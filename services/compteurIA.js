// ==========================================================================
// SAMII OS — CE QU'UN TOUR A RÉELLEMENT COÛTÉ
// ==========================================================================
//
// ── LE PROBLÈME, MESURÉ AVANT D'ÉCRIRE UNE LIGNE ─────────────────────────
//
//   grep -rn "usageMetadata|promptTokenCount|thoughtsTokenCount"  →  ZÉRO
//
// Google renvoie, dans CHAQUE réponse, le compte exact des tokens consommés.
// SAMII le jetait. Conséquence directe : la plateforme ne pouvait pas dire
// ce qu'un message lui coûtait, et toute discussion tarifaire reposait sur
// des tailles de prompt converties en tokens à la louche.
//
// Ce fichier ne change RIEN à ce que SAMII fait. Il lit ce que Google a déjà
// écrit dans la réponse, et l'écrit quelque part.
//
// ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────
//
// Il ne facture pas. Il ne bloque pas. Il n'échoue jamais bruyamment : une
// panne d'écriture du compteur ne doit pas couper une conversation. Un
// instrument qui casse la machine qu'il mesure n'est pas un instrument.
// ==========================================================================

const { AsyncLocalStorage } = require("async_hooks");
const db = require("./db");
const ECO = require("../config/economie");

// ── LE TOUR COURANT ──────────────────────────────────────────────────────
//
// Pourquoi AsyncLocalStorage plutôt qu'un paramètre passé de main en main :
// parce que le chemin entre `planner.ask()` et `axios.post()` traverse huit
// fonctions et trois fichiers. Le faire porter un identifiant de tour aurait
// voulu dire modifier chacune, donc toucher au métier. ALS suit la chaîne de
// promesses toute seule, sans qu'aucune signature ne bouge.
const contexte = new AsyncLocalStorage();

let compteur = 0;
function nouvelIdentifiant() {
    compteur = (compteur + 1) % 1_000_000;
    return `t${Date.now().toString(36)}${compteur.toString(36)}`;
}

// Ouvre un tour. Tout appel d'IA fait à l'intérieur — y compris dans une
// promesse lancée depuis l'intérieur — sera rattaché à ce tour.
function tour(infos, fn) {
    const sac = {
        id: nouvelIdentifiant(),
        debut: Date.now(),
        appels: [],
        ...infos,
    };
    return contexte.run(sac, () => fn(sac));
}

function tourCourant() {
    return contexte.getStore() || null;
}

// ── LIRE CE QUE GOOGLE A DÉJÀ ÉCRIT ──────────────────────────────────────
//
// Les noms de champs sont ceux de l'API Gemini. Deux pièges, tous deux
// vérifiés dans la documentation avant d'être codés :
//
//   • `promptTokenCount` INCLUT déjà `cachedContentTokenCount`. On garde les
//     deux tels quels et c'est `config/economie.js` qui fait la soustraction
//     au moment de calculer — pas ici. L'instrument enregistre ce qu'il voit,
//     il n'interprète pas.
//
//   • `thoughtsTokenCount` n'est PAS inclus dans `candidatesTokenCount`.
//     L'oublier, c'est sous-estimer la sortie d'un modèle qui réfléchit —
//     et la sortie coûte cinq fois l'entrée.
function lireUsageGemini(data) {
    const u = data?.usageMetadata;
    if (!u) return null;
    return {
        entree: Number(u.promptTokenCount) || 0,
        sortie: Number(u.candidatesTokenCount) || 0,
        reflexion: Number(u.thoughtsTokenCount) || 0,
        cache: Number(u.cachedContentTokenCount) || 0,
        outils: Number(u.toolUsePromptTokenCount) || 0,
        total: Number(u.totalTokenCount) || 0,
    };
}

// Les relais parlent le dialecte OpenAI. Même idée, autres noms.
function lireUsageOpenAi(data) {
    const u = data?.usage;
    if (!u) return null;
    return {
        entree: Number(u.prompt_tokens) || 0,
        sortie: Number(u.completion_tokens) || 0,
        reflexion: Number(u.completion_tokens_details?.reasoning_tokens) || 0,
        cache: Number(u.prompt_tokens_details?.cached_tokens) || 0,
        outils: 0,
        total: Number(u.total_tokens) || 0,
    };
}

// ── NOTER UN APPEL ───────────────────────────────────────────────────────
//
// Appelée depuis services/geminiService.js, juste après la réponse. Une
// ligne par appel, et JAMAIS une exception qui remonte : si le compteur
// tombe, la conversation continue.
//
// `usage` absent n'est pas une erreur : une réponse en flux (SSE) ne porte
// pas d'`usageMetadata` dans son en-tête, et un relais peut ne rien rendre.
// On note l'appel quand même, avec `mesure: false` — savoir qu'un appel a eu
// lieu sans connaître son coût vaut mieux que ne pas savoir qu'il a eu lieu.
// ⚠️ LE PARAMÈTRE EST LU DANS LE `try`, PAS DANS LA SIGNATURE.
//
// Première version : `function noter({ fournisseur, ... } = {})`. Le défaut
// `= {}` ne couvre que `undefined` — `noter(null)` déstructurait null et
// levait AVANT d'entrer dans le try. La garde « le compteur ne casse jamais
// la conversation » était donc fausse dans le seul cas où elle compte : une
// entrée abîmée. Trouvé par la suite, pas par la relecture.
function noter(entree) {
    try {
        const { fournisseur, modele, data, flux = false, grounding = 0,
                reussi = true, erreur = null } = entree || {};
        const usage = fournisseur === "gemini" ? lireUsageGemini(data) : lireUsageOpenAi(data);
        const appel = {
            quand: Date.now(),
            fournisseur: fournisseur || "inconnu",
            modele: modele || ECO.MODELE_PAR_DEFAUT,
            flux: flux === true,
            grounding: Number(grounding) || 0,
            reussi: reussi !== false,
            erreur: erreur ? String(erreur).slice(0, 200) : null,
            mesure: Boolean(usage),
            ...(usage || { entree: 0, sortie: 0, reflexion: 0, cache: 0, outils: 0, total: 0 }),
        };
        const cout = ECO.coutAppel({
            modele: appel.modele,
            entree: appel.entree, sortie: appel.sortie,
            reflexion: appel.reflexion, cache: appel.cache,
            grounding: appel.grounding,
        });
        appel.coutUSD = cout.connu ? cout.usd : null;

        const sac = tourCourant();
        if (sac) sac.appels.push(appel);
        else ajouterOrphelin(appel);         // hors tour : on garde quand même, plafonné
        return appel;
    } catch {
        return null;
    }
}

// Les appels faits hors de tout tour ouvert — l'extraction de mémoire, les
// moteurs sociaux, les tâches planifiées. On ne les perd pas : ils comptent
// dans le coût de la plateforme même si personne ne les a demandés. Mesuré :
// l'extraction de mémoire DOUBLE le nombre d'appels de chaque message du QG.
//
// ⚠️ PLAFONNÉ, ET CE PLAFOND N'EST PAS DÉCORATIF.
//
// Première version : un tableau qui grossit et que rien ne vide. En
// production, l'extraction de mémoire produit un orphelin PAR MESSAGE, pour
// toujours. Un instrument qui fait fuir la mémoire du serveur qu'il mesure
// est pire que pas d'instrument du tout.
//
// On garde donc les N derniers, et on compte ce qu'on a laissé tomber : un
// plafond silencieux ferait croire qu'il n'y a jamais eu que N orphelins.
const MAX_ORPHELINS = 500;
const orphelins = [];
let orphelinsPerdus = 0;

function ajouterOrphelin(appel) {
    orphelins.push(appel);
    while (orphelins.length > MAX_ORPHELINS) { orphelins.shift(); orphelinsPerdus++; }
}

function reprendreLesOrphelins() {
    const pris = orphelins.splice(0, orphelins.length);
    const perdus = orphelinsPerdus;
    orphelinsPerdus = 0;
    return { appels: pris, perdus };
}

// ── LE BILAN D'UN TOUR ───────────────────────────────────────────────────
function bilan(sac) {
    const s = sac || tourCourant();
    if (!s) return null;
    const technique = ECO.coutTechnique(s.appels, {
        piecesJointes: s.piecesJointes || 0,
        recherchesCse: s.recherchesCse || 0,
    });
    const mesures = s.appels.filter((a) => a.mesure).length;
    return {
        tourId: s.id,
        etiquette: s.etiquette || null,
        audience: s.audience || null,
        niveau: s.niveau || null,
        auto: s.auto === true,
        appels: s.appels.length,
        appelsMesures: mesures,
        // « complet » veut dire : TOUS les appels ont rendu leurs tokens ET
        // tous les modèles sont tarifés. Sans ça, le total est un plancher,
        // pas un coût — et le rapport doit pouvoir le dire.
        complet: technique.complet && mesures === s.appels.length && s.appels.length > 0,
        tokens: s.appels.reduce((acc, a) => ({
            entree: acc.entree + a.entree,
            sortie: acc.sortie + a.sortie,
            reflexion: acc.reflexion + a.reflexion,
            cache: acc.cache + a.cache,
        }), { entree: 0, sortie: 0, reflexion: 0, cache: 0 }),
        coutGoogleUSD: technique.google,
        coutTechniqueUSD: technique.usd,
        modeles: [...new Set(s.appels.map((a) => a.modele))],
        dureeMs: Date.now() - s.debut,
    };
}

// ── ÉCRIRE ───────────────────────────────────────────────────────────────
//
// Une ligne par TOUR, pas par appel : c'est le tour qui a un sens économique
// (« ce message a coûté tant »), et une ligne par appel ferait grossir la
// table cinq fois plus vite pour la même information. Le détail des appels
// part dans une colonne JSON, lisible quand on en a besoin.
//
// Jamais attendue par l'appelant, jamais bloquante, jamais fatale.
async function enregistrer(sac) {
    try {
        const b = bilan(sac);
        if (!b || !b.appels) return null;
        await db.query(
            `INSERT INTO consommation_ia
               (tour_id, workspace_id, user_id, source, audience, niveau, auto,
                appels, appels_mesures, complet,
                tokens_entree, tokens_sortie, tokens_reflexion, tokens_cache,
                cout_google_usd, cout_technique_usd, modeles, detail, duree_ms)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             ON CONFLICT (tour_id) DO NOTHING`,
            [b.tourId, sac.workspaceId || null, sac.userId || null, sac.source || null,
             b.audience, b.niveau, b.auto,
             b.appels, b.appelsMesures, b.complet,
             b.tokens.entree, b.tokens.sortie, b.tokens.reflexion, b.tokens.cache,
             b.coutGoogleUSD, b.coutTechniqueUSD, JSON.stringify(b.modeles),
             JSON.stringify(sac.appels), b.dureeMs],
        );
        return b;
    } catch (err) {
        console.warn("⚠️ compteurIA : bilan non enregistré —", err.message);
        return null;
    }
}

module.exports = {
    tour, tourCourant, noter, bilan, enregistrer,
    lireUsageGemini, lireUsageOpenAi, reprendreLesOrphelins,
    __test_orphelins: orphelins,
};
