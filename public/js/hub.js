const METIERS = [
    { title: "Client particulier", icon: "user", cat: "BASE", description: "Gestion profil utilisateur", status: "Disponible", mod: "client" },

    { title: "Restaurant", icon: "coffee", cat: "COMMERCE", description: "Flux et commandes", status: "Disponible", mod: "restaurant" },
    { title: "E-commerce", icon: "shopping-bag", cat: "COMMERCE", description: "Gestion boutique web", status: "Beta", mod: "ecommerce" },
    { title: "Boutique", icon: "tag", cat: "COMMERCE", description: "Gestion stocks et ventes", status: "Disponible", mod: "boutique" },
    { title: "Supermarché", icon: "shopping-cart", cat: "COMMERCE", description: "Logistique et inventaire", status: "Bientot", mod: "supermarche" },

    { title: "Garage", icon: "wrench", cat: "AUTOMOBILE", description: "Suivi réparation", status: "Disponible", mod: "garage" },
    { title: "Location voitures", icon: "car", cat: "AUTOMOBILE", description: "Flotte et contrats", status: "Premium", mod: "location" },

    { title: "Hotel", icon: "hotel", cat: "HOTELLERIE", description: "Gestion nuitées", status: "Disponible", mod: "hotel" },

    { title: "Salle de sport", icon: "dumbbell", cat: "SPORT", description: "Gestion membres", status: "Disponible", mod: "gym" },

    { title: "Clinique", icon: "activity", cat: "SANTE", description: "Dossiers médicaux", status: "Disponible", mod: "clinique" },
    { title: "Pharmacie", icon: "pill", cat: "SANTE", description: "Gestion stock produits", status: "Disponible", mod: "pharmacie" },

    { title: "Immobilier", icon: "home", cat: "IMMOBILIER", description: "Gestion biens immobiliers", status: "Disponible", mod: "immo" },

    { title: "Entreprise", icon: "briefcase", cat: "ENTREPRISE", description: "Gestion interne société", status: "Verrouille", mod: "enterprise" },

    { title: "Ferme", icon: "sprout", cat: "AGRICULTURE", description: "Production et suivi", status: "Disponible", mod: "ferme" },

    { title: "Transport", icon: "truck", cat: "LOGISTIQUE", description: "Gestion flux marchandises", status: "Disponible", mod: "transport" }
];

const CATEGORY_ORDER = [
    "BASE",
    "COMMERCE",
    "AUTOMOBILE",
    "HOTELLERIE",
    "SPORT",
    "SANTE",
    "IMMOBILIER",
    "ENTREPRISE",
    "AGRICULTURE",
    "LOGISTIQUE"
];

const STATUS_CLASS = {
    "Disponible": "disponible",
    "Beta": "beta",
    "Premium": "premium",
    "Bientot": "bientot",
    "Verrouille": "verrouille"
};

function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");

    if (!grid) return;

    const search = filter.toLowerCase();

    grid.innerHTML = "";

    CATEGORY_ORDER.forEach(category => {

        const items = METIERS.filter(m =>
            m.cat === category &&
            (
                m.title.toLowerCase().includes(search) ||
                m.description.toLowerCase().includes(search) ||
                m.cat.toLowerCase().includes(search)
            )
        );

        if (items.length === 0) return;

        const section = document.createElement("section");
        section.className = "cat-section";

        section.innerHTML = `
            <h2 class="cat-title">${category}</h2>

            <div class="cat-grid">

                ${items.map(m => `
                    <article class="card">

                        <i data-lucide="${m.icon}"></i>

                        <span class="badge ${STATUS_CLASS[m.status]}">${m.status}</span>

                        <h3>${m.title}</h3>

                        <p>${m.description}</p>

                        <a class="og-button" href="/qg/${m.mod}">
                            Accéder
                        </a>

                    </article>
                `).join("")}

            </div>
        `;

        grid.appendChild(section);

    });

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
