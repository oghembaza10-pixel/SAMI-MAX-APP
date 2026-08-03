/**
 * SAMII OS - QG Marchand (Front-End Controller)
 * Exécution chirurgicale - Zéro usine à gaz.
 */

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ── MÉMORISER LE DERNIER QG ──────────────────
    if (window.location.pathname.startsWith('/qg/')) {
        localStorage.setItem('ogLastQG', window.location.pathname);
    }
    const qgBackLink = document.getElementById('qg-back-link');
    if (qgBackLink) qgBackLink.href = localStorage.getItem('ogLastQG') || '/hub';

    // ── SIDEBAR COLLAPSE ─────────────────────────
    const sidebar   = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');
    const isMobile  = () => window.matchMedia('(max-width: 900px)').matches;
    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!isMobile()) sidebar.classList.toggle('collapsed');
        });
    }

    // ── ÉTAT GLOBAL ──────────────────────────────
    let canalActif  = null;
    let allData     = null;

    // ── GRADES ───────────────────────────────────
    const GRADES = [
        { nom: 'SOLDAT',     icon: '🪖',  seuil: 0   },
        { nom: 'CAPORAL',    icon: '🎖️',  seuil: 10  },
        { nom: 'SERGENT',    icon: '⭐',   seuil: 25  },
        { nom: 'LIEUTENANT', icon: '🌟',   seuil: 50  },
        { nom: 'CAPITAINE',  icon: '🏅',   seuil: 100 },
        { nom: 'GÉNÉRAL',    icon: '🎗️',  seuil: 200 },
    ];

    function afficherGrade(totalCommandes) {
        let actuel  = GRADES[0];
        let suivant = GRADES[1];
        for (let i = 0; i < GRADES.length; i++) {
            if (totalCommandes >= GRADES[i].seuil) {
                actuel  = GRADES[i];
                suivant = GRADES[i + 1] || null;
            }
        }
        const iconEl = document.getElementById('grade-icon');
        const nomEl  = document.getElementById('grade-nom');
        const fillEl = document.getElementById('grade-fill');
        const nextEl = document.getElementById('grade-next');
        if (iconEl) iconEl.textContent = actuel.icon;
        if (nomEl)  nomEl.textContent  = actuel.nom;
        if (suivant) {
            const pct = Math.min(Math.round(
                ((totalCommandes - actuel.seuil) /
                (suivant.seuil - actuel.seuil)) * 100), 100);
            if (fillEl) fillEl.style.width = pct + '%';
            if (nextEl) nextEl.textContent = `→ ${suivant.nom}`;
        } else {
            if (fillEl) fillEl.style.width = '100%';
            if (nextEl) nextEl.textContent = '👑 MAX';
        }
    }

    // ── DÉFINITION DES MODULES ───────────────────
    const MODULES = {
        '': {
            label : 'Tout',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus (DZD)',    icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',       key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',         key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',  key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',      key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients VIP',      icon: 'crown',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist',        icon: 'shield-off',    key: 'blacklist'        },
            ],
        },
        shopify: {
            label : 'Shopify',
            cartes: [
                { id: 'stat-revenus',    label: 'CA Shopify (DZD)', icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',       key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',         key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',  key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',      key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Shopify',  icon: 'users',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Abandons panier',  icon: 'shopping-cart', key: 'blacklist'        },
            ],
        },
        telegram: {
            label : 'Telegram',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus Telegram', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Telegram', icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Réponses IA',      icon: 'bot',            key: 'blacklist'        },
            ],
        },
        whatsapp: {
            label : 'WhatsApp',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus WhatsApp', icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',       key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',         key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',  key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',      key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients WhatsApp', icon: 'users',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Diffusions',       icon: 'radio',         key: 'blacklist'        },
            ],
        },
        instagram: {
            label : 'Instagram',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus Instagram', icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',         icon: 'package',       key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Messages',          icon: 'message-circle',key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Leads',             icon: 'user-plus',     key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',          icon: 'x-circle',      key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Instagram', icon: 'users',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist',         icon: 'shield-off',    key: 'blacklist'        },
            ],
        },
    };

    // ── COMPTEUR ANIMÉ ───────────────────────────
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

    function setCard(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute('data-to', value);
        startCountUp(el, parseFloat(value) || 0);
    }

    // ── FLASH EFFET SUR CARTES ───────────────────
    function flashCartes() {
        document.querySelectorAll('.qg-card').forEach(card => {
            card.classList.add('qg-card--flash');
            setTimeout(() => card.classList.remove('qg-card--flash'), 600);
        });
    }

    // ── MISE À JOUR LABELS CARTES ────────────────
    function updateCarteLabels(canal) {
        const module = MODULES[canal] || MODULES[''];
        module.cartes.forEach(carte => {
            const card  = document.getElementById(carte.id)?.closest('.qg-card');
            if (!card) return;
            const label = card.querySelector('.qg-card__label');
            const icon  = card.querySelector('.qg-card__icon i');
            if (label) label.textContent = carte.label;
            if (icon)  icon.setAttribute('data-lucide', carte.icon);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── CALCUL STATS PAR MODULE ──────────────────
    function calcStats(commandes, clients) {
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((s, c) => s + getMontant(c), 0);
        const en_attente      = commandes.filter(c => c.Statut === 'en attente').length;
        const confirmees      = commandes.filter(c => c.Statut === 'confirmée').length;
        const annulees        = commandes.filter(c => c.Statut === 'annulée').length;
        const vip             = clients.filter(c => c.VIP      === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;
        return { total_commandes, total_revenus: total_revenus.toFixed(2),
                 en_attente, confirmees, annulees, vip, blacklist };
    }

    function getMontant(c) {
        return parseFloat(c.montant || c.Total || 0) || 0;
    }

    // ── APPLIQUER MODULE ─────────────────────────
    function appliquerModule(canal) {
        if (!allData) return;

        const commandes = canal
            ? allData.commandes.filter(c =>
                (c.Source || c.source || '').toLowerCase() === canal)
            : allData.commandes;

        const clients = canal
            ? allData.clients.filter(c =>
                (c.Source || c.source || '').toLowerCase() === canal)
            : allData.clients;

        const stats = calcStats(commandes, clients);

        updateCarteLabels(canal);
        flashCartes();

        setCard('stat-revenus',    stats.total_revenus);
        setCard('stat-commandes',  stats.total_commandes);
        setCard('stat-attente',    stats.en_attente);
        setCard('stat-confirmees', stats.confirmees);
        setCard('stat-annulees',   stats.annulees);
        setCard('stat-vip',        stats.vip);
        setCard('stat-blacklist',  stats.blacklist);

        renderCommandes(commandes);

        renderClients('vip-list',   clients.filter(c => c.VIP      === true));
        renderClients('black-list', clients.filter(c => c.Blacklist === true));

        const titreEl = document.getElementById('qg-boutique-nom');
        if (titreEl) {
            titreEl.textContent = canal
                ? `${allData.workspace?.nom || ''} · ${canal.toUpperCase()}`
                : (allData.workspace?.nom || '');
        }
    }

    // ── CHARGER MODULES SIDEBAR ──────────────────
    async function loadModules() {
        try {
            const res  = await fetch('/api/connecteurs');
            const data = await res.json();
            const el   = document.getElementById('qg-modules');
            if (!el || !data.connecteurs) return;

            const icones = {
                shopify  : '🛍',
                telegram : '💬',
                whatsapp : '📱',
                instagram: '📸',
                gmail    : '📧',
                yalidine : '📦',
                tiktok   : '🎵',
            };

            const actifs = Object.entries(data.connecteurs)
                .filter(([, v]) => v.actif);

            el.innerHTML = `
                <button class="qg-module-btn active" data-canal="">📊 Tout</button>
                ${actifs.map(([type]) => `
                    <button class="qg-module-btn" data-canal="${type}">
                        ${icones[type] || '🔌'} ${type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                `).join('')}
            `;

            el.querySelectorAll('.qg-module-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    el.querySelectorAll('.qg-module-btn')
                      .forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    canalActif = btn.dataset.canal || null;
                    appliquerModule(canalActif || '');
                });
            });

        } catch (err) {
            console.error('❌ Modules :', err.message);
        }
    }

    // ── CHARGER DONNÉES QG ───────────────────────
    async function loadQGData() {
        try {
            const shop = document.body.getAttribute('data-shop') || '';
            const res  = await fetch(`/api/qg-data?shop=${encodeURIComponent(shop)}`);
            const data = await res.json();
            if (!data.success) return;

            allData = data;

            setCard('stat-livrees',   data.livraison.livrees);
            setCard('stat-en-cours', data.livraison.en_cours);
            setCard('stat-echecs',   data.livraison.echecs);

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

            setCard('perf-revenus-mois',   data.performance.revenus_mois);
            setCard('perf-commandes-mois', data.performance.commandes_mois);
            const evolEl = document.getElementById('perf-evolution');
            if (evolEl) evolEl.textContent = data.performance.evolution;

            afficherGrade(data.stats.total_commandes);
            appliquerModule(canalActif || '');

        } catch (err) {
            console.error('❌ QG data :', err.message);
        }
    }

    // ── RENDER COMMANDES ─────────────────────────
    function renderCommandes(commandes) {
        const tbody = document.getElementById('commandes-tbody');
        if (!tbody) return;
        if (!commandes || commandes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Aucune commande</td></tr>`;
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

    // ── RENDER CLIENTS ───────────────────────────
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

    // ── TILT CARTES ──────────────────────────────
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

    // ── SOCKET.IO ────────────────────────────────
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('connect', () => {
            const shop = document.body.getAttribute('data-shop');
            if (shop) socket.emit('join', shop);
        });
        socket.on('nouvelle-commande', () => {
            afficherNotification('🛒 Nouvelle commande reçue');
            loadQGData();
        });
        socket.on('commande-confirmee', (d) => {
            afficherNotification(`✅ Commande #${d.id} confirmée`);
            loadQGData();
        });
        socket.on('commande-annulee', (d) => {
            afficherNotification(`❌ Commande #${d.id} annulée`);
            loadQGData();
        });
    }

    // ── TOAST ────────────────────────────────────
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

    // ── LANCEMENT ────────────────────────────────
    loadModules();
    loadQGData();

});
