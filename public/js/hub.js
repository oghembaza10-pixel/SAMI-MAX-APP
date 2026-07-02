const METIERS = [

    { title: "Particulier", icon: "user", mod: "particulier" },
    { title: "Entreprise", icon: "briefcase", mod: "entreprise" },
    { title: "E-commerce", icon: "shopping-bag", mod: "ecommerce" },
    { title: "Restaurant", icon: "utensils-crossed", mod: "restaurant" },

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

            <i data-lucide="${m.icon}"></i>

            <h3>${m.title}</h3>

        </article>

    `).join("");

    if (window.lucide) {
        lucide.createIcons();
    }
}

document.addEventListener("DOMContentLoaded", () => {

    renderGrid();

    const search = document.getElementById("search");

    if (search) {

        search.addEventListener("input", e => {

            renderGrid(e.target.value);

        });

    }

});
