// ==========================================================================
// SAMII OS — RÉCEPTEUR DE NOTIFICATIONS DE PAIEMENT (mode observation)
//
// POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'ENCAISSE RIEN.
//
// On branche un nouveau prestataire — SebPay, Bénin, dix-sept pays, Orange
// Money et MTN. Sa documentation n'est pas accessible d'ici et personne ne
// sait exactement quels champs il envoie ni comment il signe.
//
// La tentation serait de coder d'après une supposition, puis de découvrir en
// production que le champ s'appelle `montant` et pas `amount`. On fait
// l'inverse : on ouvre une oreille, on lui demande de parler, et on écrit le
// code d'après ce qu'il a RÉELLEMENT dit.
//
// CE QUE FAIT CETTE ROUTE : elle reçoit, elle note tout, elle répond 200.
// CE QU'ELLE NE FAIT PAS : créditer un compte, livrer un produit, valider un
// paiement. Tant que la signature n'est pas vérifiée, une notification n'est
// qu'une affirmation faite par un inconnu sur Internet — n'importe qui peut
// appeler cette adresse et prétendre qu'un paiement de 500 000 est passé.
//
// Le 200 systématique est volontaire pendant l'observation : la plupart des
// prestataires réessaient pendant des heures sur un code d'erreur, et on ne
// veut pas d'une tempête de réessais pour un test.
//
// QUAND ON AURA VU UN VRAI MESSAGE : on lira /webhook/paiement-afrique/vu
// (réservé aux fondateurs), on saura le format, et on écrira le vrai
// traitement — avec vérification de signature, cette fois.
// ==========================================================================
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const db = require("./../services/db");
const { estFondateur } = require("../config/fondateurs");

// Cette adresse est publique par nature — le prestataire doit pouvoir
// l'appeler sans compte. Elle est donc aussi appelable par n'importe qui.
// La limite ne protège pas l'argent (rien n'est crédité ici), elle protège
// la base et les journaux d'un arrosage.
const limite = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { recu: false, raison: "trop d'appels" },
});

// Les vingt derniers messages, gardés en mémoire du processus. La base est
// la trace durable ; ceci sert à regarder tout de suite, sans requête, même
// si la table n'existait pas encore.
const DERNIERS = [];
const MAX_MEMOIRE = 20;

// Ce qui ne doit jamais finir dans un journal, même par accident : un
// prestataire qui renverrait une clé dans son message la verrait recopiée
// dans nos logs, où elle vivrait bien plus longtemps que nécessaire.
const SENSIBLE = /^(authorization|cookie|x-api-key|api-key|secret|token)$/i;

function enteteLisibles(req) {
    const out = {};
    for (const [cle, val] of Object.entries(req.headers || {})) {
        out[cle] = SENSIBLE.test(cle) ? "«masqué»" : String(val).slice(0, 300);
    }
    return out;
}

// Le corps arrive sous trois formes selon le prestataire et le montage
// d'index.js : un Buffer brut (application/json, capté plus haut pour
// permettre la vérification de signature), un objet déjà analysé
// (formulaire), ou rien du tout. On veut les deux : le texte exact tel qu'il
// est passé sur le fil — seul le brut permet de vérifier une signature — et
// sa version lisible.
function lireCorps(req) {
    const brut = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : (req.body && typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body || ""));

    let analyse = null;
    try { analyse = brut ? JSON.parse(brut) : null; } catch (e) { analyse = null; }
    if (!analyse && req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        analyse = req.body;
    }
    return { brut, analyse };
}

async function noter(req, res) {
    const { brut, analyse } = lireCorps(req);
    const entetes = enteteLisibles(req);

    const trace = {
        recuLe: new Date().toISOString(),
        methode: req.method,
        chemin: req.originalUrl,
        ip: req.ip,
        typeContenu: req.headers["content-type"] || "«aucun»",
        entetes,
        corpsBrut: brut.slice(0, 8000),
        champs: analyse ? Object.keys(analyse) : [],
    };

    DERNIERS.unshift(trace);
    if (DERNIERS.length > MAX_MEMOIRE) DERNIERS.length = MAX_MEMOIRE;

    // Bien visible dans les journaux Render : c'est là qu'il regardera en
    // premier, et « quelque chose est arrivé » doit sauter aux yeux.
    console.log("💳 ─────────────────────────────────────────────────");
    console.log(`💳 NOTIFICATION DE PAIEMENT — ${req.method} ${req.originalUrl}`);
    console.log(`💳 type : ${trace.typeContenu}`);
    console.log(`💳 champs reçus : ${trace.champs.length ? trace.champs.join(", ") : "«aucun champ analysable»"}`);
    console.log(`💳 corps : ${brut.slice(0, 1500) || "«vide»"}`);
    // Les en-têtes de signature sont ce qui nous manque le plus : c'est eux
    // qui diront comment vérifier l'authenticité au prochain tour.
    const signatures = Object.entries(entetes).filter(([k]) => /sign|hash|hmac|digest/i.test(k));
    console.log(`💳 signature : ${signatures.length ? JSON.stringify(Object.fromEntries(signatures)) : "«aucun en-tête de signature»"}`);
    console.log("💳 ─────────────────────────────────────────────────");

    // La trace durable. Si la table manque ou si la base tousse, on ne casse
    // pas la réponse : le prestataire n'a pas à souffrir de nos problèmes, et
    // on a déjà tout dans les journaux et en mémoire.
    try {
        await db.query(
            `INSERT INTO journal (action, details) VALUES ($1, $2)`,
            ["paiement.notification", JSON.stringify(trace).slice(0, 6000)],
        );
    } catch (err) {
        console.warn("⚠️ notification non enregistrée en base :", err.message);
    }

    // 200 quoi qu'il arrive — voir l'en-tête du fichier.
    res.status(200).json({ recu: true });
}

// GET comme POST : beaucoup de prestataires appellent d'abord en GET pour
// vérifier que l'adresse répond avant de la déclarer valide.
router.get("/", limite, noter);
router.post("/", limite, noter);

// ── LA FENÊTRE D'OBSERVATION ────────────────────────────────────────────
// Réservée aux fondateurs : ces traces contiennent des en-têtes et des
// corps de requête, c'est-à-dire potentiellement des données de paiement.
// On ne les met pas derrière une simple adresse difficile à deviner.
router.get("/vu", (req, res) => {
    if (!estFondateur(req.session?.email)) return res.status(404).send("Introuvable.");

    const bloc = (t) => `
      <article>
        <h2>${t.recuLe} — ${t.methode}</h2>
        <p class="m">type : <b>${t.typeContenu}</b> · IP : ${t.ip}</p>
        <p class="m">champs : ${t.champs.length ? t.champs.map(c => `<code>${c}</code>`).join(" ") : "<i>aucun</i>"}</p>
        <h3>Corps</h3><pre>${(t.corpsBrut || "«vide»").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>
        <h3>En-têtes</h3><pre>${JSON.stringify(t.entetes, null, 2).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>
      </article>`;

    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notifications de paiement reçues</title>
<style>
  body{margin:0;padding:24px;background:#0b0d14;color:#e8eaf2;
       font:15px/1.6 ui-sans-serif,system-ui,sans-serif}
  h1{font-size:1.4rem;margin:0 0 6px}
  .intro{color:#8d94a8;margin:0 0 26px;max-width:62ch}
  article{background:#141826;border:1px solid #232a3d;border-radius:12px;
          padding:18px;margin-bottom:16px}
  h2{font-size:.95rem;margin:0 0 4px;color:#7a9bff}
  h3{font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;
     color:#8d94a8;margin:16px 0 6px}
  .m{color:#8d94a8;font-size:.84rem;margin:2px 0}
  code{background:#1d2233;padding:2px 6px;border-radius:5px;font-size:.8rem;color:#e3b341}
  pre{background:#0b0d14;border:1px solid #232a3d;border-radius:9px;padding:12px;
      overflow-x:auto;font-size:.78rem;color:#b9c0d4;margin:0}
  .vide{color:#8d94a8;padding:40px 0;text-align:center}
</style></head><body>
<h1>Notifications de paiement reçues</h1>
<p class="intro">Tout ce que le prestataire a envoyé à cette adresse, tel quel.
Rien n'est interprété et aucun paiement n'est validé : cette page sert à
découvrir son format avant d'écrire le traitement.
Les vingt derniers messages depuis le dernier redémarrage.</p>
${DERNIERS.length ? DERNIERS.map(bloc).join("") : `<div class="vide">Rien reçu pour l'instant.<br>Déclenche un paiement de test — la page se remplira.</div>`}
</body></html>`);
});

module.exports = router;
