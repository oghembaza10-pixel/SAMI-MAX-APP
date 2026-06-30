const METIERS = [
    { title: "Client", icon: "user", mod: "client" },
    { title: "Restaurant", icon: "coffee", mod: "restaurant" },
    { title: "E-commerce", icon: "shopping-bag", mod: "ecommerce" },
    { title: "Boutique", icon: "store", mod: "boutique" },
    { title: "Grossiste", icon: "package", mod: "grossiste" },

    { title: "Livreur", icon: "truck", mod: "livreur" },
    { title: "Hôtel", icon: "hotel", mod: "hotel" },
    { title: "Salle de sport", icon: "dumbbell", mod: "gym" },
    { title: "Salle des fêtes", icon: "party-popper", mod: "fetes" },
    { title: "Garage", icon: "wrench", mod: "garage" },

    { title: "Lavage Auto", icon: "droplets", mod: "lavage" },
    { title: "Location voitures", icon: "car", mod: "location" },
    { title: "Immobilier", icon: "building-2", mod: "immo" },
    { title: "Pharmacie", icon: "pill", mod: "pharmacie" },
    { title: "Clinique", icon: "heart-pulse", mod: "clinique" },

    { title: "Entreprise", icon: "briefcase", mod: "entreprise" },
    { title: "Ferme", icon: "sprout", mod: "ferme" },
    { title: "Transport", icon: "truck", mod: "transport" },
    { title: "Avocat", icon: "scale", mod: "avocat" },
    { title: "Comptable", icon: "calculator", mod: "comptable" },

    { title: "Assurance", icon: "shield", mod: "assurance" },
    { title: "Formation", icon: "graduation-cap", mod: "formation" },
    { title: "Marketing", icon: "megaphone", mod: "marketing" },
    { title: "Studio", icon: "palette", mod: "studio" },
    { title: "Cabinet", icon: "file-text", mod: "cabinet" },

    { title: "Maintenance", icon: "settings", mod: "maintenance" },
    { title: "Import / Export", icon: "globe", mod: "import" },
    { title: "Sécurité", icon: "lock", mod: "security" },
    { title: "Recrutement", icon: "users", mod: "recrutement" },
    { title: "Événement", icon: "calendar", mod: "event" }
];

function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");

    if (!grid) return;

    const recherche = filter.toLowerCase();

    const liste = METIERS.filter(m =>
        m.title.toLowerCase().includes(recherche)
    );

    grid.innerHTML = `
        <div class="main-grid">

            ${liste.map(m => `

                <article class="card" data-module="${m.mod}">

                    <i data-lucide="${m.icon}"></i>

                    <h3>${m.title}</h3>

                    <button type="button"
                        onclick="window.location.href='/qg/${m.mod}'">

                        Entrer

                    </button>

                </article>

            `).join("")}

        </div>
    `;

    if (window.lucide) {
        lucide.createIcons();
    }

}

document.addEventListener("DOMContentLoaded", () => {

    renderGrid();

    const search = document.getElementById("search");

    if (search) {

        search.addEventListener("input", function () {

            renderGrid(this.value);

        });

    }

});
