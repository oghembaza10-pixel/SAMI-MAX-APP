// ==========================================================================
// SAMII OS — LA COUCHE D'ORCHESTRATION
// ==========================================================================
//
//   SAMII → INTENTION → NIVEAU → MOTEUR → PLAN → AGENT(S) → OUTILS
//         → VÉRIFICATION → RÉSULTAT
//
// Ce fichier tient les quatre derniers maillons. Les trois premiers existent
// déjà : `brain/prompts/sovereign/tables.js` donne l'intention (le domaine),
// `services/niveauAuto.js` donne le niveau, `config/moteurs.js` donne le
// moteur. On ne les refait pas — on s'y branche.
//
// ── LA RÈGLE QUI COMMANDE TOUT ───────────────────────────────────────────
//
// UN AGENT NE PEUT JAMAIS OBTENIR UN DROIT QUE SAMII N'A PAS AU MÊME MOMENT.
//
// Pas « ne devrait pas » : ne PEUT pas. Les permissions sont vérifiées ICI,
// avant qu'un seul agent démarre, et la liste des outils d'une mission est
// comparée à ce que le tour concède réellement — niveau ∩ audience ∩ moteur,
// exactement l'intersection du chantier 7.
//
// C'est la seule façon d'empêcher le glissement classique : un agent lancé
// depuis un tour « lecture » qui, trois maillons plus loin, envoie un e-mail
// parce que son code savait le faire.
//
// ── LES AGENTS NE S'APPELLENT PAS ENTRE EUX ──────────────────────────────
//
// Ils ne se connaissent pas. `config/agents.js` déclare l'ordre, ce fichier
// avance d'un cran à la fois, et s'arrête au premier maillon qui échoue. Un
// agent qui appellerait le suivant ferait deux dégâts : une boucle que
// personne ne voit venir, et un droit transmis par la bande.
//
// ── UN SEUL SAMII ────────────────────────────────────────────────────────
//
// Rien de ce qui sort d'ici ne nomme un agent à la personne. Les noms
// servent à la trace et au diagnostic. Ce qui remonte au chat, c'est un
// résultat — SAMII ne dit jamais « mon Stratège a décidé ».
// ==========================================================================

const AGENTS = require("../config/agents");
const NIVEAUX = require("../config/niveaux");
const MOTEURS = require("../config/moteurs");

// Le socle existant : coupure d'agent et trace en base. Il vit sous
// engines/social/ parce que c'est là qu'il est né, mais il n'a jamais rien
// eu de social — il enveloppe un travail, le chronomètre, le trace et
// rattrape ses erreurs. Le déplacer casserait sept agents en service pour un
// gain de rangement ; on s'en sert là où il est.
const socle = require("../engines/social/agents/base");

// ══════════════════════════════════════════════════════════════════════════
// 1. CHOISIR — cette demande a-t-elle besoin d'un spécialiste ?
// ══════════════════════════════════════════════════════════════════════════
//
// Trois réponses possibles, et la première est de loin la plus fréquente :
//
//   "reponse"      SAMII répond, point. C'est le cas ordinaire.
//   "specialiste"  une mission ouvre une chaîne.
//   "plusieurs"    plusieurs missions se disputent la demande.
//
// AUCUNE LISTE DE RÈGLES N'EST ÉCRITE ICI. Le domaine vient du détecteur
// existant, la complexité du peseur existant. Ce fichier ne fait que les
// croiser avec le registre.
function choisir({ message = "", context = {} } = {}) {
    const niveauAuto = require("../services/niveauAuto");
    const competences = require("../services/competences");

    // ── LE MÉTIER ENTRE DANS LE CHOIX ────────────────────────────────────
    //
    // Chantier 9. Avant, le domaine venait du seul message. Il vient
    // désormais de l'arbitrage métier × message, qui est la MÊME fonction que
    // celle qui nourrit le prompt des deux chats — donc une seule lecture du
    // métier dans tout le projet.
    //
    // Ce que ça change, concrètement : un e-commerçant qui écrit « j'ai 20
    // commandes en retard » ne déclenche plus une mission marketing. Le
    // message dit `logistique`, le métier tire vers `business`, et le message
    // l'emporte — donc aucune chaîne de publication ne s'ouvre. Avant, le
    // détecteur rendait `business` sur cette phrase (le mot « commande »),
    // et le métier n'était pas lu du tout.
    const lecture = competences.arbitrer({ metier: context.metier || null, message });
    const domaine = lecture.domaine;
    const poids = niveauAuto.peser(message, { piece: context.piece || null, domaine });

    const candidates = AGENTS.missionsPourDomaine(domaine);
    const raisons = [...lecture.raisons, ...poids.raisons];

    if (!candidates.length) {
        return { besoin: "reponse", missions: [], domaine, raisons, poids: poids.score };
    }

    // ── UN GESTE SIMPLE NE MOBILISE PERSONNE ─────────────────────────────
    //
    // « Merci », « traduis ça » : le peseur les reconnaît déjà et ramène le
    // score à zéro. Faire tourner cinq agents là-dessus coûterait cinq
    // appels d'IA pour une politesse.
    if (poids.gesteSimple) {
        return {
            besoin: "reponse", missions: [], domaine,
            raisons: [...raisons, "geste simple : aucun spécialiste"], poids: poids.score,
        };
    }

    const retenues = candidates.filter((m) => NIVEAUX.comparer(context.niveau || NIVEAUX.DEFAUT, m.niveauMin) >= 0);
    const ecartees = candidates
        .filter((m) => !retenues.includes(m))
        .map((m) => ({ id: m.id, raison: `demande le niveau ${m.niveauMin} au minimum` }));

    if (!retenues.length) {
        return { besoin: "reponse", missions: [], domaine, raisons, ecartees, poids: poids.score };
    }

    return {
        besoin: retenues.length > 1 ? "plusieurs" : "specialiste",
        missions: retenues.map((m) => m.id),
        domaine, raisons, ecartees, poids: poids.score,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// 2. AUTORISER — la porte unique
// ══════════════════════════════════════════════════════════════════════════
//
// TOUT passe par ici, la délégation comme la chaîne générique. Une deuxième
// porte finirait par ne plus poser les mêmes questions que la première, et
// c'est toujours celle qu'on oublie qui laisse passer.
//
// Rend `{ autorise, refus }`. `refus` est une PHRASE, destinée à être lue :
// un refus qu'on ne sait pas expliquer se contourne, parce que personne ne
// comprend ce qu'il protège.
function autoriser({ missionId, context = {} } = {}) {
    const m = AGENTS.mission(missionId);

    // ── MISSION INCONNUE ─────────────────────────────────────────────────
    //
    // Échec FERMÉ. Une mission qu'on ne connaît pas ne s'exécute pas « au
    // cas où » : le jour où un identifiant est mal tapé, on veut un refus
    // net, pas une chaîne vide qui rend « c'est fait ».
    if (!m) return { autorise: false, refus: `mission inconnue : ${missionId}` };

    // ── LE COUPE-CIRCUIT ─────────────────────────────────────────────────
    //
    // Lu à chaque appel, jamais au chargement — couper un agent un dimanche
    // soir doit prendre effet tout de suite, pas au prochain déploiement.
    // Un seul maillon coupé arrête la mission : une chaîne amputée d'un
    // maillon ne produit pas un résultat partiel, elle produit un résultat
    // FAUX (un contenu jamais relu, par exemple).
    for (const idAgent of m.agents) {
        if (socle.estCoupe(idAgent)) {
            return { autorise: false, refus: `un spécialiste nécessaire est coupé (${idAgent})`, coupe: idAgent };
        }
    }

    // ── LE NIVEAU ────────────────────────────────────────────────────────
    const niveau = context.niveau || NIVEAUX.DEFAUT;
    if (NIVEAUX.comparer(niveau, m.niveauMin) < 0) {
        return { autorise: false, refus: `cette mission demande le niveau ${m.niveauMin}, le tour est en ${niveau}` };
    }

    // ── L'EFFET DÉCLARÉ DOIT ÊTRE L'EFFET RÉEL ───────────────────────────
    //
    // Recalculé depuis les agents, comparé au déclaré. Une mission qui
    // annoncerait « lecture » en embarquant le publieur obtiendrait des
    // droits de lecture pour faire un acte de publication. Les deux lignes
    // sont à vingt lignes d'écart dans le registre : personne ne le verrait
    // en relisant.
    const reel = AGENTS.effetReel(missionId);
    if (reel !== m.effet) {
        return {
            autorise: false,
            refus: `mission mal déclarée : elle annonce « ${m.effet} » mais ses spécialistes font « ${reel} »`,
        };
    }

    // ── LES ACTES IRRÉVERSIBLES DEMANDENT UNE POSTURE ────────────────────
    //
    // `publie` sort de la maison. On réutilise la règle d'autonomie qui
    // existe déjà (routes/samii-mode.js) plutôt que d'en écrire une seconde
    // — elle croise la posture choisie et le palier payé.
    if (reel === "publie") {
        const { canActAutonomously } = require("../routes/samii-mode");
        if (!canActAutonomously(context.mode, context.palier)) {
            return {
                autorise: false,
                refus: "cette mission publie pour de vrai : elle demande une posture autonome et un abonnement qui l'autorise",
            };
        }
    }

    // ── LES OUTILS : L'INTERSECTION DU CHANTIER 7, APPLIQUÉE AUX AGENTS ──
    //
    // C'est la garde la plus importante du fichier. Les outils que les
    // agents d'une mission peuvent employer sont comparés à ce que CE
    // tour-là concède réellement : le niveau, l'audience, et le moteur qui
    // répond.
    //
    // Sans elle, un agent hériterait des droits de son code plutôt que de
    // ceux de la personne — et une bascule de secours sur un relais
    // rendrait à un agent un outil que le chantier 7 venait de lui retirer.
    const voulus = AGENTS.outilsDeLaMission(missionId);
    if (voulus.length) {
        const permis = new Set(NIVEAUX.outilsDe(niveau));
        if (context.audience !== "souverain" && context.allowActions !== false) {
            for (const nom of NIVEAUX.FAMILLES.commerce) permis.add(nom);
        }
        const fiables = new Set(MOTEURS.outilsFiablesDe(context.moteur || "gemini"));
        const interdits = voulus.filter((o) => !permis.has(o) || !fiables.has(o));
        if (interdits.length) {
            return {
                autorise: false,
                refus: `un spécialiste voudrait employer ${interdits.join(", ")}, que ce tour n'autorise pas`,
                interdits,
            };
        }
    }

    return { autorise: true, mission: m, effet: reel };
}

// ══════════════════════════════════════════════════════════════════════════
// 3. VÉRIFIER — « terminé » ne suffit pas
// ══════════════════════════════════════════════════════════════════════════
//
// Le relecteur social avait déjà la bonne forme : des BLOQUANTS (des faits
// vérifiables par du code) et des REMARQUES (des jugements). On généralise
// cette forme, sans emporter ses contrôles — hashtags, plateformes et
// doublons de publication n'ont rien à faire dans une couche générique.
//
// Ce qu'on vérifie ici :
//   • la mission a-t-elle rendu quelque chose ?
//   • ce quelque chose contient-il ce que la mission avait ANNONCÉ ?
//   • une erreur a-t-elle été rattrapée en silence ?
//
// Un agent qui rend `{ ok: true }` et rien d'autre échoue cette vérification.
// C'est le but : « c'est fait » n'est pas un résultat, c'est une affirmation.
function verifier({ missionId, resultat } = {}) {
    const m = AGENTS.mission(missionId);
    const bloquants = [];
    const remarques = [];

    if (!m) return { verdict: "refuse", conforme: false, bloquants: [`mission inconnue : ${missionId}`], remarques };

    if (!resultat || typeof resultat !== "object") {
        return { verdict: "refuse", conforme: false, bloquants: ["la mission n'a rien rendu"], remarques };
    }
    if (resultat.ok === false) {
        bloquants.push(resultat.erreur ? `échec : ${resultat.erreur}` : "échec sans motif rendu");
        // On s'arrête là : inutile de reprocher des champs manquants à un
        // résultat qui annonce lui-même son échec. Ce serait du bruit, et le
        // bruit fait perdre le vrai motif.
        return { verdict: "refuse", conforme: false, bloquants, remarques, etape: resultat.etape || null };
    }

    // Les champs que la mission avait annoncés.
    for (const champ of m.attendu?.champs || []) {
        if (resultat[champ] === undefined || resultat[champ] === null) {
            bloquants.push(`le résultat ne porte pas « ${champ} », que cette mission annonce toujours`);
        }
    }

    // Le contrôle propre à la mission.
    if (typeof m.attendu?.verifier === "function") {
        for (const manque of m.attendu.verifier(resultat) || []) bloquants.push(manque);
    }

    // ── UNE ÉTAPE EN ÉCHEC DANS UNE MISSION « RÉUSSIE » ──────────────────
    //
    // `engines/social.preparer` rend `etapes[]` avec l'état de chaque
    // maillon. Un maillon en échec dans une mission qui se dit réussie n'est
    // pas bloquant — mais le taire serait mentir par omission.
    for (const e of resultat.etapes || []) {
        if (e && e.ok === false) remarques.push(`le spécialiste « ${e.agent} » a échoué : ${e.erreur || "sans motif"}`);
    }

    return {
        verdict: bloquants.length ? "refuse" : "approuve",
        conforme: !bloquants.length,
        bloquants, remarques,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// 4. EXÉCUTER
// ══════════════════════════════════════════════════════════════════════════
//
// ── LA GARDE DE DOUBLE EXÉCUTION ─────────────────────────────────────────
//
// Deux clics, deux onglets, un relais qui rejoue un appel d'outil : la même
// mission peut partir deux fois à quelques millisecondes d'intervalle. Pour
// une mission qui prépare une publication, ça fait deux posts.
//
// `engines/social` a déjà sa garde côté base (l'empreinte du contenu). Celle
// d'ici est en amont et générique : tant qu'une mission tourne pour un
// workspace, la même ne redémarre pas. Elle ne remplace pas l'autre — les
// deux servent, à deux moments différents.
const enCours = new Map();

function cleDeCourse(missionId, context, entree) {
    return [missionId, context.workspaceId || "-", JSON.stringify(entree || {})].join("|");
}

async function executer({ missionId, entree = {}, context = {}, reessais = 1 } = {}) {
    const porte = autoriser({ missionId, context });
    if (!porte.autorise) {
        return { ok: false, refuse: true, erreur: porte.refus, mission: missionId, agents: [] };
    }
    const m = porte.mission;
    const cle = cleDeCourse(missionId, context, entree);

    if (enCours.has(cle)) {
        return {
            ok: false, refuse: true, mission: missionId, agents: m.agents,
            erreur: "cette même mission est déjà en cours — je ne la lance pas deux fois",
        };
    }
    enCours.set(cle, Date.now());

    try {
        let dernier = null;
        let controle = null;

        // ── LES REPRISES ─────────────────────────────────────────────────
        //
        // Une reprise n'est PAS un droit acquis : elle ne rejoue que ce qui
        // a échoué pour une raison qui peut passer (moteur indisponible,
        // réseau). Un refus de permission ou un résultat non conforme ne se
        // rejoue pas — réessayer ne le rendrait pas plus autorisé, et on
        // aurait payé deux fois pour le même non.
        const maxEssais = Math.max(1, Math.min(Number(reessais) || 1, 3));
        for (let essai = 1; essai <= maxEssais; essai++) {
            dernier = await lancer(m, entree, context);
            controle = verifier({ missionId, resultat: dernier });
            if (controle.conforme) break;
            if (essai < maxEssais && !rejouable(dernier)) break;
        }

        return {
            ok: controle.conforme,
            mission: missionId,
            // Les noms des spécialistes sortent d'ici pour la TRACE et le
            // diagnostic. Ils ne sont jamais destinés à l'écran : c'est
            // SAMII qui parle, pas « le Stratège ».
            agents: m.agents,
            effet: porte.effet,
            resultat: dernier,
            verification: controle,
            erreur: controle.conforme ? null : controle.bloquants.join(" ; "),
        };
    } finally {
        // Dans un `finally` : une exception qui laisserait la clé posée
        // bloquerait cette mission pour toute la vie du processus.
        enCours.delete(cle);
    }
}

// Ce qui mérite une seconde tentative : une panne, pas un refus. Un contenu
// que le relecteur a refusé sera refusé à l'identique la fois suivante.
function rejouable(resultat) {
    const motif = String(resultat?.erreur || "");
    if (!motif) return false;
    return /indisponible|timeout|réseau|reseau|epuis|épuis|surcharg|ECONN|ETIMEDOUT|aucune réponse de l'IA/i.test(motif);
}

// Exécute la mission : soit elle délègue à un moteur qui orchestre déjà sa
// chaîne, soit on déroule ses maillons ici. Dans les deux cas chaque maillon
// passe par `socle.executer` — donc chronométré, tracé, et incapable de
// faire tomber la file en levant.
async function lancer(m, entree, context) {
    if (typeof m.executer === "function") return m.executer(entree, context);

    // Le chemin générique : les familles à venir, qui n'ont pas de moteur.
    const etapes = [];
    let passe = { ...entree };
    for (const idAgent of m.agents) {
        const a = AGENTS.agent(idAgent);
        if (!a || typeof a.executer !== "function") {
            etapes.push({ agent: idAgent, ok: false, erreur: "spécialiste sans exécution déclarée" });
            return { ok: false, etape: idAgent, erreur: `le spécialiste « ${idAgent} » n'a pas d'exécution`, etapes };
        }
        const r = await socle.executer(idAgent,
            { workspaceId: context.workspaceId, entree: { mission: m.id } },
            () => a.executer(passe, context));
        etapes.push({ agent: idAgent, ok: r.ok, erreur: r.erreur });
        if (!r.ok) return { ok: false, etape: idAgent, erreur: r.erreur, etapes };
        // Le maillon suivant reçoit ce que le précédent a produit — et rien
        // du contexte d'appel : un agent ne doit pas hériter des droits ni
        // des secrets de son voisin.
        passe = { ...passe, ...r };
    }
    return { ok: true, etapes, ...passe };
}

module.exports = { choisir, autoriser, verifier, executer, rejouable };
