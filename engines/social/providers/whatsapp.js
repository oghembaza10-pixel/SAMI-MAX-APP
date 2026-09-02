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
const connectorService = require("../../../services/connectorService");

// Volontairement en dur. Voir ci-dessus.
const MAX_DESTINATAIRES = 20;

// ── D'OÙ VIENT LA LISTE ───────────────────────────────────────────────────
//
// Trois sources, dans cet ordre :
//
//   1. celle passée à l'appel           — un envoi ponctuel décidé sur le moment
//   2. `connecteurs.config.diffusion`   — la liste du marchand, posée une fois
//   3. `WHATSAPP_DIFFUSION`             — la nôtre, sur Render
//
// L'ordre compte : ce qu'on demande explicitement l'emporte toujours sur ce
// qui est enregistré. Sans ça, une liste oubliée en base recevrait un
// message destiné à quelqu'un d'autre.
//
// Les numéros sont normalisés (chiffres et « + » seulement) et dédoublonnés :
// un numéro écrit deux fois dans la liste, c'est une cliente qui reçoit deux
// fois le même message.
function nettoyer(liste) {
    const vus = new Set();
    return (liste || [])
        .map((n) => String(n || "").replace(/[^\d+]/g, "").trim())
        .filter((n) => {
            if (n.length < 8) return false;      // ce n'est pas un numéro
            if (vus.has(n)) return false;
            vus.add(n);
            return true;
        });
}

async function resoudreDestinataires({ destinataires, workspaceId }) {
    const donnes = nettoyer(destinataires);
    if (donnes.length) return { liste: donnes, source: "appel" };

    if (workspaceId) {
        try {
            const c = await connectorService.getOne(workspaceId, "whatsapp");
            const enregistres = nettoyer(c?.config?.diffusion);
            if (enregistres.length) return { liste: enregistres, source: "connecteur du marchand" };
        } catch { /* pas de connecteur : on continue */ }
    }

    const nôtre = nettoyer(String(process.env.WHATSAPP_DIFFUSION || "").split(","));
    if (nôtre.length) return { liste: nôtre, source: "WHATSAPP_DIFFUSION" };

    return { liste: [], source: null };
}

async function publier({ texte, workspaceId, destinataires }) {
    if (!texte) return { ok: false, erreur: "texte vide" };

    const { liste, source } = await resoudreDestinataires({ destinataires, workspaceId });
    if (!liste.length) {
        return {
            ok: false,
            erreur: "WhatsApp n'est pas un fil : il faut des destinataires. "
                  + "Aucun n'a été trouvé — ni dans l'appel, ni dans le connecteur du marchand "
                  + "(config.diffusion), ni dans WHATSAPP_DIFFUSION.",
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
    // La source est dans l'identifiant : en relisant `social_publications`
    // dans six mois, « à qui ce message est-il parti » a une réponse.
    return { ok: true, id: `wa_${reussis}_destinataires_via_${String(source).replace(/\s+/g, "_")}` };
}

module.exports = {
    nom: "whatsapp",
    plateformes: ["whatsapp"],
    publier,
    // Exportées pour que les tests puissent vérifier la résolution et le
    // nettoyage sans envoyer un seul message.
    resoudreDestinataires, nettoyer,
    MAX_DESTINATAIRES,
};
