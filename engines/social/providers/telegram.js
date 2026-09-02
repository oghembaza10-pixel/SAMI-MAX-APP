// ==========================================================================
// PROVIDER TELEGRAM
// ==========================================================================
//
// Telegram est le seul canal de cette V1 qui publie DÉJÀ du contenu éditorial
// en production : `engines/canalEngine.js` envoie un post par jour sur le
// canal SAMII. Ce provider emprunte le même chemin.
//
// ── DEUX DESTINATIONS, PAS UNE ────────────────────────────────────────────
//
//   sans workspaceId  → le canal SAMII (CONFIG.TELEGRAM.CHANNEL_USERNAME),
//                       c'est-à-dire NOTRE audience
//   avec workspaceId  → le canal du marchand, s'il en a connecté un
//
// Se tromper de destination ici, c'est publier le contenu d'un marchand sur
// notre canal, ou l'inverse. D'où la résolution explicite et le refus net
// quand aucune destination n'est trouvée : mieux vaut ne rien publier que
// publier au mauvais endroit.
//
// ── MARKDOWN ──────────────────────────────────────────────────────────────
//
// Telegram refuse un message dont le Markdown est mal formé — un astérisque
// isolé suffit. `canalEngine` avait déjà rencontré le problème et le
// contourne en réessayant en texte brut. On reprend la même parade : le
// contenu part, quitte à perdre la mise en forme. Perdre du gras vaut mieux
// que perdre le message.

const CONFIG = require("../../../config");
const telegramService = require("../../../services/telegramService");
const connectorService = require("../../../services/connectorService");

async function destination(workspaceId) {
    if (!workspaceId) {
        const canal = CONFIG.TELEGRAM?.CHANNEL_USERNAME || "";
        return canal ? { cible: canal, quoi: "canal SAMII" } : null;
    }
    try {
        const c = await connectorService.getOne(workspaceId, "telegram");
        if (!c?.actif) return null;
        // `canalId` pour un canal public, `chatId` pour une conversation :
        // les deux existent dans `connecteurs` selon la façon dont le
        // marchand s'est branché.
        const cible = c.config?.canalId || c.config?.chatId || "";
        return cible ? { cible, quoi: "canal du marchand" } : null;
    } catch {
        return null;
    }
}

async function publier({ texte, workspaceId }) {
    if (!texte) return { ok: false, erreur: "texte vide" };

    const dest = await destination(workspaceId);
    if (!dest) {
        return {
            ok: false,
            erreur: workspaceId
                ? "aucun canal Telegram connecté pour cet espace"
                : "CONFIG.TELEGRAM.CHANNEL_USERNAME n'est pas posée",
        };
    }

    let r = await telegramService.send(dest.cible, texte, null, "Markdown");
    if (!r.success) {
        // Même repli que canalEngine : le Markdown de SAMII n'est pas
        // toujours valide aux yeux de Telegram.
        r = await telegramService.send(dest.cible, texte, null, null);
    }
    if (!r.success) return { ok: false, erreur: r.error || "envoi Telegram refusé" };

    // Telegram rend un `message_id`. C'est ce qui permettra à l'agent
    // d'analyse d'aller rechercher les vues plus tard — sans lui, on ne
    // saurait pas de quelle publication on parle.
    const id = r.message_id || r.result?.message_id || null;
    return { ok: true, id: id ? String(id) : null };
}

module.exports = {
    nom: "telegram",
    plateformes: ["telegram"],
    publier,
};
