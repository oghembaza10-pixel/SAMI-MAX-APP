// ==========================================================================
// SAMII OS — « QU'EST-CE QUI S'EST PASSÉ AUJOURD'HUI ? »
//
// POURQUOI CE FICHIER EXISTE. On peut demander à SAMII ce qui s'est passé,
// mais il ne le sait pas : il connaît la conversation, pas l'activité. Il
// répondrait donc de mémoire — c'est-à-dire qu'il inventerait.
//
// Ce fichier ne parle pas. Il COMPTE. Il va chercher, en base, ce qui s'est
// réellement passé, et rend un objet de chiffres. C'est SAMII qui en fait
// une phrase, avec sa voix et son ton — la séparation compte : le jour où
// le ton change, les chiffres ne bougent pas.
//
// ── LA RÈGLE QUI GOUVERNE TOUT ICI ──────────────────────────────────────
//
// UNE SOURCE ABSENTE SE DIT, ELLE NE SE DEVINE PAS.
//
// Chaque source rend soit des chiffres, soit une raison lisible de son
// silence — « Gmail n'est pas connecté », « pas branché à GitHub ». Ces
// raisons remontent dans `indisponibles` et SAMII a pour consigne de les
// annoncer. Une IA à qui l'on donne un tableau vide comble le vide : elle
// dira « tu as reçu quelques emails » parce que la phrase sonne juste.
//
// C'est la différence entre un assistant et un bonimenteur.
//
// ── CE QU'ON REGARDE, ET POUR QUI ───────────────────────────────────────
//
// Le fondateur (session.isAdmin) voit la plateforme entière : c'est son
// tableau de bord. Un marchand voit SA boutique, et rien d'autre — même
// fichier, même code, périmètre différent. Sans ça, le premier marchand qui
// ouvre la page apprend le chiffre d'affaires de tous les autres.
// ==========================================================================
const db = require("./db");

// Les lectures sont indépendantes : une table absente ou une requête en
// erreur ne doit pas emporter tout le briefing. On enveloppe donc chaque
// source, et son échec devient une ligne d'indisponibilité.
async function essayer(nom, fn) {
    try {
        return { ok: true, valeur: await fn() };
    } catch (err) {
        console.warn(`⚠️ Briefing (${nom}) :`, err.message);
        return { ok: false, raison: `${nom} : lecture impossible (${err.message})` };
    }
}

const unNombre = (rows) => Number(rows?.[0]?.n || 0);

// ── LES SOURCES ─────────────────────────────────────────────────────────

// Comptées sur les dernières 24 heures glissantes, pas « depuis minuit » :
// à 00h30 un « depuis minuit » annonce une journée vide alors qu'il vient
// de se passer quelque chose il y a une heure.
const DEPUIS = "created_at >= NOW() - INTERVAL '24 hours'";

async function commandes(workspaceId) {
    const cadre = workspaceId ? "WHERE workspace_id = $1" : "";
    const args = workspaceId ? [workspaceId] : [];
    const rows = await db.query(
        `SELECT COUNT(*)::int                                   AS n,
                COALESCE(SUM(montant), 0)                       AS total,
                COUNT(*) FILTER (WHERE statut = 'confirmee')::int AS confirmees,
                COUNT(*) FILTER (WHERE statut = 'annulee')::int   AS annulees,
                MAX(devise)                                     AS devise
           FROM commandes
          ${cadre}${cadre ? " AND" : "WHERE"} date_commande >= NOW() - INTERVAL '24 hours'`,
        args,
    );
    const r = rows[0] || {};
    return {
        nombre: Number(r.n || 0),
        total: Number(r.total || 0),
        confirmees: Number(r.confirmees || 0),
        annulees: Number(r.annulees || 0),
        devise: r.devise || "",
    };
}

async function nouveauxComptes(communaute) {
    // Le fondateur voit toute la plateforme ; sinon on reste dans sa
    // communauté — même règle que partout ailleurs dans ce dépôt.
    if (communaute) {
        return unNombre(await db.query(
            `SELECT COUNT(*)::int AS n FROM utilisateurs
              WHERE ${DEPUIS} AND COALESCE(communaute, 'samii') = $1`,
            [communaute],
        ));
    }
    return unNombre(await db.query(
        `SELECT COUNT(*)::int AS n FROM utilisateurs WHERE ${DEPUIS}`,
    ));
}

async function paiements(vendeurId) {
    const cadre = vendeurId ? "AND vendeur_id = $1" : "";
    const args = vendeurId ? [vendeurId] : [];
    const rows = await db.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(montant), 0) AS total, MAX(devise) AS devise
           FROM paiements
          WHERE ${DEPUIS} AND statut = 'paye' ${cadre}`,
        args,
    );
    const r = rows[0] || {};
    return { nombre: Number(r.n || 0), total: Number(r.total || 0), devise: r.devise || "" };
}

async function rendezVous(workspaceId) {
    const cadre = workspaceId ? "WHERE workspace_id = $1 AND" : "WHERE";
    const args = workspaceId ? [workspaceId] : [];
    return unNombre(await db.query(
        `SELECT COUNT(*)::int AS n FROM rendez_vous ${cadre} ${DEPUIS}`, args,
    ));
}

// Le journal est la mémoire de l'application : c'est là que les moteurs
// écrivent ce qu'ils font. On remonte les actions les plus fréquentes
// plutôt que la liste brute — « 14 relances panier » est une information,
// quatorze lignes identiques n'en sont pas.
async function activite(workspaceId) {
    const cadre = workspaceId ? "WHERE workspace_id = $1 AND" : "WHERE";
    const args = workspaceId ? [workspaceId] : [];
    const rows = await db.query(
        `SELECT action, COUNT(*)::int AS n
           FROM journal ${cadre} ${DEPUIS}
          GROUP BY action ORDER BY n DESC LIMIT 8`,
        args,
    );
    return rows.map((r) => ({ action: r.action, nombre: Number(r.n) }));
}

// Les erreurs enregistrées. Aujourd'hui rien n'écrit `action = 'erreur'`
// dans le journal — les catch du dépôt vont dans console.error, qui n'est
// lisible que dans les logs Render et n'est pas interrogeable. Le compte
// sera donc à zéro tant que personne n'aura instrumenté les routes, et
// c'est POUR ÇA qu'on ne dit pas « aucune erreur » : on dit qu'on ne les
// enregistre pas encore. Zéro erreur mesurée n'est pas zéro erreur.
async function erreurs(workspaceId) {
    const cadre = workspaceId ? "AND workspace_id = $1" : "";
    const args = workspaceId ? [workspaceId] : [];
    const rows = await db.query(
        `SELECT action, details, created_at FROM journal
          WHERE ${DEPUIS} AND action ILIKE '%erreur%' ${cadre}
          ORDER BY created_at DESC LIMIT 5`,
        args,
    );
    return rows.map((r) => ({ action: r.action, details: r.details, quand: r.created_at }));
}

// On ne réécrit pas le comptage : `routes/messages.js` l'exporte déjà, avec
// le bon nom de colonne (`lu_le IS NULL`, pas un booléen) et le
// cloisonnement par communauté. Deux comptages du même chiffre finissent
// toujours par diverger, et c'est le badge de la colonne de gauche qui fait
// foi — pas nous.
async function messagesPrives(userId, communaute) {
    if (!userId) return { nonLus: 0 };
    const messages = require("../routes/messages");
    return { nonLus: await messages.nonLus(userId, communaute) };
}

// Gmail : le code existe (services/google.js), l'autorisation non. Tant que
// le marchand n'a pas branché son compte Google, on le DIT — on ne fait pas
// semblant que sa boîte est vide.
async function emails(workspaceId) {
    if (!workspaceId) return { indisponible: "Gmail : pas d'espace de travail rattaché à ce compte." };
    const google = require("./google");
    const res = await google.listRecentEmails(workspaceId);
    if (!res || res.connected === false) {
        return { indisponible: "Gmail n'est pas connecté — Paramètres → Connecter mes outils → Google." };
    }
    const liste = res.emails || [];
    return {
        nombre: liste.length,
        apercus: liste.slice(0, 8).map((e) => ({
            de: e.from || e.expediteur || "",
            objet: e.subject || e.objet || "",
        })),
    };
}

// ── CE QU'ON N'A PAS, ET QU'ON REFUSE DE FAIRE SEMBLANT D'AVOIR ─────────
//
// GitHub et Render ont été demandés. Aucun appel à api.github.com ni à
// l'API Render n'existe dans ce dépôt : ce sont deux connecteurs à
// construire, avec leurs jetons et leurs quotas. Les nommer ici plutôt que
// de les omettre a une raison — omis, SAMII n'en parle pas et on croit
// qu'il a regardé. Nommés, il dit qu'il ne peut pas voir.
const SOURCES_ABSENTES = [
    "GitHub : aucun connecteur — je ne vois ni les commits, ni les pull requests.",
    "Render : aucun connecteur — je ne vois ni l'état du service, ni les déploiements.",
];

// ── LE RASSEMBLEMENT ────────────────────────────────────────────────────

// `session` est passée telle quelle : l'identité vient de là, jamais du
// corps d'une requête. Un identifiant de workspace accepté depuis la page
// et n'importe qui lit le chiffre d'affaires de n'importe qui.
async function collecter(session = {}, COM = null) {
    const estFondateur = session.isAdmin === true;
    const workspaceId = estFondateur ? null : (session.workspaceId || null);
    const userId = session.userId || null;
    // Le fondateur voit toute la plateforme ; les autres restent dans leur
    // communauté. `COM` vient du service (res.locals.COM), pas du compte.
    const communaute = estFondateur ? null : (COM?.slug || null);

    const [cmd, comptes, pay, rdv, act, err, msg, mail] = await Promise.all([
        essayer("commandes", () => commandes(workspaceId)),
        essayer("nouveaux comptes", () => nouveauxComptes(communaute)),
        essayer("paiements", () => paiements(estFondateur ? null : userId)),
        essayer("rendez-vous", () => rendezVous(workspaceId)),
        essayer("activité", () => activite(workspaceId)),
        essayer("erreurs", () => erreurs(workspaceId)),
        essayer("messages", () => messagesPrives(userId, COM?.slug || null)),
        essayer("emails", () => emails(session.workspaceId || null)),
    ]);

    const indisponibles = [...SOURCES_ABSENTES];
    const prendre = (r, defaut) => {
        if (r.ok) return r.valeur;
        indisponibles.push(r.raison);
        return defaut;
    };

    const donnees = {
        perimetre: estFondateur ? "toute la plateforme" : "ton espace de travail",
        fenetre: "les dernières 24 heures",
        commandes: prendre(cmd, null),
        nouveauxComptes: prendre(comptes, null),
        paiements: prendre(pay, null),
        rendezVous: prendre(rdv, null),
        activite: prendre(act, []),
        erreursEnregistrees: prendre(err, []),
        messagesNonLus: prendre(msg, { nonLus: 0 }).nonLus,
    };

    const boiteMail = prendre(mail, null);
    if (boiteMail?.indisponible) {
        indisponibles.push(boiteMail.indisponible);
        donnees.emails = null;
    } else {
        donnees.emails = boiteMail;
    }

    // Dit explicitement, parce que « 0 erreur » et « on ne compte pas les
    // erreurs » sonnent pareil à l'oreille et ne veulent pas dire du tout
    // la même chose.
    if (!donnees.erreursEnregistrees.length) {
        indisponibles.push(
            "Erreurs applicatives : elles ne sont pas encore enregistrées en base "
            + "(elles partent dans les logs). Zéro ici ne veut pas dire zéro erreur.",
        );
    }

    return { donnees, indisponibles };
}

module.exports = { collecter, SOURCES_ABSENTES };
