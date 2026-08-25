// ==========================================================================
// SAMII OS — Tests des trois façons d'être sur WhatsApp
//
// Pourquoi ces tests-là. Une entreprise qui a déjà un compte WhatsApp Business
// approuvé ne changera pas d'infrastructure pour nous : elle nous branche
// au-dessus de la sienne. Si ce chemin casse, on ne perd pas une
// fonctionnalité, on perd le type de client qui vaut le plus cher — et on ne
// s'en aperçoit qu'au moment où son premier message reste sans réponse.
//
// Deux choses sont vérifiées ici :
//   1. chaque fournisseur reçoit exactement la requête que son API attend
//      (bonne URL, bon en-tête d'authentification, bon corps) ;
//   2. un webhook entrant est lu correctement — et un accusé de réception
//      n'est jamais pris pour un message, sinon on répond à soi-même en
//      boucle à chaque envoi.
//
// Aucun réseau : axios est remplacé par un espion qui enregistre l'appel.
//
// Lancer :  npm test
// ==========================================================================
const assert = require("assert");
const path = require("path");

const RACINE = path.join(__dirname, "..");

// ── axios simulé : on garde le dernier appel pour l'inspecter ────────────
const appels = [];
function installerAxiosSimule() {
    const faux = {
        post: async (url, body, options) => { appels.push({ url, body, options }); return { data: {} }; },
        get: async (url, options) => { appels.push({ url, options }); return { data: {} }; },
    };
    const r = require.resolve(path.join(RACINE, "node_modules/axios"));
    require.cache[r] = { id: r, filename: r, loaded: true, exports: faux };
}
installerAxiosSimule();

const wa = require(path.join(RACINE, "services/whatsappFournisseurs"));

const cas = [];
const verifier = (titre, obtenu, attendu) => {
    cas.push({ titre, ok: JSON.stringify(obtenu) === JSON.stringify(attendu), obtenu, attendu });
};
const dernier = () => appels[appels.length - 1] || {};

(async () => {
    // 1. Un connecteur enregistré avant l'arrivée des trois fournisseurs n'a
    //    pas de champ `fournisseur`. Il doit rester du Green API : sinon tous
    //    les marchands déjà branchés cassent d'un coup, en silence.
    verifier("config sans fournisseur = Green API (compatibilité)",
        wa.fournisseurDe({ apiId: "1", apiToken: "x" }), "green");
    verifier("fournisseur inconnu = Green API",
        wa.fournisseurDe({ fournisseur: "inventé" }), "green");

    // 2. Une config incomplète ne doit jamais partir sur le réseau.
    verifier("Green sans token : incomplet", wa.estComplete({ apiId: "1" }), false);
    verifier("360dialog sans clé : incomplet",
        wa.estComplete({ fournisseur: "360dialog" }), false);
    verifier("Cloud complet", wa.estComplete({ fournisseur: "cloud", phoneNumberId: "1", token: "t" }), true);

    const refus = await wa.envoyer({ fournisseur: "cloud", phoneNumberId: "1" }, { to: "22", message: "hé" });
    verifier("config incomplète : refus sans appel réseau", refus.success, false);

    // 3. Green API — son propre format, qui n'a rien à voir avec Meta.
    await wa.envoyer({ apiId: "7107", apiToken: "tok" }, { to: "213555112233", message: "Bonjour" });
    verifier("Green : URL de l'instance",
        dernier().url, "https://api.green-api.com/waInstance7107/sendMessage/tok");
    verifier("Green : le destinataire porte le suffixe @c.us",
        dernier().body.chatId, "213555112233@c.us");

    // 4. Meta Cloud API — l'identifiant du numéro est dans l'URL, le jeton
    //    dans l'en-tête Authorization.
    await wa.envoyer({ fournisseur: "cloud", phoneNumberId: "130409", token: "EAAG" }, { to: "+234 808 015 9197", message: "Hello" });
    verifier("Cloud : URL Graph avec l'identifiant du numéro",
        dernier().url, "https://graph.facebook.com/v23.0/130409/messages");
    verifier("Cloud : jeton porteur",
        dernier().options.headers.Authorization, "Bearer EAAG");
    // Les deux API refusent un numéro contenant « + » ou des espaces : la
    // normalisation doit être faite ici, pas espérée de l'appelant.
    verifier("Cloud : le numéro est normalisé", dernier().body.to, "2348080159197");
    verifier("Cloud : corps au format Meta", dernier().body.type, "text");

    // 5. 360dialog — même corps que Meta (c'est la même API dessous), mais
    //    pas d'identifiant dans l'URL : la clé identifie déjà le numéro.
    await wa.envoyer({ fournisseur: "360dialog", apiKey: "d360-abc" }, { to: "2348080159197", message: "Hello" });
    verifier("360dialog : URL sans identifiant de numéro",
        dernier().url, "https://waba-v2.360dialog.io/messages");
    verifier("360dialog : en-tête de clé dédié",
        dernier().options.headers["D360-API-KEY"], "d360-abc");
    verifier("360dialog : même corps que Meta",
        dernier().body.messaging_product, "whatsapp");

    // 6. Le webhook entrant. Meta et 360dialog envoient la même enveloppe :
    //    un seul lecteur pour les deux.
    const entrant = {
        entry: [{ changes: [{ value: {
            metadata: { display_phone_number: "234 808 015 9197", phone_number_id: "130409" },
            contacts: [{ profile: { name: "Jdaem" }, wa_id: "2348080159197" }],
            messages: [{ from: "2348080159197", type: "text", text: { body: "Good morning" } }],
        } }] }],
    };
    const lu = wa.lireWebhookCloud(entrant);
    verifier("webhook : expéditeur", lu.sender, "2348080159197");
    verifier("webhook : nom du contact", lu.senderName, "Jdaem");
    verifier("webhook : texte", lu.texte, "Good morning");
    verifier("webhook : identifiant du numéro", lu.phoneNumberId, "130409");

    // Le piège qui coûte le plus cher : les accusés de réception arrivent par
    // le MÊME webhook. Sans ce filtre, chaque message qu'on envoie revient et
    // déclenche une réponse — on se parle à soi-même, en boucle, chez le
    // client.
    const accuse = { entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "130409" },
        statuses: [{ id: "wamid.X", status: "delivered" }],
    } }] }] };
    verifier("un accusé de réception n'est pas un message",
        wa.lireWebhookCloud(accuse), null);
    verifier("une enveloppe vide ne casse rien", wa.lireWebhookCloud({}), null);

    // 7. Un vocal n'apporte pas de texte, seulement un identifiant de média :
    //    l'appelant doit pouvoir le distinguer d'un message vide.
    const vocal = { entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "130409" },
        contacts: [{ profile: { name: "Jdaem" } }],
        messages: [{ from: "2348080159197", type: "audio", audio: { id: "MEDIA-1", mime_type: "audio/ogg; codecs=opus" } }],
    } }] }] };
    const luVocal = wa.lireWebhookCloud(vocal);
    verifier("vocal : pas de texte", luVocal.texte, "");
    verifier("vocal : identifiant de média", luVocal.mediaId, "MEDIA-1");

    // 8. Déclaration du webhook : automatique chez 360dialog, manuelle
    //    ailleurs — et jamais présentée comme faite quand elle ne l'est pas.
    const chezMeta = await wa.declarerWebhook({ fournisseur: "cloud" }, "https://exemple/webhook");
    verifier("Meta : déclaration manuelle, on ne prétend pas l'avoir faite",
        chezMeta.automatique, false);
    const chez360 = await wa.declarerWebhook({ fournisseur: "360dialog", apiKey: "k" }, "https://exemple/webhook");
    verifier("360dialog : déclaration automatique", chez360.automatique, true);
    verifier("360dialog : bonne route de configuration",
        dernier().url, "https://waba-v2.360dialog.io/v1/configs/webhook");

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
