
const { pool } = require("../config/database");

function attachChatSocket(io) {

    io.use(async (socket, next) => {
        try {
            const session = socket.request.session;

            if (!session || !session.userId) {
                return next(new Error("Authentication required."));
            }

            const result = await pool.query(
                `SELECT id, username, is_active, role
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

        socket.join(`user:${userId}`);

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
                            u.username AS sender_username, u.role AS sender_role, p.avatar_url AS sender_avatar_url,
                            r.content AS reply_content, ru.username AS reply_sender_username
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

                io.to(`conversation:${conversationId}`).emit(
                    "chat:read:update",
                    {
                        conversationId,
                        userId,
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

        socket.on("disconnect", () => {
            console.log(
                `Messenger disconnected: ${socket.user.username}`
            );
        });
    });
}

module.exports = { attachChatSocket };
