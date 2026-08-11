// ==========================================================================
// SAMII OS — PARTENARIAT
// Formulaire public (investisseur, créateur, développeur, ...) + tableau de
// bord privé pour l'équipe SAMII, gardé par ADMIN_EMAIL.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gmail = require("../services/gmail");
const socketService = require("../services/socketService");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ghembazao@gmail.com";
const ROOM_ADMIN = "partenariat-admin";

const CATEGORIES = {
    investisseur: "💰 Investisseur",
    createur: "🎥 Créateur de contenu",
    developpeur: "💻 Développeur",
    fournisseur: "📦 Fournisseur / Logistique",
    marketing: "📣 Affilié / Marketing",
    autre: "✍️ Autre",
};

function requireAdmin(req, res, next) {
    if (!req.session?.loggedIn || req.session.email !== ADMIN_EMAIL) return res.redirect("/login");
    next();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

router.post("/", async (req, res) => {
    try {
        const { categorie, email, telephone, description } = req.body;

        if (!CATEGORIES[categorie]) return res.json({ success: false, error: "Catégorie invalide." });
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.json({ success: false, error: "Email invalide." });
        if (!description || !description.trim()) return res.json({ success: false, error: "Décris ta proposition en quelques mots." });

        const inserted = await db.query(
            `INSERT INTO candidatures_partenariat (categorie, email, telephone, description)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [categorie, email.trim(), (telephone || "").trim(), description.trim()]
        );

        const candidature = inserted[0];
        socketService.emitToShop(ROOM_ADMIN, "partenariat:nouvelle", candidature);

        gmail.send({
            to: ADMIN_EMAIL,
            subject: `🤝 Nouvelle candidature partenariat — ${CATEGORIES[categorie]}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
                <h2 style="color:#C5A059;">${CATEGORIES[categorie]}</h2>
                <p><b>Email :</b> ${escapeHtml(email)}</p>
                <p><b>Téléphone :</b> ${escapeHtml(telephone || "—")}</p>
                <p><b>Message :</b><br>${escapeHtml(description)}</p>
            </div>`,
        }).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /partenariat :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.get("/admin", requireAdmin, async (req, res) => {
    let candidatures = [];
    try {
        candidatures = await db.query(`SELECT * FROM candidatures_partenariat ORDER BY created_at DESC LIMIT 200`);
    } catch (err) {
        console.error("❌ GET /partenariat/admin :", err.message);
    }

    const ligneHtml = (c) => `
        <div class="pa-row" data-id="${c.id}" data-cat="${escapeHtml(c.categorie)}">
            <div class="pa-row-top">
                <span class="pa-cat">${CATEGORIES[c.categorie] || c.categorie}</span>
                <select class="pa-statut" data-id="${c.id}">
                    <option value="nouveau" ${c.statut === "nouveau" ? "selected" : ""}>Nouveau</option>
                    <option value="contacte" ${c.statut === "contacte" ? "selected" : ""}>Contacté</option>
                    <option value="accepte" ${c.statut === "accepte" ? "selected" : ""}>Accepté</option>
                    <option value="refuse" ${c.statut === "refuse" ? "selected" : ""}>Refusé</option>
                </select>
            </div>
            <div class="pa-contact">
                <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>
                ${c.telephone ? ` · <a href="tel:${escapeHtml(c.telephone)}">${escapeHtml(c.telephone)}</a>` : ""}
            </div>
            <p class="pa-desc">${escapeHtml(c.description)}</p>
            <span class="pa-date">${new Date(c.created_at).toLocaleString("fr-FR")}</span>
        </div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Candidatures Partenariat — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); --radius:16px; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:30px 20px 80px; }
.pa-wrap { max-width:820px; margin:0 auto; }
h1 { font-size:22px; margin-bottom:6px; }
.pa-sub { color:var(--muted); font-size:13px; margin-bottom:22px; }
.pa-filters { display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; }
.pa-filters button { padding:7px 13px; border-radius:20px; border:1px solid var(--border); background:rgba(0,217,255,.06); color:var(--muted); font-size:11.5px; cursor:pointer; font-family:"JetBrains Mono"; }
.pa-filters button.active { color:var(--blue); border-color:var(--blue); background:rgba(0,217,255,.14); }
#pa-list { display:flex; flex-direction:column; gap:12px; }
.pa-row { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
.pa-row-top { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }
.pa-cat { font-weight:800; font-size:13px; color:var(--blue); }
.pa-statut { padding:5px 10px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:11.5px; font-family:"JetBrains Mono"; }
.pa-contact { font-size:12.5px; color:var(--muted); margin-bottom:8px; }
.pa-contact a { color:var(--blue); text-decoration:none; }
.pa-desc { font-size:13px; line-height:1.6; margin:0 0 8px; white-space:pre-wrap; }
.pa-date { font-size:10.5px; color:var(--muted); font-family:"JetBrains Mono"; }
.pa-empty { text-align:center; padding:60px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
</style>
</head>
<body>
<div class="pa-wrap">
    <h1>🤝 Candidatures Partenariat</h1>
    <p class="pa-sub">Investisseurs, créateurs, développeurs, fournisseurs... reçus en direct.</p>
    <div class="pa-filters" id="pa-filters">
        <button data-filter="all" class="active">Toutes</button>
        ${Object.entries(CATEGORIES).map(([k, v]) => `<button data-filter="${k}">${v}</button>`).join("")}
    </div>
    <div id="pa-list">${candidatures.length ? candidatures.map(ligneHtml).join("") : `<div class="pa-empty">Aucune candidature pour l'instant.</div>`}</div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
document.getElementById("pa-filters").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    document.querySelectorAll("#pa-filters button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const filtre = btn.dataset.filter;
    document.querySelectorAll(".pa-row").forEach(row => {
        row.style.display = (filtre === "all" || row.dataset.cat === filtre) ? "" : "none";
    });
});

document.getElementById("pa-list").addEventListener("change", async (e) => {
    if (!e.target.classList.contains("pa-statut")) return;
    await fetch("/partenariat/admin/" + e.target.dataset.id + "/statut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: e.target.value }),
    });
});

const CATEGORIES_LABELS = ${JSON.stringify(CATEGORIES)};
const socket = io();
socket.on("connect", () => socket.emit("join", "${ROOM_ADMIN}"));
socket.on("partenariat:nouvelle", (c) => {
    const empty = document.querySelector(".pa-empty");
    if (empty) empty.remove();
    const div = document.createElement("div");
    div.className = "pa-row";
    div.dataset.id = c.id;
    div.dataset.cat = c.categorie;
    div.innerHTML = \`
        <div class="pa-row-top">
            <span class="pa-cat">\${CATEGORIES_LABELS[c.categorie] || c.categorie}</span>
            <select class="pa-statut" data-id="\${c.id}">
                <option value="nouveau" selected>Nouveau</option>
                <option value="contacte">Contacté</option>
                <option value="accepte">Accepté</option>
                <option value="refuse">Refusé</option>
            </select>
        </div>
        <div class="pa-contact"><a href="mailto:\${c.email}">\${c.email}</a>\${c.telephone ? ' · <a href="tel:' + c.telephone + '">' + c.telephone + '</a>' : ''}</div>
        <p class="pa-desc"></p>
        <span class="pa-date">\${new Date(c.created_at).toLocaleString('fr-FR')}</span>\`;
    div.querySelector(".pa-desc").textContent = c.description;
    document.getElementById("pa-list").prepend(div);
});
</script>
</body>
</html>`);
});

router.post("/admin/:id/statut", requireAdmin, async (req, res) => {
    try {
        const { statut } = req.body;
        if (!["nouveau", "contacte", "accepte", "refuse"].includes(statut)) {
            return res.json({ success: false, error: "Statut invalide." });
        }
        await db.query(`UPDATE candidatures_partenariat SET statut = $1 WHERE id = $2`, [statut, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /partenariat/admin/:id/statut :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
