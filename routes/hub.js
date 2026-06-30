const METIERS = [
    { title: "Client particulier", icon: "user", cat: "BASE", description: "Gestion profil utilisateur", status: "Disponible", mod: "client" },
    { title: "Restaurant", icon: "coffee", cat: "COMMERCE", description: "Flux et commandes", status: "Disponible", mod: "restaurant" },
    { title: "E-commerce", icon: "shopping-bag", cat: "COMMERCE", description: "Gestion boutique web", status: "Beta", mod: "ecommerce" },
    { title: "Boutique", icon: "tag", cat: "COMMERCE", description: "Gestion stocks et ventes", status: "Disponible", mod: "boutique" },
    { title: "Supermarché", icon: "shopping-cart", cat: "COMMERCE", description: "Logistique et inventaire", status: "Bientôt", mod: "supermarche" },
    { title: "Garage", icon: "wrench", cat: "AUTOMOBILE", description: "Suivi réparation", status: "Disponible", mod: "garage" },
    { title: "Location voitures", icon: "car", cat: "AUTOMOBILE", description: "Flotte et contrats", status: "Premium", mod: "location" },
    { title: "Hôtel", icon: "hotel", cat: "HÔTELLERIE", description: "Gestion nuitées", status: "Disponible", mod: "hotel" },
    { title: "Salle de sport", icon: "dumbbell", cat: "SPORT", description: "Gestion membres", status: "Disponible", mod: "gym" },
    { title: "Clinique", icon: "activity", cat: "SANTÉ", description: "Dossiers médicaux", status: "Disponible", mod: "clinique" },
    { title: "Pharmacie", icon: "pill", cat: "SANTÉ", description: "Gestion stock produits", status: "Disponible", mod: "pharmacie" },
    { title: "Immobilier", icon: "home", cat: "IMMOBILIER", description: "Gestion biens immobiliers", status: "Disponible", mod: "immo" },
    { title: "Entreprise", icon: "briefcase", cat: "ENTREPRISE", description: "Gestion interne société", status: "Verrouillé", mod: "enterprise" },
    { title: "Ferme", icon: "sprout", cat: "AGRICULTURE", description: "Production et suivi", status: "Disponible", mod: "ferme" },
    { title: "Transport", icon: "truck", cat: "LOGISTIQUE", description: "Gestion flux marchandises", status: "Disponible", mod: "transport" }
];

const CATEGORY_ORDER = ["BASE", "COMMERCE", "AUTOMOBILE", "HÔTELLERIE", "SPORT", "SANTÉ", "IMMOBILIER", "ENTREPRISE", "AGRICULTURE", "LOGISTIQUE"];

function renderGrid(filter = "") {
    const grid = document.getElementById('hub-grid');
    const f = filter.toLowerCase();
    
    grid.innerHTML = CATEGORY_ORDER.map(cat => {
        const items = METIERS.filter(m => m.cat === cat && (m.title.toLowerCase().includes(f) || m.cat.toLowerCase().includes(f) || m.description.toLowerCase().includes(f)));
        if (items.length === 0) return '';
        return `
            <section class="cat-section">
                <h2 class="cat-title">${cat}</h2>
                <div class="cat-grid">
                    ${items.map(m => `
                        <article class="card">
                            <i data-lucide="${m.icon}"></i>
                            <span class="badge ${m.status.toLowerCase()}">${m.status}</span>
                            <h3>${m.title}</h3>
                            <p>${m.description}</p>
                            <button class="og-button" onclick="window.location.href='/qg/${m.mod}'">Accéder</button>
                        </article>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
    lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
    renderGrid();
    document.getElementById("search").addEventListener("input", (e) => renderGrid(e.target.value));
});
