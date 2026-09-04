// ==========================================================================
// RÉPONDRE AUX COMMENTAIRES — LE LEVIER D'ABONNÉS LE MOINS CHER
// ==========================================================================
//
// ── LE TROU QUE CE FICHIER BOUCHE ─────────────────────────────────────────
//
// `services/meta.js` sait répondre à un commentaire Facebook ET à un
// commentaire Instagram depuis le début. Vérifié : ces deux fonctions
// n'étaient appelées NULLE PART. Du code écrit, testé par personne, et
// jamais branché — donc strictement équivalent à du code absent.
//
// Or c'est le geste qui recrute. Instagram et Facebook pondèrent très fort
// les réponses sous un post, et quelqu'un à qui on répond revient. Un
// commentaire sans réponse, c'est une personne qui a fait le premier pas et
// à qui on a tourné le dos.
//
// ── POURQUOI LA LOGIQUE VIT ICI ET PAS DANS LA ROUTE ──────────────────────
//
// Parce qu'une route ne se teste qu'avec un serveur HTTP, une signature
// valide et une charge Meta complète. Séparée, la décision « répond-on, et
// quoi ? » se vérifie en trois lignes. Le fichier de route ne garde que ce
// qui est vraiment du HTTP : la signature et l'accusé de réception.
//
// ── LES QUATRE PIÈGES, PAR ORDRE DE GRAVITÉ ───────────────────────────────
//
// 1. LA BOUCLE. Meta renvoie NOS PROPRES réponses comme de nouveaux
//    commentaires. Sans garde, SAMII se répond à elle-même, et Meta
//    renvoie cette réponse, et ainsi de suite — sur une vraie page, devant
//    de vraies personnes, jusqu'à la limite de débit. C'est le seul défaut
//    de cette liste qui fasse des dégâts publics et irréversibles.
//
// 2. LE DOUBLON. Meta réessaie une livraison quand il n'a pas eu son 200
//    assez vite. Le même commentaire arrive deux fois, et SAMII répond
//    deux fois.
//
// 3. L'AMBIGUÏTÉ DU WORKSPACE. Mesuré en base : le MÊME `pageId`
//    (1104617002736031) est actif sur TROIS workspaces différents. Résoudre
//    « le workspace de cette page » rend donc plusieurs lignes. Prendre la
//    première venue est le défaut qu'on a déjà payé sur le choix du QG :
//    sans ORDER BY, la réponse change d'un appel à l'autre.
//
// 4. LE CONTENU. Un commentaire est public. Une réponse ratée est visible
//    par tout le monde et ne s'efface pas des captures d'écran.

const db = require("../../services/db");
const meta = require("../../services/meta");
const connectorService = require("../../services/connectorService");
const gemini = require("../../services/geminiService");
const { IDENTITE } = require("./agents/creator");

// ── L'ARRÊT D'URGENCE ─────────────────────────────────────────────────────
//
// Lu à chaque appel, comme partout ailleurs dans ce dépôt : couper une
// réponse automatique qui part de travers doit prendre effet tout de suite,
// pas au prochain déploiement.
function actif() {
    return String(process.env.SOCIAL_REPONSES_COMMENTAIRES || "").trim().toUpperCase() === "OUI";
}

// ── QUI SOMMES-NOUS ───────────────────────────────────────────────────────
//
// La liste des identités qui sont NOUS : la Page et le compte Instagram.
// Tout commentaire venant d'une de ces identités est une de nos propres
// réponses qui nous revient — on ne répond jamais à soi-même.
function estNous({ auteurId, pageId, igAccountId }) {
    const nous = [pageId, igAccountId].filter(Boolean).map(String);
    return nous.includes(String(auteurId || ""));
}

// ── LE WORKSPACE, CHOISI UNE FOIS ET TOUJOURS LE MÊME ─────────────────────
//
// `SOCIAL_WORKSPACE` gagne quand il correspond : c'est une décision écrite
// par un humain, elle bat n'importe quel tri. Sinon on ordonne — jamais un
// LIMIT 1 sans ORDER BY, qui rend une ligne différente selon l'humeur du
// planificateur de requêtes.
async function workspaceDe({ pageId, igAccountId }) {
    const champ = igAccountId ? "igAccountId" : "pageId";
    const valeur = igAccountId || pageId;
    if (!valeur) return null;

    try {
        const rows = await db.query(
            `SELECT workspace_id, type
               FROM connecteurs
              WHERE actif = TRUE
                AND type IN ('facebook','instagram')
                AND (config::jsonb)->>$1 = $2
              ORDER BY (workspace_id = $3) DESC,
                       (type = $4) DESC,
                       workspace_id ASC`,
            [champ, String(valeur), String(process.env.SOCIAL_WORKSPACE || ""),
             igAccountId ? "instagram" : "facebook"]);
        return rows[0]?.workspace_id || null;
    } catch (err) {
        console.error("❌ commentaires — workspace introuvable :", err.message);
        return null;
    }
}

// ── A-T-ON DÉJÀ RÉPONDU À CELUI-LÀ ────────────────────────────────────────
//
// La trace vit en base, pas en mémoire : un redémarrage de Render remettrait
// une mémoire à zéro et SAMII répondrait une deuxième fois à tout ce qui
// arrive juste après.
async function dejaRepondu(commentaireId) {
    try {
        const rows = await db.query(
            `SELECT 1 FROM journal WHERE action = 'social.commentaire.repondu' AND ref_id = $1 LIMIT 1`,
            [String(commentaireId)]);
        return rows.length > 0;
    } catch (err) {
        // Illisible : on s'abstient. Répondre deux fois en public est pire
        // que ne pas répondre — le premier se voit, le second se rattrape.
        console.error("❌ commentaires — anti-doublon illisible :", err.message);
        return true;
    }
}

async function marquer({ commentaireId, workspaceId, plateforme, texte }) {
    try {
        await db.query(
            `INSERT INTO journal (action, details, workspace_id, ref_id, created_at)
             VALUES ('social.commentaire.repondu', $1, $2, $3, NOW())`,
            [`${plateforme} — ${String(texte).slice(0, 300)}`, workspaceId || null, String(commentaireId)]);
    } catch (err) {
        console.error("❌ commentaires — trace non écrite :", err.message);
    }
}

// ── CE QUE SAMII RÉPOND ───────────────────────────────────────────────────
//
// Court, et sans lien. Un lien dans le premier commentaire fait chuter la
// portée sur les deux réseaux, et une réponse de cinq lignes sous un
// commentaire de quatre mots se lit comme un robot.
const LONGUEUR_MAX = 280;

async function ecrireReponse({ commentaire, auteur, plateforme, workspaceId }) {
    const message = `${IDENTITE}

Quelqu'un vient de commenter une publication de SAMII sur ${plateforme}.

Commentaire de ${auteur || "cette personne"} : « ${String(commentaire).slice(0, 500)} »

Écris LA réponse de SAMII. Règles :
- moins de ${LONGUEUR_MAX} caractères, une à deux phrases
- réponds à ce qui est DIT, ne récite pas une plaquette
- si c'est une question, réponds-y ; si c'est un compliment, remercie sans en faire trop
- si c'est une critique, prends-la au sérieux, sans te justifier longuement
- aucun lien, aucune adresse web
- pas de « N'hésitez pas à nous contacter »

Réponds UNIQUEMENT par le texte de la réponse, sans guillemets autour.`;

    const r = await gemini.chat({
        message,
        context: { source: "social-commentaires", workspaceId, audience: "souverain" },
        useTools: false,
    });

    // Le même piège que pour le créateur : quand toute la chaîne d'IA tombe,
    // `chat()` rend une phrase d'excuse dans un `{type:"text"}` normal. La
    // publier sous un post reviendrait à écrire « SAMII réfléchit un peu
    // plus longtemps que prévu » à un client, en public.
    if (r?.degrade) return { ok: false, raison: `aucune réponse de l'IA — ${r.motif || "chaîne épuisée"}` };
    const texte = String(r?.text || "").trim().replace(/^["«»\s]+|["«»\s]+$/g, "");
    if (!texte) return { ok: false, raison: "l'IA a renvoyé un texte vide" };
    if (texte.length > LONGUEUR_MAX * 2) return { ok: false, raison: `réponse trop longue (${texte.length} caractères)` };
    return { ok: true, texte: texte.slice(0, LONGUEUR_MAX) };
}

// ── LE TRAITEMENT D'UN COMMENTAIRE ────────────────────────────────────────
//
// Rend TOUJOURS un objet qui dit ce qui s'est passé, jamais une exception :
// un commentaire qui tourne mal ne doit pas emporter les suivants de la
// même livraison.
//
// Chaque refus porte sa raison. « Rien ne s'est passé » sans motif est
// exactement ce qui a coûté une journée sur le cycle social.
async function traiter({ plateforme, commentaireId, texte, auteurId, auteurNom,
                         pageId, igAccountId } = {}) {
    if (!actif()) return { fait: false, raison: "SOCIAL_REPONSES_COMMENTAIRES n'est pas à OUI" };
    if (!commentaireId) return { fait: false, raison: "commentaire sans identifiant" };
    if (!String(texte || "").trim()) return { fait: false, raison: "commentaire vide" };

    // LE GARDE LE PLUS IMPORTANT DU FICHIER. En premier, avant tout appel
    // réseau : c'est celui dont l'oubli se paie en public.
    if (estNous({ auteurId, pageId, igAccountId })) {
        return { fait: false, raison: "c'est notre propre réponse qui nous revient" };
    }

    if (await dejaRepondu(commentaireId)) {
        return { fait: false, raison: "déjà répondu à ce commentaire" };
    }

    const workspaceId = await workspaceDe({ pageId, igAccountId });
    if (!workspaceId) return { fait: false, raison: `aucun workspace actif pour ${igAccountId ? `le compte Instagram ${igAccountId}` : `la page ${pageId}`}` };

    const connecteur = await connectorService.getOne(workspaceId, plateforme === "instagram" ? "instagram" : "facebook");
    const jeton = connecteur?.config?.pageAccessToken;
    if (!jeton) return { fait: false, raison: `pas de jeton de page pour ${workspaceId}` };

    const reponse = await ecrireReponse({ commentaire: texte, auteur: auteurNom, plateforme, workspaceId });
    if (!reponse.ok) return { fait: false, raison: reponse.raison };

    // On marque AVANT d'envoyer. Si l'envoi réussit mais que la trace
    // échoue, la prochaine livraison du même commentaire ferait répondre une
    // seconde fois. Marquer d'abord peut faire perdre une réponse ; marquer
    // après peut en faire publier deux. Le premier se répare à la main.
    await marquer({ commentaireId, workspaceId, plateforme, texte: reponse.texte });

    try {
        if (plateforme === "instagram") await meta.replyToInstagramComment(jeton, commentaireId, reponse.texte);
        else await meta.replyToFacebookComment(jeton, commentaireId, reponse.texte);
    } catch (err) {
        const detail = err.response?.data?.error?.message || err.message;
        return { fait: false, raison: `Meta a refusé la réponse : ${detail}` };
    }

    return { fait: true, plateforme, commentaireId, workspaceId, reponse: reponse.texte };
}

// ── LIRE UNE LIVRAISON META ───────────────────────────────────────────────
//
// Une seule livraison porte plusieurs entrées, chaque entrée plusieurs
// changements. On ne garde que les AJOUTS de commentaires : `verb: "edited"`
// et `verb: "remove"` arrivent aussi, et répondre à une suppression n'a
// aucun sens.
//
// Facebook et Instagram ne rangent pas leurs champs pareil — d'où deux
// lectures, mais une seule forme en sortie.
function lireLivraison(corps) {
    const trouves = [];
    for (const entree of (Array.isArray(corps?.entry) ? corps.entry : [])) {
        for (const chgt of (Array.isArray(entree.changes) ? entree.changes : [])) {
            const v = chgt.value || {};

            // ── FACEBOOK : field « feed » ────────────────────────────────
            if (chgt.field === "feed") {
                if (v.item !== "comment" || v.verb !== "add") continue;
                trouves.push({
                    plateforme: "facebook",
                    commentaireId: v.comment_id,
                    texte: v.message,
                    auteurId: v.from?.id,
                    auteurNom: v.from?.name,
                    pageId: entree.id,
                });
                continue;
            }

            // ── INSTAGRAM : field « comments » ───────────────────────────
            if (chgt.field === "comments") {
                trouves.push({
                    plateforme: "instagram",
                    commentaireId: v.id,
                    texte: v.text,
                    auteurId: v.from?.id,
                    auteurNom: v.from?.username,
                    igAccountId: entree.id,
                });
            }
        }
    }
    return trouves;
}

async function traiterLivraison(corps) {
    const resultats = [];
    for (const c of lireLivraison(corps)) {
        try {
            resultats.push(await traiter(c));
        } catch (err) {
            resultats.push({ fait: false, raison: `erreur inattendue : ${err.message}` });
        }
    }
    return resultats;
}

module.exports = {
    traiter, traiterLivraison, lireLivraison,
    actif, estNous, workspaceDe, dejaRepondu, LONGUEUR_MAX,
};
