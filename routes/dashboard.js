const express = require("express");
const QRCode = require("qrcode");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.role, u.is_active, u.is_platform_owner, u.created_at,
                    p.display_name, p.bio, p.location, p.education,
                    p.skills, p.rank_title, p.is_public
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Account not found." });

        const row = result.rows[0];
        const unreadResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM messages m
             JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
             WHERE cm.user_id = $1
               AND m.sender_id IS DISTINCT FROM $1
               AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`,
            [req.user.id]
        );

        const baseUrl = (process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || "localhost:3000"}`).replace(/\/+$/, "");
        const publicProfileUrl = `${baseUrl}/user/${encodeURIComponent(row.username)}`;
        const qrCodeUrl = await QRCode.toDataURL(publicProfileUrl, { errorCorrectionLevel: "H", width: 800, margin: 2 });

        res.json({
            success: true,
            user: {
                id: row.id,
                username: row.username,
                email: row.email,
                role: row.role,
                isFounder: row.is_platform_owner === true,
                isActive: row.is_active,
                createdAt: row.created_at,
                displayName: row.display_name
            },
            profile: {
                displayName: row.display_name,
                bio: row.bio,
                location: row.location,
                education: row.education,
                skills: row.skills || [],
                rankTitle: row.rank_title || "BEGINNER",
                isPublic: row.is_public
            },
            unreadMessages: Number(unreadResult.rows[0].total || 0),
            publicProfileUrl,
            qrCodeUrl
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
