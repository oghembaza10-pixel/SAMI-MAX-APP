/**
 * SAMII OS - QG Universel (Front-End Controller)
 * S'adapte automatiquement au métier : produit (e-commerce/restaurant) ou rendez-vous (dentiste/avocat/...)
 */

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const qgBackLink = document.getElementById('qg-back-link');
    if (window.location.pathname.startsWith('/qg/')) {
        localStorage.setItem('ogLastQG', window.location.pathname);
    }
    if (qgBackLink) qgBackLink.href = localStorage.getItem('ogLastQG') || '/hub';

    const sidebar   = document.getElementById('og-sidebar');
    const toggleBtn = document.getElementById('og-sidebar-collapse');
    const isMobile  = () => window.matchMedia('(max-width: 900px)').matches;
    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!isMobile()) sidebar.classList.toggle('collapsed');
        });
    }

    let canalActif  = null;
    let allData     = null;
    let parcoursActuel = 'produit';

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

    const CARTES_PRODUIT = [
        { id: 'stat-revenus',    label: 'Revenus (DZD)', icon: 'trending-up',  key: 'total_revenus'   },
        { id: 'stat-commandes',  label: 'Commandes',     icon: 'package',      key: 'total_commandes' },
        { id: 'stat-attente',    label: 'En attente',    icon: 'clock',        key: 'en_attente'      },
        { id: 'stat-confirmees', label: 'Confirmées',    icon: 'check-circle', key: 'confirmees'      },
        { id: 'stat-annulees',   label: 'Annulées',      icon: 'x-circle',     key: 'annulees'        },
        { id: 'stat-vip',        label: 'Clients VIP',   icon: 'crown',        key: 'vip'              },
        { id: 'stat-blacklist',  label: 'Blacklist',     icon: 'shield-off',   key: 'blacklist'        },
    ];

    const CARTES_RDV = [
        { id: 'stat-revenus',    label: 'Rendez-vous ce mois', icon: 'calendar',      key: 'total_revenus'   },
        { id: 'stat-commandes',  label: 'Rendez-vous',         icon: 'calendar-days', key: 'total_commandes' },
        { id: 'stat-attente',    label: 'À confirmer',         icon: 'clock',         key: 'en_attente'      },
        { id: 'stat-confirmees', label: 'Confirmés',           icon: 'check-circle',  key: 'confirmees'      },
        { id: 'stat-annulees',   label: 'Annulés',             icon: 'x-circle',      key: 'annulees'        },
        { id: 'stat-vip',        label: 'Clients fidèles',     icon: 'crown',         key: 'vip'              },
        { id: 'stat-blacklist',  label: 'Indésirables',        icon: 'shield-off',    key: 'blacklist'        },
    ];

    const MODULES = {
        '': { label: 'Tout', cartes: CARTES_PRODUIT },
        shopify: {
            label : 'Shopify',
            cartes: [
                { id: 'stat-revenus',    label: 'CA Shopify (DZD)', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Shopify',  icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Abandons panier',  icon: 'shopping-cart',  key: 'blacklist'        },
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
                { id: 'stat-revenus',    label: 'Revenus WhatsApp', icon: 'trending-up',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'En attente',       icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Confirmées',       icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients WhatsApp', icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Diffusions',       icon: 'radio',          key: 'blacklist'        },
            ],
        },
        instagram: {
            label : 'Instagram',
            cartes: [
                { id: 'stat-revenus',    label: 'Revenus Instagram', icon: 'trending-up',   key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes',        icon: 'package',        key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Messages',         icon: 'message-circle', key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Leads',            icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Annulées',         icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Clients Instagram',icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist',        icon: 'shield-off',     key: 'blacklist'        },
            ],
        },
        tiktok: {
            label : 'TikTok',
            cartes: [
                { id: 'stat-revenus',    label: 'Vues / Portée',    icon: 'eye',            key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Conversions',      icon: 'zap',            key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Vidéos Actives',   icon: 'video',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Leads TikTok',     icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Signalements',     icon: 'x-circle',       key: 'annulees'         },
                { id: 'stat-vip',        label: 'Abonnés VIP',      icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Engagement',       icon: 'trending-up',    key: 'blacklist'        },
            ],
        },
        youtube: {
            label : 'YouTube',
            cartes: [
                { id: 'stat-revenus',    label: 'Vues Totales',     icon: 'play-circle',    key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Clics Tunnel',     icon: 'external-link',  key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Impressions',      icon: 'bar-chart-2',    key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Abonnés Gagnés',   icon: 'user-plus',      key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Désabonnements',   icon: 'user-minus',     key: 'annulees'         },
                { id: 'stat-vip',        label: 'Membres Actifs',   icon: 'crown',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Rétention',        icon: 'activity',       key: 'blacklist'        },
            ],
        },
        google: {
            label : 'Google / SEO',
            cartes: [
                { id: 'stat-revenus',    label: 'Trafic Organique', icon: 'search',         key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Conversions SEO',  icon: 'globe',          key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Indexation',       icon: 'check-square',   key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Position Top 3',   icon: 'award',          key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Erreurs Crawl',    icon: 'alert-triangle', key: 'annulees'         },
                { id: 'stat-vip',        label: 'Leads Web',        icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Performance Ads',  icon: 'target',         key: 'blacklist'        },
            ],
        },
        gmail: {
            label : 'Gmail',
            cartes: [
                { id: 'stat-revenus',    label: 'Emails Envoyés',   icon: 'send',           key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Commandes Mail',   icon: 'mail',           key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Non lus',          icon: 'clock',          key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Traités par IA',   icon: 'bot',            key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Spams / Rejets',   icon: 'slash',          key: 'annulees'         },
                { id: 'stat-vip',        label: 'Contacts Pro',     icon: 'users',          key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Blacklist Mails',  icon: 'shield-off',     key: 'blacklist'        },
            ],
        },
        discord: {
            label : 'Discord',
            cartes: [
                { id: 'stat-revenus',    label: 'Membres QG',       icon: 'users',          key: 'total_revenus'    },
                { id: 'stat-commandes',  label: 'Notifications',    icon: 'bell',           key: 'total_commandes'  },
                { id: 'stat-attente',    label: 'Tickets Support',  icon: 'life-buoy',      key: 'en_attente'       },
                { id: 'stat-confirmees', label: 'Vérifiés',         icon: 'check-circle',   key: 'confirmees'       },
                { id: 'stat-annulees',   label: 'Bannis',           icon: 'user-x',         key: 'annulees'         },
                { id: 'stat-vip',        label: 'Rôles VIP',        icon: 'shield',         key: 'vip'              },
                { id: 'stat-blacklist',  label: 'Bots Actifs',      icon: 'cpu',            key: 'blacklist'        },
            ],
        },
    };

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

    function flashCartes() {
        document.querySelectorAll('.qg-card').forEach(card => {
            card.classList.add('qg-card--flash');
            setTimeout(() => card.classList.remove('qg-card--flash'), 600);
        });
    }

    function updateCarteLabels(canal) {
        let module = MODULES[canal] || MODULES[''];
        if (!canal && parcoursActuel === 'rdv') {
            module = { label: 'Tout', cartes: CARTES_RDV };
        }
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

    function calcStats(commandes, clients) {
        const total_commandes = commandes.length;
        const total_revenus   = commandes.reduce((s, c) => s + getMontant(c), 0);
        const en_attente      = commandes.filter(c => c.Statut === 'en attente' || c.Statut === 'en_attente').length;
        const confirmees      = commandes.filter(c => c.Statut === 'confirmée' || c.Statut === 'confirmé').length;
        const annulees        = commandes.filter(c => c.Statut === 'annulée' || c.Statut === 'annulé').length;
        const vip             = clients.filter(c => c.VIP     === true).length;
        const blacklist       = clients.filter(c => c.Blacklist === true).length;
        return { total_commandes, total_revenus: total_revenus.toFixed(2),
                 en_attente, confirmees, annulees, vip, blacklist };
    }

    function getMontant(c) {
        return parseFloat(c.montant || c.Total || 0) || 0;
    }

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

        setCard('stat-revenus',    parcoursActuel === 'rdv' ? stats.total_commandes : stats.total_revenus);
        setCard('stat-commandes',  stats.total_commandes);
        setCard('stat-attente',    stats.en_attente);
        setCard('stat-confirmees', stats.confirmees);
        setCard('stat-annulees',   stats.annulees);
        setCard('stat-vip',        stats.vip);
        setCard('stat-blacklist',  stats.blacklist);

        renderCommandes(commandes);

        const titreEl = document.getElementById('qg-boutique-nom');
        if (titreEl) {
            titreEl.textContent = canal
                ? `${allData.workspace?.nom || ''} · ${canal.toUpperCase()}`
                : (allData.workspace?.nom || '');
        }
    }

    async function loadModules() {
        try {
            const res  = await fetch('/api/connecteurs');
            const data = await res.json();
            const el   = document.getElementById('qg-modules');
            if (!el || !data.connecteurs) return;

            const icones = {
                shopify   : '🛍',
                telegram  : '💬',
                whatsapp  : '📱',
                instagram : '📸',
                gmail     : '📧',
                yalidine  : '📦',
                tiktok    : '🎵',
                youtube   : '▶️',
                google    : '🔍',
                discord   : '🎮',
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

    async function loadQGData() {
        try {
            const shop = document.body.getAttribute('data-shop') || '';
            const res  = await fetch(`/api/qg-data?shop=${encodeURIComponent(shop)}`);
            const data = await res.json();
            if (!data.success) return;

            allData = data;
            parcoursActuel = data.parcours || 'produit';

            setCard('stat-livrees',    data.livraison.livrees);
            setCard('stat-en-cours', data.livraison.en_cours);
            setCard('stat-echecs',    data.livraison.echecs);

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

    function renderCommandes(commandes) {
        const tbody = document.getElementById('commandes-tbody');
        if (!tbody) return;
        if (!commandes || commandes.length === 0) {
            const texteVide = parcoursActuel === 'rdv' ? 'Aucun rendez-vous pour le moment' : 'Aucune commande pour le moment';
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">${texteVide}</td></tr>`;
            return;
        }

        if (parcoursActuel === 'rdv') {
            tbody.innerHTML = commandes.slice(0, 20).map(c => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px;">#${String(c['ID Commande'] || '').toString().slice(-4) || '—'}</td>
                    <td style="padding: 12px; font-weight: 500; color: #fff;">${c['Nom Client'] || '—'}</td>
                    <td style="padding: 12px;">${c['Téléphone'] || '—'}</td>
                    <td style="padding: 12px;">${c['Produit'] || '—'}</td>
                    <td style="padding: 12px; color: #d4af37; font-weight: 600;">${c['DateRdv'] || '—'}</td>
                    <td style="padding: 12px;"><span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || 'en_attente'}</span></td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick="agirCommande('${c.airtableId}', 'confirmer')" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; padding: 5px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;" title="Confirmer">✅</button>
                        <button onclick="agirCommande('${c.airtableId}', 'annuler')" style="background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 10px; border-radius: 6px; cursor: pointer;" title="Annuler">❌</button>
                    </td>
                </tr>
            `).join('');
            return;
        }

        tbody.innerHTML = commandes.slice(0, 20).map(c => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px;">#${c['ID Commande'] || c.airtableId?.slice(-4) || '—'}</td>
                <td style="padding: 12px; font-weight: 500; color: #fff;">${c['Nom Client'] || c['Nom'] || '—'}</td>
                <td style="padding: 12px;">${c['Téléphone'] || '—'}</td>
                <td style="padding: 12px;">${c['Produit'] || '—'}</td>
                <td style="padding: 12px; color: #d4af37; font-weight: 600;">${parseFloat(c['montant'] || c['Total'] || 0).toFixed(2)} ${c['Devise'] || 'DZD'}</td>
                <td style="padding: 12px;"><span class="qg-badge qg-badge--${statutClass(c['Statut'])}">${c['Statut'] || 'en attente'}</span></td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="agirCommande('${c.airtableId}', 'confirmer')" style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; border: 1px solid #2ecc71; padding: 5px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px;" title="Confirmer">✅</button>
                    <button onclick="agirCommande('${c.airtableId}', 'annuler')" style="background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 10px; border-radius: 6px; cursor: pointer;" title="Annuler">❌</button>
                </td>
            </tr>
        `).join('');
    }

    window.agirCommande = async function(id, action) {
        try {
            const res = await fetch(`/api/commandes/${id}/${action}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                loadQGData();
            } else {
                alert("Erreur lors de l'action.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    function statutClass(statut) {
        const map = {
            'confirmée' : 'green',
            'confirmé'  : 'green',
            'en attente': 'yellow',
            'en_attente': 'yellow',
            'annulée'   : 'red',
            'annulé'    : 'red',
            'expédiée'  : 'blue',
            'livrée'    : 'green',
            'en cours'  : 'blue',
            'échoué'    : 'red',
        };
        return map[statut] || 'grey';
    }

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

    loadModules();
    loadQGData();

});
