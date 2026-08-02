// ============================================================================
// SAMII OS — OG TECHNOLOGY COMMUNITY
// Community Hub — Mobile First / Dark + Light / Futuristic
// ============================================================================

const express = require("express");

const router = express.Router();


// ============================================================================
// AUTH
// ============================================================================

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) {
        return res.redirect("/login");
    }

    next();
}


// ============================================================================
// DONNÉES DE DÉMONSTRATION — STRUCTURE PRÊTE POUR AIRTABLE
// ============================================================================

const POSTS = [
    {
        id: 1,
        author: "Samii Technology",
        initials: "S",
        grade: "GÉNÉRAL",
        verified: true,
        time: "Il y a 12 min",
        text: "Bienvenue dans la nouvelle Community SAMII. Ici, clients, marchands, créateurs et partenaires construisent ensemble l'écosystème.",
        image: "",
        likes: 128,
        comments: 24,
        shares: 11,
        tag: "SAMII",
        type: "system"
    },
    {
        id: 2,
        author: "Marketplace OG",
        initials: "M",
        grade: "MARCHAND",
        verified: true,
        time: "Il y a 34 min",
        text: "Nouvelle opportunité publiée sur Marketplace. Les membres de la communauté peuvent maintenant découvrir les produits et services directement depuis leur feed.",
        image: "",
        likes: 74,
        comments: 13,
        shares: 8,
        tag: "MARKETPLACE",
        type: "marketplace"
    },
    {
        id: 3,
        author: "Membre SAMII",
        initials: "M",
        grade: "CAPITAINE",
        verified: false,
        time: "Il y a 1 h",
        text: "Je viens de terminer ma première mission. Les points ont été ajoutés à mon grade. On avance 🚀",
        image: "",
        likes: 46,
        comments: 9,
        shares: 3,
        tag: "COMMUNAUTÉ",
        type: "member"
    }
];


// ============================================================================
// CSS GLOBAL
// ============================================================================

const COMMUNITY_CSS = `

/* ========================================================================
   VARIABLES
   ======================================================================== */

:root {

    --og-black: #030508;
    --og-black-2: #070b11;
    --og-panel: rgba(9, 15, 24, .88);
    --og-panel-solid: #0a111b;

    --og-blue: #087cff;
    --og-blue-bright: #00b7ff;
    --og-cyan: #00efff;

    --og-blue-soft: rgba(0, 132, 255, .12);
    --og-cyan-soft: rgba(0, 239, 255, .08);

    --og-white: #f5f9ff;
    --og-text: #dce7f5;
    --og-muted: #8190a5;

    --og-border: rgba(255,255,255,.08);
    --og-border-blue: rgba(0,174,255,.22);

    --og-danger: #ff4f67;
    --og-success: #21e6a0;
    --og-warning: #ffc857;

    --og-shadow:
        0 20px 60px rgba(0,0,0,.45);

    --og-glow:
        0 0 35px rgba(0,174,255,.16);

    --radius-xl: 24px;
    --radius-lg: 18px;
    --radius-md: 14px;

    --ease: cubic-bezier(.16,1,.3,1);
}


/* ========================================================================
   LIGHT MODE
   ======================================================================== */

body.light-mode {

    --og-black: #eef4fa;
    --og-black-2: #f6f9fc;

    --og-panel: rgba(255,255,255,.94);
    --og-panel-solid: #ffffff;

    --og-white: #07111d;
    --og-text: #26384c;
    --og-muted: #6d7d90;

    --og-border: rgba(4,25,45,.09);
    --og-border-blue: rgba(0,105,210,.22);

    --og-blue-soft: rgba(0,115,230,.08);
    --og-cyan-soft: rgba(0,180,230,.07);

    --og-shadow:
        0 18px 45px rgba(15,45,75,.10);

    background:
        radial-gradient(
            circle at 10% 0%,
            rgba(0,160,255,.10),
            transparent 32%
        ),
        #eef4fa;
}


/* ========================================================================
   RESET
   ======================================================================== */

* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {

    margin: 0;

    min-height: 100vh;

    background:
        radial-gradient(
            circle at 10% 10%,
            rgba(0,105,255,.10),
            transparent 30%
        ),
        radial-gradient(
            circle at 90% 70%,
            rgba(0,238,255,.06),
            transparent 30%
        ),
        linear-gradient(
            135deg,
            #020407,
            #050a11 55%,
            #020509
        );

    color: var(--og-text);

    font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    overflow-x: hidden;

    transition:
        background .35s ease,
        color .35s ease;
}

button,
input,
textarea {
    font: inherit;
}

button {
    cursor: pointer;
}

a {
    color: inherit;
    text-decoration: none;
}


/* ========================================================================
   FUTURISTIC BACKGROUND
   ======================================================================== */

.community-background {

    position: fixed;

    inset: 0;

    pointer-events: none;

    z-index: -1;

    overflow: hidden;
}

.community-grid {

    position: absolute;

    inset: 0;

    opacity: .18;

    background-image:

        linear-gradient(
            rgba(0,180,255,.045) 1px,
            transparent 1px
        ),

        linear-gradient(
            90deg,
            rgba(0,180,255,.045) 1px,
            transparent 1px
        );

    background-size: 44px 44px;

    mask-image:
        linear-gradient(
            to bottom,
            black,
            transparent 90%
        );
}

.community-orb {

    position: absolute;

    width: 500px;
    height: 500px;

    border-radius: 50%;

    background:
        radial-gradient(
            circle,
            rgba(0,155,255,.11),
            transparent 68%
        );

    filter: blur(25px);

    animation:
        floatingOrb 12s ease-in-out infinite;
}

.community-orb.one {
    top: -220px;
    left: -160px;
}

.community-orb.two {

    right: -250px;
    bottom: -180px;

    animation-delay: -5s;
}

@keyframes floatingOrb {

    0%,
    100% {
        transform: translate3d(0,0,0);
    }

    50% {
        transform: translate3d(35px,-25px,0);
    }
}


/* ========================================================================
   APP
   ======================================================================== */

.community-app {

    min-height: 100vh;

    display: flex;
    flex-direction: column;
}


/* ========================================================================
   HEADER
   ======================================================================== */

.community-header {

    position: sticky;

    top: 0;

    z-index: 100;

    height: 70px;

    display: flex;

    align-items: center;

    gap: 20px;

    padding:
        0 28px;

    background:
        rgba(3,8,14,.82);

    border-bottom:
        1px solid var(--og-border);

    backdrop-filter:
        blur(22px);

    -webkit-backdrop-filter:
        blur(22px);
}

body.light-mode .community-header {

    background:
        rgba(255,255,255,.82);
}


/* LOGO */

.community-logo {

    min-width: 190px;

    display: flex;

    align-items: center;

    gap: 12px;
}

.community-logo-mark {

    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    border-radius: 12px;

    background:
        linear-gradient(
            145deg,
            #008cff,
            #00eaff
        );

    color: #00121e;

    font-weight: 1000;

    box-shadow:
        0 0 25px rgba(0,205,255,.35);
}

.community-logo-text {

    display: flex;
    flex-direction: column;

    line-height: 1;
}

.community-logo-text strong {

    color: var(--og-white);

    font-size: 16px;

    letter-spacing: 1.5px;
}

.community-logo-text span {

    margin-top: 5px;

    color: var(--og-cyan);

    font-size: 9px;

    font-weight: 800;

    letter-spacing: 2.2px;
}


/* SEARCH */

.community-search {

    flex: 1;

    max-width: 620px;

    height: 42px;

    display: flex;

    align-items: center;

    gap: 10px;

    padding: 0 15px;

    border:
        1px solid var(--og-border);

    border-radius: 12px;

    background:
        rgba(255,255,255,.035);

    transition:
        border .25s,
        box-shadow .25s;
}

.community-search:focus-within {

    border-color:
        rgba(0,190,255,.45);

    box-shadow:
        0 0 0 4px rgba(0,160,255,.06);
}

.community-search-icon {

    color: var(--og-muted);

    font-size: 16px;
}

.community-search input {

    width: 100%;

    border: 0;

    outline: 0;

    background: transparent;

    color: var(--og-white);

    font-size: 13px;
}

.community-search input::placeholder {
    color: var(--og-muted);
}


/* HEADER ACTIONS */

.community-header-actions {

    margin-left: auto;

    display: flex;

    align-items: center;

    gap: 8px;
}

.icon-button {

    width: 40px;
    height: 40px;

    border:
        1px solid var(--og-border);

    border-radius: 11px;

    background:
        rgba(255,255,255,.035);

    color: var(--og-text);

    display: grid;

    place-items: center;

    transition:
        all .25s var(--ease);
}

.icon-button:hover {

    border-color:
        rgba(0,205,255,.4);

    color:
        var(--og-cyan);

    transform:
        translateY(-2px);

    box-shadow:
        var(--og-glow);
}

.notification-button {
    position: relative;
}

.notification-dot {

    position: absolute;

    top: 7px;
    right: 7px;

    width: 7px;
    height: 7px;

    border-radius: 50%;

    background:
        var(--og-cyan);

    box-shadow:
        0 0 10px var(--og-cyan);
}


/* PROFILE */

.header-profile {

    display: flex;

    align-items: center;

    gap: 10px;

    padding-left: 10px;
}

.profile-avatar {

    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #071827,
            #006dff
        );

    border:
        1px solid rgba(0,220,255,.45);

    color: white;

    font-weight: 900;

    box-shadow:
        0 0 20px rgba(0,150,255,.18);
}

.profile-name {

    display: flex;

    flex-direction: column;

    line-height: 1.2;
}

.profile-name strong {

    color: var(--og-white);

    font-size: 12px;
}

.profile-name span {

    color: var(--og-cyan);

    font-size: 9px;

    font-weight: 800;

    letter-spacing: 1px;
}


/* ========================================================================
   DESKTOP LAYOUT
   ======================================================================== */

.community-layout {

    width: 100%;

    max-width: 1480px;

    margin: 0 auto;

    padding:
        28px;

    display: grid;

    grid-template-columns:
        245px
        minmax(400px, 680px)
        285px;

    gap: 22px;

    align-items: start;
}


/* ========================================================================
   SIDEBARS
   ======================================================================== */

.community-sidebar {

    position: sticky;

    top: 94px;

    display: flex;

    flex-direction: column;

    gap: 14px;
}

.sidebar-card {

    padding: 16px;

    border:
        1px solid var(--og-border);

    border-radius: var(--radius-lg);

    background:
        linear-gradient(
            145deg,
            rgba(255,255,255,.045),
            rgba(255,255,255,.018)
        );

    box-shadow:
        var(--og-shadow);

    backdrop-filter:
        blur(16px);
}

body.light-mode .sidebar-card {

    background:
        rgba(255,255,255,.82);
}


/* NAV */

.community-nav {

    display: flex;

    flex-direction: column;

    gap: 5px;
}

.community-nav-link {

    min-height: 44px;

    display: flex;

    align-items: center;

    gap: 12px;

    padding:
        0 12px;

    border-radius: 11px;

    color: var(--og-muted);

    font-size: 12px;

    font-weight: 700;

    transition:
        all .22s var(--ease);
}

.community-nav-link:hover,
.community-nav-link.active {

    color: var(--og-white);

    background:
        linear-gradient(
            90deg,
            rgba(0,150,255,.14),
            rgba(0,230,255,.045)
        );

    box-shadow:
        inset 3px 0 0 var(--og-cyan);
}

.community-nav-link .nav-icon {

    width: 27px;
    height: 27px;

    display: grid;

    place-items: center;

    border-radius: 8px;

    background:
        rgba(255,255,255,.04);

    font-size: 14px;
}


/* QG CARD */

.qg-card {

    padding: 18px;

    border:
        1px solid rgba(0,190,255,.2);

    border-radius: var(--radius-lg);

    background:
        radial-gradient(
            circle at 100% 0%,
            rgba(0,200,255,.13),
            transparent 55%
        ),
        rgba(3,14,24,.8);

    overflow: hidden;

    position: relative;
}

.qg-card::after {

    content: "";

    position: absolute;

    width: 90px;
    height: 90px;

    right: -40px;
    top: -40px;

    border-radius: 50%;

    border:
        1px solid rgba(0,220,255,.25);

    box-shadow:
        0 0 30px rgba(0,190,255,.12);
}

.qg-title {

    color: var(--og-cyan);

    font-size: 10px;

    font-weight: 900;

    letter-spacing: 1.8px;

    margin-bottom: 8px;
}

.qg-text {

    color: var(--og-muted);

    font-size: 11px;

    line-height: 1.55;
}


/* ========================================================================
   MAIN FEED
   ======================================================================== */

.community-feed {

    min-width: 0;

    display: flex;

    flex-direction: column;

    gap: 16px;
}


/* HERO */

.community-hero {

    position: relative;

    overflow: hidden;

    padding: 26px;

    min-height: 180px;

    border:
        1px solid rgba(0,184,255,.22);

    border-radius:
        var(--radius-xl);

    background:

        radial-gradient(
            circle at 90% 20%,
            rgba(0,222,255,.18),
            transparent 38%
        ),

        radial-gradient(
            circle at 20% 100%,
            rgba(0,90,255,.18),
            transparent 45%
        ),

        linear-gradient(
            135deg,
            rgba(8,23,39,.95),
            rgba(3,9,17,.95)
        );

    box-shadow:
        0 25px 70px rgba(0,0,0,.4),
        inset 0 1px rgba(255,255,255,.05);
}

body.light-mode .community-hero {

    background:
        radial-gradient(
            circle at 90% 10%,
            rgba(0,175,255,.13),
            transparent 40%
        ),
        linear-gradient(
            135deg,
            #ffffff,
            #eaf6ff
        );
}

.hero-kicker {

    color: var(--og-cyan);

    font-size: 10px;

    font-weight: 900;

    letter-spacing: 2px;

    margin-bottom: 10px;
}

.community-hero h1 {

    margin: 0;

    max-width: 500px;

    color: var(--og-white);

    font-size:
        clamp(25px, 4vw, 36px);

    line-height: 1.05;

    letter-spacing: -1px;
}

.community-hero h1 span {

    background:
        linear-gradient(
            90deg,
            #fff,
            #00cfff,
            #008dff
        );

    -webkit-background-clip: text;

    -webkit-text-fill-color: transparent;
}

.hero-description {

    max-width: 530px;

    margin:
        13px 0 20px;

    color: var(--og-muted);

    font-size: 12px;

    line-height: 1.6;
}

.hero-actions {

    display: flex;

    gap: 8px;

    flex-wrap: wrap;
}


/* BUTTONS */

.primary-button,
.secondary-button {

    min-height: 40px;

    padding:
        0 15px;

    border-radius: 10px;

    display: inline-flex;

    align-items: center;

    justify-content: center;

    gap: 7px;

    font-size: 11px;

    font-weight: 900;

    transition:
        all .25s var(--ease);
}

.primary-button {

    color: #00131e;

    border: 0;

    background:
        linear-gradient(
            135deg,
            #00efff,
            #0087ff
        );

    box-shadow:
        0 7px 25px rgba(0,165,255,.25);
}

.primary-button:hover {

    transform:
        translateY(-2px);

    box-shadow:
        0 12px 35px rgba(0,180,255,.38);
}

.secondary-button {

    color: var(--og-text);

    background:
        rgba(255,255,255,.045);

    border:
        1px solid var(--og-border);
}

.secondary-button:hover {

    border-color:
        rgba(0,200,255,.35);

    color:
        var(--og-cyan);
}


/* ========================================================================
   CREATE POST
   ======================================================================== */

.create-post {

    padding: 17px;

    border:
        1px solid var(--og-border);

    border-radius:
        var(--radius-lg);

    background:
        var(--og-panel);

    box-shadow:
        var(--og-shadow);

    backdrop-filter:
        blur(18px);
}

.create-post-top {

    display: flex;

    gap: 11px;

    align-items: flex-start;
}

.create-avatar {

    flex:
        0 0 auto;

    width: 40px;
    height: 40px;

    display: grid;
    place-items: center;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #006aff,
            #00d9ff
        );

    color: white;

    font-weight: 900;
}

.fake-input {

    flex: 1;

    min-height: 42px;

    display: flex;

    align-items: center;

    padding:
        0 14px;

    border:
        1px solid var(--og-border);

    border-radius: 12px;

    color: var(--og-muted);

    background:
        rgba(255,255,255,.025);

    font-size: 12px;

    cursor: pointer;

    transition:
        all .2s;
}

.fake-input:hover {

    border-color:
        rgba(0,190,255,.35);

    color:
        var(--og-text);
}

.create-actions {

    display: grid;

    grid-template-columns:
        repeat(4,1fr);

    gap: 7px;

    margin-top: 13px;
}

.create-action {

    min-height: 37px;

    border:
        1px solid var(--og-border);

    border-radius: 10px;

    background:
        rgba(255,255,255,.025);

    color: var(--og-muted);

    font-size: 10px;

    font-weight: 800;

    transition:
        all .2s;
}

.create-action:hover {

    color: var(--og-cyan);

    border-color:
        rgba(0,200,255,.28);

    background:
        rgba(0,170,255,.06);
}


/* ========================================================================
   POST
   ======================================================================== */

.community-post {

    border:
        1px solid var(--og-border);

    border-radius:
        var(--radius-lg);

    background:
        var(--og-panel);

    box-shadow:
        var(--og-shadow);

    overflow: hidden;

    backdrop-filter:
        blur(18px);

    transition:
        border .25s,
        transform .25s;
}

.community-post:hover {

    border-color:
        rgba(0,160,255,.17);
}

.post-header {

    display: flex;

    align-items: center;

    gap: 11px;

    padding:
        17px 17px 10px;
}

.post-avatar {

    width: 42px;
    height: 42px;

    flex:
        0 0 auto;

    display: grid;

    place-items: center;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #081b30,
            #0079ff
        );

    border:
        1px solid rgba(0,195,255,.35);

    color: white;

    font-weight: 900;
}

.post-author {

    min-width: 0;

    display: flex;

    flex-direction: column;
}

.post-author-name {

    display: flex;

    align-items: center;

    gap: 5px;

    color: var(--og-white);

    font-size: 12px;

    font-weight: 900;
}

.verified {

    color:
        var(--og-cyan);

    font-size: 10px;
}

.post-meta {

    color: var(--og-muted);

    font-size: 9px;

    margin-top: 3px;
}

.post-menu {

    margin-left: auto;

    border: 0;

    background: transparent;

    color: var(--og-muted);

    font-size: 18px;
}

.post-content {

    padding:
        5px 17px 15px;
}

.post-content p {

    margin: 0;

    color: var(--og-text);

    font-size: 13px;

    line-height: 1.65;

    white-space: pre-line;
}


/* POST TAG */

.post-tag {

    display: inline-flex;

    margin-top: 13px;

    padding:
        5px 8px;

    border-radius: 7px;

    background:
        rgba(0,185,255,.07);

    border:
        1px solid rgba(0,185,255,.15);

    color:
        var(--og-cyan);

    font-size: 8px;

    font-weight: 900;

    letter-spacing: 1px;
}


/* POST ACTIONS */

.post-actions {

    display: flex;

    align-items: center;

    border-top:
        1px solid var(--og-border);

    padding:
        8px 12px;
}

.post-action {

    flex: 1;

    height: 38px;

    border: 0;

    border-radius: 9px;

    background: transparent;

    color: var(--og-muted);

    font-size: 10px;

    font-weight: 800;

    transition:
        all .2s;
}

.post-action:hover {

    color:
        var(--og-cyan);

    background:
        rgba(0,180,255,.05);
}

.post-action.liked {

    color:
        var(--og-cyan);

    text-shadow:
        0 0 10px rgba(0,220,255,.45);
}


/* ========================================================================
   RIGHT SIDEBAR
   ======================================================================== */

.widget-title {

    display: flex;

    justify-content: space-between;

    align-items: center;

    margin-bottom: 14px;

    color: var(--og-white);

    font-size: 11px;

    font-weight: 900;
}

.widget-title span {

    color:
        var(--og-cyan);

    font-size: 9px;

    letter-spacing: 1px;
}

.trend {

    display: flex;

    flex-direction: column;

    gap: 3px;

    padding:
        9px 0;

    border-bottom:
        1px solid var(--og-border);
}

.trend:last-child {
    border-bottom: 0;
}

.trend small {

    color: var(--og-muted);

    font-size: 8px;
}

.trend strong {

    color: var(--og-text);

    font-size: 11px;
}

.trend span {

    color: var(--og-muted);

    font-size: 8px;
}


/* RANK */

.rank-item {

    display: flex;

    align-items: center;

    gap: 9px;

    padding: 8px 0;
}

.rank-number {

    width: 22px;
    height: 22px;

    display: grid;
    place-items: center;

    border-radius: 7px;

    color: var(--og-cyan);

    background:
        rgba(0,180,255,.07);

    font-size: 9px;

    font-weight: 900;
}

.rank-avatar {

    width: 29px;
    height: 29px;

    display: grid;
    place-items: center;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #0a2945,
            #006aff
        );

    color: white;

    font-size: 9px;

    font-weight: 900;
}

.rank-info {

    flex: 1;

    min-width: 0;
}

.rank-info strong {

    display: block;

    color: var(--og-text);

    font-size: 9px;
}

.rank-info span {

    color: var(--og-muted);

    font-size: 8px;
}


/* ========================================================================
   MOBILE BOTTOM NAV
   ======================================================================== */

.mobile-bottom-nav {

    display: none;

    position: fixed;

    left: 10px;
    right: 10px;
    bottom: 10px;

    z-index: 200;

    height: 64px;

    padding:
        6px;

    border:
        1px solid rgba(0,190,255,.2);

    border-radius: 19px;

    background:
        rgba(5,11,18,.92);

    backdrop-filter:
        blur(22px);

    box-shadow:
        0 20px 50px rgba(0,0,0,.55);
}

body.light-mode .mobile-bottom-nav {

    background:
        rgba(255,255,255,.92);
}

.mobile-nav-item {

    flex: 1;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;

    gap: 3px;

    border: 0;

    border-radius: 13px;

    background: transparent;

    color: var(--og-muted);

    font-size: 8px;

    font-weight: 800;
}

.mobile-nav-item span:first-child {

    font-size: 17px;
}

.mobile-nav-item.active {

    color:
        var(--og-cyan);

    background:
        rgba(0,190,255,.08);
}


/* ========================================================================
   THEME TOGGLE
   ======================================================================== */

.theme-switch {

    position: fixed;

    right: 20px;
    bottom: 20px;

    z-index: 250;

    width: 46px;
    height: 46px;

    border-radius: 50%;

    border:
        1px solid rgba(0,190,255,.25);

    background:
        rgba(7,14,22,.9);

    color:
        var(--og-cyan);

    box-shadow:
        0 8px 30px rgba(0,0,0,.35);

    transition:
        all .25s;
}

.theme-switch:hover {

    transform:
        rotate(18deg)
        scale(1.06);

    box-shadow:
        0 0 25px rgba(0,200,255,.2);
}

body.light-mode .theme-switch {

    background:
        rgba(255,255,255,.95);
}


/* ========================================================================
   MODAL PUBLICATION
   ======================================================================== */

.publish-overlay {

    position: fixed;

    inset: 0;

    z-index: 500;

    display: none;

    align-items: center;

    justify-content: center;

    padding: 20px;

    background:
        rgba(0,0,0,.72);

    backdrop-filter:
        blur(12px);
}

.publish-overlay.open {
    display: flex;
}

.publish-modal {

    width: 100%;

    max-width: 620px;

    max-height: 90vh;

    overflow-y: auto;

    padding: 22px;

    border:
        1px solid rgba(0,190,255,.25);

    border-radius: 22px;

    background:
        #07101a;

    box-shadow:
        0 30px 100px rgba(0,0,0,.7),
        0 0 50px rgba(0,170,255,.08);
}

body.light-mode .publish-modal {
    background: #fff;
}

.modal-header {

    display: flex;

    align-items: center;

    justify-content: space-between;

    margin-bottom: 20px;
}

.modal-header h2 {

    margin: 0;

    color: var(--og-white);

    font-size: 18px;
}

.modal-close {

    width: 35px;
    height: 35px;

    border: 0;

    border-radius: 9px;

    background:
        rgba(255,255,255,.05);

    color: var(--og-muted);

    font-size: 18px;
}

.publish-textarea {

    width: 100%;

    min-height: 170px;

    resize: vertical;

    border:
        1px solid var(--og-border);

    border-radius: 14px;

    padding: 14px;

    outline: 0;

    background:
        rgba(255,255,255,.025);

    color: var(--og-white);

    font-size: 13px;

    line-height: 1.6;
}

.publish-textarea:focus {

    border-color:
        rgba(0,200,255,.4);

    box-shadow:
        0 0 0 4px rgba(0,170,255,.06);
}

.modal-tools {

    display: grid;

    grid-template-columns:
        repeat(3,1fr);

    gap: 8px;

    margin:
        12px 0;
}

.modal-tool {

    min-height: 40px;

    border:
        1px solid var(--og-border);

    border-radius: 10px;

    background:
        rgba(255,255,255,.025);

    color: var(--og-muted);

    font-size: 10px;

    font-weight: 800;
}

.modal-publish {

    width: 100%;

    height: 46px;

    border: 0;

    border-radius: 12px;

    background:
        linear-gradient(
            135deg,
            #00eaff,
            #007cff
        );

    color:
        #00111c;

    font-weight: 1000;

    box-shadow:
        0 10px 30px rgba(0,145,255,.22);
}


/* ========================================================================
   RESPONSIVE TABLET
   ======================================================================== */

@media (max-width: 1200px) {

    .community-layout {

        grid-template-columns:
            210px
            minmax(400px, 1fr);

        max-width: 1050px;
    }

    .community-right-sidebar {
        display: none;
    }
}


/* ========================================================================
   RESPONSIVE MOBILE
   ======================================================================== */

@media (max-width: 760px) {

    .community-header {

        height: 60px;

        padding:
            0 13px;

        gap: 8px;
    }

    .community-logo {

        min-width: auto;
    }

    .community-logo-text span {
        display: none;
    }

    .community-logo-text strong {
        font-size: 13px;
    }

    .community-logo-mark {

        width: 34px;
        height: 34px;
    }

    .community-search {

        order: 3;

        position: absolute;

        top: 67px;

        left: 12px;
        right: 12px;

        max-width: none;

        height: 40px;
    }

    .community-header-actions {

        gap: 4px;
    }

    .header-profile {
        display: none;
    }

    .community-layout {

        display: block;

        padding:
            58px 10px 90px;
    }

    .community-left-sidebar,
    .community-right-sidebar {

        display: none;
    }

    .community-feed {

        width: 100%;
    }

    .community-hero {

        min-height: auto;

        padding:
            22px 18px;

        border-radius: 19px;
    }

    .community-hero h1 {

        font-size: 27px;
    }

    .hero-description {

        font-size: 11px;
    }

    .hero-actions {

        display: grid;

        grid-template-columns:
            1fr 1fr;
    }

    .primary-button,
    .secondary-button {

        width: 100%;

        min-height: 42px;
    }

    .create-post {

        padding: 13px;

        border-radius: 16px;
    }

    .create-actions {

        grid-template-columns:
            repeat(2,1fr);
    }

    .community-post {

        border-radius: 16px;
    }

    .post-header {

        padding:
            14px 13px 9px;
    }

    .post-content {

        padding:
            5px 13px 13px;
    }

    .post-actions {

        padding:
            6px;
    }

    .post-action {

        font-size: 9px;
    }

    .mobile-bottom-nav {

        display: flex;
    }

    .theme-switch {

        right: 12px;

        bottom: 84px;

        width: 40px;
        height: 40px;

        font-size: 14px;
    }
}


/* ========================================================================
   VERY SMALL PHONES
   ======================================================================== */

@media (max-width: 380px) {

    .community-layout {

        padding-left: 7px;
        padding-right: 7px;
    }

    .community-hero h1 {
        font-size: 24px;
    }

    .create-action {
        font-size: 9px;
    }

    .mobile-bottom-nav {
        left: 6px;
        right: 6px;
    }
}

`;


// ============================================================================
// HTML
// ============================================================================

router.get("/", requireAuth, async (req, res) => {

    const postsHtml = POSTS.map(post => {

        return `
        <article
            class="community-post"
            data-post-id="${post.id}"
        >

            <div class="post-header">

                <div class="post-avatar">
                    ${post.initials}
                </div>

                <div class="post-author">

                    <div class="post-author-name">

                        ${post.author}

                        ${
                            post.verified
                                ? `<span class="verified">✓</span>`
                                : ""
                        }

                    </div>

                    <div class="post-meta">

                        ${post.grade}
                        ·
                        ${post.time}

                    </div>

                </div>

                <button
                    class="post-menu"
                    onclick="postMenu(${post.id})"
                >
                    ⋯
                </button>

            </div>


            <div class="post-content">

                <p>${post.text}</p>

                ${
                    post.tag
                        ? `
                            <span class="post-tag">
                                #${post.tag}
                            </span>
                        `
                        : ""
                }

            </div>


            <div class="post-actions">

                <button
                    class="post-action"
                    onclick="likePost(this)"
                >
                    ❤️
                    <span>${post.likes}</span>
                </button>

                <button
                    class="post-action"
                    onclick="openComments(${post.id})"
                >
                    💬
                    <span>${post.comments}</span>
                </button>

                <button
                    class="post-action"
                    onclick="sharePost(${post.id})"
                >
                    ↗
                    <span>${post.shares}</span>
                </button>

                <button
                    class="post-action"
                    onclick="savePost(this)"
                >
                    🔖
                    Enregistrer
                </button>

            </div>

        </article>
        `;

    }).join("");


    res.send(`

<!DOCTYPE html>

<html lang="fr">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    >

    <meta
        name="theme-color"
        content="#030508"
    >

    <title>
        Community — OG Technology | SAMII OS
    </title>

    <style>

        ${COMMUNITY_CSS}

    </style>

</head>


<body>

<div class="community-app">


    <!-- ================================================================
         BACKGROUND
         ================================================================ -->

    <div class="community-background">

        <div class="community-grid"></div>

        <div class="community-orb one"></div>

        <div class="community-orb two"></div>

    </div>


    <!-- ================================================================
         HEADER
         ================================================================ -->

    <header class="community-header">


        <a
            href="/community"
            class="community-logo"
        >

            <div class="community-logo-mark">
                OG
            </div>

            <div class="community-logo-text">

                <strong>
                    OG TECHNOLOGY
                </strong>

                <span>
                    SAMII COMMUNITY
                </span>

            </div>

        </a>


        <div class="community-search">

            <span class="community-search-icon">
                ⌕
            </span>

            <input
                id="communitySearch"
                type="search"
                placeholder="Rechercher dans la communauté..."
                autocomplete="off"
            >

        </div>


        <div class="community-header-actions">


            <button
                class="icon-button notification-button"
                onclick="showNotification()"
                title="Notifications"
            >

                🔔

                <span
                    class="notification-dot"
                ></span>

            </button>


            <button
                class="icon-button"
                onclick="openPublish()"
                title="Publier"
            >
                ＋
            </button>


            <div class="header-profile">

                <div class="profile-avatar">
                    S
                </div>

                <div class="profile-name">

                    <strong>
                        Mon QG
                    </strong>

                    <span>
                        SOLDAT
                    </span>

                </div>

            </div>

        </div>

    </header>


    <!-- ================================================================
         MAIN LAYOUT
         ================================================================ -->

    <main class="community-layout">


        <!-- ============================================================
             LEFT SIDEBAR
             ============================================================ -->

        <aside
            class="community-sidebar community-left-sidebar"
        >


            <div class="sidebar-card">

                <nav class="community-nav">


                    <a
                        href="/community"
                        class="community-nav-link active"
                    >

                        <span class="nav-icon">
                            ⌂
                        </span>

                        Accueil

                    </a>


                    <a
                        href="/qg"
                        class="community-nav-link"
                    >

                        <span class="nav-icon">
                            ◈
                        </span>

                        Mon QG

                    </a>


                    <a
                        href="/marketplace"
                        class="community-nav-link"
                    >

                        <span class="nav-icon">
                            🛒
                        </span>

                        Marketplace

                    </a>


                    <a
                        href="/arsenal"
                        class="community-nav-link"
                    >

                        <span class="nav-icon">
                            🛡
                        </span>

                        Arsenal

                    </a>


                    <a
                        href="#"
                        class="community-nav-link"
                        onclick="comingSoon(event,'Mon réseau')"
                    >

                        <span class="nav-icon">
                            ◉
                        </span>

                        Mon réseau

                    </a>


                    <a
                        href="#"
                        class="community-nav-link"
                        onclick="comingSoon(event,'Groupes')"
                    >

                        <span class="nav-icon">
                            ◎
                        </span>

                        Groupes

                    </a>


                    <a
                        href="#"
                        class="community-nav-link"
                        onclick="comingSoon(event,'Enregistrés')"
                    >

                        <span class="nav-icon">
                            🔖
                        </span>

                        Enregistrés

                    </a>

                </nav>

            </div>


            <div class="qg-card">

                <div class="qg-title">
                    SAMII CORE
                </div>

                <div class="qg-text">

                    Votre communauté est connectée
                    à l'écosystème SAMII.

                    <br><br>

                    Publiez, échangez, développez
                    votre réseau et progressez
                    dans les grades.

                </div>

            </div>


        </aside>


        <!-- ============================================================
             FEED
             ============================================================ -->

        <section class="community-feed">


            <!-- HERO -->

            <section class="community-hero">

                <div class="hero-kicker">
                    OG TECHNOLOGY / COMMUNITY
                </div>

                <h1>
                    Le réseau où
                    <span>
                        tout l'écosystème SAMII
                    </span>
                    se rencontre.
                </h1>

                <p class="hero-description">

                    Clients, marchands, créateurs,
                    partenaires et membres peuvent
                    publier, échanger et construire
                    ensemble.

                </p>

                <div class="hero-actions">

                    <button
                        class="primary-button"
                        onclick="openPublish()"
                    >
                        ＋ Publier
                    </button>

                    <a
                        href="/marketplace"
                        class="secondary-button"
                    >
                        🛒 Marketplace
                    </a>

                </div>

            </section>


            <!-- CREATE -->

            <section class="create-post">


                <div class="create-post-top">

                    <div class="create-avatar">
                        S
                    </div>

                    <div
                        class="fake-input"
                        onclick="openPublish()"
                    >
                        Que voulez-vous partager
                        avec la communauté ?
                    </div>

                </div>


                <div class="create-actions">

                    <button
                        class="create-action"
                        onclick="openPublish('photo')"
                    >
                        📷 Photo
                    </button>

                    <button
                        class="create-action"
                        onclick="openPublish('video')"
                    >
                        🎥 Vidéo
                    </button>

                    <button
                        class="create-action"
                        onclick="openPublish('product')"
                    >
                        🛒 Produit
                    </button>

                    <button
                        class="create-action"
                        onclick="openPublish('service')"
                    >
                        ⚡ Service
                    </button>

                </div>


            </section>


            <!-- FEED -->

            ${postsHtml}


        </section>


        <!-- ============================================================
             RIGHT SIDEBAR
             ============================================================ -->

        <aside
            class="community-sidebar community-right-sidebar"
        >


            <!-- TRENDS -->

            <div class="sidebar-card">

                <div class="widget-title">

                    Tendances

                    <span>
                        LIVE
                    </span>

                </div>


                <div class="trend">

                    <small>
                        #1 · COMMUNAUTÉ
                    </small>

                    <strong>
                        SAMII Technology
                    </strong>

                    <span>
                        1 284 publications
                    </span>

                </div>


                <div class="trend">

                    <small>
                        #2 · MARKETPLACE
                    </small>

                    <strong>
                        Nouvelles offres
                    </strong>

                    <span>
                        742 publications
                    </span>

                </div>


                <div class="trend">

                    <small>
                        #3 · BUSINESS
                    </small>

                    <strong>
                        Entrepreneurs du Maghreb
                    </strong>

                    <span>
                        526 publications
                    </span>

                </div>

            </div>


            <!-- RANKING -->

            <div class="sidebar-card">

                <div class="widget-title">

                    Classement SAMII

                    <span>
                        TOP
                    </span>

                </div>


                <div class="rank-item">

                    <div class="rank-number">
                        1
                    </div>

                    <div class="rank-avatar">
                        S
                    </div>

                    <div class="rank-info">

                        <strong>
                            Samii Core
                        </strong>

                        <span>
                            GÉNÉRAL · 12 840 pts
                        </span>

                    </div>

                </div>


                <div class="rank-item">

                    <div class="rank-number">
                        2
                    </div>

                    <div class="rank-avatar">
                        M
                    </div>

                    <div class="rank-info">

                        <strong>
                            Marchand Pro
                        </strong>

                        <span>
                            COLONEL · 8 420 pts
                        </span>

                    </div>

                </div>


                <div class="rank-item">

                    <div class="rank-number">
                        3
                    </div>

                    <div class="rank-avatar">
                        A
                    </div>

                    <div class="rank-info">

                        <strong>
                            Alpha Store
                        </strong>

                        <span>
                            COMMANDANT · 6 210 pts
                        </span>

                    </div>

                </div>

            </div>


            <!-- ECOSYSTEM -->

            <div class="sidebar-card">

                <div class="widget-title">

                    Écosystème

                </div>

                <div class="qg-text">

                    <strong
                        style="color:var(--og-cyan)"
                    >
                        QG
                    </strong>
                    · Pilotez votre activité

                    <br><br>

                    <strong
                        style="color:var(--og-cyan)"
                    >
                        MARKETPLACE
                    </strong>
                    · Achetez & vendez

                    <br><br>

                    <strong
                        style="color:var(--og-cyan)"
                    >
                        ARSENAL
                    </strong>
                    · Débloquez vos cartes

                </div>

            </div>


        </aside>


    </main>


    <!-- ================================================================
         MOBILE NAVIGATION
         ================================================================ -->

    <nav class="mobile-bottom-nav">


        <button
            class="mobile-nav-item active"
            onclick="window.location='/community'"
        >

            <span>
                ⌂
            </span>

            Accueil

        </button>


        <button
            class="mobile-nav-item"
            onclick="comingSoon(null,'Réseau')"
        >

            <span>
                ◉
            </span>

            Réseau

        </button>


        <button
            class="mobile-nav-item"
            onclick="openPublish()"
        >

            <span>
                ＋
            </span>

            Publier

        </button>


        <button
            class="mobile-nav-item"
            onclick="window.location='/marketplace'"
        >

            <span>
                🛒
            </span>

            Market

        </button>


        <button
            class="mobile-nav-item"
            onclick="window.location='/qg'"
        >

            <span>
                ◈
            </span>

            QG

        </button>


    </nav>


    <!-- ================================================================
         THEME
         ================================================================ -->

    <button
        class="theme-switch"
        id="themeSwitch"
        onclick="toggleTheme()"
        aria-label="Changer le thème"
    >
        ☾
    </button>


    <!-- ================================================================
         PUBLICATION MODAL
         ================================================================ -->

    <div
        id="publishOverlay"
        class="publish-overlay"
        onclick="closePublishOutside(event)"
    >

        <div class="publish-modal">


            <div class="modal-header">

                <h2>
                    Nouvelle publication
                </h2>

                <button
                    class="modal-close"
                    onclick="closePublish()"
                >
                    ×
                </button>

            </div>


            <textarea
                id="publishText"
                class="publish-textarea"
                placeholder="Partagez quelque chose avec la communauté..."
            ></textarea>


            <div class="modal-tools">

                <button
                    class="modal-tool"
                    onclick="selectPublishType('photo')"
                >
                    📷 Photo
                </button>

                <button
                    class="modal-tool"
                    onclick="selectPublishType('video')"
                >
                    🎥 Vidéo
                </button>

                <button
                    class="modal-tool"
                    onclick="selectPublishType('product')"
                >
                    🛒 Produit
                </button>

            </div>


            <button
                class="modal-publish"
                onclick="publishPost()"
            >
                PUBLIER DANS LA COMMUNAUTÉ
            </button>


        </div>

    </div>


</div>


<script>


// ========================================================================
// THEME
// ========================================================================

const savedTheme =
    localStorage.getItem("samii-community-theme");

if (savedTheme === "light") {

    document.body.classList.add("light-mode");

    document
        .getElementById("themeSwitch")
        .innerText = "☀";

}


function toggleTheme() {

    document.body.classList.toggle("light-mode");

    const isLight =
        document.body.classList.contains("light-mode");

    localStorage.setItem(
        "samii-community-theme",
        isLight ? "light" : "dark"
    );

    document
        .getElementById("themeSwitch")
        .innerText =
            isLight ? "☀" : "☾";
}


// ========================================================================
// PUBLICATION
// ========================================================================

let selectedPublishType = "text";


function openPublish(type = "text") {

    selectedPublishType = type;

    document
        .getElementById("publishOverlay")
        .classList.add("open");

    setTimeout(() => {

        document
            .getElementById("publishText")
            .focus();

    }, 100);

}


function closePublish() {

    document
        .getElementById("publishOverlay")
        .classList.remove("open");

}


function closePublishOutside(event) {

    if (
        event.target.id ===
        "publishOverlay"
    ) {

        closePublish();

    }

}


function selectPublishType(type) {

    selectedPublishType = type;

    const textarea =
        document.getElementById("publishText");

    const labels = {

        photo:
            "Décrivez votre photo ou partagez quelque chose avec la communauté...",

        video:
            "Présentez votre vidéo à la communauté...",

        product:
            "Présentez votre produit Marketplace...",

        service:
            "Présentez votre service...",

        text:
            "Partagez quelque chose avec la communauté..."

    };

    textarea.placeholder =
        labels[type] || labels.text;

    textarea.focus();

}


function publishPost() {

    const textarea =
        document.getElementById("publishText");

    const text =
        textarea.value.trim();

    if (!text) {

        alert(
            "Écrivez quelque chose avant de publier."
        );

        textarea.focus();

        return;
    }

    /*
     * FUTUR :
     *
     * POST /community/api/posts
     *
     * Airtable :
     * COMMUNITY_POSTS
     *
     * Pour l'instant on prépare
     * l'interface sans inventer
     * de backend.
     */

    alert(
        "Publication prête pour la connexion au moteur Community SAMII."
    );

    textarea.value = "";

    closePublish();

}


// ========================================================================
// LIKE
// ========================================================================

function likePost(button) {

    button.classList.toggle("liked");

    const counter =
        button.querySelector("span");

    if (!counter) return;

    let value =
        parseInt(counter.innerText, 10) || 0;

    if (button.classList.contains("liked")) {

        value++;

    } else {

        value--;

    }

    counter.innerText =
        Math.max(0, value);

}


// ========================================================================
// SAVE
// ========================================================================

function savePost(button) {

    if (
        button.dataset.saved === "1"
    ) {

        button.dataset.saved = "0";

        button.innerHTML =
            "🔖 Enregistrer";

    } else {

        button.dataset.saved = "1";

        button.innerHTML =
            "✅ Enregistré";

    }

}


// ========================================================================
// SHARE
// ========================================================================

async function sharePost(id) {

    const url =
        window.location.origin +
        "/community#post-" +
        id;

    try {

        if (
            navigator.share
        ) {

            await navigator.share({

                title:
                    "SAMII Community",

                text:
                    "Découvre cette publication sur SAMII Community.",

                url

            });

        } else {

            await navigator.clipboard.writeText(url);

            alert(
                "Lien copié."
            );

        }

    } catch (error) {

        console.log(
            "Partage annulé."
        );

    }

}


// ========================================================================
// COMMENTS
// ========================================================================

function openComments(id) {

    alert(
        "Système de commentaires Community — connexion backend à venir."
    );

}


// ========================================================================
// POST MENU
// ========================================================================

function postMenu(id) {

    alert(
        "Options de publication : signaler, masquer, enregistrer."
    );

}


// ========================================================================
// SEARCH
// ========================================================================

const searchInput =
    document.getElementById(
        "communitySearch"
    );

if (searchInput) {

    searchInput.addEventListener(
        "input",
        function () {

            const query =
                this.value
                    .trim()
                    .toLowerCase();

            const posts =
                document.querySelectorAll(
                    ".community-post"
                );

            posts.forEach(post => {

                const text =
                    post.innerText
                        .toLowerCase();

                post.style.display =
                    !query ||
                    text.includes(query)
                        ? ""
                        : "none";

            });

        }
    );

}


// ========================================================================
// NOTIFICATIONS
// ========================================================================

function showNotification() {

    alert(
        "Centre de notifications SAMII — prêt pour la connexion aux événements."
    );

}


// ========================================================================
// COMING SOON
// ========================================================================

function comingSoon(event, name) {

    if (event) {

        event.preventDefault();

    }

    alert(
        name +
        " sera connecté au moteur Community SAMII."
    );

}


</script>


</body>

</html>

    `);

});


module.exports = router;
