const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Hub OG en construction");
});

module.exports = router;
