// ==========================================================================
// PROVIDER BUFFER — Facebook, Instagram, LinkedIn, TikTok
// ==========================================================================
//
// ── CE QUE « NON ACCORDÉE » VEUT DIRE, ET NE VEUT PAS DIRE ───────────────
//
// Correction d'une erreur répétée plusieurs fois dans ce dossier : j'ai
// écrit que `pages_manage_posts` « n'est pas accordée », donc que publier
// sur Facebook échouerait. C'est faux pour NOS comptes.
//
// Meta n'exige la revue d'application que pour les utilisateurs TIERS. Une
// personne qui a un rôle sur l'app — administrateur, développeur, testeur —
// peut accorder toutes les permissions à ses propres Pages, revue ou pas.
// L'app SAMII GPT est dans ce cas pour le compte du fondateur.
//
// Donc : chez nous, ça passe. Chez un marchand qui n'a aucun rôle sur
// l'app, ça bloquera tant que la revue n'est pas obtenue. Le code ne
// présume rien : il tente, et garde le message exact de Meta.
//
// ── POURQUOI BUFFER PLUTÔT QUE META EN DIRECT ─────────────────────────────
//
// Publier sur une page Facebook par l'API de Meta demande la permission
// `pages_manage_posts`. Elle n'a PAS été accordée : les six obtenues sont
// public_profile, email, pages_show_list, business_management,
// ads_management et ads_read. Le provider `meta` existe, il est correct, et
// il échouera sur une erreur de permission tant que Meta n'aura pas tranché.
//
// Buffer, lui, a déjà l'autorisation de publier — c'est son métier, et les
// comptes y sont connectés côté Buffer, pas côté SAMII. C'est donc le
// chemin qui fonctionne AUJOURD'HUI. Le provider Meta reste en place : le
// jour où la permission arrive, il suffit de retirer Buffer de la liste
// pour repasser en direct.
//
// ── L'API ─────────────────────────────────────────────────────────────────
//
// GraphQL, une seule adresse, jeton en Bearer :
//
//     POST https://api.buffer.com
//     Authorization: Bearer <BUFFER_ACCESS_TOKEN>
//
//     query  { account { organizations { id name } } }
//     query  { channels(input:{organizationId:"…"}) { id name service } }
//     mutation { createPost(input:{ text, channelId, … }) { … } }
//
// ── LE PIÈGE DES DEUX LINKEDIN ────────────────────────────────────────────
//
// Il y a un LinkedIn personnel ET la page OG Technology. Les deux ont
// `service: "linkedin"` chez Buffer.
//
// Publier « sur LinkedIn » devient donc ambigu, et le pire comportement
// possible serait de choisir tout seul — ou pire, de publier sur les deux
// sans que personne l'ait demandé. Ce provider REFUSE quand plusieurs
// chaînes correspondent et qu'aucun choix n'a été posé, en nommant les
// chaînes trouvées avec leur identifiant. Choisir se fait alors une fois,
// par variable d'environnement :
//
//     BUFFER_CANAUX=linkedin:abc123,facebook:def456
//
// Et pour publier volontairement sur les deux LinkedIn :
//
//     BUFFER_CANAUX=linkedin:abc123|xyz789
//
// Le « | » veut dire « et aussi » : il ne peut pas arriver par accident.

const axios = require("axios");

// L'adresse de Buffer. Surchargeable UNIQUEMENT pour pouvoir éprouver ce
// provider contre un faux serveur — publier sur les vrais comptes d'OG
// Technology pour vérifier qu'un champ est bien transmis serait absurde.
// En production, cette variable n'est pas posée et c'est le vrai Buffer.
const ADRESSE = String(process.env.BUFFER_ADRESSE || "").trim() || "https://api.buffer.com";

// Une publication ne doit pas tenir la file. Au-delà, c'est que Buffer ne
// répond pas — et insister n'y changera rien.
const DELAI_MS = 20000;

// ── LA CORRESPONDANCE DES NOMS ────────────────────────────────────────────
//
// Nos slugs ↔ le champ `service` de Buffer. Écrite ici plutôt que devinée :
// Buffer dit "facebook" là où nous disons "facebook", mais rien ne garantit
// que ce sera vrai pour la prochaine plateforme ajoutée.
const SERVICE = {
    facebook: "facebook",
    instagram: "instagram",
    linkedin: "linkedin",
    tiktok: "tiktok",
};

function jeton() {
    return String(process.env.BUFFER_ACCESS_TOKEN || "").trim();
}

// ── CE QUE BUFFER A LE DROIT DE SERVIR ────────────────────────────────────
//
// « fb en utilise api meta, whatsapp aussi, telegram — on a tout ça.
//   Ne mélange pas. Buffer gère que insta. »
//
// Techniquement Buffer sait publier sur Facebook, LinkedIn et TikTok. Mais
// SAMII a déjà ses propres chemins pour Facebook (Meta), WhatsApp (Green
// API) et Telegram, et deux chemins vers la même page, c'est le jour où
// l'on publie deux fois sans comprendre pourquoi.
//
// `BUFFER_PLATEFORMES` tranche, depuis Render, sans toucher au code :
//
//     BUFFER_PLATEFORMES=instagram              ← ce qui a été demandé
//     BUFFER_PLATEFORMES=instagram,linkedin     ← si LinkedIn passe aussi par Buffer
//
// Non posée, Buffer garde sa couverture complète : un défaut silencieux qui
// RESTREINT serait pire, on chercherait pendant une heure pourquoi une
// plateforme ne part pas.
function plateformesAutorisees() {
    const brut = String(process.env.BUFFER_PLATEFORMES || "").trim();
    if (!brut) return Object.keys(SERVICE);
    return brut.split(",").map((s) => s.trim().toLowerCase()).filter((s) => SERVICE[s]);
}

function configure() {
    return !!jeton();
}

// ── « EST-CE QUE TU SERS CETTE PLATEFORME-LÀ ? » ──────────────────────────
//
// `configure()` répond « ai-je mon jeton ». Ce n'est PAS la même question
// que « vas-tu traiter Facebook ». Sans cette seconde question, l'écran du
// fondateur affichait « facebook → buffer » alors que Buffer refusait
// Facebook et passait la main à Meta — vu sur l'écran réel, corrigé ici.
//
// Le registre l'appelle quand elle existe. `passeLaMain` reste en place :
// l'une décide de l'affichage et du choix, l'autre rattrape à l'exécution.
function sert(slug) {
    return plateformesAutorisees().includes(String(slug || "").toLowerCase());
}

// La phrase, écrite UNE fois. Elle sert au registre (pour l'écran) et à
// `chainesPour` (pour l'erreur de publication). Écrite deux fois, elle
// aurait divergé le jour où la variable change de nom.
function motifEcart(slug) {
    return `${String(slug).toLowerCase()} est volontairement hors de Buffer `
         + `(BUFFER_PLATEFORMES=${plateformesAutorisees().join(",")})`;
}

// ── L'APPEL ───────────────────────────────────────────────────────────────
//
// Ne lève jamais : rend `{ ok, donnees, erreur }`. Une exception qui
// remonterait ferait tomber la publication des autres plateformes.
//
// GraphQL répond 200 même quand la requête a échoué — l'erreur est dans le
// corps. Regarder le seul code HTTP, c'est prendre un échec pour un succès.
async function appeler(requete, variables) {
    if (!configure()) return { ok: false, erreur: "BUFFER_ACCESS_TOKEN n'est pas posée" };
    try {
        const r = await axios.post(ADRESSE, { query: requete, variables: variables || {} }, {
            headers: {
                Authorization: `Bearer ${jeton()}`,
                "Content-Type": "application/json",
            },
            timeout: DELAI_MS,
        });
        if (r.data?.errors?.length) {
            return { ok: false, erreur: r.data.errors.map((e) => e.message).join(" · ") };
        }
        return { ok: true, donnees: r.data?.data };
    } catch (err) {
        // Le message de Buffer, s'il en donne un ; jamais le jeton, qui est
        // dans les en-têtes et n'a rien à faire dans un journal.
        const detail = err.response?.data?.errors?.[0]?.message
            || err.response?.data?.message
            || err.message;
        const code = err.response?.status;
        return { ok: false, erreur: code ? `HTTP ${code} — ${detail}` : detail };
    }
}

// ── LES CHAÎNES ───────────────────────────────────────────────────────────
//
// Deux requêtes : l'organisation, puis ses chaînes. Le résultat est gardé en
// mémoire pour la durée du processus — la liste ne change qu'au moment où
// quelqu'un connecte un compte dans Buffer, ce qui n'arrive pas toutes les
// minutes. `oublier()` permet de la relire sans redémarrer.
let cache = null;

async function chaines({ forcer = false } = {}) {
    if (cache && !forcer) return cache;

    const orgs = await appeler(`query { account { organizations { id name } } }`);
    if (!orgs.ok) return { ok: false, erreur: orgs.erreur };
    const org = orgs.donnees?.account?.organizations?.[0];
    if (!org?.id) return { ok: false, erreur: "aucune organisation Buffer sur ce compte" };

    // ── LE TYPE DE L'IDENTIFIANT N'EST PAS « String » ────────────────────
    //
    // Buffer déclare `organizationId` comme un `OrganizationId!`, un type
    // à lui, pas une chaîne. La requête partait en `$id: String!` et Buffer
    // la refusait AVANT de l'exécuter :
    //
    //     Variable "$id" of type "String!" used in position
    //     expecting type "OrganizationId!"
    //
    // Conséquence relevée en production le 3 septembre : la liste des
    // chaînes ne se chargeait jamais, donc AUCUNE publication Buffer ne
    // trouvait son canal. Facebook (Meta direct) et Telegram passaient ;
    // LinkedIn et Instagram, qui passent par Buffer, échouaient tous les
    // deux — sur un message parlant de types GraphQL, qui ne dit pas qu'on
    // vient de perdre deux réseaux.
    //
    // Même famille que `PostInput`/`PostId` côté métriques : chez Buffer,
    // les identifiants sont typés. On ne devine pas, on écrit le type.
    const c = await appeler(
        `query GetChannels($id: OrganizationId!) { channels(input: { organizationId: $id }) { id name service } }`,
        { id: org.id });
    if (!c.ok) return { ok: false, erreur: c.erreur };

    const liste = Array.isArray(c.donnees?.channels) ? c.donnees.channels : [];
    cache = { ok: true, organisation: { id: org.id, nom: org.name }, chaines: liste };
    return cache;
}

function oublier() { cache = null; }

// ── LE CHOIX EXPLICITE ────────────────────────────────────────────────────
//
//     BUFFER_CANAUX=linkedin:abc|xyz,facebook:def
//
// Rend la liste d'identifiants choisis pour une plateforme, ou null si
// aucun choix n'a été posé.
function choixPose(slug) {
    const brut = String(process.env.BUFFER_CANAUX || "").trim();
    if (!brut) return null;
    for (const paire of brut.split(",")) {
        const [nom, ids] = paire.split(":").map((s) => (s || "").trim());
        if (nom.toLowerCase() !== String(slug).toLowerCase()) continue;
        const liste = ids.split("|").map((s) => s.trim()).filter(Boolean);
        return liste.length ? liste : null;
    }
    return null;
}

// Quelles chaînes Buffer servir pour cette plateforme. Refuse plutôt que de
// deviner quand plusieurs correspondent.
async function chainesPour(slug) {
    const propre = String(slug).toLowerCase();
    const service = SERVICE[propre];
    if (!service) return { ok: false, passeLaMain: true, erreur: `Buffer ne gère pas « ${slug} » dans cette version` };

    // Écarté volontairement par BUFFER_PLATEFORMES : ce n'est pas un échec,
    // c'est un choix. On passe donc la main au provider suivant (Meta pour
    // Facebook), au lieu de bloquer.
    if (!sert(propre)) {
        return { ok: false, passeLaMain: true, erreur: motifEcart(propre) };
    }

    const c = await chaines();
    if (!c.ok) return { ok: false, erreur: c.erreur };

    const correspondantes = c.chaines.filter((x) => String(x.service).toLowerCase() === service);
    if (!correspondantes.length) {
        return {
            ok: false,
            // Ce n'est PAS un échec de publication : Buffer n'a simplement
            // pas cette plateforme. Le registre doit donc essayer le
            // provider suivant plutôt que de s'arrêter là.
            //
            // Vu en vrai : le plan gratuit de Buffer plafonne à 3 chaînes, et
            // les trois sont prises par LinkedIn (×2) et Instagram. Facebook
            // n'y est pas.
            passeLaMain: true,
            erreur: `aucune chaîne ${service} connectée dans Buffer `
                  + `(connectées : ${c.chaines.map((x) => x.service).join(", ") || "aucune"})`,
        };
    }

    const choix = choixPose(slug);
    if (choix) {
        const retenues = correspondantes.filter((x) => choix.includes(x.id));
        if (!retenues.length) {
            return {
                ok: false,
                erreur: `BUFFER_CANAUX désigne ${choix.join("|")} pour ${slug}, `
                      + `mais aucune de ces chaînes n'existe (disponibles : `
                      + correspondantes.map((x) => `${x.name}=${x.id}`).join(", ") + ")",
            };
        }
        return { ok: true, chaines: retenues };
    }

    // Une seule : pas d'ambiguïté possible.
    if (correspondantes.length === 1) return { ok: true, chaines: correspondantes };

    // Plusieurs, et aucun choix posé. On REFUSE. Publier sur les deux
    // LinkedIn parce que personne n'a tranché serait la pire réponse.
    return {
        ok: false,
        erreur: `${correspondantes.length} chaînes ${service} dans Buffer, aucune n'est désignée. `
              + `Pose BUFFER_CANAUX — par exemple ${slug}:${correspondantes[0].id} `
              + `(ou ${slug}:${correspondantes.map((x) => x.id).join("|")} pour publier sur toutes). `
              + `Chaînes : ${correspondantes.map((x) => `${x.name}=${x.id}`).join(", ")}`,
    };
}

// ── PUBLIER ───────────────────────────────────────────────────────────────
//
// `mode` :
//   addToQueue      → Buffer place dans la file, à son propre créneau
//   customScheduled → à une date précise (dueAt)
//
// On utilise `customScheduled` quand une date est donnée, `addToQueue`
// sinon. `schedulingType: automatic` laisse Buffer choisir l'heure de la
// file — c'est ce qu'on veut pour un « publie maintenant », Buffer étant
// justement l'outil qui sait quand publier.
async function publier({ plateforme, texte, media, mediaType, quand }) {
    if (!configure()) return { ok: false, erreur: "BUFFER_ACCESS_TOKEN n'est pas posée" };
    if (!texte) return { ok: false, erreur: "texte vide" };

    const cibles = await chainesPour(plateforme);
    if (!cibles.ok) return { ok: false, erreur: cibles.erreur, passeLaMain: !!cibles.passeLaMain };

    const resultats = [];
    for (const chaine of cibles.chaines) {
        const entree = {
            text: texte,
            channelId: chaine.id,
            schedulingType: quand ? "customScheduled" : "automatic",
            mode: quand ? "customScheduled" : "addToQueue",
        };
        if (quand) entree.dueAt = new Date(quand).toISOString();

        // ── UNE VIDÉO N'EST PAS UNE IMAGE ────────────────────────────────
        //
        // Envoyer l'URL d'un .mp4 dans `imageUrl` est la façon la plus
        // simple de faire échouer un Reel : Buffer essaie de le traiter
        // comme une image, et le message d'erreur qui revient ne parle pas
        // de vidéo. On distingue donc explicitement.
        //
        // Le type est déduit de l'extension quand l'appelant ne le donne
        // pas : c'est imparfait, mais c'est mieux que de tout traiter
        // comme une image.
        if (media) {
            const type = String(mediaType || "").toLowerCase()
                || (/\.(mp4|mov|m4v|webm)(\?|$)/i.test(media) ? "video" : "image");
            if (type === "video") entree.videoUrl = media;
            else entree.imageUrl = media;
        }

        const r = await appeler(
            `mutation Publier($input: CreatePostInput!) {
                createPost(input: $input) {
                    ... on PostActionSuccess { post { id text } }
                    ... on MutationError { message }
                }
            }`,
            { input: entree });

        if (!r.ok) { resultats.push({ chaine: chaine.name, ok: false, erreur: r.erreur }); continue; }

        // La réponse est une union : le succès porte `post`, l'échec porte
        // `message`. Lire `post` sans vérifier prendrait une erreur pour un
        // succès — c'est le piège habituel de ce genre d'API.
        const charge = r.donnees?.createPost;
        if (charge?.message) { resultats.push({ chaine: chaine.name, ok: false, erreur: charge.message }); continue; }
        if (!charge?.post?.id) { resultats.push({ chaine: chaine.name, ok: false, erreur: "Buffer n'a pas rendu d'identifiant de publication" }); continue; }
        resultats.push({ chaine: chaine.name, ok: true, id: charge.post.id });
    }

    const reussis = resultats.filter((r) => r.ok);
    if (!reussis.length) {
        return { ok: false, erreur: resultats.map((r) => `${r.chaine} : ${r.erreur}`).join(" · ") };
    }
    // Un envoi partiel n'est pas un succès : dire « ok » alors qu'une des
    // deux pages LinkedIn n'a rien reçu, c'est ce qu'on ne découvre qu'en
    // allant regarder.
    if (reussis.length < resultats.length) {
        return {
            ok: false,
            erreur: `${reussis.length}/${resultats.length} chaînes seulement — `
                  + resultats.filter((r) => !r.ok).map((r) => `${r.chaine} : ${r.erreur}`).join(" · "),
            partiel: resultats,
        };
    }
    return {
        ok: true,
        id: reussis.map((r) => r.id).join(","),
        // Buffer n'expose pas d'URL publique de la publication programmée :
        // on renvoie celle de la file plutôt qu'un lien inventé.
        url: "https://publish.buffer.com/",
    };
}

// ── L'ÉTAT, POUR L'ÉCRAN DU FONDATEUR ─────────────────────────────────────
//
// Dit précisément ce qui est branché et ce qui manque. « Buffer ne marche
// pas » n'est pas une information ; « 2 chaînes linkedin, aucune désignée »
// en est une.
async function etat() {
    if (!configure()) return { configure: false, raison: "BUFFER_ACCESS_TOKEN n'est pas posée" };
    const c = await chaines();
    if (!c.ok) return { configure: true, joignable: false, raison: c.erreur };

    const parPlateforme = {};
    for (const slug of Object.keys(SERVICE)) {
        const r = await chainesPour(slug);
        parPlateforme[slug] = r.ok
            ? { pret: true, chaines: r.chaines.map((x) => ({ id: x.id, nom: x.name })) }
            : { pret: false, raison: r.erreur };
    }
    return {
        configure: true,
        joignable: true,
        // Ce que Buffer a le DROIT de servir, pour que l'écran ne laisse pas
        // croire qu'il couvre Facebook alors qu'on l'en a écarté.
        autorisees: plateformesAutorisees(),
        organisation: c.organisation,
        // Aucune donnée sensible ici : des noms de pages et des identifiants
        // de chaînes, pas de jeton.
        chainesBuffer: c.chaines.map((x) => ({ id: x.id, nom: x.name, service: x.service })),
        parPlateforme,
    };
}

module.exports = {
    nom: "buffer",
    // Les quatre plateformes que Buffer sait servir chez nous. Telegram et
    // WhatsApp n'y sont PAS : Buffer ne les gère pas, et SAMII sait déjà les
    // faire elle-même.
    plateformes: ["facebook", "instagram", "linkedin", "tiktok"],
    publier,
    etat, chaines, chainesPour, oublier, configure, sert, motifEcart, plateformesAutorisees,
    // Exposé pour le collecteur de statistiques : il a besoin d'interroger
    // Buffer avec sa propre requête, sans réécrire l'authentification ni la
    // gestion d'erreur — deux copies du même appel divergeraient.
    interroger: appeler,
    ADRESSE, SERVICE,
};
