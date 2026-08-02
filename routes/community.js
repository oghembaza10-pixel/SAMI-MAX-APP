const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    const nom = req.session?.nom || "Membre SAMII";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<title>Community — SAMII LUXURY</title>

<style>

:root {
    --bg: #050505;
    --card: #0d0d0d;
    --card-hover: #121212;
    --line: #1f1f1f;
    --line-gold: rgba(197, 160, 89, 0.25);

    --text: #f3f3f3;
    --muted: #888888;

    --gold: #c5a059;
    --gold-light: #e0bd72;
    --gold-grad: linear-gradient(135deg, #f3d085 0%, #c5a059 100%);
    
    --purple-glow: rgba(115, 87, 255, 0.08);

    --radius: 20px;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    background: var(--bg);
}

body {
    min-height: 100vh;
    background: 
        radial-gradient(circle at 50% -20%, rgba(197, 160, 89, 0.06), transparent 40%),
        radial-gradient(circle at 100% 80%, rgba(115, 87, 255, 0.05), transparent 50%),
        var(--bg);
    color: var(--text);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 80px;
}

button, input, textarea {
    font-family: inherit;
}

button {
    cursor: pointer;
    transition: all 0.2s ease;
}

/* =========================================================
   TOPBAR LUX
========================================================= */

.topbar {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    background: rgba(5, 5, 5, 0.85);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}

.logo {
    display: flex;
    align-items: center;
    gap: 11px;
    font-weight: 800;
    font-size: .95rem;
    letter-spacing: .08em;
    text-transform: uppercase;
}

.logo-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: linear-gradient(145deg, #181818, #0a0a0a);
    border: 1px solid var(--line-gold);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.logo span {
    background: var(--gold-grad);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 9px;
}

.header-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #0a0a0a;
    color: #ccc;
    font-size: 15px;
}

.header-btn:active {
    border-color: var(--gold);
    color: var(--gold-light);
}

/* =========================================================
   MOBILE NAVIGATION
========================================================= */

.mobile-nav {
    position: sticky;
    top: 66px;
    z-index: 90;
    display: flex;
    overflow-x: auto;
    gap: 8px;
    padding: 11px 16px;
    background: rgba(5, 5, 5, 0.9);
    border-bottom: 1px solid var(--line);
    scrollbar-width: none;
}

.mobile-nav::-webkit-scrollbar {
    display: none;
}

.mobile-nav button {
    flex-shrink: 0;
    padding: 8px 16px;
    border: 1px solid var(--line);
    border-radius: 100px;
    background: var(--card);
    color: var(--muted);
    font-size: .75rem;
    font-weight: 500;
}

.mobile-nav button.active {
    background: rgba(197, 160, 89, 0.08);
    border-color: var(--gold);
    color: var(--gold-light);
    box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
}

/* =========================================================
   MAIN CONTAINER
========================================================= */

.community {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 14px 40px;
}

/* =========================================================
   WELCOME BANNER LUX
========================================================= */

.welcome {
    position: relative;
    overflow: hidden;
    padding: 24px;
    margin-bottom: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: linear-gradient(145deg, #0f0f0f, #080808);
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}

.welcome::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--gold-grad);
}

.welcome-label {
    position: relative;
    z-index: 1;
    color: var(--gold);
    font-size: .68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .15em;
    margin-bottom: 8px;
}

.welcome h1 {
    position: relative;
    z-index: 1;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
}

.welcome p {
    position: relative;
    z-index: 1;
    color: var(--muted);
    font-size: .84rem;
    line-height: 1.6;
}

/* =========================================================
   CREATE POST BOX
========================================================= */

.create {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
    margin-bottom: 16px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
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
    background: linear-gradient(145deg, #161616, #0a0a0a);
    border: 1px solid var(--line);
    font-size: 16px;
}

.create-button {
    flex: 1;
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #090909;
    color: #666;
    text-align: left;
    font-size: .8rem;
}

.create-button:active {
    background: #141414;
    border-color: #333;
}

.create-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 12px;
}

.create-option {
    padding: 10px 4px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: #090909;
    color: var(--muted);
    font-size: .68rem;
    text-align: center;
    font-weight: 500;
}

.create-option:active {
    background: #151515;
    border-color: var(--line);
    color: white;
}

/* =========================================================
   FEED TITLE
========================================================= */

.feed-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    margin-bottom: 8px;
}

.feed-title strong {
    font-size: .82rem;
    letter-spacing: .03em;
    text-transform: uppercase;
    color: #aaa;
}

.feed-title button {
    border: 0;
    background: transparent;
    color: var(--gold);
    font-size: .72rem;
    font-weight: 600;
}

/* =========================================================
   POST CARD LUX
========================================================= */

.post {
    overflow: hidden;
    margin-bottom: 14px;
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: linear-gradient(145deg, #0e0e0e, #080808);
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
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
    font-size: .84rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.post-user small {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: .68rem;
}

.post-menu {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: #666;
    font-size: 18px;
}

.post-content {
    margin-top: 14px;
    color: #d8d8d8;
    font-size: .85rem;
    line-height: 1.7;
}

.post-tag {
    display: inline-block;
    margin-top: 14px;
    padding: 5px 10px;
    border-radius: 8px;
    background: rgba(197, 160, 89, 0.06);
    border: 1px solid rgba(197, 160, 89, 0.2);
    color: var(--gold-light);
    font-size: .66rem;
    font-weight: 500;
}

/* =========================================================
   POST ACTIONS
========================================================= */

.post-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
}

.post-action {
    padding: 10px 4px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: #090909;
    color: #777;
    font-size: .7rem;
    font-weight: 500;
}

.post-action:active {
    background: #161616;
    border-color: var(--line);
    color: white;
}

/* =========================================================
   DISCOVERY SECTION
========================================================= */

.discovery {
    margin-top: 22px;
}

.section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 0 4px;
}

.section-title strong {
    font-size: .85rem;
    text-transform: uppercase;
    letter-spacing: .03em;
    color: #aaa;
}

.section-title button {
    border: 0;
    background: transparent;
    color: var(--gold);
    font-size: .7rem;
    font-weight: 600;
}

.discovery-scroll {
    display: flex;
    overflow-x: auto;
    gap: 12px;
    scrollbar-width: none;
    padding-bottom: 5px;
}

.discovery-scroll::-webkit-scrollbar {
    display: none;
}

.discovery-card {
    flex-shrink: 0;
    width: 155px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--card);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

.discovery-card .user-avatar {
    width: 40px;
    height: 40px;
    margin-bottom: 12px;
}

.discovery-card strong {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: .78rem;
}

.discovery-card small {
    display: block;
    margin-top: 4px;
    color: var(--muted);
    font-size: .66rem;
}

.follow {
    width: 100%;
    margin-top: 12px;
    padding: 8px;
    border: 1px solid var(--line-gold);
    border-radius: 10px;
    background: rgba(197, 160, 89, 0.04);
    color: var(--gold-light);
    font-size: .68rem;
    font-weight: 600;
}

.follow:active {
    background: rgba(197, 160, 89, 0.15);
}

/* =========================================================
   TRENDING BOX
========================================================= */

.trending {
    margin-top: 22px;
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

.trending h3 {
    margin-bottom: 12px;
    font-size: .84rem;
    text-transform: uppercase;
    letter-spacing: .03em;
    color: #aaa;
}

.trend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
}

.trend:last-child {
    border-bottom: 0;
}

.trend span {
    color: var(--muted);
    font-size: .68rem;
}

.trend strong {
    color: #ddd;
    font-size: .74rem;
}

/* =========================================================
   BOTTOM MOBILE NAV LUX
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
    padding: 6px 10px env(safe-area-inset-bottom);
    background: rgba(5, 5, 5, 0.92);
    border-top: 1px solid var(--line);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
}

.bottom-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 0;
    background: transparent;
    color: #666;
    font-size: .6rem;
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
    width: 46px;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--gold-grad);
    color: #050505;
    box-shadow: 0 6px 20px rgba(197, 160, 89, 0.35);
    font-size: 22px;
    font-weight: bold;
}

/* =========================================================
   DESKTOP VERSION (GRID SYSTEM)
========================================================= */

@media (min-width: 800px) {

    body {
        padding-bottom: 0;
    }

    .topbar {
        padding: 0 40px;
    }

    .community {
        max-width: 1240px;
        display: grid;
        grid-template-columns: 230px minmax(440px, 660px) 280px;
        gap: 24px;
        padding: 30px 20px 60px;
    }

    .desktop-sidebar {
        display: block;
        position: sticky;
        top: 90px;
        height: fit-content;
    }

    .desktop-menu {
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--card);
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }

    .desktop-menu button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: #777;
        text-align: left;
        font-size: .78rem;
        font-weight: 500;
    }

    .desktop-menu button:hover {
        background: #111;
        color: #ddd;
    }

    .desktop-menu button.active {
        background: rgba(197, 160, 89, 0.08);
        color: var(--gold-light);
        border: 1px solid var(--line-gold);
    }

    .desktop-profile {
        padding: 18px;
        margin-bottom: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--card);
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }

    .desktop-profile strong {
        display: block;
        margin-top: 10px;
        font-size: .82rem;
    }

    .desktop-profile small {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: .68rem;
    }

    .desktop-right {
        position: sticky;
        top: 90px;
        height: fit-content;
        display: block;
    }

    .desktop-panel {
        padding: 18px;
        margin-bottom: 14px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--card);
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }

    .desktop-panel h3 {
        margin-bottom: 12px;
        font-size: .82rem;
        text-transform: uppercase;
        letter-spacing: .03em;
        color: #aaa;
    }

    .bottom-nav, .mobile-nav {
        display: none !important;
    }

    .mobile-only {
        display: none !important;
    }
}

@media (max-width: 799px) {
    .desktop-only {
        display: none !important;
    }
}

@media (min-width: 1200px) {
    .community {
        max-width: 1320px;
        grid-template-columns: 250px minmax(520px, 720px) 300px;
    }
}

</style>
</head>

<body>

<!-- =====================================================
      HEADER
===================================================== -->

<header class="topbar">
    <div class="logo">
        <div class="logo-icon">
            🤖
        </div>
        <div>
            SAMII <span>COMMUNITY</span>
        </div>
    </div>

    <div class="header-actions">
        <button class="header-btn">🔍</button>
        <button class="header-btn">🔔</button>
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

    <!-- DESKTOP LEFT -->
    <aside class="desktop-sidebar desktop-only">
        <div class="desktop-profile">
            <div class="user-avatar">👤</div>
            <strong>${nom}</strong>
            <small>Membre SAMII</small>
        </div>

        <div class="desktop-menu">
            <button class="active">🏠 Accueil</button>
            <button>🔥 Explorer</button>
            <button>👥 Communautés</button>
            <button>🔖 Enregistrés</button>
            <button>👤 Mon profil</button>
        </div>
    </aside>

    <!-- FEED -->
    <main>

        <!-- WELCOME -->
        <section class="welcome">
            <div class="welcome-label">SAMII COMMUNITY LUX</div>
            <h1>Bienvenue dans l'espace exclusif 🌐</h1>
            <p>Clients, commerçants d'élite et membres du réseau se rencontrent, partagent et propulsent leurs activités au sommet.</p>
        </section>

        <!-- CREATE -->
        <section class="create">
            <div class="create-head">
                <div class="user-avatar">👤</div>
                <button class="create-button">Quoi de neuf dans l'écosystème ?...</button>
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
                    <strong>Boutique Officielle</strong>
                    <small>Marchand · Algérie · 2 h</small>
                </div>
                <button class="post-menu">⋮</button>
            </div>

            <div class="post-content">
                Bienvenue dans SAMII Community 👋<br><br>
                Le point de rencontre ultime pour structurer, automatiser et scaler vos boutiques en ligne avec une précision chirurgicale.
            </div>

            <span class="post-tag">🏪 Commerce & Luxe</span>

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
                Je cherche des retours d'expérience sur l'automatisation des tunnels avec nos intégrations. Des avis dans la communauté ?
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
                    <strong>Membre VIP</strong>
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
        <section class="trending mobile-only">
            <h3>🔥 Tendances</h3>
            <div class="trend">
                <span>Commerce</span>
                <strong>#EcommerceAlgerie</strong>
            </div>
            <div class="trend">
                <span>SAMII</span>
                <strong>#SAMIIOS</strong>
            </div>
            <div class="trend">
                <span>Marketplace</span>
                <strong>#NouveauxProduits</strong>
            </div>
        </section>

    </main>

    <!-- DESKTOP RIGHT -->
    <aside class="desktop-right desktop-only">
        <section class="desktop-panel">
            <h3>🔥 Tendances</h3>
            <div class="trend">
                <span>Commerce</span>
                <strong>#EcommerceAlgerie</strong>
            </div>
            <div class="trend">
                <span>SAMII</span>
                <strong>#SAMIIOS</strong>
            </div>
            <div class="trend">
                <span>Marketplace</span>
                <strong>#NouveauxProduits</strong>
            </div>
        </section>

        <section class="desktop-panel">
            <h3>👥 Membres Actifs</h3>
            <div class="trend" style="border-bottom: 1px solid var(--line); padding: 8px 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar" style="width: 32px; height: 32px; font-size: 13px; margin:0;">🏪</div>
                    <div>
                        <strong style="font-size: 0.74rem; display:block;">Boutique Exemple</strong>
                        <small style="color:var(--muted); font-size: 0.62rem;">Marchand</small>
                    </div>
                </div>
            </div>
            <div class="trend" style="border-bottom: 0; padding: 8px 0 0 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-avatar" style="width: 32px; height: 32px; font-size: 13px; margin:0;">👤</div>
                    <div>
                        <strong style="font-size: 0.74rem; display:block;">Membre SAMII</strong>
                        <small style="color:var(--muted); font-size: 0.62rem;">Client</small>
                    </div>
                </div>
            </div>
        </section>
    </aside>

</div>


<!-- =====================================================
      MOBILE BOTTOM NAV
===================================================== -->

<nav class="bottom-nav">
    <button class="bottom-item active">
        <span>🏠</span>
        <span>Accueil</span>
    </button>
    <button class="bottom-item">
        <span>🔎</span>
        <span>Explorer</span>
    </button>
    <button class="bottom-item bottom-publish">
        <span>＋</span>
        <span>Publier</span>
    </button>
    <button class="bottom-item">
        <span>🔔</span>
        <span>Alertes</span>
    </button>
    <button class="bottom-item">
        <span>👤</span>
        <span>Profil</span>
    </button>
</nav>

</body>
</html>`);

});

module.exports = router;
