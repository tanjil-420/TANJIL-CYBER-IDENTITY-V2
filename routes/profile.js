const express = require("express");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const socialKeys = ["facebook", "instagram", "threads", "tiktok", "github", "whatsapp", "youtube"];

function clean(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validHttpsUrl(value, label) {
    if (!value) return "";
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") throw new Error();
        return url.href;
    } catch {
        throw new Error(`Invalid ${label} URL. Use a valid HTTPS link.`);
    }
}

function normalizeProfile(row) {
    const links = row.links || {};
    const socials = {};
    for (const key of socialKeys) socials[key] = links[key] || "";
    return {
        displayName: row.display_name || "",
        bio: row.bio || "",
        age: row.age || "",
        education: row.education || "",
        location: row.location || "",
        status: row.status || "",
        phone: row.phone || "",
        publicEmail: row.public_email === true,
        publicPhone: row.public_phone === true,
        website: links.website || "",
        avatarUrl: row.avatar_url || "",
        socials,
        skills: Array.isArray(row.skills) ? row.skills : [],
        isPublic: row.is_public !== false,
        theme: row.theme || "cyberpunk"
    };
}

// GET MY PROFILE
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.email,
                    p.display_name, p.bio, p.age, p.education,
                    p.location, p.status, p.phone, p.public_email,
                    p.public_phone, p.links, p.skills, p.avatar_url,
                    p.theme, p.is_public
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Profile not found." });
        const row = result.rows[0];
        res.json({
            user: { id: row.id, username: row.username, email: row.email, role: req.user.role },
            profile: normalizeProfile(row),
            publicProfileUrl: `/public-profile.html?username=${encodeURIComponent(row.username)}`
        });
    } catch (error) {
        next(error);
    }
});

// UPDATE MY PROFILE (supports the current profile editor payload)
async function updateMyProfile(req, res, next) {
    try {
        const displayName = clean(req.body.displayName, 80);
        const bio = clean(req.body.bio, 500);
        const location = clean(req.body.location, 150);
        const education = clean(req.body.education, 100);
        const status = clean(req.body.status, 50);
        const age = clean(req.body.age, 20);
        const phone = clean(req.body.phone, 30);
        const website = validHttpsUrl(clean(req.body.website, 500), "website");
        const rawAvatar = clean(req.body.avatarUrl, 600000);
        let avatarUrl = "";
        if (rawAvatar.startsWith("data:image/")) {
            if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(rawAvatar) || rawAvatar.length > 550000) {
                throw new Error("Profile image must be JPG, PNG or WebP and smaller than 400 KB.");
            }
            avatarUrl = rawAvatar;
        } else {
            avatarUrl = validHttpsUrl(rawAvatar, "avatar");
        }
        const socialsInput = req.body.socials || req.body.links || {};
        const links = { website };
        for (const key of socialKeys) {
            links[key] = validHttpsUrl(clean(socialsInput[key], 500), key);
        }

        const skillsInput = Array.isArray(req.body.skills)
            ? req.body.skills
            : typeof req.body.skills === "string"
                ? req.body.skills.split(/[\n,]/)
                : [];
        const skills = [...new Set(skillsInput.map(value => clean(value, 50)).filter(Boolean))].slice(0, 30);
        const isPublic = typeof req.body.isPublic === "boolean" ? req.body.isPublic : true;

        const result = await pool.query(
            `UPDATE profiles
             SET display_name = $1,
                 bio = $2,
                 location = $3,
                 education = COALESCE(NULLIF($4, ''), education),
                 status = COALESCE(NULLIF($5, ''), status),
                 age = COALESCE(NULLIF($6, ''), age),
                 phone = COALESCE(NULLIF($7, ''), phone),
                 links = $8::jsonb,
                 avatar_url = NULLIF($9, ''),
                 skills = $10::jsonb,
                 is_public = $11,
                 updated_at = NOW()
             WHERE user_id = $12
             RETURNING *`,
            [displayName, bio, location, education, status, age, phone,
                JSON.stringify(links), avatarUrl, JSON.stringify(skills), isPublic, req.user.id]
        );

        if (!result.rows.length) return res.status(404).json({ error: "Profile not found." });
        res.json({
            success: true,
            message: "Profile updated successfully.",
            profile: normalizeProfile(result.rows[0]),
            publicProfileUrl: `/public-profile.html?username=${encodeURIComponent(req.user.username)}`
        });
    } catch (error) {
        if (error.message.startsWith("Invalid ")) return res.status(400).json({ error: error.message });
        next(error);
    }
}

router.put("/me", requireAuth, updateMyProfile);
router.patch("/me", requireAuth, updateMyProfile);

// CHANGE PUBLIC VISIBILITY
router.patch("/visibility", requireAuth, async (req, res, next) => {
    try {
        if (typeof req.body.isPublic !== "boolean") return res.status(400).json({ error: "Invalid visibility setting." });
        await pool.query("UPDATE profiles SET is_public = $1, updated_at = NOW() WHERE user_id = $2", [req.body.isPublic, req.user.id]);
        res.json({ success: true, isPublic: req.body.isPublic });
    } catch (error) {
        next(error);
    }
});

// PUBLIC PROFILE
router.get("/public/:username", async (req, res, next) => {
    try {
        const username = String(req.params.username || "").trim().toLowerCase();
        const result = await pool.query(
            `SELECT u.username, u.email, p.display_name, p.bio, p.age,
                    p.education, p.location, p.status, p.phone,
                    p.public_phone, p.public_email, p.links, p.skills,
                    p.avatar_url, p.theme
             FROM users u
             JOIN profiles p ON p.user_id = u.id
             WHERE u.username = $1 AND u.is_active = TRUE AND p.is_public = TRUE`,
            [username]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Public profile not found." });
        const row = result.rows[0];
        const profile = normalizeProfile({ ...row, is_public: true });
        if (!row.public_phone) profile.phone = null;
        const email = row.public_email ? row.email : null;
        res.json({ success: true, profile: { ...profile, username: row.username, email } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
