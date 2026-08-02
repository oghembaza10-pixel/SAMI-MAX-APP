const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    const nom = req.session?.nom || "Mohamed Ouahid Ghembaza";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<title>Community — SAMII OS</title>

<style>

:root {
    --bg: #050505;
    --surface: #0e0e10;
    --surface-glass: rgba(14, 14, 16, 0.82);
    --card: #121216;
    --card-hover: #18181d;
    --border: #22222a;
    --border-light: rgba(255, 255, 255, 0.08);

    --text-main: #f8f9fa;
    --text-muted: #9ba1a6;
    --text-dimmed: #5f666d;

    --gold: #c5a059;
    --gold-light: #dfbe78;
    --gold-gradient: linear-gradient(135deg, #dfbe78 0%, #c5a059 50%, #9c7b38 100%);
    
    --accent-purple: #7357ff;
    --accent-glow: rgba(115, 87, 255, 0.15);

    --radius-sm: 12px;
    --radius-md: 18px;
    --radius-lg: 24px;
    
    --shadow-premium: 0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(197, 160, 89, 0.05);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    background: var(--bg);
    color-scheme: dark;
}

body {
    min-height: 100vh;
    background: 
        radial-gradient(circle at 50% -20%, rgba(115, 87, 255, 0.12), transparent 40%),
        radial-gradient(circle at 100% 80%, rgba(197, 160, 89, 0.06), transparent 30%),
        var(--bg);
    color: var(--text-main);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 80px;
}

button, input, textarea {
    font-family: inherit;
}

button {
    cursor: pointer;
    border: none;
    background: none;
}

/* =========================================================
   TOPBAR (Mobile & Glassmorphism)
========================================================= */

.topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: var(--surface-glass);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 1rem;
    letter-spacing: 0.05em;
}

.logo-icon {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--gold-gradient);
    color: #050505;
    box-shadow: 0 4px 15px rgba(197, 160, 89, 0.25);
    font-size: 1.1rem;
}

.logo span {
    background: var(--gold-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--card);
    color: var(--text-main);
    font-size: 16px;
    transition: all 0.2s ease;
}

.header-btn:active {
    transform: scale(0.95);
    border-color: var(--gold);
}

/* =========================================================
   MOBILE CATEGORY NAV (Instagram/LinkedIn Hybrid Style)
========================================================= */

.mobile-nav {
    position: sticky;
    top: 64px;
    z-index: 90;
    display: flex;
    overflow-x: auto;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(5, 5, 5, 0.9);
    border-bottom: 1px solid var(--border-light);
    scrollbar-width: none;
}

.mobile-nav::-webkit-scrollbar {
    display: none;
}

.mobile-nav button {
    flex-shrink: 0;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 100px;
    background: var(--card);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 500;
    transition: all 0.2s;
}

.mobile-nav button.active {
    background: rgba(197, 160, 89, 0.12);
    border-color: rgba(197, 160, 89, 0.4);
    color: var(--gold-light);
    box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
}

/* =========================================================
   MAIN CONTAINER & GRID LAYOUT
========================================================= */

.community {
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px 12px;
}

/* =========================================================
   WELCOME BANNER (Effekt Waw Premium)
========================================================= */

.welcome {
    position: relative;
    overflow: hidden;
    padding: 24px;
    margin-bottom: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: linear-gradient(145deg, #121217, #0a0a0e);
    box-shadow: var(--shadow-premium);
}

.welcome::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--gold-gradient);
}

.welcome::after {
    content: "";
    position: absolute;
    width: 160px;
    height: 160px;
    right: -50px;
    top: -50px;
    border-radius: 50%;
    background: rgba(197, 160, 89, 0.08);
    filter: blur(25px);
}

.welcome-label {
    position: relative;
    z-index: 1;
    color: var(--gold);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: 8px;
}

.welcome h1 {
    position: relative;
    z-index: 1;
    font-size: 1.35rem;
    line-height: 1.3;
    margin-bottom: 8px;
    font-weight: 700;
}

.welcome p {
    position: relative;
    z-index: 1;
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.6;
}

/* =========================================================
   CREATE POST BOX
========================================================= */

.create {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    margin-bottom: 16px;
    box-shadow: var(--shadow-premium);
}

.create-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.user-avatar {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: linear-gradient(135deg, #252530, #181820);
    border: 1px solid var(--border);
    font-size: 18px;
}

.create-button {
    flex: 1;
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--text-dimmed);
    text-align: left;
    font-size: 0.82rem;
    transition: all 0.2s;
}

.create-button:active {
    background: var(--card-hover);
    border-color: var(--gold);
}

.create-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
}

.create-option {
    padding: 10px 4px;
    border-radius: 10px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.7rem;
    text-align: center;
    font-weight: 500;
    transition: all 0.2s;
}

.create-option:active {
    background: var(--card-hover);
    color: var(--gold-light);
}

/* =========================================================
   FEED & POSTS
========================================================= */

.feed-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    margin-bottom: 8px;
}

.feed-title strong {
    font-size: 0.85rem;
    letter-spacing: 0.02em;
}

.feed-title button {
    color: var(--gold);
    font-size: 0.75rem;
    font-weight: 600;
}

.post {
    overflow: hidden;
    margin-bottom: 14px;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-premium);
}

.post-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.post-user {
    flex: 1;
    min-width: 0;
}

.post-user strong {
    display: block;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.post-user small {
    display: block;
    margin-top: 3px;
    color: var(--text-dimmed);
    font-size: 0.7rem;
}

.post-menu {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    font-size: 18px;
}

.post-content {
    margin-top: 14px;
    color: #e2e8f0;
    font-size: 0.85rem;
    line-height: 1.65;
}

.post-tag {
    display: inline-block;
    margin-top: 14px;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(197, 160, 89, 0.08);
    border: 1px solid rgba(197, 160, 89, 0.2);
    color: var(--gold-light);
    font-size: 0.68rem;
    font-weight: 600;
}

.post-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
}

.post-action {
    padding: 10px 4px;
    border-radius: 10px;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 500;
    transition: all 0.2s;
}

.post-action:active {
    background: var(--card-hover);
    color: var(--gold-light);
}

/* =========================================================
   DISCOVERY SECTION
========================================================= */

.discovery {
    margin-top: 20px;
}

.section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 0 4px;
}

.section-title strong {
    font-size: 0.88rem;
}

.section-title button {
    color: var(--gold);
    font-size: 0.72rem;
}

.discovery-scroll {
    display: flex;
    overflow-x: auto;
    gap: 12px;
    scrollbar-width: none;
    padding-bottom: 4px;
}

.discovery-scroll::-webkit-scrollbar {
    display: none;
}

.discovery-card {
    flex-shrink: 0;
    width: 155px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    text-align: center;
    box-shadow: var(--shadow-premium);
}

.discovery-card .user-avatar {
    width: 44px;
    height: 44px;
    margin: 0 auto 10px auto;
}

.discovery-card strong {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.78rem;
}

.discovery-card small {
    display: block;
    margin-top: 3px;
    color: var(--text-dimmed);
    font-size: 0.68rem;
}

.follow {
    width: 100%;
    margin-top: 12px;
    padding: 8px;
    border: 1px solid rgba(197, 160, 89, 0.35);
    border-radius: 10px;
    background: rgba(197, 160, 89, 0.05);
    color: var(--gold-light);
    font-size: 0.7rem;
    font-weight: 600;
    transition: all 0.2s;
}

.follow:active {
    background: var(--gold);
    color: #000;
}

/* =========================================================
   BOTTOM MOBILE NAV (Effekt App Native)
========================================================= */

.bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 200;
    height: 68px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 6px 8px env(safe-area-inset-bottom);
    background: rgba(10, 10, 14, 0.92);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(25px);
}

.bottom-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    color: var(--text-dimmed);
    font-size: 0.6rem;
    font-weight: 500;
}

.bottom-item span:first-child {
    font-size: 18px;
}

.bottom-item.active {
    color: var(--gold-light);
}

.bottom-publish {
    position: relative;
    margin-top: -22px;
}

.bottom-publish span:first-child {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--gold-gradient);
    color: #050505;
    box-shadow: 0 6px 20px rgba(197, 160, 89, 0.35);
    font-size: 22px;
    font-weight: bold;
}

/* =========================================================
   DESKTOP VIEW & AMAZON-INSPIRED LEFT SIDEBAR
========================================================= */

@media (min-width: 900px) {
    body {
        padding-bottom: 0;
    }

    .topbar {
        padding: 0 40px;
    }

    .community {
        max-width: 1350px;
        display: grid;
        grid-template-columns: 260px minmax(500px, 720px) 300px;
        gap: 24px;
        padding: 30px 20px 60px;
    }

    .bottom-nav, .mobile-nav {
        display: none !important;
    }

    /* Menu Latéral Inspiré Amazon / Pro Navigation */
    .desktop-sidebar {
        position: sticky;
        top: 88px;
        height: fit-content;
    }

    .amazon-sidebar-box {
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--card);
        overflow: hidden;
        box-shadow: var(--shadow-premium);
        margin-bottom: 16px;
    }

    .amazon-sidebar-header {
        padding: 16px;
        background: rgba(255, 255, 255, 0.02);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .amazon-sidebar-header strong {
        font-size: 0.85rem;
        display: block;
    }

    .amazon-sidebar-header small {
        color: var(--gold);
        font-size: 0.7rem;
    }

    .amazon-menu-section {
        padding: 12px;
        border-bottom: 1px solid var(--border);
    }

    .amazon-menu-section:last-child {
        border-bottom: none;
    }

    .amazon-menu-title {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-dimmed);
        padding: 6px 8px;
        font-weight: 700;
    }

    .amazon-menu-section button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        background: transparent;
        color: var(--text-muted);
        text-align: left;
        font-size: 0.8rem;
        font-weight: 500;
        transition: all 0.2s;
    }

    .amazon-menu-section button:hover {
        background: var(--card-hover);
        color: var(--text-main);
    }

    .amazon-menu-section button.active {
        background: rgba(197, 160, 89, 0.1);
        color: var(--gold-light);
        border-left: 3px solid var(--gold);
    }

    .desktop-right {
        position: sticky;
        top: 88px;
        height: fit-content;
    }

    .desktop-panel {
        padding: 18px;
        margin-bottom: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--card);
        box-shadow: var(--shadow-premium);
    }

    .desktop-panel h3 {
        margin-bottom: 14px;
        font-size: 0.85rem;
        letter-spacing: 0.03em;
    }

    .trend {
        padding: 10px 0;
        border-bottom: 1px solid var(--border-light);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .trend:last-child {
        border-bottom: none;
    }

    .trend span {
        color: var(--text-dimmed);
        font-size: 0.68rem;
    }

    .trend strong {
        color: var(--text-main);
        font-size: 0.75rem;
    }

    .mobile-only {
        display: none !important;
    }
}

@media (max-width: 899px) {
    .desktop-only {
        display: none !important;
    }
}

</style>
</head>

<body>

<!-- =====================================================
     HEADER TOPBAR
===================================================== -->
<header class="topbar">
    <div class="logo">
        <div class="logo-icon">🤖</div>
        <div>SAMII <span>OS</span></div>
    </div>
    <div class="header-actions">
        <button class="header-btn" title="Rechercher">🔍</button>
        <button class="header-btn" title="Notifications">🔔</button>
    </div>
</header>

<!-- =====================================================
     MOBILE CATEGORY NAV
===================================================== -->
<nav class="mobile-nav">
    <button class="active">🏠 Accueil</button>
    <button>🔥 Explorer</button>
    <button>📦 Produits</button>
    <button>💼 Offres</button>
    <button>❓ Demandes</button>
</nav>

<div class="community">

    <!-- =================================================
         DESKTOP LEFT SIDEBAR (AMAZON-INSPIRED DEEP NAVIGATION)
    ================================================== -->
    <aside class="desktop-sidebar desktop-only">
        <div class="amazon-sidebar-box">
            <div class="amazon-sidebar-header">
                <div class="user-avatar">👤</div>
                <div>
                    <strong>${nom}</strong>
                    <small>Membre SAMII</small>
                </div>
            </div>

            <div class="amazon-menu-section">
                <div class="amazon-menu-title">Navigation Principale</div>
                <button class="active"><span>🏠</span> Accueil</button>
                <button><span>🔥</span> Explorer les flux</button>
                <button><span>👥</span> Réseau & Communautés</button>
                <button><span>🔖</span> Éléments Enregistrés</button>
            </div>

            <div class="amazon-menu-section">
                <div class="amazon-menu-title">Écosystème & Hub</div>
                <button><span>📦</span> Catalogue Produits</button>
                <button><span>💼</span> Offres & Missions</button>
                <button><span>🤖</span> Automatisation Sami</button>
                <button><span>⚙️</span> Paramètres du Compte</button>
            </div>
        </div>
    </aside>

    <!-- =================================================
         FEED CENTRAL
    ================================================== -->
    <main>
        <!-- WELCOME -->
        <section class="welcome">
            <div class="welcome-label">SAMII COMMUNITY HUB</div>
            <h1>Bienvenue dans l'écosystème 🌐</h1>
            <p>Clients, commerçants et membres de l'élite se rencontrent, partagent et développent leurs activités automatisées ensemble.</p>
        </section>

        <!-- CREATE -->
        <section class="create">
            <div class="create-head">
                <div class="user-avatar">👤</div>
                <button class="create-button">Quoi de neuf ? Partage quelque chose...</button>
            </div>
            <div class="create-options">
                <button class="create-option">📷<br>Photo</button>
                <button class="create-option">📦<br>Produit</button>
                <button class="create-option">💼<br>Offre</button>
                <button class="create-option">❓<br>Demande</button>
            </div>
        </section>

        <!-- FEED TITLE -->
        <div class="feed-title">
            <strong>Fil de la communauté</strong>
            <button>Récent ▾</button>
        </div>

        <!-- POST 1 -->
        <article class="post">
            <div class="post-header">
                <div class="user-avatar">🏪</div>
                <div class="post-user">
                    <strong>Exemple Boutique</strong>
                    <small>Marchand · Algérie · 2 h</small>
                </div>
                <button class="post-menu">⋮</button>
            </div>
            <div class="post-content">
                Bienvenue dans SAMII Community 👋<br><br>
                Ici les commerçants peuvent présenter leurs produits, les clients découvrir de nouvelles offres et toute la communauté peut échanger.
            </div>
            <span class="post-tag">🏪 Commerce</span>
            <div class="post-actions">
                <button class="post-action">❤️ J'aime</button>
                <button class="post-action">💬 Commenter</button>
                <button class="post-action">↗ Partager</button>
            </div>
        </article>

        <!-- POST 2 -->
        <article class="post">
            <div class="post-header">
                <div class="user-avatar">👤</div>
                <div class="post-user">
                    <strong>Membre SAMII</strong>
                    <small>Client · Algérie · 4 h</small>
                </div>
                <button class="post-menu">⋮</button>
            </div>
            <div class="post-content">
                Je cherche un service pour m'aider à développer ma boutique et structurer mes tunnels.<br><br>
                Des recommandations dans la communauté ?
            </div>
            <span class="post-tag">❓ Demande</span>
            <div class="post-actions">
                <button class="post-action">❤️ J'aime</button>
                <button class="post-action">💬 Commenter</button>
                <button class="post-action">↗ Partager</button>
            </div>
        </article>

        <!-- DISCOVERY -->
        <section class="discovery">
            <div class="section-title">
                <strong>👥 À découvrir</strong>
                <button>Voir tout</button>
            </div>
            <div class="discovery-scroll">
                <div class="discovery-card">
                    <div class="user-avatar">🏪</div>
                    <strong>Boutique Exemple</strong>
                    <small>Marchand</small>
                    <button class="follow">Suivre</button>
                </div>
                <div class="discovery-card">
                    <div class="user-avatar">👤</div>
                    <strong>Membre SAMII</strong>
                    <small>Client</small>
                    <button class="follow">Suivre</button>
                </div>
                <div class="discovery-card">
                    <div class="user-avatar">🚚</div>
                    <strong>Transport Express</strong>
                    <small>Service</small>
                    <button class="follow">Suivre</button>
                </div>
            </div>
        </section>

        <!-- TRENDING MOBILE -->
        <section class="trending mobile-only" style="margin-top:20px; padding:16px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--card);">
            <h3 style="margin-bottom:12px; font-size:0.85rem;">🔥 Tendances</h3>
            <div class="trend"><span>Commerce</span><strong>#EcommerceAlgerie</strong></div>
            <div class="trend"><span>SAMII</span><strong>#SAMIIOS</strong></div>
            <div class="trend"><span>Marketplace</span><strong>#NouveauxProduits</strong></div>
        </section>
    </main>

    <!-- =================================================
         DESKTOP RIGHT SIDEBAR
    ================================================== -->
    <aside class="desktop-right desktop-only">
        <section class="desktop-panel">
            <h3>🔥 Tendances du Réseau</h3>
            <div class="trend"><span>Commerce</span><strong>#EcommerceAlgerie</strong></div>
            <div class="trend"><span>SAMII</span><strong>#SAMIIOS</strong></div>
            <div class="trend"><span>Marketplace</span><strong>#NouveauxProduits</strong></div>
        </section>

        <section class="desktop-panel">
            <h3>👥 Membres Actifs</h3>
            <div class="trend" style="padding: 8px 0;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="user-avatar" style="width:32px; height:32px; font-size:14px;">🏪</div>
                    <div><strong style="display:block; font-size:0.75rem;">Boutique Exemple</strong><small style="color:var(--text-dimmed); font-size:0.65rem;">Marchand</small></div>
                </div>
            </div>
            <div class="trend" style="padding: 8px 0;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="user-avatar" style="width:32px; height:32px; font-size:14px;">👤</div>
                    <div><strong style="display:block; font-size:0.75rem;">Membre SAMII</strong><small style="color:var(--text-dimmed); font-size:0.65rem;">Client</small></div>
                </div>
            </div>
        </section>
    </aside>

</div>

<!-- =====================================================
     MOBILE BOTTOM NAVIGATION (App Style)
===================================================== -->
<nav class="bottom-nav">
    <button class="bottom-item active"><span>🏠</span><span>Accueil</span></button>
    <button class="bottom-item"><span>🔎</span><span>Explorer</span></button>
    <button class="bottom-item bottom-publish"><span>＋</span><span>Publier</span></button>
    <button class="bottom-item"><span>🔔</span><span>Alertes</span></button>
    <button class="bottom-item"><span>👤</span><span>Profil</span></button>
</nav>

</body>
</html>`);

});

module.exports = router;
