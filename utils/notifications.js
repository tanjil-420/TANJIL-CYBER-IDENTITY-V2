const { pool } = require("../config/database");

async function createNotification(
    userId,
    type,
    title,
    body = "",
    url = null
){
    await pool.query(
        `INSERT INTO notifications
        (
            user_id,
            type,
            title,
            body,
            url
        )
        VALUES ($1,$2,$3,$4,$5)`,
        [
            userId,
            type,
            title,
            body,
            url
        ]
    );
}

module.exports = {
    createNotification
};
