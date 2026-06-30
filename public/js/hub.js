const METIERS = [
    { title: "Client", icon: "user", mod: "client" },
    { title: "Restaurant", icon: "coffee", mod: "restaurant" },
    { title: "E-commerce", icon: "shopping-bag", mod: "ecommerce" },
    { title: "Boutique", icon: "tag", mod: "boutique" },
    { title: "Grossiste", icon: "package", mod: "grossiste" },

    { title: "Livreur", icon: "truck", mod: "livreur" },
    { title: "Hôtel", icon: "hotel", mod: "hotel" },
    { title: "Salle de sport", icon: "dumbbell", mod: "gym" },
    { title: "Salle des fêtes", icon: "music", mod: "fetes" },
    { title: "Garage", icon: "wrench", mod: "garage" },

    { title: "Lavage auto", icon: "droplet", mod: "lavage" },
    { title: "Location voitures", icon: "car", mod: "location" },
    { title: "Immobilier", icon: "home", mod: "immo" },
    { title: "Pharmacie", icon: "pill", mod: "pharmacie" },
    { title: "Clinique", icon: "activity", mod: "clinique" },

    { title: "Entreprise", icon: "briefcase", mod: "enterprise" },
    { title: "Ferme", icon: "sprout", mod: "ferme" },
    { title: "Transport", icon: "truck", mod: "transport" },
    { title: "Avocat", icon: "scale", mod: "avocat" },
    { title: "Comptable", icon: "calculator", mod: "compta" },

    { title: "Assurance", icon: "shield", mod: "assurance" },
    { title: "Formation", icon: "book", mod: "formation" },
    { title: "Marketing", icon: "megaphone", mod: "marketing" },
    { title: "Studio", icon: "pen-tool", mod: "studio" },
    { title: "Cabinet", icon: "message-square", mod: "cabinet" },

    { title: "Maintenance", icon: "settings", mod: "maint" },
    { title: "Import / Export", icon: "globe", mod: "import" },
    { title: "Sécurité", icon: "lock", mod: "security" },
    { title: "Recrutement", icon: "users", mod: "recrut" },
    { title: "Événement", icon: "calendar", mod: "event" }
];

function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");

    if (!grid) return;

    const search = filter.toLowerCase();

    const metiers = METIERS.filter(m =>
        m.title.toLowerCase().includes(search)
    );

    grid.innerHTML = `
        <div class="main-grid">
            ${metiers.map(m => `
                <article class="card" data-module="${m.mod}">
                    <i data-lucide="${m.icon}"></i>

                    <h3>${m.title}</h3>

                    <button
                        type="button"
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

