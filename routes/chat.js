
const express = require("express");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// SEARCH USERS
router.get("/users", async (req, res, next) => {
    try {
        const query = String(req.query.q || "").trim().toLowerCase();

        if (query.length < 3 || query.length > 30) {
            return res.status(400).json({
                error: "Search requires 3-30 characters."
            });
        }

        const result = await pool.query(
            `SELECT u.id, u.username, p.avatar_url
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.username LIKE $1 AND u.id != $2 AND u.is_active = TRUE
             ORDER BY u.username LIMIT 20`,
            [`%${query}%`, req.user.id]
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        next(error);
    }
});

// CREATE OR OPEN PRIVATE CHAT
router.post("/private", async (req, res, next) => {
    const otherUserId = Number(req.body.userId);
    const client = await pool.connect();

    try {
        if (!Number.isSafeInteger(otherUserId) ||
            otherUserId <= 0 ||
            otherUserId === Number(req.user.id)) {
            return res.status(400).json({
                error: "Invalid recipient."
            });
        }

        await client.query("BEGIN");

        const userCheck = await client.query(
            `SELECT id FROM users
             WHERE id = $1 AND is_active = TRUE`,
            [otherUserId]
        );

        if (!userCheck.rows.length) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "User not found."
            });
        }

        const existing = await client.query(
            `SELECT c.id
             FROM conversations c
             JOIN conversation_members a
                ON a.conversation_id = c.id
             JOIN conversation_members b
                ON b.conversation_id = c.id
             WHERE c.type = 'private'
             AND a.user_id = $1
             AND b.user_id = $2
             AND (
                SELECT COUNT(*)
                FROM conversation_members x
                WHERE x.conversation_id = c.id
             ) = 2
             LIMIT 1`,
            [req.user.id, otherUserId]
        );

        if (existing.rows.length) {
            await client.query("COMMIT");

            return res.json({
                success: true,
                conversationId: existing.rows[0].id,
                existing: true
            });
        }

        const conversation = await client.query(
            `INSERT INTO conversations (type, created_by)
             VALUES ('private', $1)
             RETURNING id`,
            [req.user.id]
        );

        const conversationId = conversation.rows[0].id;

        await client.query(
            `INSERT INTO conversation_members
             (conversation_id, user_id, member_role)
             VALUES
             ($1, $2, 'owner'),
             ($1, $3, 'member')`,
            [conversationId, req.user.id, otherUserId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            conversationId,
            existing: false
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);

    } finally {
        client.release();
    }
});

// CREATE GROUP
router.post("/groups", async (req, res, next) => {
    const name = typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

    const members = Array.isArray(req.body.memberIds)
        ? [...new Set(req.body.memberIds.map(Number))]
        : [];

    if (!name || name.length > 80) {
        return res.status(400).json({
            error: "Group name must contain 1-80 characters."
        });
    }

    if (members.length > 49 ||
        members.some(id => !Number.isSafeInteger(id) || id <= 0) ||
        members.includes(Number(req.user.id))) {
        return res.status(400).json({
            error: "Invalid group members."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (members.length) {
            const users = await client.query(
                `SELECT id FROM users
                 WHERE id = ANY($1::bigint[])
                 AND is_active = TRUE`,
                [members]
            );

            if (users.rows.length !== members.length) {
                throw new Error("One or more members are unavailable.");
            }
        }

        const group = await client.query(
            `INSERT INTO conversations
             (type, name, created_by)
             VALUES ('group', $1, $2)
             RETURNING id`,
            [name, req.user.id]
        );

        const conversationId = group.rows[0].id;

        await client.query(
            `INSERT INTO conversation_members
             (conversation_id, user_id, member_role)
             VALUES ($1, $2, 'owner')`,
            [conversationId, req.user.id]
        );

        for (const memberId of members) {
            await client.query(
                `INSERT INTO conversation_members
                 (conversation_id, user_id)
                 VALUES ($1, $2)`,
                [conversationId, memberId]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            conversationId,
            message: "Group created successfully."
        });

    } catch (error) {
        await client.query("ROLLBACK");

        if (error.message.startsWith("One or more")) {
            return res.status(400).json({
                error: error.message
            });
        }

        next(error);

    } finally {
        client.release();
    }
});

// ADD GROUP MEMBER
router.post("/groups/:id/members", async (req, res, next) => {
    const conversationId = Number(req.params.id);
    const memberId = Number(req.body.userId);

    if (!Number.isSafeInteger(conversationId) ||
        conversationId <= 0 ||
        !Number.isSafeInteger(memberId) ||
        memberId <= 0) {
        return res.status(400).json({
            error: "Invalid member information."
        });
    }

    try {
        const permission = await pool.query(
            `SELECT c.type, cm.member_role
             FROM conversations c
             JOIN conversation_members cm
             ON cm.conversation_id = c.id
             WHERE c.id = $1 AND cm.user_id = $2`,
            [conversationId, req.user.id]
        );

        if (!permission.rows.length ||
            permission.rows[0].type !== "group" ||
            !["owner", "admin"].includes(permission.rows[0].member_role)) {
            return res.status(403).json({
                error: "Group admin permission required."
            });
        }

        const result = await pool.query(
            `INSERT INTO conversation_members
             (conversation_id, user_id)
             SELECT $1, id
             FROM users
             WHERE id = $2 AND is_active = TRUE
             ON CONFLICT DO NOTHING
             RETURNING user_id`,
            [conversationId, memberId]
        );

        const exists = await pool.query(
            `SELECT 1 FROM conversation_members
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, memberId]
        );

        if (!exists.rows.length) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        res.json({
            success: true,
            added: result.rows.length > 0
        });

    } catch (error) {
        next(error);
    }
});

// CONVERSATION LIST
router.get("/conversations", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
                c.id,
                c.type,
                c.name,
                c.created_at,
                (SELECT u.id FROM conversation_members other_member JOIN users u ON u.id = other_member.user_id WHERE other_member.conversation_id = c.id AND other_member.user_id != $1 LIMIT 1) AS other_user_id,
                (SELECT u.username FROM conversation_members other_member JOIN users u ON u.id = other_member.user_id WHERE other_member.conversation_id = c.id AND other_member.user_id != $1 LIMIT 1) AS other_username,
                (SELECT p.avatar_url FROM conversation_members other_member JOIN profiles p ON p.user_id = other_member.user_id WHERE other_member.conversation_id = c.id AND other_member.user_id != $1 LIMIT 1) AS other_avatar_url,
                (SELECT p.is_public FROM conversation_members other_member JOIN profiles p ON p.user_id = other_member.user_id WHERE other_member.conversation_id = c.id AND other_member.user_id != $1 LIMIT 1) AS other_profile_public,
                (SELECT u.role FROM conversation_members other_member JOIN users u ON u.id = other_member.user_id WHERE other_member.conversation_id = c.id AND other_member.user_id != $1 LIMIT 1) AS other_role,
                (
                    SELECT m.content
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT COUNT(*)
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    AND m.sender_id != $1
                    AND m.created_at > COALESCE(cm.last_read_at, '-infinity')
                ) AS unread_count
             FROM conversations c
             JOIN conversation_members cm
             ON cm.conversation_id = c.id
             WHERE cm.user_id = $1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            conversations: result.rows
        });

    } catch (error) {
        next(error);
    }
});

// CHAT INFO / PUBLIC ID
router.get("/:id/info", async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return res.status(400).json({ error: "Invalid conversation." });
        const membership = await pool.query("SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [conversationId, req.user.id]);
        if (!membership.rows.length) return res.status(403).json({ error: "Conversation access denied." });
        const conversation = await pool.query("SELECT id, type, name FROM conversations WHERE id = $1", [conversationId]);
        if (!conversation.rows.length) return res.status(404).json({ error: "Conversation not found." });
        const members = await pool.query(`SELECT u.username, p.display_name, p.avatar_url, p.is_public, p.bio, p.skills
             FROM conversation_members cm JOIN users u ON u.id = cm.user_id
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE cm.conversation_id = $1 AND u.id <> $2 ORDER BY u.username`, [conversationId, req.user.id]);
        const profiles = members.rows.map(row => ({ username: row.username, displayName: row.display_name || row.username, avatarUrl: row.avatar_url || "",
            isPublic: row.is_public === true, publicId: row.is_public === true ? "@" + row.username : null,
            bio: row.is_public === true ? (row.bio || "") : "", skills: row.is_public === true && Array.isArray(row.skills) ? row.skills : [],
            profileUrl: row.is_public === true ? "/public-profile.html?username=" + encodeURIComponent(row.username) : null }));
        res.json({ success: true, conversation: conversation.rows[0], members: profiles });
    } catch (error) { next(error); }
});

// MESSAGE HISTORY
router.get("/:id/messages", async (req, res, next) => {
    try {
        const conversationId = Number(req.params.id);
        const beforeId = req.query.before
            ? Number(req.query.before)
            : null;

        if (!Number.isSafeInteger(conversationId) ||
            conversationId <= 0 ||
            (beforeId !== null &&
            (!Number.isSafeInteger(beforeId) || beforeId <= 0))) {
            return res.status(400).json({
                error: "Invalid conversation or message ID."
            });
        }

        const member = await pool.query(
            `SELECT 1 FROM conversation_members
             WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, req.user.id]
        );

        if (!member.rows.length) {
            return res.status(403).json({
                error: "Conversation access denied."
            });
        }

        const result = await pool.query(
            `SELECT m.id, m.conversation_id, m.sender_id, m.reply_to_id,
                    m.content, m.message_type, m.created_at,
                    u.username AS sender_username, u.role AS sender_role, p.avatar_url AS sender_avatar_url,
                    r.content AS reply_content, ru.username AS reply_sender_username
             FROM messages m
             LEFT JOIN users u ON u.id = m.sender_id
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN messages r ON r.id = m.reply_to_id
             LEFT JOIN users ru ON ru.id = r.sender_id
             WHERE m.conversation_id = $1
             AND ($2::bigint IS NULL OR m.id < $2)
             ORDER BY m.id DESC LIMIT 50`,
            [conversationId, beforeId]
        );

        res.json({
            success: true,
            messages: result.rows.reverse()
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
