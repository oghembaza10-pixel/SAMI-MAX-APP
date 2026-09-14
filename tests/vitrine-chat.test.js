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

    // ── LES QUATRE CHEMINS EXISTENT TOUJOURS, EN PETIT ───────────────────
    //
    // Ce garde exigeait quatre `.amorce` — des cartes pleine largeur. MESURÉ
    // avant leur remplacement : elles pesaient 231 px sur bureau, 254 px sur
    // mobile, et avec le reste du hero, 459 px / 494 px AVANT le premier
    // message. Plus de la moitié de l'écran, sur une page dont le chat est
    // censé être le sujet.
    //
    // Les quatre chemins n'ont pas disparu : ils sont devenus des puces
    // d'une ligne, contre le champ. C'est donc l'INTENTION qu'on garde ici,
    // pas la forme — quatre entrées distinctes, dont une qui porte une vraie
    // demande d'action, et aucune carte pleine largeur.
    const chips = (page.match(/class="chip"/g) || []).length;
    verifier(chips === 4, `${chips} puces de démarrage au lieu de 4`);
    verifier(!/class="amorce"/.test(page),
        "les grosses cartes pleine largeur sont revenues : elles reprennent la moitié de l'écran");
    verifier(/aide-moi à développer ça/.test(page),
        "la première puce ne porte plus de demande d'action : elle montre à quoi sert SAMII");

    // Le libellé est COURT, la demande envoyée est ENTIÈRE. Envoyer le
    // libellé ferait répondre SAMII à deux mots au lieu d'une personne.
    // ⚠️ `page.includes('data-demande=')` NE SUFFIT PAS : il passe dès qu'UNE
    // puce en porte une. Vérifié par mutation — retirer la demande d'une
    // seule puce laissait le garde vert. On les compte.
    const demandes = (page.match(/data-demande="[^"]{12,}"/g) || []).length;
    verifier(demandes === chips,
        `${demandes} puces sur ${chips} emportent une demande complète : les autres enverraient `
        + "leur libellé court, et SAMII répondrait à un mot-clé au lieu d'une personne");

    // ── ET LE COMPORTEMENT, QUI N'EST NI DANS LE HTML NI VISIBLE ICI ─────
    //
    // Les quatre gardes ci-dessous ont été ajoutés APRÈS des mutations qui
    // ont survécu : on peut retirer l'effacement, le clic des puces ou la
    // bascule du titre sans qu'un test de gabarit ne bronche. Un rendu EJS
    // ne voit ni le CSS ni le script.
    const feuille = fs.readFileSync(path.join(RACINE, "views/samii-accueil.ejs"), "utf8");
    verifier(/\[data-ecrit="1"\]\s+\.demarrer/.test(feuille),
        "l'invitation ne s'efface plus quand on écrit : quatre suggestions resteraient sous les yeux "
        + "de quelqu'un qui sait déjà ce qu'il veut dire");
    verifier(/\[data-commence="1"\]\s+\.demarrer/.test(feuille),
        "l'invitation ne disparaît plus au premier message");
    verifier(/\[data-commence="1"\]\s+#ouverture/.test(feuille),
        "le titre ne s'efface plus quand la conversation commence : il resterait au-dessus des messages");

    const script = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    verifier(/closest\(["']\.chip["']\)/.test(script),
        "le script n'écoute plus les puces : elles seraient décoratives");
    verifier(/getAttribute\(["']data-demande["']\)/.test(script),
        "le script envoie le libellé de la puce au lieu de sa demande complète");
    verifier(/setAttribute\(["']data-commence["'],\s*["']1["']\)/.test(script),
        "rien ne bascule l'écran en mode conversation au premier message");
    verifier(/setAttribute\(["']data-ecrit["']/.test(script),
        "rien ne signale qu'on a commencé à écrire : l'invitation resterait affichée");
    verifier(/Par o(ù|u) commencer aujourd/.test(page),
        "l'invitation « Par où commencer aujourd'hui ? » n'est pas rendue");

    // ── ET LE HERO NE REVIENT PAS ────────────────────────────────────────
    //
    // La grosse boule centrale et le paragraphe d'accroche pesaient 138 px à
    // eux deux. SAMII est déjà nommé dans la barre du haut, et ce qu'il sait
    // faire s'apprend en lui parlant.
    const ouv = page.slice(page.indexOf('id="ouverture"'), page.indexOf("</div>", page.indexOf('id="ouverture"')));
    verifier(ouv.length > 10, "le bloc d'ouverture a disparu de la page");
    verifier(!/class="boule"/.test(ouv),
        "la grosse boule est revenue au centre de l'écran vide — le branding est déjà dans la barre du haut");
    verifier(!/<p>/.test(ouv),
        "un paragraphe d'accroche est revenu sous le titre : il repousse le chat vers le bas");
    verifier(page.includes('id="boule-mini"'),
        "la boule de la barre haute a disparu : c'est elle qui porte les états « cherche » et « parle »");

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
// 6 bis. LE CHAT V2 : ESPACES, RIDEAU, INTELLIGENCE, BOULE VIVANTE
// ══════════════════════════════════════════════════════════════════════════
//
// Quatre ajouts de ce chantier, et chacun a un piège qu'un navigateur a
// trouvé avant moi.
{
    const NIVEAUX = require("../config/niveaux");
    const MODES = require("../routes/samii-mode").MODES || [];
    const connectee = rendre({
        loggedIn: true, nom: "Omar", typeCompte: "marchand",
        qgs: [{ id: "w1", nom: "Ma Boutique" }, { id: "w2", nom: "Amel Couture" }],
        projets: [{ id: "p1", nom: "Projet X" }],
        workspaceId: "w1", credits: 200,
        niveaux: NIVEAUX.pourAffichage(), postures: MODES,
    });

    // ── LES ESPACES SONT À CÔTÉ DU CHAT, PAS DANS LA NAVIGATION ─────────
    //
    // Un QG n'est pas une destination : c'est un contexte qu'on active sans
    // quitter la conversation. Le laisser dans la barre, entre l'Académie et
    // le Marketplace, disait le contraire.
    verifier(connectee.includes('id="espaces"'), "le panneau des espaces n'est pas rendu");
    verifier(connectee.includes('id="appel-espaces"'), "rien ne permet de rappeler ses espaces");

    // ⚠️ LES QG ÉTAIENT LISTÉS DEUX FOIS au premier essai — le bloc d'origine
    // était resté dans la barre en plus du panneau. Une garde de navigation
    // a compté quatre formulaires au lieu de deux.
    const formulaires = (connectee.match(/action="\/mes-qg"/g) || []).length;
    verifier(formulaires === 2,
        `${formulaires} formulaires POST /mes-qg pour deux QG : ils sont listés en double`);
    verifier((connectee.match(/data-projet=/g) || []).length === 1,
        "les projets ne sont pas dans le panneau, ou ils y sont en double");

    // ── LE RIDEAU ────────────────────────────────────────────────────────
    verifier(connectee.includes('id="plus-loin"') && connectee.includes('id="rideau-plus"'),
        "le rideau « Aller plus loin » n'est pas rendu");
    for (const route of ["/academy", "/metiers", "/connect/tools"]) {
        verifier(connectee.includes(`href="${route}"`),
            `« ${route} » n'est plus atteignable : on change la VISIBILITÉ des services, ` +
            "jamais leur existence");
    }

    // ── L'INTELLIGENCE, LUE DANS SON REGISTRE ────────────────────────────
    verifier(connectee.includes('id="menu-cerveau"'), "le sélecteur d'intelligence n'est pas rendu");
    const choix = (connectee.match(/data-niveau="/g) || []).length;
    verifier(choix === NIVEAUX.pourAffichage().length,
        `${choix} niveaux proposés pour ${NIVEAUX.pourAffichage().length} déclarés dans ` +
        "config/niveaux.js — un niveau ajouté demain n'apparaîtrait pas");
    for (const n of NIVEAUX.pourAffichage()) {
        verifier(connectee.includes(`data-niveau="${n.id}"`), `le niveau « ${n.id} » manque au menu`);
    }

    // ── ET L'AUTONOMIE RESTE UN AUTRE AXE ────────────────────────────────
    //
    // Les mélanger ferait croire que « Maître » agit plus seul que
    // « Rapide » — c'est faux, et quelqu'un monterait son niveau en croyant
    // lever une confirmation.
    verifier(/Jusqu.{1,8}o(ù|u) il peut agir seul/.test(connectee),
        "la posture d'autonomie n'est plus présentée à part : elle serait confondue avec " +
        "la profondeur de raisonnement");
    verifier(connectee.includes('href="/samii/mode"'),
        "le lien vers la page des postures est absent ou faux — il pointait d'abord sur " +
        "/mode, une route qui répond 404 (elle est montée sous /samii)");
    verifier(!/data-niveau="(ombre|copilote|strategiste|autonome|souverain)"/.test(connectee),
        "une posture d'autonomie est proposée comme un niveau d'intelligence");

    // ── LE SOLDE VIENT DU SERVEUR, PAS D'UNE ROUTE IMAGINAIRE ────────────
    //
    // ⚠️ La pastille a d'abord été écrite comme un `fetch("/recharge/etat")`.
    // Cette route N'EXISTE PAS : l'appel échouait en silence et la pastille
    // gardait son tiret pour toujours.
    verifier(connectee.includes("200 crédits") || connectee.includes("200 "),
        "le solde n'est pas rendu par le serveur");
    const js = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8");
    // ⚠️ INSTRUMENT — le garde ci-dessous lit le fichier brut, commentaires
    // compris. La note qui explique la route morte contient forcément son nom :
    // sans ce décapage, le garde se déclencherait sur sa propre documentation.
    // (`//` précédé de « : » est laissé en place : c'est un https://, pas un
    // commentaire.)
    const jsCode = js
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    verifier(!/fetch\(["']\/recharge\/etat/.test(jsCode),
        "le navigateur appelle /recharge/etat, une route qui n'existe pas");

    // ── LA BOULE EST VIVANTE ─────────────────────────────────────────────
    //
    // Entre l'envoi et la première lettre il y a deux à cinq secondes de
    // silence. Sans signe, ce silence ressemble à une panne — et quelqu'un
    // qui croit à une panne renvoie son message, ce qui coûte un tour.
    verifier(/\.boule--pense/.test(connectee) && /\.boule--parle/.test(connectee),
        "la boule n'a plus ses états « cherche » et « parle »");
    verifier(connectee.includes('id="boule-mini"'),
        "la boule de la barre haute a disparu : l'état ne serait plus visible dès que la " +
        "conversation fait défiler la grande hors de l'écran");
    verifier(/etatBoule\(["']pense["']\)/.test(jsCode),
        "rien ne met la boule en recherche pendant l'attente");
    verifier(/etatBoule\(["']parle["']\)/.test(jsCode) && /souffler\(\)/.test(jsCode),
        "la boule ne réagit plus aux mots qui arrivent");
    verifier(/prefers-reduced-motion/.test(connectee),
        "les animations ne respectent pas « moins de mouvement » : quelqu'un qui l'a demandé " +
        "recevrait un pouls permanent au centre de son écran");

    // ── LE NIVEAU CHOISI PART AVEC LE MESSAGE ────────────────────────────
    //
    // `/api/chat` le lisait DÉJÀ et le borne au palier payé. On rend visible
    // un réglage qui n'avait pas d'interface — on n'ajoute aucune règle.
    verifier(/niveau:\s*niveauChoisi/.test(jsCode),
        "le niveau choisi n'est pas envoyé : le sélecteur ne servirait à rien");

    // ── ET LE PANNEAU NE DÉBORDE PAS ─────────────────────────────────────
    //
    // ⚠️ Première version : `hidden` + `display: flex !important`. L'élément
    // restait dans la mise en page — barre de défilement horizontale sur
    // bureau ET sur mobile — et `hidden` ne cachait plus rien.
    verifier(/\.scene\s*\{[^}]*overflow:\s*hidden/.test(connectee),
        "la scène ne masque pas ce qui dépasse : la colonne des espaces, posée hors écran " +
        "au repos, fait déborder la page horizontalement");
    verifier(!/\.espaces\[hidden\]/.test(connectee),
        "le panneau est encore piloté par l'attribut `hidden` avec un display forcé — " +
        "deux vérités possibles, et c'est la mauvaise qui gagne");
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
// ══════════════════════════════════════════════════════════════════════════
// 6 ter. LE CRAN DE DÉPART DE LA BARRE : « RAPIDE », PAS « AUTO »
// ══════════════════════════════════════════════════════════════════════════
//
// Auto laisse SAMII monter d'un cran quand il juge la demande lourde, et ce
// cran coûte plus cher — décidé par la machine, pas par la personne. En
// préselection on veut le cran le plus léger : il répond tout de suite et il
// ne surprend personne sur son solde.
//
// LE PIÈGE : ce cran est écrit à DEUX endroits — le gabarit l'affiche, le
// script l'envoie. Recopié, il finit par différer, et la barre annonce un
// niveau pendant que le navigateur en envoie un autre. On vérifie donc qu'il
// n'est écrit NULLE PART : les deux le LISENT du registre.
{
    const NIV = require("../config/niveaux");

    // Le registre déclare le cran de départ, et il est distinct de DEFAUT —
    // qui est le filet de niveau(), côté serveur. Les confondre changerait
    // la facturation en croyant changer un libellé.
    verifier(NIV.PRESELECTION === "rapide",
        `le cran de départ vaut « ${NIV.PRESELECTION} » au lieu de « rapide »`);
    verifier(NIV.existe(NIV.PRESELECTION),
        "le cran de départ n'est pas un niveau connu du registre");
    verifier(NIV.PRESELECTION !== NIV.AUTO,
        "le cran de départ est redevenu « auto »");
    verifier(Object.prototype.hasOwnProperty.call(NIV, "DEFAUT"),
        "DEFAUT a disparu du registre : niveau() n'a plus de filet");

    // La page rendue affiche CE cran, lu du registre.
    const attendu = NIV.pourAffichage().find((n) => n.id === NIV.PRESELECTION);
    const page2 = rendre({
        niveaux: NIV.pourAffichage(),
        niveauParDefaut: attendu,
    });
    verifier(page2.includes(`data-defaut="${attendu.id}"`),
        "le bouton ne dit pas au script quel cran est affiché : les deux vont diverger");
    // ⚠️ INSTRUMENT. `indexOf('cerveau__fleche')` trouvait la RÈGLE CSS du
    // même nom, définie bien plus haut dans la feuille de style : la tranche
    // partait à l'envers et sortait vide, faisant échouer un bouton
    // parfaitement rendu. On cherche donc la fermeture APRÈS le début.
    const debutBouton = page2.indexOf('id="cerveau-pic"');
    const bouton = page2.slice(debutBouton, page2.indexOf("cerveau__fleche", debutBouton));
    verifier(bouton.length > 40,
        "la tranche du bouton est vide — l'instrument ne regarde pas le bon endroit");
    verifier(bouton.includes(echapper(attendu.libelle)),
        `le bouton n'affiche pas « ${attendu.libelle} »`);
    verifier(bouton.includes(attendu.icone),
        `l'icône du cran de départ (${attendu.icone}) n'est pas rendue`);
    verifier(!bouton.includes("Auto"),
        "le bouton affiche encore « Auto » au départ");

    // ── ET AUTO RESTE PROPOSÉ ────────────────────────────────────────────
    //
    // On change le point de départ, PAS l'offre. Auto reste dans le menu,
    // intact : quelqu'un qui le veut le choisit d'un clic.
    verifier(page2.includes('data-niveau="auto"'),
        "« Auto » a disparu du menu — on devait déplacer le départ, pas retirer le choix");
    verifier(NIV.pourAffichage().length === 5,
        "le menu ne propose plus les cinq crans");

    // Le script ne doit PAS porter le cran en dur.
    const js2 = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    verifier(/getAttribute\("data-defaut"\)/.test(js2),
        "le script n'écoute plus le cran annoncé par la page : il repart sur sa propre valeur");
    verifier(!/niveauChoisi\s*=\s*["']auto["']/.test(js2),
        "le script réinstalle « auto » en dur comme cran de départ");

    // Le gabarit non plus : sinon il se désaccorderait du registre.
    const gabarit = fs.readFileSync(path.join(RACINE, "views/samii-accueil.ejs"), "utf8");
    const debutZone = gabarit.indexOf('id="cerveau-pic"');
    const zone = gabarit.slice(debutZone, gabarit.indexOf("cerveau__fleche", debutZone));
    verifier(zone.length > 40,
        "la tranche du gabarit est vide — l'instrument ne regarde pas le bon endroit");
    verifier(!/L\("(Auto|Rapide|Expert|Pro|Ma[iî]tre)"\)/.test(zone),
        "le gabarit écrit un libellé de niveau en dur dans le bouton au lieu de le lire");
}

if (echecs.length) {
    console.log(`\n❌ page d'accueil : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ page d'accueil : ${verifs} vérifications passées`);
process.exit(0);
