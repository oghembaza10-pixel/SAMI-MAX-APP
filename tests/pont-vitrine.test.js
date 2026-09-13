// ==========================================================================
// SAMII OS — Un seul SAMII : ce qui a été dit avant le compte suit la personne
// ==========================================================================
//
// LA PROMESSE QUI N'ÉTAIT PAS TENUE.
//
// Le message de quota du chat public dit, mot pour mot : « crée ton compte et
// je garde tout ce qu'on s'est dit ». Mesuré sur l'application qui tourne :
// rien n'était gardé. Deux défauts superposés, tous deux silencieux.
//
//   1. LA CLÉ ÉTRANGÈRE. `samii_conversations.user_id` référence
//      `utilisateurs.id`. Le chat public y écrivait « anon:<session> » : la
//      base refusait CHAQUE insertion, l'erreur partait dans un catch, et
//      personne ne la lisait. Aucune conversation anonyme n'a jamais existé.
//
//   2. LA SESSION FANTÔME. `saveUninitialized: false` — le bon réglage — fait
//      qu'une session à laquelle on n'écrit rien n'est jamais enregistrée.
//      Aucun cookie, donc un identifiant NEUF à chaque requête. Même si
//      l'insertion avait réussi, les messages d'un même visiteur auraient été
//      classés sous une clé différente à chaque échange.
//
// Les deux comptent : corriger l'un sans l'autre ne donne toujours rien.
//
// CE QUE ÇA CHANGE POUR QUELQU'UN. Il raconte son commerce pendant dix
// messages, se décide, crée son compte — et SAMII sait encore qui il est.
// C'est le pire moment possible pour paraître amnésique : celui où la
// personne vient d'accorder sa confiance.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── 1. LES MESSAGES D'UN VISITEUR ONT LEUR PROPRE COLONNE ────────────────
//
// On ne touche pas à la clé étrangère : elle protège les vraies
// conversations. Un visiteur écrit dans `session_ref`, et `user_id` reste
// NULL jusqu'à ce qu'un compte les réclame.
{
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");

    verifier(!/"anon:" \+ String\(req\.sessionID/.test(vitrine),
        "le chat public écrit encore « anon:… » dans user_id, qui porte une clé étrangère : " +
        "la base refuse chaque insertion et rien n'est gardé");
    verifier(/session_ref/.test(vitrine),
        "le chat public n'écrit pas dans session_ref : les messages d'un visiteur n'ont nulle part où aller");

    const bloc = vitrine.slice(vitrine.indexOf("async function journaliserTour"));
    const corps = bloc.slice(0, bloc.indexOf("\n}\n") + 1);
    verifier(/INSERT INTO samii_conversations \(user_id, session_ref/.test(corps),
        "l'insertion ne porte pas les deux colonnes");
    verifier(/req\.session\?\.userId \? String\(req\.session\.userId\) : null/.test(corps),
        "user_id ne vaut pas NULL pour un visiteur : la clé étrangère refusera l'insertion");

    const schema = fs.readFileSync(path.join(RACINE, "services", "schema.js"), "utf8");
    verifier(/ADD COLUMN IF NOT EXISTS session_ref TEXT/.test(schema),
        "la colonne session_ref n'est pas créée au démarrage : elle manquera en production, " +
        "et l'insertion échouera exactement comme avant");
    verifier(/idx_conv_session/.test(schema),
        "aucun index sur session_ref : le rattachement balaierait toute la table à chaque inscription");
}

// ── 2. LE VISITEUR A UN FIL, PAS UNE SUITE D'INCONNUS ────────────────────
//
// Sans une écriture dans la session, `saveUninitialized: false` ne
// l'enregistre jamais et l'identifiant change à chaque requête.
{
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
    verifier(/function marquerVisiteur/.test(vitrine),
        "rien ne rend la session d'un visiteur réelle : son identifiant changera à chaque " +
        "message et sa conversation n'existera jamais comme un tout");
    verifier(/req\.session\.vitrineDepuis/.test(vitrine),
        "marquerVisiteur n'écrit rien dans la session — une session non modifiée n'est pas enregistrée");

    // Et il doit être appelé sur le chemin que les DEUX routes empruntent.
    const prep = vitrine.slice(vitrine.indexOf("function preparerEntree"));
    verifier(/marquerVisiteur\(req\)/.test(prep.slice(0, 600)),
        "marquerVisiteur n'est pas appelé dans preparerEntree : une des deux routes du chat " +
        "public laisserait le visiteur sans fil");
}

// ── 3. LE RATTACHEMENT NE PREND QUE CE QUI N'APPARTIENT À PERSONNE ───────
{
    const memoire = fs.readFileSync(path.join(RACINE, "services", "samiiMemoire.js"), "utf8");
    const bloc = memoire.slice(memoire.indexOf("async function rattacherConversationAnonyme"));

    verifier(/WHERE session_ref = \$2 AND user_id IS NULL/.test(bloc),
        "le rattachement ne vérifie pas que ces messages n'appartiennent à personne : " +
        "il pourrait s'approprier la conversation d'un compte existant");
    verifier(/SET user_id = \$1, session_ref = NULL/.test(bloc),
        "session_ref n'est pas effacé au rattachement : la prochaine session portant le même " +
        "identifiant réclamerait les mêmes messages une seconde fois");
    verifier(/if \(!sessionID \|\| !userId\) return/.test(bloc),
        "le rattachement accepte des paramètres vides — il balaierait la table");
}

// ── 4. L'IDENTIFIANT EST CAPTURÉ AVANT LA RÉGÉNÉRATION ───────────────────
//
// LA SUBTILITÉ QUI FAIT TOUT RATER SANS PRÉVENIR. `req.session.regenerate()`
// crée un nouvel identifiant et jette l'ancien — c'est la bonne pratique
// contre la fixation de session, on n'y touche pas. Mais c'est sous l'ANCIEN
// que vivent les messages. Lu après, il ne désigne plus rien : le
// rattachement réussit, ne trouve aucune ligne, et personne ne le voit.
{
    // ── ON MESURE LE CODE, PAS LES COMMENTAIRES ─────────────────────────
    //
    // Première version : elle comptait `req.session.regenerate` là où le
    // commentaire d'à côté le NOMMAIT pour l'expliquer. Elle a donc annoncé
    // trois régénérations pour deux réelles, et un ordre inversé. La garde
    // criait pour une raison qui n'était pas la bonne — exactement le piège
    // qu'un test doit éviter.
    const sansCommentaires = (texte) => texte
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/([^:])\/\/.*$/gm, "$1");

    for (const fichier of ["login", "register"]) {
        const src = sansCommentaires(fs.readFileSync(path.join(RACINE, "routes", `${fichier}.js`), "utf8"));

        const iCapture = src.search(/const session(AvantConnexion|AvantInscription) = req\.sessionID/);
        const iRegen = src.indexOf("req.session.regenerate");
        verifier(iCapture !== -1,
            `routes/${fichier}.js ne capture pas l'identifiant de session avant la régénération`);
        verifier(iCapture !== -1 && iRegen !== -1 && iCapture < iRegen,
            `routes/${fichier}.js lit l'identifiant APRÈS la régénération : il ne désigne plus rien, ` +
            "le rattachement ne trouve aucune ligne et rien ne le signale");

        // Tous les chemins de connexion doivent rattacher, pas seulement un.
        const nbRegen = (src.match(/req\.session\.regenerate/g) || []).length;
        const nbRattache = (src.match(/rattacherConversationAnonyme/g) || []).length;
        verifier(nbRattache >= nbRegen,
            `routes/${fichier}.js régénère la session ${nbRegen} fois mais ne rattache que ` +
            `${nbRattache} fois : selon son type de compte, la personne perdrait sa conversation`);

        // Et jamais bloquant : une connexion ne doit pas échouer parce qu'un
        // rattachement a échoué.
        verifier(/rattacherConversationAnonyme\([^)]*\)\.catch\(/.test(src),
            `routes/${fichier}.js attend le rattachement : un incident de mémoire empêcherait ` +
            "quelqu'un de se connecter");
    }
}

// ── 5. UN SEUL SAMII : L'IDENTITÉ DÉCIDE, PAS LA PAGE ────────────────────
//
// Une personne connectée qui écrit depuis la page d'accueil doit recevoir le
// SAMII complet — mémoire, projets, outils, niveaux — et pas la version
// visiteur. C'est ce qui fait qu'on ne change pas d'IA en changeant de page.
{
    const accueil = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
    verifier(/if \(CONNECTE\)/.test(accueil) && /\/api\/chat/.test(accueil),
        "la page d'accueil envoie une personne connectée vers le chat visiteur : elle perdrait " +
        "sa mémoire, ses projets et ses outils en changeant simplement de page");

    // Et les deux chats partagent la même échelle de réflexion.
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
    verifier(/niveauAuto\.choisir\(/.test(vitrine),
        "le chat public n'utilise pas le même classement de niveau que le QG");

    // Et le même magasin de conversation.
    const memoire = fs.readFileSync(path.join(RACINE, "services", "samiiMemoire.js"), "utf8");
    verifier(/FROM samii_conversations/.test(memoire) && /samii_conversations/.test(vitrine),
        "les deux chats n'écrivent plus dans la même table : il y aurait deux mémoires, " +
        "donc deux SAMII");
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ pont vitrine : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ pont vitrine : ${verifs} vérifications passées`);
