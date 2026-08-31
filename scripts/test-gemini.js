// ==========================================================================
// SAMII OS — État réel des clés Gemini
//
// CE QUE CE SCRIPT DISAIT DE FAUX.
//
// Son ancien commentaire annonçait : « chaque clé a son propre quota
// gratuit, donc les tester une par une ne consomme quasiment rien ». Les
// deux moitiés de la phrase sont fausses, et elles se renforçaient.
//
// Il testait chaque clé en DEMANDANT UNE GÉNÉRATION — l'opération la plus
// chère en quota. Or le plafond gratuit (« generate_content_free_tier_
// requests, limit: 20 ») se compte PAR PROJET GOOGLE, pas par clé. Dix-sept
// clés réparties sur trois projets, ce sont trois compteurs de 20, pas
// dix-sept.
//
// Résultat : le script tirait dix-sept générations d'affilée dans quelques
// compteurs partagés, épuisait lui-même ce qu'il prétendait mesurer, et
// rendait un verdict différent à chaque exécution. Une fois 15/17, dix
// minutes plus tard 4/17, sans qu'une seule clé ait changé. On a cru à des
// clés mortes ; il n'y en avait aucune.
//
// CE QU'IL FAIT MAINTENANT. Il demande la LISTE DES MODÈLES
// (GET /v1beta/models). Cet appel prouve exactement ce qu'on veut savoir —
// la clé existe, elle est active, l'API est ouverte sur son projet — sans
// toucher au quota de génération. On peut le lancer dix fois de suite sans
// abîmer la mesure ni priver les clients d'une seule réponse.
//
// Et il distingue enfin les trois états qu'on confondait :
//   VALIDE          — la clé marche.
//   INVALIDE        — révoquée, supprimée, API non activée. À retirer.
//   QUOTA ATTEINT   — la clé est bonne, son PROJET est saturé maintenant.
//
// Usage :  node scripts/test-gemini.js
//          node scripts/test-gemini.js --generation   (teste aussi une vraie
//          génération sur la première clé valide — consomme 1 requête)
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");

const MODEL = "gemini-3.6-flash";
const PAYANTES = new Set(CONFIG.GEMINI.PAYANTES || []);

const VALIDE = "valide";
const INVALIDE = "invalide";
const QUOTA = "quota";

// Un appel qui ne consomme pas le quota de génération : il demande seulement
// ce que la clé a le droit de voir.
async function etatDeLaCle(key) {
    try {
        const r = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`,
            { timeout: 15000 },
        );
        return { etat: VALIDE, detail: r.data?.models?.length ? "" : "aucun modèle listé" };
    } catch (err) {
        const statut = err.response?.status;
        const message = String(err.response?.data?.error?.message || err.message);
        if (statut === 429) return { etat: QUOTA, detail: message };
        if (statut === 400 || statut === 403) return { etat: INVALIDE, detail: message };
        // Panne réseau, coupure : ce n'est pas un verdict sur la clé, et le
        // dire serait pire que se taire — on ferait supprimer une clé saine.
        return { etat: "indéterminé", detail: message };
    }
}

// Le plafond que Google annonce dans son refus. Deux clés qui affichent le
// même plafond ET tombent ensemble partagent très probablement un projet.
function plafondAnnonce(detail) {
    const m = /limit:\s*(\d+)/.exec(detail || "");
    return m ? Number(m[1]) : null;
}

async function main() {
    const keys = CONFIG.GEMINI.API_KEYS;
    const gratuites = keys.filter((k) => !PAYANTES.has(k));

    console.log(`── ${keys.length} clé(s) Gemini détectée(s) sur Render ──`);
    console.log(`   ${gratuites.length} gratuite(s), ${keys.length - gratuites.length} payante(s)\n`);
    if (keys.length === 0) {
        throw new Error("Aucune clé Gemini détectée. Vérifie le NOM de la variable sur Render.");
    }

    const compte = { [VALIDE]: 0, [INVALIDE]: 0, [QUOTA]: 0, "indéterminé": 0 };
    const aRetirer = [];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const label = `Clé #${String(i + 1).padStart(2)} (…${key.slice(-4)})${PAYANTES.has(key) ? " [PAYANTE]" : ""}`;
        const { etat, detail } = await etatDeLaCle(key);
        compte[etat] = (compte[etat] || 0) + 1;

        if (etat === VALIDE) {
            console.log(`✅ ${label} — valide${detail ? ` (${detail})` : ""}`);
        } else if (etat === QUOTA) {
            const p = plafondAnnonce(detail);
            console.log(`🟡 ${label} — la clé est BONNE, son projet est saturé${p ? ` (plafond ${p}/min)` : ""}`);
        } else if (etat === INVALIDE) {
            aRetirer.push(`#${i + 1} (…${key.slice(-4)})`);
            console.log(`❌ ${label} — INVALIDE, à retirer de Render : ${detail.slice(0, 120)}`);
        } else {
            console.log(`⚪ ${label} — indéterminé (réseau ?) : ${detail.slice(0, 120)}`);
        }
    }

    console.log(`\n──────────────────────────────`);
    console.log(`${compte[VALIDE]} valide(s) · ${compte[QUOTA]} en quota · ${compte[INVALIDE]} à retirer · ${compte["indéterminé"]} indéterminée(s)`);

    if (aRetirer.length) {
        // Ce conseil disait « à supprimer de Render », sec. Il a désigné
        // GOOGLE_API_KEY — qui sert au Custom Search et à YouTube, et que ce
        // script n'avait aucun titre à faire supprimer. Un outil de
        // diagnostic qui donne un ordre doit dire ce qu'il ignore : il voit
        // qu'une clé ne parle pas à Gemini, il ne voit pas à quoi d'autre
        // elle sert.
        console.log(`\n🧹 Ces clés ne répondent pas à Gemini : ${aRetirer.join(", ")}`);
        console.log(`   Le code les saute déjà ; chacune coûte un aller-retour avant de passer la main.`);
        console.log(`   AVANT DE SUPPRIMER : vérifie à quoi sert la variable. Une clé Google`);
        console.log(`   peut être parfaitement valide pour un AUTRE service (Custom Search,`);
        console.log(`   YouTube, Maps) et n'échouer ici que parce que l'API Gemini n'est pas`);
        console.log(`   activée sur son projet. La retirer casserait ce service-là.`);
    }

    // ── CE QUI COMPTE VRAIMENT : COMBIEN DE COMPTEURS, PAS COMBIEN DE CLÉS ──
    if (compte[QUOTA] > 1) {
        console.log(`\n⚠️  ${compte[QUOTA]} clés annoncent un quota dépassé EN MÊME TEMPS.`);
        console.log(`   Le plafond gratuit se compte PAR PROJET GOOGLE, pas par clé.`);
        console.log(`   Des clés qui saturent ensemble partagent le même projet — et donc`);
        console.log(`   le même compteur. En ajouter d'autres dans ce projet n'ajoute rien.`);
        console.log(`   Pour vraiment doubler le quota : un NOUVEAU projet Google, ou la`);
        console.log(`   facturation activée sur celui-ci.`);
    }

    if (!process.argv.includes("--generation")) {
        console.log(`\nℹ️  Aucune génération n'a été demandée : ce contrôle ne consomme pas`);
        console.log(`   le quota des clients. Ajoute --generation pour tester en plus une`);
        console.log(`   vraie réponse (coût : 1 requête).`);
        return;
    }

    // Une seule génération, sur la première clé valide : de quoi confirmer
    // que le modèle répond, sans refaire le gâchis d'avant.
    console.log(`\n── Test de génération (1 requête) ──`);
    for (let i = 0; i < keys.length; i++) {
        const { etat } = await etatDeLaCle(keys[i]);
        if (etat !== VALIDE) continue;
        try {
            const r = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${keys[i]}`,
                { contents: [{ role: "user", parts: [{ text: 'Réponds juste "ok".' }] }] },
                { timeout: 30000 },
            );
            const texte = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || "(vide)";
            console.log(`✅ Clé #${i + 1} génère : ${String(texte).trim().slice(0, 40)}`);
        } catch (err) {
            console.log(`❌ Clé #${i + 1} ne génère pas : ${err.response?.data?.error?.message || err.message}`);
        }
        return;
    }
    console.log("Aucune clé valide pour tester la génération.");
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
