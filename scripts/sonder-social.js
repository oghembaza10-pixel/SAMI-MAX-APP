// ==========================================================================
// SONDER LES AGENTS SOCIAUX — « POURQUOI SAMII N'A RIEN PUBLIÉ ? »
// ==========================================================================
//
//     node scripts/sonder-social.js
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
//
// Le 3 septembre, SAMII n'avait rien publié nulle part. Sept explications
// étaient plausibles — mode MANUAL, planificateur jamais démarré, Render
// endormi, heure ratée, workspace mal écrit, aucun connecteur, clé d'IA
// absente — et aucune n'était vérifiable sans ouvrir la base.
//
// La réponse était en base, dans UNE ligne de `social_agent_runs` : le cycle
// avait bien tourné, à l'heure, avec le bon workspace ; c'est le créateur
// qui avait échoué, après 103 secondes. Deviner aurait fait corriger six
// choses qui marchaient déjà.
//
// Cette sonde ne conclut pas à votre place. Elle affiche ce qu'elle MESURE,
// dans l'ordre où la chaîne se casse.
//
// Elle ne publie rien et n'écrit rien : on peut la lancer en pleine
// production sans se demander ce qu'elle va déclencher.

// PAS de `require("dotenv")` ici : ce paquet n'est installé nulle part dans
// ce dépôt, et sur Render les variables sont déjà dans `process.env` avant
// que Node démarre. La ligne a fait planter la sonde au premier lancement
// en production — `MODULE_NOT_FOUND` — sur un script censé diagnostiquer.
//
// La même TZ que `index.js`, sinon `SOCIAL_HEURES` serait comparé à UTC et
// la sonde dirait le contraire de ce que fait le serveur.
process.env.TZ = process.env.TZ || "Africa/Algiers";

const db = require("../services/db");

const titre = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 60 - t.length))}`);
const dit = (cle, valeur) => console.log(`   ${String(cle).padEnd(28)} ${valeur}`);

// Une variable d'environnement : présente ou non, jamais sa valeur si elle
// peut être un secret.
function drapeau(nom, { secret = false } = {}) {
    const v = process.env[nom];
    if (!v) return "❌ absente";
    return secret ? `✅ posée (…${String(v).slice(-4)})` : `✅ ${v}`;
}

async function compte(sql, params = []) {
    try {
        const r = await db.query(sql, params);
        return r[0] || {};
    } catch (err) {
        return { erreur: err.message };
    }
}

async function main() {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   SONDE DES AGENTS SOCIAUX — ce qui est mesuré, pas déduit    ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    // ── 1. LES INTERRUPTEURS ──────────────────────────────────────────────
    titre("1. MODE ET INTERRUPTEURS");
    let social, cycle;
    try {
        social = require("../engines/social");
        cycle = require("../engines/social/cycle");
        dit("mode effectif", social.mode());
    } catch (err) {
        dit("mode effectif", `❌ moteur illisible : ${err.message}`);
    }
    dit("SOCIAL_MODE", drapeau("SOCIAL_MODE"));
    dit("SOCIAL_AUTO_CONFIRME", drapeau("SOCIAL_AUTO_CONFIRME"));
    dit("SOCIAL_PUBLICATION_REELLE", drapeau("SOCIAL_PUBLICATION_REELLE"));
    dit("SOCIAL_AGENTS_COUPES", process.env.SOCIAL_AGENTS_COUPES || "(aucun — tous actifs)");
    dit("SOCIAL_WORKSPACE", drapeau("SOCIAL_WORKSPACE"));
    if (process.env.SOCIAL_WORKSPACE && !/^WS-/.test(process.env.SOCIAL_WORKSPACE.trim())) {
        dit("", "⚠️ ne commence pas par « WS- » — les connecteurs ne seront pas trouvés");
    }

    // ── 2. L'HEURE ────────────────────────────────────────────────────────
    //
    // Le piège classique : `SOCIAL_HEURES` est comparé à l'heure LOCALE du
    // serveur (index.js pose TZ=Africa/Algiers), pas à UTC. Croire l'un pour
    // l'autre fait chercher une panne là où il n'y a qu'un décalage.
    titre("2. L'HEURE (le cycle ne prépare qu'aux heures autorisées)");
    const maintenant = new Date();
    dit("TZ du processus", process.env.TZ || "(non posée)");
    dit("heure locale", `${maintenant.getHours()} h (${maintenant.toString().slice(0, 24)})`);
    dit("heure UTC", `${maintenant.getUTCHours()} h`);
    if (cycle) {
        const heures = cycle.heuresAutorisees();
        dit("SOCIAL_HEURES", heures.join(", "));
        dit("maintenant autorisé ?", heures.includes(maintenant.getHours())
            ? "✅ oui — une préparation peut partir à la prochaine minute 5"
            : `⏸️ non — prochaine fenêtre : ${prochaineHeure(heures, maintenant.getHours())} h locale`);
        dit("SOCIAL_MAX_PAR_JOUR", cycle.maxParJour());
        dit("communauté", cycle.communaute());
    }

    // ── 3. LA TRACE — LE SIGNAL DÉCISIF ───────────────────────────────────
    //
    // Zéro ligne  ⇒ le cycle n'a JAMAIS tourné (déploiement, redémarrage,
    //               planificateur non démarré, service endormi).
    // Des lignes  ⇒ il tourne ; l'agent nommé dit où ça casse.
    //
    // C'est la seule question à poser en premier. Tout le reste dépend de
    // sa réponse.
    titre("3. TRACE DES AGENTS (social_agent_runs) — le signal décisif");
    const t = await compte(`SELECT count(*)::int AS n,
                                   max(created_at)::text AS dernier,
                                   min(created_at)::text AS premier
                              FROM social_agent_runs`);
    if (t.erreur) {
        dit("lecture", `❌ ${t.erreur}`);
    } else if (!t.n) {
        dit("exécutions", "0 — ⚠️ LE CYCLE N'A JAMAIS TOURNÉ");
        console.log("      → le planificateur n'est pas démarré, ou le service a redémarré");
        console.log("        à chaque fois avant la fenêtre. Vérifier les 13 tâches au boot.");
    } else {
        dit("exécutions", `${t.n} (de ${t.premier} à ${t.dernier})`);
        const parAgent = await db.query(
            `SELECT agent, statut, count(*)::int AS n, max(created_at)::text AS dernier
               FROM social_agent_runs GROUP BY agent, statut ORDER BY dernier DESC`).catch(() => []);
        for (const l of parAgent) {
            dit(`${l.agent} / ${l.statut}`, `${l.n} — dernier ${l.dernier}`);
        }
        const echecs = await db.query(
            `SELECT agent, created_at::text AS quand, duree_ms, erreur
               FROM social_agent_runs WHERE statut = 'erreur'
              ORDER BY created_at DESC LIMIT 5`).catch(() => []);
        if (echecs.length) {
            console.log("\n   Derniers échecs, mot pour mot :");
            for (const e of echecs) {
                console.log(`   • [${e.quand}] ${e.agent} (${e.duree_ms} ms)`);
                console.log(`     ${e.erreur}`);
                // Une durée longue sur un échec de contenu accuse la chaîne
                // d'IA (relais successifs), pas la rédaction.
                if (Number(e.duree_ms) > 30000) {
                    console.log("     ⏱️ plus de 30 s : ressemble à la chaîne de relais épuisée,");
                    console.log("        pas à un refus immédiat. Voir la section 6.");
                }
            }
        }
    }

    // ── 4. CE QUI A ÉTÉ ÉCRIT, ET CE QUI EST PARTI ────────────────────────
    titre("4. CE QUI EXISTE EN BASE");
    for (const [table, colonne] of [["social_posts", "created_at"],
                                    ["social_post_variants", "created_at"],
                                    ["social_publications", "created_at"]]) {
        const c = await compte(`SELECT count(*)::int AS n, max(${colonne})::text AS dernier FROM ${table}`);
        dit(table, c.erreur ? `❌ ${c.erreur}` : `${c.n} ligne(s)${c.dernier ? ` — dernière ${c.dernier}` : ""}`);
    }
    const pub = await db.query(
        `SELECT plateforme, statut, COALESCE(provider,'?') AS provider, count(*)::int AS n
           FROM social_publications GROUP BY 1,2,3 ORDER BY 1,2`).catch(() => []);
    if (pub.length) {
        console.log("");
        for (const p of pub) dit(`${p.plateforme} / ${p.statut}`, `${p.n} via ${p.provider}`);
    }
    const ratees = await db.query(
        `SELECT plateforme, erreur, created_at::text AS quand FROM social_publications
          WHERE statut <> 'published' AND COALESCE(erreur,'') <> ''
          ORDER BY created_at DESC LIMIT 5`).catch(() => []);
    if (ratees.length) {
        console.log("\n   Publications refusées :");
        for (const r of ratees) console.log(`   • [${r.quand}] ${r.plateforme} — ${r.erreur}`);
    }

    // ── 5. OÙ SAMII PEUT PUBLIER MAINTENANT ───────────────────────────────
    titre("5. LES CIBLES (qui accepterait un contenu là, tout de suite)");
    if (cycle) {
        try {
            const { retenues, ecartees } = await cycle.ciblesDisponibles();
            dit("retenues", retenues.length ? retenues.join(", ") : "❌ aucune");
            for (const e of ecartees) console.log(`   ⛔ ${e}`);
        } catch (err) {
            dit("cibles", `❌ ${err.message}`);
        }
    }

    // ── 6. LA CHAÎNE D'IA — ON L'APPELLE POUR DE VRAI ─────────────────────
    //
    // Un seul appel, minuscule. C'est ce qui distingue « le modèle a mal
    // écrit » de « aucun fournisseur n'a répondu » — les deux produisaient
    // le même message d'erreur avant le 3 septembre.
    titre("6. LA CHAÎNE D'IA (un appel réel, très court)");
    // ── LES NOMS NE SONT PAS DEVINÉS, ILS SONT LUS ────────────────────
    //
    // Cette section affichait « GEMINI_API_KEY ❌ absente » : un nom que
    // j'avais choisi, pas celui que le code lit. La clé payante s'appelle
    // « API_KEY » sur Render — la sonde la déclarait donc absente alors
    // qu'elle était posée. Une sonde qui invente des noms ment.
    //
    // On lit maintenant l'INVENTAIRE que `config.js` a réellement
    // constitué : quel nom de variable a donné quelle clé, et dans quel
    // rang. Aucune clé n'y figure, seulement ses quatre derniers
    // caractères.
    try {
        const CONFIG = require("../config");
        const inv = CONFIG.GEMINI?.INVENTAIRE || [];
        if (!inv.length) {
            dit("clés Gemini", "❌ AUCUNE trouvée — vérifier le nom de la variable sur Render");
        } else {
            dit("clés Gemini", `${inv.length} trouvée(s), essayées dans cet ordre :`);
            inv.forEach((e, i) => dit(`   ${i + 1}. ${e.nom}`, `…${e.empreinte} (${e.rang})`));
            dit("payantes écartées ?", CONFIG.GEMINI.CHEZ_UNE_PARTENAIRE
                ? "✅ oui — service partenaire, la payante reste à la maison"
                : "non — service maison, la payante sert en dernier recours");
        }
    } catch (err) {
        dit("clés Gemini", `❌ config illisible : ${err.message}`);
    }
    dit("GROQ_API_KEY", drapeau("GROQ_API_KEY", { secret: true }));
    dit("OPENROUTER_API_KEY", drapeau("OPENROUTER_API_KEY", { secret: true }));
    dit("DEEPSEEK_API_KEY", drapeau("DEEPSEEK_API_KEY", { secret: true }));
    try {
        const base = require("../engines/social/agents/base");
        const debut = Date.now();
        const r = await base.demander(
            'Réponds UNIQUEMENT ceci, sans rien autour : {"ok":true}',
            { source: "sonde-social" });
        dit("appel", `✅ réponse en ${Date.now() - debut} ms`);
        dit("reçu", `« ${String(r).replace(/\s+/g, " ").slice(0, 120)} »`);
        dit("JSON lisible ?", base.lireJson(r) ? "✅ oui" : "⚠️ non — le créateur échouerait ici");
    } catch (err) {
        dit("appel", `❌ ${err.message}`);
        console.log("      → tant que cette ligne est rouge, AUCUN contenu ne peut être écrit.");
    }

    // ── 7. LE MÉDIA ───────────────────────────────────────────────────────
    titre("7. LE MÉDIA (Instagram refuse une publication sans image)");
    dit("PEXELS_API_KEY", drapeau("PEXELS_API_KEY", { secret: true }));
    try {
        const vitrine = require("../engines/social/vitrine");
        const c = await vitrine.couverture({ communaute: cycle ? cycle.communaute() : null });
        if (c.ok) {
            dit("catalogue", `${c.produits} produit(s), ${c.avecImage} avec image, ${c.avecVideo} avec vidéo`);
            dit("photo possible ?", c.peutPublierPhoto ? "✅ oui" : "❌ non");
            dit("reel depuis catalogue ?", c.peutPublierReel ? "✅ oui" : "❌ non — Pexels est la seule source de vidéo");
        } else {
            dit("catalogue", `❌ ${c.raison}`);
        }
    } catch (err) {
        dit("catalogue", `❌ ${err.message}`);
    }

    // ── 8. LE TEST RÉEL, À LA DEMANDE ─────────────────────────────────────
    //
    //     node scripts/sonder-social.js --forcer
    //
    // `forcer` saute UNIQUEMENT deux garde-fous : le mode MANUAL et
    // l'heure. Le plafond par jour, les campagnes coupées, les agents
    // coupés et le relecteur restent en place — un test qui désarme les
    // protections ne teste pas ce qui tourne en production.
    if (process.argv.includes("--forcer")) {
        titre("8. PRÉPARATION FORCÉE (test réel, maintenant)");
        if (!cycle) {
            dit("préparation", "❌ le cycle n'a pas pu être chargé");
        } else {
            const r = await cycle.preparer({ forcer: true });
            console.log(JSON.stringify(r, null, 2).split("\n").map((l) => `   ${l}`).join("\n"));

            if (r.fait) {
                // Programmé ne veut pas dire parti. On pousse jusqu'au bout,
                // sinon le test s'arrête juste avant la seule étape qui
                // touche vraiment les réseaux.
                titre("9. ENVOI (ce qui est dû part maintenant)");
                const e = await cycle.envoyer();
                console.log(JSON.stringify(e, null, 2).split("\n").map((l) => `   ${l}`).join("\n"));
                console.log("\n   → Va voir les comptes. Puis relance la sonde sans --forcer");
                console.log("     pour lire ce que la base a enregistré.");
            } else {
                console.log("\n   → Rien n'a été préparé. La raison ci-dessus est la vraie :");
                console.log("     elle vient du code qui tourne, pas d'une supposition.");
            }
        }
    } else {
        console.log("\n   💡 Pour tester une publication TOUT DE SUITE, sans attendre 14 h :");
        console.log("      node scripts/sonder-social.js --forcer");
    }

    console.log("\n");
    process.exit(0);
}

function prochaineHeure(heures, h) {
    const suivante = heures.find((x) => x > h);
    return suivante !== undefined ? suivante : `${heures[0]} (demain)`;
}

main().catch((err) => {
    console.error("\n❌ La sonde elle-même a échoué :", err.message);
    process.exit(1);
});
