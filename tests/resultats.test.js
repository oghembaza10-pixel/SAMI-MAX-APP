// ==========================================================================
// SAMII OS — LES RESULTATS : UN RÉSULTAT QUI RESTE
// ==========================================================================
//
// Un outil rend une structure, le serveur en fait une résultat, le fil la
// peint. Cette suite garde les trois promesses de cette chaîne :
//
//   1. LA CARTE NE DIT QUE CE QUE L'OUTIL A DIT. Aucun champ inventé,
//      aucune valeur « plausible » pour boucher un trou.
//   2. LA CARTE NE PROPOSE QUE DES GESTES TENABLES. Un bouton visible est
//      une promesse — la version cliquable du défaut qu'on vient de
//      réparer dans le prompt (chantier A).
//   3. LA STRUCTURE BRUTE NE PART PAS AU NAVIGATEUR. La résultat part, le
//      `functionResult` reste sur le serveur.
//
// ⚠️ LES SORTIES D'OUTILS UTILISÉES ICI SONT LUES DANS brain/planner.js,
// pas imaginées. `rechercher_prospects` rend
// `{ success, prospects[], sources[] }` ; `resume_journee` rend
// `{ success, periode, perimetre, donnees{}, indisponibles[] }`. Un test
// bâti sur une forme inventée serait vert pour une chaîne qui ne marche pas.
//
// Lancer :  node tests/resultats.test.js
// ==========================================================================

const path = require("path");
const fs = require("fs");

const RACINE = path.join(__dirname, "..");
const resultats = require(path.join(RACINE, "services", "resultats.js"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux.js"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── LES SORTIES RÉELLES, RECOPIÉES DES OUTILS ────────────────────────────
const PROSPECTS = {
    success: true,
    prospects: [
        { nom: "Salon Amel", lien: "https://salon-amel.dz", reseau_social: "",
          contact_pro: "contact@salon-amel.dz", secteur: "Coiffure",
          explication: "Salon actif au centre d'Alger." },
        { nom: "Beauty Lab", lien: "", reseau_social: "https://instagram.com/beautylab",
          contact_pro: "", secteur: "Esthétique", explication: "Forte présence Instagram." },
    ],
    sources: [{ title: "Google Maps", uri: "https://maps.google.com/x" }],
};

const BILAN = {
    success: true,
    periode: "les dernières 24 heures",
    perimetre: "ton espace de travail",
    donnees: {
        commandes: 3, paiements: 0, rendezVous: 2, messagesNonLus: 7,
        emails: { nombre: 12, apercus: [{ de: "client@exemple.dz", objet: "Ma commande" }] },
    },
    indisponibles: ["Erreurs applicatives : elles ne sont pas encore enregistrées en base."],
};

const acte = (nom, donnees, reussi = true) => [{ nom, reussi, donnees }];

// ══════════════════════════════════════════════════════════════════════════
// 1. LA CARTE DIT CE QUE L'OUTIL A DIT — ET RIEN DE PLUS
// ══════════════════════════════════════════════════════════════════════════
{
    const [c] = resultats.depuisLesActes(acte("rechercher_prospects", PROSPECTS),
        { audience: "souverain", niveau: "pro" });
    verifier(!!c, "aucune résultat pour une sortie de prospects pourtant valide");
    verifier(c && c.source === "rechercher_prospects",
        "la résultat ne dit pas quel outil l'a produite");
    verifier(c && c.elements.length === 2,
        `la résultat montre ${c && c.elements.length} prospects au lieu des 2 rendus par l'outil`);
    verifier(c && c.elements[0].titre === "Salon Amel",
        "le nom du premier prospect n'est pas celui rendu par l'outil");
    verifier(c && c.elements[0].contact === "contact@salon-amel.dz",
        "le contact professionnel publié par l'entreprise n'est pas repris tel quel");

    // ⚠️ LE PIÈGE : un prospect sans contact. L'outil rend une chaîne vide
    // quand l'entreprise ne publie rien. Une résultat qui comblerait ce vide
    // (« contact non communiqué », une adresse devinée) inventerait une
    // donnée — et une résultat qu'on croit sur parole est pire qu'une absence.
    verifier(c && !c.elements[1].contact,
        "un prospect sans contact publié reçoit quand même un contact dans la résultat — "
        + "la résultat invente une donnée que l'outil n'a pas rendue");

    // Le second n'a pas de `lien` mais un `reseau_social` : c'est celui-là
    // qui doit apparaître, pas une chaîne vide.
    verifier(c && c.elements[1].lien === "https://instagram.com/beautylab",
        "le repli sur la page réseau social ne se fait pas quand le site manque");
}

// ══════════════════════════════════════════════════════════════════════════
// 2. AUCUN LIEN EXÉCUTABLE NE PASSE
// ══════════════════════════════════════════════════════════════════════════
//
// Le contenu d'une résultat de prospects vient d'une recherche web : des liens
// écrits par n'importe qui sur n'importe quelle page. `javascript:` dans un
// href est du code qui s'exécute au clic, dans le navigateur du marchand,
// avec sa session ouverte.
{
    const piege = {
        success: true,
        prospects: [
            { nom: "A", lien: "javascript:alert(1)", reseau_social: "", secteur: "X", explication: "y" },
            { nom: "B", lien: "data:text/html,<script>x</script>", reseau_social: "", secteur: "X", explication: "y" },
            { nom: "C", lien: "  HTTPS://exemple.dz/ok  ", reseau_social: "", secteur: "X", explication: "y" },
        ],
        sources: [{ title: "mauvaise", uri: "javascript:void(0)" }],
    };
    const [c] = resultats.depuisLesActes(acte("rechercher_prospects", piege),
        { audience: "souverain", niveau: "pro" });
    verifier(c && c.elements[0].lien === "",
        "un lien « javascript: » survit dans une résultat — il s'exécuterait au clic");
    verifier(c && c.elements[1].lien === "",
        "un lien « data: » survit dans une résultat");
    verifier(c && /^HTTPS:\/\/exemple\.dz\/ok$/.test(c.elements[2].lien),
        "un lien http(s) légitime a été retiré, ou son espace de bord n'a pas été enlevé");
    verifier(c && c.liens.length === 0,
        "une SOURCE en « javascript: » survit — les sources passent par le même filtre que les liens");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LES GESTES : JAMAIS UN BOUTON QUI NE PEUT PAS ABOUTIR
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le garde central de ce chantier. Un geste qui nomme un outil n'est
// proposé que si cette personne, à ce niveau, le tient vraiment — même table
// que le prompt (config/audiences.js, `outilsDuTour`).
{
    const AUDIENCES = require(path.join(RACINE, "config", "audiences.js"));
    let gestesOutilles = 0;
    for (const [audience, niveau] of [
        ["souverain", "rapide"], ["souverain", "expert"],
        ["souverain", "pro"], ["souverain", "maitre"],
        ["client", null], ["public", null], ["", null],
    ]) {
        const possibles = new Set(AUDIENCES.outilsDuTour(audience, niveau));
        for (const [nom, donnees] of [["rechercher_prospects", PROSPECTS], ["resume_journee", BILAN]]) {
            const [c] = resultats.depuisLesActes(acte(nom, donnees), { audience, niveau });
            if (!c) continue;
            for (const g of c.gestes) {
                verifier(!!g.libelle && !!g.demande,
                    `${nom} / ${audience} : un geste sans libellé ou sans demande à envoyer`);
                if (!g.outil) continue;
                gestesOutilles++;
                verifier(possibles.has(g.outil),
                    `${nom} / ${audience}${niveau ? " · " + niveau : ""} : la résultat propose « ${g.libelle} » `
                    + `qui appelle « ${g.outil} » — un outil que cette personne ne tient pas. `
                    + "Un bouton visible est une promesse.");
            }
        }
    }
    // Un garde qui ne rencontre jamais de geste outillé ne garde rien. La
    // boucle ci-dessus resterait verte si plus aucune résultat n'en proposait.
    verifier(gestesOutilles > 0,
        "aucun geste appelant un outil n'a été rencontré — la vérification ci-dessus ne mesure plus rien");
}

// Et la démonstration par le contraste : le même geste apparaît au niveau
// qui le porte, disparaît à celui qui ne le porte pas.
{
    const libelles = (niveau) => {
        const [c] = resultats.depuisLesActes(acte("rechercher_prospects", PROSPECTS),
            { audience: "souverain", niveau });
        return c ? c.gestes.map((g) => g.libelle) : [];
    };
    const aPro = libelles("pro");
    const aExpert = libelles("expert");
    verifier(aPro.some((l) => /email/i.test(l)),
        "au niveau Pro, le geste « envoyer un email » n'est pas proposé — il est pourtant accordé");
    verifier(!aExpert.some((l) => /email/i.test(l)),
        "au niveau Expert, le geste « envoyer un email » est proposé — `envoyer_email` est dans la "
        + "famille écriture, accordée à partir de Pro seulement");
    verifier(aExpert.length > 0,
        "au niveau Expert la résultat ne propose plus AUCUN geste — les gestes sans outil "
        + "doivent rester, ce sont de simples messages");
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE PRIX ET LE SOLDE : CE QUI EST PAYÉ EST DIT
// ══════════════════════════════════════════════════════════════════════════
{
    const credits = {
        montant: 0.08, solde: 1.42,
        lignes: [
            { quoi: "message", montant: 0.03 },
            { quoi: "rechercher_prospects", montant: 0.05, libelle: "Recherche de prospects" },
        ],
    };
    const [c] = resultats.depuisLesActes(acte("rechercher_prospects", PROSPECTS),
        { audience: "souverain", niveau: "pro", credits });
    verifier(c && c.cout && c.cout.montant === 0.05,
        "la résultat ne porte pas le prix de SON acte");
    verifier(c && c.cout && c.cout.solde === 1.42,
        "la résultat ne porte pas le solde restant — une dépense sans solde est un ticket sans total");
    verifier(c && c.cout && c.cout.libelle === "Recherche de prospects",
        "le prix de l'acte n'est pas nommé avec le libellé du registre");

    // ⚠️ LE PRIX DU MESSAGE N'APPARTIENT PAS À LA CARTE. Il appartient au
    // tour. Une résultat qui afficherait 0,08 $ ferait payer son message à un
    // acte qui coûte 0,05 $.
    verifier(c && c.cout.montant !== credits.montant,
        "la résultat affiche le total du tour au lieu du prix de son acte");

    // Quota gratuit : rien n'a été débité, donc rien à montrer. Écrire « 0 »
    // ferait croire à une remise.
    const [sansDebit] = resultats.depuisLesActes(acte("rechercher_prospects", PROSPECTS),
        { audience: "souverain", niveau: "pro", credits: null });
    verifier(sansDebit && !sansDebit.cout,
        "une résultat affiche un prix alors que le tour n'a pas été débité");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LE BILAN : « 0 » EST UNE VALEUR, « PAS MESURÉ » N'EN EST PAS UNE
// ══════════════════════════════════════════════════════════════════════════
{
    const [c] = resultats.depuisLesActes(acte("resume_journee", BILAN),
        { audience: "souverain", niveau: "pro" });
    verifier(!!c, "aucune résultat pour un bilan pourtant valide");
    verifier(c && c.forme === "chiffres", "le bilan n'est pas rendu en chiffres");

    const par = {};
    (c ? c.elements : []).forEach((e) => { par[e.titre] = e.valeur; });
    verifier(par["Commandes"] === "3", "le compteur de commandes ne vient pas du briefing");
    // ⚠️ LE PIÈGE : `paiements: 0`. Un test de vérité (`if (valeur)`) le
    // ferait disparaître de la résultat, et le marchand lirait un bilan où le
    // zéro est absent — donc un bilan qui ment par omission.
    verifier(par["Paiements"] === "0",
        "« 0 paiement » a disparu de la résultat — un zéro est une information, pas une absence");
    verifier(par["Emails"] === "12", "le compteur d'emails ne vient pas du briefing");

    // Ce que le briefing n'a PAS pu lire doit rester visible : sinon la
    // résultat fait croire à un bilan complet.
    verifier(c && Array.isArray(c.manques) && c.manques.length === 1,
        "les sources indisponibles ne sont pas reportées sur la résultat — "
        + "« 0 erreur » et « on ne mesure pas les erreurs » sonnent pareil");

    // ⚠️ ET LES APERÇUS DE LA BOÎTE MAIL NE SORTENT PAS. L'outil les rend ;
    // la résultat n'en tire qu'un compteur. Le sérialisé de la résultat ne doit
    // contenir ni expéditeur ni objet.
    const serialise = JSON.stringify(c);
    verifier(!/client@exemple\.dz/.test(serialise) && !/Ma commande/.test(serialise),
        "les aperçus de la boîte mail partent dans la résultat — seul le compteur devait sortir");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. CE QUI NE DOIT PAS PRODUIRE DE CARTE
// ══════════════════════════════════════════════════════════════════════════
{
    const rien = (actes, opts) => resultats.depuisLesActes(actes, opts || { audience: "souverain", niveau: "pro" });
    verifier(rien(acte("rechercher_prospects", PROSPECTS, false)).length === 0,
        "un acte RATÉ produit une résultat — il n'a rien produit à montrer");
    verifier(rien(acte("rechercher_prospects", { success: false, error: "panne" })).length === 0,
        "une sortie en échec produit une résultat");
    verifier(rien(acte("rechercher_prospects", { success: true, prospects: [] })).length === 0,
        "une liste vide produit une résultat vide");
    verifier(rien(acte("envoyer_email", { success: true })).length === 0,
        "un outil sans adaptateur produit quand même une résultat — le défaut doit être le texte");
    verifier(rien(null).length === 0 && rien(undefined).length === 0 && rien([]).length === 0,
        "un journal absent ou vide fait planter la construction des résultats");
    verifier(rien(acte("resume_journee", { success: true, donnees: {} })).length === 0,
        "un bilan sans le moindre compteur produit une résultat vide");

    // Un adaptateur qui lève ne doit pas emporter la réponse : le texte de
    // SAMII est déjà parti, il porte l'essentiel.
    const casse = { get success() { throw new Error("sortie illisible"); } };
    let planté = false;
    try { rien(acte("rechercher_prospects", casse)); } catch { planté = true; }
    verifier(!planté, "un adaptateur qui lève fait planter tout le tour au lieu de n'omettre que sa résultat");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LE FIL SAIT LA PEINDRE — ET SANS innerHTML
// ══════════════════════════════════════════════════════════════════════════
//
// Le renderer n'est pas exécutable ici (il a besoin d'un DOM). On garde donc
// les deux propriétés qui se lisent dans la source et qui, si elles
// disparaissaient, ne se verraient nulle part ailleurs.
{
    const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
    verifier(/function peindreResultat\b/.test(js) && /function peindreResultats\b/.test(js),
        "le fil du chat n'a plus de fonction pour peindre une résultat");
    verifier(/peindreResultats\(json && json\.resultats\)/.test(js),
        "les résultats de la réponse ne sont plus peintes — le canal est branché côté serveur "
        + "et débranché côté page");

    // ⚠️ AUCUN innerHTML DANS LA PEINTURE D'UNE CARTE. Les noms et les
    // descriptions viennent d'une recherche web : un seul innerHTML et une
    // page publique choisit ce qui s'exécute chez le marchand.
    //
    // ⚠️ INSTRUMENT — PREMIÈRE VERSION DE CE GARDE : elle isolait le seul
    // corps de `peindreResultat`. Mesuré en remplaçant pour de vrai
    // `textContent` par `innerHTML` : le garde restait VERT. L'écriture ne
    // se fait pas dans `peindreResultat`, elle se fait dans `elem()`, son
    // auxiliaire — qui était HORS de la zone regardée. Un garde qui ne
    // couvre pas la ligne dangereuse ne garde rien.
    //
    // La zone va donc de `elem` à la fin de `peindreResultat` : les trois
    // fonctions qui touchent au DOM d'une résultat, ensemble.
    const peinture = (/function elem\(balise[\s\S]*?\n    \/\/ Le compte n'est PAS un péage/.exec(js) || [""])[0];
    verifier(peinture.length > 500, "le bloc de peinture n'a pas été retrouvé — le garde ci-dessous ne mesure rien");
    verifier(/function elem\(/.test(peinture) && /function peindreResultat\b/.test(peinture),
        "la zone surveillée ne contient plus les deux fonctions qui écrivent dans le DOM");
    verifier(!/innerHTML/.test(peinture),
        "la peinture d'une résultat utilise innerHTML sur des données venues du web — "
        + "une page publique choisirait ce qui s'exécute dans le navigateur du marchand");
    verifier(/rel = "noopener noreferrer"/.test(peinture),
        "les liens d'un résultat s'ouvrent sans rel=noopener — la page ouverte garde la main sur l'onglet");

    // ── LA CLASSE POSÉE EST CELLE QUI EST ÉCOUTÉE ────────────────────────
    //
    // ⚠️ CE GARDE EXISTE PARCE QUE ÇA VIENT D'ARRIVER. La classe du bouton de
    // geste était écrite à deux endroits : celui qui la POSE sur le bouton, et
    // celui qui l'ÉCOUTE dans `closest()`. Un renommage a touché l'un et pas
    // l'autre. Les boutons s'affichaient normalement et ne faisaient rien au
    // clic — aucune erreur, aucun journal, le geste le plus visible du bloc
    // mort en silence. Aucun test de source ne l'a vu : les deux chaînes
    // existaient, elles ne se parlaient plus. C'est le navigateur qui l'a dit.
    //
    // La classe est maintenant une constante unique. Ce garde vérifie qu'elle
    // le reste, et que la feuille de style connaît le même nom — sinon les
    // boutons répondent au clic sans avoir l'allure d'un bouton.
    verifier(/var CLASSE_GESTE = "resultat__geste";/.test(js),
        "la constante qui porte la classe du bouton de geste a disparu ou changé de nom");
    verifier(!/"chip resultat__geste"/.test(peinture) && !/closest\("\.resultat__geste"\)/.test(peinture),
        "la classe du bouton de geste est réécrite en dur au lieu de passer par la constante — "
        + "c'est exactement comme ça qu'elle a divergé");
    const vue = fs.readFileSync(path.join(RACINE, "views", "samii-accueil.ejs"), "utf8");
    verifier(/\.resultat__geste\b/.test(vue),
        "la feuille de style ne connaît pas « resultat__geste » — les boutons de geste "
        + "répondraient au clic sans avoir l'allure d'un bouton");

    // ── LA ROUTE RESTE BRANCHÉE AUX DEUX BOUTS ───────────────────────────
    //
    // La chaîne a trois maillons : le planner garde la sortie de l'outil, la
    // route en fait des résultats, la page les peint. Les deux extrémités sont
    // éprouvées plus haut ; celui du milieu ne s'exécute pas ici (il faut une
    // session et une clé de modèle). On garde donc qu'il existe — un
    // débranchement ne se verrait nulle part ailleurs : la page continuerait
    // d'afficher le texte, et personne ne saurait que les résultats ont disparu.
    const route = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
    verifier(/resultats\.depuisLesActes\(/.test(route),
        "routes/api.js ne construit plus de résultats — la page en attend toujours");
    verifier(/resultats: resultatsDuTour/.test(route),
        "les résultats construites ne sont plus jointes à la réponse");
    verifier(/if \(typeof debit\.solde === "number"\) credits\.solde = debit\.solde;/.test(route),
        "le solde ne repart plus avec la réponse — une résultat ne pourrait plus le montrer");

    // ⚠️ ET LA STRUCTURE BRUTE NE REPART PAS. `...result` emporte `actes`, et
    // depuis ce chantier chaque acte porte ce que l'outil a lu. La route doit
    // recomposer la liste sans `donnees` : sinon des aperçus de boîte mail et
    // des prospects entiers partent au navigateur sans que personne l'ait
    // décidé. Ce garde tient précisément cette ligne-là.
    verifier(/actes: Array\.isArray\(result\.actes\)/.test(route)
        && /\{ nom: a\.nom, reussi: a\.reussi \}/.test(route),
        "routes/api.js renvoie `actes` tel quel — la sortie brute de chaque outil "
        + "part au navigateur avec elle");

    const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    const pushes = (planner.match(/donnees: functionResult/g) || []).length;
    verifier(pushes === 2,
        `${pushes} chemin(s) du planner gardent la sortie de l'outil au lieu de 2 — `
        + "le chemin au fil et le chemin d'un bloc doivent rendre la même résultat, "
        + "sinon la même question donne deux écrans selon le transport");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LA SOURCE DES GESTES EST LE REGISTRE, PAS UNE LISTE RECOPIÉE
// ══════════════════════════════════════════════════════════════════════════
{
    const src = fs.readFileSync(path.join(RACINE, "services", "resultats.js"), "utf8");
    verifier(/AUDIENCES\.outilsDuTour\(/.test(src),
        "services/resultats.js ne passe plus par config/audiences.js pour filtrer les gestes — "
        + "une deuxième table de permissions vient d'apparaître");
    // Tout outil nommé dans un geste doit exister dans le registre. Un nom
    // mal orthographié ferait disparaître le bouton en silence, pour tout le
    // monde, sans que rien ne le signale.
    const connus = new Set(Object.values(NIVEAUX.FAMILLES).flat());
    const nommes = [...src.matchAll(/outil:\s*"([a-z_]+)"/g)].map((m) => m[1]);
    verifier(nommes.length > 0, "aucun geste outillé déclaré — le garde ci-dessous ne mesure rien");
    for (const nom of nommes) {
        verifier(connus.has(nom),
            `un geste appelle « ${nom} », qui n'existe dans aucune famille de config/niveaux.js — `
            + "le bouton disparaîtrait en silence pour tout le monde");
    }
}

if (echecs.length) {
    console.log(`\n❌ Résultats : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ Résultats : ${verifs} vérifications passées`);
