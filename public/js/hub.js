// ==========================================================================
// OG TECHNOLOGY — HUB : Moteur front-end (vitrine premium, pas de dashboard)
// ==========================================================================

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

// Traductions de secours si i18n.js n'est pas encore chargé
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
      <a class="metier-card" href="/register?metier=${m.id}" data-metier="${m.id}">
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
// ── Toast simple pour "bientôt disponible" ──────────────────────────
function showHubToast(message) {
    let toast = document.getElementById("hub-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "hub-toast";
        toast.className = "hub-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("hub-toast--visible");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove("hub-toast--visible"), 2800);
}

// ── Panneau de recherche : 3 options ─────────────────────────────────
function initSearchPanel() {
    const wrap = document.querySelector(".hero-search-wrap");
    const input = document.getElementById("hero-search");
    const panel = document.getElementById("hero-search-panel");
    if (!wrap || !input || !panel) return;

    function openPanel() { wrap.classList.add("open"); }
    function closePanel() { wrap.classList.remove("open"); }

    input.addEventListener("focus", openPanel);
    input.addEventListener("input", openPanel);

    // Ferme le panneau si on clique en dehors
    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) closePanel();
    });

    panel.querySelectorAll(".hero-search__option").forEach(btn => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action;
            const query = input.value.trim();

            if (action === "create") {
                const url = query
                    ? `/inscription?metier=${encodeURIComponent(query)}`
                    : `/inscription`;
                window.location.href = url;
            } else if (action === "invite") {
                showHubToast(typeof t === "function" ? t("hub.toast.inviteSoon") : "Inviter un collaborateur — bientôt disponible");
                closePanel();
            } else if (action === "find") {
                showHubToast(typeof t === "function" ? t("hub.toast.searchSoon") : "Chercher un QG — bientôt disponible");
                closePanel();
            }
        });
    });

    const searchBtn = document.getElementById("hero-search-btn");
    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            const query = input.value.trim();
            window.location.href = query
                ? `/inscription?metier=${encodeURIComponent(query)}`
                : `/inscription`;
        });
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const query = input.value.trim();
            window.location.href = query
                ? `/inscription?metier=${encodeURIComponent(query)}`
                : `/inscription`;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderMetierGrid();
    initSearchPanel();

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
