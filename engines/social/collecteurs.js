// ==========================================================================
// LES COLLECTEURS — CE QUI REND L'APPRENTISSAGE POSSIBLE
// ==========================================================================
//
// ── LE TROU QUE CE FICHIER BOUCHE ─────────────────────────────────────────
//
// `analytics.COLLECTEURS` était un objet VIDE. Aucune plateforme n'était
// branchée. Conséquence en chaîne :
//
//   aucun collecteur  →  `social_analytics` reste vide
//   table vide        →  `observations().releves` vaut toujours 0
//   0 relevé          →  sous MINIMUM_OBSERVATIONS (5)
//   sous le seuil     →  l'agent d'apprentissage REFUSE de conclure
//
// L'agent était donc honnête et définitivement muet. Il ne pouvait pas
// apprendre — pas par prudence, par absence de données.
//
// ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────
//
// Il n'invente aucun chiffre. Un collecteur qui ne peut pas mesurer rend
// `null`, et `analytics.collecter()` écrit alors « indisponible » avec son
// motif. C'est la consigne la plus importante du dossier : « ne pas créer un
// FAUX système d'apprentissage ». Des statistiques plausibles seraient pires
// que pas de statistiques, parce qu'on déciderait en s'appuyant dessus.
//
// ── POURQUOI ÇA MARCHE MAINTENANT ─────────────────────────────────────────
//
// « Meta a plein de choses en test, tout peut passer. Pour nous, tout
//   passe. »
//
// C'est exact, et je l'avais écrit à l'envers plusieurs fois : Meta n'exige
// la revue d'application que pour les utilisateurs TIERS. Un compte qui a un
// rôle sur l'app lit les statistiques de SES pages sans revue. Le collecteur
// Meta ci-dessous est donc utilisable dès aujourd'hui sur nos comptes.

const db = require("../../services/db");

// ── LA FORME COMMUNE ──────────────────────────────────────────────────────
//
// Chaque plateforme nomme ses chiffres autrement : Facebook dit
// `post_impressions`, Instagram dit `reach`, Buffer dit encore autre chose.
// On les ramène ICI à un vocabulaire unique, une seule fois, pour que
// l'agent d'apprentissage compare des choses comparables.
//
// `brut` garde la réponse d'origine : le jour où l'on veut une mesure qu'on
// n'avait pas prévue, elle est déjà en base.
function mesure({ vues, portee, likes, commentaires, partages, clics, brut }) {
    const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    return {
        mesures: {
            vues: n(vues),
            portee: n(portee),
            likes: n(likes),
            commentaires: n(commentaires),
            partages: n(partages),
            clics: n(clics),
        },
        brut,
    };
}

// ── LES IDENTIFIANTS DE META ──────────────────────────────────────────────
//
// `publishPagePost` rend un id de la forme « <pageId>_<postId> ». C'est cet
// identifiant complet qu'il faut interroger — le postId seul donne un 400
// qui ne dit pas pourquoi.
async function credentialsMeta(workspaceId, plateforme) {
    if (!workspaceId) return null;
    try {
        const connectorService = require("../../services/connectorService");
        const c = await connectorService.getOne(workspaceId, plateforme);
        if (!c?.config?.pageAccessToken) return null;
        return {
            accessToken: c.config.pageAccessToken,
            pageId: c.config.pageId || null,
            igUserId: c.config.igUserId || c.config.instagramId || null,
        };
    } catch (err) {
        console.warn(`⚠️ collecteur ${plateforme} — connecteur illisible :`, err.message);
        return null;
    }
}

const GRAPH = "https://graph.facebook.com/v25.0";

// ── FACEBOOK ──────────────────────────────────────────────────────────────
//
// Les métriques d'un post de Page. On demande les quatre qui existent
// toujours ; celles qu'une Page ne sert pas reviennent simplement absentes,
// et valent alors 0 plutôt que de faire échouer la lecture.
async function facebook(pub) {
    if (!pub.externe_id) return null;
    const creds = await credentialsMeta(pub.workspace_id, "facebook");
    if (!creds) return null;

    const axios = require("axios");
    try {
        const r = await axios.get(`${GRAPH}/${pub.externe_id}/insights`, {
            params: {
                metric: "post_impressions,post_impressions_unique,post_clicks,post_reactions_by_type_total",
                access_token: creds.accessToken,
            },
            timeout: 15000,
        });
        const par = {};
        for (const m of r.data?.data || []) par[m.name] = m.values?.[0]?.value;

        // Les réactions arrivent en objet {like: 3, love: 1, …} : on somme,
        // parce que « 4 réactions » est ce qui nous intéresse.
        const reactions = par.post_reactions_by_type_total;
        const likes = reactions && typeof reactions === "object"
            ? Object.values(reactions).reduce((a, b) => a + (Number(b) || 0), 0)
            : reactions;

        return mesure({
            vues: par.post_impressions,
            portee: par.post_impressions_unique,
            clics: par.post_clicks,
            likes,
            brut: r.data,
        });
    } catch (err) {
        // Un refus de Meta n'est PAS une mesure de zéro. Rendre `null` fait
        // écrire « indisponible » avec le motif, ce qui est la vérité.
        console.warn(`⚠️ collecteur facebook (${pub.externe_id}) :`,
                     err.response?.data?.error?.message || err.message);
        return null;
    }
}

// ── INSTAGRAM ─────────────────────────────────────────────────────────────
//
// Ne fonctionne QUE pour ce que nous avons publié nous-mêmes par Meta :
// l'identifiant rendu est alors un media_id Instagram, interrogeable.
//
// Ce qui part par Buffer rend un identifiant BUFFER, que le Graph d'Instagram
// ne connaît pas. On refuse alors explicitement plutôt que d'appeler et de
// récolter une erreur illisible.
async function instagram(pub) {
    if (!pub.externe_id) return null;
    if (pub.provider && pub.provider !== "meta") return null;
    const creds = await credentialsMeta(pub.workspace_id, "instagram");
    if (!creds) return null;

    const axios = require("axios");
    try {
        const r = await axios.get(`${GRAPH}/${pub.externe_id}/insights`, {
            params: { metric: "reach,likes,comments,shares,views", access_token: creds.accessToken },
            timeout: 15000,
        });
        const par = {};
        for (const m of r.data?.data || []) par[m.name] = m.values?.[0]?.value;
        return mesure({
            vues: par.views,
            portee: par.reach,
            likes: par.likes,
            commentaires: par.comments,
            partages: par.shares,
            brut: r.data,
        });
    } catch (err) {
        console.warn(`⚠️ collecteur instagram (${pub.externe_id}) :`,
                     err.response?.data?.error?.message || err.message);
        return null;
    }
}

// ── BUFFER ────────────────────────────────────────────────────────────────
//
// Le schéma réel, découvert par introspection sur le compte d'OG Technology
// (`__schema` interrogé depuis le Web Shell de Render, seul endroit d'où
// api.buffer.com est joignable) :
//
//     post(input: PostInput) -> Post
//     PostInput  { id: PostId }
//     Post       { metrics: [PostMetric], metricsUpdatedAt: DateTime, … }
//     PostMetric { name: String, type: PostMetricType, unit: …, value: Float }
//
// ── CE QUE J'AVAIS DEVINÉ FAUX ────────────────────────────────────────────
//
// J'avais écrit `metrics { impressions reach likes comments shares clicks }`,
// c'est-à-dire un OBJET aux champs nommés. C'est une LISTE. La requête
// aurait échoué — proprement, en rendant `null` avec le message de Buffer,
// mais elle n'aurait jamais rendu un chiffre.
//
// ── POURQUOI ON NE CODE PAS LES NOMS EN DUR ───────────────────────────────
//
// `type` est une énumération dont je ne connais pas les valeurs exactes, et
// `name` est une chaîne pensée pour être lue par un humain. Les deux peuvent
// changer, et ils diffèrent d'un réseau à l'autre : Instagram ne rend pas
// les mêmes métriques que LinkedIn.
//
// On reconnaît donc par ALIAS, sur `type` ET sur `name`, à la casse et à la
// ponctuation près. Ce qui n'est reconnu par aucun alias n'est pas perdu :
// `brut` garde la liste entière, et le jour où l'on veut une mesure de plus,
// elle est déjà en base.
const ALIAS = {
    vues:         ["impressions", "views", "videoviews", "plays", "postimpressions"],
    portee:       ["reach", "uniqueimpressions", "accountsreached"],
    likes:        ["likes", "reactions", "favorites"],
    commentaires: ["comments", "replies"],
    partages:     ["shares", "reposts", "retweets"],
    clics:        ["clicks", "linkclicks", "urlclicks", "postclicks"],
};

function normaliser(x) {
    return String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Range une liste de PostMetric dans notre vocabulaire. Quand deux métriques
// tombent dans la même case (« Impressions » et « Video views »), on garde
// la plus grande : sous-estimer une portée fausserait une comparaison.
function rangerMetriques(liste) {
    const sortie = {};
    for (const m of liste || []) {
        const valeur = Number(m?.value);
        if (!Number.isFinite(valeur)) continue;
        const cles = [normaliser(m.type), normaliser(m.name)];
        for (const [nôtre, alias] of Object.entries(ALIAS)) {
            if (cles.some((c) => c && alias.includes(c))) {
                sortie[nôtre] = Math.max(sortie[nôtre] || 0, valeur);
                break;
            }
        }
    }
    return sortie;
}

async function bufferMetrics(pub) {
    if (!pub.externe_id) return null;
    const buffer = require("./providers/buffer");
    if (!buffer.configure()) return null;

    // Un envoi Buffer peut viser plusieurs chaînes : l'identifiant est alors
    // « id1,id2 ». On mesure la première — additionner les portées de deux
    // réseaux différents ne voudrait rien dire.
    const id = String(pub.externe_id).split(",")[0].trim();

    // La variable est typée `PostInput!` plutôt que `PostId!` : c'est la
    // forme que le schéma déclare, et elle survit à un changement du scalaire.
    const r = await buffer.interroger(
        `query Mesures($input: PostInput!) {
            post(input: $input) {
                id
                metricsUpdatedAt
                metrics { name type unit value }
            }
        }`, { input: { id } });

    if (!r.ok) {
        console.warn(`⚠️ collecteur buffer (${id}) :`, r.erreur);
        return null;
    }
    const liste = r.donnees?.post?.metrics;
    // Une publication trop récente n'a pas encore de chiffres. Ce n'est pas
    // un échec, mais ce n'est pas non plus une mesure de zéro : on rend
    // `null` pour qu'elle soit relue au prochain passage.
    if (!Array.isArray(liste) || !liste.length) return null;

    const range = rangerMetriques(liste);
    if (!Object.keys(range).length) {
        console.warn(`⚠️ collecteur buffer (${id}) : ${liste.length} métrique(s) rendue(s), `
                   + `aucune reconnue — ${liste.map((m) => m.type || m.name).join(", ")}`);
        return null;
    }

    return mesure({ ...range, brut: r.donnees });
}

// Instagram et LinkedIn partent par Buffer : c'est lui qui a les chiffres.
// Instagram a DEUX chemins possibles selon qui a publié — on essaie celui
// qui correspond au provider, puis l'autre.
async function instagramOuBuffer(pub) {
    if (pub.provider === "buffer") return bufferMetrics(pub);
    return (await instagram(pub)) || (await bufferMetrics(pub));
}

// ── BRANCHER ──────────────────────────────────────────────────────────────
//
// Appelé une fois au chargement de `engines/social`. Séparé de l'agent
// `analytics` exprès : l'agent définit le CONTRAT, ce fichier fournit les
// implémentations. Le jour où une plateforme change d'API, un seul fichier
// bouge.
function brancher(analytics) {
    analytics.enregistrerCollecteur("facebook", facebook);
    analytics.enregistrerCollecteur("instagram", instagramOuBuffer);
    analytics.enregistrerCollecteur("linkedin", bufferMetrics);
    // Telegram : l'API des bots n'expose pas le nombre de vues d'un message
    // de canal. Pas de collecteur plutôt qu'un collecteur qui rend 0 — un
    // zéro faux se mélangerait aux vrais et fausserait toute moyenne.
    return Object.keys(analytics.COLLECTEURS);
}

module.exports = {
    brancher, facebook, instagram, bufferMetrics, instagramOuBuffer,
    mesure, rangerMetriques, normaliser, ALIAS, GRAPH,
};
