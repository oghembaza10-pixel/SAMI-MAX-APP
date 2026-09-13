// ==========================================================================
// SAMII OS — LA COUCHE D'ORCHESTRATION : un agent n'a que les droits de SAMII
// ==========================================================================
//
// CE QUE CETTE SUITE SURVEILLE.
//
// Sept agents sociaux existaient, fonctionnaient, étaient testés — et
// PERSONNE NE POUVAIT LES APPELER. Mesuré avant d'écrire une ligne :
//
//     grep -c "agent\|engines/social" brain/planner.js   →   0
//
// `engines/social` n'était atteignable que depuis le cron, les scripts, le
// webhook Meta, et un écran marqué `router.use(requireFondateur)`. Un
// marchand qui écrivait « fais-moi une publication Facebook » recevait un
// paragraphe, et la chaîne rédaction → adaptation → relecture restait hors
// de portée.
//
// Le chantier 8 pose le pont. Cette suite vérifie que le pont ne transporte
// pas de droits avec lui.
//
// ── LA RÈGLE MESURÉE ICI ─────────────────────────────────────────────────
//
//   UN AGENT NE PEUT JAMAIS OBTENIR UN DROIT QUE SAMII N'A PAS AU MÊME
//   MOMENT.
//
// Pas « ne devrait pas ». La porte est unique, elle est vérifiée avant
// qu'un maillon démarre, et on la force de quinze façons différentes pour
// voir si elle cède.
//
// ── CE QUI EST RÉELLEMENT EXERCÉ ─────────────────────────────────────────
//
// RÉEL   : la sélection de mission, la porte des permissions, l'ordre de la
//          chaîne, la vérification du résultat, la garde de double
//          exécution, les reprises, le coupe-circuit, et le pont depuis le
//          planner avec un compte des appels d'IA réellement partis.
// SIMULÉ : le moteur d'IA (aucune clé ici) et `engines/social.preparer`,
//          remplacé par une doublure quand on veut choisir ce qu'il rend.
//          La suite `social` (268 vérifications) mesure le vrai, elle.
//
// Lancer :  npm test
// ==========================================================================

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "cle-essai-agents";

const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const REGISTRE = require(path.join(RACINE, "config", "agents.js"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux.js"));
const MOTEURS = require(path.join(RACINE, "config", "moteurs.js"));
const agents = require(path.join(RACINE, "brain", "agents.js"));

// Le contexte d'un marchand abonné Pro, dans son QG.
const PRO = { niveau: "pro", palier: "pro", mode: "autonome", audience: "souverain", workspaceId: "w1" };

// ══════════════════════════════════════════════════════════════════════════
// 1. UN SEUL SAMII : LES AGENTS N'ONT PAS D'IDENTITÉ VISIBLE
// ══════════════════════════════════════════════════════════════════════════
{
    for (const [id, a] of Object.entries(REGISTRE.AGENTS)) {
        verifier(a.interne === true,
            `le spécialiste « ${id} » n'est pas marqué interne : il pourrait finir par se présenter ` +
            "à la personne, et SAMII aurait l'air d'être plusieurs");
    }

    // ── LE NOM D'UN AGENT NE DOIT PAS ATTEINDRE L'ÉCRAN ──────────────────
    //
    // Le planner est le dernier endroit avant le modèle. Ce qu'il rend est
    // réinjecté dans l'IA pour qu'elle formule sa réponse : un nom d'agent
    // qui traîne là et SAMII dira « mon Relecteur a refusé ».
    const planner = require("fs").readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    const bloc = planner.slice(planner.indexOf("async confierAUneMission"));
    const corps = bloc.slice(0, bloc.indexOf("\n    async "));
    const sansCommentaires = corps.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const id of Object.keys(REGISTRE.AGENTS)) {
        verifier(!new RegExp(`["'\`]${id}["'\`]|\\b${id}\\b\\s*:`).test(sansCommentaires),
            `le pont du planner nomme le spécialiste « ${id} » dans ce qu'il rend au modèle : ` +
            "SAMII parlerait de ses agents à la personne, et il n'y a qu'un seul SAMII");
    }
    verifier(!/agents\s*:/.test(sansCommentaires),
        "le pont du planner remonte la liste des spécialistes au modèle");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. CHOISIR : réponse simple, un spécialiste, ou plusieurs
// ══════════════════════════════════════════════════════════════════════════
{
    // Une politesse ne mobilise personne.
    const bonjour = agents.choisir({ message: "Bonjour", context: PRO });
    verifier(bonjour.besoin === "reponse",
        `« Bonjour » mobilise ${bonjour.missions.join(", ")} : cinq agents pour une politesse`);

    // Un geste simple non plus, même dans un domaine couvert.
    const traduire = agents.choisir({ message: "Traduis cette légende Instagram en anglais", context: PRO });
    verifier(traduire.besoin === "reponse",
        `un geste simple ouvre une chaîne (${traduire.missions.join(", ")}) : ` +
        `raisons = ${traduire.raisons.join(" | ")}`);

    // Une vraie demande de contenu social ouvre la chaîne.
    const post = agents.choisir({
        message: "Écris-moi une publication Facebook pour ma nouvelle collection de bazin",
        context: PRO,
    });
    verifier(post.besoin === "specialiste",
        `« écris-moi une publication Facebook » ne mobilise aucun spécialiste ` +
        `(besoin=${post.besoin}, domaine=${post.domaine}, raisons=${post.raisons.join(" | ")})`);
    verifier(post.missions.includes("publication_sociale"),
        `la mission retenue est ${post.missions.join(", ")} au lieu de publication_sociale`);

    // ── LE DOMAINE VIENT DU DÉTECTEUR EXISTANT ───────────────────────────
    //
    // Si quelqu'un réécrivait une deuxième table de règles ici, ce contrôle
    // ne la verrait pas — mais les raisons rendues nomment le domaine, et
    // c'est ce nom-là qui doit venir de brain/prompts/sovereign/tables.js.
    const { detect } = require(path.join(RACINE, "brain", "prompts", "sovereign", "tables.js"));
    verifier(post.domaine === detect("Écris-moi une publication Facebook pour ma nouvelle collection de bazin"),
        "le domaine ne vient pas du détecteur existant : il y aurait deux classements du même message");

    // ── LE NIVEAU ÉCARTE LA MISSION, ET LE DIT ───────────────────────────
    const enExpert = agents.choisir({
        message: "Écris-moi une publication Facebook pour ma nouvelle collection de bazin",
        context: { ...PRO, niveau: "expert" },
    });
    verifier(enExpert.besoin === "reponse",
        "un tour Expert ouvre quand même une chaîne de spécialistes : le plafond de niveau ne servirait à rien");
    verifier((enExpert.ecartees || []).some((e) => e.id === "publication_sociale"),
        "la mission est écartée sans raison rendue : personne ne saurait pourquoi rien ne s'est passé");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LA PORTE DES PERMISSIONS
// ══════════════════════════════════════════════════════════════════════════
{
    // ── MISSION INCONNUE : ÉCHEC FERMÉ ───────────────────────────────────
    const inconnue = agents.autoriser({ missionId: "mission_qui_nexiste_pas", context: PRO });
    verifier(!inconnue.autorise,
        "une mission inconnue est autorisée : un identifiant mal tapé lancerait une chaîne vide " +
        "qui rendrait « c'est fait »");

    // ── AGENT COUPÉ : LE COUPE-CIRCUIT ARRÊTE LA MISSION ─────────────────
    //
    // Un seul maillon coupé arrête tout. Une chaîne amputée du relecteur ne
    // produit pas un résultat partiel : elle produit un contenu jamais relu.
    const avant = process.env.SOCIAL_AGENTS_COUPES;
    process.env.SOCIAL_AGENTS_COUPES = "reviewer";
    const coupe = agents.autoriser({ missionId: "publication_sociale", context: PRO });
    verifier(!coupe.autorise,
        "la mission tourne alors que le relecteur est coupé : du contenu partirait sans avoir été relu");
    verifier(coupe.coupe === "reviewer",
        `le refus ne nomme pas le spécialiste coupé (${JSON.stringify(coupe)})`);
    // Lu à CHAQUE appel, pas au chargement : on le rallume et ça doit repartir.
    process.env.SOCIAL_AGENTS_COUPES = "";
    verifier(agents.autoriser({ missionId: "publication_sociale", context: PRO }).autorise,
        "rallumer l'agent ne suffit pas à rouvrir la mission : le coupe-circuit serait lu au " +
        "chargement, et le rallumer demanderait un déploiement");
    if (avant === undefined) delete process.env.SOCIAL_AGENTS_COUPES;
    else process.env.SOCIAL_AGENTS_COUPES = avant;

    // ── LE NIVEAU ────────────────────────────────────────────────────────
    for (const niveau of ["rapide", "expert"]) {
        const r = agents.autoriser({ missionId: "publication_sociale", context: { ...PRO, niveau } });
        verifier(!r.autorise,
            `un tour ${niveau} lance une chaîne de spécialistes : le tour serait facturé au prix ` +
            "d'un message et coûterait plusieurs appels");
    }
    verifier(agents.autoriser({ missionId: "publication_sociale", context: { ...PRO, niveau: "maitre" } }).autorise,
        "le niveau Maître ne peut pas lancer la mission alors qu'il est au-dessus du minimum");

    // ── L'EFFET DÉCLARÉ DOIT ÊTRE L'EFFET RÉEL ───────────────────────────
    //
    // ⚠️ CETTE VÉRIFICATION A ÉTÉ REFAITE APRÈS UNE MUTATION SURVÉCUE.
    //
    // Première version : elle comparait `effetReel()` à `mission.effet` — sur
    // un registre cohérent, donc toujours vrai. Retirer la garde de la PORTE
    // ne la faisait pas crier. Elle mesurait le registre, pas le garde-fou.
    //
    // On force donc le registre à mentir, et on regarde si la porte cède.
    const m = REGISTRE.mission("publication_sociale");
    const vraiEffet = m.effet;
    m.effet = "lecture";   // la mission prétend ne rien changer au monde…
    const menteuse = agents.autoriser({ missionId: "publication_sociale", context: PRO });
    verifier(!menteuse.autorise,
        "une mission qui ANNONCE « lecture » mais dont les spécialistes préparent est autorisée : " +
        "elle obtiendrait les permissions du plus inoffensif pour faire le travail du plus définitif");
    verifier(/mal déclarée/.test(String(menteuse.refus)),
        `le refus n'explique pas la contradiction (${menteuse.refus})`);
    m.effet = vraiEffet;
    verifier(agents.autoriser({ missionId: "publication_sociale", context: PRO }).autorise,
        "la mission reste refusée après remise en état : la vérification serait collante");

    // ── LA CHAÎNE NE PUBLIE PAS ──────────────────────────────────────────
    //
    // C'est la garantie produit du chantier : SAMII prépare, la personne
    // valide. Le publieur n'est PAS dans la chaîne.
    verifier(!REGISTRE.mission("publication_sociale").agents.includes("publisher"),
        "le publieur est dans la chaîne déclenchée depuis le chat : un message suffirait à " +
        "faire partir du contenu sur de vrais comptes");
    verifier(REGISTRE.effetReel("publication_sociale") === "prepare",
        `l'effet réel de la mission est « ${REGISTRE.effetReel("publication_sociale")} » et non « prepare »`);
}

// ══════════════════════════════════════════════════════════════════════════
// 4. UN AGENT NE CONTOURNE JAMAIS LES PERMISSIONS DE SAMII
// ══════════════════════════════════════════════════════════════════════════
//
// LA GARDE LA PLUS IMPORTANTE DE LA SUITE. On donne à un agent un outil que
// le tour n'autorise pas, et on regarde si la porte cède.
{
    const vrai = REGISTRE.AGENTS.creator.outils;

    // Un outil d'écriture, dans un tour Expert (qui porte la lecture mais
    // pas l'écriture... et surtout pas la mission, donc on monte en Pro pour
    // isoler la garde des outils).
    REGISTRE.AGENTS.creator.outils = ["envoyer_email"];
    const okPro = agents.autoriser({ missionId: "publication_sociale", context: PRO });
    verifier(okPro.autorise,
        "un tour Pro refuse un agent qui emploie « envoyer_email », que le niveau Pro porte pourtant");

    // Le même agent, le même outil, mais sur un tour dont le MOTEUR est un
    // relais. Le chantier 7 ne concède aux relais que la famille commerce :
    // l'agent doit être arrêté.
    const surRelais = agents.autoriser({
        missionId: "publication_sociale",
        context: { ...PRO, moteur: "groq" },
    });
    verifier(!surRelais.autorise,
        "UN AGENT CONTOURNE LE CHANTIER 7 : sur un relais, il emploierait « envoyer_email » que " +
        "ce moteur n'a pas le droit de porter — une panne de Gemini rouvrirait l'outil par la bande");
    verifier((surRelais.interdits || []).includes("envoyer_email"),
        `le refus ne nomme pas l'outil interdit (${JSON.stringify(surRelais)})`);

    // Et un outil qu'AUCUN niveau ne porte : refusé partout.
    REGISTRE.AGENTS.creator.outils = ["outil_inexistant"];
    verifier(!agents.autoriser({ missionId: "publication_sociale", context: PRO }).autorise,
        "un agent emploie un outil qui n'existe dans aucune famille et la porte le laisse passer");

    REGISTRE.AGENTS.creator.outils = vrai;
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LA VÉRIFICATION : « TERMINÉ » N'EST PAS UN RÉSULTAT
// ══════════════════════════════════════════════════════════════════════════
{
    const v = (resultat) => agents.verifier({ missionId: "publication_sociale", resultat });

    verifier(!v({ ok: true }).conforme,
        "un agent qui rend « ok: true » et rien d'autre passe la vérification : « c'est fait » " +
        "serait accepté comme un résultat");
    verifier(!v(null).conforme, "un résultat absent passe la vérification");
    verifier(!v({ ok: false, erreur: "moteur indisponible" }).conforme,
        "un échec annoncé passe la vérification");

    // Le cas qui compte : tout est là, mais rien n'a été approuvé.
    const refuse = v({ ok: true, postId: 7, variantes: [{ plateforme: "facebook", approuve: false, bloquants: ["texte vide"] }] });
    verifier(!refuse.conforme,
        "un post dont TOUTES les variantes ont été refusées passe pour une réussite : SAMII " +
        "dirait « c'est prêt » alors que rien n'est publiable");
    verifier(refuse.bloquants.some((b) => /relecture/.test(b)),
        `le motif ne dit pas que la relecture a tout refusé (${refuse.bloquants.join(" ; ")})`);

    // Un résultat complet passe.
    const bon = v({ ok: true, postId: 7, variantes: [{ plateforme: "facebook", approuve: true }] });
    verifier(bon.conforme, `un résultat complet est refusé : ${bon.bloquants.join(" ; ")}`);

    // ── UNE ÉTAPE EN ÉCHEC EST DITE, MÊME QUAND ÇA PASSE ─────────────────
    const partiel = v({
        ok: true, postId: 7,
        variantes: [{ plateforme: "facebook", approuve: true }],
        etapes: [{ agent: "adapter", ok: false, erreur: "LinkedIn a refusé le format" }],
    });
    verifier(partiel.conforme && partiel.remarques.length > 0,
        "un maillon en échec dans une mission réussie est passé sous silence : c'est un mensonge " +
        "par omission, et la personne croirait que tout s'est bien passé");

    // ── UN RÉSULTAT INCOMPLET ────────────────────────────────────────────
    verifier(!v({ ok: true, variantes: [{ plateforme: "facebook", approuve: true }] }).conforme,
        "un résultat sans postId passe : rien n'aurait été enregistré et SAMII dirait que si");

    // ── LES CHAMPS ANNONCÉS SONT EXIGÉS, MÊME SANS CONTRÔLE SUR MESURE ───
    //
    // ⚠️ AJOUTÉ APRÈS UNE MUTATION SURVÉCUE. Retirer la boucle générique des
    // `champs` ne faisait rien crier : la mission sociale a EN PLUS son
    // propre `verifier()`, qui couvre exactement les mêmes deux champs. La
    // boucle était donc du code jamais mesuré — et les missions à venir, qui
    // déclareront des champs SANS contrôle sur mesure, n'auraient été
    // protégées par rien.
    //
    // On inscrit une mission jetable pour la mesurer telle qu'elle servira.
    REGISTRE.MISSIONS.__essai__ = {
        id: "__essai__", libelle: "Mission d'essai", domaines: [], agents: ["reviewer"],
        effet: "lecture", niveauMin: "pro", outil: null,
        attendu: { champs: ["rapport", "chiffres"] },   // aucun `verifier` sur mesure
    };
    const sansChamps = agents.verifier({ missionId: "__essai__", resultat: { ok: true } });
    verifier(!sansChamps.conforme,
        "une mission qui annonce rendre « rapport » et « chiffres » est déclarée conforme " +
        "sans les avoir rendus : « c'est fait » suffirait pour toute mission à venir");
    verifier(sansChamps.bloquants.length === 2,
        `${sansChamps.bloquants.length} champ(s) manquant(s) signalé(s) sur 2 : ` +
        `${sansChamps.bloquants.join(" ; ")}`);
    verifier(agents.verifier({ missionId: "__essai__", resultat: { ok: true, rapport: "r", chiffres: [1] } }).conforme,
        "une mission qui rend tout ce qu'elle annonce est quand même refusée");
    delete REGISTRE.MISSIONS.__essai__;
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LES REPRISES : ON REJOUE UNE PANNE, PAS UN REFUS
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(agents.rejouable({ erreur: "aucune réponse de l'IA — chaîne épuisée" }),
        "une panne de moteur n'est pas rejouable : un incident passager ferait échouer la mission");
    verifier(agents.rejouable({ erreur: "connect ECONNREFUSED 10.0.0.1:443" }),
        "une coupure réseau n'est pas rejouable");
    verifier(!agents.rejouable({ erreur: "le texte contient un marqueur non remplacé" }),
        "un refus du relecteur est rejoué : il refuserait à l'identique, et on aurait payé deux fois " +
        "pour le même non");
    verifier(!agents.rejouable({ erreur: "" }),
        "un échec sans motif est rejoué à l'aveugle");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. EXÉCUTION RÉELLE — avec une doublure de la chaîne sociale
// ══════════════════════════════════════════════════════════════════════════
(async () => {
    const social = require(path.join(RACINE, "engines", "social"));
    const vraiPreparer = social.preparer;
    let appelsPreparer = 0;
    let scenario = "ok";

    social.preparer = async () => {
        appelsPreparer++;
        if (scenario === "panne") return { ok: false, etape: "creator", erreur: "moteur indisponible" };
        if (scenario === "refus") {
            return { ok: true, postId: 12, titre: "T", contenu: "C", approuvees: 0,
                variantes: [{ plateforme: "facebook", approuve: false, bloquants: ["texte trop court"] }] };
        }
        if (scenario === "lent") {
            await new Promise((r) => setTimeout(r, 60));
            return { ok: true, postId: 13, titre: "T", contenu: "C", approuvees: 1,
                variantes: [{ plateforme: "facebook", approuve: true, bloquants: [] }] };
        }
        return { ok: true, postId: 11, titre: "Bazin", contenu: "Le contenu", approuvees: 2,
            variantes: [
                { plateforme: "facebook", approuve: true, bloquants: [] },
                { plateforme: "instagram", approuve: true, bloquants: [] },
            ] };
    };

    // ── LE CHEMIN NOMINAL ────────────────────────────────────────────────
    {
        scenario = "ok"; appelsPreparer = 0;
        const r = await agents.executer({
            missionId: "publication_sociale",
            entree: { theme: "nouvelle collection de bazin" },
            context: PRO,
        });
        verifier(r.ok, `la mission échoue sur le chemin nominal : ${r.erreur}`);
        verifier(appelsPreparer === 1, `la chaîne a été lancée ${appelsPreparer} fois pour un seul appel`);
        verifier(r.agents.join(",") === "creator,adapter,reviewer",
            `l'ordre des spécialistes est « ${r.agents.join(" → ")} » : la relecture doit venir APRÈS ` +
            "l'adaptation, sinon on relit un contenu qui n'est pas celui qui partira");
        verifier(r.effet === "prepare", `l'effet rapporté est « ${r.effet} »`);
    }

    // ── LE REFUS DU RELECTEUR N'EST PAS UNE RÉUSSITE ─────────────────────
    {
        scenario = "refus"; appelsPreparer = 0;
        const r = await agents.executer({
            missionId: "publication_sociale", entree: { theme: "t" }, context: PRO, reessais: 3,
        });
        verifier(!r.ok,
            "une préparation dont toutes les variantes ont été refusées est rendue comme réussie");
        verifier(appelsPreparer === 1,
            `le refus du relecteur a été rejoué ${appelsPreparer} fois : il refuserait à l'identique, ` +
            "et chaque reprise coûte une chaîne complète d'appels d'IA");
    }

    // ── UNE PANNE, ELLE, EST REJOUÉE ─────────────────────────────────────
    {
        scenario = "panne"; appelsPreparer = 0;
        const r = await agents.executer({
            missionId: "publication_sociale", entree: { theme: "t" }, context: PRO, reessais: 2,
        });
        verifier(!r.ok, "une panne est rendue comme réussie");
        verifier(appelsPreparer === 2,
            `une panne de moteur n'a été tentée que ${appelsPreparer} fois sur 2 demandées : ` +
            "un incident passager ferait échouer la mission sans seconde chance");
    }

    // ── LA DOUBLE EXÉCUTION ──────────────────────────────────────────────
    //
    // Deux onglets, deux clics, un relais qui rejoue un appel d'outil : la
    // même mission peut partir deux fois. Pour une préparation, ça fait deux
    // publications.
    {
        scenario = "lent"; appelsPreparer = 0;
        const entree = { theme: "exactement le même sujet" };
        const [a, b] = await Promise.all([
            agents.executer({ missionId: "publication_sociale", entree, context: PRO }),
            agents.executer({ missionId: "publication_sociale", entree, context: PRO }),
        ]);
        verifier(appelsPreparer === 1,
            `la même mission a démarré ${appelsPreparer} fois en parallèle : deux publications ` +
            "seraient préparées pour un seul message");
        verifier((a.ok && !b.ok) || (b.ok && !a.ok),
            "les deux lancements simultanés se disent réussis : la garde de double exécution ne sert à rien");

        // Et la clé est rendue : la mission doit pouvoir repartir après.
        appelsPreparer = 0;
        const apres = await agents.executer({ missionId: "publication_sociale", entree, context: PRO });
        verifier(apres.ok && appelsPreparer === 1,
            "la mission reste bloquée après un lancement : la clé de course n'a pas été rendue, " +
            "et ce sujet serait interdit pour toute la vie du processus");
    }

    // ── UN REFUS DE PERMISSION NE LANCE RIEN DU TOUT ─────────────────────
    {
        scenario = "ok"; appelsPreparer = 0;
        const r = await agents.executer({
            missionId: "publication_sociale", entree: { theme: "t" },
            context: { ...PRO, niveau: "rapide" },
        });
        verifier(!r.ok && r.refuse, "un tour Rapide n'est pas refusé");
        verifier(appelsPreparer === 0,
            `la chaîne a démarré ${appelsPreparer} fois malgré un refus de permission : ` +
            "la porte serait décorative");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7 bis. LE CHEMIN GÉNÉRIQUE — celui de toutes les familles à venir
    // ══════════════════════════════════════════════════════════════════════
    //
    // ⚠️ AJOUTÉ APRÈS UNE MUTATION SURVÉCUE.
    //
    // Faire fuiter le contexte d'appel d'un maillon au suivant ne faisait
    // rien crier. La raison : la mission sociale DÉLÈGUE à `engines/social`,
    // donc la chaîne générique de `brain/agents.js` n'était jamais exécutée.
    // Tout ce chemin — l'ordre des maillons, l'arrêt au premier échec, le
    // passage de relais, la trace — était écrit et jamais mesuré.
    //
    // C'est pourtant LE chemin que prendront l'agent vente, l'agent
    // prospection, l'agent finance : ceux qui n'auront pas de moteur à eux.
    // On monte donc une famille jetable et on la fait vraiment tourner.
    {
        const journal = [];
        const vus = [];

        REGISTRE.AGENTS.__un__ = {
            id: "__un__", libelle: "Premier", famille: "essai", interne: true,
            effet: "lecture", outils: [],
            executer: async (entree, contexte) => {
                journal.push("__un__");
                vus.push({ agent: "__un__", entree: Object.keys(entree), contexte: Object.keys(contexte || {}) });
                return { brouillon: "ce que le premier a produit" };
            },
        };
        REGISTRE.AGENTS.__deux__ = {
            id: "__deux__", libelle: "Second", famille: "essai", interne: true,
            effet: "lecture", outils: [],
            executer: async (entree) => {
                journal.push("__deux__");
                vus.push({ agent: "__deux__", entree: Object.keys(entree) });
                return { rapport: "vérifié", chiffres: [1] };
            },
        };
        REGISTRE.MISSIONS.__generique__ = {
            id: "__generique__", libelle: "Chaîne d'essai", domaines: [],
            agents: ["__un__", "__deux__"], effet: "lecture", niveauMin: "pro", outil: null,
            attendu: { champs: ["rapport"] },
        };

        // ── CHAQUE MAILLON EST TRACÉ ─────────────────────────────────────
        //
        // On remplace l'écriture en base, pas le socle : c'est le VRAI
        // `base.executer` qui doit appeler `tracerAgent`, chronomètre et
        // capture d'erreur compris. Un maillon qui s'exécuterait hors du
        // socle ne laisserait aucune trace — et le coupe-circuit ne
        // s'appliquerait pas à lui non plus.
        const store = require(path.join(RACINE, "services", "socialStore.js"));
        const vraiTracer = store.tracerAgent;
        const traces = [];
        store.tracerAgent = async (t) => { traces.push(t); return 1; };

        // ── L'ORDRE, ET LE PASSAGE DE RELAIS ─────────────────────────────
        journal.length = 0; vus.length = 0; traces.length = 0;
        const r = await agents.executer({
            missionId: "__generique__", entree: { sujet: "essai" },
            context: { ...PRO, secretDeSession: "ne doit pas voyager" },
        });
        verifier(r.ok, `la chaîne générique échoue : ${r.erreur}`);
        verifier(journal.join(",") === "__un__,__deux__",
            `les maillons ont tourné dans l'ordre « ${journal.join(" → ")} » : une chaîne dont ` +
            "l'ordre n'est pas garanti relit un contenu qui n'est pas celui qui partira");
        verifier((vus[1]?.entree || []).includes("brouillon"),
            `le second maillon n'a pas reçu ce que le premier a produit (${(vus[1]?.entree || []).join(", ")}) : ` +
            "chaque agent repartirait de zéro");

        verifier(traces.map((t) => t.agent).join(",") === "__un__,__deux__",
            `les maillons tracés sont « ${traces.map((t) => t.agent).join(", ")} » au lieu des deux : ` +
            "un agent qui s'exécute hors du socle ne laisse aucune trace, et le coupe-circuit ne " +
            "s'applique pas à lui");
        verifier(traces.every((t) => t.statut === "ok" && typeof t.dureeMs === "number"),
            `une trace est incomplète : ${JSON.stringify(traces).slice(0, 160)}`);

        // ── LA FUITE DE CONTEXTE ─────────────────────────────────────────
        //
        // Un maillon ne doit pas hériter du contexte d'appel de son voisin.
        // Ce qui voyage, c'est ce que le maillon précédent a PRODUIT — pas la
        // session, pas le palier, pas ce que SAMII avait sous la main.
        verifier(!(vus[1]?.entree || []).includes("secretDeSession"),
            `FUITE : le second maillon reçoit « secretDeSession » (${(vus[1]?.entree || []).join(", ")}) — ` +
            "un agent hériterait du contexte d'appel de son voisin, donc de ses droits et de ses secrets");
        verifier(!(vus[1]?.entree || []).includes("palier") && !(vus[1]?.entree || []).includes("niveau"),
            `le second maillon reçoit le contexte d'appel (${(vus[1]?.entree || []).join(", ")})`);

        // ── LA CHAÎNE S'ARRÊTE AU PREMIER ÉCHEC ──────────────────────────
        journal.length = 0;
        const vraiUn = REGISTRE.AGENTS.__un__.executer;
        REGISTRE.AGENTS.__un__.executer = async () => { journal.push("__un__"); throw new Error("le premier a échoué"); };
        const casse = await agents.executer({ missionId: "__generique__", entree: { sujet: "e2" }, context: PRO });
        verifier(!casse.ok, "une chaîne dont le premier maillon a échoué se dit réussie");
        verifier(!journal.includes("__deux__"),
            "le second maillon a tourné alors que le premier avait échoué : il travaillerait sur " +
            "un résultat qui n'existe pas");
        verifier(casse.resultat?.etape === "__un__",
            `le maillon fautif n'est pas nommé (${JSON.stringify(casse.resultat).slice(0, 120)})`);
        REGISTRE.AGENTS.__un__.executer = vraiUn;

        // ── UN AGENT SANS EXÉCUTION DÉCLARÉE ─────────────────────────────
        const vraiDeux = REGISTRE.AGENTS.__deux__.executer;
        delete REGISTRE.AGENTS.__deux__.executer;
        const sansCode = await agents.executer({ missionId: "__generique__", entree: { sujet: "e3" }, context: PRO });
        verifier(!sansCode.ok,
            "une mission dont un spécialiste n'a pas d'exécution se dit réussie : une classe " +
            "déclarée passerait pour un agent fonctionnel");
        REGISTRE.AGENTS.__deux__.executer = vraiDeux;

        // ── LE COUPE-CIRCUIT VAUT AUSSI SUR CE CHEMIN ────────────────────
        const avant = process.env.SOCIAL_AGENTS_COUPES;
        process.env.SOCIAL_AGENTS_COUPES = "__deux__";
        journal.length = 0;
        const coupee = await agents.executer({ missionId: "__generique__", entree: { sujet: "e4" }, context: PRO });
        verifier(!coupee.ok && !journal.includes("__un__"),
            "un spécialiste coupé n'arrête pas la chaîne générique, ou la chaîne démarre quand même : " +
            "le coupe-circuit ne protégerait que le social");
        if (avant === undefined) delete process.env.SOCIAL_AGENTS_COUPES;
        else process.env.SOCIAL_AGENTS_COUPES = avant;

        store.tracerAgent = vraiTracer;
        delete REGISTRE.AGENTS.__un__;
        delete REGISTRE.AGENTS.__deux__;
        delete REGISTRE.MISSIONS.__generique__;
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8. LE PONT : SAMII → OUTIL → MISSION → RÉSULTAT, EN COMPTANT LES APPELS
    // ══════════════════════════════════════════════════════════════════════
    {
        const planner = require(path.join(RACINE, "brain", "planner.js"));

        scenario = "ok"; appelsPreparer = 0;
        const sortie = await planner.executeFunction("preparer_publication",
            { theme: "bazin", plateformes: "facebook,instagram" }, PRO);

        verifier(sortie.success === true,
            `le pont du planner n'aboutit pas : ${JSON.stringify(sortie).slice(0, 160)}`);
        verifier(appelsPreparer === 1,
            `le pont a lancé la chaîne ${appelsPreparer} fois`);
        verifier(sortie.postId === 11 && (sortie.variantes || []).length === 2,
            `le pont ne rapporte pas ce qui a été préparé : ${JSON.stringify(sortie).slice(0, 160)}`);

        // ── AUCUN NOM D'AGENT DANS CE QUI REMONTE AU MODÈLE ──────────────
        const texte = JSON.stringify(sortie);
        for (const id of Object.keys(REGISTRE.AGENTS)) {
            verifier(!texte.includes(id),
                `le nom du spécialiste « ${id} » remonte au modèle : SAMII dirait « mon ${id} a… », ` +
                "et il n'y a qu'un seul SAMII");
        }

        // ── UN REFUS EST EXPLIQUÉ, PAS DÉGUISÉ EN PANNE ──────────────────
        const refuse = await planner.executeFunction("preparer_publication",
            { theme: "bazin" }, { ...PRO, niveau: "expert" });
        verifier(refuse.success === false, "un tour Expert aboutit quand même à une préparation");
        verifier(!/momentanément|réessaie|n'a pas pu être lancée/i.test(String(refuse.error)),
            `un refus de permission est présenté comme un incident technique : « ${refuse.error} » — ` +
            "SAMII s'excuserait d'une panne là où il devrait expliquer une limite");

        // ── LE PONT EXISTE VRAIMENT DANS LE PLANNER ──────────────────────
        //
        // C'est la mutation la plus évidente à faire, donc celle qu'il faut
        // garder : retirer le `case` et tout le reste continuerait de passer.
        const src = require("fs").readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
        verifier(/case "preparer_publication"/.test(src),
            "le planner n'a plus de case pour « preparer_publication » : l'outil serait déclaré au " +
            "modèle, le modèle l'appellerait, et SAMII répondrait « Fonction inconnue »");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 9. LA FACTURATION ET LES OUTILS : PAS DE RÉGRESSION
    // ══════════════════════════════════════════════════════════════════════
    {
        const CREDITS = require(path.join(RACINE, "config", "credits.js"));
        const gemini = require(path.join(RACINE, "services", "geminiService.js"));
        const noms = (p) => (p?.[0]?.functionDeclarations || []).map((f) => f.name);

        // L'outil a un prix décidé — pas deviné au moment de facturer.
        verifier(CREDITS.ACTES.preparer_publication || CREDITS.GRATUITS.preparer_publication,
            "« preparer_publication » n'a pas de prix décidé : la facturation improviserait");

        // Une préparation ratée ne se facture pas. Même règle que partout.
        const ratee = CREDITS.factureDuTour([{ nom: "preparer_publication", reussi: false }]);
        const reussie = CREDITS.factureDuTour([{ nom: "preparer_publication", reussi: true }]);
        verifier(ratee.montant < reussie.montant,
            "une préparation en échec est facturée comme une réussie : on ferait payer une panne");

        // ── UN CLIENT DE MARCHAND N'OUVRE AUCUNE CHAÎNE ──────────────────
        //
        // Le chemin sans niveau est celui des conversations clients
        // (WhatsApp, Telegram, page publique d'une boutique).
        const chezUnClient = noms(gemini.__test_buildToolsPayload(true, {}, "gemini"));
        verifier(!chezUnClient.includes("preparer_publication"),
            `un client de marchand se voit offrir « preparer_publication » (${chezUnClient.length} outils) : ` +
            "il pourrait faire préparer du contenu sur les comptes sociaux du marchand");

        // ── ET AUCUN RELAIS NE REÇOIT LA FAMILLE AGENTS ──────────────────
        for (const relais of ["groq", "openrouter", "deepseek"]) {
            const chez = noms(gemini.__test_buildToolsPayload(true, { niveau: "maitre" }, relais));
            verifier(!chez.includes("preparer_publication"),
                `le relais ${relais} reçoit « preparer_publication » : une panne de Gemini ferait ` +
                "préparer une publication par un moteur qu'on sait moins discipliné");
            verifier(!MOTEURS.moteur(relais).outilsFiables.includes("agents"),
                `${relais} déclare porter la famille « agents »`);
        }

        // Et Gemini, lui, la porte bien — sinon la mission serait inatteignable.
        const chezGemini = noms(gemini.__test_buildToolsPayload(true, { niveau: "pro" }, "gemini"));
        verifier(chezGemini.includes("preparer_publication"),
            "Gemini ne porte pas « preparer_publication » au niveau Pro : la chaîne serait inatteignable " +
            "depuis le chat, exactement comme avant le chantier 8");

        // Et Expert ne l'a pas : une mission coûte plusieurs appels.
        verifier(!noms(gemini.__test_buildToolsPayload(true, { niveau: "expert" }, "gemini"))
            .includes("preparer_publication"),
            "le niveau Expert porte « preparer_publication » : un tour facturé au prix d'un message " +
            "en coûterait cinq");
    }

    social.preparer = vraiPreparer;

    // ── VERDICT ──────────────────────────────────────────────────────────
    if (echecs.length) {
        console.log(`\n❌ agents : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ agents : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ agents : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
