// ==========================================================================
// SAMII OS — Tests des permissions de l'API publique
//
// Pourquoi ces tests-là et pas d'autres : depuis que la plateforme distribue
// des clés à des tiers, une régression ici n'est pas un bug, c'est un
// incident de sécurité chez le client d'une agence. Ce fichier ne cherche
// donc pas la couverture — il verrouille les six règles dont la violation
// coûterait le plus cher.
//
// Aucune base ni réseau : services/db est remplacé par une base simulée, ce
// qui rend la suite exécutable partout, y compris en intégration continue.
//
// Lancer :  npm test
// ==========================================================================
const crypto = require("crypto");
const assert = require("assert");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const empreinte = (c) => crypto.createHash("sha256").update(c).digest("hex");

const CLE = {
    lecture:   "sk_samii_" + "l".repeat(48),
    complete:  "sk_samii_" + "c".repeat(48),
    ancienne:  "sk_samii_" + "a".repeat(48),
    agence:    "sk_samii_" + "g".repeat(48),
    revoquee:  "sk_samii_" + "r".repeat(48),
};

const CLES = [
    { id: 1, cle_hash: empreinte(CLE.lecture),  workspace_id: "WS-1", agence_id: null,
      portees: ["commandes:lire", "espaces:lire"] },
    { id: 2, cle_hash: empreinte(CLE.complete), workspace_id: "WS-1", agence_id: null,
      portees: ["commandes:lire","commandes:ecrire","rendezvous:lire","rendezvous:ecrire","clients:lire","espaces:lire"] },
    // portees NULL = clé créée avant le Policy Engine : elle garde tout.
    { id: 3, cle_hash: empreinte(CLE.ancienne), workspace_id: "WS-1", agence_id: null, portees: null },
    { id: 4, cle_hash: empreinte(CLE.agence),   workspace_id: null,   agence_id: "42",
      portees: ["commandes:lire", "espaces:lire"] },
];

const ESPACES = [
    { id: "WS-1",     nom: "Boutique",  metier: "boutique",   pays: "DZ", devise: "DZD", agence_id: null },
    { id: "WS-CLI",   nom: "Client",    metier: "restaurant", pays: "DZ", devise: "DZD", agence_id: "42" },
    { id: "WS-AUTRE", nom: "Concurrent", metier: "boutique",  pays: "FR", devise: "EUR", agence_id: "99" },
];

function installerBaseSimulee() {
    const faux = {
        query: async (sql, p = []) => {
            const s = sql.replace(/\s+/g, " ").trim();
            if (s.startsWith("SELECT id, workspace_id, agence_id, portees FROM api_cles"))
                return CLES.filter(c => c.cle_hash === p[0]);
            if (s.startsWith("SELECT id FROM workspaces WHERE id = $1 AND agence_id = $2"))
                return ESPACES.filter(w => w.id === p[0] && w.agence_id === p[1]).map(w => ({ id: w.id }));
            if (s.startsWith("SELECT id, nom, metier, pays, devise FROM workspaces WHERE agence_id"))
                return ESPACES.filter(w => w.agence_id === p[0]);
            if (s.startsWith("SELECT id, nom, metier, pays, devise FROM workspaces WHERE id"))
                return ESPACES.filter(w => w.id === p[0]);
            if (s.startsWith("SELECT id, nom, agence_id FROM workspaces"))
                return ESPACES.filter(w => w.id === p[0]).map(w => ({ id: w.id, nom: w.nom, agence_id: w.agence_id }));
            if (s.startsWith("SELECT id, nom_client")) return [];
            if (s.startsWith("SELECT id, client_nom")) return [];
            if (s.startsWith("SELECT nom_client AS nom")) return [];
            if (s.startsWith("INSERT INTO commandes")) return [];
            if (s.startsWith("INSERT INTO rendez_vous")) return [{ id: 1 }];
            if (s.startsWith("SELECT id, url, secret FROM webhooks_sortants")) return [];
            // Écritures accessoires (traces, journal) : sans effet sur les tests.
            return [];
        },
    };
    const r = require.resolve(path.join(RACINE, "services/db"));
    require.cache[r] = { id: r, filename: r, loaded: true, exports: faux };
}

async function demarrerServeur() {
    installerBaseSimulee();
    const express = require(path.join(RACINE, "node_modules/express"));
    const app = express();
    app.use(express.json());
    app.use("/api/v1", require(path.join(RACINE, "routes/api-v1")));
    return new Promise((resolve) => {
        const serveur = app.listen(0, () => resolve({ serveur, port: serveur.address().port }));
    });
}

(async () => {
    const { serveur, port } = await demarrerServeur();
    const base = `http://127.0.0.1:${port}/api/v1`;

    const appel = async (methode, chemin, cle, entetes = {}, corps) => {
        const r = await fetch(base + chemin, {
            method: methode,
            headers: {
                ...(cle ? { Authorization: "Bearer " + cle } : {}),
                "Content-Type": "application/json", ...entetes,
            },
            body: corps ? JSON.stringify(corps) : undefined,
        });
        return { statut: r.status, corps: await r.json() };
    };

    const cas = [];
    const verifier = (titre, obtenu, attendu) => {
        cas.push({ titre, ok: obtenu === attendu, obtenu, attendu });
    };

    // 1. Sans clé valide, rien ne passe.
    verifier("sans clé → 401",
        (await appel("GET", "/moi")).statut, 401);
    verifier("clé inconnue → 401",
        (await appel("GET", "/moi", "sk_samii_inconnue")).statut, 401);

    // 2. Une clé de lecture ne peut pas écrire — c'est toute la promesse
    //    faite au marchand quand il décoche une permission.
    verifier("lecture seule : lire les commandes → 200",
        (await appel("GET", "/commandes", CLE.lecture)).statut, 200);
    verifier("lecture seule : créer une commande → 403",
        (await appel("POST", "/commandes", CLE.lecture, {}, { nomClient: "X" })).statut, 403);
    verifier("lecture seule : lire les clients → 403",
        (await appel("GET", "/clients", CLE.lecture)).statut, 403);

    // 3. Le refus doit nommer ce qui manque, sinon l'intégrateur est aveugle.
    const refus = await appel("POST", "/commandes", CLE.lecture, {}, { nomClient: "X" });
    verifier("le refus nomme la permission manquante",
        refus.corps.porteeRequise, "commandes:ecrire");

    // 4. Une clé complète travaille normalement.
    verifier("clé complète : créer une commande → 201",
        (await appel("POST", "/commandes", CLE.complete, {}, { nomClient: "X" })).statut, 201);

    // 5. Les clés d'avant le Policy Engine ne doivent RIEN perdre : leur
    //    retirer des droits couperait le flux d'un partenaire sans prévenir.
    verifier("clé historique : lire les commandes → 200",
        (await appel("GET", "/commandes", CLE.ancienne)).statut, 200);
    verifier("clé historique : créer un rendez-vous → 201",
        (await appel("POST", "/rendez-vous", CLE.ancienne, {},
            { clientNom: "S", dateRdv: "2026-09-12T14:30:00Z" })).statut, 201);

    // 6. Cloisonnement entre agences — la règle dont la violation serait la
    //    plus grave : les données d'un marchand chez une autre agence.
    verifier("agence sans espace ciblé → 400",
        (await appel("GET", "/commandes", CLE.agence)).statut, 400);
    verifier("agence → son propre client → 200",
        (await appel("GET", "/commandes", CLE.agence, { "X-SAMII-Espace": "WS-CLI" })).statut, 200);
    verifier("agence → client d'une AUTRE agence → 403",
        (await appel("GET", "/commandes", CLE.agence, { "X-SAMII-Espace": "WS-AUTRE" })).statut, 403);
    verifier("agence → espace inexistant → 403",
        (await appel("GET", "/commandes", CLE.agence, { "X-SAMII-Espace": "WS-NEANT" })).statut, 403);

    serveur.close();

    const echecs = cas.filter(c => !c.ok);
    for (const c of cas) {
        console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}` + (c.ok ? "" : `  → obtenu ${c.obtenu}, attendu ${c.attendu}`));
    }
    console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);

    assert.strictEqual(echecs.length, 0, `${echecs.length} test(s) en échec`);
    process.exit(0);
})().catch(err => {
    console.error("\n❌ Suite interrompue :", err.message);
    process.exit(1);
});
