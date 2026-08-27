// ==========================================================================
// SAMII OS — La vitrine d'un marchand s'affiche-t-elle vraiment ?
//
// POURQUOI CE TEST EXISTE. Réglages → Ma boutique demandait une adresse, des
// pixels, un thème, une disposition, des sections, des vedettes. Tout était
// enregistré. Mais `renderVitrine` n'existait nulle part : `index.js` le
// cherchait dans `routes/vitrine.js`, ne le trouvait pas, et le try/catch
// avalait l'erreur sans un mot. Un marchand configurait sa boutique pendant
// vingt minutes, ouvrait son sous-domaine, et tombait sur notre page
// d'accueil. Personne ne l'a vu passer, parce que rien ne plantait.
//
// C'est le pire genre de panne : silencieuse, et du côté client.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. Le lien entre index.js et la page tient — l'export existe encore.
//   2. La route /vitrine/:userId existe, et /chat n'est pas avalé par elle.
//   3. La page servie contient bien ce qu'un client vient y chercher : le
//      nom, les produits, les prix.
//   4. Les réglages du marchand ont un effet visible (le thème choisi).
//   5. Un marchand inconnu donne 404, pas une page à moitié vide.
//   6. Un titre de produit malveillant est échappé — ces textes sont tapés
//      par des marchands et lus par des inconnus.
//
// COMMENT. On rend vraiment la page, avec une base simulée. Pas d'analyse de
// source : c'est le HTML servi qu'on inspecte, celui que verra le client.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── Une base simulée ─────────────────────────────────────────────────────
const MARCHAND = {
    id: "u-test", prenom: "Ines", nom: "Audrey", email: "x@y.z", telephone: null,
    pays: "Cameroun", bio_vitrine: "Ressources numériques et formations.",
    photo_profil_url: "", banniere_url: "", grade_actuel: "Créatrice",
    type_compte: "marchand", metier: "Formations", sous_domaine: "coindudigital",
    vitrine_theme: "vibrant", vitrine_grille: "compacte", created_at: new Date("2024-03-12"),
};

// Un titre hostile, tel qu'un marchand pourrait en taper un — par malice ou
// par copier-coller malheureux depuis une page web.
const TITRE_HOSTILE = `<script>alert("xss")</script>`;

const PRODUITS = [
    { id: 1, titre: "Pack Canva Pro", prix: "5000", devise: "FCFA", photo_url: "https://exemple.test/a.jpg", photos_urls: null, categorie: "formation", section_vitrine: null, en_vedette: true, ville: "Douala", vues: 120, created_at: new Date() },
    { id: 2, titre: TITRE_HOSTILE, prix: "3000", devise: "FCFA", photo_url: null, photos_urls: null, categorie: "outils", section_vitrine: "Outils IA", en_vedette: false, ville: null, vues: 40, created_at: new Date() },
];

const Module = require("module");
const vraiRequire = Module.prototype.require;
let marchandExiste = true;

Module.prototype.require = function (nom) {
    if (nom === "../services/db" || nom === "./db") {
        return {
            query: async (q) => {
                if (/FROM utilisateurs WHERE id/.test(q)) return marchandExiste ? [MARCHAND] : [];
                if (/FROM annonces/.test(q)) return PRODUITS;
                if (/FROM publications p/.test(q)) return [];
                if (/FROM avis a/.test(q)) return [];
                return [];
            },
        };
    }
    return vraiRequire.apply(this, arguments);
};

const routeur = require(path.join(RACINE, "routes", "vitrine.js"));
const vitrineThemes = require(path.join(RACINE, "config", "vitrine-themes.js"));
Module.prototype.require = vraiRequire;

// ── 1. Le lien avec index.js ─────────────────────────────────────────────
// C'est LA vérification qui aurait attrapé la panne d'origine : index.js
// fait `const { renderVitrine } = require("./routes/vitrine")`. Si cet
// export disparaît, le sous-domaine d'un marchand retombe en silence sur la
// page d'accueil, exactement comme avant.
verifier(typeof routeur.renderVitrine === "function",
    "routes/vitrine.js n'exporte plus renderVitrine — le sous-domaine d'un marchand retombera en silence sur l'accueil (c'est la panne d'origine)");

// ── 2. Les routes ────────────────────────────────────────────────────────
const chemins = routeur.stack.filter((c) => c.route).map((c) => ({
    chemin: c.route.path,
    methodes: Object.keys(c.route.methods),
}));

const routeVitrine = chemins.find((r) => r.chemin === "/:userId" && r.methodes.includes("get"));
verifier(!!routeVitrine, "la route GET /vitrine/:userId n'existe pas — aucune boutique n'est visible");

const routeChat = chemins.find((r) => r.chemin === "/chat");
verifier(!!routeChat, "la route POST /vitrine/chat a disparu");

// L'ordre compte : déclarée avant /chat, la route /:userId capterait « chat »
// comme un identifiant de marchand et le chat public de l'accueil tomberait.
if (routeVitrine && routeChat) {
    const iChat = chemins.findIndex((r) => r.chemin === "/chat");
    const iVitrine = chemins.findIndex((r) => r.chemin === "/:userId");
    verifier(iChat < iVitrine,
        "/:userId est déclarée AVANT /chat : elle capte « chat » comme un identifiant de marchand et casse le chat public");
}

// ── Rendre la page pour de vrai ──────────────────────────────────────────
function rendre() {
    return new Promise((resolve) => {
        const req = { session: {}, protocol: "https", get: () => "samii.souverain-store.com" };
        let code = 200;
        const res = {
            status(c) { code = c; return this; },
            send: (html) => resolve({ code, html }),
        };
        routeur.renderVitrine(MARCHAND.id, req, res);
    });
}

(async () => {
    const { code, html } = await rendre();

    // ── 3. Ce qu'un client vient chercher ────────────────────────────────
    verifier(code === 200, `la boutique répond ${code} au lieu de 200`);
    verifier(html.includes("Ines Audrey"), "le nom du marchand n'apparaît pas sur sa boutique");
    verifier(html.includes("Pack Canva Pro"), "les produits du marchand n'apparaissent pas");
    verifier(html.includes("5000 FCFA"), "le prix d'un produit n'apparaît pas — une boutique sans prix ne vend rien");
    verifier(html.includes("Outils IA"), "les sections définies par le marchand ne sont pas rendues");
    verifier(/Vedette/.test(html), "un produit mis en vedette n'est pas signalé comme tel");
    verifier(html.includes("/marketplace/produit/1"),
        "les produits ne sont pas cliquables — la boutique est un catalogue mort");

    // Le lien partageable : c'est ce qu'elle colle dans une story. S'il
    // pointe ailleurs que sur son sous-domaine, elle envoie son monde chez
    // quelqu'un d'autre.
    verifier(html.includes("coindudigital.souverain-store.com"),
        "l'adresse de la boutique n'est pas celle du sous-domaine du marchand");

    // ── 4. Ses réglages ont un effet ─────────────────────────────────────
    // Le thème est choisi dans Réglages → Ma boutique. S'il n'arrive pas
    // jusqu'à la page, le marchand règle des couleurs qu'il ne verra jamais.
    const varsVibrant = vitrineThemes.getTheme("vibrant").vars["--blue"];
    verifier(html.includes(varsVibrant),
        `le thème choisi (vibrant) n'est pas appliqué — ${varsVibrant} est absent de la page`);
    const varsSignature = vitrineThemes.getTheme("signature").vars["--blue"];
    verifier(!html.includes(varsSignature),
        "la page applique le thème par défaut alors que le marchand en a choisi un autre");

    // ── 5. Aucune couleur de texte en dur ────────────────────────────────
    // Le thème « minimal » est CLAIR. Une seule couleur de texte codée en
    // dur pour le thème sombre le rend illisible — et ça ne se voit que
    // chez le marchand qui a choisi ce thème-là.
    const feuille = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
    const couleursDures = [...feuille.matchAll(/(^|[;{\s])color\s*:\s*(#[0-9a-f]{3,8}|white|black)/gi)]
        .map((m) => m[2])
        // Le badge et le compteur de photos posent leur texte sur un fond
        // opaque qu'ils fixent eux-mêmes : leur contraste ne dépend pas du
        // thème, ils sont donc légitimement en dur.
        .filter((c) => !/^#(fff|000)$/i.test(c));
    verifier(couleursDures.length === 0,
        `${couleursDures.length} couleur(s) de texte en dur dans la feuille — le thème clair deviendra illisible : ${couleursDures.join(", ")}`);

    // ── 6. Un titre hostile est échappé ──────────────────────────────────
    verifier(!html.includes(TITRE_HOSTILE),
        "un titre de produit contenant du HTML est injecté tel quel dans la page (faille XSS)");
    verifier(html.includes("&lt;script&gt;"),
        "le titre hostile n'apparaît pas sous forme échappée — vérifier que le produit est bien rendu");

    // ── 7. Un marchand inconnu ───────────────────────────────────────────
    marchandExiste = false;
    const absent = await rendre();
    verifier(absent.code === 404,
        `une boutique inexistante répond ${absent.code} au lieu de 404`);
    verifier(!absent.html.includes("Pack Canva Pro"),
        "une boutique inexistante affiche quand même des produits");
    marchandExiste = true;

    if (echecs.length) {
        console.error(`❌ vitrine : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ vitrine : ${verifs} vérifications passées`);
})();
