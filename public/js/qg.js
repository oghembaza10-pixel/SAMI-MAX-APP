/**
 * SAMII OS - QG Universel (Front-End Controller)
 * S'adapte automatiquement au métier : produit (e-commerce/restaurant) ou rendez-vous (dentiste/avocat/...)
 */

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ==========================================================================
    // I18N — traductions des textes générés dynamiquement (labels de cartes par
    // canal, messages vides, notifications temps réel). Lit directement
    // localStorage('samii_lang') pour rester en phase avec le sélecteur de
    // langue de qg-template.ejs, sans dépendance d'ordre de chargement de script.
    // ==========================================================================
    function qgLang() {
        const l = localStorage.getItem('samii_lang');
        return ['fr', 'en', 'ar', 'zh'].includes(l) ? l : 'fr';
    }

    const STAT_LABELS = {
        produit: {
            total_revenus:   { fr: 'Revenus (DZD)',     en: 'Revenue (DZD)',        ar: 'الإيرادات (DZD)',        zh: '收入 (DZD)' },
            total_commandes: { fr: 'Commandes',         en: 'Orders',               ar: 'الطلبات',                zh: '订单' },
            en_attente:      { fr: 'En attente',        en: 'Pending',              ar: 'قيد الانتظار',           zh: '待处理' },
            confirmees:      { fr: 'Confirmées',        en: 'Confirmed',            ar: 'مؤكدة',                  zh: '已确认' },
            annulees:        { fr: 'Annulées',          en: 'Cancelled',            ar: 'ملغاة',                  zh: '已取消' },
            vip:             { fr: 'Clients VIP',       en: 'VIP Clients',          ar: 'عملاء VIP',              zh: 'VIP客户' },
            blacklist:       { fr: 'Blacklist',         en: 'Blacklist',            ar: 'القائمة السوداء',        zh: '黑名单' },
        },
        rdv: {
            total_revenus:   { fr: 'Rendez-vous ce mois', en: 'Appointments this month', ar: 'مواعيد هذا الشهر',   zh: '本月预约' },
            total_commandes: { fr: 'Rendez-vous',         en: 'Appointments',            ar: 'مواعيد',              zh: '预约' },
            en_attente:      { fr: 'À confirmer',         en: 'To confirm',              ar: 'بانتظار التأكيد',    zh: '待确认' },
            confirmees:      { fr: 'Confirmés',           en: 'Confirmed',               ar: 'مؤكدة',               zh: '已确认' },
            annulees:        { fr: 'Annulés',             en: 'Cancelled',               ar: 'ملغاة',               zh: '已取消' },
            vip:             { fr: 'Clients fidèles',     en: 'Loyal clients',           ar: 'عملاء أوفياء',       zh: '忠实客户' },
            blacklist:       { fr: 'Indésirables',        en: 'Unwanted',                ar: 'غير مرغوب فيهم',     zh: '黑名单客户' },
        },
        shopify: {
            total_revenus:   { fr: 'CA Shopify (DZD)',  en: 'Shopify revenue (DZD)', ar: 'إيرادات Shopify (DZD)', zh: 'Shopify 营收 (DZD)' },
            total_commandes: { fr: 'Commandes',         en: 'Orders',               ar: 'الطلبات',                zh: '订单' },
            en_attente:      { fr: 'En attente',        en: 'Pending',              ar: 'قيد الانتظار',           zh: '待处理' },
            confirmees:      { fr: 'Confirmées',        en: 'Confirmed',            ar: 'مؤكدة',                  zh: '已确认' },
            annulees:        { fr: 'Annulées',          en: 'Cancelled',            ar: 'ملغاة',                  zh: '已取消' },
            vip:             { fr: 'Clients Shopify',   en: 'Shopify clients',      ar: 'عملاء Shopify',          zh: 'Shopify 客户' },
            blacklist:       { fr: 'Abandons panier',   en: 'Cart abandonments',    ar: 'سلات مهجورة',            zh: '弃购购物车' },
        },
        telegram: {
            total_revenus:   { fr: 'Revenus Telegram',  en: 'Telegram revenue',     ar: 'إيرادات Telegram',       zh: 'Telegram 收入' },
            total_commandes: { fr: 'Commandes',         en: 'Orders',               ar: 'الطلبات',                zh: '订单' },
            en_attente:      { fr: 'En attente',        en: 'Pending',              ar: 'قيد الانتظار',           zh: '待处理' },
            confirmees:      { fr: 'Confirmées',        en: 'Confirmed',            ar: 'مؤكدة',                  zh: '已确认' },
            annulees:        { fr: 'Annulées',          en: 'Cancelled',            ar: 'ملغاة',                  zh: '已取消' },
            vip:             { fr: 'Clients Telegram',  en: 'Telegram clients',     ar: 'عملاء Telegram',         zh: 'Telegram 客户' },
            blacklist:       { fr: 'Réponses IA',       en: 'AI replies',           ar: 'ردود الذكاء الاصطناعي',  zh: 'AI 回复' },
        },
        whatsapp: {
            total_revenus:   { fr: 'Revenus WhatsApp',  en: 'WhatsApp revenue',     ar: 'إيرادات WhatsApp',       zh: 'WhatsApp 收入' },
            total_commandes: { fr: 'Commandes',         en: 'Orders',               ar: 'الطلبات',                zh: '订单' },
            en_attente:      { fr: 'En attente',        en: 'Pending',              ar: 'قيد الانتظار',           zh: '待处理' },
            confirmees:      { fr: 'Confirmées',        en: 'Confirmed',            ar: 'مؤكدة',                  zh: '已确认' },
            annulees:        { fr: 'Annulées',          en: 'Cancelled',            ar: 'ملغاة',                  zh: '已取消' },
            vip:             { fr: 'Clients WhatsApp',  en: 'WhatsApp clients',     ar: 'عملاء WhatsApp',         zh: 'WhatsApp 客户' },
            blacklist:       { fr: 'Diffusions',        en: 'Broadcasts',           ar: 'البث الجماعي',           zh: '群发消息' },
        },
        instagram: {
            total_revenus:   { fr: 'Revenus Instagram', en: 'Instagram revenue',    ar: 'إيرادات Instagram',      zh: 'Instagram 收入' },
            total_commandes: { fr: 'Commandes',         en: 'Orders',               ar: 'الطلبات',                zh: '订单' },
            en_attente:      { fr: 'Messages',          en: 'Messages',             ar: 'الرسائل',                zh: '消息' },
            confirmees:      { fr: 'Leads',             en: 'Leads',                ar: 'العملاء المحتملون',      zh: '潜在客户' },
            annulees:        { fr: 'Annulées',          en: 'Cancelled',            ar: 'ملغاة',                  zh: '已取消' },
            vip:             { fr: 'Clients Instagram', en: 'Instagram clients',    ar: 'عملاء Instagram',        zh: 'Instagram 客户' },
            blacklist:       { fr: 'Blacklist',         en: 'Blacklist',            ar: 'القائمة السوداء',        zh: '黑名单' },
        },
        tiktok: {
            total_revenus:   { fr: 'Vues / Portée',     en: 'Views / Reach',        ar: 'المشاهدات / الوصول',     zh: '观看量/触达' },
            total_commandes: { fr: 'Conversions',       en: 'Conversions',          ar: 'التحويلات',              zh: '转化' },
            en_attente:      { fr: 'Vidéos Actives',    en: 'Active videos',        ar: 'فيديوهات نشطة',          zh: '活跃视频' },
            confirmees:      { fr: 'Leads TikTok',      en: 'TikTok leads',         ar: 'عملاء TikTok المحتملون', zh: 'TikTok 潜在客户' },
            annulees:        { fr: 'Signalements',      en: 'Reports',              ar: 'البلاغات',               zh: '举报' },
            vip:             { fr: 'Abonnés VIP',       en: 'VIP followers',        ar: 'متابعون VIP',            zh: 'VIP 粉丝' },
            blacklist:       { fr: 'Engagement',        en: 'Engagement',           ar: 'التفاعل',                zh: '互动率' },
        },
        youtube: {
            total_revenus:   { fr: 'Vues Totales',      en: 'Total views',          ar: 'إجمالي المشاهدات',       zh: '总观看量' },
            total_commandes: { fr: 'Clics Tunnel',      en: 'Funnel clicks',        ar: 'نقرات القمع التسويقي',   zh: '漏斗点击' },
            en_attente:      { fr: 'Impressions',       en: 'Impressions',          ar: 'مرات الظهور',            zh: '展示次数' },
            confirmees:      { fr: 'Abonnés Gagnés',    en: 'Subscribers gained',   ar: 'مشتركون جدد',            zh: '新增订阅者' },
            annulees:        { fr: 'Désabonnements',    en: 'Unsubscribes',         ar: 'إلغاء الاشتراك',         zh: '取消订阅' },
            vip:             { fr: 'Membres Actifs',    en: 'Active members',       ar: 'أعضاء نشطون',            zh: '活跃成员' },
            blacklist:       { fr: 'Rétention',         en: 'Retention',            ar: 'معدل الاحتفاظ',          zh: '留存率' },
        },
        google: {
            total_revenus:   { fr: 'Trafic Organique',  en: 'Organic traffic',      ar: 'الزيارات العضوية',       zh: '自然流量' },
            total_commandes: { fr: 'Conversions SEO',   en: 'SEO conversions',      ar: 'تحويلات SEO',            zh: 'SEO 转化' },
            en_attente:      { fr: 'Indexation',        en: 'Indexing',             ar: 'الفهرسة',                zh: '索引' },
            confirmees:      { fr: 'Position Top 3',    en: 'Top 3 ranking',        ar: 'مركز ضمن أفضل 3',        zh: '前3名排名' },
            annulees:        { fr: 'Erreurs Crawl',     en: 'Crawl errors',         ar: 'أخطاء الزحف',            zh: '抓取错误' },
            vip:             { fr: 'Leads Web',         en: 'Web leads',            ar: 'عملاء الويب المحتملون',  zh: '网站潜在客户' },
            blacklist:       { fr: 'Performance Ads',   en: 'Ads performance',      ar: 'أداء الإعلانات',         zh: '广告表现' },
        },
        gmail: {
            total_revenus:   { fr: 'Emails Envoyés',    en: 'Emails sent',          ar: 'الرسائل المرسلة',        zh: '已发送邮件' },
            total_commandes: { fr: 'Commandes Mail',    en: 'Email orders',         ar: 'طلبات عبر البريد',       zh: '邮件订单' },
            en_attente:      { fr: 'Non lus',           en: 'Unread',               ar: 'غير مقروءة',             zh: '未读' },
            confirmees:      { fr: 'Traités par IA',    en: 'Handled by AI',        ar: 'تمت معالجتها بالذكاء الاصطناعي', zh: 'AI 已处理' },
            annulees:        { fr: 'Spams / Rejets',    en: 'Spam / Rejected',      ar: 'رسائل مزعجة / مرفوضة',   zh: '垃圾邮件/已拒收' },
            vip:             { fr: 'Contacts Pro',      en: 'Pro contacts',         ar: 'جهات اتصال احترافية',    zh: '专业联系人' },
            blacklist:       { fr: 'Blacklist Mails',   en: 'Email blacklist',      ar: 'القائمة السوداء للبريد', zh: '邮件黑名单' },
        },
        discord: {
            total_revenus:   { fr: 'Membres QG',        en: 'HQ members',           ar: 'أعضاء المقر',            zh: '总部成员' },
            total_commandes: { fr: 'Notifications',     en: 'Notifications',        ar: 'الإشعارات',              zh: '通知' },
            en_attente:      { fr: 'Tickets Support',   en: 'Support tickets',      ar: 'تذاكر الدعم',            zh: '支持工单' },
            confirmees:      { fr: 'Vérifiés',          en: 'Verified',             ar: 'موثقون',                 zh: '已验证' },
            annulees:        { fr: 'Bannis',            en: 'Banned',               ar: 'محظورون',                zh: '已封禁' },
            vip:             { fr: 'Rôles VIP',         en: 'VIP roles',            ar: 'أدوار VIP',              zh: 'VIP 身份组' },
            blacklist:       { fr: 'Bots Actifs',       en: 'Active bots',          ar: 'بوتات نشطة',             zh: '活跃机器人' },
        },
    };

    const MISC_LABELS = {
        all:              { fr: 'Tout',                        en: 'All',                          ar: 'الكل',                       zh: '全部' },
        noActivity:       { fr: 'Aucune activité pour le moment', en: 'No activity for now',        ar: 'لا يوجد نشاط حاليًا',        zh: '暂无活动' },
        noAppointments:   { fr: 'Aucun rendez-vous pour le moment', en: 'No appointments for now',  ar: 'لا توجد مواعيد حاليًا',      zh: '暂无预约' },
        noOrders:         { fr: 'Aucune commande pour le moment', en: 'No orders for now',          ar: 'لا توجد طلبات حاليًا',       zh: '暂无订单' },
        noClients:        { fr: 'Aucun client',                en: 'No clients',                    ar: 'لا يوجد عملاء',              zh: '暂无客户' },
        actionError:      { fr: "Erreur lors de l'action.",    en: 'An error occurred.',             ar: 'حدث خطأ أثناء تنفيذ الإجراء.', zh: '操作出错。' },
        confirmTitle:     { fr: 'Confirmer',                   en: 'Confirm',                        ar: 'تأكيد',                      zh: '确认' },
        cancelTitle:      { fr: 'Annuler',                     en: 'Cancel',                         ar: 'إلغاء',                      zh: '取消' },
        notifCommission:  { fr: '💰 Nouvelle commission de parrainage', en: '💰 New referral commission', ar: '💰 عمولة إحالة جديدة',  zh: '💰 新推荐佣金' },
        notifNewOrder:    { fr: '🛒 Nouvelle commande reçue',  en: '🛒 New order received',          ar: '🛒 طلب جديد',                zh: '🛒 收到新订单' },
        notifNewAppt:     { fr: '📅 Nouveau rendez-vous reçu', en: '📅 New appointment received',    ar: '📅 موعد جديد',               zh: '📅 收到新预约' },
        notifClient:      { fr: 'Client',                      en: 'Client',                         ar: 'عميل',                       zh: '客户' },
    };

    // Notifications avec ID/nom interpolé — phrase complète par langue (les
    // ordres de mots diffèrent trop entre fr/en/ar/zh pour une concaténation
    // préfixe + suffixe générique).
    const MISC_TEMPLATES = {
        notifOrderConfirmed: {
            fr: (id) => `✅ Commande #${id} confirmée`, en: (id) => `✅ Order #${id} confirmed`,
            ar: (id) => `✅ تم تأكيد الطلب #${id}`,      zh: (id) => `✅ 订单 #${id} 已确认`,
        },
        notifOrderCancelled: {
            fr: (id) => `❌ Commande #${id} annulée`, en: (id) => `❌ Order #${id} cancelled`,
            ar: (id) => `❌ تم إلغاء الطلب #${id}`,    zh: (id) => `❌ 订单 #${id} 已取消`,
        },
        notifApptConfirmed: {
            fr: (id) => `✅ Rendez-vous #${id} confirmé`, en: (id) => `✅ Appointment #${id} confirmed`,
            ar: (id) => `✅ تم تأكيد الموعد #${id}`,       zh: (id) => `✅ 预约 #${id} 已确认`,
        },
        notifApptCancelled: {
            fr: (id) => `❌ Rendez-vous #${id} annulé`, en: (id) => `❌ Appointment #${id} cancelled`,
            ar: (id) => `❌ تم إلغاء الموعد #${id}`,     zh: (id) => `❌ 预约 #${id} 已取消`,
        },
        notifWhatsapp: {
            fr: (name) => `💬 WhatsApp — ${name}`, en: (name) => `💬 WhatsApp — ${name}`,
            ar: (name) => `💬 WhatsApp — ${name}`, zh: (name) => `💬 WhatsApp — ${name}`,
        },
    };

    function qm(key) {
        const lang = qgLang();
        return (MISC_LABELS[key] && (MISC_LABELS[key][lang] || MISC_LABELS[key].fr)) || key;
    }

    function qmt(key, arg) {
        const lang = qgLang();
        const tpl  = MISC_TEMPLATES[key];
        if (!tpl) return key;
        return (tpl[lang] || tpl.fr)(arg);
    }

    fetch('/parrainage/resume')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const badge = document.getElementById('badge-gains-parrainage');
            if (badge && data.confirme > 0) badge.textContent = ' (+' + data.confirme.toFixed(2) + '$)';
        })
        .catch(() => {});

    const qgBackLink = document.getElementById('qg-back-link');
    if (window.location.pathname.startsWith('/qg/')) {
        localStorage.setItem('ogLastQG', window.location.pathname);
    }
    if (qgBackLink) qgBackLink.href = localStorage.getItem('ogLastQG') || '/hub';

    const sidebar   = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');
    const isMobile  = () => window.matchMedia('(max-width: 900px)').matches;
    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!isMobile()) sidebar.classList.toggle('collapsed');
        });
    }

    // Bouton "Plus" mobile : ouvre le panneau avec Arsenal/Coffre/Connecteurs/
    // SAMII/Paramètres... au lieu de les laisser hors-écran sans indice.
    const moreToggle = document.getElementById('qg-more-toggle');
    const navOverlay = document.getElementById('qg-nav-overlay');
    function closeMorePanel() {
        if (sidebar) sidebar.classList.remove('qg-sidebar--expanded');
        if (moreToggle) moreToggle.classList.remove('active');
    }
    if (sidebar && moreToggle) {
        moreToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('qg-sidebar--expanded');
            moreToggle.classList.toggle('active', isOpen);
        });
        if (navOverlay) navOverlay.addEventListener('click', closeMorePanel);
        sidebar.querySelectorAll('.qg-nav__item--more').forEach((link) => {
            link.addEventListener('click', closeMorePanel);
        });
    }

    let canalActif  = null;
    let allData     = null;
    let parcoursActuel = 'produit';
    let calendrierMois = new Date();
    let calendrierJourFiltre = null;
    let commandesRdvComplet = [];

    // Mêmes paliers que services/gradeService.js (SEUILS) — le nom doit
    // correspondre exactement à utilisateurs.grade_actuel.
    // ⚠️ `nom` doit rester exactement identique à utilisateurs.grade_actuel
    // (services/gradeService.js) — c'est une clé métier, pas un texte
    // d'affichage. La traduction du libellé affiché se fait séparément
    // via GRADE_LABELS, sans toucher à cette valeur.
    const GRADES = [
        { nom: 'Soldat',     icon: '🪖',  seuil: 0   },
        { nom: 'Caporal',    icon: '🎖️',  seuil: 10  },
        { nom: 'Sergent',    icon: '⭐',   seuil: 25  },
        { nom: 'Lieutenant', icon: '🌟',   seuil: 50  },
        { nom: 'Capitaine',  icon: '🏅',   seuil: 100 },
        { nom: 'Général',    icon: '🎗️',  seuil: 200 },
    ];

    const GRADE_LABELS = {
        Soldat:     { fr: 'SOLDAT',     en: 'SOLDIER',    ar: 'جندي',   zh: '士兵' },
        Caporal:    { fr: 'CAPORAL',    en: 'CORPORAL',   ar: 'عريف',   zh: '下士' },
        Sergent:    { fr: 'SERGENT',    en: 'SERGEANT',   ar: 'رقيب',   zh: '中士' },
        Lieutenant: { fr: 'LIEUTENANT', en: 'LIEUTENANT', ar: 'ملازم',  zh: '中尉' },
        Capitaine:  { fr: 'CAPITAINE',  en: 'CAPTAIN',    ar: 'نقيب',   zh: '上尉' },
        Général:    { fr: 'GÉNÉRAL',    en: 'GENERAL',    ar: 'جنرال',  zh: '将军' },
    };
    function gradeLabel(nom) {
        const lang = qgLang();
        return (GRADE_LABELS[nom] && (GRADE_LABELS[nom][lang] || GRADE_LABELS[nom].fr)) || (nom || '').toUpperCase();
    }

    // Affiche le vrai grade du compte (utilisateurs.grade_actuel/score_grade,
    // renvoyé par /api/qg-data) — avant, ce grade était recalculé ici à partir
    // du nombre de commandes de la boutique, déconnecté du grade réel utilisé
    // par l'Arsenal et les thèmes visuels.
    function afficherGrade(gradeActuel, score) {
        const scoreNum = score || 0;
        let index = GRADES.findIndex(g => g.nom === gradeActuel);
        if (index < 0) index = 0;
        const actuel  = GRADES[index];
        const suivant = GRADES[index + 1] || null;

        const iconEl = document.getElementById('grade-icon');
        const nomEl  = document.getElementById('grade-nom');
        const fillEl = document.getElementById('grade-fill');
        const nextEl = document.getElementById('grade-next');
        if (iconEl) iconEl.textContent = actuel.icon;
        if (nomEl)  nomEl.textContent  = gradeLabel(actuel.nom);
        if (suivant) {
            const pct = Math.min(Math.round(
                ((scoreNum - actuel.seuil) /
                (suivant.seuil - actuel.seuil)) * 100), 100);
            if (fillEl) fillEl.style.width = pct + '%';
            if (nextEl) nextEl.textContent = `→ ${gradeLabel(suivant.nom)}`;
        } else {
            if (fillEl) fillEl.style.width = '100%';
            if (nextEl) nextEl.textContent = '👑 MAX';
        }
    }

    const CARTES_PRODUIT = [
        { id: 'stat-revenus',    label: 'Revenus (DZD)', icon: 'trending-up',  key: 'total_revenus'   },
        { id: 'stat-commandes',  label: 'Commandes',     icon: 'package',      key: 'total_commandes' },
        { id: 'stat-attente',    label: 'En attente',    icon: 'clock',        key: 'en_attente'      },
        { id: 'stat-confirmees', label: 'Confirmées',    icon: 'check-circle', key: 'confirmees'      },
        { id: 'stat-annulees',   label: 'Annulées',      icon: 'x-circle',     key: 'annulees'        },
        { id: 'stat-vip',        label: 'Clients VIP',   icon: 'crown',        key: 'vip'              },
        { id: 'stat-blacklist',  label: 'Blacklist',     icon: 'shield-off',   key: 'blacklist'        },
    ];

    const CARTES_RDV = [
        { id: 'stat-revenus',    label: 'Rendez-vous ce mois', icon: 'calendar',      key: 'total_revenus'   },
        { id: 'stat-commandes',  label: 'Rendez-vous',         icon: 'calendar-days', key: 'total_commandes' },
        { id: 'stat-attente',    label: 'À confirmer',         icon: 'clock',         key: 'en_attente'      },
        { id: 'stat-confirmees', label: 'Confirmés',           icon: 'check-circle',  key: 'confirmees'      },
        { id: 'stat-annulees',   label: 'Annulés',             icon: 'x-circle',      key: 'annulees'        },
        { id: 'stat-vip',        label: 'Clients fidèles',     icon: 'crown',         key: 'vip'              },
        { id: 'stat-blacklist',  label: 'Indésirables',        icon: 'shield-off',    key: 'blacklist'        },
    ];

    const MODULES = {
        '': { label: 'Tout', cartes: CARTES_PRODUIT },
        shopify: {
            label : 'Shopify',
            cartes: [
                { id: 'stat-revenus',    label: 'CA Shopify (DZD)', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Shopify',  icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Abandons panier',  icon: 'shopping-cart',  key: 'blacklist'        },
            ],
        },
        telegram: {
            label : 'Telegram',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus Telegram', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Telegram', icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Réponses IA',      icon: 'bot',            key: 'blacklist'        },
            ],
        },
        whatsapp: {
            label : 'WhatsApp',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus WhatsApp', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients WhatsApp', icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Diffusions',       icon: 'radio',          key: 'blacklist'        },
            ],
        },
        instagram: {
            label : 'Instagram',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus Instagram', icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Messages',         icon: 'message-circle', key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Leads',            icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Instagram',icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist',        icon: 'shield-off',     key: 'blacklist'        },
            ],
        },
        tiktok: {
            label : 'TikTok',
            cartes: [
                { id: 'stat-revenus',    label: 'Vues / Portée',    icon: 'eye',            key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Conversions',      icon: 'zap',            key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Vidéos Actives',   icon: 'video',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Leads TikTok',     icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Signalements',     icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Abonnés VIP',      icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Engagement',       icon: 'trending-up',    key: 'blacklist'        },
            ],
        },
        youtube: {
            label : 'YouTube',
            cartes: [
                { id: 'stat-revenus',    label: 'Vues Totales',     icon: 'play-circle',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Clics Tunnel',     icon: 'external-link',  key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Impressions',      icon: 'bar-chart-2',    key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Abonnés Gagnés',   icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Désabonnements',   icon: 'user-minus',     key: 'annulees'         },
                { id: 'stat-vip',        label: 'Membres Actifs',   icon: 'crown',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Rétention',        icon: 'activity',       key: 'blacklist'        },
            ],
        },
        google: {
            label : 'Google / SEO',
            cartes: [
                { id: 'stat-revenus',    label: 'Trafic Organique', icon: 'search',         key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Conversions SEO',  icon: 'globe',          key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Indexation',       icon: 'check-square',   key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Position Top 3',   icon: 'award',          key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Erreurs Crawl',    icon: 'alert-triangle', key: 'annulees'         },
                { id: 'stat-vip',        label: 'Leads Web',        icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Performance Ads',  icon: 'target',         key: 'blacklist'        },
            ],
        },
        gmail: {
            label : 'Gmail',
            cartes: [
                { id: 'stat-revenus',    label: 'Emails Envoyés',   icon: 'send',           key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes Mail',   icon: 'mail',           key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Non lus',          icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Traités par IA',   icon: 'bot',            key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Spams / Rejets',   icon: 'slash',          key: 'annulees'         },
                { id: 'stat-vip',        label: 'Contacts Pro',     icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist Mails',  icon: 'shield-off',     key: 'blacklist'        },
            ],
        },
        discord: {
            label : 'Discord',
            cartes: [
                { id: 'stat-revenus',    label: 'Membres QG',       icon: 'users',          key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Notifications',    icon: 'bell',           key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Tickets Support',  icon: 'life-buoy',      key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Vérifiés',         icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Bannis',           icon: 'user-x',         key: 'annulees'         },
                { id: 'stat-vip',        label: 'Rôles VIP',        icon: 'shield',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Bots Actifs',      icon: 'cpu',            key: 'blacklist'        },
            ],
        },
    };

    function startCountUp(el, target) {
        let current     = 0;
        const duration  = 1400;
        const frames    = (duration / 1000) * 60;
        const increment = target / frames;
        const update = () => {
            current += increment;
            if (current < target) {
                el.textContent = Math.ceil(current).toLocaleString('fr-FR');
                requestAnimationFrame(update);
            } else {
                el.textContent = target.toLocaleString('fr-FR');
            }
        };
        update();
    }

    function setCard(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('data-to', value);
        startCountUp(el, parseFloat(value) || 0);
    }

    function flashCartes() {
        document.querySelectorAll('.qg-card').forEach(card => {
            card.classList.add('qg-card--flash');
            setTimeout(() => card.classList.remove('qg-card--flash'), 600);
        });
    }

    function updateCarteLabels(canal) {
        let module = MODULES[canal] || MODULES[''];
        let groupe = canal || 'produit';
        if (!canal && parcoursActuel === 'rdv') {
            module = { label: 'Tout', cartes: CARTES_RDV };
            groupe = 'rdv';
        }
        const lang = qgLang();
        const labels = STAT_LABELS[groupe] || STAT_LABELS.produit;
        module.cartes.forEach(carte => {
            const card  = document.getElementById(carte.id)?.closest('.qg-card');
            if (!card) return;
            const label = card.querySelector('.qg-card__label');
            const icon  = card.querySelector('.qg-card__icon i');
            const traduit = labels[carte.key] && (labels[carte.key][lang] || labels[carte.key].fr);
            if (label) label.textContent = traduit || carte.label;
            if (icon)  icon.setAttribute('data-lucide', carte.icon);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function calcStats(commandes, clients) {
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((s, c) => s + getMontant(c), 0);
        const en_attente      = commandes.filter(c => c.Statut === 'en attente' || c.Statut === 'en_attente').length;
        const confirmees      = commandes.filter(c => c.Statut === 'confirmée' || c.Statut === 'confirmé').length;
        const annulees        = commandes.filter(c => c.Statut === 'annulée' || c.Statut === 'annulé').length;
        const vip             = clients.filter(c => c.VIP     === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;
        return { total_commandes, total_revenus: total_revenus.toFixed(2),
                 en_attente, confirmees, annulees, vip, blacklist };
    }

    function getMontant(c) {
        return parseFloat(c.montant || c.Total || 0) || 0;
    }

    function appliquerModule(canal) {
        if (!allData) return;

        const commandes = canal
            ? allData.commandes.filter(c =>
                (c.Source || c.source || '').toLowerCase() === canal)
            : allData.commandes;

        const clients = canal
            ? allData.clients.filter(c =>
                (c.Source || c.source || '').toLowerCase() === canal)
            : allData.clients;

        const stats = calcStats(commandes, clients);

        updateCarteLabels(canal);
        flashCartes();

        setCard('stat-revenus',    parcoursActuel === 'rdv' ? stats.total_commandes : stats.total_revenus);
        setCard('stat-commandes',  stats.total_commandes);
        setCard('stat-attente',    stats.en_attente);
        setCard('stat-confirmees', stats.confirmees);
        setCard('stat-annulees',   stats.annulees);
        setCard('stat-vip',        stats.vip);
        setCard('stat-blacklist',  stats.blacklist);

        renderCommandes(commandes);

        // Le calendrier s'affiche pour les métiers RDV (dentiste, avocat...)
        // ET pour un métier "produit" (e-commerce...) dès qu'il a au moins un
        // rendez-vous — un e-commerçant peut très bien recevoir des demandes
        // de RDV via le chat SAMII sans être classé "métier RDV".
        const rdvDisponibles = parcoursActuel === 'rdv' ? commandes : (allData.rendezVous || []);
        commandesRdvComplet = rdvDisponibles;
        const section = document.getElementById('rdv-calendar-section');
        const title   = document.getElementById('rdv-calendar-title');
        if (rdvDisponibles.length > 0) {
            renderCalendrierRdv();
        } else {
            if (section) section.style.display = 'none';
            if (title)   title.style.display = 'none';
        }

        const titreEl = document.getElementById('qg-boutique-nom');
        if (titreEl) {
            titreEl.textContent = canal
                ? `${allData.workspace?.nom || ''} · ${canal.toUpperCase()}`
                : (allData.workspace?.nom || '');
        }
    }

    async function loadModules() {
        try {
            const res  = await fetch('/api/connecteurs');
            const data = await res.json();
            const el   = document.getElementById('qg-modules');
            if (!el || !data.connecteurs) return;

            const icones = {
                shopify   : '🛍',
                telegram  : '💬',
                whatsapp  : '📱',
                instagram : '📸',
                gmail     : '📧',
                yalidine  : '📦',
                tiktok    : '🎵',
                youtube   : '▶️',
                google    : '🔍',
                discord   : '🎮',
            };

            const actifs = Object.entries(data.connecteurs)
                .filter(([, v]) => v.actif);

            el.innerHTML = `
                <button class="qg-module-btn active" data-canal="">📊 ${qm('all')}</button>
                ${actifs.map(([type]) => `
                    <button class="qg-module-btn" data-canal="${type}">
                        ${icones[type] || '🔌'} ${type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                `).join('')}
            `;

            el.querySelectorAll('.qg-module-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    el.querySelectorAll('.qg-module-btn')
                      .forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    canalActif = btn.dataset.canal || null;
                    appliquerModule(canalActif || '');
                });
            });

        } catch (err) {
            console.error('❌ Modules :', err.message);
        }
    }

    async function loadQGData() {
        try {
            const shop = document.body.getAttribute('data-shop') || '';
            const res  = await fetch(`/api/qg-data?shop=${encodeURIComponent(shop)}`);
            const data = await res.json();
            if (!data.success) return;

            allData = data;
            parcoursActuel = data.parcours || 'produit';

            setCard('stat-livrees',    data.livraison.livrees);
            setCard('stat-en-cours', data.livraison.en_cours);
            setCard('stat-echecs',    data.livraison.echecs);

            const missionDate = document.getElementById('mission-date');
            if (missionDate) missionDate.textContent = data.mission.date;
            setCard('mission-commandes', data.mission.commandes);
            setCard('mission-revenus',   data.mission.revenus);
            const objectif = 10;
            const pct      = Math.min(Math.round((data.mission.commandes / objectif) * 100), 100);
            const pctEl    = document.getElementById('mission-pct');
            const barEl    = document.getElementById('mission-bar');
            if (pctEl) pctEl.textContent = pct + '%';
            if (barEl) barEl.style.width = pct + '%';

            setCard('perf-revenus-mois',   data.performance.revenus_mois);
            setCard('perf-commandes-mois', data.performance.commandes_mois);
            const evolEl = document.getElementById('perf-evolution');
            if (evolEl) evolEl.textContent = data.performance.evolution;

            afficherGrade(data.grade?.actuel, data.grade?.score);
            appliquerModule(canalActif || '');
            renderActivite(data.journal);
            renderEmails(data.emails);

        } catch (err) {
            console.error('❌ QG data :', err.message);
        }
    }

    function renderActivite(journal) {
        const list = document.getElementById('activite-list');
        if (!list) return;
        if (!journal || journal.length === 0) {
            list.innerHTML = `<li style="padding:12px;color:#888;font-size:.85rem;">${qm('noActivity')}</li>`;
            return;
        }
        list.innerHTML = journal.map(j => `
            <li style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:.85rem;color:#ddd;">
                <span style="color:#d4af37;">${new Date(j.created_at).toLocaleString('fr-FR')}</span>
                — ${j.details || j.action || ''}
            </li>
        `).join('');
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Gmail n'est affiché que si le marchand a réellement connecté Google —
    // le bouton "Gmail" existait déjà comme filtre de commandes (toujours
    // vide, une commande n'arrive jamais par email), sans jamais montrer de
    // vrais emails malgré une connexion Google active.
    function renderEmails(emails) {
        const section = document.getElementById('gmail-section');
        const title   = document.getElementById('gmail-title');
        const list    = document.getElementById('gmail-list');
        if (!section || !title || !list) return;

        if (!emails || emails.length === 0) {
            section.style.display = 'none';
            title.style.display   = 'none';
            return;
        }

        section.style.display = '';
        title.style.display   = '';
        list.innerHTML = emails.map(e => `
            <li style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:.85rem;color:#ddd;">
                <strong style="color:#d4af37;">${escapeHtml(e.sujet || '(sans objet)')}</strong>
                <div style="color:#999;font-size:.78rem;margin-top:2px;">${escapeHtml(e.de || '')}</div>
                <div style="color:#aaa;font-size:.8rem;margin-top:4px;">${escapeHtml(e.extrait || '')}</div>
            </li>
        `).join('');
    }

    function dateValide(v) {
        return v && v !== '—' && !isNaN(new Date(v).getTime());
    }

    function renderAgendaJour(rdvsJour) {
        if (!calendrierJourFiltre) return '';
        if (!rdvsJour.length) {
            return `<p class="rdv-cal-agenda-empty">${qm('noAppointments')}</p>`;
        }
        return `<div class="rdv-cal-agenda">${rdvsJour.map(c => `
            <div class="rdv-cal-agenda-item">
                <div>
                    <strong>${c['Nom Client'] || '—'}</strong>
                    <span class="rdv-cal-agenda-heure">${dateValide(c['DateRdv']) ? new Date(c['DateRdv']).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || 'en_attente'}</span>
                    <p class="rdv-cal-agenda-motif">${c['Produit'] || ''} ${c['Téléphone'] ? '· ' + c['Téléphone'] : ''}</p>
                </div>
                <div class="rdv-cal-agenda-actions">
                    <button onclick="agirCommande('${c.airtableId}', 'confirmer')" title="${qm('confirmTitle')}">✅</button>
                    <button onclick="agirCommande('${c.airtableId}', 'annuler')" title="${qm('cancelTitle')}">❌</button>
                </div>
            </div>
        `).join('')}</div>`;
    }

    function renderCalendrierRdv() {
        const section = document.getElementById('rdv-calendar-section');
        const title   = document.getElementById('rdv-calendar-title');
        const holder  = document.getElementById('rdv-calendar');
        if (!section || !title || !holder) return;
        section.style.display = '';
        title.style.display = '';

        const parDate = {};
        commandesRdvComplet.forEach(c => {
            if (!dateValide(c['DateRdv'])) return;
            const key = new Date(c['DateRdv']).toISOString().slice(0, 10);
            (parDate[key] = parDate[key] || []).push(c);
        });

        const annee = calendrierMois.getFullYear();
        const mois  = calendrierMois.getMonth();
        const premierJour = new Date(annee, mois, 1);
        const nbJours = new Date(annee, mois + 1, 0).getDate();
        let offset = premierJour.getDay() - 1;
        if (offset < 0) offset = 6;

        const todayKey = new Date().toISOString().slice(0, 10);
        const nomMois  = calendrierMois.toLocaleDateString(qgLang() === 'ar' ? 'ar' : 'fr-FR', { month: 'long', year: 'numeric' });

        let cellsHtml = '';
        for (let i = 0; i < offset; i++) cellsHtml += `<div class="rdv-cal-cell rdv-cal-cell--empty"></div>`;
        for (let jour = 1; jour <= nbJours; jour++) {
            const key = `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
            const rdvsJour = parDate[key] || [];
            const classes = [
                'rdv-cal-cell',
                key === todayKey ? 'rdv-cal-cell--today' : '',
                key === calendrierJourFiltre ? 'rdv-cal-cell--selected' : '',
                rdvsJour.length ? 'rdv-cal-cell--has' : '',
            ].filter(Boolean).join(' ');
            cellsHtml += `
                <div class="${classes}" data-date="${key}">
                    <span class="rdv-cal-num">${jour}</span>
                    ${rdvsJour.length ? `<span class="rdv-cal-dot">${rdvsJour.length}</span>` : ''}
                </div>`;
        }

        holder.innerHTML = `
            <div class="rdv-cal-header">
                <button type="button" id="rdv-cal-prev" aria-label="Mois précédent">‹</button>
                <strong style="text-transform:capitalize;">${nomMois}</strong>
                <button type="button" id="rdv-cal-next" aria-label="Mois suivant">›</button>
            </div>
            <div class="rdv-cal-weekdays">
                <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
            </div>
            <div class="rdv-cal-grid">${cellsHtml}</div>
            ${calendrierJourFiltre ? renderAgendaJour(parDate[calendrierJourFiltre] || []) : ''}
            ${calendrierJourFiltre ? `<button type="button" id="rdv-cal-reset" class="rdv-cal-reset">✕ Fermer</button>` : ''}
        `;

        document.getElementById('rdv-cal-prev').addEventListener('click', () => {
            calendrierMois = new Date(annee, mois - 1, 1);
            renderCalendrierRdv();
        });
        document.getElementById('rdv-cal-next').addEventListener('click', () => {
            calendrierMois = new Date(annee, mois + 1, 1);
            renderCalendrierRdv();
        });
        holder.querySelectorAll('.rdv-cal-cell--has').forEach(cell => {
            cell.addEventListener('click', () => {
                const key = cell.dataset.date;
                calendrierJourFiltre = calendrierJourFiltre === key ? null : key;
                renderCalendrierRdv();
            });
        });
        const resetBtn = document.getElementById('rdv-cal-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            calendrierJourFiltre = null;
            renderCalendrierRdv();
        });
    }

    function renderCommandes(commandes) {
        const tbody = document.getElementById('commandes-tbody');
        if (!tbody) return;
        if (!commandes || commandes.length === 0) {
            const texteVide = parcoursActuel === 'rdv' ? qm('noAppointments') : qm('noOrders');
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">${texteVide}</td></tr>`;
            return;
        }

        if (parcoursActuel === 'rdv') {
            tbody.innerHTML = commandes.slice(0, 20).map(c => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px;">#${String(c['ID Commande'] || '').toString().slice(-4) || '—'}</td>
                    <td style="padding: 12px; font-weight: 500; color: #fff;">${c['Nom Client'] || '—'}</td>
                    <td style="padding: 12px;">${c['Téléphone'] || '—'}</td>
                    <td style="padding: 12px;">${c['Produit'] || '—'}</td>
                    <td style="padding: 12px; color: #d4af37; font-weight: 600;">${c['DateRdv'] || '—'}</td>
                    <td style="padding: 12px;"><span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || 'en_attente'}</span></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick="agirCommande('${c.airtableId}', 'confirmer')" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; padding: 5px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;" title="${qm('confirmTitle')}">✅</button>
                        <button onclick="agirCommande('${c.airtableId}', 'annuler')" style="background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 10px; border-radius: 6px; cursor: pointer;" title="${qm('cancelTitle')}">❌</button>
                    </td>
                </tr>
            `).join('');
            return;
        }

        tbody.innerHTML = commandes.slice(0, 20).map(c => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px;">#${c['ID Commande'] || c.airtableId?.slice(-4) || '—'}</td>
                <td style="padding: 12px; font-weight: 500; color: #fff;">${c['Nom Client'] || c['Nom'] || '—'}</td>
                <td style="padding: 12px;">${c['Téléphone'] || '—'}</td>
                <td style="padding: 12px;">${c['Produit'] || '—'}</td>
                <td style="padding: 12px; color: #d4af37; font-weight: 600;">${parseFloat(c['montant'] || c['Total'] || 0).toFixed(2)} ${c['Devise'] || 'DZD'}</td>
                <td style="padding: 12px;"><span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || 'en attente'}</span></td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="agirCommande('${c.airtableId}', 'confirmer')" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; padding: 5px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;" title="${qm('confirmTitle')}">✅</button>
                    <button onclick="agirCommande('${c.airtableId}', 'annuler')" style="background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 10px; border-radius: 6px; cursor: pointer;" title="${qm('cancelTitle')}">❌</button>
                </td>
            </tr>
        `).join('');
    }

    window.agirCommande = async function(id, action) {
        try {
            const res = await fetch(`/api/commandes/${id}/${action}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                loadQGData();
            } else {
                alert(qm('actionError'));
            }
        } catch (e) {
            console.error(e);
        }
    };

    function statutClass(statut) {
        const map = {
            'confirmée' : 'green',
            'confirmé'  : 'green',
            'en attente': 'yellow',
            'en_attente': 'yellow',
            'annulée'   : 'red',
            'annulé'    : 'red',
            'expédiée'  : 'blue',
            'livrée'    : 'green',
            'en cours'  : 'blue',
            'échoué'    : 'red',
        };
        return map[statut] || 'grey';
    }

    function renderClients(containerId, clients) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!clients || clients.length === 0) {
            el.innerHTML = `<p style="color:#888;font-size:.85rem;">${qm('noClients')}</p>`;
            return;
        }
        el.innerHTML = clients.map(c => `
            <div class="qg-client-card">
                <div class="qg-client-card__name">${c['Nom'] || c['Nom Client'] || '—'}</div>
                <div class="qg-client-card__phone">${c['Téléphone'] || '—'}</div>
                <div class="qg-client-card__total">${parseFloat(c['Total Dépensé'] || 0).toFixed(0)} DZD</div>
            </div>
        `).join('');
    }

    if (window.matchMedia('(min-width: 900px)').matches) {
        document.querySelectorAll('.qg-card--tilt').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect    = card.getBoundingClientRect();
                const rotateX = (e.clientY - rect.top  - rect.height / 2) / 28;
                const rotateY = (rect.width / 2 - (e.clientX - rect.left)) / 28;
                card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
            });
            card.addEventListener('mouseleave', () => card.style.transform = '');
        });
    }

    if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('connect', () => {
            const shop = document.body.getAttribute('data-shop');
            const workspaceId = document.body.getAttribute('data-workspace-id');
            const userId = document.body.getAttribute('data-user-id');
            if (shop) socket.emit('join', shop);
            if (workspaceId) socket.emit('join', workspaceId);
            if (userId) socket.emit('join', userId);
        });
        socket.on('parrainage:gain', (gain) => {
            if (gain.statut !== 'confirmee') return;
            const badge = document.getElementById('badge-gains-parrainage');
            if (!badge) return;
            const actuel = parseFloat((badge.textContent.match(/[\d.]+/) || [0])[0]) || 0;
            badge.textContent = ' (+' + (actuel + parseFloat(gain.commission_montant)).toFixed(2) + '$)';
            afficherNotification(qm('notifCommission'));
        });
        socket.on('nouvelle-commande', () => {
            afficherNotification(qm('notifNewOrder'));
            loadQGData();
        });
        socket.on('commande-confirmee', (d) => {
            afficherNotification(qmt('notifOrderConfirmed', d.id));
            loadQGData();
        });
        socket.on('commande-annulee', (d) => {
            afficherNotification(qmt('notifOrderCancelled', d.id));
            loadQGData();
        });
        socket.on('nouveau-rdv', () => {
            afficherNotification(qm('notifNewAppt'));
            loadQGData();
        });
        socket.on('rdv-confirme', (d) => {
            afficherNotification(qmt('notifApptConfirmed', d.id));
            loadQGData();
        });
        socket.on('rdv-annule', (d) => {
            afficherNotification(qmt('notifApptCancelled', d.id));
            loadQGData();
        });
        socket.on('whatsapp.message', (d) => {
            afficherNotification(qmt('notifWhatsapp', d.senderName || qm('notifClient')));
            loadQGData();
        });
    }

    function afficherNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'qg-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('qg-toast--visible'));
        setTimeout(() => {
            toast.classList.remove('qg-toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    loadModules();
    loadQGData();

    // Ré-applique les labels traduits des cartes quand la langue change
    // (déclenché par le sélecteur de langue dans qg-template.ejs).
    document.addEventListener('samii:langchange', () => {
        updateCarteLabels(canalActif || '');
    });

});
