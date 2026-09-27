// ==========================================================================
// SAMII OS — LE POSTE DE TRAVAIL DIT-IL LA VÉRITÉ, UNE SEULE FOIS ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE. Cette page réunit trois sources dans une seule
// timeline et marque, sur chaque ligne, QUI a agi et QUEL geste c'était.
// Quatre façons de se tromper, et aucune ne se voit à l'écran :
//
//   1. MONTRER CE QUI N'EST PAS À SOI. Une table sans filtre est globale par
//      défaut ; cette fuite est revenue CINQ fois dans ce projet.
//
//   2. ATTRIBUER À SAMII UN GESTE DU MARCHAND. Le registre est fermé par
//      défaut, et il doit le rester : une action inconnue reste côté business.
//
//   3. MONTRER DEUX FOIS LE MÊME FAIT. C'est le défaut que ce chantier
//      corrige : 20 lignes peintes pour 11 éléments distincts, mesuré.
//
//   4. INVENTER UN VERBE. Le verbe n'est pas choisi : il est DÉDUIT de
//      `config/credits.js` — la table qui facture — et de la description de
//      l'outil. Un verbe qui s'en écarterait dirait au marchand autre chose
//      que ce qu'on lui facture.
//
// Ce qu'on NE peut PAS vérifier ici : qu'un marchand ne voit pas les lignes
// d'un autre EN BASE. Une doublure n'exécute pas de SQL (règle 3 d'AGENTS.md).
// C'est `tests/activite-reel.test.js`.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (condition, message) => {
    verifs++;
    if (!condition) echecs.push(message);
};

function remplacer(chemin, exports) {
    const r = require.resolve(path.join(RACINE, chemin));
    require.cache[r] = { id: r, filename: r, loaded: true, exports };
}

const requetes = [];
remplacer("services/db", {
    query: async (sql, params) => { requetes.push({ sql, params }); return []; },
});

const activite = require(path.join(RACINE, "services", "activite"));
const TRACES = require(path.join(RACINE, "config", "traces"));
const CREDITS = require(path.join(RACINE, "config", "credits"));
const MISSIONS = require(path.join(RACINE, "services", "missionsLongues"));

(async () => {

// ══════════════════════════════════════════════════════════════════════════
// A. LE REGISTRE DES TRACES COUVRE EXACTEMENT LES OUTILS QUI EXISTENT
// ══════════════════════════════════════════════════════════════════════════
//
// La liste de référence n'est pas écrite ici : c'est celle de la table qui
// FACTURE. Un outil ajouté demain sans verbe fera crier cette garde — et il
// le doit, sinon son geste serait invisible dans la timeline.
{
    const factures = new Set([...Object.keys(CREDITS.GRATUITS), ...Object.keys(CREDITS.ACTES)]);
    verifier(factures.size > 15, `la table de facturation ne couvre que ${factures.size} outils — cette garde ne mesure plus rien`);

    for (const outil of factures) {
        verifier(
            !!TRACES.OUTILS[outil],
            `config/traces.js ne dit pas quel geste est « ${outil} » — il est facturé mais son travail serait invisible`
        );
    }
    for (const outil of Object.keys(TRACES.OUTILS)) {
        verifier(
            factures.has(outil),
            `config/traces.js déclare « ${outil} », que la facturation ne connaît pas — outil inventé ou renommé`
        );
    }
    for (const [outil, def] of Object.entries(TRACES.OUTILS)) {
        verifier(TRACES.VERBES.includes(def.verbe), `« ${outil} » porte le verbe « ${def.verbe} », hors vocabulaire`);
        // ⚠️ CE QU'ON AFFICHE N'EST PAS L'IDENTIFIANT. Trouvé à l'écran : la
        // page d'un produit francophone écrivait « EXECUTE » et « DETECTE »,
        // sans accent, parce qu'elle montrait la clé du registre.
        const mot = TRACES.libelleVerbe(def.verbe);
        verifier(
            mot !== def.verbe,
            `le verbe « ${def.verbe} » s'affiche tel quel — un identifiant n'est pas un mot français`
        );
        // ⚠️ ET IL S'AFFICHE SANS CAPITALES. Mesuré au navigateur : le DOM
        // portait « exécuté », le rendu en capitales affichait « EXECUTE ».
        // Perdre les accents d'un produit francophone à cause d'une règle de
        // style est un pari sur la police ; on ne parie pas.
        for (const [nom, dico] of [["EN", require(path.join(RACINE, "services", "langue")).EN],
                                   ["AR", require(path.join(RACINE, "services", "langue")).AR]]) {
            verifier(mot in dico, `services/langue.js (${nom}) ne traduit pas le verbe « ${mot} »`);
        }
        verifier(!!String(def.libelle || "").trim(), `« ${outil} » n'a pas de libellé lisible`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// B. UNE TRACE N'EST JAMAIS CONFONDUE AVEC UNE ACTION MÉTIER
// ══════════════════════════════════════════════════════════════════════════
//
// « Un appel d'outil ne doit pas créer artificiellement une fausse action
// métier. » Le préfixe est ce qui le garantit : écrire `order.paid` parce que
// SAMII a regardé un paiement inventerait un fait qui n'a pas eu lieu.
{
    for (const outil of Object.keys(TRACES.OUTILS)) {
        for (const reussi of [true, false]) {
            const nom = TRACES.nomAction(outil, reussi);
            // ⚠️ LA VALEUR EST ÉCRITE EN DUR ICI, ET C'EST VOULU.
            //
            // Première version : `nom.startsWith(TRACES.PREFIXE)`. Mesuré en
            // mutation — vider `PREFIXE` n'a RIEN fait crier, parce que tout
            // commence par la chaîne vide. La garde relisait la constante
            // qu'elle était censée vérifier.
            //
            // Une garde qui contrôle une valeur ne peut pas la demander à ce
            // qu'elle contrôle. « samii. » est donc répété ici : c'est le
            // seul endroit du projet où une duplication est la mesure.
            verifier(
                nom.startsWith("samii."),
                `l'action de « ${outil} » (« ${nom} ») ne porte pas le préfixe « samii. » — elle pourrait passer pour une action métier`
            );
            // Aller-retour : ce qu'on écrit doit se relire à l'identique.
            const relu = TRACES.lireAction(nom);
            verifier(!!relu, `« ${nom} » ne se relit pas`);
            verifier(relu?.outil === outil, `« ${nom} » se relit comme « ${relu?.outil} »`);
            verifier(relu?.acteur === "samii", `« ${nom} » ne se relit pas comme un geste de SAMII`);
            verifier(
                relu?.etat === (reussi ? "reussi" : "echec"),
                `« ${nom} » se relit avec l'état « ${relu?.etat} »`
            );
        }
    }
    // Et le vocabulaire métier passe à travers sans être touché.
    for (const metier of ["order.paid", "stock.low", "abonnement.expire", "", null]) {
        verifier(
            TRACES.lireAction(metier) === null,
            `« ${metier} » est lu comme une trace de SAMII — le vocabulaire métier serait réécrit`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// C. LES OUTILS NON TRACÉS LE SONT DÉJÀ EN AVAL — ET ON LE VÉRIFIE
// ══════════════════════════════════════════════════════════════════════════
//
// Quatre outils n'écrivent pas de trace : leur geste produit DÉJÀ une ligne
// de journal, qui dit elle-même que SAMII a agi. En écrire une seconde
// ferait apparaître le même fait deux fois.
//
// Une garde qui se contenterait de lire `tracer: false` ne vérifierait rien.
// On vérifie donc que la ligne aval EXISTE VRAIMENT : que le code l'écrit, et
// que `services/activite.js` sait la ranger du côté de SAMII.
{
    const sansTrace = Object.entries(TRACES.OUTILS).filter(([, d]) => d.tracer === false);
    verifier(sansTrace.length > 0, "plus aucun outil n'est marqué « déjà tracé en aval » — cette garde ne mesure plus rien");

    const sources = ["services", "engines", "routes"]
        .flatMap((d) => fs.readdirSync(path.join(RACINE, d))
            .filter((f) => f.endsWith(".js"))
            .map((f) => fs.readFileSync(path.join(RACINE, d, f), "utf8")))
        .join("\n");

    for (const [outil, def] of sansTrace) {
        const avale = String(def.pourquoi || "").split(" ")[0];
        verifier(
            !!avale,
            `« ${outil} » n'est pas tracé et ne dit pas quelle ligne le dit déjà`
        );
        verifier(
            sources.includes(`"${avale}"`) || sources.includes(`\`${avale}`) || !!activite.parCanal(avale),
            `« ${outil} » compte sur la ligne « ${avale} », qu'aucun fichier n'écrit — son geste serait invisible`
        );
        // Et cette ligne doit être attribuée à SAMII, sinon son travail
        // tomberait du côté business.
        const lu = activite.lire(avale);
        verifier(
            lu.acteur === "samii",
            `la ligne « ${avale} », qui remplace la trace de « ${outil} », est rangée côté ${lu.acteur}`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// D. LE CANAL DIT QUI A AGI
// ══════════════════════════════════════════════════════════════════════════
{
    for (const canal of activite.CANAUX_DE_SAMII) {
        const lu = activite.lire(`order.created.${canal}`);
        verifier(lu.acteur === "samii", `une commande passée par « ${canal} » est rangée côté ${lu.acteur}`);
        verifier(lu.verbe === "agit", `une commande passée par « ${canal} » porte le verbe « ${lu.verbe} »`);
    }
    for (const canal of ["shopify", "boutique"]) {
        const lu = activite.lire(`order.created.${canal}`);
        verifier(lu.acteur === "business", `une commande venue de « ${canal} » est attribuée à SAMII`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// E. FERMÉ PAR DÉFAUT
// ══════════════════════════════════════════════════════════════════════════
{
    const inconnue = activite.lire("action.qui.nexiste.pas");
    verifier(inconnue.acteur === "business", "une action inconnue est attribuée à SAMII");
    verifier(inconnue.verbe === "observe", `une action inconnue reçoit le verbe « ${inconnue.verbe} »`);
    verifier(inconnue.libelle === "action.qui.nexiste.pas", "une action inconnue reçoit un libellé inventé");

    // ⚠️ L'EXEMPLE QUI A DÉCIDÉ DU MODÈLE. Le stock qui baisse appartient au
    // business ; le fait de l'avoir REPÉRÉ appartient à SAMII.
    const stock = activite.lire("stock.low");
    verifier(stock.acteur === "samii", "« stock bas repéré » est rangé côté business — la détection est pourtant le travail d'un moteur");
    verifier(stock.verbe === "detecte", `« stock.low » porte le verbe « ${stock.verbe} » au lieu de « detecte »`);
}

// ══════════════════════════════════════════════════════════════════════════
// F. SANS QG, ON NE DEMANDE RIEN — ET SURTOUT PAS « TOUT »
// ══════════════════════════════════════════════════════════════════════════
{
    requetes.length = 0;
    const r = await activite.lireJournal(null, 40);
    verifier(r.length === 0, "lireJournal sans QG rend des lignes");
    verifier(
        requetes.length === 0,
        `lireJournal a interrogé la base SANS QG (${requetes.length} requête(s)) — une table sans filtre est globale par défaut`
    );

    requetes.length = 0;
    await activite.lireJournal("qg-abc", 40);
    const q = requetes[0] || {};
    verifier(
        /WHERE\s+workspace_id\s*=\s*\$1/i.test(q.sql || ""),
        `la requête du journal n'est pas filtrée par workspace_id : ${(q.sql || "").replace(/\s+/g, " ").slice(0, 120)}`
    );
    verifier(q.params?.[0] === "qg-abc", `le QG passé au SQL est ${JSON.stringify(q.params?.[0])}`);
    verifier(/ORDER BY\s+created_at\s+DESC/i.test(q.sql || ""), "la requête ne trie pas du plus récent au plus ancien");
    verifier(/LIMIT\s+\$2/i.test(q.sql || ""), "la limite n'est pas un paramètre SQL");
    verifier(/conversation_id/i.test(q.sql || ""), "la requête ne remonte pas le lien vers le Chat");

    const vide = await activite.pour({});
    verifier(vide.vide === true, "activite.pour sans rien ne se déclare pas vide");
    verifier(vide.fil.length === 0, "activite.pour sans QG rend des éléments");
}

// ══════════════════════════════════════════════════════════════════════════
// G. LA PAGE NE PEUT PAS ÉCRIRE
// ══════════════════════════════════════════════════════════════════════════
{
    const src = fs.readFileSync(path.join(RACINE, "services", "activite.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    for (const verbe of ["INSERT INTO", "UPDATE ", "DELETE FROM"]) {
        verifier(!new RegExp(verbe, "i").test(code), `services/activite.js contient « ${verbe} » — cette page doit LIRE`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// H. LES ÉTATS SONT TRADUITS DEPUIS LEUR PROPRE REGISTRE
// ══════════════════════════════════════════════════════════════════════════
{
    const etats = MISSIONS.ETATS || [];
    verifier(etats.length > 0, "missionsLongues n'exporte plus ses ÉTATS");
    for (const e of etats) {
        verifier(
            Object.prototype.hasOwnProperty.call(activite.ETAT_MISSION, e),
            `l'état de mission « ${e} » n'est traduit nulle part : la mission n'apparaîtrait pas`
        );
    }
    for (const [etat, col] of Object.entries(activite.ETAT_MISSION)) {
        verifier(TRACES.ETATS.includes(col), `l'état « ${etat} » est rangé dans « ${col} », hors vocabulaire`);
    }
    for (const [statut, col] of Object.entries(activite.ETAT_PUBLICATION)) {
        verifier(TRACES.ETATS.includes(col), `le statut « ${statut} » est rangé dans « ${col} », hors vocabulaire`);
    }
    verifier(activite.ETAT_MISSION["etat.inconnu"] === undefined, "un état inconnu reçoit une section");
}

// ══════════════════════════════════════════════════════════════════════════
// I. LE GESTE SUIVANT N'EST PROPOSÉ QUE S'IL EXISTE
// ══════════════════════════════════════════════════════════════════════════
//
// Six gestes ont été demandés ; trois seulement ont une route. Poser les
// trois autres aurait donné des boutons morts sur la page qui existe
// justement pour rendre le travail visible.
{
    const enCours = activite.gestesDe({ source: "mission", etat: "en_cours", id: 7 });
    verifier(enCours.some((g) => g.type === "annuler"), "une mission en cours ne peut pas être arrêtée");
    verifier(
        enCours.every((g) => g.cible && g.cible.startsWith("/api/missions/7")),
        "le geste d'arrêt ne vise pas la bonne mission"
    );

    const finie = activite.gestesDe({ source: "mission", etat: "reussi", id: 7, resultat: true });
    verifier(finie.some((g) => g.type === "resultat"), "une mission terminée ne montre pas son résultat");
    verifier(!finie.some((g) => g.type === "annuler"), "une mission terminée propose de l'arrêter — elle est faite");

    // Sans résultat, pas de bouton : il ouvrirait sur du vide.
    verifier(
        !activite.gestesDe({ source: "mission", etat: "reussi", id: 7, resultat: false }).some((g) => g.type === "resultat"),
        "une mission sans résultat propose quand même de le voir"
    );
    // Sans lien, pas de bouton non plus.
    verifier(
        !activite.gestesDe({ source: "publication", etat: "reussi", lien: null }).some((g) => g.type === "lien"),
        "une publication sans adresse propose quand même de l'ouvrir"
    );
    // Le retour au Chat n'apparaît que s'il y a un tour où retourner.
    verifier(
        activite.gestesDe({ source: "journal", conversationId: "t-1" }).some((g) => g.type === "chat"),
        "un élément né d'une conversation ne propose pas d'y retourner"
    );
    verifier(
        activite.gestesDe({ source: "journal", conversationId: null }).length === 0,
        "un élément sans conversation propose quand même d'ouvrir le Chat"
    );
    // ⚠️ Et l'identifiant est ÉCHAPPÉ dans l'adresse : il vient de la base,
    // mais une valeur qui traverse une URL sans être encodée finit par casser
    // le jour où elle contient un « & ».
    const bizarre = activite.gestesDe({ source: "journal", conversationId: "a&b c" })[0];
    verifier(
        bizarre && !bizarre.cible.includes("a&b c"),
        `l'identifiant de tour part brut dans l'adresse : ${bizarre?.cible}`
    );
}

// ══════════════════════════════════════════════════════════════════════════
// J. LE LIBELLÉ NE RÉPÈTE PAS LE DÉTAIL — ET NE LE TRONQUE JAMAIS
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(activite.sansRedite("Commande reçue", "Commande reçue — CMD-7") === "CMD-7", "la répétition n'est pas retirée");
    const intact = "Commande payée : CMD-118";
    verifier(
        activite.sansRedite("Paiement reçu", intact) === intact,
        `une phrase qui ne commence pas par le libellé a été modifiée : ${JSON.stringify(activite.sansRedite("Paiement reçu", intact))}`
    );
    verifier(activite.sansRedite("Publication", "Publication") === "", "un détail identique au libellé est affiché deux fois");
    verifier(activite.sansRedite("", "n'importe quoi") === "n'importe quoi", "sansRedite mange le détail sans libellé");
}

// ══════════════════════════════════════════════════════════════════════════
// K. LA VUE
// ══════════════════════════════════════════════════════════════════════════
{
    const vue = fs.readFileSync(path.join(RACINE, "views", "activite.ejs"), "utf8");

    // ── Les cinq filtres demandés ────────────────────────────────────────
    for (const f of ["tout", "samii", "business", "en_cours", "echec"]) {
        verifier(vue.includes(`data-filtre="${f}"`), `views/activite.ejs n'offre plus le filtre « ${f} »`);
    }
    // ── UNE seule liste : c'est ce qui rend la duplication impossible ────
    verifier(
        (vue.match(/id="act-fil"/g) || []).length === 1,
        "views/activite.ejs ne rend plus exactement une liste — la duplication redevient possible"
    );
    // ── Le marqueur SAMII est visuel, pas le mot répété ──────────────────
    // ⚠️ ON VÉRIFIE LA DÉCLARATION, PAS LE SÉLECTEUR.
    //
    // Première version : la présence de `.act-item[data-acteur="samii"]`.
    // Mesuré en mutation — retirer la règle qui PORTE le marqueur n'a rien
    // fait crier, parce que le même sélecteur sert aussi à colorer le verbe
    // deux lignes plus bas. Le sélecteur existait ; le marqueur, non.
    // ⚠️ ON MESURE LE MARQUEUR, PAS LE SÉLECTEUR QUI LE PORTE.
    //
    // Deux fois cette garde a dû être réécrite. D'abord parce qu'elle
    // cherchait la présence du sélecteur `[data-acteur="samii"]`, qui servait
    // AUSSI à colorer le verbe : retirer la règle du marqueur ne faisait rien
    // crier. Puis parce que le polish a déplacé le liseré de la ligne vers
    // son corps — le marqueur était intact, la garde criait quand même.
    //
    // Elle vérifie donc la DÉCLARATION, où qu'elle vive : une règle visant
    // les lignes de SAMII qui pose un liseré, et un point de couleur. Les
    // deux ensemble font la signature ; l'un sans l'autre ne se voit pas.
    verifier(
        /\[data-acteur="samii"\][^{]*\{[^}]*border-left-color/.test(vue),
        "les lignes de SAMII n'ont plus leur liseré — rien ne les distingue à l'œil nu"
    );
    verifier(
        /\[data-acteur="samii"\][^{]*::before\s*\{[^}]*background/.test(vue),
        "le point qui marque les lignes de SAMII a disparu"
    );
    // Le verbe ne doit pas être mis en capitales : le rendu y perd les
    // accents français. Mesuré — « exécuté » s'affichait « EXECUTE ».
    {
        const regle = (vue.match(/\.act-item__verbe\s*\{[^}]*\}/) || [""])[0];
        verifier(
            !!regle && !/text-transform:\s*uppercase/.test(regle),
            "le verbe est rendu en capitales — les accents disparaissent selon la police"
        );
    }
    verifier(
        !/>\s*SAMII a /.test(vue),
        "views/activite.ejs écrit « SAMII a … » devant les lignes — le marqueur doit être visuel"
    );

    // ── TOUT EST ÉCHAPPÉ ─────────────────────────────────────────────────
    //
    // Les détails viennent du journal, où des routes journalisent des messages
    // reçus (`whatsapp.message`, `facebook.comment`). Ce sont des textes
    // d'inconnus affichés à un marchand : un seul `<%-` et la page exécute ce
    // qu'on lui envoie.
    const sansCommentaires = vue.replace(/<%#[\s\S]*?%>/g, "");
    const brutes = (sansCommentaires.match(/<%-[^%]*%>/g) || []).filter((b) => !/include\(/.test(b));
    verifier(brutes.length === 0, `views/activite.ejs rend ${brutes.length} expression(s) NON échappée(s) : ${brutes.join(" ")}`);
    // ⚠️ ON MESURE LE CODE, PAS LA PROSE. Première version : la garde criait
    // sur le COMMENTAIRE qui explique justement pourquoi on n'écrit pas en
    // innerHTML. C'est le piège qu'AGENTS.md dit être arrivé quatre fois —
    // un contrôle qui s'attrape sur sa propre documentation.
    const vueSansProse = sansCommentaires
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    verifier(
        !/innerHTML/.test(vueSansProse),
        "views/activite.ejs écrit en innerHTML — le résultat d'une mission vient d'un modèle, donc du dehors"
    );

    // ── LES DEUX DÉCISIONS DE DENSITÉ, MESURÉES AU NAVIGATEUR ───────────
    //
    // Elles ne se voient pas dans le code : sans garde, elles reviendront
    // en arrière à la première retouche, et personne ne saura pourquoi la
    // page a regrossi.
    //
    //   • Le détail borné à DEUX lignes. Mesuré : non borné, une ligne
    //     portant un message d'erreur montait à 179 px. Bornée, 74 px.
    //   • La rangée de filtres sur UNE ligne, qui défile. Mesuré : en
    //     `flex-wrap`, cinq puces passaient à deux rangées — 66 px contre
    //     28 px, soit 38 px volés en haut de chaque écran.
    {
        const detail = (vue.match(/\.act-item__detail\s*\{[^}]*\}/) || [""])[0];
        verifier(
            /-webkit-line-clamp:\s*2/.test(detail),
            "le détail d'un événement n'est plus borné à deux lignes — une erreur un peu longue reprendra 179 px"
        );
        const filtres = (vue.match(/\.act-filtres\s*\{[^}]*\}/) || [""])[0];
        verifier(
            /overflow-x:\s*auto/.test(filtres) && !/flex-wrap:\s*wrap/.test(filtres),
            "la rangée de filtres repasse à la ligne — elle reprendra 38 px en haut de chaque écran"
        );
    }

    verifier(/<meta name="viewport"/.test(vue), "views/activite.ejs n'a pas de meta viewport");
    verifier(
        /include\("partials\/nav",\s*\{\s*variante:\s*"qg",\s*actif:\s*"activite"\s*\}\)/.test(vue),
        "views/activite.ejs ne marque pas « activite » comme entrée active"
    );
    verifier(/toLocaleTimeString/.test(vue), "views/activite.ejs n'ajuste pas l'heure au fuseau du lecteur");

    // ── ⚠️ LES BOUTONS NE DÉPENDENT PAS D'UN CDN ────────────────────────
    //
    // Trouvé au navigateur, et ça avait tué TOUS les filtres : `lucide` vient
    // d'unpkg. Injoignable, l'appel lève, et tout ce qui suit dans le même
    // bloc <script> ne s'exécute jamais. La page s'affichait et aucune puce
    // ne répondait.
    verifier(
        /if \(window\.lucide\) lucide\.createIcons\(\)/.test(vue),
        "views/activite.ejs appelle lucide sans garde — un CDN injoignable emporterait toute la logique de la page"
    );
    {
        const bloc = vue.split("<script>").find((b) => b.includes("lucide.createIcons"));
        verifier(
            bloc !== undefined && !/act-f|data-filtre|appliquer\(/.test(bloc),
            "la logique des filtres partage son bloc <script> avec l'appel au CDN — une panne du CDN la tuerait"
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// K bis. L'INDEX EST DÉCLARÉ DANS LE SCHÉMA
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ DEUX MOITIÉS, ET IL FAUT LES DEUX.
//
// `activite-reel.test.js` vérifie que le PLAN de la requête utilise
// `idx_journal_ws`. Mesuré en mutation : retirer la ligne de
// `services/schema.js` ne faisait rien crier — l'index existait déjà dans la
// base d'essai, créé par une exécution précédente. Cette garde prouvait qu'un
// index présent sert la requête, jamais qu'il serait créé.
//
// Ici : qu'il sera créé sur une base neuve. Là-bas : qu'il sert la requête.
{
    const schema = fs.readFileSync(path.join(RACINE, "services", "schema.js"), "utf8");
    verifier(
        /CREATE INDEX IF NOT EXISTS\s+idx_journal_ws\s+ON\s+journal\s*\(\s*workspace_id\s*,\s*created_at DESC\s*\)/i.test(schema),
        "services/schema.js ne crée plus idx_journal_ws — sur une base neuve, la page balaierait tout le journal"
    );
    // Les trois colonnes du fil, même raison : une base neuve doit les avoir.
    for (const [table, colonne] of [["journal", "conversation_id"],
                                    ["missions_longues", "conversation_id"],
                                    ["samii_conversations", "tour_id"]]) {
        verifier(
            new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colonne}`, "i").test(schema),
            `services/schema.js ne crée plus ${table}.${colonne} — le lien avec le Chat serait mort sur une base neuve`
        );
    }
}

// ══════════════════════════════════════════════════════════════════════════
// L. LA PORTE — CHEZ NOUS, FERMÉE CHEZ UNE PARTENAIRE
// ══════════════════════════════════════════════════════════════════════════
{
    const modules = require(path.join(RACINE, "config", "modules-qg"));
    const communautes = require(path.join(RACINE, "config", "communautes"));
    const maison = communautes.get("samii");
    const partenaire = communautes.get("coindudigital");

    verifier(modules.autorises(maison).some((m) => m.id === "activite"), "le Centre d'activité a disparu de chez nous");
    verifier(
        !modules.autorises(partenaire).some((m) => m.id === "activite"),
        "le Centre d'activité apparaît chez une partenaire — ce sont nos données"
    );
    verifier(modules.chemineAutorise("/activite", modules.cheminsAutorises(maison)), "/activite est fermé chez nous");
    verifier(
        !modules.chemineAutorise("/activite", modules.cheminsAutorises(partenaire)),
        "/activite est OUVERT chez une partenaire"
    );
    const core = modules.MODULES.filter((m) => m.rang === "core").map((m) => m.id);
    verifier(core.indexOf("activite") === 1, `le Centre d'activité est en position ${core.indexOf("activite") + 1} des entrées « core »`);
}

// ══════════════════════════════════════════════════════════════════════════
// M. LE FIL DU TOUR EST POSÉ EN CODE, JAMAIS LU DEPUIS LA PAGE
// ══════════════════════════════════════════════════════════════════════════
//
// Un identifiant de tour accepté depuis le corps de la requête permettrait de
// coudre ses propres lignes au fil de quelqu'un d'autre. C'est la règle 5 du
// projet, qui a coûté quatre pannes ici.
{
    const api = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
    verifier(
        /const tourId = require\("crypto"\)\.randomUUID\(\)/.test(api),
        "routes/api.js ne génère plus l'identifiant du tour"
    );
    verifier(
        !/tourId\s*=\s*req\.(body|query|params)/.test(api),
        "routes/api.js accepte un identifiant de tour venu de la page"
    );
    const ml = fs.readFileSync(path.join(RACINE, "services", "missionsLongues.js"), "utf8");
    verifier(
        /context\.conversationId/.test(ml),
        "missionsLongues ne garde plus le tour d'où la mission a été lancée"
    );
    const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    verifier(
        /conversationId: context\?\.conversationId/.test(planner),
        "la trace d'un outil ne porte plus le tour dont elle vient"
    );
    // ⚠️ Les arguments d'un outil ne sont JAMAIS recopiés dans le journal :
    // `envoyer_email` porte le corps du message, `historique_client` le nom et
    // le téléphone d'un client, `executer_code` le programme.
    const trace = planner.split("tracerGeste(nom, resultat, context)")[1] || "";
    const corps = trace.split("\n    async executerOutil")[0];
    verifier(
        !/\bargs\b/.test(corps),
        "la trace d'un outil recopie ses arguments — le corps d'un e-mail entrerait dans une page qu'on ouvre devant n'importe qui"
    );
}

// ── Verdict ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.error(`❌ activité : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ activité : ${verifs} vérifications passées (${Object.keys(TRACES.OUTILS).length} outils au registre)`);
})().catch((err) => {
    console.error("❌ activité : la suite a levé —", err.message);
    process.exit(1);
});
