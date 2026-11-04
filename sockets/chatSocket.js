
const { pool } = require("../config/database");

function attachChatSocket(io) {

    io.use(async (socket, next) => {
        try {
            const session = socket.request.session;

            if (!session || !session.userId) {
                return next(new Error("Authentication required."));
            }

            const result = await pool.query(
                `SELECT id, username, is_active
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
                const content = typeof data?.content === "string"
                    ? data.content.trim()
                    : "";

                if (!Number.isSafeInteger(conversationId) ||
                    conversationId <= 0) {
                    throw new Error("Invalid conversation.");
                }

                if (!content || content.length > 4000) {
                    throw new Error(
                        "Message must contain 1 to 4000 characters."
                    );
                }

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

                const result = await pool.query(
                    `INSERT INTO messages (
                        conversation_id,
                        sender_id,
                        content
                    )
                    VALUES ($1, $2, $3)
                    RETURNING id, conversation_id, sender_id,
                    content, message_type, created_at`,
                    [conversationId, userId, content]
                );

                const message = {
                    ...result.rows[0],
                    sender_username: socket.user.username
                };

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
