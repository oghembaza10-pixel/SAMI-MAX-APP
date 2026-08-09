// ==========================================================================
// SAMII OS — WEBHOOK WHATSAPP (Green API) — Messages entrants
// Parcours conversationnel : catalogue produit (e-commerce/menu) ou prise
// de rendez-vous (dentiste, avocat, garage...), miroir de routes/telegram.js.
// ==========================================================================
const express      = require("express");
const orchestrator = require("../brain/orchestrator");
const planner       = require("../brain/planner");
const memory        = require("../brain/memory");
const socketService = require("../services/socketService");
const whatsapp       = require("../services/whatsapp");
const db            = require("../services/db");

const router = express.Router();

// ── MÉTIERS PAR TYPE DE PARCOURS (identique à telegram.js) ────────────
const METIERS_RDV = [
    "dentiste", "medecin", "avocat", "comptable", "coiffeur", "kine",
    "veterinaire", "notaire", "courtier", "immobilier", "garage",
    "lavage", "mecanicien", "esthetique", "tatoueur", "photographe",
    "formateur", "architecte", "agence", "service",
];

function typeParcours(metier) {
    const m = (metier || "").toLowerCase();
    return METIERS_RDV.includes(m) ? "rdv" : "produit";
}

function isOrderIntent(text) {
    const t = text.toLowerCase();
    return t.match(/command|acheter|achat|veux commander|je veux|passer commande|order|طلب|نطلب|نشري/);
}
function isRdvIntent(text) {
    const t = text.toLowerCase();
    return t.match(/rendez.?vous|rdv|appointment|book|réserver|reserver|موعد|حجز/);
}
function isCancelIntent(text) {
    const t = text.toLowerCase();
    return t.match(/annul|cancel|stop|arrêt|لا|waqef/);
}

function genOrderId() { return `WA-${Date.now().toString().slice(-6)}`; }
function sessionKey(sender) { return `wa_${sender}`; }

async function reply(sender, workspaceId, text) {
    await whatsapp.send({ to: sender, message: text, workspaceId });
}

// ── Résout le workspace propriétaire de l'instance Green API ──────────
async function getWorkspaceByInstance(idInstance) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'whatsapp' AND actif = true AND config LIKE $1`,
            [`%"apiId":"${idInstance}"%`]
        );
        return rows[0]?.workspace_id || "";
    } catch {
        return "";
    }
}

async function getMetierWorkspace(workspaceId) {
    try {
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

async function getProduitsDuWorkspace(workspaceId) {
    try {
        return await db.query(
            `SELECT id, nom, prix, options FROM produits WHERE workspace_id = $1 AND actif = true ORDER BY nom`,
            [workspaceId]
        );
    } catch { return []; }
}

// ── PARCOURS PRODUIT (e-commerce, restaurant/menu, boutique...) ──────
async function handleOrderFlow(sender, workspaceId, text, name) {
    const key = sessionKey(sender);
    const session = memory.get(key) || {};
    const step = session.step;

    if (!step) {
        const produits = await getProduitsDuWorkspace(workspaceId);

        if (produits.length === 0) {
            memory.set(key, { step: "produit", name, workspaceId });
            await reply(sender, workspaceId, "Quel produit souhaites-tu commander ?");
            return;
        }

        const liste = produits.map((p, i) => `${i + 1}. *${p.nom}* — ${p.prix} DZD`).join("\n");
        memory.set(key, { step: "produit_choix", name, workspaceId, produitsDisponibles: produits });
        await reply(sender, workspaceId, `Voici nos produits disponibles :\n\n${liste}\n\nRéponds avec le numéro de ton choix.`);
        return;
    }

    if (step === "produit_choix") {
        const index = parseInt(text.trim(), 10) - 1;
        const produits = session.produitsDisponibles || [];
        const choisi = produits[index];
        if (!choisi) { await reply(sender, workspaceId, "Numéro invalide, réessaie."); return; }

        const options = choisi.options && typeof choisi.options === "object" ? choisi.options : {};
        const clesOptions = Object.keys(options);

        if (clesOptions.length === 0) {
            memory.set(key, { step: "adresse", name, workspaceId, produit: `${choisi.nom} (${choisi.prix} DZD)` });
            await reply(sender, workspaceId, "Quelle est ton adresse de livraison ?");
            return;
        }

        const premiereCle = clesOptions[0];
        const valeursPossibles = options[premiereCle];
        memory.set(key, {
            step: "option_choix", name, workspaceId,
            produitBase: choisi, optionsRestantes: clesOptions, optionIndex: 0, optionsChoisies: {},
        });
        const liste = valeursPossibles.map((v, i) => `${i + 1}. ${v}`).join("\n");
        await reply(sender, workspaceId, `Choisis ${premiereCle} :\n${liste}`);
        return;
    }

    if (step === "option_choix") {
        const cleActuelle = session.optionsRestantes[session.optionIndex];
        const valeursPossibles = session.produitBase.options[cleActuelle];
        const index = parseInt(text.trim(), 10) - 1;
        const valeurChoisie = valeursPossibles[index];
        if (!valeurChoisie) { await reply(sender, workspaceId, "Numéro invalide, réessaie."); return; }

        const optionsChoisies = { ...session.optionsChoisies, [cleActuelle]: valeurChoisie };
        const prochainIndex = session.optionIndex + 1;

        if (prochainIndex < session.optionsRestantes.length) {
            const prochaineCle = session.optionsRestantes[prochainIndex];
            const prochainesValeurs = session.produitBase.options[prochaineCle];
            memory.set(key, { ...session, optionIndex: prochainIndex, optionsChoisies });
            const liste = prochainesValeurs.map((v, i) => `${i + 1}. ${v}`).join("\n");
            await reply(sender, workspaceId, `Choisis ${prochaineCle} :\n${liste}`);
            return;
        }

        const descriptifOptions = Object.entries(optionsChoisies).map(([k, v]) => `${k}: ${v}`).join(", ");
        const produitComplet = `${session.produitBase.nom} (${descriptifOptions}) — ${session.produitBase.prix} DZD`;
        memory.set(key, { step: "adresse", name, workspaceId, produit: produitComplet });
        await reply(sender, workspaceId, "Quelle est ton adresse de livraison ?");
        return;
    }

    if (step === "produit") {
        memory.set(key, { step: "adresse", name, workspaceId, produit: text });
        await reply(sender, workspaceId, "Quelle est ton adresse de livraison ?");
        return;
    }

    if (step === "adresse") {
        const orderId = genOrderId();
        const s = { ...session, adresse: text };

        try {
            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant)
                 VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'whatsapp', 0)`,
                [orderId, workspaceId, s.name || "Client", sender, s.adresse, s.produit || ""]
            );
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["order.created.whatsapp", `#${orderId} — ${s.name}`, workspaceId]
            );
            socketService.emitToShop(workspaceId, "nouvelle-commande", { id: orderId });
            console.log(`✅ Commande WhatsApp ${orderId} créée pour workspace "${workspaceId}"`);
            await reply(sender, workspaceId,
                `✅ *Commande enregistrée !*\n\n🆔 Numéro : ${orderId}\n\n_Le marchand va confirmer ta commande et te recontacter pour le paiement (en ligne ou sur place selon ce qu'il propose)._`
            );
        } catch (err) {
            console.error("❌ Commande WhatsApp :", err.message);
            await reply(sender, workspaceId, "Une erreur est survenue, réessaie plus tard.");
        }
        memory.clear(key);
    }
}

// ── PARCOURS RENDEZ-VOUS (dentiste, avocat, garage, location...) ─────
async function handleRdvFlow(sender, workspaceId, text, name) {
    const key = sessionKey(sender);
    const session = memory.get(key) || {};
    const step = session.step;

    if (!step) {
        memory.set(key, { step: "rdv_motif", name, workspaceId });
        await reply(sender, workspaceId, "Quel est le motif de ton rendez-vous ?");
        return;
    }

    if (step === "rdv_motif") {
        memory.set(key, { step: "rdv_date", name, workspaceId, motif: text });
        await reply(sender, workspaceId, "Quelle date/heure souhaites-tu ?");
        return;
    }

    if (step === "rdv_date") {
        const s = { ...session, dateRdv: text };

        try {
            const rows = await db.query(
                `INSERT INTO rendez_vous (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
                 VALUES ($1, $2, $3, $4, $5, 'en_attente', 'whatsapp') RETURNING id`,
                [workspaceId, s.name || "Client", sender, s.motif || "", s.dateRdv]
            );
            const rdvId = `RDV-${rows[0].id}`;
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["rdv.created.whatsapp", `#${rdvId} — ${s.name}`, workspaceId]
            );
            socketService.emitToShop(workspaceId, "nouveau-rdv", { id: rdvId });
            console.log(`✅ Rendez-vous WhatsApp ${rdvId} créé pour workspace "${workspaceId}"`);
            await reply(sender, workspaceId,
                `✅ *Demande de rendez-vous envoyée !*\n\n🆔 Numéro : ${rdvId}\n📝 Motif : ${s.motif}\n🗓️ Date souhaitée : ${s.dateRdv}\n\n_Le professionnel confirmera l'horaire sous peu._`
            );
        } catch (err) {
            console.error("❌ Rendez-vous WhatsApp :", err.message);
            await reply(sender, workspaceId, "Une erreur est survenue, réessaie plus tard.");
        }
        memory.clear(key);
    }
}

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        // Monté sous /webhook, où express.raw() laisse le body en Buffer brut.
        const raw  = req.body;
        const body = Buffer.isBuffer(raw) ? JSON.parse(raw.toString("utf8") || "{}") : (raw || {});

        if (body.typeWebhook !== "incomingMessageReceived") return;

        const idInstance = body.instanceData?.idInstance;
        const senderData  = body.senderData || {};
        const textMessage =
            body.messageData?.textMessageData?.textMessage ||
            body.messageData?.extendedTextMessageData?.text ||
            "";

        if (!idInstance || !textMessage) return;

        const workspaceId = await getWorkspaceByInstance(idInstance);
        if (!workspaceId) {
            console.log(`⚠️ WhatsApp webhook : aucune instance connectée pour idInstance=${idInstance}`);
            return;
        }

        const senderName = senderData.senderName || senderData.chatName || "Client";
        const sender      = (senderData.sender || senderData.chatId || "").replace("@c.us", "");
        const text        = textMessage.trim();

        console.log(`💬 WhatsApp [${senderName}] (workspace ${workspaceId}) : ${text}`);

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["whatsapp.message", `${senderName}: ${text}`, workspaceId]
        );

        try {
            await orchestrator.process({
                type   : "whatsapp.message",
                shop   : workspaceId,
                payload: { senderName, sender, message: text },
            });
        } catch (procErr) {
            console.error("❌ WhatsApp orchestrator :", procErr.message);
            await db.query(
                `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
                ["error.whatsapp.message", procErr.message, workspaceId]
            );
        }

        socketService.emitToShop(workspaceId, "whatsapp.message", { senderName, message: text });

        // ── Parcours conversationnel (catalogue produit / rendez-vous) ──
        const key = sessionKey(sender);

        if (isCancelIntent(text) && memory.get(key)?.step) {
            memory.clear(key);
            await reply(sender, workspaceId, "D'accord, demande annulée. N'hésite pas à revenir quand tu veux 🙏");
            return;
        }

        if (memory.get(key)?.step) {
            const session = memory.get(key);
            if (session.step.startsWith("rdv_")) {
                await handleRdvFlow(sender, workspaceId, text, senderName);
            } else {
                await handleOrderFlow(sender, workspaceId, text, senderName);
            }
            return;
        }

        const metier = await getMetierWorkspace(workspaceId);
        const parcours = typeParcours(metier);

        if (isRdvIntent(text) || (parcours === "rdv" && isOrderIntent(text))) {
            await handleRdvFlow(sender, workspaceId, text, senderName);
            return;
        }
        if (isOrderIntent(text)) {
            await handleOrderFlow(sender, workspaceId, text, senderName);
            return;
        }

        const geminiReply = await planner.ask(text, { source: "whatsapp", chatId: sender, name: senderName });
        await reply(sender, workspaceId, geminiReply);

    } catch (err) {
        console.error("❌ Webhook WhatsApp :", err.message);
    }
});

module.exports = router;
