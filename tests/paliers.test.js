// ==========================================================================
// SAMII OS — Tests des paliers d'abonnement
//
// Pourquoi ces tests-là. Depuis que la page d'accueil annonce ce que chaque
// palier contient, une règle qui bouge sans qu'on s'en aperçoive n'est plus
// un détail technique : c'est une promesse commerciale qui devient fausse.
// Trois choses doivent rester vraies, et ce fichier les verrouille :
//   1. un seul prix par palier, lu au même endroit par la vitrine et la caisse ;
//   2. le nombre de canaux vendu est bien celui qui est appliqué ;
//   3. ce qui est annoncé au palier Souverain (API, publication quotidienne)
//      ne s'ouvre pas en dessous.
//
// Aucune base ni réseau : la base est simulée, comme dans permissions.test.js.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const paliers = require(path.join(RACINE, "config/paliers"));

// Base simulée : une seule table `workspaces`, un palier par espace.
const ESPACES = {
    "WS-FREE": "free",
    "WS-ACTIF": "standard",
    "WS-SOUVERAIN": "pro",
};
let CONNECTEURS = [];

// À qui appartient chaque espace. Sert au seul cas qui compte ici : un compte
// fondateur ne doit pas être arrêté par le quota de canaux — c'est ce qui a
// empêché le fondateur de brancher son propre WhatsApp sur sa propre
// plateforme, parce qu'un second endroit du code relisait palier_abonnement
// au lieu de passer par abonnementService.
const PROPRIETAIRES = {
    "WS-FONDATEUR": "oghembaza10@gmail.com",
};
ESPACES["WS-FONDATEUR"] = "free";

function installerBaseSimulee() {
    const faux = {
        query: async (sql, p = []) => {
            const s = sql.replace(/\s+/g, " ").trim();
            // Le quota vérifie d'abord que l'espace existe, puis demande son
            // palier à abonnementService — qui lit aussi le propriétaire, car
            // c'est lui qui connaît les comptes fondateurs.
            if (s.startsWith("SELECT id FROM workspaces")) {
                return ESPACES[p[0]] ? [{ id: p[0] }] : [];
            }
            if (s.startsWith("SELECT palier_abonnement, owner, owner_email FROM workspaces")
                || s.startsWith("SELECT palier_abonnement FROM workspaces")) {
                const palier = ESPACES[p[0]];
                if (!palier) return [];
                const email = PROPRIETAIRES[p[0]] || "marchand@exemple.com";
                return [{ palier_abonnement: palier, owner: email, owner_email: email }];
            }
            if (s.startsWith("SELECT * FROM connecteurs WHERE workspace_id = $1 ORDER BY")) {
                return CONNECTEURS.filter(c => c.workspace_id === p[0]);
            }
            return [];
        },
    };
    const r = require.resolve(path.join(RACINE, "services/db"));
    require.cache[r] = { id: r, filename: r, loaded: true, exports: faux };
}

installerBaseSimulee();
const connectorService = require(path.join(RACINE, "services/connectorService"));

const cas = [];
const verifier = (titre, obtenu, attendu) => {
    const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
    cas.push({ titre, ok, obtenu, attendu });
};

(async () => {
    // 1. Les prix : un seul chiffre, et jamais de prix sur un palier qui ne
    //    s'achète pas en ligne (Société se négocie, Découverte est gratuit).
    verifier("les paliers achetables sont Actif et Souverain",
        paliers.PAYANTS, ["standard", "pro"]);
    verifier("Découverte n'a pas de prix à encaisser",
        paliers.prixUSD("free"), null);
    verifier("Société est sur devis, pas de prix à encaisser",
        paliers.prixUSD("societe"), null);
    verifier("Actif coûte moins cher que Souverain",
        paliers.prixUSD("standard") < paliers.prixUSD("pro"), true);

    // 2. Les canaux vendus sont ceux qui sont appliqués.
    verifier("Découverte : 1 canal", paliers.canauxMax("free"), 1);
    verifier("Actif : 3 canaux", paliers.canauxMax("standard"), 3);
    verifier("Souverain : sans limite", paliers.canauxMax("pro"), null);
    verifier("palier inconnu : traité comme gratuit",
        paliers.canauxMax("n'existe pas"), 1);

    // 3. L'API et les applications tierces n'existent qu'à partir de Souverain.
    verifier("Découverte : pas d'API", paliers.aLesIntegrations("free"), false);
    verifier("Actif : pas d'API", paliers.aLesIntegrations("standard"), false);
    verifier("Souverain : API ouverte", paliers.aLesIntegrations("pro"), true);
    verifier("Société : API ouverte", paliers.aLesIntegrations("societe"), true);

    // 3 bis. Les créations par IA se facturent à la seconde et s'ajoutent au
    // renouvellement : un palier sans renouvellement ne doit pas pouvoir en
    // lancer, sinon on paie le fournisseur sans jamais pouvoir encaisser.
    verifier("Découverte : pas de création par IA",
        paliers.aLesCreationsIA("free"), false);
    verifier("Actif : créations par IA ouvertes",
        paliers.aLesCreationsIA("standard"), true);
    verifier("Souverain : créations par IA ouvertes",
        paliers.aLesCreationsIA("pro"), true);
    // Le palier gratuit garde en revanche les moteurs qui ne coûtent rien —
    // c'est la carte Griot, ouverte dès Découverte dans le catalogue.
    const griot = require(path.join(RACINE, "config/cartes-catalog"))
        .CARTES.find(c => c.id === "griot");
    verifier("Griot est ouvert dès le palier gratuit", griot?.palier, "free");

    // 4. Une cadence de publication ne peut pas dépasser le palier.
    verifier("Découverte : aucune publication automatique",
        paliers.cadencePublication("free", "quotidien"), null);
    verifier("Actif : le quotidien est ramené à 3x/semaine",
        paliers.cadencePublication("standard", "quotidien"), "3x_semaine");
    verifier("Actif : une cadence plus rare est respectée",
        paliers.cadencePublication("standard", "hebdo"), "hebdo");
    verifier("Souverain : le quotidien passe",
        paliers.cadencePublication("pro", "quotidien"), "quotidien");
    verifier("cadence inconnue : ramenée au plafond du palier",
        paliers.cadencePublication("standard", "toutes_les_heures"), "3x_semaine");
    verifier("Souverain : deux publications par jour",
        paliers.cadencePublication("pro", "2x_jour"), "2x_jour");
    verifier("Actif : deux fois par jour est ramené à 3x/semaine",
        paliers.cadencePublication("standard", "2x_jour"), "3x_semaine");

    // Invariant entre deux fichiers : une cadence vendue ici doit exister dans
    // le moteur, sinon estDu() retomberait sur l'intervalle par défaut et le
    // marchand publierait à une fréquence qu'il n'a pas choisie.
    const moteur = fs.readFileSync(path.join(RACINE, "engines/autopostEngine.js"), "utf8");
    const bloc = moteur.slice(moteur.indexOf("const INTERVALLES_MS"), moteur.indexOf("function extractJson"));
    verifier("chaque cadence vendue existe dans le moteur de publication",
        paliers.CADENCES.filter(c => !bloc.includes(c)), []);

    // 5. Le quota de canaux, tel qu'il est réellement appliqué à la connexion.
    CONNECTEURS = [];
    verifier("espace gratuit vide : le premier canal passe",
        (await connectorService.quotaCanaux("WS-FREE", "telegram")).ok, true);

    CONNECTEURS = [{ workspace_id: "WS-FREE", type: "telegram", config: "{}", actif: true }];
    verifier("espace gratuit avec 1 canal : le deuxième est refusé",
        (await connectorService.quotaCanaux("WS-FREE", "instagram")).ok, false);
    // Sans cette règle, un marchand au quota ne pourrait plus corriger le
    // jeton d'un canal qu'il a déjà — le blocage se retournerait contre lui.
    verifier("rebrancher un canal déjà connecté ne consomme rien",
        (await connectorService.quotaCanaux("WS-FREE", "telegram")).ok, true);
    // Livrer n'est pas un canal de vente : le transporteur ne doit jamais
    // manger le quota, sinon le palier gratuit devient inutilisable.
    verifier("un transporteur ne compte pas dans le quota",
        (await connectorService.quotaCanaux("WS-FREE", "yalidine")).ok, true);
    verifier("un moyen de paiement ne compte pas dans le quota",
        (await connectorService.quotaCanaux("WS-FREE", "ccp")).ok, true);

    CONNECTEURS = [
        { workspace_id: "WS-ACTIF", type: "telegram", config: "{}", actif: true },
        { workspace_id: "WS-ACTIF", type: "whatsapp", config: "{}", actif: true },
    ];
    verifier("Actif avec 2 canaux : le troisième passe",
        (await connectorService.quotaCanaux("WS-ACTIF", "gmail")).ok, true);

    CONNECTEURS.push({ workspace_id: "WS-ACTIF", type: "gmail", config: "{}", actif: true });
    verifier("Actif avec 3 canaux : le quatrième est refusé",
        (await connectorService.quotaCanaux("WS-ACTIF", "instagram")).ok, false);
    // Un canal débranché libère sa place : le quota compte ce qui tourne,
    // pas ce qui a existé un jour.
    CONNECTEURS[2].actif = false;
    verifier("un canal débranché libère sa place",
        (await connectorService.quotaCanaux("WS-ACTIF", "instagram")).ok, true);

    // Huit canaux déjà branchés, et on en demande un NEUVIÈME qui n'est pas
    // dans la liste : sans ça le test passerait par la règle « déjà connecté »
    // et ne prouverait rien sur l'absence de plafond.
    const dejaBranches = paliers.CANAUX_COMPTES.slice(0, 8);
    CONNECTEURS = dejaBranches.map(type => (
        { workspace_id: "WS-SOUVERAIN", type, config: "{}", actif: true }
    ));
    const nouveau = paliers.CANAUX_COMPTES.find(t => !dejaBranches.includes(t));
    verifier("Souverain : aucun plafond de canaux",
        (await connectorService.quotaCanaux("WS-SOUVERAIN", nouveau)).ok, true);

    // L'essai WhatsApp de 3 jours est promis à tous les paliers sur la page
    // de tarifs : le compter comme un canal le refuserait au gratuit dès
    // qu'un Telegram est branché, c'est-à-dire à qui il est destiné.
    CONNECTEURS = [{ workspace_id: "WS-FREE", type: "telegram", config: "{}", actif: true }];
    const essai = await connectorService.save("WS-FREE", "whatsapp", { mode: "depannage" })
        .then(() => "accepté").catch(e => e.code || "refusé");
    verifier("l'essai WhatsApp 3 jours passe malgré le quota atteint", essai, "accepté");
    // Mais une vraie connexion WhatsApp, elle, reste soumise au quota.
    const vraie = await connectorService.save("WS-FREE", "whatsapp", { fournisseur: "green", apiId: "1", apiToken: "x" })
        .then(() => "accepté").catch(e => e.code || "refusé");
    verifier("une vraie connexion WhatsApp reste soumise au quota", vraie, "QUOTA_CANAUX");

    // ── Le compte fondateur ──────────────────────────────────────────────
    // Le fondateur n'a pas pu brancher son propre WhatsApp sur sa propre
    // plateforme : le quota lui répondait « Palier Actif requis ». La cause
    // n'était pas le quota mais un SECOND endroit qui relisait
    // palier_abonnement au lieu de passer par abonnementService — donc sans
    // connaître les comptes fondateurs. Ce test verrouille le chemin unique.
    CONNECTEURS = [
        { workspace_id: "WS-FREE", type: "telegram", actif: true },
        { workspace_id: "WS-FONDATEUR", type: "youtube", actif: true },
        { workspace_id: "WS-FONDATEUR", type: "telegram", actif: true },
    ];
    verifier("un espace gratuit ordinaire est bien bloqué au 2e canal",
        (await connectorService.quotaCanaux("WS-FREE", "whatsapp")).ok, false);
    verifier("le fondateur n'est jamais bloqué par le quota de canaux",
        (await connectorService.quotaCanaux("WS-FONDATEUR", "whatsapp")).ok, true);

    // Un espace client (routes/client-connect.js) n'est pas un espace
    // marchand : il n'a pas de palier et ne doit jamais être bloqué ici.
    verifier("espace hors workspaces : jamais bloqué",
        (await connectorService.quotaCanaux("UTILISATEUR-42", "instagram")).ok, true);

    const echecs = cas.filter(c => !c.ok);
    for (const c of cas) {
        console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}`
            + (c.ok ? "" : `  → obtenu ${JSON.stringify(c.obtenu)}, attendu ${JSON.stringify(c.attendu)}`));
    }
    console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);

    assert.strictEqual(echecs.length, 0, `${echecs.length} test(s) en échec`);
    process.exit(0);
})().catch(err => {
    console.error("\n❌ Suite interrompue :", err.message);
    process.exit(1);
});
