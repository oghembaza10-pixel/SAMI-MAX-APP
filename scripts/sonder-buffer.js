// ==========================================================================
// SONDER LE SCHÉMA DE BUFFER — LIRE AU LIEU DE DEVINER
// ==========================================================================
//
//     node scripts/sonder-buffer.js
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
//
// Deux pannes en production le 3 septembre, la même faute deux fois :
//
//   1. `channels(input:{organizationId: $id})` déclaré `$id: String!`
//      → Variable "$id" of type "String!" used in position expecting
//        type "OrganizationId!"
//
//   2. `createPost(input:{ …, videoUrl })`
//      → Field "videoUrl" is not defined by type "CreatePostInput"
//
// Dans les deux cas j'avais écrit un nom plausible sans lire le schéma.
// Buffer a une introspection GraphQL : la réponse existait, il suffisait de
// la demander. Une heure de production perdue pour une requête jamais
// envoyée.
//
// Ce script pose la question. Il ne publie rien, ne crée rien, ne modifie
// rien — il lit.
//
// À relancer chaque fois qu'on touche à une requête Buffer, AVANT de la
// pousser.

process.env.TZ = process.env.TZ || "Africa/Algiers";

const buffer = require("../engines/social/providers/buffer");

const titre = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 58 - t.length))}`);

// Le type d'un champ GraphQL est un oignon : NON_NULL(LIST(NON_NULL(…))).
// On le déplie en la notation qu'on écrit dans une requête.
function typeLisible(t) {
    if (!t) return "?";
    if (t.kind === "NON_NULL") return `${typeLisible(t.ofType)}!`;
    if (t.kind === "LIST") return `[${typeLisible(t.ofType)}]`;
    return t.name || t.kind;
}

const CHAMPS = `
    name
    type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }
`;

async function decrire(nom) {
    const r = await buffer.interroger(
        `query Decrire($nom: String!) {
            __type(name: $nom) {
                name
                kind
                inputFields { ${CHAMPS} }
                fields { ${CHAMPS} }
            }
        }`, { nom });
    if (!r.ok) return { ok: false, erreur: r.erreur };
    const t = r.donnees?.__type;
    if (!t) return { ok: false, erreur: `le type « ${nom} » n'existe pas chez Buffer` };
    return { ok: true, type: t };
}

async function main() {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   SCHÉMA BUFFER — ce que le serveur accepte VRAIMENT           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    if (!buffer.configure()) {
        console.log("\n❌ BUFFER_ACCESS_TOKEN n'est pas posée — rien à interroger.\n");
        process.exit(1);
    }

    // ── CE QUE `createPost` ACCEPTE ───────────────────────────────────────
    //
    // La question qui compte : sous quel nom passe-t-on une image et une
    // vidéo ? `videoUrl` a été refusé ; `imageUrl` n'a JAMAIS été exercé —
    // toutes les tentatives mouraient avant, sur la requête des chaînes. Il
    // peut être tout aussi inventé.
    titre("CreatePostInput — les champs de la mutation de publication");
    const cpi = await decrire("CreatePostInput");
    if (!cpi.ok) {
        console.log(`   ❌ ${cpi.erreur}`);
    } else {
        const champs = cpi.type.inputFields || [];
        for (const c of champs) console.log(`   ${c.name.padEnd(26)} ${typeLisible(c.type)}`);
        console.log(`\n   → ${champs.length} champs.`);

        const medias = champs.filter((c) => /image|video|media|photo|asset|attach|thumb|url/i.test(c.name));
        console.log("\n   CE QUI RESSEMBLE À DU MÉDIA :");
        if (!medias.length) {
            console.log("   ⚠️ aucun champ média direct — le média passe sans doute par un");
            console.log("      type dédié. Regarder les champs ci-dessus dont le type n'est");
            console.log("      pas scalaire, puis relancer :  node scripts/sonder-buffer.js <NomDuType>");
        } else {
            for (const c of medias) console.log(`   • ${c.name.padEnd(24)} ${typeLisible(c.type)}`);
        }

        for (const attendu of ["imageUrl", "videoUrl"]) {
            const existe = champs.some((c) => c.name === attendu);
            console.log(`   ${existe ? "✅" : "❌"} le code envoie « ${attendu} » — ${existe ? "ce champ existe" : "CE CHAMP N'EXISTE PAS"}`);
        }
    }

    // ── LE TYPE DE L'IDENTIFIANT D'ORGANISATION ───────────────────────────
    titre("channels(input:) — le type attendu pour organizationId");
    const cq = await buffer.interroger(
        `query { __schema { queryType { fields { name args { name type { kind name ofType { kind name } } } } } } }`);
    if (!cq.ok) {
        console.log(`   ❌ ${cq.erreur}`);
    } else {
        const champ = (cq.donnees?.__schema?.queryType?.fields || []).find((f) => f.name === "channels");
        if (!champ) console.log("   ❌ la requête « channels » n'existe plus");
        else for (const a of champ.args) console.log(`   argument ${a.name.padEnd(14)} ${typeLisible(a.type)}`);
        console.log("\n   (le contenu de cet argument se décrit avec :");
        console.log("    node scripts/sonder-buffer.js ChannelsInput )");
    }

    // ── UN TYPE À LA DEMANDE ──────────────────────────────────────────────
    //
    // `node scripts/sonder-buffer.js CreatePostInput` — pour creuser un type
    // nommé dans une des listes ci-dessus sans modifier ce fichier.
    const demande = process.argv[2];
    if (demande) {
        titre(`${demande} — sur demande`);
        const t = await decrire(demande);
        if (!t.ok) console.log(`   ❌ ${t.erreur}`);
        else {
            for (const c of (t.type.inputFields || t.type.fields || [])) {
                console.log(`   ${c.name.padEnd(26)} ${typeLisible(c.type)}`);
            }
        }
    }

    console.log("\n");
    process.exit(0);
}

main().catch((err) => {
    console.error("\n❌ La sonde Buffer a échoué :", err.message);
    process.exit(1);
});
