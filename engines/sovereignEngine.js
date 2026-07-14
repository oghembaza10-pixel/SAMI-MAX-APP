/**
 * OG • Sovereign Engine
 * Les 33 Tables Souveraines — Lecture seule
 * SAMII consulte les lois — jamais d'écriture
 */

const axios  = require("axios");
const CONFIG = require("../services/config");

// ── CLIENT AXIOS ─────────────────────────────────────────────
const http = axios.create({
    timeout: 10000,
    headers: {
        Authorization: `Bearer ${CONFIG.AIRTABLE.API_KEY}`,
        "Content-Type": "application/json",
    }
});

const BASE = `https://api.airtable.com/v0/${CONFIG.AIRTABLE.BASE_ID}`;

// ── LES 33 TABLES SOUVERAINES ────────────────────────────────
const TABLES_SOUVERAINES = [
    { id: 1,  nom: "L_AME",                titre: "L'Âme (Origine)",                         role: "identite"     },
    { id: 2,  nom: "SOCLE_VIE_ETHIQUE",    titre: "Socle de Vie Éthique",                    role: "fondation"    },
    { id: 3,  nom: "PERCEPTIONS",          titre: "Perceptions",                              role: "analyse"      },
    { id: 4,  nom: "INTELLIGENCE",         titre: "Intelligence (Savoir)",                    role: "donnees"      },
    { id: 5,  nom: "LANGAGE",              titre: "Langage (Pensée)",                         role: "communication"},
    { id: 6,  nom: "LOIS_MEMOIRE",         titre: "Lois Mémoire (Expérience)",                role: "memoire"      },
    { id: 7,  nom: "SOUVERAIN",            titre: "Souverain (En couleur)",                   role: "regles"       },
    { id: 8,  nom: "VOLONTE_ACTION",       titre: "Volonté et Action",                        role: "execution"    },
    { id: 9,  nom: "VIGILANCE",            titre: "Vigilance",                                role: "alertes"      },
    { id: 10, nom: "LE_VERROUILLE",        titre: "Le Verrouillé",                            role: "securite"     },
    { id: 11, nom: "HARMONIQUE_METHEME",   titre: "Poids de l'Harmonique Méthème",            role: "equilibre"    },
    { id: 12, nom: "MAITRE_TEMPS_ESPACE",  titre: "Maître du Temps et de l'Espace",           role: "planning"     },
    { id: 13, nom: "PILIERS_MEDITATION",   titre: "Piliers de la Méditation",                 role: "strategie"    },
    { id: 14, nom: "AUTO_CONSCIENCE",      titre: "L'Auto-Conscience Opérationnelle",         role: "monitoring"   },
    { id: 15, nom: "NOYAU_PREDICTIF",      titre: "Noyau Prédictif / Architecture Planifiée", role: "prediction"   },
    { id: 16, nom: "REFERENTIEL_VERITE",   titre: "Le Référentiel de Vérité",                 role: "verification" },
    { id: 17, nom: "LOI_UNITAIRE",         titre: "Loi Unitaire / Principes Fondamentaux",    role: "lois"         },
    { id: 18, nom: "CYCLE_APPRENTISSAGE",  titre: "Le Cycle de l'Auto-Apprentissage",         role: "evolution"    },
    { id: 19, nom: "PROTOCOLE_VENTE",      titre: "Protocole Vente Adaptif",                  role: "ventes"       },
    { id: 20, nom: "CENTRE_COMMANDEMENT",  titre: "Centre Commandement Stratégique",          role: "dashboard"    },
    { id: 21, nom: "PROTOCOLE_FORTERESSE", titre: "Protocole de Stage (Forteresse)",          role: "protection"   },
    { id: 22, nom: "IMMUNE_DEFENSIVE",     titre: "Protocole d'Immune Défensive",             role: "defense"      },
    { id: 23, nom: "RADAR_OPERATIONNEL",   titre: "Radar Opérationnel (Tactique Marché)",     role: "tactique"     },
    { id: 24, nom: "GESTION_CAPITAL",      titre: "Protocole de Gestion Capital",             role: "finances"     },
    { id: 25, nom: "MAITRISE_TALENTS",     titre: "Protocole Maîtrise de Talents",            role: "equipe"       },
    { id: 26, nom: "PROTOCOLE_RECIT",      titre: "Protocole du Récit (Identité Marque)",     role: "branding"     },
    { id: 27, nom: "VERBE_CREATEUR",       titre: "Protocole Verbe Créateur",                 role: "creation"     },
    { id: 28, nom: "TEMPS_SOUVERAIN",      titre: "Le Temps Souverain (Espace Sacré)",        role: "temps"        },
    { id: 29, nom: "CHRONOS_SOUVERAIN",    titre: "Chronos Souverain (Maîtrise Temps)",       role: "chronologie"  },
    { id: 30, nom: "RADAR_INTELLIGENCE",   titre: "Radar Anticipé + Intelligence Stratégique",role: "opportunites" },
    { id: 31, nom: "CHIRURGIE_DECISION",   titre: "La Chirurgie de la Décision",              role: "decisions"    },
    { id: 32, nom: "SCEAU_EXECUTION",      titre: "Le Sceau de l'Exécution (Action Réelle)",  role: "actions"      },
    { id: 33, nom: "COURONNEMENT",         titre: "Le Couronnement (Souveraineté Absolue)",   role: "autonomie"    },
];

// ======================================================
// LECTURE — SAMII consulte les lois
// Jamais d'écriture sur ces tables
// ======================================================

// ── Lire tous les enregistrements d'une table souveraine ─────
async function readTable(tableName) {
    try {
        const res = await http.get(`${BASE}/${encodeURIComponent(tableName)}`);
        return res.data.records;
    } catch (err) {
        console.warn(`⚠️ Lecture ${tableName} :`, err.message);
        return [];
    }
}

// ── Lire une table filtrée par shop ──────────────────────────
async function read(tableName, shop) {
    try {
        const res = await http.get(
            `${BASE}/${encodeURIComponent(tableName)}?filterByFormula={shop_url}="${shop}"`
        );
        return res.data.records[0]?.fields || null;
    } catch (err) {
        console.warn(`⚠️ Lecture ${tableName} [${shop}] :`, err.message);
        return null;
    }
}

// ── Lire une carte spécifique (activation abonnement) ────────
async function activate(tableName, shop) {
    console.log(`🃏 Lecture carte : ${tableName} → ${shop}`);
    const data = await read(tableName, shop);
    if (data) {
        console.log(`✅ Carte lue : ${tableName}`);
    } else {
        console.warn(`⚠️ Carte vide : ${tableName}`);
    }
    return data;
}

// ── Initialiser = lire les 33 lois au démarrage boutique ─────
async function initialize(shop) {
    console.log(`👑 SOVEREIGN ENGINE — Lecture des 33 lois : ${shop}`);

    for (const table of TABLES_SOUVERAINES) {
        try {
            const records = await readTable(table.nom);
            console.log(`📖 [${table.id}/33] ${table.titre} — ${records.length} règle(s)`);
        } catch (err) {
            console.warn(`⚠️ [${table.id}] ${table.nom} :`, err.message);
        }
    }

    console.log(`👑 ${shop} — 33 lois souveraines chargées`);
}

// ── Consulter une loi spécifique (pour Gemini V2) ────────────
async function consult(tableName) {
    const records = await readTable(tableName);
    return records.map(r => r.fields);
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    initialize,
    read,
    activate,
    consult,
    TABLES_SOUVERAINES,
};
