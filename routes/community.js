const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Community — SAMII</title>

   :root {
    --bg: #07080b;
    --bg-soft: #0b0d11;
    --panel: rgba(17, 19, 24, .82);
    --panel-solid: #111318;
    --panel-hover: #171a21;

    --border: rgba(255,255,255,.07);
    --border-hover: rgba(197,160,89,.30);

    --text: #f5f5f7;
    --text-soft: #a5a8b0;
    --text-muted: #6d7078;

    --gold: #c5a059;
    --gold-light: #e2c47d;

    --purple: #795cff;
    --purple-soft: rgba(121,92,255,.14);

    --radius-lg: 20px;
    --radius-md: 14px;
    --radius-sm: 10px;

    --shadow:
        0 20px 60px rgba(0,0,0,.35);

    --transition:
        180ms cubic-bezier(.2,.8,.2,1);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    scroll-behavior: smooth;
}

body {
    min-height: 100vh;

    background:
        radial-gradient(
            circle at 15% -10%,
            rgba(121,92,255,.10),
            transparent 32%
        ),
        radial-gradient(
            circle at 85% 0%,
            rgba(197,160,89,.07),
            transparent 28%
        ),
        var(--bg);

    color: var(--text);

    font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    -webkit-font-smoothing: antialiased;
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

button,
input {
    outline: none;
}

/* =========================================================
   TOP BAR
========================================================= */

.topbar {
    position: sticky;
    top: 0;
    z-index: 1000;

    height: 68px;

    display: flex;
    align-items: center;

    padding: 0 30px;

    background: rgba(7,8,11,.78);

    border-bottom:
        1px solid rgba(255,255,255,.055);

    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
}

.brand {
    display: flex;
    align-items: center;
    gap: 11px;

    min-width: 210px;

    font-size: .92rem;
    font-weight: 800;
    letter-spacing: .07em;
}

.brand-mark {
    width: 39px;
    height: 39px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 12px;

    background:
        linear-gradient(
            145deg,
            #876cff,
            #5439d4
        );

    box-shadow:
        0 8px 25px rgba(121,92,255,.25);

    font-size: 17px;
}

.brand span {
    color: var(--gold-light);
}

/* SEARCH */

.search {
    flex: 1;
    max-width: 470px;

    margin: 0 auto;
}

.search input {
    width: 100%;
    height: 42px;

    padding: 0 18px 0 42px;

    border:
        1px solid rgba(255,255,255,.07);

    border-radius: 13px;

    background:
        rgba(255,255,255,.035);

    color: var(--text);

    transition: var(--transition);
}

.search input::placeholder {
    color: #62656d;
}

.search input:focus {
    background: rgba(255,255,255,.055);

    border-color:
        rgba(197,160,89,.45);

    box-shadow:
        0 0 0 4px rgba(197,160,89,.06);
}

/* ACTIONS */

.top-actions {
    min-width: 210px;

    display: flex;
    justify-content: flex-end;
    align-items: center;

    gap: 8px;
}

.top-btn {
    width: 40px;
    height: 40px;

    display: flex;
    align-items: center;
    justify-content: center;

    border:
        1px solid rgba(255,255,255,.065);

    border-radius: 12px;

    background:
        rgba(255,255,255,.035);

    color: #d6d7dc;

    transition: var(--transition);
}

.top-btn:hover {
    transform: translateY(-1px);

    background:
        rgba(255,255,255,.075);

    border-color:
        rgba(197,160,89,.30);

    color: white;
}

/* =========================================================
   MAIN LAYOUT
========================================================= */

.community {
    width: 100%;
    max-width: 1480px;

    margin: auto;

    display: grid;

    grid-template-columns:
        230px
        minmax(450px, 680px)
        290px;

    gap: 25px;

    padding:
        28px 24px 70px;
}

/* =========================================================
   SIDEBAR
========================================================= */

.sidebar {
    position: sticky;
    top: 92px;

    height: fit-content;
}

.profile-mini,
.nav,
.panel,
.create-post,
.post,
.welcome {
    border:
        1px solid var(--border);

    background:
        linear-gradient(
            145deg,
            rgba(20,22,28,.88),
            rgba(12,14,18,.88)
        );

    box-shadow:
        0 12px 40px rgba(0,0,0,.18);

    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
}

/* PROFILE */

.profile-mini {
    padding: 19px;

    border-radius: var(--radius-lg);

    margin-bottom: 12px;
}

.avatar {
    width: 46px;
    height: 46px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 14px;

    background:
        linear-gradient(
            145deg,
            #8268ff,
            #4c35c4
        );

    box-shadow:
        0 8px 25px rgba(121,92,255,.20);

    font-size: 18px;
}

.profile-name {
    margin-top: 13px;

    font-size: .91rem;
    font-weight: 700;
}

.profile-role {
    margin-top: 5px;

    color: var(--text-muted);

    font-size: .78rem;
}

/* NAV */

.nav {
    padding: 7px;

    border-radius: var(--radius-lg);
}

.nav-item {
    position: relative;

    width: 100%;

    display: flex;
    align-items: center;
    gap: 12px;

    padding: 12px 13px;

    border: 0;
    border-radius: 11px;

    background: transparent;

    color: #92959e;

    text-align: left;

    font-size: .86rem;

    transition: var(--transition);
}

.nav-item:hover {
    background:
        rgba(255,255,255,.045);

    color: white;

    transform: translateX(2px);
}

.nav-item.active {
    background:
        linear-gradient(
            90deg,
            rgba(197,160,89,.11),
            rgba(197,160,89,.025)
        );

    color: #f3dfb5;
}

.nav-item.active::before {
    content: "";

    position: absolute;
    left: 0;
    top: 9px;
    bottom: 9px;

    width: 2px;

    border-radius: 4px;

    background:
        linear-gradient(
            180deg,
            var(--gold-light),
            var(--gold)
        );
}

/* =========================================================
   MAIN
========================================================= */

.main {
    min-width: 0;
}

/* WELCOME */

.welcome {
    position: relative;
    overflow: hidden;

    padding: 25px;

    border-radius: var(--radius-lg);

    margin-bottom: 14px;
}

.welcome::after {
    content: "";

    position: absolute;

    width: 180px;
    height: 180px;

    right: -70px;
    top: -90px;

    border-radius: 50%;

    background:
        rgba(121,92,255,.10);

    filter: blur(10px);
}

.welcome h1 {
    position: relative;
    z-index: 1;

    font-size: 1.38rem;

    letter-spacing: -.025em;
}

.welcome p {
    position: relative;
    z-index: 1;

    max-width: 570px;

    margin-top: 8px;

    color: var(--text-muted);

    font-size: .86rem;

    line-height: 1.6;
}

/* =========================================================
   CREATE POST
========================================================= */

.create-post {
    padding: 17px;

    border-radius: var(--radius-lg);

    margin-bottom: 14px;
}

.create-top {
    display: flex;
    align-items: center;
    gap: 12px;
}

.create-input {
    flex: 1;

    min-height: 46px;

    padding: 0 17px;

    border:
        1px solid rgba(255,255,255,.07);

    border-radius: 15px;

    background:
        rgba(255,255,255,.035);

    color: #777b84;

    text-align: left;

    transition: var(--transition);
}

.create-input:hover {
    background:
        rgba(255,255,255,.055);

    border-color:
        rgba(255,255,255,.12);

    color: #c5c7cc;
}

.create-actions {
    display: grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap: 7px;

    margin-top: 13px;
}

.create-action {
    padding: 10px 8px;

    border:
        1px solid transparent;

    border-radius: 10px;

    background: transparent;

    color: #858891;

    font-size: .78rem;

    transition: var(--transition);
}

.create-action:hover {
    background:
        rgba(255,255,255,.045);

    border-color:
        rgba(255,255,255,.07);

    color: #eee;

    transform: translateY(-1px);
}

/* =========================================================
   FILTERS
========================================================= */

.feed-filter {
    display: flex;
    align-items: center;
    gap: 7px;

    margin-bottom: 13px;

    overflow-x: auto;

    scrollbar-width: none;
}

.feed-filter::-webkit-scrollbar {
    display: none;
}

.filter-btn {
    white-space: nowrap;

    padding: 8px 13px;

    border:
        1px solid rgba(255,255,255,.065);

    border-radius: 100px;

    background:
        rgba(255,255,255,.025);

    color: #777a82;

    font-size: .76rem;

    transition: var(--transition);
}

.filter-btn:hover {
    color: #ddd;

    border-color:
        rgba(255,255,255,.12);
}

.filter-btn.active {
    color: #f1ddb0;

    border-color:
        rgba(197,160,89,.32);

    background:
        rgba(197,160,89,.08);
}

/* =========================================================
   POST
========================================================= */

.post {
    padding: 20px;

    border-radius: var(--radius-lg);

    margin-bottom: 13px;

    transition: var(--transition);
}

.post:hover {
    border-color:
        rgba(255,255,255,.10);

    transform: translateY(-1px);

    box-shadow:
        0 18px 50px rgba(0,0,0,.24);
}

.post-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.post-user {
    flex: 1;
}

.post-user strong {
    display: block;

    color: #f0f0f2;

    font-size: .88rem;
}

.post-user small {
    display: block;

    margin-top: 3px;

    color: #666a72;

    font-size: .71rem;
}

.post-menu {
    width: 32px;
    height: 32px;

    border: 0;
    border-radius: 9px;

    background: transparent;

    color: #666a72;

    transition: var(--transition);
}

.post-menu:hover {
    background:
        rgba(255,255,255,.05);

    color: white;
}

.post-content {
    margin-top: 16px;

    color: #c9cbd0;

    font-size: .88rem;

    line-height: 1.7;
}

.post-tag {
    display: inline-flex;
    align-items: center;

    margin-top: 14px;

    padding: 5px 9px;

    border:
        1px solid rgba(197,160,89,.14);

    border-radius: 7px;

    background:
        rgba(197,160,89,.055);

    color: #c9aa6b;

    font-size: .68rem;
}

.post-actions {
    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 5px;

    margin-top: 17px;
    padding-top: 10px;

    border-top:
        1px solid rgba(255,255,255,.055);
}

.post-action {
    padding: 9px;

    border: 0;
    border-radius: 9px;

    background: transparent;

    color: #696c74;

    font-size: .75rem;

    transition: var(--transition);
}

.post-action:hover {
    background:
        rgba(255,255,255,.045);

    color: #ddd;
}

/* =========================================================
   RIGHT COLUMN
========================================================= */

.right-column {
    position: sticky;
    top: 92px;

    height: fit-content;
}

.panel {
    padding: 18px;

    border-radius: var(--radius-lg);

    margin-bottom: 13px;
}

.panel h3 {
    margin-bottom: 13px;

    font-size: .86rem;

    letter-spacing: -.01em;
}

/* TRENDS */

.trend {
    padding: 11px 0;

    border-bottom:
        1px solid rgba(255,255,255,.045);
}

.trend:last-child {
    border-bottom: none;
}

.trend small {
    color: #5e6169;

    font-size: .67rem;
}

.trend strong {
    display: block;

    margin-top: 4px;

    color: #d5d6da;

    font-size: .78rem;
}

/* MEMBERS */

.member {
    display: flex;
    align-items: center;
    gap: 9px;

    padding: 9px 0;
}

.member .avatar {
    width: 38px;
    height: 38px;

    border-radius: 11px;

    font-size: 14px;
}

.member-info {
    flex: 1;
    min-width: 0;
}

.member-info strong {
    display: block;

    overflow: hidden;

    color: #ddd;

    font-size: .74rem;

    white-space: nowrap;
    text-overflow: ellipsis;
}

.member-info small {
    display: block;

    margin-top: 3px;

    color: #5f626a;

    font-size: .66rem;
}

.follow {
    padding: 6px 9px;

    border:
        1px solid rgba(197,160,89,.35);

    border-radius: 100px;

    background:
        transparent;

    color: #c5a059;

    font-size: .65rem;

    transition: var(--transition);
}

.follow:hover {
    background:
        var(--gold);

    color: #080808;

    transform: translateY(-1px);
}

/* =========================================================
   SCROLLBAR
========================================================= */

::-webkit-scrollbar {
    width: 7px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #25272d;
    border-radius: 20px;
}

::-webkit-scrollbar-thumb:hover {
    background: #34363e;
}

/* =========================================================
   RESPONSIVE
========================================================= */

@media (max-width: 1180px) {

    .community {
        grid-template-columns:
            210px
            minmax(420px, 1fr);
    }

    .right-column {
        display: none;
    }
}

@media (max-width: 780px) {

    .topbar {
        height: 62px;
        padding: 0 14px;
    }

    .brand {
        min-width: auto;
    }

    .brand > div:last-child {
        display: none;
    }

    .search {
        display: none;
    }

    .top-actions {
        min-width: auto;
    }

    .community {
        display: block;

        padding:
            14px 11px 45px;
    }

    .sidebar {
        position: static;

        margin-bottom: 13px;
    }

    .profile-mini {
        display: none;
    }

    .nav {
        display: flex;

        overflow-x: auto;

        gap: 4px;

        padding: 5px;

        scrollbar-width: none;
    }

    .nav::-webkit-scrollbar {
        display: none;
    }

    .nav-item {
        width: auto;

        min-width: max-content;

        padding: 10px 13px;
    }

    .nav-item.active::before {
        display: none;
    }

    .welcome {
        padding: 20px;
    }

    .welcome h1 {
        font-size: 1.2rem;
    }

    .create-actions {
        grid-template-columns:
            repeat(2, 1fr);
    }

    .post {
        padding: 16px;
    }
}

@media (max-width: 430px) {

    .top-btn {
        width: 36px;
        height: 36px;
    }

    .brand-mark {
        width: 36px;
        height: 36px;
    }

    .create-actions {
        gap: 4px;
    }

    .create-action {
        font-size: .71rem;
    }

    .post-actions {
        grid-template-columns:
            repeat(3, 1fr);
    }

    .post-action {
        font-size: .68rem;
    }
}
</head>

<body>

<header class="topbar">

    <div class="brand">
        <div class="brand-mark">🤖</div>
        <div>SAMII <span>COMMUNITY</span></div>
    </div>

    <div class="search">
        <input
            type="search"
            placeholder="Rechercher dans Community..."
        >
    </div>

    <div class="top-actions">
        <button class="top-btn" title="Notifications">🔔</button>
        <button class="top-btn" title="Profil">👤</button>
    </div>

</header>


<div class="community">

    <!-- =====================================================
         SIDEBAR
    ====================================================== -->

    <aside class="sidebar">

        <div class="profile-mini">

            <div class="avatar">👤</div>

            <div class="profile-name">
                Mon profil
            </div>

            <div class="profile-role">
                Membre SAMII
            </div>

        </div>

        <nav class="nav">

            <button class="nav-item active">
                🏠
                <span>Accueil</span>
            </button>

            <button class="nav-item">
                🔥
                <span>Explorer</span>
            </button>

            <button class="nav-item">
                ✍️
                <span>Publier</span>
            </button>

            <button class="nav-item">
                👥
                <span>Communautés</span>
            </button>

            <button class="nav-item">
                🔖
                <span>Enregistrés</span>
            </button>

        </nav>

    </aside>


    <!-- =====================================================
         MAIN FEED
    ====================================================== -->

    <main class="main">

        <section class="welcome">

            <h1>Bienvenue dans SAMII Community 🌐</h1>

            <p>
                L'espace où clients, commerçants, créateurs et membres
                de SAMII peuvent se rencontrer, partager, demander,
                proposer et découvrir.
            </p>

        </section>


        <section class="create-post">

            <div class="create-top">

                <div class="avatar">👤</div>

                <button class="create-input">
                    Quoi de neuf ? Partagez avec la communauté...
                </button>

            </div>

            <div class="create-actions">

                <button class="create-action">
                    📷 Photo
                </button>

                <button class="create-action">
                    📦 Produit
                </button>

                <button class="create-action">
                    💼 Offre
                </button>

                <button class="create-action">
                    ❓ Demande
                </button>

            </div>

        </section>


        <div class="feed-filter">

            <button class="filter-btn active">
                Tout
            </button>

            <button class="filter-btn">
                🔥 Tendances
            </button>

            <button class="filter-btn">
                📦 Produits
            </button>

            <button class="filter-btn">
                💼 Offres
            </button>

            <button class="filter-btn">
                ❓ Demandes
            </button>

        </div>


        <!-- POST 1 -->

        <article class="post">

            <div class="post-head">

                <div class="avatar">🏪</div>

                <div class="post-user">

                    <strong>Exemple Boutique</strong>

                    <small>
                        Marchand · Algérie · Il y a 2 h
                    </small>

                </div>

                <button class="post-menu">⋮</button>

            </div>

            <div class="post-content">

                Bienvenue dans SAMII Community 👋

                <br><br>

                Ici, les marchands peuvent présenter leurs produits,
                les clients peuvent découvrir des offres et tout le
                monde peut échanger avec la communauté.

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


        <!-- POST 2 -->

        <article class="post">

            <div class="post-head">

                <div class="avatar">👤</div>

                <div class="post-user">

                    <strong>Membre SAMII</strong>

                    <small>
                        Client · Algérie · Il y a 4 h
                    </small>

                </div>

                <button class="post-menu">⋮</button>

            </div>

            <div class="post-content">

                Je cherche un service pour m'aider à développer
                ma boutique. Des recommandations ?

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

    </main>


    <!-- =====================================================
         RIGHT COLUMN
    ====================================================== -->

    <aside class="right-column">

        <section class="panel">

            <h3>🔥 Tendances</h3>

            <div class="trend">

                <small>Commerce</small>

                <strong>
                    #EcommerceAlgerie
                </strong>

            </div>

            <div class="trend">

                <small>SAMII</small>

                <strong>
                    #SAMIIOS
                </strong>

            </div>

            <div class="trend">

                <small>Marketplace</small>

                <strong>
                    #NouveauxProduits
                </strong>

            </div>

        </section>


        <section class="panel">

            <h3>👥 Membres à découvrir</h3>

            <div class="member">

                <div class="avatar">🏪</div>

                <div class="member-info">

                    <strong>Boutique Exemple</strong>

                    <small>Marchand</small>

                </div>

                <button class="follow">
                    Suivre
                </button>

            </div>


            <div class="member">

                <div class="avatar">👤</div>

                <div class="member-info">

                    <strong>Membre SAMII</strong>

                    <small>Client</small>

                </div>

                <button class="follow">
                    Suivre
                </button>

            </div>

        </section>

    </aside>

</div>

</body>
</html>`);

});

module.exports = router;
