// ==========================================================================
// SAMII OS — LA BOUCLE : exécuter, lire l'erreur, corriger, réexécuter
// ==========================================================================
//
// CE QUI SÉPARE « SAMII ÉCRIT DU CODE » DE « SAMII RÉSOUT UN PROBLÈME ».
//
// Écrire du code, un modèle sait le faire depuis longtemps. Ce qu'il ne fait
// pas tout seul, c'est LE FAIRE TOURNER, LIRE L'ERREUR, ET RECOMMENCER.
// Sans ce fichier, SAMII rendrait un programme plausible et le marchand
// découvrirait la faute de frappe en le collant quelque part.
//
// ── CE QUE CE FICHIER NE FAIT PAS ────────────────────────────────────────
//
// Il n'écrit pas le premier programme : le modèle l'a déjà mis dans les
// arguments de l'outil. Il ne vérifie aucune permission : la porte est dans
// brain/agents.js et elle est passée avant. Il n'exécute rien lui-même :
// services/bacDExecution.js s'en charge, avec ses murs.
//
// Il tient LA BOUCLE, et rien d'autre. C'est ce qui permet de la lire d'un
// coup d'œil — et de voir tout de suite ce qu'elle coûte.
//
// ── CE QUE CHAQUE TOUR COÛTE ─────────────────────────────────────────────
//
// Un appel d'IA (la correction) plus une exécution. Une boucle sans borne
// sur un bug que le modèle ne sait pas voir, c'est une facture qui monte sans
// fin pour un résultat qui n'arrivera pas. D'où MAX_CORRECTIONS.
// ==========================================================================

const bac = require("./bacDExecution");
const socle = require("../engines/social/agents/base");

// Deux corrections, pas plus. Une faute d'inattention — une virgule, un nom
// de variable, un `await` oublié — se rattrape au premier essai ; le deuxième
// couvre l'enchaînement de deux fautes. Au troisième, le problème n'est plus
// dans le code mais dans la demande, et continuer coûte sans rien apprendre.
const MAX_CORRECTIONS = 2;

// Ce qu'on montre au modèle pour qu'il corrige. Une trace d'erreur complète
// fait des milliers de caractères et noie la ligne qui compte.
const ERREUR_MAX = 1200;

// ── DEMANDER UNE CORRECTION ──────────────────────────────────────────────
//
// On passe par `socle.demander`, le même chemin que tous les autres agents :
// il refuse une non-réponse au lieu de rendre une phrase d'excuse qui
// descendrait la chaîne et ferait accuser le maillon suivant.
//
// LA CONSIGNE EST FERMÉE EXPRÈS. « Rends UNIQUEMENT le programme » : un
// modèle qui explique sa correction avant de la donner produit un fichier
// qui ne s'exécute pas, et l'erreur suivante serait une erreur de syntaxe
// causée par nous.
async function corriger({ code, langage, erreur, but, contexte }) {
    const texte = await socle.demander(
        `Ce programme ${langage} a échoué. Corrige-le.

BUT : ${but || "produire le résultat demandé"}

PROGRAMME :
${code}

ERREUR :
${String(erreur || "").slice(0, ERREUR_MAX)}

Rends UNIQUEMENT le programme corrigé, sans explication, sans balises de code.
Il doit écrire son résultat sur la sortie standard.`,
        { workspaceId: contexte?.workspaceId, source: "boucle-de-code" },
    );
    // Les modèles enrobent leur code dans ```…``` malgré la consigne. Le
    // laisser ferait échouer l'exécution sur une erreur de syntaxe qui vient
    // de nous, pas d'eux.
    return String(texte || "")
        .replace(/^```[a-z]*\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
}

// ══════════════════════════════════════════════════════════════════════════
// RÉSOUDRE
// ══════════════════════════════════════════════════════════════════════════
//
// Rend toujours un objet, ne lève jamais. `essais` raconte chaque tour : ce
// qui a été tenté, ce qui est sorti, pourquoi ça a échoué. C'est ce qui
// permet de dire « j'ai corrigé une fois » au lieu de faire croire que ça a
// marché du premier coup.
async function resoudre(entree = {}, contexte = {}) {
    const langage = String(entree.langage || "javascript").toLowerCase();
    const but = entree.but || "";
    let code = String(entree.code || "");

    const essais = [];

    for (let tour = 0; tour <= MAX_CORRECTIONS; tour++) {
        // Chaque exécution passe par le socle : chronométrée, tracée, et
        // incapable de faire tomber l'appelant en levant. Le coupe-circuit
        // (`SOCIAL_AGENTS_COUPES=executeur`) s'applique donc aussi ici.
        const r = await socle.executer("executeur",
            { workspaceId: contexte.workspaceId, entree: { langage, tour } },
            () => bac.executer({ langage, code, limites: entree.limites || {} }));

        const sortie = String(r.stdout || "").trim();
        essais.push({
            tour: tour + 1,
            ok: Boolean(r.ok),
            refuse: Boolean(r.refuse),
            raison: r.raison || null,
            sortie: sortie.slice(0, 400),
        });

        // ── UN REFUS N'EST PAS UN BUG ────────────────────────────────────
        //
        // « Aucun bac sûr sur cette machine » ne se corrige pas en réécrivant
        // le programme. Corriger ici ferait payer un appel d'IA pour rien, et
        // dirait à la personne que son code est fautif alors que c'est notre
        // machine qui n'est pas prête.
        if (r.refuse) {
            return {
                execute: false, refuse: true, raison: r.raison,
                ecartes: r.ecartes || [], essais, corrections: tour, langage,
                sortie: "", erreur: "",
            };
        }

        if (r.ok) {
            return {
                execute: true, refuse: false,
                sortie, erreur: String(r.stderr || "").trim(),
                corrections: tour, essais, langage,
                bac: r.bac, degrade: Boolean(r.degrade),
                // Dit en clair, parce que ça change ce que SAMII doit
                // répondre : « voilà le résultat » n'est pas « j'ai dû m'y
                // reprendre à deux fois, voilà le résultat ».
                consigne: tour === 0
                    ? "Le programme a tourné du premier coup. Donne son résultat."
                    : `Le programme a échoué ${tour} fois avant d'aboutir. Dis-le, puis donne le résultat.`,
            };
        }

        // Plus de tour disponible : on rend l'échec avec ce qu'on sait.
        if (tour === MAX_CORRECTIONS) break;

        // ── ON NE CORRIGE PAS CE QU'ON N'A PAS LAISSÉ FINIR ──────────────
        //
        // Un programme tué par le temps ou la mémoire n'a pas de message
        // d'erreur à lire : il tournait, simplement trop. Demander une
        // correction sur « arrêté après 10000 ms » fait deviner le modèle, et
        // deviner coûte un appel pour rien. On s'arrête et on le dit.
        if (r.tue) {
            return {
                execute: false, refuse: false,
                raison: r.raison, essais, corrections: tour, langage,
                sortie, erreur: String(r.stderr || "").trim().slice(0, ERREUR_MAX),
                consigne: "Le programme a été arrêté par une limite. Explique laquelle, "
                    + "et propose une approche moins coûteuse — ne redonne pas le même programme.",
            };
        }

        try {
            const corrige = await corriger({
                code, langage, but, contexte,
                erreur: String(r.stderr || r.raison || "").trim(),
            });
            // Un modèle qui rend exactement le même programme ne corrigera
            // pas davantage au tour suivant. On arrête au lieu de payer deux
            // exécutions identiques.
            if (!corrige || corrige === code) {
                essais.push({ tour: tour + 1, ok: false, raison: "la correction n'a rien changé" });
                break;
            }
            code = corrige;
        } catch (err) {
            // Le moteur n'a pas répondu : ce n'est pas un échec du programme.
            essais.push({ tour: tour + 1, ok: false, raison: `correction impossible : ${err.message}` });
            break;
        }
    }

    const dernier = essais[essais.length - 1] || {};
    return {
        execute: false, refuse: false,
        raison: dernier.raison || "le programme n'a pas abouti",
        sortie: dernier.sortie || "",
        erreur: "",
        corrections: Math.max(0, essais.length - 1),
        essais, langage,
        consigne: "Le programme n'a pas abouti. Dis ce qui bloque, sans prétendre avoir un résultat.",
    };
}

module.exports = { resoudre, MAX_CORRECTIONS };
