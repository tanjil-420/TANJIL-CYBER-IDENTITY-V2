const express = require("express");
const { pool } = require("../config/database");

const router = express.Router();

router.get("/", async(req,res,next)=>{

try{

const result = await pool.query(`
SELECT
u.username,
p.rank_title,
COUNT(a.achievement_key) AS achievements
FROM users u
LEFT JOIN profiles p
ON p.user_id = u.id
LEFT JOIN user_achievements a
ON a.user_id = u.id
GROUP BY
u.username,
p.rank_title
ORDER BY achievements DESC
LIMIT 25
`);

res.json({
success:true,
leaders:result.rows
});

}catch(error){
next(error);
}

});

module.exports = router;
