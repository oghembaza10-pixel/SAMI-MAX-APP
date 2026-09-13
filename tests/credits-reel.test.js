// ==========================================================================
// SAMII OS — Le solde paie-t-il le TRAVAIL de SAMII, contre une VRAIE base ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE EN PLUS DE credits.test.js.
//
// credits.test.js monte un registre en mémoire. Il prouve la logique, et il
// l'a bien prouvée. Mais une base simulée ne connaît pas le SQL : elle ne
// sait pas qu'une colonne n'existe pas, ni qu'une clause `WHERE` oublie un
// paramètre.
//
// Les deux seuls vrais bugs de ce chantier étaient exactement de cette
// nature, et aucun n'était atteignable en mémoire :
//
//   1. `SUM(sens * montant_centimes)` — une colonne qui n'existe pas. Le
//      solde était toujours vide, donc aucun message n'était jamais payé.
//
//   2. L'IDEMPOTENCE IGNORAIT LE COMPTE. `consommer` cherchait la référence
//      dans TOUTE la table. Un marchand paie « tg:1:42 » ; un AUTRE marchand
//      ne paie plus rien pour son propre acte, parce qu'une ligne portant
//      cette référence existe déjà quelque part. La fonction renvoie « déjà
//      compté » — c'est-à-dire un succès. Trouvé en lançant la sonde deux
//      fois de suite : la deuxième n'a rien prélevé.
//
// Ce que cette suite vérifie ne peut donc PAS être vérifié ailleurs.
//
// Lancer :
//   PGTEST_URL=postgres://postgres@127.0.0.1:5432/samii_test npm test
// ==========================================================================
const path = require("path");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite crédits réels ignorée (normal hors développement).");
    process.exit(0);
}
// Même garde-fou que la suite portefeuille : cette suite ÉCRIT. Elle ne doit
// pouvoir viser qu'une base d'essai locale, même si quelqu'un colle la
// mauvaise adresse.
if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
    console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;

const RACINE = path.join(__dirname, "..");
const db = require(path.join(RACINE, "services/db"));
const portefeuille = require(path.join(RACINE, "services/portefeuille"));
const creditsSamii = require(path.join(RACINE, "services/creditsSamii"));
const confirmationsQuota = require(path.join(RACINE, "services/confirmationsQuota"));
const CREDITS = require(path.join(RACINE, "config/credits"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };
const proche = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0001;

// Les colonnes que services/schema.js pose au démarrage de l'application.
// Une base d'essai fraîche ne les a pas : on les ajoute plutôt que d'exiger
// un démarrage complet, qui rendrait cette suite impossible à lancer seule.
async function preparerSchema() {
    await db.query(`ALTER TABLE commandes ADD COLUMN IF NOT EXISTS confirme_le TIMESTAMP`);
    await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS confirmations_depassement_mois INT DEFAULT 0`);
    await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS confirmations_depassement_reset_le TIMESTAMP`);
    await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS theme_visuel TEXT`);
    // Colonnes que le parcours réel utilise (tri des QG, propriétaire).
    await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner TEXT`);
    await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS est_bac_a_sable BOOLEAN DEFAULT false`);
    await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'actif'`);
    await db.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS qg_principal TEXT`);
}

(async () => {
    await preparerSchema();

    // Un marchand neuf à chaque exécution. Surtout pas d'identifiants fixes :
    // c'est précisément en relançant deux fois que le bug d'idempotence est
    // apparu, et un jeu de données figé le cacherait à nouveau.
    const marque = Date.now();
    const email = `credits-reel-${marque}@test.invalid`;
    const u = await db.query(
        `INSERT INTO utilisateurs (nom, prenom, email, password_hash, type_compte)
         VALUES ('Essai','Crédits',$1,'x','marchand') RETURNING id`, [email]);
    const userId = u[0].id;
    const wsId = `ws-credits-${marque}`;
    await db.query(
        `INSERT INTO workspaces (id, owner_email, nom, metier) VALUES ($1,$2,'Boutique d''essai','boulangerie')`,
        [wsId, email]);

    // ── 1. QUI PAIE POUR UN QG ───────────────────────────────────────────
    verifier(await creditsSamii.proprietaireDuWorkspace(wsId) === userId,
        "un QG ne retrouve pas le compte qui doit payer ses actes");
    verifier(await creditsSamii.proprietaireDuWorkspace(`ws-inexistant-${marque}`) === null,
        "un QG inconnu désigne quand même quelqu'un — on prélèverait au hasard");

    // ── 2. LE MARCHAND PAIE L'ACTE, PAS LE MESSAGE DE SON CLIENT ─────────
    //
    // Sur Telegram c'est le CLIENT qui parle. Lui facturer chaque phrase
    // punirait le marchand du volume de sa propre clientèle.
    await creditsSamii.crediter(userId, 5, { rail: "essai", detail: "solde de départ" });
    const avant = (await creditsSamii.etat(userId)).soldeUSD;
    const ref = `tg:${wsId}:1:42`;
    const r1 = await creditsSamii.facturerActesWorkspace(wsId,
        [{ nom: "prendre_rendez_vous", reussi: true }], { ref, motif: "essai Telegram" });
    const apres = (await creditsSamii.etat(userId)).soldeUSD;
    verifier(r1.ok, `l'acte d'un canal client n'est pas facturé au marchand : ${r1.raison}`);
    verifier(proche(avant - apres, CREDITS.PRIX_ACTE_USD),
        `le solde a baissé de ${(avant - apres).toFixed(2)} $ au lieu du prix d'un acte ` +
        `(${CREDITS.PRIX_ACTE_USD} $) — soit le message du client est facturé, soit rien ne l'est`);

    // ── 3. LE REJEU D'UN CANAL ───────────────────────────────────────────
    await creditsSamii.facturerActesWorkspace(wsId,
        [{ nom: "prendre_rendez_vous", reussi: true }], { ref });
    verifier(proche((await creditsSamii.etat(userId)).soldeUSD, apres),
        "une livraison Telegram rejouée facture l'acte une seconde fois");

    // ── 4. LA RÉFÉRENCE D'UN AUTRE MARCHAND NE ME DISPENSE PAS DE PAYER ──
    //
    // LE BUG QUI JUSTIFIE CETTE SUITE. Deux marchands, la MÊME référence.
    // Le second doit être prélevé normalement : une référence est un fait
    // chez quelqu'un, pas une clé universelle.
    const email2 = `credits-reel-b-${marque}@test.invalid`;
    const u2 = await db.query(
        `INSERT INTO utilisateurs (nom, prenom, email, password_hash, type_compte)
         VALUES ('Essai','Voisin',$1,'x','marchand') RETURNING id`, [email2]);
    const userId2 = u2[0].id;
    const wsId2 = `ws-credits-b-${marque}`;
    await db.query(
        `INSERT INTO workspaces (id, owner_email, nom, metier) VALUES ($1,$2,'Voisine','boulangerie')`,
        [wsId2, email2]);
    await creditsSamii.crediter(userId2, 5, { rail: "essai", detail: "solde de départ" });

    const avantVoisin = (await creditsSamii.etat(userId2)).soldeUSD;
    await creditsSamii.facturerActesWorkspace(wsId2,
        [{ nom: "prendre_rendez_vous", reussi: true }],
        { ref });   // ← EXACTEMENT la même référence que le premier marchand
    const apresVoisin = (await creditsSamii.etat(userId2)).soldeUSD;
    verifier(proche(avantVoisin - apresVoisin, CREDITS.PRIX_ACTE_USD),
        "un marchand n'est PAS facturé parce qu'un AUTRE marchand a déjà utilisé cette " +
        "référence : l'idempotence de consommer() ignore le compte, le travail est rendu " +
        "et jamais payé, et la fonction renvoie un succès");

    // ── 5. LA CONFIRMATION SE RÈGLE SUR LE SOLDE, PAS SUR L'ARDOISE ──────
    //
    // Confirmer une commande était payant bien avant la recharge
    // (confirmationsQuota.js). Ce que la recharge change n'est pas le prix,
    // c'est le moyen de paiement : au lieu d'une ardoise qu'il faut ensuite
    // régulariser par un lien à part, c'est réglé tout de suite.
    const quotaGratuit = confirmationsQuota.QUOTA_PAR_PALIER.free;
    for (let i = 0; i <= quotaGratuit; i++) {
        await db.query(
            `INSERT INTO commandes (id, workspace_id, nom_client, statut, confirme_le)
             VALUES ($1,$2,'Client','confirmée', now())`,
            [`cmd-${marque}-${i}`, wsId]);
    }
    const soldeAvantConfirm = (await creditsSamii.etat(userId)).soldeUSD;
    await confirmationsQuota.enregistrerSiDepassement(wsId, `cmd-${marque}-0`);
    const soldeApresConfirm = (await creditsSamii.etat(userId)).soldeUSD;
    const ardoise = await confirmationsQuota.getDepassementMois(wsId);

    verifier(proche(soldeAvantConfirm - soldeApresConfirm, confirmationsQuota.PRIX_DEPASSEMENT_USD),
        `la confirmation au-delà du quota n'est pas prélevée sur le solde ` +
        `(${(soldeAvantConfirm - soldeApresConfirm).toFixed(2)} $ au lieu de ` +
        `${confirmationsQuota.PRIX_DEPASSEMENT_USD} $)`);
    verifier(ardoise.count === 0,
        `la confirmation est prélevée sur le solde ET inscrite à l'ardoise ` +
        `(${ardoise.count}) : elle est comptée deux fois`);

    // Rejeu : la même confirmation ne se facture qu'une fois.
    await confirmationsQuota.enregistrerSiDepassement(wsId, `cmd-${marque}-0`);
    verifier(proche((await creditsSamii.etat(userId)).soldeUSD, soldeApresConfirm),
        "une confirmation rejouée est facturée une seconde fois");

    // ── 6. À SEC : L'ARDOISE REPREND, ET PERSONNE N'EST COUPÉ ────────────
    const reste = (await creditsSamii.etat(userId)).soldeUSD;
    if (reste > 0) {
        await portefeuille.consommer({
            compte: creditsSamii.compteDe(userId), montant: reste,
            devise: CREDITS.DEVISE_COMPTE, motif: "vidage d'essai",
            transactionRef: `vidage-${marque}`,
        });
    }
    verifier((await creditsSamii.etat(userId)).soldeUSD === 0, "le solde d'essai n'est pas vidé");

    await confirmationsQuota.enregistrerSiDepassement(wsId, `cmd-${marque}-1`);
    verifier((await confirmationsQuota.getDepassementMois(wsId)).count === 1,
        "sans solde, la confirmation ne retombe pas sur l'ardoise : le travail disparaît " +
        "sans trace, ni payé ni dû");

    // Et surtout : facturer à sec ne doit JAMAIS lever. Un client laissé
    // sans réponse parce que son marchand est à sec, c'est une vente perdue
    // pour lui et un service qui a l'air cassé pour tout le monde.
    let leve = false;
    try {
        await creditsSamii.facturerActesWorkspace(wsId,
            [{ nom: "prendre_rendez_vous", reussi: true }], { ref: `tg:${wsId}:1:99` });
    } catch { leve = true; }
    verifier(!leve, "facturer un marchand à sec lève une erreur — la conversation de son " +
        "client s'arrêterait là");

    // ── 7. LE PAYS VIENT DU QG, ET LA MONNAIE DU PAYS ────────────────────
    //
    // LE DÉFAUT QUE CE TEST EMPÊCHE DE REVENIR.
    //
    // La page de recharge lisait `utilisateurs.pays`. Mesuré sur
    // l'application qui tourne : cette colonne n'est JAMAIS écrite par le
    // parcours normal — ni le formulaire d'inscription ni sa route ne la
    // renseignent. Un marchand de Bamako voyait donc ses prix en dinars
    // ALGÉRIENS avec « ≈ 2 USD » en dessous.
    //
    // Le pays réellement saisi est celui du QG : le formulaire le demande et
    // la route le REFUSE s'il manque. On le prouve ici sur de vraies lignes,
    // sans jamais modifier une colonne à la main pour faire passer le test.
    const devises = require(path.join(RACINE, "services/devises"));
    const workspaceService = require(path.join(RACINE, "services/workspaceService"));

    for (const [pays, attendue] of [
        ["Algérie", "DZD"], ["Mali", "XOF"], ["Maroc", "MAD"], ["Tunisie", "TND"],
        ["Sénégal", "XOF"], ["Côte d'Ivoire", "XOF"], ["Cameroun", "XAF"], ["France", "EUR"],
    ]) {
        const e = `pays-${attendue}-${pays.replace(/[^a-z]/gi, "")}-${marque}@test.invalid`;
        const w = `ws-pays-${attendue}-${pays.replace(/[^a-z]/gi, "")}-${marque}`;
        await db.query(
            `INSERT INTO utilisateurs (nom, prenom, email, password_hash, type_compte)
             VALUES ('Essai','Pays',$1,'x','marchand')`, [e]);
        // Exactement ce qu'écrit le parcours : un QG avec son pays. La devise
        // du QG est volontairement laissée au défaut (« DZD » pour tout le
        // monde) — c'est justement pourquoi on ne s'y fie pas.
        await db.query(
            `INSERT INTO workspaces (id, owner, owner_email, nom, metier, pays, devise)
             VALUES ($1,$2,$2,'Boutique','boutique',$3,'DZD')`, [w, e, pays]);

        const lu = await workspaceService.paysDuCompte({ workspaceId: w, email: e });
        verifier(lu === pays, `le QG dit « ${pays} » et paysDuCompte répond « ${lu} »`);
        const monnaie = devises.pourPays(lu);
        verifier(monnaie === attendue,
            `un marchand en ${pays} se verrait facturer en ${monnaie} au lieu de ${attendue}`);

        // Et sans QG en session : on doit retrouver le même pays par son QG
        // principal. C'est le cas réel de quelqu'un qui arrive sur /recharge
        // depuis le chat, sans être entré dans sa boutique.
        const sansSession = await workspaceService.paysDuCompte({ email: e });
        verifier(sansSession === pays,
            `sans QG en session, ${pays} devient « ${sansSession} » : la personne verrait ` +
            "une autre monnaie selon la page d'où elle vient");

        // Le montant affiché doit être convertible — un taux manquant
        // ferait échouer la recharge d'un pays entier, en silence.
        const conv = devises.convertir(2, "USD", monnaie);
        verifier(conv.ok && conv.montant > 0,
            `2 $ ne se convertissent pas en ${monnaie} (${pays}) : ${conv.raison || "montant nul"}`);
    }

    // Personne sans QG ni pays : on ne doit rien inventer. `pourPays("")`
    // rend « USD », son repli documenté — et surtout pas un dinar au hasard.
    const inconnu = await workspaceService.paysDuCompte({ email: `personne-${marque}@test.invalid` });
    verifier(inconnu === "", `un compte sans QG rend « ${inconnu} » au lieu de rien`);
    verifier(devises.pourPays(inconnu) === "USD",
        "un pays inconnu ne retombe plus sur USD : on facturerait dans une monnaie inventée");

    // ── 8. L'INVARIANT, APRÈS TOUT ÇA ────────────────────────────────────
    const somme = await db.query(`SELECT COALESCE(SUM(sens * montant),0) AS t FROM portefeuille_mouvements`);
    verifier(proche(somme[0].t, 0),
        `le grand livre n'est plus équilibré : somme signée = ${somme[0].t}`);

    if (echecs.length) {
        console.log(`\n❌ crédits réels : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ crédits réels : ${verifs} vérifications passées (vrai PostgreSQL)`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ crédits réels : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
