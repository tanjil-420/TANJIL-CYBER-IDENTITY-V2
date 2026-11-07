
const { pool } = require("../config/database");

async function requireAuth(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                error: "Please login to continue."
            });
        }

        const result = await pool.query(
            `SELECT id, username, email, role, is_platform_owner, is_active
             FROM users
             WHERE id = $1`,
            [req.session.userId]
        );

        if (!result.rows.length || !result.rows[0].is_active) {
            return req.session.destroy(() => {
                res.status(401).json({
                    error: "Your account is unavailable."
                });
            });
        }

        req.user = result.rows[0];

        next();

    } catch (error) {
        next(error);
    }
}

async function requireAdmin(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: "Authentication required."
            });
        }

        if (req.user.role !== "admin") {
            return res.status(403).json({
                error: "Admin permission required."
            });
        }

        next();

    } catch (error) {
        next(error);
    }
}

module.exports = {
    requireAuth,
    requireAdmin
};
