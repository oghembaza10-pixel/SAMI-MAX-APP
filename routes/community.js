const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {

    const nom = req.session?.nom || "Membre SAMII";
    const typeCompte = req.session?.typeCompte || "membre";

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
            background: #0b0b0d;
            color: #f5f5f5;
            font-family: Arial, Helvetica, sans-serif;
        }

        button,
        input {
            font: inherit;
        }

        a {
            color: inherit;
            text-decoration: none;
        }

        /* =========================================================
           HEADER
        ========================================================= */

        .topbar {
            height: 64px;
            border-bottom: 1px solid #242429;
            background: #101014;

            display: flex;
            align-items: center;

            padding: 0 28px;

            position: sticky;
            top: 0;
            z-index: 100;
        }

        .logo {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: .5px;
            color: #d4af37;
        }

        .search {
            margin-left: 35px;
            width: 320px;
        }

        .search input {
            width: 100%;
            background: #19191f;
            border: 1px solid #2c2c33;
            color: white;

            padding: 10px 15px;
            border-radius: 22px;
            outline: none;
        }

        .search input:focus {
            border-color: #d4af37;
        }

        .top-actions {
            margin-left: auto;

            display: flex;
            align-items: center;
            gap: 18px;
        }

        .top-icon {
            font-size: 20px;
            cursor: pointer;
            opacity: .8;
        }

        .top-icon:hover {
            opacity: 1;
        }

        .avatar-small {
            width: 36px;
            height: 36px;
            border-radius: 50%;

            background: linear-gradient(145deg, #7d5cff, #4b35b8);

            display: flex;
            align-items: center;
            justify-content: center;

            font-weight: bold;
        }

        /* =========================================================
           LAYOUT
        ========================================================= */

        .community {
            max-width: 1400px;
            margin: auto;

            display: grid;
            grid-template-columns: 230px minmax(400px, 680px) 280px;

            gap: 24px;

            padding: 28px 20px;
        }

        /* =========================================================
           LEFT SIDEBAR
        ========================================================= */

        .sidebar {
            position: sticky;
            top: 90px;
            height: fit-content;
        }

        .profile-card {
            background: #111116;
            border: 1px solid #25252b;
            border-radius: 14px;
            overflow: hidden;

            margin-bottom: 15px;
        }

        .profile-cover {
            height: 65px;

            background:
                linear-gradient(
                    135deg,
                    #171321,
                    #2b2350
                );
        }

        .profile-body {
            padding: 15px;
            text-align: center;
        }

        .profile-avatar {
            width: 60px;
            height: 60px;

            border-radius: 50%;

            margin: -42px auto 10px;

            border: 4px solid #111116;

            background: linear-gradient(145deg, #7d5cff, #4b35b8);

            display: flex;
            align-items: center;
            justify-content: center;

            font-size: 22px;
            font-weight: bold;
        }

        .profile-name {
            font-weight: bold;
            margin-bottom: 4px;
        }

        .profile-type {
            color: #888891;
            font-size: 12px;
        }

        .menu {
            background: #111116;
            border: 1px solid #25252b;
            border-radius: 14px;

            padding: 8px;
        }

        .menu-item {
            display: flex;
            align-items: center;

            gap: 12px;

            padding: 12px;

            border-radius: 9px;

            color: #b9b9c0;

            cursor: pointer;
        }

        .menu-item:hover {
            background: #1b1b21;
            color: white;
        }

        .menu-item.active {
            background: rgba(212, 175, 55, .12);
            color: #d4af37;
        }

        /* =========================================================
           CENTER
        ========================================================= */

        .main {
            min-width: 0;
        }

        .community-title {
            margin-bottom: 18px;
        }

        .community-title h1 {
            font-size: 28px;
            margin-bottom: 6px;
        }

        .community-title p {
            color: #888891;
            font-size: 14px;
        }

        /* CREATE POST */

        .create-post {
            background: #111116;
            border: 1px solid #25252b;
            border-radius: 14px;

            padding: 16px;

            margin-bottom: 18px;
        }

        .create-top {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .create-input {
            flex: 1;

            background: #19191f;
            border: 1px solid #292930;

            padding: 12px 16px;

            border-radius: 22px;

            color: #999;

            cursor: pointer;
        }

        .create-actions {
            display: flex;

            gap: 8px;

            margin-top: 14px;
        }

        .create-action {
            flex: 1;

            border: none;
            background: transparent;

            color: #aaaab2;

            padding: 9px;

            border-radius: 8px;

            cursor: pointer;
        }

        .create-action:hover {
            background: #1b1b21;
            color: white;
        }

        /* POST */

        .post {
            background: #111116;
            border: 1px solid #25252b;

            border-radius: 14px;

            padding: 18px;

            margin-bottom: 18px;
        }

        .post-header {
            display: flex;
            align-items: center;
            gap: 11px;
        }

        .post-avatar {
            width: 42px;
            height: 42px;

            border-radius: 50%;

            background: linear-gradient(145deg, #7d5cff, #4b35b8);

            display: flex;
            align-items: center;
            justify-content: center;

            font-weight: bold;
        }

        .post-author {
            font-weight: bold;
        }

        .post-meta {
            color: #777780;
            font-size: 12px;
            margin-top: 3px;
        }

        .post-content {
            margin-top: 16px;

            color: #dedee2;

            line-height: 1.6;

            font-size: 15px;
        }

        .post-tag {
            display: inline-block;

            margin-top: 12px;

            padding: 5px 9px;

            border-radius: 6px;

            background: rgba(212, 175, 55, .1);

            color: #d4af37;

            font-size: 11px;
        }

        .post-actions {
            display: flex;

            gap: 6px;

            margin-top: 18px;

            padding-top: 12px;

            border-top: 1px solid #24242a;
        }

        .post-action {
            flex: 1;

            background: transparent;
            border: none;

            color: #888891;

            padding: 9px;

            border-radius: 8px;

            cursor: pointer;
        }

        .post-action:hover {
            background: #1b1b21;
            color: white;
        }

        /* =========================================================
           RIGHT SIDEBAR
        ========================================================= */

        .rightbar {
            position: sticky;
            top: 90px;
            height: fit-content;
        }

        .side-card {
            background: #111116;

            border: 1px solid #25252b;

            border-radius: 14px;

            padding: 17px;

            margin-bottom: 16px;
        }

        .side-title {
            font-weight: bold;

            margin-bottom: 14px;
        }

        .trend {
            padding: 10px 0;

            border-bottom: 1px solid #222229;
        }

        .trend:last-child {
            border-bottom: none;
        }

        .trend-name {
            font-weight: bold;
            font-size: 14px;
        }

        .trend-count {
            color: #777780;
            font-size: 12px;

            margin-top: 4px;
        }

        .member {
            display: flex;

            align-items: center;

            gap: 10px;

            margin-bottom: 13px;
        }

        .member-avatar {
            width: 36px;
            height: 36px;

            border-radius: 50%;

            background: #272732;

            display: flex;
            align-items: center;
            justify-content: center;
        }

        .member-name {
            font-size: 13px;
            font-weight: bold;
        }

        .member-type {
            color: #777780;
            font-size: 11px;
            margin-top: 3px;
        }

        .follow {
            margin-left: auto;

            border: 1px solid #3b3b43;

            background: transparent;

            color: #d4af37;

            padding: 5px 9px;

            border-radius: 7px;

            cursor: pointer;

            font-size: 11px;
        }

        /* =========================================================
           RESPONSIVE
        ========================================================= */

        @media (max-width: 1050px) {

            .community {
                grid-template-columns: 200px minmax(400px, 1fr);
            }

            .rightbar {
                display: none;
            }

        }

        @media (max-width: 720px) {

            .topbar {
                padding: 0 15px;
            }

            .search {
                display: none;
            }

            .community {
                display: block;
                padding: 18px 12px;
            }

            .sidebar {
                position: static;
                margin-bottom: 18px;
            }

            .menu {
                display: flex;
                overflow-x: auto;
            }

            .menu-item {
                white-space: nowrap;
            }

            .profile-card {
                display: none;
            }

            .community-title h1 {
                font-size: 24px;
            }

        }
    </style>
</head>

<body>

<header class="topbar">

    <div class="logo">
        SAMII
    </div>

    <div class="search">
        <input
            type="text"
            placeholder="Rechercher dans Community..."
        >
    </div>

    <div class="top-actions">

        <div class="top-icon">
            🔔
        </div>

        <div class="top-icon">
            💬
        </div>

        <div class="avatar-small">
            ${String(nom).charAt(0).toUpperCase()}
        </div>

    </div>

</header>


<div class="community">

    <!-- =====================================================
         SIDEBAR
    ====================================================== -->

    <aside class="sidebar">

        <div class="profile-card">

            <div class="profile-cover"></div>

            <div class="profile-body">

                <div class="profile-avatar">
                    ${String(nom).charAt(0).toUpperCase()}
                </div>

                <div class="profile-name">
                    ${nom}
                </div>

                <div class="profile-type">
                    ${typeCompte}
                </div>

            </div>

        </div>


        <div class="menu">

            <div class="menu-item active">
                🏠
                <span>Accueil</span>
            </div>

            <div class="menu-item">
                🔥
                <span>Explorer</span>
            </div>

            <div class="menu-item">
                👥
                <span>Communautés</span>
            </div>

            <div class="menu-item">
                🔖
                <span>Enregistrés</span>
            </div>

        </div>

    </aside>


    <!-- =====================================================
         MAIN FEED
    ====================================================== -->

    <main class="main">

        <div class="community-title">

            <h1>
                Community
            </h1>

            <p>
                Le réseau de SAMII — clients, marchands et membres de l'écosystème.
            </p>

        </div>


        <!-- CREATE -->

        <div class="create-post">

            <div class="create-top">

                <div class="post-avatar">
                    ${String(nom).charAt(0).toUpperCase()}
                </div>

                <div
                    class="create-input"
                    onclick="ouvrirPublication()"
                >
                    Quoi de neuf, ${nom} ?
                </div>

            </div>


            <div class="create-actions">

                <button
                    class="create-action"
                    onclick="ouvrirPublication('discussion')"
                >
                    💬 Discussion
                </button>

                <button
                    class="create-action"
                    onclick="ouvrirPublication('demande')"
                >
                    🔎 Demande
                </button>

                <button
                    class="create-action"
                    onclick="ouvrirPublication('produit')"
                >
                    🛍️ Produit
                </button>

            </div>

        </div>


        <!-- DEMO POST 1 -->

        <article class="post">

            <div class="post-header">

                <div class="post-avatar">
                    S
                </div>

                <div>

                    <div class="post-author">
                        SAMII
                    </div>

                    <div class="post-meta">
                        Administrateur · Aujourd'hui
                    </div>

                </div>

            </div>


            <div class="post-content">

                Bienvenue dans <strong>SAMII Community</strong>.
                Ici, clients, marchands et membres de l'écosystème
                peuvent échanger, partager leurs besoins, présenter
                leurs produits et créer de nouvelles opportunités.

                <div>
                    <span class="post-tag">
                        #SAMII
                    </span>

                    <span class="post-tag">
                        #Community
                    </span>
                </div>

            </div>


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


        <!-- DEMO POST 2 -->

        <article class="post">

            <div class="post-header">

                <div class="post-avatar">
                    A
                </div>

                <div>

                    <div class="post-author">
                        Ahmed
                    </div>

                    <div class="post-meta">
                        Marchand · Il y a 2 h
                    </div>

                </div>

            </div>


            <div class="post-content">

                Je viens de lancer ma nouvelle collection.
                Je cherche également des partenaires pour
                développer ma distribution en Algérie.

                <div>
                    <span class="post-tag">
                        #Commerce
                    </span>

                    <span class="post-tag">
                        #Algérie
                    </span>
                </div>

            </div>


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
         RIGHT SIDEBAR
    ====================================================== -->

    <aside class="rightbar">

        <div class="side-card">

            <div class="side-title">
                🔥 Tendances
            </div>

            <div class="trend">

                <div class="trend-name">
                    #Ecommerce
                </div>

                <div class="trend-count">
                    Commerce · 1 240 publications
                </div>

            </div>

            <div class="trend">

                <div class="trend-name">
                    #Algérie
                </div>

                <div class="trend-count">
                    840 publications
                </div>

            </div>

            <div class="trend">

                <div class="trend-name">
                    #Entrepreneurs
                </div>

                <div class="trend-count">
                    620 publications
                </div>

            </div>

        </div>


        <div class="side-card">

            <div class="side-title">
                👥 À découvrir
            </div>

            <div class="member">

                <div class="member-avatar">
                    M
                </div>

                <div>
                    <div class="member-name">
                        Mohamed
                    </div>

                    <div class="member-type">
                        Marchand
                    </div>
                </div>

                <button class="follow">
                    Suivre
                </button>

            </div>


            <div class="member">

                <div class="member-avatar">
                    S
                </div>

                <div>
                    <div class="member-name">
                        Sarah
                    </div>

                    <div class="member-type">
                        Client
                    </div>
                </div>

                <button class="follow">
                    Suivre
                </button>

            </div>

        </div>

    </aside>

</div>


<script>

function ouvrirPublication(type = "discussion") {

    const labels = {
        discussion: "Discussion",
        demande: "Demande",
        produit: "Produit"
    };

    alert(
        "Création d'une publication : " +
        (labels[type] || "Publication") +
        "\\n\\nLe système de publication sera connecté ensuite."
    );
}

</script>

</body>
</html>`);

});

module.exports = router;
