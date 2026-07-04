// =====================================================================
// OG EMPIRE — CATALOGUE DES QG (50 métiers, extensible à 200+)
// Chaque QG utilise le même template universel /qg/:slug
// =====================================================================

const OG_METIERS = [
  // ===== VIE PERSONNELLE & ESSENTIEL =====
  { slug: "particulier",   title: {fr:"Particulier",       en:"Individual",     ar:"فرد"},         icon: "user",          category: "vie",       tagline: {fr:"Ton empire personnel", en:"Your personal empire", ar:"إمبراطوريتك الشخصية"}, status: "live" },
  { slug: "famille",       title: {fr:"Famille",           en:"Family",         ar:"عائلة"},        icon: "heart",         category: "vie",       tagline: {fr:"Le QG de la maison", en:"Home command", ar:"مقر البيت"}, status: "soon" },
  { slug: "voyage",        title: {fr:"Voyage",            en:"Travel",         ar:"سفر"},          icon: "plane",         category: "mobilite",  tagline: {fr:"Explore le monde", en:"Explore the world", ar:"استكشف العالم"}, status: "live" },
  { slug: "immobilier",    title: {fr:"Immobilier",        en:"Real Estate",    ar:"عقارات"},       icon: "building-2",    category: "business",  tagline: {fr:"Empire de la pierre", en:"Stone empire", ar:"إمبراطورية الحجر"}, status: "live" },

  // ===== E-COMMERCE & COMMERCE =====
  { slug: "ecommerce",     title: {fr:"E-commerce",        en:"E-commerce",     ar:"تجارة إلكترونية"}, icon: "shopping-bag",  category: "business",  tagline: {fr:"Ta boutique digitale",  en:"Digital storefront", ar:"متجرك الرقمي"}, status: "live" },
  { slug: "boutique",      title: {fr:"Boutique",          en:"Retail Store",   ar:"محل"},          icon: "store",         category: "business",  tagline: {fr:"Commerce physique", en:"Retail command", ar:"تجارة محلية"}, status: "live" },
  { slug: "marketplace-pro", title: {fr:"Grossiste",       en:"Wholesale",      ar:"جملة"},         icon: "package",       category: "business",  tagline: {fr:"Commerce de volume", en:"Bulk commerce", ar:"تجارة الجملة"}, status: "soon" },
  { slug: "fournisseur",   title: {fr:"Fournisseur",       en:"Supplier",       ar:"مورّد"},        icon: "package-check", category: "business",  tagline: {fr:"Réseau d'approvisionnement", en:"Supply network", ar:"شبكة توريد"}, status: "soon" },

  // ===== RESTAURATION =====
  { slug: "restaurant",    title: {fr:"Restaurant",        en:"Restaurant",     ar:"مطعم"},         icon: "utensils-crossed", category: "restauration", tagline: {fr:"L'art de la table", en:"The art of dining", ar:"فن المائدة"}, status: "live" },
  { slug: "cafe",          title: {fr:"Café",              en:"Coffee Shop",    ar:"مقهى"},         icon: "coffee",        category: "restauration", tagline: {fr:"Refuge des idées", en:"Ideas refuge", ar:"ملاذ الأفكار"}, status: "live" },
  { slug: "boulangerie",   title: {fr:"Boulangerie",       en:"Bakery",         ar:"مخبزة"},        icon: "cookie",        category: "restauration", tagline: {fr:"Artisan du pain", en:"Bread artisan", ar:"صانع الخبز"}, status: "live" },
  { slug: "livraison",     title: {fr:"Livraison",         en:"Delivery",       ar:"توصيل"},        icon: "bike",          category: "restauration", tagline: {fr:"Cavalier moderne", en:"Modern rider", ar:"فارس عصري"}, status: "live" },

  // ===== TRANSPORT & MOBILITÉ =====
  { slug: "transport",     title: {fr:"Transport",         en:"Transport",      ar:"نقل"},          icon: "truck",         category: "mobilite",  tagline: {fr:"Maître des routes", en:"Road master", ar:"سيد الطرق"}, status: "live" },
  { slug: "taxi",          title: {fr:"Taxi",              en:"Taxi",           ar:"سيارة أجرة"},   icon: "car",           category: "mobilite",  tagline: {fr:"Ville sur roues", en:"City on wheels", ar:"مدينة على عجلات"}, status: "live" },
  { slug: "bus",           title: {fr:"Bus",               en:"Bus",            ar:"حافلة"},        icon: "bus",           category: "mobilite",  tagline: {fr:"Flotte urbaine", en:"Urban fleet", ar:"أسطول حضري"}, status: "soon" },
  { slug: "train",         title: {fr:"Train",             en:"Rail",           ar:"قطار"},         icon: "train-front",   category: "mobilite",  tagline: {fr:"Voies du royaume", en:"Kingdom rails", ar:"سكك المملكة"}, status: "soon" },
  { slug: "aeroport",      title: {fr:"Aéroport",          en:"Airport",        ar:"مطار"},         icon: "plane-takeoff", category: "mobilite",  tagline: {fr:"Porte du ciel", en:"Sky gateway", ar:"بوابة السماء"}, status: "soon" },
  { slug: "maritime",      title: {fr:"Maritime",          en:"Maritime",       ar:"بحري"},         icon: "ship",          category: "mobilite",  tagline: {fr:"Empire des mers", en:"Sea empire", ar:"إمبراطورية البحار"}, status: "soon" },
  { slug: "location-vehicule", title: {fr:"Location auto", en:"Car rental",     ar:"تأجير سيارات"}, icon: "key-round",     category: "mobilite",  tagline: {fr:"Flotte à la demande", en:"On-demand fleet", ar:"أسطول عند الطلب"}, status: "soon" },
  { slug: "garage",        title: {fr:"Garage",            en:"Garage",         ar:"ورشة"},         icon: "wrench",        category: "mobilite",  tagline: {fr:"Forge mécanique", en:"Mechanical forge", ar:"مطرقة الميكانيك"}, status: "soon" },

  // ===== HÉBERGEMENT & TOURISME =====
  { slug: "hotel",         title: {fr:"Hôtel",             en:"Hotel",          ar:"فندق"},         icon: "bed",           category: "tourisme",  tagline: {fr:"Palais du voyageur", en:"Traveler palace", ar:"قصر المسافر"}, status: "soon" },
  { slug: "location-courte", title: {fr:"Location courte", en:"Short rental",  ar:"إيجار قصير"},   icon: "home",          category: "tourisme",  tagline: {fr:"Séjour urbain", en:"Urban stay", ar:"إقامة حضرية"}, status: "soon" },
  { slug: "tourisme",      title: {fr:"Tourisme",          en:"Tourism",        ar:"سياحة"},        icon: "map",           category: "tourisme",  tagline: {fr:"Guide de l'aventure", en:"Adventure guide", ar:"دليل المغامرة"}, status: "soon" },
  { slug: "evenementiel",  title: {fr:"Événementiel",      en:"Events",         ar:"فعاليات"},      icon: "calendar-heart", category: "tourisme", tagline: {fr:"Grand orchestrateur", en:"Grand orchestrator", ar:"مدير الحفلات"}, status: "soon" },

  // ===== SANTÉ & BEAUTÉ =====
  { slug: "sante",         title: {fr:"Santé",             en:"Health",         ar:"صحة"},          icon: "stethoscope",   category: "sante",     tagline: {fr:"Gardien du bien-être", en:"Wellness guardian", ar:"حارس الصحة"}, status: "soon" },
  { slug: "pharmacie",     title: {fr:"Pharmacie",         en:"Pharmacy",       ar:"صيدلية"},       icon: "pill",          category: "sante",     tagline: {fr:"Le comptoir vital", en:"Vital counter", ar:"صيدلية"}, status: "soon" },
  { slug: "dentiste",      title: {fr:"Dentiste",          en:"Dentist",        ar:"طبيب أسنان"},   icon: "smile",         category: "sante",     tagline: {fr:"Cabinet du sourire", en:"Smile cabinet", ar:"عيادة الابتسامة"}, status: "soon" },
  { slug: "veterinaire",   title: {fr:"Vétérinaire",       en:"Vet",            ar:"طبيب بيطري"},   icon: "paw-print",     category: "sante",     tagline: {fr:"Ami des animaux", en:"Animal ally", ar:"صديق الحيوانات"}, status: "soon" },
  { slug: "beaute",        title: {fr:"Beauté",            en:"Beauty",         ar:"جمال"},         icon: "sparkles",      category: "sante",     tagline: {fr:"Studio de l'élégance", en:"Elegance studio", ar:"استوديو الأناقة"}, status: "soon" },
  { slug: "coiffeur",      title: {fr:"Coiffeur",          en:"Barber",         ar:"حلاق"},         icon: "scissors",      category: "sante",     tagline: {fr:"Art du style", en:"Style art", ar:"فن التصفيف"}, status: "soon" },
  { slug: "sport",         title: {fr:"Salle de sport",    en:"Gym",            ar:"نادي رياضي"},   icon: "dumbbell",      category: "sante",     tagline: {fr:"Temple du corps", en:"Body temple", ar:"معبد الجسد"}, status: "live" },

  // ===== SERVICES PROS =====
  { slug: "entreprise",    title: {fr:"Entreprise",        en:"Business",       ar:"شركة"},         icon: "briefcase",     category: "pro",       tagline: {fr:"Organisation en marche", en:"Business in motion", ar:"مؤسسة في حركة"}, status: "live" },
  { slug: "freelance",     title: {fr:"Freelance",         en:"Freelance",      ar:"مستقل"},        icon: "laptop",        category: "pro",       tagline: {fr:"Général indépendant", en:"Independent general", ar:"جنرال مستقل"}, status: "soon" },
  { slug: "avocat",        title: {fr:"Avocat",            en:"Lawyer",         ar:"محامي"},        icon: "scale",         category: "pro",       tagline: {fr:"Chambre de justice", en:"Justice chamber", ar:"غرفة العدل"}, status: "live" },
  { slug: "comptable",     title: {fr:"Comptable",         en:"Accountant",     ar:"محاسب"},        icon: "calculator",    category: "pro",       tagline: {fr:"Maître des chiffres", en:"Numbers master", ar:"سيد الأرقام"}, status: "soon" },
  { slug: "notaire",       title: {fr:"Notaire",           en:"Notary",         ar:"موثق"},         icon: "file-signature", category: "pro",      tagline: {fr:"Sceau de confiance", en:"Trust seal", ar:"ختم الثقة"}, status: "soon" },
  { slug: "agence",        title: {fr:"Agence",            en:"Agency",         ar:"وكالة"},        icon: "megaphone",     category: "pro",       tagline: {fr:"Studio créatif", en:"Creative studio", ar:"استوديو إبداعي"}, status: "soon" },
  { slug: "consulting",    title: {fr:"Consulting",        en:"Consulting",     ar:"استشارة"},      icon: "compass",       category: "pro",       tagline: {fr:"Boussole stratégique", en:"Strategy compass", ar:"بوصلة استراتيجية"}, status: "soon" },

  // ===== INDUSTRIE & CONSTRUCTION =====
  { slug: "batiment",      title: {fr:"Bâtiment",          en:"Construction",   ar:"بناء"},         icon: "hard-hat",      category: "industrie", tagline: {fr:"Bâtisseur d'empire", en:"Empire builder", ar:"باني الإمبراطورية"}, status: "soon" },
  { slug: "industrie",     title: {fr:"Industrie",         en:"Industry",       ar:"صناعة"},        icon: "factory",       category: "industrie", tagline: {fr:"Forge du royaume", en:"Kingdom forge", ar:"مصنع المملكة"}, status: "soon" },
  { slug: "artisan",       title: {fr:"Artisan",           en:"Craftsman",      ar:"حرفي"},         icon: "hammer",        category: "industrie", tagline: {fr:"Main du métier", en:"Craft mastery", ar:"يد الحرفة"}, status: "soon" },
  { slug: "agriculture",   title: {fr:"Agriculture",       en:"Agriculture",    ar:"زراعة"},        icon: "sprout",        category: "industrie", tagline: {fr:"Terres et récoltes", en:"Land & harvest", ar:"الأرض والحصاد"}, status: "soon" },
  { slug: "energie",       title: {fr:"Énergie",           en:"Energy",         ar:"طاقة"},         icon: "zap",           category: "industrie", tagline: {fr:"Feu de l'empire", en:"Empire fire", ar:"نار الإمبراطورية"}, status: "soon" },

  // ===== ÉDUCATION & CULTURE =====
  { slug: "education",     title: {fr:"Éducation",         en:"Education",      ar:"تعليم"},        icon: "graduation-cap", category: "culture",  tagline: {fr:"Temple du savoir", en:"Knowledge temple", ar:"معبد المعرفة"}, status: "soon" },
  { slug: "formation",     title: {fr:"Formation",         en:"Training",       ar:"تكوين"},        icon: "book-open",     category: "culture",   tagline: {fr:"Studio d'apprentissage", en:"Learning studio", ar:"استوديو التعلم"}, status: "soon" },
  { slug: "culture",       title: {fr:"Culture",           en:"Culture",        ar:"ثقافة"},        icon: "landmark",      category: "culture",   tagline: {fr:"Héritage vivant", en:"Living heritage", ar:"إرث حي"}, status: "soon" },

  // ===== TECH & FINANCE =====
  { slug: "tech",          title: {fr:"Technologie",       en:"Technology",     ar:"تكنولوجيا"},    icon: "cpu",           category: "tech",      tagline: {fr:"Laboratoire du futur", en:"Future lab", ar:"مختبر المستقبل"}, status: "soon" },
  { slug: "startup",       title: {fr:"Startup",           en:"Startup",        ar:"شركة ناشئة"},   icon: "rocket",        category: "tech",      tagline: {fr:"Fusée entrepreneuriale", en:"Founder rocket", ar:"صاروخ ريادي"}, status: "soon" },
  { slug: "finance",       title: {fr:"Finance",           en:"Finance",        ar:"مالية"},        icon: "trending-up",   category: "tech",      tagline: {fr:"Coffre-fort intelligent", en:"Smart vault", ar:"خزنة ذكية"}, status: "soon" },
  { slug: "crypto",        title: {fr:"Crypto",            en:"Crypto",         ar:"عملات رقمية"},  icon: "bitcoin",       category: "tech",      tagline: {fr:"Frontière numérique", en:"Digital frontier", ar:"الحدود الرقمية"}, status: "soon" },
  { slug: "assurance",     title: {fr:"Assurance",         en:"Insurance",      ar:"تأمين"},        icon: "shield-check",  category: "tech",      tagline: {fr:"Rempart du risque", en:"Risk shield", ar:"حصن ضد الخطر"}, status: "soon" }
];

// Catégories & labels d'affichage
const OG_CATEGORIES = [
  { id: "all",         label: { fr: "Tous",           en: "All",         ar: "الكل" } },
  { id: "vie",         label: { fr: "Vie",            en: "Life",        ar: "حياة" } },
  { id: "business",    label: { fr: "Business",       en: "Business",    ar: "أعمال" } },
  { id: "restauration",label: { fr: "Restauration",   en: "Food",        ar: "مطاعم" } },
  { id: "mobilite",    label: { fr: "Mobilité",       en: "Mobility",    ar: "نقل" } },
  { id: "tourisme",    label: { fr: "Tourisme",       en: "Tourism",     ar: "سياحة" } },
  { id: "sante",       label: { fr: "Santé & Beauté", en: "Health",      ar: "صحة" } },
  { id: "pro",         label: { fr: "Services Pro",   en: "Pro Services", ar: "خدمات" } },
  { id: "industrie",   label: { fr: "Industrie",      en: "Industry",    ar: "صناعة" } },
  { id: "culture",     label: { fr: "Éducation",      en: "Education",   ar: "تعليم" } },
  { id: "tech",        label: { fr: "Tech & Finance", en: "Tech",        ar: "تقنية" } }
];

// Réseaux connectés SAMII (affichés Hub + SAMII page)
const OG_NETWORKS = [
  { id: "meta",      label: "Meta",      icon: "meta-icon",      color: "#0866FF" },
  { id: "whatsapp",  label: "WhatsApp",  icon: "whatsapp-icon",  color: "#25D366" },
  { id: "instagram", label: "Instagram", icon: "instagram-icon", color: "#E1306C" },
  { id: "tiktok",    label: "TikTok",    icon: "tiktok-icon",    color: "#FF0050" },
  { id: "shopify",   label: "Shopify",   icon: "shopify-icon",   color: "#95BF47" },
  { id: "google",    label: "Google",    icon: "google-icon",    color: "#EA4335" },
  { id: "stripe",    label: "Stripe",    icon: "stripe-icon",    color: "#635BFF" },
  { id: "youtube",   label: "YouTube",   icon: "youtube-icon",   color: "#FF0000" }
];
