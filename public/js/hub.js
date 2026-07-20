document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des icônes Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    const modal = document.getElementById('commandModal');
    const openTrigger = document.getElementById('openCommandModal');
    const closeTrigger = document.getElementById('closeCommandModal');
    
    const panelHome = document.getElementById('panelHome');
    const panelCreate = document.getElementById('panelCreate');

    const triggerCreateQG = document.getElementById('triggerCreateQG');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const deploySector = document.getElementById('deploySector');
    const deploymentForm = document.getElementById('deploymentForm');

    function openModal() {
        if (modal) modal.classList.add('active');
        if (globalSearchInput) globalSearchInput.focus();
    }

    function closeModal() {
        if (modal) modal.classList.remove('active');
        setTimeout(() => {
            if (panelHome) panelHome.classList.add('active');
            if (panelCreate) panelCreate.classList.remove('active');
        }, 300);
    }

    if (openTrigger) openTrigger.addEventListener('click', openModal);
    if (closeTrigger) closeTrigger.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Raccourci clavier ⌘K ou Ctrl+K
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openModal();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Clic sur les départements de l'empire
    document.querySelectorAll('.department-card').forEach(card => {
        card.addEventListener('click', () => {
            const metier = card.getAttribute('data-metier');
            openModal();
            if (globalSearchInput) globalSearchInput.value = metier;
            if (deploySector) deploySector.value = metier;
            if (panelHome) panelHome.classList.remove('active');
            if (panelCreate) panelCreate.classList.add('active');
        });
    });

    // Bouton de création QG depuis la modale
    if (triggerCreateQG) {
        triggerCreateQG.addEventListener('click', () => {
            const val = globalSearchInput ? globalSearchInput.value.trim() : '';
            if (deploySector) deploySector.value = val;
            if (panelHome) panelHome.classList.remove('active');
            if (panelCreate) panelCreate.classList.add('active');
        });
    }

    // Basculement vers un QG existant via les pilules
    document.querySelectorAll('.cluster-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const wsId = pill.getAttribute('data-workspace');
            if (wsId) {
                window.location.href = `/workspace/${wsId}`;
            }
        });
    });

    // Soumission du formulaire d'infrastructure
    if (deploymentForm) {
        deploymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                secteur: document.getElementById('deploySector')?.value,
                nom: document.getElementById('deployName')?.value,
                prenom: document.getElementById('deployFirstname')?.value,
                entreprise: document.getElementById('deployCompany')?.value
            };
            console.log('Déploiement de l’Empire OG initié :', payload);
            // Connexion aux routes backend / routage souverain
        });
    }
});
