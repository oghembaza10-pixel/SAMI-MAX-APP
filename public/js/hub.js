const METIERS = [
  { title: "Particulier", icon: "user", mod: "particulier" },
  { title: "Entreprise", icon: "briefcase", mod: "entreprise" },
  { title: "E-commerce", icon: "shopping-bag", mod: "ecommerce" },
  { title: "Restaurant", icon: "utensils-crossed", mod: "restaurant" },
  { title: "Livreur", icon: "bike", mod: "livreur" },
  { title: "Agence de voyage", icon: "plane", mod: "voyage" },
  { title: "Grossiste", icon: "warehouse", mod: "grossiste" },
  { title: "Administration", icon: "building", mod: "administration" },
  { title: "Garage", icon: "wrench", mod: "garage" },
  { title: "Immobilier", icon: "building-2", mod: "immobilier" },
  { title: "Hôtel", icon: "hotel", mod: "hotel" },
  { title: "Location", icon: "car", mod: "location" },
  { title: "Marketing", icon: "megaphone", mod: "marketing" },
  { title: "Comptable", icon: "calculator", mod: "comptable" },
  { title: "Avocat", icon: "scale", mod: "avocat" },
  { title: "Salle de sport", icon: "dumbbell", mod: "sport" },
  { title: "Transport", icon: "truck", mod: "transport" },
  { title: "Ferme", icon: "sprout", mod: "ferme" },
  { title: "Formation", icon: "graduation-cap", mod: "formation" },
  { title: "Pharmacie", icon: "pill", mod: "pharmacie" },
  { title: "Clinique", icon: "heart-pulse", mod: "clinique" },
  { title: "Studio", icon: "palette", mod: "studio" },
  { title: "Import / Export", icon: "globe", mod: "import-export" },
  { title: "Lavage", icon: "droplets", mod: "lavage" }
];

// -------- GRID RENDER --------
function renderGrid(filter = "") {
  const grid = document.getElementById("hub-grid");
  if (!grid) return;

  const q = filter.toLowerCase();

  const list = METIERS.filter(m =>
    m.title.toLowerCase().includes(q)
  );

  grid.innerHTML = list.map((m, i) => `
    <article class="card" onclick="location.href='/qg/${m.mod}'">

        <div class="card-icon">
            <i data-lucide="${m.icon}"></i>
        </div>

        <h3>${m.title}</h3>

        <div class="card-bottom">
            <span>Entrer →</span>
        </div>

    </article>
  `).join("");

  if (window.lucide) {
    lucide.createIcons();
  }

  // animation clean
  document.querySelectorAll(".card").forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";

    setTimeout(() => {
      el.style.transition = "0.35s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, i * 35);
  });
}

// -------- INIT SAFE --------
document.addEventListener("DOMContentLoaded", () => {
  renderGrid();

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (e) => {
      renderGrid(e.target.value);
    });
  }

  initLang();
});

// -------- LANG --------
const translations = {
  fr: {
    title: "Bienvenue au Centre Commercial des QG",
    subtitle: "Choisissez votre activité et lancez votre quartier général."
  },
  en: {
    title: "Welcome to the HQ Mall",
    subtitle: "Choose your activity and launch your headquarters."
  },
  ar: {
    title: "مرحبًا بك في مركز المقرات",
    subtitle: "اختر نشاطك وابدأ مقرّك الرئيسي."
  }
};

function initLang() {
  const title = document.querySelector(".hero h1");
  const subtitle = document.querySelector(".hero p");
  const buttons = document.querySelectorAll(".language-switcher button");

  if (!title || !subtitle) return;

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.lang;

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      title.textContent = translations[lang].title;
      subtitle.textContent = translations[lang].subtitle;

      localStorage.setItem("og-lang", lang);
    });
  });

  const saved = localStorage.getItem("og-lang") || "fr";
  const btn = document.querySelector(`[data-lang="${saved}"]`);
  if (btn) btn.click();
}
