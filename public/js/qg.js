// ==========================================================================
// OG EMPIRE — QG MONDIAL : LOGIQUE JAVASCRIPT (Finalisée)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // 1. INITIALISATION GÉNÉRALE
    // ==========================================================================

    // Initialisation des icônes Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }


    // ==========================================================================
    // 2. COMPTEURS ANIMÉS (Digital Counter)
    // ==========================================================================
    // Cible les éléments avec la classe .countup
    const countUpEls = document.querySelectorAll('.countup');

    if (countUpEls.length > 0) {
        const startCountUp = (el) => {
            const targetStr = el.getAttribute('data-to');
            if (!targetStr) return;
            const target = parseInt(targetStr.replace(/\s/g, '')); // Nettoie les espaces
            if (isNaN(target)) return;

            let current = 0;
            const duration = 1500; // Durée en ms
            const frameRate = 60; // Images par seconde
            const totalFrames = (duration / 1000) * frameRate;
            const increment = target / totalFrames;

            const updateCount = () => {
                current += increment;
                if (current < target) {
                    // Affiche le chiffre entier (pas de décimales), format français (espace milliers)
                    el.textContent = Math.ceil(current).toLocaleString('fr-FR');
                    requestAnimationFrame(updateCount);
                } else {
                    // Affiche le chiffre final exact
                    el.textContent = target.toLocaleString('fr-FR');
                }
            };
            updateCount();
        };

        // Intersection Observer : Lance l'anim quand la carte est visible à l'écran
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
    // 3. ANIMATION GLOBE 3D (Canvas)
    // ==========================================================================
    const globeCanvas = document.getElementById('globeCanvas');

    if (globeCanvas) {
        const ctx = globeCanvas.getContext('2d');
        let time = 0;
        let particles = [];

        // Fonction pour initialiser/redimensionner les particules
        const initParticles = () => {
            const width = globeCanvas.clientWidth;
            const height = globeCanvas.clientHeight;
            globeCanvas.width = width;
            globeCanvas.height = height;

            // Crée des particules aléatoires en 3D
            particles = Array.from({ length: 180 }, () => ({
                x: (Math.random() - 0.5) * width,
                y: (Math.random() - 0.5) * height,
                z: (Math.random() - 0.5) * width,
                size: Math.random() * 1.5 + 0.5,
                // Vitesse de rotation individuelle pour plus de vie
                speed: Math.random() * 0.001 + 0.0005
            }));
        };

        // Boucle d'animation du dessin
        const drawGlobe = () => {
            const width = globeCanvas.width;
            const height = globeCanvas.height;
            const cx = width / 2;
            const cy = height / 2;

            // Efface le canvas
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                // Rotation Y (principale) et X (légère)
                const cosY = Math.cos(time * p.speed);
                const sinY = Math.sin(time * p.speed);
                const cosX = Math.cos(time * (p.speed * 0.5));
                const sinX = Math.sin(time * (p.speed * 0.5));

                // Applique les rotations
                let rx = p.x * cosY - p.z * sinY; // Rotation Y
                let rz = p.x * sinY + p.z * cosY;
                let ry = p.y * cosX - rz * sinX; // Rotation X
                rz = p.y * sinX + rz * cosX;

                // Perspective (Focale)
                const fov = 250;
                const scale = fov / (fov + rz + width/3);
                const px = rx * scale + cx;
                const py = ry * scale + cy;

                // Alpha (opacité) : les points derrière sont plus sombres
                const alpha = scale * 0.6 + 0.2;

                // Dessine le point
                ctx.fillStyle = `rgba(0, 242, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
                ctx.fill();
            });

            time += 1;
            requestAnimationFrame(drawGlobe);
        };

        // Initialisation du canvas
        initParticles();
        drawGlobe();

        // Redimensionnement réactif
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(initParticles, 200);
        });
    }


    // ==========================================================================
    // 4. EFFET TILT/PARALLAX SUBTIL SUR LES CARTES (6 petites cartes)
    // ==========================================================================
    // Cible les cartes avec les classes .tech-card et .small
    const smallCards = document.querySelectorAll('.tech-card.small');

    // N'active l'effet que sur les grands écrans (desktop)
    if (smallCards.length > 0 && window.matchMedia('(min-width: 768px)').matches) {
        smallCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left; // Position X de la souris dans la carte
                const y = e.clientY - rect.top;  // Position Y de la souris dans la carte
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                // Calcule l'inclinaison (valeurs divisées pour un effet subtil)
                const rotateX = (y - centerY) / 25;
                const rotateY = (centerX - x) / 25;

                // Applique la transformation CSS
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px) scale(1.02)`;
                // Ajoute un léger glow dynamique au survol (si le CSS le permet)
                card.style.boxShadow = `0 10px 20px rgba(0,0,0,0.4), var(--og-gold-glow)`;
            });

            // Réinitialise la carte quand la souris quitte
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });
    }

});
