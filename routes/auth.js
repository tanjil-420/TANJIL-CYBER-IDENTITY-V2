
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function validUsername(username) {
    return /^(?=.{3,30}$)[a-zA-Z0-9]+(?:[._][a-zA-Z0-9]+)*$/.test(username);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// REGISTER
router.post("/register", async (req, res, next) => {
    const username = String(req.body.username || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!validUsername(username)) {
        return res.status(400).json({
            error: "Username must be 3-30 characters and use letters, numbers, dots or underscores."
        });
    }

    if (!validEmail(email) || email.length > 255) {
        return res.status(400).json({
            error: "Enter a valid email address."
        });
    }

    if (password.length < 10 || password.length > 72) {
        return res.status(400).json({
            error: "Password must contain 10-72 characters."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const passwordHash = await bcrypt.hash(password, 12);

        const userResult = await client.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, role`,
            [username, email, passwordHash]
        );

        const user = userResult.rows[0];

        await client.query(
            `INSERT INTO profiles (user_id, display_name)
             VALUES ($1, $2)`,
            [user.id, username]
        );

        await client.query("COMMIT");

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        req.session.userId = user.id;

        await new Promise((resolve, reject) => {
            req.session.save(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Username or email is already registered."
            });
        }

        next(error);

    } finally {
        client.release();
    }
});

// LOGIN
router.post("/login", async (req, res, next) => {
    const identity = String(req.body.identity || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    if (!identity || !password || password.length > 72) {
        return res.status(400).json({
            error: "Enter your username/email and password."
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, email, password_hash, role, is_active
             FROM users
             WHERE username = $1 OR email = $1
             LIMIT 1`,
            [identity]
        );

        if (!result.rows.length) {
            return res.status(401).json({
                error: "Invalid login credentials."
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                error: "Your account has been disabled."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!validPassword) {
            return res.status(401).json({
                error: "Invalid login credentials."
            });
        }

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        req.session.userId = user.id;

        await new Promise((resolve, reject) => {
            req.session.save(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        res.json({
            success: true,
            message: "Login successful.",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        next(error);
    }
});

// CURRENT USER
router.get("/me", requireAuth, (req, res) => {
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// LOGOUT
router.post("/logout", requireAuth, (req, res, next) => {
    req.session.destroy(error => {
        if (error) return next(error);

        res.clearCookie("tanjil.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

module.exports = router;
