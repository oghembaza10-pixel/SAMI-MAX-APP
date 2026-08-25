// ==========================================================================
// SAMII OS — Tests du portefeuille, sur une VRAIE base
//
// Pourquoi pas une base simulée ici. Les autres suites remplacent services/db
// par un faux : c'est le bon choix pour vérifier des règles. Un grand livre,
// non. Ce qu'on doit prouver — qu'une transaction annule TOUT en cas d'erreur,
// qu'un solde ne devient jamais négatif sous deux opérations concurrentes,
// qu'une contrainte CHECK refuse un montant nul — n'existe que dans un vrai
// PostgreSQL. Un faux dirait toujours oui.
//
// La suite se saute d'elle-même si aucune base d'essai n'est fournie : elle ne
// doit jamais faire échouer `npm test` chez quelqu'un qui n'en a pas, et elle
// ne doit JAMAIS tourner sur la base de production (voir le garde-fou).
//
// Lancer :
//   PGTEST_URL=postgres://postgres@localhost:5433/samii_test npm test
// ==========================================================================
const assert = require("assert");
const path = require("path");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite portefeuille ignorée (normal hors développement).");
    process.exit(0);
}
// Garde-fou : cette suite EFFACE des tables. Elle ne doit pouvoir viser qu'une
// base d'essai, jamais autre chose, même si quelqu'un colle la mauvaise URL.
if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
    console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;

const RACINE = path.join(__dirname, "..");
const db = require(path.join(RACINE, "services/db"));
const pf = require(path.join(RACINE, "services/portefeuille"));

const cas = [];
const verifier = (titre, obtenu, attendu) => {
    cas.push({ titre, ok: JSON.stringify(obtenu) === JSON.stringify(attendu), obtenu, attendu });
};

async function preparer() {
    await db.query(`DROP TABLE IF EXISTS portefeuille_mouvements, portefeuille_retraits`);
    await db.query(`
        CREATE TABLE portefeuille_mouvements (
            id BIGSERIAL PRIMARY KEY, operation TEXT NOT NULL, compte TEXT NOT NULL,
            poche TEXT NOT NULL, sens SMALLINT NOT NULL CHECK (sens IN (-1,1)),
            montant NUMERIC(14,2) NOT NULL CHECK (montant > 0), devise TEXT NOT NULL,
            type TEXT NOT NULL, transaction_ref TEXT, rail TEXT, detail TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.query(`
        CREATE TABLE portefeuille_retraits (
            id BIGSERIAL PRIMARY KEY, reference TEXT UNIQUE NOT NULL, compte TEXT NOT NULL,
            montant NUMERIC(14,2) NOT NULL CHECK (montant > 0), devise TEXT NOT NULL,
            rail TEXT NOT NULL, destination TEXT, statut TEXT NOT NULL DEFAULT 'demande',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(), traite_le TIMESTAMPTZ)`);
    await db.query(`DELETE FROM academie_transactions`);
}

// Crée la ligne de transaction que le portefeuille lira pour connaître le
// partage. 10 % figés, comme dans config/academie.js.
async function transactionFictive(reference, { acheteur, vendeur, brut, devise = "USD" }) {
    const commission = Math.round(brut * 0.10 * 100) / 100;
    await db.query(
        `INSERT INTO academie_transactions
            (reference, type, vendeur_id, acheteur_id, montant_brut, devise,
             taux_commission, commission, net_vendeur, statut)
         VALUES ($1,'mission',$2,$3,$4,$5,0.10,$6,$7,'en_attente')`,
        [reference, vendeur, acheteur, brut, devise, commission, Math.round((brut - commission) * 100) / 100],
    );
}

const soldeDe = async (compte, devise = "USD") =>
    (await pf.soldes(compte))[devise] || { disponible: 0, sequestre: 0, retrait: 0 };

(async () => {
    await preparer();

    // ── 1. Le parcours complet d'une mission payée ───────────────────────
    // Un marchand dépose 500 par mobile money, bloque 300 pour une mission,
    // le développeur livre, l'argent se partage.
    await pf.deposer({ compte: "marchand-1", montant: 500, rail: "mobile_money" });
    verifier("dépôt : 500 disponibles", (await soldeDe("marchand-1")).disponible, 500);

    await transactionFictive("TX-1", { acheteur: "marchand-1", vendeur: "dev-1", brut: 300 });
    await pf.bloquer({ compte: "marchand-1", transactionRef: "TX-1", montant: 300 });

    const apresBlocage = await soldeDe("marchand-1");
    verifier("séquestre : 200 restent disponibles", apresBlocage.disponible, 200);
    verifier("séquestre : 300 sont bloqués", apresBlocage.sequestre, 300);
    // Le vendeur ne voit rien tant que rien n'est livré : c'est toute la
    // promesse faite à l'acheteur.
    verifier("le vendeur n'a encore rien", (await soldeDe("dev-1")).disponible, 0);

    const lib = await pf.liberer({ transactionRef: "TX-1" });
    verifier("libération : 270 au vendeur", lib.net, 270);
    verifier("libération : 30 à la maison", lib.commission, 30);
    verifier("le vendeur a ses 270", (await soldeDe("dev-1")).disponible, 270);
    verifier("SAMII a sa commission", (await soldeDe(pf.MAISON)).disponible, 30);
    verifier("le séquestre est vidé", (await soldeDe("marchand-1")).sequestre, 0);

    const statut = await db.query(`SELECT statut FROM academie_transactions WHERE reference = 'TX-1'`);
    verifier("la transaction est marquée reversée", statut[0].statut, "reversee");

    // ── 2. Ce qui doit être refusé ───────────────────────────────────────
    // Deux clics sur « payer » ne doivent pas bloquer deux fois la somme.
    await transactionFictive("TX-2", { acheteur: "marchand-1", vendeur: "dev-1", brut: 50 });
    await pf.bloquer({ compte: "marchand-1", transactionRef: "TX-2", montant: 50 });
    const doubleBlocage = await pf.bloquer({ compte: "marchand-1", transactionRef: "TX-2", montant: 50 })
        .then(() => "accepté").catch((e) => e.code);
    verifier("bloquer deux fois la même transaction est refusé", doubleBlocage, "DEJA_BLOQUE");

    const doubleLiberation = await pf.liberer({ transactionRef: "TX-1" })
        .then(() => "accepté").catch((e) => e.code);
    verifier("libérer deux fois est refusé", doubleLiberation, "DEJA_LIBERE");

    // Le solde ne peut pas devenir négatif — la règle la plus importante de
    // tout le fichier : elle vaut de l'argent réel.
    await transactionFictive("TX-3", { acheteur: "marchand-1", vendeur: "dev-1", brut: 99999 });
    const tropGrand = await pf.bloquer({ compte: "marchand-1", transactionRef: "TX-3", montant: 99999 })
        .then(() => "accepté").catch((e) => e.code);
    verifier("bloquer plus que son solde est refusé", tropGrand, "SOLDE_INSUFFISANT");
    verifier("et le solde n'a pas bougé", (await soldeDe("marchand-1")).disponible, 150);

    // ── 3. Remboursement : rien n'a été livré ────────────────────────────
    await pf.rembourser({ transactionRef: "TX-2" });
    const apresRemb = await soldeDe("marchand-1");
    verifier("remboursement : la somme revient", apresRemb.disponible, 200);
    verifier("remboursement : plus rien sous séquestre", apresRemb.sequestre, 0);
    // Aucune commission sur un travail non livré (contrat, article 5).
    verifier("aucune commission sur un remboursement", (await soldeDe(pf.MAISON)).disponible, 30);

    // ── 4. Retrait : l'argent n'est plus dépensable dès la demande ───────
    const ret = await pf.demanderRetrait({
        compte: "dev-1", montant: 270, rail: "mobile_money", destination: "+2348080159197",
    });
    const enAttente = await soldeDe("dev-1");
    verifier("retrait demandé : plus rien de dépensable", enAttente.disponible, 0);
    verifier("retrait demandé : la somme est en attente", enAttente.retrait, 270);

    // Sans la troisième poche, le vendeur retirerait et dépenserait la même
    // somme — c'est précisément ce qu'on empêche ici.
    await transactionFictive("TX-4", { acheteur: "dev-1", vendeur: "dev-2", brut: 270 });
    const depenseImpossible = await pf.bloquer({ compte: "dev-1", transactionRef: "TX-4", montant: 270 })
        .then(() => "accepté").catch((e) => e.code);
    verifier("on ne peut pas dépenser un retrait en cours", depenseImpossible, "SOLDE_INSUFFISANT");

    await pf.confirmerRetrait(ret.operation);
    const apresPaie = await soldeDe("dev-1");
    verifier("retrait payé : tout est parti", apresPaie.retrait, 0);
    verifier("retrait payé : rien ne reste", apresPaie.disponible, 0);

    // Un retrait annulé rend la somme dépensable, sans la faire disparaître.
    await pf.deposer({ compte: "dev-2", montant: 100, rail: "ccp" });
    const ret2 = await pf.demanderRetrait({ compte: "dev-2", montant: 100, rail: "ccp", destination: "0044766935" });
    await pf.annulerRetrait(ret2.operation, "Coordonnées erronées");
    verifier("retrait annulé : la somme redevient dépensable", (await soldeDe("dev-2")).disponible, 100);

    // ── 4 bis. La course : deux paiements lancés en même temps ───────────
    // Le test qui a trouvé le vrai bug. Sans verrou par compte, huit blocages
    // de 100 lancés ensemble sur un solde de 100 en faisaient passer CINQ et
    // laissaient le compte à −400 : de l'argent créé de rien. Aucune base
    // simulée ne peut montrer ça, et aucune relecture du solde ne l'empêche —
    // le danger n'est pas de lire trop tôt, c'est que l'autre écrive entre la
    // lecture et l'écriture.
    await pf.deposer({ compte: "course", montant: 100, rail: "ccp" });
    const refs = ["CO-1", "CO-2", "CO-3", "CO-4", "CO-5", "CO-6", "CO-7", "CO-8"];
    for (const r of refs) await transactionFictive(r, { acheteur: "course", vendeur: "dev-1", brut: 100 });
    const course = await Promise.allSettled(refs.map((r) =>
        pf.bloquer({ compte: "course", transactionRef: r, montant: 100 })));

    verifier("un seul blocage passe sur un solde de 100",
        course.filter((r) => r.status === "fulfilled").length, 1);
    const apresCourse = await soldeDe("course");
    verifier("le solde n'est jamais négatif", apresCourse.disponible, 0);
    verifier("exactement 100 sous séquestre", apresCourse.sequestre, 100);

    // ── 5. L'invariant, celui qui dit si on a perdu de l'argent ──────────
    const ecarts = await pf.controleEquilibre();
    verifier("le grand livre est équilibré", ecarts.map((e) => e.ecart), ecarts.map(() => 0));

    // ── 6. Les devises ne se mélangent pas ───────────────────────────────
    // Additionner des dinars et des dollars au taux du jour donne un chiffre
    // faux dès le lendemain : chaque devise vit séparément.
    await pf.deposer({ compte: "marchand-2", montant: 10000, devise: "DZD", rail: "ccp" });
    await pf.deposer({ compte: "marchand-2", montant: 20, devise: "USD", rail: "carte" });
    const multi = await pf.soldes("marchand-2");
    verifier("chaque devise a son solde", [multi.DZD.disponible, multi.USD.disponible], [10000, 20]);
    const enDZD = await transactionFictive("TX-5", { acheteur: "marchand-2", vendeur: "dev-1", brut: 30000, devise: "DZD" });
    const trop = await pf.bloquer({ compte: "marchand-2", transactionRef: "TX-5", montant: 30000, devise: "DZD" })
        .then(() => "accepté").catch((e) => e.code);
    verifier("le solde USD ne renfloue pas le solde DZD", trop, "SOLDE_INSUFFISANT");

    // ── 7. Tout ou rien ──────────────────────────────────────────────────
    // Une écriture déséquilibrée ne doit rien laisser derrière elle. On la
    // provoque par une transaction dont le partage a été trafiqué en base.
    await db.query(
        `INSERT INTO academie_transactions
            (reference, type, vendeur_id, acheteur_id, montant_brut, devise, taux_commission, commission, net_vendeur, statut)
         VALUES ('TX-FAUX','mission','dev-1','marchand-3',100,'USD',0.10,10,50,'en_attente')`,
    );
    await pf.deposer({ compte: "marchand-3", montant: 100, rail: "especes" });
    await pf.bloquer({ compte: "marchand-3", transactionRef: "TX-FAUX", montant: 100 });
    const refus = await pf.liberer({ transactionRef: "TX-FAUX" })
        .then(() => "accepté").catch(() => "refusé");
    verifier("un partage qui ne tombe pas juste est refusé", refus, "refusé");
    // Et surtout : rien n'a été écrit à moitié.
    const apresRefus = await soldeDe("marchand-3");
    verifier("après refus, le séquestre est intact", apresRefus.sequestre, 100);
    verifier("après refus, le vendeur n'a rien reçu", (await soldeDe("dev-1")).disponible, 0);
    const ecartsFinaux = await pf.controleEquilibre();
    verifier("le livre reste équilibré après un refus",
        ecartsFinaux.map((e) => e.ecart), ecartsFinaux.map(() => 0));

    const echecs = cas.filter((c) => !c.ok);
    for (const c of cas) {
        console.log(`${c.ok ? "✓" : "✗"}  ${c.titre}`
            + (c.ok ? "" : `  → obtenu ${JSON.stringify(c.obtenu)}, attendu ${JSON.stringify(c.attendu)}`));
    }
    console.log(`\n${cas.length - echecs.length}/${cas.length} vérifications passées`);

    assert.strictEqual(echecs.length, 0, `${echecs.length} test(s) en échec`);
    process.exit(0);
})().catch((err) => {
    console.error("\n❌ Suite interrompue :", err.message);
    process.exit(1);
});
