// ==========================================================================
// SAMII OS — VÉRIFICATION D'IDENTITÉ (livreurs + location de chambres)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const verificationService = require("../services/verificationService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

const CLOUDINARY_CLOUD_NAME = "ojwx5hft";
const CLOUDINARY_UPLOAD_PRESET = "MARKETPLACE OG";

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

router.get("/", requireAuth, async (req, res) => {
    const statutRow = await verificationService.getStatut(req.session.userId);
    const statut = statutRow?.verification_statut || "non_soumis";

    const STATUT_INFO = {
        non_soumis: { label: "Pas encore soumis", couleur: "var(--text-muted)" },
        en_attente: { label: "🟡 En cours de vérification", couleur: "#f5a623" },
        verifie: { label: "✅ Identité vérifiée", couleur: "#3ddc84" },
        refuse: { label: "❌ Refusée", couleur: "#e55" },
    };

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Vérification d'identité — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/qg-style.css">
    <style>
        .vf-shell { max-width: 560px; margin: 0 auto; padding: 40px 24px 100px; }
        .vf-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .vf-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .vf-icon-box { width: 44px; height: 44px; border-radius: 12px; background: radial-gradient(circle, rgba(95,212,255,0.2), rgba(197,160,89,0.08)); border: 1px solid rgba(95,212,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
        .vf-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .vf-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 24px; line-height: 1.6; }
        .vf-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        .vf-statut { font-weight: 700; font-size: 1.05rem; margin-bottom: 6px; }
        .vf-note { font-size: .82rem; color: var(--text-muted); margin-top: 10px; }
        .vf-upload-zone { border: 2px dashed rgba(255,255,255,0.15); border-radius: 14px; padding: 30px 20px; text-align: center; cursor: pointer; margin-top: 16px; transition: border-color .2s ease; }
        .vf-upload-zone:hover { border-color: rgba(197,160,89,0.5); }
        .vf-upload-zone img { max-width: 100%; max-height: 180px; border-radius: 10px; }
        button.vf-btn { width: 100%; padding: 14px; margin-top: 18px; background: linear-gradient(135deg, var(--gold-og), var(--gold-hover)); border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #000; font-size: .95rem; }
        button.vf-btn:disabled { opacity: .5; cursor: not-allowed; }
        .vf-msg { text-align: center; margin-top: 12px; font-size: .85rem; color: #e55; min-height: 18px; }
        .vf-msg.ok { color: #3ddc84; }
        .vf-usages { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
        .vf-usage { display: flex; align-items: center; gap: 10px; font-size: .85rem; color: var(--text-main); }
    </style>
</head>
<body data-theme="og">
<div class="vf-shell">
    <a href="/hub" class="vf-back">← Retour</a>
    <div class="vf-title">
        <div class="vf-icon-box">🪪</div>
        <h1>Vérification d'identité</h1>
    </div>
    <p class="sub">Nécessaire pour recevoir des livraisons ou publier une location de chambre — une personne vérifiée, ce sont des livreurs et des hôtes de confiance pour tout le monde.</p>

    <div class="vf-card">
        <div class="vf-statut" style="color:${STATUT_INFO[statut].couleur}">${STATUT_INFO[statut].label}</div>
        ${statut === "refuse" && statutRow?.verification_note_admin ? `<div class="vf-note">Raison : ${escapeHtml(statutRow.verification_note_admin)}</div>` : ""}

        ${statut === "verifie" ? `
            <p style="color:var(--text-muted);font-size:.85rem;margin-top:10px;">Tu peux maintenant passer en ligne comme livreur ou publier une annonce de location de chambre.</p>
        ` : statut === "en_attente" ? `
            <p style="color:var(--text-muted);font-size:.85rem;margin-top:10px;">Ta pièce d'identité est en cours de vérification par l'équipe SAMII. Ça ne prend généralement pas longtemps.</p>
        ` : `
            <div class="vf-usages">
                <div class="vf-usage">🛵 Recevoir des demandes de livraison</div>
                <div class="vf-usage">🛏️ Publier une location de chambre</div>
            </div>
            <form id="form-verif">
                <label style="display:block;font-family:var(--font-mono);font-size:.7rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">Pièce d'identité (carte nationale, passeport...)</label>
                <div class="vf-upload-zone" id="upload-zone">
                    <div id="upload-placeholder">📷 Clique pour prendre en photo ou choisir une image</div>
                    <img id="preview" style="display:none;">
                </div>
                <input type="file" id="fileInput" accept="image/*" style="display:none;">
                <input type="hidden" id="documentUrl">
                <button type="submit" class="vf-btn" id="btn-submit" disabled>Soumettre pour vérification</button>
            </form>
            <div class="vf-msg" id="msg"></div>
        `}
    </div>
</div>

<script>
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("upload-placeholder");
const documentUrl = document.getElementById("documentUrl");
const btnSubmit = document.getElementById("btn-submit");
const msg = document.getElementById("msg");

uploadZone?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { msg.textContent = "❌ Fichier image invalide."; return; }
    if (file.size > 10 * 1024 * 1024) { msg.textContent = "❌ Image trop lourde (10 Mo max)."; return; }

    placeholder.textContent = "⏳ Envoi...";
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "${CLOUDINARY_UPLOAD_PRESET}");
        const response = await fetch("https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload", { method: "POST", body: formData });
        const json = await response.json();
        if (!response.ok || !json.secure_url) throw new Error("upload échoué");

        documentUrl.value = json.secure_url;
        preview.src = json.secure_url;
        preview.style.display = "block";
        placeholder.style.display = "none";
        btnSubmit.disabled = false;
    } catch {
        placeholder.textContent = "❌ Échec de l'envoi, réessaie.";
    }
});

document.getElementById("form-verif")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!documentUrl.value) return;
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Envoi...";
    try {
        const res = await fetch("/verification/soumettre", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentUrl: documentUrl.value }),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = "✅ Envoyé — en attente de vérification.";
            msg.className = "vf-msg ok";
            setTimeout(() => location.reload(), 1200);
        } else {
            msg.textContent = json.error || "Erreur.";
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Soumettre pour vérification";
        }
    } catch {
        msg.textContent = "Erreur réseau.";
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Soumettre pour vérification";
    }
});
</script>
</body>
</html>`);
});

router.post("/soumettre", requireAuth, async (req, res) => {
    try {
        const { documentUrl } = req.body;
        if (!documentUrl || typeof documentUrl !== "string" || !documentUrl.startsWith("https://")) {
            return res.json({ success: false, error: "Document manquant." });
        }
        await verificationService.soumettre(req.session.userId, documentUrl);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /verification/soumettre :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
