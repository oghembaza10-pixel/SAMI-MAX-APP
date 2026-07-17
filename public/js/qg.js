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
    const sidebar   = document.getElementById('og-sidebar');
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
            item.style.opacity    = '0';
            item.style.transform  = 'translateY(14px)';
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
    // DONNÉES RÉELLES — /api/qg-data?shop=...
    // ======================================================================
    async function loadQGData() {
        try {
            // ── Récupère le shop depuis le body ──
            const shop = document.body.getAttribute('data-shop') || '';
            const res  = await fetch(`/api/qg-data?shop=${encodeURIComponent(shop)}`);
            const data = await res.json();
            if (!data.success) return;

            // ── Stats globales ──
            setCard('stat-revenus',    data.stats.total_revenus);
            setCard('stat-commandes',  data.stats.total_commandes);
            setCard('stat-attente',    data.stats.en_attente);
            setCard('stat-confirmees', data.stats.confirmees);
            setCard('stat-annulees',   data.stats.annulees);
            setCard('stat-vip',        data.stats.vip);
            setCard('stat-blacklist',  data.stats.blacklist);

            // ── Nom boutique ──
            const nomEl = document.getElementById('qg-boutique-nom');
            if (nomEl && data.boutique?.nom) nomEl.textContent = data.boutique.nom;

            // ── Livraison temps réel ──
            setCard('stat-livrees',  data.livraison.livrees);
            setCard('stat-en-cours', data.livraison.en_cours);
            setCard('stat-echecs',   data.livraison.echecs);

            // ── Mission du jour ──
            const missionDate = document.getElementById('mission-date');
            if (missionDate) missionDate.textContent = data.mission.date;

            setCard('mission-commandes', data.mission.commandes);
            setCard('mission-revenus',   data.mission.revenus);

            const objectif = 10;
            const pct      = Math.min(Math.round((data.mission.commandes / objectif) * 100), 100);
            const pctEl    = document.getElementById('mission-pct');
            const barEl    = document.getElementById('mission-bar');
            if (pctEl) pctEl.textContent = pct + '%';
            if (barEl) barEl.style.width = pct + '%';

            // ── Performance du mois ──
            setCard('perf-revenus-mois',   data.performance.revenus_mois);
            setCard('perf-commandes-mois', data.performance.commandes_mois);
            const evolEl = document.getElementById('perf-evolution');
            if (evolEl) evolEl.textContent = data.performance.evolution;

            // ── Tableau commandes ──
            renderCommandes(data.commandes);

            // ── VIP & Blacklist ──
            renderClients('vip-list',   data.clients.filter(c => c.VIP      === true));
            renderClients('black-list', data.clients.filter(c => c.Blacklist === true));

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

    function renderCommandes(commandes) {
        const tbody = document.getElementById('commandes-tbody');
        if (!tbody) return;

        if (!commandes || commandes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Aucune commande pour l'instant</td></tr>`;
            return;
        }

        tbody.innerHTML = commandes.slice(0, 20).map(c => `
            <tr>
                <td>#${c['ID Commande'] || '—'}</td>
                <td>${c['Nom Client']   || '—'}</td>
                <td>${c['Téléphone']    || '—'}</td>
                <td>${c['Produit']      || '—'}</td>
                <td>${parseFloat(c['montant'] || c['Total'] || 0).toFixed(2)} ${c['Devise'] || 'DZD'}</td>
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
            'en cours'  : 'blue',
            'échoué'    : 'red',
        };
        return map[statut] || 'grey';
    }

    // ======================================================================
    // VIP & BLACKLIST
    // ======================================================================
    function renderClients(containerId, clients) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!clients || clients.length === 0) {
            el.innerHTML = `<p style="color:#888;font-size:.85rem;">Aucun client</p>`;
            return;
        }

        el.innerHTML = clients.map(c => `
            <div class="qg-client-card">
                <div class="qg-client-card__name">${c['Nom'] || c['Nom Client'] || '—'}</div>
                <div class="qg-client-card__phone">${c['Téléphone'] || '—'}</div>
                <div class="qg-client-card__total">${parseFloat(c['Total Dépensé'] || 0).toFixed(0)} DZD</div>
            </div>
        `).join('');
    }

    // ======================================================================
    // SOCKET.IO — TEMPS RÉEL
    // ======================================================================
    if (typeof io !== 'undefined') {
        const socket = io();

        socket.on('connect', () => {
            console.log('🔌 Socket.IO connecté');
            const shop = document.body.getAttribute('data-shop');
            if (shop) socket.emit('join', shop);
        });

        socket.on('nouvelle-commande', (commande) => {
            console.log('🛒 Nouvelle commande :', commande);
            afficherNotification(`🛒 Nouvelle commande #${commande.order_number || ''} — ${commande.total_price || ''} DZD`);
            loadQGData();
        });

        socket.on('commande-confirmee', (data) => {
            afficherNotification(`✅ Commande #${data.id} confirmée`);
            loadQGData();
        });

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
