// ==========================================================================
// SAMII OS — THE SOVEREIGN ACADEMY — PostgreSQL Edition v6 (Boutons réels + Traduction complète)
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
    {  id: "ac_4", 
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

function isRealCourseId(id) {
    return /^\d+$/.test(String(id));
}

router.post("/partager", requireAuth, async (req, res) => {
    const { titre, categorie, format, contenu, lien_ressource } = req.body;
    const userId = req.session.userId || "1";
    const userName = req.session.nom || "Membre OG";

    if (!titre || !titre.trim()) {
        return res.json({ success: false, message: "Le titre est requis." });
    }

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
        return res.json({ success: true, message: "✅ Ressource publiée avec succès dans l'Académie !" });
    } catch (err) {
        console.error("❌ POST /academie/partager :", err.message);
        return res.json({ success: false, message: "❌ Erreur lors de la publication. Réessaie." });
    }
});

router.post("/like/toggle", requireAuth, async (req, res) => {
    const { coursId } = req.body;
    const userId = req.session.userId;

    if (!coursId || !userId) return res.json({ success: false });

    if (!isRealCourseId(coursId)) {
        return res.json({ success: true, demo: true, message: "Ressource de démonstration — like non enregistré." });
    }

    try {
        const existing = await db.query(
            `SELECT id FROM academie_likes WHERE user_id = $1 AND cours_id = $2`,
            [userId, coursId]
        );

        if (existing.length > 0) {
            await db.query(`DELETE FROM academie_likes WHERE id = $1`, [existing[0].id]);
            await db.query(`UPDATE academie_cours SET likes = GREATEST(COALESCE(likes,0) - 1, 0) WHERE id = $1`, [coursId]);
            return res.json({ success: true, liked: false });
        }

        await db.query(`INSERT INTO academie_likes (user_id, cours_id) VALUES ($1, $2)`, [userId, coursId]);
        await db.query(`UPDATE academie_cours SET likes = COALESCE(likes,0) + 1 WHERE id = $1`, [coursId]);
        return res.json({ success: true, liked: true });
    } catch (err) {
        console.error("❌ POST /academie/like/toggle :", err.message);
        return res.json({ success: false });
    }
});

router.post("/favoris/toggle", requireAuth, async (req, res) => {
    const { coursId } = req.body;
    const userId = req.session.userId;
    if (!coursId || !userId) return res.status(400).json({ success: false });

    if (!isRealCourseId(coursId)) {
        return res.json({ success: true, demo: true, message: "Ressource de démonstration — favori non enregistré." });
    }

    try {
        const check = await db.query(`SELECT id FROM academie_favoris WHERE user_id = $1 AND cours_id = $2`, [userId, coursId]);
        if (check.length > 0) {
            await db.query(`DELETE FROM academie_favoris WHERE id = $1`, [check[0].id]);
            return res.json({ success: true, saved: false });
        } else {
            await db.query(`INSERT INTO academie_favoris (user_id, cours_id) VALUES ($1, $2)`, [userId, coursId]);
            return res.json({ success: true, saved: true });
        }
    } catch (err) {
        console.error("❌ POST /academie/favoris/toggle :", err.message);
        return res.json({ success: false });
    }
});

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
            duree: r.duree, prix: r.prix, likes: r.likes || 0, photo_url: r.photo_url, formateur_id: r.formateur_id,
            formateur_nom: r.formateur_nom, type_formateur: r.type_formateur, est_live: r.est_live, actif: r.actif
        }));
    } catch (err) {
        console.warn("⚠️ Académie — lecture PostgreSQL échouée :", err.message);
    }

    let toutesRessources = [...COURS_VIRTUELS, ...coursDB];

    if (categorie && categorie !== "tous") toutesRessources = toutesRessources.filter(c => c.categorie === categorie);
    if (format && format !== "tous") toutesRessources = toutesRessources.filter(c => c.format === format);
    if (recherche) {
        const q = recherche.toLowerCase();
        toutesRessources = toutesRessources.filter(c => String(c.titre || "").toLowerCase().includes(q));
    }

    let mesFavorisAcademie = [];
    let mesLikesAcademie = [];
    try {
        if (req.session.userId) {
            const favRows = await db.query(`SELECT cours_id FROM academie_favoris WHERE user_id = $1`, [req.session.userId]);
            mesFavorisAcademie = favRows.map(r => String(r.cours_id));
            const likeRows = await db.query(`SELECT cours_id FROM academie_likes WHERE user_id = $1`, [req.session.userId]);
            mesLikesAcademie = likeRows.map(r => String(r.cours_id));
        }
    } catch (err) { /* ignore */ }

    const categoryOptionsHtml = CATEGORIES_ACADEMIE.map(c =>
        `<option value="${escapeHtml(c.id)}" data-i18n-opt="cat_${c.id}" ${categorie === c.id ? "selected" : ""}>${escapeHtml(c.label)}</option>`
    ).join("");

    const formatChipsHtml = FORMATS_RESSOURCES.map(f => `
        <a href="/academie?format=${f.id}${categorie ? '&categorie=' + categorie : ''}" data-i18n="fmt_${f.id}" class="format-chip ${(!format && f.id === 'tous') || format === f.id ? "active" : ""}">
            ${f.label}
        </a>`).join("");

    const cardsHtml = toutesRessources.map((c, index) => {
        const id = c.id || `cours_${index}_${Date.now()}`;
        const titre = escapeHtml(c.titre || "Masterclass SAMII OS");
        const catLabel = escapeHtml(getCategoryLabel(c.categorie));
        const duree = escapeHtml(c.duree || "Modules HD");
        const niveau = escapeHtml(c.niveau || "Tous niveaux");
        const formateur = escapeHtml(c.formateur_nom || "Formateur OG");
        const likesCount = c.likes || 0;
        const isAI = c.type_formateur === "ia_mentor";
        const isLive = c.est_live === true;
        const isReal = isRealCourseId(id);
        const isFavorited = mesFavorisAcademie.includes(String(id));
        const isLiked = mesLikesAcademie.includes(String(id));
        const photoUrl = c.photo_url || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=85";

        const badgeHtml = isLive 
            ? `<span class="badge-live" data-i18n="badge_live"><span class="live-dot-pulse"></span> LIVE</span>` 
            : isAI 
                ? `<span class="badge-ai" data-i18n="badge_ai"><span class="ai-dot"></span> SAMII AI</span>` 
                : `<span class="badge-cat">${catLabel}</span>`;

        return `
        <article class="course-card ${isLive ? "is-live-card" : ""}" data-course-id="${escapeHtml(String(id))}" data-real="${isReal}">
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
                <a href="/academie/cours/${id}" class="course-title" data-i18n-title="${titre}">${titre}</a>
                <div class="trainer-row">
                    <div class="trainer-avatar">${isAI ? "AI" : "OG"}</div>
                    <div class="trainer-info">
                        <strong>${formateur}</strong>
                        <span>${niveau}</span>
                    </div>
                </div>
                <div class="course-social-actions">
                    <button class="social-btn like-btn ${isLiked ? "liked" : ""}" type="button" onclick='toggleLike(${JSON.stringify(String(id))}, ${isReal}, this)'>
                        <i data-lucide="heart"></i> <span class="likes-count">${likesCount}</span>
                    </button>
                    <button class="social-btn bookmark-btn ${isFavorited ? "saved" : ""}" type="button" onclick='toggleAcademieFavorite(${JSON.stringify(String(id))}, ${isReal}, this)'>
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
.sidebar { position: fixed; left: 0; top: 0; width: 250px; height: 100vh; padding: 24px 16px; background: var(--panel-2); border-right: 1px solid var(--border); z-index: 300; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 12px; padding: 6px 10px 25px; font-family: 'Orbitron', sans-serif; font-weight: 900; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #010409; background: linear-gradient(135deg, var(--gold), #ffe66d); box-shadow: var(--gold-glow); font-weight: 900; }
.brand-name { font-size: 13px; }.brand-name span { color: var(--cyan); }
.side-menu { display: flex; flex-direction: column; gap: 6px; }
.side-link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 600; border: 1px solid transparent; transition: .25s var(--ease); }
.side-link svg { width: 18px; height: 18px; }
.side-link:hover, .side-link.active { color: var(--text); background: rgba(0, 240, 255, 0.1); border-color: var(--cyan); box-shadow: inset 3px 0 0 var(--cyan); }
.side-bottom { margin-top: auto; padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: rgba(0, 240, 255, 0.03); }
.side-ai { font-size: 11px; font-family: "JetBrains Mono"; color: var(--cyan); margin-bottom: 4px; }
.side-text { color: var(--muted); font-size: 11px; }
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
.lang-selector { display: flex; align-items: center; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 3px; gap: 2px; }
.lang-btn { background: transparent; border: none; color: var(--muted); font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 9px; cursor: pointer; transition: 0.2s; }
.lang-btn.active { background: var(--cyan); color: #010409; box-shadow: var(--cyan-glow); }
.tech-switch-btn { position: relative; width: 58px; height: 30px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); cursor: pointer; display: flex; align-items: center; padding: 3px; transition: all 0.4s var(--ease); }
.tech-switch-thumb { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--cyan), #0077ff); box-shadow: var(--cyan-glow); display: grid; place-items: center; color: #010409; transform: translateX(0px); transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), background 0.4s; }
[data-theme="light"] .tech-switch-thumb { transform: translateX(28px); background: linear-gradient(135deg, var(--gold), #ffe66d); box-shadow: var(--gold-glow); }
.action-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; color: #010409; background: linear-gradient(135deg, var(--cyan), #00a8ff); font-size: 12px; font-weight: 800; box-shadow: var(--cyan-glow); transition: .25s; }
.action-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
.subnav { display: flex; align-items: center; gap: 8px; padding: 10px 24px; overflow-x: auto; scrollbar-width: none; background: rgba(0,0,0,0.02); border-top: 1px solid var(--border); }
.subnav::-webkit-scrollbar { display: none; }
.format-chip { flex: 0 0 auto; text-decoration: none; padding: 6px 14px; border-radius: 20px; color: var(--muted); font-size: 11px; font-weight: 600; border: 1px solid var(--border); background: var(--panel); transition: .2s; }
.format-chip:hover, .format-chip.active { color: #010409; background: var(--cyan); border-color: var(--cyan); font-weight: 700; box-shadow: var(--cyan-glow); }
.content { padding: 24px; }
.hero { margin-bottom: 24px; }
.hero-kicker { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono"; color: var(--cyan); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
.hero h1 { margin: 0; font-family: 'Orbitron', sans-serif; font-size: clamp(22px, 2.8vw, 36px); }
.hero h1 span { color: var(--cyan); text-shadow: var(--cyan-glow); }
.hero p { margin: 8px 0 0; color: var(--muted); font-size: 12px; max-width: 650px; }
.courses-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (min-width: 1024px) { .courses-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; } }
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
.course-social-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.social-btn { background: transparent; border: none; color: var(--muted); display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: "JetBrains Mono"; padding: 4px 6px; border-radius: 6px; transition: .2s; }
.social-btn svg { width: 13px; height: 13px; }
.social-btn.like-btn:hover, .social-btn.like-btn.liked { color: #ff3366; }
.social-btn.like-btn.liked svg { fill: #ff3366; }
.social-btn.bookmark-btn:hover, .social-btn.bookmark-btn.saved { color: var(--gold); }
.social-btn.bookmark-btn.saved svg { fill: var(--gold); }
.social-btn.share-btn:hover { color: var(--cyan); }
.modal-overlay { position: fixed; inset: 0; background: rgba(1, 4, 9, 0.85); backdrop-filter: blur(15px); z-index: 1000; display: none; place-items: center; padding: 15px; }
.modal-overlay.open { display: grid; animation: fadeIn .2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.modal-card { width: 100%; max-width: 550px; background: var(--panel-2); border: 1px solid var(--cyan); border-radius: 18px; padding: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.6), var(--cyan-glow); position: relative; max-height: 90vh; overflow-y: auto; }
.modal-close { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: var(--muted); font-size: 18px; }
.modal-close:hover { color: var(--cyan); }
.modal-card h2 { font-family: 'Orbitron', sans-serif; margin-top: 0; font-size: 18px; color: var(--cyan); text-shadow: var(--cyan-glow); }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 10px; font-family: "JetBrains Mono"; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); outline: none; font-size: 12px; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--cyan); box-shadow: var(--cyan-glow); }
.modal-submit { width: 100%; padding: 12px; border-radius: 10px; background: linear-gradient(135deg, var(--cyan), #0077ff); border: none; color: #010409; font-weight: 800; font-size: 12px; box-shadow: var(--cyan-glow); }
.sami-social-box { margin-top: 20px; padding: 14px; background: rgba(0, 240, 255, 0.04); border: 1px dashed var(--cyan); border-radius: 12px; text-align: center; }
.sami-social-box p { font-size: 11px; color: var(--text); margin-bottom: 10px; line-height: 1.4; }
.sami-social-links { display: flex; justify-content: center; gap: 10px; }
.sami-social-btn { padding: 8px 14px; border-radius: 8px; background: var(--cyan); color: #010409; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; box-shadow: var(--cyan-glow); }
.toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--panel-2); border: 1px solid var(--cyan); color: var(--text); padding: 12px 22px; border-radius: 12px; font-size: 12px; z-index: 900; opacity: 0; transition: .3s; pointer-events: none; }
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
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
<body dir="ltr" id="bodyRoot">
<div class="tech-bg"><div class="tech-grid"></div></div>
<aside class="sidebar">
    <div>
        <div class="brand"><div class="brand-mark">OG</div><div class="brand-name">SAMII <span>OS</span></div></div>
        <nav class="side-menu">
            <a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> <span data-i18n="nav_qg">QG Central</span></a>
            <a href="/marketplace" class="side-link"><i data-lucide="shopping-bag"></i> <span data-i18n="nav_store">Marketplace</span></a>
            <a href="/academie" class="side-link active"><i data-lucide="graduation-cap"></i> <span data-i18n="nav_academy">Académie & Feed</span></a>
            <a href="/community" class="side-link"><i data-lucide="users"></i> <span data-i18n="nav_chat">Communauté</span></a>
            <a href="/client-qg" class="side-link"><i data-lucide="shield-check"></i> Client-QG</a>
        </nav>
    </div>
    <div class="side-bottom">
        <div class="side-ai">SAMII OS ACTIVE</div>
        <div class="side-text" data-i18n="side_desc">Interface high-tech mobile-first sous marque OG.</div>
    </div>
</aside>
<main class="main">
    <header class="header">
        <div class="header-top">
            <form class="search" action="/academie" method="GET">
                <select name="categorie">
                    ${categoryOptionsHtml}
                </select>
                <input type="text" name="recherche" id="searchInput" data-i18n-placeholder="search_ph" placeholder="Rechercher transport, e-commerce, automatisation..." value="${escapeHtml(req.query.recherche || '')}">
                <button type="submit"><i data-lucide="search"></i></button>
            </form>
            <div class="header-actions">
                <div class="lang-selector">
                    <button type="button" class="lang-btn active" data-lang-btn="fr" onclick="setLanguage('fr')">FR</button>
                    <button type="button" class="lang-btn" data-lang-btn="ar" onclick="setLanguage('ar')">AR</button>
                    <button type="button" class="lang-btn" data-lang-btn="en" onclick="setLanguage('en')">EN</button>
                </div>
                <button class="tech-switch-btn" type="button" onclick="toggleTheme()" title="Changer d'ambiance">
                    <div class="tech-switch-thumb">
                        <i data-lucide="zap" style="width:12px; height:12px;"></i>
                    </div>
                </button>
                <button class="action-btn" type="button" onclick="openPartageModal()">
                    <i data-lucide="plus-circle"></i> <span data-i18n="btn_express">Exprimez-vous</span>
                </button>
            </div>
        </div>
        <div class="subnav">
            ${formatChipsHtml}
        </div>
    </header>
    <div class="content">
        <div class="hero">
            <div class="hero-kicker"><span class="live-dot"></span> THE SOVEREIGN ACADEMY & FEED</div>
            <h1 data-i18n="hero_title">Le Flux <span>OG</span></h1>
            <p data-i18n="hero_desc">Formations, logistique, transports et partages de la communauté sous l'écosystème SAMII OS.</p>
        </div>
        <div class="courses-grid">
            ${cardsHtml.length ? cardsHtml : `<p data-i18n="empty_state" style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px;">Aucune ressource trouvée.</p>`}
        </div>
    </div>
</main>
<div class="modal-overlay" id="partageModal">
    <div class="modal-card">
        <button class="modal-close" onclick="closePartageModal()">&times;</button>
        <h2><i data-lucide="share-2"></i> <span data-i18n="modal_title">Exprimez-vous & Partagez</span></h2>
        <p style="color:var(--muted); font-size:11px; margin-bottom:12px;" data-i18n="modal_desc">Publiez vos articles, configurations de transport, photos ou astuces.</p>
        
        <form id="partageForm" onsubmit="submitPartage(event)">
            <div class="form-group">
                <label data-i18n="form_title">Titre / Sujet</label>
                <input type="text" name="titre" required placeholder="Ex: Optimisation flotte logistique...">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                    <label data-i18n="form_cat">Catégorie</label>
                    <select name="categorie">
                        <option value="ecommerce" data-i18n="cat_ecommerce">E-commerce</option>
                        <option value="automatisation" data-i18n="cat_automatisation">Automatisation</option>
                        <option value="logistique" data-i18n="cat_logistique" selected>Logistique & Transport</option>
                        <option value="affiliation" data-i18n="cat_affiliation">Affiliation</option>
                    </select>
                </div>
                <div class="form-group">
                    <label data-i18n="form_format">Format</label>
                    <select name="format">
                        <option value="outil" data-i18n="fmt_form_outil" selected>⚙️ Config / Fichier</option>
                        <option value="ebook" data-i18n="fmt_form_ebook">📚 Article / PDF</option>
                        <option value="video" data-i18n="fmt_form_video">🎬 Vidéo / Démo</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label data-i18n="form_link">Lien Média / Photo (URL)</label>
                <input type="text" name="lien_ressource" placeholder="https://images.unsplash.com/...">
            </div>
            <div class="form-group">
                <label data-i18n="form_content">Description / Expression</label>
                <textarea name="contenu" rows="3" required placeholder="Détaillez votre partage..."></textarea>
            </div>
            <button type="submit" class="modal-submit" data-i18n="form_submit">Publier sur le Flux</button>
        </form>

        <div class="sami-social-box">
            <p data-i18n="sami_social_text">📌 N'oubliez pas de vous abonner au Facebook de Sami et de l'ajouter en ami pour voir les vidéos explicatives et les notifications de comment ça marche !</p>
            <div class="sami-social-links">
                <a href="https://facebook.com" target="_blank" class="sami-social-btn"><i data-lucide="facebook"></i> <span data-i18n="sami_fb_btn">Facebook de Sami</span></a>
            </div>
        </div>
    </div>
</div>
<div class="toast" id="toast"></div>
<nav class="mobile-nav">
    <a href="/qg"><i data-lucide="layout-dashboard"></i>QG</a>
    <a href="/marketplace"><i data-lucide="shopping-bag"></i>Store</a>
    <a href="/academie" class="active"><i data-lucide="graduation-cap"></i>Flux</a>
    <a href="/community"><i data-lucide="users"></i>Chat</a>
</nav>
<script>
lucide.createIcons();

const i18n = {
    fr: {
        nav_qg: "QG Central", nav_store: "Marketplace", nav_academy: "Académie & Feed", nav_chat: "Communauté",
        side_desc: "Interface high-tech mobile-first sous marque OG.",
        btn_express: "Exprimez-vous",
        hero_title: "Le Flux <span>OG</span>",
        hero_desc: "Formations, logistique, transports et partages de la communauté sous l'écosystème SAMII OS.",
        modal_title: "Exprimez-vous & Partagez",
        modal_desc: "Publiez vos articles, configurations de transport, photos ou astuces.",
        form_title: "Titre / Sujet", form_cat: "Catégorie", form_format: "Format",
        form_link: "Lien Média / Photo (URL)", form_content: "Description / Expression", form_submit: "Publier sur le Flux",
        sami_social_text: "📌 N'oubliez pas de vous abonner au Facebook de Sami et de l'ajouter en ami pour voir les vidéos explicatives et les notifications de comment ça marche !",
        sami_fb_btn: "Facebook de Sami",
        search_ph: "Rechercher transport, e-commerce, automatisation...",
        badge_live: " LIVE", badge_ai: " SAMII AI",
        empty_state: "Aucune ressource trouvée.",
        fmt_tous: "Tous les formats", fmt_live: "🔴 Lives & Replays", fmt_video: "🎬 Formations Vidéo",
        fmt_ebook: "📚 E-books & Guides PDF", fmt_outil: "⚙️ Fichiers & Configs",
        fmt_form_outil: "⚙️ Config / Fichier", fmt_form_ebook: "📚 Article / PDF", fmt_form_video: "🎬 Vidéo / Démo",
        cat_ecommerce: "E-commerce", cat_automatisation: "Automatisation",
        cat_logistique: "Logistique & Transport", cat_affiliation: "Affiliation",
        toast_liked: "❤️ Ajouté à tes favoris", toast_unliked: "Retiré", toast_demo: "Ressource de démonstration.",
        toast_copied: "🔗 Lien copié !",
    },
    ar: {
        nav_qg: "القيادة المركزية", nav_store: "المتجر الرقمي", nav_academy: "الأكاديمية والتغذية", nav_chat: "المجتمع",
        side_desc: "واجهة عالية التقنية مصممة خصيصاً لهواتف علامة OG.",
        btn_express: "شارك برأيك",
        hero_title: "منصة التدفق <span>OG</span>",
        hero_desc: "دورات تدريبية، لوجستيات، نقل ومشاركات المجتمع تحت نظام SAMII OS.",
        modal_title: "شارك ونشر أفكارك",
        modal_desc: "انشر مقالاتك، إعدادات النقل، الصور أو النصائح المفيدة.",
        form_title: "العنوان / الموضوع", form_cat: "الفئة", form_format: "الصيغة",
        form_link: "رابط الوسائط / الصورة (URL)", form_content: "الوصف / التفاصيل", form_submit: "نشر على المنصة",
        sami_social_text: "📌 لا تنسوا متابعة صفحة سامي على الفيسبوك وإضافته كصديق لمشاهدة الفيديوهات التوضيحية وتنبيهات كيفية العمل!",
        sami_fb_btn: "فيسبوك سامي",
        search_ph: "ابحث عن النقل، التجارة الإلكترونية، الأتمتة...",
        badge_live: " مباشر", badge_ai: " سامي الذكي",
        empty_state: "لا توجد موارد.",
        fmt_tous: "كل الصيغ", fmt_live: "🔴 مباشر وإعادة", fmt_video: "🎬 دورات فيديو",
        fmt_ebook: "📚 كتب وأدلة PDF", fmt_outil: "⚙️ ملفات وإعدادات",
        fmt_form_outil: "⚙️ إعداد / ملف", fmt_form_ebook: "📚 مقال / PDF", fmt_form_video: "🎬 فيديو / عرض",
        cat_ecommerce: "التجارة الإلكترونية", cat_automatisation: "الأتمتة",
        cat_logistique: "اللوجستيات والنقل", cat_affiliation: "التسويق بالعمولة",
        toast_liked: "❤️ أضيف للمفضلة", toast_unliked: "أُزيل", toast_demo: "مورد تجريبي.",
        toast_copied: "🔗 تم نسخ الرابط!",
    },
    en: {
        nav_qg: "Central HQ", nav_store: "Marketplace", nav_academy: "Academy & Feed", nav_chat: "Community",
        side_desc: "High-tech mobile-first interface under the OG brand.",
        btn_express: "Express yourself",
        hero_title: "The OG <span>Feed</span>",
        hero_desc: "Courses, logistics, transport and community shares under the SAMII OS ecosystem.",
        modal_title: "Express & Share",
        modal_desc: "Publish your articles, transport configurations, photos or tips.",
        form_title: "Title / Subject", form_cat: "Category", form_format: "Format",
        form_link: "Media / Photo Link (URL)", form_content: "Description / Expression", form_submit: "Publish to Feed",
        sami_social_text: "📌 Don't forget to subscribe to Sami's Facebook and add him as a friend to see explanatory videos and how-to notifications!",
        sami_fb_btn: "Sami's Facebook",
        search_ph: "Search transport, e-commerce, automation...",
        badge_live: " LIVE", badge_ai: " SAMII AI",
        empty_state: "No resources found.",
        fmt_tous: "All formats", fmt_live: "🔴 Lives & Replays", fmt_video: "🎬 Video Courses",
        fmt_ebook: "📚 E-books & PDF Guides", fmt_outil: "⚙️ Files & Configs",
        fmt_form_outil: "⚙️ Config / File", fmt_form_ebook: "📚 Article / PDF", fmt_form_video: "🎬 Video / Demo",
        cat_ecommerce: "E-commerce", cat_automatisation: "Automation",
        cat_logistique: "Logistics & Transport", cat_affiliation: "Affiliation",
        toast_liked: "❤️ Added to favorites", toast_unliked: "Removed", toast_demo: "Demo resource.",
        toast_copied: "🔗 Link copied!",
    }
};

function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
}

function currentLang() { return localStorage.getItem('og_lang') || 'fr'; }

function setLanguage(lang) {
    localStorage.setItem('og_lang', lang);
    const root = document.getElementById('bodyRoot');
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langBtn === lang);
    });

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key] !== undefined) {
            el.innerHTML = i18n[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (i18n[lang] && i18n[lang][key]) el.setAttribute('placeholder', i18n[lang][key]);
    });

    document.querySelectorAll('option[data-i18n-opt]').forEach(el => {
        const key = el.getAttribute('data-i18n-opt');
        if (i18n[lang] && i18n[lang][key]) el.textContent = i18n[lang][key];
    });
}

const savedLang = currentLang();
setLanguage(savedLang);

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('og_theme', newTheme);
}
const savedTheme = localStorage.getItem('og_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

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
        showToast(result.message || (result.success ? "✅ Publié !" : "❌ Erreur."));
        if (result.success) { setTimeout(() => location.reload(), 900); }
    } catch(err) { showToast("Erreur réseau."); }
}

async function toggleLike(coursId, isReal, btn) {
    const lang = currentLang();
    if (!isReal) { showToast(i18n[lang]?.toast_demo || "Ressource de démonstration."); return; }
    try {
        const res = await fetch('/academie/like/toggle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coursId })
        });
        const data = await res.json();
        if (data.success) {
            btn.classList.toggle('liked', data.liked);
            const span = btn.querySelector('.likes-count');
            let count = parseInt(span.textContent) || 0;
            span.textContent = data.liked ? count + 1 : Math.max(count - 1, 0);
            showToast(data.liked ? (i18n[lang]?.toast_liked || "❤️") : (i18n[lang]?.toast_unliked || "Retiré"));
        }
    } catch (err) { showToast("Erreur réseau."); }
}

async function toggleAcademieFavorite(coursId, isReal, btn) {
    const lang = currentLang();
    if (!isReal) { showToast(i18n[lang]?.toast_demo || "Ressource de démonstration."); return; }
    try {
        const res = await fetch('/academie/favoris/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coursId })
        });
        const data = await res.json();
        if (data.success) {
            btn.classList.toggle('saved', data.saved);
        }
    } catch (err) { showToast("Erreur réseau."); }
}

function shareContent(title) {
    const lang = currentLang();
    if (navigator.share) {
        navigator.share({ title: title, url: window.location.href }).catch(() => {});
    } else {
        navigator.clipboard.writeText(window.location.href);
        showToast(i18n[lang]?.toast_copied || "🔗 Lien copié !");
    }
}
</script>
</body>
</html>`);
});

module.exports = router;
