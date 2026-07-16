// ==========================================================================
// OG EMPIRE — QG : Moteur front-end V2 (données réelles + Socket.IO)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ======================================================================
    // MÉMORISER LE DERNIER QG
    // ======================================================================
    if (window.location.pathname.startsWith('/qg/')) {
        localStorage.setItem('ogLastQG', window.location.pathname);
    }
    const qgBackLink = document.getElementById('qg-back-link');
    if (qgBackLink) qgBackLink.href = localStorage.getItem('ogLastQG') || '/hub';

    // ======================================================================
    // SIDEBAR COLLAPSE
    // ======================================================================
    const sidebar  = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');
    const isMobile  = () => window.matchMedia('(max-width: 900px)').matches;

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!isMobile()) sidebar.classList.toggle('collapsed');
        });
    }

    // ======================================================================
    // COMPTEUR ANIMÉ
    // ======================================================================
    function startCountUp(el, target) {
        let current     = 0;
        const duration  = 1400;
        const frames    = (duration / 1000) * 60;
        const increment = target / frames;

        const update = () => {
            current += increment;
            if (current < target) {
                el.textContent = Math.ceil(current).toLocaleString('fr-FR');
                requestAnimationFrame(update);
            } else {
                el.textContent = target.toLocaleString('fr-FR');
            }
        };
        update();
    }

    function animateCountUp(el) {
        const targetStr = el.getAttribute('data-to');
        if (!targetStr) return;
        const target = parseInt(targetStr.replace(/\s/g, ''));
        if (!isNaN(target)) startCountUp(el, target);
    }

    const countObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCountUp(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('.countup').forEach(el => countObserver.observe(el));

    // ======================================================================
    // TILT CARTES
    // ======================================================================
    if (window.matchMedia('(min-width: 900px)').matches) {
        document.querySelectorAll('.qg-card--tilt').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect    = card.getBoundingClientRect();
                const rotateX = (e.clientY - rect.top  - rect.height / 2) / 28;
                const rotateY = (rect.width / 2 - (e.clientX - rect.left)) / 28;
                card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
            });
            card.addEventListener('mouseleave', () => card.style.transform = '');
        });
    }

    // ======================================================================
    // APPARITION PROGRESSIVE
    // ======================================================================
    document.querySelectorAll('.qg-dashboard, .qg-arsenal').forEach(group => {
        Array.from(group.children).forEach((item, i) => {
            item.style.opacity   = '0';
            item.style.transform = 'translateY(14px)';
            item.style.transition = `opacity .5s ease ${i * 0.06}s, transform .5s ease ${i * 0.06}s`;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                item.style.opacity   = '1';
                item.style.transform = 'translateY(0)';
            }));
        });
    });

    // ======================================================================
    // STATUT SAMII
    // ======================================================================
    const samiiDot = document.getElementById('samii-status-dot');
    if (samiiDot) {
        samiiDot.classList.add('qg-status-dot--on');
        samiiDot.title = 'SAMII actif';
    }

    // ======================================================================
    // DONNÉES RÉELLES — /api/qg-data
    // ======================================================================
    async function loadQGData() {
        try {
            const res  = await fetch('/api/qg-data');
            const data = await res.json();
            if (!data.success) return;

            // Stats cartes
            setCard('stat-revenus',   data.stats.total_revenus);
            setCard('stat-commandes', data.stats.total_commandes);
            setCard('stat-attente',   data.stats.en_attente);
            setCard('stat-confirmees',data.stats.confirmees);
            setCard('stat-annulees',  data.stats.annulees);

            // Nom boutique
            const nomEl = document.getElementById('qg-boutique-nom');
            if (nomEl) nomEl.textContent = data.boutique.nom;

            // Tableau commandes
            renderCommandes(data.commandes);

        } catch (err) {
            console.error('❌ QG data :', err.message);
        }
    }

    function setCard(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('data-to', value);
        startCountUp(el, parseFloat(value) || 0);
    }

    // ======================================================================
    // TABLEAU COMMANDES
    // ======================================================================
    function renderCommandes(commandes) {
        const tbody = document.getElementById('commandes-tbody');
        if (!tbody) return;

        if (!commandes || commandes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Aucune commande pour l'instant</td></tr>`;
            return;
        }

        tbody.innerHTML = commandes.map(c => `
            <tr>
                <td>#${c['ID Commande'] || '—'}</td>
                <td>${c['Nom Client']   || '—'}</td>
                <td>${c['Produit']      || '—'}</td>
                <td>${c['Total']        || '0'} ${c['Devise'] || 'DZD'}</td>
                <td><span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || '—'}</span></td>
            </tr>
        `).join('');
    }

    function statutClass(statut) {
        const map = {
            'confirmée' : 'green',
            'en attente': 'yellow',
            'annulée'   : 'red',
            'expédiée'  : 'blue',
            'livrée'    : 'green',
        };
        return map[statut] || 'grey';
    }

    // ======================================================================
    // SOCKET.IO — TEMPS RÉEL
    // ======================================================================
    if (typeof io !== 'undefined') {
        const socket = io();

        socket.on('connect', () => {
            console.log('🔌 Socket.IO connecté');
            // Rejoindre la room de la boutique
            const shop = document.body.getAttribute('data-shop');
            if (shop) socket.emit('join', shop);
        });

        // Nouvelle commande → mise à jour live
        socket.on('nouvelle-commande', (commande) => {
            console.log('🛒 Nouvelle commande reçue :', commande);
            afficherNotification(`🛒 Nouvelle commande #${commande.order_number || ''} — ${commande.total_price || ''} DZD`);
            loadQGData(); // Recharge les stats
        });

        // Commande confirmée
        socket.on('commande-confirmee', (data) => {
            afficherNotification(`✅ Commande #${data.id} confirmée par le client`);
            loadQGData();
        });

        // Commande annulée
        socket.on('commande-annulee', (data) => {
            afficherNotification(`❌ Commande #${data.id} annulée`);
            loadQGData();
        });
    }

    // ======================================================================
    // NOTIFICATION TOAST
    // ======================================================================
    function afficherNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'qg-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('qg-toast--visible'));

        setTimeout(() => {
            toast.classList.remove('qg-toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // ======================================================================
    // LANCEMENT
    // ======================================================================
    loadQGData();

});
