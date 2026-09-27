// ==========================================================================
// SAMII OS — SAMII A-T-IL SES MAINS, PAR DÉFAUT ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE, EN PLUS DE `niveau-auto.test.js`.
//
// `niveau-auto.test.js` éprouve le CLASSEUR : pèse-t-il juste, gratuitement,
// sans décider à la place de la personne. Il ne dit rien de la question qui a
// motivé le chantier G :
//
//     un marchand qui ne touche à rien, et qui écrit « envoie une facture à
//     Aminata » — SAMII tient-il l'outil qui le fait ?
//
// La réponse mesurée avant ce chantier était NON, à tous les paliers. Quatre
// pannes se cumulaient, et aucune ne ressemblait à une panne :
//
//   1. LE CRAN DE DÉPART. `PRESELECTION` valait « rapide », et Rapide porte
//      ZÉRO outil. Le navigateur envoyait ce cran EXPLICITEMENT, donc
//      `choisir()` y lisait un choix de la personne — ce qui coupait aussi la
//      pesée et l'escalade. Quatre vraies questions de marchand mesurées au
//      point de fabrication du payload : zéro outil à chaque fois.
//
//   2. LE PLANCHER D'AUTO. La pesée compte l'EFFORT, jamais la CAPACITÉ.
//      « Envoie une facture de 7500 DA » marquait 3 — sous le seuil Pro, qui
//      est à 5 — et atterrissait sur Expert, qui ne porte que `lecture`. Sept
//      outils sur dix-sept étaient inatteignables par Auto.
//
//   3. L'ESCALADE. `doitMonter()` était écrite, exportée, testée — appelée
//      nulle part. Une erreur de pesée vers le bas était donc définitive.
//
//   4. LE REPLI MUET. Les trois relais portent zéro outil pour l'audience
//      marchande, et un relais qui répond avec succès ne portait AUCUN
//      marqueur. Rien n'empêchait « c'est envoyé » alors que rien ne partait.
//
// ── CE QUI EST MESURÉ, ET OÙ ─────────────────────────────────────────────
//
// Au POINT DE FABRICATION DU PAYLOAD (`buildToolsPayload`), pas sur le nom du
// niveau. Un test qui vérifie « Auto a choisi Pro » ne prouve rien : ce qui
// compte est la liste d'outils qui part réellement chez le moteur. C'est la
// leçon du chantier E, et elle vaut ici deux fois.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const A = require(path.join(RACINE, "services", "niveauAuto.js"));
const N = require(path.join(RACINE, "config", "niveaux.js"));
const CREDITS = require(path.join(RACINE, "config", "credits.js"));
const ECO = require(path.join(RACINE, "config", "economie.js"));
const AUDIENCES = require(path.join(RACINE, "config", "audiences.js"));
const MOTEURS = require(path.join(RACINE, "config", "moteurs.js"));
const gemini = require(path.join(RACINE, "services", "geminiService.js"));

// ── L'INSTRUMENT : LES OUTILS QUI PARTENT VRAIMENT ───────────────────────
//
// Le même contexte que `routes/api.js` construit pour le chat du QG :
// `audience: "souverain"`, et `tourDeConversation` posé par le planner. Sans
// ce dernier, `buildToolsPayload` rend `null` par construction — et un
// instrument qui mesure toujours zéro ne mesure rien.
function outilsPortes(niveau, { moteur = "gemini", audience = "souverain", piece = null } = {}) {
    const charge = gemini.__test_buildToolsPayload(true, {
        workspaceId: "qg-essai", audience, tourDeConversation: true, niveau, piece,
    }, moteur);
    if (!Array.isArray(charge)) return [];
    return (charge[0]?.functionDeclarations || charge[0]?.function_declarations || [])
        .map((d) => d.name);
}

// Ce qu'un marchand obtient quand il n'a RIEN touché : le cran de départ du
// registre, passé comme le navigateur le passe.
function commeUnMarchandQuiNeToucheARien(message, palier = "pro") {
    return A.choisir({ message, demande: N.PRESELECTION, palier });
}

// ══════════════════════════════════════════════════════════════════════════
// 1. LE DÉFAUT EST « AUTO », ET CE N'EST PAS UN LIBELLÉ
// ══════════════════════════════════════════════════════════════════════════
//
// La mesure ne porte pas sur la chaîne « auto » : elle porte sur la
// CONSÉQUENCE. Un cran explicite fait `auto: false`, et `auto: false` coupe la
// pesée et l'escalade. C'est ça qu'il faut vérifier.
{
    verifier(N.PRESELECTION === N.AUTO,
        `le cran de départ vaut « ${N.PRESELECTION} » : un cran explicite coupe la pesée ` +
        "ET l'escalade (voir niveauAuto.choisir : `auto = !demande || demande === AUTO`)");

    const c = commeUnMarchandQuiNeToucheARien("Fais le point sur mon activité");
    verifier(c.auto === true,
        "le cran de départ ne déclenche pas la sélection automatique — " +
        "la pesée ne tourne pas, et `doitMonter` refusera de monter");

    // Et le départ doit être PROPOSÉ : un défaut absent du menu est un défaut
    // que personne ne peut retrouver après en avoir changé.
    const menu = N.pourAffichage().map((n) => n.id);
    verifier(menu.includes(N.PRESELECTION),
        `le cran de départ « ${N.PRESELECTION} » n'est pas dans le menu`);
    verifier(menu[0] === N.AUTO,
        "« Auto » n'est plus en tête du menu : c'est le comportement recommandé");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. UNE DEMANDE SIMPLE RESTE SIMPLE — AUTO N'EST PAS LE MAXIMUM
// ══════════════════════════════════════════════════════════════════════════
//
// C'est la contrepartie de la décision, et c'est elle qui empêche le chantier
// de devenir « ouvrir le robinet ». Un bonjour ne doit RIEN faire tourner.
{
    const triviaux = [
        "Bonjour", "Salut", "Merci beaucoup", "Bonsoir SAMII",
        "Traduis-moi « merci beaucoup » en anglais",
        "Reformule cette phrase, elle est trop longue",
        "Corrige l'orthographe de ce texte",
    ];
    for (const m of triviaux) {
        const c = commeUnMarchandQuiNeToucheARien(m);
        verifier(c.niveau === "rapide",
            `« ${m} » part en « ${c.niveau} » — Auto doit SÉLECTIONNER, ` +
            "pas monter au maximum en permanence");
        verifier(outilsPortes(c.niveau).length === 0,
            `« ${m} » emporte ${outilsPortes(c.niveau).length} outils : un bonjour ne doit ` +
            "rien faire tourner chez le fournisseur");
    }

    // Et le pire cas d'Auto sur un message trivial reste le moteur le moins
    // cher. Si Rapide montait un jour sur le moteur « pro », ce test le dirait.
    verifier(N.niveau("rapide").moteur === N.niveau(N.ORDRE[0]).moteur,
        "le cran le plus léger ne tourne plus sur le moteur le plus léger");
}

// ══════════════════════════════════════════════════════════════════════════
// 3 à 5. LA DEMANDE ATTEINT LE CRAN DE SON OUTIL
// ══════════════════════════════════════════════════════════════════════════
//
// Une table, et la seule assertion qui compte : l'outil demandé est-il DANS
// LA CHARGE qui part ? Le nom du niveau n'est qu'un moyen.
//
// ⚠️ Le niveau attendu n'est PAS écrit ici. Il est lu dans le registre
// (`niveauMinimalPour`) : écrire « pro » à la main ici, c'est recopier la
// table des familles, et le test se tairait le jour où elle change.
{
    const DEMANDES = [
        // « lecture » — Expert
        ["Fais le point sur mon activité ce mois", "etat_de_mon_business"],
        ["Qu'est-ce qui s'est passé dans mon activité cette semaine ?", "resume_journee"],
        ["Compare mes prix à ceux pratiqués ailleurs", "prix_du_marche"],
        ["Trouve-moi des salons de coiffure à Douala sans site web", "rechercher_prospects"],
        ["Quel est l'historique de ma cliente Aminata ?", "historique_client"],
        // « ecriture » — Pro
        ["Envoie une facture de 7500 DA à Aminata Diallo", "envoyer_facture"],
        ["Envoie un e-mail à mon fournisseur pour relancer la commande", "envoyer_email"],
        ["Crée un événement demain à 15h avec le fournisseur", "creer_evenement_agenda"],
        ["Génère un rapport de mes ventes dans un tableur", "creer_rapport_sheets"],
        // « agents » — Pro
        ["Prépare-moi une publication Instagram pour ma nouvelle collection", "preparer_publication"],
        // « code » — Maître
        ["Écris un script python qui calcule ma marge", "executer_code"],
    ];

    for (const [phrase, outil] of DEMANDES) {
        const attendu = N.niveauMinimalPour(outil);
        verifier(!!attendu,
            `« ${outil} » n'est porté par AUCUN niveau du registre — le test ne mesure rien`);
        if (!attendu) continue;

        // Au palier qui y a droit : l'outil DOIT partir.
        const c = commeUnMarchandQuiNeToucheARien(phrase, "pro");
        const portes = outilsPortes(c.niveau);
        verifier(portes.includes(outil),
            `« ${phrase} » part en « ${c.niveau} » et n'emporte PAS ${outil} ` +
            `(il faut au moins ${attendu}) — SAMII répondra de mémoire ou refusera`);
        verifier(N.comparer(c.niveau, attendu) >= 0,
            `« ${phrase} » retenu à « ${c.niveau} », sous le minimum « ${attendu} » de ${outil}`);
    }

    // ── ET LE PLANCHER NE MONTE PAS PLUS HAUT QUE NÉCESSAIRE ─────────────
    //
    // Une demande de LECTURE ne doit pas atterrir sur Pro : ce serait porter
    // les outils d'écriture sans que personne les ait demandés.
    for (const phrase of ["Fais le point sur mon activité ce mois",
                          "Quel est l'historique de ma cliente Aminata ?"]) {
        const c = commeUnMarchandQuiNeToucheARien(phrase, "pro");
        verifier(N.comparer(c.niveau, "pro") < 0,
            `« ${phrase} » ne fait que LIRE et part pourtant en « ${c.niveau} » : ` +
            "les outils d'écriture partent sans qu'on les ait demandés");
    }

    // Le piège que la pesée seule ne pouvait pas voir : un geste simple
    // ANNONCÉ, suivi d'une vraie demande d'envoi.
    const piege = commeUnMarchandQuiNeToucheARien("Traduis cette facture et envoie-la à Aminata", "pro");
    verifier(outilsPortes(piege.niveau).includes("envoyer_facture"),
        `« traduis … et envoie-la » part en « ${piege.niveau} » sans envoyer_facture : ` +
        "le geste simple en tête a masqué la demande réelle");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. L'ESCALADE — BRANCHÉE, BORNÉE, ET DÉCLARÉE
// ══════════════════════════════════════════════════════════════════════════
{
    const fs = require("fs");
    // Elle est APPELÉE. `tests/economie.test.js` garde déjà la cohérence
    // table ↔ code dans les deux sens ; ici on vérifie le fait lui-même,
    // parce que c'est la panne d'origine : une fonction écrite et jamais
    // appelée, pendant des mois, sans que rien ne le dise.
    const api = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    verifier(/niveauAuto\.doitMonter\(/.test(api),
        "routes/api.js n'appelle plus doitMonter : l'escalade est redevenue du code mort");
    verifier(ECO.AUTO.escaladeActive === true,
        "config/economie.js déclare l'escalade inactive alors qu'elle est branchée");

    // ── LES QUATRE VERROUS, MESURÉS SUR LE COMPORTEMENT ──────────────────
    const aveu = "Je n'ai pas accès à tes commandes pour te répondre.";
    const auto = { auto: true, borne: false, niveau: "expert" };
    const monter = (choix, opts = {}) => A.doitMonter({ choix, reponse: aveu, palier: "pro", ...opts });

    verifier(monter(auto) === true,
        "on ne monte pas sur un aveu d'insuffisance : la réponse creuse reste la réponse");
    verifier(monter(auto, { dejaMonte: true }) === false,
        "on monte DEUX fois : une escalade qui se répète est une facture qui s'emballe");
    verifier(monter({ ...auto, auto: false }) === false,
        "on monte depuis un choix EXPLICITE : on dépense l'argent de quelqu'un sans le lui demander");
    verifier(monter({ ...auto, borne: true }) === false,
        "on monte alors que le plafond a déjà mordu : il n'y a rien au-dessus auquel ce compte ait droit");
    verifier(monter({ ...auto, niveau: "maitre" }) === false,
        "on monte depuis le sommet");
    verifier(A.doitMonter({ choix: auto, reponse: "Tu as fait 42 ventes ce mois.", palier: "pro" }) === false,
        "on monte sur une réponse NORMALE : une réponse brève peut être la bonne");

    // ── LE CINQUIÈME VERROU — TROUVÉ EN LANÇANT LE VRAI SERVEUR ──────────
    //
    // Les quatre au-dessus ne suffisaient pas. Sur un compte GRATUIT, le
    // plafond est « expert » : `monter("expert", "free")` vise « pro », se fait
    // borner, et rend « expert ». L'escalade relançait un TOUR ENTIER pour
    // retomber au même cran, avec les mêmes outils et la même réponse creuse.
    // Mesuré en HTTP réel :
    //
    //     escalade (aveu) | AUTO | expert | 10 outils | 3 appels | expert→expert
    //
    // `borne` ne l'attrapait pas : il parle du choix INITIAL, pas de la montée.
    verifier(A.doitMonter({ choix: auto, reponse: aveu, palier: "free" }) === false,
        "on monte de « expert » à « expert » sur un compte gratuit : un tour entier " +
        "relancé pour retomber au même niveau, avec la même réponse creuse");
    verifier(A.doitMonter({ choix: { ...auto, niveau: "rapide" }, reponse: aveu, palier: "free" }) === true,
        "un compte gratuit ne peut plus monter de Rapide à Expert : le filet ne sert plus à rien");
    // Sans palier, on refuse plutôt que de deviner.
    verifier(A.doitMonter({ choix: auto, reponse: aveu }) === false,
        "on monte sans connaître le palier : la montée est décidée sur une supposition");
    // Et la montée doit vraiment changer de cran partout où elle est acceptée.
    for (const palier of Object.keys(N.PLAFOND_PAR_PALIER)) {
        for (const depart of N.ORDRE) {
            const accepte = A.doitMonter({ choix: { auto: true, borne: false, niveau: depart }, reponse: aveu, palier });
            if (!accepte) continue;
            verifier(N.comparer(N.monter(depart, palier).id, depart) > 0,
                `l'escalade est acceptée depuis « ${depart} » au palier « ${palier} » alors ` +
                "que monter() ne change rien : un tour relancé pour rien");
        }
    }

    // Et monter doit vraiment donner des outils en plus — sinon l'escalade est
    // une dépense sans contrepartie.
    const de = "expert";
    const vers = N.monter(de, "pro").id;
    verifier(outilsPortes(vers).length > outilsPortes(de).length,
        `monter de ${de} à ${vers} n'apporte aucun outil de plus : l'escalade coûte un ` +
        "tour entier pour rien");

    // ── LE TOUR RATÉ N'EST PAS FACTURÉ ───────────────────────────────────
    //
    // `routes/api.js` REMPLACE `result` avant la facturation. Le motif cherche
    // cette substitution : un `result` de plus, facturé à côté, serait un
    // double prélèvement invisible.
    verifier(/result = await conduire\(\)/.test(api),
        "l'escalade ne remplace plus le résultat : les deux tours pourraient être facturés");
    verifier(ECO.AUTO.prixOrchestrationUSD === 0,
        "une orchestration est facturée en plus alors que le tour raté ne doit rien coûter");
    // La table de l'étendue doit AVOUER le pire cas, sinon elle ment par omission.
    const pire = Math.max(...ECO.AUTO.etendue.map((e) => Number(e.appels) || 0));
    verifier(ECO.AUTO.etendue.some((e) => /escalade/i.test(e.cas)),
        "config/economie.js ne dit pas qu'un tour peut être joué deux fois");
    verifier(pire >= 14,
        `le pire cas déclaré est ${pire} appels — l'escalade double le tour, la table doit le dire`);
}

// ══════════════════════════════════════════════════════════════════════════
// 7. AUCUN OUTIL — LES CAS OÙ C'EST LA BONNE RÉPONSE
// ══════════════════════════════════════════════════════════════════════════
//
// « Donner ses mains à SAMII » ne veut pas dire « des outils partout ». Trois
// situations où zéro outil est CORRECT, et où le chantier G ne doit rien avoir
// changé.
{
    verifier(outilsPortes("rapide").length === 0,
        "le niveau Rapide porte maintenant des outils : un tour rapide qui appelle le " +
        "réseau n'est plus rapide");

    // Une pièce jointe est écrite par quelqu'un d'autre. Le tour qui la regarde
    // n'agit pas. Garde-fou antérieur, qu'on ne touche pas.
    verifier(outilsPortes("maitre", { piece: { base64: "xx", mimeType: "image/png" } }).length === 0,
        "un tour avec pièce jointe porte des outils : le contenu vient de dehors");

    // Une audience inconnue ne tient RIEN. Fermé par défaut.
    verifier(outilsPortes("maitre", { audience: "audience_inventee" }).length === 0,
        "une audience inconnue reçoit des outils — fermé par défaut, sinon l'oubli " +
        "tombe du mauvais côté");
    verifier(outilsPortes("maitre", { audience: "" }).length === 0,
        "une audience VIDE reçoit des outils");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LE MOTEUR DE REPLI — IL PORTE ZÉRO OUTIL, ET ON NE LE CACHE PAS
// ══════════════════════════════════════════════════════════════════════════
//
// On ne « répare » pas ce fait : `config/moteurs.js` ne concède aux relais que
// la famille `commerce`, délibérément (chantier 7 — une panne de Gemini
// remettait `envoyer_facture` entre les mains d'un moteur qui ne sait pas le
// tenir, et l'e-mail partait vraiment). Ce qu'on exige, c'est que le fait soit
// VU plutôt que masqué.
//
// ── CE BLOC EST ASYNCHRONE, ET C'EST LA CONSÉQUENCE DE SA CORRECTION ─────
//
// Il lisait le texte du fichier — instantané, et creux. Il APPELLE maintenant
// `chatViaOpenAiCompatible` avec une doublure de réseau, ce qui rend une
// promesse. Le reste de la suite est synchrone : ce bloc est donc une fonction,
// attendue juste avant le verdict.
async function eprouverLeRepli() {
    const relais = ["groq", "openrouter", "deepseek"];
    for (const r of relais) {
        verifier(outilsPortes("maitre", { moteur: r }).length === 0,
            `le relais ${r} porte des outils du marchand : le chantier 7 les lui a retirés ` +
            "parce qu'il ne sait pas les tenir");
        // Et il garde bien la famille `commerce` : c'est ce qui permet à une
        // boutique de continuer à prendre des commandes sur Telegram pendant
        // une panne Gemini. Retirer ça serait une régression grave.
        verifier(MOTEURS.porteLaFamille(r, "commerce"),
            `le relais ${r} a perdu la famille commerce : une panne Gemini couperait la ` +
            "prise de commande sur Telegram et WhatsApp");
    }

    // ── LE MARQUEUR D'HONNÊTETÉ, MESURÉ EN APPELANT LE VRAI CODE ─────────
    //
    // ⚠️ PREMIÈRE VERSION DE CE BLOC : QUATRE GARDES CREUX, TROUVÉS PAR LA
    // CAMPAGNE DE MUTATIONS.
    //
    // Ils lisaient le TEXTE de geminiService (`/sansOutils/`, `/role: "system"/`)
    // et, pire, REIMPLÉMENTAIENT le calcul du marqueur dans le test lui-même.
    // Résultat mesuré : remplacer le calcul du code par `const sansOutils =
    // false;` laissait les quatre gardes VERTS. Un test qui recalcule ce qu'il
    // devrait vérifier ne vérifie que lui-même.
    //
    // `chatViaOpenAiCompatible` prend son `poster` en paramètre. On l'appelle
    // donc pour de vrai, avec une doublure de réseau, et on REGARDE le corps
    // qui part et l'objet qui revient. Le fichier avait déjà écrit la règle
    // pour deux autres fonctions : « la vérifier en relisant le fichier ne
    // prouverait rien, il faut pouvoir l'appeler. »
    const viaRelais = async ({ niveau, audience, provider = "groq", useTools = true }) => {
        let corpsEnvoye = null;
        const poster = async (body) => {
            corpsEnvoye = body;
            return { data: { choices: [{ message: { content: "Je regarde ça." } }] } };
        };
        const r = await gemini.__test_chatViaOpenAiCompatible({
            provider, model: "modele-essai", poster,
            message: "Envoie une facture de 7500 DA à Aminata",
            context: { workspaceId: "qg-essai", audience, niveau, tourDeConversation: true },
            useTools, history: [],
        });
        const consignes = (corpsEnvoye?.messages || []).filter((m) => m.role === "system");
        return {
            outils: (corpsEnvoye?.tools || []).length,
            consigne: consignes.map((m) => m.content).join(" "),
            sansOutils: r?.sansOutils === true,
            provider: r?.provider,
        };
    };

    const marchandPro = await viaRelais({ niveau: "pro", audience: "souverain" });
    verifier(marchandPro.outils === 0,
        `le relais a reçu ${marchandPro.outils} outils du marchand : le chantier 7 les lui a retirés`);
    verifier(marchandPro.sansOutils === true,
        "un marchand servi par un relais n'est pas marqué « sans outils » : rien n'empêche " +
        "« c'est envoyé » alors que rien ne part");
    verifier(/ne dis jamais qu'une action est faite/i.test(marchandPro.consigne),
        `la consigne au relais ne lui interdit pas d'annoncer une action faite ` +
        `(« ${marchandPro.consigne.slice(0, 80)} »)`);
    verifier(/sans acc[eè]s à tes outils|moteur de secours/i.test(marchandPro.consigne),
        "la consigne ne dit pas au relais qu'il est privé de ses outils");

    // Rapide : aucun outil de toute façon — donc AUCUNE consigne, sinon SAMII
    // s'excuserait de ne pas pouvoir faire ce qu'on ne lui demandait pas.
    const marchandRapide = await viaRelais({ niveau: "rapide", audience: "souverain" });
    verifier(marchandRapide.sansOutils === false,
        "un tour Rapide servi par un relais est marqué « sans outils » alors qu'il n'en " +
        "aurait porté aucun de toute façon");
    verifier(marchandRapide.consigne === "",
        `un tour Rapide reçoit quand même la consigne de secours (« ${marchandRapide.consigne.slice(0, 60)} »)`);

    // Le chat PUBLIC : jamais d'outil par construction, donc jamais dégradé.
    // C'est le faux positif qu'une première version du calcul produisait.
    const publique = await viaRelais({ niveau: undefined, audience: "public", useTools: false });
    verifier(publique.sansOutils === false,
        "le chat PUBLIC servi par un relais est marqué « sans outils » — il n'a jamais eu " +
        "d'outil, par construction (audience public, zéro outil)");
    verifier(publique.consigne === "",
        "le chat public reçoit une consigne de secours qui ne le concerne pas");

    // Le client d'une boutique : le relais tient bien la famille commerce, donc
    // la prise de commande survit à une panne Gemini. Pas de dégradation.
    const clientBoutique = await viaRelais({ niveau: "expert", audience: "client" });
    verifier(clientBoutique.outils > 0,
        "un client de boutique servi par un relais ne reçoit AUCUN outil : une panne " +
        "Gemini couperait la prise de commande sur Telegram et WhatsApp");
    verifier(clientBoutique.sansOutils === false,
        "un client de boutique est marqué « sans outils » alors que le relais tient bien " +
        "la famille commerce");

    // ── ET AUCUNE FAUSSE RÉUSSITE EN REPLI ───────────────────────────────
    //
    // ⚠️ TROUVÉ EN LANÇANT LE VRAI SERVEUR, PAS EN RELISANT.
    //
    // `chatWithFunctionResult` portait QUATRE « C'est fait ✅ » codés en dur,
    // rendus quand le modèle ne donne pas de texte ou quand l'appel de
    // reformulation échoue — SANS regarder le résultat de l'outil. Mesuré sur
    // `creer_evenement_agenda` : l'acte a échoué (table `connecteurs` absente),
    // il a bien été rapporté `reussi: false` et donc NON facturé, et la phrase
    // rendue était « C'est posé dans ton agenda ✅ ».
    //
    // ⚠️ PREMIÈRE VERSION DE CE BLOC : il ÉVALUAIT la fonction depuis le texte
    // du fichier. Ça marchait, mais ça mesurait une COPIE — le jour où les
    // appelants cessent d'utiliser cette fonction, la copie continue de bien se
    // comporter et le test se tait. La fonction est exportée, on l'appelle.
    {
        const phrase = gemini.__test_phraseDeRepli;
        verifier(typeof phrase === "function",
            "phraseDeRepli n'est plus exposée : les quatre replis peuvent rementir sans qu'on le voie");

        const rate = phrase({ success: false, error: "Aucun agenda Google connecté" });
        verifier(!/fait|posé|envoyé|enregistré/i.test(rate),
            `un outil qui a ÉCHOUÉ produit la phrase « ${rate} » : une fausse réussite ` +
            "se découvre chez le client du marchand, pas chez nous");
        verifier(/Aucun agenda Google connecté/.test(rate),
            `la phrase d'échec ne dit pas pourquoi (« ${rate} ») : un échec sans motif ne se ` +
            "répare pas");
        verifier(!/fait/i.test(phrase({ success: false })),
            "un échec sans motif annonce quand même une réussite");
        // Et la réussite reste annoncée : on ne rend pas tout le monde méfiant.
        for (const bon of [{ success: true }, { donnees: [1, 2] }, undefined, null]) {
            verifier(/fait/i.test(phrase(bon)),
                `un résultat sans échec franc (${JSON.stringify(bon)}) n'est plus annoncé comme ` +
                "fait — la règle doit être celle de factureDuTour : seul `success === false` est un échec");
        }

        // La règle de lecture est LA MÊME que celle de la facturation. Deux
        // règles auraient divergé, et le marchand serait facturé pour un geste
        // dont on lui dit qu'il a raté.
        const commeFacture = (r) => CREDITS.factureDuTour([{ nom: "prendre_rendez_vous", reussi: r?.success !== false }]).montant;
        for (const r of [{ success: false }, { success: true }, undefined]) {
            const ditRate = /n'ai pas réussi/.test(phrase(r));
            const nonFacture = commeFacture(r) === CREDITS.PRIX_MESSAGE_USD;
            verifier(ditRate === nonFacture,
                `pour ${JSON.stringify(r)} la phrase dit ${ditRate ? "raté" : "fait"} et la facture ` +
                `${nonFacture ? "ne compte rien" : "compte l'acte"} — les deux règles ont divergé`);
        }
    }

    // Plus aucun « C'est fait ✅ » ne doit partir sans passer par la phrase.
    const fs = require("fs");
    const src = fs.readFileSync(path.join(RACINE, "services", "geminiService.js"), "utf8");
    const durs = (src.match(/"C'est fait ✅"/g) || []).length;
    verifier(durs === 1,
        `${durs} « C'est fait ✅ » écrits en dur : un seul est permis, celui de phraseDeRepli`);
}

// ══════════════════════════════════════════════════════════════════════════
// 9. LE COÛT — LE NIVEAU N'ENTRE NULLE PART DANS LE PRIX
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le fait qui a rendu la décision possible, et il doit rester vrai.
// Le jour où un niveau coûtera plus cher, ce test criera — et il FAUDRA
// rouvrir la question du défaut.
{
    const prix = N.ORDRE.map((id) => N.niveau(id).prixUSD);
    verifier(new Set(prix).size === 1,
        `les niveaux n'ont plus le même prix (${prix.join(", ")}) : le cran de départ ` +
        "« auto » change désormais la facture, et la décision du chantier G doit être revue");
    verifier(prix[0] === CREDITS.PRIX_MESSAGE_USD,
        "le prix d'un niveau a divergé du prix d'un message");

    // La facture d'un tour ne dépend QUE du message et des actes réussis.
    const nu = CREDITS.factureDuTour([]);
    verifier(nu.montant === CREDITS.PRIX_MESSAGE_USD,
        "un tour sans acte ne coûte plus le prix d'un message");

    // Et rien de ce que le chantier G ouvre n'est facturé en plus TANT QUE
    // SAMII n'agit pas. Les outils de lecture restent compris dans le message :
    // c'est ce qui rend Expert par défaut économiquement neutre.
    for (const lecture of N.FAMILLES.lecture) {
        const f = CREDITS.factureDuTour([{ nom: lecture, reussi: true }]);
        const gratuit = lecture in CREDITS.GRATUITS;
        const paye = f.montant > CREDITS.PRIX_MESSAGE_USD;
        verifier(gratuit !== paye,
            `« ${lecture} » est ${gratuit ? "déclaré gratuit" : "tarifé"} mais facturé ` +
            `${paye ? "en supplément" : "au prix d'un message"} — la grille et la facture divergent`);
    }
    // Les cinq outils de lecture repris des anciennes pages, nommément : ce
    // sont eux qu'Auto ouvre en passant le plancher à Expert.
    for (const l of ["marche_du_moment", "prix_du_marche", "trouver_fournisseur",
                     "etat_de_mon_business", "historique_client", "resume_journee",
                     "consulter_gmail", "consulter_agenda", "lister_fichiers_drive"]) {
        verifier(CREDITS.factureDuTour([{ nom: l, reussi: true }]).montant === CREDITS.PRIX_MESSAGE_USD,
            `« ${l} » est facturé en supplément : Expert par défaut deviendrait une hausse ` +
            "de prix déguisée");
    }
    // `rechercher_prospects` est dans `lecture` MAIS il se paie (grounding à la
    // requête). C'est voulu, et c'est le seul : on le nomme pour que la ligne
    // ci-dessus ne puisse pas être élargie par distraction.
    verifier(CREDITS.prixActe("rechercher_prospects") > 0,
        "rechercher_prospects est devenu gratuit : il consomme une recherche web facturée");
}

// ══════════════════════════════════════════════════════════════════════════
// 10 à 12. PERMISSIONS, AUDIENCE, ET AUCUN OUTIL INTERDIT
// ══════════════════════════════════════════════════════════════════════════
//
// Le chantier G ne doit RIEN avoir déplacé ici. `AUDIENCE ∩ NIVEAU ∩ MOTEUR`
// reste l'unique calcul, et l'audience reste le plafond absolu.
{
    // L'audience borne le niveau, jamais l'inverse. Un client de boutique au
    // niveau Maître ne doit pas tenir un outil du marchand.
    const chezLeClient = outilsPortes("maitre", { audience: "client" });
    const duMarchand = ["consulter_gmail", "envoyer_email", "envoyer_facture",
                        "etat_de_mon_business", "executer_code", "rechercher_prospects"];
    for (const interdit of duMarchand) {
        verifier(!chezLeClient.includes(interdit),
            `un client de boutique tient « ${interdit} » au niveau Maître — ` +
            "l'audience doit plafonner le niveau, pas le contraire");
    }
    verifier(chezLeClient.length > 0 && chezLeClient.every((o) => N.FAMILLES.commerce.includes(o)),
        `un client de boutique tient ${JSON.stringify(chezLeClient)} : seule la famille ` +
        "commerce lui revient");

    // Le niveau n'accorde JAMAIS la famille commerce : elle dépend de
    // l'audience. Garde-fou antérieur.
    for (const id of N.ORDRE) {
        const f = N.niveau(id).familles;
        verifier(!f.includes("commerce"),
            `le niveau « ${id} » accorde la famille commerce : elle dépend de l'audience`);
    }

    // Le plafond du palier borne le niveau retenu, y compris sous le plancher
    // d'outil. Un compte gratuit ne doit JAMAIS atteindre l'écriture.
    for (const phrase of ["Envoie une facture de 7500 DA à Aminata",
                          "Écris un script python qui calcule ma marge",
                          "Prépare-moi une publication Instagram"]) {
        const c = commeUnMarchandQuiNeToucheARien(phrase, "free");
        verifier(N.comparer(c.niveau, N.plafond("free")) <= 0,
            `« ${phrase} » dépasse le plafond gratuit (${c.niveau} > ${N.plafond("free")}) : ` +
            "le plancher d'outil a contourné le paywall");
        verifier(c.borne === true,
            `« ${phrase} » ne dit pas au compte gratuit que le plafond a mordu — ` +
            "il croira que SAMII ne sait pas faire");
        verifier(c.exige && N.comparer(c.exige, c.niveau) > 0,
            `« ${phrase} » ne nomme pas le cran qui manquait (exige=${c.exige}) : ` +
            "« passe à un abonnement » sans motif n'apprend rien");
    }

    // Tout outil porté par un niveau doit être connu de la facturation. Un
    // outil ouvert par le plancher d'Auto sans prix décidé serait un
    // supplément que personne n'a choisi.
    for (const id of N.ORDRE) {
        for (const outil of N.outilsDe(id)) {
            verifier((outil in CREDITS.ACTES) || (outil in CREDITS.GRATUITS),
                `« ${outil} » (niveau ${id}) n'a pas de prix décidé — Auto peut l'ouvrir, ` +
                "et personne n'a tranché ce qu'il coûte");
        }
    }

    // Et le plancher ne peut nommer qu'une famille EXISTANTE du registre.
    for (const intention of A.INTENTIONS) {
        verifier(Object.prototype.hasOwnProperty.call(N.FAMILLES, intention.famille),
            `une intention vise la famille « ${intention.famille} », absente de ` +
            "config/niveaux.FAMILLES — elle ne fera jamais monter personne");
        verifier(!!N.niveauMinimalDeFamille(intention.famille),
            `la famille « ${intention.famille} » n'est portée par aucun niveau`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 13. NON-RÉGRESSION DU CHAT N°1 (le marchand connecté)
// ══════════════════════════════════════════════════════════════════════════
{
    // Le chat du QG parle à l'audience `souverain`, et elle doit garder ses
    // dix-sept outils. Si ce nombre bouge, ce n'est pas le chantier G.
    const souverain = AUDIENCES.outilsDe("souverain");
    verifier(souverain.length === 17,
        `l'audience souveraine porte ${souverain.length} outils au lieu de 17 : ` +
        "le chantier G ne devait toucher ni l'audience ni les permissions");

    // Au sommet, le marchand tient tout ce que l'audience lui accorde ET que
    // le niveau porte — l'intersection, pas plus, pas moins.
    const auSommet = outilsPortes("maitre");
    const attendu = souverain.filter((o) => N.outilsDe("maitre").includes(o));
    verifier(auSommet.length === attendu.length,
        `au niveau Maître le marchand tient ${auSommet.length} outils, l'intersection en ` +
        `donne ${attendu.length} — le calcul a changé de forme`);

    // Un niveau demandé à la main reste respecté, et reste borné au palier.
    for (const id of N.ORDRE) {
        const c = A.choisir({ message: "Fais-moi un plan complet", demande: id, palier: "pro" });
        verifier(c.niveau === id && c.auto === false,
            `« ${id} » demandé à la main donne « ${c.niveau} » (auto=${c.auto})`);
    }
    const trop = A.choisir({ message: "Fais-moi un plan", demande: "maitre", palier: "free" });
    verifier(trop.niveau === N.plafond("free") && trop.borne === true,
        `« maitre » demandé sur un compte gratuit donne « ${trop.niveau} » (borne=${trop.borne})`);
}

// ══════════════════════════════════════════════════════════════════════════
// 14. NON-RÉGRESSION DU CHAT ANONYME
// ══════════════════════════════════════════════════════════════════════════
//
// MESURÉ : le chemin anonyme n'envoie JAMAIS de niveau. `corpsConnecte` est la
// seule fonction du script qui pose `niveau:`, et elle est derrière
// `if (CONNECTE)`. Le chat public passe par `routes/vitrine.js` avec
// `audience: "public"`, qui ne porte aucun outil. Changer le cran de départ ne
// peut donc pas toucher l'anonyme — et ce test garde ce fait, parce que c'est
// lui qui rend la décision sans danger.
{
    const fs = require("fs");
    const js = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    // Le corps anonyme ne porte pas de niveau.
    const debutAnonyme = js.indexOf("var corps = JSON.stringify({ message: texte");
    verifier(debutAnonyme > 0,
        "l'instrument ne trouve plus le corps anonyme — il ne mesure rien");
    const corpsAnonyme = js.slice(debutAnonyme, debutAnonyme + 200);
    verifier(!/niveau/.test(corpsAnonyme),
        `le chemin anonyme envoie maintenant un niveau (${corpsAnonyme.slice(0, 120)}) : ` +
        "le cran de départ se met à décider pour quelqu'un qui n'a pas de compte");

    // L'audience publique ne porte aucun outil, à aucun niveau.
    verifier(AUDIENCES.outilsDe("public").length === 0,
        "l'audience publique porte des outils : un visiteur anonyme pourrait agir");
    for (const id of N.ORDRE) {
        verifier(outilsPortes(id, { audience: "public" }).length === 0,
            `l'audience publique porte des outils au niveau ${id}`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 15. LA NOTE DU MOTEUR — CE QUE L'ÉCRAN DIT QUAND ÇA NE S'EST PAS BIEN PASSÉ
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE BLOC EXISTE PARCE QUE LA CAMPAGNE DE MUTATIONS A MONTRÉ QUE RIEN NE
// GARDAIT `peindreNote`. La mutation « la note du moteur n'est plus peinte »
// (`if (true) return;` en tête de la fonction) laissait TOUTE la suite verte.
//
// Or c'est la seule chose qui, à l'écran, distingue « SAMII s'en occupe » de
// « rien n'a été exécuté ». Un marchand qui ne voit pas cette phrase attend une
// facture qui ne partira jamais.
//
// ── POURQUOI ON EXTRAIT LA FONCTION AU LIEU DE L'IMPORTER ────────────────
//
// `public/js/samii-accueil.js` tourne dans un navigateur, à l'intérieur d'une
// IIFE : il n'exporte rien, et on ne peut pas l'importer ici. L'alternative
// aurait été de n'en garder qu'un test Playwright — mais Playwright ne tourne
// pas dans `npm test`, donc la panne ne serait vue qu'à la main.
//
// On extrait donc le TEXTE de la fonction et on l'exécute avec un faux DOM
// minimal. Ce n'est pas l'idéal — c'est une copie — mais la copie est le code
// réel, et ça attrape ce qui compte : un `return` précoce, une branche perdue,
// une phrase qui ne dit plus « rien n'a été exécuté ». Un garde de plus vérifie
// que les trois appels existent bien dans les trois chemins.
{
    const fs = require("fs");
    const js = fs.readFileSync(path.join(RACINE, "public/js/samii-accueil.js"), "utf8");

    // Les trois entonnoirs. Un seul oublié, et la note se tait sur ce chemin-là.
    const appels = (js.match(/\bpeindreNote\(/g) || []).length;
    verifier(appels === 4,
        `peindreNote est nommée ${appels} fois (1 déclaration + 3 appels attendus) : ` +
        "un des trois chemins — flux avec outil, flux sans outil, sans flux — ne peint plus rien");

    // On découpe la fonction entre sa déclaration et la suivante.
    // ⚠️ LA TRANCHE PART DE `MOTS_NIVEAU`, PAS DE LA FONCTION.
    // `peindreNote` s'appuie sur `nomNiveau()` et sa table, déclarées juste
    // au-dessus. Une tranche qui commence à la fonction lève
    // « nomNiveau is not defined » — et une tranche plus large est un garde plus
    // large : muter un libellé de cran se voit aussi.
    const debut = js.indexOf("    var MOTS_NIVEAU = {");
    const fin = js.indexOf("    function peindreResultat(c) {");
    verifier(debut > 0 && fin > debut,
        "l'instrument ne trouve plus peindreNote — il ne mesure rien");

    if (debut > 0 && fin > debut) {
        const corps = js.slice(debut, fin);

        // LE FAUX DOM, RÉDUIT À CE QUE LA FONCTION UTILISE VRAIMENT :
        //   var t = bloc("tour tour--note");
        //   t.appendChild(elem("p", "note note--" + genre, phrase));
        // Deux fabriques, un `appendChild` qui ne fait rien. Rien de plus — un
        // faux DOM plus riche que nécessaire est un faux DOM qu'on croit juste.
        const peints = [];
        // eslint-disable-next-line no-new-func
        const peindreNote = new Function("bloc", "elem", "T", `${corps}\nreturn peindreNote;`)(
            (classe) => ({ classe, appendChild() {} }),
            (balise, classe, texte) => { const e = { balise, classe, texte }; peints.push(e); return e; },
            {},   // aucun libellé traduit : on éprouve les phrases de repli
        );

        const rendre = (json) => {
            peints.length = 0;
            peindreNote(json);
            return { note: peints[peints.length - 1] || null };
        };

        // 1. RIEN À DIRE → RIEN N'EST PEINT. Un bandeau à chaque message
        //    deviendrait du bruit qu'on n'ouvre plus.
        for (const rien of [null, undefined, {}, { niveau: { id: "expert", auto: true } }]) {
            const r = rendre(rien);
            verifier(!r.note,
                `une note est peinte pour ${JSON.stringify(rien)} : un bandeau à chaque message ` +
                "devient du bruit qu'on cesse de lire");
        }

        // 2. LE REPLI SANS OUTILS — la phrase la plus importante du produit.
        {
            const r = rendre({ sansOutils: true, niveau: { id: "pro", auto: true } });
            verifier(r.note && /note--secours/.test(r.note.classe),
                `le repli sans outils ne peint pas sa note (${JSON.stringify(r.note)})`);
            verifier(r.note && /rien n'a été exécuté/i.test(r.note.texte),
                `la note du repli ne dit pas que rien n'a été exécuté (« ${r.note?.texte} ») — ` +
                "c'est la seule phrase qui empêche de lire « je m'en occupe » comme « c'est fait »");
        }

        // 3. LA MONTÉE — sinon le niveau annoncé au départ devient faux en silence.
        {
            const r = rendre({ niveau: { id: "pro", auto: true, escalade: { de: "expert", vers: "pro" } } });
            verifier(r.note && /note--montee/.test(r.note.classe),
                `une escalade ne peint pas sa note (${JSON.stringify(r.note)})`);
            verifier(r.note && /Pro/.test(r.note.texte),
                `la note de montée ne nomme pas le cran atteint (« ${r.note?.texte} »)`);
        }

        // 4. LE PLAFOND — on nomme le cran qui manquait.
        {
            const r = rendre({ niveau: { id: "expert", auto: true, borne: true, exige: "pro" } });
            verifier(r.note && /note--borne/.test(r.note.classe),
                `un plafond qui a mordu ne peint pas sa note (${JSON.stringify(r.note)})`);
            verifier(r.note && /Pro/.test(r.note.texte) && /Expert/.test(r.note.texte),
                `la note du plafond ne nomme pas les deux crans (« ${r.note?.texte} »)`);
        }

        // 5. L'ORDRE COMPTE : « rien n'a été exécuté » passe AVANT tout le reste.
        //    Un tour à la fois dégradé ET monté doit dire le plus grave.
        {
            const r = rendre({
                sansOutils: true,
                niveau: { id: "pro", auto: true, borne: true, exige: "maitre", escalade: { de: "expert", vers: "pro" } },
            });
            verifier(r.note && /note--secours/.test(r.note.classe),
                `un tour dégradé ET monté annonce « ${r.note?.classe} » : le plus grave doit primer`);
        }
    }
}

// ── VERDICT ──────────────────────────────────────────────────────────────
//
// `eprouverLeRepli()` est la seule partie asynchrone : elle appelle le vrai
// `chatViaOpenAiCompatible`. On l'attend AVANT de compter, sinon le verdict
// tomberait sur une suite incomplète — et une suite qui se déclare verte avant
// d'avoir fini est pire qu'une suite rouge.
eprouverLeRepli().then(() => {
if (echecs.length) {
    console.error(`❌ les mains de SAMII : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log(`✅ les mains de SAMII : ${verifs} vérifications passées`);
process.exit(0);
}).catch((err) => {
    console.error("❌ les mains de SAMII : la suite a levé —", err.message);
    process.exit(1);
});
