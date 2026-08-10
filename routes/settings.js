// ==========================================================================
// SAMII OS — PARAMÈTRES (photo, bannière, bio, pays, langue, thème QG)
// Anciennement "/vitrine/modifier/moi" — regroupé ici, l'emplacement
// attendu pour ce genre de réglages.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

router.get("/", async (req, res) => {
    let user = {};
    try {
        const rows = await db.query(`SELECT * FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        user = rows[0] || {};
    } catch (err) {
        console.error("❌ GET /settings :", err.message);
    }

    const isClient = req.session.typeCompte === "client";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paramètres — SAMII</title>
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
    <h1>⚙️ Paramètres</h1>
    <div class="vm-card">
        <form id="form-settings">
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

document.getElementById("form-settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = "Enregistrement...";
    msg.className = "vm-msg";
    try {
        const res = await fetch("/settings", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = "✅ Paramètres enregistrés ! Redirection...";
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

router.post("/", async (req, res) => {
    try {
        const { photo_profil_url, banniere_url, bio_vitrine, pays, langue_preferee, theme_visuel } = req.body;

        // Ne jamais faire confiance au client : un thème verrouillé envoyé
        // via une requête forgée est ignoré, on revient au thème actuel.
        const rows = await db.query(`SELECT grade_actuel, theme_visuel FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        const grade = rows[0]?.grade_actuel || "Soldat";
        const themeActuel = rows[0]?.theme_visuel || "og";
        const themeValide = gradeService.themeEstDebloque(theme_visuel, grade) ? theme_visuel : themeActuel;

        await db.query(
            `UPDATE utilisateurs SET photo_profil_url = $1, banniere_url = $2, bio_vitrine = $3, pays = $4, langue_preferee = $5, theme_visuel = $6 WHERE id = $7`,
            [photo_profil_url || "", banniere_url || "", bio_vitrine || "", pays || "", langue_preferee || "fr", themeValide, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /settings :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
