// ==========================================================================
// OG EMPIRE — SYSTÈME I18N (réutilisable sur tout le projet)
// ==========================================================================

const Language = (function () {
    const SUPPORTED = ["fr", "en", "ar", "zh"];
    const DEFAULT_LANG = "en";
    const STORAGE_KEY = "og_lang";

    let currentLang = DEFAULT_LANG;
    let dict = {};
    const listeners = [];

    function detectLang() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.includes(stored)) return stored;
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

    async function set(lang) {
        if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
        dict = await loadDict(lang);
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        updateDirection(lang);
        updateActiveButtons(lang);
        translate();
        listeners.forEach((cb) => cb(lang, dict));
    }

    async function init() {
        const lang = detectLang();
        await set(lang);
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

    function getLang() {
        return currentLang;
    }

    return { init, set, translate, onChange, getDict, getLang };
})();

document.addEventListener("DOMContentLoaded", () => {
    Language.init();
});
