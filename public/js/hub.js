/* ==========================================================================
   OG EMPIRE — HUB FRONTEND LOGIC (hub.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialiser les icônes Lucide
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // 2. Données dynamiques injectées par le serveur
    const workspaces = window.OG_WORKSPACES || [];
    const connectedPlatforms = window.OG_CONNECTED_PLATFORMS || [];
    const currentWorkspaceId = window.OG_WORKSPACE_ID || "";

    console.log("🛡️ [OG HUB] Initialisé. Workspaces:", workspaces.length);

    // 3. Rendu dynamique des métiers
    renderMetiers();

    // 4. Gestion de la recherche dans le Hero
    setupSearch();

    // 5. Gestion du widget SAMII
    setupSamiiWidget();
});

/* --------------------------------------------------------------------------
   Rendu des cartes métiers
   -------------------------------------------------------------------------- */
function renderMetiers(filterText = "") {
    const grid = document.getElementById("metier-grid");
    if (!grid) return;

    const metiersList = [
        { name: "E-commerce", icon: "shopping-bag" },
        { name: "Restaurant", icon: "utensils" },
        { name: "Immobilier", icon: "home" },
        { name: "Santé", icon: "activity" },
        { name: "Éducation", icon: "book-open" },
        { name: "Finance", icon: "trending-up" },
        { name: "Industrie", icon: "cpu" },
        { name: "Agriculture", icon: "shrub" },
        { name: "Tourisme", icon: "plane" },
        { name: "Services", icon: "briefcase" },
        { name: "Technologie", icon: "terminal" }
    ];

    const filtered = metiersList.filter(m => 
        m.name.toLowerCase().includes(filterText.toLowerCase())
    );

    grid.innerHTML = "";

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1; padding: 20px 0;">Aucun empire correspondant trouvé.</p>`;
        return;
    }

    filtered.forEach(metier => {
        const card = document.createElement("a");
        card.href = "#";
        card.className = "metier-card";
        card.innerHTML = `
            <div class="metier-card__media">
                <i data-lucide="${metier.icon}" class="metier-card__watermark"></i>
            </div>
            <div class="metier-card__body">
                <i data-lucide="${metier.icon}"></i>
                <div>
                    <h3>${metier.name}</h3>
                    <span>Lancer le QG</span>
                </div>
            </div>
        `;

        card.addEventListener("click", (e) => {
            e.preventDefault();
            triggerMetierCreation(metier.name);
        });

        grid.appendChild(card);
    });

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

/* --------------------------------------------------------------------------
   Barre de recherche interactive
   -------------------------------------------------------------------------- */
function setupSearch() {
    const searchInput = document.getElementById("hero-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        renderMetiers(e.target.value.trim());
    });
}

/* --------------------------------------------------------------------------
   Déclenchement de création de QG par métier
   -------------------------------------------------------------------------- */
function triggerMetierCreation(metierName) {
    const feed = document.getElementById("samii-widget-feed");
    const widget = document.getElementById("samii-widget");
    
    if (widget) {
        widget.setAttribute("data-open", "true");
    }

    if (feed) {
        const msg = document.createElement("div");
        msg.className = "samii-msg samii-msg--bot";
        msg.innerHTML = `
            <div class="samii-msg__bubble">
                Excellent choix, Général. Vous avez sélectionné le secteur <b>${metierName}</b>.<br>
                Voulez-vous que j'initialise votre structure de données pour ce QG ?
            </div>
        `;
        feed.appendChild(msg);
        feed.scrollTop = feed.scrollHeight;
    }
}

/* --------------------------------------------------------------------------
   Gestion du Widget SAMII
   -------------------------------------------------------------------------- */
function setupSamiiWidget() {
    const widget = document.getElementById("samii-widget");
    const trigger = document.getElementById("samii-widget-trigger");
    const closeBtn = document.getElementById("samii-widget-close");
    const form = document.getElementById("samii-widget-form");
    const input = document.getElementById("samii-widget-input");
    const feed = document.getElementById("samii-widget-feed");

    if (!widget || !trigger) return;

    trigger.addEventListener("click", () => {
        const isOpen = widget.getAttribute("data-open") === "true";
        widget.setAttribute("data-open", isOpen ? "false" : "true");
        if (!isOpen && input) input.focus();
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            widget.setAttribute("data-open", "false");
        });
    }

    if (form && input && feed) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            const userMsg = document.createElement("div");
            userMsg.className = "samii-msg samii-msg--user";
            userMsg.innerHTML = `<div class="samii-msg__bubble">${escapeHtml(text)}</div>`;
            feed.appendChild(userMsg);

            input.value = "";
            feed.scrollTop = feed.scrollHeight;

            setTimeout(() => {
                const botMsg = document.createElement("div");
                botMsg.className = "samii-msg samii-msg--bot";
                botMsg.innerHTML = `
                    <div class="samii-msg__bubble">
                        Reçu, Général. Je traite votre directive "${escapeHtml(text)}" à travers l'écosystème.
                    </div>
                `;
                feed.appendChild(botMsg);
                feed.scrollTop = feed.scrollHeight;
            }, 600);
        });
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
