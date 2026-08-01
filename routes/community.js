const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    const nom = req.session?.nom || "Membre SAMII";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<title>Community — SAMII</title>

<style>

:root {
    --bg: #070707;
    --card: #101010;
    --card2: #151515;
    --line: #242424;

    --text: #f5f5f5;
    --muted: #8b8b8b;

    --gold: #c5a059;
    --gold2: #e0bd72;

    --purple: #7357ff;

    --radius: 18px;
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
            circle at 50% -15%,
            rgba(115,87,255,.13),
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

    background: rgba(7,7,7,.92);

    border-bottom: 1px solid rgba(255,255,255,.06);

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

    border-radius: 11px;

    background:
        linear-gradient(
            145deg,
            #836cff,
            #5138d0
        );

    box-shadow:
        0 5px 20px rgba(115,87,255,.25);
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
    border-radius: 11px;

    background: #111;
    color: #ddd;

    font-size: 16px;
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

    background: rgba(7,7,7,.94);

    border-bottom: 1px solid rgba(255,255,255,.045);

    scrollbar-width: none;
}

.mobile-nav::-webkit-scrollbar {
    display: none;
}

.mobile-nav button {

    flex-shrink: 0;

    padding: 8px 13px;

    border: 1px solid #242424;
    border-radius: 100px;

    background: #101010;

    color: #858585;

    font-size: .74rem;
}

.mobile-nav button.active {

    background:
        rgba(197,160,89,.10);

    border-color:
        rgba(197,160,89,.35);

    color:
        var(--gold2);
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
            #141414,
            #0e0e0e
        );
}

.welcome::after {

    content: "";

    position: absolute;

    width: 140px;
    height: 140px;

    right: -65px;
    top: -65px;

    border-radius: 50%;

    background:
        rgba(115,87,255,.13);

    filter: blur(15px);
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
}

.create-head {

    display: flex;

    align-items: center;

    gap: 10px;
}

.user-avatar {

    flex-shrink: 0;

    width: 40px;
    height: 40px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 13px;

    background:
        linear-gradient(
            145deg,
            #765cff,
            #4d36c4
        );

    font-size: 16px;
}

.create-button {

    flex: 1;

    min-height: 42px;

    padding: 0 15px;

    border:
        1px solid #292929;

    border-radius: 13px;

    background: #151515;

    color: #777;

    text-align: left;

    font-size: .78rem;
}

.create-button:active {

    background: #1b1b1b;

    border-color: #3b3b3b;
}

.create-options {

    display: grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap: 5px;

    margin-top: 11px;
}

.create-option {

    padding: 9px 3px;

    border: 0;

    border-radius: 9px;

    background: transparent;

    color: #858585;

    font-size: .66rem;

    text-align: center;
}

.create-option:active {

    background: #1b1b1b;

    color: white;
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
}

.feed-title button {

    border: 0;

    background: transparent;

    color: var(--gold);

    font-size: .7rem;
}

/* =========================================================
   POST
========================================================= */

.post {

    overflow: hidden;

    margin-bottom: 10px;

    padding: 16px;

    border:
        1px solid var(--line);

    border-radius: var(--radius);

    background:
        linear-gradient(
            145deg,
            #111,
            #0e0e0e
        );
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
}

.post-user small {

    display: block;

    margin-top: 3px;

    color: #686868;

    font-size: .66rem;
}

.post-menu {

    width: 30px;
    height: 30px;

    border: 0;

    border-radius: 8px;

    background: transparent;

    color: #666;

    font-size: 18px;
}

.post-content {

    margin-top: 14px;

    color: #d0d0d0;

    font-size: .82rem;

    line-height: 1.65;
}

.post-tag {

    display: inline-block;

    margin-top: 12px;

    padding: 5px 8px;

    border-radius: 7px;

    background:
        rgba(197,160,89,.08);

    border:
        1px solid rgba(197,160,89,.16);

    color: var(--gold2);

    font-size: .63rem;
}

/* =========================================================
   POST ACTIONS
========================================================= */

.post-actions {

    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 4px;

    margin-top: 14px;

    padding-top: 9px;

    border-top:
        1px solid #202020;
}

.post-action {

    padding: 9px 3px;

    border: 0;

    border-radius: 9px;

    background: transparent;

    color: #707070;

    font-size: .68rem;
}

.post-action:active {

    background: #191919;

    color: white;
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
}

.section-title button {

    border: 0;

    background: transparent;

    color: var(--gold);

    font-size: .68rem;
}

.discovery-scroll {

    display: flex;

    overflow-x: auto;

    gap: 9px;

    scrollbar-width: none;
}

.discovery-scroll::-webkit-scrollbar {
    display: none;
}

.discovery-card {

    flex-shrink: 0;

    width: 145px;

    padding: 14px;

    border:
        1px solid var(--line);

    border-radius: 15px;

    background: #101010;
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
}

.discovery-card small {

    display: block;

    margin-top: 4px;

    color: #666;

    font-size: .63rem;
}

.follow {

    width: 100%;

    margin-top: 11px;

    padding: 7px;

    border:
        1px solid rgba(197,160,89,.30);

    border-radius: 9px;

    background: transparent;

    color: var(--gold);

    font-size: .65rem;
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

    background: #101010;
}

.trending h3 {

    margin-bottom: 10px;

    font-size: .8rem;
}

.trend {

    display: flex;

    align-items: center;

    justify-content: space-between;

    padding: 9px 0;

    border-bottom:
        1px solid #202020;
}

.trend:last-child {
    border-bottom: 0;
}

.trend span {

    color: #666;

    font-size: .64rem;
}

.trend strong {

    color: #cfcfcf;

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
        rgba(10,10,10,.94);

    border-top:
        1px solid rgba(255,255,255,.07);

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

    color: #686868;

    font-size: .58rem;
}

.bottom-item span:first-child {

    font-size: 17px;
}

.bottom-item.active {

    color: var(--gold2);
}

.bottom-publish {

    position: relative;

    margin-top: -20px;
}

.bottom-publish span:first-child {

    width: 43px;
    height: 43px;

    display: flex;

    align-items: center;
    justify-content: center;

    border-radius: 50%;

    background:
        linear-gradient(
            145deg,
            var(--gold2),
            var(--gold)
        );

    color: #050505;

    box-shadow:
        0 8px 25px rgba(197,160,89,.25);

    font-size: 20px;
}

/* =========================================================
   DESKTOP
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
            210px
            minmax(420px, 650px)
            260px;

        gap: 20px;

        padding:
            25px 20px 60px;
    }

    .desktop-sidebar {

        display: block;
    }

    .sidebar-card {

        position: sticky;

        top: 88px;
    }

    .bottom-nav {

        display: none;
    }

    .mobile-nav {

        display: none;
    }

    .desktop-sidebar {

        position: sticky;

        top: 88px;

        height: fit-content;
    }

    .desktop-menu {

        padding: 8px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: #101010;
    }

    .desktop-menu button {

        width: 100%;

        display: flex;

        align-items: center;

        gap: 10px;

        padding: 11px;

        border: 0;

        border-radius: 10px;

        background: transparent;

        color: #888;

        text-align: left;

        font-size: .75rem;
    }

    .desktop-menu button.active {

        background:
            rgba(197,160,89,.08);

        color: var(--gold2);
    }

    .desktop-profile {

        padding: 16px;

        margin-bottom: 10px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: #101010;
    }

    .desktop-profile strong {

        display: block;

        margin-top: 9px;

        font-size: .78rem;
    }

    .desktop-profile small {

        display: block;

        margin-top: 3px;

        color: #666;

        font-size: .64rem;
    }

    .desktop-right {

        position: sticky;

        top: 88px;

        height: fit-content;
    }

    .desktop-panel {

        padding: 16px;

        margin-bottom: 10px;

        border:
            1px solid var(--line);

        border-radius: 16px;

        background: #101010;
    }

    .desktop-panel h3 {

        margin-bottom: 10px;

        font-size: .78rem;
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
            230px
            minmax(500px, 700px)
            280px;
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
                👤
            </div>

            <strong>
                ${nom}
            </strong>

            <small>
                Membre SAMII
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
                SAMII COMMUNITY
            </div>

            <h1>
                Bienvenue dans la communauté 🌐
            </h1>

            <p>
                Clients, commerçants et membres SAMII
                se rencontrent, partagent et développent
                leurs activités ensemble.
            </p>

        </section>


        <!-- CREATE -->

        <section class="create">

            <div class="create-head">

                <div class="user-avatar">
                    👤
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
                    🏪
                </div>

                <div class="post-user">

                    <strong>
                        Exemple Boutique
                    </strong>

                    <small>
                        Marchand · Algérie · 2 h
                    </small>

                </div>

                <button class="post-menu">
                    ⋮
                </button>

            </div>


            <div class="post-content">

                Bienvenue dans SAMII Community 👋

                <br><br>

                Ici les commerçants peuvent présenter
                leurs produits, les clients découvrir
                de nouvelles offres et toute la communauté
                peut échanger.

            </div>


            <span class="post-tag">
                🏪 Commerce
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
                    👤
                </div>

                <div class="post-user">

                    <strong>
                        Membre SAMII
                    </strong>

                    <small>
                        Client · Algérie · 4 h
                    </small>

                </div>

                <button class="post-menu">
                    ⋮
                </button>

            </div>


            <div class="post-content">

                Je cherche un service pour m'aider
                à développer ma boutique.

                <br><br>

                Des recommandations dans la communauté ?

            </div>


            <span class="post-tag">
                ❓ Demande
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
                        🏪
                    </div>

                    <strong>
                        Boutique Exemple
                    </strong>

                    <small>
                        Marchand
                    </small>

                    <button class="follow">
                        Suivre
                    </button>

                </div>


                <div class="discovery-card">

                    <div class="user-avatar">
                        👤
                    </div>

                    <strong>
                        Membre SAMII
                    </strong>

                    <small>
                        Client
                    </small>

                    <button class="follow">
                        Suivre
                    </button>

                </div>


                <div class="discovery-card">

                    <div class="user-avatar">
                        🚚
                    </div>

                    <strong>
                        Transport Express
                    </strong>

                    <small>
                        Service
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
                    Commerce
                </span>

                <strong>
                    #EcommerceAlgerie
                </strong>

            </div>

            <div class="trend">

                <span>
                    SAMII
                </span>

                <strong>
                    #SAMIIOS
                </strong>

            </div>

            <div class="trend">

                <span>
                    Marketplace
                </span>

                <strong>
                    #NouveauxProduits
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
                    Commerce
                </span>

                <strong>
                    #EcommerceAlgerie
                </strong>

            </div>

            <div class="trend">

                <span>
                    SAMII
                </span>

                <strong>
                    #SAMIIOS
                </strong>

            </div>

            <div class="trend">

                <span>
                    Marketplace
                </span>

                <strong>
                    #NouveauxProduits
                </strong>

            </div>

        </section>


        <section class="desktop-panel">

            <h3>
                👥 Membres
            </h3>

            <div class="member">

                <div class="user-avatar">
                    🏪
                </div>

                <div class="post-user">

                    <strong>
                        Boutique Exemple
                    </strong>

                    <small>
                        Marchand
                    </small>

                </div>

            </div>


            <div class="member">

                <div class="user-avatar">
                    👤
                </div>

                <div class="post-user">

                    <strong>
                        Membre SAMII
                    </strong>

                    <small>
                        Client
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
