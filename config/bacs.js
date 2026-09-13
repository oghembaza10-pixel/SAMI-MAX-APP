// ==========================================================================
// SAMII OS — LE REGISTRE DES BACS D'EXÉCUTION
// ==========================================================================
//
// EXÉCUTER DU CODE ÉCRIT PAR UNE IA, SUR LA MACHINE QUI FAIT TOURNER LES
// COMMERCES DE VRAIS MARCHANDS.
//
// C'est la capacité la plus dangereuse de tout le projet. Un outil qui se
// trompe envoie un mauvais e-mail ; du code qui s'échappe lit la base, les
// clés, les commandes de tout le monde. Ce fichier ne décrit donc pas ce
// qu'on aimerait avoir : il décrit CE QUI A ÉTÉ MESURÉ, ici, sur cette
// machine, et ce qui manque.
//
// ── CE QUI A ÉTÉ MESURÉ, COMMANDE PAR COMMANDE ───────────────────────────
//
//   docker              binaire présent, DÉMON INJOIGNABLE
//                       (« dial unix /var/run/docker.sock: no such file »)
//   unshare             présent, namespaces utilisateur + PID fonctionnels
//                       (3 processus visibles au lieu de toute la machine)
//   ulimit -t           fonctionne — une boucle infinie est coupée à 2 s
//   ulimit -v           INUTILISABLE pour Node : V8 réserve un grand espace
//                       virtuel et meurt avant de démarrer
//                       (« Failed to reserve virtual memory for CodeRange »)
//   --max-old-space-size fonctionne — le bon levier mémoire pour Node
//   timeout             fonctionne, borne l'horloge murale
//   remontage en lecture seule dans le namespace utilisateur : REFUSÉ
//
// ── LE TROU, DIT EN CLAIR ────────────────────────────────────────────────
//
// Avec unshare seul, le code exécuté A ÉCRIT dans /tmp de l'hôte et A LU
// /etc/passwd. Mesuré, pas supposé : le fichier était là après coup.
//
// Les namespaces PID et utilisateur isolent les PROCESSUS. Ils n'isolent pas
// le SYSTÈME DE FICHIERS. Sans un montage à part — que ce conteneur ne
// permet pas de créer — il n'y a pas de mur, seulement une porte fermée
// derrière laquelle le mur manque.
//
// ── CE QU'ON EN FAIT ─────────────────────────────────────────────────────
//
// ON REFUSE D'EXÉCUTER. Par défaut, aucun bac ne satisfait la condition
// « isole le système de fichiers », donc aucune exécution ne part. Ce n'est
// pas une panne : c'est le seul état honnête tant que le mur n'existe pas.
//
// L'abstraction est complète et testée. Le jour où un démon de conteneurs
// existe sur la machine, le bac `conteneur` passe disponible et TOUT le reste
// — permissions, limites, boucle de correction, nettoyage — fonctionne déjà.
//
// Un drapeau d'environnement permet d'ouvrir le bac dégradé pour du
// développement local. Il est nommé pour qu'on ne puisse pas le poser par
// distraction, et sa valeur doit être écrite en toutes lettres.
// ==========================================================================

// ══════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE DES GARANTIES
// ══════════════════════════════════════════════════════════════════════════
//
// UN SYSTÈME DOIT CONNAÎTRE SON PROPRE NIVEAU DE GARANTIE.
//
// C'est la règle qui commande ce fichier. « Bac isolé » ne veut rien dire :
// isolé de quoi, et jusqu'où ? Chaque axe porte donc un mot précis, et
// chaque mot a été VÉRIFIÉ par une commande sur cette machine.
//
//   "borne"        une limite existe et elle a été vue s'appliquer
//   "isole"        cloisonné par un espace de noms
//   "ferme"        rendu inaccessible (mesuré : la connexion est refusée)
//   "non_etanche"  le code peut sortir de son périmètre. Mesuré.
//   "non_garanti"  on ne sait pas, donc on répond non
//
// « non_etanche » et « non_garanti » ne sont pas des nuances d'écriture : ce
// sont des refus. Une tâche qui exige un axe non tenu n'est pas exécutée.
const NIVEAUX_DE_GARANTIE = ["ferme", "isole", "borne", "non_etanche", "non_garanti"];

// Les axes sur lesquels un bac se juge. Nommés une fois, comparés partout :
// un axe ajouté au registre et oublié dans une exigence serait un trou qui
// ne se voit pas.
const AXES = ["fichiers", "reseau", "cpu", "horloge", "memoire", "processus"];

// ── CE QU'UNE TÂCHE D'EXÉCUTION EXIGE, AU MINIMUM ────────────────────────
//
// C'est ICI que se joue le refus. Aucune tâche ne s'exécute si l'un de ces
// axes n'est pas tenu par le bac retenu.
//
// `fichiers: "etanche"` est l'exigence qu'AUCUN bac de cette machine ne
// satisfait. C'est délibéré et ce n'est pas provisoire : tant que
// l'infrastructure n'offre pas de conteneur, l'exécution est refusée.
const EXIGENCES = {
    fichiers: "etanche",
    reseau: "ferme",
    horloge: "borne",
    cpu: "borne",
    memoire: "borne",
    processus: "isole",
};

// Un axe est tenu si le bac l'annonce à la valeur exigée. Volontairement
// strict, sans échelle de « presque » : une garantie approximative est une
// garantie absente, et c'est comme ça qu'on finit par appeler « sécurisé »
// un bac qui écrit sur l'hôte.
function axeTenu(garanties, axe, exige) {
    const valeur = garanties?.[axe];
    if (!valeur) return false;
    if (valeur === "non_etanche" || valeur === "non_garanti") return false;
    return valeur === exige;
}

// Ce qui manque à un bac pour satisfaire des exigences données.
function manques(garanties, exigences = EXIGENCES) {
    return Object.entries(exigences)
        .filter(([axe, exige]) => !axeTenu(garanties, axe, exige))
        .map(([axe, exige]) => ({ axe, exige, obtenu: garanties?.[axe] || "inconnu" }));
}

// ── LES LIMITES PAR DÉFAUT ───────────────────────────────────────────────
//
// Volontairement serrées. Un marchand qui demande « calcule ma marge » n'a
// pas besoin de trente secondes ni d'un gigaoctet ; et une limite qu'on
// desserre « juste pour voir » ne se resserre jamais.
const LIMITES = {
    // Horloge murale, en millisecondes. Borne finale : même un programme qui
    // dort sans consommer de CPU finit par être arrêté.
    tempsMs: 10000,
    // Temps CPU en secondes (ulimit -t). Coupe les boucles infinies AVANT
    // l'horloge murale, sans attendre.
    cpuSecondes: 5,
    // Tas V8 en mégaoctets (--max-old-space-size). `ulimit -v` ne convient
    // pas : mesuré, il empêche Node de démarrer.
    memoireMo: 128,
    // Taille de fichier en blocs de 1 Ko (ulimit -f) : de quoi écrire un
    // résultat, pas de quoi remplir le disque.
    fichierKo: 2048,
    // Nombre de processus (ulimit -u) : ferme la bombe à fourches.
    processusMax: 64,
    // Ce qu'on garde de la sortie. Un programme bavard ne doit pas faire
    // enfler un prompt ni une facture.
    sortieMax: 8000,
};

// ── LES LANGAGES ─────────────────────────────────────────────────────────
//
// Un langage n'est pas ouvert parce que son interpréteur est installé : il
// est ouvert parce qu'on sait le BORNER. `commande` porte déjà ses garde-fous.
const LANGAGES = {
    javascript: {
        id: "javascript",
        libelle: "JavaScript (Node)",
        fichier: "programme.js",
        // Le drapeau mémoire fait partie de la commande : hors de portée du
        // code exécuté, contrairement à une variable d'environnement.
        commande: (limites) => ["node", `--max-old-space-size=${limites.memoireMo}`, "programme.js"],
    },
    python: {
        id: "python",
        libelle: "Python 3",
        fichier: "programme.py",
        // Python n'a pas d'équivalent de --max-old-space-size : sa mémoire
        // est bornée par le seul ulimit, moins précis. On le déclare quand
        // même pour que la disponibilité soit MESURÉE au démarrage et non
        // supposée — voir `disponible()`.
        commande: () => ["python3", "programme.py"],
    },
};

// ══════════════════════════════════════════════════════════════════════════
// LES BACS
// ══════════════════════════════════════════════════════════════════════════
//
// `murs` — ce que ce bac garantit RÉELLEMENT. Pas ce qu'il vise.
// `sonde` — la commande qui prouve qu'il est utilisable, ici, maintenant.
//           Un bac n'est jamais « disponible » parce qu'un binaire existe :
//           docker est installé sur cette machine et son démon ne répond pas.
const BACS = {
    // ── LE CONTENEUR : celui qui tiendrait tout, et il n'est pas là ──────
    conteneur: {
        id: "conteneur",
        libelle: "Conteneur jetable",
        garanties: {
            fichiers: "etanche",
            reseau: "ferme",
            cpu: "borne",
            horloge: "borne",
            memoire: "borne",
            processus: "isole",
        },
        // `docker info` interroge le DÉMON, pas le binaire. C'est la
        // différence entre « installé » et « utilisable », et c'est
        // exactement là que cette machine échoue.
        sonde: ["docker", "info"],
        rang: 0,
        pourquoi: "la seule forme qui ferme aussi le système de fichiers",
    },

    // ── LE PROCESSUS CLOISONNÉ : réel, mesuré, et incomplet ──────────────
    //
    // ⚠️ CE N'EST PAS UN BAC DE PRODUCTION, ET IL NE FAUT PAS L'APPELER
    // AINSI. Il tient cinq axes sur six. Le sixième est celui qui compte.
    //
    // CE QU'IL TIENT, VÉRIFIÉ COMMANDE PAR COMMANDE :
    //   processus  namespaces utilisateur + PID — 3 processus visibles
    //   cpu        ulimit -t — une boucle infinie coupée à 2 s
    //   memoire    --max-old-space-size — « Allocation failed » à la limite
    //   horloge    minuteur + SIGKILL du GROUPE — un programme qui dort
    //              120 s est arrêté à 2,5 s
    //   reseau     unshare --net — mesuré : ENETUNREACH, DNS muet
    //
    // CE QU'IL NE TIENT PAS :
    //   fichiers   MESURÉ : le code a écrit /tmp/EVASION sur l'hôte et lu
    //              /etc/passwd. Le remontage en lecture seule est REFUSÉ
    //              dans le namespace utilisateur de ce conteneur.
    //
    // Un vol ne demande pas plus que ça. Tant que `fichiers` vaut
    // « non_etanche », l'exigence n'est pas satisfaite et l'exécution est
    // refusée — sauf demande explicite pour du développement local.
    processus: {
        id: "processus",
        libelle: "Processus cloisonné (namespaces + limites)",
        garanties: {
            // Le mot dit ce qui a été mesuré, pas ce qu'on espérait.
            fichiers: "non_etanche",
            reseau: "ferme",
            cpu: "borne",
            horloge: "borne",
            memoire: "borne",
            processus: "isole",
        },
        sonde: ["unshare", "--version"],
        rang: 1,
        pourquoi: "borne le temps, le calcul, la mémoire et ferme le réseau — pas les fichiers",
        // Le drapeau, écrit en toutes lettres. Une phrase qui dit ce qu'on
        // accepte : impossible de la poser en croyant activer autre chose.
        drapeau: "EXECUTION_CODE_SANS_ISOLATION_FICHIERS",
        valeurDrapeau: "JE SAIS QUE LE CODE PEUT LIRE ET ECRIRE SUR LA MACHINE",
    },
};

const ORDRE = Object.values(BACS).sort((a, b) => a.rang - b.rang).map((b) => b.id);

// ── LA SONDE ─────────────────────────────────────────────────────────────
//
// On EXÉCUTE la commande. Un `command -v docker` aurait répondu oui sur
// cette machine, et l'exécution aurait échoué au premier essai, en
// production, sur la demande de quelqu'un.
//
// Le résultat est mis en cache : sonder à chaque message coûterait un
// processus par tour pour une réponse qui ne change pas.
const cache = new Map();

function sonder(idBac) {
    if (cache.has(idBac)) return cache.get(idBac);
    const b = BACS[idBac];
    if (!b) return false;
    let ok = false;
    try {
        const { spawnSync } = require("child_process");
        const r = spawnSync(b.sonde[0], b.sonde.slice(1), { timeout: 8000, stdio: "ignore" });
        ok = r.status === 0;
    } catch { ok = false; }
    cache.set(idBac, ok);
    return ok;
}

function oublierLesSondes() { cache.clear(); }

// Le bac est-il installé ET autorisé à servir ?
//
// Deux conditions distinctes, et les confondre serait le défaut : un bac peut
// être parfaitement installé et rester interdit parce qu'il lui manque le mur
// des fichiers.
function disponible(idBac, exigences = EXIGENCES) {
    const b = BACS[idBac];
    if (!b) return { ok: false, raison: `bac inconnu : ${idBac}`, manques: [] };
    if (!sonder(idBac)) {
        return { ok: false, raison: `${b.libelle} n'est pas utilisable sur cette machine`, manques: [] };
    }

    // ── LE REFUS EST LA RÈGLE, PAS L'EXCEPTION ───────────────────────────
    //
    // On compare les garanties DÉCLARÉES aux garanties EXIGÉES. Ce qui
    // manque est nommé axe par axe : « fichiers : etanche exigé, non_etanche
    // obtenu ». Un refus qu'on ne sait pas expliquer se contourne, parce que
    // personne ne comprend ce qu'il protège.
    const absents = manques(b.garanties, exigences);
    if (!absents.length) {
        return { ok: true, degrade: false, raison: b.libelle, manques: [], garanties: b.garanties };
    }

    const detail = absents.map((m) => `${m.axe} : « ${m.exige} » exigé, « ${m.obtenu} » obtenu`).join(" ; ");

    // ── LA SEULE PORTE DÉROBÉE, ET ELLE EST BRUYANTE ─────────────────────
    //
    // Pour du développement local. Elle n'ouvre QUE ce bac-là, elle exige une
    // phrase entière, et tout ce qui en sort est marqué `degrade: true`
    // jusqu'au bout de la chaîne — on ne peut pas oublier dans quel état on
    // est.
    const pose = String(process.env[b.drapeau] || "").trim().toUpperCase();
    if (b.drapeau && pose === b.valeurDrapeau) {
        return {
            ok: true, degrade: true, manques: absents, garanties: b.garanties,
            raison: `${b.libelle} — garanties manquantes (${detail}), ouvert explicitement pour du développement`,
        };
    }

    return {
        ok: false, degrade: false, manques: absents, garanties: b.garanties,
        raison: `${b.libelle} ne tient pas les garanties exigées — ${detail}. Exécution refusée.`,
    };
}

// ── CHOISIR ──────────────────────────────────────────────────────────────
//
// Rend le meilleur bac utilisable, ou aucun — avec la raison de chaque
// écart. Une chaîne vide est une réponse, pas une panne : c'est l'état de
// cette machine aujourd'hui, et il vaut mieux le dire que d'exécuter quand
// même.
function choisir(exigences = EXIGENCES) {
    const ecartes = [];
    for (const id of ORDRE) {
        const d = disponible(id, exigences);
        if (d.ok) {
            return {
                bac: BACS[id], degrade: Boolean(d.degrade), raison: d.raison,
                garanties: d.garanties, manques: d.manques, ecartes,
            };
        }
        ecartes.push({ id, raison: d.raison, manques: d.manques });
    }
    return {
        bac: null, degrade: false, garanties: null, manques: [],
        raison: "aucun bac ne tient les garanties exigées pour exécuter du code", ecartes,
    };
}

// ── L'ÉTAT DES GARANTIES, POUR QUI VEUT LE LIRE ──────────────────────────
//
// Une page, un journal, un rapport : tout le monde doit pouvoir demander
// « qu'est-ce qui est réellement tenu ici ? » et obtenir la même réponse.
// Deux lectures séparées finiraient par ne plus dire la même chose, et c'est
// toujours celle qu'on ne regarde pas qui ment.
function etat() {
    return {
        exigences: EXIGENCES,
        bacs: ORDRE.map((id) => {
            const d = disponible(id);
            return {
                id, libelle: BACS[id].libelle,
                installe: sonder(id),
                garanties: BACS[id].garanties,
                utilisable: d.ok,
                degrade: Boolean(d.degrade),
                manques: d.manques,
                raison: d.raison,
            };
        }),
        retenu: choisir().bac?.id || null,
    };
}

function langage(id) {
    return LANGAGES[String(id || "").toLowerCase()] || null;
}

function limites(demandees = {}) {
    // On ne DESSERRE jamais depuis l'appelant : un modèle qui écrit
    // « tempsMs: 600000 » dans ses arguments obtiendrait dix minutes de
    // calcul. On ne peut que resserrer.
    const l = { ...LIMITES };
    for (const [cle, valeur] of Object.entries(demandees)) {
        if (!(cle in LIMITES)) continue;
        const n = Number(valeur);
        if (Number.isFinite(n) && n > 0 && n < LIMITES[cle]) l[cle] = n;
    }
    return l;
}

module.exports = {
    BACS, LANGAGES, LIMITES, AXES, NIVEAUX_DE_GARANTIE, EXIGENCES, ORDRE,
    sonder, oublierLesSondes, disponible, choisir, etat,
    langage, limites, manques, axeTenu,
};
