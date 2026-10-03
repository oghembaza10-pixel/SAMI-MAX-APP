// ==========================================================================
// SAMII OS — LE WEBHOOK WHATSAPP N'OBÉIT QU'À QUI PEUT LE PROUVER
// ==========================================================================
//
// CE QUI EST MESURÉ ICI, ET POURQUOI C'EST EN HTTP.
//
// Le 2026-10-03, `POST /webhook/whatsapp` acceptait une charge utile
// fabriquée de toutes pièces et la traitait comme un vrai message Meta.
// L'expéditeur du message décide à qui part la réponse, donc un inconnu
// pouvait faire écrire le numéro officiel de SAMII à un numéro de son choix.
//
// ── POURQUOI UN VRAI SERVEUR, ET PAS UN FAUX `req` ────────────────────────
//
// Parce que la partie subtile n'est pas le HMAC, c'est le CORPS BRUT. La
// signature porte sur les octets tels qu'ils arrivent ; `JSON.parse` suivi
// de `JSON.stringify` ne redonne pas la même chaîne, et la signature ne
// tomberait jamais juste. Ça ne tient qu'à une chose : `index.js` monte
// `/webhook` avec `express.raw()` AVANT `express.json()`.
//
// Un faux `req` passerait un objet et ne prouverait rien de cette plomberie.
// On monte donc le VRAI routeur derrière le MÊME parseur que l'application,
// et on envoie de vraies requêtes HTTP.
//
// ── LE TÉMOIN EST OBLIGATOIRE ─────────────────────────────────────────────
//
// « Tout est refusé » n'est pas une preuve de sécurité : une route cassée qui
// répondrait 401 à tout aurait l'air parfaitement gardée. Chaque refus est
// donc accompagné d'un appel LÉGITIME qui doit passer.
// ==========================================================================
const path = require("path");
const crypto = require("crypto");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const SECRET = "secret-de-test-pour-la-signature";
const JETON = "jeton-green-api-de-test";

// Les deux formes réelles que cette route reçoit.
const CHARGE_META = JSON.stringify({
    entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "111222333", display_phone_number: "+10000000000" },
        contacts: [{ profile: { name: "Client" }, wa_id: "213000000000" }],
        messages: [{ from: "213000000000", id: "wamid.TEST", timestamp: "1", type: "text", text: { body: "bonjour" } }],
    } }] }],
});
const CHARGE_GREEN = JSON.stringify({
    typeWebhook: "incomingMessageReceived",
    instanceData: { idInstance: "7103000000" },
    senderData: { sender: "213000000000@c.us", senderName: "Client" },
    messageData: { textMessageData: { textMessage: "bonjour" } },
});

const signer = (corps, secret = SECRET) =>
    "sha256=" + crypto.createHmac("sha256", secret).update(Buffer.from(corps, "utf8")).digest("hex");

(async () => {
    // `services/db.js` fabrique son pool au chargement : sans URL il crierait
    // à chaque require. Aucune requête n'est attendue ici — les refus
    // s'arrêtent avant la base — mais le module doit pouvoir se charger.
    process.env.DATABASE_URL = process.env.PGTEST_URL
        || process.env.DATABASE_URL
        || "postgresql://samii@127.0.0.1:5432/samii_pgtest";
    process.env.META_APP_SECRET = SECRET;
    process.env.WHATSAPP_WEBHOOK_TOKEN = JETON;
    process.env.WHATSAPP_VERIFY_TOKEN = "jeton-de-verification";

    const express = require(path.join(RACINE, "node_modules/express"));
    const routeur = require(path.join(RACINE, "routes/webhook-whatsapp.js"));

    const app = express();
    // ⚠️ LE MÊME ORDRE QUE index.js, ET C'EST TOUT CE QUI REND LA MESURE
    // VALABLE : raw d'abord, json ensuite. Inversé, le corps arrive analysé,
    // le HMAC ne tombe jamais juste, et ce fichier crierait à tort.
    app.use("/webhook", express.raw({ type: "application/json" }));
    app.use(express.json());
    app.use("/webhook/whatsapp", routeur);

    const serveur = await new Promise((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const BASE = `http://127.0.0.1:${serveur.address().port}`;

    // On écoute ce que la route DIT : un refus ne doit pas seulement rendre
    // 401, il doit s'arrêter AVANT de lire le message. La trace d'entrée
    // « 📩 Webhook WhatsApp reçu » ne doit donc pas apparaître.
    const vraiLog = console.log;
    const vraiWarn = console.warn;
    let journal = [];
    console.log = (...a) => journal.push(a.join(" "));
    console.warn = (...a) => journal.push(a.join(" "));

    async function poster(corps, entetes) {
        journal = [];
        const r = await fetch(`${BASE}/webhook/whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...entetes },
            body: corps,
        });
        // La suite du traitement est asynchrone : on lui laisse le temps de
        // laisser une trace, sinon « rien dans le journal » ne prouverait que
        // la lenteur.
        await new Promise((r2) => setTimeout(r2, 150));
        return { code: r.status, journal: journal.join("\n") };
    }

    const aLuLeMessage = (j) => /Webhook WhatsApp reçu/.test(j);

    try {
        // ── 1. LE TÉMOIN : UN APPEL LÉGITIME DOIT PASSER ──────────────────
        const bon = await poster(CHARGE_META, { "X-Hub-Signature-256": signer(CHARGE_META) });
        verifier(bon.code === 200,
            `témoin : une charge Meta correctement signée est refusée (${bon.code}) — le garde est ` +
            "trop strict et le webhook ne fonctionnerait plus du tout. Sans ce témoin, les refus " +
            "ci-dessous ne prouveraient rien");
        verifier(aLuLeMessage(bon.journal),
            "témoin : l'appel signé n'a pas été TRAITÉ (aucune trace d'entrée) — le 200 viendrait " +
            "d'un refus silencieux, et les mesures suivantes seraient creuses");

        // ── 2. LA FAILLE D'ORIGINE : AUCUNE PREUVE ────────────────────────
        const nu = await poster(CHARGE_META, {});
        verifier(nu.code === 401,
            `une charge Meta SANS signature rend ${nu.code} au lieu de 401 : n'importe qui peut ` +
            "faire écrire le numéro officiel de SAMII au numéro de son choix");
        verifier(!aLuLeMessage(nu.journal),
            "une charge non signée a été LUE avant d'être refusée : le 401 masque un traitement qui " +
            "a bien eu lieu (crédits consommés, réponse peut-être partie)");

        // ── 3. UNE SIGNATURE QUI N'EST PAS LA BONNE ───────────────────────
        const fausse = await poster(CHARGE_META, { "X-Hub-Signature-256": signer(CHARGE_META, "mauvais-secret") });
        verifier(fausse.code === 401,
            `une signature calculée avec un AUTRE secret est acceptée (${fausse.code}) : le HMAC ` +
            "n'est pas réellement comparé");

        // ── 4. LE CORPS MODIFIÉ APRÈS SIGNATURE ───────────────────────────
        //
        // C'est ce qui distingue une vraie vérification d'un en-tête qu'on
        // regarde sans s'en servir : la signature doit couvrir les OCTETS.
        const altere = CHARGE_META.replace("213000000000", "213999999999");
        const rejoue = await poster(altere, { "X-Hub-Signature-256": signer(CHARGE_META) });
        verifier(rejoue.code === 401,
            `un corps modifié après signature est accepté (${rejoue.code}) : la signature ne couvre ` +
            "pas le contenu, donc on peut changer le numéro de l'expéditeur — et donc la " +
            "destination de la réponse");

        // ── 4 bis. LA SIGNATURE PORTE SUR LES OCTETS REÇUS, PAS SUR UN
        //          CORPS RE-SÉRIALISÉ ─────────────────────────────────────
        //
        // ⚠️ CETTE VÉRIFICATION A ÉTÉ AJOUTÉE APRÈS UNE MUTATION MUETTE, ET
        // C'EST LA PLUS IMPORTANTE DU FICHIER.
        //
        // Remplacer le corps brut par `JSON.stringify(JSON.parse(corps))` ne
        // faisait crier personne : les charges ci-dessus sont fabriquées PAR
        // `JSON.stringify`, donc elles repassent identiques par ce tour. Le
        // test ne distinguait pas les deux.
        //
        // En production, Meta n'envoie pas du JSON minifié : indentation,
        // ordre des clés, échappements diffèrent. Une telle régression
        // casserait donc TOUTES les signatures réelles pendant que ce fichier
        // resterait vert — exactement le test qui se tait quand ça compte.
        //
        // On signe donc un corps INDENTÉ, octet pour octet. Il ne survit pas
        // à un aller-retour JSON, et seule une vraie vérification sur les
        // octets l'accepte.
        const indentee = JSON.stringify(JSON.parse(CHARGE_META), null, 2);
        verifier(indentee !== JSON.stringify(JSON.parse(indentee)),
            "montage : la charge indentée survit à un aller-retour JSON — elle ne peut donc pas " +
            "distinguer une signature sur les octets d'une signature sur un corps re-sérialisé");
        const brute = await poster(indentee, { "X-Hub-Signature-256": signer(indentee) });
        verifier(brute.code === 200,
            `un corps indenté correctement signé est refusé (${brute.code}) : la signature est ` +
            "calculée sur un corps RE-SÉRIALISÉ au lieu des octets reçus. En production, où Meta " +
            "n'envoie pas du JSON minifié, aucune signature ne tomberait juste");

        // ── 5. PAS DE PORTE DÉROBÉE PAR LA FORME DU MESSAGE ───────────────
        //
        // Green API et Meta arrivent par la MÊME route. Si le garde choisissait
        // son vérificateur d'après la forme du corps, il suffirait d'envoyer
        // une charge « Green API » pour ne jamais rencontrer le HMAC.
        const vertNu = await poster(CHARGE_GREEN, {});
        verifier(vertNu.code === 401,
            `une charge en forme de Green API, sans aucune preuve, rend ${vertNu.code} au lieu de ` +
            "401 : changer la FORME du message suffit à contourner la signature");
        verifier(!aLuLeMessage(vertNu.journal),
            "une charge Green API non authentifiée a été lue avant d'être refusée");

        const vertSigne = await poster(CHARGE_GREEN, { Authorization: `Bearer ${JETON}` });
        verifier(vertSigne.code === 200,
            `témoin : une charge Green API avec le bon jeton est refusée (${vertSigne.code}) — la ` +
            "voie du fournisseur qui ne signe pas serait définitivement fermée");

        const vertFaux = await poster(CHARGE_GREEN, { Authorization: "Bearer mauvais-jeton" });
        verifier(vertFaux.code === 401,
            `un mauvais jeton partagé est accepté (${vertFaux.code})`);

        // ── 6. ON ÉCHOUE FERMÉ QUAND LE SECRET MANQUE ─────────────────────
        //
        // « Pas de secret donc on laisse passer » est la valeur de repli que
        // ce dépôt s'interdit : l'appel réussit alors depuis n'importe où et
        // rien ne le signale.
        const secretGarde = process.env.META_APP_SECRET;
        const jetonGarde = process.env.WHATSAPP_WEBHOOK_TOKEN;
        delete process.env.META_APP_SECRET;
        delete process.env.WHATSAPP_WEBHOOK_TOKEN;
        const sansSecret = await poster(CHARGE_META, { "X-Hub-Signature-256": signer(CHARGE_META) });
        verifier(sansSecret.code === 401,
            `sans META_APP_SECRET, le webhook rend ${sansSecret.code} au lieu de 401 : l'absence de ` +
            "secret ouvre la porte à tout le monde au lieu de la fermer");
        process.env.META_APP_SECRET = secretGarde;
        process.env.WHATSAPP_WEBHOOK_TOKEN = jetonGarde;

        // ── 7. UN EN-TÊTE MALFORMÉ NE DOIT PAS CASSER LE SERVEUR ──────────
        //
        // `crypto.timingSafeEqual` LÈVE une exception si les deux tampons
        // n'ont pas la même taille. Sans contrôle de longueur préalable, un
        // en-tête court rendrait 500 — une erreur serveur offerte à qui
        // envoie n'importe quoi.
        for (const mauvais of ["sha256=court", "sha256=", "", "nimporte-quoi", "sha256=" + "ff".repeat(64)]) {
            const r = await poster(CHARGE_META, { "X-Hub-Signature-256": mauvais });
            verifier(r.code === 401,
                `l'en-tête de signature « ${mauvais.slice(0, 24)} » rend ${r.code} au lieu de 401 : ` +
                "un en-tête malformé provoque une erreur serveur au lieu d'un refus propre");
        }

        // ── 8. LA POIGNÉE DE MAIN GET N'EST PAS CASSÉE ────────────────────
        //
        // Meta n'accepte de brancher un webhook qu'après un GET réussi. Si ce
        // chantier l'avait cassée, plus aucun numéro ne pourrait être branché
        // le jour où l'accès revient — et personne ne le découvrirait avant.
        const defi = await fetch(`${BASE}/webhook/whatsapp?hub.mode=subscribe`
            + `&hub.verify_token=jeton-de-verification&hub.challenge=12345`);
        const corpsDefi = await defi.text();
        verifier(defi.status === 200 && corpsDefi === "12345",
            `la vérification d'abonnement Meta (GET) rend ${defi.status} « ${corpsDefi} » au lieu de ` +
            "200 « 12345 » : aucun numéro WhatsApp ne pourrait plus être branché");

        const defiFaux = await fetch(`${BASE}/webhook/whatsapp?hub.mode=subscribe`
            + `&hub.verify_token=mauvais&hub.challenge=12345`);
        verifier(defiFaux.status === 403,
            `un mauvais jeton de vérification rend ${defiFaux.status} au lieu de 403`);
    } finally {
        console.log = vraiLog;
        console.warn = vraiWarn;
        serveur.close();
    }
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ signature du webhook WhatsApp : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ signature du webhook WhatsApp : ${verifs} vérifications passées`);
    process.exit(0);
}).catch((err) => {
    console.log(`\n❌ signature du webhook WhatsApp : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    console.log(err.stack);
    process.exit(1);
});
