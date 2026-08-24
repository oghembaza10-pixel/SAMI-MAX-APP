// ==========================================================================
// SAMII OS — QG AGENCE
// Un compte "agence" (utilisateurs.type_compte = 'agence', choisi à
// l'inscription) crée et pilote les boutiques de ses clients, en autonomie.
// Chaque client garde son propre accès direct (mêmes règles que n'importe
// quel compte SAMII — connexion par email, workspace lié via owner_email) ;
// l'agence, elle, entre dans ces mêmes boutiques via le lien supplémentaire
// workspaces.agence_id → utilisateurs.id (voir
// scripts/alter-workspaces-agence.js et services/workspaceService.js).
// ==========================================================================
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../services/db");
const gmail = require("../services/gmail");
const CONFIG = require("../config");
const workspaceService = require("../services/workspaceService");
const journalService = require("../services/journalService");

function requireAgence(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    if (req.session.typeCompte !== "agence") return res.redirect("/hub");
    next();
}

// L'agence est autonome : elle crée les espaces de ses clients quand elle
// veut, sans validation préalable — c'est elle qui tient la relation client.
//
// Le contrôle se fait donc EN AVAL, pas en amont :
//   1. chaque création est tracée dans le journal (action agence.client.cree)
//      et remonte en direct dans l'espace admin ;
//   2. le client est prévenu par email dès que son espace est créé, avec le
//      nom de l'agence — le vrai propriétaire de l'adresse sait donc
//      immédiatement qu'un espace existe à son nom, et peut le signaler.
// Un abus reste visible et réversible, sans jamais ralentir une agence
// légitime.

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

// Métiers qui fonctionnent en rendez-vous (médical, hôtellerie, immobilier,
// services...) plutôt qu'en commandes : une agence gère souvent les deux
// mondes en même temps — un resto, une clinique, un hôtel, une boutique en
// ligne — et chaque fiche doit montrer le chiffre qui compte pour CE métier.
const METIERS_RDV = new Set(["sante", "immobilier", "services", "tourisme", "education", "finance"]);

// Une agence qui ne voit qu'une liste de noms doit entrer dans chaque espace
// pour savoir si ça tourne. Ces agrégats lui donnent l'état réel de tout son
// portefeuille d'un coup d'œil, en une seule requête par table plutôt qu'une
// par client (sinon 30 clients = 60 requêtes à chaque chargement).
async function chargerActivite(workspaceIds) {
    if (!workspaceIds.length) return {};

    const [commandes, rdvs] = await Promise.all([
        db.query(
            `SELECT workspace_id,
                    COUNT(*) FILTER (WHERE date_commande >= CURRENT_DATE)::int          AS jour,
                    COUNT(*) FILTER (WHERE date_commande >= CURRENT_DATE - 7)::int      AS semaine,
                    COUNT(*) FILTER (WHERE statut = 'en attente')::int                  AS attente,
                    COALESCE(SUM(montant) FILTER (WHERE date_commande >= CURRENT_DATE - 30), 0)::numeric AS ca_mois,
                    MAX(date_commande)                                                  AS derniere
               FROM commandes
              WHERE workspace_id = ANY($1)
              GROUP BY workspace_id`,
            [workspaceIds],
        ),
        db.query(
            `SELECT workspace_id,
                    COUNT(*) FILTER (WHERE date_rdv >= CURRENT_DATE)::int               AS a_venir,
                    COUNT(*) FILTER (WHERE statut = 'en_attente')::int                  AS attente,
                    MAX(created_at)                                                     AS derniere
               FROM rendez_vous
              WHERE workspace_id = ANY($1)
              GROUP BY workspace_id`,
            [workspaceIds],
        ),
    ]);

    const parWorkspace = {};
    for (const id of workspaceIds) {
        parWorkspace[id] = { jour: 0, semaine: 0, attente: 0, caMois: 0, rdvAVenir: 0, derniere: null };
    }
    for (const c of commandes) {
        const e = parWorkspace[c.workspace_id];
        if (!e) continue;
        e.jour = c.jour; e.semaine = c.semaine; e.attente = c.attente;
        e.caMois = Number(c.ca_mois) || 0;
        e.derniere = c.derniere;
    }
    for (const r of rdvs) {
        const e = parWorkspace[r.workspace_id];
        if (!e) continue;
        e.rdvAVenir = r.a_venir;
        e.attente += r.attente;
        if (r.derniere && (!e.derniere || new Date(r.derniere) > new Date(e.derniere))) e.derniere = r.derniere;
    }
    return parWorkspace;
}

function joursDepuis(date) {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

router.get("/", requireAgence, async (req, res) => {
    const clients = await workspaceService.getByAgence(req.session.userId);
    const nbActifs = clients.filter(c => c.agenceStatut === "actif").length;
    const nbAbandon = clients.filter(c => c.agenceStatut === "abandon_demande").length;

    let activite = {};
    try {
        activite = await chargerActivite(clients.map(c => c.workspaceId));
    } catch (err) {
        // Le portefeuille doit rester consultable même si l'agrégat échoue :
        // on perd les chiffres, jamais la liste des clients.
        console.error("❌ QG Agence — activité :", err.message);
    }

    // Un client "en alerte" = aucune commande ni RDV depuis plus de 7 jours,
    // ou des demandes en attente non traitées. C'est exactement ce qu'une
    // agence doit voir en premier : là où son intervention est nécessaire.
    const enAlerte = clients.filter(c => {
        const a = activite[c.workspaceId];
        if (!a || c.agenceStatut !== "actif") return false;
        const jours = joursDepuis(a.derniere);
        return a.attente > 0 || jours === null || jours > 7;
    }).length;

    const totalJour = Object.values(activite).reduce((s, a) => s + (a.jour || 0), 0);
    const totalAttente = Object.values(activite).reduce((s, a) => s + (a.attente || 0), 0);

    // L'agence est autonome, mais elle doit savoir que son client est
    // prévenu : c'est ce qui rend la démarche propre vis-à-vis du client
    // final, et ça évite qu'elle découvre l'email après coup.
    const bandeauValidation = `
        <div class="ag-validation">
            <strong>✅ Votre espace est actif</strong>
            <p>Vous créez les espaces de vos clients librement. Chaque client reçoit un email l'informant que son espace SAMII a été ouvert par votre agence, et garde son propre accès direct — vous, vous gardez la vue et le contrôle sur l'ensemble.</p>
        </div>`;

    const paysOptions = Object.entries(PAYS_DEVISE)
        .map(([code, p]) => `<option value="${code}">${escapeHtml(p.label)}</option>`)
        .join("");
    const metierOptions = [...METIERS_VALIDES]
        .map(m => `<option value="${m}">${escapeHtml(m.charAt(0).toUpperCase() + m.slice(1))}</option>`)
        .join("");

    const ICONE_METIER = {
        ecommerce: "🛍️", restaurant: "🍽️", sante: "🩺", tourisme: "🏨",
        immobilier: "🏘️", livreur: "🚚", finance: "💳", education: "🎓",
        technologie: "💻", agriculture: "🌾", industrie: "🏭", services: "🧰",
    };

    const clientsHtml = clients.length ? clients.map(c => {
        const a = activite[c.workspaceId] || { jour: 0, semaine: 0, attente: 0, caMois: 0, rdvAVenir: 0, derniere: null };
        const estRdv = METIERS_RDV.has((c.metier || "").toLowerCase());
        const jours = joursDepuis(a.derniere);

        const statutBadge = c.agenceStatut === "abandon_demande"
            ? `<span class="ag-badge ag-badge--attente">Fermeture demandée</span>`
            : a.attente > 0
                ? `<span class="ag-badge ag-badge--alerte">${a.attente} à traiter</span>`
                : (jours === null || jours > 7)
                    ? `<span class="ag-badge ag-badge--dormant">Sans activité</span>`
                    : `<span class="ag-badge ag-badge--actif">Actif</span>`;

        // Le chiffre mis en avant dépend du métier : un hôtel ou une clinique
        // vit sur ses rendez-vous, un resto ou une boutique sur ses commandes.
        const chiffres = estRdv
            ? `<div class="ag-metric"><strong>${a.rdvAVenir}</strong><span>RDV à venir</span></div>
               <div class="ag-metric"><strong>${a.semaine}</strong><span>7 derniers jours</span></div>`
            : `<div class="ag-metric"><strong>${a.jour}</strong><span>Commandes aujourd'hui</span></div>
               <div class="ag-metric"><strong>${a.semaine}</strong><span>7 derniers jours</span></div>`;

        const caFormate = a.caMois > 0
            ? `<div class="ag-metric"><strong>${Math.round(a.caMois).toLocaleString("fr-FR")}</strong><span>${escapeHtml(c.devise || "")} · 30 j</span></div>`
            : "";

        const derniereActivite = jours === null
            ? `Aucune activité pour l'instant`
            : jours === 0 ? `Activité aujourd'hui`
            : jours === 1 ? `Dernière activité hier`
            : `Dernière activité il y a ${jours} jours`;

        return `
        <div class="ag-client" data-metier="${escapeHtml(c.metier || "")}" data-nom="${escapeHtml((c.nom || "").toLowerCase())}">
            <div class="ag-client-head">
                <div class="ag-client-avatar">${ICONE_METIER[c.metier] || "🏢"}</div>
                <div class="ag-client-info">
                    <strong>${escapeHtml(c.nom)}</strong>
                    <span>${escapeHtml(c.metier || "")} · ${escapeHtml(c.owner)}</span>
                </div>
                ${statutBadge}
            </div>
            <div class="ag-metrics">${chiffres}${caFormate}</div>
            <div class="ag-client-foot">
                <span class="ag-derniere${jours === null || jours > 7 ? " ag-derniere--alerte" : ""}">${derniereActivite}</span>
                <div class="ag-client-actions">
                    <a href="/agence/entrer/${encodeURIComponent(c.workspaceId)}" class="ag-btn-entrer">Entrer →</a>
                    ${c.agenceStatut === "actif" ? `<button type="button" class="ag-btn-abandon" data-id="${escapeHtml(c.workspaceId)}">Abandonné</button>` : ""}
                </div>
            </div>
        </div>`;
    }).join("") : `<div class="ag-empty">Aucun client pour l'instant. Ajoutez votre premier client ci-dessus.</div>`;

    // Filtres par métier : seulement ceux réellement présents dans le
    // portefeuille — inutile d'afficher "agriculture" à une agence qui ne
    // gère que des restos et des cliniques.
    const metiersPresents = [...new Set(clients.map(c => c.metier).filter(Boolean))];
    const filtresHtml = metiersPresents.length > 1
        ? `<div class="ag-filtres">
               <button type="button" class="ag-filtre active" data-filtre="tous">Tous (${clients.length})</button>
               ${metiersPresents.map(m => {
                   const n = clients.filter(c => c.metier === m).length;
                   return `<button type="button" class="ag-filtre" data-filtre="${escapeHtml(m)}">${ICONE_METIER[m] || "🏢"} ${escapeHtml(m)} (${n})</button>`;
               }).join("")}
           </div>`
        : "";

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
.ag-validation { background:rgba(61,220,132,.07); border:1px solid rgba(61,220,132,.3); border-radius:var(--radius); padding:16px 18px; margin-bottom:22px; }
.ag-validation strong { display:block; color:var(--green); font-size:14px; margin-bottom:6px; }
.ag-validation p { margin:0; color:var(--muted); font-size:12.8px; line-height:1.65; }
.ag-stats-bar { display:flex; gap:14px; margin:20px 0; }
.ag-stat { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; text-align:center; }
.ag-stat strong { display:block; font-family:"JetBrains Mono"; font-size:22px; color:var(--green); }
.ag-stat strong.attente { color:var(--gold); }
.ag-stat strong.alerte { color:#ff6b6b; }
@media (max-width:600px) { .ag-stats-bar { flex-wrap:wrap; } .ag-stat { min-width:calc(50% - 7px); } }
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
/* Recherche + filtres par métier : une agence qui gère 20 clients de
   métiers différents doit retrouver le bon en deux secondes. */
.ag-outils { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.ag-recherche { flex:1; min-width:200px; padding:11px 14px; border-radius:11px; background:rgba(0,0,0,.35); border:1px solid var(--border); color:var(--text); font-size:13px; font-family:Inter,sans-serif; }
.ag-recherche:focus { outline:none; border-color:var(--blue); }
.ag-recherche::placeholder { color:var(--muted); }
.ag-filtres { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:16px; }
.ag-filtre { padding:7px 13px; border-radius:20px; border:1px solid var(--border); background:transparent; color:var(--muted); font-size:11.5px; cursor:pointer; font-family:Inter,sans-serif; text-transform:capitalize; transition:.2s ease; }
.ag-filtre:hover { color:var(--text); border-color:var(--blue); }
.ag-filtre.active { background:rgba(0,217,255,.13); color:var(--blue); border-color:var(--blue); font-weight:700; }

/* Fiche client : une carte par client, avec les chiffres qui comptent pour
   SON métier (commandes pour un resto/e-com, RDV pour une clinique/hôtel). */
.ag-client { background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:16px; margin-bottom:12px; transition:border-color .2s ease, transform .2s ease; }
.ag-client:hover { border-color:rgba(0,217,255,.4); transform:translateY(-1px); }
.ag-client-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.ag-client-avatar { width:42px; height:42px; border-radius:12px; background:rgba(0,217,255,.1); border:1px solid var(--border); display:grid; place-items:center; font-size:19px; flex-shrink:0; }
.ag-client-info { flex:1; display:flex; flex-direction:column; min-width:150px; }
.ag-client-info strong { font-size:14.5px; }
.ag-client-info span { font-size:11px; color:var(--muted); text-transform:capitalize; }
.ag-badge { font-size:10px; font-family:"JetBrains Mono"; padding:4px 10px; border-radius:20px; white-space:nowrap; }
.ag-badge--actif { color:var(--green); background:rgba(61,220,132,.1); }
.ag-badge--attente { color:var(--gold); background:rgba(215,179,76,.1); }
.ag-badge--alerte { color:#ff6b6b; background:rgba(255,107,107,.1); font-weight:700; }
.ag-badge--dormant { color:var(--muted); background:rgba(127,150,168,.09); }

.ag-metrics { display:flex; gap:10px; margin:14px 0 12px; flex-wrap:wrap; }
.ag-metric { flex:1; min-width:92px; background:rgba(0,0,0,.28); border-radius:11px; padding:10px 12px; }
.ag-metric strong { display:block; font-family:"JetBrains Mono"; font-size:19px; color:var(--blue); line-height:1.2; }
.ag-metric span { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }

.ag-client-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:11px; border-top:1px solid rgba(255,255,255,.05); }
.ag-derniere { font-size:11.5px; color:var(--muted); }
.ag-derniere--alerte { color:var(--gold); }
.ag-client-actions { display:flex; gap:8px; }
.ag-btn-entrer { padding:8px 15px; border-radius:9px; background:rgba(0,217,255,.12); color:var(--blue); text-decoration:none; font-size:12px; font-weight:700; border:1px solid rgba(0,217,255,.25); }
.ag-btn-entrer:hover { background:rgba(0,217,255,.2); }
.ag-btn-abandon { padding:8px 14px; border-radius:9px; border:1px solid rgba(215,179,76,.3); background:transparent; color:var(--gold); font-size:12px; cursor:pointer; }
.ag-empty { text-align:center; padding:40px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.ag-aucun-resultat { text-align:center; padding:28px; color:var(--muted); font-size:13px; }
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
        <div class="ag-stat"><strong>${totalJour}</strong><span>Aujourd'hui</span></div>
        <div class="ag-stat"><strong class="${totalAttente ? "attente" : ""}">${totalAttente}</strong><span>À traiter</span></div>
        <div class="ag-stat"><strong class="${enAlerte ? "alerte" : ""}">${enAlerte}</strong><span>Demandent attention</span></div>
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
    ${clients.length ? `<div class="ag-outils">
        <input type="search" class="ag-recherche" id="ag-recherche" placeholder="Rechercher un client...">
    </div>
    ${filtresHtml}` : ""}
    <div id="liste-clients">${clientsHtml}</div>
    <div class="ag-aucun-resultat" id="ag-aucun-resultat" style="display:none;">Aucun client ne correspond à cette recherche.</div>
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

// Recherche + filtre métier : tout se fait côté navigateur sur les fiches
// déjà chargées — pas d'aller-retour serveur, le portefeuille tient
// largement en mémoire même avec plusieurs dizaines de clients.
(function filtrerClients() {
    const recherche = document.getElementById("ag-recherche");
    const fiches = [...document.querySelectorAll(".ag-client")];
    const aucun = document.getElementById("ag-aucun-resultat");
    if (!fiches.length) return;

    let metierActif = "tous";

    function appliquer() {
        const texte = (recherche?.value || "").trim().toLowerCase();
        let visibles = 0;
        fiches.forEach(f => {
            const okMetier = metierActif === "tous" || f.dataset.metier === metierActif;
            const okTexte = !texte || (f.dataset.nom || "").includes(texte) || f.textContent.toLowerCase().includes(texte);
            const visible = okMetier && okTexte;
            f.style.display = visible ? "" : "none";
            if (visible) visibles++;
        });
        if (aucun) aucun.style.display = visibles === 0 ? "block" : "none";
    }

    recherche?.addEventListener("input", appliquer);
    document.querySelectorAll(".ag-filtre").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".ag-filtre").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            metierActif = btn.dataset.filtre;
            appliquer();
        });
    });
})();

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

        const emailClient = email.trim().toLowerCase();
        const nomAgence = req.session.nom || "votre agence";

        await journalService.log({
            action: "agence.client.cree",
            details: `Boutique "${nom.trim()}" créée par l'agence ${nomAgence} pour ${emailClient}`,
            workspaceId: workspace.workspaceId,
            userId: req.session.userId,
        });

        // Le client est prévenu tout de suite : il apprend qu'un espace
        // existe à son nom, par qui, et comment y accéder lui-même. C'est ce
        // qui rend la démarche propre — le propriétaire réel de l'adresse
        // n'est jamais mis devant le fait accompli. En tâche de fond : un
        // souci d'envoi ne doit pas faire échouer la création côté agence.
        gmail.send({
            to: emailClient,
            subject: `Votre espace SAMII "${nom.trim()}" a été créé`,
            html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#C5A059;">Votre espace SAMII est prêt 👑</h2>
        <p><strong>${escapeHtml(nomAgence)}</strong> vient de créer l'espace <strong>${escapeHtml(nom.trim())}</strong> pour vous sur SAMII OS.</p>
        <p>Pour y accéder, créez votre compte avec <strong>cette adresse email</strong> : votre espace vous sera automatiquement rattaché, et vous en serez le propriétaire.</p>
        <a href="${CONFIG.APP_URL}/register" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;background:#C5A059;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;font-size:16px;">
            👉 Accéder à mon espace
        </a>
        <p style="color:#888;font-size:.82rem;line-height:1.6;">Votre agence garde une vue sur cet espace pour vous accompagner. Vous en restez le propriétaire et pouvez nous contacter à tout moment.</p>
        <p style="color:#888;font-size:.82rem;">Vous ne connaissez pas cette agence ? Répondez simplement à cet email, nous fermerons l'espace.</p>
    </div>`,
        }).catch(err => console.warn("⚠️ Email création espace client (agence) :", err.message));

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
