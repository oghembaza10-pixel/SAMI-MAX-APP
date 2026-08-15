/**
 * ============================================================
 * OG • Commerce Engine V3 — VERSION DÉFINITIVE
 * SAMII agit seul et rapporte
 * ============================================================
 */
const socketService = require("../services/socketService");
const shopifyBoutiqueService = require("../services/shopifyBoutiqueService");
const notificationEngine = require("../engines/notificationEngine");
const automationEngine   = require("../engines/automationEngine");
const db = require("../services/db");
const notify = require("../services/notify");
const confirmationsQuota = require("../services/confirmationsQuota");
// require() tardif (dans les méthodes) : telegramService requiert brain/orchestrator,
// qui requiert ce fichier — un require en tête de fichier créerait un cycle où
// telegramService capterait un orchestrator encore vide au chargement.

class CommerceEngine {
    // ── HELPER : workspace_id réel à partir du shop Shopify ──
    // Le "shop" Shopify (ex: monshop.myshopify.com) n'est pas directement le
    // workspaceId SAMII — retrouve le workspace lié (voir
    // services/shopifyBoutiqueService.js), avec repli sur "shop" tel quel
    // pour les événements qui passent déjà un vrai workspaceId (chat, RDV...).
    async getWorkspaceIdForShop(shop) {
        try {
            const workspace = await shopifyBoutiqueService.findByShopUrl(shop);
            return workspace?.id || shop;
        } catch {
            return shop;
        }
    }

    // ── HELPER : Données client ──────────────────────────────
    getClientData(order) {
        return {
            client : `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || "Inconnu",
            phone  : order.shipping_address?.phone || order.customer?.phone || "",
            address: order.shipping_address
                ? `${order.shipping_address.address1}, ${order.shipping_address.city}`
                : "",
        };
    }

    // ── HELPER : Notifie la boutique ─────────────────────────
    async notifyShop(shop, recipients, message) {
        const coords = await notificationEngine.getCoords(shop);

        const channels = [];
        if (coords.telegram) channels.push("telegram");
        if (recipients?.whatsapp) channels.push("whatsapp");
        if (!channels.length) return;

        return notificationEngine.broadcast({
            channels,
            recipients: {
                telegram : coords.telegram,
                whatsapp : recipients?.whatsapp || "",
                email    : recipients?.email    || "",
            },
            message,
            shop,
        });
    }

    // =========================================================
    // NOUVELLE COMMANDE
    // =========================================================
    async newOrder(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone, address } = this.getClientData(order);

            console.log(`🛒 Nouvelle commande #${order.order_number} — ${shop}`);
         // ── ✅ BOUCLIER ANTI-FRAUDE : détection de commandes à risque ──
            const montantCommande = parseFloat(order.total_price || 0);
            const SEUIL_RISQUE = 50000; // ajuste selon ta devise/marché
            let alerteFraude = null;

            if (montantCommande > SEUIL_RISQUE) {
                alerteFraude = `Montant élevé (${montantCommande} DZD)`;
            }
            if (order.customer?.orders_count === 0 && montantCommande > SEUIL_RISQUE / 2) {
                alerteFraude = alerteFraude
                    ? `${alerteFraude} + Premier achat`
                    : "Premier achat avec montant important";
            }
            const workspaceId = await this.getWorkspaceIdForShop(shop);
            const orderId = `SHOPIFY-${order.order_number || order.id}`;

            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant, date_commande)
                 VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'shopify', $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [orderId, workspaceId, client, phone, address, order.line_items?.map(i => i.title).join(", ") || "",
                 parseFloat(order.total_price || 0), order.created_at || new Date().toISOString()]
            );

            await automationEngine.run("order.created", { shop, payload: order });

            const message =
                `👑 *SAMII — Commande #${order.order_number} enregistrée*\n\n` +
                `✅ J'ai enregistré la commande automatiquement.\n\n` +
                `👤 *Client :* ${client}\n` +
                `📞 *Tél :* ${phone}\n` +
                `📍 *Adresse :* ${address}\n` +
                `📦 *Produits :* ${order.line_items?.map(i => i.title).join(", ") || ""}\n` +
                `💰 *Total :* ${order.total_price} DZD\n` +
                `📊 *Statut :* ${order.financial_status}\n\n` +
                `_SAMII gère la suite automatiquement._`;

           await this.notifyShop(shop, { whatsapp: phone }, message);

            // ── Alerte séparée si risque détecté ──
            if (alerteFraude) {
                const alerteMsg =
                    `🛡️ *SAMII — Bouclier Anti-Fraude*\n\n` +
                    `⚠️ Commande #${order.order_number} signalée pour vérification.\n\n` +
                    `👤 *Client :* ${client}\n` +
                    `💰 *Montant :* ${order.total_price} DZD\n` +
                    `🚩 *Raison :* ${alerteFraude}\n\n` +
                    `_Vérifiez cette commande avant expédition._`;
                await this.notifyShop(shop, { whatsapp: phone }, alerteMsg);
            }

            socketService.emitToShop(shop, "nouvelle-commande", { id: order.order_number });

            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.newOrder :", err.message);
            return { success: false, error: err.message };
        }
    }
   // =========================================================
    // SIRÈNE — PANIER ABANDONNÉ (checkout créé mais pas payé)
    // =========================================================
    async abandonedCheckout(event) {
        try {
            const checkout = event.payload;
            const shop = event.shop;
            const phone = checkout.shipping_address?.phone || checkout.phone || "";
            const client = `${checkout.shipping_address?.first_name || ""} ${checkout.shipping_address?.last_name || ""}`.trim() || "cher client";

            if (!phone) return { success: false, error: "Pas de téléphone." };

            // ── Attendre 1h avant de relancer (évite de spammer trop tôt) ──
            setTimeout(async () => {
                try {
                    const message =
                        `👋 Bonjour ${client} !\n\n` +
                        `Vous avez laissé des articles dans votre panier. 🛒\n\n` +
                        `Besoin d'aide pour finaliser votre commande ? Répondez-nous, on est là !`;

                    await this.notifyShop(shop, { whatsapp: phone }, message);
                } catch (err) {
                    console.warn("⚠️ Sirène relance échouée :", err.message);
                }
            }, 60 * 60 * 1000); // 1h

            return { success: true, shop };
        } catch (err) {
            console.error("❌ CommerceEngine.abandonedCheckout :", err.message);
            return { success: false, error: err.message };
        }
    } 
    // =========================================================
    // COMMANDE MISE À JOUR
    // =========================================================
    async orderUpdated(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await automationEngine.run("order.updated", { shop, payload: order });

            const message =
                `👑 *SAMII — Commande #${order.order_number} mise à jour*\n\n` +
                `👤 *Client :* ${client}\n` +
                `📦 *Statut :* ${order.fulfillment_status || order.financial_status}\n\n` +
                `_Mis à jour automatiquement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderUpdated :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE PAYÉE
    // =========================================================
    async orderPaid(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await automationEngine.run("order.paid", { shop, payload: order });

            const message =
                `👑 *SAMII — Paiement confirmé #${order.order_number}*\n\n` +
                `✅ Paiement reçu et enregistré.\n\n` +
                `👤 *Client :* ${client}\n` +
                `💰 *Total :* ${order.total_price} DZD\n\n` +
                `_SAMII continue le traitement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderPaid :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE EXPÉDIÉE
    // =========================================================
    async orderFulfilled(event) {
        try {
            const order    = event.payload;
            const shop     = event.shop;
            const { client, phone } = this.getClientData(order);
            const tracking = order.fulfillments?.[0]?.tracking_number  || "N/A";
            const carrier  = order.fulfillments?.[0]?.tracking_company || "N/A";

            await automationEngine.run("order.fulfilled", { shop, payload: order });

            const message =
                `👑 *SAMII — Expédition #${order.order_number}*\n\n` +
                `✅ J'ai mis à jour le statut en expédiée.\n\n` +
                `👤 *Client :* ${client}\n` +
                `📦 *Transporteur :* ${carrier}\n` +
                `🔍 *Tracking :* ${tracking}\n\n` +
                `_Client notifié automatiquement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderFulfilled :", err.message);
            return { success: false, error: err.message };
        }
    }
    // =========================================================
    // COMMANDE LIVRÉE
    // =========================================================
    async orderDelivered(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            const message =
                `👑 *SAMII — Livraison confirmée #${order.order_number}*\n\n` +
                `✅ Colis livré avec succès.\n\n` +
                `👤 *Client :* ${client}\n\n` +
                `_Dossier clôturé automatiquement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);

            if (phone) {
                try {
                    const reviewMessage =
                        `Bonjour ${client} 👋\n\n` +
                        `Votre commande #${order.order_number} a bien été livrée !\n\n` +
                        `Votre avis compte énormément pour nous. Pourriez-vous prendre 30 secondes pour nous laisser un retour ?\n\n` +
                        `Merci de votre confiance 🙏`;

                    await notificationEngine.send({
                        channel: "whatsapp",
                        to: phone,
                        message: reviewMessage,
                        shop,
                    });
                } catch (avisErr) {
                    console.warn("⚠️ Sentinelle Avis non envoyée :", avisErr.message);
                }
            }

            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderDelivered :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // COMMANDE ANNULÉE
    // =========================================================
    async orderCancelled(event) {
        try {
            const order = event.payload;
            const shop  = event.shop;
            const { client, phone } = this.getClientData(order);

            await automationEngine.run("order.cancelled", { shop, payload: order });

            const message =
                `👑 *SAMII — Commande #${order.order_number} annulée*\n\n` +
                `❌ Annulation enregistrée automatiquement.\n\n` +
                `👤 *Client :* ${client}\n` +
                `💬 *Raison :* ${order.cancel_reason || "Non précisée"}\n\n` +
                `_Dossier mis à jour._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            socketService.emitToShop(shop, "commande-annulee", { id: order.order_number });

            return { success: true, shop, orderId: order.id };
        } catch (err) {
            console.error("❌ CommerceEngine.orderCancelled :", err.message);
            return { success: false, error: err.message };
        }
    }

   // =========================================================
    // TELEGRAM — CONFIRMATION (canal indépendant, PostgreSQL)
    // =========================================================
    async confirmTelegramOrder(event) {
        try {
            const { orderId } = event.payload;
            const rows = await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1 RETURNING workspace_id`, [orderId]);
            if (rows[0]?.workspace_id) confirmationsQuota.enregistrerSiDepassement(rows[0].workspace_id).catch(() => {});
            await db.query(
                `INSERT INTO journal (action, details) VALUES ($1, $2)`,
                ["order.confirmed.telegram", `#${orderId} confirmée via Telegram`]
            );
            return { success: true, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.confirmTelegramOrder :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // TELEGRAM — ANNULATION (canal indépendant, PostgreSQL)
    // =========================================================
    async cancelTelegramOrder(event) {
        try {
            const { orderId } = event.payload;
            await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
            await db.query(
                `INSERT INTO journal (action, details) VALUES ($1, $2)`,
                ["order.cancelled.telegram", `#${orderId} annulée via Telegram`]
            );
            return { success: true, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.cancelTelegramOrder :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // CRÉATION COMMANDE / RENDEZ-VOUS — VIA RAISONNEMENT SAMII (chat)
    // Utilisé par le function-calling Gemini (Telegram, WhatsApp...),
    // remplace les anciens parcours pas-à-pas figés par métier.
    // =========================================================
    async createOrderFromChat(context, args) {
        try {
            const { workspaceId, name, source, chatId } = context || {};
            if (!workspaceId) return { success: false, error: "Impossible d'identifier le workspace de ce client." };

            // Anti-invention : si un vrai catalogue est fourni, le produit doit en faire partie.
            let montant = 0;
            if (Array.isArray(context.produits) && context.produits.length > 0) {
                const produitCatalogue = context.produits.find(
                    p => (p.nom || "").toLowerCase() === (args.produit || "").toLowerCase()
                );
                if (!produitCatalogue) {
                    return { success: false, error: "Ce produit ne fait pas partie du catalogue réel du marchand. Redemande au client de choisir un produit exact de la liste fournie." };
                }
                montant = Number(produitCatalogue.prix) || 0;
            }

            const orderId = `${source === "whatsapp" ? "WA" : "TG"}-${Date.now().toString().slice(-6)}`;
            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant, contact_id)
                 VALUES ($1, $2, $3, $4, $5, $6, 'en attente', $7, $8, $9)`,
                [orderId, workspaceId, name || "Client", args.telephone || "", args.adresse || "", args.produit || "", source || "chat", montant, chatId ? String(chatId) : null]
            );
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                [`order.created.${source || "chat"}`, `#${orderId} — ${name || "Client"}`, workspaceId]
            );
            socketService.emitToShop(workspaceId, "nouvelle-commande", { id: orderId });
            notify.notifyWorkspace(workspaceId, {
                title: "🛒 Nouvelle commande",
                body : `${name || "Client"} — ${args.produit}`,
                url  : "/qg",
            });

            // Le client final confirme directement lui-même (IA, sans agent humain) —
            // le marchand n'a donc plus qu'à regarder la commande une fois validée
            // et l'expédier ; il n'a plus de bouton à cliquer pour la confirmer.
            const commandePourConfirmation = {
                client: name, total: montant, produits: args.produit, order_id: orderId,
            };
            if (source === "telegram" && chatId) {
                await require("../services/telegramService").demanderConfirmation(chatId, commandePourConfirmation, workspaceId);
            } else if (source === "whatsapp" && chatId) {
                await require("../services/whatsapp").demanderConfirmation(chatId, commandePourConfirmation, workspaceId);
            }

            await require("../services/telegramService").notifyAdmin(
                workspaceId,
                `🛎️ *Nouvelle commande — confirmation demandée au client*\n\n🆔 *Numéro :* \`${orderId}\`\n👤 *Client :* ${name || "Client"}\n📞 *Tél :* ${args.telephone}\n📦 *Produit :* ${args.produit}\n💰 *Total :* ${montant} DZD\n📍 *Adresse :* ${args.adresse}\n\n⏳ SAMII attend la réponse du client. Tu seras notifié dès qu'elle sera confirmée.`
            );

            return { success: true, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.createOrderFromChat :", err.message);
            return { success: false, error: err.message };
        }
    }

    async createRdvFromChat(context, args) {
        try {
            const { workspaceId, name, source } = context || {};
            if (!workspaceId) return { success: false, error: "Impossible d'identifier le workspace de ce client." };

            // SAMII doit renvoyer une date ISO (voir le schéma de la fonction), mais on
            // ne fait jamais confiance à un modèle IA à 100% — si le format reçu n'est
            // pas une date valide, on garde quand même le rendez-vous (date à NULL,
            // texte brut ajouté au motif) plutôt que de faire planter l'insertion.
            const dateParsee = args.date_rdv && !isNaN(Date.parse(args.date_rdv)) ? new Date(args.date_rdv) : null;
            const motif = dateParsee ? (args.motif || "") : `${args.motif || ""} (souhaité : ${args.date_rdv || "non précisé"})`;

            const rows = await db.query(
                `INSERT INTO rendez_vous (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
                 VALUES ($1, $2, $3, $4, $5, 'en_attente', $6) RETURNING id`,
                [workspaceId, name || "Client", args.telephone || "", motif, dateParsee, source || "chat"]
            );
            const rdvId = `RDV-${rows[0].id}`;
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                [`rdv.created.${source || "chat"}`, `#${rdvId} — ${name || "Client"}`, workspaceId]
            );
            socketService.emitToShop(workspaceId, "nouveau-rdv", { id: rdvId });
            notify.notifyWorkspace(workspaceId, {
                title: "📅 Nouveau rendez-vous",
                body : `${name || "Client"} — ${args.motif}`,
                url  : "/qg",
            });

            if (source === "telegram") {
                await require("../services/telegramService").notifyAdmin(
                    workspaceId,
                    `📅 *Nouvelle demande de rendez-vous !*\n\n🆔 *Numéro :* \`${rdvId}\`\n👤 *Client :* ${name || "Client"}\n📞 *Tél :* ${args.telephone}\n📝 *Motif :* ${args.motif}\n🗓️ *Date souhaitée :* ${args.date_rdv}`,
                    [[{ text: "✅", callback_data: `rdvconfirm_${rdvId}` }, { text: "❌", callback_data: `rdvcancel_${rdvId}` }]]
                );
            }

            return { success: true, rdvId };
        } catch (err) {
            console.error("❌ CommerceEngine.createRdvFromChat :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // CALENDRIER RDV — créneaux configurables par le marchand
    // (disponible pour tout workspace, pas seulement les métiers
    // "sur rendez-vous" — un e-commerçant peut aussi en recevoir).
    // =========================================================

    async getRdvConfig(workspaceId) {
        const DEFAUT = { jours_fermes: [5], heure_debut: "09:00", heure_fin: "18:00", duree_creneau_min: 30 };
        try {
            const rows = await db.query(`SELECT rdv_config FROM workspaces WHERE id = $1`, [workspaceId]);
            const config = rows[0]?.rdv_config;
            return config ? { ...DEFAUT, ...config } : DEFAUT;
        } catch {
            return DEFAUT;
        }
    }

    // process.env.TZ = "Africa/Algiers" (index.js) — new Date(y,m,d,h,mi) et
    // les getters locaux (getDay, getHours...) sont donc déjà en heure d'Alger.
    joursDisponibles(config, nbJours = 7) {
        const jours = [];
        const auj = new Date();
        for (let i = 0; jours.length < nbJours && i < nbJours + 7; i++) {
            const d = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + i);
            if (!(config.jours_fermes || []).includes(d.getDay())) jours.push(d);
        }
        return jours;
    }

    creneauxDuJour(config, date) {
        const [hD, mD] = String(config.heure_debut || "09:00").split(":").map(Number);
        const [hF, mF] = String(config.heure_fin || "18:00").split(":").map(Number);
        const duree = config.duree_creneau_min || 30;
        const creneaux = [];
        let curseur = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hD, mD);
        const fin = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hF, mF);
        while (curseur < fin) {
            creneaux.push(new Date(curseur));
            curseur = new Date(curseur.getTime() + duree * 60000);
        }
        return creneaux;
    }

    // Ouvre le calendrier interactif Telegram — crée un rendez-vous "brouillon"
    // (sans date) dont l'id sert de référence légère dans les callback_data
    // des boutons, plutôt que de stocker l'état en mémoire (perdu au redémarrage).
    async proposerCreneauxRdv(context, args) {
        try {
            const { workspaceId, name, source, chatId } = context || {};
            if (!workspaceId) return { success: false, error: "Impossible d'identifier le workspace de ce client." };
            if (source !== "telegram" || !chatId) {
                return { success: false, error: "Calendrier interactif indisponible sur ce canal — demande la date/heure souhaitée directement au client, en texte." };
            }

            const rows = await db.query(
                `INSERT INTO rendez_vous (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
                 VALUES ($1, $2, $3, $4, NULL, 'brouillon', $5) RETURNING id`,
                [workspaceId, name || "Client", args.telephone || "", args.motif || "", source]
            );
            const draftId = rows[0].id;

            const config = await this.getRdvConfig(workspaceId);
            const jours = this.joursDisponibles(config);
            const boutons = jours.map(d => ([{
                text: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
                callback_data: `rdvday_${draftId}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
            }]));

            await require("../services/telegramService").sendWithKeyboard(
                chatId,
                "📅 Choisis un jour pour ton rendez-vous :",
                boutons
            );

            return { success: true, calendrierEnvoye: true };
        } catch (err) {
            console.error("❌ CommerceEngine.proposerCreneauxRdv :", err.message);
            return { success: false, error: err.message };
        }
    }

    async creneauxLibresPourJour(workspaceId, dateISO) {
        const config = await this.getRdvConfig(workspaceId);
        const [an, mo, jr] = dateISO.split("-").map(Number);
        const date = new Date(an, mo - 1, jr);
        const tousLesCreneaux = this.creneauxDuJour(config, date);

        const prisRows = await db.query(
            `SELECT date_rdv FROM rendez_vous
             WHERE workspace_id = $1 AND statut NOT IN ('annulé', 'brouillon')
               AND date_rdv >= $2::date AND date_rdv < ($2::date + INTERVAL '1 day')`,
            [workspaceId, dateISO]
        );
        const prisSet = new Set(prisRows.map(r => new Date(r.date_rdv).getTime()));

        return tousLesCreneaux.filter(c => !prisSet.has(c.getTime()));
    }

    // Transforme le brouillon en vrai rendez-vous une fois le créneau choisi.
    async finaliserCreneauRdv(draftId, dateRdv) {
        try {
            const rows = await db.query(
                `UPDATE rendez_vous SET date_rdv = $1, statut = 'en_attente'
                 WHERE id = $2 AND statut = 'brouillon' RETURNING *`,
                [dateRdv, draftId]
            );
            const rdv = rows[0];
            if (!rdv) return null;
            const rdvId = `RDV-${rdv.id}`;

            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                [`rdv.created.telegram`, `#${rdvId} — ${rdv.client_nom}`, rdv.workspace_id]
            );
            socketService.emitToShop(rdv.workspace_id, "nouveau-rdv", { id: rdvId });
            notify.notifyWorkspace(rdv.workspace_id, {
                title: "📅 Nouveau rendez-vous",
                body : `${rdv.client_nom} — ${rdv.motif}`,
                url  : "/qg",
            });
            await require("../services/telegramService").notifyAdmin(
                rdv.workspace_id,
                `📅 *Nouveau rendez-vous !*\n\n🆔 *Numéro :* \`${rdvId}\`\n👤 *Client :* ${rdv.client_nom}\n📞 *Tél :* ${rdv.client_telephone}\n📝 *Motif :* ${rdv.motif}\n🗓️ *Date :* ${new Date(rdv.date_rdv).toLocaleString("fr-FR")}`,
                [[{ text: "✅", callback_data: `rdvconfirm_${rdvId}` }, { text: "❌", callback_data: `rdvcancel_${rdvId}` }]]
            );
            return rdv;
        } catch (err) {
            console.error("❌ CommerceEngine.finaliserCreneauRdv :", err.message);
            return null;
        }
    }

    // =========================================================
    // STOCK FAIBLE
    // =========================================================
    async lowStock(event) {
        try {
            const { product, variant, shop } = event.payload;
            await automationEngine.run("stock.low", { shop, payload: event.payload });

            const message =
                `👑 *SAMII — Alerte Stock*\n\n` +
                `⚠️ Stock faible détecté.\n\n` +
                `📦 *Produit :* ${product}\n` +
                `🔢 *Quantité restante :* ${variant}\n\n` +
                `_Pensez à réapprovisionner._`;

            await this.notifyShop(shop, {}, message);
            return { success: true, shop };
        } catch (err) {
            console.error("❌ CommerceEngine.lowStock :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // STOCK ÉPUISÉ
    // =========================================================
    async stockEmpty(event) {
        try {
            const { product, shop } = event.payload;

            const message =
                `👑 *SAMII — Stock ÉPUISÉ*\n\n` +
                `🚨 Rupture de stock détectée.\n\n` +
                `📦 *Produit :* ${product}\n\n` +
                `_Action requise immédiatement._`;

            await this.notifyShop(shop, {}, message);
            return { success: true, shop };
        } catch (err) {
            console.error("❌ CommerceEngine.stockEmpty :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — STATUT MIS À JOUR
    // =========================================================
    async yalidineStatus(event) {
        try {
            const { orderId, status, tracking, shop } = event.payload;
            await db.query(`UPDATE commandes SET statut = $1 WHERE id = $2`, [status, orderId]);

            const message =
                `👑 *SAMII — Yalidine #${orderId}*\n\n` +
                `✅ Statut mis à jour automatiquement.\n\n` +
                `📊 *Nouveau statut :* ${status}\n` +
                `🔍 *Tracking :* ${tracking || "N/A"}\n\n` +
                `_Statut synchronisé._`;

            await this.notifyShop(shop, {}, message);
            return { success: true, shop, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.yalidineStatus :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — LIVRÉ
    // =========================================================
    async yalidineDelivered(event) {
        try {
            const { orderId, client, phone, shop } = event.payload;
            await db.query(`UPDATE commandes SET statut = 'livrée' WHERE id = $1`, [orderId]);

            const message =
                `👑 *SAMII — Livraison Yalidine #${orderId}*\n\n` +
                `✅ Colis livré — statut mis à jour.\n\n` +
                `👤 *Client :* ${client || "Client"}\n\n` +
                `_Dossier clôturé automatiquement._`;

            await this.notifyShop(shop, { whatsapp: phone }, message);
            return { success: true, shop, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.yalidineDelivered :", err.message);
            return { success: false, error: err.message };
        }
    }

    // =========================================================
    // YALIDINE — RETOURNÉ
    // =========================================================
    async yalidineReturned(event) {
        try {
            const { orderId, reason, shop } = event.payload;
            await db.query(`UPDATE commandes SET statut = 'retournée' WHERE id = $1`, [orderId]);

            const message =
                `👑 *SAMII — Retour Yalidine #${orderId}*\n\n` +
                `🔄 Colis retourné — statut mis à jour.\n\n` +
                `💬 *Raison :* ${reason || "Non précisée"}\n\n` +
                `_Statut synchronisé._`;

            await this.notifyShop(shop, {}, message);
            return { success: true, shop, orderId };
        } catch (err) {
            console.error("❌ CommerceEngine.yalidineReturned :", err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new CommerceEngine();
   
