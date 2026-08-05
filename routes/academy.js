// ==========================================================================
// SAMII OS — THE SOVEREIGN ACADEMY — PostgreSQL Edition v3
// Masterclasses en direct • E-books • Formations • Feed Communautaire & Partages
// ==========================================================================

const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) {
        return res.redirect("/login");
    }
    next();
}

const CATEGORIES_ACADEMIE = [
    { id: "tous",            label: "Toutes les catégories" },
    { id: "ecommerce",       label: "E-commerce & Dropshipping" },
    { id: "automatisation",  label: "Automatisation & IA (Make, n8n, SAMII OS)" },
    { id: "marketing",       label: "Marketing Digital & Ads (Meta, TikTok, Google)" },
    { id: "funnels",         label: "Business & Funnels de Vente" },
    { id: "logistique",      label: "Logistique & Supply Chain" },
    { id: "mindset",         label: "Mindset & Stratégie d'Entreprise" },
    { id: "affiliation",     label: "Affiliation & Monétisation" },
    { id: "outils",          label: "Bons Plans & Outils Secrets" }
];

const FORMATS_RESSOURCES = [
    { id: "tous",    label: "Tous les formats" },
    { id: "live",    label: "🔴 Lives & Replays" },
    { id: "video",   label: "🎬 Formations Vidéo" },
    { id: "ebook",   label: "📚 E-books & Guides PDF" },
    { id: "outil",   label: "⚙️ Fichiers & Configs" }
];

const COURS_VIRTUELS = [
    { 
        id: "ac_1", 
        titre: "Architecture Avancée SAMII OS : Orchestration multi-agents & Flux n8n", 
        categorie: "automatisation", 
        format: "video", 
        niveau: "Avancé", 
        duree: "2h 45min", 
        prix: "Inclus VIP", 
        photo_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "ai_agent_samii", 
        formateur_nom: "Samii Core", 
        type_formateur: "ia_mentor", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_2", 
        titre: "Masterclass Live : Scaler son e-commerce de 0 à 10k€/mois avec Meta & TikTok", 
        categorie: "ecommerce", 
        format: "live", 
        niveau: "Tous niveaux", 
        duree: "En direct ce soir", 
        prix: "Gratuit Fondateur", 
        photo_url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "marchand_verified_1", 
        formateur_nom: "OG Expert", 
        type_formateur: "expert", 
        est_live: true, 
        actif: true 
    },
    { 
        id: "ac_3", 
        titre: "E-book Ultime : Les tunnels de vente haute conversion & psychologie d'achat", 
        categorie: "funnels", 
        format: "ebook", 
        niveau: "Intermédiaire", 
        duree: "120 pages", 
        prix: "Inclus", 
        photo_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "ai_agent_vaulta", 
        formateur_nom: "SAMII OS Academy", 
        type_formateur: "ia_mentor", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_4", 
        titre: "Logistique E-commerce : Optimiser ses livraisons et réduire les retours", 
        categorie: "logistique", 
        format: "video", 
        niveau: "Débutant", 
        duree: "1h 15min", 
        prix: "Inclus", 
        photo_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "marchand_verified_1", 
        formateur_nom: "Partenaire OG", 
        type_formateur: "expert", 
        est_live: false, 
        actif: true 
    }
];

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCategoryLabel(id) {
    return CATEGORIES_ACADEMIE.find(c => c.id === id)?.label || id || "Général";
}

function getFormatLabel(id) {
    return FORMATS_RESSOURCES.find(f => f.id === id)?.label || "Ressource";
}

// ==========================================================================
// ACADÉMIE — ROUTE DE PUBLICATION COMMUNAUTAIRE (Fichiers, Photos, Articles)
// ==========================================================================
router.post("/partager", requireAuth, async (req, res) => {
    const { titre, categorie, format, contenu, lien_ressource } = req.body;
    const userId = req.session.userId || 1;
    const userName = req.session.userName || "Membre OG";

    try {
        await db.query(
            `INSERT INTO academie_cours (titre, categorie, format, niveau, duree, prix, photo_url, formateur_id, formateur_nom, type_formateur, est_live, actif, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
            [
                titre || "Publication Communautaire",
                categorie || "outils",
                format || "outil",
                "Tous niveaux",
                "Ressource Partagée",
                "Libre",
                lien_ressource || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=85",
                String(userId),
                userName,
                "expert",
                false,
                true
            ]
        );
        return res.json({ success: true, message: "Ressource publiée avec succès dans l'Académie !" });
    } catch (err) {
        console.warn("⚠️ Erreur publication académie DB (mode virtuel actif) :", err.message);
        // Fallback simulation si table non migrée
        COURS_VIRTUELS.unshift({
            id: `usr_${Date.now()}`,
            titre: titre || "Nouvelle Publication",
            categorie: categorie || "outils",
            format: format || "outil",
            niveau: "Tous niveaux",
            duree: "Ressource Partagée",
            prix: "Libre",
            photo_url: lien_ressource || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=85",
            formateur_id: String(userId),
            formateur_nom: userName,
            type_formateur: "expert",
            est_live: false,
            actif: true
        });
        return res.json({ success: true, message: "Publication enregistrée en mode local !" });
    }
});

// ==========================================================================
// ACADÉMIE — ROUTE PRINCIPALE HAUTEMENT FUTURISTE (Dark/Light + Feed Partage)
// ==========================================================================

router.get("/", requireAuth, async (req, res) => {
    const { categorie, format, recherche, niveau } = req.query;

    let coursDB = [];

    try {
        let clauses = ["actif = true"];
        let params = [];
        let i = 1;

        if (categorie && categorie !== "tous") { clauses.push(`categorie = $${i++}`); params.push(categorie); }
        if (format && format !== "tous") { clauses.push(`format = $${i++}`); params.push(format); }
        if (recherche) { clauses.push(`LOWER(titre) LIKE LOWER($${i++})`); params.push(`%${recherche}%`); }
        if (niveau) { clauses.push(`niveau = $${i++}`); params.push(niveau); }

        const rows = await db.query(
            `SELECT * FROM academie_cours WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT 50`,
            params
        );

        coursDB = rows.map(r => ({
            id: r.id, titre: r.titre, categorie: r.categorie, format: r.format, niveau: r.niveau,
            duree: r.duree, prix: r.prix, photo_url: r.photo_url, formateur_id: r.formateur_id,
            formateur_nom: r.formateur_nom, type_formateur: r.type_formateur, est_live: r.est_live, actif: r.actif
        }));

    } catch (err) {
        console.warn("⚠️ Académie — lecture PostgreSQL échouée (utilisation du mode virtuel) :", err.message);
    }

    let toutesRessources = [...COURS_VIRTUELS, ...coursDB];

    if (categorie && categorie !== "tous") toutesRessources = toutesRessources.filter(c => c.categorie === categorie);
    if (format && format !== "tous") toutesRessources = toutesRessources.filter(c => c.format === format);
    if (recherche) {
        const q = recherche.toLowerCase();
        toutesRessources = toutesRessources.filter(c => String(c.titre || "").toLowerCase().includes(q));
    }

    let mesFavorisAcademie = [];
    try {
        if (req.session.userId) {
            const favRows = await db.query(`SELECT cours_id FROM academie_favoris WHERE user_id = $1`, [req.session.userId]);
            mesFavorisAcademie = favRows.map(r => String(r.cours_id));
        }
    } catch (err) {
        console.warn("⚠️ Académie — lecture favoris échouée :", err.message);
    }

    const categoryOptionsHtml = CATEGORIES_ACADEMIE.map(c =>
        `<option value="${escapeHtml(c.id)}" ${categorie === c.id ? "selected" : ""}>${escapeHtml(c.label)}</option>`
    ).join("");

    const formatChipsHtml = FORMATS_RESSOURCES.map(f => `
        <a href="/academie?format=${f.id}${categorie ? '&categorie=' + categorie : ''}" class="format-chip ${(!format && f.id === 'tous') || format === f.id ? "active" : ""}">
            ${f.label}
        </a>`).join("");

    const cardsHtml = toutesRessources.map((c, index) => {
        const id = c.id || `cours_${index}_${Date.now()}`;
        const titre = escapeHtml(c.titre || "Masterclass SAMII OS");
        const catLabel = escapeHtml(getCategoryLabel(c.categorie));
        const duree = escapeHtml(c.duree || "Modules HD");
        const niveau = escapeHtml(c.niveau || "Tous niveaux");
        const formateur = escapeHtml(c.formateur_nom || "Formateur OG");
        const isAI = c.type_formateur === "ia_mentor";
        const isLive = c.est_live === true;
        const isFavorited = mesFavorisAcademie.includes(String(id));
        const photoUrl = c.photo_url || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=85";

        const badgeHtml = isLive 
            ? `<span class="badge-live"><span class="live-dot-pulse"></span> EN DIRECT</span>` 
            : isAI 
                ? `<span class="badge-ai"><span class="ai-dot"></span> SAMII AI</span>` 
                : `<span class="badge-cat">${catLabel}</span>`;

        return `
        <article class="course-card ${isLive ? "is-live-card" : ""}" data-course-id="${escapeHtml(String(id))}">
            <div class="course-media">
                <a href="/academie/cours/${id}" class="course-image-link">
                    <img src="${escapeHtml(photoUrl)}" alt="${titre}" loading="lazy">
                </a>
                <div class="course-top-badges">
                    ${badgeHtml}
                    <span class="course-level">${niveau}</span>
                </div>
                <button class="favorite-btn ${isFavorited ? "saved" : ""}" type="button" aria-label="Favoris"
                    onclick='toggleAcademieFavorite(${JSON.stringify(String(id))}, this)'>
                    <i data-lucide="bookmark"></i>
                </button>
                <div class="course-duration"><i data-lucide="clock"></i> ${duree}</div>
            </div>
            <div class="course-body">
                <div class="course-meta-info">
                    <span class="course-category-tag">${catLabel}</span>
                </div>
                <a href="/academie/cours/${id}" class="course-title">${titre}</a>
                <div class="trainer-row">
                    <div class="trainer-avatar">${isAI ? "AI" : "OG"}</div>
                    <div class="trainer-info">
                        <strong>${formateur}</strong>
                        <span>${isAI ? "Agent Automatisé" : "Membre Vérifié"}</span>
                    </div>
                </div>
                <div class="course-footer">
                    <a href="/academie/cours/${id}" class="access-btn">
                        <i data-lucide="play-circle"></i> Explorer la ressource
                    </a>
                </div>
            </div>
        </article>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>SAMII OS — The Sovereign Academy</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { 
    --bg: #010409; 
    --bg-2: #050d18; 
    --panel: rgba(8, 17, 30, 0.85); 
    --panel-2: rgba(12, 25, 42, 0.95); 
    --text: #f0f6fc; 
    --muted: #8b949e; 
    --cyan: #00f0ff;
    --cyan-glow: 0 0 25px rgba(0, 240, 255, 0.35); 
    --gold: #f1c40f; 
    --gold-glow: 0 0 25px rgba(241, 196, 15, 0.3);
    --border: rgba(0, 240, 255, 0.18); 
    --danger: #ff3366; 
    --radius: 16px; 
    --ease: cubic-bezier(.16, 1, .3, 1); 
}
[data-theme="light"] { 
    --bg: #f4f7fa; 
    --bg-2: #e9edf2; 
    --panel: rgba(255, 255, 255, 0.9); 
    --panel-2: rgba(255, 255, 255, 0.98); 
    --text: #0d1117; 
    --muted: #57606a; 
    --cyan: #0077ff;
    --cyan-glow: 0 0 20px rgba(0, 119, 255, 0.2);
    --gold: #b78103; 
    --gold-glow: 0 0 15px rgba(183, 129, 3, 0.2);
    --border: rgba(0, 119, 255, 0.2); 
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 5% 5%, rgba(241, 196, 15, 0.04), transparent 35%), radial-gradient(circle at 95% 95%, rgba(0, 240, 255, 0.07), transparent 35%), var(--bg); color: var(--text); font-family: Inter, sans-serif; overflow-x: hidden; transition: background 0.3s, color 0.3s; }
button, input, select { font: inherit; }
button { cursor: pointer; }
a { color: inherit; text-decoration: none; }

.tech-bg { position: fixed; inset: 0; z-index: -5; pointer-events: none; overflow: hidden; }
.tech-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 50px 50px; opacity: 0.4; mask-image: linear-gradient(to bottom, black, transparent 90%); }
.tech-orb { position: absolute; width: 450px; height: 450px; border-radius: 50%; filter: blur(100px); opacity: 0.12; background: var(--cyan); }
.tech-orb.one { top: -150px; left: -100px; background: var(--gold); }
.tech-orb.two { right: -150px; bottom: 10%; }

/* SIDEBAR STYLING */
.sidebar { position: fixed; left: 0; top: 0; width: 250px; height: 100vh; padding: 24px 16px; background: var(--panel-2); backdrop-filter: blur(20px); border-right: 1px solid var(--border); z-index: 300; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 12px; padding: 6px 10px 25px; font-family: 'Orbitron', sans-serif; font-weight: 900; letter-spacing: 1px; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #010409; background: linear-gradient(135deg, var(--gold), #ffe66d); box-shadow: var(--gold-glow); font-size: 14px; font-weight: 900; }
.brand-name { font-size: 13px; }
.brand-name span { color: var(--cyan); text-shadow: var(--cyan-glow); }
.side-menu { display: flex; flex-direction: column; gap: 6px; }
.side-link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 600; border: 1px solid transparent; transition: .25s var(--ease); }
.side-link svg { width: 18px; height: 18px; }
.side-link:hover, .side-link.active { color: var(--text); background: linear-gradient(90deg, rgba(0, 240, 255, 0.12), rgba(241, 196, 15, 0.04)); border-color: var(--cyan); box-shadow: inset 3px 0 0 var(--cyan), var(--cyan-glow); }
.side-link.active svg { color: var(--cyan); filter: drop-shadow(0 0 8px var(--cyan)); }

.side-bottom { margin-top: auto; padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: linear-gradient(135deg, rgba(0, 240, 255, 0.05), rgba(241, 196, 15, 0.02)); }
.side-ai { display: flex; align-items: center; gap: 8px; font-size: 11px; font-family: "JetBrains Mono"; color: var(--cyan); margin-bottom: 6px; }
.side-ai-dot { width: 7px; height: 7px; background: var(--cyan); border-radius: 50%; box-shadow: var(--cyan-glow); animation: pulseLive 1.5s infinite; }
.side-text { color: var(--muted); font-size: 11px; line-height: 1.5; }

/* MAIN LAYOUT */
.main { margin-left: 250px; min-height: 100vh; width: calc(100% - 250px); }
.header { position: sticky; top: 0; z-index: 200; backdrop-filter: blur(25px); background: var(--panel-2); border-bottom: 1px solid var(--border); }
.header-top { min-height: 72px; padding: 10px 28px; display: flex; align-items: center; gap: 15px; }

.search { flex: 1; display: flex; min-width: 0; max-width: 720px; margin: auto; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--bg); transition: .25s; }
.search:focus-within { border-color: var(--cyan); box-shadow: var(--cyan-glow); }
.search select { width: 180px; padding: 0 12px; background: transparent; border: none; border-right: 1px solid var(--border); color: var(--text); outline: none; font-size: 12px; }
.search select option { background: var(--bg); color: var(--text); }
.search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text); padding: 13px 14px; font-size: 13px; }
.search input::placeholder { color: var(--muted); }
.search button { width: 52px; border: none; background: linear-gradient(135deg, var(--cyan), #0077ff); color: #010409; transition: .25s; font-weight: 800; }
.search button:hover { filter: brightness(1.2); box-shadow: var(--cyan-glow); }

.header-actions { display: flex; align-items: center; gap: 12px; }
.theme-toggle-btn { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: var(--panel); border: 1px solid var(--border); color: var(--text); transition: .25s; }
.theme-toggle-btn:hover { border-color: var(--cyan); box-shadow: var(--cyan-glow); transform: rotate(15deg); }

.action-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 12px; color: #010409; text-decoration: none; background: linear-gradient(135deg, var(--cyan), #00a8ff); font-size: 12px; font-weight: 800; box-shadow: var(--cyan-glow); transition: .25s var(--ease); }
.action-btn:hover { transform: translateY(-2px); filter: brightness(1.15); }

/* SUBNAV FORMATS */
.subnav { display: flex; align-items: center; gap: 8px; padding: 10px 28px; overflow-x: auto; scrollbar-width: none; background: rgba(0,0,0,0.03); border-top: 1px solid var(--border); }
.subnav::-webkit-scrollbar { display: none; }
.format-chip { flex: 0 0 auto; text-decoration: none; padding: 7px 14px; border-radius: 20px; color: var(--muted); font-size: 11px; font-weight: 600; border: 1px solid var(--border); transition: .2s; background: var(--panel); }
.format-chip:hover, .format-chip.active { color: #010409; background: var(--cyan); border-color: var(--cyan); font-weight: 700; box-shadow: var(--cyan-glow); }

/* CONTENT HERO & GRID */
.content { padding: 32px; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 32px; }
.hero-kicker { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono"; color: var(--cyan); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; text-shadow: var(--cyan-glow); }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 12px var(--danger); animation: pulseLive 1.5s infinite; }
@keyframes pulseLive { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 20px var(--danger); } 100% { transform: scale(0.95); opacity: 0.8; } }

.hero h1 { margin: 0; font-family: 'Orbitron', sans-serif; font-size: clamp(26px, 3.2vw, 42px); line-height: 1.1; letter-spacing: -.5px; }
.hero h1 span { color: var(--cyan); text-shadow: var(--cyan-glow); }
.hero p { margin: 10px 0 0; color: var(--muted); font-size: 13px; max-width: 700px; }

.courses-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 24px; }
.course-card { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); backdrop-filter: blur(18px); box-shadow: 0 15px 35px rgba(0,0,0,0.2); transition: transform .35s var(--ease), border-color .35s, box-shadow .35s; display: flex; flex-direction: column; }
.course-card:hover { transform: translateY(-8px); border-color: var(--cyan); box-shadow: 0 25px 60px rgba(0,0,0,0.35), var(--cyan-glow); }
.course-card.is-live-card { border-color: rgba(255, 51, 102, 0.5); }

.course-media { position: relative; aspect-ratio: 16/9; background: #000; overflow: hidden; }
.course-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s var(--ease); opacity: 0.9; }
.course-card:hover .course-media img { transform: scale(1.08); opacity: 1; }

.course-top-badges { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
.badge-cat, .badge-level, .badge-live, .badge-ai { padding: 5px 10px; border-radius: 999px; backdrop-filter: blur(12px); font-family: "JetBrains Mono"; font-size: 8px; font-weight: 700; white-space: nowrap; }
.badge-cat { color: var(--text); background: rgba(1, 4, 9, 0.85); border: 1px solid var(--border); }
.badge-level { color: var(--gold); background: rgba(1, 4, 9, 0.85); border: 1px solid rgba(241, 196, 15, 0.4); }
.badge-live { color: white; background: rgba(255, 51, 102, 0.9); border: 1px solid rgba(255, 100, 130, 0.6); box-shadow: 0 0 15px rgba(255, 51, 102, 0.4); display: flex; align-items: center; gap: 6px; }
.live-dot-pulse { width: 6px; height: 6px; background: white; border-radius: 50%; animation: pulseLive 1s infinite; }
.badge-ai { color: #010409; background: var(--cyan); border: 1px solid #fff; font-weight: 900; box-shadow: var(--cyan-glow); display: flex; align-items: center; gap: 4px; }
.ai-dot { width: 5px; height: 5px; background: #010409; border-radius: 50%; }

.course-duration { position: absolute; bottom: 10px; left: 12px; display: flex; align-items: center; gap: 5px; font-size: 10px; font-family: "JetBrains Mono"; color: white; background: rgba(1,4,9,0.75); padding: 4px 8px; border-radius: 8px; backdrop-filter: blur(8px); }
.course-duration svg { width: 12px; height: 12px; color: var(--cyan); }

.favorite-btn { position: absolute; right: 12px; bottom: 10px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: white; background: rgba(1,4,9,0.7); border: 1px solid var(--border); backdrop-filter: blur(10px); transition: .25s var(--ease); }
.favorite-btn:hover { color: var(--cyan); border-color: var(--cyan); box-shadow: var(--cyan-glow); transform: scale(1.1); }
.favorite-btn.saved { color: var(--gold); background: rgba(241, 196, 15, 0.2); border-color: var(--gold); box-shadow: var(--gold-glow); }

.course-body { padding: 18px; display: flex; flex-direction: column; flex: 1; }
.course-category-tag { font-size: 9px; font-family: "JetBrains Mono"; color: var(--cyan); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.course-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 44px; text-decoration: none; font-size: 14px; font-weight: 700; line-height: 1.45; transition: color .2s; }
.course-title:hover { color: var(--cyan); }

.trainer-row { display: flex; align-items: center; gap: 10px; margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--border); }
.trainer-avatar { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border-radius: 9px; color: #010409; font-size: 9px; font-weight: 900; background: linear-gradient(135deg, var(--cyan), #00a8ff); box-shadow: var(--cyan-glow); }
.trainer-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.trainer-info strong { font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trainer-info span { color: var(--muted); font-size: 9px; margin-top: 2px; }

.course-footer { margin-top: auto; padding-top: 15px; }
.access-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; border-radius: 12px; background: rgba(0, 240, 255, 0.08); border: 1px solid var(--border); color: var(--cyan); font-size: 12px; font-weight: 700; transition: .25s var(--ease); }
.access-btn:hover { background: var(--cyan); color: #010409; box-shadow: var(--cyan-glow); }

/* MODAL PARTAGE COMMUNAUTAIRE (PHOTOS, ARTICLES, FICHIERS) */
.modal-overlay { position: fixed; inset: 0; background: rgba(1, 4, 9, 0.85); backdrop-filter: blur(15px); z-index: 1000; display: none; place-items: center; padding: 20px; }
.modal-overlay.open { display: grid; animation: fadeIn .25s ease; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.modal-card { width: 100%; max-width: 600px; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: 20px; padding: 30px; box-shadow: 0 25px 70px rgba(0,0,0,0.6), var(--cyan-glow); position: relative; }
.modal-close { position: absolute; top: 20px; right: 20px; background: transparent; border: none; color: var(--muted); font-size: 20px; }
.modal-close:hover { color: var(--cyan); }
.modal-card h2 { font-family: 'Orbitron', sans-serif; margin-top: 0; font-size: 20px; color: var(--cyan); text-shadow: var(--cyan-glow); }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-size: 11px; font-family: "JetBrains Mono"; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; color: var(--text); outline: none; font-size: 13px; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--cyan); box-shadow: var(--cyan-glow); }
.modal-submit { width: 100%; padding: 13px; border-radius: 12px; background: linear-gradient(135deg, var(--cyan), #0077ff); border: none; color: #010409; font-weight: 800; font-size: 13px; box-shadow: var(--cyan-glow); transition: .25s; }
.modal-submit:hover { filter: brightness(1.2); }

/* MOBILE RESPONSIVE NAV */
.mobile-nav { display: none; }
@media (max-width: 900px) {
    .sidebar { display: none; }
    .main { margin-left: 0; width: 100%; }
    .header-top { padding: 10px 15px; flex-wrap: wrap; }
    .search { order: 3; flex-basis: 100%; max-width: none; }
    .content { padding: 20px 12px 90px; }
    .courses-grid { grid-template-columns: 1fr; gap: 15px; }
    .mobile-nav { position: fixed; left: 8px; right: 8px; bottom: 8px; height: 62px; z-index: 400; display: grid; grid-template-columns: repeat(4, 1fr); padding: 5px; border: 1px solid var(--border); border-radius: 17px; background: var(--panel-2); backdrop-filter: blur(25px); box-shadow: 0 15px 50px rgba(0,0,0,0.5), var(--cyan-glow); }
    .mobile-nav a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; color: var(--muted); font-size: 8px; font-weight: 700; border-radius: 12px; }
    .mobile-nav a svg { width: 18px; height: 18px; }
    .mobile-nav a.active { color: var(--cyan); background: rgba(0, 240, 255, 0.12); }
}
</style>
</head>
<body>
<div class="tech-bg"><div class="tech-grid"></div><div class="tech-orb one"></div><div class="tech-orb two"></div></div>

<aside class="sidebar">
    <div>
        <div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>OS</span></div></div>
        <nav class="side-menu">
            <a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
            <a href="/marketplace" class="side-link"><i data-lucide="shopping-bag"></i> Marketplace</a>
            <a href="/academie" class="side-link active"><i data-lucide="graduation-cap"></i> Académie & Lives</a>
            <a href="/community" class="side-link"><i data-lucide="users"></i> Communauté</a>
            <a href="/client-qg" class="side-link"><i data-lucide="shield-check"></i> Client-QG</a>
        </nav>
    </div>
    <div class="side-bottom">
        <div class="side-ai"><span class="side-ai-dot"></span> SAMII OS ACTIVE</div>
        <div class="side-text">Interface hautement futuriste et sécurisée sous la marque OG.</div>
    </div>
</aside>

<main class="main">
    <header class="header">
        <div class="header-top">
            <form class="search" action="/academie" method="GET">
                <select name="categorie">
                    ${categoryOptionsHtml}
                </select>
                <input type="text" name="recherche" placeholder="Rechercher une formation, un article, un fichier, une photo..." value="${escapeHtml(req.query.recherche || '')}">
                <button type="submit"><i data-lucide="search"></i></button>
            </form>
            <div class="header-actions">
                <button class="theme-toggle-btn" type="button" onclick="toggleTheme()" title="Basculer Mode Dark / Lumière">
                    <i data-lucide="sun-medium" id="theme-icon"></i>
                </button>
                <button class="action-btn" type="button" onclick="openPartageModal()">
                    <i data-lucide="plus-circle"></i> S'exprimer & Partager
                </button>
            </div>
        </div>
        <div class="subnav">
            ${formatChipsHtml}
        </div>
    </header>

    <div class="content">
        <div class="hero">
            <div>
                <div class="hero-kicker"><span class="live-dot"></span> KNOWLEDGE NEXUS & MASTERCLASS</div>
                <h1>The Sovereign <span>Academy</span></h1>
                <p>Explorez les masterclasses, partagez vos photos, articles et fichiers techniques au sein du réseau d'élite de la marque OG.</p>
            </div>
        </div>

        <div class="courses-grid">
            ${cardsHtml}
        </div>
    </div>
</main>

<!-- MODAL DE PARTAGE COMMUNAUTAIRE (EXPRIMEZ-VOUS, FOTOS, ARTICLES, FICHIERS) -->
<div class="modal-overlay" id="partageModal">
    <div class="modal-card">
        <button class="modal-close" onclick="closePartageModal()">&times;</button>
        <h2><i data-lucide="share-2"></i> Partage & Expression OG</h2>
        <p style="color:var(--muted); font-size:12px; margin-bottom:20px;">Partagez vos articles, photos, fichiers de configuration ou retours d'expérience avec la communauté.</p>
        
        <form id="partageForm" onsubmit="submitPartage(event)">
            <div class="form-group">
                <label>Titre / Sujet</label>
                <input type="text" name="titre" required placeholder="Ex: Ma configuration n8n optimisée pour le e-commerce...">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label>Catégorie</label>
                    <select name="categorie">
                        <option value="ecommerce">E-commerce & Dropshipping</option>
                        <option value="automatisation">Automatisation & IA (Make, n8n)</option>
                        <option value="marketing">Marketing Digital & Ads</option>
                        <option value="funnels">Funnels de Vente</option>
                        <option value="logistique">Logistique & Supply Chain</option>
                        <option value="outils" selected>Bons Plans & Fichiers Secrets</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Format de Publication</label>
                    <select name="format">
                        <option value="outil" selected>⚙️ Fichier / Configuration</option>
                        <option value="ebook">📚 Article / Guide PDF</option>
                        <option value="video">🎬 Vidéo / Démo</option>
                        <option value="live">🔴 Live & Partage Live</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Lien du Fichier / Photo / Article (URL externe ou Unsplash/Drive)</label>
                <input type="text" name="lien_ressource" placeholder="https://images.unsplash.com/... ou lien de partage">
            </div>
            <div class="form-group">
                <label>Expression / Description détaillée</label>
                <textarea name="contenu" rows="4" placeholder="Décrivez votre partage, ajoutez vos astuces ou instructions techniques..." required></textarea>
            </div>
            <button type="submit" class="modal-submit">Publier instantanément sur l'Académie</button>
        </form>
    </div>
</div>

<nav class="mobile-nav">
    <a href="/qg"><i data-lucide="layout-dashboard"></i>QG</a>
    <a href="/marketplace"><i data-lucide="shopping-bag"></i>Store</a>
    <a href="/academie" class="active"><i data-lucide="graduation-cap"></i>Académie</a>
    <a href="/community"><i data-lucide="users"></i>Chat</a>
</nav>

<script>
lucide.createIcons();

// Gestion Dark / Lumière futuriste
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('og_theme', newTheme);
    
    const icon = document.getElementById('theme-icon');
    if(icon) {
        icon.setAttribute('data-lucide', newTheme === 'dark' ? 'sun-medium' : 'moon');
        lucide.createIcons();
    }
}

// Charger le thème mémorisé
const savedTheme = localStorage.getItem('og_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Gestion Modal Partage Communautaire
function openPartageModal() {
    document.getElementById('partageModal').classList.add('open');
}
function closePartageModal() {
    document.getElementById('partageModal').classList.remove('open');
}

async function submitPartage(event) {
    event.preventDefault();
    const form = document.getElementById('partageForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/academie/partager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            location.reload();
        } else {
            alert("Erreur lors de la publication.");
        }
    } catch(err) {
        console.error(err);
        alert("Erreur réseau.");
    }
}

async function toggleAcademieFavorite(coursId, btn) {
    try {
        const res = await fetch('/academie/favoris/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coursId })
        });
        const data = await res.json();
        if (data.success) {
            if (data.saved) {
                btn.classList.add('saved');
            } else {
                btn.classList.remove('saved');
            }
        }
    } catch (err) {
        console.error("Erreur favoris académie:", err);
    }
}
</script>
</body>
</html>`);
});

router.post("/favoris/toggle", requireAuth, async (req, res) => {
    const { coursId } = req.body;
    const userId = req.session.userId;
    if (!coursId || !userId) return res.status(400).json({ success: false });

    try {
        const check = await db.query(`SELECT * FROM academie_favoris WHERE user_id = $1 AND cours_id = $2`, [userId, coursId]);
        if (check.length > 0) {
            await db.query(`DELETE FROM academie_favoris WHERE user_id = $1 AND cours_id = $2`, [userId, coursId]);
            return res.json({ success: true, saved: false });
        } else {
            await db.query(`INSERT INTO academie_favoris (user_id, cours_id) VALUES ($1, $2)`, [userId, coursId]);
            return res.json({ success: true, saved: true });
        }
    } catch (err) {
        console.warn("⚠️ Erreur toggle favoris académie DB:", err.message);
        return res.json({ success: true, saved: true });
    }
});

module.exports = router;
