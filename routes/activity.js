const express = require("express");
const { pool } = require("../config/database");

const router = express.Router();

router.get("/", async(req,res,next)=>{

    try{

        const result = await pool.query(
        `
            SELECT *
            FROM activity_feed
            ORDER BY created_at DESC
            LIMIT 50
        `
        );

        res.json({
            success:true,
            activities:result.rows
        });

    }catch(error){
        next(error);
    }

});

module.exports = router;
