const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Community — SAMII</title>

    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background: #050505;
            color: #f5f5f5;
            font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input,
        textarea {
            font-family: inherit;
        }

        button {
            cursor: pointer;
        }

        /* =====================================================
           HEADER
        ===================================================== */

        .topbar {
            position: sticky;
            top: 0;
            z-index: 100;
            height: 64px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 0 28px;

            background: rgba(10, 10, 10, .96);
            border-bottom: 1px solid #242424;
            backdrop-filter: blur(12px);
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 800;
            letter-spacing: .08em;
        }

        .brand-mark {
            width: 38px;
            height: 38px;
            border-radius: 50%;

            display: flex;
            align-items: center;
            justify-content: center;

            background: linear-gradient(145deg, #7d5cff, #4d35c9);
            font-size: 18px;
        }

        .brand span {
            color: #c5a059;
        }

        .search {
            width: 320px;
            margin-left: 40px;
        }

        .search input {
            width: 100%;
            padding: 10px 14px;

            border: 1px solid #303030;
            border-radius: 20px;

            background: #111;
            color: white;
            outline: none;
        }

        .search input:focus {
            border-color: #c5a059;
        }

        .top-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .top-btn {
            width: 40px;
            height: 40px;

            border: 1px solid #2b2b2b;
            border-radius: 50%;

            background: #111;
            color: white;

            font-size: 17px;
        }

        .top-btn:hover {
            border-color: #c5a059;
        }

        /* =====================================================
           LAYOUT
        ===================================================== */

        .community {
            width: 100%;
            max-width: 1450px;
            margin: 0 auto;

            display: grid;
            grid-template-columns: 230px minmax(400px, 680px) 280px;
            gap: 24px;

            padding: 28px 22px 60px;
        }

        /* =====================================================
           LEFT SIDEBAR
        ===================================================== */

        .sidebar {
            position: sticky;
            top: 88px;
            height: fit-content;
        }

        .profile-mini {
            padding: 18px;
            border: 1px solid #272727;
            border-radius: 14px;
            background: #101010;
            margin-bottom: 14px;
        }

        .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;

            display: flex;
            align-items: center;
            justify-content: center;

            background: linear-gradient(145deg, #7d5cff, #4d35c9);

            font-size: 21px;
        }

        .profile-name {
            margin-top: 12px;
            font-weight: bold;
        }

        .profile-role {
            margin-top: 5px;
            color: #777;
            font-size: .82rem;
        }

        .nav {
            padding: 8px;

            border: 1px solid #272727;
            border-radius: 14px;

            background: #101010;
        }

        .nav-item {
            width: 100%;

            display: flex;
            align-items: center;
            gap: 12px;

            padding: 12px;

            border: none;
            border-radius: 9px;

            background: transparent;
            color: #d0d0d0;

            text-align: left;
            font-size: .9rem;
        }

        .nav-item:hover,
        .nav-item.active {
            background: #1b1b1b;
            color: #fff;
        }

        .nav-item.active {
            border-left: 2px solid #c5a059;
        }

        /* =====================================================
           MAIN
        ===================================================== */

        .main {
            min-width: 0;
        }

        .welcome {
            padding: 22px;

            border: 1px solid #292929;
            border-radius: 16px;

            background:
                radial-gradient(
                    circle at top right,
                    rgba(125,92,255,.15),
                    transparent 45%
                ),
                #101010;

            margin-bottom: 16px;
        }

        .welcome h1 {
            font-size: 1.45rem;
            margin-bottom: 8px;
        }

        .welcome p {
            color: #888;
            line-height: 1.5;
            font-size: .9rem;
        }

        /* =====================================================
           CREATE POST
        ===================================================== */

        .create-post {
            padding: 18px;

            border: 1px solid #292929;
            border-radius: 16px;

            background: #101010;

            margin-bottom: 16px;
        }

        .create-top {
            display: flex;
            gap: 12px;
        }

        .create-input {
            flex: 1;

            padding: 13px 16px;

            border: 1px solid #2b2b2b;
            border-radius: 24px;

            background: #151515;
            color: #aaa;

            text-align: left;
        }

        .create-input:hover {
            border-color: #555;
            color: white;
        }

        .create-actions {
            display: grid;
            grid-template-columns: repeat(4, 1fr);

            gap: 8px;

            margin-top: 14px;
        }

        .create-action {
            padding: 10px;

            border: 1px solid transparent;
            border-radius: 9px;

            background: transparent;
            color: #aaa;
        }

        .create-action:hover {
            background: #191919;
            color: white;
            border-color: #292929;
        }

        /* =====================================================
           FEED FILTER
        ===================================================== */

        .feed-filter {
            display: flex;
            gap: 8px;

            margin-bottom: 14px;

            overflow-x: auto;
        }

        .filter-btn {
            white-space: nowrap;

            padding: 8px 14px;

            border: 1px solid #292929;
            border-radius: 20px;

            background: #101010;
            color: #888;
        }

        .filter-btn.active,
        .filter-btn:hover {
            color: white;
            border-color: #c5a059;
        }

        /* =====================================================
           POST
        ===================================================== */

        .post {
            padding: 20px;

            border: 1px solid #292929;
            border-radius: 16px;

            background: #101010;

            margin-bottom: 16px;
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
            font-size: .95rem;
        }

        .post-user small {
            color: #707070;
            font-size: .75rem;
        }

        .post-menu {
            border: none;
            background: transparent;
            color: #777;
            font-size: 20px;
        }

        .post-content {
            margin-top: 16px;

            color: #ddd;
            line-height: 1.6;
            font-size: .93rem;
        }

        .post-tag {
            display: inline-block;

            margin-top: 14px;
            padding: 5px 9px;

            border-radius: 6px;

            background: #1b1710;
            color: #c5a059;

            font-size: .72rem;
        }

        .post-actions {
            display: grid;
            grid-template-columns: repeat(3, 1fr);

            gap: 5px;

            margin-top: 18px;
            padding-top: 12px;

            border-top: 1px solid #242424;
        }

        .post-action {
            padding: 9px;

            border: none;
            border-radius: 8px;

            background: transparent;
            color: #777;
        }

        .post-action:hover {
            background: #191919;
            color: white;
        }

        /* =====================================================
           RIGHT
        ===================================================== */

        .right-column {
            position: sticky;
            top: 88px;
            height: fit-content;
        }

        .panel {
            padding: 18px;

            border: 1px solid #292929;
            border-radius: 14px;

            background: #101010;

            margin-bottom: 14px;
        }

        .panel h3 {
            font-size: .95rem;
            margin-bottom: 16px;
        }

        .trend {
            padding: 11px 0;

            border-bottom: 1px solid #222;
        }

        .trend:last-child {
            border-bottom: none;
        }

        .trend small {
            color: #666;
        }

        .trend strong {
            display: block;
            margin-top: 4px;
            font-size: .85rem;
        }

        .member {
            display: flex;
            align-items: center;
            gap: 10px;

            padding: 10px 0;
        }

        .member-info {
            flex: 1;
        }

        .member-info strong {
            display: block;
            font-size: .82rem;
        }

        .member-info small {
            color: #666;
        }

        .follow {
            padding: 6px 10px;

            border: 1px solid #c5a059;
            border-radius: 15px;

            background: transparent;
            color: #c5a059;

            font-size: .72rem;
        }

        .follow:hover {
            background: #c5a059;
            color: #000;
        }

        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 1100px) {
            .community {
                grid-template-columns: 200px minmax(400px, 1fr);
            }

            .right-column {
                display: none;
            }
        }

        @media (max-width: 760px) {
            .topbar {
                padding: 0 14px;
            }

            .search {
                display: none;
            }

            .community {
                display: block;
                padding: 15px 12px 40px;
            }

            .sidebar {
                position: static;
                margin-bottom: 15px;
            }

            .profile-mini {
                display: none;
            }

            .nav {
                display: flex;
                overflow-x: auto;
                gap: 5px;
            }

            .nav-item {
                min-width: max-content;
            }

            .create-actions {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
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
