
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("connect", () => {
    console.log("PostgreSQL connection established.");
});

pool.on("error", error => {
    console.error("PostgreSQL pool error:", error.message);
});

module.exports = { pool };
