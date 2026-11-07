const express = require("express");
const { pool } = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req,res,next)=>{

    try{

        const result = await pool.query(
            `SELECT *
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [req.user.id]
        );

        res.json({
            success:true,
            notifications:result.rows
        });

    }catch(error){
        next(error);
    }

});

router.patch("/:id/read", async(req,res,next)=>{

    try{

        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1
             AND user_id = $2`,
            [
                req.params.id,
                req.user.id
            ]
        );

        res.json({
            success:true
        });

    }catch(error){
        next(error);
    }

});

module.exports = router;
