// ==========================================================================
// SAMII OS — Après connexion, l'utilisateur choisit-il vraiment,
//            et le chat est-il vraiment le même SAMII ?
//
// POURQUOI CE TEST EXISTE.
//
// Deux règles ont été posées, et toutes deux se cassent en silence.
//
//   1. « Ne force pas automatiquement l'utilisateur vers le QG. » Une
//      redirection de trop ne ressemble jamais à une panne : la page
//      demandée s'affiche, elle n'est simplement pas celle qu'on voulait.
//      Personne n'ouvre de ticket pour ça — les gens s'habituent.
//
//   2. « Un seul SAMII, une seule mémoire. » Si la page d'accueil parle à
//      /vitrine/chat alors que le QG parle à /api/chat, on obtient DEUX
//      assistants sous le même nom : celui du dehors ne se souvient de rien,
//      celui du dedans ignore ce qui s'est dit avant. Rien ne plante. On
//      s'en aperçoit le jour où quelqu'un dit « je te l'ai déjà expliqué ».
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. Toute connexion dépose sur le chat, SAUF les trois cas où une autre
//      réponse est meilleure : une intention interrompue, une communauté
//      partenaire, et plusieurs QG (une question dont seule la personne a la
//      réponse).
//   2. Chez une partenaire, RIEN ne change.
//   3. Plus aucune destination forcée ne survit dans le code mort.
//   4. La barre latérale liste les QG et permet d'en changer sans se
//      reconnecter — via la route existante, qui vérifie l'appartenance.
//   5. Connecté, le chat parle à /api/chat : la même mémoire que le QG.
//   6. Micro, pièce jointe et projets sont montrés À TOUT LE MONDE, et les
//      routes publiques qui les font marcher existent. C'est l'inverse de ce
//      que ce test exigeait au départ : cacher ces outils aux visiteurs, c'est
//      cacher exactement ce qui donne envie de s'inscrire.
//   7. Les valeurs Cloudinary ne sont plus recopiées dans chaque fichier.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const ejs = require(path.join(RACINE, "node_modules", "ejs"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const retour = require(path.join(RACINE, "services", "retour.js"));
const langue = require(path.join(RACINE, "services", "langue.js"));
const paliers = require(path.join(RACINE, "config", "paliers.js"));
const cloudinary = require(path.join(RACINE, "config", "cloudinary.js"));

const MAISON = { ecosysteme: true, slug: "samii" };
const PARTENAIRE = { ecosysteme: false, slug: "coindudigital" };

function ou(COM, options) {
    return retour.apresConnexion({ session: {} }, { locals: { COM } }, options);
}

// ── 1. CHEZ NOUS, ON NE DÉCIDE PLUS À SA PLACE ───────────────────────────
{
    const LIBRES = [
        [{ typeCompte: "client" }, "un client"],
        [{ typeCompte: "marchand", aUneBoutique: true, nombreBoutiques: 1 }, "un marchand avec un QG"],
        [{ typeCompte: "marchand", aUneBoutique: false, nombreBoutiques: 0 }, "un marchand sans QG"],
        [{ typeCompte: "agence", aUneBoutique: false, nombreBoutiques: 0 }, "une agence sans boutique"],
    ];
    for (const [options, quoi] of LIBRES) {
        const dest = ou(MAISON, options);
        verifier(dest === "/",
            `${quoi} est envoyé sur « ${dest} » au lieu du chat — on décide encore à sa place`);
    }

    // ── LES TROIS EXCEPTIONS, QUI SONT LA RÈGLE ──────────────────────────
    // Honorer une intention n'est pas en imposer une.
    verifier(ou(MAISON, { typeCompte: "marchand", suite: "/marketplace/panier" }) === "/marketplace/panier",
        "quelqu'un qu'on a interrompu pour l'identifier ne repart pas où il allait");

    // Plusieurs QG : une question dont seule la personne a la réponse.
    verifier(ou(MAISON, { typeCompte: "marchand", aUneBoutique: true, nombreBoutiques: 3 }) === "/mes-qg",
        "avec trois QG, on en choisit un à sa place");
}

// ── 2. CHEZ UNE PARTENAIRE, RIEN NE CHANGE ───────────────────────────────
// Le chat n'est pas son produit, et « / » y redirige vers sa communauté :
// l'y déposer l'aurait fait rebondir.
{
    const communautes = require(path.join(RACINE, "config", "communautes"));
    const COM = communautes.get("coindudigital") || PARTENAIRE;
    verifier(ou(COM, { typeCompte: "marchand", aUneBoutique: true, nombreBoutiques: 1 }) === "/qg",
        "un marchand de partenaire n'atterrit plus sur son QG");
    verifier(ou(COM, { typeCompte: "marchand", aUneBoutique: true, nombreBoutiques: 2 }) === "/mes-qg",
        "le choix entre plusieurs QG a disparu chez une partenaire");
    const client = ou(COM, { typeCompte: "client" });
    verifier(client !== "/",
        `un client de partenaire est envoyé sur « ${client} » — il devrait rester chez elle`);
}

// ── 3. AUCUNE DESTINATION FORCÉE NE SURVIT EN CODE MORT ──────────────────
// C'est la leçon de routes/hub.js : une liste morte finit par être relue
// comme la règle en vigueur.
{
    const src = fs.readFileSync(path.join(RACINE, "services", "retour.js"), "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const apres = code.slice(code.indexOf('return "/";'));
    verifier(!/return\s+"\/qg"/.test(apres) && !/accueilMarchand/.test(apres),
        "du code de redirection survit APRÈS le retour vers le chat — inatteignable, " +
        "mais le prochain lecteur le prendra pour la règle");
}

// ── LA PAGE, RENDUE POUR DE VRAI ─────────────────────────────────────────
function rendre(extra) {
    const f = path.join(RACINE, "views", "samii-accueil.ejs");
    return ejs.render(fs.readFileSync(f, "utf8"), Object.assign({
        lang: "fr", dir: "ltr", L: langue.traducteur("fr"),
        languesDispo: langue.LANGUES, nomsLangues: langue.NOMS,
        autreLangue: "en", lienLangue: (v) => `/langue/${v}`,
        loggedIn: false, nom: "", typeCompte: "client", tarifs: paliers.PALIERS,
        qgs: [], projets: [], workspaceId: "", cloudinary,
        // `v()` vient d'app.locals quand Express rend la page
        // (services/actifs.js : la version d'une feuille est l'empreinte de son
        // contenu). Un test qui rend la vue à la main doit poser les MÊMES
        // locales que l'application, sinon il échoue sur une absence qui
        // n'existe pas en production.
        v: require(path.join(RACINE, "services", "actifs.js")).v,
    }, extra), { filename: f });
}

const anonyme = rendre({});
const connecte = rendre({
    loggedIn: true, nom: "Ouahid", typeCompte: "marchand",
    qgs: [{ id: "w1", nom: "Amel Couture", metier: "pretaporter" },
          { id: "w2", nom: "Ma Boutique OG", metier: "ecommerce" }],
    projets: [{ id: 7, nom: "Campagne rentrée" }],
    workspaceId: "w1",
});

// ── 4. LA BARRE LATÉRALE EST LE CENTRE DE NAVIGATION ─────────────────────
{
    verifier(connecte.includes("Amel Couture") && connecte.includes("Ma Boutique OG"),
        "les QG ne sont pas listés dans la barre latérale — il faut se reconnecter pour en changer");

    // Via la route qui existe et qui VÉRIFIE l'appartenance. Un lien fabriqué
    // ici réécrirait ce contrôle, et un contrôle réécrit est un contrôle à
    // retrouver le jour où il manque.
    verifier((connecte.match(/action="\/mes-qg"/g) || []).length === 2,
        "les QG ne passent pas par POST /mes-qg — l'appartenance n'est plus vérifiée par la route qui sait le faire");
    verifier(/name="workspaceId"/.test(connecte),
        "le QG choisi n'est pas transmis");

    // Celui où l'on est déjà se distingue des autres.
    verifier(/sortie--ici/.test(connecte),
        "le QG courant ne se distingue pas des autres — on ne sait pas où on est");

    // Les projets, à la Claude : la table et le service existaient déjà.
    verifier(/data-projet="7"/.test(connecte),
        "les projets ne sont pas dans la barre latérale");

    // ── LE QG DE LA SESSION PASSE TOUJOURS ───────────────────────────────
    //
    // getByOwner() cherche sur `owner` OU `owner_email`. Un marchand dont
    // l'espace est rattaché autrement — collaborateur ajouté, adresse changée
    // depuis la création — reçoit une liste vide alors que sa session porte
    // bel et bien un workspaceId. La barre lui proposait « Ouvrir un QG »,
    // comme s'il n'en avait aucun : depuis le chat, plus aucune porte vers
    // SON PROPRE QG. La page s'affiche, rien n'échoue, et la personne conclut
    // qu'elle a perdu sa boutique.
    {
        const orphelin = rendre({
            loggedIn: true, typeCompte: "marchand", workspaceId: "w-seul",
            qgs: [{ id: "w-seul", nom: "Mon QG", metier: "", direct: true }],
            projets: [],
        });
        // LA CLASSE EST DANS LE MOTIF, ET CE N'EST PAS DU ZÈLE.
        // La première version cherchait juste `href="/qg"` — et elle passait
        // même après avoir cassé l'entrée, parce que le bouton « Mon QG » de
        // la barre HAUTE porte la même adresse. Un test qui matche autre
        // chose que ce qu'il croit surveiller ne surveille rien.
        verifier(/class="sortie sortie--ici" href="\/qg"/.test(orphelin),
            "un QG présent en session mais absent de la liste ne mène nulle part depuis la " +
            "BARRE LATÉRALE — la personne n'a plus de porte vers sa propre boutique");
        // Et surtout PAS par POST /mes-qg : cette route vérifie l'appartenance
        // contre la même liste qui ne le connaît pas, donc elle le refuserait.
        verifier(!/action="\/mes-qg"/.test(orphelin),
            "on passe par POST /mes-qg pour un QG que cette route ne reconnaît pas — elle refusera");
    }

    // Un compte agence garde son QG Agence, qui était une destination forcée
    // et devient un choix.
    const agence = rendre({ loggedIn: true, typeCompte: "agence", qgs: [], projets: [] });
    verifier(agence.includes('href="/agence"'),
        "un compte agence n'a plus accès à son QG Agence — la redirection a été retirée sans rien mettre à la place");
}

// ── 5. UN SEUL SAMII, UNE SEULE MÉMOIRE ──────────────────────────────────
const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
{

    verifier(/fetch\("\/api\/chat"/.test(js),
        "connecté, le chat n'appelle pas /api/chat — c'est un second SAMII, amnésique, sous le même nom");
    verifier(/if \(CONNECTE\)/.test(js),
        "rien ne distingue le visiteur anonyme du membre connecté — l'un des deux chemins est mort");
    verifier(/projetId/.test(js), "le projet actif n'est pas transmis — les projets ne servent à rien");
    verifier(/\/vitrine\/chat/.test(js),
        "le chemin anonyme a disparu — un visiteur sans compte ne peut plus parler à SAMII");
}

// ── 6. MICRO ET PIÈCE JOINTE : POUR TOUT LE MONDE ────────────────────────
//
// CE TEST A CHANGÉ DE RÈGLE, ET C'EST UNE CORRECTION, PAS UN ASSOUPLISSEMENT.
//
// Il exigeait l'inverse : micro et trombone cachés aux visiteurs sans compte,
// au motif que les routes étaient derrière requireAuth. Le raisonnement était
// techniquement juste et commercialement à l'envers — on cachait précisément
// ce qui donne envie de s'inscrire. Quelqu'un qui a dicté une phrase à SAMII
// et l'a vu l'écrire comprend le produit en trois secondes ; on ne lui
// demande un compte qu'après.
//
// Et dicter n'est pas un confort ici : beaucoup de gens tapent lentement, ou
// pas du tout. Exiger un clavier écarte une partie du marché visé avant la
// première phrase.
//
// Ce qui est vérifié maintenant : les outils sont là POUR TOUS, et les routes
// publiques qui les font marcher existent vraiment — sinon on afficherait des
// boutons qui renvoient vers /login, ce qui serait pire que de les cacher.
{
    for (const [quoi, motif] of [["le micro", /id="micro"/], ["la pièce jointe", /id="joindre"/]]) {
        verifier(motif.test(connecte), `${quoi} manque pour un membre connecté`);
        verifier(motif.test(anonyme),
            `${quoi} est caché aux visiteurs sans compte — c'est ce qui donne envie de s'inscrire`);
    }

    // La route publique de dictée doit exister, et rester bornée : ouverte ne
    // veut pas dire sans limite.
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
    verifier(/router\.post\("\/transcrire"/.test(vitrine),
        "aucune route publique de dictée — le micro affiché à un visiteur ne marcherait pas");
    verifier(/micLimiter/.test(vitrine),
        "la dictée publique n'a pas de limite propre : ouverte ne veut pas dire sans plafond");
    verifier(/fileSize: 8 \* 1024 \* 1024/.test(vitrine),
        "aucune taille maximale sur l'audio public");

    // L'image doit traverser toute la chaîne publique, sinon le trombone
    // dépose une photo que personne ne regarde jamais.
    verifier(/imageUrl/.test(vitrine),
        "le chat public n'accepte pas d'image — le trombone serait un bouton décoratif");
    const gemini = fs.readFileSync(path.join(RACINE, "services", "geminiService.js"), "utf8");
    verifier(/async function imageEnLigne/.test(gemini),
        "geminiService ne sait pas rapatrier une image : Gemini ne suit pas les URL tout seul");
    verifier(/w_1024,q_auto/.test(gemini),
        "l'image n'est pas redimensionnée avant d'être envoyée — on paierait la photo d'un téléphone en entier, deux fois");
    verifier(/tu ne peux pas la voir/.test(gemini),
        "quand le relais de secours ne voit pas l'image, rien ne le lui dit — SAMII décrirait une photo qu'il n'a jamais vue");

    // Une photo sans un mot est une question valable.
    verifier(/if \(!messageBrut && !req\.body\.imageUrl\) return null;/.test(vitrine),
        "une image envoyée sans texte est refusée — c'est pourtant le geste le plus naturel");

    // Les projets aussi sont montrés à tous : cachés, personne ne sait qu'ils
    // existent, donc personne ne les réclame.
    verifier(/id="nouveau-projet"/.test(anonyme) && /id="nouveau-projet"/.test(connecte),
        "« Nouveau projet » n'est pas montré à tout le monde");
    verifier(/projetSansCompte/.test(js),
        "un visiteur qui clique sur « Nouveau projet » n'a aucune explication");

    verifier(!/name="workspaceId"/.test(anonyme),
        "des QG s'affichent pour un visiteur sans compte");

    verifier(/MediaRecorder/.test(js) && /transcrire|transcribe/.test(js),
        "le micro n'enregistre pas ou n'envoie pas à la transcription");
    verifier(/\/vitrine\/transcrire/.test(js),
        "le micro n'appelle pas la route publique pour un visiteur sans compte");
    // La transcription se relit avant de partir : elle se trompe, et un
    // message envoyé de travers coûte un crédit et une explication.
    verifier(/champ\.value = champ\.value \? champ\.value \+ " " \+ t : t;/.test(js),
        "la transcription part toute seule sans que la personne puisse la relire");
    // Le point rouge de l'onglet doit s'éteindre : sinon on a l'air d'écouter
    // en continu après l'enregistrement.
    verifier(/getTracks\(\)\.forEach/.test(js),
        "la piste micro n'est pas coupée après l'enregistrement — le navigateur reste marqué « micro actif »");
}

// ── 7. CLOUDINARY N'EST PLUS RECOPIÉ PARTOUT ─────────────────────────────
{
    verifier(cloudinary.CLOUD_NAME && cloudinary.UPLOAD_PRESET,
        "config/cloudinary.js ne fournit pas les deux valeurs");

    for (const f of ["routes/verification.js", "routes/marketplace.js"]) {
        const src = fs.readFileSync(path.join(RACINE, f), "utf8");
        verifier(!/"ojwx5hft"/.test(src),
            `${f} recopie encore le nom du nuage au lieu de lire config/cloudinary.js`);
    }
}

if (echecs.length) {
    console.log(`\n❌ navigation libre : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exitCode = 1;
} else {
    console.log(`✅ navigation libre : ${verifs} vérifications passées`);
}
