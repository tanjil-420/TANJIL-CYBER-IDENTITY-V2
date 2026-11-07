const express = require("express");
const { pool } = require("../config/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function clean(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validSubmissionUrl(value) {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") throw new Error();
        return url.href;
    } catch {
        return false;
    }
}

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.title, c.skill_name, c.description, c.deliverable,
                    c.status, c.created_at, s.id AS submission_id,
                    s.submission_text, s.submission_url, s.status AS submission_status,
                    s.reviewer_note, s.submitted_at
             FROM challenges c
             LEFT JOIN challenge_submissions s
               ON s.challenge_id = c.id AND s.user_id = $1
             WHERE c.status = 'open' OR $2 = TRUE
             ORDER BY c.created_at DESC
             LIMIT 100`,
            [req.user.id, req.user.role === "admin"]
        );
        res.json({ success: true, challenges: result.rows });
    } catch (error) {
        next(error);
    }
});

router.post("/", requireAdmin, async (req, res, next) => {
    const title = clean(req.body.title, 100);
    const skillName = clean(req.body.skillName, 80);
    const description = clean(req.body.description, 2500);
    const deliverable = clean(req.body.deliverable, 500);
    if (!title || !skillName || !description) {
        return res.status(400).json({ error: "Title, skill and challenge description are required." });
    }
    try {
        const result = await pool.query(
            `INSERT INTO challenges (created_by, title, skill_name, description, deliverable)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, skill_name, status, created_at`,
            [req.user.id, title, skillName, description, deliverable]
        );
        res.status(201).json({ success: true, challenge: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

router.post("/:id/submissions", async (req, res, next) => {
    const challengeId = Number(req.params.id);
    const submissionText = clean(req.body.submissionText, 2500);
    const rawUrl = clean(req.body.submissionUrl, 2000);
    const submissionUrl = validSubmissionUrl(rawUrl);
    if (!Number.isSafeInteger(challengeId) || challengeId <= 0) {
        return res.status(400).json({ error: "Invalid challenge." });
    }
    if (submissionUrl === false) {
        return res.status(400).json({ error: "Use a valid HTTPS link for your work." });
    }
    if (!submissionText && !submissionUrl) {
        return res.status(400).json({ error: "Add a project description or HTTPS link before submitting." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO challenge_submissions
                (challenge_id, user_id, submission_text, submission_url)
             SELECT id, $2, $3, $4 FROM challenges
             WHERE id = $1 AND status = 'open'
             ON CONFLICT (challenge_id, user_id)
             DO UPDATE SET submission_text = EXCLUDED.submission_text,
                           submission_url = EXCLUDED.submission_url,
                           status = 'submitted',
                           reviewer_note = NULL,
                           submitted_at = NOW(),
                           reviewed_at = NULL
             WHERE challenge_submissions.status = 'revision'
             RETURNING id, status, submitted_at`,
            [challengeId, req.user.id, submissionText, submissionUrl]
        );
        if (!result.rows.length) {
            const challenge = await pool.query("SELECT status FROM challenges WHERE id = $1", [challengeId]);
            if (!challenge.rows.length) return res.status(404).json({ error: "Challenge not found." });
            if (challenge.rows[0].status !== "open") return res.status(409).json({ error: "This challenge is closed." });
            return res.status(409).json({ error: "You already submitted work for this challenge." });
        }
        res.status(201).json({ success: true, submission: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

router.get("/admin/submissions", requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.submission_text, s.submission_url, s.submitted_at,
                    c.title AS challenge_title, c.skill_name, u.username
             FROM challenge_submissions s
             JOIN challenges c ON c.id = s.challenge_id
             JOIN users u ON u.id = s.user_id
             WHERE s.status = 'submitted'
             ORDER BY s.submitted_at ASC
             LIMIT 100`
        );
        res.json({ success: true, submissions: result.rows });
    } catch (error) {
        next(error);
    }
});

router.patch("/admin/submissions/:id", requireAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    const status = req.body.status;
    const reviewerNote = clean(req.body.reviewerNote, 800);
    if (!Number.isSafeInteger(id) || id <= 0 || !["approved", "revision"].includes(status)) {
        return res.status(400).json({ error: "Invalid review action." });
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const update = await client.query(
            `UPDATE challenge_submissions
             SET status = $1, reviewer_note = $2, reviewed_at = NOW()
             WHERE id = $3 AND status = 'submitted'
             RETURNING user_id`,
            [status, reviewerNote, id]
        );
        if (!update.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Submission not found or already reviewed." });
        }
        let approvedCount = 0;
        if (status === "approved") {
            const userId = update.rows[0].user_id;
            const count = await client.query(
                "SELECT COUNT(*)::int AS total FROM challenge_submissions WHERE user_id = $1 AND status = 'approved'",
                [userId]
            );
            approvedCount = count.rows[0].total;
            await client.query(
                `INSERT INTO user_achievements (user_id, achievement_key, title, description)
                 VALUES ($1, 'first-project', 'First Project', 'Your first community project was approved.')
                 ON CONFLICT (user_id, achievement_key) DO NOTHING`,
                [userId]
            );
            if (approvedCount >= 3) {
                await client.query(
                    `INSERT INTO user_achievements (user_id, achievement_key, title, description)
                     VALUES ($1, 'three-approved-projects', 'Project Builder', 'Three community challenge submissions were approved.')
                     ON CONFLICT (user_id, achievement_key) DO NOTHING`,
                    [userId]
                );
            }
        }
        await client.query("COMMIT");
        res.json({ success: true, status, approvedCount });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

router.patch("/:id/status", requireAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    const status = req.body.status;
    if (!Number.isSafeInteger(id) || id <= 0 || !["open", "closed"].includes(status)) {
        return res.status(400).json({ error: "Invalid challenge status." });
    }
    try {
        const result = await pool.query(
            `UPDATE challenges SET status = $1, updated_at = NOW()
             WHERE id = $2 RETURNING id, status`,
            [status, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Challenge not found." });
        res.json({ success: true, challenge: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
