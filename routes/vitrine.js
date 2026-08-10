// ==========================================================================
// SAMII OS — VITRINE — Profil public premium (PostgreSQL)
// Photo + bannière réelles, grade, stats, annonces synchronisées
// ==========================================================================

const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
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

function initiales(prenom, nom) {
    const a = (prenom || "").charAt(0).toUpperCase();
    const b = (nom || "").charAt(0).toUpperCase();
    return (a + b) || "OG";
}

function membreDepuis(date) {
    if (!date) return "";
    const d = new Date(date);
    const mois = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    return `${mois[d.getMonth()]} ${d.getFullYear()}`;
}

// ==========================================================================
// PAGE PUBLIQUE
// ==========================================================================

router.get("/:userId", async (req, res) => {
    const userId = req.params.userId;
    let user = null;
    let annonces = [];
    let publications = [];
    let stats = { totalAnnonces: 0, noteMoyenne: 0, totalAvis: 0 };

    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE id = $1`, [userId]);
        user = rows[0] || null;

        if (!user) {
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Introuvable</title>
            <style>body{background:#03060b;color:#f5fbff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style>
            </head><body><div><h1>👤 Profil introuvable</h1><p><a href="/" style="color:#00d9ff;">Retour à l'accueil</a></p></div></body></html>`);
        }

        annonces = await db.query(
            `SELECT * FROM annonces WHERE vendeur_id = $1 AND actif = true ORDER BY created_at DESC LIMIT 24`,
            [userId]
        );
        stats.totalAnnonces = annonces.length;

        publications = await db.query(
            `SELECT * FROM publications WHERE auteur_id = $1 ORDER BY created_at DESC LIMIT 12`,
            [userId]
        );

        const noteRows = await db.query(
            `SELECT ROUND(AVG(note)::numeric, 1) AS moyenne, COUNT(*) AS total FROM avis WHERE cible_type = 'vendeur' AND cible_id = $1`,
            [userId]
        );
        if (noteRows[0]?.total > 0) {
            stats.noteMoyenne = parseFloat(noteRows[0].moyenne);
            stats.totalAvis = parseInt(noteRows[0].total, 10);
        }
    } catch (err) {
        console.error("❌ GET /vitrine/:userId :", err.message);
        return res.status(404).send("Vitrine introuvable.");
    }

    const estMoi = req.session?.userId === userId;

    const nomComplet = `${user.prenom || ""} ${user.nom || ""}`.trim() || "Membre SAMII";
    const estPremium = user.abonnement === "premium";
    const estMarchand = user.type_compte === "marchand";
    const grade = escapeHtml(user.grade_actuel || "Soldat");

    const annoncesHtml = annonces.length ? annonces.map(a => {
        let photos = [];
        try {
            if (a.photos_urls) photos = JSON.parse(a.photos_urls);
        } catch { /* ignore */ }
        const photo = photos[0] || a.photo_url || "";
        return `
        <a href="/marketplace/produit/${a.id}" class="vt-card">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(a.titre)}" loading="lazy">` : `<div class="vt-card-placeholder"><i data-lucide="image"></i></div>`}
            <div class="vt-card-body">
                <span>${escapeHtml(a.titre)}</span>
                <strong>${escapeHtml(a.prix || "Sur devis")}</strong>
            </div>
        </a>`;
    }).join("") : `<div class="vt-empty"><i data-lucide="package-search"></i><p>Aucune annonce publiée pour le moment.</p></div>`;

    const publicationsHtml = publications.length ? publications.map(p => `
        <div class="vt-post">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" loading="lazy">` : ""}
            ${p.contenu ? `<p>${escapeHtml(p.contenu)}</p>` : ""}
        </div>`).join("") : `<div class="vt-empty"><i data-lucide="message-square"></i><p>Aucune publication pour le moment.</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(nomComplet)} — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding-bottom:60px; }
.banner { height:220px; background:linear-gradient(135deg,#07121d,#0a1a2a); position:relative; overflow:hidden; }
.banner img { width:100%; height:100%; object-fit:cover; }
.banner::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 40%,var(--bg) 100%); }
.profile-wrap { max-width:1000px; margin:0 auto; padding:0 20px; }
.profile-head { display:flex; align-items:flex-end; gap:18px; margin-top:-56px; position:relative; z-index:2; flex-wrap:wrap; }
.avatar { width:112px; height:112px; border-radius:24px; border:4px solid var(--bg); background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-size:32px; font-weight:900; color:white; flex-shrink:0; overflow:hidden; }
.avatar img { width:100%; height:100%; object-fit:cover; }
.profile-info { padding-bottom:8px; }
.profile-info h1 { margin:0; font-size:24px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.badges-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.pbadge { font-family:"JetBrains Mono"; font-size:10px; padding:5px 11px; border-radius:20px; border:1px solid var(--border); color:var(--blue); background:rgba(0,217,255,.08); display:flex; align-items:center; gap:5px; }
.pbadge svg { width:11px; height:11px; }
.pbadge.premium { color:var(--gold); border-color:rgba(215,179,76,.4); background:rgba(215,179,76,.1); }
.pbadge.grade { color:#3ddc84; border-color:rgba(61,220,132,.3); background:rgba(61,220,132,.08); }
.stats-bar { display:flex; gap:26px; margin:22px 0; padding:18px 20px; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); flex-wrap:wrap; }
.stat-block { text-align:center; }
.stat-block strong { display:block; font-family:"JetBrains Mono"; font-size:20px; color:var(--blue); }
.stat-block span { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.bio-text { color:var(--muted); font-size:13.5px; line-height:1.7; margin:16px 0; max-width:600px; }
.section-title { font-size:16px; font-weight:800; margin:30px 0 14px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:17px; height:17px; color:var(--blue); }
.vt-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; }
.vt-card { text-decoration:none; color:var(--text); border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); transition:.2s; }
.vt-card:hover { transform:translateY(-4px); border-color:var(--blue); box-shadow:var(--cyan-glow); }
.vt-card img { width:100%; aspect-ratio:1/1; object-fit:cover; }
.vt-card-placeholder { width:100%; aspect-ratio:1/1; display:grid; place-items:center; color:var(--blue); background:#07121d; }
.vt-card-body { padding:11px; }
.vt-card-body span { display:block; font-size:11.5px; margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vt-card-body strong { color:var(--blue); font-size:13px; }
.vt-empty { grid-column:1/-1; text-align:center; padding:60px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.vt-empty svg { width:36px; height:36px; color:var(--blue); margin-bottom:12px; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; padding:16px 20px 0; }
.back-link:hover { color:var(--blue); }
.edit-vitrine-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:10px; border:1px solid var(--border); background:rgba(0,217,255,.08); color:var(--blue); text-decoration:none; font-size:12.5px; font-weight:700; margin:16px 0 0; }
.edit-vitrine-btn:hover { background:rgba(0,217,255,.16); }
.vt-posts { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
.vt-post { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); padding:14px; }
.vt-post img { width:100%; border-radius:10px; margin-bottom:10px; aspect-ratio:16/10; object-fit:cover; }
.vt-post p { font-size:12.5px; color:var(--text); line-height:1.6; margin:0; }
</style>
</head>
<body>
<a href="/marketplace" class="back-link"><i data-lucide="arrow-left"></i> Retour à Marketplace</a>
<div class="banner">${user.banniere_url ? `<img src="${escapeHtml(user.banniere_url)}" alt="">` : ""}</div>
<div class="profile-wrap">
    <div class="profile-head">
        <div class="avatar">${user.photo_profil_url ? `<img src="${escapeHtml(user.photo_profil_url)}" alt="">` : initiales(user.prenom, user.nom)}</div>
        <div class="profile-info">
            <h1>${escapeHtml(nomComplet)}</h1>
            <div class="badges-row">
                <span class="pbadge grade"><i data-lucide="${estMarchand ? "store" : "user"}"></i> ${grade}</span>
                ${estPremium ? `<span class="pbadge premium"><i data-lucide="crown"></i> Premium</span>` : ""}
                ${user.pays ? `<span class="pbadge"><i data-lucide="map-pin"></i> ${escapeHtml(user.pays)}</span>` : ""}
                ${user.created_at ? `<span class="pbadge"><i data-lucide="calendar"></i> Membre depuis ${membreDepuis(user.created_at)}</span>` : ""}
            </div>
        </div>
    </div>

    <div class="stats-bar">
        <div class="stat-block"><strong>${stats.totalAnnonces}</strong><span>Annonces</span></div>
        <div class="stat-block"><strong>${stats.noteMoyenne || "—"}</strong><span>Note ${stats.totalAvis ? `(${stats.totalAvis})` : ""}</span></div>
        <div class="stat-block"><strong>${user.score_grade || 0}</strong><span>Points SAMII</span></div>
    </div>

    ${user.bio_vitrine ? `<p class="bio-text">${escapeHtml(user.bio_vitrine)}</p>` : ""}

    ${estMoi ? `<a href="/vitrine/modifier/moi" class="edit-vitrine-btn"><i data-lucide="pencil"></i> Modifier ma vitrine</a>` : ""}

    <div class="section-title"><i data-lucide="store"></i> Annonces actives</div>
    <div class="vt-grid">${annoncesHtml}</div>

    <div class="section-title"><i data-lucide="message-square"></i> Publications Communauté</div>
    <div class="vt-posts">${publicationsHtml}</div>
</div>
<script>if (typeof lucide !== "undefined") lucide.createIcons();</script>
</body>
</html>`);
});

// ==========================================================================
// FORMULAIRE PRIVÉ D'ÉDITION
// ==========================================================================

router.get("/modifier/moi", requireAuth, async (req, res) => {
    let user = {};
    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        user = rows[0] || {};
    } catch (err) {
        console.error("❌ GET /vitrine/modifier/moi :", err.message);
    }

    const isClient = req.session.typeCompte === "client";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Modifier ma vitrine</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:30px 20px 80px; }
.vm-shell { max-width:560px; margin:0 auto; }
.back { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; margin-bottom:22px; }
.back:hover { color:var(--blue); }
h1 { font-size:22px; margin-bottom:20px; }
.vm-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:24px; }
label { display:block; font-family:"JetBrains Mono"; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:16px 0 7px; }
label:first-of-type { margin-top:0; }
input,textarea,select { width:100%; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13.5px; font-family:inherit; outline:none; }
input:focus,textarea:focus,select:focus { border-color:var(--blue); box-shadow:var(--cyan-glow); }
select option { background:#07101a; }
textarea { resize:vertical; min-height:90px; }
.upload-zone { display:flex; align-items:center; gap:12px; }
.upload-preview-img { width:64px; height:64px; border-radius:12px; object-fit:cover; border:1px solid var(--border); flex-shrink:0; background:#07121d; }
.upload-preview-banner { width:100%; height:80px; border-radius:12px; object-fit:cover; border:1px solid var(--border); background:#07121d; margin-top:8px; }
.upload-btn { padding:10px 16px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--blue); font-size:12px; font-weight:700; cursor:pointer; }
.upload-status { font-size:11px; color:var(--blue); margin-top:6px; display:none; }
button[type="submit"] { width:100%; padding:14px; margin-top:20px; border:none; border-radius:12px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); }
.vm-msg { text-align:center; margin-top:14px; font-size:13px; color:#ff5470; min-height:20px; }
.vm-msg.ok { color:#3ddc84; }
</style>
</head>
<body>
<div class="vm-shell">
    <a href="${isClient ? "/client-qg" : "/qg"}" class="back"><i data-lucide="arrow-left"></i> Retour</a>
    <h1>Modifier ma vitrine</h1>
    <div class="vm-card">
        <form id="form-vitrine">
            <label>Photo de profil</label>
            <div class="upload-zone">
                <img class="upload-preview-img" id="previewPhoto" src="${escapeHtml(user.photo_profil_url || "")}" alt="">
                <button type="button" class="upload-btn" onclick="document.getElementById('inputPhoto').click()">Choisir une photo</button>
            </div>
            <input type="file" id="inputPhoto" accept="image/*" style="display:none;">
            <input type="hidden" name="photo_profil_url" id="hiddenPhoto" value="${escapeHtml(user.photo_profil_url || "")}">
            <div class="upload-status" id="statusPhoto">⏳ Envoi...</div>

            <label>Bannière de couverture</label>
            <img class="upload-preview-banner" id="previewBanner" src="${escapeHtml(user.banniere_url || "")}" alt="">
            <button type="button" class="upload-btn" style="margin-top:8px;" onclick="document.getElementById('inputBanner').click()">Choisir une bannière</button>
            <input type="file" id="inputBanner" accept="image/*" style="display:none;">
            <input type="hidden" name="banniere_url" id="hiddenBanner" value="${escapeHtml(user.banniere_url || "")}">
            <div class="upload-status" id="statusBanner">⏳ Envoi...</div>

            <label>Bio / présentation</label>
            <textarea name="bio_vitrine" placeholder="Parle un peu de toi ou de ton activité...">${escapeHtml(user.bio_vitrine || "")}</textarea>

            <label>Pays</label>
            <input name="pays" value="${escapeHtml(user.pays || "")}" placeholder="Ex : Algérie">

            <label>Langue préférée</label>
            <select name="langue_preferee">
                <option value="fr" ${user.langue_preferee === "fr" ? "selected" : ""}>Français</option>
                <option value="ar" ${user.langue_preferee === "ar" ? "selected" : ""}>Arabe</option>
                <option value="en" ${user.langue_preferee === "en" ? "selected" : ""}>Anglais</option>
            </select>

            <label>Thème visuel du QG</label>
            <select name="theme_visuel">
                ${gradeService.THEMES.map(t => {
                    const debloque = gradeService.themeEstDebloque(t.id, user.grade_actuel);
                    const selected = user.theme_visuel === t.id ? "selected" : "";
                    return `<option value="${t.id}" ${selected} ${debloque ? "" : "disabled"}>${t.emoji} ${t.label}${debloque ? "" : " — verrouillé"}</option>`;
                }).join("")}
            </select>

            <button type="submit">Enregistrer les modifications</button>
        </form>
        <div class="vm-msg" id="msg"></div>
    </div>
</div>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

async function uploadToCloudinary(file, statusId, previewId, hiddenId) {
    const status = document.getElementById(statusId);
    status.style.display = "block";
    status.textContent = "⏳ Envoi en cours...";
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "MARKETPLACE OG");
        const res = await fetch("https://api.cloudinary.com/v1_1/ojwx5hft/image/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (json.secure_url) {
            document.getElementById(previewId).src = json.secure_url;
            document.getElementById(hiddenId).value = json.secure_url;
            status.textContent = "✅ Image envoyée !";
            setTimeout(() => status.style.display = "none", 1500);
        } else {
            status.textContent = "❌ Échec de l'envoi.";
        }
    } catch (err) {
        status.textContent = "❌ Erreur réseau.";
    }
}

document.getElementById("inputPhoto").addEventListener("change", function () {
    if (this.files[0]) uploadToCloudinary(this.files[0], "statusPhoto", "previewPhoto", "hiddenPhoto");
});
document.getElementById("inputBanner").addEventListener("change", function () {
    if (this.files[0]) uploadToCloudinary(this.files[0], "statusBanner", "previewBanner", "hiddenBanner");
});

document.getElementById("form-vitrine").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = "Enregistrement...";
    msg.className = "vm-msg";
    try {
        const res = await fetch("/vitrine/modifier/moi", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = "✅ Vitrine mise à jour ! Redirection...";
            msg.className = "vm-msg ok";
            setTimeout(() => {
                window.location.href = document.querySelector(".back").getAttribute("href");
            }, 900);
        } else {
            msg.textContent = json.error || "Erreur.";
        }
    } catch (err) {
        msg.textContent = "Erreur réseau.";
    }
});
</script>
</body>
</html>`);
});

router.post("/modifier/moi", requireAuth, async (req, res) => {
    try {
        const { photo_profil_url, banniere_url, bio_vitrine, pays, langue_preferee, theme_visuel } = req.body;

        // Ne jamais faire confiance au client : un thème verrouillé envoyé
        // via une requête forgée est ignoré, on revient au thème actuel.
        const rows = await db.query(`SELECT grade_actuel, theme_visuel FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        const grade = rows[0]?.grade_actuel || "Soldat";
        const themeActuel = rows[0]?.theme_visuel || "strategiste";
        const themeValide = gradeService.themeEstDebloque(theme_visuel, grade) ? theme_visuel : themeActuel;

        await db.query(
            `UPDATE utilisateurs SET photo_profil_url = $1, banniere_url = $2, bio_vitrine = $3, pays = $4, langue_preferee = $5, theme_visuel = $6 WHERE id = $7`,
            [photo_profil_url || "", banniere_url || "", bio_vitrine || "", pays || "", langue_preferee || "fr", themeValide, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /vitrine/modifier/moi :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
