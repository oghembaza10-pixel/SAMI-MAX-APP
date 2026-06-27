// ======================================================
// SAMII OS - Version 1
// Base Architecture
// ======================================================

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ======================================================
// CONFIG
// ======================================================

const PORT = process.env.PORT || 3000;

// Airtable
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Tables
const TABLE_USERS = "Utilisateur";
const TABLE_BOUTIQUES = "Boutique";
const TABLE_COMMANDES = "Commande";
const TABLE_CONVERSATIONS = "Conversation";
const TABLE_DASHBOARD = "Dashboard";
const TABLE_LOGS = "Logs";
const TABLE_PARAMETRES = "Paramètres";
const TABLE_QG = "QG Samii";

// ======================================================
// Vérification Render
// ======================================================

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {

    console.error("❌ Variables Airtable manquantes.");

} else {

    console.log("✅ Airtable connecté.");

}

// ======================================================
// Fonction Airtable
// ======================================================

async function createRecord(table, fields) {

    return axios.post(

        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,

        {
            fields
        },

        {
            headers: {

                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                "Content-Type": "application/json"

            }
        }

    );

}

// ======================================================
// Fonction Log
// ======================================================

async function addLog(type, message) {

    try {

        await createRecord(TABLE_LOGS, {

            "Type": type,
            "Message": message

        });

    } catch (err) {

        console.log("Impossible d'ajouter un log.");

    }

}

// ======================================================
// TEST
// ======================================================

app.get("/", (req, res) => {

    res.send("SAMII OS fonctionne.");

});

// ======================================================
// START
// ======================================================

app.listen(PORT, () => {

    console.log(`🚀 SAMII OS lancé sur le port ${PORT}`);

});
