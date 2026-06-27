// ======================================================
// SAMII OS V1
// ======================================================

const express = require("express");

const CONFIG = require("./config");

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ======================================================
// Vérification
// ======================================================

if (!CONFIG.AIRTABLE.API_KEY) {

    console.log("❌ AIRTABLE_API_KEY manquante");

} else {

    console.log("✅ Airtable connecté");

}

if (!CONFIG.AIRTABLE.BASE_ID) {

    console.log("❌ AIRTABLE_BASE_ID manquant");

}

console.log("🚀 SAMII OS démarre...");

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

    res.send("🚀 SAMII OS V1 fonctionne.");

});

// ======================================================
// START
// ======================================================

app.listen(CONFIG.PORT, () => {

    console.log(`🚀 SAMII OS lancé sur ${CONFIG.PORT}`);

});
