document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des icônes Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Gestion de la modale
    const modal = document.getElementById('ogModal');
    const openTrigger = document.getElementById('openModalTrigger');
    const closeTrigger = document.getElementById('closeModal');
    
    const stepHome = document.getElementById('stepHome');
    const stepCreate = document.getElementById('stepCreate');

    const createQGBtn = document.getElementById('createQG');
    const metierInput = document.getElementById('metierInput');
    const workspaceMetier = document.getElementById('workspaceMetier');
    const createWorkspaceForm = document.getElementById('createWorkspaceForm');

    function openModal() {
        if (modal) modal.classList.add('active');
        if (metierInput) metierInput.focus();
    }

    function closeModal() {
        if (modal) modal.classList.remove('active');
        setTimeout(() => {
            if (stepHome) stepHome.classList.add('active');
            if (stepCreate) stepCreate.classList.remove('active');
        }, 200);
    }

    if (openTrigger) openTrigger.addEventListener('click', openModal);
    if (closeTrigger) closeModalTrigger?.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Raccourci clavier ⌘K / Ctrl+K
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openModal();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Clic sur les cartes métiers de la grille principale
    document.querySelectorAll('.metier-card').forEach(card => {
        card.addEventListener('click', () => {
            const metier = card.getAttribute('data-metier');
            openModal();
            if (metierInput) metierInput.value = metier;
            if (workspaceMetier) workspaceMetier.value = metier;
            if (stepHome) stepHome.classList.remove('active');
            if (stepCreate) stepCreate.classList.add('active');
        });
    });

    // Bouton de création depuis la modale
    if (createQGBtn) {
        createQGBtn.addEventListener('click', () => {
            const val = metierInput ? metierInput.value.trim() : '';
            if (workspaceMetier) workspaceMetier.value = val;
            if (stepHome) stepHome.classList.remove('active');
            if (stepCreate) stepCreate.classList.add('active');
        });
    }

    // Gestion du bouton de redirection d'espace actif
    document.querySelectorAll('.workspace-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const wsId = pill.getAttribute('data-workspace');
            if (wsId) {
                window.location.href = `/workspace/${wsId}`;
            }
        });
    });

    // Soumission du formulaire de création d'espace
    if (createWorkspaceForm) {
        createWorkspaceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                metier: document.getElementById('workspaceMetier')?.value,
                nom: document.getElementById('workspaceNom')?.value,
                prenom: document.getElementById('workspacePrenom')?.value,
                entreprise: document.getElementById('workspaceEntreprise')?.value
            };
            
            // Simulation de transmission ou appel API backend
            console.log('Déploiement de l’infrastructure OG :', formData);
            // Tu peux router vers ton endpoint Make/n8n ou route Express ici
        });
    }
});
