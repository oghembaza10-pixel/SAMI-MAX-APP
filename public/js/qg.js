// /public/js/qg.js

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // INITIALISATION GÉNÉRALE
    // ==========================================================================

    // 1. Initialisation des icônes Lucide (si non fait dans un partial _head)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ==========================================================================
    // GESTION DE LA SIDEBAR RÉTRACTABLE
    // ==========================================================================
    const sidebar = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            // Stocker l'état dans le localStorage pour la persistance
            if (sidebar.classList.contains('collapsed')) {
                localStorage.setItem('ogSidebarCollapsed', 'true');
            } else {
                localStorage.setItem('ogSidebarCollapsed', 'false');
            }
        });

        // Restaurer l'état de la sidebar au chargement
        if (localStorage.getItem('ogSidebarCollapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
    }

    // ==========================================================================
    // COMPTEURS ANIMÉS (Simulation CountUp)
    // ==========================================================================
    const countUpEls = document.querySelectorAll('.countup');

    if (countUpEls.length > 0) {
        const startCountUp = (el) => {
            const targetStr = el.getAttribute('data-to');
            if (!targetStr) return;
            const target = parseInt(targetStr.replace(/\s/g, '')); // Nettoyer les espaces
            if (isNaN(target)) return;

            let current = 0;
            const duration = 1500; // Durée en ms
            const frameRate = 60; // Images par seconde
            const totalFrames = (duration / 1000) * frameRate;
            const increment = target / totalFrames;

            const updateCount = () => {
                current += increment;
                if (current < target) {
                    // Formatage français (espace comme séparateur de milliers)
                    el.textContent = Math.ceil(current).toLocaleString('fr-FR').replace(/\s/g, '&nbsp;');
                    requestAnimationFrame(updateCount);
                } else {
                    el.textContent = target.toLocaleString('fr-FR').replace(/\s/g, '&nbsp;');
                }
            };
            updateCount();
        };

        // Intersection Observer pour déclencher l'animation quand l'élément est visible
        const observerOptions = { threshold: 0.5 };
        const countObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startCountUp(entry.target);
                    observer.unobserve(entry.target); // N'animer qu'une seule fois
                }
            });
        }, observerOptions);

        countUpEls.forEach(el => countObserver.observe(el));
    }

    // ==========================================================================
    // EFFET TILT/PARALLAX SUBTIL SUR LES CARTES (Premium UX)
    // ==========================================================================
    const cards = document.querySelectorAll('.og-card');

    if (cards.length > 0 && window.matchMedia('(min-width: 768px)').matches) { // Activer seulement sur desktop
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left; // position souris dans carte
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                // Calcul de l'inclinaison (valeurs réduites pour la subtilité)
                const rotateX = (y - centerY) / 30;
                const rotateY = (centerX - x) / 30;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px) scale(1.01)`;
                card.style.boxShadow = `0 15px 40px rgba(0,0,0,0.5), 0 0 15px rgba(240, 198, 81, 0.15)`; // Glow dynamique
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = ''; // Reset transformation
                card.style.boxShadow = ''; // Reset shadow
            });
        });
    }

    // ==========================================================================
    // APPARITION PROGRESSIVE DES CARTES (Stagger effect)
    // ==========================================================================
    const dashboardGrid = document.querySelector('.qg-dashboard');
    if (dashboardGrid) {
        const dashboardCards = dashboardGrid.querySelectorAll('.og-card');
        dashboardCards.forEach((card, index) => {
            card.style.opacity = '0';
            // Assurez-vous d'avoir l'animation 'og-rise' dans votre css/animations.css
            card.style.animation = 'og-rise 0.8s var(--ease-out) forwards';
            card.style.animationDelay = `${index * 0.1}s`; // Délai
