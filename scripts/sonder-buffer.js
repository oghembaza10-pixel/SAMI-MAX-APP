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
                enumValues { name }
                inputFields { ${CHAMPS} }
                fields { ${CHAMPS} }
            }
        }`, { nom });
    if (!r.ok) return { ok: false, erreur: r.erreur };
    const t = r.donnees?.__type;
    if (!t) return { ok: false, erreur: `le type « ${nom} » n'existe pas chez Buffer` };
    return { ok: true, type: t };
}

// ── LE NOM DU TYPE, SOUS SES ENVELOPPES ───────────────────────────────────
//
// `[AssetInput!]!` cache `AssetInput`. Pour aller le décrire, il faut le
// dénuder d'abord.
function typeNu(t) {
    while (t && !t.name) t = t.ofType;
    return t?.name || null;
}

// Les scalaires n'ont rien à décrire — les décrire ferait du bruit et un
// appel réseau pour rien.
const SCALAIRES = new Set(["String", "Boolean", "Int", "Float", "ID", "DateTime"]);

// ── AFFICHER UN TYPE, ET DIRE CE QUI EST OBLIGATOIRE ──────────────────────
//
// Un champ `Type!` sans valeur par défaut DOIT être envoyé. C'est ce qui
// manquait le plus : `assets` et `needsApproval` sont obligatoires et le
// code ne les envoyait pas — `createPost` ne pouvait donc réussir dans
// AUCUN cas, pas même en texte seul.
function afficher(t) {
    if (t.enumValues?.length) {
        console.log(`   (énumération) valeurs acceptées :`);
        for (const v of t.enumValues) console.log(`     • ${v.name}`);
        return [];
    }
    const champs = t.inputFields || t.fields || [];
    const aCreuser = [];
    for (const c of champs) {
        const lisible = typeLisible(c.type);
        const requis = lisible.endsWith("!");
        console.log(`   ${requis ? "◆" : "·"} ${c.name.padEnd(24)} ${lisible}${requis ? "   ← OBLIGATOIRE" : ""}`);
        const nu = typeNu(c.type);
        if (nu && !SCALAIRES.has(nu)) aCreuser.push(nu);
    }
    return aCreuser;
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
    // La question de départ : sous quel nom passe-t-on une image et une
    // vidéo ? Réponse mesurée — ni `imageUrl` ni `videoUrl` n'existent, les
    // deux étaient inventés. Le média passe par `assets: [AssetInput!]!`.
    //
    // Et une découverte plus lourde : `assets` et `needsApproval` sont
    // OBLIGATOIRES. Le code ne les envoyait pas — `createPost` ne pouvait
    // donc réussir dans aucun cas, pas même en texte seul.
    //
    // La sonde descend seule dans les types nommés. La première version
    // s'arrêtait à `[AssetInput!]!` et demandait de relancer : un
    // aller-retour de plus par niveau, et c'est exactement ce qui coûte
    // cher ici. Une commande, la réponse entière.
    titre("CreatePostInput — les champs de la mutation de publication");
    const cpi = await decrire("CreatePostInput");
    if (!cpi.ok) {
        console.log(`   ❌ ${cpi.erreur}`);
    } else {
        const champs = cpi.type.inputFields || [];
        const aCreuser = afficher(cpi.type);
        console.log(`\n   → ${champs.length} champs (◆ = obligatoire).`);

        for (const attendu of ["imageUrl", "videoUrl"]) {
            const existe = champs.some((c) => c.name === attendu);
            console.log(`   ${existe ? "✅" : "❌"} le code envoie « ${attendu} » — ${existe ? "ce champ existe" : "CE CHAMP N'EXISTE PAS"}`);
        }

        // Un seul niveau de profondeur : au-delà, la sortie devient
        // illisible et on ne cherche plus rien de précis.
        const vus = new Set(["CreatePostInput"]);
        for (const nom of aCreuser) {
            if (vus.has(nom)) continue;
            vus.add(nom);
            titre(nom);
            const t = await decrire(nom);
            if (!t.ok) { console.log(`   ❌ ${t.erreur}`); continue; }
            afficher(t.type);
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
        const nu = champ && typeNu(champ.args?.[0]?.type);
        if (nu) {
            titre(`${nu} — le contenu de cet argument`);
            const t = await decrire(nu);
            if (!t.ok) console.log(`   ❌ ${t.erreur}`);
            else afficher(t.type);
        }
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
        else afficher(t.type);
    }

    console.log("\n");
    process.exit(0);
}

main().catch((err) => {
    console.error("\n❌ La sonde Buffer a échoué :", err.message);
    process.exit(1);
});
