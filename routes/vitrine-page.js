// ==========================================================================
// SAMII OS — LA VITRINE D'UN MARCHAND (page publique)
//
// POURQUOI CE FICHIER EXISTE.
// Réglages → Ma boutique demandait déjà tout : une adresse
// (maboutique.souverain-store.com), des pixels publicitaires, un thème de
// couleurs, une disposition de grille, des sections de produits, des
// vedettes. Tout ça était enregistré en base depuis des mois.
// Mais `renderVitrine` n'existait nulle part : `index.js` le cherchait dans
// `routes/vitrine.js`, ne le trouvait pas, et le try/catch avalait l'erreur
// en silence. Résultat : un marchand configurait sa boutique, ouvrait son
// sous-domaine, et tombait sur la page d'accueil de SAMII. Les réglages
// existaient, la page non.
//
// CE QU'ON CONSTRUIT ICI. Une vraie page — celle qu'on montre à quelqu'un,
// pas un listing. Couverture, portrait, nom, ce qu'il vend, où il est,
// depuis quand, ce que les gens en disent. Puis ses produits, ses
// publications, ses avis. C'est la forme que le monde entier connaît déjà :
// personne n'a besoin qu'on lui explique comment lire une page de profil.
//
// TROIS RÈGLES TENUES DANS TOUT LE FICHIER.
//
// 1. AUCUNE REQUÊTE NE PEUT VIDER LA PAGE. Chaque lecture est isolée dans
//    son propre try/catch. Une table absente (avis, publications) fait
//    disparaître UNE section, jamais la boutique. Un marchand ne perd pas sa
//    devanture parce qu'une fonctionnalité annexe tousse.
//
// 2. LE THÈME EST UNE DONNÉE, PAS DU CODE. Les couleurs viennent de
//    `config/vitrine-themes.js` via les variables CSS. Le thème « minimal »
//    est CLAIR : rien ici ne peut coder une couleur de texte en dur, sinon
//    ce thème devient illisible. Tout passe par var(--text)/var(--muted).
//
// 3. TOUT EST ÉCHAPPÉ. Le titre d'un produit, la bio, le nom : ce sont des
//    textes tapés par des marchands, affichés à des inconnus. Ils passent
//    tous par escapeHtml, et les valeurs injectées dans du JavaScript par
//    JSON.stringify — jamais par concaténation.
// ==========================================================================
const db = require("../services/db");
const vitrineThemes = require("../config/vitrine-themes");
const pixelsService = require("../services/pixelsService");

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

// Les photos arrivent sous deux formes selon l'origine du produit : une URL
// simple, ou un tableau JSON stocké en texte. On accepte les deux et on ne
// se plaint jamais — une photo manquante donne une tuile, pas une erreur.
function parsePhotos(photoUrl, photosUrls) {
    let list = [];
    if (photosUrls) {
        try {
            const parsed = typeof photosUrls === "string" ? JSON.parse(photosUrls) : photosUrls;
            if (Array.isArray(parsed)) list = parsed.filter(Boolean);
        } catch { list = []; }
    }
    if (!list.length && photoUrl) list = [photoUrl];
    return list;
}

function initiales(prenom, nom) {
    const a = String(prenom || "").trim()[0] || "";
    const b = String(nom || "").trim()[0] || "";
    return (a + b).toUpperCase() || "?";
}

// « Membre depuis mars 2024 » plutôt qu'une date : sur une page de profil,
// c'est l'ancienneté qui rassure, pas le jour exact.
function moisAnnee(date) {
    if (!date) return "";
    try {
        return new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    } catch { return ""; }
}

function ilYA(date) {
    if (!date) return "";
    const secondes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (secondes < 60) return "à l'instant";
    if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
    if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
    if (secondes < 2592000) return `il y a ${Math.floor(secondes / 86400)} j`;
    return moisAnnee(date);
}

// Un grand nombre écrit en entier ne se lit pas d'un coup d'œil. 12 400
// devient 12,4 k — la précision n'apporte rien ici, la lisibilité si.
function compact(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + " M";
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + " k";
    return String(v);
}

const ETOILES = (note) => {
    const n = Math.round(Number(note) || 0);
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
};

// ==========================================================================
// LA PAGE
// ==========================================================================
async function renderVitrine(userId, req, res) {
    // ── 1. Le marchand ───────────────────────────────────────────────────
    // La seule requête dont l'échec justifie de ne rien afficher : sans
    // marchand, il n'y a pas de boutique à montrer.
    let user = null;
    try {
        const rows = await db.query(
            `SELECT id, prenom, nom, email, telephone, pays, bio_vitrine,
                    photo_profil_url, banniere_url, grade_actuel, type_compte,
                    metier, sous_domaine, vitrine_theme, vitrine_grille, created_at
             FROM utilisateurs WHERE id = $1`,
            [userId],
        );
        user = rows[0] || null;
    } catch (err) {
        console.error("❌ vitrine : lecture du marchand —", err.message);
    }
    if (!user) return res.status(404).send(pageIntrouvable());

    const nomComplet = `${user.prenom || ""} ${user.nom || ""}`.trim() || "Boutique";
    const theme = user.vitrine_theme || "signature";
    const grande = user.vitrine_grille === "grande";

    // ── 2. Ses produits ──────────────────────────────────────────────────
    let produits = [];
    try {
        produits = await db.query(
            `SELECT id, titre, prix, devise, photo_url, photos_urls, categorie,
                    section_vitrine, en_vedette, ville, vues, created_at
             FROM annonces
             WHERE vendeur_id = $1 AND actif = true
             ORDER BY en_vedette DESC NULLS LAST, created_at DESC
             LIMIT 120`,
            [userId],
        );
    } catch (err) {
        console.warn("⚠️ vitrine : produits —", err.message);
    }

    // ── 3. Ses publications dans la communauté ───────────────────────────
    let publications = [];
    try {
        publications = await db.query(
            `SELECT p.id, p.contenu, p.categorie, p.created_at,
                    (SELECT COUNT(*) FROM publications_likes pl WHERE pl.publication_id = p.id) AS nb_likes,
                    (SELECT COUNT(*) FROM publications_commentaires pc WHERE pc.publication_id = p.id) AS nb_commentaires
             FROM publications p
             WHERE p.auteur_id = $1
             ORDER BY p.created_at DESC LIMIT 20`,
            [userId],
        );
    } catch (err) {
        console.warn("⚠️ vitrine : publications —", err.message);
    }

    // ── 4. Ce que ses clients en disent ──────────────────────────────────
    let avis = [];
    let note = null;
    try {
        avis = await db.query(
            `SELECT a.note, a.commentaire, a.created_at, u.prenom, u.nom
             FROM avis a LEFT JOIN utilisateurs u ON u.id = a.auteur_id
             WHERE a.cible_type = 'vendeur' AND a.cible_id = $1
             ORDER BY a.created_at DESC LIMIT 12`,
            [userId],
        );
        if (avis.length) {
            const somme = avis.reduce((t, a) => t + (Number(a.note) || 0), 0);
            note = { moyenne: (somme / avis.length).toFixed(1), total: avis.length };
        }
    } catch (err) {
        console.warn("⚠️ vitrine : avis —", err.message);
    }

    // ── 5. Les pixels du marchand ────────────────────────────────────────
    // C'est SA publicité : quelqu'un qui regarde sa boutique doit compter
    // dans SON audience, pas dans la nôtre. La visite est un ViewContent.
    let pixelsHtml = "";
    try {
        const pixels = await pixelsService.getPixels(userId);
        pixelsHtml = pixelsService.pixelEventHtml(pixels, "ViewContent", {
            contentName: nomComplet,
            contentId: String(userId),
        });
    } catch (err) {
        console.warn("⚠️ vitrine : pixels —", err.message);
    }

    // ── 6. Mise en forme ─────────────────────────────────────────────────
    const vuesTotales = produits.reduce((t, p) => t + (Number(p.vues) || 0), 0);
    const vedettes = produits.filter((p) => p.en_vedette);
    const ordinaires = produits.filter((p) => !p.en_vedette);

    // Les sections sont nommées par le marchand dans « Gérer mes produits ».
    // Celles qui n'en ont pas se retrouvent ensemble, à la fin, sous un
    // titre neutre — jamais dans une section fantôme sans nom.
    const sections = new Map();
    for (const p of ordinaires) {
        const cle = (p.section_vitrine || "").trim() || "__autres";
        if (!sections.has(cle)) sections.set(cle, []);
        sections.get(cle).push(p);
    }
    const autres = sections.get("__autres") || [];
    sections.delete("__autres");

    const estProprietaire = req.session?.userId === user.id;
    const lienPublic = user.sous_domaine
        ? `https://${user.sous_domaine}.souverain-store.com`
        : `${req.protocol}://${req.get("host")}/vitrine/${encodeURIComponent(user.id)}`;

    res.send(gabarit({
        user, nomComplet, theme, grande, produits, vedettes, sections, autres,
        publications, avis, note, vuesTotales, pixelsHtml, lienPublic,
        estProprietaire,
    }));
}

// ==========================================================================
// LES MORCEAUX
// ==========================================================================

function carteProduit(p, grande) {
    const photos = parsePhotos(p.photo_url, p.photos_urls);
    const image = photos[0];
    const prix = String(p.prix || "").trim();
    const devise = String(p.devise || "").trim();
    return `
    <a class="prod" href="/marketplace/produit/${encodeURIComponent(p.id)}">
        <div class="prod__img">
            <!-- La tuile est TOUJOURS là, dessous ; la photo se pose par-dessus.
                 Si son adresse est morte — et il y en a, dans une base qui a
                 des années — l'image se retire et découvre la tuile. Sans ça,
                 le navigateur affiche le titre du produit en texte brut par
                 dessus le badge, et la carte a l'air cassée. -->
            <div class="prod__vide">📦</div>
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(p.titre || "")}" loading="lazy" onerror="this.remove()">` : ""}
            ${p.en_vedette ? `<span class="prod__badge">⭐ Vedette</span>` : ""}
            ${photos.length > 1 ? `<span class="prod__nb">${photos.length} photos</span>` : ""}
        </div>
        <div class="prod__bas">
            <h3>${escapeHtml(p.titre || "Sans titre")}</h3>
            <div class="prod__ligne">
                <span class="prod__prix">${prix ? escapeHtml(prix) + (devise ? " " + escapeHtml(devise) : "") : "Prix sur demande"}</span>
                ${p.ville ? `<span class="prod__ville">${escapeHtml(p.ville)}</span>` : ""}
            </div>
        </div>
    </a>`;
}

function grille(liste, grande) {
    return `<div class="grille ${grande ? "grille--grande" : ""}">${liste.map((p) => carteProduit(p, grande)).join("")}</div>`;
}

function bloc(titre, contenu, compte) {
    return `
    <section class="bloc">
        <div class="bloc__tete">
            <h2>${escapeHtml(titre)}</h2>
            ${compte != null ? `<span class="bloc__compte">${compte}</span>` : ""}
        </div>
        ${contenu}
    </section>`;
}

// Un vide qui explique ce qui manque et à qui de jouer. « Aucun produit »
// ne dit rien ; « la boutique se remplit » dit ce qui va se passer.
function vide(icone, titre, texte) {
    return `<div class="vide"><span>${icone}</span><b>${escapeHtml(titre)}</b><p>${escapeHtml(texte)}</p></div>`;
}

function pageIntrouvable() {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boutique introuvable</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#03060b;color:#f5fbff;
font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px}
a{color:#00d9ff}p{color:#7f96a8;max-width:44ch}</style></head><body><div>
<h1 style="font-size:1.5rem;margin:0 0 8px">Cette boutique n'existe pas</h1>
<p>Le lien est peut-être ancien, ou la boutique a été fermée.</p>
<p><a href="/marketplace">Voir les autres boutiques →</a></p>
</div></body></html>`;
}

// ==========================================================================
// LE GABARIT COMPLET
// ==========================================================================
function gabarit(d) {
    const {
        user, nomComplet, theme, grande, produits, vedettes, sections, autres,
        publications, avis, note, vuesTotales, pixelsHtml, lienPublic, estProprietaire,
    } = d;

    const bio = (user.bio_vitrine || "").trim();
    const metier = (user.metier || "").trim();
    // Le sous-titre de la page : ce qu'il vend, en une ligne. On prend le
    // métier déclaré, sinon la catégorie qui revient le plus dans ses
    // produits — plutôt qu'une étiquette vide.
    const categories = {};
    for (const p of produits) if (p.categorie) categories[p.categorie] = (categories[p.categorie] || 0) + 1;
    const categorieDominante = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const sousTitre = metier || categorieDominante || "Boutique";

    // Même principe partout : le repli est DESSOUS, la photo se pose dessus
    // et se retire si son adresse est morte. Un dégradé aux couleurs du thème
    // vaut mieux qu'un rectangle gris avec une icône d'image cassée.
    const couverture = `<div class="couv__degrade"></div>${
        user.banniere_url
            ? `<img class="couv__img" src="${escapeHtml(user.banniere_url)}" alt="" onerror="this.remove()">`
            : ""}`;

    const portrait = `<span>${escapeHtml(initiales(user.prenom, user.nom))}</span>${
        user.photo_profil_url
            ? `<img src="${escapeHtml(user.photo_profil_url)}" alt="${escapeHtml(nomComplet)}" onerror="this.remove()">`
            : ""}`;

    const sectionsHtml = [...sections.entries()]
        .map(([nom, liste]) => bloc(nom, grille(liste, grande), liste.length))
        .join("");

    const publicationsHtml = publications.length
        ? publications.map((p) => `
        <article class="post">
            <div class="post__tete">
                <div class="post__ava">${escapeHtml(initiales(user.prenom, user.nom))}</div>
                <div>
                    <b>${escapeHtml(nomComplet)}</b>
                    <span>${escapeHtml(ilYA(p.created_at))}${p.categorie ? " · " + escapeHtml(p.categorie) : ""}</span>
                </div>
            </div>
            <p class="post__texte">${escapeHtml(p.contenu || "").replace(/\n/g, "<br>")}</p>
            <div class="post__pied">
                <span>♥ ${compact(p.nb_likes)}</span>
                <span>💬 ${compact(p.nb_commentaires)}</span>
            </div>
        </article>`).join("")
        : vide("📝", "Aucune publication pour l'instant",
            "Les publications faites dans la communauté apparaîtront ici, sur sa page.");

    const avisHtml = avis.length
        ? `<div class="avis">
            <div class="avis__resume">
                <div class="avis__note">${escapeHtml(note.moyenne)}</div>
                <div>
                    <div class="avis__etoiles">${ETOILES(note.moyenne)}</div>
                    <span>${note.total} avis client${note.total > 1 ? "s" : ""}</span>
                </div>
            </div>
            ${avis.map((a) => `
            <article class="avis__item">
                <div class="avis__tete">
                    <b>${escapeHtml(`${a.prenom || "Client"} ${(a.nom || "").slice(0, 1)}`.trim())}</b>
                    <span class="avis__etoiles avis__etoiles--min">${ETOILES(a.note)}</span>
                    <span class="avis__date">${escapeHtml(ilYA(a.created_at))}</span>
                </div>
                ${a.commentaire ? `<p>${escapeHtml(a.commentaire)}</p>` : ""}
            </article>`).join("")}
        </div>`
        : vide("⭐", "Pas encore d'avis",
            "Les avis laissés après un achat s'afficheront ici — c'est ce qui rassure un nouveau client.");

    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(nomComplet)} — Boutique</title>
<meta name="description" content="${escapeHtml(bio || `${nomComplet} · ${sousTitre}`)}">

<!-- Ce qui s'affiche quand le lien est collé dans WhatsApp, Facebook ou
     Instagram. Sans ces balises, un lien partagé est une adresse nue —
     et une adresse nue ne se clique pas. -->
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(nomComplet)} — Boutique">
<meta property="og:description" content="${escapeHtml(bio || sousTitre)}">
<meta property="og:url" content="${escapeHtml(lienPublic)}">
${user.banniere_url ? `<meta property="og:image" content="${escapeHtml(user.banniere_url)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{${vitrineThemes.cssVarsString(theme)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
     font:15px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
     -webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}

/* ── La barre qui apparaît en descendant ─────────────────────────────
   Le nom disparaît en haut de page dès qu'on scrolle ; sans cette barre,
   on ne sait plus chez qui on est au bout de trois produits. */
.haut{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;
      gap:12px;padding:10px 16px;background:color-mix(in srgb,var(--bg) 88%,transparent);
      backdrop-filter:blur(14px);border-bottom:1px solid var(--border);
      transform:translateY(-110%);transition:transform .25s ease}
.haut.on{transform:none}
.haut__ava{position:relative;width:32px;height:32px;border-radius:50%;overflow:hidden;
           flex:none;background:var(--blue);color:var(--bg);display:grid;place-items:center;
           font-weight:700;font-size:12px}
.haut__ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.haut__nom{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;
           text-overflow:ellipsis;flex:1}
.haut__retour{color:var(--muted);font-size:20px;line-height:1;padding:2px 6px;
              background:none;border:0;cursor:pointer}

/* ── La couverture ────────────────────────────────────────────────── */
.couv{position:relative;height:clamp(150px,30vw,340px);overflow:hidden;background:var(--panel)}
.couv__img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.couv__degrade{width:100%;height:100%;
  background:radial-gradient(120% 140% at 15% 0%,var(--blue) 0%,transparent 55%),
             radial-gradient(120% 140% at 85% 20%,var(--blue-2) 0%,transparent 60%),
             var(--bg);opacity:.75}
.couv::after{content:"";position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 40%,var(--bg) 100%)}

.enveloppe{max-width:1060px;margin:0 auto;padding:0 16px 120px}

/* ── L'identité ───────────────────────────────────────────────────── */
.ident{position:relative;margin-top:clamp(-70px,-9vw,-52px);display:flex;
       align-items:flex-end;gap:18px;flex-wrap:wrap}
.ident__ava{position:relative;width:clamp(96px,18vw,148px);height:clamp(96px,18vw,148px);
            border-radius:50%;overflow:hidden;flex:none;border:4px solid var(--bg);
            background:var(--panel);display:grid;place-items:center;
            font-size:clamp(28px,6vw,42px);font-weight:800;color:var(--blue);
            box-shadow:0 12px 40px rgba(0,0,0,.35)}
.ident__ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ident__txt{flex:1;min-width:220px;padding-bottom:6px}
.ident__nom{font-size:clamp(22px,4.4vw,32px);font-weight:800;line-height:1.15;margin:0;
            display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.verif{color:var(--blue);font-size:.62em}
.ident__sous{color:var(--muted);margin:4px 0 0;font-size:14.5px}
.ident__meta{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;
             color:var(--muted);font-size:13px}

/* ── Les chiffres ─────────────────────────────────────────────────── */
/* Une grille, pas un flex : sur un téléphone de 360 px, un flex-wrap
   laissait le quatrième chiffre tout seul sur sa ligne. Deux colonnes
   régulières se lisent d'un coup d'œil, quatre sur grand écran. */
.chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:22px 0 0;
          padding:16px 0;border-top:1px solid var(--border);
          border-bottom:1px solid var(--border)}
.chiffre b{display:block;font-size:20px;font-weight:800;line-height:1.2}
.chiffre span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}

/* ── Les actions ──────────────────────────────────────────────────── */
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 4px}
.btn{display:inline-flex;align-items:center;gap:7px;padding:11px 18px;border-radius:10px;
     font-size:14px;font-weight:600;border:1px solid var(--border);cursor:pointer;
     background:var(--panel);color:var(--text);font-family:inherit;transition:.15s}
.btn:hover{border-color:var(--blue)}
.btn--fort{background:var(--blue);border-color:var(--blue);color:var(--bg)}
.btn--fort:hover{filter:brightness(1.08)}

/* ── Les onglets ──────────────────────────────────────────────────── */
.onglets{position:sticky;top:0;z-index:30;display:flex;gap:4px;overflow-x:auto;
         margin-top:22px;padding:6px 0;background:var(--bg);
         border-bottom:1px solid var(--border);scrollbar-width:none}
.onglets::-webkit-scrollbar{display:none}
.onglet{padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;
        color:var(--muted);background:none;border:0;cursor:pointer;white-space:nowrap;
        font-family:inherit;border-bottom:3px solid transparent;border-radius:8px 8px 0 0}
.onglet[aria-selected="true"]{color:var(--blue);border-bottom-color:var(--blue)}

.panneau[hidden]{display:none}
.bloc{margin-top:32px}
.bloc__tete{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.bloc__tete h2{font-size:17px;font-weight:700;margin:0}
.bloc__compte{color:var(--muted);font-size:12.5px}

/* ── La grille de produits ──────────────────────────────────────────
   La largeur minimale d'une colonne suit l'écran, et c'est tout l'enjeu.
   Fixée à 158 px, un téléphone de 360 px — le plus répandu ici — n'avait
   plus la place pour DEUX colonnes et retombait à une seule : une boutique
   qui montre un produit par écran ne se parcourt pas. Fixée à 140 px, le
   problème s'inversait sur ordinateur, où des vignettes de 140 px au
   milieu de 1 280 px font vitrine de brocante.
   Le clamp tient les deux bouts : 140 px sur téléphone (deux colonnes),
   jusqu'à 210 px sur grand écran (quatre colonnes confortables).
   Et auto-fill, pas auto-fit : une section qui ne contient qu'un produit
   garde une vignette de taille normale au lieu de l'étirer sur toute la
   largeur. */
.grille{display:grid;gap:14px;
        grid-template-columns:repeat(auto-fill,minmax(clamp(140px,22vw,210px),1fr))}
.grille--grande{gap:18px;
        grid-template-columns:repeat(auto-fill,minmax(clamp(200px,32vw,300px),1fr))}
.prod{background:var(--panel);border:1px solid var(--border);border-radius:14px;
      overflow:hidden;display:flex;flex-direction:column;transition:.18s}
.prod:hover{transform:translateY(-3px);border-color:var(--blue)}
.prod__img{position:relative;aspect-ratio:1;background:color-mix(in srgb,var(--bg) 70%,var(--panel))}
.prod__img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
.prod__vide{position:absolute;inset:0;display:grid;place-items:center;font-size:32px;opacity:.35}
.prod__badge{position:absolute;top:8px;left:8px;z-index:2;background:var(--gold);color:#000;
             font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px}
.prod__nb{position:absolute;bottom:8px;right:8px;z-index:2;background:rgba(0,0,0,.6);color:#fff;
          font-size:10.5px;padding:3px 8px;border-radius:999px}
.prod__bas{padding:11px 12px 13px}
.prod__bas h3{font-size:13.5px;font-weight:600;margin:0 0 6px;line-height:1.35;
              display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
              overflow:hidden}
/* Le prix ne se coupe jamais : « 5 000 FCFA » sur deux lignes, c'est une
   carte qui a l'air bancale. C'est la ville qui cède la place — elle est
   secondaire, et une ville tronquée reste lisible. */
.prod__ligne{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.prod__prix{color:var(--gold);font-weight:700;font-size:14px;white-space:nowrap}
.prod__ville{color:var(--muted);font-size:11.5px;min-width:0;overflow:hidden;
             text-overflow:ellipsis;white-space:nowrap}

/* ── Les publications ─────────────────────────────────────────────── */
.post{background:var(--panel);border:1px solid var(--border);border-radius:14px;
      padding:16px;margin-bottom:14px}
.post__tete{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.post__ava{width:38px;height:38px;border-radius:50%;background:var(--blue);color:var(--bg);
           display:grid;place-items:center;font-weight:700;font-size:13px;flex:none}
.post__tete b{display:block;font-size:14px}
.post__tete span{color:var(--muted);font-size:12px}
.post__texte{margin:0;white-space:pre-wrap;word-break:break-word}
.post__pied{display:flex;gap:18px;margin-top:12px;padding-top:10px;
            border-top:1px solid var(--border);color:var(--muted);font-size:12.5px}

/* ── Les avis ─────────────────────────────────────────────────────── */
.avis__resume{display:flex;align-items:center;gap:18px;background:var(--panel);
              border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:14px}
.avis__note{font-size:38px;font-weight:800;color:var(--gold);line-height:1}
.avis__etoiles{color:var(--gold);letter-spacing:2px}
.avis__etoiles--min{font-size:12px;letter-spacing:1px}
.avis__resume span{color:var(--muted);font-size:13px}
.avis__item{background:var(--panel);border:1px solid var(--border);border-radius:12px;
            padding:14px 16px;margin-bottom:10px}
.avis__tete{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.avis__date{color:var(--muted);font-size:12px;margin-left:auto}
.avis__item p{margin:0;color:var(--muted)}

/* ── À propos ─────────────────────────────────────────────────────── */
.apropos{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px}
.apropos p{margin:0 0 16px;white-space:pre-wrap}
.fiche{display:grid;gap:10px}
.fiche div{display:flex;gap:10px;font-size:14px;padding:9px 0;
           border-top:1px solid var(--border)}
.fiche b{color:var(--muted);font-weight:500;min-width:130px}

.vide{background:var(--panel);border:1px dashed var(--border);border-radius:14px;
      padding:44px 22px;text-align:center}
.vide span{font-size:32px;display:block;margin-bottom:10px}
.vide b{display:block;margin-bottom:5px}
.vide p{color:var(--muted);margin:0;font-size:13.5px;max-width:46ch;
        margin-inline:auto;line-height:1.55}

/* ── La bulle de l'assistant ──────────────────────────────────────── */
.bulle{position:fixed;right:18px;bottom:18px;z-index:60;width:56px;height:56px;
       border-radius:50%;border:0;cursor:pointer;background:var(--blue);color:var(--bg);
       font-size:24px;box-shadow:0 10px 34px rgba(0,0,0,.4)}
.chat{position:fixed;right:18px;bottom:84px;z-index:60;width:min(360px,calc(100vw - 36px));
      max-height:min(520px,72vh);display:none;flex-direction:column;background:var(--panel);
      border:1px solid var(--border);border-radius:16px;overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,.5);backdrop-filter:blur(16px)}
.chat.on{display:flex}
.chat__tete{padding:13px 16px;border-bottom:1px solid var(--border);font-weight:700;
            font-size:14px;display:flex;align-items:center;gap:8px}
.chat__tete small{color:var(--muted);font-weight:400;font-size:11.5px;margin-left:auto}
/* Une hauteur minimale même vide : sans elle, la fenêtre s'ouvre écrasée
   entre son titre et son champ, et on dirait qu'elle a raté son ouverture. */
.chat__fil{flex:1;min-height:110px;overflow-y:auto;padding:14px;
           display:flex;flex-direction:column;gap:10px}
.msg{max-width:85%;padding:9px 13px;border-radius:13px;font-size:13.5px;line-height:1.5;
     white-space:pre-wrap;word-break:break-word}
.msg--moi{align-self:flex-end;background:var(--blue);color:var(--bg)}
.msg--lui{align-self:flex-start;background:color-mix(in srgb,var(--bg) 60%,var(--panel));
          border:1px solid var(--border)}
.chat__bas{display:flex;gap:8px;padding:11px;border-top:1px solid var(--border)}
.chat__bas input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:9px;
                 padding:10px 12px;color:var(--text);font:inherit;font-size:13.5px}
.chat__bas button{background:var(--blue);color:var(--bg);border:0;border-radius:9px;
                  padding:0 15px;font-weight:700;cursor:pointer;font-family:inherit}

.pied{text-align:center;color:var(--muted);font-size:12px;margin-top:48px;
      padding-top:20px;border-top:1px solid var(--border)}
.pied a{color:var(--blue)}

@media(max-width:560px){
  .chiffres{grid-template-columns:repeat(2,1fr);gap:14px 12px}
  .actions .btn{flex:1;justify-content:center}
}
</style>
</head>
<body>

<div class="haut" id="haut">
    <button class="haut__retour" id="btnRetour" aria-label="Revenir en arrière">←</button>
    <div class="haut__ava">${portrait}</div>
    <div class="haut__nom">${escapeHtml(nomComplet)}</div>
    <button class="btn btn--fort" id="btnHautContact" style="padding:7px 14px;font-size:13px;">Contacter</button>
</div>

<header class="couv">${couverture}</header>

<div class="enveloppe">

    <div class="ident">
        <div class="ident__ava">${portrait}</div>
        <div class="ident__txt">
            <h1 class="ident__nom">
                ${escapeHtml(nomComplet)}
                ${note && Number(note.moyenne) >= 4.5 ? `<span class="verif" title="Bien noté par ses clients">✔</span>` : ""}
            </h1>
            <p class="ident__sous">${escapeHtml(sousTitre)}</p>
            <div class="ident__meta">
                ${user.pays ? `<span>📍 ${escapeHtml(user.pays)}</span>` : ""}
                ${user.grade_actuel ? `<span>🎖 ${escapeHtml(user.grade_actuel)}</span>` : ""}
                ${user.created_at ? `<span>Sur la plateforme depuis ${escapeHtml(moisAnnee(user.created_at))}</span>` : ""}
            </div>
        </div>
    </div>

    <div class="chiffres">
        <div class="chiffre"><b>${compact(produits.length)}</b><span>Produits</span></div>
        <div class="chiffre"><b>${compact(vuesTotales)}</b><span>Vues</span></div>
        <div class="chiffre"><b>${note ? escapeHtml(note.moyenne) + " ★" : "—"}</b><span>${note ? `${note.total} avis` : "Aucun avis"}</span></div>
        <div class="chiffre"><b>${compact(publications.length)}</b><span>Publications</span></div>
    </div>

    <div class="actions">
        <button class="btn btn--fort" id="btnContact">💬 Contacter la boutique</button>
        <button class="btn" id="btnPartager">🔗 Partager</button>
        <a class="btn" href="/marketplace?vendeur=${encodeURIComponent(user.id)}">🛍 Tous ses produits</a>
        ${estProprietaire ? `<a class="btn" href="/settings#boutique">⚙️ Modifier ma boutique</a>` : ""}
    </div>

    <nav class="onglets" role="tablist">
        <button class="onglet" role="tab" aria-selected="true"  data-cible="boutique">Boutique</button>
        <button class="onglet" role="tab" aria-selected="false" data-cible="publications">Publications</button>
        <button class="onglet" role="tab" aria-selected="false" data-cible="avis">Avis</button>
        <button class="onglet" role="tab" aria-selected="false" data-cible="apropos">À propos</button>
    </nav>

    <div class="panneau" id="p-boutique">
        ${produits.length ? `
            ${vedettes.length ? bloc("⭐ Mise en avant", grille(vedettes, grande), vedettes.length) : ""}
            ${sectionsHtml}
            ${autres.length ? bloc(sections.size || vedettes.length ? "Tous les produits" : "La boutique", grille(autres, grande), autres.length) : ""}
        ` : vide("🏪", "La boutique se remplit",
            estProprietaire
                ? "Publie un produit depuis « Gérer mes produits » et il apparaîtra ici en quelques secondes."
                : "Aucun produit en ligne pour le moment. Reviens bientôt, ou écris à la boutique.")}
    </div>

    <div class="panneau" id="p-publications" hidden>${publicationsHtml}</div>
    <div class="panneau" id="p-avis" hidden>${avisHtml}</div>

    <div class="panneau" id="p-apropos" hidden>
        <div class="apropos">
            ${bio ? `<p>${escapeHtml(bio)}</p>` : `<p style="color:var(--muted)">Cette boutique n'a pas encore écrit sa présentation.</p>`}
            <div class="fiche">
                ${metier ? `<div><b>Activité</b><span>${escapeHtml(metier)}</span></div>` : ""}
                ${user.pays ? `<div><b>Pays</b><span>${escapeHtml(user.pays)}</span></div>` : ""}
                ${user.created_at ? `<div><b>Membre depuis</b><span>${escapeHtml(moisAnnee(user.created_at))}</span></div>` : ""}
                <div><b>Produits en ligne</b><span>${produits.length}</span></div>
                <div><b>Adresse de la boutique</b><span><a href="${escapeHtml(lienPublic)}" style="color:var(--blue)">${escapeHtml(lienPublic.replace(/^https?:\/\//, ""))}</a></span></div>
            </div>
        </div>
    </div>

    <p class="pied">Boutique propulsée par <a href="/">SAMII</a></p>
</div>

<button class="bulle" id="bulle" aria-label="Poser une question">💬</button>
<section class="chat" id="chat" aria-live="polite">
    <div class="chat__tete">💬 Assistant <small>répond en quelques secondes</small></div>
    <div class="chat__fil" id="fil"></div>
    <form class="chat__bas" id="formChat">
        <input id="champChat" placeholder="Une question sur la boutique ?" autocomplete="off" maxlength="500">
        <button type="submit">→</button>
    </form>
</section>

<script>
(function () {
    "use strict";

    // Le nom du marchand et son lien viennent du serveur : ils passent par
    // JSON.stringify, jamais par concaténation dans du texte JS.
    var NOM = ${JSON.stringify(nomComplet)};
    var LIEN = ${JSON.stringify(lienPublic)};

    // ── Les onglets ──────────────────────────────────────────────────
    var onglets = document.querySelectorAll(".onglet");
    function ouvrir(cible) {
        onglets.forEach(function (o) {
            var actif = o.dataset.cible === cible;
            o.setAttribute("aria-selected", actif ? "true" : "false");
            document.getElementById("p-" + o.dataset.cible).hidden = !actif;
        });
    }
    onglets.forEach(function (o) {
        o.addEventListener("click", function () { ouvrir(o.dataset.cible); });
    });

    // ── La barre du haut : elle n'apparaît qu'une fois le nom sorti de
    //    l'écran, sinon elle doublerait ce qu'on lit déjà. ─────────────
    var haut = document.getElementById("haut");
    var repere = document.querySelector(".ident");
    if ("IntersectionObserver" in window && repere) {
        new IntersectionObserver(function (entrees) {
            haut.classList.toggle("on", !entrees[0].isIntersecting);
        }, { rootMargin: "-72px 0px 0px 0px" }).observe(repere);
    }

    // Revenir là d'où l'on vient. S'il n'y a pas d'historique — un lien
    // ouvert depuis WhatsApp, par exemple — la marketplace fait un retour
    // plus utile qu'un bouton mort.
    document.getElementById("btnRetour").addEventListener("click", function () {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/marketplace";
    });

    // ── Partager ─────────────────────────────────────────────────────
    document.getElementById("btnPartager").addEventListener("click", function () {
        var btn = this;
        if (navigator.share) {
            navigator.share({ title: NOM, url: LIEN }).catch(function () {});
            return;
        }
        // Pas de partage natif (ordinateur de bureau) : on copie, et on le
        // dit — un bouton qui ne réagit pas passe pour cassé.
        navigator.clipboard.writeText(LIEN).then(function () {
            var avant = btn.textContent;
            btn.textContent = "✅ Lien copié";
            setTimeout(function () { btn.textContent = avant; }, 1800);
        }).catch(function () { window.prompt("Copie ce lien :", LIEN); });
    });

    // ── La bulle ─────────────────────────────────────────────────────
    var chat = document.getElementById("chat");
    var fil = document.getElementById("fil");
    var champ = document.getElementById("champChat");
    var historique = [];
    var ouvertUneFois = false;

    function bascule() {
        chat.classList.toggle("on");
        if (chat.classList.contains("on")) {
            if (!ouvertUneFois) {
                ouvertUneFois = true;
                ajouter("lui", "Bonjour 👋 Je réponds pour " + NOM + ". Une question sur un produit, un prix, la livraison ?");
            }
            champ.focus();
        }
    }
    document.getElementById("bulle").addEventListener("click", bascule);
    document.getElementById("btnContact").addEventListener("click", bascule);
    document.getElementById("btnHautContact").addEventListener("click", bascule);

    function ajouter(qui, texte) {
        var d = document.createElement("div");
        d.className = "msg msg--" + (qui === "moi" ? "moi" : "lui");
        d.textContent = texte;
        fil.appendChild(d);
        fil.scrollTop = fil.scrollHeight;
        return d;
    }

    document.getElementById("formChat").addEventListener("submit", function (e) {
        e.preventDefault();
        var texte = champ.value.trim();
        if (!texte) return;
        champ.value = "";
        ajouter("moi", texte);
        historique.push({ role: "user", message: texte });
        var attente = ajouter("lui", "…");

        fetch("/vitrine/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: texte, langue: "fr", historique: historique.slice(-6) }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var reponse = data.reply || "Je n'ai pas pu répondre. Réessaie dans un instant.";
                attente.textContent = reponse;
                historique.push({ role: "model", message: reponse });
            })
            .catch(function () {
                attente.textContent = "Connexion perdue. Réessaie dans un instant.";
            });
    });
})();
</script>
${pixelsHtml}
</body>
</html>`;
}

module.exports = { renderVitrine };
