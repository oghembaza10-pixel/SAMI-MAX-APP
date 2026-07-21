// ==========================================================================
// OG EMPIRE — HUB : Moteur front-end (vitrine premium, pas de dashboard)
// ==========================================================================

// Liste des métiers (id + icône fixes, le texte vient du dictionnaire i18n)
const METIERS = [
    { id: "ecommerce",   icon: "shopping-cart",  mood: "mood-ecommerce" },
    { id: "restaurant",  icon: "utensils",        mood: "mood-restaurant" },
    { id: "immobilier",  icon: "building-2",      mood: "mood-immobilier" },
    { id: "livreur",     icon: "bike",            mood: "mood-livreur" },
    { id: "sante",       icon: "heart-pulse",     mood: "mood-sante" },
    { id: "finance",     icon: "trending-up",     mood: "mood-finance" },
    { id: "education",   icon: "graduation-cap",  mood: "mood-education" },
    { id: "technologie", icon: "cpu",             mood: "mood-technologie" },
    { id: "agriculture", icon: "leaf",            mood: "mood-agriculture" },
    { id: "industrie",   icon: "factory",         mood: "mood-industrie" },
    { id: "services",    icon: "briefcase",       mood: "mood-services" },
    { id: "tourisme",    icon: "plane",           mood: "mood-tourisme" },
];

const PLATFORMS = [
    { id: "instagram", label: "Instagram", icon: "instagram",      color: "#E1306C", connectRoute: "/connect/instagram" },
    { id: "tiktok",    label: "TikTok",    icon: "music-2",        color: "#25F4EE", connectRoute: "/connect/tiktok" },
    { id: "facebook",  label: "Facebook",  icon: "facebook",       color: "#1877F2", connectRoute: "/connect/facebook" },
    { id: "whatsapp",  label: "WhatsApp",  icon: "message-circle", color: "#25D366", connectRoute: "/connect/whatsapp" },
    { id: "youtube",   label: "YouTube",   icon: "youtube",        color: "#FF0000", connectRoute: "/connect/youtube" },
    { id: "linkedin",  label: "LinkedIn",  icon: "linkedin",       color: "#0A66C2", connectRoute: "/connect/linkedin" },
    { id: "x",         label: "X",         icon: "twitter",        color: "#E7E9EA", connectRoute: "/connect/x" },
    { id: "pinterest", label: "Pinterest", icon: "image",          color: "#E60023", connectRoute: "/connect/pinterest" },
    { id: "shopify",   label: "Shopify",   icon: "shopping-bag",   color: "#95BF47", connectRoute: "/connect/shopify" },
    { id: "discord",   label: "Discord",   icon: "message-square", color: "#5865F2", connectRoute: "/connect/discord" },
    { id: "telegram",  label: "Telegram",  icon: "send",           color: "#229ED9", connectRoute: "/connect/telegram" },
    { id: "stripe",    label: "Stripe",    icon: "credit-card",    color: "#635BFF", connectRoute: "/connect/stripe" },
    { id: "paypal",    label: "PayPal",    icon: "wallet",         color: "#00457C", connectRoute: "/connect/paypal" },
    { id: "google",    label: "Google",    icon: "chrome",         color: "#4285F4", connectRoute: "/connect/google" },
    { id: "notion",    label: "Notion",    icon: "file-text",      color: "#EDEDED", connectRoute: "/connect/notion" },
    { id: "openai",    label: "OpenAI",    icon: "sparkles",       color: "#10A37F", connectRoute: "/connect/openai" },
    { id: "claude",    label: "Claude",    icon: "bot",            color: "#D97757", connectRoute: "/connect/claude" },
];

// Traductions de secours si i18n.js n'est pas encore chargé (sécurité)
const FALLBACK_METIER_TEXT = {
    ecommerce:   { label: "E-commerce",   desc: "Commerce en ligne" },
    restaurant:  { label: "Restaurant",   desc: "Restauration & food" },
    immobilier:  { label: "Immobilier",   desc: "Biens & propriétés" },
    livreur:     { label: "Livreur",      desc: "Livraison & logistique" },
    sante:       { label: "Santé",        desc: "Santé & bien-être" },
    finance:     { label: "Finance",      desc: "Finance & invest." },
    education:   { label: "Éducation",    desc: "Formation & savoir" },
    technologie: { label: "Technologie",  desc: "Tech & innovation" },
    agriculture: { label: "Agriculture",  desc: "Culture & agriculture" },
    industrie:   { label: "Industrie",    desc: "Production & usine" },
    services:    { label: "Services",     desc: "Services pro" },
    tourisme:    { label: "Tourisme",     desc: "Voyage & tourisme" },
};

function getMetierText(id) {
    if (typeof Language !== "undefined" && Language.getDict) {
        const dict = Language.getDict();
        if (dict && dict.hub && dict.hub.metiers && dict.hub.metiers[id]) {
            return dict.hub.metiers[id];
        }
    }
    return FALLBACK_METIER_TEXT[id] || { label: id, desc: "" };
}

function getMetierMoreText() {
    if (typeof Language !== "undefined" && Language.getDict) {
        const dict = Language.getDict();
        if (dict && dict.hub && dict.hub.metierMore) return dict.hub.metierMore;
    }
    return "Plus de métiers";
}

function renderMetierGrid() {
    const grid = document.getElementById("metier-grid");
    if (!grid) return;

    grid.innerHTML = METIERS.map(m => {
        const t = getMetierText(m.id);
        return `
        <a class="metier-card" href="/qg/${m.id}" data-metier="${m.id}">
            <div class="metier-card__media ${m.mood}">
                <i class="metier-card__watermark" data-lucide="${m.icon}"></i>
                <div class="metier-card__shade"></div>
            </div>
            <div class="metier-card__body">
                <i data-lucide="${m.icon}"></i>
                <div>
                    <h3>${t.label}</h3>
                    <span>${t.desc}</span>
                </div>
            </div>
        </a>
    `;
    }).join("") + `
        <a class="metier-card more" href="/metiers">
            <i data-lucide="plus-circle"></i>
            <h3>${getMetierMoreText()}</h3>
        </a>
    `;

    if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderSidebarPlatforms() {
    const wrap = document.getElementById("og-sidebar-platforms");
    if (!wrap) return;

    const connected = window.OG_CONNECTED_PLATFORMS || [];

    wrap.innerHTML = PLATFORMS.map(p => {
        const isConnected = connected.includes(p.id);
        return `
            <button
                class="og-platform${isConnected ? " connected" : ""}"
                type="button"
                style="--brand-color:${p.color}"
                data-platform="${p.id}"
                data-connect-route="${p.connectRoute}"
                title="${p.label}${isConnected ? " — connecté" : " — cliquer pour connecter"}"
                aria-label="${p.label}"
            >
                <i data-lucide="${p.icon}"></i>
                ${isConnected ? '<span class="og-platform__dot"></span>' : ""}
            </button>
        `;
    }).join("");

    wrap.querySelectorAll(".og-platform").forEach(btn => {
        btn.addEventListener("click", () => {
            const alreadyConnected = btn.classList.contains("connected");
            window.location.href = alreadyConnected ? "/settings#connexions" : btn.dataset.connectRoute;
        });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
    renderMetierGrid();
    renderSidebarPlatforms();

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Re-rendu des cartes métier quand la langue change
    if (typeof Language !== "undefined" && Language.onChange) {
        Language.onChange(() => {
            renderMetierGrid();
        });
    }

    // Sidebar : état actif au clic
    const navItems = document.querySelectorAll(".og-item");
    navItems.forEach(item => {
        item.addEventListener("click", function () {
            navItems.forEach(i => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    // Recherche premium du hero
    const heroSearch = document.getElementById("hero-search");
    if (heroSearch) {
        heroSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && heroSearch.value.trim()) {
                window.location.href = "/metiers?q=" + encodeURIComponent(heroSearch.value.trim());
            }
        });
    }

    // Widget SAMII : ouverture / fermeture
    const samiiWidget = document.getElementById("samii-widget");
    const samiiTrigger = document.getElementById("samii-widget-trigger");
    const samiiClose = document.getElementById("samii-widget-close");

    function openSamii() { if (samiiWidget) samiiWidget.dataset.open = "true"; }
    function closeSamii() { if (samiiWidget) samiiWidget.dataset.open = "false"; }

    if (samiiTrigger) samiiTrigger.addEventListener("click", openSamii);
    if (samiiClose) samiiClose.addEventListener("click", closeSamii);

    const samiiForm = document.getElementById("samii-widget-form");
    if (samiiForm) {
        samiiForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("samii-widget-input");
            const feed = document.getElementById("samii-widget-feed");
            const message = input.value.trim();
            if (!message) return;

            feed.insertAdjacentHTML("beforeend", `
                <div class="samii-msg samii-msg--user">
                    <div class="samii-msg__bubble">${message}</div>
                </div>
            `);
            input.value = "";
            feed.scrollTop = feed.scrollHeight;

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message }),
                });
                const data = await res.json();
                feed.insertAdjacentHTML("beforeend", `
                    <div class="samii-msg samii-msg--bot">
                        <div class="samii-msg__bubble">${data.reply}</div>
                    </div>
                `);
                feed.scrollTop = feed.scrollHeight;
            } catch (err) {
                console.error(err);
            }
        });
    }
});
