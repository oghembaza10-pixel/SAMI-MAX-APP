// ==========================================================================
// SAMII OS — PARRAINAGE — Lien perso, filleuls, gains en temps réel
// Parrain : 20% récurrent sur les paiements du filleul (12 mois).
// Filleul : 5% de réduction sur son propre abonnement (12 mois).
// ==========================================================================
const express = require("express");
const router = express.Router();
const CONFIG = require("../config");
const referralService = require("../services/referralService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function devise(montant, code) {
    const n = parseFloat(montant) || 0;
    return `${n.toFixed(2)} ${escapeHtml(code || "USD")}`;
}

router.get("/resume", requireAuth, async (req, res) => {
    try {
        const resume = await referralService.resumeParrain(req.session.userId);
        res.json({
            success: true,
            nbFilleuls: resume.filleuls.length,
            confirme: resume.confirme,
            enAttente: resume.enAttente,
        });
    } catch (err) {
        console.error("❌ GET /parrainage/resume :", err.message);
        res.json({ success: false });
    }
});

router.get("/", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    let code = "";
    let resume = { filleuls: [], commissions: [], confirme: 0, enAttente: 0 };

    try {
        code = await referralService.assurerCodeParrainage(userId);
        resume = await referralService.resumeParrain(userId);
    } catch (err) {
        console.error("❌ GET /parrainage :", err.message);
    }

    const lienParrainage = `${CONFIG.APP_URL}/register?ref=${code}`;
    const retourHref = req.session.typeCompte === "client" ? "/client-qg" : "/qg";

    const filleulsHtml = resume.filleuls.length ? resume.filleuls.map(f => {
        const nomComplet = `${f.prenom || ""} ${f.nom || ""}`.trim() || f.email || "";
        const nomAffiche = nomComplet ? escapeHtml(nomComplet) : `<span data-i18n="parrainage.filleul_default">Filleul</span>`;
        const commissionsFilleul = resume.commissions.filter(c => c.filleul_id === f.id);
        const totalFilleul = commissionsFilleul.reduce((s, c) => s + (parseFloat(c.commission_montant) || 0), 0);
        const boutiqueLigne = f.boutique_nom
            ? `<span class="pr-filleul-boutique">🏪 ${escapeHtml(f.boutique_nom)}${f.boutique_metier ? ` · ${escapeHtml(f.boutique_metier)}` : ""}</span>`
            : "";
        return `
        <div class="pr-filleul">
            <div class="pr-filleul-avatar">${escapeHtml((f.prenom || f.email || "?").charAt(0).toUpperCase())}</div>
            <div class="pr-filleul-info">
                <strong>${nomAffiche}</strong>
                ${boutiqueLigne}
                <span><span class="pr-count">${commissionsFilleul.length}</span> <span data-i18n="parrainage.payments_word">paiement(s) généré(s)</span></span>
            </div>
            <div class="pr-filleul-gain">+${totalFilleul.toFixed(2)}</div>
        </div>`;
    }).join("") : `<div class="pr-empty"><i data-lucide="users"></i><p data-i18n="parrainage.empty.filleuls">Aucun filleul pour l'instant. Partage ton lien !</p></div>`;

    const gainsHtml = resume.commissions.length ? resume.commissions.slice(0, 30).map(c => `
        <div class="pr-gain-row" data-id="${c.id}">
            <span class="pr-gain-plan">${c.plan ? escapeHtml(c.plan) : `<span data-i18n="parrainage.plan_default">abonnement</span>`} · <span data-i18n="parrainage.month_word">mois</span> ${c.mois_numero}/12</span>
            <span class="pr-gain-statut pr-gain-statut--${c.statut === "confirmee" ? "ok" : "attente"}" data-i18n="${c.statut === "confirmee" ? "parrainage.status.confirmed" : "parrainage.status.pending"}">${c.statut === "confirmee" ? "Confirmé" : "En attente"}</span>
            <span class="pr-gain-montant">+${devise(c.commission_montant, c.devise)}</span>
        </div>`).join("") : `<div class="pr-empty"><i data-lucide="sparkles"></i><p data-i18n="parrainage.empty.gains">Tes gains apparaîtront ici dès qu'un filleul paiera son abonnement.</p></div>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devenez partenaire SAMII — SAMII OS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --gold:#d7b34c; --green:#3ddc84; --border:rgba(0,217,255,.16); --radius:18px; --cyan-glow:0 0 15px rgba(0,217,255,.45); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding:0 0 70px; }
.pr-wrap { max-width:720px; margin:0 auto; padding:0 20px; }
.pr-top-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:20px 0 0; }
.back-link { display:inline-flex; align-items:center; gap:8px; color:var(--muted); text-decoration:none; font-size:13px; }
.back-link:hover { color:var(--blue); }
.lang-switch { display:flex; gap:2px; font-family:"JetBrains Mono"; font-size:10.5px; padding:3px; border:1px solid var(--border); border-radius:9px; background:rgba(0,217,255,.04); }
.lang-switch span { padding:5px 8px; border-radius:6px; cursor:pointer; color:var(--muted); transition:.2s ease; }
.lang-switch span.active, .lang-switch span:hover { color:var(--blue); background:rgba(0,217,255,.1); box-shadow:inset 0 0 0 1px rgba(0,217,255,.18); }
h1 { font-size:24px; margin:18px 0 4px; display:flex; align-items:center; gap:10px; }
.pr-sub { color:var(--muted); font-size:13.5px; margin-bottom:24px; }
.pr-link-card { background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:18px; }
.pr-link-card label { display:block; font-family:"JetBrains Mono"; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-bottom:8px; }
.pr-link-row { display:flex; gap:10px; }
.pr-link-row input { flex:1; padding:12px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--blue); font-size:13px; font-family:"JetBrains Mono"; outline:none; }
.pr-copy-btn { padding:0 18px; border-radius:10px; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; cursor:pointer; box-shadow:var(--cyan-glow); white-space:nowrap; }
.pr-pitch { margin:14px 0 0; padding-top:14px; border-top:1px dashed var(--border); font-size:12.5px; line-height:1.6; color:var(--muted); }
.pr-terms { display:flex; gap:14px; margin-top:14px; flex-wrap:wrap; }
.pr-term { flex:1; min-width:140px; background:rgba(0,217,255,.06); border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
.pr-term strong { display:block; color:var(--blue); font-size:16px; font-family:"JetBrains Mono"; }
.pr-term span { font-size:11px; color:var(--muted); }
.pr-stats-bar { display:flex; gap:14px; margin:20px 0; }
.pr-stat { flex:1; background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:18px; text-align:center; }
.pr-stat strong { display:block; font-family:"JetBrains Mono"; font-size:22px; color:var(--green); }
.pr-stat strong.attente { color:var(--gold); }
.pr-stat span { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.section-title { font-size:15px; font-weight:800; margin:28px 0 12px; display:flex; align-items:center; gap:8px; }
.section-title svg { width:16px; height:16px; color:var(--blue); }
.pr-filleul { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:12px 14px; margin-bottom:10px; }
.pr-filleul-avatar { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); display:grid; place-items:center; font-weight:800; color:#001018; flex-shrink:0; }
.pr-filleul-info { flex:1; display:flex; flex-direction:column; }
.pr-filleul-info strong { font-size:13.5px; }
.pr-filleul-info span { font-size:11px; color:var(--muted); }
.pr-filleul-boutique { font-size:11.5px; color:var(--blue); }
.pr-filleul-gain { font-family:"JetBrains Mono"; color:var(--green); font-weight:700; }
.pr-gain-row { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:11px 14px; margin-bottom:8px; font-size:12.5px; }
.pr-gain-plan { flex:1; color:var(--muted); }
.pr-gain-statut { font-size:10px; font-family:"JetBrains Mono"; padding:3px 9px; border-radius:20px; }
.pr-gain-statut--ok { color:var(--green); background:rgba(61,220,132,.1); }
.pr-gain-statut--attente { color:var(--gold); background:rgba(215,179,76,.1); }
.pr-gain-montant { font-family:"JetBrains Mono"; color:var(--green); font-weight:700; }
.pr-empty { text-align:center; padding:40px 20px; border:1px dashed var(--border); border-radius:16px; color:var(--muted); }
.pr-empty svg { width:30px; height:30px; color:var(--blue); margin-bottom:10px; }
.pr-flash { position:fixed; bottom:20px; right:20px; background:var(--green); color:#001018; padding:12px 18px; border-radius:12px; font-weight:800; font-size:13px; box-shadow:0 4px 20px rgba(61,220,132,.4); transform:translateY(120%); transition:.3s; }
.pr-flash.show { transform:translateY(0); }
</style>
</head>
<body>
<div class="pr-top-row">
    <a href="${retourHref}" class="back-link"><i data-lucide="arrow-left"></i> <span data-i18n="nav.back">Retour</span></a>
    <div class="lang-switch">
        <span data-lang="fr" class="active">FR</span>
        <span data-lang="en">EN</span>
        <span data-lang="ar">AR</span>
        <span data-lang="zh">中</span>
    </div>
</div>
<div class="pr-wrap">
    <h1>🤝 <span data-i18n="parrainage.title">Devenez partenaire SAMII</span></h1>
    <p class="pr-sub" data-i18n="parrainage.subtitle">Vous gardez la relation avec vos clients. Nous fournissons la technologie. 20% récurrent pendant 12 mois sur chaque compte que vous apportez.</p>

    <div class="pr-link-card">
        <label data-i18n="parrainage.link.label">Ton lien de parrainage</label>
        <div class="pr-link-row">
            <input id="lien-parrainage" readonly value="${escapeHtml(lienParrainage)}">
            <button class="pr-copy-btn" id="btn-copier" data-i18n="parrainage.copy">Copier</button>
        </div>
        <div class="pr-terms">
            <div class="pr-term"><strong>20%</strong><span data-i18n="parrainage.term1.desc">Toi, sur chaque paiement de ton filleul — 12 mois</span></div>
            <div class="pr-term"><strong>5%</strong><span data-i18n="parrainage.term2.desc">Ton filleul, sur son propre abonnement — 12 mois</span></div>
        </div>
        <p class="pr-pitch" data-i18n="parrainage.pitch">Freelance, agence e-commerce, intégrateur : proposez SAMII à vos propres clients comme une extension de votre prestation (installation, configuration WhatsApp, automatisations — vous facturez ce que vous voulez dessus), et touchez en plus cette commission récurrente tant qu'ils restent actifs.</p>
    </div>

    <div class="pr-stats-bar">
        <div class="pr-stat"><strong id="stat-confirme">${resume.confirme.toFixed(2)}</strong><span data-i18n="parrainage.stat.confirmed">Gains confirmés</span></div>
        <div class="pr-stat"><strong class="attente" id="stat-attente">${resume.enAttente.toFixed(2)}</strong><span data-i18n="parrainage.stat.pending">En attente</span></div>
        <div class="pr-stat"><strong id="stat-filleuls">${resume.filleuls.length}</strong><span data-i18n="parrainage.stat.filleuls">Filleuls</span></div>
    </div>

    <div class="section-title"><i data-lucide="users"></i> <span data-i18n="parrainage.section.filleuls">Tes filleuls</span></div>
    <div id="liste-filleuls">${filleulsHtml}</div>

    <div class="section-title"><i data-lucide="wallet"></i> <span data-i18n="parrainage.section.gains">Historique des gains</span></div>
    <div id="liste-gains">${gainsHtml}</div>
</div>

<div class="pr-flash" id="flash" data-i18n="parrainage.flash.gain">💰 Nouveau gain reçu !</div>

<script src="/socket.io/socket.io.js"></script>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const I18N = {
    fr: {
        "nav.back": "Retour",
        "parrainage.title": "Devenez partenaire SAMII",
        "parrainage.subtitle": "Vous gardez la relation avec vos clients. Nous fournissons la technologie. 20% récurrent pendant 12 mois sur chaque compte que vous apportez.",
        "parrainage.link.label": "Ton lien de parrainage",
        "parrainage.copy": "Copier",
        "parrainage.copied": "Copié !",
        "parrainage.term1.desc": "Toi, sur chaque paiement de ton filleul — 12 mois",
        "parrainage.term2.desc": "Ton filleul, sur son propre abonnement — 12 mois",
        "parrainage.pitch": "Freelance, agence e-commerce, intégrateur : proposez SAMII à vos propres clients comme une extension de votre prestation (installation, configuration WhatsApp, automatisations — vous facturez ce que vous voulez dessus), et touchez en plus cette commission récurrente tant qu'ils restent actifs.",
        "parrainage.stat.confirmed": "Gains confirmés",
        "parrainage.stat.pending": "En attente",
        "parrainage.stat.filleuls": "Filleuls",
        "parrainage.section.filleuls": "Tes filleuls",
        "parrainage.section.gains": "Historique des gains",
        "parrainage.empty.filleuls": "Aucun filleul pour l'instant. Partage ton lien !",
        "parrainage.empty.gains": "Tes gains apparaîtront ici dès qu'un filleul paiera son abonnement.",
        "parrainage.filleul_default": "Filleul",
        "parrainage.payments_word": "paiement(s) généré(s)",
        "parrainage.plan_default": "abonnement",
        "parrainage.month_word": "mois",
        "parrainage.status.confirmed": "Confirmé",
        "parrainage.status.pending": "En attente",
        "parrainage.flash.gain": "💰 Nouveau gain reçu !"
    },
    en: {
        "nav.back": "Back",
        "parrainage.title": "Become a SAMII partner",
        "parrainage.subtitle": "You keep the relationship with your clients. We provide the technology. 20% recurring for 12 months on every account you bring in.",
        "parrainage.link.label": "Your referral link",
        "parrainage.copy": "Copy",
        "parrainage.copied": "Copied!",
        "parrainage.term1.desc": "You, on every payment made by your referral — 12 months",
        "parrainage.term2.desc": "Your referral, on their own subscription — 12 months",
        "parrainage.pitch": "Freelancer, e-commerce agency, integrator: offer SAMII to your own clients as an extension of your service (installation, WhatsApp setup, automations — you charge whatever you want for that), and earn this recurring commission on top for as long as they stay active.",
        "parrainage.stat.confirmed": "Confirmed earnings",
        "parrainage.stat.pending": "Pending",
        "parrainage.stat.filleuls": "Referrals",
        "parrainage.section.filleuls": "Your referrals",
        "parrainage.section.gains": "Earnings history",
        "parrainage.empty.filleuls": "No referrals yet. Share your link!",
        "parrainage.empty.gains": "Your earnings will show up here as soon as a referral pays for their subscription.",
        "parrainage.filleul_default": "Referral",
        "parrainage.payments_word": "payment(s) generated",
        "parrainage.plan_default": "subscription",
        "parrainage.month_word": "month",
        "parrainage.status.confirmed": "Confirmed",
        "parrainage.status.pending": "Pending",
        "parrainage.flash.gain": "💰 New earning received!"
    },
    ar: {
        "nav.back": "رجوع",
        "parrainage.title": "كن شريكًا لـ SAMII",
        "parrainage.subtitle": "تحتفظ بعلاقتك مع عملائك. نحن نوفّر التقنية. 20% عمولة متكررة لمدة 12 شهرًا على كل حساب تجلبه.",
        "parrainage.link.label": "رابط الإحالة الخاص بك",
        "parrainage.copy": "نسخ",
        "parrainage.copied": "تم النسخ!",
        "parrainage.term1.desc": "أنت، على كل دفعة يقوم بها من أحلته — 12 شهرًا",
        "parrainage.term2.desc": "من أحلته، على اشتراكه الخاص — 12 شهرًا",
        "parrainage.pitch": "مستقل، وكالة تجارة إلكترونية، مكامل تقني: اقترح SAMII على عملائك كامتداد لخدمتك (تثبيت، إعداد WhatsApp، أتمتة — وأنت من يحدد سعر ذلك)، واحصل بالإضافة إلى ذلك على هذه العمولة المتكررة طالما بقي عميلك نشطًا.",
        "parrainage.stat.confirmed": "أرباح مؤكدة",
        "parrainage.stat.pending": "قيد الانتظار",
        "parrainage.stat.filleuls": "الإحالات",
        "parrainage.section.filleuls": "إحالاتك",
        "parrainage.section.gains": "سجل الأرباح",
        "parrainage.empty.filleuls": "لا توجد إحالات بعد. شارك رابطك!",
        "parrainage.empty.gains": "ستظهر أرباحك هنا بمجرد أن تدفع إحالة اشتراكها.",
        "parrainage.filleul_default": "إحالة",
        "parrainage.payments_word": "دفعات تم إنشاؤها",
        "parrainage.plan_default": "اشتراك",
        "parrainage.month_word": "شهر",
        "parrainage.status.confirmed": "مؤكد",
        "parrainage.status.pending": "قيد الانتظار",
        "parrainage.flash.gain": "💰 تم استلام ربح جديد!"
    },
    zh: {
        "nav.back": "返回",
        "parrainage.title": "成为 SAMII 合作伙伴",
        "parrainage.subtitle": "你保留与客户的关系，我们提供技术。你带来的每个账户，12个月内可获得20%的持续佣金。",
        "parrainage.link.label": "你的推荐链接",
        "parrainage.copy": "复制",
        "parrainage.copied": "已复制！",
        "parrainage.term1.desc": "你，从被推荐人的每笔付款中获得 — 12个月",
        "parrainage.term2.desc": "被推荐人，在其自身订阅上获得 — 12个月",
        "parrainage.pitch": "自由职业者、电商代理、系统集成商：把 SAMII 作为你自身服务的延伸推荐给你的客户（安装、WhatsApp 配置、自动化——费用由你自己定），只要客户保持活跃，你就能额外获得这份持续佣金。",
        "parrainage.stat.confirmed": "已确认收益",
        "parrainage.stat.pending": "待确认",
        "parrainage.stat.filleuls": "被推荐人",
        "parrainage.section.filleuls": "你的被推荐人",
        "parrainage.section.gains": "收益记录",
        "parrainage.empty.filleuls": "暂无被推荐人。分享你的链接吧！",
        "parrainage.empty.gains": "一旦有被推荐人支付订阅费用，你的收益将显示在这里。",
        "parrainage.filleul_default": "被推荐人",
        "parrainage.payments_word": "笔付款已生成",
        "parrainage.plan_default": "订阅",
        "parrainage.month_word": "月",
        "parrainage.status.confirmed": "已确认",
        "parrainage.status.pending": "待确认",
        "parrainage.flash.gain": "💰 收到新收益！"
    }
};

let currentLang = localStorage.getItem("samii_lang") || "fr";
function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.fr[key] || key; }

function applyLang(lang) {
    if (!I18N[lang]) lang = "fr";
    currentLang = lang;
    localStorage.setItem("samii_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (I18N[lang][key] !== undefined) el.textContent = I18N[lang][key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
        const key = el.getAttribute("data-i18n-ph");
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll(".lang-switch span").forEach(s => s.classList.toggle("active", s.dataset.lang === lang));
}

document.querySelectorAll(".lang-switch span").forEach(span => {
    span.addEventListener("click", () => applyLang(span.dataset.lang));
});

applyLang(currentLang);

document.getElementById("btn-copier").addEventListener("click", () => {
    const input = document.getElementById("lien-parrainage");
    input.select();
    navigator.clipboard?.writeText(input.value);
    const btn = document.getElementById("btn-copier");
    btn.removeAttribute("data-i18n");
    btn.textContent = t("parrainage.copied");
    setTimeout(() => { btn.textContent = t("parrainage.copy"); btn.setAttribute("data-i18n", "parrainage.copy"); }, 1500);
});

const socket = io();
socket.on("connect", () => socket.emit("join", "${userId}"));
socket.on("parrainage:gain", (gain) => {
    const flash = document.getElementById("flash");
    flash.classList.add("show");
    setTimeout(() => flash.classList.remove("show"), 2500);

    if (gain.statut === "confirmee") {
        const el = document.getElementById("stat-confirme");
        el.textContent = (parseFloat(el.textContent) + parseFloat(gain.commission_montant)).toFixed(2);
    } else {
        const el = document.getElementById("stat-attente");
        el.textContent = (parseFloat(el.textContent) + parseFloat(gain.commission_montant)).toFixed(2);
    }

    const liste = document.getElementById("liste-gains");
    const vide = liste.querySelector(".pr-empty");
    if (vide) vide.remove();
    const row = document.createElement("div");
    row.className = "pr-gain-row";
    const planTexte = gain.plan ? gain.plan : t("parrainage.plan_default");
    const statutOk = gain.statut === "confirmee";
    row.innerHTML = "<span class=\\"pr-gain-plan\\">" + planTexte + " · " + t("parrainage.month_word") + " " + gain.mois_numero + "/12</span>" +
        "<span class=\\"pr-gain-statut pr-gain-statut--" + (statutOk ? "ok" : "attente") + "\\">" + (statutOk ? t("parrainage.status.confirmed") : t("parrainage.status.pending")) + "</span>" +
        "<span class=\\"pr-gain-montant\\">+" + parseFloat(gain.commission_montant).toFixed(2) + " " + gain.devise + "</span>";
    liste.prepend(row);
});
</script>
</body>
</html>`);
});

module.exports = router;
