// ==========================================================================
// OG EMPIRE — QG : Moteur front-end
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ======================================================================
    // SIDEBAR : réduire/étendre (PC) ou tiroir (mobile) — toujours ouverte
    // par défaut à chaque chargement, plus de mémorisation qui coince
    // ======================================================================
    const sidebar = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');
    const mobileMenuBtn = document.getElementById('qg-mobile-menu-btn');
    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (isMobile()) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });

        document.addEventListener('click', (e) => {
            if (isMobile() && sidebar.classList.contains('mobile-open')) {
                const clickedToggle = e.target === toggleBtn || toggleBtn.contains(e.target)
                    || e.target === mobileMenuBtn || (mobileMenuBtn && mobileMenuBtn.contains(e.target));
                if (!sidebar.contains(e.target) && !clickedToggle) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }

    if (sidebar && mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // ======================================================================
    // COMPTEURS ANIMÉS
    // ======================================================================
    const countUpEls = document.querySelectorAll('.countup');

    if (countUpEls.length > 0) {
        const startCountUp = (el) => {
            const targetStr = el.getAttribute('data-to');
            if (!targetStr) return;
            const target = parseInt(targetStr.replace(/\s/g, ''));
            if (isNaN(target)) return;

            let current = 0;
            const duration = 1400;
            const frameRate = 60;
            const totalFrames = (duration / 1000) * frameRate;
            const increment = target / totalFrames;

            const updateCount = () => {
                current += increment;
                if (current < target) {
                    el.textContent = Math.ceil(current).toLocaleString('fr-FR');
                    requestAnimationFrame(updateCount);
                } else {
                    el.textContent = target.toLocaleString('fr-FR');
                }
            };
            updateCount();
        };

        const countObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startCountUp(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.4 });

        countUpEls.forEach(el => countObserver.observe(el));
    }

    // ======================================================================
    // EFFET TILT SUR LES CARTES DASHBOARD (desktop)
    // ======================================================================
    const tiltCards = document.querySelectorAll('.qg-card--tilt');

    if (tiltCards.length > 0 && window.matchMedia('(min-width: 900px)').matches) {
        tiltCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 28;
                const rotateY = (centerX - x) / 28;

                card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // ======================================================================
    // APPARITION PROGRESSIVE
    // ======================================================================
    const staggerGroups = document.querySelectorAll('.qg-dashboard, .qg-arsenal');
    staggerGroups.forEach(group => {
        const items = group.children;
        Array.from(items).forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(14px)';
            item.style.transition = `opacity .5s ease ${index * 0.06}s, transform .5s ease ${index * 0.06}s`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                });
            });
        });
    });

    // ======================================================================
    // STATUT SAMII
    // ======================================================================
    const samiiActive = true;
    const samiiDot = document.getElementById('samii-status-dot');
    if (samiiDot) {
        samiiDot.classList.toggle('qg-status-dot--on', samiiActive);
        samiiDot.classList.toggle('qg-status-dot--off', !samiiActive);
        samiiDot.title = samiiActive ? 'SAMII actif' : 'SAMII inactif';
    }

});
