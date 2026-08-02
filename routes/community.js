const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    const nom = req.session?.nom || "Mohamed Ouahid Ghembaza";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<title>Community — SAMII</title>

<style>

:root {
    --bg: #030712;
    --card: #0b1329;
    --card2: #0f1b3b;
    --line: #1e294b;

    --text: #f8fafc;
    --muted: #94a3b8;

    --gold: #c5a059;
    --gold2: #dfbc73;
    --gold-glow: rgba(197, 160, 89, 0.25);

    --blue-tech: #00f0ff;
    --blue-glow: rgba(0, 240, 255, 0.15);

    --radius: 16px;
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
        radial-gradient(
            circle at 50% -20%,
            rgba(0, 240, 255, 0.12),
            transparent 40%
        ),
        radial-gradient(
            circle at 85% 15%,
            rgba(197, 160, 89, 0.08),
            transparent 35%
        ),
        var(--bg);

    color: var(--text);

    font-family:
        Inter,
        Arial,
        Helvetica,
        sans-serif;

    -webkit-font-smoothing: antialiased;

    padding-bottom: 75px;
}

button,
input,
textarea {
    font-family: inherit;
}

button {
    cursor: pointer;
}

/* =========================================================
   TOP MOBILE
========================================================= */

.topbar {

    position: sticky;
    top: 0;
    z-index: 100;

    height: 62px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 15px;

    background: rgba(3, 7, 18, 0.88);

    border-bottom: 1px solid var(--line);

    backdrop-filter: blur(18px);
}

.logo {
    display: flex;
    align-items: center;
    gap: 9px;

    font-weight: 800;
    font-size: .92rem;
    letter-spacing: .04em;
}

.logo-icon {

    width: 34px;
    height: 34px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 10px;

    background:
        linear-gradient(
            135deg,
            var(--gold2),
            var(--gold)
        );

    box-shadow:
        0 4px 15px var(--gold-glow);
    
    color: #030712;
    font-size: 18px;
}

.logo span {
    color: var(--gold);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 7px;
}

.header-btn {

    width: 36px;
    height: 36px;

    display: flex;
    align-items: center;
    justify-content: center;

    border: 1px solid var(--line);
    border-radius: 10px;

    background: var(--card);
    color: var(--gold);

    font-size: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.header-btn:active {
    border-color: var(--gold);
}

/* =========================================================
   MOBILE NAVIGATION
========================================================= */

.mobile-nav {

    position: sticky;
    top: 62px;
    z-index: 90;

    display: flex;

    overflow-x: auto;

    gap: 6px;

    padding: 9px 13px;

    background: rgba(3, 7, 18, 0.9);

    border-bottom: 1px solid var(--line);

    scrollbar-width: none;
}

.mobile-nav::-webkit-scrollbar {
    display: none;
}

.mobile-nav button {

    flex-shrink: 0;

    padding: 8px 14px;

    border: 1px solid var(--line);
    border-radius: 100px;

    background: var(--card);

    color: var(--muted);

    font-size: .74rem;
    font-weight: 500;
}

.mobile-nav button.active {

    background:
        rgba(197, 160, 89, 0.12);

    border-color:
        rgba(197, 160, 89, 0.4);

    color:
        var(--gold2);
    
    box-shadow: 0 0 12px rgba(197, 160, 89, 0.15);
}

/* =========================================================
   MAIN
========================================================= */

.community {

    width: 100%;

    max-width: 720px;

    margin: 0 auto;

    padding: 13px 12px 30px;
}

/* =========================================================
   WELCOME
========================================================= */

.welcome {

    position: relative;

    overflow: hidden;

    padding: 20px;

    margin-bottom: 12px;

    border:
        1px solid var(--line);

    border-radius: var(--radius);

    background:
        linear-gradient(
            145deg,
            var(--card),
            var(--bg)
        );
    
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.welcome::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: linear-gradient(to bottom, var(--gold2), var(--gold));
}

.welcome::after {

    content: "";

    position: absolute;

    width: 140px;
    height: 140px;

    right: -50px;
    top: -50px;

    border-radius: 50%;

    background:
        rgba(0, 240, 255, 0.1);

    filter: blur(25px);
}

.welcome-label {

    position: relative;
    z-index: 1;

    color: var(--gold);

    font-size: .68rem;

    font-weight: 700;

    text-transform: uppercase;

    letter-spacing: .12em;

    margin-bottom: 7px;
}

.welcome h1 {

    position: relative;
    z-index: 1;

    font-size: 1.28rem;

    line-height: 1.25;

    margin-bottom: 7px;
    color: var(--text);
}

.welcome p {

    position: relative;
    z-index: 1;

    color: var(--muted);

    font-size: .82rem;

    line-height: 1.55;
}

/* =========================================================
   CREATE POST
========================================================= */

.create {

    padding: 14px;

    border:
        1px solid var(--line);

    border-radius: var(--radius);

    background: var(--card);

    margin-bottom: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.create-head {

    display: flex;

    align-items: center;

    gap: 10px;
}

.user-avatar {

    flex-shrink: 0;

    width: 42px;
    height: 42px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 12px;

    background:
        linear-gradient(
            135deg,
            var(--gold2),
            var(--gold)
        );

    font-size: 18px;
    color: #030712;
    box-shadow: 0 4px 12px var(--gold-glow);
}

.create-button {

    flex: 1;

    min-height: 44px;

    padding: 0 15px;

    border:
        1px solid var(--line);

    border-radius: 12px;

    background: var(--bg);

    color: var(--muted);

    text-align: left;

    font-size: .78rem;
    transition: all 0.2s ease;
}

.create-button:active {

    border-color: var(--gold);
    color: var(--text);
}

.create-options {

    display: grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap: 6px;

    margin-top: 11px;
}

.create-option {

    padding: 10px 4px;

    border: 1px solid transparent;

    border-radius: 10px;

    background: var(--bg);

    color: var(--muted);

    font-size: .66rem;

    text-align: center;
    transition: all 0.2s ease;
}

.create-option:active {

    background: var(--card2);
    border-color: var(--line);

    color: var(--gold2);
}

/* =========================================================
   FEED
========================================================= */

.feed-title {

    display: flex;

    align-items: center;
    justify-content: space-between;

    padding: 7px 3px;

    margin-bottom: 5px;
}

.feed-title strong {

    font-size: .78rem;
    color: var(--text);
}

.feed-title button {

    border: 0;

    background: transparent;

    color: var(--gold);

    font-size: .7rem;
    font-weight: 600;
}

/* =========================================================
   POST
========================================================= */

.post {

    overflow: hidden;

    margin-bottom: 12px;

    padding: 16px;

    border:
        1px solid var(--line);

    border-radius: var(--radius);

    background:
        linear-gradient(
            145deg,
            var(--card),
            var(--bg)
        );
    
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

.post-header {

    display: flex;

    align-items: center;

    gap: 10px;
}

.post-user {

    flex: 1;

    min-width: 0;
}

.post-user strong {

    display: block;

    font-size: .81rem;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;
    color: var(--text);
}

.post-user small {

    display: block;

    margin-top: 3px;

    color: var(--muted);

    font-size: .66rem;
}

.post-menu {

    width: 30px;
    height: 30px;

    border: 0;

    border-radius: 8px;

    background: transparent;

    color: var(--muted);

    font-size: 18px;
}

.post-content {

    margin-top: 14px;

    color: #e2e8f0;

    font-size: .82rem;

    line-height: 1.65;
}

.post-tag {

    display: inline-block;

    margin-top: 12px;

    padding: 5px 10px;

    border-radius: 8px;

    background:
        rgba(197, 160, 89, 0.1);

    border:
        1px solid rgba(197, 160, 89, 0.25);

    color: var(--gold2);

    font-size: .63rem;
    font-weight: 600;
}

/* =========================================================
   POST ACTIONS
========================================================= */

.post-actions {

    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 6px;

    margin-top: 14px;

    padding-top: 10px;

    border-top:
        1px solid var(--line);
}

.post-action {

    padding: 9px 3px;

    border: 1px solid transparent;

    border-radius: 9px;

    background: var(--bg);

    color: var(--muted);

    font-size: .68rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.post-action:active {

    background: var(--card2);
    border-color: var(--line);

    color: var(--gold2);
}

/* =========================================================
   DISCOVERY SECTION
========================================================= */

.discovery {

    margin-top: 18px;
}

.section-title {

    display: flex;

    align-items: center;
    justify-content: space-between;

    margin-bottom: 9px;

    padding: 0 3px;
}

.section-title strong {

    font-size: .82rem;
    color: var(--text);
}

.section-title button {

    border: 0;

    background: transparent;

    color: var(--gold);

    font-size: .68rem;
    font-weight: 600;
}

.discovery-scroll {

    display: flex;

    overflow-x: auto;

    gap: 10px;

    scrollbar-width: none;
}

.discovery-scroll::-webkit-scrollbar {
    display: none;
}

.discovery-card {

    flex-shrink: 0;

    width: 150px;

    padding: 14px;

    border:
        1px solid var(--line);

    border-radius: 16px;

    background: var(--card);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.discovery-card .user-avatar {

    width: 38px;
    height: 38px;

    margin-bottom: 10px;
}

.discovery-card strong {

    display: block;

    overflow: hidden;

    white-space: nowrap;

    text-overflow: ellipsis;

    font-size: .74rem;
    color: var(--text);
}

.discovery-card small {

    display: block;

    margin-top: 4px;

    color: var(--muted);

    font-size: .63rem;
}

.follow {

    width: 100%;

    margin-top: 11px;

    padding: 7px;

    border:
        1px solid rgba(197, 160, 89, 0.35);

    border-radius: 9px;

    background: rgba(197, 160, 89, 0.05);

    color: var(--gold);

    font-size: .65rem;
    font-weight: 600;
    transition: all 0.2s ease;
}

.follow:active {
    background: var(--gold);
    color: #030712;
}

/* =========================================================
   TRENDING
========================================================= */

.trending {

    margin-top: 18px;

    padding: 16px;

    border:
        1px solid var(--line);

    border-radius: var(--radius);

    background: var(--card);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.trending h3 {

    margin-bottom: 10px;

    font-size: .8rem;
    color: var(--text);
}

.trend {

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding: 10px 0;

    border-bottom:
        1px solid var(--line);
}

.trend:last-child {
    border-bottom: 0;
}

.trend span {

    color: var(--muted);

    font-size: .64rem;
}

.trend strong {

    color: var(--gold2);

    font-size: .71rem;
}

/* =========================================================
   BOTTOM MOBILE NAV
========================================================= */

.bottom-nav {

    position: fixed;

    left: 0;
    right: 0;
    bottom: 0;

    z-index: 200;

    height: 65px;

    display: grid;

    grid-template-columns:
        repeat(5, 1fr);

    padding:
        7px 8px
        env(safe-area-inset-bottom);

    background:
        rgba(3, 7, 18, 0.94);

    border-top:
        1px solid var(--line);

    backdrop-filter: blur(20px);
}

.bottom-item {

    display: flex;

    flex-direction: column;

    align-items: center;
    justify-content: center;

    gap: 3px;

    border: 0;

    background: transparent;

    color: var(--muted);

    font-size: .58rem;
}

.bottom-item span:first-child {

    font-size: 18px;
}

.bottom-item.active {

    color: var(--gold2);
}

.bottom-publish {

    position: relative;

    margin-top: -22px;
}

.bottom-publish span:first-child {

    width: 44px;
    height: 44px;

    display: flex;

    align-items: center;

    justify-content: center;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            var(--gold2),
            var(--gold)
        );

    color: #030712;

    box-shadow:
        0 6px 20px var(--gold-glow);

    font-size: 22px;
    font-weight: bold;
}

/* =========================================================
   DESKTOP (LinkedIn Inspired 3-Column Layout)
========================================================= */

@media (min-width: 800px) {

    body {
        padding-bottom: 0;
    }

    .topbar {

        padding:
            0 30px;
    }

    .community {

        max-width: 1200px;

        display: grid;

        grid-template-columns:
            225px
            minmax(420px, 640px)
            270px;

        gap: 24px;

        padding:
            25px 20px 60px;
    }

    .desktop-sidebar {

        display: block;
        position: sticky;

        top: 88px;

        height: fit-content;
    }

    .desktop-profile {

        padding: 18px;

        margin-bottom: 12px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: var(--card);
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        text-align: center;
    }

    .desktop-profile .user-avatar {
        width: 54px;
        height: 54px;
        margin: 0 auto 10px auto;
        font-size: 24px;
    }

    .desktop-profile strong {

        display: block;

        margin-top: 6px;

        font-size: .85rem;
        color: var(--text);
    }

    .desktop-profile small {

        display: block;

        margin-top: 3px;

        color: var(--gold);

        font-size: .68rem;
        font-weight: 500;
    }

    .desktop-menu {

        padding: 10px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: var(--card);
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }

    .desktop-menu button {

        width: 100%;

        display: flex;

        align-items: center;

        gap: 12px;

        padding: 11px 12px;

        border: 1px solid transparent;

        border-radius: 10px;

        background: transparent;

        color: var(--muted);

        text-align: left;

        font-size: .76rem;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .desktop-menu button:hover {
        background: var(--bg);
        color: var(--text);
    }

    .desktop-menu button.active {

        background:
            rgba(197, 160, 89, 0.1);

        border-color: rgba(197, 160, 89, 0.3);

        color: var(--gold2);
    }

    .bottom-nav {

        display: none;
    }

    .mobile-nav {

        display: none;
    }

    .desktop-right {

        position: sticky;

        top: 88px;

        height: fit-content;
        display: block;
    }

    .desktop-panel {

        padding: 16px;

        margin-bottom: 12px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: var(--card);
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }

    .desktop-panel h3 {

        margin-bottom: 12px;

        font-size: .8rem;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .member {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
    }

    .member:last-child {
        border-bottom: 0;
    }

    .member .user-avatar {
        width: 34px;
        height: 34px;
        font-size: 15px;
        margin-bottom: 0;
    }

    .mobile-only {

        display: none !important;
    }
}

/* =========================================================
   MOBILE ONLY
========================================================= */

@media (max-width: 799px) {

    .desktop-only {
        display: none !important;
    }
}

/* =========================================================
   LARGE DESKTOP
========================================================= */

@media (min-width: 1200px) {

    .community {

        max-width: 1280px;

        grid-template-columns:
            240px
            minmax(500px, 680px)
            290px;
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
            ⚡
        </div>

        <div>
            SAMII <span>COMMUNITY</span>
        </div>

    </div>

    <div class="header-actions">

        <button class="header-btn">
            🔍
        </button>

        <button class="header-btn">
            🔔
        </button>

    </div>

</header>


<!-- =====================================================
     MOBILE CATEGORY NAV
===================================================== -->

<nav class="mobile-nav">

    <button class="active">
        🏠 Accueil
    </button>

    <button>
        🔥 Explorer
    </button>

    <button>
        📦 Produits
    </button>

    <button>
        💼 Offres
    </button>

    <button>
        ❓ Demandes
    </button>

</nav>


<div class="community">


    <!-- =================================================
         DESKTOP LEFT
    ================================================== -->

    <aside class="desktop-sidebar desktop-only">

        <div class="desktop-profile">

            <div class="user-avatar">
                👑
            </div>

            <strong>
                ${nom}
            </strong>

            <small>
                The Sovereign OS & Automation
            </small>

        </div>

        <div class="desktop-menu">

            <button class="active">
                🏠 Accueil
            </button>

            <button>
                🔥 Explorer
            </button>

            <button>
                👥 Communautés
            </button>

            <button>
                🔖 Enregistrés
            </button>

            <button>
                👤 Mon profil
            </button>

        </div>

    </aside>


    <!-- =================================================
         FEED
    ================================================== -->

    <main>


        <!-- WELCOME -->

        <section class="welcome">

            <div class="welcome-label">
                SAMII ECOSYSTEM
            </div>

            <h1>
                Bienvenue dans la communauté 🌐
            </h1>

            <p>
                Propulsez vos activités e-commerce, automatisez vos workflows et connectez-vous avec l'élite des entrepreneurs.
            </p>

        </section>


        <!-- CREATE -->

        <section class="create">

            <div class="create-head">

                <div class="user-avatar">
                    👑
                </div>

                <button class="create-button">
                    Quoi de neuf ? Partage quelque chose...
                </button>

            </div>

            <div class="create-options">

                <button class="create-option">
                    📷<br>
                    Photo
                </button>

                <button class="create-option">
                    📦<br>
                    Produit
                </button>

                <button class="create-option">
                    💼<br>
                    Offre
                </button>

                <button class="create-option">
                    ❓<br>
                    Demande
                </button>

            </div>

        </section>


        <!-- FEED TITLE -->

        <div class="feed-title">

            <strong>
                Fil de la communauté
            </strong>

            <button>
                Récent ▾
            </button>

        </div>


        <!-- =================================================
             POST
    ================================================== -->

        <article class="post">

            <div class="post-header">

                <div class="user-avatar">
                    ⚡
                </div>

                <div class="post-user">

                    <strong>
                        SAMII Core
                    </strong>

                    <small>
                        Système · Automatisation · 1 h
                    </small>

                </div>

                <button class="post-menu">
                    ⋮
                </button>

            </div>


            <div class="post-content">
                Architecture des flux initialisée avec succès. Connexion aux tables opérationnelles et synchronisation multi-agents active. 🚀
            </div>


            <span class="post-tag">
                🤖 #SAMIIOS
            </span>


            <div class="post-actions">

                <button class="post-action">
                    ❤️ J'aime
                </button>

                <button class="post-action">
                    💬 Commenter
                </button>

                <button class="post-action">
                    ↗ Partager
                </button>

            </div>

        </article>


        <!-- =================================================
             POST 2
    ================================================== -->

        <article class="post">

            <div class="post-header">

                <div class="user-avatar">
                    💼
                </div>

                <div class="post-user">

                    <strong>
                        The Sovereign
                    </strong>

                    <small>
                        E-commerce & Luxe · International · 3 h
                    </small>

                </div>

                <button class="post-menu">
                    ⋮
                </button>

            </div>


            <div class="post-content">
                Transition de l'interface numérique vers le format universel anglophone en cours. Esthétique minimaliste noire et or déployée.
            </div>


            <span class="post-tag">
                ✨ #TheSovereign
            </span>


            <div class="post-actions">

                <button class="post-action">
                    ❤️ J'aime
                </button>

                <button class="post-action">
                    💬 Commenter
                </button>

                <button class="post-action">
                    ↗ Partager
                </button>

            </div>

        </article>


        <!-- =================================================
             DISCOVERY
    ================================================== -->

        <section class="discovery">

            <div class="section-title">

                <strong>
                    👥 À découvrir
                </strong>

                <button>
                    Voir tout
                </button>

            </div>


            <div class="discovery-scroll">


                <div class="discovery-card">

                    <div class="user-avatar">
                        ⚡
                    </div>

                    <strong>
                        Module Sami
                    </strong>

                    <small>
                        Automatisation
                    </small>

                    <button class="follow">
                        Suivre
                    </button>

                </div>


                <div class="discovery-card">

                    <div class="user-avatar">
                        ✨
                    </div>

                    <strong>
                        Vaulta Store
                    </strong>

                    <small>
                        E-commerce
                    </small>

                    <button class="follow">
                        Suivre
                    </button>

                </div>


                <div class="discovery-card">

                    <div class="user-avatar">
                        🛡️
                    </div>

                    <strong>
                        L'Arsenal
                    </strong>

                    <small>
                        Modules OS
                    </small>

                    <button class="follow">
                        Suivre
                    </button>

                </div>


            </div>

        </section>


        <!-- =================================================
             TRENDING MOBILE
    ================================================== -->

        <section class="trending mobile-only">

            <h3>
                🔥 Tendances
            </h3>

            <div class="trend">

                <span>
                    Automatisation
                </span>

                <strong>
                    #SAMIIOS
                </strong>

            </div>

            <div class="trend">

                <span>
                    E-commerce
                </span>

                <strong>
                    #TheSovereign
                </strong>

            </div>

            <div class="trend">

                <span>
                    Workflow
                </span>

                <strong>
                    #n8nAutomation
                </strong>

            </div>

        </section>

    </main>


    <!-- =================================================
         DESKTOP RIGHT
    ================================================== -->

    <aside class="desktop-right desktop-only">

        <section class="desktop-panel">

            <h3>
                🔥 Tendances
            </h3>

            <div class="trend">

                <span>
                    Automatisation
                </span>

                <strong>
                    #SAMIIOS
                </strong>

            </div>

            <div class="trend">

                <span>
                    E-commerce
                </span>

                <strong>
                    #TheSovereign
                </strong>

            </div>

            <div class="trend">

                <span>
                    Workflow
                </span>

                <strong>
                    #n8nAutomation
                </strong>

            </div>

        </section>


        <section class="desktop-panel">

            <h3>
                👥 Membres actifs
            </h3>

            <div class="member">

                <div class="user-avatar">
                    ⚡
                </div>

                <div class="post-user">

                    <strong>
                        Sami Core
                    </strong>

                    <small>
                        Assistant IA
                    </small>

                </div>

            </div>


            <div class="member">

                <div class="user-avatar">
                    👑
                </div>

                <div class="post-user">

                    <strong>
                        ${nom}
                    </strong>

                    <small>
                        Fondateur
                    </small>

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

        <span>
            Accueil
        </span>

    </button>


    <button class="bottom-item">

        <span>🔎</span>

        <span>
            Explorer
        </span>

    </button>


    <button class="bottom-item bottom-publish">

        <span>
            ＋
        </span>

        <span>
            Publier
        </span>

    </button>


    <button class="bottom-item">

        <span>🔔</span>

        <span>
            Alertes
        </span>

    </button>


    <button class="bottom-item">

        <span>👤</span>

        <span>
            Profil
        </span>

    </button>

</nav>


</body>
</html>`);

});

module.exports = router;
