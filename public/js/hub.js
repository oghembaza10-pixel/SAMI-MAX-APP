const OG_METIERS = [
    // === A-E ===
    { slug: "particulier", title: {fr:"Particulier", en:"Individual", ar:"فرد"}, icon:"user" },
    { slug: "entreprise", title: {fr:"Entreprise", en:"Business", ar:"شركة"}, icon:"briefcase" },
    { slug: "ecommerce", title: {fr:"E-commerce", en:"E-commerce", ar:"تجارة"}, icon:"shopping-bag" },
    { slug: "restaurant", title: {fr:"Restaurant", en:"Restaurant", ar:"مطعم"}, icon:"utensils" },
    { slug: "livreur", title: {fr:"Delivery", en:"Delivery", ar:"توصيل"}, icon:"bike" },
    { slug: "voyage", title: {fr:"Voyage", en:"Travel", ar:"سفر"}, icon:"plane" },
    { slug: "immobilier", title: {fr:"Immobilier", en:"Real Estate", ar:"عقارات"}, icon:"building-2" },
    { slug: "agriculteur", title: {fr:"Agriculteur", en:"Farmer", ar:"مزارع"}, icon:"tractor" },
    { slug: "avocat", title: {fr:"Avocat", en:"Lawyer", ar:"محامي"}, icon:"scale" },
    { slug: "artisan", title: {fr:"Artisan", en:"Craftsman", ar:"حرفي"}, icon:"hammer" },
    { slug: "architecte", title: {fr:"Architecte", en:"Architect", ar:"مهندس معماري"}, icon:"ruler" },
    { slug: "assurance", title: {fr:"Assurance", en:"Insurance", ar:"تأمين"}, icon:"shield-check" },
    { slug: "banque", title: {fr:"Banque", en:"Bank", ar:"بنك"}, icon:"landmark" },
    { slug: "boulangerie", title: {fr:"Boulangerie", en:"Bakery", ar:"مخبزة"}, icon:"cookie" },
    { slug: "coiffeur", title: {fr:"Coiffeur", en:"Barber", ar:"حلاق"}, icon:"scissors" },
    { slug: "comptable", title: {fr:"Comptable", en:"Accountant", ar:"محاسب"}, icon:"calculator" },
    { slug: "consultant", title: {fr:"Consultant", en:"Consultant", ar:"مستشار"}, icon:"compass" },
    { slug: "dentiste", title: {fr:"Dentiste", en:"Dentist", ar:"طبيب أسنان"}, icon:"smile" },
    // === F-O ===
    { slug: "famille", title: {fr:"Famille", en:"Family", ar:"عائلة"}, icon:"heart" },
    { slug: "financement", title: {fr:"Financement", en:"Funding", ar:"تمويل"}, icon:"badge-dollar-sign" },
    { slug: "formation", title: {fr:"Formation", en:"Training", ar:"تكوين"}, icon:"book-open" },
    { slug: "fournisseur", title: {fr:"Fournisseur", en:"Supplier", ar:"مورّد"}, icon:"package-check" },
    { slug: "freelance", title: {fr:"Freelance", en:"Freelance", ar:"مستقل"}, icon:"laptop" },
    { slug: "garage", title: {fr:"Garage", en:"Garage", ar:"ورشة"}, icon:"wrench" },
    { slug: "grossiste", title: {fr:"Grossiste", en:"Wholesale", ar:"جملة"}, icon:"package" },
    { slug: "hotel", title: {fr:"Hôtel", en:"Hotel", ar:"فندق"}, icon:"bed" },
    { slug: "industrie", title: {fr:"Industrie", en:"Industry", ar:"صناعة"}, icon:"factory" },
    { slug: "informatique", title: {fr:"Informatique", en:"IT", ar:"إعلام آلي"}, icon:"cpu" },
    { slug: "installation", title: {fr:"Installation", en:"Installation", ar:"تركيب"}, icon:"settings" },
    { slug: "investisseur", title: {fr:"Investisseur", en:"Investor", ar:"مستثمر"}, icon:"trending-up" },
    { slug: "juridique", title: {fr:"Juridique", en:"Legal", ar:"قانوني"}, icon:"gavel" },
    { slug: "laboratoire", title: {fr:"Laboratoire", en:"Lab", ar:"مخبر"}, icon:"microscope" },
    { slug: "livraison-pro", title: {fr:"Livraison Pro", en:"Pro Delivery", ar:"توصيل احترافي"}, icon:"van" },
    { slug: "logistique", title: {fr:"Logistique", en:"Logistics", ar:"لوجستيك"}, icon:"map-pin" },
    { slug: "magasin", title: {fr:"Magasin", en:"Store", ar:"متجر"}, icon:"store" },
    { slug: "marketing", title: {fr:"Marketing", en:"Marketing", ar:"تسويق"}, icon:"megaphone" },
    { slug: "medic", title: {fr:"Médical", en:"Medical", ar:"طبي"}, icon:"stethoscope" },
    { slug: "mobilite", title: {fr:"Mobilité", en:"Mobility", ar:"تنقل"}, icon:"truck" },
    { slug: "musicien", title: {fr:"Musicien", en:"Musician", ar:"موسيقي"}, icon:"music" },
    { slug: "nettoyage", title: {fr:"Nettoyage", en:"Cleaning", ar:"تنظيف"}, icon:"droplets" },
    { slug: "notaire", title: {fr:"Notaire", en:"Notary", ar:"موثق"}, icon:"file-signature" },
    // === P-Z ===
    { slug: "pharmacie", title: {fr:"Pharmacie", en:"Pharmacy", ar:"صيدلية"}, icon:"pill" },
    { slug: "photographe", title: {fr:"Photographe", en:"Photographer", ar:"مصور"}, icon:"camera" },
    { slug: "recrutement", title: {fr:"Recrutement", en:"Recruitment", ar:"توظيف"}, icon:"user-plus" },
    { slug: "reparation", title: {fr:"Réparation", en:"Repair", ar:"تصليح"}, icon:"wrench-screwdriver" },
    { slug: "restaurant-luxe", title: {fr:"Restaurant Luxe", en:"Luxury Dining", ar:"مطعم فاخر"}, icon:"cloche" },
    { slug: "salle-de-sport", title: {fr:"Salle de sport", en:"Gym", ar:"نادي رياضي"}, icon:"dumbbell" },
    { slug: "securite", title: {fr:"Sécurité", en:"Security", ar:"أمن"}, icon:"lock-keyhole" },
    { slug: "service-client", title: {fr:"Service client", en:"Customer Service", ar:"خدمة زبائن"}, icon:"headset" },
    { slug: "startup", title: {fr:"Startup", en:"Startup", ar:"شركة ناشئة"}, icon:"rocket" },
    { slug: "taxiste", title: {fr:"Taxi", en:"Taxi", ar:"سيارة أجرة"}, icon:"car" },
    { slug: "tech", title: {fr:"Technologie", en:"Tech", ar:"تكنولوجيا"}, icon:"brain-circuit" },
    { slug: "telephonie", title: {fr:"Téléphonie", en:"Telecom", ar:"هاتف"}, icon:"phone" },
    { slug: "traduction", title: {fr:"Traduction", en:"Translation", ar:"ترجمة"}, icon:"languages" },
    { slug: "transport", title: {fr:"Transport", en:"Transport", ar:"نقل"}, icon:"truck" },
    { slug: "usine", title: {fr:"Usine", en:"Factory", ar:"مصنع"}, icon:"warehouse" },
    { slug: "veterinaire", title: {fr:"Vétérinaire", en:"Vet", ar:"طبيب بيطري"}, icon:"paw-print" },
    { slug: "vêtement", title: {fr:"Vêtement", en:"Clothing", ar:"ملابس"}, icon:"shirt" },
    { slug: "voyageur", title: {fr:"Voyageur", en:"Traveler", ar:"مسافر"}, icon:"baggage-claim" },
    { slug: "zone-franche", title: {fr:"Zone Franche", en:"Free Zone", ar:"منطقة حرة"}, icon:"globe" }
];

let currentLang = "fr";

/* =======================
    RENDER GRID
======================= */
function renderGrid() {
    const grid = document.getElementById("hub-grid");
    if (!grid) return;

    // Crée les 50 cartes
    const cardsHTML = OG_METIERS.map(m => `
        <article class="card" onclick="window.location.href='/qg/${m.slug}'">
            <div class="card-icon">
                <i data-lucide="${m.icon}"></i>
            </div>
            <h3>${m.title[currentLang]}</h3>
        </article>
    `).join("");

    // AJOUTE LE BOUTON "+" À LA FIN
    const plusButtonHTML = `
        <article class="card card-plus" onclick="window.location.href='/proposer-qg'">
            <div class="card-icon">
                <i data-lucide="plus-circle"></i>
            </div>
            <h3>Plus de métiers</h3>
        </article>
    `;

    // Affiche TOUT le HTML d'un coup
    grid.innerHTML = cardsHTML + plusButtonHTML;

    if (window.lucide) {
        lucide.createIcons();
    }

    // Animation d'apparition (Luxe)
    document.querySelectorAll(".card").forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        setTimeout(() => {
            card.style.transition = ".5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, i * 30); // Vitesse d'animation rapide pour 51 éléments
    });
}

/* =======================
    LANGUAGES & EVENTS
======================= */
const translations = {
    fr: { title:"OG", subtitle:"Le jeu commence ici.<br>Choisissez votre premier QG." },
    en: { title:"OG", subtitle:"The game starts here.<br>Choose your first HQ." },
    ar: { title:"OG", subtitle:"اللعبة تبدأ هنا.<br>اختر مقرّك الأول." }
};

function applyLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    const titleEl = document.querySelector(".hero h1");
    const subEl = document.querySelector(".hero p");
    if (titleEl) titleEl.textContent = t.title;
    if (subEl) subEl.innerHTML = t.subtitle;

    // Re-rend la grille quand la langue change
    renderGrid();

    document.querySelectorAll(".language-switcher button").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.lang === lang) { btn.classList.add("active"); }
    });
    localStorage.setItem("og-lang", lang);
}

document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("og-lang") || "fr";
    applyLanguage(saved);

    document.querySelectorAll(".language-switcher button").forEach(btn => {
        btn.addEventListener("click", () => {
            applyLanguage(btn.dataset.lang);
        });
    });
});
