// ==========================================================================
// SAMII OS — CENTRE DE CONTRÔLE (admin)
// Page privée, indépendante du système de compte normal : email + mot de
// passe dédiés, stockés dans admin_comptes. Premier accès = création du
// compte admin (une seule fois, tant que la table est vide).
// ==========================================================================
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../services/db");
const { confirmCcpAbonnement } = require("../services/orders");
const verificationService = require("../services/verificationService");

const ROOM_ADMIN = "partenariat-admin";

const CATEGORIES = {
    investisseur: "💰 Investisseur",
    createur: "🎥 Créateur de contenu",
    developpeur: "💻 Développeur",
    fournisseur: "📦 Fournisseur / Logistique",
    marketing: "📣 Affilié / Marketing",
    autre: "✍️ Autre",
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function requireAdmin(req, res, next) {
    if (!req.session?.isAdmin) return res.redirect("/admin/login");
    next();
}

function pageShell(title, body) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --green:#3ddc84; --border:rgba(0,217,255,.16); --radius:16px; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; }
a { color:var(--blue); }
</style>
</head>
<body>${body}</body>
</html>`;
}

function authFormPage({ title, intro, action, fields, error, submitLabel }) {
    return pageShell(title, `
<div style="max-width:400px;margin:80px auto;padding:0 20px;">
    <h1 style="font-size:22px;margin-bottom:6px;">🔐 ${escapeHtml(title)}</h1>
    <p style="color:var(--muted);font-size:13px;margin-bottom:22px;">${intro}</p>
    <form method="POST" action="${action}" style="background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:22px;">
        ${fields}
        ${error ? `<div style="color:#ff5470;font-size:12.5px;margin-top:4px;">${escapeHtml(error)}</div>` : ""}
        <button type="submit" style="width:100%;padding:13px;margin-top:16px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:#001018;font-weight:800;cursor:pointer;">${submitLabel}</button>
    </form>
</div>
<style>
label { display:block; font-family:"JetBrains Mono"; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:14px 0 6px; }
label:first-of-type { margin-top:0; }
input { width:100%; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13.5px; outline:none; }
input:focus { border-color:var(--blue); }
</style>`);
}

router.get("/login", async (req, res) => {
    if (req.session?.isAdmin) return res.redirect("/admin");

    let compteExiste = false;
    try {
        const rows = await db.query(`SELECT id FROM admin_comptes LIMIT 1`);
        compteExiste = rows.length > 0;
    } catch (err) {
        console.error("❌ GET /admin/login :", err.message);
    }

    if (!compteExiste) {
        return res.send(authFormPage({
            title: "Créer ton accès admin",
            intro: "Premier accès : choisis l'email et le mot de passe de ta page de contrôle. Cette étape ne se refera plus jamais.",
            action: "/admin/setup",
            submitLabel: "Créer mon accès",
            fields: `
                <label>Email</label><input name="email" type="email" placeholder="ton@email.com" required>
                <label>Mot de passe</label><input name="password" type="password" placeholder="Minimum 8 caractères" minlength="8" required>`,
            error: req.query.error || "",
        }));
    }

    res.send(authFormPage({
        title: "Centre de contrôle",
        intro: "Accès privé — email et mot de passe requis.",
        action: "/admin/login",
        submitLabel: "Se connecter",
        fields: `
            <label>Email</label><input name="email" type="email" placeholder="ton@email.com" required>
            <label>Mot de passe</label><input name="password" type="password" placeholder="Ton mot de passe" required>`,
        error: req.query.error || "",
    }));
});

router.post("/setup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 8) {
            return res.redirect("/admin/login?error=" + encodeURIComponent("Email et mot de passe (8+ caractères) requis."));
        }

        const existing = await db.query(`SELECT id FROM admin_comptes LIMIT 1`);
        if (existing.length > 0) return res.redirect("/admin/login");

        const hash = await bcrypt.hash(password, 10);
        await db.query(`INSERT INTO admin_comptes (email, password_hash) VALUES ($1, $2)`, [email.trim(), hash]);

        req.session.isAdmin = true;
        req.session.adminEmail = email.trim();
        req.session.save(() => res.redirect("/admin"));
    } catch (err) {
        console.error("❌ POST /admin/setup :", err.message);
        res.redirect("/admin/login?error=" + encodeURIComponent("Erreur serveur."));
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const rows = await db.query(`SELECT * FROM admin_comptes WHERE email = $1`, [(email || "").trim()]);
        const compte = rows[0];

        if (!compte || !(await bcrypt.compare(password || "", compte.password_hash))) {
            return res.redirect("/admin/login?error=" + encodeURIComponent("Email ou mot de passe incorrect."));
        }

        req.session.isAdmin = true;
        req.session.adminEmail = compte.email;
        req.session.save(() => res.redirect("/admin"));
    } catch (err) {
        console.error("❌ POST /admin/login :", err.message);
        res.redirect("/admin/login?error=" + encodeURIComponent("Erreur serveur."));
    }
});

router.get("/logout", (req, res) => {
    delete req.session.isAdmin;
    delete req.session.adminEmail;
    req.session.save(() => res.redirect("/admin/login"));
});

router.get("/", requireAdmin, async (req, res) => {
    let stats = {};
    let candidatures = [];
    let ccpDemandes = [];
    let verifications = [];
    let achatsExternes = [];

    try {
        const [
            utilisateurs, marchands, clients, workspacesRows, commandesTotal, commandesJour,
            commissionsRows, ccpDemandesRows, candidaturesRows, candidaturesNouvelles, verifsRows,
            achatsExternesRows,
        ] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs`),
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs WHERE type_compte = 'marchand'`),
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs WHERE type_compte = 'client'`),
            db.query(`SELECT COUNT(*)::int AS n FROM workspaces`),
            db.query(`SELECT COUNT(*)::int AS n FROM commandes`),
            db.query(`SELECT COUNT(*)::int AS n FROM commandes WHERE date_commande >= CURRENT_DATE`),
            db.query(`SELECT statut, COALESCE(SUM(commission_montant),0)::numeric AS total FROM commissions_parrainage GROUP BY statut`),
            db.query(`SELECT COUNT(*)::int AS n FROM abonnements WHERE statut = 'en attente' AND methode_paiement = 'ccp'`),
            db.query(`SELECT COUNT(*)::int AS n FROM candidatures_partenariat`),
            db.query(`SELECT COUNT(*)::int AS n FROM candidatures_partenariat WHERE statut = 'nouveau'`),
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs WHERE verification_statut = 'en_attente'`),
            db.query(`SELECT COUNT(*)::int AS n FROM commandes WHERE source = 'lien_externe' AND statut IN ('payée','achetée')`),
        ]);

        stats = {
            utilisateurs: utilisateurs[0].n,
            marchands: marchands[0].n,
            clients: clients[0].n,
            workspaces: workspacesRows[0].n,
            commandesTotal: commandesTotal[0].n,
            commandesJour: commandesJour[0].n,
            commissionConfirmee: commissionsRows.find(r => r.statut === "confirmee")?.total || 0,
            commissionEnAttente: commissionsRows.find(r => r.statut === "en_attente")?.total || 0,
            ccpDemandes: ccpDemandesRows[0].n,
            candidaturesTotal: candidaturesRows[0].n,
            candidaturesNouvelles: candidaturesNouvelles[0].n,
            verifsEnAttente: verifsRows[0].n,
            achatsExternes: achatsExternesRows[0].n,
        };

        candidatures = await db.query(`SELECT * FROM candidatures_partenariat ORDER BY created_at DESC LIMIT 200`);
        ccpDemandes = await db.query(
            `SELECT a.id, a.type AS plan, a.montant, a.devise, a.date_debut, w.id AS workspace_id, w.nom AS workspace_nom, w.owner AS workspace_owner
             FROM abonnements a LEFT JOIN workspaces w ON w.id = a.workspace_id
             WHERE a.statut = 'en attente' AND a.methode_paiement = 'ccp'
             ORDER BY a.date_debut DESC LIMIT 100`
        );
        verifications = await db.query(
            `SELECT id, nom, prenom, email, telephone, verification_document_url, verification_soumis_le
             FROM utilisateurs WHERE verification_statut = 'en_attente' ORDER BY verification_soumis_le ASC LIMIT 100`
        );
        achatsExternes = await db.query(
            `SELECT id, nom_client, telephone, adresse, ville, pays, montant, devise, statut,
                    url_produit, titre_produit, image_produit, prix_source, devise_source, frais_service,
                    numero_suivi, transporteur, date_commande
             FROM commandes WHERE source = 'lien_externe' AND statut IN ('payée','achetée')
             ORDER BY date_commande ASC LIMIT 100`
        );
    } catch (err) {
        console.error("❌ GET /admin :", err.message);
    }

    const statCard = (icon, valeur, label, accent) => `
        <div class="ad-stat">
            <div class="ad-stat-icon">${icon}</div>
            <div class="ad-stat-value" style="color:${accent || "var(--text)"};">${valeur}</div>
            <div class="ad-stat-label">${label}</div>
        </div>`;

    const ligneCcpHtml = (a) => `
        <div class="pa-row" data-ccp-id="${a.id}">
            <div class="pa-row-top">
                <span class="pa-cat">🏦 ${escapeHtml(a.plan)} — ${Number(a.montant).toLocaleString("fr-FR")} ${escapeHtml(a.devise)}</span>
                <button class="ccp-confirm-btn" data-id="${a.id}">✅ Confirmer le paiement</button>
            </div>
            <div class="pa-contact">${escapeHtml(a.workspace_nom || a.workspace_id)} · ${escapeHtml(a.workspace_owner || "")}</div>
            <span class="pa-date">Demandé le ${new Date(a.date_debut).toLocaleString("fr-FR")}</span>
        </div>`;

    const ligneVerifHtml = (v) => `
        <div class="pa-row" data-verif-id="${v.id}">
            <div class="pa-row-top">
                <span class="pa-cat">🪪 ${escapeHtml(`${v.prenom || ""} ${v.nom || ""}`.trim() || v.email)}</span>
                <div style="display:flex;gap:8px;">
                    <button class="verif-approuver-btn" data-id="${v.id}">✅ Approuver</button>
                    <button class="verif-refuser-btn" data-id="${v.id}">❌ Refuser</button>
                </div>
            </div>
            <div class="pa-contact">${escapeHtml(v.email || "")}${v.telephone ? ` · <a href="tel:${escapeHtml(v.telephone)}">${escapeHtml(v.telephone)}</a>` : ""}</div>
            ${v.verification_document_url ? `<a href="${escapeHtml(v.verification_document_url)}" target="_blank" rel="noopener" style="display:inline-block;margin:6px 0;"><img src="${escapeHtml(v.verification_document_url)}" style="max-width:220px;max-height:140px;border-radius:8px;border:1px solid var(--border);"></a>` : ""}
            <span class="pa-date">Soumis le ${v.verification_soumis_le ? new Date(v.verification_soumis_le).toLocaleString("fr-FR") : "-"}</span>
        </div>`;

    const ligneAchatExterneHtml = (c) => `
        <div class="pa-row" data-achat-id="${c.id}">
            <div class="pa-row-top">
                <span class="pa-cat">🔗 ${escapeHtml(c.titre_produit || "Produit")} — ${Number(c.montant).toLocaleString("fr-FR")} ${escapeHtml(c.devise)}</span>
                ${c.statut === "payée"
                    ? `<button class="achat-fait-btn" data-id="${c.id}">✅ Marqué comme acheté</button>`
                    : `<span class="pa-cat" style="color:var(--green);">✅ Acheté</span>`}
            </div>
            <div class="pa-contact">
                ${escapeHtml(c.nom_client)} · <a href="tel:${escapeHtml(c.telephone)}">${escapeHtml(c.telephone)}</a><br>
                ${escapeHtml(c.adresse)}${c.ville ? `, ${escapeHtml(c.ville)}` : ""}${c.pays ? `, ${escapeHtml(c.pays)}` : ""}
            </div>
            <p class="pa-desc">
                ${c.image_produit ? `<img src="${escapeHtml(c.image_produit)}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:8px;">` : ""}
                <a href="${escapeHtml(c.url_produit)}" target="_blank" rel="noopener" style="color:var(--blue);">${escapeHtml(c.url_produit)}</a><br>
                Prix source : ${Number(c.prix_source).toLocaleString("fr-FR")} ${escapeHtml(c.devise_source)} — Frais service : ${Number(c.frais_service).toFixed(2)} EUR
            </p>
            ${c.statut === "achetée" && !c.numero_suivi ? `
                <div class="achat-suivi-form" data-id="${c.id}" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                    <select class="achat-transporteur">
                        <option value="yalidine">Yalidine</option>
                        <option value="amana">Amana</option>
                        <option value="ctm">CTM</option>
                        <option value="dhl">DHL</option>
                        <option value="aramex">Aramex</option>
                        <option value="colissimo">Colissimo</option>
                        <option value="chronopost">Chronopost</option>
                        <option value="mondialrelay">Mondial Relay</option>
                        <option value="dpd">DPD</option>
                        <option value="ups">UPS</option>
                        <option value="autre">Autre</option>
                    </select>
                    <input type="text" class="achat-numero" placeholder="Numéro de suivi" style="flex:1;min-width:140px;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,.3);color:var(--text);font-size:12px;">
                    <button class="achat-suivi-btn" data-id="${c.id}">📦 Activer le suivi</button>
                </div>
            ` : c.numero_suivi ? `<p class="pa-desc">📦 Suivi : ${escapeHtml(c.numero_suivi)} (${escapeHtml(c.transporteur)})</p>` : ""}
            <span class="pa-date">Payé le ${new Date(c.date_commande).toLocaleString("fr-FR")}</span>
        </div>`;

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

    res.send(pageShell("Centre de contrôle", `
<div style="max-width:960px;margin:0 auto;padding:30px 20px 80px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:24px;">
        <div>
            <h1 style="font-size:22px;margin-bottom:4px;">🛡️ Centre de contrôle</h1>
            <p style="color:var(--muted);font-size:12.5px;">Connecté en tant que ${escapeHtml(req.session.adminEmail || "")}</p>
        </div>
        <a href="/admin/logout" style="font-size:12.5px;color:var(--muted);text-decoration:none;border:1px solid var(--border);padding:8px 14px;border-radius:9px;">Déconnexion</a>
    </div>

    <div class="ad-stats-grid">
        ${statCard("👥", stats.utilisateurs, "Utilisateurs totaux")}
        ${statCard("🏪", stats.marchands, "Marchands")}
        ${statCard("👤", stats.clients, "Clients")}
        ${statCard("🏢", stats.workspaces, "Workspaces")}
        ${statCard("📦", stats.commandesTotal, "Commandes totales")}
        ${statCard("📦", stats.commandesJour, "Commandes aujourd'hui", "var(--green)")}
        ${statCard("💸", stats.commissionConfirmee.toFixed(2) + "$", "Parrainage confirmé", "var(--green)")}
        ${statCard("⏳", stats.commissionEnAttente.toFixed(2) + "$", "Parrainage en attente", "var(--gold)")}
        ${statCard("🏦", stats.ccpDemandes, "Demandes CCP")}
        ${statCard("🤝", stats.candidaturesTotal, "Candidatures partenariat")}
        ${statCard("🆕", stats.candidaturesNouvelles, "Nouvelles candidatures", "var(--blue)")}
        ${statCard("🪪", stats.verifsEnAttente, "Vérifications en attente", stats.verifsEnAttente ? "var(--gold)" : "var(--text)")}
        ${statCard("🔗", stats.achatsExternes, "Achats externes à traiter", stats.achatsExternes ? "var(--gold)" : "var(--text)")}
    </div>

    <div class="section-title">🪪 Vérifications d'identité en attente (livreurs / location)</div>
    <div id="verif-list" style="margin-bottom:30px;">${verifications.length ? verifications.map(ligneVerifHtml).join("") : `<div class="pa-empty">Aucune vérification en attente.</div>`}</div>

    <div class="section-title">🔗 Achats externes à traiter</div>
    <div id="achat-list" style="margin-bottom:30px;">${achatsExternes.length ? achatsExternes.map(ligneAchatExterneHtml).join("") : `<div class="pa-empty">Aucun achat externe en attente.</div>`}</div>

    <div class="section-title">🏦 Demandes CCP en attente</div>
    <div id="ccp-list" style="margin-bottom:30px;">${ccpDemandes.length ? ccpDemandes.map(ligneCcpHtml).join("") : `<div class="pa-empty">Aucune demande CCP en attente.</div>`}</div>

    <div class="section-title">🤝 Candidatures Partenariat</div>
    <div class="pa-filters" id="pa-filters">
        <button data-filter="all" class="active">Toutes</button>
        ${Object.entries(CATEGORIES).map(([k, v]) => `<button data-filter="${k}">${v}</button>`).join("")}
    </div>
    <div id="pa-list">${candidatures.length ? candidatures.map(ligneHtml).join("") : `<div class="pa-empty">Aucune candidature pour l'instant.</div>`}</div>
</div>

<style>
.ad-stats-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:30px; }
@media (min-width:640px) { .ad-stats-grid { grid-template-columns:repeat(4,1fr); } }
.ad-stat { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px; text-align:center; }
.ad-stat-icon { font-size:1.1rem; margin-bottom:6px; }
.ad-stat-value { font-family:"JetBrains Mono"; font-weight:800; font-size:19px; }
.ad-stat-label { font-size:10.5px; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:.04em; }
.section-title { font-size:15px; font-weight:800; margin:10px 0 14px; }
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
.ccp-confirm-btn { padding:7px 13px; border-radius:8px; border:1px solid var(--green); background:rgba(61,220,132,.12); color:var(--green); font-size:11.5px; font-weight:700; cursor:pointer; font-family:"JetBrains Mono"; }
.ccp-confirm-btn:disabled { opacity:.5; cursor:default; }
.achat-fait-btn, .achat-suivi-btn { padding:7px 13px; border-radius:8px; border:1px solid var(--gold); background:rgba(212,175,55,.12); color:var(--gold); font-size:11.5px; font-weight:700; cursor:pointer; font-family:"JetBrains Mono"; }
.achat-fait-btn:disabled, .achat-suivi-btn:disabled { opacity:.5; cursor:default; }
.achat-transporteur { padding:6px 8px; border-radius:8px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:12px; }
.achat-transporteur option { background:#0a0d14; }
.verif-approuver-btn { padding:7px 13px; border-radius:8px; border:1px solid var(--green); background:rgba(61,220,132,.12); color:var(--green); font-size:11.5px; font-weight:700; cursor:pointer; font-family:"JetBrains Mono"; }
.verif-refuser-btn { padding:7px 13px; border-radius:8px; border:1px solid #e55; background:rgba(229,85,85,.12); color:#e55; font-size:11.5px; font-weight:700; cursor:pointer; font-family:"JetBrains Mono"; }
.verif-approuver-btn:disabled, .verif-refuser-btn:disabled { opacity:.5; cursor:default; }
</style>
<script src="/socket.io/socket.io.js"></script>
<script>
document.getElementById("ccp-list").addEventListener("click", async (e) => {
    const btn = e.target.closest(".ccp-confirm-btn");
    if (!btn) return;
    if (!confirm("Confirmer que le virement CCP a bien été reçu ? Le palier sera activé immédiatement.")) return;
    btn.disabled = true;
    btn.textContent = "⏳ Activation...";
    try {
        const res = await fetch("/admin/ccp/" + btn.dataset.id + "/confirmer", { method: "POST" });
        const json = await res.json();
        if (json.success) {
            btn.closest(".pa-row").remove();
            if (!document.querySelector("#ccp-list .pa-row")) {
                document.getElementById("ccp-list").innerHTML = '<div class="pa-empty">Aucune demande CCP en attente.</div>';
            }
        } else {
            alert(json.error || "Erreur.");
            btn.disabled = false;
            btn.textContent = "✅ Confirmer le paiement";
        }
    } catch (err) {
        alert("Erreur réseau.");
        btn.disabled = false;
        btn.textContent = "✅ Confirmer le paiement";
    }
});

document.getElementById("achat-list").addEventListener("click", async (e) => {
    const btnFait = e.target.closest(".achat-fait-btn");
    const btnSuivi = e.target.closest(".achat-suivi-btn");

    if (btnFait) {
        btnFait.disabled = true;
        btnFait.textContent = "⏳...";
        try {
            const res = await fetch("/admin/achat-externe/" + btnFait.dataset.id + "/achete", { method: "POST" });
            const json = await res.json();
            if (json.success) {
                location.reload();
            } else {
                alert(json.error || "Erreur.");
                btnFait.disabled = false;
                btnFait.textContent = "✅ Marqué comme acheté";
            }
        } catch (err) {
            alert("Erreur réseau.");
            btnFait.disabled = false;
            btnFait.textContent = "✅ Marqué comme acheté";
        }
        return;
    }

    if (btnSuivi) {
        const form = btnSuivi.closest(".achat-suivi-form");
        const transporteur = form.querySelector(".achat-transporteur").value;
        const numero = form.querySelector(".achat-numero").value.trim();
        if (!numero) { alert("Indique le numéro de suivi."); return; }

        btnSuivi.disabled = true;
        btnSuivi.textContent = "⏳...";
        try {
            const res = await fetch("/admin/achat-externe/" + btnSuivi.dataset.id + "/suivi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transporteur, numero }),
            });
            const json = await res.json();
            if (json.success) {
                btnSuivi.closest(".pa-row").remove();
                if (!document.querySelector("#achat-list .pa-row")) {
                    document.getElementById("achat-list").innerHTML = '<div class="pa-empty">Aucun achat externe en attente.</div>';
                }
            } else {
                alert(json.error || "Erreur.");
                btnSuivi.disabled = false;
                btnSuivi.textContent = "📦 Activer le suivi";
            }
        } catch (err) {
            alert("Erreur réseau.");
            btnSuivi.disabled = false;
            btnSuivi.textContent = "📦 Activer le suivi";
        }
    }
});

document.getElementById("verif-list").addEventListener("click", async (e) => {
    const btnApprouver = e.target.closest(".verif-approuver-btn");
    const btnRefuser = e.target.closest(".verif-refuser-btn");
    const btn = btnApprouver || btnRefuser;
    if (!btn) return;

    let note = "";
    if (btnRefuser) {
        note = prompt("Raison du refus (visible par la personne) :") || "";
        if (note === null) return;
    } else if (!confirm("Approuver cette vérification d'identité ? La personne pourra immédiatement recevoir des livraisons / publier une location.")) {
        return;
    }

    btn.disabled = true;
    const action = btnApprouver ? "approuver" : "refuser";
    try {
        const res = await fetch("/admin/verification/" + btn.dataset.id + "/" + action, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
        });
        const json = await res.json();
        if (json.success) {
            btn.closest(".pa-row").remove();
            if (!document.querySelector("#verif-list .pa-row")) {
                document.getElementById("verif-list").innerHTML = '<div class="pa-empty">Aucune vérification en attente.</div>';
            }
        } else {
            alert(json.error || "Erreur.");
            btn.disabled = false;
        }
    } catch {
        alert("Erreur réseau.");
        btn.disabled = false;
    }
});

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
    await fetch("/admin/partenariat/" + e.target.dataset.id + "/statut", {
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
</script>`));
});

router.post("/achat-externe/:id/achete", requireAdmin, async (req, res) => {
    try {
        const rows = await db.query(
            `UPDATE commandes SET statut = 'achetée' WHERE id = $1 AND source = 'lien_externe' AND statut = 'payée' RETURNING id`,
            [req.params.id]
        );
        if (!rows[0]) return res.json({ success: false, error: "Introuvable ou déjà traité." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/achat-externe/:id/achete :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/achat-externe/:id/suivi", requireAdmin, async (req, res) => {
    try {
        const { transporteur, numero } = req.body;
        if (!transporteur || !numero?.trim()) {
            return res.json({ success: false, error: "Transporteur et numéro requis." });
        }
        const rows = await db.query(
            `UPDATE commandes SET numero_suivi = $1, transporteur = $2, statut = 'en cours'
             WHERE id = $3 AND source = 'lien_externe' AND statut = 'achetée' RETURNING id`,
            [numero.trim(), transporteur, req.params.id]
        );
        if (!rows[0]) return res.json({ success: false, error: "Introuvable ou déjà traité." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/achat-externe/:id/suivi :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/ccp/:id/confirmer", requireAdmin, async (req, res) => {
    try {
        const result = await confirmCcpAbonnement(req.params.id);
        if (!result.updated) return res.json({ success: false, error: "Demande introuvable ou déjà traitée." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/ccp/:id/confirmer :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/verification/:id/approuver", requireAdmin, async (req, res) => {
    try {
        const ok = await verificationService.approuver(req.params.id);
        if (!ok) return res.json({ success: false, error: "Demande introuvable ou déjà traitée." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/verification/:id/approuver :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/verification/:id/refuser", requireAdmin, async (req, res) => {
    try {
        const ok = await verificationService.refuser(req.params.id, req.body.note || "");
        if (!ok) return res.json({ success: false, error: "Demande introuvable ou déjà traitée." });
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/verification/:id/refuser :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/partenariat/:id/statut", requireAdmin, async (req, res) => {
    try {
        const { statut } = req.body;
        if (!["nouveau", "contacte", "accepte", "refuse"].includes(statut)) {
            return res.json({ success: false, error: "Statut invalide." });
        }
        await db.query(`UPDATE candidatures_partenariat SET statut = $1 WHERE id = $2`, [statut, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /admin/partenariat/:id/statut :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
