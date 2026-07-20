/**
 * ============================================================================
 * THE SOVEREIGN — HUB LOGIC & SAMII MODAL CONTROLLER
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // INITIALISATION DES ICONES LUCIDE
    // =========================================================================
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // =========================================================================
    // RÉCÉPITION DES DONNÉES GLOBALES DU SERVEUR
    // =========================================================================
    const workspaces = window.OG_WORKSPACES || [];
    const currentWorkspaceId = window.OG_WORKSPACE_ID || '';
    const hasWorkspace = window.OG_HAS_WORKSPACE || false;
    const lastWorkspaceId = window.OG_LAST_WORKSPACE || '';

    // =========================================================================
    // GESTION DE LA MODALE DU HUB (OUVERTURE / FERMETURE)
    // =========================================================================
    const hubModal = document.getElementById('hubModal');
    const hubSearchButton = document.getElementById('hubSearchButton');
    const closeHubModal = document.getElementById('closeHubModal');

    function openModal() {
        if (hubModal) {
            hubModal.classList.add('active');
            showStep('hubStepHome');
        }
    }

    function closeModal() {
        if (hubModal) {
            hubModal.classList.remove('active');
        }
    }

    if (hubSearchButton) {
        hubSearchButton.addEventListener('click', openModal);
    }

    if (closeHubModal) {
        closeHubModal.addEventListener('click', closeModal);
    }

    if (hubModal) {
        const backdrop = hubModal.querySelector('.hub-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
    }

    // =========================================================================
    // NAVIGATION ENTRE LES ÉTAPES DE LA MODALE
    // =========================================================================
    function showStep(stepId) {
        const steps = hubModal.querySelectorAll('.hub-step');
        steps.forEach(step => {
            step.classList.remove('active');
        });

        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.add('active');
        }
    }

    // Boutons d'action principaux dans l'étape d'accueil
    const btnCreateQG = document.getElementById('createQG');
    const btnInviteCollab = document.getElementById('inviteCollaborator');
    const btnSearchWorkspace = document.getElementById('searchWorkspace');

    if (btnCreateQG) {
        btnCreateQG.addEventListener('click', () => {
            showStep('hubStepCreate');
        });
    }

    if (btnInviteCollab) {
        btnInviteCollab.addEventListener('click', () => {
            showStep('hubStepCollaborator');
        });
    }

    if (btnSearchWorkspace) {
        btnSearchWorkspace.addEventListener('click', () => {
            showStep('hubStepWorkspace');
        });
    }

    // =========================================================================
    // GESTION DU DERNIER QG UTILISÉ
    // =========================================================================
    const lastWorkspaceButton = document.querySelector('.last-workspace-button');
    if (lastWorkspaceButton) {
        lastWorkspaceButton.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-workspace');
            if (targetId) {
                window.location.href = `/workspace/${targetId}`;
            }
        });
    }

    // =========================================================================
    // SÉLECTION DES CARTES MÉTIERS (GRILLE)
    // =========================================================================
    const metierCards = document.querySelectorAll('.metier-card');
    metierCards.forEach(card => {
        card.addEventListener('click', () => {
            const metierName = card.getAttribute('data-metier');
            openModal();
            showStep('hubStepCreate');
            
            const metierInput = document.getElementById('workspaceMetier');
            if (metierInput && metierName) {
                metierInput.value = metierName;
            }
        });
    });

    // =========================================================================
    // SOUMISSION DU FORMULAIRE DE CRÉATION DE QG AVEC SAMII
    // =========================================================================
    const createWorkspaceForm = document.getElementById('createWorkspaceForm');
    if (createWorkspaceForm) {
        createWorkspaceForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const metier = document.getElementById('workspaceMetier')?.value || '';
            const nom = document.getElementById('workspaceNom')?.value || '';
            const prenom = document.getElementById('workspacePrenom')?.value || '';
            const entreprise = document.getElementById('workspaceEntreprise')?.value || '';

            // Simulation ou appel de transition vers l'étape de conseils SAMII
            showStep('hubStepAdvice');

            const samiiAdviceContainer = document.getElementById('samiiAdvice');
            if (samiiAdviceContainer) {
                samiiAdviceContainer.innerHTML = `
                    <div style="padding: 15px 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                        <p style="color: #f4f4f5; margin-bottom: 8px;"><strong>Analysé par SAMII :</strong></p>
                        <p>Votre structure pour <strong>${entreprise || 'votre entité'}</strong> axée sur le métier de <strong>${metier || 'général'}</strong> a été configurée avec succès.</p>
                    </div>
                `;
            }
        });
    }

});
