// ==========================================================================
// SAMII OS — AUTO-POST : le marchand programme Sami pour publier tout seul
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const workspaceService = require("../services/workspaceService");
const connectorService = require("../services/connectorService");
const abonnementService = require("../services/abonnementService");
const paliers = require("../config/paliers");

// La publication automatique fait partie de ce qu'on vend : aucune au palier
// gratuit, 3 fois par semaine à Actif, tous les jours au-dessus. La règle
// vit dans config/paliers.js avec le reste des paliers.

// workspaceService.getById() ne renvoie qu'une liste blanche de champs (voir
// mapRow) qui n'inclut pas auto_post_config — même limitation déjà présente
// pour rdv_config (engines/commerceEngine.js la contourne pareil) — donc
// lecture directe ici plutôt que via getById().
async function getAutoPostConfig(workspaceId) {
    const rows = await db.query(`SELECT auto_post_config FROM workspaces WHERE id = $1`, [workspaceId]);
    return rows[0]?.auto_post_config || { actif: false, canaux: [], frequence: "quotidien", sujet: "" };
}

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CANAUX_DISPONIBLES = [
    { id: "facebook", label: "Facebook", type: "facebook" },
    { id: "instagram", label: "Instagram", type: "instagram" },
    { id: "youtube", label: "YouTube", type: "google" },
];

router.get("/", requireAuth, async (req, res) => {
    const workspaceId = req.session?.workspaceId;
    if (!workspaceId) return res.redirect("/hub");

    const [config, connecteurs] = await Promise.all([
        getAutoPostConfig(workspaceId),
        connectorService.getByWorkspace(workspaceId),
    ]);

    const canauxConnectes = CANAUX_DISPONIBLES.map(c => ({
        ...c,
        connecte: connecteurs.some(x => x.type === c.type && x.actif),
    }));

    res.render("autopost", { canaux: canauxConnectes, config, error: null, success: false });
});

router.post("/", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const { actif, frequence, sujet } = req.body;
        let canaux = req.body.canaux || [];
        if (typeof canaux === "string") canaux = [canaux];

        const ancienConfig = await getAutoPostConfig(workspaceId);
        const palier = await abonnementService.getPalier(workspaceId);
        const cadence = paliers.cadencePublication(palier, frequence || "quotidien");

        const nouveauConfig = {
            ...ancienConfig,
            // Palier sans publication automatique : la case reste décochée,
            // quoi que le formulaire ait envoyé.
            actif: cadence !== null && actif === "on",
            canaux,
            frequence: cadence || "quotidien",
            sujet: sujet || "",
        };
        await workspaceService.update(workspaceId, { auto_post_config: nouveauConfig });

        const connecteurs = await connectorService.getByWorkspace(workspaceId);
        const canauxConnectes = CANAUX_DISPONIBLES.map(c => ({
            ...c,
            connecte: connecteurs.some(x => x.type === c.type && x.actif),
        }));

        // Message honnête plutôt qu'un enregistrement silencieusement modifié :
        // le marchand doit savoir que sa demande a été ramenée à son palier.
        let avertissement = null;
        if (cadence === null) {
            avertissement = "La publication automatique fait partie du palier Actif. Ton réglage est gardé, il s'activera dès l'abonnement.";
        } else if (frequence && cadence !== frequence) {
            avertissement = `Ton palier permet la cadence « ${cadence.replace("_", " ")} ». Passe au palier supérieur pour publier plus souvent.`;
        }
        res.render("autopost", { canaux: canauxConnectes, config: nouveauConfig, error: avertissement, success: !avertissement });
    } catch (err) {
        console.error("❌ POST /autopost :", err.message);
        res.render("autopost", { canaux: CANAUX_DISPONIBLES, config: {}, error: "Erreur lors de l'enregistrement.", success: false });
    }
});

module.exports = router;
