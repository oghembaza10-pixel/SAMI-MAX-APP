// ==========================================================================
// SAMII OS — LE REGISTRE DES SPÉCIALISTES
// ==========================================================================
//
// UN SEUL SAMII.
//
// C'est la règle qui commande tout le fichier. Les agents ne sont pas des
// personnalités. Ils n'ont pas de nom visible, pas de voix, pas d'identité
// propre. Personne, dans le chat, ne doit jamais lire « le Stratège pense
// que… ». C'est SAMII qui parle, toujours, et ce qu'on déclare ici, ce sont
// ses SPÉCIALITÉS INTERNES — la façon dont il s'y prend quand une demande
// dépasse ce qu'on répond d'un trait.
//
// D'où `interne: true` sur chaque agent, et un test qui vérifie qu'aucun nom
// d'agent ne peut remonter jusqu'à l'écran.
//
// ── CE QUE CE FICHIER NE FAIT PAS ────────────────────────────────────────
//
// Il ne recrée aucun agent. Les sept spécialistes sociaux existent déjà,
// fonctionnent déjà, sont testés déjà (tests/social.test.js, 268
// vérifications). Ce fichier les DÉCLARE — ce qu'ils savent faire, ce qu'ils
// ont le droit de faire, dans quel ordre ils travaillent — pour que SAMII
// puisse enfin les appeler.
//
// ── LE TROU QU'IL COMBLE ─────────────────────────────────────────────────
//
// Mesuré avant d'écrire une ligne :
//
//     grep -c "agent\|engines/social" brain/planner.js   →   0
//
// Le planner ne connaissait pas les agents. `engines/social` n'était
// atteignable que depuis le cron, les scripts, le webhook Meta, et un écran
// marqué `router.use(requireFondateur)`. Autrement dit : un marchand qui
// écrivait « écris-moi une publication Facebook » dans le chat n'atteignait
// JAMAIS les sept agents. SAMII rédigeait un paragraphe et s'arrêtait là.
//
// Les agents existaient. Personne ne pouvait s'en servir.
//
// ── POURQUOI PAS UNE GROSSE TABLE DE RÈGLES ──────────────────────────────
//
// Parce qu'elle existe déjà. `brain/prompts/sovereign/tables.js` classe
// depuis toujours un message en huit domaines — business, strategie,
// programmation, marketing, finance, logistique, securite, crm — et
// `services/niveauAuto.js` pèse déjà la complexité et rend ses raisons.
//
// Une deuxième table aurait divergé de la première au premier changement.
// On branche donc les missions sur les domaines EXISTANTS.
// ==========================================================================

// ── LES EFFETS, DU PLUS INOFFENSIF AU PLUS DÉFINITIF ─────────────────────
//
// C'est sur cette échelle que les permissions se décident, PAS sur le nom de
// l'agent. Un agent ne se voit jamais accorder un droit parce qu'il s'appelle
// « publisher » : il se le voit accorder parce que sa mission a tel effet et
// que la personne a tel palier, telle posture, tel niveau.
//
//   lecture   ne change rien nulle part. On peut se tromper sans conséquence.
//   prepare   fabrique quelque chose qui reste chez nous, en attente. Un
//             brouillon, un plan, une variante non publiée. Réversible.
//   publie    sort de la maison : une publication sur un vrai compte, un
//             message à un vrai client, de l'argent qui bouge. Irréversible.
const EFFETS = ["lecture", "prepare", "publie"];

function effetPlusFort(a, b) {
    return EFFETS.indexOf(a) >= EFFETS.indexOf(b) ? a : b;
}

// ══════════════════════════════════════════════════════════════════════════
// LES SPÉCIALISTES
// ══════════════════════════════════════════════════════════════════════════
//
// `famille` — d'où ils viennent. « social » est la PREMIÈRE famille, pas la
// seule prévue : vente, prospection, CRM, marketing, finance, logistique,
// programmation, recherche et contenu viendront s'ajouter ici sans que rien
// d'autre ne bouge. On ne les invente pas aujourd'hui — on fait la place.
//
// `effet` — ce que CET agent fait au monde. La mission prend le plus fort de
// ses agents : une chaîne qui finit par publier est une chaîne qui publie,
// même si ses quatre premiers maillons ne font que réfléchir.
//
// `outils` — les outils que cet agent a le droit d'employer. VIDE pour les
// sept agents sociaux, et ce n'est pas un oubli : ils passent par
// `engines/social/providers`, jamais par le function calling de SAMII. Le
// champ existe pour les agents à venir, et pour que la garde qui vérifie
// « cet agent n'utilise que des outils autorisés au tour » ait quelque chose
// à vérifier dès maintenant.
const AGENTS = {
    strategist: {
        id: "strategist", libelle: "Stratégie éditoriale", famille: "social",
        interne: true, effet: "lecture", outils: [],
        pourQuoi: "décide quoi dire, où, et quand",
    },
    creator: {
        id: "creator", libelle: "Rédaction", famille: "social",
        interne: true, effet: "prepare", outils: [],
        pourQuoi: "écrit le contenu source, une seule fois",
    },
    adapter: {
        id: "adapter", libelle: "Adaptation par plateforme", famille: "social",
        interne: true, effet: "prepare", outils: [],
        pourQuoi: "décline le contenu au format de chaque plateforme",
    },
    reviewer: {
        id: "reviewer", libelle: "Relecture", famille: "social",
        interne: true, effet: "lecture", outils: [],
        pourQuoi: "approuve ou refuse, variante par variante",
    },
    publisher: {
        id: "publisher", libelle: "Publication", famille: "social",
        interne: true, effet: "publie", outils: [],
        pourQuoi: "programme et envoie sur les vrais comptes",
    },
    // ── LA FAMILLE « CODE » : la deuxième, et la place était faite ───────
    //
    // Le chantier 8 disait « on fait la place, on n'invente pas 20 agents ».
    // Voici la première famille qui s'ajoute, et elle n'a demandé aucune
    // modification de la couche d'orchestration : mêmes permissions, même
    // trace, même vérification, même garde de double exécution.
    executeur: {
        id: "executeur", libelle: "Exécution en bac", famille: "code",
        interne: true,
        // `prepare` et non `publie` : le code tourne dans un dossier jetable,
        // sans réseau, et rien n'en sort à part du texte. Ce n'est pas une
        // lecture non plus — il consomme du calcul et peut échouer.
        effet: "prepare", outils: [],
        pourQuoi: "fait tourner le programme dans un bac isolé et rend sa sortie",
    },
    correcteur: {
        id: "correcteur", libelle: "Correction après erreur", famille: "code",
        interne: true, effet: "prepare", outils: [],
        pourQuoi: "lit l'erreur, corrige le programme, et on réessaie",
    },

    analytics: {
        id: "analytics", libelle: "Mesure", famille: "social",
        interne: true, effet: "lecture", outils: [],
        pourQuoi: "relève ce que les publications ont donné",
    },
    learning: {
        id: "learning", libelle: "Apprentissage", famille: "social",
        interne: true, effet: "lecture", outils: [],
        pourQuoi: "tire des conclusions des relevés, quand il y en a assez",
    },
};

// ══════════════════════════════════════════════════════════════════════════
// LES MISSIONS
// ══════════════════════════════════════════════════════════════════════════
//
// UNE MISSION EST UNE CHAÎNE ORDONNÉE, PAS UN AGENT.
//
// C'est la réponse à « une tâche peut nécessiter plusieurs spécialistes ».
// La mission dit QUI travaille et DANS QUEL ORDRE. Les agents ne s'appellent
// jamais entre eux : ils ne se connaissent même pas. SAMII tient la liste,
// SAMII avance d'un cran, SAMII s'arrête si un maillon échoue.
//
// Si les agents s'appelaient les uns les autres, deux choses arriveraient,
// et les deux sont arrivées dans de vrais systèmes : une boucle que personne
// ne voit venir, et un agent qui obtient par la bande un droit qu'on ne lui
// a pas donné, parce que son appelant l'avait.
//
// ── DEUX FAÇONS D'EXÉCUTER, ET C'EST VOULU ───────────────────────────────
//
//   `executer`  la mission délègue à un moteur qui sait déjà orchestrer sa
//               propre chaîne. C'est le cas du social : `engines/social`
//               enchaîne créateur → adaptateur → relecteur depuis des mois,
//               c'est testé, ça marche. Le réécrire ici serait exactement le
//               « ne recrée pas ce qui existe » qu'on veut éviter.
//
//   `chaine`    la mission est exécutée maillon par maillon par la couche
//               générique (brain/agents.js). C'est le chemin des familles à
//               venir, qui n'auront pas leur propre moteur.
//
// Les deux passent par la MÊME porte : mêmes permissions, même trace, même
// vérification. La façon d'exécuter change ; ce qui est autorisé, non.
const MISSIONS = {
    publication_sociale: {
        id: "publication_sociale",
        libelle: "Préparer une publication",
        // Les domaines de brain/prompts/sovereign/tables.js — pas une
        // nouvelle liste. `marketing` couvre pub/contenu/tiktok/instagram/meta.
        domaines: ["marketing"],
        agents: ["creator", "adapter", "reviewer"],
        // Le plus fort des trois : `prepare`. La chaîne s'arrête AVANT la
        // publication — c'est `engines/social.preparer()` qui le garantit,
        // et son commentaire le dit : « Ne publie JAMAIS, quel que soit le
        // mode ». Programmer puis publier sont des décisions distinctes,
        // prises ailleurs, par quelqu'un.
        effet: "prepare",
        // L'outil par lequel SAMII déclenche cette mission. C'est le pont :
        // le modèle appelle un outil, comme pour n'importe quelle action, et
        // l'outil ouvre la chaîne. Pas de deuxième mécanisme de décision.
        outil: "preparer_publication",
        // ── POURQUOI PRO ET PAS EXPERT ───────────────────────────────────
        //
        // CORRIGÉ PAR LE TEST, PAS PAR LA RELECTURE. Premier jet :
        // `niveauMin: "expert"`. Mais `config/niveaux.js` n'accorde la
        // famille « agents » qu'à Pro et Maître — deux tables disaient donc
        // deux choses différentes, et c'est celle qui autorise le plus qui
        // aurait gagné dans l'un des deux chemins.
        //
        // Le fond : une mission coûte autant d'appels qu'elle a de maillons.
        // Trois plateformes, c'est sept ou huit appels. Ouvrir ça au niveau
        // Expert reviendrait à vendre un tour au prix d'un message et à en
        // payer sept.
        niveauMin: "pro",
        async executer(entree, contexte) {
            // Requis ici et pas en tête de fichier : `engines/social/index.js`
            // branche ses collecteurs AU CHARGEMENT et tire toute la chaîne
            // de providers avec lui. Un fichier de configuration lu par le
            // chat ne doit pas faire ça à chaque démarrage.
            const social = require("../engines/social");
            return social.preparer({
                workspaceId: contexte.workspaceId,
                communaute: contexte.communaute,
                theme: entree.theme,
                objectif: entree.objectif,
                angle: entree.angle,
                cibles: entree.plateformes,
                creePar: contexte.creePar,
            });
        },
        // ── CE QU'ON EXIGE DU RÉSULTAT ───────────────────────────────────
        //
        // « Un agent ne doit pas simplement dire : Terminé. »
        //
        // La mission déclare ce qu'un succès CONTIENT. La couche de
        // vérification compare, et ce qui manque est nommé. Sans cette
        // déclaration, « ok: true » suffirait — et un post créé dont toutes
        // les variantes ont été refusées passerait pour une réussite.
        attendu: {
            champs: ["postId", "variantes"],
            verifier(resultat) {
                const manques = [];
                if (!resultat.postId) manques.push("aucun post n'a été enregistré");
                if (!Array.isArray(resultat.variantes) || !resultat.variantes.length) {
                    manques.push("aucune variante n'a été produite");
                }
                // Zéro variante approuvée n'est PAS un échec technique — le
                // relecteur a fait son travail. Mais ce n'est pas « c'est
                // fait » non plus : il faut le dire, et dire pourquoi.
                if (Array.isArray(resultat.variantes) && resultat.variantes.length
                    && !resultat.variantes.some((v) => v.approuve)) {
                    manques.push("aucune variante n'a passé la relecture");
                }
                return manques;
            },
        },
    },
    // ══════════════════════════════════════════════════════════════════════
    // EXÉCUTER DU CODE — comprendre, écrire, exécuter, corriger, retester
    // ══════════════════════════════════════════════════════════════════════
    //
    // LA SÉPARATION EST LE CŒUR DE CETTE MISSION.
    //
    //   ÉCRIRE le code    c'est le modèle, avant d'arriver ici. Le programme
    //                     est déjà dans les arguments de l'outil.
    //   DÉCIDER du droit  c'est brain/agents.js, en amont.
    //   EXÉCUTER          c'est services/bacDExecution.js, et lui seul.
    //   CORRIGER          c'est le modèle à nouveau, avec l'erreur en main.
    //   FACTURER          c'est config/credits.js, après.
    //
    // Cette mission ne fait qu'une chose : tenir la BOUCLE. Exécuter, lire
    // l'erreur, demander une correction, réexécuter, et s'arrêter.
    //
    // ── POURQUOI LA BOUCLE EST BORNÉE À DEUX CORRECTIONS ─────────────────
    //
    // Chaque tour coûte un appel d'IA plus une exécution. Une boucle sans
    // borne sur un bug que le modèle ne sait pas voir, c'est une facture qui
    // monte sans fin pour un résultat qui n'arrivera pas. Deux essais
    // rattrapent la faute d'inattention — une virgule, un nom de variable —
    // qui est le cas courant. Au-delà, le problème n'est pas dans le code.
    executer_code: {
        id: "executer_code",
        libelle: "Exécuter un programme",
        // `programmation` est un des huit domaines existants
        // (brain/prompts/sovereign/tables.js) : « code|programme|javascript|
        // node|api|bug|erreur ». Aucun nouveau domaine.
        domaines: ["programmation"],
        agents: ["executeur", "correcteur"],
        effet: "prepare",
        outil: "executer_code",
        // Maître seulement — même verrou que la famille d'outils. Les deux
        // doivent dire la même chose, et un test le vérifie : deux tables qui
        // se contredisent, c'est celle qui autorise le plus qui gagne dans un
        // des deux chemins.
        niveauMin: "maitre",
        async executer(entree, contexte) {
            return require("../services/boucleDeCode").resoudre(entree, contexte);
        },
        attendu: {
            champs: ["execute", "sortie"],
            verifier(resultat) {
                const manques = [];
                if (resultat.execute !== true) {
                    manques.push(resultat.refuse
                        ? `aucune exécution : ${resultat.raison || "refusée"}`
                        : "le programme n'a jamais été exécuté");
                }
                // ── « ÇA A TOURNÉ » N'EST PAS « ÇA A MARCHÉ » ────────────
                //
                // Un programme peut se terminer proprement sans rien écrire.
                // Le rendre comme une réussite ferait dire à SAMII « voilà le
                // résultat » en montrant du vide.
                if (resultat.execute === true && !String(resultat.sortie || "").trim()) {
                    manques.push("le programme s'est exécuté sans rien produire");
                }
                return manques;
            },
        },
    },
};

// ── LIRE ─────────────────────────────────────────────────────────────────
//
// Rendent `null` sur un inconnu. Un appelant doit pouvoir distinguer
// « ça n'existe pas » de « ça existe et c'est vide » — c'est la différence
// entre un identifiant mal tapé et une mission sans agent.
function agent(id) {
    return AGENTS[String(id || "").toLowerCase()] || null;
}

function mission(id) {
    return MISSIONS[String(id || "").toLowerCase()] || null;
}

// La mission déclenchée par un outil donné. C'est le pont, lu dans l'autre
// sens : le modèle a appelé `preparer_publication`, quelle chaîne ouvre-t-il ?
function missionParOutil(nomOutil) {
    return Object.values(MISSIONS).find((m) => m.outil === nomOutil) || null;
}

// Les missions qui savent servir ce domaine. Rendues dans l'ordre de
// déclaration — il n'y en a qu'une aujourd'hui, il y en aura plusieurs.
function missionsPourDomaine(domaine) {
    const d = String(domaine || "").toLowerCase();
    return Object.values(MISSIONS).filter((m) => m.domaines.includes(d));
}

// ── L'EFFET RÉEL D'UNE MISSION ───────────────────────────────────────────
//
// Déclaré sur la mission, mais RECALCULÉ depuis ses agents et comparé. Une
// mission qui déclarerait `lecture` en embarquant le publieur mentirait aux
// permissions — et c'est exactement le genre de mensonge qu'on ne voit pas
// en relisant, parce que les deux lignes sont à vingt lignes d'écart.
function effetReel(idMission) {
    const m = mission(idMission);
    if (!m) return null;
    let effet = "lecture";
    for (const idAgent of m.agents) {
        const a = agent(idAgent);
        if (a) effet = effetPlusFort(effet, a.effet);
    }
    return effet;
}

// Tous les outils que les agents d'une mission peuvent employer. Sert à la
// garde « un agent n'utilise que ce qui est autorisé au tour » : on compare
// cet ensemble à ce que le niveau, l'audience et le moteur ont concédé.
function outilsDeLaMission(idMission) {
    const m = mission(idMission);
    if (!m) return [];
    const outils = new Set();
    for (const idAgent of m.agents) {
        for (const o of agent(idAgent)?.outils || []) outils.add(o);
    }
    return [...outils];
}

module.exports = {
    AGENTS, MISSIONS, EFFETS,
    agent, mission, missionParOutil, missionsPourDomaine,
    effetReel, outilsDeLaMission, effetPlusFort,
};
