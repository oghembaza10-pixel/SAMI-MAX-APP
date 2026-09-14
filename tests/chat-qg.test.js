// ==========================================================================
// SAMII OS — LE CHAT DU QG (/samii) : SON COMPOSER ET SA STRUCTURE
// ==========================================================================
//
// ── LE BUG QUI EST REVENU DEUX FOIS ──────────────────────────────────────
//
// Le composer n'avait qu'UNE rangée, où tout se disputait la largeur :
// trombone, champ, niveau, micro, résumé, directives, connaissances,
// envoyer. Huit contrôles.
//
// MESURÉ dans un navigateur à 390 px de large :
//
//     micro    x=402   HORS ÉCRAN
//     envoyer  x=552   HORS ÉCRAN
//
// Sur un écran de 390 px. On ne pouvait PAS envoyer un message depuis un
// téléphone — et sans débordement horizontal signalé, le composer coupait
// simplement ce qui dépassait.
//
// Ce défaut avait DÉJÀ été corrigé une fois : une règle @media masquait
// #samii-lang-select et #samii-resume-btn, avec exactement le même
// diagnostic écrit en commentaire. Puis trois boutons ont été ajoutés, et
// le bug est revenu. Masquer des identifiants un par un est un correctif
// qui expire au prochain bouton.
//
// Cette suite garde la STRUCTURE, pas une liste :
//   · l'essentiel (micro, champ, envoyer) vit sur une rangée qui ne peut
//     pas déborder — les deux boutons ne rétrécissent jamais, le champ
//     absorbe toute la compression ;
//   · les outils rares vivent ailleurs, et peuvent s'y accumuler.
//
// Lancer :  node tests/chat-qg.test.js
// ==========================================================================

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const NIVEAUX = require("../config/niveaux");

const RACINE = path.join(__dirname, "..");
let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// Le gabarit est RENDU, pas lu : une page qui compile n'est pas une page
// qui affiche, et c'est justement l'écart qui nous intéresse.
function rendre(extra = {}) {
    const gabarit = fs.readFileSync(path.join(RACINE, "views/samii.ejs"), "utf8");
    return ejs.render(gabarit, {
        lang: "fr", dir: "ltr", L: (x) => x, v: (x) => x,
        languesDispo: ["fr", "en", "ar"], lienLangue: (c) => "/lang/" + c,
        workspaceId: "ws-1", shop: "", estParticulier: false,
        communaute: { slug: "samii" }, typeCompte: "marchand",
        loggedIn: true, nom: "Test", qgs: [], projets: [],
        niveaux: NIVEAUX.pourAffichage(),
        plafondNiveau: "expert",
        ordreNiveaux: NIVEAUX.ORDRE,
        niveauParDefaut: NIVEAUX.PRESELECTION,
        // La colonne partagée (partials/qg-nav) lit ce registre depuis
        // app.locals : un gabarit EJS n'a pas de `require`. On le fournit ici
        // comme index.js le fait, plutôt que de le remplacer par un faux — un
        // test qui invente ses données ne teste plus la vraie page.
        modulesQg: require("../config/modules-qg"),
        COM: { slug: "samii" },
        ...extra,
    }, { filename: path.join(RACINE, "views/samii.ejs") });
}

let page;
try {
    page = rendre();
} catch (err) {
    console.log(`\n❌ chat du QG : le gabarit ne se rend plus — ${err.message}\n`);
    process.exit(1);
}

const css = fs.readFileSync(path.join(RACINE, "public/css/samii-style.css"), "utf8");
const jsBrut = fs.readFileSync(path.join(RACINE, "public/js/samii-page.js"), "utf8");
// ⚠️ INSTRUMENT. Les gardes cherchent des motifs qui figurent forcément dans
// les commentaires qui les EXPLIQUENT (« display:none » est cité pour
// raconter le bug du micro). Sans ce décapage, un garde se déclencherait sur
// sa propre documentation — c'est arrivé trois fois dans ce projet.
const js = jsBrut
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// ══════════════════════════════════════════════════════════════════════════
// 1. LA RANGÉE ESSENTIELLE : MICRO · CHAMP · ENVOYER
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(page.includes('id="samii-mic-btn"'), "le bouton micro a disparu du composer");
    verifier(page.includes('id="samii-page-input"'), "le champ de saisie a disparu");
    verifier(page.includes('id="samii-page-send"'),
        "le bouton envoyer n'a pas d'identifiant — rien ne peut plus l'allumer ni l'éteindre");

    // Les trois sont dans la MÊME rangée, et dans cet ordre : micro à gauche
    // du champ, envoyer à droite.
    const ligne = page.slice(page.indexOf('class="composer__ligne"'), page.indexOf('class="composer__outils"'));
    verifier(ligne.length > 100, "la rangée essentielle est introuvable dans la page rendue");
    const iMicro = ligne.indexOf('id="samii-mic-btn"');
    const iChamp = ligne.indexOf('id="samii-page-input"');
    const iEnvoi = ligne.indexOf('id="samii-page-send"');
    verifier(iMicro >= 0 && iChamp >= 0 && iEnvoi >= 0,
        "micro, champ ou envoyer ne sont plus dans la rangée essentielle — ils peuvent à nouveau être poussés hors de l'écran");
    verifier(iMicro < iChamp, "le micro n'est plus à gauche du champ");
    verifier(iChamp < iEnvoi, "le bouton envoyer n'est plus à droite du champ");

    // ── ET LES OUTILS RARES NE SONT PAS DANS CETTE RANGÉE ────────────────
    //
    // C'est LA règle qui empêche le bug de revenir : tout nouveau bouton va
    // ailleurs. S'il entre ici, il repousse envoyer vers le bord.
    for (const intrus of ["samii-resume-btn", "samii-directives-btn",
                          "samii-connaissances-btn", "samii-attach-btn", "samii-niveau"]) {
        verifier(!ligne.includes(`id="${intrus}"`),
            `« ${intrus} » est entré dans la rangée essentielle : il repousse le bouton envoyer vers le bord de l'écran`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LA GÉOMÉTRIE QUI REND LE DÉBORDEMENT IMPOSSIBLE
// ══════════════════════════════════════════════════════════════════════════
//
// Ce ne sont pas des préférences d'apparence : ce sont les trois propriétés
// qui font que la rangée ne PEUT pas déborder, quelle que soit la largeur.
{
    const bloc = (sel) => {
        const i = css.indexOf(sel);
        return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
    };
    const ronds = bloc(".composer__rond, .composer__envoi {");
    verifier(/flex-shrink:\s*0/.test(ronds),
        "micro et envoyer peuvent rétrécir : ils se réduiront à rien avant que le champ ne cède");
    verifier(/width:\s*44px/.test(ronds) && /height:\s*44px/.test(ronds),
        "micro et envoyer ne font plus 44 px : en dessous, on rate le bouton un doigt sur deux");

    const champ = bloc(".composer__champ {");
    verifier(/min-width:\s*0/.test(champ),
        "le champ n'a plus `min-width: 0` — c'est LE mécanisme du bug : sans lui, "
        + "un texte long pousse les voisins hors de l'écran au lieu de se comprimer");
    verifier(/font-size:\s*16px/.test(champ),
        "le champ n'est plus à 16 px : en dessous, iOS zoome au premier appui et le composer sort du cadre");
    verifier(/resize:\s*none/.test(champ), "la poignée de redimensionnement est revenue dans le composer");

    // La rangée essentielle ne doit PAS passer à la ligne : le champ doit
    // rester entre les deux boutons, jamais au-dessus.
    verifier(!/\.composer__ligne\s*{[^}]*flex-wrap:\s*wrap/.test(css),
        "la rangée essentielle passe à la ligne : le champ se retrouverait seul, micro et envoyer en dessous");
    // La rangée des outils, elle, DOIT pouvoir passer à la ligne.
    verifier(/\.composer__outils\s*{[^}]*flex-wrap:\s*wrap/.test(css),
        "la rangée des outils ne passe plus à la ligne : elle débordera au prochain bouton ajouté");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LA LISTE NOIRE PAR IDENTIFIANT NE DOIT PAS REVENIR
// ══════════════════════════════════════════════════════════════════════════
//
// C'était le premier correctif, et il a péri au bouton suivant. Si quelqu'un
// le réécrit, c'est que la structure a re-cassé — et ce test doit le dire
// plutôt que de laisser le cycle recommencer.
{
    const media = css.slice(css.indexOf("@media (max-width: 900px)"));
    const masques = (media.match(/#samii-[a-z-]+\s*(,\s*#samii-[a-z-]+\s*)*{\s*display:\s*none/g) || []);
    verifier(masques.length === 0,
        `une règle masque à nouveau des boutons par identifiant sur mobile (${masques.length}) — `
        + "ce correctif expire au prochain bouton ajouté, c'est la structure qui doit tenir");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LES ICÔNES DU COMPOSER NE DÉPENDENT PLUS D'UN CDN
// ══════════════════════════════════════════════════════════════════════════
//
// Elles étaient toutes des <i data-lucide>, remplacées au chargement par un
// script tiré d'unpkg. MESURÉ quand ce script ne répond pas : le composer
// rendait 0 svg et 8 <i> VIDES — huit boutons invisibles, micro et envoyer
// compris. « Pas de bouton microphone visible » : c'est un de ces cas.
{
    const composer = page.slice(page.indexOf('<form class="composer"'), page.indexOf("</form>"));
    const rangee = composer.slice(0, composer.indexOf('class="composer__outils"'));
    verifier(!/data-lucide/.test(rangee),
        "un bouton de la rangée essentielle dépend encore de Lucide : si le CDN ne répond pas, "
        + "il est invisible et la conversation devient impossible");
    verifier((composer.match(/<svg/g) || []).length >= 4,
        "les icônes du composer ne sont plus écrites en SVG dans la page");

    // Les menus gardent Lucide — mais ils portent un LIBELLÉ TEXTE, donc une
    // icône manquante y est un défaut d'apparence, pas une fonction perdue.
    for (const b of ["samii-resume-btn", "samii-directives-btn", "samii-connaissances-btn"]) {
        const i = composer.indexOf(`id="${b}"`);
        verifier(i >= 0 && /<span>/.test(composer.slice(i, i + 320)),
            `« ${b} » n'a pas de libellé texte : sans Lucide, ce serait un bouton vide`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LE BOUTON ENVOYER DIT S'IL PEUT SERVIR
// ══════════════════════════════════════════════════════════════════════════
{
    // Désactivé DANS LE HTML, pas seulement par le script : si celui-ci tarde
    // ou casse, on doit voir un bouton éteint, pas un bouton actif qui
    // n'envoie rien.
    const envoi = page.slice(page.indexOf('id="samii-page-send"') - 200, page.indexOf('id="samii-page-send"') + 200);
    verifier(/\sdisabled/.test(envoi),
        "le bouton envoyer n'est plus désactivé dans le HTML : avant que le script tourne, "
        + "il paraîtrait actif sans rien envoyer");

    verifier(/function rafraichirEnvoi/.test(js), "plus rien ne met à jour l'état du bouton envoyer");
    verifier(/sendBtn\.disabled\s*=\s*occupe\s*\|\|\s*!rempli/.test(js),
        "l'état du bouton ne dépend plus à la fois du contenu du champ et d'un envoi en cours");
    verifier(/if \(occupe\) return;/.test(js),
        "rien n'empêche deux envois simultanés : deux clics rapides feraient deux tours, et un tour se facture");
    verifier(/\} finally \{[\s\S]{0,400}marquerOccupe\(false\)/.test(js),
        "le déverrouillage n'est pas dans un `finally` : un flux coupé laisserait le composer "
        + "éteint pour toujours et la conversation morte sans un mot");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE CLAVIER : ENTRÉE ENVOIE, SHIFT+ENTRÉE VA À LA LIGNE
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(/<textarea[^>]*id="samii-page-input"/.test(page),
        "le champ est redevenu un <input> : une seule ligne, donc Shift+Entrée ne peut rien vouloir dire");
    verifier(/e\.key !== ['"]Enter['"] \|\| e\.shiftKey/.test(js),
        "Entrée et Shift+Entrée ne sont plus distingués");
    verifier(/isComposing/.test(js) && /229/.test(js),
        "la saisie composée (arabe, chinois, accents) n'est plus protégée : Entrée validerait "
        + "un caractère à moitié écrit et enverrait le message");
    verifier(/function ajusterHauteur/.test(js) && /scrollHeight/.test(js),
        "le champ ne grandit plus avec le texte");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LE DÉFILEMENT D'UN VRAI CHAT
// ══════════════════════════════════════════════════════════════════════════
//
// `feed.scrollTop = feed.scrollHeight` était écrit cinq fois, sans condition
// — et ne déplaçait RIEN, parce que le fil n'avait aucun `overflow`. C'est la
// page entière qui bougeait, et le composer partait vers le haut avec elle.
{
    const feed = css.slice(css.indexOf(".samii-chat__feed {"), css.indexOf("}", css.indexOf(".samii-chat__feed {")));
    verifier(/overflow-y:\s*auto/.test(feed),
        "le fil n'a plus de zone défilante : `feed.scrollTop` ne déplacera rien et la page défilera à sa place");

    verifier(/\.qg-main\.samii-page\s*{[^}]*height:\s*100dvh/.test(css),
        "la page n'est plus bornée à la fenêtre : le composer repartira au-delà du bas de l'écran");
    verifier(/@supports not \(height: 100dvh\)/.test(css),
        "aucun repli pour les navigateurs sans `dvh`");

    verifier(/function estEnBas/.test(js) && /function suivre/.test(js),
        "le défilement n'est plus conditionnel : on ramènerait de force en bas quelqu'un en train de relire");
    verifier(/suivre\(true\)/.test(js),
        "on ne redescend plus de force quand c'est la personne elle-même qui envoie");
    // Un seul `scrollTop = scrollHeight` doit rester : celui de `suivre()`.
    const forces = (js.match(/scrollTop\s*=\s*\w*\.?scrollHeight/g) || []).length;
    verifier(forces === 1,
        `${forces} défilements forcés au lieu d'un seul (dans suivre()) — les autres ramènent en bas sans condition`);
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LE MICRO NE DISPARAÎT PLUS SANS EXPLICATION
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(!/micBtn\.style\.display\s*=\s*['"]none['"]/.test(js),
        "le micro redevient invisible quand le navigateur ne sait pas enregistrer : "
        + "on chercherait un bouton absent sans jamais savoir pourquoi");
    verifier(/micBtn\.disabled\s*=\s*true/.test(js) && /micBtn\.title\s*=/.test(js),
        "le micro indisponible n'est plus éteint-et-expliqué");

    const mic = page.slice(page.indexOf('id="samii-mic-btn"') - 260, page.indexOf('id="samii-mic-btn"') + 260);
    verifier(/aria-label=/.test(mic) && /title=/.test(mic),
        "le micro a perdu son aria-label ou son title");
    verifier(/samii-mic-btn--active/.test(css),
        "l'état « en écoute » du micro n'a plus de style : un enregistrement qu'on croit arrêté "
        + "et qui tourne encore est le pire défaut possible sur un micro");
}

// ══════════════════════════════════════════════════════════════════════════
// 9. MÊME SAMII QUE LA VITRINE
// ══════════════════════════════════════════════════════════════════════════
//
// Le QG ajoute son contexte de workspace, rien d'autre. Deux chats du même
// SAMII qui ne partent pas au même niveau, c'est la même question posée deux
// fois avec deux réponses différentes.
{
    verifier(/\/api\/chat\/flux/.test(js), "le flux SSE a disparu du chat du QG");
    verifier(/\/api\/chat['"]/.test(js), "le repli d'un bloc sur /api/chat a disparu");

    const depart = NIVEAUX.PRESELECTION;
    verifier(page.includes(`value="${depart}" selected`) || new RegExp(`value="${depart}"[^>]*selected`).test(page),
        `le cran de départ du QG n'est pas « ${depart} » — la vitrine et le QG ne partiraient pas au même niveau`);
    for (const n of NIVEAUX.pourAffichage()) {
        verifier(page.includes(`value="${n.id}"`), `le niveau « ${n.id} » manque au sélecteur du QG`);
    }
}

if (echecs.length) {
    console.log(`\n❌ chat du QG : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ chat du QG : ${verifs} vérifications passées`);
