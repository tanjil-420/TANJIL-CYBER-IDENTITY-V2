
const { pool } = require("../config/database");

const REACTION_EMOJIS = new Set(["👍", "❤️", "😂", "🎉", "🔥", "👏"]);
const onlineUsers = new Map();
const eventWindows = new Map();

function allowEvent(userId, event, limit, windowMs) {
    const key = `${userId}:${event}`;
    const now = Date.now();
    const events = (eventWindows.get(key) || []).filter(timestamp => now - timestamp < windowMs);
    if (events.length >= limit) {
        eventWindows.set(key, events);
        return false;
    }
    events.push(now);
    eventWindows.set(key, events);
    return true;
}

function attachChatSocket(io) {

    io.use(async (socket, next) => {
        try {
            const session = socket.request.session;

            if (!session || !session.userId) {
                return next(new Error("Authentication required."));
            }

            const result = await pool.query(
                `SELECT id, username, is_active, role, is_platform_owner
                 FROM users
                 WHERE id = $1`,
                [session.userId]
            );

            if (!result.rows.length || !result.rows[0].is_active) {
                return next(new Error("Account unavailable."));
            }

            socket.user = result.rows[0];

            next();

        } catch (error) {
            next(new Error("Authentication failed."));
        }
    });

    io.on("connection", socket => {

        const userId = socket.user.id;
        const key = String(userId);
        const typingLastSent = new Map();
        const presence = onlineUsers.get(key) || { userId, username: socket.user.username, sockets: 0 };
        presence.sockets++;
        onlineUsers.set(key, presence);

        socket.join(`user:${userId}`);
        socket.emit("presence:snapshot", [...onlineUsers.values()].map(({ userId: id, username }) => ({ userId: id, username })));
        if (presence.sockets === 1) {
            io.emit("presence:update", { userId, username: socket.user.username, online: true });
        }

        console.log(
            `Messenger connected: ${socket.user.username}`
        );

        // LOAD USER CONVERSATIONS
        socket.on("chat:sync", async callback => {
            try {
                const result = await pool.query(
                    `SELECT c.id, c.type, c.name
                     FROM conversations c
                     JOIN conversation_members cm
                     ON cm.conversation_id = c.id
                     WHERE cm.user_id = $1`,
                    [userId]
                );

                for (const conversation of result.rows) {
                    socket.join(`conversation:${conversation.id}`);
                }

                if (typeof callback === "function") {
                    callback({
                        success: true,
                        conversations: result.rows
                    });
                }

            } catch (error) {
                if (typeof callback === "function") {
                    callback({
                        success: false,
                        error: "Unable to load conversations."
                    });
                }
            }
        });

        // JOIN A CONVERSATION
        socket.on("chat:join", async (data, callback) => {
            try {
                const conversationId = Number(data?.conversationId);

                if (!Number.isSafeInteger(conversationId) ||
                    conversationId <= 0) {
                    throw new Error("Invalid conversation.");
                }

                const result = await pool.query(
                    `SELECT 1
                     FROM conversation_members
                     WHERE conversation_id = $1
                     AND user_id = $2`,
                    [conversationId, userId]
                );

                if (!result.rows.length) {
                    throw new Error("Access denied.");
                }

                socket.join(`conversation:${conversationId}`);

                if (typeof callback === "function") {
                    callback({ success: true });
                }

            } catch (error) {
                if (typeof callback === "function") {
                    callback({
                        success: false,
                        error: error.message
                    });
                }
            }
        });

        // SEND MESSAGE
        socket.on("chat:send", async (data, callback) => {
            try {
                const conversationId = Number(data?.conversationId);
                const content = typeof data?.content === "string" ? data.content.trim() : "";
                const replyToId = data?.replyToId == null ? null : Number(data.replyToId);

                if (!Number.isSafeInteger(conversationId) ||
                    conversationId <= 0) {
                    throw new Error("Invalid conversation.");
                }

                if (!content || content.length > 4000) throw new Error("Message must contain 1 to 4000 characters.");
                if (replyToId !== null && (!Number.isSafeInteger(replyToId) || replyToId <= 0)) throw new Error("Invalid reply target.");
                if (!allowEvent(userId, "message", 30, 60_000)) throw new Error("Message rate limit reached. Please wait before sending more.");

                const membership = await pool.query(
                    `SELECT 1
                     FROM conversation_members
                     WHERE conversation_id = $1
                     AND user_id = $2`,
                    [conversationId, userId]
                );

                if (!membership.rows.length) {
                    throw new Error("You are not a conversation member.");
                }

                if (replyToId !== null) {
                    const parent = await pool.query("SELECT id FROM messages WHERE id = $1 AND conversation_id = $2", [replyToId, conversationId]);
                    if (!parent.rows.length) throw new Error("The message you are replying to is unavailable.");
                }

                const inserted = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, reply_to_id)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id`,
                    [conversationId, userId, content, replyToId]
                );
                const messageResult = await pool.query(
                    `SELECT m.id, m.conversation_id, m.sender_id, m.reply_to_id, m.content, m.message_type, m.created_at,
                            u.username AS sender_username, u.role AS sender_role, u.is_platform_owner AS sender_is_founder, p.avatar_url AS sender_avatar_url,
                            r.content AS reply_content, ru.username AS reply_sender_username,
                            '[]'::json AS reactions, ARRAY[]::text[] AS read_by
                     FROM messages m LEFT JOIN users u ON u.id = m.sender_id
                     LEFT JOIN profiles p ON p.user_id = u.id
                     LEFT JOIN messages r ON r.id = m.reply_to_id
                     LEFT JOIN users ru ON ru.id = r.sender_id
                     WHERE m.id = $1`, [inserted.rows[0].id]
                );
                const message = messageResult.rows[0];

                io.to(`conversation:${conversationId}`).emit(
                    "chat:new",
                    message
                );

                if (typeof callback === "function") {
                    callback({
                        success: true,
                        message
                    });
                }

            } catch (error) {
                if (typeof callback === "function") {
                    callback({
                        success: false,
                        error: error.message
                    });
                }
            }
        });

        // READ MESSAGES
        socket.on("chat:read", async (data, callback) => {
            try {
                const conversationId = Number(data?.conversationId);

                if (!Number.isSafeInteger(conversationId) ||
                    conversationId <= 0) {
                    throw new Error("Invalid conversation.");
                }

                const result = await pool.query(
                    `UPDATE conversation_members
                     SET last_read_at = NOW()
                     WHERE conversation_id = $1
                     AND user_id = $2
                     RETURNING conversation_id`,
                    [conversationId, userId]
                );

                if (!result.rows.length) {
                    throw new Error("Access denied.");
                }

                await pool.query(
                    `INSERT INTO message_read_receipts (message_id, user_id)
                     SELECT id, $2 FROM messages
                     WHERE conversation_id = $1 AND sender_id IS DISTINCT FROM $2
                     ORDER BY id DESC LIMIT 50
                     ON CONFLICT DO NOTHING`,
                    [conversationId, userId]
                );
                const receipts = await pool.query(
                    `SELECT message_id
                     FROM message_read_receipts
                     WHERE user_id = $1
                       AND message_id IN (
                           SELECT id FROM messages
                           WHERE conversation_id = $2 AND sender_id IS DISTINCT FROM $1
                           ORDER BY id DESC LIMIT 50
                       )`,
                    [userId, conversationId]
                );
                const messageIds = receipts.rows.map(row => row.message_id);

                io.to(`conversation:${conversationId}`).emit(
                    "chat:read:update",
                    {
                        conversationId,
                        userId,
                        username: socket.user.username,
                        messageIds,
                        lastReadAt: new Date().toISOString()
                    }
                );

                if (typeof callback === "function") {
                    callback({ success: true });
                }

            } catch (error) {
                if (typeof callback === "function") {
                    callback({
                        success: false,
                        error: error.message
                    });
                }
            }
        });

        socket.on("chat:typing", async (data, callback) => {
            try {
                const conversationId = Number(data?.conversationId);
                const isTyping = data?.typing === true;
                if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
                    throw new Error("Invalid conversation.");
                }
                const now = Date.now();
                if (now - (typingLastSent.get(conversationId) || 0) < 400) return;
                typingLastSent.set(conversationId, now);
                const membership = await pool.query(
                    "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
                    [conversationId, userId]
                );
                if (!membership.rows.length) throw new Error("Access denied.");
                socket.to(`conversation:${conversationId}`).emit("chat:typing", {
                    conversationId,
                    userId,
                    username: socket.user.username,
                    typing: isTyping
                });
                if (typeof callback === "function") callback({ success: true });
            } catch (error) {
                if (typeof callback === "function") callback({ success: false, error: error.message });
            }
        });

        socket.on("chat:reaction", async (data, callback) => {
            try {
                const conversationId = Number(data?.conversationId);
                const messageId = Number(data?.messageId);
                const emoji = data?.emoji;
                if (!Number.isSafeInteger(conversationId) || conversationId <= 0 ||
                    !Number.isSafeInteger(messageId) || messageId <= 0 ||
                    !REACTION_EMOJIS.has(emoji)) {
                    throw new Error("Invalid reaction.");
                }
                if (!allowEvent(userId, "reaction", 60, 60_000)) throw new Error("Reaction rate limit reached. Please wait before reacting again.");
                const member = await pool.query(
                    `SELECT 1 FROM conversation_members
                     WHERE conversation_id = $1 AND user_id = $2`,
                    [conversationId, userId]
                );
                if (!member.rows.length) throw new Error("Access denied.");
                const target = await pool.query(
                    "SELECT 1 FROM messages WHERE id = $1 AND conversation_id = $2",
                    [messageId, conversationId]
                );
                if (!target.rows.length) throw new Error("Message not found.");
                const existing = await pool.query(
                    "SELECT emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2",
                    [messageId, userId]
                );
                if (existing.rows[0]?.emoji === emoji) {
                    await pool.query("DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2", [messageId, userId]);
                } else {
                    await pool.query(
                        `INSERT INTO message_reactions (message_id, user_id, emoji)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (message_id, user_id)
                         DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()`,
                        [messageId, userId, emoji]
                    );
                }
                const result = await pool.query(
                    `SELECT emoji, COUNT(*)::int AS count, BOOL_OR(user_id = $2) AS reacted
                     FROM message_reactions WHERE message_id = $1 GROUP BY emoji ORDER BY emoji`,
                    [messageId, userId]
                );
                const update = { conversationId, messageId, reactions: result.rows };
                io.to(`conversation:${conversationId}`).emit("chat:reaction:update", update);
                if (typeof callback === "function") callback({ success: true, ...update });
            } catch (error) {
                if (typeof callback === "function") callback({ success: false, error: error.message });
            }
        });

        socket.on("disconnect", () => {
            const current = onlineUsers.get(key);
            if (current) {
                current.sockets--;
                if (current.sockets <= 0) {
                    onlineUsers.delete(key);
                    eventWindows.delete(`${userId}:message`);
                    eventWindows.delete(`${userId}:reaction`);
                    io.emit("presence:update", { userId, username: socket.user.username, online: false });
                }
            }
            console.log(
                `Messenger disconnected: ${socket.user.username}`
            );
        });
    });
}

module.exports = { attachChatSocket };
