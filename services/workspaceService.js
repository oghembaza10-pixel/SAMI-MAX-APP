// ======================================================
// SAMII OS — Workspace Service — PostgreSQL
// ======================================================
// Source de vérité des Workspaces.
// Toutes les routes doivent passer par ce service.
// ======================================================
const db = require("../services/db");

function parseJSON(raw, fallback) {
    if (!raw) return fallback;
    if (typeof raw === "object") return raw;
    try {
        return { ...fallback, ...JSON.parse(raw) };
    } catch {
        return fallback;
    }
}

function parseMissions(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// À QUI EST CETTE BOUTIQUE ?
//
// Écrit ici, une seule fois, parce que la question se posait à deux
// endroits qui ne répondaient pas pareil : /qg comparait « owner » au
// caractère près, /workspace/create cherchait sur « owner ou
// owner_email ». Quand les deux ne tombaient pas d'accord, la personne
// faisait des allers-retours entre les deux pages sans jamais arriver.
function appartientA(workspace, email, session = {}) {
    if (!workspace) return false;
    const meme = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
    if (meme(workspace.owner, email) || meme(workspace.ownerEmail, email)) return true;
    // Une agence gère les boutiques qu'elle a ouvertes pour ses clients.
    return Boolean(session.typeCompte === "agence" && workspace.agenceId
        && workspace.agenceId === session.userId);
}

// OUVRIR UNE BOUTIQUE, C'EST DEVENIR MARCHAND
//
// « Quand quelqu'un veut créer la boutique, il met "créer ma boutique",
// il n'a pas accès. Même moi ça me faisait ça hier. »
//
// À l'inscription, la case cochée d'avance est « Découvrir » — donc
// `type_compte = 'client'` pour la quasi-totalité des comptes. Et /qg
// renvoyait tout compte « client » vers le fil d'actualité, sans un mot.
// La personne cliquait, la page chargeait, et elle se retrouvait d'où
// elle venait : rien n'était cassé côté serveur, donc rien ne le disait.
//
// Le type de compte n'est pas une autorisation qu'on accorde, c'est la
// trace de ce que la personne fait. Le jour où elle ouvre une boutique,
// elle est marchande. On l'écrit ici, au seul endroit où ce fait devient
// vrai, plutôt que de le contrôler à chaque porte.
//
// La condition SQL `AND type_compte = 'client'` n'est pas décorative :
// elle interdit qu'une agence soit rétrogradée par ce chemin, même si un
// appel arrivait ici par erreur.
async function promouvoirEnMarchand(session) {
    if (!session || session.typeCompte !== "client") return false;
    session.typeCompte = "marchand";
    if (!session.userId) return true;
    try {
        await db.query(
            `UPDATE utilisateurs SET type_compte = 'marchand' WHERE id = $1 AND type_compte = 'client'`,
            [session.userId],
        );
    } catch (err) {
        // La session est déjà à jour : la personne entre dans sa boutique
        // maintenant. Un échec d'écriture ne doit pas lui refermer la porte
        // au nez — il se rattrape à la connexion suivante, /qg refaisant la
        // même promotion dès qu'il trouve une boutique à son nom.
        console.warn("⚠️ promouvoirEnMarchand :", err.message);
    }
    return true;
}

function mapRow(r) {
    return {
        workspaceId: r.id || "",
        recordId: r.id || "",
        owner: r.owner || r.owner_email || "",
        // Les DEUX colonnes, pas seulement la première trouvée.
        // getByOwner() cherche sur « owner OU owner_email » ; si elles
        // diffèrent (une majuscule, un ancien import), la recherche
        // trouvait la boutique et le contrôle de propriété la refusait
        // ensuite — deux pages se renvoyaient la balle indéfiniment.
        ownerEmail: r.owner_email || "",
        nom: r.nom || "",
        metier: r.metier || "",
        logo: r.logo || "",
        langue: r.langue || "fr",
        devise: r.devise || "DZD",
        pays: r.pays || "",
        description: r.description || "",
        samii: parseJSON(r.samii, { mode: "auto" }),
        coffre: parseJSON(r.coffre, { forteresse: { charges: 0, activeUntil: null }, boost: { charges: 0, activeUntil: null } }),
        automatisations: parseJSON(r.automatisations, { ambassadeur: true, serenite: true, bouclierAntiFraude: true }),
        missions: parseMissions(r.missions),
        metaAccessToken: r.meta_access_token || "",
        metaAdAccountId: r.meta_ad_account_id || "",
        metaPageId: r.meta_page_id || "",
        timezone: r.timezone || "Africa/Algiers",
        palierAbonnement: r.palier_abonnement || "free",
        agenceId: r.agence_id || null,
        agenceStatut: r.agence_statut || "actif",
        statut: r.statut || "actif",
        actif: r.statut === "actif" || !r.statut,
        created_at: r.created_at || "",
        updated_at: r.updated_at || "",
    };
}

async function getByOwner(email) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE owner = $1 OR owner_email = $1 LIMIT 50`,
            [email]
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getByOwner :", err.message);
        return [];
    }
}

async function getAllActive() {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE statut = 'actif' OR statut IS NULL LIMIT 100`
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getAllActive :", err.message);
        return [];
    }
}

async function getById(workspaceId) {
    try {
        const rows = await db.query(`SELECT * FROM workspaces WHERE id = $1 LIMIT 1`, [workspaceId]);
        return rows[0] ? mapRow(rows[0]) : null;
    } catch (err) {
        console.error("❌ workspaceService.getById :", err.message);
        return null;
    }
}

// ── « LEQUEL DE SES QG ? » — LA RÈGLE, ÉCRITE UNE SEULE FOIS ─────────────
//
// Trois endroits posaient cette question, et les trois se contentaient de
// prendre la première ligne venue : `LIMIT 1` ici, `[0]` dans login.js,
// `[0]` dans register.js — tous les trois SANS `ORDER BY`.
//
// Or sans tri, Postgres rend les lignes dans l'ordre qui l'arrange. Cet
// ordre change avec le plan d'exécution, un VACUUM, une simple mise à jour.
// Ce n'est pas une préférence de style : c'est un résultat non déterministe.
//
// Vu en vrai sur le compte du fondateur : HUIT workspaces pour la même
// adresse, dont deux bacs à sable (« Boutique d'essai », « Restaurant
// d'essai »). Se connecter pouvait donc déposer dans un décor de
// démonstration un jour sur deux, sans que rien ne l'explique.
//
// L'ordre, décidé ici et nulle part ailleurs :
//   1. jamais un bac à sable tant qu'un vrai QG existe
//   2. jamais un QG suspendu tant qu'un actif existe
//   3. celui où il s'est passé quelque chose le plus récemment
//   4. le plus récemment créé, pour trancher les égalités
//
// Le bac à sable est TRIÉ, pas filtré : quelqu'un qui n'a que ça doit
// quand même pouvoir entrer quelque part.
//
// ── POURQUOI PAS `updated_at` ────────────────────────────────────────────
//
// C'était ma première version, et elle était fausse. `updated_at` bouge au
// moindre réglage : sur le compte du fondateur, elle désignait « Ma Boutique
// Test » — zéro commande, zéro journal, jamais utilisée — devant « Ma
// Boutique OG », 23 commandes et 28 lignes de journal.
//
// Ce qui dit où quelqu'un TRAVAILLE, c'est l'activité : une commande, une
// ligne de journal. D'où le GREATEST ci-dessous.
//
// Et même corrigé, ce tri reste une heuristique : deux boutiques actives le
// même jour restent à égalité. C'est pour ça que `qgPrincipal` regarde
// D'ABORD le choix écrit de la personne — voir plus bas.
const DERNIERE_VIE = `
    GREATEST(
        COALESCE((SELECT max(j.created_at)   FROM journal   j WHERE j.workspace_id = w.id), '-infinity'),
        COALESCE((SELECT max(o.date_commande) FROM commandes o WHERE o.workspace_id = w.id), '-infinity'),
        COALESCE(w.updated_at, '-infinity'),
        COALESCE(w.created_at, '-infinity')
    )`;

const ORDRE_QG = `
    ORDER BY COALESCE(w.est_bac_a_sable, FALSE) ASC,
             (COALESCE(w.statut, 'actif') <> 'actif') ASC,
             ${DERNIERE_VIE} DESC,
             w.created_at DESC NULLS LAST`;

// Tous les QG d'une personne, du plus pertinent au moins pertinent.
async function listerParPertinence(email) {
    try {
        const rows = await db.query(
            `SELECT w.* FROM workspaces w WHERE w.owner = $1 OR w.owner_email = $1 ${ORDRE_QG} LIMIT 50`,
            [email]);
        return rows;
    } catch (err) {
        console.error("❌ workspaceService.listerParPertinence :", err.message);
        return [];
    }
}

// ── LE QG PRINCIPAL ───────────────────────────────────────────────────────
//
// Celui où l'on dépose quelqu'un qui vient de se connecter.
//
// L'ordre des deux sources n'est pas négociable :
//
//   1. CE QUE LA PERSONNE A CHOISI (`utilisateurs.qg_principal`)
//   2. à défaut seulement, l'heuristique d'activité
//
// Un choix explicite bat toujours une devinette, aussi bonne soit-elle. Le
// choix est quand même VÉRIFIÉ : on ne dépose personne dans un QG qui ne lui
// appartient plus (boutique vendue, fermée, ou identifiant devenu invalide).
// Sans ce contrôle, une valeur périmée en base enverrait sur une page morte
// à chaque connexion, sans que rien ne l'explique.
//
// Rend la ligne brute — les appelants ont besoin de champs différents.
async function qgPrincipal(email) {
    const rows = await listerParPertinence(email);
    if (!rows.length) return null;

    try {
        const u = await db.query(
            `SELECT qg_principal FROM utilisateurs WHERE email = $1 LIMIT 1`, [email]);
        const choisi = u[0]?.qg_principal;
        if (choisi) {
            const retenu = rows.find((w) => w.id === choisi);
            if (retenu) return retenu;
            console.warn(`⚠️ qgPrincipal : ${email} a choisi « ${choisi} », `
                       + `qui ne lui appartient plus — retour au tri par activité`);
        }
    } catch (err) {
        // La colonne peut ne pas encore exister sur une base qui n'a pas
        // rejoué le schéma. Ce n'est pas une raison pour empêcher quelqu'un
        // de se connecter : on retombe simplement sur l'heuristique.
        console.warn("⚠️ qgPrincipal — choix illisible :", err.message);
    }

    return rows[0];
}

// Écrire le choix. Refuse un QG qui n'appartient pas à la personne : cette
// fonction sera appelée depuis une requête HTTP, donc avec une valeur qui
// vient du dehors.
async function choisirQgPrincipal(email, workspaceId) {
    const rows = await listerParPertinence(email);
    if (!rows.some((w) => w.id === workspaceId)) {
        return { ok: false, erreur: "ce QG n'appartient pas à ce compte" };
    }
    try {
        await db.query(`UPDATE utilisateurs SET qg_principal = $1 WHERE email = $2`,
                       [workspaceId, email]);
        return { ok: true, workspaceId };
    } catch (err) {
        console.error("❌ choisirQgPrincipal :", err.message);
        return { ok: false, erreur: err.message };
    }
}

async function getActiveWorkspace(email) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces
              WHERE (owner = $1 OR owner_email = $1)
                AND (statut = 'actif' OR statut IS NULL)
              ${ORDRE_QG} LIMIT 1`,
            [email]
        );
        if (!rows[0]) return null;
        const w = mapRow(rows[0]);
        return { workspaceId: w.workspaceId, nom: w.nom, metier: w.metier };
    } catch (err) {
        console.error("❌ workspaceService.getActiveWorkspace :", err.message);
        return null;
    }
}

async function getByMetier(email, metier) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE (owner = $1 OR owner_email = $1) AND metier = $2 LIMIT 1`,
            [email, metier]
        );
        return rows[0] ? mapRow(rows[0]) : null;
    } catch (err) {
        console.error("❌ workspaceService.getByMetier :", err.message);
        return null;
    }
}

async function exists(workspaceId) {
    const workspace = await getById(workspaceId);
    return workspace !== null;
}

async function belongsToOwner(workspaceId, owner) {
    try {
        const rows = await db.query(
            `SELECT id FROM workspaces WHERE id = $1 AND (owner = $2 OR owner_email = $2) LIMIT 1`,
            [workspaceId, owner]
        );
        return rows.length > 0;
    } catch (err) {
        console.error("❌ workspaceService.belongsToOwner :", err.message);
        return false;
    }
}

async function create({ workspaceId, owner, nom, metier, logo = "", pays = "", devise = "", langue = "fr", agenceId = null }) {
    try {
        await db.query(
            `INSERT INTO workspaces (id, owner, owner_email, nom, metier, logo, pays, devise, langue, statut, agence_id)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, 'actif', $9)`,
            [workspaceId, owner, nom, metier, logo, pays, devise || "DZD", langue, agenceId]
        );
        return await getById(workspaceId);
    } catch (err) {
        console.error("❌ workspaceService.create :", err.message);
        return null;
    }
}

// Boutiques créées par une agence donnée, pour son "QG Agence".
async function getByAgence(agenceId) {
    try {
        const rows = await db.query(
            `SELECT * FROM workspaces WHERE agence_id = $1 ORDER BY created_at DESC`,
            [agenceId]
        );
        return rows.map(mapRow);
    } catch (err) {
        console.error("❌ workspaceService.getByAgence :", err.message);
        return [];
    }
}

async function update(recordId, fields) {
    try {
        const colonnesAutorisees = [
            "nom", "metier", "logo", "langue", "devise", "pays", "description",
            "samii", "coffre", "automatisations", "missions", "rdv_config", "auto_post_config",
            "meta_access_token", "meta_ad_account_id", "meta_page_id",
            "timezone", "statut",
        ];

        const sets = [];
        const values = [];
        let i = 1;

        for (const [key, value] of Object.entries(fields)) {
            const colonne = key.replace(/([A-Z])/g, "_$1").toLowerCase(); // camelCase → snake_case
            if (!colonnesAutorisees.includes(colonne)) continue;
            const valeurFinale = typeof value === "object" ? JSON.stringify(value) : value;
            sets.push(`${colonne} = $${i++}`);
            values.push(valeurFinale);
        }

        if (!sets.length) return await getById(recordId);

        sets.push(`updated_at = NOW()`);
        values.push(recordId);

        await db.query(`UPDATE workspaces SET ${sets.join(", ")} WHERE id = $${i}`, values);
        return await getById(recordId);
    } catch (err) {
        console.error("❌ workspaceService.update :", err.message);
        return null;
    }
}

async function remove(recordId) {
    try {
        await db.query(`DELETE FROM workspaces WHERE id = $1`, [recordId]);
        return true;
    } catch (err) {
        console.error("❌ workspaceService.delete :", err.message);
        return false;
    }
}

module.exports = {
    getByOwner,
    listerParPertinence,
    qgPrincipal,
    choisirQgPrincipal,
    ORDRE_QG,
    DERNIERE_VIE,
    getById,
    getActiveWorkspace,
    getByMetier,
    exists,
    belongsToOwner,
    appartientA,
    promouvoirEnMarchand,
    create,
    update,
    getByAgence,
    delete: remove,
};
