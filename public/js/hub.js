// ==========================================================================
// OG EMPIRE — HUB : Moteur front-end (vitrine, pas de dashboard)
// ==========================================================================

// Liste des métiers. "route" correspond à /qg/:metier côté serveur (index.js).
const METIERS = [
    { id: "ecommerce",    label: "E-commerce",    desc: "Commerce en ligne",     icon: "shopping-cart" },
    { id: "restaurant",   label: "Restaurant",    desc: "Restauration & food",   icon: "utensils" },
    { id: "immobilier",   label: "Immobilier",    desc: "Biens & propriétés",    icon: "building-2" },
    { id: "livreur",      label: "Livreur",       desc: "Livraison & logistique",icon: "bike" },
    { id: "sante",        label: "Santé",         desc: "Santé & bien-être",     icon: "heart-pulse" },
    { id: "finance",      label: "Finance",       desc: "Finance & invest.",     icon: "trending-up" },
    { id: "education",    label: "Éducation",     desc: "Formation & savoir",    icon: "graduation-cap" },
    { id: "technologie",  label: "Technologie",   desc: "Tech & innovation",     icon: "cpu" },
    { id: "agriculture",  label: "Agriculture",   desc: "Culture & agriculture", icon: "leaf" },
    { id: "industrie",    label: "Industrie",     desc: "Production & usine",    icon: "factory" },
    { id: "services",     label: "Services",      desc: "Services pro",          icon: "briefcase" },
    { id: "tourisme",     label: "Tourisme",      desc: "Voyage & tourisme",     icon: "plane" },
];

// Plateformes connectables. "connectRoute" = endpoint OAuth/connexion côté serveur.
// Le serveur peut injecter window.OG_CONNECTED_PLATFORMS = ["instagram", "google", ...]
const PLATFORMS = [
    { id: "instagram", label: "Instagram", logo: "/img/logos/instagram.svg", connectRoute: "/connect/instagram" },
    { id: "tiktok",    label: "TikTok",    logo: "/img/logos/tiktok.svg",    connectRoute: "/connect/tiktok" },
    { id: "whatsapp",  label: "WhatsApp",  logo: "/img/logos/whatsapp.svg",  connectRoute: "/connect/whatsapp" },
    { id: "meta",      label: "Meta",      logo: "/img/logos/meta.svg",      connectRoute: "/connect/meta" },
    { id: "google",    label: "Google",    logo: "/img/logos/google.svg",    connectRoute: "/connect/google" },
    { id: "stripe",    label: "Stripe",    logo: "/img/logos/stripe.svg",    connectRoute: "/connect/stripe" },
    { id: "shopify",   label: "Shopify",   logo: "/img/logos/shopify.svg",   connectRoute: "/connect/shopify" },
    { id: "linkedin",  label: "LinkedIn",  logo: "/img/logos/linkedin.svg",  connectRoute: "/connect/linkedin" },
    { id: "youtube",   label: "YouTube",   logo: "/img/logos/youtube.svg",   connectRoute: "/connect/youtube" },
    { id: "gmail",     label: "Gmail",     logo: "/img/logos/gmail.svg",     connectRoute: "/connect/gmail" },
    { id: "telegram",  label: "Telegram",  logo: "/img/logos/telegram.svg",  connectRoute: "/connect/telegram" },
    { id: "discord",   label: "Discord",   logo: "/img/logos/discord.svg",   connectRoute: "/connect/discord" },
];

function renderMetierGrid() {
    const grid = document.getElementById("metier-grid");
    if (!grid) return;

    grid.innerHTML = METIERS.map(m => `
        <a class="metier-card" href="/qg/${m.id}" data-metier="${m.id}">
            <i data-lucide="${m.icon}"></i>
            <h3>${m.label}</h3>
            <span>${m.desc}</span>
        </a>
    `).join("") + `
        <a class="metier-card more" href="/metiers">
            <i data-lucide="plus-circle"></i>
            <h3>Plus de métiers</h3>
        </a>
    `;
}

function renderPlatformGrid() {
    const grid = document.getElementById("platform-grid");
    if (!grid) return;

    const connected = window.OG_CONNECTED_PLATFORMS || [];

    grid.innerHTML = PLATFORMS.map(p => {
        const isConnected = connected.includes(p.id);
        return `
            <button
                class="platform-logo${isConnected ? " connected" : ""}"
                type="button"
                data-platform="${p.id}"
                data-connect-route="${p.connectRoute}"
                aria-label="${p.label}${isConnected ? " (connecté)" : " (non connecté)"}"
                title="${p.label}${isConnected ? " — connecté" : " — cliquer pour connecter"}"
            >
                <img src="${p.logo}" alt="${p.label}">
            </button>
        `;
    }).join("");

    grid.querySelectorAll(".platform-logo").forEach(btn => {
        btn.addEventListener("click", () => {
            const alreadyConnected = btn.classList.contains("connected");
            const route = btn.dataset.connectRoute;
            if (alreadyConnected) {
                window.location.href = "/settings#connexions";
            } else {
                window.location.href = route;
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderMetierGrid();
    renderPlatformGrid();

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    const navItems = document.querySelectorAll(".og-item");
    navItems.forEach(item => {
        item.addEventListener("click", function () {
            navItems.forEach(i => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    const samiiWidget = document.getElementById("samii-widget");
    const samiiTrigger = document.getElementById("samii-widget-trigger");
    const samiiClose = document.getElementById("samii-widget-close");
    const samiiMiniButtons = document.querySelectorAll("#samii-open, .samii-mini");

    function openSamii() { if (samiiWidget) samiiWidget.dataset.open = "true"; }
    function closeSamii() { if (samiiWidget) samiiWidget.dataset.open = "false"; }

    if (samiiTrigger) samiiTrigger.addEventListener("click", openSamii);
    if (samiiClose) samiiClose.addEventListener("click", closeSamii);
    samiiMiniButtons.forEach(btn => btn.addEventListener("click", openSamii));

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

// ==========================================================================
// i18n — conservé pour compatibilité avec le futur sélecteur de langue
// ==========================================================================
const capitolTranslations = {
    fr: { eyebrow: "Bienvenue, Général",  hero: "Ton empire commence ici.", sub: "Choisis ton premier QG et construis ton héritage." },
    en: { eyebrow: "Welcome, General",    hero: "Your empire starts here.", sub: "Choose your first HQ and build your legacy." },
    ar: { eyebrow: "أهلاً أيها الجنرال",  hero: "إمبراطوريتك تبدأ هنا.",     sub: "اختر مقرك الأول وابنِ إرثك." },
};

function switchCapitolLang(lang) {
    const t = capitolTranslations[lang];
    if (!t) return;
    const eyebrow = document.querySelector(".hero-eyebrow");
    const title = document.querySelector(".hero-text-zone h1");
    const sub = document.querySelector(".hero-text-zone p");
    if (eyebrow) eyebrow.textContent = t.eyebrow;
    if (title) title.textContent = t.hero;
    if (sub) sub.textContent = t.sub;
}
