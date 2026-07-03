const METIERS = [
    { title:{fr:"Particulier",en:"Individual",ar:"فرد"}, icon:"user", mod:"particulier" },
    { title:{fr:"Entreprise",en:"Business",ar:"شركة"}, icon:"briefcase", mod:"entreprise" },
    { title:{fr:"E-commerce",en:"E-commerce",ar:"تجارة"}, icon:"shopping-bag", mod:"ecommerce" },
    { title:{fr:"Restaurant",en:"Restaurant",ar:"مطعم"}, icon:"utensils", mod:"restaurant" },
    { title:{fr:"Livreur",en:"Delivery",ar:"توصيل"}, icon:"bike", mod:"livreur" },
    { title:{fr:"Voyage",en:"Travel",ar:"سفر"}, icon:"plane", mod:"voyage" },
    { title:{fr:"Location",en:"Rental",ar:"تأجير"}, icon:"car", mod:"location" },
    { title:{fr:"Avocat",en:"Lawyer",ar:"محامي"}, icon:"scale", mod:"avocat" },
    { title:{fr:"Salle de sport",en:"Gym",ar:"رياضة"}, icon:"dumbbell", mod:"sport" },
    { title:{fr:"Transport",en:"Transport",ar:"نقل"}, icon:"truck", mod:"transport" },

    // bonus
    { title:{fr:"Tous les QG",en:"All HQs",ar:"كل المقرات"}, icon:"grid", mod:"all" }
];

let currentLang = "fr";

/* =======================
   RENDER GRID
======================= */
function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");
    if (!grid) return;

    const search = filter.toLowerCase();

    const list = METIERS.filter(m =>
        m.title[currentLang].toLowerCase().includes(search)
    );

    grid.innerHTML = list.map(m => `
        <article class="card" onclick="window.location.href='/qg/${m.mod}'">
            <div class="card-icon">
                <i data-lucide="${m.icon}"></i>
            </div>
            <h3>${m.title[currentLang]}</h3>
        </article>
    `).join("");

    if (window.lucide) {
        lucide.createIcons();
    }

    document.querySelectorAll(".card").forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        setTimeout(() => {
            card.style.transition = ".3s ease";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, i * 40);
    });
}

/* =======================
   LANGUAGES
======================= */
const translations = {
    fr: {
        title:"OG",
        subtitle:"Le jeu commence ici.<br>Choisissez votre premier QG."
    },
    en: {
        title:"OG",
        subtitle:"The game starts here.<br>Choose your first HQ."
    },
    ar: {
        title:"OG",
        subtitle:"اللعبة تبدأ هنا.<br>اختر مقرّك الأول."
    }
};

/* =======================
   APPLY LANGUAGE
======================= */
function applyLanguage(lang) {

    currentLang = lang;
    const t = translations[lang];

    const titleEl = document.querySelector(".hero h1");
    const subEl = document.querySelector(".hero p");

    if (titleEl) titleEl.textContent = t.title;
    if (subEl) subEl.innerHTML = t.subtitle; // J'utilise innerHTML pour le <br>

    renderGrid();

    document.querySelectorAll(".language-switcher button").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.lang === lang) {
            btn.classList.add("active");
        }
    });

    localStorage.setItem("og-lang", lang);
}

/* =======================
   EVENTS
======================= */
document.addEventListener("DOMContentLoaded", () => {

    const saved = localStorage.getItem("og-lang") || "fr";
    applyLanguage(saved);

    document.querySelectorAll(".language-switcher button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".language-switcher button")
                .forEach(b => b.classList.remove("active"));

            btn.classList.add("active");
            applyLanguage(btn.dataset.lang);
        });
    });

    const search = document.getElementById("search");
    if (search) {
        search.addEventListener("input", e => {
            renderGrid(e.target.value);
        });
    }
});
