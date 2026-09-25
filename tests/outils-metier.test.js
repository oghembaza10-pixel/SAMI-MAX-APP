// ==========================================================================
// SAMII OS — LES CINQ OUTILS REPRIS DES ANCIENNES PAGES
// ==========================================================================
//
// Douze pages vivaient sous /samii : un formulaire, un prompt, un résultat
// qu'on lisait puis qu'on fermait. Le marchand devait connaître douze
// adresses pour s'en servir — mesuré à l'audit : deux sur douze étaient
// atteignables depuis la conversation.
//
// Cinq outils les reprennent :
//   marche_du_moment      Top Produits + Opportunités (+ le marché)
//   prix_du_marche        Œil Concurrentiel
//   trouver_fournisseur   Chasseur de Stock
//   etat_de_mon_business  Miroir + Oracle Financier
//   historique_client     Mémoire Client
//
// ── CE QUE CETTE SUITE GARDE ─────────────────────────────────────────────
//
//   1. LES PROMPTS SONT CEUX DES PAGES, pas des réécritures. Un prompt
//      reformulé « plus proprement » est un prompt qu'il faut réévaluer.
//   2. CHAQUE OUTIL ANNONCÉ EST RÉELLEMENT EXÉCUTABLE par l'audience
//      concernée — et par elle SEULE.
//   3. AUCUNE DONNÉE FICTIVE. Un bloc n'affiche que ce que l'outil rend.
//   4. AUCUN SYSTÈME PARALLÈLE : un seul registre de familles, un seul
//      constructeur de charge, un seul renderer.
//
// Lancer :  node tests/outils-metier.test.js
// ==========================================================================

const path = require("path");
const fs = require("fs");

const RACINE = path.join(__dirname, "..");
const NIVEAUX = require(path.join(RACINE, "config", "niveaux.js"));
const AUDIENCES = require(path.join(RACINE, "config", "audiences.js"));
const gemini = require(path.join(RACINE, "services", "geminiService.js"));
const resultats = require(path.join(RACINE, "services", "resultats.js"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const CINQ = ["marche_du_moment", "prix_du_marche", "trouver_fournisseur",
    "etat_de_mon_business", "historique_client"];

// ══════════════════════════════════════════════════════════════════════════
// 1. DÉCLARÉS UNE FOIS, AU MÊME ENDROIT QUE LES AUTRES
// ══════════════════════════════════════════════════════════════════════════
//
// Trois fichiers doivent se parler : le registre des familles, la
// déclaration envoyée au modèle, et l'exécution. Un outil qui manque à l'un
// des trois échoue en silence — le modèle ne l'appelle jamais, ou l'appelle
// et tombe sur « fonction inconnue ».
{
    const declares = new Set((gemini.TOOLS[0].functionDeclarations || []).map((f) => f.name));
    const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    for (const outil of CINQ) {
        verifier(NIVEAUX.FAMILLES.lecture.includes(outil),
            `« ${outil} » n'est pas dans la famille « lecture » de config/niveaux.js — `
            + "il ne sera accordé à personne");
        verifier(declares.has(outil),
            `« ${outil} » n'est pas déclaré au modèle — il ne sera jamais appelé`);
        verifier(new RegExp(`case "${outil}":`).test(planner),
            `« ${outil} » n'a pas de branche d'exécution dans le planner — `
            + "le modèle l'appellerait et recevrait « fonction inconnue »");
    }

    // ⚠️ LA FAMILLE N'EST PAS UN DÉTAIL. « lecture » veut dire : ces outils
    // LISENT et ne créent rien. S'ils passaient en « ecriture », ils
    // deviendraient payants à l'acte alors que consulter ses propres
    // chiffres ne crée rien de nouveau — c'est la règle de
    // config/credits.js : « faire payer un supplément pour lire ses propres
    // affaires serait un péage sur sa propre porte ».
    for (const outil of CINQ) {
        for (const famille of ["ecriture", "commerce", "agents", "code"]) {
            verifier(!NIVEAUX.FAMILLES[famille].includes(outil),
                `« ${outil} » est aussi dans la famille « ${famille} » — un outil dans deux `
                + "familles reçoit deux permissions différentes selon le chemin");
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. ⚠️ EXÉCUTABLES PAR L'AUDIENCE CONCERNÉE — ET PAR ELLE SEULE
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le garde central. `historique_client` rend le nom, le téléphone et
// l'historique d'achat d'une personne. Accordé à la mauvaise audience, il
// donne le carnet d'adresses du marchand à n'importe quel client de
// boutique qui sait demander.
//
// On interroge la VRAIE charge (buildToolsPayload), pas une reconstitution.
{
    const charge = (audience, niveau) => {
        // `useTools` recopié de brain/planner.js, à l'identique.
        const p = gemini.__test_buildToolsPayload(
            audience !== "souverain", { audience, niveau, tourDeConversation: true }, "gemini");
        return new Set(p ? (p[0].functionDeclarations || []).map((f) => f.name) : []);
    };

    // LE MARCHAND les tient, à partir du niveau qui porte la lecture.
    for (const niveau of ["expert", "pro", "maitre"]) {
        const tenus = charge("souverain", niveau);
        for (const outil of CINQ) {
            verifier(tenus.has(outil),
                `le marchand au niveau « ${niveau} » ne tient pas « ${outil} » — `
                + "un outil annoncé et non tenu est une promesse creuse");
        }
    }
    // Et sans niveau déclaré (Academy, entraînement) : la table dit
    // lecture + ecriture, donc ils sont tenus aussi.
    const sansNiveau = charge("souverain", null);
    for (const outil of CINQ) {
        verifier(sansNiveau.has(outil),
            `sans niveau déclaré, le marchand ne tient pas « ${outil} »`);
    }

    // « RAPIDE » N'EN TIENT AUCUN, et c'est voulu : un tour censé répondre
    // tout de suite ne part pas dans un appel réseau.
    const rapide = charge("souverain", "rapide");
    for (const outil of CINQ) {
        verifier(!rapide.has(outil),
            `le niveau « rapide » tient « ${outil} » — il ne doit porter aucun outil`);
    }

    // ⚠️ NI LE CLIENT D'UNE BOUTIQUE, NI LE VISITEUR PUBLIC.
    for (const audience of ["client", "public", ""]) {
        const tenus = charge(audience, null);
        for (const outil of CINQ) {
            verifier(!tenus.has(outil),
                `l'audience « ${audience || "(absente)"} » tient « ${outil} » — `
                + (outil === "historique_client"
                    ? "elle lirait le carnet de clients du marchand"
                    : "ces outils lisent les affaires du marchand, pas les siennes"));
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LES PROMPTS SONT CEUX DES PAGES
// ══════════════════════════════════════════════════════════════════════════
//
// On compare des PHRASES CHOISIES, présentes dans la page d'origine et dans
// le planner. Ce ne sont pas des mots au hasard : chacune porte une
// précision qui a été ajoutée après coup et qui se perdrait dans une
// réécriture « plus propre ».
{
    const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    for (const [page, fichier, phrases] of [
        ["Top Produits", "topproduits", [
            "Sois réaliste et honnête dans tes estimations, pas exagéré.",
            "Exactement 5 éléments dans chaque liste.",
        ]],
        ["Opportunités", "opportunites", [
            "Sois honnête : toutes les pistes ne doivent pas avoir un score élevé.",
        ]],
        ["Œil Concurrentiel", "oeilconcurrentiel", [
            "Donne 3 à 5 éléments par liste quand c'est possible. Sois concret.",
            'ne fais pas de verdict de comparaison, mets "verdict": null.',
        ]],
        ["Chasseur de Stock", "chasseurstock", [
            "Sois concret et réaliste dans les estimations de prix.",
            "Utilise la recherche web pour identifier 4 à 6 pistes concrètes",
        ]],
    ]) {
        const source = fs.readFileSync(path.join(RACINE, "routes", `${fichier}.js`), "utf8");
        for (const phrase of phrases) {
            verifier(source.includes(phrase),
                `la page ${page} ne contient plus « ${phrase.slice(0, 40)}… » — `
                + "cette suite compare à la page, elle ne mesure plus rien si la page a changé");
            verifier(planner.includes(phrase),
                `le prompt de ${page} a été réécrit dans le planner : « ${phrase.slice(0, 45)}… » `
                + "a disparu. Un prompt reformulé est un prompt à réévaluer.");
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LES BLOCS N'AFFICHENT QUE CE QUE L'OUTIL A RENDU
// ══════════════════════════════════════════════════════════════════════════
const bloc = (nom, donnees, opts) =>
    resultats.depuisLesActes([{ nom, reussi: true, donnees }],
        opts || { audience: "souverain", niveau: "pro" })[0] || null;

// ── Top Produits ─────────────────────────────────────────────────────────
{
    const c = bloc("marche_du_moment", {
        success: true, marche: "DZ", devise: "DZD",
        du_moment: [{ nom: "Montre connectée", revenu_estime: "150 000 DZD/mois", raison: "Forte demande." }],
        a_venir: [{ nom: "Lampe solaire", revenu_estime: "80 000 DZD/mois", raison: "Coupures fréquentes." }],
        sources: [{ title: "Source", uri: "https://exemple.dz" }],
    });
    verifier(c && c.elements.length === 2, "les deux listes de Top Produits ne sont pas réunies dans le bloc");
    verifier(c && c.elements[0].contact === "150 000 DZD/mois",
        "le revenu estimé n'est pas repris TEL QUEL — c'est une chaîne rendue par l'outil, "
        + "pas un nombre qu'on reformate");
    verifier(c && c.elements[0].valeur === "Maintenant" && c.elements[1].valeur === "Bientôt",
        "la distinction « ce qui marche maintenant » / « bientôt » a disparu du bloc");
    verifier(c && c.liens.length === 1, "les sources web ne sont pas reprises");
}

// ── Opportunités : l'autre forme du MÊME outil ───────────────────────────
{
    const c = bloc("marche_du_moment", {
        success: true, marche: "DZ",
        pistes: [{ nom: "Robes grandes tailles", score: 78, explication: "Peu de concurrence." }],
    });
    verifier(c && c.elements.length === 1, "la forme « pistes » (Opportunités) ne produit pas de bloc");
    verifier(c && c.elements[0].valeur === "78/100",
        "le score n'est pas affiché tel que l'outil le rend");
    // ⚠️ Un score absent ne devient pas « 0 » ni « moyen ». L'outil ne l'a
    // pas rendu : on n'affiche rien.
    const sansScore = bloc("marche_du_moment", { success: true, pistes: [{ nom: "X", explication: "y" }] });
    verifier(sansScore && sansScore.elements[0].valeur === "",
        "une piste sans score reçoit quand même un score dans le bloc — donnée inventée");
}

// ── Œil Concurrentiel ────────────────────────────────────────────────────
{
    const avec = bloc("prix_du_marche", {
        success: true, produit: "montre",
        verdict: { statut: "haut", explication: "20 % au-dessus." },
        comparatif: [{ source: "Jumia", type: "Détail", prix: "8000 DZD" }],
        fournisseurs: [{ nom: "Alibaba", origine: "Chine", prix_gros: "1200 DZD", lien: "https://alibaba.com" }],
    });
    verifier(avec && avec.elements[0].titre === "Ton positionnement",
        "le verdict n'ouvre pas le bloc — c'est pourtant la réponse à la question posée");
    verifier(avec && avec.elements.length === 3, "comparatif et fournisseurs ne sont pas tous repris");

    // ⚠️ SANS PRIX DONNÉ, PAS DE VERDICT. L'outil rend `verdict: null` — le
    // bloc ne doit rien mettre à la place. Un verdict sans point de
    // comparaison serait une opinion déguisée en mesure.
    const sans = bloc("prix_du_marche", {
        success: true, produit: "montre", verdict: null,
        comparatif: [{ source: "Jumia", type: "Détail", prix: "8000 DZD" }], fournisseurs: [],
    });
    verifier(sans && !sans.elements.some((e) => e.titre === "Ton positionnement"),
        "un verdict apparaît alors que le marchand n'a donné aucun prix — "
        + "le bloc invente une comparaison qui n'a pas eu lieu");
}

// ── Chasseur de Stock ────────────────────────────────────────────────────
{
    const c = bloc("trouver_fournisseur", {
        success: true, produit: "montre", region: "chine",
        fournisseurs: [{ plateforme: "1688", description: "Gros volumes.", prix_unitaire: "900-1400 DZD", moq: "50", lien: "https://s.1688.com" }],
    });
    verifier(c && /Minimum : 50/.test(c.elements[0].contact || ""),
        "le minimum de commande n'apparaît pas — un MOQ de 500 et un MOQ de 5 "
        + "ne sont pas la même offre");
    const sansMoq = bloc("trouver_fournisseur", {
        success: true, produit: "x", fournisseurs: [{ plateforme: "P", description: "d", prix_unitaire: "1" }],
    });
    verifier(sansMoq && !sansMoq.elements[0].contact,
        "un fournisseur sans MOQ connu reçoit quand même un minimum — donnée inventée");
}

// ── Miroir + Oracle Financier ────────────────────────────────────────────
{
    const c = bloc("etat_de_mon_business", {
        success: true, total_commandes: 42, confirmees: 30, annulees: 0, enAttente: 7,
        total_revenus: 184500, tauxConfirmation: 71, clientsFideles: 6,
        projection: { revenus30j: 184500, moyenneJournaliere: 6150, projection30j: 184500, joursMesures: 22 },
        sansProjection: null,
    });
    verifier(c && c.forme === "chiffres", "l'état du business n'est pas rendu en chiffres");
    const par = Object.fromEntries((c ? c.elements : []).map((e) => [e.titre, e.valeur]));
    // ⚠️ « 0 annulée » est une information. Un test de vérité le ferait
    // disparaître, et le marchand lirait un bilan qui ment par omission.
    verifier(par["Annulées"] === "0",
        "« 0 annulée » a disparu du bilan — un zéro est une information, pas une absence");
    verifier(par["Taux de confirmation"] === "71 %", "le taux de confirmation n'est pas repris");
    verifier(par["Revenus 30 j"] === "184500" && par["Par jour"] === "6150",
        "la projection de l'Oracle Financier n'est pas reprise dans l'état du business");

    // ⚠️ SON SEUIL EST CONSERVÉ. Sous cinq jours de données, la page
    // d'origine ne projetait RIEN — et l'absence doit être DITE, sinon le
    // marchand croit à un bilan complet.
    const jeune = bloc("etat_de_mon_business", {
        success: true, total_commandes: 3, confirmees: 1, annulees: 0, enAttente: 2,
        total_revenus: 9000, tauxConfirmation: 33, clientsFideles: 0,
        projection: null, sansProjection: "Pas encore assez d'activité pour projeter : 2 jour(s) mesuré(s) sur les 5 nécessaires.",
    });
    verifier(jeune && !jeune.elements.some((e) => /30 j|Par jour/.test(e.titre)),
        "une projection apparaît alors que l'outil n'en a calculé aucune");
    verifier(jeune && jeune.manques.length === 1,
        "l'absence de projection n'est pas dite — « pas de projection » et « projection nulle » "
        + "sonnent pareil et ne veulent pas dire la même chose");
}

// ── Mémoire Client ───────────────────────────────────────────────────────
{
    const c = bloc("historique_client", {
        success: true, nom: "Samira B.", telephone: "0555112233",
        total_commandes: 4, total_depense: 31200, frequence: "~18 jours",
        fidele: true, risque: false, historique: [],
    });
    verifier(c && c.titre === "Samira B.", "le bloc ne porte pas le nom du client");
    const par = Object.fromEntries((c ? c.elements : []).map((e) => [e.titre, e.valeur]));
    verifier(par["Fidèle"] === "oui", "la fidélité n'est pas reprise");
    verifier(par["À surveiller"] === "non", "le signal de risque n'est pas repris");
    verifier(c && c.manques.length === 0, "un client sans risque reçoit quand même un avertissement");

    const risque = bloc("historique_client", {
        success: true, nom: "X", telephone: "055", total_commandes: 1,
        total_depense: 0, frequence: null, fidele: false, risque: true, historique: [],
    });
    verifier(risque && risque.manques.length === 1,
        "un client signalé à risque n'affiche aucun avertissement — c'est le seul moment "
        + "où l'information sert : avant d'expédier");
    // ⚠️ L'HISTORIQUE D'ACHAT NE SORT PAS DANS LE BLOC. L'outil le rend ;
    // le bloc n'en tire que des compteurs. Même règle que les aperçus de
    // boîte mail : ce qui n'est pas affiché ne part pas au navigateur.
    const c2 = bloc("historique_client", {
        success: true, nom: "Y", telephone: "0555", total_commandes: 1, total_depense: 100,
        frequence: null, fidele: false, risque: false,
        historique: [{ produit: "ROBE-SECRETE", date: "2026-01-01", montant: 100 }],
    });
    verifier(c2 && !/ROBE-SECRETE/.test(JSON.stringify(c2)),
        "le détail des achats part dans le bloc — seuls les compteurs devaient sortir");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. CE QUI NE DOIT PRODUIRE AUCUN BLOC
// ══════════════════════════════════════════════════════════════════════════
for (const outil of CINQ) {
    verifier(bloc(outil, { success: false, error: "panne" }) === null,
        `${outil} : une sortie en échec produit quand même un bloc`);
    verifier(bloc(outil, null) === null, `${outil} : une sortie absente produit un bloc`);
    verifier(bloc(outil, { success: true }) === null,
        `${outil} : une sortie vide produit un bloc vide`);
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LES GESTES PROPOSÉS SONT TENABLES
// ══════════════════════════════════════════════════════════════════════════
//
// Les blocs se renvoient la balle : « où je trouve ça ? » sous une liste de
// produits appelle `trouver_fournisseur`. Ces gestes doivent passer le même
// plafond que le reste — sinon on remet un bouton qui ne peut pas aboutir.
{
    const exemples = {
        marche_du_moment: { success: true, marche: "DZ", du_moment: [{ nom: "A", revenu_estime: "1", raison: "r" }], a_venir: [] },
        prix_du_marche: { success: true, produit: "x", verdict: null, comparatif: [{ source: "s", type: "t", prix: "p" }], fournisseurs: [] },
        trouver_fournisseur: { success: true, produit: "x", fournisseurs: [{ plateforme: "p", description: "d", prix_unitaire: "1" }] },
        etat_de_mon_business: { success: true, total_commandes: 1, confirmees: 1, annulees: 0, enAttente: 0, total_revenus: 1, tauxConfirmation: 100, clientsFideles: 0, projection: null, sansProjection: null },
        historique_client: { success: true, nom: "N", telephone: "0", total_commandes: 1, total_depense: 1, frequence: null, fidele: false, risque: false, historique: [] },
    };
    let outilles = 0;
    for (const [audience, niveau] of [["souverain", "expert"], ["souverain", "pro"], ["souverain", "rapide"]]) {
        const possibles = new Set(AUDIENCES.outilsDuTour(audience, niveau));
        for (const outil of CINQ) {
            const c = bloc(outil, exemples[outil], { audience, niveau });
            if (!c) continue;
            for (const g of c.gestes) {
                if (!g.outil) continue;
                outilles++;
                verifier(possibles.has(g.outil),
                    `${outil} / ${audience} · ${niveau} : le bloc propose « ${g.libelle} » qui appelle `
                    + `« ${g.outil} », non tenu à ce niveau — un bouton visible est une promesse`);
            }
        }
    }
    verifier(outilles > 0,
        "aucun geste appelant un outil n'a été rencontré — la boucle ci-dessus ne mesure rien");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. AUCUN SYSTÈME PARALLÈLE
// ══════════════════════════════════════════════════════════════════════════
{
    const planner = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
    const src = fs.readFileSync(path.join(RACINE, "services", "resultats.js"), "utf8");
    // Les cinq passent par le moteur existant, pas par un appel direct neuf.
    verifier((planner.match(/gemini\.chatWithSearch\(/g) || []).length >= 4,
        "les outils de recherche n'appellent plus chatWithSearch — un second chemin vers "
        + "le modèle est apparu");
    verifier(!/require\(["']axios["']\)/.test(src),
        "services/resultats.js appelle le réseau — un adaptateur affiche, il ne va rien chercher");
    verifier(/AUDIENCES\.outilsDuTour\(/.test(src),
        "services/resultats.js ne passe plus par config/audiences.js — une deuxième table "
        + "de permissions vient d'apparaître");
}

if (echecs.length) {
    console.log(`\n❌ Outils métier : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    for (const e of echecs) console.log(`   • ${e}`);
    console.log("");
    process.exit(1);
}
console.log(`✅ Outils métier : ${verifs} vérifications passées (${CINQ.length} outils)`);
