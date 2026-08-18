// ======================================================
// SAMII OS — Workspace Routes (fix : plus de vue externe manquante)
// ======================================================
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const workspaceService = require("../services/workspaceService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function generateWorkspaceId() {
    return `WS-${crypto.randomUUID()}`;
}

const PAYS_DEVISE = {
    DZ: { label: "Algérie",  devise: "DZD" },
    FR: { label: "France",   devise: "EUR" },
    MA: { label: "Maroc",    devise: "MAD" },
    TN: { label: "Tunisie",  devise: "TND" },
    US: { label: "États-Unis", devise: "USD" },
    CA: { label: "Canada",   devise: "CAD" },
    SA: { label: "Arabie Saoudite", devise: "SAR" },
    AE: { label: "Émirats arabes unis", devise: "AED" },
    autre: { label: "Autre", devise: "" },
};

router.get("/create", requireAuth, async (req, res) => {
    const existing = await workspaceService.getByOwner(req.session.email);
    if (existing.length > 0) {
        req.session.workspaceId = existing[0].workspaceId;
        req.session.metier      = existing[0].metier;
        return req.session.save(() => res.redirect("/qg"));
    }

    const metier = req.query.metier || "";
    const paysOptions = Object.entries(PAYS_DEVISE)
        .map(([code, p]) => `<option value="${code}" data-devise="${p.devise}">${p.label}</option>`)
        .join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SAMII vous accueille</title>
    <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ background:#050505; font-family:Arial,sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; color:white; padding:20px; }
        .box{ width:100%; max-width:440px; background:#12121a; padding:32px; border-radius:16px; border:1px solid rgba(197,160,89,.25); }
        .lang-switch{ display:flex; gap:4px; justify-content:center; margin-bottom:20px; font-size:.68rem; }
        .lang-switch span{ padding:5px 10px; border-radius:6px; cursor:pointer; color:#777; border:1px solid #333; transition:.2s ease; }
        .lang-switch span.active, .lang-switch span:hover{ color:#C5A059; border-color:#C5A059; background:rgba(197,160,89,.08); }
        .samii-line{ display:flex; gap:10px; align-items:flex-start; margin-bottom:18px; }
        .samii-avatar{ width:36px; height:36px; border-radius:50%; flex-shrink:0; background:linear-gradient(145deg,#7d5cff,#5a3fe0); display:flex; align-items:center; justify-content:center; font-size:16px; }
        .samii-bubble{ background:#1a1a24; border-radius:12px; padding:12px 14px; font-size:.88rem; line-height:1.5; color:#e8e4d8; }
        input, select{ width:100%; padding:12px; margin-top:8px; margin-bottom:16px; border:1px solid #333; border-radius:8px; background:#0d0d12; color:white; font-size:.95rem; }
        input:focus, select:focus{ outline:none; border-color:#C5A059; }
        label{ font-size:.78rem; color:#86807A; letter-spacing:.03em; }
        button{ width:100%; padding:13px; margin-top:10px; background:#C5A059; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer; color:#000; }
        button:hover{ opacity:.9; }
        .msg{ margin-top:14px; text-align:center; font-size:.88rem; color:#e55; min-height:20px; }
        .msg.ok{ color:#4caf50; }
        #custom-metier-wrap{ display:none; }
    </style>
</head>
<body>
<div class="box">
    <div class="lang-switch">
        <span data-lang="fr" class="active">FR</span>
        <span data-lang="en">EN</span>
        <span data-lang="ar">AR</span>
        <span data-lang="zh">中</span>
    </div>
    <div class="samii-line">
        <div class="samii-avatar">🤖</div>
        <div class="samii-bubble" data-i18n="ws.welcome">
            Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG${metier ? ` <b>${metier}</b>` : ""}, j'ai besoin de quelques infos pour bien l'adapter à votre réalité.
        </div>
    </div>
    <form id="form-workspace">
        <label data-i18n="ws.nom.label">Nom de votre boutique / entreprise</label>
        <input name="nom" data-i18n-ph="ws.nom.ph" placeholder="Ex : Le Souverain Store" required>

        <input type="hidden" name="metier" id="metier-hidden" value="${metier}">
        ${!metier ? `
        <label data-i18n="ws.metier.label">Votre métier</label>
        <select name="metierSelect" id="metier-select">
            <option value="ecommerce" data-i18n="ws.metier.ecommerce">E-commerce</option>
            <option value="restaurant" data-i18n="ws.metier.restaurant">Restaurant</option>
            <option value="autre" data-i18n="ws.metier.autre">Autre</option>
        </select>
        <div id="custom-metier-wrap">
            <label data-i18n="ws.metierCustom.label">Précisez votre métier</label>
            <input name="metierCustom" id="metier-custom" data-i18n-ph="ws.metierCustom.ph" placeholder="Ex : Coiffeur">
        </div>` : ''}

        <label data-i18n="ws.description.label">Description (optionnel)</label>
        <input name="description" data-i18n-ph="ws.description.ph" placeholder="Décrivez votre activité en une phrase">

        <label data-i18n="ws.pays.label">Votre pays</label>
        <select name="pays" id="select-pays">
            <option value="" data-i18n="ws.pays.placeholder">Choisissez votre pays</option>
            ${paysOptions}
        </select>

        <label data-i18n="ws.devise.label">Devise</label>
        <input name="devise" id="input-devise" data-i18n-ph="ws.devise.ph" placeholder="Sera pré-remplie selon le pays" readonly>

        <button type="submit" data-i18n="ws.submit">Créer mon QG</button>
    </form>
    <div class="msg" id="msg"></div>
</div>
<script>
const I18N = {
    fr: {
        'ws.welcome': 'Bonjour Général ! Je suis <b>SAMII</b>. Avant de construire votre QG${metier ? ` <b>${metier}</b>` : ""}, j\\'ai besoin de quelques infos pour bien l\\'adapter à votre réalité.',
        'ws.nom.label': 'Nom de votre boutique / entreprise', 'ws.nom.ph': 'Ex : Le Souverain Store',
        'ws.metier.label': 'Votre métier', 'ws.metier.ecommerce': 'E-commerce', 'ws.metier.restaurant': 'Restaurant', 'ws.metier.autre': 'Autre',
        'ws.metierCustom.label': 'Précisez votre métier', 'ws.metierCustom.ph': 'Ex : Coiffeur',
        'ws.description.label': 'Description (optionnel)', 'ws.description.ph': 'Décrivez votre activité en une phrase',
        'ws.pays.label': 'Votre pays', 'ws.pays.placeholder': 'Choisissez votre pays',
        'ws.devise.label': 'Devise', 'ws.devise.ph': 'Sera pré-remplie selon le pays',
        'ws.submit': 'Créer mon QG',
        'msg.creating': '⏳ SAMII prépare votre QG...', 'msg.created': '✅ QG créé ! Redirection...',
        'msg.error_default': '❌ Erreur. Réessayez.',
    },
    en: {
        'ws.welcome': 'Hello General! I am <b>SAMII</b>. Before building your HQ${metier ? ` <b>${metier}</b>` : ""}, I need a few details to tailor it to your business.',
        'ws.nom.label': 'Name of your store / business', 'ws.nom.ph': 'E.g.: Le Souverain Store',
        'ws.metier.label': 'Your business type', 'ws.metier.ecommerce': 'E-commerce', 'ws.metier.restaurant': 'Restaurant', 'ws.metier.autre': 'Other',
        'ws.metierCustom.label': 'Specify your business type', 'ws.metierCustom.ph': 'E.g.: Hairdresser',
        'ws.description.label': 'Description (optional)', 'ws.description.ph': 'Describe your business in one sentence',
        'ws.pays.label': 'Your country', 'ws.pays.placeholder': 'Choose your country',
        'ws.devise.label': 'Currency', 'ws.devise.ph': 'Will be filled in based on your country',
        'ws.submit': 'Create my HQ',
        'msg.creating': '⏳ SAMII is preparing your HQ...', 'msg.created': '✅ HQ created! Redirecting...',
        'msg.error_default': '❌ Error. Please try again.',
    },
    ar: {
        'ws.welcome': 'مرحبًا أيها الجنرال! أنا <b>SAMII</b>. قبل بناء مقر قيادتك${metier ? ` <b>${metier}</b>` : ""}، أحتاج إلى بعض المعلومات لتكييفه مع نشاطك.',
        'ws.nom.label': 'اسم متجرك / شركتك', 'ws.nom.ph': 'مثال: متجر السيادة',
        'ws.metier.label': 'مجال نشاطك', 'ws.metier.ecommerce': 'تجارة إلكترونية', 'ws.metier.restaurant': 'مطعم', 'ws.metier.autre': 'آخر',
        'ws.metierCustom.label': 'حدد مجال نشاطك', 'ws.metierCustom.ph': 'مثال: حلّاق',
        'ws.description.label': 'الوصف (اختياري)', 'ws.description.ph': 'صف نشاطك في جملة واحدة',
        'ws.pays.label': 'بلدك', 'ws.pays.placeholder': 'اختر بلدك',
        'ws.devise.label': 'العملة', 'ws.devise.ph': 'ستُملأ تلقائيًا حسب البلد',
        'ws.submit': 'إنشاء مقر قيادتي',
        'msg.creating': '⏳ SAMII يجهّز مقر قيادتك...', 'msg.created': '✅ تم إنشاء المقر! جارٍ التحويل...',
        'msg.error_default': '❌ خطأ. حاول مرة أخرى.',
    },
    zh: {
        'ws.welcome': '你好，将军！我是 <b>SAMII</b>。在搭建你的指挥部${metier ? ` <b>${metier}</b>` : ""}之前，我需要一些信息来更好地适配你的业务。',
        'ws.nom.label': '你的店铺 / 企业名称', 'ws.nom.ph': '例如：Le Souverain Store',
        'ws.metier.label': '你的行业', 'ws.metier.ecommerce': '电商', 'ws.metier.restaurant': '餐饮', 'ws.metier.autre': '其他',
        'ws.metierCustom.label': '请说明你的行业', 'ws.metierCustom.ph': '例如：理发师',
        'ws.description.label': '描述（可选）', 'ws.description.ph': '用一句话描述你的业务',
        'ws.pays.label': '你的国家', 'ws.pays.placeholder': '选择你的国家',
        'ws.devise.label': '货币', 'ws.devise.ph': '将根据国家自动填写',
        'ws.submit': '创建我的指挥部',
        'msg.creating': '⏳ SAMII 正在准备你的指挥部...', 'msg.created': '✅ 指挥部已创建！正在跳转...',
        'msg.error_default': '❌ 错误，请重试。',
    },
};

let currentLang = localStorage.getItem('samii_lang') || 'fr';
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.fr[key] || key; }

function applyLang(lang) {
    if (!I18N[lang]) lang = 'fr';
    currentLang = lang;
    localStorage.setItem('samii_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[lang][key] !== undefined) el.innerHTML = I18N[lang][key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll('.lang-switch span').forEach(s => s.classList.toggle('active', s.dataset.lang === lang));
}

document.querySelectorAll('.lang-switch span').forEach(span => {
    span.addEventListener('click', () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById('select-pays').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    document.getElementById('input-devise').value = opt?.dataset.devise || "";
});

const metierSelect = document.getElementById('metier-select');
if (metierSelect) {
    metierSelect.addEventListener('change', (e) => {
        document.getElementById('custom-metier-wrap').style.display = e.target.value === 'autre' ? 'block' : 'none';
        document.getElementById('metier-hidden').value = e.target.value;
    });
    document.getElementById('metier-hidden').value = metierSelect.value;
}

document.getElementById('form-workspace').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg');
    const data = Object.fromEntries(new FormData(e.target));
    msg.textContent = t('msg.creating');
    msg.className   = 'msg';

    const res  = await fetch('/workspace/create', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(data),
    });
    const json = await res.json();

    if (json.success) {
        msg.textContent = t('msg.created');
        msg.className   = 'msg ok';
        window.location.href = '/qg';
    } else {
        msg.textContent = json.error || t('msg.error_default');
    }
});
</script>
</body>
</html>`);
});

router.post("/create", requireAuth, async (req, res) => {
    try {
        const { nom, metier, metierCustom, description, pays, devise } = req.body;
        const email = req.session?.email || "";

        if (!nom || !nom.trim()) {
            return res.json({ success: false, error: "Le nom du workspace est obligatoire." });
        }
        if (!metier || !metier.trim()) {
            return res.json({ success: false, error: "Le métier est obligatoire." });
        }
        if (!pays) {
            return res.json({ success: false, error: "Le pays est requis." });
        }

        let metierFinal = metier.trim();
        if (metierFinal === "autre") {
            const custom = metierCustom?.trim() || "";
            if (!custom) {
                return res.json({ success: false, error: "Précisez votre métier." });
            }
            metierFinal = custom.toLowerCase();
        }

        const workspaceId = generateWorkspaceId();

        const workspace = await workspaceService.create({
            workspaceId,
            owner      : email,
            nom        : nom.trim(),
            metier     : metierFinal,
            description: description?.trim() || "",
            pays,
            devise: devise || "",
            langue: "fr",
            logo  : "",
        });

        if (!workspace) {
            return res.json({ success: false, error: "Erreur lors de la création. Réessayez." });
        }

        req.session.workspaceId   = workspace.workspaceId;
        req.session.metier        = workspace.metier;
        req.session.lastWorkspace = workspace.workspaceId;
        // ── Email de bienvenue (ne bloque jamais la création si ça échoue) ──
try {
    const notificationEngine = require("../engines/notificationEngine");
    await notificationEngine.send({
        channel: "email",
        to: email,
       message: `Bienvenue dans OG Technology, Soldat !\n\nVotre QG "${workspace.nom}" est prêt. SAMII est déjà à votre poste pour vous accompagner.\n\nAllez jeter un œil : https://samii.souverain-store.com/qg\n\nÀ votre conquête 👑`,
    });
} catch (mailErr) {
    console.warn("⚠️ Email de bienvenue non envoyé :", mailErr.message);
}

        req.session.save((err) => {
            if (err) return res.json({ success: false, error: "Erreur de session." });
            res.json({ success: true, redirect: "/qg" });
        });

    } catch (err) {
        console.error("❌ POST /workspace/create :", err.message);
        res.json({ success: false, error: "Erreur interne. Réessayez." });
    }
});

// ── ONBOARDING CONVERSATIONNEL ────────────────────────────────────────────
// Remplace le formulaire par une conversation avec Sami : mêmes champs,
// mêmes règles, même workspaceService.create() que POST /create ci-dessus —
// seule la façon de les recueillir change. Le formulaire classique reste
// disponible (GET /create) en repli, rien n'est retiré.
const METIERS_VALIDES = new Set([
    "ecommerce", "restaurant", "immobilier", "livreur", "sante", "finance",
    "education", "technologie", "agriculture", "industrie", "services", "tourisme",
]);
const PAYS_VALIDES = new Set(["DZ", "MA", "TN", "FR", "BE", "CA", "SN", "CI", "OTHER"]);

router.post("/onboarding-chat", requireAuth, async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message || !message.trim()) {
            return res.json({ success: false, error: "Message vide." });
        }

        const gemini = require("../services/geminiService");
        const email = req.session?.email || "";
        const prenom = (req.session?.nom || "").split(" ")[0] || "";

        const result = await gemini.chat({
            message: message.trim(),
            context: {
                source: "onboarding",
                audience: "souverain",
                prenom,
                instructions:
                    "Tu accompagnes un nouveau membre qui vient de s'inscrire, pour créer son QG (workspace). " +
                    "Pose les questions une par une, jamais toutes en même temps : d'abord comment il veut appeler son activité (nom), " +
                    "puis ce qu'il fait exactement (pour en déduire le métier), puis dans quel pays il est basé. " +
                    "Reste bref et naturel, une ou deux phrases par message. Dès que tu as ces trois informations, " +
                    "appelle creer_workspace — n'attends pas d'avoir plus de détails que nécessaire.",
            },
            useTools: true,
            history: Array.isArray(history) ? history.slice(-20) : [],
        });

        if (result.type !== "function_call" || result.name !== "creer_workspace") {
            return res.json({ success: true, reply: result.text, redirect: null });
        }

        const args = result.args || {};
        const nom = (args.nom || "").trim();
        let metierFinal = (args.metier || "").trim().toLowerCase();
        const pays = PAYS_VALIDES.has(args.pays) ? args.pays : "OTHER";

        if (!nom) {
            return res.json({ success: true, reply: "Il me manque le nom de ton activité — comment tu veux l'appeler ?", redirect: null });
        }
        if (metierFinal === "autre" || !METIERS_VALIDES.has(metierFinal)) {
            const custom = (args.metierCustom || "").trim();
            metierFinal = custom ? custom.toLowerCase() : "autre";
        }

        const workspaceId = generateWorkspaceId();
        const workspace = await workspaceService.create({
            workspaceId,
            owner      : email,
            nom,
            metier     : metierFinal,
            description: (args.description || "").trim(),
            pays,
            devise: "",
            langue: "fr",
            logo  : "",
        });

        if (!workspace) {
            return res.json({ success: true, reply: "Je n'ai pas réussi à créer ton QG, on réessaie ?", redirect: null });
        }

        req.session.workspaceId   = workspace.workspaceId;
        req.session.metier        = workspace.metier;
        req.session.lastWorkspace = workspace.workspaceId;

        try {
            const notificationEngine = require("../engines/notificationEngine");
            await notificationEngine.send({
                channel: "email",
                to: email,
                message: `Bienvenue dans OG Technology, Soldat !\n\nVotre QG "${workspace.nom}" est prêt. SAMII est déjà à votre poste pour vous accompagner.\n\nAllez jeter un œil : https://samii.souverain-store.com/qg\n\nÀ votre conquête 👑`,
            });
        } catch (mailErr) {
            console.warn("⚠️ Email de bienvenue non envoyé :", mailErr.message);
        }

        req.session.save((err) => {
            if (err) return res.json({ success: false, error: "Erreur de session." });
            res.json({
                success : true,
                reply   : `✅ Ton QG "${workspace.nom}" est prêt ! Je t'y emmène →`,
                redirect: "/qg",
            });
        });

    } catch (err) {
        console.error("❌ POST /workspace/onboarding-chat :", err.message);
        res.json({ success: false, error: "Erreur serveur. Réessaie." });
    }
});

module.exports = router;
