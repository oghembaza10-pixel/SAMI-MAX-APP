const express = require("express");

const router = express.Router();

router.post("/", async (req, res) => {

    const {

        nom,

        whatsapp,

        boutique,

        pays

    } = req.body;

    res.json({

        success: true,

        message: "Inscription reçue.",

        data: {

            nom,

            whatsapp,

            boutique,

            pays

        }

    });

});

module.exports = router;
