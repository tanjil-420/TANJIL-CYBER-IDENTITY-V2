
const express = require("express");
const { pool } = require("../config/database");
const adminConfig = require("../config/config.json").admin;
const {
    requireAuth,
    requireAdmin
} = require("../middleware/auth");

const router = express.Router();
const PROFILE_RANKS = [
    "BEGINNER",
    "SKILL EXPLORER",
    "SKILL BUILDER",
    "VERIFIED CREATOR",
    "COMMUNITY MENTOR",
    "MODERATOR",
    "OPERATOR",
    "PLATFORM OWNER"
];

router.use(requireAuth, requireAdmin);

router.get("/configuration", (req, res) => {
    res.json({
        success: true,
        configuration: adminConfig
    });
});

// ADMIN STATISTICS
router.get("/stats", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users
                    WHERE is_active = TRUE) AS active_users,
                (SELECT COUNT(*) FROM conversations) AS total_chats,
                (SELECT COUNT(*) FROM messages) AS total_messages,
                (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_week,
                (SELECT COUNT(*) FROM skill_test_enrollments WHERE status = 'active') AS active_events,
                (SELECT COUNT(*) FROM skill_test_tasks WHERE status = 'submitted') AS pending_reviews,
                (SELECT COUNT(*) FROM challenges WHERE status = 'open') AS open_challenges,
                (SELECT COUNT(*) FROM challenge_submissions WHERE status = 'submitted') AS pending_challenge_submissions,
                (SELECT COUNT(*) FROM site_visitors) AS unique_visitors
        `);

        res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (error) {
        next(error);
    }
});

// ALL USERS
router.get("/users", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.role, u.is_platform_owner,
                    u.is_active, u.created_at, p.rank_title
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
             ORDER BY u.created_at DESC
             LIMIT 200`
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        next(error);
    }
});

// CHANGE USER ACCOUNT STATUS
router.patch("/users/:id/status", async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const isActive = req.body.isActive;

        if (!Number.isSafeInteger(userId) ||
            userId <= 0 ||
            typeof isActive !== "boolean") {
            return res.status(400).json({
                error: "Invalid account information."
            });
        }

        if (userId === Number(req.user.id)) {
            return res.status(400).json({
                error: "You cannot disable your own account."
            });
        }
        const target = await pool.query("SELECT is_platform_owner FROM users WHERE id = $1", [userId]);
        if (target.rows[0]?.is_platform_owner) {
            return res.status(403).json({ error: "The Platform Owner account cannot be disabled." });
        }

        const result = await pool.query(
            `UPDATE users
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, username, is_active`,
            [isActive, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        next(error);
    }
});

// CHANGE USER ROLE
router.patch("/users/:id/role", async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const role = req.body.role;

        if (!Number.isSafeInteger(userId) ||
            userId <= 0 ||
            !["user", "admin"].includes(role)) {
            return res.status(400).json({
                error: "Invalid role information."
            });
        }

        if (userId === Number(req.user.id)) {
            return res.status(400).json({
                error: "You cannot change your own role."
            });
        }
        const target = await pool.query("SELECT is_platform_owner FROM users WHERE id = $1", [userId]);
        if (target.rows[0]?.is_platform_owner) {
            return res.status(403).json({ error: "The Platform Owner role cannot be changed." });
        }

        const result = await pool.query(
            `UPDATE users
             SET role = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, username, role`,
            [role, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        next(error);
    }
});

router.patch("/users/:id/rank", async (req, res, next) => {
    const userId = Number(req.params.id);
    const rank = req.body.rank;
    if (!Number.isSafeInteger(userId) || userId <= 0 || !PROFILE_RANKS.includes(rank)) {
        return res.status(400).json({ error: "Invalid rank information." });
    }
    try {
        if (rank === "PLATFORM OWNER") {
            const owner = await pool.query("SELECT is_platform_owner FROM users WHERE id = $1", [userId]);
            if (!owner.rows[0]?.is_platform_owner) {
                return res.status(403).json({ error: "Only the founder account can hold the Platform Owner rank." });
            }
        }
        const result = await pool.query(
            `UPDATE profiles SET rank_title = $1, updated_at = NOW()
             WHERE user_id = $2 RETURNING user_id, rank_title`,
            [rank, userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: "User profile not found." });
        res.json({ success: true, rank: result.rows[0].rank_title });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
