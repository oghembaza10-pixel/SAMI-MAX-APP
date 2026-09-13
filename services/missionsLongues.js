// ==========================================================================
// SAMII OS — LES MISSIONS QUI SURVIVENT À LA REQUÊTE
// ==========================================================================
//
// LE PROBLÈME, DIT SIMPLEMENT.
//
// « Prépare-moi une stratégie complète » ne tient pas dans une requête HTTP.
// Trente secondes plus tard, le navigateur abandonne, Render coupe, et le
// travail est perdu — ou pire, il continue dans le vide et personne ne le
// saura jamais.
//
// ── CE QU'ON N'A PAS CONSTRUIT ───────────────────────────────────────────
//
// Pas de file d'attente, pas de deuxième processus, pas de Redis, pas de
// nouveau « mode SAMII ». Rien de tout ça n'existe dans ce projet et rien de
// tout ça n'est nécessaire.
//
// On a généralisé le SEUL motif durable qui marchait déjà :
// `social_publications` — une ligne avec un statut, une échéance, un
// compteur d'essais, reprise par un cron. C'est exactement la bonne forme ;
// elle ne savait faire qu'une chose.
//
// Et le battement passe par `kernel/scheduler.js`, déjà en service pour dix
// autres tâches. Aucun processus de plus à surveiller.
//
// ── CE QU'UNE MISSION LONGUE N'EST PAS ───────────────────────────────────
//
// Ce n'est PAS une nouvelle personnalité ni un nouveau niveau. Les niveaux
// restent Rapide / Expert / Pro / Maître, l'autonomie reste un axe séparé.
// Une mission longue est une FAÇON D'EXÉCUTER une mission de
// config/agents.js : un agent par battement au lieu de tous d'un coup.
//
// ── LES TROIS COLONNES QUI FONT LA REPRISE ───────────────────────────────
//
//   etape         où on en est. Écrite en base AVANT l'étape suivante.
//   verrou_jusqu  qui la tient. Un processus tué net ne bloque rien : le
//                 bail expire seul.
//   expire_le     la fin, quoi qu'il arrive.
// ==========================================================================

const db = require("./db");
const AGENTS = require("../config/agents");
const socle = require("../engines/social/agents/base");

// ── LES ÉTATS ────────────────────────────────────────────────────────────
//
// Cinq, et les frontières comptent :
//
//   attente    créée, jamais démarrée
//   en_cours   au moins une étape faite, il en reste
//   terminee   toutes les étapes faites ET le résultat vérifié
//   echouee    une étape a échoué trop de fois, ou le délai est passé
//   annulee    quelqu'un l'a arrêtée
//
// `terminee` n'est PAS « la dernière étape est passée » : c'est « et la
// vérification a dit oui ». Sans cette distinction, une mission qui rend du
// vide serait annoncée comme réussie — le défaut du chantier 8, qu'on ne
// refait pas ici.
const ETATS = ["attente", "en_cours", "terminee", "echouee", "annulee"];
const VIVANTS = ["attente", "en_cours"];

// Combien de temps un processus garde une mission avant qu'un autre puisse
// la reprendre. Assez long pour qu'une étape finisse, assez court pour qu'un
// redémarrage ne bloque pas la mission plus d'un battement ou deux.
const BAIL_MS = 120000;

// Combien de fois on retente UNE étape. Au-delà, la mission échoue : une
// étape qui rate trois fois ne ratera pas différemment la quatrième, et
// chaque reprise consomme.
const ESSAIS_MAX = 3;

// La vie maximale d'une mission. Sans elle, une mission qui se rate à chaque
// reprise tourne indéfiniment et consomme à chaque battement.
const DUREE_MAX_MS = 60 * 60 * 1000;

// L'attente entre deux étapes d'une même mission. Zéro serait tentant — et
// ferait tourner toute la chaîne dans un seul battement, donc reproduirait
// exactement le problème qu'on corrige.
const PAUSE_ENTRE_ETAPES_MS = 1000;

// Qui tient le bail. Le PID suffit : on ne veut pas identifier la machine,
// seulement distinguer deux preneurs et pouvoir lire un journal.
const MOI = `${process.pid}`;

function etatValide(e) { return ETATS.includes(String(e || "")); }

// ══════════════════════════════════════════════════════════════════════════
// CRÉER
// ══════════════════════════════════════════════════════════════════════════
//
// ── LES PERMISSIONS SONT VÉRIFIÉES ICI, PAS AU BATTEMENT ─────────────────
//
// Et elles sont GELÉES dans la ligne. C'est un choix, et il se défend des
// deux côtés : une mission lancée en Maître ne doit pas s'arrêter au milieu
// parce que l'abonnement a expiré entre-temps, et elle ne doit pas non plus
// gagner des droits parce que la personne est passée Pro depuis. Ce qui a
// été autorisé au lancement est ce qui s'exécute, du début à la fin.
async function creer({ missionId, entree = {}, context = {} } = {}) {
    const agents = require("../brain/agents");

    const porte = agents.autoriser({ missionId, context });
    if (!porte.autorise) {
        return { ok: false, refuse: true, erreur: porte.refus };
    }

    const m = porte.mission;
    // Une mission qui délègue (`executer`) n'a pas d'étapes à dérouler : elle
    // fait tout d'un bloc, donc elle n'a rien à faire ici. La lancer en long
    // donnerait une mission à une seule étape, plus lente et plus compliquée,
    // sans aucun gain.
    if (typeof m.executer === "function") {
        return { ok: false, refuse: true, erreur: `« ${missionId} » s'exécute d'un bloc, pas en mission longue` };
    }
    if (!m.agents?.length) {
        return { ok: false, refuse: true, erreur: `« ${missionId} » n'a aucune étape` };
    }

    try {
        const rows = await db.query(
            `INSERT INTO missions_longues
                (user_id, workspace_id, mission, entree, niveau, palier, audience,
                 etat, etapes_total, expire_le)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'attente',$8, NOW() + ($9 || ' milliseconds')::interval)
             RETURNING *`,
            [
                context.identite?.userId || context.userId || null,
                context.workspaceId || null,
                missionId,
                JSON.stringify(entree || {}),
                context.niveau || null,
                context.palier || null,
                context.audience || null,
                m.agents.length,
                String(DUREE_MAX_MS),
            ],
        );
        return { ok: true, mission: rows[0] };
    } catch (err) {
        console.error("❌ missionsLongues.creer :", err.message);
        return { ok: false, refuse: false, erreur: "la mission n'a pas pu être enregistrée" };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// PRENDRE — le verrou, et pourquoi il est écrit comme ça
// ══════════════════════════════════════════════════════════════════════════
//
// UNE SEULE REQUÊTE, PAS UN « SELECT PUIS UPDATE ».
//
// Lire les missions dues puis les verrouiller en deux temps laisse une
// fenêtre entre les deux : deux processus lisent la même ligne, tous deux la
// croient libre, et la mission s'exécute deux fois. C'est le défaut classique
// des files d'attente écrites à la main, et il ne se voit qu'en production
// sous charge.
//
// Ici, l'UPDATE conditionnel FAIT la sélection. La base garantit qu'une seule
// des deux transactions verra la ligne non verrouillée.
//
// `FOR UPDATE SKIP LOCKED` dans le sous-select : deux battements simultanés
// ne s'attendent pas, ils prennent chacun une mission différente.
async function prendre(limite = 3) {
    try {
        return await db.query(
            `UPDATE missions_longues SET
                verrou_jusqu = NOW() + ($2 || ' milliseconds')::interval,
                verrou_par   = $3,
                etat         = 'en_cours',
                debut_le     = COALESCE(debut_le, NOW())
             WHERE id IN (
                SELECT id FROM missions_longues
                 WHERE etat = ANY($4)
                   AND prochaine_le <= NOW()
                   AND (verrou_jusqu IS NULL OR verrou_jusqu < NOW())
                 ORDER BY prochaine_le
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING *`,
            [Math.min(Number(limite) || 3, 20), String(BAIL_MS), MOI, VIVANTS],
        );
    } catch (err) {
        console.error("❌ missionsLongues.prendre :", err.message);
        return [];
    }
}

async function lire(id) {
    try {
        const rows = await db.query(`SELECT * FROM missions_longues WHERE id = $1`, [id]);
        return rows[0] || null;
    } catch { return null; }
}

async function lister({ userId, workspaceId, limite = 20 } = {}) {
    const clauses = ["1=1"]; const params = [];
    if (userId) { params.push(String(userId)); clauses.push(`user_id = $${params.length}`); }
    if (workspaceId) { params.push(String(workspaceId)); clauses.push(`workspace_id = $${params.length}`); }
    params.push(Math.min(Number(limite) || 20, 100));
    try {
        return await db.query(
            `SELECT id, mission, etat, etape, etapes_total, essais, erreur,
                    created_at, debut_le, fin_le
               FROM missions_longues
              WHERE ${clauses.join(" AND ")}
              ORDER BY created_at DESC LIMIT $${params.length}`, params);
    } catch (err) {
        console.error("❌ missionsLongues.lister :", err.message);
        return [];
    }
}

// ── ANNULER ──────────────────────────────────────────────────────────────
//
// Seulement ce qui est encore vivant, et seulement par son propriétaire. Une
// mission terminée ne « s'annule » pas : elle est faite, et prétendre le
// contraire ferait croire qu'on a défait quelque chose.
//
// Le propriétaire est comparé EN BASE, dans le WHERE. Le vérifier en
// JavaScript après un SELECT laisserait la porte ouverte à l'appelant qui
// oublie la comparaison — et il y en a toujours un.
async function annuler(id, { userId } = {}) {
    try {
        const rows = await db.query(
            `UPDATE missions_longues
                SET etat = 'annulee', fin_le = NOW(),
                    erreur = COALESCE(erreur, 'annulée par le propriétaire')
              WHERE id = $1 AND etat = ANY($2)
                AND ($3::text IS NULL OR user_id = $3)
              RETURNING id, etat`,
            [id, VIVANTS, userId || null],
        );
        return rows[0] || null;
    } catch (err) {
        console.error("❌ missionsLongues.annuler :", err.message);
        return null;
    }
}

// ══════════════════════════════════════════════════════════════════════════
// AVANCER D'UNE ÉTAPE
// ══════════════════════════════════════════════════════════════════════════
//
// UNE seule étape par appel. C'est ce qui rend la reprise réelle : le
// curseur est écrit en base avant qu'on touche à la suivante, donc un
// redémarrage entre deux étapes reprend au bon endroit sans refaire ce qui
// est fait.
//
// Tout faire d'un trait aurait été plus simple à écrire et aurait reproduit
// exactement le problème qu'on corrige.
async function avancerDUneEtape(ligne) {
    const m = AGENTS.mission(ligne.mission);
    if (!m) return terminerEnEchec(ligne, `mission inconnue : ${ligne.mission}`);

    // ── LES TROIS RAISONS DE S'ARRÊTER AVANT DE TRAVAILLER ───────────────
    //
    // Vérifiées à CHAQUE étape, pas seulement au lancement. Une annulation
    // arrivée pendant l'étape précédente doit être vue maintenant, pas à la
    // fin de la chaîne.
    const frais = await lire(ligne.id);
    if (!frais || !VIVANTS.includes(frais.etat)) {
        return { ok: false, arrete: true, etat: frais?.etat || "inconnu" };
    }
    if (frais.expire_le && new Date(frais.expire_le).getTime() < Date.now()) {
        return terminerEnEchec(frais, "le délai maximum de la mission est dépassé");
    }

    // Le coupe-circuit, lu à chaque étape : couper un agent doit arrêter les
    // missions en cours, pas seulement les prochaines.
    const idAgent = m.agents[frais.etape];
    if (!idAgent) return terminerEnEchec(frais, `étape ${frais.etape} hors de la chaîne`);
    if (socle.estCoupe(idAgent)) {
        return terminerEnEchec(frais, `un spécialiste nécessaire est coupé (${idAgent})`);
    }

    const agent = AGENTS.agent(idAgent);
    if (!agent || typeof agent.executer !== "function") {
        return terminerEnEchec(frais, `le spécialiste « ${idAgent} » n'a pas d'exécution`);
    }

    // ── LE CONTEXTE EST RECONSTRUIT DEPUIS LA LIGNE, PAS HÉRITÉ ──────────
    //
    // Les droits gelés au lancement, et rien d'autre. Un agent ne reçoit ni
    // la session, ni les secrets, ni ce que SAMII avait sous la main au
    // moment de la demande — même règle qu'au chantier 8, et elle compte
    // encore plus ici : le battement tourne hors de toute requête.
    const contexte = {
        niveau: frais.niveau, palier: frais.palier, audience: frais.audience,
        workspaceId: frais.workspace_id, userId: frais.user_id,
    };
    const passe = { ...(frais.entree || {}), ...(frais.passe || {}) };

    const r = await socle.executer(idAgent,
        { workspaceId: frais.workspace_id, entree: { mission: frais.mission, etape: frais.etape } },
        () => agent.executer(passe, contexte));

    if (!r.ok) {
        const essais = frais.essais + 1;
        if (essais >= ESSAIS_MAX) {
            return terminerEnEchec(frais, `étape « ${idAgent} » : ${r.erreur || "sans motif"}`);
        }
        // ── ON RECULE L'ÉCHÉANCE, ON NE BOUCLE PAS ───────────────────────
        //
        // Chaque essai attend plus longtemps que le précédent. Sans ça, une
        // étape qui échoue instantanément serait rejouée à chaque battement
        // et brûlerait ses trois essais en quinze secondes — sans laisser le
        // temps à la panne passagère de se résoudre, ce qui est pourtant la
        // seule raison de réessayer.
        await db.query(
            `UPDATE missions_longues
                SET essais = $2, erreur = $3, verrou_jusqu = NULL,
                    prochaine_le = NOW() + ($4 || ' milliseconds')::interval
              WHERE id = $1`,
            [frais.id, essais, String(r.erreur || "").slice(0, 500), String(PAUSE_ENTRE_ETAPES_MS * 5 * essais)],
        );
        return { ok: false, reessai: true, essais, agent: idAgent };
    }

    // ── L'ÉTAPE EST FAITE : ON L'ÉCRIT AVANT DE PENSER À LA SUIVANTE ─────
    const etape = frais.etape + 1;
    const nouveauPasse = { ...(frais.passe || {}), ...depouiller(r) };
    const trace = [...(frais.trace || []), {
        etape: frais.etape, agent: idAgent, ok: true, le: new Date().toISOString(),
    }];
    // Ce que l'étape a produit de FACTURABLE. Un agent déclare ses actes ; on
    // ne facture jamais « l'étape a tourné ».
    const actes = [...(frais.cout_actes || []), ...(Array.isArray(r.actes) ? r.actes : [])];

    const fini = etape >= (m.agents.length || 0);

    if (!fini) {
        await db.query(
            `UPDATE missions_longues
                SET etape = $2, passe = $3, trace = $4, cout_actes = $5,
                    essais = 0, erreur = NULL, verrou_jusqu = NULL,
                    prochaine_le = NOW() + ($6 || ' milliseconds')::interval
              WHERE id = $1`,
            [frais.id, etape, JSON.stringify(nouveauPasse), JSON.stringify(trace),
                JSON.stringify(actes), String(PAUSE_ENTRE_ETAPES_MS)],
        );
        return { ok: true, etape, sur: m.agents.length, agent: idAgent };
    }

    // ── LA DERNIÈRE ÉTAPE N'EST PAS LA FIN ───────────────────────────────
    //
    // On vérifie ce qui sort, avec la MÊME fonction que le chantier 8. Une
    // mission dont toutes les étapes sont passées mais qui ne rend rien
    // d'exploitable n'est pas terminée : elle a échoué en silence, et c'est
    // le pire des échecs parce qu'on l'annonce comme une réussite.
    const agentsCore = require("../brain/agents");
    const resultat = { ok: true, ...nouveauPasse };
    const controle = agentsCore.verifier({ missionId: frais.mission, resultat });

    if (!controle.conforme) {
        return terminerEnEchec(frais, controle.bloquants.join(" ; "), { trace, actes, resultat });
    }

    await db.query(
        `UPDATE missions_longues
            SET etat = 'terminee', etape = $2, passe = $3, trace = $4,
                cout_actes = $5, resultat = $6, erreur = NULL,
                verrou_jusqu = NULL, fin_le = NOW()
          WHERE id = $1`,
        [frais.id, etape, JSON.stringify(nouveauPasse), JSON.stringify(trace),
            JSON.stringify(actes), JSON.stringify({ ...resultat, verification: controle })],
    );
    return { ok: true, terminee: true, etape, sur: m.agents.length };
}

// Ce qu'on garde d'un retour d'agent pour le passer au suivant. Les clés du
// socle (`ok`, `erreur`) ne sont pas des données de travail : les laisser
// ferait qu'un agent reçoive `ok: true` comme s'il l'avait produit.
function depouiller(r) {
    const { ok, erreur, coupe, ...reste } = r;
    return reste;
}

async function terminerEnEchec(ligne, motif, extras = {}) {
    try {
        await db.query(
            `UPDATE missions_longues
                SET etat = 'echouee', erreur = $2, verrou_jusqu = NULL, fin_le = NOW(),
                    trace = COALESCE($3, trace), cout_actes = COALESCE($4, cout_actes),
                    resultat = COALESCE($5, resultat)
              WHERE id = $1`,
            [ligne.id, String(motif || "").slice(0, 500),
                extras.trace ? JSON.stringify(extras.trace) : null,
                extras.actes ? JSON.stringify(extras.actes) : null,
                extras.resultat ? JSON.stringify(extras.resultat) : null],
        );
    } catch (err) {
        console.error("❌ missionsLongues.terminerEnEchec :", err.message);
    }
    return { ok: false, echouee: true, erreur: motif };
}

// ══════════════════════════════════════════════════════════════════════════
// LE BATTEMENT
// ══════════════════════════════════════════════════════════════════════════
//
// Branché sur `kernel/scheduler.js`, déjà en service pour dix autres tâches.
// Aucun processus de plus à surveiller, aucune bibliothèque de file.
//
// Il prend quelques missions dues, avance CHACUNE d'UNE étape, et rend la
// main. Le battement suivant reprendra là où celui-ci s'est arrêté — y
// compris après un redémarrage, puisque tout est en base.
//
// ── IL NE LÈVE JAMAIS ────────────────────────────────────────────────────
//
// Une mission qui explose ne doit pas empêcher les autres d'avancer, ni
// arrêter le battement. C'est la même règle que le socle des agents, pour la
// même raison : un incident isolé ne devient jamais une panne générale.
async function battement({ limite = 3 } = {}) {
    const prises = await prendre(limite);
    const faits = [];
    for (const ligne of prises) {
        try {
            faits.push({ id: ligne.id, ...(await avancerDUneEtape(ligne)) });
        } catch (err) {
            console.error(`❌ mission longue #${ligne.id} :`, err.message);
            await terminerEnEchec(ligne, `incident : ${err.message}`);
            faits.push({ id: ligne.id, ok: false, echouee: true });
        }
    }
    return faits;
}

// ── LES MISSIONS ABANDONNÉES ─────────────────────────────────────────────
//
// Un processus tué au milieu d'une étape laisse une mission verrouillée. Le
// bail expire seul, donc `prendre()` la reprendra — mais son compteur
// d'essais n'a pas bougé, et si le processus meurt à chaque fois sur la même
// étape, elle repartirait indéfiniment.
//
// Ce passage compte l'abandon comme un essai. Trois abandons et la mission
// échoue, au lieu de tuer le serveur une fois par heure pour toujours.
async function reprendreLesAbandonnees() {
    try {
        const rows = await db.query(
            `UPDATE missions_longues
                SET essais = essais + 1, verrou_par = NULL,
                    erreur = 'reprise après un arrêt du processus'
              WHERE etat = 'en_cours'
                AND verrou_jusqu IS NOT NULL AND verrou_jusqu < NOW()
              RETURNING id, essais, mission`);
        for (const r of rows) {
            if (r.essais >= ESSAIS_MAX) {
                await terminerEnEchec(r, `abandonnée ${r.essais} fois — le processus meurt sur cette mission`);
            }
        }
        return rows;
    } catch (err) {
        console.error("❌ missionsLongues.reprendreLesAbandonnees :", err.message);
        return [];
    }
}

module.exports = {
    ETATS, VIVANTS, BAIL_MS, ESSAIS_MAX, DUREE_MAX_MS, PAUSE_ENTRE_ETAPES_MS,
    etatValide, creer, prendre, lire, lister, annuler,
    avancerDUneEtape, battement, reprendreLesAbandonnees,
};
