// ==========================================================================
// PROVIDER WHATSAPP
// ==========================================================================
//
// ── WHATSAPP N'EST PAS UN FIL, ET C'EST TOUT LE PROBLÈME ──────────────────
//
// Sur Facebook ou Telegram, « publier » veut dire : déposer un contenu à un
// endroit, et ceux qui passent le voient. Sur WhatsApp, ça n'existe pas. Il
// n'y a que des messages envoyés à des NUMÉROS.
//
// Une « publication WhatsApp » est donc forcément un envoi à une liste de
// destinataires. Ce provider a besoin de cette liste. Sans elle, il REFUSE
// — il n'invente pas un destinataire, et il ne se contente pas d'un
// « succès » qui n'aurait touché personne.
//
// Le registre des plateformes marque WhatsApp `genre: "message"` justement
// pour que cette différence soit visible partout, et pas redécouverte ici.
//
// ── CE QUI EXISTE DÉJÀ ────────────────────────────────────────────────────
//
// `services/whatsapp.js` sait envoyer, avec les identifiants Green API du
// marchand (`resolveCredentials`) et un repli sur le canal interne. Ce
// provider l'appelle. Aucun appel HTTP n'est réécrit ici.
//
// ── LE DANGER PROPRE À CE CANAL ───────────────────────────────────────────
//
// Un envoi en masse sur WhatsApp fait bannir un numéro. Ce n'est pas une
// erreur qu'on corrige au déploiement suivant : le numéro est perdu, avec
// les conversations clients qu'il portait. D'où la borne dure ci-dessous —
// et le fait qu'elle ne soit PAS réglable par variable d'environnement. Une
// limite qu'on peut lever depuis un tableau de bord finit toujours levée un
// soir de lancement.

const whatsapp = require("../../../services/whatsapp");

// Volontairement en dur. Voir ci-dessus.
const MAX_DESTINATAIRES = 20;

async function publier({ texte, workspaceId, destinataires }) {
    if (!texte) return { ok: false, erreur: "texte vide" };

    const liste = Array.isArray(destinataires) ? destinataires.filter(Boolean) : [];
    if (!liste.length) {
        return {
            ok: false,
            erreur: "WhatsApp n'est pas un fil : il faut une liste de destinataires. "
                  + "L'envoi à une liste depuis les agents sociaux n'est pas encore construit.",
        };
    }
    if (liste.length > MAX_DESTINATAIRES) {
        return {
            ok: false,
            erreur: `${liste.length} destinataires demandés, ${MAX_DESTINATAIRES} au maximum — `
                  + "un envoi en masse fait bannir le numéro WhatsApp.",
        };
    }

    const resultats = [];
    for (const numero of liste) {
        try {
            const r = await whatsapp.send(numero, texte, workspaceId);
            resultats.push({ numero, ok: !!r?.success, erreur: r?.error || null });
        } catch (err) {
            resultats.push({ numero, ok: false, erreur: err.message });
        }
    }

    const reussis = resultats.filter((r) => r.ok).length;
    // Un envoi partiel n'est PAS un succès : dire « ok » alors que la moitié
    // des clientes n'ont rien reçu, c'est le genre de mensonge qu'on ne
    // découvre qu'en recevant une réclamation.
    if (reussis === 0) {
        return { ok: false, erreur: `aucun des ${liste.length} envois n'est passé` };
    }
    if (reussis < liste.length) {
        return {
            ok: false,
            erreur: `${reussis} envoi(s) sur ${liste.length} seulement`,
            partiel: resultats,
        };
    }
    return { ok: true, id: `wa_${reussis}_destinataires` };
}

module.exports = {
    nom: "whatsapp",
    plateformes: ["whatsapp"],
    publier,
    MAX_DESTINATAIRES,
};
