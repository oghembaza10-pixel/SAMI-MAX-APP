// ======================================================
// SAMII OS — Hub Frontend
// ======================================================
// Le Hub affiche les workspaces de l'utilisateur.
// Au clic → POST /hub/select-workspace → redirect /qg
// Il ne connaît pas Airtable, SAMII, ni les connecteurs.
// ======================================================

// ── Helper — échapper le HTML (protection XSS) ───────
function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#39;");
}

// ── Verrou anti double-clic ───────────────────────────
let selectingWorkspace = false;

// ── Liste des métiers ─────────────────────────────────
const METIERS = [
    { id: "ecommerce",   icon: "shopping-cart",  mood: "mood-ecommerce"   },
    { id: "restaurant",  icon: "utensils",        mood: "mood-restaurant"  },
    { id: "immobilier",  icon: "building-2",      mood: "mood-immobilier"  },
    { id: "livreur",     icon: "bike",            mood: "mood-livreur"     },
    { id: "sante",       icon: "heart-pulse",     mood: "mood-sante"       },
    { id: "finance",     icon: "trending-up",     mood: "mood-finance"     },
    { id: "education",   icon: "graduation-cap",  mood: "mood-education"   },
    { id: "technologie", icon: "cpu",             mood: "mood-technologie" },
    { id: "agriculture", icon: "leaf",            mood: "mood-agriculture" },
    { id: "industrie",   icon: "factory",         mood: "mood-industrie"   },
    { id: "services",    icon: "briefcase",       mood: "mood-services"    },
    { id: "tourisme",    icon: "plane",           mood: "mood-tourisme"    },
];

const PLATFORMS = [
    { id: "instagram", label: "Instagram", icon: "instagram",      color: "#E1306C", connectRoute: "/connect/instagram" },
    { id: "tiktok",    label: "TikTok",    icon: "music-2",        color: "#25F4EE", connectRoute: "/connect/tiktok"    },
    { id: "facebook",  label: "Facebook",  icon: "facebook",       color: "#1877F2", connectRoute: "/connect/facebook"  },
    { id: "whatsapp",  label: "WhatsApp",  icon: "message-circle", color: "#25D366", connectRoute: "/connect/whatsapp"  },
    { id: "youtube",   label: "YouTube",   icon: "youtube",        color: "#FF0000", connectRoute: "/connect/youtube"   },
    { id: "linkedin",  label: "LinkedIn",  icon: "linkedin",       color: "#0A66C2", connectRoute: "/connect/linkedin"  },
    { id: "x",         label: "X",         icon: "twitter",        color: "#E7E9EA", connectRoute: "/connect/x"         },
    { id: "pinterest", label: "Pinterest", icon: "image",          color: "#E60023", connectRoute: "/connect/pinterest" },
    { id: "shopify",   label: "Shopify",   icon: "shopping-bag",   color: "#95BF47", connectRoute: "/connect/shopify"   },
    { id: "discord",   label: "Discord",   icon: "message-square", color: "#5865F2", connectRoute: "/connect/discord"   },
    { id: "telegram",  label: "Telegram",  icon: "send",           color: "#229ED9", connectRoute: "/connect/telegram"  },
    { id: "stripe",    label: "Stripe",    icon: "credit-card",    color: "#635BFF", connectRoute: "/connect/stripe"    },
    { id: "paypal",    label: "PayPal",    icon: "wallet",         color: "#00457C", connectRoute: "/connect/paypal"    },
    { id: "google",    label: "Google",    icon: "chrome",         color: "#4285F4", connectRoute: "/connect/google"    },
    { id: "notion",    label: "Notion",    icon: "file-text",      color: "#EDEDED", connectRoute: "/connect/notion"    },
    { id: "openai",    label: "OpenAI",    icon: "sparkles",       color: "#10A37F", connectRoute: "/connect/openai"    },
    { id: "claude",    label: "Claude",    icon: "bot",            color: "#D97757", connectRoute: "/connect/claude"    },
];

const FALLBACK_METIER_TEXT = {
    ecommerce:   { label: "E-commerce",   desc: "Commerce en ligne"      },
    restaurant:  { label: "Restaurant",   desc: "Restauration & food"    },
    immobilier:  { label: "Immobilier",   desc: "Biens & propriétés"     },
    livreur:     { label: "Livreur",      desc: "Livraison & logistique" },
    sante:       { label: "Santé",        desc: "Santé & bien-être"      },
    finance:     { label: "Finance",      desc: "Finance & invest."      },
    education:   { label: "Éducation",    desc: "Formation & savoir"     },
    technologie: { label: "Technologie",  desc: "Tech & innovation"      },
    agriculture: { label: "Agriculture",  desc: "Culture & agriculture"  },
    industrie:   { label: "Industrie",    desc: "Production & usine"     },
    services:    { label: "Services",     desc: "Services pro"           },
    tourisme:    { label: "Tourisme",     desc: "Voyage & tourisme"      },
};

// ── Helpers texte ─────────────────────────────────────
function getMetierText(id) {
    if (typeof Language !== "undefined" && Language.getDict) {
        const dict = Language.getDict();
        if (dict?.hub?.metiers?.[id]) return dict.hub.metiers[id];
    }
    return FALLBACK_METIER_TEXT[id] || { label: id, desc: "" };
}

function getMetierMoreText() {
    if (typeof Language !== "undefined" && Language.getDict) {
        const dict = Language.getDict();
        if (dict?.hub?.metierMore) return dict.hub.metierMore;
    }
    return "Plus de métiers";
}

// ── Afficher une erreur utilisateur ──────────────────
function afficherErreurHub(message) {
    let el = document.getElementById("hub-error-msg");
    if (!el) {
        el           = document.createElement("div");
        el.id        = "hub-error-msg";
        el.className = "hub-error-msg";
        const grid   = document.getElementById("metier-grid");
        if (grid) grid.before(el);
    }
    el.textContent   = message;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 5000);
}

// ── Sélectionner un workspace ─────────────────────────
async function selectWorkspace(btn) {
    // ✅ Verrou anti double-clic
    if (selectingWorkspace) return;
    selectingWorkspace = true;
    btn.disabled       = true;

    try {
        const res = await fetch("/hub/select-workspace", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ workspaceId: btn.dataset.workspaceId }),
        });

        // ✅ Vérifier res.ok avant res.json()
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data.success && data.redirect) {
            window.location.href = data.redirect;
        } else {
            afficherErreurHub("Impossible d'ouvrir ce Workspace. Réessayez dans quelques secondes.");
        }

    } catch (err) {
        console.error("❌ select-workspace :", err.message);
        afficherErreurHub("Impossible d'ouvrir ce Workspace. Réessayez dans quelques secondes.");

    } finally {
        // ✅ Toujours réactiver le bouton
        btn.disabled       = false;
        selectingWorkspace = false;
    }
}
// ── Render workspaces existants ───────────────────────
function renderWorkspaces() {
    // ✅ Éviter le doublon
    const existing = document.getElementById("hub-workspaces-section");
    if (existing) existing.remove();

    const workspaces = window.OG_WORKSPACES || [];
    if (workspaces.length === 0) return;

    const container = document.getElementById("metier-grid");
    if (!container) return;

    const section     = document.createElement("div");
    section.id        = "hub-workspaces-section";
    section.className = "hub-section";
    section.innerHTML = `
        <div class="section-eyebrow">
            <i data-lucide="folder-open"></i>
            <span>Mes Workspaces</span>
        </div>
        <div class="hub-workspaces" id="hub-workspaces">
            ${workspaces.map(ws => {
                const m = METIERS.find(x => x.id === ws.metier) || { icon: "briefcase", mood: "" };
                const t = getMetierText(ws.metier);
                return `
                    <button class="metier-card" type="button"
                            data-workspace-id="${escapeHtml(ws.workspaceId)}"
                            data-metier="${escapeHtml(ws.metier)}">
                        <div class="metier-card__media ${m.mood}">
                            <i class="metier-card__watermark" data-lucide="${m.icon}"></i>
                            <div class="metier-card__shade"></div>
                        </div>
                        <div class="metier-card__body">
                            <i data-lucide="${m.icon}"></i>
                            <div>
                                <h3>${escapeHtml(ws.nom || t.label)}</h3>
                                <span>${escapeHtml(t.desc)}</span>
                            </div>
                        </div>
                    </button>
                `;
            }).join("")}
            <a class="metier-card more" href="/workspace/create">
                <i data-lucide="plus-circle"></i>
                <h3>Nouveau workspace</h3>
            </a>
        </div>
    `;

    container.before(section);

    if (typeof lucide !== "undefined") lucide.createIcons();

    section.querySelectorAll(".metier-card[data-workspace-id]").forEach(btn => {
        btn.addEventListener("click", () => selectWorkspace(btn));
    });
}


// ── Render grille métiers (toujours visible) ──────────
function renderMetiers() {
    const grid = document.getElementById("metier-grid");
    if (!grid) return;

    grid.innerHTML = METIERS.map(m => {
        const t = getMetierText(m.id);
        return `
            <a class="metier-card" href="/workspace/create?metier=${m.id}"
               data-metier="${m.id}">
                <div class="metier-card__media ${m.mood}">
                    <i class="metier-card__watermark" data-lucide="${m.icon}"></i>
                    <div class="metier-card__shade"></div>
                </div>
                <div class="metier-card__body">
                    <i data-lucide="${m.icon}"></i>
                    <div>
                        <h3>${escapeHtml(t.label)}</h3>
                        <span>${escapeHtml(t.desc)}</span>
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

// ── Render grille complète ────────────────────────────
function renderMetierGrid() {
    renderWorkspaces();
    renderMetiers();
}



// ── Render plateformes sidebar ────────────────────────
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
            window.location.href = btn.classList.contains("connected")
                ? "/settings#connexions"
                : btn.dataset.connectRoute;
        });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// ── DOMContentLoaded ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    renderMetierGrid();
    renderSidebarPlatforms();

    if (typeof lucide !== "undefined") lucide.createIcons();

    if (typeof Language !== "undefined" && Language.onChange) {
        Language.onChange(() => renderMetierGrid());
    }

    // Navigation sidebar
    const navItems = document.querySelectorAll(".og-item");
    navItems.forEach(item => {
        item.addEventListener("click", function () {
            navItems.forEach(i => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    // Recherche hero
    const heroSearch = document.getElementById("hero-search");
    if (heroSearch) {
        heroSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && heroSearch.value.trim()) {
                window.location.href = "/metiers?q=" + encodeURIComponent(heroSearch.value.trim());
            }
        });
    }

    // ── Widget SAMII ──────────────────────────────────
    const samiiWidget  = document.getElementById("samii-widget");
    const samiiTrigger = document.getElementById("samii-widget-trigger");
    const samiiClose   = document.getElementById("samii-widget-close");

    if (samiiTrigger) samiiTrigger.addEventListener("click", () => {
        if (samiiWidget) samiiWidget.dataset.open = "true";
    });
    if (samiiClose) samiiClose.addEventListener("click", () => {
        if (samiiWidget) samiiWidget.dataset.open = "false";
    });

    const samiiForm = document.getElementById("samii-widget-form");
    if (samiiForm) {
        samiiForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input   = document.getElementById("samii-widget-input");
            const feed    = document.getElementById("samii-widget-feed");
            const message = input.value.trim();
            if (!message) return;

            feed.insertAdjacentHTML("beforeend", `
                <div class="samii-msg samii-msg--user">
                    <div class="samii-msg__bubble">${escapeHtml(message)}</div>
                </div>
            `);
            input.value    = "";
            feed.scrollTop = feed.scrollHeight;

            try {
                // ✅ workspaceId lu côté serveur via session
                const res = await fetch("/api/chat", {
                    method : "POST",
                    headers: { "Content-Type": "application/json" },
                    body   : JSON.stringify({ message }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();
                feed.insertAdjacentHTML("beforeend", `
                    <div class="samii-msg samii-msg--bot">
                        <div class="samii-msg__bubble">${escapeHtml(data.reply || "")}</div>
                    </div>
                `);
                feed.scrollTop = feed.scrollHeight;

            } catch (err) {
                console.error("❌ SAMII chat :", err.message);
            }
        });
    }
});
