// ==========================================================================
// AGENT 2 — LE CRÉATEUR DE CONTENU
// ==========================================================================
//
// Il écrit UNE fois. Le contenu qu'il produit est la source ; c'est
// l'adaptateur, juste après, qui en fait sept versions.
//
// ── POURQUOI IL N'ÉCRIT PAS DIRECTEMENT PAR PLATEFORME ────────────────────
//
// Parce qu'alors sept textes seraient écrits en parallèle, sans lien entre
// eux, et le même message finirait dit de sept manières qui ne se
// ressemblent plus. Une idée d'abord, ses déclinaisons ensuite : c'est ce
// qui garde une campagne cohérente.
//
// ── L'IDENTITÉ ────────────────────────────────────────────────────────────
//
// « Le contenu doit respecter l'identité OG Technology / SAMII. »
//
// Elle est écrite ici, en un seul endroit, et pas recopiée dans chaque
// invite. Le jour où le ton change, il change une fois.

const base = require("./base");

const NOM = "creator";

// L'identité, dite une fois. Volontairement concrète : « soyez
// professionnel » ne produit rien, « pas de superlatif creux » si.
const IDENTITE = `SAMII est l'assistante IA d'OG Technology, faite pour les commerçants
et marchands d'Afrique francophone (Cameroun, Côte d'Ivoire, Sénégal, Algérie, Maroc…).

Ton : direct, concret, respectueux. Tu parles à quelqu'un qui tient une boutique
et n'a pas de temps à perdre.

Interdits :
- pas de superlatif creux (« révolutionnaire », « incroyable », « game changer »)
- pas de promesse chiffrée qu'on ne peut pas tenir (« ×10 vos ventes »)
- pas de jargon technique non expliqué
- pas de familiarité forcée ni d'emojis en rafale`;

async function creer({ workspaceId, theme, objectif, angle } = {}) {
    return base.executer(NOM, { workspaceId, entree: { theme, objectif, angle } }, async () => {
        if (!theme) throw new Error("aucun thème donné au créateur");

        const message = `${IDENTITE}

Écris UN contenu source sur ce thème : « ${theme} ».
${objectif ? `Objectif : ${objectif}` : ""}
${angle ? `Angle imposé : ${angle}` : ""}

Ce contenu sera ensuite adapté à plusieurs plateformes — écris donc le FOND,
pas encore la mise en forme d'un réseau précis.

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "titre": "titre interne court, pour s'y retrouver dans une liste",
  "contenu": "le texte principal, 3 à 6 phrases, l'idée complète",
  "hook": "une accroche de moins de 90 caractères",
  "cta": "un appel à l'action concret, une seule action",
  "hashtags": ["5 mots-clés pertinents, sans le #"],
  "idee_visuel": "ce qu'on devrait montrer en image, décrit en une phrase",
  "script_video": "un script de 20 secondes, parlé, pour une vidéo courte"
}`;

        const brut = await base.demander(message, { workspaceId, source: "social-creator" });
        const json = base.lireJson(brut);

        // Un contenu vide qui remonterait la chaîne serait publié comme tel.
        // On refuse ici, à la source.
        if (!json?.contenu || String(json.contenu).trim().length < 40) {
            throw new Error("le créateur n'a pas produit de contenu exploitable");
        }

        return {
            titre: String(json.titre || theme).slice(0, 200),
            contenu: String(json.contenu).trim(),
            hook: String(json.hook || "").slice(0, 200),
            cta: String(json.cta || "").slice(0, 200),
            hashtags: (Array.isArray(json.hashtags) ? json.hashtags : [])
                .map((h) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 10),
            ideeVisuel: String(json.idee_visuel || "").slice(0, 500),
            scriptVideo: String(json.script_video || "").slice(0, 2000),
        };
    });
}

module.exports = { NOM, creer, IDENTITE };
