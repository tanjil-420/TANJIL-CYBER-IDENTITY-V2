
require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

// ENVIRONMENT VALIDATION
if (!process.env.SESSION_SECRET?.trim()) {
    throw new Error(
        "SESSION_SECRET is missing. Please configure it in your .env file or Render Environment."
    );
}

if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
        "DATABASE_URL is missing. Please configure your PostgreSQL connection URL."
    );
}

// DATABASE
const { pool } = require("./config/database");

// ROUTES AND SOCKETS
const { attachChatSocket } = require("./sockets/chatSocket");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const qrRoutes = require("./routes/qr");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chat");

// APP SETUP
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");

// HELMET SECURITY
app.use(
    helmet({
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
    })
);

// BODY PARSERS
app.use(express.json({ limit: "100kb" }));

app.use(
    express.urlencoded({
        extended: false,
        limit: "100kb"
    })
);

// DATABASE SESSION STORE
const sessionStore = new pgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
});

// SHARED SESSION MIDDLEWARE
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

// EXPRESS SESSION
app.use(sessionMiddleware);

// SOCKET.IO
const io = new Server(server, {
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"]
});

// SHARE EXPRESS SESSION WITH SOCKET.IO
io.engine.use(sessionMiddleware);

attachChatSocket(io);

// RATE LIMITING
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many attempts. Please try again later."
    }
});

// API ROUTES
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);


// DATABASE AND SCHEMA HEALTH CHECK
app.get("/api/health", async (req, res) => {
    try {
        const db = await pool.query("SELECT 1");

        const result = await pool.query(`
            SELECT
                to_regclass('public.users') IS NOT NULL AS users,
                to_regclass('public.profiles') IS NOT NULL AS profiles,
                to_regclass('public.conversations') IS NOT NULL AS conversations,
                to_regclass('public.conversation_members') IS NOT NULL AS conversation_members,
                to_regclass('public.messages') IS NOT NULL AS messages,
                to_regclass('public.user_sessions') IS NOT NULL AS user_sessions
        `);

        const tables = result.rows[0];

        const missingTables = Object.entries(tables)
            .filter(([name, exists]) => !exists)
            .map(([name]) => name);

        const schemaReady = missingTables.length === 0;

        res.status(schemaReady ? 200 : 503).json({
            status: schemaReady ? "online" : "incomplete",
            project: "TANJIL CYBER IDENTITY",
            version: "2.0.0",
            database: "connected",
            schema: schemaReady ? "ready" : "incomplete",
            tables,
            missingTables,
            messenger: "enabled",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("HEALTH CHECK FAILED:", error);

        res.status(503).json({
            status: "offline",
            database: "disconnected",
            error: "Database health check failed."
        });
    }
});

// FRONTEND
app.use(
    express.static(path.join(__dirname, "public"), {
        index: "index.html",
        maxAge: isProduction ? "1h" : 0
    })
);

// API NOT FOUND
app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API endpoint not found."
    });
});

// GLOBAL ERROR HANDLER
app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Internal server error."
    });
});

// START SERVER
async function startServer() {
    try {
        await pool.query("SELECT 1");

        server.listen(PORT, "0.0.0.0", () => {
            console.log("--------------------------------");
            console.log(" TANJIL CYBER IDENTITY V2.0");
            console.log("--------------------------------");
            console.log(`Server: http://localhost:${PORT}`);
            console.log("Database: Connected");
            console.log("Socket.IO: Active");
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("SERVER START FAILED:", error.message);
        process.exit(1);
    }
}

// GRACEFUL SHUTDOWN
async function shutdown(signal) {
    console.log(`${signal} received. Shutting down server...`);

    io.close(async () => {
        try {
            await pool.end();
            console.log("Database connection closed.");
            process.exit(0);

        } catch (error) {
            console.error("SHUTDOWN ERROR:", error.message);
            process.exit(1);
        }
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// RUN
startServer();
