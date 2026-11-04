
const express = require("express");
const { pool } = require("../config/database");
const {
    requireAuth,
    requireAdmin
} = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// ADMIN STATISTICS
router.get("/stats", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users
                    WHERE is_active = TRUE) AS active_users,
                (SELECT COUNT(*) FROM conversations) AS total_chats,
                (SELECT COUNT(*) FROM messages) AS total_messages
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
            `SELECT id, username, email, role,
                    is_active, created_at
             FROM users
             ORDER BY created_at DESC
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

module.exports = router;
