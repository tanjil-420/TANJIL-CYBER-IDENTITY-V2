
const express = require("express");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const allowedLinks = [
    "facebook",
    "instagram",
    "threads",
    "tiktok",
    "github",
    "website",
    "youtube"
];

function clean(value, maxLength) {
    return typeof value === "string"
        ? value.trim().slice(0, maxLength)
        : "";
}

function validateLinks(input) {
    const result = {};

    for (const key of allowedLinks) {
        const value = clean(input?.[key], 500);

        if (!value) continue;

        try {
            const url = new URL(value);

            if (url.protocol !== "https:") {
                throw new Error("Only HTTPS links are allowed.");
            }

            result[key] = url.href;

        } catch {
            throw new Error(`Invalid ${key} URL.`);
        }
    }

    return result;
}

// GET MY PROFILE
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.username, u.email,
                    p.display_name, p.bio, p.age,
                    p.education, p.location, p.status,
                    p.phone, p.public_email, p.public_phone,
                    p.links, p.theme, p.is_public
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "Profile not found."
            });
        }

        res.json({
            profile: result.rows[0]
        });

    } catch (error) {
        next(error);
    }
});

// UPDATE MY PROFILE
router.put("/me", requireAuth, async (req, res, next) => {
    try {
        const links = validateLinks(req.body.links || {});

        const displayName = clean(req.body.displayName, 80);
        const bio = clean(req.body.bio, 500);
        const age = clean(req.body.age, 20);
        const education = clean(req.body.education, 100);
        const location = clean(req.body.location, 150);
        const status = clean(req.body.status, 50);
        const phone = clean(req.body.phone, 30);

        const publicEmail = req.body.publicEmail === true;
        const publicPhone = req.body.publicPhone === true;

        const theme = clean(req.body.theme, 30) || "cyberpunk";

        await pool.query(
            `UPDATE profiles
             SET display_name = $1,
                 bio = $2,
                 age = $3,
                 education = $4,
                 location = $5,
                 status = $6,
                 phone = $7,
                 public_email = $8,
                 public_phone = $9,
                 links = $10::jsonb,
                 theme = $11,
                 updated_at = NOW()
             WHERE user_id = $12`,
            [
                displayName,
                bio,
                age,
                education,
                location,
                status,
                phone,
                publicEmail,
                publicPhone,
                JSON.stringify(links),
                theme,
                req.user.id
            ]
        );

        res.json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (error) {
        if (error.message.startsWith("Invalid ")) {
            return res.status(400).json({
                error: error.message
            });
        }

        next(error);
    }
});

// CHANGE PUBLIC VISIBILITY
router.patch("/visibility", requireAuth, async (req, res, next) => {
    try {
        if (typeof req.body.isPublic !== "boolean") {
            return res.status(400).json({
                error: "Invalid visibility setting."
            });
        }

        await pool.query(
            `UPDATE profiles
             SET is_public = $1, updated_at = NOW()
             WHERE user_id = $2`,
            [req.body.isPublic, req.user.id]
        );

        res.json({
            success: true,
            isPublic: req.body.isPublic
        });

    } catch (error) {
        next(error);
    }
});

// PUBLIC PROFILE
router.get("/public/:username", async (req, res, next) => {
    try {
        const username = String(req.params.username)
            .trim()
            .toLowerCase();

        const result = await pool.query(
            `SELECT
                u.username,
                u.email,
                p.display_name,
                p.bio,
                p.age,
                p.education,
                p.location,
                p.status,
                p.phone,
                p.public_phone,
                p.public_email,
                p.links,
                p.theme
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.username = $1
             AND u.is_active = TRUE
             AND p.is_public = TRUE`,
            [username]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                error: "Public profile not found."
            });
        }

        const profile = result.rows[0];

        if (!profile.public_phone) {
            profile.phone = null;
        }

        if (!profile.public_email) {
            profile.email = null;
        }

        res.json({
            profile
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
