// ==========================================================================
// SAMII OS — TELEGRAM WEBHOOK — V3 Universel (tous métiers, multi-langue)
// ==========================================================================
const express      = require("express");
const axios        = require("axios");
const CONFIG       = require("../config");
const orchestrator = require("../brain/orchestrator");
const planner      = require("../brain/planner");
const memory       = require("../brain/memory");
const db           = require("../services/db");

const router = express.Router();
const TOKEN  = CONFIG.TELEGRAM.BOT_TOKEN;
const BASE   = `https://api.telegram.org/bot${TOKEN}`;

// ── MÉTIERS PAR TYPE DE PARCOURS ──────────────────────────────
// Rendez-vous : professions de service où le client prend un créneau.
// Produit (par défaut) : e-commerce, restaurant (menu), boutique, etc.
const METIERS_RDV = [
    "dentiste", "avocat", "comptable", "coiffeur", "medecin", "kine",
    "veterinaire", "notaire", "courtier", "immobilier", "service",
];

function typeParcours(metier) {
    const m = (metier || "").toLowerCase();
    return METIERS_RDV.includes(m) ? "rdv" : "produit";
}

// ── MULTI-LANGUE ───────────────────────────────────────────────
const LANGUES_SUPPORTEES = ["fr", "en", "ar"];

function detecterLangue(message) {
    const code = (message?.from?.language_code || "fr").toLowerCase().slice(0, 2);
    return LANGUES_SUPPORTEES.includes(code) ? code : "fr";
}

const T = {
    fr: {
        bienvenueClient: "👑 *Bienvenue !*\n\nJe suis SAMII, votre assistant. Comment puis-je vous aider aujourd'hui ?",
        bienvenueGenerique: (chatId) => `👑 *Bienvenue sur SAMII OS !*\n\n✅ Chat ID : \`${chatId}\`\n\nJe suis SAMII, votre assistant. Comment puis-je vous aider ?`,
        adminConnecte: "✅ *Telegram connecté à ton QG !*\n\nTu recevras désormais toutes tes commandes/rendez-vous ici directement. 👑",
        adminErreur: "❌ Erreur de connexion. Réessaie depuis ton QG.",
        commandeAnnulee: "❌ Commande annulée. Comment puis-je vous aider ?",
        quelProduit: "🛍️ *Parfait !*\n\nQuel produit souhaitez-vous commander ?\n_(Nom, taille, couleur...)_",
        produitsDispo: (liste) => `🛍️ *Voici nos produits disponibles :*\n\n${liste}\n\nTapez le *numéro* du produit qui vous intéresse.`,
        numeroInvalide: "❌ Numéro invalide. Réessaie avec un numéro de la liste.",
        telephone: "📞 Votre *numéro de téléphone* s'il vous plaît ?",
        adresse: "📍 Votre *adresse de livraison* ?",
        choisisOption: (label, liste) => `📦 Choisis *${label}* :\n\n${liste}\n\nTape le numéro.`,
        recapCommande: (s, adresse) => `📋 *Récapitulatif de votre commande*\n\n📦 *Produit :* ${s.produit}\n📍 *Adresse :* ${adresse}\n📞 *Tél :* ${s.telephone}\n\nConfirmez-vous cette commande ?`,
        commandeEnregistree: (orderId) => `✅ *Commande enregistrée !*\n\n🆔 *Numéro :* \`${orderId}\`\n\n_Merci de confirmer ci-dessus._ 🙏`,
        quelMotif: "📅 *Prise de rendez-vous*\n\nQuel est le motif de votre demande ?",
        quelleDate: "🗓️ Quelle *date et heure* vous conviendraient ? _(ex : 15/09 à 14h)_",
        recapRdv: (s) => `📋 *Récapitulatif de votre rendez-vous*\n\n📝 *Motif :* ${s.motif}\n🗓️ *Date souhaitée :* ${s.dateRdv}\n📞 *Tél :* ${s.telephone}\n\nConfirmez-vous cette demande ?`,
        rdvEnregistre: (rdvId) => `✅ *Demande de rendez-vous envoyée !*\n\n🆔 *Numéro :* \`${rdvId}\`\n\n_Le professionnel vous confirmera l'horaire._ 🙏`,
        rdvConfirme: (id) => `✅ *Rendez-vous #${id} confirmé !*\n\nÀ bientôt 🙏`,
        rdvAnnule: (id) => `❌ *Rendez-vous #${id} annulé.*\n\nSi c'est une erreur, répondez-nous 😊`,
        commandeConfirmee: (id) => `✅ *Commande #${id} confirmée !*\n\nNous préparons le colis 📦\nMerci de votre confiance 🙏`,
        commandeAnnuleeId: (id) => `❌ *Commande #${id} annulée.*\n\nSi c'est une erreur, répondez-nous 😊`,
        idChat: (chatId) => `🆔 Chat ID : \`${chatId}\``,
        nouvelleCommande: (orderId, s, adresse) => `🛎️ *Nouvelle commande !*\n\n🆔 *Numéro :* \`${orderId}\`\n👤 *Client :* ${s.name}\n📞 *Tél :* ${s.telephone}\n📦 *Produit :* ${s.produit}\n📍 *Adresse :* ${adresse}`,
        nouveauRdv: (rdvId, s) => `📅 *Nouvelle demande de rendez-vous !*\n\n🆔 *Numéro :* \`${rdvId}\`\n👤 *Client :* ${s.name}\n📞 *Tél :* ${s.telephone}\n📝 *Motif :* ${s.motif}\n🗓️ *Date souhaitée :* ${s.dateRdv}`,
    },
    en: {
        bienvenueClient: "👑 *Welcome!*\n\nI'm SAMII, your assistant. How can I help you today?",
        bienvenueGenerique: (chatId) => `👑 *Welcome to SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nI'm SAMII, your assistant. How can I help?`,
        adminConnecte: "✅ *Telegram connected to your QG!*\n\nYou'll now receive all your orders/appointments here directly. 👑",
        adminErreur: "❌ Connection error. Try again from your QG.",
        commandeAnnulee: "❌ Order cancelled. How can I help you?",
        quelProduit: "🛍️ *Great!*\n\nWhich product would you like to order?\n_(Name, size, color...)_",
        produitsDispo: (liste) => `🛍️ *Here are our available products:*\n\n${liste}\n\nType the *number* of the product you're interested in.`,
        numeroInvalide: "❌ Invalid number. Try again with a number from the list.",
        telephone: "📞 Your *phone number* please?",
        adresse: "📍 Your *delivery address*?",
        choisisOption: (label, liste) => `📦 Choose *${label}*:\n\n${liste}\n\nType the number.`,
        recapCommande: (s, adresse) => `📋 *Order summary*\n\n📦 *Product:* ${s.produit}\n📍 *Address:* ${adresse}\n📞 *Phone:* ${s.telephone}\n\nDo you confirm this order?`,
        commandeEnregistree: (orderId) => `✅ *Order registered!*\n\n🆔 *Number:* \`${orderId}\`\n\n_Please confirm above._ 🙏`,
        quelMotif: "📅 *Appointment request*\n\nWhat is the reason for your request?",
        quelleDate: "🗓️ What *date and time* would suit you? _(e.g. 09/15 at 2pm)_",
        recapRdv: (s) => `📋 *Appointment summary*\n\n📝 *Reason:* ${s.motif}\n🗓️ *Preferred date:* ${s.dateRdv}\n📞 *Phone:* ${s.telephone}\n\nDo you confirm this request?`,
        rdvEnregistre: (rdvId) => `✅ *Appointment request sent!*\n\n🆔 *Number:* \`${rdvId}\`\n\n_The professional will confirm the time._ 🙏`,
        rdvConfirme: (id) => `✅ *Appointment #${id} confirmed!*\n\nSee you soon 🙏`,
        rdvAnnule: (id) => `❌ *Appointment #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        commandeConfirmee: (id) => `✅ *Order #${id} confirmed!*\n\nWe're preparing your package 📦\nThank you for your trust 🙏`,
        commandeAnnuleeId: (id) => `❌ *Order #${id} cancelled.*\n\nIf this is a mistake, reply to us 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
        nouvelleCommande: (orderId, s, adresse) => `🛎️ *New order!*\n\n🆔 *Number:* \`${orderId}\`\n👤 *Client:* ${s.name}\n📞 *Phone:* ${s.telephone}\n📦 *Product:* ${s.produit}\n📍 *Address:* ${adresse}`,
        nouveauRdv: (rdvId, s) => `📅 *New appointment request!*\n\n🆔 *Number:* \`${rdvId}\`\n👤 *Client:* ${s.name}\n📞 *Phone:* ${s.telephone}\n📝 *Reason:* ${s.motif}\n🗓️ *Preferred date:* ${s.dateRdv}`,
    },
    ar: {
        bienvenueClient: "👑 *مرحباً!*\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك اليوم؟",
        bienvenueGenerique: (chatId) => `👑 *مرحباً بك في SAMII OS!*\n\n✅ Chat ID: \`${chatId}\`\n\nأنا سامي، مساعدك. كيف يمكنني مساعدتك؟`,
        adminConnecte: "✅ *تم ربط تيليجرام بمركز قيادتك!*\n\nستستقبل الآن جميع طلباتك ومواعيدك هنا مباشرة. 👑",
        adminErreur: "❌ خطأ في الاتصال. حاول مرة أخرى من مركز القيادة.",
        commandeAnnulee: "❌ تم إلغاء الطلب. كيف يمكنني مساعدتك؟",
        quelProduit: "🛍️ *ممتاز!*\n\nما هو المنتج الذي تريد طلبه؟\n_(الاسم، المقاس، اللون...)_",
        produitsDispo: (liste) => `🛍️ *إليك منتجاتنا المتوفرة:*\n\n${liste}\n\nاكتب *رقم* المنتج الذي يهمك.`,
        numeroInvalide: "❌ رقم غير صحيح. حاول مرة أخرى برقم من القائمة.",
        telephone: "📞 *رقم هاتفك* من فضلك؟",
        adresse: "📍 *عنوان التوصيل*؟",
        choisisOption: (label, liste) => `📦 اختر *${label}* :\n\n${liste}\n\nاكتب الرقم.`,
        recapCommande: (s, adresse) => `📋 *ملخص طلبك*\n\n📦 *المنتج:* ${s.produit}\n📍 *العنوان:* ${adresse}\n📞 *الهاتف:* ${s.telephone}\n\nهل تؤكد هذا الطلب؟`,
        commandeEnregistree: (orderId) => `✅ *تم تسجيل الطلب!*\n\n🆔 *الرقم:* \`${orderId}\`\n\n_يرجى التأكيد أعلاه._ 🙏`,
        quelMotif: "📅 *طلب موعد*\n\nما هو سبب طلبك؟",
        quelleDate: "🗓️ ما هو *التاريخ والوقت* المناسب لك؟ _(مثال: 15/09 الساعة 14:00)_",
        recapRdv: (s) => `📋 *ملخص الموعد*\n\n📝 *السبب:* ${s.motif}\n🗓️ *التاريخ المطلوب:* ${s.dateRdv}\n📞 *الهاتف:* ${s.telephone}\n\nهل تؤكد هذا الطلب؟`,
        rdvEnregistre: (rdvId) => `✅ *تم إرسال طلب الموعد!*\n\n🆔 *الرقم:* \`${rdvId}\`\n\n_سيؤكد لك المختص الموعد._ 🙏`,
        rdvConfirme: (id) => `✅ *تم تأكيد الموعد #${id}!*\n\nإلى اللقاء 🙏`,
        rdvAnnule: (id) => `❌ *تم إلغاء الموعد #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        commandeConfirmee: (id) => `✅ *تم تأكيد الطلب #${id}!*\n\nنحضّر طردك 📦\nشكراً لثقتك 🙏`,
        commandeAnnuleeId: (id) => `❌ *تم إلغاء الطلب #${id}.*\n\nإذا كان هذا خطأ، يرجى الرد علينا 😊`,
        idChat: (chatId) => `🆔 Chat ID: \`${chatId}\``,
        nouvelleCommande: (orderId, s, adresse) => `🛎️ *طلب جديد!*\n\n🆔 *الرقم:* \`${orderId}\`\n👤 *العميل:* ${s.name}\n📞 *الهاتف:* ${s.telephone}\n📦 *المنتج:* ${s.produit}\n📍 *العنوان:* ${adresse}`,
        nouveauRdv: (rdvId, s) => `📅 *طلب موعد جديد!*\n\n🆔 *الرقم:* \`${rdvId}\`\n👤 *العميل:* ${s.name}\n📞 *الهاتف:* ${s.telephone}\n📝 *السبب:* ${s.motif}\n🗓️ *التاريخ المطلوب:* ${s.dateRdv}`,
    },
};

function tr(lang, key, ...args) {
    const dict = T[lang] || T.fr;
    const entry = dict[key] || T.fr[key];
    return typeof entry === "function" ? entry(...args) : entry;
}

async function reply(chatId, text) {
    try {
        await axios.post(`${BASE}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
        });
    } catch (err) {
        console.error("❌ Telegram reply :", err.response?.data || err.message);
    }
}

// ── LIAISON WORKSPACE ──────────────────────────────────────────
async function linkClientToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
        );
        if (existing.length > 0) return;
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram_client', $2, true)`,
            [workspaceId, JSON.stringify({ chatId: String(chatId), linkedAt: new Date().toISOString() })]
        );
        console.log(`🔗 Client ${chatId} lié au workspace ${workspaceId}`);
    } catch (err) {
        console.error("❌ linkClientToWorkspace :", err.message);
    }
}

async function linkMerchantToWorkspace(chatId, workspaceId) {
    try {
        const existing = await db.query(
            `SELECT id FROM connecteurs WHERE type = 'telegram' AND workspace_id = $1`,
            [workspaceId]
        );
        const config = JSON.stringify({ chatId: String(chatId), connectedAt: new Date().toISOString() });
        if (existing.length > 0) {
            await db.query(`UPDATE connecteurs SET config = $1, actif = true WHERE id = $2`, [config, existing[0].id]);
            return true;
        }
        await db.query(
            `INSERT INTO connecteurs (workspace_id, type, config, actif) VALUES ($1, 'telegram', $2, true)`,
            [workspaceId, config]
        );
        return true;
    } catch (err) {
        console.error("❌ linkMerchantToWorkspace :", err.message);
        return false;
    }
}

async function getClientWorkspace(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram_client' AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getWorkspaceByChatId(chatId) {
    try {
        const rows = await db.query(
            `SELECT workspace_id FROM connecteurs WHERE type = 'telegram' AND actif = true AND config LIKE $1`,
            [`%${chatId}%`]
        );
        return rows[0]?.workspace_id || "";
    } catch { return ""; }
}

async function getAdminChatId(workspaceId) {
    try {
        if (!workspaceId) return null;
        const rows = await db.query(
            `SELECT config FROM connecteurs WHERE type = 'telegram' AND actif = true AND workspace_id = $1`,
            [workspaceId]
        );
        if (!rows[0]) return null;
        const config = JSON.parse(rows[0].config || "{}");
        return config.chatId || null;
    } catch { return null; }
}

async function getMetierWorkspace(workspaceId) {
    try {
        if (!workspaceId) return "";
        const rows = await db.query(`SELECT metier FROM workspaces WHERE id = $1`, [workspaceId]);
        return rows[0]?.metier || "";
    } catch { return ""; }
}

function genOrderId() { return `TG-${Date.now().toString().slice(-6)}`; }
function genRdvId() { return `RDV-${Date.now().toString().slice(-6)}`; }

async function getProduitsDuWorkspace(workspaceId) {
    try {
        return await db.query(
            `SELECT id, nom, prix, options FROM produits WHERE workspace_id = $1 AND actif = true ORDER BY nom`,
            [workspaceId]
        );
    } catch { return []; }
}

// ── PARCOURS PRODUIT (e-commerce, restaurant/menu, boutique...) ──
async function handleOrderFlow(chatId, text, name, lang) {
    const session = memory.get(chatId) || {};
    const step = session.step;

    if (!step) {
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        const produits = await getProduitsDuWorkspace(workspaceId);

        if (produits.length === 0) {
            memory.set(chatId, { step: "produit", name, lang });
            await reply(chatId, tr(lang, "quelProduit"));
            return true;
        }

        const listeProduits = produits.map((p, i) => `${i + 1}. *${p.nom}* — ${p.prix} DZD`).join("\n");
        memory.set(chatId, { step: "produit_choix", name, lang, produitsDisponibles: produits });
        await reply(chatId, tr(lang, "produitsDispo", listeProduits));
        return true;
    }

    if (step === "produit_choix") {
        const index = parseInt(text.trim(), 10) - 1;
        const produits = session.produitsDisponibles || [];
        const choisi = produits[index];
        if (!choisi) { await reply(chatId, tr(lang, "numeroInvalide")); return true; }

        const options = choisi.options && typeof choisi.options === "object" ? choisi.options : {};
        const clesOptions = Object.keys(options);
        if (clesOptions.length === 0) {
            memory.set(chatId, { step: "telephone", produit: `${choisi.nom} (${choisi.prix} DZD)`, name: session.name, lang });
            await reply(chatId, tr(lang, "telephone"));
            return true;
        }

        const premiereCle = clesOptions[0];
        const valeursPossibles = options[premiereCle];
        memory.set(chatId, {
            step: "option_choix", name: session.name, lang,
            produitBase: choisi, optionsRestantes: clesOptions, optionIndex: 0, optionsChoisies: {},
        });
        const liste = valeursPossibles.map((v, i) => `${i + 1}. ${v}`).join("\n");
        await reply(chatId, tr(lang, "choisisOption", premiereCle, liste));
        return true;
    }

    if (step === "option_choix") {
        const cleActuelle = session.optionsRestantes[session.optionIndex];
        const valeursPossibles = session.produitBase.options[cleActuelle];
        const index = parseInt(text.trim(), 10) - 1;
        const valeurChoisie = valeursPossibles[index];
        if (!valeurChoisie) { await reply(chatId, tr(lang, "numeroInvalide")); return true; }

        const optionsChoisies = { ...session.optionsChoisies, [cleActuelle]: valeurChoisie };
        const prochainIndex = session.optionIndex + 1;

        if (prochainIndex < session.optionsRestantes.length) {
            const prochaineCle = session.optionsRestantes[prochainIndex];
            const prochainesValeurs = session.produitBase.options[prochaineCle];
            memory.set(chatId, { ...session, optionIndex: prochainIndex, optionsChoisies });
            const liste = prochainesValeurs.map((v, i) => `${i + 1}. ${v}`).join("\n");
            await reply(chatId, tr(lang, "choisisOption", prochaineCle, liste));
            return true;
        }

        const descriptifOptions = Object.entries(optionsChoisies).map(([k, v]) => `${k}: ${v}`).join(", ");
        const produitComplet = `${session.produitBase.nom} (${descriptifOptions}) — ${session.produitBase.prix} DZD`;
        memory.set(chatId, { step: "telephone", produit: produitComplet, name: session.name, lang });
        await reply(chatId, tr(lang, "telephone"));
        return true;
    }

    if (step === "produit") {
        memory.set(chatId, { step: "telephone", produit: text, name: session.name, lang });
        await reply(chatId, tr(lang, "telephone"));
        return true;
    }

    if (step === "telephone") {
        memory.set(chatId, { ...session, step: "adresse", telephone: text });
        await reply(chatId, tr(lang, "adresse"));
        return true;
    }

    if (step === "adresse") {
        const orderId = genOrderId();
        const s = memory.get(chatId);
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        const adminChatId = await getAdminChatId(workspaceId);

        console.log(`🛒 Création commande Telegram — orderId=${orderId}, workspaceId="${workspaceId}", chatId=${chatId}`);
        try {
            await db.query(
                `INSERT INTO commandes (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant)
                 VALUES ($1, $2, $3, $4, $5, $6, 'en attente', 'telegram', 0)`,
                [orderId, workspaceId, s.name || "Inconnu", s.telephone || "", text, s.produit || ""]
            );
            console.log(`✅ Commande ${orderId} créée avec succès sur workspace "${workspaceId}"`);
        } catch (createErr) {
            console.error(`❌ Échec création commande ${orderId} :`, createErr.message);
        }

        await db.query(
            `INSERT INTO journal (action, details, workspace_id) VALUES ($1, $2, $3)`,
            ["order.created.telegram", `#${orderId} — ${s.name}`, workspaceId]
        );

        if (adminChatId) {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id: adminChatId, parse_mode: "Markdown",
                text: tr(lang, "nouvelleCommande", orderId, s, text),
                reply_markup: { inline_keyboard: [[
                    { text: "✅", callback_data: `confirm_${orderId}` },
                    { text: "❌", callback_data: `cancel_${orderId}` },
                ]] },
            });
        }

        await axios.post(`${BASE}/sendMessage`, {
            chat_id: chatId, parse_mode: "Markdown",
            text: tr(lang, "recapCommande", s, text),
            reply_markup: { inline_keyboard: [[
                { text: "✅", callback_data: `confirm_${orderId}` },
                { text: "❌", callback_data: `cancel_${orderId}` },
            ]] },
        });

        memory.clear(chatId);
        await reply(chatId, tr(lang, "commandeEnregistree", orderId));
        return true;
    }

    return false;
}

// ── PARCOURS RENDEZ-VOUS (dentiste, avocat, comptable, coiffeur...) ──
async function handleRdvFlow(chatId, text, name, lang) {
    const session = memory.get(chatId) || {};
    const step = session.step;

    if (!step) {
        memory.set(chatId, { step: "rdv_motif", name, lang });
        await reply(chatId, tr(lang, "quelMotif"));
        return true;
    }

    if (step === "rdv_motif") {
        memory.set(chatId, { step: "rdv_date", motif: text, name: session.name, lang });
        await reply(chatId, tr(lang, "quelleDate"));
        return true;
    }

    if (step === "rdv_date") {
        memory.set(chatId, { ...session, step: "rdv_telephone", dateRdv: text });
        await reply(chatId, tr(lang, "telephone"));
        return true;
    }

    if (step === "rdv_telephone") {
        const rdvId = genRdvId();
        const s = { ...session, telephone: text };
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        const adminChatId = await getAdminChatId(workspaceId);

        try {
            await db.query(
                `INSERT INTO rendez_vous (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
                 VALUES ($1, $2, $3, $4, $5, 'en_attente', 'telegram')`,
                [workspaceId, s.name || "Inconnu", s.telephone, s.motif, s.dateRdv]
            );
            console.log(`✅ Rendez-vous ${rdvId} créé pour workspace "${workspaceId}"`);
        } catch (err) {
            console.error(`❌ Échec création rendez-vous :`, err.message);
        }

        if (adminChatId) {
            await axios.post(`${BASE}/sendMessage`, {
                chat_id: adminChatId, parse_mode: "Markdown",
                text: tr(lang, "nouveauRdv", rdvId, s),
                reply_markup: { inline_keyboard: [[
                    { text: "✅", callback_data: `rdvconfirm_${rdvId}` },
                    { text: "❌", callback_data: `rdvcancel_${rdvId}` },
                ]] },
            });
        }

        await reply(chatId, tr(lang, "recapRdv", s));
        memory.clear(chatId);
        await reply(chatId, tr(lang, "rdvEnregistre", rdvId));
        return true;
    }

    return false;
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

router.post("/", async (req, res) => {
    res.sendStatus(200);
    try {
        const body = req.body;

        if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data || "";
            const lang = memory.get(chatId)?.lang || "fr";

            await axios.post(`${BASE}/answerCallbackQuery`, { callback_query_id: cb.id, text: "⚙️ SAMII..." });

            if (data.startsWith("confirm_")) {
                const orderId = data.replace("confirm_", "");
                await db.query(`UPDATE commandes SET statut = 'confirmée' WHERE id = $1`, [orderId]);
                await orchestrator.process({ type: "order.confirmed", shop: "", payload: { orderId, chatId } });
                await reply(chatId, tr(lang, "commandeConfirmee", orderId));
                return;
            }
            if (data.startsWith("cancel_")) {
                const orderId = data.replace("cancel_", "");
                await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [orderId]);
                await orchestrator.process({ type: "order.cancelled.telegram", shop: "", payload: { orderId, chatId } });
                await reply(chatId, tr(lang, "commandeAnnuleeId", orderId));
                return;
            }
            if (data.startsWith("rdvconfirm_")) {
                const rdvId = data.replace("rdvconfirm_", "");
                await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1`, [rdvId.replace("RDV-", "")]);
                await reply(chatId, tr(lang, "rdvConfirme", rdvId));
                return;
            }
            if (data.startsWith("rdvcancel_")) {
                const rdvId = data.replace("rdvcancel_", "");
                await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1`, [rdvId.replace("RDV-", "")]);
                await reply(chatId, tr(lang, "rdvAnnule", rdvId));
                return;
            }

            await orchestrator.process({ type: "telegram.callback", shop: "", payload: { chatId, data, cb } });
            return;
        }

        const message = body.message;
        if (!message) return;

        const chatId = message.chat.id;
        const text = (message.text || "").trim();
        const name = message.from?.first_name || "Client";
        const langDetectee = detecterLangue(message);
        const lang = memory.get(chatId)?.lang || langDetectee;

        console.log(`📨 Telegram [${name}] (${lang}) : ${text}`);

        if (text.startsWith("/start")) {
            memory.clear(chatId);
            const param = text.split(" ")[1] || null;

            if (param && param.startsWith("admin_")) {
                const workspaceId = param.replace("admin_", "");
                const ok = await linkMerchantToWorkspace(chatId, workspaceId);
                await reply(chatId, ok ? tr(lang, "adminConnecte") : tr(lang, "adminErreur"));
                return;
            }

            if (param) {
                await linkClientToWorkspace(chatId, param);
                await reply(chatId, tr(lang, "bienvenueClient"));
                return;
            }

            await reply(chatId, tr(lang, "bienvenueGenerique", chatId));
            return;
        }

        if (text === "/id") { await reply(chatId, tr(lang, "idChat", chatId)); return; }

        if (isCancelIntent(text) && memory.getStep(chatId)) {
            memory.clear(chatId);
            await reply(chatId, tr(lang, "commandeAnnulee"));
            return;
        }

        if (memory.getStep(chatId)) {
            const session = memory.get(chatId);
            if (session.step?.startsWith("rdv_")) {
                await handleRdvFlow(chatId, text, name, session.lang || lang);
            } else {
                await handleOrderFlow(chatId, text, name, session.lang || lang);
            }
            return;
        }

        // Nouveau parcours — détecte le métier du workspace pour choisir produit vs rendez-vous
        let workspaceId = await getClientWorkspace(chatId);
        if (!workspaceId) workspaceId = await getWorkspaceByChatId(chatId);
        const metier = await getMetierWorkspace(workspaceId);
        const parcours = typeParcours(metier);

        if (isRdvIntent(text) || (parcours === "rdv" && isOrderIntent(text))) {
            await handleRdvFlow(chatId, text, name, lang);
            return;
        }
        if (isOrderIntent(text)) {
            await handleOrderFlow(chatId, text, name, lang);
            return;
        }

        await orchestrator.process({ type: "telegram.message", shop: "", payload: { chatId, text, message } });
        const geminiReply = await planner.ask(text, { source: "telegram", chatId, name, lang });
        await reply(chatId, geminiReply);
    } catch (err) {
        console.error("❌ Telegram webhook :", err.message);
    }
});

module.exports = router;
