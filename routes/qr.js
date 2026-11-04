
const express = require("express");
const QRCode = require("qrcode");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
    try {
        const baseURL = process.env.APP_URL.replace(/\/+$/, "");

        const profileURL =
            `${baseURL}/u/${encodeURIComponent(req.user.username)}`;

        const qr = await QRCode.toDataURL(profileURL, {
            errorCorrectionLevel: "H",
            type: "image/png",
            width: 1000,
            margin: 3,
            color: {
                dark: "#08111F",
                light: "#FFFFFF"
            }
        });

        res.json({
            success: true,
            username: req.user.username,
            url: profileURL,
            qr
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
