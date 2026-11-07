const { pool } = require("../config/database");

async function addActivity(
    userId,
    username,
    activityType,
    activityText
){
    await pool.query(
        `INSERT INTO activity_feed
        (
            user_id,
            username,
            activity_type,
            activity_text
        )
        VALUES ($1,$2,$3,$4)`,
        [
            userId,
            username,
            activityType,
            activityText
        ]
    );
}

module.exports = {
    addActivity
};
