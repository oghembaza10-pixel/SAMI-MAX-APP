// =====================================================================
// OG EMPIRE — CAPITALE MONDIALE : Moteur Front-End
// Gère la langue et l'initialisation
// =====================================================================

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialiser Lucide Icons (déjà fait dans l'EJS, mais bien de l'avoir ici aussi)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 2. Note: Dans cette version "Capitale", il n'y a plus de grille de métiers à filtrer.
    // Le JS n'a plus besoin de gérer le tableau METIERS.
    // Il ne gère que la langue pour le texte global si nécessaire.
    
    // Initialiser l'état des liens de sidebar au clic (optionnel, pour le style actif)
    const sidebarLinks = document.querySelectorAll('.nav-item');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// ==========================================================================
// NOTE POUR LE DÉVELOPPEUR : Internationalisation (i18n)
// ==========================================================================
// Puisque tu as besoin de changer le texte "Rejoignez l'écosystème OG" en FR/EN/AR,
// voici comment tu peux l'implémenter facilement si tu ne veux pas recharger la page.
// Ajoute simplement cet objet et cette fonction dans ce fichier.

const capitolTranslations = {
    fr: { hero: "Rejoignez l'écosystème OG." },
    en: { hero: "Join the OG Ecosystem." },
    ar: { hero: "انضم إلى نظام OG البيئي." }
};

function switchCapitolLang(lang) {
    const heroTitle = document.querySelector('.hero-text-zone h1');
    if (heroTitle && capitolTranslations[lang]) {
        heroTitle.textContent = capitolTranslations[lang].hero;
    }
    
    // Sauvegarder
    localStorage.setItem("og-capital-lang", lang);
}

// Si tu ajoutes un sélecteur de langue dans le futur, tu l'appellerais ici.
// Pour l'instant, la logique est prête au cas où tu voudrais ajouter
// des boutons de langue dans la sidebar ou le header.
