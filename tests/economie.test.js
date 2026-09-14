// ==========================================================================
// SAMII OS — L'ÉCONOMIE : CE QU'UN TOUR COÛTE, ET CE QU'ON EN FAIT
// ==========================================================================
//
// ── CE QUI MANQUAIT, MESURÉ AVANT D'ÉCRIRE UNE LIGNE ─────────────────────
//
//   grep -rn "usageMetadata|promptTokenCount|thoughtsTokenCount"  →  ZÉRO
//
// Google écrit le compte exact des tokens dans CHAQUE réponse. SAMII le
// jetait. La plateforme ne pouvait donc pas dire ce qu'un message lui
// coûtait, et toute la tarification reposait sur deux constantes plates :
// `PRIX_MESSAGE_USD = 0.01` et `PRIX_ACTE_USD = 0.05`, le même prix pour
// dix actes dont la consommation va de un appel à sept.
//
// ── CE QUE CETTE SUITE MESURE ────────────────────────────────────────────
//
// L'INSTRUMENT, pas les prix. Les prix ne sont pas appliqués : ce chantier
// mesure d'abord. Ce qu'on vérifie ici, c'est que la mesure est JUSTE —
// qu'elle additionne tous les appels, qu'elle n'oublie pas les tokens de
// réflexion, qu'elle ne compte pas le cache deux fois, qu'elle dit quand
// elle ne sait pas, et qu'elle ne touche jamais au portefeuille.
//
// Lancer :  node tests/economie.test.js
// ==========================================================================

const ECO = require("../config/economie");
const compteur = require("../services/compteurIA");
const CREDITS = require("../config/credits");
const fs = require("fs");
const path = require("path");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };
const proche = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

(async () => {

// ══════════════════════════════════════════════════════════════════════════
// 1. LE COÛT D'UN APPEL EST CALCULÉ, PAS DEVINÉ
// ══════════════════════════════════════════════════════════════════════════
{
    const M = 1_000_000;
    const t = ECO.TARIFS["gemini-3.6-flash"];

    // Entrée seule.
    const a = ECO.coutAppel({ modele: "gemini-3.6-flash", entree: 1_000_000 });
    verifier(a.connu && proche(a.usd, t.entree),
        `1M tokens d'entrée coûtent ${a.usd} au lieu de ${t.entree}`);

    // ── LES TOKENS DE RÉFLEXION SONT FACTURÉS AU TARIF DE SORTIE ─────────
    //
    // C'est l'oubli le plus cher possible : ils sont invisibles pour
    // l'utilisateur, absents de `candidatesTokenCount`, et facturés cinq
    // fois le prix de l'entrée. Les manquer, c'est sous-estimer chaque tour
    // d'un modèle qui réfléchit.
    const r = ECO.coutAppel({ modele: "gemini-3.6-flash", reflexion: 1_000_000 });
    verifier(r.connu && proche(r.usd, t.reflexion),
        `1M tokens de réflexion coûtent ${r.usd} au lieu de ${t.reflexion} — ` +
        "ils sont facturés au tarif de SORTIE, pas ignorés");
    verifier(t.reflexion === t.sortie,
        "le tarif de réflexion ne suit plus le tarif de sortie dans la table");

    // ── LE CACHE N'EST PAS COMPTÉ DEUX FOIS ──────────────────────────────
    //
    // `promptTokenCount` de Google INCLUT déjà `cachedContentTokenCount`.
    // Additionner les deux au plein tarif ferait payer le cache comme s'il
    // n'existait pas — et rendrait une optimisation plus chère que l'absence
    // d'optimisation.
    const c = ECO.coutAppel({ modele: "gemini-3.6-flash", entree: 1_000_000, cache: 1_000_000 });
    verifier(c.connu && proche(c.usd, t.cache),
        `1M tokens entièrement en cache coûtent ${c.usd} au lieu de ${t.cache} — ` +
        "le cache serait facturé en plus de l'entrée, pas à sa place");
    verifier(c.usd < a.usd,
        "lire depuis le cache coûte plus cher que ne pas l'utiliser : la table est à l'envers");

    // ── UN MODÈLE INCONNU NE VAUT PAS ZÉRO ───────────────────────────────
    const x = ECO.coutAppel({ modele: "un-modele-jamais-declare", entree: 1_000_000 });
    verifier(x.connu === false && x.usd === null,
        `un modèle inconnu est facturé ${x.usd} : un modèle dont on ignore le prix ` +
        "passerait pour gratuit, et c'est ainsi qu'une facture surprend");

    // Le grounding se facture à la REQUÊTE, pas au token.
    const g = ECO.coutAppel({ modele: "gemini-3.6-flash", grounding: 1 });
    verifier(proche(g.usd, ECO.HORS_TOKENS.grounding.prixParRequete),
        `une requête de grounding coûte ${g.usd} au lieu de ${ECO.HORS_TOKENS.grounding.prixParRequete}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 2. UNE ACTION = TOUS SES APPELS, JAMAIS UN SEUL
// ══════════════════════════════════════════════════════════════════════════
//
// C'est le défaut économique central du produit : `preparer_publication` est
// facturé comme un acte alors qu'il en déclenche sept.
{
    const un = { modele: "gemini-3.6-flash", entree: 5000, sortie: 200, reflexion: 100 };
    const seul = ECO.coutAction([un]);
    const sept = ECO.coutAction(Array.from({ length: 7 }, () => ({ ...un })));

    verifier(sept.appels === 7, `la chaîne compte ${sept.appels} appels au lieu de 7`);
    verifier(proche(sept.usd, seul.usd * 7),
        `sept appels coûtent ${sept.usd} au lieu de ${seul.usd * 7} : l'addition est fausse`);
    verifier(sept.usd > seul.usd,
        "une chaîne de sept appels ne coûte pas plus qu'un seul — l'addition ne se fait pas");

    // Un appel dont le modèle est inconnu rend le TOTAL incertain, il ne
    // s'efface pas en silence.
    const trouble = ECO.coutAction([un, { modele: "inconnu", entree: 9999 }]);
    verifier(trouble.complet === false && trouble.inconnus.includes("inconnu"),
        "un appel non tarifé disparaît du total sans que rien ne le signale");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LE COMPTEUR LIT CE QUE GOOGLE ÉCRIT
// ══════════════════════════════════════════════════════════════════════════
{
    const u = compteur.lireUsageGemini({ usageMetadata: {
        promptTokenCount: 4713, candidatesTokenCount: 180,
        thoughtsTokenCount: 120, cachedContentTokenCount: 40,
        toolUsePromptTokenCount: 7, totalTokenCount: 5013,
    } });
    verifier(u && u.entree === 4713 && u.sortie === 180 && u.reflexion === 120 && u.cache === 40 && u.outils === 7,
        `le compteur lit mal usageMetadata : ${JSON.stringify(u)}`);
    verifier(compteur.lireUsageGemini({}) === null,
        "une réponse sans usageMetadata rend un objet au lieu de null : on croirait avoir mesuré zéro");

    // Dialecte OpenAI des relais.
    const o = compteur.lireUsageOpenAi({ usage: {
        prompt_tokens: 1200, completion_tokens: 200, total_tokens: 1400,
        completion_tokens_details: { reasoning_tokens: 50 },
        prompt_tokens_details: { cached_tokens: 100 },
    } });
    verifier(o && o.entree === 1200 && o.sortie === 200 && o.reflexion === 50 && o.cache === 100,
        `le compteur lit mal le format OpenAI : ${JSON.stringify(o)}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 4. UN TOUR ADDITIONNE SES APPELS — ET SEULEMENT LES SIENS
// ══════════════════════════════════════════════════════════════════════════
{
    const reponse = (entree) => ({ usageMetadata: {
        promptTokenCount: entree, candidatesTokenCount: 100,
        thoughtsTokenCount: 50, totalTokenCount: entree + 150,
    } });

    const b = await compteur.tour({ etiquette: "essai", niveau: "pro", audience: "souverain" }, async (sac) => {
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: reponse(1000) });
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: reponse(2000) });
        // Une promesse lancée DEPUIS le tour reste dans le tour : c'est tout
        // l'intérêt d'AsyncLocalStorage, et c'est ce qui permet de compter
        // une chaîne d'agents sans changer une seule signature.
        await new Promise((r) => setTimeout(r, 5));
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: reponse(3000) });
        return compteur.bilan(sac);
    });

    verifier(b.appels === 3, `le tour compte ${b.appels} appels au lieu de 3`);
    verifier(b.tokens.entree === 6000, `entrée cumulée ${b.tokens.entree} au lieu de 6000`);
    verifier(b.tokens.sortie === 300, `sortie cumulée ${b.tokens.sortie} au lieu de 300`);
    verifier(b.tokens.reflexion === 150,
        `réflexion cumulée ${b.tokens.reflexion} au lieu de 150 — les tokens de réflexion ` +
        "sont le coût qu'on oublie");
    verifier(b.appelsMesures === 3, "un appel mesuré n'est pas compté comme tel");

    // Deux tours ne se mélangent pas.
    const t1 = await compteur.tour({ etiquette: "A" }, async (s) => {
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: reponse(111) });
        return compteur.bilan(s);
    });
    const t2 = await compteur.tour({ etiquette: "B" }, async (s) => {
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: reponse(222) });
        return compteur.bilan(s);
    });
    verifier(t1.tokens.entree === 111 && t2.tokens.entree === 222,
        `les tours se mélangent : A=${t1.tokens.entree}, B=${t2.tokens.entree}`);
    verifier(t1.tourId !== t2.tourId, "deux tours portent le même identifiant");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. UN APPEL SANS TOKENS N'EST PAS UN APPEL GRATUIT
// ══════════════════════════════════════════════════════════════════════════
//
// Une réponse en flux (SSE) ne porte pas d'usageMetadata. Compter ce tour
// comme complet ferait passer un coût inconnu pour un coût nul — et c'est
// exactement le genre de zéro qui finit dans une moyenne.
{
    const b = await compteur.tour({ etiquette: "flux" }, async (sac) => {
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: {}, flux: true });
        return compteur.bilan(sac);
    });
    verifier(b.appels === 1, "un appel sans tokens n'est pas compté : on ignorerait qu'il a eu lieu");
    verifier(b.appelsMesures === 0, "un appel sans tokens est compté comme mesuré");
    verifier(b.complet === false,
        "un tour dont aucun appel n'a rendu ses tokens se déclare COMPLET : " +
        "son coût inconnu passerait pour un coût nul dans toutes les moyennes");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. UN ÉCHEC COÛTE QUAND MÊME
// ══════════════════════════════════════════════════════════════════════════
//
// Deux vérités à ne jamais confondre : un acte raté ne se FACTURE pas, mais
// les tokens ont bien été consommés. « Appel échoué = coût zéro » est faux.
{
    verifier(ECO.ECHEC.facturerLActeRate === false,
        "la politique déclare qu'un acte raté se facture : règle produit inversée");
    verifier(ECO.ECHEC.compterLeCoutTechnique === true,
        "la politique déclare qu'un appel raté ne coûte rien — Google facture pourtant ses tokens");

    const b = await compteur.tour({ etiquette: "raté" }, async (sac) => {
        compteur.noter({
            fournisseur: "gemini", modele: "gemini-3.6-flash", reussi: false,
            erreur: "500 chez le fournisseur",
            data: { usageMetadata: { promptTokenCount: 4000, candidatesTokenCount: 0 } },
        });
        return compteur.bilan(sac);
    });
    verifier(b.coutGoogleUSD > 0,
        "un appel raté qui a consommé 4000 tokens d'entrée est compté à zéro");

    // Et la facturation métier, elle, ignore l'acte raté — règle antérieure
    // à ce chantier, qu'on vérifie pour être sûr de ne pas l'avoir bougée.
    const f = CREDITS.factureDuTour([{ nom: "passer_commande", reussi: false }], { avecMessage: false });
    verifier(f.montant === 0,
        `un acte raté est facturé ${f.montant} $ : la règle « on ne facture pas un échec » a bougé`);
}

// ══════════════════════════════════════════════════════════════════════════
// 7. CRÉDITS : UNE SEULE RÈGLE DE CONVERSION
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(ECO.CREDIT.valeurUSD > 0, "un crédit vaut zéro dollar");
    verifier(ECO.creditsPour(1) === Math.ceil(1 / ECO.CREDIT.valeurUSD),
        "la conversion dollars → crédits ne suit pas la table");

    // ── ARRONDI AU SUPÉRIEUR, ET C'EST VOLONTAIRE ────────────────────────
    //
    // Un demi-crédit arrondi à zéro, un million de fois, c'est la plateforme
    // qui paie la différence sans que rien n'apparaisse nulle part.
    verifier(ECO.creditsPour(0.001) >= 1,
        "un montant minuscule est converti en ZÉRO crédit : consommé et jamais retiré");
    verifier(ECO.creditsPour(0) === 0, "zéro dollar donne des crédits");
    verifier(ECO.creditsPour(-5) === 0,
        "un montant NÉGATIF produit des crédits : on pourrait s'en créer en consommant");
    verifier(ECO.creditsPour(NaN) === 0 && ECO.creditsPour("abc") === 0,
        "une valeur illisible produit des crédits");

    // Aller-retour cohérent.
    verifier(proche(ECO.usdPourCredits(100), 100 * ECO.CREDIT.valeurUSD),
        "crédits → dollars ne rend pas ce que dollars → crédits a pris");
    verifier(ECO.usdPourCredits(-3) === 0, "des crédits négatifs valent des dollars");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. MARGE : LE PRIX CLIENT N'EST JAMAIS LE COÛT
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(ECO.MARGE.multiplicateur > 1,
        `le multiplicateur de marge est ${ECO.MARGE.multiplicateur} : SAMII vendrait à prix coûtant ou à perte`);
    const cout = 0.01;
    verifier(proche(ECO.prixClient(cout), cout * ECO.MARGE.multiplicateur),
        "le prix client ne suit pas la politique de marge");
    verifier(ECO.prixClient(cout) > cout,
        "le prix client est inférieur au coût technique");
    verifier(ECO.prixClient(0.0000001) === 0,
        "un montant sous le plancher est quand même facturé : la ligne de ledger coûterait " +
        "plus cher que ce qu'elle retire");
    verifier(ECO.prixClient(null) === null && ECO.prixClient("x") === null,
        "un coût illisible produit un prix au lieu de dire non");
}

// ══════════════════════════════════════════════════════════════════════════
// 9. AUTO N'EST PAS UN NIVEAU, ET C'EST MESURÉ
// ══════════════════════════════════════════════════════════════════════════
{
    verifier(ECO.AUTO.estUnNiveau === false,
        "la table économique traite Auto comme un niveau ordinaire : son coût n'est pas borné " +
        "par le choix du client, il est borné par ce que SAMII décide de faire");

    // Le choix Auto est LOCAL et GRATUIT — vérifié dans le code, pas supposé.
    const auto = require("../services/niveauAuto");
    const src = fs.readFileSync(path.join(__dirname, "..", "services/niveauAuto.js"), "utf8")
        .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    verifier(!/gemini|geminiService|chat\(/.test(src),
        "services/niveauAuto.js appelle une IA pour choisir le niveau : le choix Auto serait " +
        "payant AVANT même d'avoir répondu");
    verifier(ECO.AUTO.choixCouteUnAppelIA === false,
        "la table déclare que le choix Auto coûte un appel, alors que le code est local");

    // Un vrai choix, pour vérifier que la sonde mesure quelque chose.
    const choix = auto.choisir({ message: "Bonjour", palier: "free" });
    verifier(choix && choix.niveau, "niveauAuto.choisir ne rend plus de niveau — la sonde ne mesure rien");

    // ── L'ESCALADE EST DU CODE MORT, ET LA TABLE LE DIT ──────────────────
    //
    // `doitMonter()` ferait remonter Auto d'un cran après un aveu d'échec.
    // Elle existe, elle est exportée, et elle n'est appelée NULLE PART. Tant
    // que c'est vrai, le pire cas d'Auto est celui du niveau qu'il a retenu,
    // et facturer une « orchestration » serait une taxe sur un nom.
    const racine = path.join(__dirname, "..");
    const appelants = [];
    for (const dossier of ["routes", "brain", "services", "engines"]) {
        const dir = path.join(racine, dossier);
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith(".js") || f === "niveauAuto.js") continue;
            const code = fs.readFileSync(path.join(dir, f), "utf8")
                .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
            if (/doitMonter\s*\(/.test(code)) appelants.push(`${dossier}/${f}`);
        }
    }
    verifier((appelants.length > 0) === (ECO.AUTO.escaladeActive === true),
        `l'escalade Auto est ${appelants.length ? "appelée par " + appelants.join(", ") : "morte"}, ` +
        `mais config/economie.js déclare escaladeActive=${ECO.AUTO.escaladeActive} — ` +
        "la table et le code ne disent plus la même chose");
    verifier(ECO.AUTO.prixOrchestrationUSD === 0 || ECO.AUTO.escaladeActive,
        "on facture une orchestration alors qu'aucune orchestration supplémentaire n'a lieu");
}

// ══════════════════════════════════════════════════════════════════════════
// 10. LES COEFFICIENTS NE SONT PAS INVENTÉS
// ══════════════════════════════════════════════════════════════════════════
//
// Mesuré : les quatre niveaux tournent sur le MÊME modèle. Le seul écart
// réel est le plafond de sortie. Un coefficient qui ne s'appuierait pas
// dessus serait un prix sorti de nulle part.
{
    const NIVEAUX = require("../config/niveaux");
    for (const id of NIVEAUX.ORDRE) {
        const coef = ECO.COEFFICIENTS_NIVEAU[id];
        verifier(coef, `le niveau « ${id} » n'a pas de coefficient déclaré`);
        if (!coef) continue;
        const reel = NIVEAUX.niveau(id)?.generationConfig?.maxOutputTokens;
        verifier(coef.plafondSortie === reel,
            `« ${id} » : la table économique dit ${coef.plafondSortie} tokens de sortie, ` +
            `config/niveaux.js en déclare ${reel} — deux tables qui ne disent plus la même chose`);
    }
    const base = ECO.COEFFICIENTS_NIVEAU.rapide;
    for (const id of NIVEAUX.ORDRE) {
        const c = ECO.COEFFICIENTS_NIVEAU[id];
        if (!c) continue;
        verifier(c.coefficient === c.plafondSortie / base.plafondSortie,
            `« ${id} » : coefficient ${c.coefficient} alors que le rapport des plafonds vaut ` +
            `${c.plafondSortie / base.plafondSortie} — le coefficient serait inventé`);
    }
    verifier(ECO.COEFFICIENTS_NIVEAU.applique === false,
        "les coefficients sont APPLIQUÉS alors que les mesures réelles ne sont pas tombées");
}

// ══════════════════════════════════════════════════════════════════════════
// 11. RIEN N'EST BRANCHÉ SUR LA FACTURATION
// ══════════════════════════════════════════════════════════════════════════
//
// Le chantier mesure ; il n'applique pas. Cette garde est la promesse faite
// au propriétaire du produit, écrite en code plutôt qu'en prose.
{
    const racine = path.join(__dirname, "..");
    const sansCommentaires = (f) => fs.readFileSync(path.join(racine, f), "utf8")
        .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    verifier(!/economie/.test(sansCommentaires("config/credits.js")),
        "config/credits.js lit config/economie.js : les nouveaux prix seraient DÉJÀ appliqués");
    verifier(!/economie|compteurIA/.test(sansCommentaires("services/creditsSamii.js")),
        "la facturation lit la table économique : les prix mesurés seraient déjà appliqués");
    verifier(!/economie|compteurIA/.test(sansCommentaires("services/portefeuille.js")),
        "le portefeuille lit l'instrumentation économique");

    // Les prix du produit n'ont pas bougé.
    verifier(CREDITS.PRIX_MESSAGE_USD === 0.01,
        `PRIX_MESSAGE_USD vaut ${CREDITS.PRIX_MESSAGE_USD} au lieu de 0.01 : un prix a été appliqué`);
    verifier(CREDITS.prixActe("preparer_publication") === CREDITS.prixActe("passer_commande"),
        "les prix des actes ont été différenciés alors que le rapport n'est pas validé");

    // Et l'instrument ne touche jamais au portefeuille.
    verifier(!/portefeuille|consommer|deposer/.test(sansCommentaires("services/compteurIA.js")),
        "le compteur touche au portefeuille : un instrument ne doit jamais débiter");

    // ── TOUS LES DRAPEAUX « applique », PAS SEULEMENT CEUX AUXQUELS
    //    J'AI PENSÉ ──────────────────────────────────────────────────────
    //
    // ⚠️ UNE MUTATION A SURVÉCU ICI. Je vérifiais `COEFFICIENTS_NIVEAU.applique`
    // nommément ; basculer `MARGE.applique` à true ne réveillait rien. Une
    // garde qui énumère les cas qu'on a en tête laisse passer le suivant.
    //
    // On balaie donc la table : tout ce qui porte `applique` doit être faux
    // tant que le rapport n'est pas validé — y compris les entrées ajoutées
    // après moi.
    const drapeaux = [
        ["MARGE", ECO.MARGE], ["COEFFICIENTS_NIVEAU", ECO.COEFFICIENTS_NIVEAU],
        ["AUTO", ECO.AUTO], ["INFRASTRUCTURE", ECO.INFRASTRUCTURE],
    ];
    for (const [nom, table] of drapeaux) {
        if (!table || !("applique" in table)) continue;
        verifier(table.applique === false,
            `${nom}.applique vaut ${table.applique} : une politique économique se déclare ` +
            "active alors que les mesures réelles ne sont pas tombées et que rien n'est validé");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 12. LE COMPTEUR NE CASSE JAMAIS LA CONVERSATION
// ══════════════════════════════════════════════════════════════════════════
{
    let leve = false;
    try {
        compteur.noter(null);
        compteur.noter({ fournisseur: "gemini", data: undefined });
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: { usageMetadata: "pas un objet" } });
    } catch { leve = true; }
    verifier(!leve, "le compteur lève une exception sur une entrée abîmée : il couperait une conversation");

    verifier(compteur.bilan(null) === null || typeof compteur.bilan(null) === "object",
        "bilan() hors tour lève au lieu de rendre null");

    // Le plafond des orphelins : un instrument ne fait pas fuir la mémoire
    // du serveur qu'il mesure.
    for (let i = 0; i < 700; i++) {
        compteur.noter({ fournisseur: "gemini", modele: "gemini-3.6-flash", data: { usageMetadata: { promptTokenCount: 1 } } });
    }
    const o = compteur.reprendreLesOrphelins();
    verifier(o.appels.length <= 500,
        `${o.appels.length} orphelins gardés : le tableau grossit sans fin, c'est une fuite mémoire`);
    verifier(o.perdus > 0,
        "des orphelins ont été jetés en silence : on croirait qu'il n'y en a jamais eu plus de 500");
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ économie : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ économie : ${verifs} vérifications passées`);
process.exit(0);

})().catch((err) => {
    console.error("❌ économie : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
