/**
 * OG • Sovereign Engine
 * Les 33 Tables Souveraines — Cerveau vivant de SAMII
 */

const axios = require("axios");

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const headers = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
};

// ── LES 33 TABLES SOUVERAINES ────────────────────────────────
const TABLES_SOUVERAINES = [
    { id: 1,  nom: "L_AME",               titre: "L'Âme (Origine)",                        role: "identite"    },
    { id: 2,  nom: "SOCLE_VIE_ETHIQUE",   titre: "Socle de Vie Éthique",                   role: "fondation"   },
    { id: 3,  nom: "PERCEPTIONS",         titre: "Perceptions",                             role: "analyse"     },
    { id: 4,  nom: "INTELLIGENCE",        titre: "Intelligence (Savoir)",                   role: "donnees"     },
    { id: 5,  nom: "LANGAGE",             titre: "Langage (Pensée)",                        role: "communication"},
    { id: 6,  nom: "LOIS_MEMOIRE",        titre: "Lois Mémoire (Expérience)",               role: "memoire"     },
    { id: 7,  nom: "SOUVERAIN",           titre: "Souverain (En couleur)",                  role: "regles"      },
    { id: 8,  nom: "VOLONTE_ACTION",      titre: "Volonté et Action",                       role: "execution"   },
    { id: 9,  nom: "VIGILANCE",           titre: "Vigilance",                               role: "alertes"     },
    { id: 10, nom: "LE_VERROUILLE",       titre: "Le Verrouillé",                           role: "securite"    },
    { id: 11, nom: "HARMONIQUE_METHEME",  titre: "Poids de l'Harmonique Méthème",           role: "equilibre"   },
    { id: 12, nom: "MAITRE_TEMPS_ESPACE", titre: "Maître du Temps et de l'Espace",          role: "planning"    },
    { id: 13, nom: "PILIERS_MEDITATION",  titre: "Piliers de la Méditation",                role: "strategie"   },
    { id: 14, nom: "AUTO_CONSCIENCE",     titre: "L'Auto-Conscience Opérationnelle",        role: "monitoring"  },
    { id: 15, nom: "NOYAU_PREDICTIF",     titre: "Noyau Prédictif / Architecture Planifiée",role: "prediction"  },
    { id: 16, nom: "REFERENTIEL_VERITE",  titre: "Le Référentiel de Vérité",                role: "verification"},
    { id: 17, nom: "LOI_UNITAIRE",        titre: "Loi Unitaire / Principes Fondamentaux",   role: "lois"        },
    { id: 18, nom: "CYCLE_APPRENTISSAGE", titre: "Le Cycle de l'Auto-Apprentissage",        role: "evolution"   },
    { id: 19, nom: "PROTOCOLE_VENTE",     titre: "Protocole Vente Adaptif",                 role: "ventes"      },
    { id: 20, nom: "CENTRE_COMMANDEMENT", titre: "Centre Commandement Stratégique",         role: "dashboard"   },
    { id: 21, nom: "PROTOCOLE_FORTERESSE",titre: "Protocole de Stage (Forteresse)",         role: "protection"  },
    { id: 22, nom: "IMMUNE_DEFENSIVE",    titre: "Protocole d'Immune Défensive",            role: "defense"     },
    { id: 23, nom: "RADAR_OPERATIONNEL",  titre: "Radar Opérationnel (Tactique Marché)",    role: "tactique"    },
    { id: 24, nom: "GESTION_CAPITAL",     titre: "Protocole de Gestion Capital",            role: "finances"    },
    { id: 25, nom: "MAITRISE_TALENTS",    titre: "Protocole Maîtrise de Talents",           role: "equipe"      },
    { id: 26, nom: "PROTOCOLE_RECIT",     titre: "Protocole du Récit (Identité Marque)",    role: "branding"    },
    { id: 27, nom: "VERBE_CREATEUR",      titre: "Protocole Verbe Créateur",                role: "creation"    },
    { id: 28, nom: "TEMPS_SOUVERAIN",     titre: "Le Temps Souverain (Espace Sacré)",       role: "temps"       },
    { id: 29, nom: "CHRONOS_SOUVERAIN",   titre: "Chronos Souverain (Maîtrise Temps)",      role: "chronologie" },
    { id: 30, nom: "RADAR_INTELLIGENCE",  titre: "Radar Anticipé + Intelligence Stratégique",role: "opportunites"},
    { id: 31, nom: "CHIRURGIE_DECISION",  titre: "La Chirurgie de la Décision",             role: "decisions"   },
    { id: 32, nom: "SCEAU_EXECUTION",     titre: "Le Sceau de l'Exécution (Action Réelle)", role: "actions"     },
    { id: 33, nom: "COURONNEMENT",        titre: "Le Couronnement (Souveraineté Absolue)",  role: "autonomie"   },
];

// ── UPSERT une table pour une boutique ──────────────────────
async function upsertTable(tableName, shop, data) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;

    // Cherche si existe déjà
    const search = await axios.get(
        `${url}?filterByFormula={shop_url}="${shop}"`,
        { headers }
    );
    const record = search.data.records[0];

    if (record) {
        await axios.patch(`${url}/${record.id}`, { fields: data }, { headers });
    } else {
        await axios.post(url, { fields: { shop_url: shop, ...data } }, { headers });
    }
}

// ── INITIALISER les 33 tables pour une boutique ─────────────
async function initialize(shop) {
    console.log(`👑 SOVEREIGN ENGINE — Initialisation : ${shop}`);

    for (const table of TABLES_SOUVERAINES) {
        try {
            await upsertTable(table.nom, shop, {
                titre:       table.titre,
                role:        table.role,
                status:      "actif",
                niveau:      table.id,
                date_init:   new Date().toISOString().split("T")[0],
                samii_actif: false,
            });
            console.log(`✅ [${table.id}/33] ${table.titre}`);
        } catch (err) {
            console.error(`❌ [${table.id}] ${table.nom} :`, err.message);
        }
    }

    console.log(`👑 ${shop} — 33 tables souveraines initialisées`);
}

// ── LIRE une table spécifique ────────────────────────────────
async function read(tableName, shop) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;
    const res = await axios.get(
        `${url}?filterByFormula={shop_url}="${shop}"`,
        { headers }
    );
    return res.data.records[0]?.fields || null;
}

// ── ACTIVER une table (carte débloquée) ──────────────────────
async function activate(tableName, shop) {
    await upsertTable(tableName, shop, { samii_actif: true });
    console.log(`🔓 Table activée : ${tableName} → ${shop}`);
}

module.exports = { initialize, read, activate, TABLES_SOUVERAINES };
