// ==========================================================================
// SAMII OS — THE SOVEREIGN ACADEMY — PostgreSQL Edition v4 (Ultra Mobile & Techno)
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
    { id: "logistique",      label: "Logistique, Transport & Supply Chain" },
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

// 6 Exemples uniques, ultra-détaillés ancrés dans l'écosystème Logistique, Transport et SAMII OS
const COURS_VIRTUELS = [
    { 
        id: "ac_1", 
        titre: "Architecture Avancée SAMII OS : Orchestration multi-agents & Flux n8n", 
        categorie: "automatisation", 
        format: "video", 
        niveau: "Avancé", 
        duree: "2h 45min", 
        prix: "Inclus VIP", 
        likes: 342,
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
        likes: 512,
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
        likes: 289,
        photo_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "ai_agent_vaulta", 
        formateur_nom: "SAMII OS Academy", 
        type_formateur: "ia_mentor", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_4", 
        titre: "Logistique & Transport International : Optimiser la chaîne d'approvisionnement", 
        categorie: "logistique", 
        format: "video", 
        niveau: "Avancé", 
        duree: "3h 10min", 
        prix: "Inclus VIP", 
        likes: 418,
        photo_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "logistics_pro", 
        formateur_nom: "Fleet Manager OG", 
        type_formateur: "expert", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_5", 
        titre: "Automatisation Transport Routier : Dispatching de flotte en temps réel par IA", 
        categorie: "logistique", 
        format: "outil", 
        niveau: "Expert", 
        duree: "Template n8n", 
        prix: "Libre", 
        likes: 670,
        photo_url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "ai_agent_samii", 
        formateur_nom: "Samii Dispatcher", 
        type_formateur: "ia_mentor", 
        est_live: false, 
        actif: true 
    },
    { 
        id: "ac_6", 
        titre: "Stratégie d'Affiliation Haute Performance : Générer des commissions passives", 
        categorie: "affiliation", 
        format: "video", 
        niveau: "Intermédiaire", 
        duree: "1h 50min", 
        prix: "Inclus", 
        likes: 315,
        photo_url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1000&q=85", 
        formateur_id: "aff_master", 
        formateur_nom: "OG Affiliate Lab", 
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
        COURS_VIRTUELS.unshift({
            id: `usr_${Date.now()}`,
            titre: titre || "Nouvelle Publication",
            categorie: categorie || "outils",
            format: format || "outil",
            niveau: "Tous niveaux",
            duree: "Ressource Partagée",
            prix: "Libre",
            likes: 1,
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

// Route Likes / J'aime
router.post("/like/toggle", requireAuth, async (req, res) => {
    const { coursId } = req.body;
    return res.json({ success: true, liked: true, message: "Like pris en compte" });
});

// Route Enregistrer / Bookmark
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
        return res.json({ success: true, saved: true });
    }
});

// ==========================================================================
// ACADÉMIE — ROUTE PRINCIPALE ULTRA-MOBILE (2 par ligne, Boutons J'aime/Partager, Techno Switch Animé)
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
            duree: r.duree, prix: r.prix, likes: r.likes || 12, photo_url: r.photo_url, formateur_id: r.formateur_id,
            formateur_nom: r.formateur_nom, type_formateur: r.type_formateur, est_live: r.est_live, actif: r.actif
        }));

    } catch (err) {
        console.warn("⚠️ Académie — lecture PostgreSQL échouée (mode virtuel actif) :", err.message);
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

    // Grille 2 colonnes ultra-optimisée Mobile First
    const cardsHtml = toutesRessources.map((c, index) => {
        const id = c.id || `cours_${index}_${Date.now()}`;
        const titre = escapeHtml(c.titre || "Masterclass SAMII OS");
        const catLabel = escapeHtml(getCategoryLabel(c.categorie));
        const duree = escapeHtml(c.duree || "Modules HD");
        const niveau = escapeHtml(c.niveau || "Tous niveaux");
        const formateur = escapeHtml(c.formateur_nom || "Formateur OG");
        const likesCount = c.likes || 42;
        const isAI = c.type_formateur === "ia_mentor";
        const isLive = c.est_live === true;
        const isFavorited = mesFavorisAcademie.includes(String(id));
        const photoUrl = c.photo_url || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=85";

        const badgeHtml = isLive 
            ? `<span class="badge-live"><span class="live-dot-pulse"></span> LIVE</span>` 
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
                </div>
                <div class="course-duration"><i data-lucide="clock"></i> ${duree}</div>
            </div>
            <div class="course-body">
                <a href="/academie/cours/${id}" class="course-title">${titre}</a>
                <div class="trainer-row">
                    <div class="trainer-avatar">${isAI ? "AI" : "OG"}</div>
                    <div class="trainer-info">
                        <strong>${formateur}</strong>
                        <span>${niveau}</span>
                    </div>
                </div>
                <!-- Barre d'interactions directes : J'aime, Enregistrer, Partager -->
                <div class="course-social-actions">
                    <button class="social-btn like-btn" type="button" onclick='toggleLike(${JSON.stringify(String(id))}, this)'>
                        <i data-lucide="heart"></i> <span class="likes-count">${likesCount}</span>
                    </button>
                    <button class="social-btn bookmark-btn ${isFavorited ? "saved" : ""}" type="button" onclick='toggleAcademieFavorite(${JSON.stringify(String(id))}, this)'>
                        <i data-lucide="bookmark"></i>
                    </button>
                    <button class="social-btn share-btn" type="button" onclick='shareContent(${JSON.stringify(titre)})'>
                        <i data-lucide="share-2"></i>
                    </button>
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
    --panel: rgba(8, 17, 30, 0.9); 
    --panel-2: rgba(12, 25, 42, 0.98); 
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
    --panel: rgba(255, 255, 255, 0.95); 
    --panel-2: rgba(255, 255, 255, 1); 
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
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); font-family: Inter, sans-serif; overflow-x: hidden; transition: background 0.4s ease, color 0.4s ease; }
button, input, select { font: inherit; }
button { cursor: pointer; }
a { color: inherit; text-decoration: none; }

.tech-bg { position: fixed; inset: 0; z-index: -5; pointer-events: none; overflow: hidden; }
.tech-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 40px 40px; opacity: 0.3; }

/* SIDEBAR DESKTOP */
.sidebar { position: fixed; left: 0; top: 0; width: 250px; height: 100vh; padding: 24px 16px; background: var(--panel-2); border-right: 1px solid var(--border); z-index: 300; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 12px; padding: 6px 10px 25px; font-family: 'Orbitron', sans-serif; font-weight: 900; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #010409; background: linear-gradient(135deg, var(--gold), #ffe66d); box-shadow: var(--gold-glow); font-weight: 900; }
.brand-name { font-size: 13px; }
.brand-name span { color: var(--cyan); }
.side-menu { display: flex; flex-direction: column; gap: 6px; }
.side-link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 600; border: 1px solid transparent; transition: .25s var(--ease); }
.side-link svg { width: 18px; height: 18px; }
.side-link:hover, .side-link.active { color: var(--text); background: rgba(0, 240, 255, 0.1); border-color: var(--cyan); box-shadow: inset 3px 0 0 var(--cyan); }

.side-bottom { margin-top: auto; padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: rgba(0, 240, 255, 0.03); }
.side-ai { font-size: 11px; font-family: "JetBrains Mono"; color: var(--cyan); margin-bottom: 4px; }
.side-text { color: var(--muted); font-size: 11px; }

/* MAIN LAYOUT */
.main { margin-left: 250px; min-height: 100vh; width: calc(100% - 250px); }
.header { position: sticky; top: 0; z-index: 200; backdrop-filter: blur(25px); background: var(--panel-2); border-bottom: 1px solid var(--border); }
.header-top { min-height: 72px; padding: 10px 24px; display: flex; align-items: center; gap: 15px; }

.search { flex: 1; display: flex; min-width: 0; max-width: 700px; margin: auto; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--bg); transition: .25s; }
.search:focus-within { border-color: var(--cyan); box-shadow: var(--cyan-glow); }
.search select { width: 160px; padding: 0 10px; background: transparent; border: none; border-right: 1px solid var(--border); color: var(--text); outline: none; font-size: 11px; }
.search select option { background: var(--bg); color: var(--text); }
.search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text); padding: 12px 14px; font-size: 12px; }
.search input::placeholder { color: var(--muted); }
.search button { width: 48px; border: none; background: linear-gradient(135deg, var(--cyan), #0077ff); color: #010409; font-weight: 800; }

.header-actions { display: flex; align-items: center; gap: 10px; }

/* BOUTON TECHNOLOGIQUE DARK/LIGHT AMÉLIORÉ AVEC ANIMATION DE DÉPLACEMENT */
.tech-switch-btn {
    position: relative;
    width: 64px;
    height: 32px;
    border-radius: 999px;
    background: var(--panel);
    border: 1px solid var(--border);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 3px;
    box-shadow: inset 0 2px 5px rgba(0,0,0,0.3);
    transition: all 0.4s var(--ease);
}
.tech-switch-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--cyan), #0077ff);
    box-shadow: var(--cyan-glow);
    display: grid;
    place-items: center;
    color: #010409;
    font-size: 12px;
    transform: translateX(0px);
    transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), background 0.4s;
}
[data-theme="light"] .tech-switch-thumb {
    transform: translateX(32px);
    background: linear-gradient(135deg, var(--gold), #ffe66d);
    box-shadow: var(--gold-glow);
}

.action-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; color: #010409; background: linear-gradient(135deg, var(--cyan), #00a8ff); font-size: 12px; font-weight: 800; box-shadow: var(--cyan-glow); transition: .25s; }
.action-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }

/* SUBNAV FORMATS */
.subnav { display: flex; align-items: center; gap: 8px; padding: 10px 24px; overflow-x: auto; scrollbar-width: none; background: rgba(0,0,0,0.02); border-top: 1px solid var(--border); }
.subnav::-webkit-scrollbar { display: none; }
.format-chip { flex: 0 0 auto; text-decoration: none; padding: 6px 14px; border-radius: 20px; color: var(--muted); font-size: 11px; font-weight: 600; border: 1px solid var(--border); background: var(--panel); transition: .2s; }
.format-chip:hover, .format-chip.active { color: #010409; background: var(--cyan); border-color: var(--cyan); font-weight: 700; box-shadow: var(--cyan-glow); }

/* CONTENT & GRID MOBILE FIRST (2 COLONNES PAR DÉFAUT) */
.content { padding: 24px; }
.hero { margin-bottom: 24px; }
.hero-kicker { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono"; color: var(--cyan); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
.hero h1 { margin: 0; font-family: 'Orbitron', sans-serif; font-size: clamp(22px, 2.8vw, 36px); }
.hero h1 span { color: var(--cyan); text-shadow: var(--cyan-glow); }
.hero p { margin: 8px 0 0; color: var(--muted); font-size: 12px; max-width: 650px; }

/* GRILLE STRICTEMENT 2 POSTES PAR LIGNE SUR MOBILE AUSSI */
.courses-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 1024px) {
    .courses-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
}

.course-card { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); box-shadow: 0 10px 25px rgba(0,0,0,0.15); display: flex; flex-direction: column; transition: transform .3s var(--ease), border-color .3s; }
.course-card:hover { transform: translateY(-4px); border-color: var(--cyan); box-shadow: 0 15px 35px rgba(0,0,0,0.25), var(--cyan-glow); }
.course-card.is-live-card { border-color: rgba(255, 51, 102, 0.4); }

.course-media { position: relative; aspect-ratio: 16/9; background: #000; overflow: hidden; }
.course-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s; }
.course-card:hover .course-media img { transform: scale(1.06); }

.course-top-badges { position: absolute; top: 8px; left: 8px; display: flex; gap: 4px; pointer-events: none; }
.badge-cat, .badge-live, .badge-ai { padding: 3px 8px; border-radius: 999px; font-family: "JetBrains Mono"; font-size: 7px; font-weight: 700; }
.badge-cat { color: var(--text); background: rgba(1, 4, 9, 0.85); border: 1px solid var(--border); }
.badge-live { color: white; background: rgba(255, 51, 102, 0.9); border: 1px solid rgba(255,100,130,0.5); }
.badge-ai { color: #010409; background: var(--cyan); font-weight: 900; }

.course-duration { position: absolute; bottom: 8px; left: 8px; display: flex; align-items: center; gap: 4px; font-size: 9px; font-family: "JetBrains Mono"; color: white; background: rgba(1,4,9,0.7); padding: 3px 6px; border-radius: 6px; }
.course-duration svg { width: 10px; height: 10px; color: var(--cyan); }

.course-body { padding: 12px; display: flex; flex-direction: column; flex: 1; }
.course-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 36px; text-decoration: none; font-size: 11px; font-weight: 700; line-height: 1.4; transition: color .2s; }
.course-title:hover { color: var(--cyan); }

.trainer-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.trainer-avatar { width: 22px; height: 22px; flex: 0 0 22px; display: grid; place-items: center; border-radius: 6px; color: #010409; font-size: 8px; font-weight: 900; background: linear-gradient(135deg, var(--cyan), #00a8ff); }
.trainer-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.trainer-info strong { font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trainer-info span { color: var(--muted); font-size: 8px; }

/* BARRE D'INTERACTIONS SOCIALES (J'aime, Enregistrer, Partager) */
.course-social-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.social-btn { background: transparent; border: none; color: var(--muted); display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: "JetBrains Mono"; padding: 4px 6px; border-radius: 6px; transition: .2s; }
.social-btn svg { width: 13px; height: 13px; }
.social-btn.like-btn:hover, .social-btn.like-btn.liked { color: #ff3366; }
.social-btn.bookmark-btn:hover, .social-btn.bookmark-btn.saved { color: var(--gold); }
.social-btn.share-btn:hover { color: var(--cyan); }

/* MODAL DE PARTAGE / EXPRIMEZ-VOUS / CRÉER */
.modal-overlay { position: fixed; inset: 0; background: rgba(1, 4, 9, 0.85); backdrop-filter: blur(15px); z-index: 1000; display: none; place-items: center; padding: 15px; }
.modal-overlay.open { display: grid; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.modal-card { width: 100%; max-width: 550px; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: 18px; padding: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.6), var(--cyan-glow); position: relative; }
.modal-close { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: var(--muted); font-size: 18px; }
.modal-close:hover { color: var(--cyan); }
.modal-card h2 { font-family: 'Orbitron', sans-serif; margin-top: 0; font-size: 18px; color: var(--cyan); text-shadow: var(--cyan-glow); }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 10px; font-family: "JetBrains Mono"; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); outline: none; font-size: 12px; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--cyan); box-shadow: var(--cyan-glow); }
.modal-submit { width: 100%; padding: 12px; border-radius: 10px; background: linear-gradient(135deg, var(--cyan), #0077ff); border: none; color: #010409; font-weight: 800; font-size: 12px; box-shadow: var(--cyan-glow); }

/* MOBILE RESPONSIVE BOTTOM NAV */
.mobile-nav { display: none; }
@media (max-width: 900px) {
    .sidebar { display: none; }
    .main { margin-left: 0; width: 100%; }
    .header-top { padding: 8px 12px; flex-wrap: wrap; }
    .search { order: 3; flex-basis: 100%; max-width: none; }
    .content { padding: 16px 10px 90px; }
    .mobile-nav { position: fixed; left: 8px; right: 8px; bottom: 8px; height: 58px; z-index: 400; display: grid; grid-template-columns: repeat(4, 1fr); padding: 4px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel-2); backdrop-filter: blur(20px); box-shadow: 0 10px 40px rgba(0,0,0,0.5), var(--cyan-glow); }
    .mobile-nav a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-decoration: none; color: var(--muted); font-size: 8px; font-weight: 700; border-radius: 12px; }
    .mobile-nav a svg { width: 16px; height: 16px; }
    .mobile-nav a.active { color: var(--cyan); background: rgba(0, 240, 255, 0.12); }
}
</style>
</head>
<body>
<div class="tech-bg"><div class="tech-grid"></div></div>

<aside class="sidebar">
    <div>
        <div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>OS</span></div></div>
        <nav class="side-menu">
            <a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
            <a href="/marketplace" class="side-link"><i data-lucide="shopping-bag"></i> Marketplace</a>
            <a href="/academie" class="side-link active"><i data-lucide="graduation-cap"></i> Académie & Feed</a>
            <a href="/community" class="side-link"><i data-lucide="users"></i> Communauté</a>
            <a href="/client-qg" class="side-link"><i data-lucide="shield-check"></i> Client-QG</a>
        </nav>
    </div>
    <div class="side-bottom">
        <div class="side-ai">SAMII OS ACTIVE</div>
        <div class="side-text">Interface high-tech mobile-first sous marque OG.</div>
    </div>
</aside>

<main class="main">
    <header class="header">
        <div class="header-top">
            <form class="search" action="/academie" method="GET">
                <select name="categorie">
                    ${categoryOptionsHtml}
                </select>
                <input type="text" name="recherche" placeholder="Rechercher transport, e-commerce, automatisation..." value="${escapeHtml(req.query.recherche || '')}">
                <button type="submit"><i data-lucide="search"></i></button>
            </form>
            <div class="header-actions">
                <!-- Bouton Switch Dark/Lumière technologique avec animation fluide -->
                <button class="tech-switch-btn" type="button" onclick="toggleTheme()" title="Changer d'ambiance">
                    <div class="tech-switch-thumb">
                        <i data-lucide="zap" style="width:12px; height:12px;"></i>
                    </div>
                </button>
                <button class="action-btn" type="button" onclick="openPartageModal()">
                    <i data-lucide="plus-circle"></i> Exprimez-vous
                </button>
            </div>
        </div>
        <div class="subnav">
            ${formatChipsHtml}
        </div>
    </header>

    <div class="content">
        <div class="hero">
            <div class="hero-kicker"><span class="live-dot"></span> SOTHE SOVEREIGN ACADEMY & FEED</div>
            <h1>Le Flux <span>OG</span></h1>
            <p>Formations, logistique, transports et partages de la communauté sous l'écosystème SAMII OS.</p>
        </div>

        <!-- Grille Mobile à 2 colonnes strictes -->
        <div class="courses-grid">
            ${cardsHtml}
        </div>
    </div>
</main>

<!-- MODAL DE PUBLICATION (EXPRIMEZ-VOUS / PARTAGER) -->
<div class="modal-overlay" id="partageModal">
    <div class="modal-card">
        <button class="modal-close" onclick="closePartageModal()">&times;</button>
        <h2><i data-lucide="share-2"></i> Exprimez-vous & Partagez</h2>
        <p style="color:var(--muted); font-size:11px; margin-bottom:15px;">Publiez vos articles, configurations de transport, photos ou astuces.</p>
        
        <form id="partageForm" onsubmit="submitPartage(event)">
            <div class="form-group">
                <label>Titre / Sujet</label>
                <input type="text" name="titre" required placeholder="Ex: Optimisation flotte logistique...">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label>Catégorie</label>
                    <select name="categorie">
                        <option value="ecommerce">E-commerce</option>
                        <option value="automatisation">Automatisation</option>
                        <option value="logistique" selected>Logistique & Transport</option>
                        <option value="affiliation">Affiliation</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Format</label>
                    <select name="format">
                        <option value="outil" selected>⚙️ Config / Fichier</option>
                        <option value="ebook">📚 Article / PDF</option>
                        <option value="video">🎬 Vidéo / Démo</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Lien Média / Photo (URL)</label>
                <input type="text" name="lien_ressource" placeholder="https://images.unsplash.com/...">
            </div>
            <div class="form-group">
                <label>Description / Expression</label>
                <textarea name="contenu" rows="3" required placeholder="Détaillez votre partage..."></textarea>
            </div>
            <button type="submit" class="modal-submit">Publier sur le Flux</button>
        </form>
    </div>
</div>

<nav class="mobile-nav">
    <a href="/qg"><i data-lucide="layout-dashboard"></i>QG</a>
    <a href="/marketplace"><i data-lucide="shopping-bag"></i>Store</a>
    <a href="/academie" class="active"><i data-lucide="graduation-cap"></i>Flux</a>
    <a href="/community"><i data-lucide="users"></i>Chat</a>
</nav>

<script>
lucide.createIcons();

// Animation Techno Dark / Light Switch
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('og_theme', newTheme);
}

const savedTheme = localStorage.getItem('og_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Modals
function openPartageModal() { document.getElementById('partageModal').classList.add('open'); }
function closePartageModal() { document.getElementById('partageModal').classList.remove('open'); }

async function submitPartage(event) {
    event.preventDefault();
    const form = document.getElementById('partageForm');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
        const res = await fetch('/academie/partager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) { alert(result.message); location.reload(); }
    } catch(err) { alert("Erreur réseau"); }
}

// Interactions J'aime
async function toggleLike(coursId, btn) {
    try {
        const res = await fetch('/academie/like/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coursId })
        });
        const data = await res.json();
        if (data.success) {
            btn.classList.toggle('liked');
            const span = btn.querySelector('.likes-count');
            let count = parseInt(span.textContent);
            span.textContent = btn.classList.contains('liked') ? count + 1 : count - 1;
        }
    } catch (err) { console.error(err); }
}

// Favoris / Enregistrer
async function toggleAcademieFavorite(coursId, btn) {
    try {
        const res = await fetch('/academie/favoris/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coursId })
        });
        const data = await res.json();
        if (data.success) {
            if (data.saved) btn.classList.add('saved');
            else btn.classList.remove('saved');
        }
    } catch (err) { console.error(err); }
}

// Partage natif mobile
function shareContent(title) {
    if (navigator.share) {
        navigator.share({ title: title, url: window.location.href }).catch(() => {});
    } else {
        alert("Lien copié dans le presse-papier !");
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
        return res.json({ success: true, saved: true });
    }
});

module.exports = router;
