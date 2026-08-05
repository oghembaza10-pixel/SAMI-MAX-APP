// ==========================================================================
// SAMII OS — THE SOVEREIGN ACADEMY — PostgreSQL Edition v2
// Masterclasses en direct • E-books • Formations multi-catégories • Partage communautaire
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
    { id: "logistique",      label: "Logistique & Supply Chain (Yalidine)" },
    { id: "mindset",         label: "Mindset & Stratégie d'Entreprise" },
    { id: "affiliation",     label: "Affiliation & Monétisation" },
    { id: "outils",          label: "Bons Plans & Outils Secrets" }
];

const FORMATS_RESSOURCES = [
    { id: "tous",   label: "Tous les formats" },
    { id: "live",   label: "🔴 Lives & Replays" },
    { id: "video",  label: "🎬 Formations Vidéo" },
    { id: "ebook",  label: "📚 E-books & Guides PDF" },
    { id: "outil",  label: "⚙️ Fichiers & Configs" }
];

const COURS_VIRTUELS = [
    { 
        id: "ac_1", 
        titre: "Architecture Globale Sami OS : Maîtriser les 33 Tables et l'IA", 
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
        formateur_nom: "Vaulta Automation", 
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
        formateur_nom: "The Sovereign Academy", 
        type_formateur: "ia_mentor", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_4", 
        titre: "Logistique E-commerce Algérie : Optimiser ses livraisons avec Yalidine", 
        categorie: "logistique", 
        format: "video", 
        niveau: "Débutant", 
        duree: "1h 15min", 
        prix: "Inclus", 
        photo_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "marchand_verified_1", 
        formateur_nom: "Boutique Partenaire", 
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
// ACADÉMIE — ROUTE PRINCIPALE
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
        const titre = escapeHtml(c.titre || "Masterclass SAMII");
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
                ? `<span class="badge-ai"><span class="ai-dot"></span> MENTOR IA</span>` 
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
                        <span>${isAI ? "Expertise automatisée" : "Formateur vérifié"}</span>
                    </div>
                </div>
                <div class="course-footer">
                    <a href="/academie/cours/${id}" class="access-btn">
                        <i data-lucide="play-circle"></i> Accéder au module
                    </a>
                </div>
            </div>
        </article>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>The Sovereign Academy — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { 
    --bg: #03060b; 
    --bg-2: #07101a; 
    --panel: rgba(9, 18, 29, 0.88); 
    --panel-2: rgba(12, 25, 39, 0.96); 
    --text: #f5fbff; 
    --muted: #7f96a8; 
    --blue: #00d9ff; 
    --blue-2: #0077ff; 
    --gold: #d7b34c; 
    --gold-glow: 0 0 20px rgba(215, 179, 76, 0.3);
    --cyan-glow: 0 0 15px rgba(0, 217, 255, 0.45), 0 0 45px rgba(0, 119, 255, 0.18); 
    --border: rgba(0, 217, 255, 0.16); 
    --danger: #ff5470; 
    --radius: 18px; 
    --ease: cubic-bezier(.16, 1, .3, 1); 
}
body.light { 
    --bg: #eef5fa; 
    --bg-2: #e2edf5; 
    --panel: rgba(255, 255, 255, 0.88); 
    --panel-2: rgba(255, 255, 255, 0.97); 
    --text: #08121c; 
    --muted: #607384; 
    --border: rgba(0, 119, 255, 0.16); 
    --cyan-glow: 0 0 20px rgba(0, 119, 255, 0.18); 
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 10% 10%, rgba(215, 179, 76, 0.05), transparent 30%), radial-gradient(circle at 90% 90%, rgba(0, 217, 255, 0.08), transparent 32%), var(--bg); color: var(--text); font-family: Inter, sans-serif; overflow-x: hidden; }
button, input, select { font: inherit; }
button { cursor: pointer; }
a { color: inherit; text-decoration: none; }

.tech-bg { position: fixed; inset: 0; z-index: -5; pointer-events: none; overflow: hidden; }
.tech-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(215, 179, 76, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(215, 179, 76, 0.025) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(to bottom, black, transparent 90%); }
.tech-orb { position: absolute; width: 400px; height: 400px; border-radius: 50%; filter: blur(90px); opacity: 0.1; background: var(--gold); }
.tech-orb.one { top: -150px; left: -100px; }
.tech-orb.two { right: -150px; bottom: 10%; background: var(--blue); }

/* SIDEBAR STYLING */
.sidebar { position: fixed; left: 0; top: 0; width: 245px; height: 100vh; padding: 22px 16px; background: linear-gradient(180deg, rgba(4, 10, 17, 0.97), rgba(3, 7, 12, 0.94)); border-right: 1px solid var(--border); z-index: 300; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 10px; padding: 8px 10px 25px; font-weight: 800; letter-spacing: .5px; }
.brand-mark { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 11px; color: #03060b; background: linear-gradient(135deg, var(--gold), #f3e5ab); box-shadow: var(--gold-glow); font-weight: 900; }
.brand-name { font-size: 14px; }
.brand-name span { color: var(--gold); }
.side-menu { display: flex; flex-direction: column; gap: 6px; }
.side-link { display: flex; align-items: center; gap: 12px; padding: 12px 13px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 600; border: 1px solid transparent; transition: .25s var(--ease); }
.side-link svg { width: 18px; height: 18px; }
.side-link:hover, .side-link.active { color: var(--text); background: linear-gradient(90deg, rgba(215, 179, 76, 0.12), rgba(0, 217, 255, 0.04)); border-color: rgba(215, 179, 76, 0.3); box-shadow: inset 3px 0 0 var(--gold), var(--gold-glow); }
.side-link.active svg { color: var(--gold); filter: drop-shadow(0 0 7px var(--gold)); }

.side-bottom { margin-top: auto; padding: 14px; border: 1px solid rgba(215, 179, 76, 0.2); border-radius: 16px; background: linear-gradient(135deg, rgba(215, 179, 76, 0.08), rgba(0, 217, 255, 0.03)); }
.side-ai { display: flex; align-items: center; gap: 8px; font-size: 11px; font-family: "JetBrains Mono"; color: var(--gold); margin-bottom: 6px; }
.side-ai-dot { width: 7px; height: 7px; background: var(--gold); border-radius: 50%; box-shadow: var(--gold-glow); }
.side-text { color: var(--muted); font-size: 11px; line-height: 1.5; }

/* MAIN LAYOUT */
.main { margin-left: 245px; min-height: 100vh; width: calc(100% - 245px); }
.header { position: sticky; top: 0; z-index: 200; backdrop-filter: blur(24px); background: rgba(3, 7, 12, 0.85); border-bottom: 1px solid var(--border); }
.header-top { min-height: 70px; padding: 10px 28px; display: flex; align-items: center; gap: 15px; }

.search { flex: 1; display: flex; min-width: 0; max-width: 720px; margin: auto; border: 1px solid rgba(215, 179, 76, 0.3); border-radius: 13px; overflow: hidden; background: rgba(0, 0, 0, 0.3); transition: .25s; }
.search:focus-within { border-color: var(--gold); box-shadow: var(--gold-glow); }
.search select { width: 175px; padding: 0 12px; background: transparent; border: none; border-right: 1px solid var(--border); color: var(--text); outline: none; font-size: 12px; }
.search select option { background: #07101a; color: white; }
.search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text); padding: 13px 14px; font-size: 13px; }
.search input::placeholder { color: var(--muted); }
.search button { width: 50px; border: none; background: linear-gradient(135deg, var(--gold), #c09a30); color: #03060b; transition: .25s; font-weight: 800; }
.search button:hover { filter: brightness(1.2); box-shadow: var(--gold-glow); }

.header-actions { display: flex; align-items: center; gap: 10px; }
.action-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 11px; color: #03060b; text-decoration: none; background: linear-gradient(135deg, var(--gold), #f3e5ab); font-size: 12px; font-weight: 800; box-shadow: var(--gold-glow); transition: .25s var(--ease); }
.action-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

/* SUBNAV FORMATS & CATEGORIES */
.subnav { display: flex; align-items: center; gap: 8px; padding: 10px 28px; overflow-x: auto; scrollbar-width: none; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.02); }
.subnav::-webkit-scrollbar { display: none; }
.format-chip { flex: 0 0 auto; text-decoration: none; padding: 7px 14px; border-radius: 20px; color: var(--muted); font-size: 11px; font-weight: 600; border: 1px solid var(--border); transition: .2s; background: rgba(255,255,255,0.02); }
.format-chip:hover, .format-chip.active { color: #03060b; background: var(--gold); border-color: var(--gold); font-weight: 700; box-shadow: var(--gold-glow); }

/* CONTENT HERO & GRID */
.content { padding: 30px; }
.hero { display: flex; align-items: flex-end; justify-content:space-between; gap: 20px; margin-bottom: 30px; }
.hero-kicker { display: flex; align-items: center; gap: 7px; font-family: "JetBrains Mono"; color: var(--gold); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5470; box-shadow: 0 0 12px #ff5470; animation: pulseLive 1.5s infinite; }
@keyframes pulseLive { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 18px #ff5470; } 100% { transform: scale(0.95); opacity: 0.8; } }

.hero h1 { margin: 0; font-size: clamp(26px, 3.2vw, 42px); line-height: 1.1; letter-spacing: -.9px; }
.hero h1 span { color: var(--gold); text-shadow: var(--gold-glow); }
.hero p { margin: 10px 0 0; color: var(--muted); font-size: 13px; max-width: 700px; }

.courses-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 22px; }
.course-card { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); backdrop-filter: blur(18px); box-shadow: 0 15px 35px rgba(0,0,0,0.25); transition: transform .35s var(--ease), border-color .35s, box-shadow .35s; display: flex; flex-direction: column; }
.course-card:hover { transform: translateY(-7px); border-color: rgba(215, 179, 76, 0.5); box-shadow: 0 25px 60px rgba(0,0,0,0.4), var(--gold-glow); }
.course-card.is-live-card { border-color: rgba(255, 84, 112, 0.4); }

.course-media { position: relative; aspect-ratio: 16/9; background: #020509; overflow: hidden; }
.course-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s var(--ease); }
.course-card:hover .course-media img { transform: scale(1.08); }

.course-top-badges { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
.badge-cat, .badge-level, .badge-live, .badge-ai { padding: 5px 9px; border-radius: 999px; backdrop-filter: blur(12px); font-family: "JetBrains Mono"; font-size: 8px; font-weight: 700; white-space: nowrap; }
.badge-cat { color: white; background: rgba(3, 8, 14, 0.8); border: 1px solid rgba(255,255,255,0.1); }
.badge-level { color: var(--gold); background: rgba(3, 8, 14, 0.85); border: 1px solid rgba(215, 179, 76, 0.3); }
.badge-live { color: white; background: rgba(255, 84, 112, 0.85); border: 1px solid rgba(255, 120, 140, 0.5); box-shadow: 0 0 15px rgba(255, 84, 112, 0.4); display: flex; align-items: center; gap: 5px; }
.live-dot-pulse { width: 6px; height: 6px; background: white; border-radius: 50%; animation: pulseLive 1s infinite; }
.badge-ai { color: white; background: rgba(130, 45, 210, 0.85); border: 1px solid rgba(205, 145, 255, 0.4); display: flex; align-items: center; gap: 4px; }
.ai-dot { width: 5px; height: 5px; background: #d7a7ff; border-radius: 50%; box-shadow: 0 0 8px #d7a7ff; }

.course-duration { position: absolute; bottom: 10px; left: 12px; display: flex; align-items: center; gap: 5px; font-size: 10px; font-family: "JetBrains Mono"; color: white; background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 8px; backdrop-filter: blur(8px); }
.course-duration svg { width: 12px; height: 12px; color: var(--gold); }

.favorite-btn { position: absolute; right: 12px; bottom: 10px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: white; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); transition: .25s var(--ease); }
.favorite-btn:hover { color: var(--gold); border-color: var(--gold); box-shadow: var(--gold-glow); transform: scale(1.1); }
.favorite-btn.saved { color: var(--gold); background: rgba(215, 179, 76, 0.2); border-color: var(--gold); }

.course-body { padding: 18px; display: flex; flex-direction: column; flex: 1; }
.course-category-tag { font-size: 9px; font-family: "JetBrains Mono"; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.course-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 44px; text-decoration: none; font-size: 14px; font-weight: 700; line-height: 1.45; transition: color .2s; }
.course-title:hover { color: var(--gold); }

.trainer-row { display: flex; align-items: center; gap: 10px; margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.trainer-avatar { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border-radius: 9px; color: #03060b; font-size: 9px; font-weight: 900; background: linear-gradient(135deg, var(--gold), #f3e5ab); box-shadow: var(--gold-glow); }
.trainer-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.trainer-info strong { font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trainer-info span { color: var(--muted); font-size: 9px; margin-top: 2px; }

.course-footer { margin-top: auto; padding-top: 15px; }
.access-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; border-radius: 12px; background: rgba(215, 179, 76, 0.1); border: 1px solid rgba(215, 179, 76, 0.3); color: var(--gold); font-size: 12px; font-weight: 700; transition: .25s var(--ease); }
.access-btn:hover { background: var(--gold); color: #03060b; box-shadow: var(--gold-glow); }

/* MOBILE RESPONSIVE NAV */
.mobile-nav { display: none; }
@media (max-width: 900px) {
    .sidebar { display: none; }
    .main { margin-left: 0; width: 100%; }
    .header-top { padding: 10px 15px; flex-wrap: wrap; }
    .search { order: 3; flex-basis: 100%; max-width: none; }
    .content { padding: 20px 12px 90px; }
    .courses-grid { grid-template-columns: 1fr; gap: 15px; }
    .mobile-nav { position: fixed; left: 8px; right: 8px; bottom: 8px; height: 62px; z-index: 400; display: grid; grid-template-columns: repeat(4, 1fr); padding: 5px; border: 1px solid rgba(215, 179, 76, 0.3); border-radius: 17px; background: rgba(4, 10, 17, 0.95); backdrop-filter: blur(25px); box-shadow: 0 15px 50px rgba(0,0,0,0.5), var(--gold-glow); }
    .mobile-nav a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; color: var(--muted); font-size: 8px; font-weight: 700; border-radius: 12px; }
    .mobile-nav a svg { width: 18px; height: 18px; }
    .mobile-nav a.active { color: var(--gold); background: rgba(215, 179, 76, 0.12); }
}
</style>
</head>
<body>
<div class="tech-bg"><div class="tech-grid"></div><div class="tech-orb one"></div><div class="tech-orb two"></div></div>

<aside class="sidebar">
    <div>
        <div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>ACADEMY</span></div></div>
        <nav class="side-menu">
            <a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
            <a href="/marketplace" class="side-link"><i data-lucide="shopping-bag"></i> Marketplace</a>
            <a href="/academie" class="side-link active"><i data-lucide="graduation-cap"></i> Académie & Lives</a>
            <a href="/community" class="side-link"><i data-lucide="users"></i> Communauté</a>
            <a href="/client-qg" class="side-link"><i data-lucide="shield-check"></i> Client-QG</a>
        </nav>
    </div>
    <div class="side-bottom">
        <div class="side-ai"><span class="side-ai-dot"></span> SAMII KNOWLEDGE OS</div>
        <div class="side-text">Apprenez, formez-vous en direct et dominez votre marché avec l'écosystème OG.</div>
    </div>
</aside>

<main class="main">
    <header class="header">
        <div class="header-top">
            <form class="search" action="/academie" method="GET">
                <select name="categorie">
                    ${categoryOptionsHtml}
                </select>
                <input type="text" name="recherche" placeholder="Rechercher une formation, un e-book, un replay live..." value="${escapeHtml(req.query.recherche || '')}">
                <button type="submit"><i data-lucide="search"></i></button>
            </form>
            <div class="header-actions">
                <a href="/academie/nouveau-cours" class="action-btn"><i data-lucide="plus-circle"></i> Partager une ressource</a>
            </div>
        </div>
        <div class="subnav">
            ${formatChipsHtml}
        </div>
    </header>

    <div class="content">
        <div class="hero">
            <div>
                <div class="hero-kicker"><span class="live-dot"></span> CENTRE DE FORMATION & MASTERMIND</div>
                <h1>The Sovereign <span>Academy</span></h1>
                <p class="hero">Maîtrisez l'e-commerce, l'automatisation par IA et les stratégies de scaling les plus avancées sous la bannière OG.</p>
            </div>
        </div>

        <div class="courses-grid">
            ${cardsHtml}
        </div>
    </div>
</main>

<nav class="mobile-nav">
    <a href="/qg"><i data-lucide="layout-dashboard"></i>QG</a>
    <a href="/marketplace"><i data-lucide="shopping-bag"></i>Store</a>
    <a href="/academie" class="active"><i data-lucide="graduation-cap"></i>Académie</a>
    <a href="/community"><i data-lucide="users"></i>Chat</a>
</nav>

<script>
lucide.createIcons();

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
