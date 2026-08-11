// ======================================================
// SAMII OS — Connect Tools Frontend
// ======================================================
// Tout se passe sur la même page.
// Pas de redirect sauf OAuth (Shopify, Facebook, Meta).
// ======================================================

if (typeof lucide !== "undefined") lucide.createIcons();

// ── Afficher message succès ───────────────────────────
function showSuccess(message) {
    const el = document.getElementById("connect-success");
    if (!el) return;
    el.textContent   = message;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
}

// ── Afficher message erreur ───────────────────────────
function showError(message) {
    const el = document.getElementById("connect-error");
    if (!el) return;
    el.textContent   = message;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 5000);
}

// ── Mettre à jour la carte visuellement ──────────────
function updateCard(toolId, connected, info = "") {
    const card = document.getElementById(`card-${toolId}`);
    if (!card) return;

    // Badge statut
    const badge = card.querySelector(".connect-tool-card__status");
    if (badge) {
        badge.innerHTML = connected
            ? `<span class="og-badge og-badge--live">✅ Connecté</span>`
            : `<span class="og-badge og-badge--off">🔴 Non connecté</span>`;
    }

    // Classe connected
    if (connected) {
        card.classList.add("connected");
    } else {
        card.classList.remove("connected");
    }
}

// ── Sauvegarder un connecteur (API) ──────────────────
async function saveConnector(toolId, value) {
    try {
        const res = await fetch("/connect/tools/save", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ toolId, value }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();

    } catch (err) {
        console.error("❌ saveConnector :", err.message);
        return { success: false, error: err.message };
    }
}

// ── Déconnecter un connecteur (API) ──────────────────
async function disconnectConnector(toolId) {
    try {
        const res = await fetch("/connect/tools/disconnect", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ toolId }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();

    } catch (err) {
        console.error("❌ disconnectConnector :", err.message);
        return { success: false, error: err.message };
    }
}

// ── Gérer les formulaires inline ──────────────────────
document.querySelectorAll(".connect-inline-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const toolId  = form.dataset.tool;
        const action  = form.dataset.action;
        const btn     = form.querySelector("button[type='submit']");
        const input   = form.querySelector(".connect-input");

        if (btn) { btn.disabled = true; btn.textContent = "Connexion..."; }

        try {
            // ── OAuth redirect (Shopify) ──────────────
            if (action === "oauth") {
                const shop = input?.value?.trim() || "";
                if (!shop) {
                    showError("Entre l'URL de ta boutique Shopify.");
                    return;
                }
                let shopUrl = shop.toLowerCase();
                if (!shopUrl.includes(".myshopify.com")) shopUrl += ".myshopify.com";
                window.location.href = `/auth/shopify?shop=${encodeURIComponent(shopUrl)}`;
                return;
            }

            // ── Token manuel Shopify (app custom, sans OAuth) ──
            if (action === "shopify-token") {
                const shop  = form.querySelector('input[name="shop"]')?.value?.trim() || "";
                const token = form.querySelector('input[name="token"]')?.value?.trim() || "";

                if (!shop || !token) {
                    showError("Renseigne l'URL de ta boutique et le token.");
                    if (btn) { btn.disabled = false; btn.textContent = "Connecter avec le token →"; }
                    return;
                }

                const res = await fetch("/auth/shopify/token", {
                    method : "POST",
                    headers: { "Content-Type": "application/json" },
                    body   : JSON.stringify({ shop, token }),
                });
                const data = await res.json();

                if (data.success) {
                    showSuccess(`✅ Shopify connecté : ${data.boutique}`);
                    setTimeout(() => window.location.reload(), 1200);
                } else {
                    showError(data.error || "Erreur. Réessaye.");
                    if (btn) { btn.disabled = false; btn.textContent = "Connecter avec le token →"; }
                }
                return;
            }

            // ── Save direct (Telegram, etc.) ──────────
            if (action === "save") {
                const fieldName = input?.name || "value";
                const value     = input?.value?.trim() || "";

                if (!value) {
                    showError("Ce champ est obligatoire.");
                    if (btn) { btn.disabled = false; btn.textContent = "Connecter →"; }
                    return;
                }

                const data = await saveConnector(toolId, { [fieldName]: value });

                if (data.success) {
                    updateCard(toolId, true);
                    showSuccess(`✅ ${toolId} connecté avec succès !`);
                    // Remplacer le formulaire par l'info connectée
                    const body = form.closest(".connect-tool-card__body");
                    if (body) {
                        body.innerHTML = `
                            <p class="connect-tool-card__connected-info">
                                🟢 ${value}
                            </p>
                            <button class="connect-btn connect-btn--disconnect"
                                    data-tool="${toolId}" data-action="disconnect">
                                Déconnecter
                            </button>
                        `;
                        // Rebind disconnect
                        body.querySelector("[data-action='disconnect']")
                            ?.addEventListener("click", handleDisconnect);
                    }
                } else {
                    showError(data.error || "Erreur. Réessayez.");
                    if (btn) { btn.disabled = false; btn.textContent = "Connecter →"; }
                }
            }

        } finally {
            if (btn && !btn.disabled) {
                btn.disabled = false;
            }
        }
    });
});

// ── Gérer les boutons OAuth (Facebook, Instagram) ─────
document.querySelectorAll("[data-action='oauth']").forEach(btn => {
    if (btn.tagName === "BUTTON") {
        btn.addEventListener("click", () => {
            const url = btn.dataset.url;
            if (url) window.location.href = url;
        });
    }
});

// ── Gérer les boutons Déconnecter ─────────────────────
async function handleDisconnect(e) {
    const btn    = e.currentTarget;
    const toolId = btn.dataset.tool;

    btn.disabled    = true;
    btn.textContent = "Déconnexion...";

    const data = await disconnectConnector(toolId);

    if (data.success) {
        updateCard(toolId, false);
        showSuccess(`🔴 ${toolId} déconnecté.`);
        // Recharger la page pour afficher le formulaire de reconnexion
        setTimeout(() => window.location.reload(), 1500);
    } else {
        showError(data.error || "Erreur. Réessayez.");
        btn.disabled    = false;
        btn.textContent = "Déconnecter";
    }
}

document.querySelectorAll("[data-action='disconnect']").forEach(btn => {
    btn.addEventListener("click", handleDisconnect);
});

// ── Shopify : basculer vers le formulaire "token manuel" ─
const shopifyTokenToggle = document.getElementById("shopify-token-toggle");
const shopifyTokenForm   = document.getElementById("shopify-token-form");
if (shopifyTokenToggle && shopifyTokenForm) {
    shopifyTokenToggle.addEventListener("click", () => {
        const isOpen = shopifyTokenForm.style.display !== "none";
        shopifyTokenForm.style.display = isOpen ? "none" : "block";
        shopifyTokenToggle.textContent = isOpen
            ? "Pas de bouton d'installation chez toi ? Connecte-toi avec un token →"
            : "← Revenir à la connexion en un clic";
    });
}

// ── Shopify : guide "comment obtenir mon token" ──────────
const shopifyGuideOverlay = document.getElementById("shopify-guide-overlay");
const shopifyGuideToggle  = document.getElementById("shopify-guide-toggle");
const shopifyGuideClose   = document.getElementById("shopify-guide-close");
if (shopifyGuideOverlay && shopifyGuideToggle) {
    shopifyGuideToggle.addEventListener("click", () => {
        shopifyGuideOverlay.classList.add("open");
        if (typeof lucide !== "undefined") lucide.createIcons();
    });
    shopifyGuideClose?.addEventListener("click", () => shopifyGuideOverlay.classList.remove("open"));
    shopifyGuideOverlay.addEventListener("click", (e) => {
        if (e.target === shopifyGuideOverlay) shopifyGuideOverlay.classList.remove("open");
    });
}
