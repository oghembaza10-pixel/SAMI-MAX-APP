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
//   6. Micro et pièce jointe n'apparaissent QUE connecté — leurs routes sont
//      derrière requireAuth, les montrer à un visiteur anonyme promettrait
//      un bouton qui renvoie vers /login.
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

    // Un compte agence garde son QG Agence, qui était une destination forcée
    // et devient un choix.
    const agence = rendre({ loggedIn: true, typeCompte: "agence", qgs: [], projets: [] });
    verifier(agence.includes('href="/agence"'),
        "un compte agence n'a plus accès à son QG Agence — la redirection a été retirée sans rien mettre à la place");
}

// ── 5. UN SEUL SAMII, UNE SEULE MÉMOIRE ──────────────────────────────────
{
    const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
    verifier(/fetch\("\/api\/chat"/.test(js),
        "connecté, le chat n'appelle pas /api/chat — c'est un second SAMII, amnésique, sous le même nom");
    verifier(/if \(CONNECTE\) return envoyerConnecte/.test(js),
        "rien ne distingue le visiteur anonyme du membre connecté — l'un des deux chemins est mort");
    verifier(/projetId/.test(js), "le projet actif n'est pas transmis — les projets ne servent à rien");
    verifier(/\/vitrine\/chat/.test(js),
        "le chemin anonyme a disparu — un visiteur sans compte ne peut plus parler à SAMII");
}

// ── 6. MICRO ET PIÈCE JOINTE : CONNECTÉ SEULEMENT ────────────────────────
{
    verifier(/id="micro"/.test(connecte), "le micro manque alors qu'/api/chat/transcribe existe");
    verifier(/id="joindre"/.test(connecte), "la pièce jointe manque alors qu'/api/chat lit les images");

    // Les deux routes sont derrière requireAuth : les montrer à un visiteur
    // anonyme, c'est promettre un bouton qui renvoie vers /login.
    verifier(!/id="micro"/.test(anonyme),
        "le micro s'affiche pour un visiteur sans compte — /api/chat/transcribe le renverra vers /login");
    verifier(!/id="joindre"/.test(anonyme),
        "la pièce jointe s'affiche pour un visiteur sans compte — /api/chat le renverra vers /login");
    verifier(!/name="workspaceId"/.test(anonyme),
        "des QG s'affichent pour un visiteur sans compte");

    const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
    verifier(/MediaRecorder/.test(js) && /\/api\/chat\/transcribe/.test(js),
        "le micro n'enregistre pas ou n'envoie pas à la transcription");
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
