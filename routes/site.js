const express = require("express");
const crypto = require("crypto");
const { pool } = require("../config/database");

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production";
const VISITOR_COOKIE = "tanjil.visitor";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

function readCookie(req, name) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) continue;
        const key = part.slice(0, separator).trim();
        if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
    }
    return null;
}

router.get("/stats", async (req, res, next) => {
    try {
        let visitorToken = readCookie(req, VISITOR_COOKIE);
        if (!visitorToken || !/^[a-f0-9]{64}$/.test(visitorToken)) {
            visitorToken = crypto.randomBytes(32).toString("hex");
            res.cookie(VISITOR_COOKIE, visitorToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: "lax",
                maxAge: COOKIE_MAX_AGE,
                path: "/"
            });
        }

        const visitorHash = crypto.createHash("sha256").update(visitorToken).digest("hex");
        await pool.query(
            `INSERT INTO site_visitors (visitor_hash)
             VALUES ($1)
             ON CONFLICT (visitor_hash)
             DO UPDATE SET last_seen = NOW()`,
            [visitorHash]
        );

        const result = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM site_visitors) AS visitor_count,
                (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS member_count,
                (SELECT id FROM users WHERE id = $1 AND is_active = TRUE) AS member_number`,
            [req.session?.userId || null]
        );

        const row = result.rows[0];
        res.json({
            success: true,
            visitorCount: Number(row.visitor_count || 0),
            memberCount: Number(row.member_count || 0),
            memberNumber: row.member_number ? Number(row.member_number) : null
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
