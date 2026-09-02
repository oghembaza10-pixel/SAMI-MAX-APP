// ==========================================================================
// AGENT 3 — L'ADAPTATEUR DE PLATEFORME
// ==========================================================================
//
// Un contenu entre, sept versions sortent.
//
// ── LA RÈGLE À NE PAS ENFREINDRE ──────────────────────────────────────────
//
// « NE PAS publier exactement le même texte partout. »
//
// Ce n'est pas une préférence de style : le même texte copié sur LinkedIn et
// TikTok se voit immédiatement, et fait perdre plus de crédibilité que de
// n'avoir rien publié. L'adaptateur VÉRIFIE donc son propre travail — si
// deux versions sont identiques, il le signale au lieu de laisser passer.
//
// ── LES CONTRAINTES VIENNENT DU REGISTRE ──────────────────────────────────
//
// Aucune limite de caractères n'est écrite dans ce fichier. Tout est lu dans
// `config/plateformes-sociales.js`. Si Instagram passe un jour de 2200 à
// 3000 signes, on change une ligne, là-bas, et l'adaptateur suit.

const base = require("./base");
const plateformes = require("../../../config/plateformes-sociales");
const store = require("../../../services/socialStore");

const NOM = "adapter";

async function adapter({ workspaceId, postId, contenu, hook, cta, hashtags, cibles, media, mediaType } = {}) {
    return base.executer(NOM, { workspaceId, postId, entree: { cibles, longueur: contenu?.length } }, async () => {
        if (!contenu) throw new Error("aucun contenu à adapter");

        // On n'adapte que vers des plateformes qui existent et ne sont pas
        // coupées. Une cible fantôme produirait une variante que rien ne
        // pourrait publier.
        const listeCibles = (Array.isArray(cibles) && cibles.length ? cibles : plateformes.listeActives().map((p) => p.slug))
            .map((c) => String(c).toLowerCase())
            .filter((c) => plateformes.existe(c) && !plateformes.estCoupee(c));

        if (!listeCibles.length) throw new Error("aucune plateforme cible valide");

        const consignes = listeCibles.map((slug) => {
            const p = plateformes.get(slug);
            return `- ${slug} (${p.nom}) : ${p.ton}. `
                 + `Entre ${p.longueurVisee[0]} et ${p.longueurVisee[1]} caractères, ${p.maxCaracteres} maximum. `
                 + `${p.hashtagsMax ? `${p.hashtagsMax} hashtags maximum.` : "AUCUN hashtag."}`
                 + `${p.mediaRequis ? " Un visuel est OBLIGATOIRE sur cette plateforme." : ""}`;
        }).join("\n");

        const message = `Voici un contenu source à décliner :

CONTENU : ${contenu}
${hook ? `ACCROCHE : ${hook}` : ""}
${cta ? `APPEL À L'ACTION : ${cta}` : ""}
${hashtags?.length ? `MOTS-CLÉS : ${hashtags.join(", ")}` : ""}

Écris une version DIFFÉRENTE pour chacune de ces plateformes :
${consignes}

RÈGLE ABSOLUE : deux versions ne doivent jamais être identiques ni quasi
identiques. Chaque plateforme a son public et sa façon de lire.

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{"variantes":[{"plateforme":"...","texte":"...","hashtags":"#a #b","cta":"..."}]}`;

        const brut = await base.demander(message, { workspaceId, source: "social-adapter" });
        const json = base.lireJson(brut);
        if (!json?.variantes?.length) throw new Error("l'adaptateur n'a produit aucune variante lisible");

        const variantes = [];
        const vues = new Map();          // texte normalisé → plateforme, pour repérer les copies
        const alertes = [];

        for (const v of json.variantes) {
            const slug = String(v.plateforme || "").toLowerCase();
            if (!listeCibles.includes(slug)) continue;
            const p = plateformes.get(slug);

            let texte = String(v.texte || "").trim();
            if (!texte) { alertes.push(`${slug} : texte vide, écarté`); continue; }

            // On COUPE au maximum de la plateforme plutôt que d'envoyer un
            // texte que l'API rejettera. Le relecteur, juste après, verra la
            // coupe et pourra refuser.
            if (texte.length > p.maxCaracteres) {
                alertes.push(`${slug} : texte coupé (${texte.length} → ${p.maxCaracteres})`);
                texte = texte.slice(0, p.maxCaracteres);
            }

            // La vérification que l'adaptateur se fait à lui-même.
            const cle = texte.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 200);
            if (vues.has(cle)) {
                alertes.push(`${slug} : texte identique à ${vues.get(cle)} — c'est ce qu'on voulait éviter`);
            } else {
                vues.set(cle, slug);
            }

            // Les hashtags sont bornés par le registre, pas par l'IA.
            let tags = String(v.hashtags || "").trim();
            if (p.hashtagsMax === 0) tags = "";
            else {
                const liste = tags.split(/\s+/).filter((t) => t.startsWith("#")).slice(0, p.hashtagsMax);
                tags = liste.join(" ");
            }

            const variante = {
                plateforme: slug,
                texte,
                hashtags: tags,
                cta: String(v.cta || cta || "").slice(0, 200),
                mediaUrl: media || null,
                mediaType: mediaType || null,
            };
            variantes.push(variante);

            // Enregistrée tout de suite : si la chaîne s'arrête plus loin, le
            // travail déjà fait n'est pas perdu et reste visible à l'écran.
            if (postId) await store.enregistrerVariante({ postId, ...variante });
        }

        if (!variantes.length) throw new Error("aucune variante exploitable après contrôle");
        return { variantes, alertes, cibles: listeCibles };
    });
}

module.exports = { NOM, adapter };
