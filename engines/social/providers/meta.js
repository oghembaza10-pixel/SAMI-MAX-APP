// ==========================================================================
// PROVIDER META — Facebook, Instagram, Messenger
// ==========================================================================
//
// ── IL NE RÉÉCRIT RIEN ────────────────────────────────────────────────────
//
// `engines/autopostEngine.js` sait déjà publier sur la page Facebook et le
// compte Instagram d'un marchand : il lit `connecteurs`, vérifie le jeton,
// appelle `services/meta`, et traduit l'erreur de Meta en message lisible.
// Ce code tourne en production et a déjà été corrigé plusieurs fois.
//
// Ce provider l'APPELLE. Il n'ouvre aucune connexion HTTP vers Meta. Écrire
// ici une deuxième version de `publishPagePost` aurait créé deux chemins
// vers Facebook, dont un seul serait corrigé le jour d'un changement d'API.
//
// ── FACEBOOK ET MESSENGER NE SONT PAS LA MÊME CHOSE ───────────────────────
//
// C'est le piège de tout ce dossier. « Facebook » = publier sur une page,
// vu par tout le monde. « Messenger » = écrire à UNE personne, dans sa
// boîte. `services/facebook.js` fait le second, pas le premier.
//
// Messenger a donc besoin d'un destinataire. Sans lui, ce provider REFUSE
// au lieu d'envoyer dans le vide — et le dit.
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
// ── LES PERMISSIONS META ──────────────────────────────────────────────────
//
// Publier sur une page demande `pages_manage_posts`, qui n'a PAS encore été
// accordée (les quatre obtenues sont public_profile, email, pages_show_list,
// business_management, ads_management, ads_read). Une tentative de
// publication échouera donc côté Meta avec une erreur de permission — c'est
// attendu, et le message d'erreur exact est conservé dans
// `social_publications.erreur` plutôt que remplacé par une phrase inventée.

const autopost = require("../../autopostEngine");
const connectorService = require("../../../services/connectorService");

async function publier({ plateforme, texte, media, workspaceId }) {
    if (!workspaceId) return { ok: false, erreur: "workspaceId manquant" };

    if (plateforme === "facebook") {
        // Exactement la fonction utilisée par l'auto-post quotidien.
        const r = await autopost.publierFacebook(workspaceId, {
            legende: texte, imageUrl: media || null,
        });
        return r.success ? { ok: true, id: r.id || null } : { ok: false, erreur: r.error };
    }

    if (plateforme === "instagram") {
        // Instagram REFUSE une publication sans image — ce n'est pas une
        // préférence de style, c'est l'API. On le dit ici plutôt que de
        // laisser Meta renvoyer une erreur obscure.
        if (!media) return { ok: false, erreur: "Instagram exige une image ou une vidéo" };
        const r = await autopost.publierInstagram(workspaceId, {
            legende: texte, imageUrl: media,
        });
        return r.success ? { ok: true, id: r.id || null } : { ok: false, erreur: r.error };
    }

    if (plateforme === "messenger") {
        // Un message a un destinataire. Une publication n'en a pas. Tant que
        // le système d'agents ne gère pas de listes de destinataires, on
        // refuse clairement au lieu d'inventer un comportement.
        return {
            ok: false,
            erreur: "Messenger demande un destinataire — l'envoi à une liste n'est pas encore construit",
        };
    }

    return { ok: false, erreur: `plateforme ${plateforme} non gérée par le provider Meta` };
}

// Le publieur ne s'en sert pas pour décider (c'est le registre qui décide),
// mais l'interface l'affiche : « Instagram : pas connecté » est une réponse
// utile, « échec » ne l'est pas.
async function connecte(workspaceId, plateforme) {
    try {
        const c = await connectorService.getOne(workspaceId, plateforme);
        return !!(c?.actif && c.config?.pageAccessToken);
    } catch {
        return false;
    }
}

module.exports = {
    nom: "meta",
    plateformes: ["facebook", "instagram", "messenger"],
    publier,
    connecte,
};
