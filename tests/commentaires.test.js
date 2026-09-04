// ==========================================================================
// RÉPONDRE AUX COMMENTAIRES — CE QUI DOIT TENIR
// ==========================================================================
//
// Le danger de ce module n'est pas qu'il ne marche pas : c'est qu'il marche
// TROP. Une réponse automatique sous un post public, mal gardée, écrit
// devant tout le monde et ne s'efface pas des captures d'écran.
//
// Les quatre gardes vérifiés ici, par ordre de gravité :
//
//   1. la boucle    — Meta renvoie NOS réponses comme de nouveaux
//                     commentaires ; sans garde, SAMII se répond à
//                     elle-même sans fin, en public
//   2. le doublon   — Meta réessaie une livraison non acquittée
//   3. le workspace — le même pageId est actif sur TROIS workspaces
//   4. le contenu   — une non-réponse de l'IA ne doit jamais être publiée

const path = require("path");

let passees = 0;
const echecs = [];
function verifier(condition, quoi) {
    passees++;
    if (!condition) { echecs.push(quoi); console.error(`  ❌ ${quoi}`); }
}

// ── LES DOUBLURES ─────────────────────────────────────────────────────────
const dbChemin = require.resolve("../services/db");
let reponsesDb = [];
let casserJournal = false;
const requetes = [];
require.cache[dbChemin] = {
    id: dbChemin, filename: dbChemin, loaded: true,
    exports: {
        query: async (sql, params) => {
            requetes.push({ sql, params });
            // Casser SÉLECTIVEMENT : une doublure qui tombe partout rend
            // tous les chemins identiques, et une assertion qui ne peut pas
            // distinguer deux comportements ne teste rien.
            if (casserJournal && /FROM journal/i.test(sql)) throw new Error("journal injoignable");
            return reponsesDb.length ? reponsesDb.shift() : [];
        },
        pool: {}, transaction: async (fn) => fn({ query: async () => [] }),
        SSL: false, EST_LOCAL: true,
    },
};

const geminiChemin = require.resolve("../services/geminiService");
let reponseIA = { type: "text", text: "Merci ! Passe voir, tu verras vite." };
require.cache[geminiChemin] = {
    id: geminiChemin, filename: geminiChemin, loaded: true,
    exports: { chat: async () => reponseIA, TOOLS: [], etat: () => ({}), sonder: async () => ({}) },
};

// Meta : on note ce qui PARTIRAIT vraiment. C'est la seule chose qui compte
// — le reste est de la plomberie.
const metaChemin = require.resolve("../services/meta");
const envoyes = [];
require.cache[metaChemin] = {
    id: metaChemin, filename: metaChemin, loaded: true,
    exports: {
        replyToFacebookComment: async (jeton, id, texte) => { envoyes.push({ reseau: "facebook", id, texte }); return { id: "r1" }; },
        replyToInstagramComment: async (jeton, id, texte) => { envoyes.push({ reseau: "instagram", id, texte }); return { id: "r2" }; },
    },
};

const connChemin = require.resolve("../services/connectorService");
let connecteur = { config: { pageAccessToken: "un-jeton-de-page" } };
require.cache[connChemin] = {
    id: connChemin, filename: connChemin, loaded: true,
    exports: { getOne: async () => connecteur },
};

const commentaires = require("../engines/social/commentaires");

const PAGE = "1104617002736031";
const IG = "17841427552459308";

// Un commentaire ordinaire, venu de quelqu'un d'autre que nous.
const unCommentaire = (extra = {}) => ({
    plateforme: "facebook", commentaireId: "c_1", texte: "Ça marche vraiment ?",
    auteurId: "9999", auteurNom: "Awa", pageId: PAGE, ...extra,
});

(async () => {

console.log("── L'interrupteur ──");
{
    process.env.SOCIAL_REPONSES_COMMENTAIRES = "";
    verifier(commentaires.actif() === false, "sans SOCIAL_REPONSES_COMMENTAIRES, la réponse automatique est éteinte");
    const r = await commentaires.traiter(unCommentaire());
    verifier(r.fait === false, "et rien ne part");
    verifier(/SOCIAL_REPONSES_COMMENTAIRES/.test(r.raison), "le motif nomme la variable : " + r.raison);
    process.env.SOCIAL_REPONSES_COMMENTAIRES = "OUI";
    verifier(commentaires.actif() === true, "à OUI, elle s'allume");
}

console.log("── LA BOUCLE : SAMII ne se répond jamais à elle-même ──");
{
    // Le défaut le plus grave de tout le module. Meta renvoie nos propres
    // réponses comme de nouveaux commentaires : sans ce garde, chaque
    // réponse en déclenche une autre, sur une vraie page, devant de vraies
    // personnes, jusqu'à la limite de débit.
    verifier(commentaires.estNous({ auteurId: PAGE, pageId: PAGE }), "un commentaire signé par la Page, c'est nous");
    verifier(commentaires.estNous({ auteurId: IG, igAccountId: IG }), "idem pour le compte Instagram");
    verifier(!commentaires.estNous({ auteurId: "9999", pageId: PAGE }), "un visiteur n'est pas nous");
    verifier(!commentaires.estNous({ auteurId: PAGE }), "sans page connue, on ne se reconnaît pas — et on s'abstiendra plus loin");

    envoyes.length = 0;
    const r = await commentaires.traiter(unCommentaire({ auteurId: PAGE }));
    verifier(r.fait === false, "notre propre réponse ne déclenche pas de réponse");
    verifier(/propre réponse/.test(r.raison), "et le motif le dit : " + r.raison);
    verifier(envoyes.length === 0, "RIEN n'est parti chez Meta");

    // Le garde doit passer AVANT tout appel réseau : sinon on paie un appel
    // au modèle pour chaque réponse qu'on se renvoie à soi-même.
    verifier(requetes.filter((q) => /journal/.test(q.sql)).length === 0,
        "et aucune requête n'a été faite — le garde passe avant tout le reste");
}

console.log("── LE DOUBLON : Meta réessaie, SAMII ne répète pas ──");
{
    envoyes.length = 0;
    reponsesDb = [[{ "?column?": 1 }]];          // le journal dit : déjà répondu
    const r = await commentaires.traiter(unCommentaire());
    verifier(r.fait === false && /déjà répondu/.test(r.raison), "un commentaire déjà traité est ignoré");
    verifier(envoyes.length === 0, "et rien ne repart");

    // Journal illisible : on s'abstient. Répondre deux fois en public est
    // pire que ne pas répondre — le premier se voit, le second se rattrape.
    //
    // PREMIÈRE VERSION DE CE CONTRÔLE : elle cassait TOUTE la base. La
    // recherche du workspace échouait alors elle aussi, donc `fait:false`
    // arrivait de toute façon — l'assertion passait au vert que le garde
    // existe ou non. Vérifié en le retirant : le test ne bronchait pas.
    // On ne casse donc QUE la lecture du journal, pour que seul le garde
    // testé puisse expliquer le résultat.
    reponsesDb = [];
    casserJournal = true;
    envoyes.length = 0;
    const r2 = await commentaires.traiter(unCommentaire({ commentaireId: "c_2" }));
    casserJournal = false;
    verifier(r2.fait === false, "journal illisible : on s'abstient au lieu de risquer un doublon public");
    verifier(/anti-doublon|déjà répondu/i.test(r2.raison || ""),
        "et c'est bien l'anti-doublon qui arrête, pas un effet de bord : " + r2.raison);
    verifier(envoyes.length === 0, "et rien ne part");
}

console.log("── LE WORKSPACE : le même pageId sur trois workspaces ──");
{
    // Mesuré en base le 4 septembre : pageId 1104617002736031 est ACTIF sur
    // trois workspaces. Un LIMIT 1 sans ORDER BY rendrait une ligne
    // différente d'un appel à l'autre — c'est le défaut déjà payé sur le
    // choix du QG.
    requetes.length = 0;
    reponsesDb = [[{ workspace_id: "WS-choisi", type: "facebook" }]];
    const ws = await commentaires.workspaceDe({ pageId: PAGE });
    verifier(ws === "WS-choisi", "un workspace est bien résolu");

    const q = requetes.find((x) => /connecteurs/.test(x.sql));
    // PREMIÈRE VERSION : `/ORDER BY/i.test(sql)`. Insuffisant — remplacer le
    // tri par « ORDER BY 1=1 OR … » laissait les deux mots en place et le
    // contrôle restait vert. On lit donc ce que le tri CONTIENT.
    const tri = q ? String(q.sql).split(/ORDER BY/i)[1] || "" : "";
    verifier(tri.trim().length > 0, "la requête est ORDONNÉE — jamais une ligne au hasard");
    // DEUXIÈME VERSION. La première cherchait `(workspace_id = $3) DESC`
    // n'importe où dans le tri — or « ORDER BY 1=1 OR (workspace_id = $3)
    // DESC » contient encore ce motif, tout en neutralisant complètement le
    // critère. Le contrôle restait vert sur un tri cassé. On isole donc le
    // PREMIER terme et on exige qu'il soit exactement celui-là.
    const premierTerme = (tri.split(",")[0] || "").trim();
    verifier(/^\(\s*workspace_id\s*=\s*\$3\s*\)\s*DESC$/i.test(premierTerme),
        "SOCIAL_WORKSPACE est le PREMIER terme du tri, seul et entier — reçu « " + premierTerme + " »");
    verifier(/workspace_id\s+ASC/i.test(tri),
        "et le tri se termine sur une colonne stable — sinon deux workspaces à égalité rendent une ligne différente à chaque appel");
    verifier(q && /actif\s*=\s*TRUE/i.test(q.sql), "et elle ne retient que les connecteurs actifs");
    verifier(q && q.params.includes(process.env.SOCIAL_WORKSPACE || ""),
        "SOCIAL_WORKSPACE est passé en premier critère : une décision écrite bat un tri");

    // Aucun workspace : on ne devine pas, on dit pourquoi.
    reponsesDb = [[]];
    const rien = await commentaires.workspaceDe({ pageId: "inconnue" });
    verifier(rien === null, "une page inconnue ne rend pas un workspace au hasard");

    envoyes.length = 0;
    reponsesDb = [[], []];   // pas de doublon, puis aucun workspace
    const r = await commentaires.traiter(unCommentaire({ commentaireId: "c_3", pageId: "inconnue" }));
    verifier(r.fait === false && /aucun workspace/.test(r.raison), "et la réponse dit laquelle : " + r.raison);
    verifier(envoyes.length === 0, "rien ne part");
}

console.log("── LE CONTENU : une non-réponse de l'IA ne se publie pas ──");
{
    // Le même piège que pour le créateur, en pire : ici la phrase d'excuse
    // s'afficherait SOUS un post public, signée SAMII.
    envoyes.length = 0;
    reponsesDb = [[], [{ workspace_id: "WS-1" }]];
    reponseIA = { type: "text", degrade: true, motif: "les 4 fournisseurs ont échoué",
                  text: "SAMII réfléchit un peu plus longtemps que prévu, réessaie dans une minute." };
    const r = await commentaires.traiter(unCommentaire({ commentaireId: "c_4" }));
    verifier(r.fait === false, "une réponse dégradée n'est pas publiée");
    verifier(/aucune réponse de l'IA/.test(r.raison), "et le motif le nomme : " + r.raison);
    verifier(envoyes.length === 0, "la phrase d'excuse ne part PAS sous un post public");

    reponsesDb = [[], [{ workspace_id: "WS-1" }]];
    reponseIA = { type: "text", text: "   " };
    const vide = await commentaires.traiter(unCommentaire({ commentaireId: "c_5" }));
    verifier(vide.fait === false && /vide/.test(vide.raison), "un texte vide est refusé");

    reponsesDb = [[], [{ workspace_id: "WS-1" }]];
    reponseIA = { type: "text", text: "x".repeat(2000) };
    const long = await commentaires.traiter(unCommentaire({ commentaireId: "c_6" }));
    verifier(long.fait === false && /trop longue/.test(long.raison), "une tirade de 2000 caractères est refusée");
}

console.log("── LE CAS NORMAL : ça répond, et une seule fois ──");
{
    envoyes.length = 0;
    requetes.length = 0;
    reponsesDb = [[], [{ workspace_id: "WS-1", type: "facebook" }]];
    reponseIA = { type: "text", text: "« Oui — essaie, tu verras en une journée. »" };
    const r = await commentaires.traiter(unCommentaire({ commentaireId: "c_7" }));

    verifier(r.fait === true, "un vrai commentaire reçoit une vraie réponse");
    verifier(envoyes.length === 1, "une seule réponse part");
    verifier(envoyes[0].reseau === "facebook" && envoyes[0].id === "c_7", "sur le bon réseau, sous le bon commentaire");
    verifier(!/^[«"]/.test(envoyes[0].texte), "les guillemets du modèle sont retirés : « " + envoyes[0].texte + " »");
    verifier(envoyes[0].texte.length <= commentaires.LONGUEUR_MAX, "la réponse est courte");

    // On marque AVANT d'envoyer : si l'envoi réussit et que la trace échoue,
    // la prochaine livraison ferait répondre une seconde fois.
    const iMarque = requetes.findIndex((q) => /INSERT INTO journal/i.test(q.sql));
    verifier(iMarque >= 0, "la réponse est tracée en base");
}

console.log("── LIRE UNE LIVRAISON META ──");
{
    const lus = commentaires.lireLivraison({
        entry: [
            { id: PAGE, changes: [
                { field: "feed", value: { item: "comment", verb: "add", comment_id: "fb_1", message: "Bravo", from: { id: "42", name: "Awa" } } },
                { field: "feed", value: { item: "comment", verb: "edited", comment_id: "fb_2", message: "corrigé" } },
                { field: "feed", value: { item: "reaction", verb: "add" } },
                { field: "feed", value: { item: "comment", verb: "remove", comment_id: "fb_3" } },
            ] },
            { id: IG, changes: [
                { field: "comments", value: { id: "ig_1", text: "C'est dispo ?", from: { id: "77", username: "moussa" } } },
            ] },
        ],
    });

    verifier(lus.length === 2, `2 commentaires retenus sur 5 changements (reçu ${lus.length})`);
    verifier(lus[0].plateforme === "facebook" && lus[0].commentaireId === "fb_1", "l'ajout Facebook est lu");
    verifier(lus[0].auteurNom === "Awa" && lus[0].pageId === PAGE, "avec son auteur et sa page");
    verifier(!lus.some((x) => x.commentaireId === "fb_2"), "une ÉDITION n'est pas un nouveau commentaire");
    verifier(!lus.some((x) => x.commentaireId === "fb_3"), "une SUPPRESSION non plus — répondre à un commentaire effacé n'a aucun sens");
    verifier(lus[1].plateforme === "instagram" && lus[1].commentaireId === "ig_1", "Instagram range ses champs autrement, la sortie est la même");
    verifier(lus[1].auteurNom === "moussa" && lus[1].igAccountId === IG, "avec son auteur et son compte");

    verifier(commentaires.lireLivraison({}).length === 0, "une livraison vide ne casse rien");
    verifier(commentaires.lireLivraison(null).length === 0, "null non plus");
}

if (echecs.length) {
    console.error(`\n❌ commentaires : ${echecs.length} problème(s) sur ${passees} vérifications\n`);
    for (const e of echecs) console.error(`   • ${e}`);
    process.exit(1);
}
console.log(`\n✅ commentaires : ${passees} vérifications passées`);
})().catch((e) => {
    console.error("\n❌ commentaires :", e.message, e.stack);
    process.exit(1);
});
