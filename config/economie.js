// ==========================================================================
// SAMII OS — L'ÉCONOMIE, ÉCRITE UNE SEULE FOIS
// ==========================================================================
//
// ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ─────────────────────────
//
// IL EST : la seule table qui sache ce qu'un appel d'IA COÛTE, et comment on
// passe de ce coût à des crédits. Prix Google, coefficients, politique de
// marge, classes d'action : tout ici, rien ailleurs.
//
// IL N'EST PAS : le fichier qui facture. `config/credits.js` continue de
// décider ce que le client paie, exactement comme avant ce chantier. Rien
// dans ce fichier n'est branché sur la facturation tant que les mesures
// réelles ne sont pas tombées et que les prix ne sont pas validés.
//
// La distinction compte. Un fichier qui calcule ET qui facture, c'est une
// grille tarifaire qui change toute seule le jour où Google bouge ses prix.
//
// ── LA CHAÎNE ÉCONOMIQUE, DANS L'ORDRE ───────────────────────────────────
//
//   COÛT GOOGLE RÉEL       ce que Google facture, par appel, par token
//          ↓               (mesuré par services/compteurIA.js)
//   COÛT TECHNIQUE SAMII   + infrastructure, + stockage, + recherche
//          ↓
//   POLITIQUE DE MARGE     un multiplicateur déclaré, pas un prix bricolé
//          ↓
//   CRÉDITS CONSOMMÉS      ce que le portefeuille retire
//          ↓
//   PRIX EFFECTIF CLIENT   ce que la personne comprend
//
// On ne saute jamais une marche. « Google coûte X donc le client paie X »
// n'est pas un modèle économique : c'est un compte qui finit à zéro.
// ==========================================================================

// ══════════════════════════════════════════════════════════════════════════
// 1. LES PRIX DE GOOGLE
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CES PRIX SONT DÉCLARÉS, PAS VÉRIFIÉS PAR LE CODE.
//
// `ai.google.dev` est injoignable depuis l'environnement de développement
// (le proxy de sortie refuse le CONNECT). Ils ont été relevés via les
// résumés de recherche, pas lus sur la page officielle. Chaque entrée porte
// donc `verifie: false` tant que personne n'a ouvert la page et confirmé.
//
// Ce drapeau n'est pas décoratif : `coutAppel()` le rend dans son résultat,
// et tout rapport bâti dessus doit dire « estimation ».
//
// Unité : dollars par MILLION de tokens.
const TARIFS = {
    "gemini-3.6-flash": {
        nom: "Gemini 3.6 Flash",
        // Tarif d'introduction, en vigueur jusqu'au 31/12/2026.
        entree: 0.75,
        sortie: 3.75,
        // Les tokens de réflexion sont facturés AU TARIF DE SORTIE. Ce n'est
        // pas un détail : sur un modèle qui réfléchit, ils peuvent peser plus
        // que la réponse elle-même, et ils sont invisibles pour l'utilisateur.
        reflexion: 3.75,
        // ── LECTURE D'UN CACHE DE CONTEXTE ───────────────────────────────
        //
        // ⚠️ CORRIGÉ. La table portait 0.135, ce qui n'est adossé à rien.
        //
        // La règle de Google est une REMISE DE 90 % sur le tarif d'entrée
        // pour les modèles Gemini 2.5 et suivants. Donc :
        //
        //     0,75 × 10 %  =  0,075        (tarif d'introduction)
        //     1,50 × 10 %  =  0,15         (à partir du 01/01/2027)
        //
        // 0,135 ne correspondait ni à 10 % ni à aucune valeur publiée : un
        // chiffre inventé, qui surestimait le cache de 80 % et faussait donc
        // toute comparaison « avec cache / sans cache ».
        cache: 0.075,

        // ── ET CE QUI MANQUAIT COMPLÈTEMENT : LE STOCKAGE ────────────────
        //
        // ⚠️ C'EST LE POSTE QUI RENVERSE LA CONCLUSION DU CHANTIER PRÉCÉDENT.
        //
        // Un cache de contexte ne se paie pas seulement à la lecture. Il se
        // paie AUSSI à l'heure de conservation, sur la totalité des tokens
        // gardés, que quelqu'un s'en serve ou non :
        //
        //     0,50 $ / 1M tokens / HEURE      (jusqu'au 31/12/2026)
        //     1,00 $ / 1M tokens / HEURE      (à partir du 01/01/2027)
        //
        // Le rapport précédent recommandait le cache comme « le levier le
        // plus rentable du projet » en ne comptant que la lecture. Avec le
        // stockage, le cache n'est rentable QUE s'il est relu assez souvent
        // dans l'heure pour amortir sa propre conservation — voir
        // `seuilRentabiliteCache()` plus bas, qui calcule ce seuil au lieu de
        // le supposer.
        cacheStockageParHeure: 0.50,
        // Ce que devient le tarif au 01/01/2027. Gardé ICI, à côté du tarif
        // courant : une hausse de 100 % qui n'est écrite nulle part est une
        // hausse qu'on découvre sur la facture.
        apres2026: { entree: 1.50, sortie: 7.50, reflexion: 7.50, cache: 0.15, cacheStockageParHeure: 1.00 },
        source: "ai.google.dev/gemini-api/docs/pricing",
        releve: "2026-09-14",
        verifie: false,
    },
};

// Le modèle facturé quand le registre des moteurs n'en nomme aucun.
// `config/moteurs.js` reste la seule table qui dit QUEL moteur répond ;
// celle-ci dit seulement ce que ça coûte.
const MODELE_PAR_DEFAUT = "gemini-3.6-flash";

// ── CE QUI SE FACTURE À LA REQUÊTE, PAS AU TOKEN ─────────────────────────
const HORS_TOKENS = {
    // Grounding web natif (`tools: [{google_search:{}}]`), câblé dans dix
    // routes du projet via `chatWithSearch`.
    grounding: { prixParRequete: 0.014, gratuitesParMois: 5000, verifie: false },
};

// ── LES RELAIS ───────────────────────────────────────────────────────────
//
// Groq, OpenRouter (`:free`) et DeepSeek servent de secours. Les deux
// premiers sont gratuits au moment de l'audit, le troisième marginal. Une
// panne Gemini fait donc BAISSER le coût — ce qui veut dire qu'on ne doit
// jamais facturer un tour au tarif Gemini sans savoir qui a répondu.
const TARIFS_RELAIS = {
    groq: { entree: 0, sortie: 0, reflexion: 0, cache: 0, verifie: false, note: "gratuit au moment de l'audit" },
    openrouter: { entree: 0, sortie: 0, reflexion: 0, cache: 0, verifie: false, note: "modèle :free" },
    deepseek: { entree: 0.27, sortie: 1.10, reflexion: 1.10, cache: 0.027, verifie: false },
};

// ══════════════════════════════════════════════════════════════════════════
// 2. LE COÛT D'UN APPEL
// ══════════════════════════════════════════════════════════════════════════
//
// Une fonction pure. Elle ne lit rien, n'écrit rien, ne devine rien : on lui
// donne les tokens RÉELLEMENT rendus par le fournisseur, elle rend des
// dollars. Si les tokens manquent, elle le DIT — elle ne les invente pas.
// ⚠️ LA RÉSOLUTION PAR PRÉFIXE EXISTE PARCE QU'UNE SONDE L'A EXIGÉE.
//
// Google ne renvoie pas le nom qu'on lui a donné. À « gemini-3.6-flash » il
// répond `modelVersion: "gemini-3.6-flash-002"` — la révision qui a servi.
// Or c'est ce nom-là qui détermine la facture, donc c'est lui qu'on doit
// tarifer.
//
// Recherche exacte d'abord, puis le PLUS LONG identifiant déclaré qui soit un
// préfixe. Le plus long, pas le premier : le jour où la table portera
// « gemini-3.6-flash » ET « gemini-3.6-flash-lite », un premier-arrivé
// tariferait le lite au prix du grand.
//
// Une révision inconnue d'un modèle connu est donc tarifée au prix du modèle.
// C'est une approximation, et elle est déclarée : `parPrefixe: true` remonte
// jusqu'au résultat de `coutAppel`.
function tarifDe(modele) {
    const nom = String(modele || "");
    if (TARIFS[nom]) return TARIFS[nom];
    if (TARIFS_RELAIS[nom]) return TARIFS_RELAIS[nom];

    let meilleur = null;
    for (const [id, t] of Object.entries({ ...TARIFS, ...TARIFS_RELAIS })) {
        if (!nom.startsWith(id)) continue;
        if (!meilleur || id.length > meilleur.id.length) meilleur = { id, tarif: t };
    }
    return meilleur ? { ...meilleur.tarif, parPrefixe: true, resoluVers: meilleur.id } : null;
}

function coutAppel({ modele, entree = 0, sortie = 0, reflexion = 0, cache = 0, grounding = 0 } = {}) {
    const t = tarifDe(modele);
    if (!t) {
        // Fermé par défaut, et bruyamment : un modèle dont on ignore le prix
        // ne doit pas passer pour gratuit. C'est ainsi qu'une facture surprend.
        return { usd: null, connu: false, modele, raison: "modèle absent de config/economie.js" };
    }
    const M = 1_000_000;
    // Les tokens de cache sont DÉJÀ comptés dans `entree` par l'API de
    // Google. On les retire donc du plein tarif avant de les recompter au
    // tarif du cache — sinon on les paierait deux fois dans notre calcul.
    const entreePlein = Math.max(0, entree - cache);
    const usd =
        (entreePlein / M) * t.entree +
        (cache / M) * (t.cache || 0) +
        (sortie / M) * t.sortie +
        (reflexion / M) * (t.reflexion ?? t.sortie) +
        grounding * HORS_TOKENS.grounding.prixParRequete;
    return { usd, connu: true, modele, verifie: t.verifie === true,
        parPrefixe: t.parPrefixe === true, resoluVers: t.resoluVers || modele };
}

// ── LE CACHE EST-IL RENTABLE ? ───────────────────────────────────────────
//
// ⚠️ CETTE FONCTION EXISTE PARCE QUE J'AI RECOMMANDÉ LE CACHE SANS L'AVOIR
// CALCULÉ, DANS LE RAPPORT PRÉCÉDENT.
//
// J'avais écrit : « aucun cache de contexte alors que ~17 Ko de prompt
// système sont identiques à chaque appel — c'est le levier le plus rentable
// du projet ». Je ne comptais que la LECTURE à tarif réduit. Le STOCKAGE,
// facturé à l'heure sur la totalité des tokens gardés, ne figurait même pas
// dans la table.
//
// Or un cache rarement relu coûte PLUS CHER que pas de cache du tout : on
// paie sa conservation pendant que personne ne s'en sert.
//
// Le seuil se calcule, il ne se suppose pas :
//
//     économie par relecture = tokens × (tarif_entrée − tarif_cache) / 1M
//     coût de conservation   = tokens × tarif_stockage × heures / 1M
//     seuil = conservation / économie
//
// Rend le nombre MINIMAL de relectures par heure au-delà duquel le cache
// devient gagnant. Ne dépend pas du nombre de tokens : il se simplifie.
function seuilRentabiliteCache(modele = MODELE_PAR_DEFAUT, { apres2026 = false } = {}) {
    const base = TARIFS[modele];
    if (!base) return null;
    const t = apres2026 ? base.apres2026 : base;
    const stockage = t.cacheStockageParHeure;
    if (!stockage) return null;
    const economieParRelecture = t.entree - t.cache;
    if (economieParRelecture <= 0) return null;
    return {
        relecturesParHeure: stockage / economieParRelecture,
        economieParRelecture,
        stockageParHeure: stockage,
        modele,
    };
}

// Le coût d'une ACTION, c'est la somme de TOUS ses appels — jamais « une
// action, un appel ». Mesuré : `preparer_publication` en déclenche sept.
//
// Un appel dont le modèle est inconnu ne vaut pas zéro : il rend le total
// incertain, et `complet: false` le dit à l'appelant.
function coutAction(appels = []) {
    let usd = 0, complet = true, inconnus = [];
    for (const a of appels) {
        const c = coutAppel(a);
        if (!c.connu) { complet = false; inconnus.push(a.modele || "(sans modèle)"); continue; }
        usd += c.usd;
    }
    return { usd, appels: appels.length, complet, inconnus };
}

// ══════════════════════════════════════════════════════════════════════════
// 3. COÛT TECHNIQUE SAMII
// ══════════════════════════════════════════════════════════════════════════
//
// Le coût Google n'est pas le coût de SAMII. Il faut y ajouter ce que la
// plateforme dépense pour porter l'appel : hébergement Render, base de
// données, stockage des pièces jointes, recherches externes.
//
// ⚠️ CES VALEURS SONT DES PLACEHOLDERS DÉCLARÉS, À ZÉRO.
//
// Je ne connais pas les factures Render/Postgres/Cloudinary de ce projet.
// Poser un chiffre plausible serait pire que rien : il traverserait tout le
// raisonnement en prenant l'apparence d'une mesure. Elles restent à zéro,
// `mesure: false`, jusqu'à ce que les vraies factures soient renseignées.
const INFRASTRUCTURE = {
    // Coût d'infrastructure imputé à un appel d'IA (hébergement, base).
    parAppelUSD: 0,
    // Coût de stockage imputé à une pièce jointe traitée.
    parPieceJointeUSD: 0,
    // Recherche Google Custom Search (services/googleSearch.js), quota et
    // prix propres, distincts du grounding natif.
    parRechercheCseUSD: 0,
    mesure: false,
};

function coutTechnique(appels = [], { piecesJointes = 0, recherchesCse = 0 } = {}) {
    const google = coutAction(appels);
    const infra =
        appels.length * INFRASTRUCTURE.parAppelUSD +
        piecesJointes * INFRASTRUCTURE.parPieceJointeUSD +
        recherchesCse * INFRASTRUCTURE.parRechercheCseUSD;
    return {
        google: google.usd,
        infrastructure: infra,
        usd: google.usd + infra,
        complet: google.complet && INFRASTRUCTURE.mesure,
        appels: google.appels,
        inconnus: google.inconnus,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LA POLITIQUE DE MARGE
// ══════════════════════════════════════════════════════════════════════════
//
// Un seul nombre, déclaré à un seul endroit, et qu'on peut discuter.
//
// Pourquoi un multiplicateur et pas une marge en pourcentage : parce que le
// prix de Google peut doubler (il DOIT doubler au 01/01/2027), et qu'un
// multiplicateur suit tout seul. Une marge figée en dollars, non.
//
// Pourquoi il n'est branché sur rien : parce que le décider maintenant,
// avant d'avoir un seul token réel, serait exactement l'erreur que ce
// chantier cherche à éviter.
const MARGE = {
    // Ce par quoi on multiplie le coût technique pour obtenir le prix client.
    // 3 = le client paie trois fois ce que l'appel coûte. Sur des montants
    // de l'ordre du centime, c'est une marge saine sans être prédatrice.
    multiplicateur: 3,
    // En dessous de ce montant, on ne facture rien : le coût de la ligne de
    // ledger dépasserait le montant retiré.
    plancherFacturableUSD: 0.001,
    applique: false,
};

function prixClient(coutTechniqueUSD, { multiplicateur = MARGE.multiplicateur } = {}) {
    if (typeof coutTechniqueUSD !== "number" || !Number.isFinite(coutTechniqueUSD)) return null;
    const brut = coutTechniqueUSD * multiplicateur;
    return brut < MARGE.plancherFacturableUSD ? 0 : brut;
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LES CRÉDITS
// ══════════════════════════════════════════════════════════════════════════
//
// Le portefeuille (services/portefeuille.js) tient une comptabilité en
// DOLLARS, en partie double, idempotente. On ne la remplace pas : le crédit
// est une UNITÉ D'AFFICHAGE posée par-dessus, pas une seconde monnaie.
//
// Deux monnaies dans un même ledger, c'est deux vérités et un jour d'écart
// entre elles. Une seule règle de conversion, ici.
const CREDIT = {
    // 1 crédit = 1 centime de dollar. Choisi pour que « 100 crédits » veuille
    // dire « 1 $ » sans calcul mental, et pour que le plus petit acte
    // facturable reste un entier.
    valeurUSD: 0.01,
    libelle: "crédit",
};

function creditsPour(montantUSD) {
    if (typeof montantUSD !== "number" || !Number.isFinite(montantUSD) || montantUSD <= 0) return 0;
    // On arrondit AU SUPÉRIEUR. Un demi-crédit consommé et arrondi à zéro,
    // répété un million de fois, c'est la plateforme qui paie la différence.
    return Math.ceil(montantUSD / CREDIT.valeurUSD);
}

function usdPourCredits(credits) {
    const n = Number(credits);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n * CREDIT.valeurUSD;
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LES COEFFICIENTS PAR NIVEAU
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ MESURÉ AVANT D'ÉCRIRE CETTE TABLE, ET LE RÉSULTAT EST CONTRE-INTUITIF.
//
// Les quatre niveaux tournent aujourd'hui SUR LE MÊME MODÈLE
// (`gemini-3.6-flash`). `configDeGeneration` ne change que `temperature` et
// `maxOutputTokens` — 1024 / 2048 / 4096 / 8192. Le prix au token est donc
// IDENTIQUE pour Rapide et pour Maître.
//
// Ce qui diffère réellement, c'est :
//   • le PLAFOND de sortie, donc la facture maximale possible ;
//   • les OUTILS ouverts, donc le nombre d'appels que le tour peut déclencher.
//
// Un coefficient « Maître = 8× » serait donc une invention : rien dans la
// mesure ne le soutient. Les coefficients ci-dessous sont posés sur le
// RAPPORT DES PLAFONDS DE SORTIE, la seule chose qui varie vraiment, et ils
// ne sont PAS appliqués (`applique: false`).
//
// Le jour où un niveau tournera sur un modèle plus cher, c'est `TARIFS` qui
// portera la différence — pas un coefficient inventé par-dessus.
const COEFFICIENTS_NIVEAU = {
    rapide: { plafondSortie: 1024, coefficient: 1, note: "même modèle que les autres" },
    expert: { plafondSortie: 2048, coefficient: 2, note: "même modèle, sortie ×2" },
    pro: { plafondSortie: 4096, coefficient: 4, note: "même modèle, sortie ×4, ouvre les chaînes d'agents" },
    maitre: { plafondSortie: 8192, coefficient: 8, note: "même modèle, sortie ×8, ouvre l'exécution de code" },
    applique: false,
};

// ══════════════════════════════════════════════════════════════════════════
// 7. LES CLASSES D'ACTION
// ══════════════════════════════════════════════════════════════════════════
//
// `config/credits.js` facture aujourd'hui DIX actes au même prix
// (`PRIX_ACTE_USD = 0.05`). Mesuré, ils ne coûtent pas la même chose : de
// un appel supplémentaire à sept.
//
// Cette table classe les actes par CONSOMMATION RÉELLE MESURÉE, pas par
// importance ressentie. Elle ne facture rien : elle sert au rapport et aux
// tests, et servira de base quand les prix seront validés.
const CLASSES_ACTION = {
    simple: {
        libelle: "acte simple",
        appelsSupplementaires: 1,
        actes: ["passer_commande", "prendre_rendez_vous", "envoyer_email", "creer_evenement_agenda"],
    },
    outillee: {
        libelle: "acte outillé",
        appelsSupplementaires: 2,
        actes: ["envoyer_facture", "creer_rapport_sheets"],
    },
    recherche: {
        libelle: "acte avec recherche externe",
        appelsSupplementaires: 2,
        // Porte en plus le prix à la requête du grounding et de Custom Search.
        horsTokens: ["grounding", "cse"],
        actes: ["rechercher_prospects"],
    },
    complexe: {
        libelle: "acte complexe",
        appelsSupplementaires: 3,
        actes: ["executer_code"],
    },
    chaine: {
        libelle: "chaîne d'agents",
        appelsSupplementaires: 6,
        actes: ["preparer_publication", "preparer_strategie"],
    },
};

function classeDeLActe(nom) {
    for (const [id, c] of Object.entries(CLASSES_ACTION)) {
        if ((c.actes || []).includes(nom)) return id;
    }
    return null;
}

// ══════════════════════════════════════════════════════════════════════════
// 8. AUTO N'EST PAS UN NIVEAU
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le point le plus important de ce fichier, et celui qu'une table de
// coefficients par niveau ne peut pas exprimer.
//
// Quand quelqu'un choisit « Pro », il achète une PROFONDEUR : un plafond de
// sortie, un jeu d'outils. Le coût est borné par ce qu'il a choisi.
//
// Quand il choisit « Auto », il n'achète pas un modèle — il DÉLÈGUE LA
// DÉCISION. Un même message peut produire une phrase à trois centimes ou
// une chaîne d'agents à sept appels. Le coût n'est plus borné par le choix
// de la personne : il est borné par ce que SAMII décide de faire.
//
// D'où deux conséquences, et une seule est évidente :
//
//   1. Le prix d'Auto ne peut pas être « le prix du niveau retenu ». Ce
//      serait facturer la décision après coup, et le client n'a aucun moyen
//      de la prévoir.
//
//   2. Auto doit porter un PRIX D'ORCHESTRATION — ce que coûte le fait de
//      décider — SÉPARÉ du coût de ce qui a été fait. Sinon deux tours
//      identiques pour l'utilisateur coûteraient dix fois plus l'un que
//      l'autre, sans qu'il comprenne pourquoi.
//
// ── CE QUE LA MESURE DIT AUJOURD'HUI ─────────────────────────────────────
//
// Le choix Auto lui-même est GRATUIT : `services/niveauAuto.choisir()` est un
// classement local par mots-clés, zéro appel d'IA, zéro token. Vérifié.
//
// Et `niveauAuto.doitMonter()` — la fonction qui ferait remonter Auto d'un
// cran après une réponse ratée — N'EST APPELÉE NULLE PART. Auto ne
// ré-essaie donc jamais à un niveau supérieur aujourd'hui. Le pire cas
// d'Auto est donc, à ce jour, le pire cas du niveau qu'il a retenu.
//
// `prixOrchestration` reste à zéro tant que cette fonction morte le reste :
// facturer une orchestration qui n'orchestre rien serait une taxe sur un nom.
const AUTO = {
    estUnNiveau: false,
    choixCouteUnAppelIA: false,
    escaladeActive: false,        // `doitMonter` existe mais n'est jamais appelée
    prixOrchestrationUSD: 0,
    // Ce qu'Auto peut réellement déclencher, du moins cher au plus cher.
    // Sert au rapport : le client doit voir l'étendue, pas un prix unique.
    etendue: [
        { cas: "réponse simple", appels: 2 },
        { cas: "réponse complexe", appels: 2 },
        { cas: "un outil", appels: 3 },
        { cas: "plusieurs outils", appels: 4 },
        { cas: "chaîne d'agents", appels: 7 },
        { cas: "recherche/grounding", appels: 2, horsTokens: ["grounding"] },
        { cas: "pièce jointe", appels: 2, note: "aucun outil sur ce tour, par construction" },
    ],
    applique: false,
};

// ══════════════════════════════════════════════════════════════════════════
// 9. ÉCHEC
// ══════════════════════════════════════════════════════════════════════════
//
// Deux vérités qu'il ne faut jamais confondre :
//
//   • Un acte raté ne se FACTURE PAS. Règle du produit, antérieure à ce
//     chantier, et on n'y touche pas.
//
//   • Un appel raté a quand même COÛTÉ. Google facture les tokens d'un tour
//     dont la réponse n'a servi à rien. « Appel échoué = coût zéro » est
//     faux, et c'est par là que les comptes dérivent sans qu'on le voie.
//
// Le compteur enregistre donc le coût technique de TOUS les appels, réussis
// ou non ; la facturation, elle, ne regarde que les actes réussis.
const ECHEC = {
    facturerLActeRate: false,
    compterLeCoutTechnique: true,
};

// ══════════════════════════════════════════════════════════════════════════
// 10. LE GRATUIT : CE QUI EST ANNONCÉ, ET CE QUE LE CODE FAIT
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ LES DEUX NE DISENT PAS LA MÊME CHOSE, ET L'ÉCART EST DE 50 %.
//
//   règle commerciale annoncée   20 messages / 5 heures
//   code (services/samiiQuota)   20 messages / 5 heures  ← ALIGNÉ
//
// Toute simulation du coût du gratuit se calcule sur ces deux nombres. Se
// tromper de table, c'est se tromper d'un facteur 1,5 sur la facture du
// poste le plus volumineux de la plateforme.
//
// L'écart a été corrigé dans services/samiiQuota.js : le code applique
// désormais la règle annoncée. Les deux nombres restent DÉCLARÉS SÉPARÉMENT,
// et `aligne` reste calculé plutôt qu'écrit en dur : le jour où l'un des deux
// bouge sans l'autre, la divergence redevient visible au lieu de se cacher
// derrière un booléen optimiste. Un test vérifie que cette déclaration suit
// le code, pas l'inverse.
//
// ⚠️ La fenêtre des PALIERS PAYANTS est restée à 7 heures (voir
// FENETRE_PAYANTE_HEURES). Une simulation qui utiliserait heuresCode pour le
// standard ou le pro se tromperait.
// ══════════════════════════════════════════════════════════════════════════
// 11. LES CATÉGORIES D'USAGE — CE QUE LE CLIENT COMPREND
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ ON NE FACTURE PAS « UN NOMBRE D'APPELS GEMINI ».
//
// Personne n'achète des appels d'API. Les gens achètent « envoyer une
// facture », « préparer une publication ». La grille doit donc être lisible
// dans CES mots-là — mais adossée à ce que chaque chose coûte vraiment.
//
// `appels` est MESURÉ, en HTTP réel, lors des chantiers précédents. C'est la
// seule colonne qui ne soit pas une estimation : les dollars dépendent d'un
// ratio octets/token, les appels ont été comptés un par un.
//
// `credits` est une DÉCISION, pas un calcul. Elle vit dans
// `config/credits.js`, qui reste la liste de prix faisant foi. Ce qui est
// écrit ici est le prix RECOMMANDÉ par le modèle de coût ; un test vérifie
// que la décision et la recommandation ne divergent pas silencieusement.
const CATEGORIES = {
    A_conversation: {
        libelle: "Conversation avec un client",
        exemple: "un client écrit à la boutique sur WhatsApp ou Telegram",
        appels: 1, creditsRecommandes: 0,
        // Gratuit, et c'est un choix commercial assumé : c'est le canal
        // d'acquisition du marchand. Il ne paie que les ACTES que la
        // conversation déclenche. Le coût est réel et absorbé.
        pourquoi: "canal d'acquisition du marchand — il paie les actes, pas les mots",
    },
    B_qg: {
        libelle: "Message dans le QG",
        exemple: "le marchand parle à SAMII pour lui-même",
        appels: 2, creditsRecommandes: 3,
        pourquoi: "deux appels mesurés par message ; à 1 crédit il était vendu à perte dès 2027",
    },
    C_acte_simple: {
        libelle: "Acte simple",
        exemple: "enregistrer une commande, poser un rendez-vous, envoyer un e-mail",
        appels: 3, creditsRecommandes: 5,
        actes: ["passer_commande", "prendre_rendez_vous", "envoyer_email", "creer_evenement_agenda"],
        pourquoi: "le prix ne bouge pas — c'est le geste le plus fréquent du produit",
    },
    D_acte_outil: {
        libelle: "Acte outillé",
        exemple: "envoyer une facture, créer un rapport",
        appels: 4, creditsRecommandes: 6,
        actes: ["envoyer_facture", "creer_rapport_sheets"],
        pourquoi: "un appel de plus qu'un acte simple, mesuré",
    },
    E_acte_complexe: {
        libelle: "Acte complexe",
        exemple: "exécuter un programme",
        appels: 4, creditsRecommandes: 7,
        actes: ["executer_code"],
        pourquoi: "même nombre d'appels qu'un acte outillé, plus le bac d'exécution",
    },
    F_chaine: {
        libelle: "Chaîne d'agents / mission",
        exemple: "préparer une publication, construire une stratégie",
        appels: 7, creditsRecommandes: 11,
        actes: ["preparer_publication", "preparer_strategie"],
        pourquoi: "sept appels mesurés ; au prix d'un acte simple, c'était vendu à perte dès 2027",
    },
    G_recherche: {
        libelle: "Recherche web",
        exemple: "trouver des prospects",
        appels: 3, horsTokensUSD: 0.014, creditsRecommandes: 8,
        actes: ["rechercher_prospects"],
        pourquoi: "porte en plus le grounding, facturé à la requête et non au token",
    },
    H_piece_jointe: {
        libelle: "Image ou document",
        exemple: "SAMII lit une photo ou un PDF",
        appels: 2, creditsRecommandes: 4,
        pourquoi: "deux appels, plus les octets de la pièce ; aucun outil sur ce tour par construction",
    },
    I_agent: {
        libelle: "Étape d'agent",
        exemple: "un maillon d'une mission longue",
        appels: 3, creditsRecommandes: 5,
        pourquoi: "facturé à l'étape, jamais au lancement : une mission qui échoue ne coûte pas tout",
    },
};

function categorieDeLActe(nom) {
    for (const [id, c] of Object.entries(CATEGORIES)) {
        if ((c.actes || []).includes(nom)) return id;
    }
    return null;
}

// Ce qu'une catégorie coûte, au tarif d'aujourd'hui ou à celui de 2027.
// ESTIMATION : le nombre d'appels est mesuré, les tokens par appel ne le
// sont pas (aucune clé Gemini dans l'environnement de développement).
const TOKENS_PAR_APPEL_ESTIMES = { entree: 4800, sortie: 180, reflexion: 120 };

function coutCategorie(id, { apres2026 = false, modele = MODELE_PAR_DEFAUT } = {}) {
    const c = CATEGORIES[id];
    const base = TARIFS[modele];
    if (!c || !base) return null;
    const t = apres2026 ? base.apres2026 : base;
    const A = TOKENS_PAR_APPEL_ESTIMES;
    const parAppel = (A.entree / 1e6) * t.entree
        + ((A.sortie + A.reflexion) / 1e6) * (t.sortie);
    return {
        usd: c.appels * parAppel + (c.horsTokensUSD || 0),
        appels: c.appels,
        estimation: true,
        appelsMesures: true,
    };
}

// La marge d'une catégorie, au prix décidé. Rend `null` plutôt qu'un nombre
// quand le prix est nul : une marge sur un prix nul n'a pas de sens, et
// zéro pour cent serait une réponse fausse à une question mal posée.
function margeCategorie(id, creditsDecides, { apres2026 = false } = {}) {
    const k = coutCategorie(id, { apres2026 });
    if (!k) return null;
    const prix = usdPourCredits(creditsDecides);
    if (prix <= 0) return null;
    return { prix, cout: k.usd, marge: prix - k.usd, taux: (prix - k.usd) / prix };
}

const GRATUIT = {
    messagesCible: 20, heuresCible: 5,      // ce qui est annoncé
    messagesCode: 20, heuresCode: 5,        // ce que le code applique
    aligne: true,
    note: "Aligné : le code applique la règle annoncée (20 / 5 h). Les paliers payants gardent leur fenêtre de 7 h — voir FENETRE_PAYANTE_HEURES.",
};

module.exports = {
    TARIFS, TARIFS_RELAIS, HORS_TOKENS, MODELE_PAR_DEFAUT,
    INFRASTRUCTURE, MARGE, CREDIT,
    COEFFICIENTS_NIVEAU, CLASSES_ACTION, AUTO, ECHEC, GRATUIT,
    CATEGORIES, TOKENS_PAR_APPEL_ESTIMES, categorieDeLActe, coutCategorie, margeCategorie,
    tarifDe, coutAppel, coutAction, coutTechnique, seuilRentabiliteCache,
    prixClient, creditsPour, usdPourCredits, classeDeLActe,
};
