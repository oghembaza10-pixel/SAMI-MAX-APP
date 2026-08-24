// ==========================================================================
// SAMII OS — QG AGENCE
// Un compte "agence" (utilisateurs.type_compte = 'agence', activé
// manuellement par OG Technology) crée et pilote les boutiques de ses
// clients. Chaque client garde son propre accès direct (mêmes règles que
// n'importe quel compte SAMII — connexion par email, workspace lié via
// owner_email) ; l'agence, elle, entre dans ces mêmes boutiques via le lien
// supplémentaire workspaces.agence_id → utilisateurs.id (voir
// scripts/alter-workspaces-agence.js et services/workspaceService.js).
// ==========================================================================
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../services/db");
const workspaceService = require("../services/workspaceService");
const journalService = require("../services/journalService");

function requireAgence(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (req.session.typeCompte !== "agence") return res.redirect("/hub");
    next();
}

// Une agence peut s'inscrire seule (type_compte = 'agence' choisi à
// l'inscription) et entre tout de suite dans son QG. En revanche, créer la
// boutique d'un client se fait sur un email QUELCONQUE : sans validation,
// n'importe qui pourrait s'inscrire comme agence et pré-réserver l'espace
// d'un email qui ne lui appartient pas, puis y garder un accès permanent
// (workspaces.agence_id) le jour où le vrai propriétaire s'inscrit.
// D'où ce verrou : le compte vit normalement, seule la création de clients
// attend qu'OG Technology ait validé l'agence.
// Le statut vit dans utilisateurs.statut_acces, colonne qui existe déjà —
// aucune migration à passer. login.js ne bloque que "suspendu", donc une
// agence en validation se connecte et navigue sans aucune gêne.
async function agenceEstValidee(userId) {
    try {
        const rows = await db.query(`SELECT statut_acces FROM utilisateurs WHERE id = $1`, [userId]);
        return rows[0]?.statut_acces !== "agence_en_validation";
    } catch (err) {
        // En cas de doute (base indisponible), on refuse : mieux vaut une
        // agence légitime qui réessaie qu'un espace réservé à tort.
        console.error("❌ agenceEstValidee :", err.message);
        return false;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function generateWorkspaceId() {
    return `WS-${crypto.randomUUID()}`;
}

const METIERS_VALIDES = new Set([
    "ecommerce", "restaurant", "immobilier", "livreur", "sante", "finance",
    "education", "technologie", "agriculture", "industrie", "services", "tourisme",
]);

const PAYS_DEVISE = {
    DZ: { label: "Algérie",  devise: "DZD" },
    FR: { label: "France",   devise: "EUR" },
    MA: { label: "Maroc",    devise: "MAD" },
    TN: { label: "Tunisie",  devise: "TND" },
    US: { label: "États-Unis", devise: "USD" },
    CA: { label: "Canada",   devise: "CAD" },
    SA: { label: "Arabie Saoudite", devise: "SAR" },
    AE: { label: "Émirats arabes unis", devise: "AED" },
    autre: { label: "Autre", devise: "" },
};

router.get("/", requireAgence, async (req, res) => {
    const clients = await workspaceService.getByAgence(req.session.userId);
    const nbActifs = clients.filter(c => c.agenceStatut === "actif").length;
    const nbAbandon = clients.filter(c => c.agenceStatut === "abandon_demande").length;

    // Une agence auto-inscrite voit son QG complet dès la première seconde,
    // mais doit savoir noir sur blanc pourquoi "Ajouter un client" ne
    // fonctionne pas encore — sinon elle croit à un bug et s'en va.
    const validee = await agenceEstValidee(req.session.userId);
    const bandeauValidation = validee ? "" : `
        <div class="ag-validation">
            <strong>⏳ Compte agence en cours de validation</strong>
            <p>Vous avez accès à votre QG, mais la création d'espaces clients est ouverte après un échange avec notre équipe — nous vous contactons sous 24 h. C'est ce qui garantit qu'une agence ne puisse pas réserver l'espace d'un email qui ne lui appartient pas.</p>
        </div>`;

    const paysOptions = Object.entries(PAYS_DEVISE)
        .map(([code, p]) => `<option value="${code}">${escapeHtml(p.label)}</option>`)
        .join("");
    const metierOptions = [...METIERS_VALIDES]
        .map(m => `<option value="${m}">${escapeHtml(m.charAt(0).toUpperCase() + m.slice(1))}</option>`)
        .join("");

    const clientsHtml = clients.length ? clients.map(c => {
        const statutBadge = c.agenceStatut === "abandon_demande"
            ? `<span class="ag-badge ag-badge--attente">Fermeture demandée</span>`
            : `<span class="ag-badge ag-badge--actif">Actif</span>`;
        const dateCreation = c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "";
        return `
        <div class="ag-client">
            <div class="ag-client-avatar">${escapeHtml((c.nom || "?").charAt(0).toUpperCase())}</div>
            <div class="ag-client-info">
                <strong>${escapeHtml(c.nom)}</strong>
                <span>${escapeHtml(c.metier || "")} · ${escapeHtml(c.owner)} · depuis le ${dateCreation}</span>
            </div>
            ${statutBadge}
            <div class="ag-client-actions">
                <a href="/agence/entrer/${encodeURIComponent(c.workspaceId)}" class="ag-btn-entrer">Entrer</a>
                ${c.agenceStatut === "actif" ? `<button type="button" class="ag-btn-abandon" data-id="${escapeHtml(c.workspaceId)}">Marquer abandonné</button>` : ""}
            </div>
        </div>`;
    }).join("") : `<div class="ag-empty">Aucun client pour l'instant. Ajoutez votre premier client ci-dessus.</div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QG Agence — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --green:#3ddc84; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:0 0 70px; }
.ag-wrap { max-width:820px; margin:0 auto; padding:0 20px; }
.ag-top-row { display:flex; align-items:center; justify-content:space-between; padding:20px 0 0; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; }
.back-link:hover { color:var(--blue); }
h1 { font-size:24px; margin:18px 0 4px; display:flex; align-items:center; gap:10px; }
.ag-sub { color:var(--muted); font-size:13.5px; margin-bottom:24px; }
.ag-validation { background:rgba(215,179,76,.09); border:1px solid rgba(215,179,76,.34); border-radius:var(--radius); padding:16px 18px; margin-bottom:22px; }
.ag-validation strong { display:block; color:var(--gold); font-size:14px; margin-bottom:6px; }
.ag-validation p { margin:0; color:var(--muted); font-size:12.8px; line-height:1.65; }
.ag-stats-bar { display:flex; gap:14px; margin:20px 0; }
.ag-stat { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; text-align:center; }
.ag-stat strong { display:block; font-family:"JetBrains Mono"; font-size:22px; color:var(--green); }
.ag-stat strong.attente { color:var(--gold); }
.ag-stat span { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.section-title { font-size:15px; font-weight:800; margin:28px 0 12px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:16px; height:16px; color:var(--blue); }
.ag-add-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:10px; }
.ag-add-btn { padding:12px 20px; border-radius:10px; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); }
.ag-form { display:none; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
.ag-form.show { display:grid; }
.ag-form label { display:block; font-family:"JetBrains Mono"; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:6px; }
.ag-form input, .ag-form select { width:100%; padding:11px 12px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13px; outline:none; }
.ag-form-full { grid-column:1 / -1; }
.ag-form-submit { grid-column:1 / -1; padding:12px; border-radius:10px; border:none; background:linear-gradient(135deg,var(--green),#2bb96f); color:#001018; font-weight:800; cursor:pointer; margin-top:6px; }
.ag-form-msg { grid-column:1 / -1; font-size:12.5px; }
.ag-client { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:12px 14px; margin-bottom:10px; flex-wrap:wrap; }
.ag-client-avatar { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-weight:800; color:#001018; flex-shrink:0; }
.ag-client-info { flex:1; display:flex; flex-direction:column; min-width:160px; }
.ag-client-info strong { font-size:13.5px; }
.ag-client-info span { font-size:11px; color:var(--muted); }
.ag-badge { font-size:10px; font-family:"JetBrains Mono"; padding:4px 10px; border-radius:20px; white-space:nowrap; }
.ag-badge--actif { color:var(--green); background:rgba(61,220,132,.1); }
.ag-badge--attente { color:var(--gold); background:rgba(215,179,76,.1); }
.ag-client-actions { display:flex; gap:8px; }
.ag-btn-entrer { padding:8px 14px; border-radius:9px; background:rgba(0,217,255,.12); color:var(--blue); text-decoration:none; font-size:12px; font-weight:700; }
.ag-btn-abandon { padding:8px 14px; border-radius:9px; border:1px solid rgba(215,179,76,.3); background:transparent; color:var(--gold); font-size:12px; cursor:pointer; }
.ag-empty { text-align:center; padding:40px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
</style>
</head>
<body>
<div class="ag-top-row">
    <a href="/hub" class="back-link"><i data-lucide="arrow-left"></i> Retour</a>
</div>
<div class="ag-wrap">
    <h1>🏢 QG Agence</h1>
    <p class="ag-sub">Créez et gérez les boutiques de vos clients depuis un seul endroit. Chaque client garde aussi son propre accès direct à sa boutique.</p>
    ${bandeauValidation}

    <div class="ag-stats-bar">
        <div class="ag-stat"><strong>${clients.length}</strong><span>Clients</span></div>
        <div class="ag-stat"><strong>${nbActifs}</strong><span>Actifs</span></div>
        <div class="ag-stat"><strong class="attente">${nbAbandon}</strong><span>Fermeture demandée</span></div>
    </div>

    <div class="ag-add-card">
        <button type="button" class="ag-add-btn" id="btn-toggle-form">+ Ajouter un client</button>
        <form class="ag-form" id="form-creer-client">
            <div><label>Nom de la boutique</label><input name="nom" required></div>
            <div><label>Métier</label><select name="metier" required><option value="">Choisir...</option>${metierOptions}</select></div>
            <div><label>Email du client</label><input name="email" type="email" required></div>
            <div><label>Pays</label><select name="pays" required><option value="">Choisir...</option>${paysOptions}</select></div>
            <div class="ag-form-full ag-form-msg" id="form-msg"></div>
            <button type="submit" class="ag-form-submit">Créer la boutique</button>
        </form>
    </div>

    <div class="section-title"><i data-lucide="store"></i> Vos clients</div>
    <div id="liste-clients">${clientsHtml}</div>
</div>

<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.getElementById("btn-toggle-form").addEventListener("click", () => {
    document.getElementById("form-creer-client").classList.toggle("show");
});

document.getElementById("form-creer-client").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("form-msg");
    msg.style.color = "var(--muted)";
    msg.textContent = "Création en cours...";
    const formData = new FormData(e.target);
    try {
        const res = await fetch("/agence/creer-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(formData)),
        });
        const json = await res.json();
        if (json.success) {
            msg.style.color = "var(--green)";
            msg.textContent = "✅ Boutique créée. Rechargement...";
            setTimeout(() => location.reload(), 900);
        } else {
            msg.style.color = "#ff8a8a";
            msg.textContent = "❌ " + (json.error || "Erreur.");
        }
    } catch (err) {
        msg.style.color = "#ff8a8a";
        msg.textContent = "❌ Erreur réseau.";
    }
});

document.querySelectorAll(".ag-btn-abandon").forEach(btn => {
    btn.addEventListener("click", async () => {
        if (!confirm("Signaler ce client comme abandonné ? OG Technology validera la fermeture de son espace.")) return;
        try {
            const res = await fetch("/agence/abandonner/" + btn.dataset.id, { method: "POST" });
            const json = await res.json();
            if (json.success) location.reload();
            else alert("❌ " + (json.error || "Erreur."));
        } catch (err) {
            alert("❌ Erreur réseau.");
        }
    });
});
</script>
</body>
</html>`);
});

router.post("/creer-client", requireAgence, async (req, res) => {
    try {
        if (!await agenceEstValidee(req.session.userId)) {
            return res.json({
                success: false,
                error: "Votre compte agence est en cours de validation. Nous vous contactons sous 24 h pour l'activer — vous pourrez alors créer les espaces de vos clients.",
            });
        }

        const { nom, metier, email, pays } = req.body;
        if (!nom || !nom.trim()) return res.json({ success: false, error: "Le nom de la boutique est obligatoire." });
        if (!METIERS_VALIDES.has(metier)) return res.json({ success: false, error: "Métier invalide." });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: false, error: "Email client invalide." });
        if (!PAYS_DEVISE[pays]) return res.json({ success: false, error: "Pays invalide." });

        const existant = await workspaceService.getByOwner(email.trim().toLowerCase());
        if (existant.length > 0) return res.json({ success: false, error: "Ce client a déjà une boutique sur SAMII." });

        const workspace = await workspaceService.create({
            workspaceId: generateWorkspaceId(),
            owner: email.trim().toLowerCase(),
            nom: nom.trim(),
            metier,
            pays,
            devise: PAYS_DEVISE[pays].devise || "USD",
            agenceId: req.session.userId,
        });
        if (!workspace) return res.json({ success: false, error: "Erreur lors de la création. Réessayez." });

        await journalService.log({
            action: "agence.client.cree",
            details: `Boutique "${nom.trim()}" créée par l'agence pour ${email.trim().toLowerCase()}`,
            workspaceId: workspace.workspaceId,
            userId: req.session.userId,
        });

        res.json({ success: true, workspaceId: workspace.workspaceId });
    } catch (err) {
        console.error("❌ POST /agence/creer-client :", err.message);
        res.json({ success: false, error: "Erreur interne. Réessayez." });
    }
});

router.post("/abandonner/:workspaceId", requireAgence, async (req, res) => {
    try {
        const workspace = await workspaceService.getById(req.params.workspaceId);
        if (!workspace || workspace.agenceId !== req.session.userId) {
            return res.json({ success: false, error: "Boutique introuvable ou non autorisée." });
        }

        await db.query(`UPDATE workspaces SET agence_statut = 'abandon_demande' WHERE id = $1`, [workspace.workspaceId]);
        await journalService.log({
            action: "agence.client.abandon_demande",
            details: `Fermeture demandée par l'agence pour "${workspace.nom}"`,
            workspaceId: workspace.workspaceId,
            userId: req.session.userId,
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /agence/abandonner :", err.message);
        res.json({ success: false, error: "Erreur interne." });
    }
});

router.get("/entrer/:workspaceId", requireAgence, async (req, res) => {
    try {
        const workspace = await workspaceService.getById(req.params.workspaceId);
        if (!workspace || workspace.agenceId !== req.session.userId) {
            return res.redirect("/agence");
        }
        req.session.workspaceId = workspace.workspaceId;
        req.session.metier      = workspace.metier;
        req.session.save((err) => {
            if (err) return res.redirect("/agence");
            res.redirect("/qg");
        });
    } catch (err) {
        console.error("❌ GET /agence/entrer :", err.message);
        res.redirect("/agence");
    }
});

module.exports = router;
