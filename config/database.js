
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

if (!connectionString || !connectionString.trim()) {
    throw new Error("DATABASE_URL is missing. PostgreSQL connection cannot be initialized.");
}

// Check whether SSL options are already defined in the connection URL.
let hasSslMode = false;

try {
    const databaseUrl = new URL(connectionString);
    hasSslMode = databaseUrl.searchParams.has("sslmode");
} catch (error) {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
}

// Build PostgreSQL pool configuration.
const poolConfig = {
    connectionString,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true
};

// Production SSL:
// Respect sslmode already present in the URL.
// Otherwise, enable SSL for production connections.
if (isProduction && !hasSslMode) {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
}

const pool = new Pool(poolConfig);

// PostgreSQL connection established.
pool.on("connect", () => {
    console.log("PostgreSQL connection established.");
});

// PostgreSQL connection errors.
pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error.message);
});

module.exports = { pool };
