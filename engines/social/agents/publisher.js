// ==========================================================================
// AGENT 5 — LE PUBLIEUR
// ==========================================================================
//
// ── CE QU'IL NE FAIT PAS, ET C'EST L'ESSENTIEL ────────────────────────────
//
// « Le Publisher ne doit pas contenir la logique métier de SAMII. »
//
// Il ne décide RIEN. Il ne choisit pas la plateforme, ne réécrit pas le
// texte, ne juge pas la qualité, ne connaît pas l'identité d'OG Technology.
// Il prend une variante approuvée, appelle le provider, et écrit ce qui
// s'est passé.
//
// Le test à faire passer à toute modification de ce fichier : « est-ce que
// ça marcherait aussi bien pour une entreprise qui n'a rien à voir avec
// SAMII ? » Si la réponse est non, c'est que de la logique métier s'est
// glissée ici.
//
// ── L'INTERFACE DEMANDÉE ──────────────────────────────────────────────────
//
//     publishContent({ platform, content, media, scheduledAt })
//
// Elle est fournie telle quelle (`publishContent`), avec la version
// française employée dans le reste du code. Les deux appellent le même
// corps — pas deux implémentations qui divergeraient.

const store = require("../../../services/socialStore");
const providers = require("../providers");
const plateformes = require("../../../config/plateformes-sociales");
const base = require("./base");

const NOM = "publisher";

// Combien de fois on réessaie une publication ratée avant d'abandonner.
// Trois : au-delà, ce n'est plus un incident réseau, c'est un problème qui
// ne se règlera pas en insistant — et insister sur une API sociale, c'est
// se faire limiter.
const MAX_ESSAIS = 3;

// ── PROGRAMMER ────────────────────────────────────────────────────────────
//
// Ne publie pas : inscrit une intention. `quand = null` veut dire « dès que
// le planificateur passera ».
async function programmer({ workspaceId, variantId, plateforme, quand }) {
    return base.executer(NOM, { workspaceId, entree: { variantId, plateforme, quand } }, async () => {
        const variante = await store.getVariante(variantId);
        if (!variante) throw new Error(`variante ${variantId} introuvable`);
        if (variante.statut !== "approved") {
            // Publier ce que le relecteur n'a pas approuvé viderait le
            // relecteur de son sens.
            throw new Error(`variante ${variantId} non approuvée (statut : ${variante.statut})`);
        }
        const pub = await store.programmer({
            variantId, workspaceId,
            plateforme: plateforme || variante.plateforme,
            quand: quand || null,
        });
        return { publicationId: pub.id, statut: pub.statut, programmeeLe: pub.programmee_le };
    });
}

// ── ENVOYER UNE PUBLICATION ───────────────────────────────────────────────
//
// Le cœur. Prend une ligne de `social_publications`, appelle le provider,
// écrit le résultat. Ne lève jamais.
async function envoyer(publication) {
    const debut = Date.now();
    await store.majPublication(publication.id, { statut: "publishing" });

    const resultat = await providers.publier({
        plateforme: publication.plateforme,
        texte: [publication.texte, publication.hashtags].filter(Boolean).join("\n\n"),
        media: publication.media_url,
        mediaType: publication.media_type,
        workspaceId: publication.workspace_id,
        variantId: publication.variant_id,
    });

    if (resultat.ok) {
        await store.majPublication(publication.id, {
            statut: "published",
            externeId: resultat.id,
            externeUrl: resultat.url,
            provider: resultat.provider,
            incrementerEssai: true,
        });
        return { ok: true, publicationId: publication.id, simulation: resultat.simulation, dureeMs: Date.now() - debut };
    }

    // Échec. On a le droit de réessayer tant qu'on n'a pas épuisé les essais.
    const essais = (publication.essais || 0) + 1;
    const encore = essais < MAX_ESSAIS;
    await store.majPublication(publication.id, {
        // `scheduled` = le planificateur le reprendra. `failed` = terminé.
        statut: encore ? "scheduled" : "failed",
        provider: resultat.provider,
        // Le message EXACT de la plateforme, jamais remplacé par une phrase
        // inventée : c'est la seule chose qui dira un jour « permission
        // pages_manage_posts manquante » plutôt que « échec ».
        erreur: resultat.erreur,
        incrementerEssai: true,
    });
    return {
        ok: false, publicationId: publication.id, erreur: resultat.erreur,
        essais, reessaiPrevu: encore, dureeMs: Date.now() - debut,
    };
}

// ── L'INTERFACE DEMANDÉE ──────────────────────────────────────────────────
//
// Programme puis, si aucune date n'est donnée, envoie tout de suite.
async function publierContenu({ platform, plateforme, content, texte, media, scheduledAt, quand, workspaceId, variantId }) {
    const cible = platform || plateforme;
    if (!plateformes.existe(cible)) return { ok: false, erreur: `plateforme inconnue : ${cible}` };

    const prog = await programmer({
        workspaceId, variantId, plateforme: cible, quand: scheduledAt || quand || null,
    });
    if (!prog.ok) return prog;

    // Une date dans le futur : on s'arrête là, le planificateur prendra le
    // relais.
    const date = scheduledAt || quand;
    if (date && new Date(date) > new Date()) {
        return { ok: true, programmee: true, publicationId: prog.publicationId, pour: date };
    }

    const lignes = await store.aPublierMaintenant(50);
    const ligne = lignes.find((l) => l.id === prog.publicationId);
    if (!ligne) return { ok: true, programmee: true, publicationId: prog.publicationId };
    return envoyer(ligne);
}

// ── LE PASSAGE DU PLANIFICATEUR ───────────────────────────────────────────
//
// Appelé périodiquement. Publie ce qui est dû. Une plateforme en panne ne
// doit PAS empêcher les autres : chaque envoi est isolé.
async function passer({ limite = 20 } = {}) {
    if (base.estCoupe(NOM)) return { coupe: true, traitees: 0 };
    const dues = await store.aPublierMaintenant(limite);
    const resultats = [];
    for (const ligne of dues) {
        try {
            resultats.push(await envoyer(ligne));
        } catch (err) {
            console.error(`❌ publieur — publication ${ligne.id} :`, err.message);
            resultats.push({ ok: false, publicationId: ligne.id, erreur: err.message });
        }
    }
    return {
        traitees: resultats.length,
        reussies: resultats.filter((r) => r.ok).length,
        ratees: resultats.filter((r) => !r.ok).length,
        resultats,
    };
}

module.exports = {
    NOM, MAX_ESSAIS,
    programmer, envoyer, passer,
    publierContenu,
    // Le nom exact de l'énoncé, pour que l'appel décrit dans la mission
    // fonctionne tel quel.
    publishContent: publierContenu,
};
