// ==========================================================================
// SAMII OS — STORIES — Photo/vidéo éphémère par profil (24h)
// Tables déjà existantes en base (stories, stories_vues), jamais branchées.
// Compte Cloudinary en plan gratuit : vidéos plafonnées à 19 secondes.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";
const STORY_MAX_DUREE_SEC = 19;
const STORY_DUREE_MS = 24 * 60 * 60 * 1000;

function requireAuth(req, res, next) { if (!req.session?.loggedIn) return res.redirect("/login"); next(); }
function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function initiales(nom){ return String(nom||"").trim().split(" ").map(p=>p.charAt(0).toUpperCase()).slice(0,2).join("") || "OG"; }

// ==========================================================================
// PUBLIER UNE STORY
// ==========================================================================
router.get("/publier", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nouvelle story — SAMII</title>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.9); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,system-ui,sans-serif; display:flex; align-items:center; justify-content:center; padding:20px; }
.story-box { width:100%; max-width:420px; background:var(--panel); border:1px solid var(--border); border-radius:20px; padding:26px; }
h1 { font-size:18px; margin:0 0 6px; }
p.hint { color:var(--muted); font-size:12px; margin:0 0 18px; }
.drop-zone { border:2px dashed var(--border); border-radius:16px; padding:30px 16px; text-align:center; cursor:pointer; color:var(--muted); font-size:13px; }
.drop-zone.has-media { padding:0; border-style:solid; overflow:hidden; }
.drop-zone img, .drop-zone video { width:100%; max-height:360px; object-fit:cover; display:block; }
.status { font-size:12px; color:var(--blue); margin-top:12px; min-height:16px; }
.status.err { color:#ff6b6b; }
button[type="submit"] { width:100%; margin-top:16px; padding:14px; border:none; border-radius:12px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; }
button[type="submit"]:disabled { opacity:.5; cursor:not-allowed; }
.back { display:inline-block; margin-top:14px; color:var(--muted); text-decoration:none; font-size:12.5px; }
</style>
</head>
<body>
<div class="story-box">
    <h1>✨ Nouvelle story</h1>
    <p class="hint">Visible 24h par tout le monde. Vidéo limitée à ${STORY_MAX_DUREE_SEC} secondes.</p>
    <div class="drop-zone" id="dropZone">📷 Touche pour choisir une photo ou une vidéo</div>
    <input type="file" id="fileInput" accept="image/*,video/*" style="display:none;">
    <div class="status" id="status"></div>
    <button type="submit" id="submitBtn" disabled>Publier ma story</button>
    <a href="/community" class="back">← Annuler</a>
</div>
<script>
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
let mediaUrl = null, mediaType = null;

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusEl.className = "status"; statusEl.textContent = "";
    mediaUrl = null; submitBtn.disabled = true;

    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
        const duree = await new Promise((resolve) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.onloadedmetadata = () => resolve(v.duration);
            v.onerror = () => resolve(0);
            v.src = URL.createObjectURL(file);
        });
        if (duree > ${STORY_MAX_DUREE_SEC}) {
            statusEl.className = "status err";
            statusEl.textContent = "❌ Vidéo trop longue (" + Math.round(duree) + "s) — max ${STORY_MAX_DUREE_SEC}s sur le plan gratuit.";
            return;
        }
    }

    statusEl.textContent = "⏳ Envoi en cours...";
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "${CLOUDINARY_UPLOAD_PRESET}");
        const endpoint = isVideo ? "video" : "image";
        const res = await fetch("https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/" + endpoint + "/upload", { method:"POST", body:formData });
        const json = await res.json();
        if (!json.secure_url) throw new Error("Échec upload");

        mediaUrl = json.secure_url;
        mediaType = isVideo ? "video" : "photo";

        dropZone.classList.add("has-media");
        dropZone.innerHTML = isVideo
            ? '<video src="' + mediaUrl + '" muted playsinline autoplay loop></video>'
            : '<img src="' + mediaUrl + '" alt="">';

        statusEl.textContent = "✅ Prêt à publier.";
        submitBtn.disabled = false;
    } catch (err) {
        statusEl.className = "status err";
        statusEl.textContent = "❌ Erreur d'envoi, réessaie.";
    }
});

submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!mediaUrl) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Publication...";
    const res = await fetch("/stories/publier", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ media_url: mediaUrl, type: mediaType })
    });
    const json = await res.json();
    if (json.success) window.location.href = "/community";
    else { statusEl.className = "status err"; statusEl.textContent = json.error || "Erreur."; submitBtn.disabled = false; submitBtn.textContent = "Publier ma story"; }
});
</script>
</body>
</html>`);
});

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { media_url, type } = req.body;
        if (!media_url || !["photo","video"].includes(type)) {
            return res.json({ success:false, error:"Média manquant ou invalide." });
        }

        const expiresAt = new Date(Date.now() + STORY_DUREE_MS);

        await db.query(
            `INSERT INTO stories (auteur_id, media_url, type, expires_at, actif) VALUES ($1,$2,$3,$4,true)`,
            [req.session.userId, media_url, type, expiresAt]
        );

        res.json({ success:true });
    } catch (err) {
        console.error("❌ POST /stories/publier :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ==========================================================================
// VISIONNER LES STORIES D'UN PROFIL
// ==========================================================================
router.get("/:userId", requireAuth, async (req, res) => {
    const userId = req.params.userId;
    let user, stories = [];

    try {
        const uRows = await db.query(`SELECT id, prenom, nom FROM utilisateurs WHERE id = $1`, [userId]);
        user = uRows[0];
        if (!user) return res.status(404).send("Profil introuvable.");

        stories = await db.query(
            `SELECT * FROM stories WHERE auteur_id = $1 AND actif = true AND expires_at > now() ORDER BY created_at ASC`,
            [userId]
        );

        if (stories.length) {
            for (const s of stories) {
                await db.query(
                    `INSERT INTO stories_vues (story_id, user_id) SELECT $1, $2
                     WHERE NOT EXISTS (SELECT 1 FROM stories_vues WHERE story_id = $1 AND user_id = $2)`,
                    [s.id, req.session.userId]
                );
            }
        }
    } catch (err) {
        console.error("❌ GET /stories/:userId :", err.message);
        return res.status(500).send("Erreur de chargement.");
    }

    const nom = `${user.prenom || ""} ${user.nom || ""}`.trim() || "Membre SAMII";

    if (!stories.length) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}</style>
        </head><body><div><h2>Aucune story active</h2><p><a href="/community" style="color:#00d9ff;">← Retour</a></p></div></body></html>`);
    }

    const slidesHtml = stories.map((s, i) => `
        <div class="story-slide" data-index="${i}" style="display:${i===0?"block":"none"};">
            ${s.type === "video"
                ? `<video src="${escapeHtml(s.media_url)}" autoplay muted playsinline></video>`
                : `<img src="${escapeHtml(s.media_url)}" alt="">`}
        </div>`).join("");

    const barsHtml = stories.map((s, i) => `<div class="story-bar"><div class="story-bar-fill" data-index="${i}"></div></div>`).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(nom)} — Story</title>
<style>
* { box-sizing:border-box; }
html,body { height:100%; margin:0; background:#000; }
.story-viewer { position:relative; height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.story-slide { width:100%; height:100%; }
.story-slide img, .story-slide video { width:100%; height:100%; object-fit:contain; background:#000; }
.story-top { position:absolute; top:0; left:0; right:0; padding:14px 12px; z-index:5; background:linear-gradient(180deg,rgba(0,0,0,.6),transparent); }
.story-bars { display:flex; gap:4px; margin-bottom:10px; }
.story-bar { flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,.3); overflow:hidden; }
.story-bar-fill { height:100%; width:0%; background:#fff; }
.story-bar-fill.done { width:100%; }
.story-head { display:flex; align-items:center; gap:10px; }
.story-avatar { width:32px; height:32px; border-radius:9px; display:grid; place-items:center; font-size:11px; font-weight:900; color:#001018; background:linear-gradient(135deg,#00d9ff,#0077ff); }
.story-head strong { color:#fff; font-size:13.5px; }
.story-close { margin-left:auto; color:#fff; text-decoration:none; font-size:22px; padding:4px 8px; }
.story-nav { position:absolute; top:0; bottom:0; width:35%; z-index:4; }
.story-nav--prev { left:0; }
.story-nav--next { right:0; }
</style>
</head>
<body>
<div class="story-viewer">
    <div class="story-top">
        <div class="story-bars">${barsHtml}</div>
        <div class="story-head">
            <div class="story-avatar">${initiales(nom)}</div>
            <strong>${escapeHtml(nom)}</strong>
            <a href="/community" class="story-close">×</a>
        </div>
    </div>
    ${slidesHtml}
    <div class="story-nav story-nav--prev" onclick="precedent()"></div>
    <div class="story-nav story-nav--next" onclick="suivant()"></div>
</div>
<script>
const total = ${stories.length};
let index = 0;
let timer = null;

function afficher(i) {
    document.querySelectorAll(".story-slide").forEach((el,idx) => el.style.display = idx===i ? "block" : "none");
    document.querySelectorAll(".story-bar-fill").forEach((el,idx) => {
        el.classList.toggle("done", idx < i);
        el.style.transition = "none";
        el.style.width = idx < i ? "100%" : "0%";
    });
    const video = document.querySelectorAll(".story-slide")[i].querySelector("video");
    if (video) { video.currentTime = 0; video.play().catch(()=>{}); }

    clearTimeout(timer);
    const fill = document.querySelectorAll(".story-bar-fill")[i];
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { fill.style.transition = "width 5s linear"; fill.style.width = "100%"; });
    });
    timer = setTimeout(suivant, 5000);
}

function suivant() {
    if (index < total - 1) { index++; afficher(index); }
    else window.location.href = "/community";
}
function precedent() {
    if (index > 0) { index--; afficher(index); }
}

afficher(0);
</script>
</body>
</html>`);
});

module.exports = router;
