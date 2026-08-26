// ==========================================================================
// OG TECHNOLOGY — SYSTÈME I18N (réutilisable sur tout le projet)
// ==========================================================================

const Language = (function () {
    const SUPPORTED = ["fr", "en", "ar", "zh"];
    const DEFAULT_LANG = "fr";
    // Même clé que le reste de l'app (page d'accueil, QG, hub, espace client,
    // qui lisent tous localStorage "samii_lang"). Avant, ce module stockait la
    // langue sous "og_lang" : la langue choisie ailleurs n'était jamais reprise
    // ici, et ces pages s'affichaient en anglais alors que tout le reste était
    // en français. "og_lang" reste lu en secours pour ne pas perdre le choix
    // des utilisateurs déjà passés par ces pages.
    const STORAGE_KEY = "samii_lang";
    const STORAGE_KEY_LEGACY = "og_lang";

    let currentLang = DEFAULT_LANG;
    let dict = {};
    const listeners = [];

    function detectLang() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.includes(stored)) return stored;
        const ancien = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (ancien && SUPPORTED.includes(ancien)) return ancien;
        const navLang = (navigator.language || navigator.userLanguage || "").slice(0, 2).toLowerCase();
        if (SUPPORTED.includes(navLang)) return navLang;
        return DEFAULT_LANG;
    }

    async function loadDict(lang) {
        const res = await fetch(`/i18n/${lang}.json`);
        if (!res.ok) {
            console.error(`i18n: impossible de charger /i18n/${lang}.json`);
            return {};
        }
        return res.json();
    }

    function getNested(obj, path) {
        return path.split(".").reduce(
            (acc, key) => (acc && acc[key] !== undefined ? acc[key] : null),
            obj
        );
    }

    function translate() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            const value = getNested(dict, key);
            if (value !== null) {
                el.textContent = value;
            }
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
            const key = el.getAttribute("data-i18n-placeholder");
            const value = getNested(dict, key);
            if (value !== null) {
                el.setAttribute("placeholder", value);
            }
        });

        // Les infobulles étaient déjà annotées data-i18n-title dans plusieurs
        // vues (QG, tour de contrôle) mais rien ne les traduisait : elles
        // restaient en français quelle que soit la langue choisie.
        document.querySelectorAll("[data-i18n-title]").forEach((el) => {
            const key = el.getAttribute("data-i18n-title");
            const value = getNested(dict, key);
            if (value !== null) {
                el.setAttribute("title", value);
            }
        });
    }

    function updateDirection(lang) {
        document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = lang;
    }

    function updateActiveButtons(lang) {
        document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
        });
    }

    // Le site a deux moteurs de traduction : celui-ci, qui réécrit la page
    // dans le navigateur, et celui du serveur (services/langue.js) qui rend
    // l'Académie et les pages légales déjà traduites. Chacun se souvenait du
    // choix de son côté — l'un dans localStorage, l'autre en session. On
    // passait le QG en arabe, on cliquait vers l'Académie, et tout revenait
    // en français.
    //
    // Cette ligne fait des deux mémoires une seule : on dépose le choix au
    // serveur. On n'attend pas la réponse et on ignore l'échec — la page
    // courante est déjà traduite quand la requête part ; au pire, c'est la
    // page suivante qui reviendrait au français. Une panne dégrade, elle ne
    // casse rien.
    function declarerAuServeur(lang) {
        try { fetch("/langue/" + encodeURIComponent(lang), { credentials: "same-origin" }); } catch (e) {}
    }

    async function set(lang, silencieux) {
        if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
        dict = await loadDict(lang);
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        updateDirection(lang);
        updateActiveButtons(lang);
        translate();
        // `silencieux` sert au démarrage : au premier affichage, on applique
        // la langue déjà connue sans la redéclarer — le serveur la connaît
        // déjà, et une requête à chaque chargement de page ne sert à rien.
        if (!silencieux) declarerAuServeur(lang);
        listeners.forEach((cb) => cb(lang, dict));
    }

    async function init() {
        const lang = detectLang();
        await set(lang, true);   // silencieux : premier affichage, rien à déclarer
        document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
            btn.addEventListener("click", () => set(btn.getAttribute("data-lang-btn")));
        });
    }

    function onChange(callback) {
        listeners.push(callback);
    }

    function getDict() {
        return dict;
    }

    // Pour les textes que produit le JavaScript et qu'aucun data-i18n ne peut
    // atteindre : messages de formulaire, confirmations, libellés de bouton
    // réécrits au clic. Ils restaient en français sur une page entièrement
    // traduite. Le repli est le texte français d'origine — une clé absente du
    // dictionnaire n'affiche jamais « agence.msg.reseau » à un utilisateur.
    function t(key, repli) {
        const value = getNested(dict, key);
        return value !== null && value !== undefined ? value : (repli !== undefined ? repli : key);
    }

    function getLang() {
        return currentLang;
    }

    return { init, set, translate, onChange, getDict, getLang, t };
})();

// Ce fichier est inclus de deux façons : par une balise <script> écrite dans
// le gabarit, et — depuis la barre de langue partagée — injecté à l'exécution
// sur les pages qui ne l'avaient pas. Dans le second cas, DOMContentLoaded a
// déjà eu lieu quand le fichier arrive : n'écouter que cet événement laissait
// ces pages entièrement en français, avec un sélecteur de langue inerte.
// Vu en capture d'écran sur /agence/api, pas déduit du code.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { Language.init(); });
} else {
    Language.init();
}
