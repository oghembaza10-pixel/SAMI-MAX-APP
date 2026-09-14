// ==========================================================================
// SAMII OS — LA PAGE D'ACCUEIL : CE QU'ELLE MONTRE, ET CE QU'ELLE PROMET
// ==========================================================================
//
// ── CE QUE CETTE SUITE GARDE ─────────────────────────────────────────────
//
// La homepage est devenue la vitrine principale : le produit commence par le
// chat. Elle affiche donc deux choses qu'on peut se tromper en affichant —
// des PRIX et un QUOTA. Les deux existent ailleurs, dans du code qui
// facture et qui compte.
//
// Une page qui recopie un prix finit toujours par contredire la facture. Ce
// n'est pas une hypothèse : `MONTANTS` annonçait « 2 $ = 200 messages »,
// écrit en dur, et c'est devenu faux le jour où le prix du message a changé
// — sans qu'une seule ligne de code bouge.
//
// Cette suite vérifie donc que la page LIT ses chiffres et ne les écrit pas.
//
// ── ET CE QU'ELLE NE DOIT PAS MONTRER ────────────────────────────────────
//
// Aucun appel Gemini, aucun token, aucun coût fournisseur, aucune marge. Un
// marchand achète « envoyer une facture », pas « quatre requêtes d'API ».
//
// Lancer :  node tests/vitrine-chat.test.js
// ==========================================================================

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const CREDITS = require("../config/credits");
const QUOTA = require("../services/samiiQuota");

const RACINE = path.join(__dirname, "..");

// Le même échappement qu'EJS applique à `<%= %>`. On l'écrit plutôt que de
// l'importer : un test qui partage la fonction qu'il vérifie ne vérifie rien.
const echapper = (t) => String(t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;").replace(/'/g, "&#39;");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── LE GABARIT EST RENDU POUR DE VRAI ────────────────────────────────────
//
// Pas une lecture de fichier : un rendu EJS complet, avec les mêmes données
// que celles que `donneesAccueil()` fournit. Une page qui compile n'est pas
// une page qui affiche — et c'est justement l'écart qu'on veut mesurer.
function rendre(extra = {}) {
    const gabarit = fs.readFileSync(path.join(RACINE, "views/samii-accueil.ejs"), "utf8");
    return ejs.render(gabarit, {
        lang: "fr", dir: "ltr",
        L: (x) => x, v: (x) => x,
        languesDispo: ["fr", "en", "ar"], lienLangue: (c) => "/lang/" + c,
        loggedIn: false, nom: "", typeCompte: "client", tarifs: {},
        qgs: [], projets: [], workspaceId: "",
        cloudinary: { CLOUD_NAME: "x", UPLOAD_PRESET: "y" },
        grilleCredits: CREDITS.grilleVisible(),
        creditEnUSD: 0.01,
        quotaGratuit: { messages: QUOTA.QUOTA_GRATUIT_PAR_FENETRE, heures: QUOTA.FENETRE_HEURES },
        ...extra,
    }, { filename: path.join(RACINE, "views/samii-accueil.ejs") });
}

let page;
try {
    page = rendre();
} catch (err) {
    console.log(`\n❌ page d'accueil : le gabarit ne se rend plus — ${err.message}\n`);
    process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════
// 1. LA PAGE SE REND, ET ELLE REND LE CHAT
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(page.length > 5000, `la page fait ${page.length} caractères — elle est tronquée`);
    verifier(page.includes('id="saisie"'), "le formulaire de saisie a disparu : le chat est la page");
    verifier(page.includes('id="champ"'), "le champ de texte a disparu");
    verifier(page.includes('id="envoyer"'), "le bouton d'envoi a disparu");
    verifier(page.includes('id="fil"'), "le fil de conversation a disparu");
    verifier(/Tu fais quoi, toi/.test(page), "la question d'ouverture a disparu");

    // Les quatre amorces, et la première doit porter une DEMANDE.
    const amorces = (page.match(/class="amorce"/g) || []).length;
    verifier(amorces === 4, `${amorces} amorces au lieu de 4`);
    verifier(/aide-moi à développer ça/.test(page),
        "la première amorce ne propose plus d'action : elle montre à quoi sert SAMII");

    // Micro et pièce jointe restent offerts sans compte — c'est ce qui donne
    // envie de s'inscrire.
    verifier(page.includes('id="micro"') && page.includes('id="joindre"'),
        "le micro ou la pièce jointe a disparu du champ");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LES PRIX AFFICHÉS SONT CEUX QUI SERONT FACTURÉS
// ══════════════════════════════════════════════════════════════════════════
//
// LE PIÈGE DE CE CHANTIER. Neuf prix dans une feuille, c'est neuf occasions
// de mentir. On vérifie que chaque ligne de la modale porte EXACTEMENT le
// chiffre que `config/credits.js` facture.
{
    const grille = CREDITS.grilleVisible();
    verifier(grille.length >= 8, `la grille visible ne porte que ${grille.length} lignes`);
    verifier(page.includes('id="voile-tarifs"'), "la feuille « comprendre les crédits » n'est pas rendue");

    const lignes = (page.match(/tarifs__ligne/g) || []).length;
    verifier(lignes >= grille.length,
        `${lignes} lignes rendues pour ${grille.length} entrées de grille`);

    for (const r of grille) {
        const attendu = r.credits === 0 ? "Gratuit" : `${r.credits} crédits`;
        verifier(page.includes(attendu),
            `« ${r.quoi} » devrait s'afficher « ${attendu} » et ne se trouve pas dans la page`);
        // ⚠️ ON COMPARE CE QUI ARRIVE AU NAVIGATEUR, PAS LA CHAÎNE SOURCE.
        //
        // EJS échappe le HTML : « Étape d'agent » devient « Étape d&#39;agent ».
        // Chercher la chaîne brute faisait échouer ce test sur un libellé
        // pourtant correctement affiché — un défaut de l'instrument, pas de
        // la page. Et accessoirement, comparer la version échappée vérifie
        // AUSSI que l'échappement a bien lieu.
        verifier(page.includes(echapper(r.quoi)),
            `le libellé « ${r.quoi} » n'apparaît pas`);
    }

    // Et les prix de la grille visible sont bien ceux de la facturation.
    const c = (usd) => Math.round(usd / 0.01);
    const parQuoi = Object.fromEntries(grille.map((r) => [r.quoi, r.credits]));
    verifier(parQuoi["Travailler dans ton QG"] === c(CREDITS.PRIX_MESSAGE_USD),
        "le prix du message affiché ne suit plus PRIX_MESSAGE_USD");
    verifier(parQuoi["Action simple"] === c(CREDITS.prixActe("passer_commande")),
        "le prix de l'action simple affiché ne suit plus celui qui est facturé");
    verifier(parQuoi["Mission complète"] === c(CREDITS.prixActe("preparer_publication")),
        "le prix de la mission affiché ne suit plus celui qui est facturé");
    verifier(parQuoi["Parler avec SAMII"] === 0,
        "parler avec SAMII n'est plus annoncé gratuit");

    verifier(/1 crédit = 0\.01 \$|1 crédit = 0,01 \$/.test(page),
        "l'unité « 1 crédit = 0,01 $ » n'est pas affichée : les nombres n'ont plus d'échelle");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LA PAGE NE MONTRE JAMAIS LA PLOMBERIE
// ══════════════════════════════════════════════════════════════════════════
//
// Le client achète un geste, pas des requêtes d'API. Lui montrer le nombre
// d'appels ou le coût fournisseur ne l'aide pas à décider : ça lui apprend à
// comparer SAMII à une facture Google, ce qui n'est pas le même produit.
{
    // On mesure le TEXTE VISIBLE, pas les commentaires EJS — ceux-ci ne
    // partent jamais au navigateur, et ils parlent forcément de tout ça.
    const visible = page.replace(/<!--[\s\S]*?-->/g, "");
    const INTERDITS = [
        [/\bgemini\b/i, "le nom du fournisseur"],
        [/\btokens?\b/i, "les tokens"],
        [/thinking|réflexion facturée/i, "les tokens de réflexion"],
        [/\bmarge\b/i, "la marge"],
        [/appels? (gemini|d'api|api)/i, "le nombre d'appels"],
        [/usageMetadata|promptTokenCount/i, "les champs bruts du fournisseur"],
    ];
    for (const [motif, quoi] of INTERDITS) {
        verifier(!motif.test(visible),
            `la page montre ${quoi} : le client n'achète pas de la plomberie, ` +
            "et l'afficher lui apprend à comparer SAMII à une facture Google");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE QUOTA AFFICHÉ EST CELUI QUI S'APPLIQUE
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ LA GARDE LA PLUS IMPORTANTE DE CETTE SUITE.
//
// La règle commerciale annoncée est « 20 messages / 5 h ». Le code applique
// 30 / 7 h. Écrire « 20 » dans le gabarit aurait annoncé MOINS que ce qu'on
// donne réellement — et le jour où le quota sera aligné, la page resterait
// fausse dans l'autre sens.
//
// La page lit donc `services/samiiQuota.js`, quoi qu'il dise.
{
    verifier(page.includes(String(QUOTA.QUOTA_GRATUIT_PAR_FENETRE)),
        `la page n'affiche pas le quota réellement appliqué (${QUOTA.QUOTA_GRATUIT_PAR_FENETRE} messages)`);
    verifier(new RegExp(`${QUOTA.FENETRE_HEURES}\\s*h`).test(page),
        `la page n'affiche pas la fenêtre réellement appliquée (${QUOTA.FENETRE_HEURES} h)`);

    // Et le gabarit ne doit contenir AUCUN quota écrit en dur.
    const gabarit = fs.readFileSync(path.join(RACINE, "views/samii-accueil.ejs"), "utf8")
        .replace(/<%#[\s\S]*?%>/g, "");
    verifier(/quotaVu\.messages/.test(gabarit),
        "le gabarit n'affiche plus le quota depuis sa source : il pourrait mentir sur l'offre");
    verifier(!/20 messages gratuits|30 messages gratuits/.test(gabarit),
        "un nombre de messages gratuits est ÉCRIT EN DUR dans le gabarit — c'est exactement " +
        "le piège des « 200 messages » des boutons de recharge");

    // Un visiteur connecté ne voit pas la règle du gratuit : elle ne le
    // concerne pas, et deux compteurs sur la même ligne feraient une alerte.
    const connectee = rendre({ loggedIn: true, nom: "Omar" });
    verifier(!connectee.includes('id="jauge-regle"'),
        "la règle du gratuit s'affiche pour quelqu'un de connecté");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. AUCUN TEXTE VISIBLE N'ÉCHAPPE À LA TRADUCTION
// ══════════════════════════════════════════════════════════════════════════
//
// FR / EN / AR doivent rester fonctionnels. Une phrase française codée en
// dur dans le gabarit reste française en arabe — et sur une page qui passe
// en RTL, elle se voit tout de suite.
{
    const gabarit = fs.readFileSync(path.join(RACINE, "views/samii-accueil.ejs"), "utf8");
    // Les nouveaux textes de ce chantier, un par un.
    const NOUVEAUX = [
        "Comprendre les crédits",
        "Recharger SAMII",
        "messages gratuits",
        "renouvelés toutes les",
        "crédits", "crédit", "Gratuit", "Fermer",
    ];
    for (const t of NOUVEAUX) {
        const echappe = new RegExp(`L\\(\\s*["']${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
        verifier(echappe.test(gabarit),
            `« ${t} » n'est pas passé par L() : il resterait en français en anglais et en arabe`);
    }

    // La page se rend aussi en arabe, en RTL, sans exploser.
    let ar;
    try { ar = rendre({ lang: "ar", dir: "rtl" }); } catch (e) { ar = null; }
    verifier(ar && ar.includes('dir="rtl"'), "la page ne se rend plus en arabe / RTL");
    verifier(ar && ar.includes('id="voile-tarifs"'), "la feuille des crédits disparaît en arabe");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LA FEUILLE DES CRÉDITS EST UTILISABLE AU CLAVIER
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(/role="dialog"/.test(page), "la feuille n'est pas annoncée comme un dialogue");
    verifier(/aria-modal="true"/.test(page), "la feuille n'est pas annoncée comme modale");
    verifier(/aria-labelledby="tarifs-titre"/.test(page), "la feuille n'a pas de titre annoncé");
    verifier(page.includes('id="fermer-tarifs"'), "la feuille n'a pas de bouton de fermeture");

    const js = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8");
    verifier(/Escape[\s\S]{0,200}voile\.hidden|voile\.hidden[\s\S]{0,200}Escape/.test(js),
        "Échap ne ferme pas la feuille des crédits");
    verifier(/rendreLa[\s\S]{0,120}focus\(\)/.test(js),
        "le focus n'est pas rendu à son point de départ en fermant : quelqu'un au clavier " +
        "serait renvoyé en haut de page et devrait tout reparcourir");
    verifier(/document\.body\.style\.overflow\s*=\s*""/.test(js),
        "le défilement du fond n'est pas rétabli à la fermeture : la page resterait bloquée");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. L'ANCIENNE VITRINE N'A PAS ÉTÉ SUPPRIMÉE
// ══════════════════════════════════════════════════════════════════════════
//
// Elle sert le SEO et les pages métiers. Ce chantier refait la façade, il ne
// jette pas ce qui est derrière.
{
    verifier(fs.existsSync(path.join(RACINE, "views/index.ejs")),
        "views/index.ejs a été supprimée — c'est l'ancienne vitrine, servie sur " +
        "/accueil-classique et utilisée pour le SEO");
    const idx = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
    verifier(/accueil-classique/.test(idx),
        "la route /accueil-classique a disparu");
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ page d'accueil : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ page d'accueil : ${verifs} vérifications passées`);
process.exit(0);
