const METIERS = [

    { title: "Particulier", icon: "user", mod: "particulier" },
    { title: "Entreprise", icon: "briefcase", mod: "entreprise" },
    { title: "E-commerce", icon: "shopping-bag", mod: "ecommerce" },
    { title: "Restaurant", icon: "utensils-crossed", mod: "restaurant" },
    { title: "Livreur", icon: "truck", mod: "livreur" },
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

function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");

    if (!grid) return;

    const recherche = filter.toLowerCase();

    const liste = METIERS.filter(m =>
        m.title.toLowerCase().includes(recherche)
    );

    grid.innerHTML = liste.map(m => `

        <article class="card"
            onclick="window.location.href='/qg/${m.mod}'">

            <div class="card-icon">
                <i data-lucide="${m.icon}"></i>
            </div>

            <h3>${m.title}</h3>

            <div class="card-bottom">
                <span class="enter">Entrer →</span>
            </div>

        </article>

    `).join("");

    if (window.lucide) {

        lucide.createIcons({
            attrs:{
                "stroke-width":1.8
            }
        });

    }

    document.querySelectorAll(".card").forEach((card,index)=>{

        card.style.opacity="0";
        card.style.transform="translateY(25px)";

        setTimeout(()=>{

            card.style.transition=".35s ease";
            card.style.opacity="1";
            card.style.transform="translateY(0)";

        },index*40);

    });

}

document.addEventListener("DOMContentLoaded",()=>{

    renderGrid();

    const search=document.getElementById("search");

    if(search){

        search.addEventListener("input",e=>{

            renderGrid(e.target.value);

        });

    }

});

/* ==========================================
   LANGUES
========================================== */

const translations={

fr:{
title:"Bienvenue au Centre Commercial des QG",
subtitle:"Choisissez votre activité et lancez votre quartier général."
},

en:{
title:"Welcome to the HQ Mall",
subtitle:"Choose your activity and launch your headquarters."
},

ar:{
title:"مرحبًا بك في مركز المقرات",
subtitle:"اختر نشاطك وابدأ مقرّك الرئيسي."
}

};

const title=document.querySelector(".hero h1");
const subtitle=document.querySelector(".hero p");

document.querySelectorAll(".language-switcher button").forEach(button=>{

    button.addEventListener("click",()=>{

        const lang=button.dataset.lang;

        document.querySelectorAll(".language-switcher button")
        .forEach(b=>b.classList.remove("active"));

        button.classList.add("active");

        title.textContent=translations[lang].title;
        subtitle.textContent=translations[lang].subtitle;

        localStorage.setItem("og-language",lang);

    });

});

const savedLang=localStorage.getItem("og-language")||"fr";

document.querySelector(
`.language-switcher button[data-lang="${savedLang}"]`
)?.click();
