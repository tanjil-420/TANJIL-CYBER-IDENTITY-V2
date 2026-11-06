require("dotenv").config();

const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const { pool } = require("./config/database");
const { attachChatSocket } = require("./sockets/chatSocket");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const qrRoutes = require("./routes/qr");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chat");
const siteRoutes = require("./routes/site");
const dashboardRoutes = require("./routes/dashboard");
const skillTestRoutes = require("./routes/skill-test");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET?.trim()) {
    throw new Error("SESSION_SECRET is missing. Configure it in the Render Environment settings.");
}

if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is missing. Configure your PostgreSQL connection URL.");
}

if (isProduction) app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.socket.io"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    }
}));

app.use(express.json({ limit: "600kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const sessionStore = new pgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
});

const sessionMiddleware = session({
    store: sessionStore,
    name: "tanjil.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
});

app.use(sessionMiddleware);

const io = new Server(server, {
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"]
});
io.engine.use(sessionMiddleware);
attachChatSocket(io);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/site", siteRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/skill-test", skillTestRoutes);

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        const result = await pool.query(`
            SELECT
                to_regclass('public.users') IS NOT NULL AS users,
                to_regclass('public.profiles') IS NOT NULL AS profiles,
                to_regclass('public.conversations') IS NOT NULL AS conversations,
                to_regclass('public.conversation_members') IS NOT NULL AS conversation_members,
                to_regclass('public.messages') IS NOT NULL AS messages,
                to_regclass('public.user_sessions') IS NOT NULL AS user_sessions,
                to_regclass('public.site_visitors') IS NOT NULL AS site_visitors,
                to_regclass('public.skill_test_enrollments') IS NOT NULL AS skill_test_enrollments,
                to_regclass('public.skill_test_tasks') IS NOT NULL AS skill_test_tasks,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'reply_to_id') AS message_replies
        `);
        const tables = result.rows[0];
        const missingTables = Object.entries(tables).filter(([, exists]) => !exists).map(([name]) => name);
        const schemaReady = missingTables.length === 0;

        res.status(schemaReady ? 200 : 503).json({
            status: schemaReady ? "online" : "incomplete",
            project: "TANJIL CYBER IDENTITY",
            version: "2.3.0",
            database: "connected",
            schema: schemaReady ? "ready" : "incomplete",
            tables,
            missingTables,
            messenger: "enabled",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("HEALTH CHECK FAILED:", error);
        res.status(503).json({ status: "offline", database: "disconnected" });
    }
});

app.use(express.static(path.join(__dirname, "public"), {
    index: "index.html",
    maxAge: isProduction ? "1h" : 0
}));

app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
});

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "Internal server error." });
});

async function initializeDatabase() {
    const schemaPath = path.join(__dirname, "database", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schemaSql);
    console.log("Database schema initialized and verified.");
}

async function bootstrapAdmin() {
    const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");
    if (!username) return;
    if (!/^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(username)) {
        throw new Error("ADMIN_USERNAME contains invalid characters.");
    }
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (!existing.rows.length) {
        const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Admin account not found. Set ADMIN_EMAIL once to create it, or register this username first.");
        }
        if (password.length < 5 || password.length > 72) {
            throw new Error("ADMIN_PASSWORD must contain at least 5 characters.");
        }
        const bcrypt = require("bcryptjs");
        const hash = await bcrypt.hash(password, 12);
        const created = await pool.query(
            "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
            [username, email, hash]
        );
        await pool.query("INSERT INTO profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [created.rows[0].id, username]);
        console.log(`Admin account created: @${username}`);
        return;
    }
    if (password) {
        if (password.length < 5 || password.length > 72) throw new Error("ADMIN_PASSWORD must contain at least 5 characters.");
        const bcrypt = require("bcryptjs");
        const hash = await bcrypt.hash(password, 12);
        await pool.query("UPDATE users SET role = 'admin', password_hash = $1, updated_at = NOW() WHERE username = $2", [hash, username]);
        console.log(`Admin account promoted and password initialized: @${username}`);
    } else {
        await pool.query("UPDATE users SET role = 'admin', updated_at = NOW() WHERE username = $1", [username]);
        console.log(`Admin role verified: @${username}`);
    }
}

async function startServer() {
    try {
        await pool.query("SELECT 1");
        await initializeDatabase();
        await bootstrapAdmin();

        server.listen(PORT, "0.0.0.0", () => {
            console.log("--------------------------------");
            console.log(" TANJIL CYBER IDENTITY V2.3");
            console.log("--------------------------------");
            console.log(`Server: http://localhost:${PORT}`);
            console.log("Database: Connected");
            console.log("Schema: Ready");
            console.log("Socket.IO: Active");
            console.log("--------------------------------");
        });
    } catch (error) {
        console.error("SERVER START FAILED:", error);
        process.exit(1);
    }
}

async function shutdown(signal) {
    console.log(`${signal} received. Shutting down server...`);
    io.close(async () => {
        try {
            await pool.end();
            process.exit(0);
        } catch (error) {
            console.error("SHUTDOWN ERROR:", error);
            process.exit(1);
        }
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
