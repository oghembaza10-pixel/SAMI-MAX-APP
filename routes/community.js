// ==========================================================================
// SAMII OS — COMMUNITY — v3 avec choix de diffusion multi-module
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const gradeService = require("../services/gradeService");
const { mobileNav } = require("../views/partials/mobileNav");

const communautes = require("../config/communautes");

function requireAuth(req, res, next) { if (!req.session?.loggedIn) return res.redirect("/login"); next(); }

// LIRE EST PUBLIC, ÉCRIRE DEMANDE UN COMPTE.
//
// Avant, `GET /` exigeait une session. Une créatrice qui poste son lien
// devant 8,5 millions de vues envoyait tout ce monde sur un écran de
// connexion : personne ne crée un compte pour un endroit qu'il n'a pas
// encore vu. On perdait les visiteurs à la porte, et ça ne se voyait dans
// aucun journal — ils partaient, c'est tout.
//
// Maintenant on entre, on regarde, et le compte n'est demandé qu'au moment
// de publier, d'aimer, de commenter ou d'acheter — c'est-à-dire quand il
// sert à quelque chose pour le visiteur, pas seulement pour nous.
function lectureOuverte(req, res, next) { next(); }

// La communauté demandée : /c/<slug> la pose, la session s'en souvient le
// temps de la visite pour que « publier » revienne au bon endroit.
// Pour les ACTIONS (publier, commenter) : il n'y a ni slug ni query dans le
// corps d'un POST, la session est la seule mémoire de l'endroit où l'on est.
function communauteDe(req) {
    const demandee = req.params?.slug || req.query?.c || req.session?.communaute;
    return communautes.get(demandee);
}

// Pour la PAGE : l'adresse fait foi, jamais la session.
//
// Avec la session en dernier recours, quelqu'un qui visitait /c/coindudigital
// puis revenait sur /community voyait SA communauté à la place de la nôtre —
// l'adresse disait une chose, la page en montrait une autre. Ça ne se voyait
// pas tant que le fil était commun aux deux ; maintenant que chacune a le
// sien, ça se verrait tout de suite.
function communauteDeLaPage(req) {
    return communautes.get(req.params?.slug || req.query?.c);
}

// Pour une ACTION (aimer, commenter, enregistrer, supprimer) : le service
// d'abord, la session ensuite.
//
// Un POST n'a ni slug ni query — communauteDeLaPage() rendrait donc la
// maison pour toute action faite chez elle. Sur un service partenaire, la
// réponse ne dépend de personne : il ne sert qu'une communauté. Sur le
// nôtre, où l'on peut visiter /c/<slug>, c'est la session qui se souvient.
function communauteDeLAction(req, res) {
    const service = res?.locals?.COM;
    if (service && !service.ecosysteme) return service;
    return communauteDe(req);
}
function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function timeAgo(date) {
    const s = Math.floor((Date.now()-new Date(date).getTime())/1000);
    if (s<60) return "à l'instant";
    const m=Math.floor(s/60); if(m<60) return `il y a ${m} min`;
    const h=Math.floor(m/60); if(h<24) return `il y a ${h} h`;
    const d=Math.floor(h/24); if(d<7) return `il y a ${d} j`;
    return `il y a ${Math.floor(d/7)} sem`;
}
function initiales(p,n){const a=(p||"").charAt(0).toUpperCase();const b=(n||"").charAt(0).toUpperCase();return (a+b)||"OG";}

const CATEGORIES = {
    photo:       { label:"Photo",       icon:"camera",         couleur:"#00d9ff", modules:["community"] },
    video:       { label:"Vidéo",       icon:"video",          couleur:"#ff5ea6", modules:["community"] },
    produit:     { label:"Produit",     icon:"shopping-bag",   couleur:"#d7b34c", modules:["community","marketplace"] },
    service:     { label:"Service",     icon:"concierge-bell", couleur:"#3ddc84", modules:["community","marketplace"] },
    formation:   { label:"Formation",   icon:"graduation-cap", couleur:"#9d5cff", modules:["community","academy"] },
    publication: { label:"Publication", icon:"message-square", couleur:"#7f96a8", modules:["community"] },
};
function catInfo(c){ return CATEGORIES[c] || CATEGORIES.publication; }

// ==========================================================================
// LE PREMIER JOUR D'UNE COMMUNAUTÉ
//
// « Dans l'application il y'a rien. » Elle avait raison, et ce n'était pas
// une panne : le fil était vide, et une communauté vide affichait un cadre
// en pointillés avec écrit « Aucune publication pour l'instant ».
//
// Toute communauté commence vide — un groupe Facebook aussi. La différence,
// c'est qu'un groupe Facebook vide ne donne pas l'impression d'être cassé.
// Un écran qui annonce son propre vide ne fait rien : il ne dit pas où on
// est, ni ce qu'on y trouvera, ni quoi faire dans les dix secondes qui
// suivent. C'est le seul écran que verront les tout premiers visiteurs,
// ceux qui arrivent par le lien posté en story — autant qu'il travaille.
//
// DEUX PUBLICS, DEUX BESOINS.
//   - Le visiteur arrive d'Instagram ou de WhatsApp et ne sait pas encore
//     où il a atterri. Il lui faut : c'est quoi ici, et qu'est-ce que j'y
//     gagne.
//   - Le membre — elle, en premier — a besoin d'un premier geste évident.
//     La page ouverte devant un champ vide, on ne poste pas ; avec trois
//     amorces à toucher, si.
//
// On n'invente rien sur elle : le texte de positionnement vient de sa propre
// fiche professionnelle, repris dans config/communautes.js.
// ==========================================================================
// La page servie quand l'adresse ne correspond à aucune communauté. Elle
// doit faire une chose : dire clairement que ce lien-là ne mène nulle part,
// au lieu de laisser croire que la communauté a changé de marque. Et donner
// une sortie — quelqu'un est arrivé ici en cliquant, pas en se trompant.
function communauteIntrouvable(demande) {
    const propose = communautes.liste()
        .filter((c) => c.slug !== communautes.DEFAUT)
        .map((c) => `<a href="/c/${c.slug}">${escapeHtml(c.nom)}</a>`)
        .join("");
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cette communauté n'existe pas</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
     background:#03060b;color:#f2f7fc;text-align:center;
     font:15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:1.35rem;margin:0 0 10px}
p{color:#8397ab;max-width:46ch;margin:0 auto 10px}
code{background:rgba(255,255,255,.07);padding:2px 8px;border-radius:6px;color:#e3b341}
.l{margin-top:22px;display:grid;gap:9px;justify-items:center}
a{color:#00d9ff;text-decoration:none;padding:9px 18px;border:1px solid rgba(0,217,255,.25);
  border-radius:10px;display:inline-block}
a:hover{border-color:#00d9ff}
</style></head><body><div>
<h1>Ce lien ne mène à aucune communauté</h1>
<p>L'adresse <code>/c/${escapeHtml(demande)}</code> ne correspond à rien. Il y a
sans doute une lettre de travers dans le lien — vérifie auprès de la personne
qui te l'a envoyé.</p>
<div class="l">${propose}</div>
</div></body></html>`;
}

const AMORCES = [
    { icone: "sparkles",       texte: "L'outil que j'utilise tous les jours et que personne ne connaît :" },
    { icone: "graduation-cap", texte: "Ce que j'aurais aimé savoir quand j'ai commencé :" },
    { icone: "shopping-bag",   texte: "Ce que je propose en ce moment :" },
];

// ── UN FIL FILTRÉ ET VIDE ───────────────────────────────────────────────
//
// « Quand je clique sur Mon espace, ça me renvoie dans le fil d'actualité. »
//
// Ce n'était pas le filtre : il marchait. C'était la page vide. Sans
// publication à afficher, on retombait sur filVide() — le grand panneau
// « Bienvenue / Ce que tu trouveras ici / Ouvre le bal ». Autrement dit :
// on demandait ses publications, on obtenait l'accueil de la communauté.
// Vu de l'écran, c'est exactement le fil.
//
// Une vue filtrée qui ne trouve rien doit parler de CE QU'ON CHERCHAIT, et
// proposer la sortie. Sinon on croit que le clic n'a pas marché.
function filtreVide(COM, quoi) {
    const CAS = {
        "mes-publications": {
            titre: "Tu n'as encore rien publié",
            texte: "Cet espace rassemble tes publications à toi. Dès que tu postes quelque chose dans la communauté, tu le retrouves ici — sans avoir à faire défiler tout le fil.",
            action: "Écrire ma première publication",
        },
        abonnements: {
            titre: "Tu ne suis encore personne",
            texte: "Quand quelqu'un publie bien ou vend de bonnes choses, le bouton « S'abonner » est à côté de son nom. Ce fil ne montrera plus que ces personnes-là.",
            action: "Parcourir le fil pour trouver qui suivre",
        },
        enregistres: {
            titre: "Tu n'as encore rien enregistré",
            texte: "Le marque-page sous chaque publication la range ici. Pratique pour une formation qu'on veut relire, ou un outil à essayer plus tard.",
            action: "Parcourir le fil",
        },
        produit: { titre: "Aucun produit pour l'instant", texte: "Personne n'a encore mis de produit en vente dans cette communauté. Tu peux être le premier.", action: "Voir tout le fil" },
        formation: { titre: "Aucune formation pour l'instant", texte: "Personne n'a encore proposé de formation ici. Si tu en as une, c'est le moment.", action: "Voir tout le fil" },
        service: { titre: "Aucun service pour l'instant", texte: "Personne ne propose encore de service dans cette communauté.", action: "Voir tout le fil" },
    };
    const c = CAS[quoi] || { titre: "Rien à afficher", texte: "Cette sélection est vide pour l'instant.", action: "Voir tout le fil" };
    return `
<div class="depart">
  <div class="depart-h">
    <h3>${escapeHtml(c.titre)}</h3>
    <p>${escapeHtml(c.texte)}</p>
  </div>
  <a class="depart-sortie" href="/c/${COM.slug}">${escapeHtml(c.action)} →</a>
</div>`;
}

function filVide(COM, connecte) {
    // Le visiteur a déjà lu « Bienvenue sur … » juste au-dessus, dans le bloc
    // d'invitation. Répéter un accueil et un bouton ferait deux cartes qui
    // disent la même chose : celle-ci enchaîne au lieu de recommencer.
    if (!connecte) {
        return `
<div class="depart">
  <div class="depart-h">
    <span class="depart-pastille">${escapeHtml(COM.sigle)}</span>
    <h3>Ce que tu trouveras ici</h3>
    <p>${escapeHtml(COM.moteurTexte)}</p>
  </div>
  <ul class="depart-l">
    <li><i data-lucide="message-square"></i><div><b>On partage ce qu'on trouve</b><span>Un outil, une astuce, une opportunité — publier ne coûte rien.</span></div></li>
    <li><i data-lucide="shopping-bag"></i><div><b>On vend ce qu'on fait</b><span>Formations, ressources, services : ton offre se met en ligne ici.</span></div></li>
    <li><i data-lucide="users"></i><div><b>Tu es parmi les premiers</b><span>Les premières publications donnent le ton. Autant que ce soit la tienne.</span></div></li>
  </ul>
</div>`;
    }

    return `
<div class="depart">
  <div class="depart-h">
    <h3>Ouvre le bal</h3>
    <p>${escapeHtml(COM.vide)}</p>
  </div>
  <div class="depart-amorces">
    ${AMORCES.map((a) => `
    <button type="button" class="amorce" data-amorce="${escapeHtml(a.texte)}">
      <i data-lucide="${a.icone}"></i><span>${escapeHtml(a.texte)}</span>
    </button>`).join("")}
  </div>
  <span class="depart-note">Touche une amorce : elle se met dans le champ du haut, tu finis la phrase.</span>
</div>`;
}

const MODULES_INFO = {
    community:   { label:"Communauté",  icon:"users" },
    marketplace: { label:"Marketplace", icon:"store" },
    academy:     { label:"Academy",     icon:"graduation-cap" },
};

// LE MANIFESTE D'UNE COMMUNAUTÉ PARTENAIRE.
//
// C'est ce qui transforme une page web en application sur l'écran d'accueil :
// un nom, une icône, une couleur, et une adresse de départ. Pas de magasin,
// pas de validation, pas de téléchargement lourd — au Cameroun c'est le bon
// format, et ça marche sur des téléphones où personne n'installerait 40 Mo.
//
// `scope` est volontairement limité à sa communauté : une fois installée,
// l'application ne peut pas dériver vers le reste du site. Si un lien sort
// du périmètre, il s'ouvre dans le navigateur, pas dans SON application.
router.get("/:slug/manifest.json", (req, res) => {
    const COM = communautes.get(req.params.slug);
    if (!COM.app) return res.status(404).json({ erreur: "Cette communauté n'a pas d'application." });

    const base = `/c/${COM.slug}`;
    const ic = (taille, but) => ({
        src: `/icons/${COM.app.icone}-${taille}.png`,
        sizes: `${taille.split("-")[0]}x${taille.split("-")[0]}`,
        type: "image/png",
        purpose: but,
    });

    res.type("application/manifest+json").json({
        name: COM.app.nom,
        short_name: COM.app.nomCourt,
        description: COM.app.description,
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait-primary",
        background_color: COM.app.fond,
        theme_color: COM.app.theme,
        lang: "fr",
        icons: [ic("192", "any"), ic("512", "any"), ic("512-maskable", "maskable")],
    });
});

router.get(["/", "/c/:slug", "/:slug"], lectureOuverte, async (req, res) => {
    // ── UN SLUG INCONNU NE DEVIENT PAS LA MAISON ────────────────────────
    //
    // `communautes.get()` retombe sur la maison pour tout slug qu'il ne
    // connaît pas. C'est le bon comportement quand le slug vient d'une
    // session ou d'un ?c= : mieux vaut afficher quelque chose que rien.
    //
    // Dans une ADRESSE, c'est un piège. /c/coin-du-digital — l'orthographe
    // la plus naturelle de son nom — répondait 200 en servant NOTRE
    // communauté, sans un mot. Une créatrice colle son lien en story avec
    // une lettre de travers et envoie tout son public chez nous, sous une
    // adresse qui a l'air d'être la sienne. Rien ne signale la panne : ni
    // erreur, ni indice. Ça ressemble juste à « le site est redevenu comme
    // avant ».
    const demande = req.params?.slug;
    if (demande) {
        const canonique = communautes.alias(demande);
        if (canonique) {
            // Une variante connue : on ramène vers l'adresse unique, pour
            // qu'il n'y ait jamais deux URL pour la même communauté.
            return res.redirect(301, `/c/${canonique}`);
        }
        if (!communautes.existe(demande)) return res.status(404).send(communauteIntrouvable(demande));
    }

    const COM = communauteDeLaPage(req);
    if (req.params?.slug && req.session) req.session.communaute = COM.slug;
    const connecte = !!req.session?.loggedIn;
    let publications = [], classement = [], stats = { membres:0, publications:0 }, tendances = [];

    // ── LE FILTRE DU FIL ─────────────────────────────────────────────────
    // « Les produits », « Les formations », « Les services » pointaient déjà
    // sur ?f=… dans la colonne de gauche — mais rien ne lisait ce paramètre :
    // les trois liens rechargeaient le fil complet. Ils marchent maintenant,
    // et le même mécanisme sert à afficher ce qu'on a mis de côté.
    const filtre = String(req.query?.f || "").toLowerCase().replace(/[^a-z-]/g, "");
    const filtreEnregistres = filtre === "enregistres";
    // « Chaque utilisateur doit avoir son espace : quand il fait ses
    // publications, il les voit aussi dans son espace, à part de toutes
    // celles des autres. »
    //
    // Le fil montre tout le monde, ce qui est très bien pour découvrir et
    // très mauvais pour se relire. Quelqu'un qui a publié trois choses la
    // semaine dernière ne les retrouve plus : elles sont sous cinquante
    // autres. Ici, il ne voit que les siennes.
    const filtreMien = filtre === "mes-publications";
    // Le fil de ceux qu'on suit : la raison d'être de l'abonnement.
    // S'abonner sans pouvoir lire ses abonnements ne sert à rien.
    const filtreAbonnements = filtre === "abonnements";
    const filtreCategorie = CATEGORIES[filtre] ? filtre : null;

    try {
        const rows = await db.query(`
            SELECT p.*, u.prenom, u.nom, u.grade_actuel, u.type_compte, u.photo_profil_url,
                (SELECT COUNT(*) FROM publications_likes pl WHERE pl.publication_id=p.id) AS nb_likes,
                (SELECT COUNT(*) FROM publications_commentaires pc WHERE pc.publication_id=p.id) AS nb_commentaires,
                EXISTS(SELECT 1 FROM publications_likes pl2 WHERE pl2.publication_id=p.id AND pl2.user_id=$1) AS jaime,
                EXISTS(SELECT 1 FROM publications_enregistrees pe WHERE pe.publication_id=p.id AND pe.user_id=$1) AS enregistre,
                EXISTS(SELECT 1 FROM abonnements_membres ab WHERE ab.auteur_id=p.auteur_id AND ab.abonne_id=$1 AND ab.communaute=$2) AS abonne
            FROM publications p LEFT JOIN utilisateurs u ON u.id=p.auteur_id
            -- Chacune chez soi. Sans ce filtre, le fil est global : ce qu'un
            -- membre publie chez une partenaire s'affiche dans notre
            -- communauté, et inversement. Le COALESCE range les publications
            -- d'avant la colonne dans la maison, ce qui est exact — tout ce
            -- qui a été publié jusqu'ici l'a été chez nous.
            WHERE COALESCE(p.communaute, $3) = $2
              -- $4 et $5 valent NULL quand aucun filtre n'est demandé : la
              -- condition est alors toujours vraie et le fil reste entier.
              -- Une requête unique plutôt que trois assemblées à la main,
              -- pour qu'il n'y ait qu'un seul endroit où le filtre de
              -- communauté peut être oublié.
              AND ($4::text IS NULL OR p.categorie = $4)
              AND ($5::boolean IS NULL OR EXISTS(
                    SELECT 1 FROM publications_enregistrees pe2
                     WHERE pe2.publication_id = p.id AND pe2.user_id = $1))
              -- Son espace à lui. Comparé à $1, jamais à une valeur passée
              -- par la page : sans ça, « ?f=mes-publications&qui=<id> »
              -- afficherait l'espace de quelqu'un d'autre.
              AND ($6::boolean IS NULL OR p.auteur_id = $1)
              AND ($7::boolean IS NULL OR EXISTS(
                    SELECT 1 FROM abonnements_membres ab2
                     WHERE ab2.auteur_id = p.auteur_id AND ab2.abonne_id = $1
                       AND ab2.communaute = $2))
            ORDER BY p.epingle DESC, p.created_at DESC LIMIT 40
        `, [req.session.userId || "", COM.slug, communautes.DEFAUT,
            filtreCategorie, filtreEnregistres ? true : null, filtreMien ? true : null,
            filtreAbonnements ? true : null]);
        publications = rows;
        for (const pub of publications) {
            const comms = await db.query(`SELECT pc.*, u.prenom, u.nom, u.photo_profil_url FROM publications_commentaires pc LEFT JOIN utilisateurs u ON u.id=pc.auteur_id WHERE pc.publication_id=$1 ORDER BY pc.created_at ASC LIMIT 2`, [pub.id]);
            pub.apercu_commentaires = comms;
        }
    } catch (err) { console.warn("⚠️ publications :", err.message); }

    try {
        // SES membres, pas les nôtres. Sur sa page s'affichaient les cinq
        // premiers de TOUTE la plateforme — des gens qu'elle n'a jamais vus,
        // sous sa marque, présentés comme sa communauté. C'est la même fuite
        // que le fil des publications, au même endroit du code.
        classement = await db.query(
            `SELECT id, prenom, nom, grade_actuel, score_grade, type_compte, photo_profil_url
               FROM utilisateurs
              WHERE COALESCE(communaute, $2) = $1
              ORDER BY score_grade DESC NULLS LAST LIMIT 5`,
            [COM.slug, communautes.DEFAUT]);
    } catch (err) { console.warn("⚠️ classement :", err.message); }

    // Sa propre photo, pour l'afficher là où il écrit. Requête isolée : si
    // elle échoue, on retombe sur les initiales et la page vit sa vie.
    let moi = null;
    if (connecte && req.session?.userId) {
        try {
            const rows = await db.query(
                `SELECT prenom, nom, photo_profil_url FROM utilisateurs WHERE id = $1`,
                [req.session.userId]);
            moi = rows[0] || null;
        } catch (err) { console.warn("⚠️ mon profil :", err.message); }
    }

    let stories = [];
    try {
        stories = await db.query(`
            SELECT DISTINCT ON (s.auteur_id) s.auteur_id, u.prenom, u.nom, s.created_at,
                EXISTS(SELECT 1 FROM stories_vues sv WHERE sv.story_id=s.id AND sv.user_id=$1) AS vue
            FROM stories s LEFT JOIN utilisateurs u ON u.id=s.auteur_id
            -- La communauté de l'AUTEUR fait foi. Filtrer ici plutôt que
            -- d'ajouter une colonne à la table « stories » : ça vaut aussi
            -- pour les stories déjà publiées, sans migration ni rattrapage.
            --
            -- La barre des stories est masquée chez une partenaire
            -- aujourd'hui, donc rien ne se voyait — mais la requête, elle,
            -- partait quand même. Le jour où on lui ouvre les stories, ce
            -- sont NOS membres qui seraient apparus en haut de sa page. Une
            -- fuite qui attend d'être affichée reste une fuite.
            WHERE s.actif = true AND s.expires_at > now()
              AND COALESCE(u.communaute, $3) = $2
            ORDER BY s.auteur_id, s.created_at DESC
        `, [req.session.userId || "", COM.slug, communautes.DEFAUT]);
    } catch (err) { console.warn("⚠️ stories :", err.message); }

    try {
        // Ses membres à elle. « 17 membres » sur sa page alors qu'elle n'en
        // a aucun, c'est un chiffre flatteur et faux — et le jour où elle
        // regarde qui sont ces dix-sept, elle ne reconnaît personne.
        const cRows = await db.query(
            `SELECT COUNT(*) AS total FROM utilisateurs WHERE COALESCE(communaute, $2) = $1`,
            [COM.slug, communautes.DEFAUT]);
        stats.membres = parseInt(cRows[0]?.total||0,10);
        // Comptés chez elle, pas chez nous : afficher notre total sur sa page
        // serait un chiffre flatteur et faux.
        const pRows = await db.query(
            `SELECT COUNT(*) AS total FROM publications WHERE COALESCE(communaute,$2) = $1`,
            [COM.slug, communautes.DEFAUT]);
        stats.publications = parseInt(pRows[0]?.total||0,10);
        tendances = await db.query(
            `SELECT categorie, COUNT(*) AS total FROM publications
             WHERE COALESCE(communaute,$2) = $1
             GROUP BY categorie ORDER BY total DESC LIMIT 3`,
            [COM.slug, communautes.DEFAUT]);
    } catch (err) { console.warn("⚠️ stats :", err.message); }

    // ── LE CHEMIN DU RETOUR VERS SA BOUTIQUE ─────────────────────────────
    //
    // « Je vois "ouvrir une boutique" et j'ai déjà ouvert une boutique, mais
    // il n'y a aucune chose pour revenir dans mon espace boutique. »
    //
    // Le panneau proposait toujours d'en OUVRIR une, même à quelqu'un qui en
    // a déjà une. Deux dégâts : on ne retrouve pas la sienne, et on doute —
    // « est-ce que ma boutique existe vraiment, puisqu'on me propose encore
    // de la créer ? » Un lien qui ignore ce que la personne a déjà fait la
    // renvoie à la case départ à chaque visite.
    //
    // Trois états, trois propositions. `workspaceId` est posé en session à
    // la connexion pour un marchand : c'est la marque qu'une boutique existe.
    // Le lien vers SON espace d'administration, visible d'elle seule.
    // On compare l'adresse de la session à celle déclarée dans la config :
    // le contrôle réel est refait par la route elle-même, ceci ne fait
    // qu'éviter d'afficher une porte à ceux qui ne peuvent pas l'ouvrir.
    const estAdmineDeChezElle = Boolean(
        connecte && COM.admin && req.session?.email &&
        String(req.session.email).toLowerCase() === String(COM.admin).toLowerCase()
    );

    const aBoutique = Boolean(connecte && req.session?.workspaceId);
    const boutique = aBoutique
        ? { url: "/qg", icone: "layout-dashboard", libelle: "Ma boutique" }
        : (connecte
            // « Ouvrir ma boutique » pointait sur /qg — l'espace marchand,
            // qui refusait précisément les comptes n'ayant pas encore de
            // boutique. Le bouton menait donc à la porte fermée à la place
            // du formulaire. On envoie là où l'on CRÉE une boutique.
            ? { url: communautes.accueilMarchand(COM), icone: "store", libelle: "Ouvrir ma boutique" }
            : { url: COM.ecosysteme ? `/register?c=${COM.slug}` : `/c/${COM.slug}/inscription`,
                icone: "store", libelle: "Ouvrir ma boutique" });

    const catButtonsHtml = Object.entries(CATEGORIES).map(([key,c]) => `
        <button type="button" class="cat-btn" data-cat="${key}" style="--cat-color:${c.couleur};"><i data-lucide="${c.icon}"></i> ${c.label}</button>`).join("");

    const storiesBarHtml = stories.map(s => {
        const nomS = `${s.prenom||"Membre"} ${s.nom||""}`.trim();
        return `<a class="story-circle" href="/stories/${encodeURIComponent(s.auteur_id)}">
            <div class="story-ring ${s.vue ? "story-ring--vue" : ""}">${initiales(s.prenom,s.nom)}</div>
            <span>${escapeHtml((s.prenom||"Membre").slice(0,10))}</span>
        </a>`;
    }).join("");

    const tendancesHtml = tendances.length ? tendances.map(t => { const info=catInfo(t.categorie);
        return `<div class="stat-row"><span><i data-lucide="${info.icon}" style="width:13px;height:13px;color:${info.couleur};"></i> ${info.label}</span><strong>${t.total}</strong></div>`; }).join("") : "";

    // Qui voit la corbeille sur une publication : celle qui l'a écrite, et
    // l'administratrice de CETTE communauté. Ce n'est qu'un affichage — la
    // route refait le contrôle, parce que cacher un bouton n'a jamais
    // empêché personne d'envoyer la requête.
    // Les grades sont une décision de communauté : notre jeu militaire
    // (Soldat, Caporal, la barre qui se remplit) n'a rien à faire chez une
    // partenaire qui vend des formations. « grades » non déclaré = on garde,
    // pour que rien ne change chez nous ni chez qui n'a rien demandé.
    const avecGrades = COM.grades !== false;

    const estSien = (p) => Boolean(
        connecte && p.auteur_id && String(p.auteur_id) === String(req.session?.userId));

    // MODIFIER ET SUPPRIMER NE SE DONNENT PAS AUX MÊMES PERSONNES.
    //
    // « Quand quelqu'un publie, il doit être le seul à modifier ses
    // publications. » La remarque vient de sa communauté, et elle a raison
    // contre moi : j'avais donné les deux droits à l'administratrice.
    //
    // Retirer une publication, c'est de la modération — elle en a besoin
    // pour tenir sa communauté, et le membre voit que son texte a disparu.
    // RÉÉCRIRE le texte de quelqu'un d'autre, c'est autre chose : ça laisse
    // des mots signés de son nom qu'il n'a jamais écrits, et il n'a aucun
    // moyen de s'en apercevoir. Aucune modération ne vaut ça.
    const peutModifier = (p) => estSien(p);
    const peutSupprimer = (p) => Boolean(estSien(p) || estAdmineDeChezElle);

    // Ce qu'on annonce en haut du fil quand il est filtré. Sans ça, « Mon
    // espace » sur un compte qui n'a rien publié ressemble à une communauté
    // vide, et « Les produits » sans produit ressemble à une panne.
    const LIBELLES = { produit: "Les produits", formation: "Les formations", service: "Les services" };
    const enTeteFiltre = filtreAbonnements
        ? `<div class="bandeau-espace">
             <div><b>Mes abonnements</b><br><span>${publications.length ? "Ce que publient les personnes que tu suis." : "Tu ne suis encore personne. Le bouton « S'abonner » est à côté de chaque nom."}</span></div>
             <a href="/c/${COM.slug}">Voir tout le fil →</a>
           </div>`
        : filtreMien
        ? `<div class="bandeau-espace">
             <div><b>Mon espace</b><br><span>${publications.length ? `${publications.length} publication${publications.length > 1 ? "s" : ""} à toi` : "Tu n'as encore rien publié ici."}</span></div>
             <a href="/c/${COM.slug}">Voir tout le fil →</a>
           </div>`
        : (filtreEnregistres
            ? `<div class="bandeau-espace">
                 <div><b>Mes enregistrements</b><br><span>${publications.length ? "Ce que tu as mis de côté." : "Tu n'as encore rien enregistré. Le marque-page sous chaque publication le range ici."}</span></div>
                 <a href="/c/${COM.slug}">Voir tout le fil →</a>
               </div>`
            : (filtreCategorie
                ? `<div class="bandeau-espace">
                     <div><b>${LIBELLES[filtreCategorie] || filtreCategorie}</b><br><span>${publications.length ? `${publications.length} publication${publications.length > 1 ? "s" : ""}` : "Rien dans cette catégorie pour l'instant."}</span></div>
                     <a href="/c/${COM.slug}">Voir tout le fil →</a>
                   </div>`
                : ""));

    // Le bouton ne s'affiche ni sur ses propres publications — on ne
    // s'abonne pas à soi-même — ni pour un visiteur non connecté, qui n'a
    // nulle part où ranger l'abonnement.
    const peutSabonner = (p) => Boolean(
        connecte && p.auteur_id && String(p.auteur_id) !== String(req.session?.userId));

    // ── LE VISAGE DES GENS, ET LE CHEMIN VERS EUX ────────────────────────
    //
    // « Quand on est dans la marketplace ou dans la communauté et on clique
    // sur un profil, il faut que ça affiche ce qu'il a publié — les liens
    // des gens doivent être cliquables. » Et : « il faut qu'on voie la
    // photo de profil de la personne. »
    //
    // Les deux étaient réservés à NOTRE communauté : `COM.ecosysteme ? <a>
    // : <span>`. Chez une partenaire, un nom d'auteur n'était pas un lien —
    // on voyait passer quelqu'un sans jamais pouvoir aller voir qui c'est ni
    // ce qu'il vend. Or c'est exactement là que ça compte : sa communauté
    // est faite de gens qui se découvrent.
    //
    // La page /vitrine existe déjà et est ouverte sur son service (module
    // « vitrine »). Il n'y avait donc rien à construire — juste à arrêter de
    // couper le lien.
    const lienProfil = (id) => `/vitrine/${encodeURIComponent(id || "")}`;

    // La photo se POSE sur les initiales, elle ne les remplace pas : une
    // adresse morte — et il y en a, dans une base qui a des années — retire
    // l'image et découvre les initiales dessous. Jamais une icône cassée.
    const avatar = (personne, classe) => {
        const init = initiales(personne.prenom, personne.nom);
        const photo = String(personne.photo_profil_url || "").trim();
        return `<span class="${classe}">${init}${photo
            ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" onerror="this.remove()">`
            : ""}</span>`;
    };

    const feedHtml = publications.length ? publications.map(p => {
        const nomAuteur = escapeHtml(`${p.prenom||"Membre"} ${p.nom||""}`.trim());
        const isMarchand = p.type_compte === "marchand";
        // Sans les grades, la pastille dit ce qui est UTILE à savoir sur
        // la personne : est-ce qu'elle vend ici. « 🏪 Soldat » n'apprenait
        // rien ; « 🏪 Boutique » dit à qui on peut acheter.
        //
        // Déclaré APRÈS isMarchand, et pas avant : une constante lue avant
        // sa déclaration lève une ReferenceError, et ici ça aurait mis toute
        // sa page en erreur 500. Trouvé en rendant la page, pas en la
        // relisant.
        const grade = avecGrades
            ? escapeHtml(p.grade_actuel || "Soldat")
            : (isMarchand ? "Boutique" : "Membre");
        const cat = catInfo(p.categorie);
        const commentairesHtml = p.apercu_commentaires.map(c => `
            <div class="comment-item">${avatar(c, "comment-avatar")}
            <div class="comment-body"><strong><a href="${lienProfil(c.auteur_id)}">${escapeHtml(`${c.prenom||"Membre"} ${c.nom||""}`)}</a></strong><span>${escapeHtml(c.contenu)}</span></div></div>`).join("");
        let mediaHtml = "";
        if (p.video_url) mediaHtml = `<div class="post-media"><video src="${escapeHtml(p.video_url)}" controls preload="metadata"></video></div>`;
        else if (p.image_url) mediaHtml = `<div class="post-media"><img src="${escapeHtml(p.image_url)}" alt="" loading="lazy"></div>`;

        return `
        <article class="post-card" data-post-id="${p.id}" data-auteur-id="${escapeHtml(p.auteur_id || "")}">
            <div class="post-head">
                <a class="post-avatar-lien" href="${lienProfil(p.auteur_id)}">${avatar(p, "post-avatar")}</a>
                <div class="post-authorblock">
                    <div class="post-author"><a href="${lienProfil(p.auteur_id)}">${nomAuteur}</a> ${p.epingle?'<i data-lucide="pin" class="pin-ic"></i>':""}</div>
                    <div class="post-meta"><span class="grade-chip ${isMarchand?"grade-chip--gold":""}">${isMarchand?"🏪":"👤"} ${grade}</span><span class="dot-sep">·</span><span>${timeAgo(p.created_at)}</span></div>
                </div>
                ${peutSabonner(p) ? `<button class="btn-abonner${p.abonne ? " on" : ""}" type="button" onclick="toggleAbonner(${p.id}, this)">${p.abonne ? "Abonné" : "S'abonner"}</button>` : ""}
                <span class="cat-badge" style="--cat-color:${cat.couleur};"><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
            </div>
            ${p.contenu?`<p class="post-text">${escapeHtml(p.contenu)}</p>`:""}
            ${mediaHtml}
            <div class="post-stats"><span>${p.nb_likes>0?`❤️ ${p.nb_likes}`:""}</span><span>${p.nb_commentaires>0?`${p.nb_commentaires} commentaire${p.nb_commentaires>1?"s":""}`:""}</span></div>
            <div class="post-actions">
                <button class="post-action-btn ${p.jaime?"liked":""}" type="button" onclick="toggleLike(${p.id}, this)"><i data-lucide="heart"></i> J'aime</button>
                <button class="post-action-btn" type="button" onclick="toggleCommentBox(${p.id})"><i data-lucide="message-circle"></i> Commenter</button>
                <button class="post-action-btn ${p.enregistre?"saved":""}" type="button" onclick="toggleEnregistrer(${p.id}, this)"><i data-lucide="bookmark"></i> <span>${p.enregistre?"Enregistré":"Enregistrer"}</span></button>
                <button class="post-action-btn" type="button" onclick="sharePost(${p.id})"><i data-lucide="share-2"></i> Partager</button>
                ${peutSabonner(p) ? `<button class="post-action-btn" type="button" onclick="ecrireA(this)"><i data-lucide="mail"></i> Message</button>` : ""}
                ${peutModifier(p) ? `<button class="post-action-btn post-action-btn--mien" type="button" onclick="modifierPost(${p.id})" title="Modifier"><i data-lucide="pencil"></i></button>` : ""}
                ${peutSupprimer(p) ? `<button class="post-action-btn post-action-btn--danger" type="button" onclick="supprimerPost(${p.id})" title="Supprimer"><i data-lucide="trash-2"></i></button>` : ""}
            </div>
            <div class="comments-preview">${commentairesHtml}</div>
            <div class="comment-box" id="comment-box-${p.id}" style="display:none;">
                <input type="text" id="comment-input-${p.id}" placeholder="Écris un commentaire...">
                <button type="button" onclick="postComment(${p.id})"><i data-lucide="send"></i></button>
            </div>
        </article>`;
    }).join("")
        // Une sélection vide n'est pas une communauté vide : on ne relance
        // pas l'accueil, on explique ce qui manque et on rouvre le fil.
        : (filtre ? filtreVide(COM, filtre) : filVide(COM, connecte));

    const classementHtml = classement.length ? classement.map((u,i) => `
        <a class="rank-item" href="${lienProfil(u.id)}"><span class="rank-num rank-${i+1}">${i+1}</span>${avatar(u, "rank-avatar")}
        <div class="rank-info"><strong>${escapeHtml(`${u.prenom||"Membre"} ${u.nom||""}`)}</strong><span>${avecGrades ? `${escapeHtml(u.grade_actuel||"Soldat")} · ${u.score_grade||0} pts` : (u.type_compte === "marchand" ? "Boutique" : "Membre")}</span></div></a>`).join("") : `<p class="rank-empty">Le classement se remplira bientôt.</p>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${escapeHtml(COM.titre)}</title>
<link rel="manifest" href="${COM.app ? `/c/${COM.slug}/manifest.json` : "/manifest.json"}">
<meta name="theme-color" content="${COM.app ? COM.app.theme : "#070809"}">
<link rel="apple-touch-icon" href="${COM.app ? `/icons/${COM.app.icone}-192.png` : "/icons/icon-192.png"}">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root{--bg:#03060b;--panel:rgba(9,18,29,.88);--text:#f5fbff;--muted:#7f96a8;--blue:#00d9ff;--blue-2:#0077ff;--cyan-glow:0 0 15px rgba(0,217,255,.45);--gold:#d7b34c;--border:rgba(0,217,255,.16);--danger:#ff5470;--sur-accent:var(--sur-accent);--voile:rgba(3,7,12,.82);--creux:rgba(0,0,0,.22);--halo-1:rgba(0,217,255,.09);--halo-2:rgba(0,119,255,.12);--radius:18px;--ease:cubic-bezier(.16,1,.3,1);}
body.light{--bg:#eef5fa;--panel:rgba(255,255,255,.88);--text:#08121c;--muted:#607384;--border:rgba(0,119,255,.16);}
*{box-sizing:border-box;} body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 10%,var(--halo-1),transparent 30%),radial-gradient(circle at 90% 90%,var(--halo-2),transparent 32%),var(--bg);color:var(--text);font-family:Inter,sans-serif;overflow-x:hidden;}
button,input,textarea{font:inherit;cursor:pointer;} a{color:inherit;text-decoration:none;}
.sidebar{position:fixed;left:0;top:0;width:245px;height:100vh;padding:22px 16px;background:var(--panel);border-right:1px solid var(--border);z-index:300;display:flex;flex-direction:column;}
body.light .sidebar{background:rgba(247,251,254,.95);}
.brand{display:flex;align-items:center;gap:10px;padding:8px 10px 25px;font-weight:800;}
.brand-mark{width:37px;height:37px;display:grid;place-items:center;border-radius:11px;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));font-weight:900;}
.brand-name span{color:var(--blue);}
.side-link{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:12px;color:var(--muted);font-size:13px;font-weight:600;border:1px solid transparent;margin-bottom:6px;}
.side-link svg{width:18px;height:18px;}
.side-link:hover,.side-link.active{color:var(--text);background:var(--creux);border-color:var(--border);}
.side-link.active{font-weight:700;}
.side-link.active svg{color:var(--blue);}
.side-bottom{margin-top:auto;flex-shrink:0;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--creux);}
/* Le haut de la colonne cède la place quand l'écran est court : sans
   ces deux lignes, le bas — donc « Se déconnecter » — sort de l'écran,
   ce qui nous ramène exactement au problème qu'on vient de corriger.
   min-height:0 est indispensable : un enfant flex refuse de rétrécir
   sous sa taille de contenu sans lui, et le défilement ne s'active pas. */
.sidebar > div:first-child{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}
.side-ai{display:flex;align-items:center;gap:8px;font-size:11px;font-family:"JetBrains Mono";color:var(--blue);margin-bottom:6px;}
.side-ai-dot{width:7px;height:7px;background:#00ff9d;border-radius:50%;}
.side-text{color:var(--muted);font-size:11px;line-height:1.5;}
.main{margin-left:245px;min-height:100vh;width:calc(100% - 245px);}
.header{position:sticky;top:0;z-index:200;backdrop-filter:blur(24px);background:var(--voile);border-bottom:1px solid var(--border);padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:15px;}
.header h1{font-size:19px;margin:0;}
.header-actions{display:flex;align-items:center;gap:8px;}
.icon-btn{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--border);border-radius:11px;color:var(--muted);}
.icon-btn:hover{color:var(--blue);border-color:var(--blue);}
.layout{display:grid;grid-template-columns:1fr;gap:24px;max-width:1300px;margin:0 auto;padding:26px 28px 90px;}
/* ── LE FIL SUR UNE SEULE COLONNE ───────────────────────────────────
   Le fil est passé un temps sur deux colonnes. Retour à une carte par
   ligne : « c'était beaucoup plus pro, ça fait un peu comme Facebook,
   c'est beaucoup mieux ». Une colonne, c'est une photo qui a la place
   d'être vue et un texte qui se lit sans se casser à trois mots par
   ligne — c'est la mise en page de tous les fils que ses membres
   connaissent déjà.

   On garde la grille (plutôt qu'un simple empilement) pour deux
   raisons qui ont coûté des corrections : min-width:0 sur les enfants,
   sans quoi une longue URL sans espace élargit la carte et fait
   déborder la page ; et la règle grid-column sur les bandeaux, qui
   reste valable quelle que soit la largeur. */
#feedContainer{display:grid;gap:14px;align-items:start;
  grid-template-columns:1fr;}
/* Sans min-width:0, un élément de grille refuse de descendre sous la
   largeur de son contenu : une longue URL sans espace, et toute la colonne
   déborde. */
#feedContainer > *{min-width:0;}
.post-text{overflow-wrap:anywhere;}
/* Le bandeau d'une sélection filtrée et la page vide tiennent toute la
   largeur : ce sont des messages, pas des publications. */
#feedContainer > .depart{grid-column:1 / -1;}
@media (min-width:1100px){.layout{grid-template-columns:260px 1fr 280px;align-items:start;}}
.col-side{display:none;} @media (min-width:1100px){.col-side{display:block;position:sticky;top:90px;}}
.side-panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:16px;}
.side-panel h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 14px;display:flex;align-items:center;gap:6px;}
.side-panel h3 svg{width:14px;height:14px;color:var(--blue);}
.stat-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.stories-bar{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 16px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.stories-bar::-webkit-scrollbar{display:none;}
.story-circle{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:5px;text-decoration:none;width:62px;}
.story-ring{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:900;color:#fff;background:var(--panel);border:2.5px solid var(--blue);box-shadow:0 0 0 2px var(--bg);}
.story-ring--vue{border-color:rgba(127,150,168,.35);}
.story-ring--add{background:rgba(0,217,255,.08);border-style:dashed;color:var(--blue);}
.story-circle span{font-size:10.5px;color:var(--muted);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.stat-row span{display:flex;align-items:center;gap:6px;}
.stat-row:last-child{border:none;} .stat-row strong{color:var(--blue);font-family:"JetBrains Mono";}
.btn-boutique{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;background:var(--blue);color:var(--sur-accent);font-size:12.5px;font-weight:700;white-space:nowrap;}
.btn-boutique svg{width:15px;height:15px;}
@media(max-width:520px){.btn-boutique span{display:none;}.btn-boutique{padding:8px 10px;}}
.eco-link-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;}
.eco-link-item:hover{background:rgba(0,217,255,.06);color:var(--blue);}
.eco-link-item svg{width:15px;height:15px;}
.rank-item{display:flex;align-items:center;gap:10px;padding:9px 0;}
.rank-num{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:10px;font-weight:800;background:rgba(255,255,255,.06);color:var(--muted);flex-shrink:0;}
.rank-1{background:linear-gradient(135deg,#d7b34c,#f0d98c);color:#1a1400;}
.rank-2{background:linear-gradient(135deg,#b8c2cc,#e2e8ee);color:#0a0e12;}
.rank-3{background:linear-gradient(135deg,#c98a52,#e0ab7a);color:#1a0e00;}
.rank-avatar{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:9px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;position:relative;overflow:hidden;}
.rank-info{display:flex;flex-direction:column;min-width:0;} .rank-info strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} .rank-info span{font-size:9px;color:var(--muted);}
.rank-empty{color:var(--muted);font-size:11px;text-align:center;padding:10px 0;}
.col-feed{max-width:640px;width:100%;margin:0 auto;}
.composer{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:20px;}
.composer-top{display:flex;gap:12px;}
.composer-avatar{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;font-size:12px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;position:relative;overflow:hidden;}
.composer-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.composer-avatar-lien{flex-shrink:0;line-height:0;}
.composer textarea{flex:1;resize:none;min-height:44px;border:1px solid var(--border);border-radius:12px;background:var(--creux);color:var(--text);padding:12px;outline:none;font-size:13px;}
.composer textarea:focus{border-color:var(--blue);}
.cat-buttons{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;}
.cat-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:700;}
.cat-btn svg{width:13px;height:13px;} .cat-btn:hover{border-color:var(--cat-color);color:var(--cat-color);}
.cat-btn.selected{background:var(--cat-color);border-color:var(--cat-color);color:var(--sur-accent);}
.diffusion-box{margin-top:14px;padding:12px;border-radius:12px;background:rgba(0,217,255,.04);border:1px solid var(--border);display:none;}
.diffusion-box.show{display:block;}
.diffusion-title{font-size:11px;color:var(--blue);font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:10px;}
.diffusion-title svg{width:13px;height:13px;}
.diffusion-options{display:flex;gap:8px;flex-wrap:wrap;}
.diffusion-chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:20px;border:1px solid var(--border);background:rgba(0,0,0,.2);color:var(--muted);font-size:11px;font-weight:600;}
.diffusion-chip svg{width:12px;height:12px;}
.diffusion-chip input{display:none;}
.diffusion-chip:has(input:checked){background:rgba(0,217,255,.15);border-color:var(--blue);color:var(--blue);}
.diffusion-hint{font-size:10px;color:var(--muted);margin-top:8px;}
.upload-preview{margin-top:10px;display:none;position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--border);}
.upload-preview img,.upload-preview video{width:100%;max-height:280px;object-fit:cover;display:block;}
.upload-remove{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.7);color:white;border:none;display:grid;place-items:center;}
.upload-status{font-size:11px;color:var(--blue);margin-top:8px;display:none;}
.composer-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:12px;}
.composer-hint{font-size:11px;color:var(--muted);}
.composer-submit{padding:10px 20px;border:none;border-radius:11px;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);font-weight:800;font-size:12px;}
.composer-submit:disabled{opacity:.5;cursor:not-allowed;}

/* Le bloc d'accueil du visiteur : il remplace le composeur, il ne s'ajoute
   pas. Un champ de saisie désactivé au-dessus d'une invitation, c'est deux
   fois le même message et une frustration en prime. */
.composer.invite{text-align:center;padding:26px 20px;}
.invite-h{font-size:17px;font-weight:800;margin-bottom:8px;color:var(--text);}
.invite-p{font-size:13px;color:var(--muted);line-height:1.65;max-width:46ch;margin:0 auto 18px;}
.invite-a{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.invite-btn{padding:11px 22px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:700;
  background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);}
.invite-btn--calme{background:transparent;border:1px solid var(--border);color:var(--text);}

/* La mise en avant : c'est le revenu de la communauté, elle doit se voir
   sans crier. Un contour doré, pas un bouton plein — publier reste l'action
   principale, mettre en avant est le choix de celui qui veut plus. */
.composer-boost{padding:10px 16px;border-radius:11px;background:transparent;
  border:1px solid var(--gold);color:var(--gold);font-weight:700;font-size:12px;
  display:inline-flex;align-items:center;gap:7px;}
.composer-boost:hover{background:var(--gold);color:#100c02;}
.composer-boost svg{width:14px;height:14px;}

.app-manuel{margin-top:11px;padding:12px 13px;border:1px solid var(--border);border-radius:11px;background:var(--creux);font-size:12.5px;line-height:1.65;color:var(--muted);}
.app-manuel[hidden]{display:none;}
.app-manuel b{color:var(--text);}
.app-install{width:100%;padding:12px;border-radius:11px;border:none;cursor:pointer;
  background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);
  font-weight:800;font-size:12.5px;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
.app-install svg{width:15px;height:15px;}

.sheet-voile{position:fixed;inset:0;background:rgba(2,6,10,.66);z-index:90;display:none;}
.sheet-voile.on{display:block;}
.sheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:91;width:min(430px,calc(100% - 32px));
  background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:24px;display:none;
  max-height:86vh;overflow-y:auto;}
.sheet.on{display:block;}
.sheet h3{font-size:17px;margin:0 0 6px;color:var(--text);}
.sheet .sheet-p{font-size:12.5px;color:var(--muted);line-height:1.6;margin:0 0 18px;}
.offre-boost{display:flex;align-items:center;gap:13px;padding:14px;border:1px solid var(--border);
  border-radius:13px;margin-bottom:10px;cursor:pointer;background:rgba(0,0,0,.2);}
.offre-boost:hover{border-color:var(--gold);}
.offre-boost.choisi{border-color:var(--gold);background:rgba(217,178,76,.08);}
.offre-boost b{display:block;font-size:13.5px;color:var(--text);}
.offre-boost span{font-size:11.5px;color:var(--muted);}
.offre-boost .px{margin-left:auto;font-weight:800;color:var(--gold);font-size:14px;white-space:nowrap;}
.vendre-types{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;}
.vtype{padding:8px 13px;border-radius:999px;border:1px solid var(--border);background:transparent;
       color:var(--muted);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;}
.vtype.actif{border-color:var(--blue);color:var(--blue);background:var(--creux);}
.vlab{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);
      margin:12px 0 5px;font-weight:600;}
.vin{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--border);
     background:var(--creux);color:var(--text);font:inherit;font-size:13.5px;outline:none;resize:vertical;}
.vin:focus{border-color:var(--blue);}
.vprix{display:flex;align-items:center;gap:9px;}
.vprix span{color:var(--gold);font-weight:700;font-size:13px;white-space:nowrap;}
.vmsg{min-height:18px;margin-top:10px;font-size:12.5px;color:#ff8fa3;}
.vmsg.ok{color:var(--gold);}
.vsubmit{width:100%;margin-top:12px;padding:13px;border:0;border-radius:11px;cursor:pointer;
         background:linear-gradient(135deg,var(--blue),var(--gold));color:var(--sur-accent);
         font:inherit;font-weight:800;font-size:14px;}
.vsubmit:disabled{opacity:.6;cursor:default;}
.boost-suite{margin-top:16px;padding:14px;border:1px solid var(--border);border-radius:13px;background:var(--creux);}
.boost-suite[hidden]{display:none;}
.boost-suite b{display:block;color:var(--gold);font-size:13.5px;margin-bottom:7px;}
.boost-suite p{margin:0 0 8px;font-size:12.5px;color:var(--muted);line-height:1.6;}
.boost-suite p:last-child{margin-bottom:0;}
.boost-ok{color:var(--text)!important;}
.boost-rate{color:#ff8fa3!important;}
.sheet-fermer{margin-top:14px;width:100%;padding:11px;border-radius:11px;background:transparent;
  border:1px solid var(--border);color:var(--muted);font-size:12.5px;}

/* SAMII : une bulle, pas une fenêtre. Elle reste au coin, on l'ouvre quand
   on bloque. Sur téléphone elle remonte pour ne pas couvrir la barre du bas. */
.bulle{position:fixed;right:20px;bottom:20px;z-index:80;width:54px;height:54px;border-radius:50%;
  border:none;display:grid;place-items:center;cursor:pointer;
  background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);
  box-shadow:0 8px 26px rgba(0,0,0,.42);}
.bulle svg{width:23px;height:23px;}
.bulle-halo{position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--blue);
  animation:halo 2.6s ease-out infinite;pointer-events:none;}
@keyframes halo{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.55);opacity:0;}}
@media (prefers-reduced-motion:reduce){.bulle-halo{animation:none;}}

.chat{position:fixed;right:20px;bottom:86px;z-index:81;width:min(360px,calc(100% - 40px));
  height:min(480px,70vh);background:var(--panel);border:1px solid var(--border);border-radius:16px;
  display:none;flex-direction:column;overflow:hidden;box-shadow:0 18px 46px rgba(0,0,0,.5);}
.chat.on{display:flex;}
.chat-tete{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px;}
.chat-tete b{font-size:13.5px;color:var(--text);}
.chat-tete .pt{width:7px;height:7px;border-radius:50%;background:#00ff9d;}
.chat-tete button{margin-left:auto;background:transparent;border:none;color:var(--muted);font-size:19px;line-height:1;cursor:pointer;}
.chat-fil{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
.msg{max-width:84%;padding:10px 13px;border-radius:13px;font-size:12.8px;line-height:1.55;}
.msg--bot{background:rgba(255,255,255,.06);color:var(--text);align-self:flex-start;border-bottom-left-radius:4px;}
.msg--moi{background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);align-self:flex-end;border-bottom-right-radius:4px;font-weight:600;}
.chat-bas{padding:11px;border-top:1px solid var(--border);display:flex;gap:8px;}
.chat-bas input{flex:1;background:rgba(0,0,0,.28);border:1px solid var(--border);border-radius:10px;
  padding:10px 12px;color:var(--text);font-size:12.8px;outline:none;}
.chat-bas input:focus{border-color:var(--blue);}
.chat-bas button{padding:10px 15px;border-radius:10px;border:none;font-weight:700;font-size:12.5px;
  background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);cursor:pointer;}
@media(max-width:768px){.bulle{bottom:78px;right:14px;}.chat{bottom:142px;right:14px;}}
.post-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;container-type:inline-size;}
.post-card:hover{border-color:rgba(0,217,255,.3);}
.post-head{display:flex;align-items:center;gap:11px;margin-bottom:12px;}
.post-avatar{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:13px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;text-decoration:none;
  /* La photo est posée EN ABSOLU par-dessus les initiales, qui restent dans
     le flux : si l'adresse de l'image est morte, le onerror la retire et les
     initiales sont déjà là, à la bonne place. C'est la même règle que sur la
     vitrine — le repli est dessous, jamais à côté. */
  position:relative;overflow:hidden;}
.post-avatar img,.rank-avatar img,.comment-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.post-avatar-lien{flex-shrink:0;line-height:0;}
.post-authorblock{flex:1;min-width:0;}
.post-author{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;}
.post-author a,.rank-item{color:inherit;text-decoration:none;}
.post-author a:hover{color:var(--blue);}
.pin-ic{width:12px;height:12px;color:var(--gold);}
.post-meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);margin-top:2px;}
.grade-chip{font-family:"JetBrains Mono";padding:2px 8px;border-radius:20px;background:rgba(0,217,255,.08);border:1px solid rgba(0,217,255,.2);color:var(--blue);}
.grade-chip--gold{background:rgba(215,179,76,.1);border-color:rgba(215,179,76,.3);color:var(--gold);}
.dot-sep{opacity:.5;}
.cat-badge{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:5px 10px;border-radius:20px;background:color-mix(in srgb, var(--cat-color) 15%, transparent);border:1px solid var(--cat-color);color:var(--cat-color);flex-shrink:0;}
.cat-badge svg{width:11px;height:11px;}
.post-text{font-size:13.5px;line-height:1.6;margin:0 0 12px;white-space:pre-wrap;}
.post-media{border-radius:14px;overflow:hidden;border:1px solid var(--border);margin-bottom:12px;}
.post-media img,.post-media video{width:100%;max-height:420px;object-fit:cover;display:block;background:#000;}
.post-stats{display:flex;gap:14px;font-size:11px;color:var(--muted);padding-bottom:10px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.05);min-height:14px;}
.post-actions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;}
/* Cinq boutons dans une carte de 300 px : sans le retour à la ligne, le
   dernier sortait du cadre. Le libellé disparaît quand la carte est
   étroite — l'icône suffit, et une icône coupée ne sert à rien. */
@container (max-width:340px){.post-action-btn span{display:none;}}
.post-action-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--muted);font-size:11.5px;font-weight:700;}
.post-action-btn svg{width:15px;height:15px;}
.post-action-btn:hover{background:rgba(0,217,255,.06);color:var(--blue);}
.post-action-btn.liked{color:var(--danger);} .post-action-btn.liked svg{fill:var(--danger);}
/* Enregistré : le marque-page se remplit. Sur cinq boutons dans une rangée
   étroite, c'est la forme pleine qui se lit d'un coup d'œil, pas la
   couleur — et sur un téléphone à Douala, la rangée est très étroite. */
.post-action-btn.saved{color:var(--gold);} .post-action-btn.saved svg{fill:var(--gold);}
/* La corbeille ne prend pas sa part de largeur : c'est une action rare, elle
   ne doit pas peser autant que « J'aime ». */
.post-action-btn--danger,.post-action-btn--mien{flex:0 0 auto;padding:9px 11px;color:var(--muted);}
.post-action-btn--danger:hover{background:rgba(255,84,112,.1);color:var(--danger);}
.post-action-btn--mien:hover{background:var(--creux);color:var(--blue);}
/* « S'abonner » vit dans l'en-tête, à côté du nom — c'est de la personne
   qu'on parle, pas de la publication. Discret quand c'est déjà fait :
   « Abonné » est un état, pas une invitation à recliquer. */
.btn-abonner{padding:6px 12px;border-radius:999px;border:1px solid var(--blue);
  background:var(--blue);color:var(--sur-accent);font-size:11.5px;font-weight:700;
  cursor:pointer;white-space:nowrap;flex-shrink:0;}
.btn-abonner.on{background:transparent;color:var(--muted);border-color:var(--border);}
.btn-abonner:hover{opacity:.85;}
/* La zone d'édition en place : on corrige là où on lit, sans quitter le
   fil ni perdre les commentaires déjà reçus. */
.post-edit{display:flex;flex-direction:column;gap:9px;margin:8px 0 4px;}
.post-edit textarea{width:100%;min-height:88px;padding:11px 13px;border-radius:12px;
  border:1px solid var(--border);background:var(--creux);color:var(--text);
  font:inherit;font-size:13.5px;line-height:1.55;resize:vertical;}
.post-edit-actions{display:flex;gap:8px;justify-content:flex-end;}
.post-edit-actions button{padding:9px 16px;border-radius:10px;font-size:12.5px;font-weight:700;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;}
.post-edit-actions .enr{background:var(--blue);border-color:var(--blue);color:var(--sur-accent);}
@media(max-width:420px){.post-action-btn span{display:none;}}
.comments-preview{display:flex;flex-direction:column;gap:8px;}
.comment-item{display:flex;gap:8px;align-items:flex-start;}
.comment-avatar{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:8px;font-weight:900;color:white;background:linear-gradient(135deg,var(--blue),var(--blue-2));flex-shrink:0;position:relative;overflow:hidden;}
.comment-body strong a{color:inherit;text-decoration:none;} .comment-body strong a:hover{color:var(--blue);}
.comment-body{background:rgba(255,255,255,.03);border-radius:12px;padding:7px 11px;font-size:11.5px;flex:1;}
.comment-body strong{display:block;font-size:10.5px;margin-bottom:2px;} .comment-body span{color:var(--muted);}
.comment-box{display:flex;gap:8px;margin-top:10px;}
.comment-box input{flex:1;padding:10px 13px;border-radius:20px;border:1px solid var(--border);background:rgba(0,0,0,.25);color:var(--text);outline:none;font-size:12px;}
.comment-box button{width:38px;height:38px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--sur-accent);display:grid;place-items:center;flex-shrink:0;}
.comment-box button svg{width:15px;height:15px;}
.empty-feed{text-align:center;padding:80px 20px;border:1px dashed var(--border);border-radius:20px;color:var(--muted);}
.empty-feed svg{width:44px;height:44px;color:var(--blue);margin-bottom:14px;}
/* Le premier écran d'une communauté encore vide. Volontairement plein :
   c'est le seul que verront ses tout premiers visiteurs. */
.depart{border:1px solid var(--border);border-radius:20px;padding:26px 22px;background:var(--panel);}
.depart-h{text-align:center;margin-bottom:22px;}
.depart-pastille{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,var(--blue),var(--blue-2));color:var(--bg);font-weight:800;font-size:15px;margin-bottom:12px;}
.depart-h h3{margin:0 0 6px;font-size:19px;}
.depart-h p{margin:0;color:var(--muted);font-size:13px;line-height:1.6;}
.depart-l{list-style:none;margin:0 0 22px;padding:0;display:grid;gap:12px;}
.depart-l li{display:flex;gap:12px;align-items:flex-start;padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:var(--creux);}
.depart-l svg{width:19px;height:19px;color:var(--blue);flex:none;margin-top:2px;}
.depart-l b{display:block;font-size:13.5px;margin-bottom:2px;}
.depart-l span{color:var(--muted);font-size:12.5px;line-height:1.55;}
.depart-btn{display:block;text-align:center;padding:14px;border-radius:13px;background:linear-gradient(135deg,var(--blue),var(--gold));color:var(--bg);font-weight:800;font-size:14px;text-decoration:none;}
.depart-note{display:block;text-align:center;color:var(--muted);font-size:11.5px;margin-top:12px;line-height:1.5;}
.depart-amorces{display:grid;gap:10px;}
.amorce{display:flex;gap:11px;align-items:center;width:100%;text-align:left;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--creux);color:var(--text);font-family:inherit;font-size:13px;cursor:pointer;transition:.15s;}
.amorce:hover{border-color:var(--blue);transform:translateY(-1px);}
.amorce svg{width:18px;height:18px;color:var(--gold);flex:none;}
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#0c1a28;border:1px solid var(--blue);color:var(--text);padding:12px 22px;border-radius:12px;font-size:12px;z-index:900;opacity:0;transition:.3s;pointer-events:none;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.mobile-nav{display:none;}
/* Les intertitres de la colonne : « Parcourir », « La communauté ». Avec
   huit entrées d'affilée, on ne voit plus qu'une liste ; avec deux
   respirations, on voit trois groupes. */
.side-titre{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
            color:var(--muted);opacity:.65;margin:16px 0 6px;padding-left:11px;}
.side-quitter{display:flex;align-items:center;gap:9px;margin-top:14px;padding:10px 11px;
              border-radius:10px;border:1px solid var(--border);color:var(--muted);
              font-size:12px;font-weight:600;}
.side-quitter svg{width:15px;height:15px;}
.side-quitter:hover{color:var(--danger);border-color:var(--danger);}
.apropos-chiffres{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
.apropos-chiffres div{background:var(--creux);border:1px solid var(--border);border-radius:12px;padding:13px;text-align:center;}
.apropos-chiffres b{display:block;font-size:21px;font-weight:800;}
.apropos-chiffres span{font-size:11px;color:var(--muted);}
/* Le bandeau de « Mon espace » : on doit savoir tout de suite qu'on ne
   regarde plus le fil de tout le monde, sinon on croit que la communauté
   s'est vidée. */
.bandeau-espace{background:var(--creux);border:1px solid var(--border);border-radius:14px;
                padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;
                align-items:center;gap:12px;flex-wrap:wrap;}
.bandeau-espace b{font-size:14px;} .bandeau-espace span{font-size:12px;color:var(--muted);}
.bandeau-espace a{font-size:12px;font-weight:700;color:var(--blue);}
.depart-sortie{display:inline-block;margin-top:14px;padding:11px 18px;border-radius:11px;
  background:var(--blue);color:var(--sur-accent);font-size:12.5px;font-weight:700;}
.burger{display:none;}
.voile-menu{display:none;}
@media (max-width:900px){
/* LA COLONNE N'EST PLUS SUPPRIMÉE, ELLE EST RANGÉE.
   Elle était masquée purement et simplement : tout ce qu'elle contient — les sections,
   et surtout « Se déconnecter » — n'existait donc pas sur un téléphone.
   C'est là que ça compte le plus : un téléphone se prête, et on garde le
   compte de quelqu'un d'autre ouvert sans le vouloir. */
.sidebar{display:flex;transform:translateX(-102%);transition:transform .26s cubic-bezier(.16,1,.3,1);width:min(280px,84vw);
  /* OPAQUE, et à SA couleur. Le fond d'origine est un dégradé sombre
     translucide : posé au-dessus d'une page blanche, on lisait le fil au
     travers du menu, et le menu restait sombre sur une marque claire. */
  background:var(--panel);}
.sidebar.on{transform:translateX(0);box-shadow:8px 0 40px rgba(0,0,0,.28);}
/* Sur un petit écran, huit entrées plus le bas de colonne dépassent. Sans
   ce défilement, « Se déconnecter » est hors de l'écran et donc absent —
   ce qui nous ramène au problème qu'on vient de corriger.
   Le défilement est posé sur la COLONNE ENTIÈRE et pas seulement sur la
   liste : la première version ne débordait que de quelques pixels, et le
   bouton restait coupé sur les écrans les plus courts. */
.sidebar{overflow-y:auto;}
.sidebar nav{overflow:visible;}
/* Sur un téléphone, le bas de colonne ne se colle plus en bas : il suit
   directement le menu. Collé en bas d'une colonne plus haute que l'écran,
   « Se déconnecter » tombait sous la ligne de flottaison — présent dans le
   code, invisible pour la personne. Juste après « À propos », il se voit. */
.side-bottom{margin-top:14px;padding:11px;}
.side-bottom .side-text{display:none;}
.sidebar > div:first-child{flex:0 0 auto;}
.voile-menu{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:299;opacity:0;pointer-events:none;transition:opacity .26s;}
.voile-menu.on{opacity:1;pointer-events:auto;}
.burger{display:grid;place-items:center;}
.main{margin-left:0;width:100%;} .header{padding:12px 14px;} .header h1{font-size:16px;} .layout{padding:16px 12px 90px;}
.mobile-nav{position:fixed;left:8px;right:8px;bottom:8px;height:62px;z-index:400;display:grid;grid-template-columns:repeat(5,1fr);padding:5px;border:1px solid rgba(0,217,255,.22);border-radius:17px;background:rgba(4,10,17,.92);backdrop-filter:blur(25px);}
.mobile-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--muted);font-size:8px;font-weight:700;border-radius:12px;}
.mobile-nav a svg{width:18px;height:18px;} .mobile-nav a.active{color:var(--blue);background:rgba(0,217,255,.08);}
}
</style>
<style>
/* Les couleurs de la communauté, posées APRÈS la feuille d'origine.
   À spécificité égale, c'est la dernière règle qui gagne : écrite avant,
   elle était silencieusement écrasée et la page restait aux couleurs de la
   maison. Vide pour la communauté maison, qui garde sa feuille. */
:root{${communautes.styleDe(COM)}}
</style>
</head>
<body>
<div class="voile-menu" id="voileMenu"></div>
<aside class="sidebar" id="sidebar">
<div><div class="brand"><div class="brand-mark">${escapeHtml(COM.sigle)}</div><div class="brand-name">${escapeHtml(COM.marque)} <span>${escapeHtml(COM.marqueSuite)}</span></div></div>
<nav>
${COM.ecosysteme ? `
<a href="/qg" class="side-link"><i data-lucide="layout-dashboard"></i> QG Central</a>
<a href="/marketplace" class="side-link"><i data-lucide="store"></i> Marketplace</a>
<a href="/community" class="side-link active"><i data-lucide="users"></i> Communauté</a>
<a href="/discussions" class="side-link"><i data-lucide="message-circle"></i> Discussions</a>
<a href="/arsenal" class="side-link"><i data-lucide="shield-check"></i> Arsenal</a>
<a href="/academy" class="side-link"><i data-lucide="graduation-cap"></i> Academy</a>` : `
<a href="/c/${COM.slug}" class="side-link${!filtre ? " active" : ""}"><i data-lucide="users"></i> Le fil</a>
${connecte ? `<a href="/c/${COM.slug}?f=mes-publications" class="side-link${filtreMien ? " active" : ""}"><i data-lucide="user"></i> Mon espace</a>` : ""}
${connecte ? `<a href="/c/${COM.slug}?f=abonnements" class="side-link${filtreAbonnements ? " active" : ""}"><i data-lucide="heart-handshake"></i> Mes abonnements</a>` : ""}
<div class="side-titre">Parcourir</div>
<a href="/c/${COM.slug}?f=produit" class="side-link${filtre === "produit" ? " active" : ""}"><i data-lucide="shopping-bag"></i> Les produits</a>
<a href="/c/${COM.slug}?f=formation" class="side-link${filtre === "formation" ? " active" : ""}"><i data-lucide="graduation-cap"></i> Les formations</a>
<a href="/c/${COM.slug}?f=service" class="side-link${filtre === "service" ? " active" : ""}"><i data-lucide="concierge-bell"></i> Les services</a>
${connecte ? `<a href="/c/${COM.slug}?f=enregistres" class="side-link${filtreEnregistres ? " active" : ""}"><i data-lucide="bookmark"></i> Mes enregistrements</a>` : ""}
<!-- MES MESSAGES, ICI AUSSI.
     Cette barre latérale est écrite à la main, séparément de la colonne du
     QG : ajouter le module au registre ne l'y fait PAS apparaître. Ses
     membres vivent sur cette page — laisser le lien uniquement dans le QG,
     c'est le réserver aux marchands, alors que tout le monde reçoit des
     messages. -->
${connecte ? `<a href="/messages" class="side-link"><i data-lucide="mail"></i> Mes messages<span id="cpt-messages" style="margin-left:auto;font-size:11px;font-weight:800;color:var(--blue);"></span></a>` : ""}
<div class="side-titre">La communauté</div>
${connecte ? `<a href="#" class="side-link" onclick="ouvrirBoost();return false;"><i data-lucide="rocket"></i> Mettre en avant</a>` : ""}
<a href="#" class="side-link" onclick="ouvrirApropos();return false;"><i data-lucide="info"></i> À propos</a>`}
</nav></div>
<div class="side-bottom">
  <div class="side-ai"><span class="side-ai-dot"></span> ${escapeHtml(COM.moteur)}</div>
  <div class="side-text">${escapeHtml(COM.moteurTexte)}</div>
  ${connecte
    // « Donner la possibilité aux utilisateurs de se déconnecter. » Il n'y
    // avait AUCUN moyen de sortir : ni ici, ni dans l'en-tête, nulle part
    // sur la page. Sur un téléphone partagé — ce qui est courant — c'est le
    // compte de quelqu'un d'autre qu'on garde ouvert sans le vouloir.
    ? `<a href="/logout" class="side-quitter"><i data-lucide="log-out"></i> Se déconnecter</a>`
    : `<a href="${COM.ecosysteme ? "/login" : `/c/${COM.slug}/connexion`}" class="side-quitter"><i data-lucide="log-in"></i> Se connecter</a>`}
</div>
</aside>
<div class="main">
<header class="header">
<button class="icon-btn burger" id="burger" type="button" aria-label="Ouvrir le menu"><i data-lucide="menu"></i></button>
<h1>${escapeHtml(COM.nom)}</h1>
<div class="header-actions">${aBoutique ? `<a class="btn-boutique" href="/qg"><i data-lucide="layout-dashboard"></i><span>Ma boutique</span></a>` : ""}<button class="icon-btn" id="themeBtn" type="button"><i data-lucide="moon"></i></button>${COM.ecosysteme ? `<a class="icon-btn" href="/qg"><i data-lucide="layout-dashboard"></i></a>` : ""}</div>
</header>
<div class="layout">
<div class="col-side">
<div class="side-panel"><h3><i data-lucide="activity"></i> Tendances</h3>
<div class="stat-row"><span>${escapeHtml(COM.libelleMembres)}</span><strong>${stats.membres}</strong></div>
<div class="stat-row"><span>Publications</span><strong>${stats.publications}</strong></div>
${tendancesHtml}
<div class="stat-row"><span>Statut système</span><strong style="color:#00ff9d;">● Actif</strong></div>
</div>
${COM.ecosysteme ? `<div class="side-panel"><h3><i data-lucide="compass"></i> Écosystème</h3>
<a href="/qg" class="eco-link-item"><i data-lucide="layout-dashboard"></i> QG · Piloter votre activité</a>
<a href="/marketplace" class="eco-link-item"><i data-lucide="store"></i> Marketplace · Acheter & vendre</a>
<a href="/arsenal" class="eco-link-item"><i data-lucide="shield-check"></i> Arsenal · Débloquer vos pouvoirs</a>
<a href="/academy" class="eco-link-item"><i data-lucide="graduation-cap"></i> Academy · Apprendre & progresser</a>
</div>` : `<div class="side-panel"><h3><i data-lucide="megaphone"></i> Vendre ici</h3>
<div class="side-text" style="margin-bottom:12px;">${aBoutique ? "Retrouve ta boutique, tes commandes et tes produits." : "Tu as un produit, une formation, un service ? Ouvre ton profil et publie-le. Publier est gratuit ; la mise en avant est payante."}</div>
<a href="${boutique.url}" class="eco-link-item"><i data-lucide="${boutique.icone}"></i> ${boutique.libelle}</a>
${estAdmineDeChezElle ? `<a href="/admin/communaute" class="eco-link-item" style="color:var(--gold);"><i data-lucide="gauge"></i> Mon espace d'administration</a>` : ""}
<a href="#" class="eco-link-item" onclick="ouvrirVendre();return false;"><i data-lucide="tag"></i> Mettre en vente · formation, ebook…</a>
<a href="#" class="eco-link-item" onclick="ouvrirBoost();return false;"><i data-lucide="rocket"></i> Mettre en avant · dès 1 000 FCFA</a>
</div>
${connecte ? `<div class="side-panel">
  <h3><i data-lucide="messages-square"></i> Le salon</h3>
  <div class="side-text" style="margin-bottom:12px;">Le fil, c'est pour ce qu'on publie. Le salon, c'est pour se parler — en direct, tous ensemble ou en petits groupes.</div>
  <a href="/discussions" class="eco-link-item"><i data-lucide="message-circle"></i> Entrer dans le salon général</a>
  <a href="/discussions" class="eco-link-item"><i data-lucide="users-round"></i> Mes groupes de discussion</a>
</div>` : ""}
${COM.app ? `<div class="side-panel" id="panneauApp">
  <h3><i data-lucide="smartphone"></i> L'application</h3>
  <div class="side-text" style="margin-bottom:12px;">Installe ${escapeHtml(COM.app.nom)} sur ton téléphone. Rien à télécharger, l'icône se pose sur ton écran d'accueil, à côté de WhatsApp.</div>
  <button class="app-install" onclick="installerApp()"><i data-lucide="download"></i> Installer l'application</button>
  <!-- Le mode d'emploi manuel, révélé seulement si le navigateur refuse de
       proposer l'installation lui-même. Il est écrit ici plutôt que dans un
       message fugace : sur iPhone, c'est le SEUL chemin possible. -->
  <div class="app-manuel" id="appManuel" hidden></div>
</div>` : ""}`}</div>

<div class="col-feed">
${COM.ecosysteme ? `<div class="stories-bar">
<a class="story-circle story-circle--add" href="/stories/publier"><div class="story-ring story-ring--add"><i data-lucide="plus"></i></div><span>Ta story</span></a>
${storiesBarHtml}
</div>` : ""}
${!connecte ? `
<div class="composer invite">
  <div class="invite-h">Bienvenue sur ${escapeHtml(COM.nom)}</div>
  <p class="invite-p">Tu peux tout lire ici, librement. Un compte ne sert qu'au moment où tu veux publier, commenter ou acheter — et il se crée en trente secondes.</p>
  <div class="invite-a">
    <a class="invite-btn" href="${COM.ecosysteme ? `/register?c=${COM.slug}` : `/c/${COM.slug}/inscription`}">Créer mon compte</a>
    <a class="invite-btn invite-btn--calme" href="${COM.ecosysteme ? `/login?c=${COM.slug}` : `/c/${COM.slug}/connexion`}">J'ai déjà un compte</a>
  </div>
</div>` : `
<div class="composer">
<div class="composer-top">
<a class="composer-avatar-lien" href="${lienProfil(req.session.userId)}" title="Ma page — ma photo, mes produits, mes publications">${avatar(
    moi || { prenom: req.session.nom?.split(" ")[0], nom: req.session.nom?.split(" ")[1] },
    "composer-avatar")}</a>
<textarea id="composerText" placeholder="Exprime-toi... partage, propose, forme, vends. Gagne des points à chaque publication !" rows="2"></textarea>
</div>
<div class="cat-buttons">${catButtonsHtml}</div>

<div class="diffusion-box" id="diffusionBox">
<div class="diffusion-title"><i data-lucide="sparkles"></i> Publier aussi sur :</div>
<div class="diffusion-options" id="diffusionOptions"></div>
<div class="diffusion-hint">Décoche ce que tu ne veux pas partager ailleurs.</div>
</div>

<input type="file" id="fileInput" accept="image/*,video/*" style="display:none;">
<div class="upload-preview" id="uploadPreview"></div>
<div class="upload-status" id="uploadStatus">⏳ Envoi en cours...</div>
<div class="composer-bottom">
<span class="composer-hint">Publier est gratuit${COM.ecosysteme ? " · +5 points" : ""}</span>
<div style="display:flex;gap:8px;align-items:center;">
  <button class="composer-boost" type="button" onclick="ouvrirBoost()"><i data-lucide="rocket"></i> Mettre en avant</button>
  <button class="composer-submit" id="composerSubmit" type="button">Publier</button>
</div>
</div>
</div>`}
${enTeteFiltre}
<div id="feedContainer">${feedHtml}</div>
</div>

<div class="col-side"><div class="side-panel"><h3><i data-lucide="trophy"></i> Classement</h3>${classementHtml}</div></div>
</div>
</div>
<div class="toast" id="toast"></div>

<!-- La mise en avant : le revenu de la communauté. Publier reste gratuit ;
     on paie pour être vu plus longtemps, par ceux qui ont quelque chose à
     vendre. Les durées sont courtes exprès — on essaie à petit prix avant
     de reconduire. -->
<div class="sheet-voile" id="sheetVoile" onclick="fermerFiches()"></div>
<div class="sheet" id="sheetVendre" role="dialog" aria-label="Mettre en vente">
  <h3>Mettre en vente</h3>
  <p class="sheet-p">Ça apparaît dans ta vitrine ET dans le fil de la communauté. Publier est gratuit.</p>
  <div class="vendre-types">
    <button type="button" class="vtype actif" data-type="formation">Formation</button>
    <button type="button" class="vtype" data-type="ebook">Ebook</button>
    <button type="button" class="vtype" data-type="produit">Produit</button>
    <button type="button" class="vtype" data-type="service">Service</button>
  </div>
  <label class="vlab" for="vTitre">Titre</label>
  <input class="vin" id="vTitre" maxlength="180" placeholder="Ex : Lancer sa boutique en 7 jours">
  <label class="vlab" for="vPrix">Prix</label>
  <div class="vprix"><input class="vin" id="vPrix" inputmode="decimal" placeholder="5000"><span>${escapeHtml(COM.devise || "XAF")}</span></div>
  <label class="vlab" for="vDesc">Description</label>
  <textarea class="vin" id="vDesc" rows="3" maxlength="4000" placeholder="Ce que la personne reçoit, en deux phrases."></textarea>
  <label class="vlab" for="vPhoto">Lien de l'image <span style="text-transform:none;letter-spacing:0">— facultatif</span></label>
  <input class="vin" id="vPhoto" maxlength="800" placeholder="https://…">
  <div class="vmsg" id="vMsg"></div>
  <button class="vsubmit" id="vSubmit" type="button">Mettre en vente</button>
  <button class="sheet-fermer" onclick="fermerVendre()">Fermer</button>
</div>

<div class="sheet" id="sheetBoost" role="dialog" aria-label="Mettre en avant">
  <h3>Mettre ta publication en avant</h3>
  <p class="sheet-p">Elle reste en haut du fil et apparaît aux visiteurs qui ne te suivent pas encore. Publier restera toujours gratuit — ceci est pour ceux qui vendent.</p>
  <div class="offre-boost" data-boost="24h"><div><b>24 heures</b><span>Pour un lancement, une promo du jour</span></div><span class="px">1 000 FCFA</span></div>
  <div class="offre-boost" data-boost="7j"><div><b>7 jours</b><span>Le plus pris — laisse le temps aux gens de voir</span></div><span class="px">5 000 FCFA</span></div>
  <div class="offre-boost" data-boost="30j"><div><b>30 jours</b><span>Pour une formation, une offre permanente</span></div><span class="px">15 000 FCFA</span></div>
  <!-- Ce qui se passe après le choix, DANS la fiche et sans la fermer.
       Avant, la fiche se refermait toute seule et un message passait une
       seconde en bas de l'écran : de son côté, on clique et rien ne se
       passe. Le paiement n'est pas branché — autant le dire à l'endroit
       où la question est posée, et le dire assez longtemps pour être lu. -->
  <div class="boost-suite" id="boostSuite" hidden>
    <b id="boostChoixNom"></b>
    <p>Le paiement mobile — Orange Money, MTN — n'est pas encore branché. C'est la dernière pièce qui manque, et elle ne dépend plus du code.</p>
    <!-- Sans genre : cette phrase s'affiche à tout le monde, pas seulement
         à la créatrice qui a ouvert la communauté. -->
    <p class="boost-ok" id="boostNote">Ton choix est noté. On te prévient dès que la mise en avant s'ouvre.</p>
  </div>
  <button class="sheet-fermer" onclick="fermerBoost()">Fermer</button>
</div>

<!-- À PROPOS. Une communauté sans page « à propos », c'est un fil sans
     porte d'entrée : quelqu'un qui arrive par un lien partagé ne sait pas
     où il est tombé ni ce qu'on y fait. Le texte vient de la configuration
     de la communauté — c'est SA description, pas la nôtre. -->
<div class="sheet" id="sheetApropos" role="dialog" aria-label="À propos">
  <h3>${escapeHtml(COM.nom)}</h3>
  <p class="sheet-p">${escapeHtml(COM.apropos || COM.moteurTexte)}</p>
  <div class="apropos-chiffres">
    <div><b>${stats.membres}</b><span>membre${stats.membres > 1 ? "s" : ""}</span></div>
    <div><b>${stats.publications}</b><span>publication${stats.publications > 1 ? "s" : ""}</span></div>
  </div>
  <p class="sheet-p" style="margin-top:14px;">${escapeHtml(COM.vide)}</p>
  <button class="sheet-fermer" onclick="fermerApropos()">Fermer</button>
</div>

<!-- SAMII, en bulle. Volontairement branché sur /vitrine/chat : cet accès
     est déjà public, déjà limité par IP, et ne touche à aucun compte. Un
     visiteur peut poser sa question avant même de savoir s'il reste. -->
<div class="chat" id="chat">
  <div class="chat-tete"><span class="pt"></span><b>${escapeHtml(COM.assistant)}</b><button onclick="basculerChat()" aria-label="Fermer">×</button></div>
  <div class="chat-fil" id="chatFil">
    <div class="msg msg--bot">Bonjour 👋 Je suis ${escapeHtml(COM.assistant)}. Demande-moi ce que tu veux sur ${escapeHtml(COM.nom)} — comment vendre ici, comment publier, ce que ça coûte.</div>
  </div>
  <div class="chat-bas">
    <input type="text" id="chatSaisie" placeholder="Écris ta question..." autocomplete="off">
    <button type="button" onclick="envoyerChat()">Envoyer</button>
  </div>
</div>
<button class="bulle" onclick="basculerChat()" aria-label="Parler à ${escapeHtml(COM.assistant)}">
  <span class="bulle-halo"></span><i data-lucide="bot"></i>
</button>

${
  // Elle était simplement supprimée chez une partenaire : ses membres se
  // retrouvaient sans aucune navigation en bas de l'écran, là où le pouce
  // la cherche. Elle suit maintenant ses modules à elle.
  mobileNav(communautes.accueil(COM), COM, { userId: req.session?.userId })
}
<script>
if (typeof lucide!=="undefined") lucide.createIcons();

// ── OÙ LA PAGE ENVOIE SES ACTIONS ───────────────────────────────────────
//
// Publier, aimer, commenter, vendre : les six appels de cette page visaient
// « /community/… » écrit en dur. Ça marchait tant que cette adresse
// répondait pour tout le monde.
//
// La porte l'a fermée sur le service d'une partenaire — et ces six appels
// avec elle, SANS un mot : ils reçoivent un 404 JSON, la page affiche
// « Erreur », et rien dans les journaux ne dit que la publication n'est
// jamais partie. C'est ma régression, et le contrôle des culs-de-sac ne
// pouvait pas la voir : il lit les redirections du serveur, pas les appels
// du navigateur.
//
// Le routeur est monté aux DEUX adresses, /community et /c. Sous /c, la
// communauté ne vient pas de l'URL — un POST n'a pas de slug — mais du
// service ou de la session. Il n'y a donc rien à ajouter au chemin.
// Le compteur de messages non lus, dans la barre latérale de sa communauté.
// Ses membres vivent sur cette page : sans ce chiffre ici, une question de
// client attend dans une boîte que personne n'ouvre.
fetch("/messages/non-lus")
  .then(function (r) { return r.json(); })
  .then(function (d) {
    var c = document.getElementById("cpt-messages");
    if (c && d.success && d.nonLus > 0) c.textContent = d.nonLus;
  })
  .catch(function () {});

const BASE_COM = ${JSON.stringify(COM.ecosysteme ? "/community" : "/c")};
// Le lien qu'on copie en partageant, lui, doit être l'adresse PUBLIQUE de
// la page — celle qu'on peut coller dans une story et qui ouvre le fil.
const PAGE_COM = ${JSON.stringify(communautes.accueil(COM))};
const PAGE_FILTRE = ${JSON.stringify(filtre)};

// ── La mise en avant ────────────────────────────────────────────────────
// Le paiement n'est pas encore branché. On le DIT, on ne le simule pas :
// une boutique qui fait semblant d'encaisser perd la confiance qu'elle
// vient de gagner. Le choix est enregistré, l'encaissement arrive après.
let boostChoisi = null;
function ouvrirBoost(){
  document.getElementById("sheetVoile").classList.add("on");
  document.getElementById("sheetBoost").classList.add("on");
}
function fermerBoost(){
  document.getElementById("sheetVoile").classList.remove("on");
  document.getElementById("sheetBoost").classList.remove("on");
}
// ── Mettre en vente ─────────────────────────────────────────────────────
let typeVente = "formation";
function ouvrirVendre(){
  document.getElementById("sheetVoile").classList.add("on");
  document.getElementById("sheetVendre").classList.add("on");
  const t = document.getElementById("vTitre"); if (t) t.focus();
}
function fermerVendre(){
  document.getElementById("sheetVoile").classList.remove("on");
  document.getElementById("sheetVendre").classList.remove("on");
}
document.querySelectorAll(".vtype").forEach(function(b){
  b.addEventListener("click", function(){
    document.querySelectorAll(".vtype").forEach(function(o){ o.classList.remove("actif"); });
    b.classList.add("actif");
    typeVente = b.dataset.type;
  });
});
const vBouton = document.getElementById("vSubmit");
if (vBouton) vBouton.addEventListener("click", async function(){
  const msg = document.getElementById("vMsg");
  const titre = document.getElementById("vTitre").value.trim();
  const prix  = document.getElementById("vPrix").value.trim();
  // On refuse ici avant d'appeler : une erreur immédiate vaut mieux qu'un
  // aller-retour pour apprendre qu'il manque le titre.
  if (!titre) { msg.className = "vmsg"; msg.textContent = "Donne un titre."; return; }
  if (!prix)  { msg.className = "vmsg"; msg.textContent = "Indique un prix — c'est ce qui rend l'offre achetable."; return; }
  vBouton.disabled = true; msg.className = "vmsg"; msg.textContent = "Un instant…";
  try {
    const r = await fetch(BASE_COM + "/vendre", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: typeVente, titre, prix,
        description: document.getElementById("vDesc").value.trim(),
        photo_url: document.getElementById("vPhoto").value.trim(),
      }),
    });
    const d = await r.json();
    if (d.success) {
      msg.className = "vmsg ok";
      msg.textContent = "En ligne — dans ta vitrine et dans le fil.";
      setTimeout(function(){ window.location.reload(); }, 900);
      return;
    }
    msg.textContent = d.error || "Impossible pour l'instant.";
  } catch (e) {
    msg.textContent = "Connexion perdue. Réessaie.";
  }
  vBouton.disabled = false;
});

document.querySelectorAll("[data-boost]").forEach(function(el){
  el.addEventListener("click", function(){
    document.querySelectorAll("[data-boost]").forEach(function(o){ o.classList.remove("choisi"); });
    el.classList.add("choisi");
    boostChoisi = el.dataset.boost;

    const suite = document.getElementById("boostSuite");
    const note  = document.getElementById("boostNote");
    document.getElementById("boostChoixNom").textContent =
        "Mise en avant " + el.querySelector("b").textContent + " — " + el.querySelector(".px").textContent;
    suite.hidden = false;

    // On enregistre vraiment l'intention. Sans ça, le jour où le paiement
    // s'ouvre, on ne sait pas à qui écrire — et ceux qui ont essayé les
    // premiers sont précisément ceux qu'il faut rappeler.
    fetch(BASE_COM + "/boost/interet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duree: boostChoisi }),
    })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d || !d.success) throw new Error("non enregistré");
      })
      .catch(function(){
        // On ne prétend pas avoir noté quelque chose qu'on n'a pas noté.
        note.textContent = "Ton choix n'a pas pu être enregistré — écris-nous et on te met sur la liste.";
        note.classList.add("boost-rate");
      });
  });
});
document.addEventListener("keydown", function(e){ if(e.key==="Escape"){ fermerBoost(); fermerVendre(); } });

// ── L'application ───────────────────────────────────────────────────────
// Le navigateur décide seul si une page est installable — et il ne le dit
// qu'en émettant l'événement « beforeinstallprompt ». On garde donc le
// panneau CACHÉ tant qu'il n'est pas arrivé : un bouton « Installer » qui
// ne fait rien parce que le navigateur refuse (iOS, page déjà installée,
// connexion non sécurisée) est pire que pas de bouton du tout.
let inviteApp = null;
window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    inviteApp = e;
});

// Le mode d'emploi manuel, par navigateur. Sur iPhone, « beforeinstallprompt »
// n'existe pas et n'existera pas : Safari n'installe QUE par le menu Partager.
// Un message fugace en bas de l'écran n'y suffit pas — on écrit les gestes,
// et ils restent affichés le temps qu'il faut pour les faire.
function modeEmploiInstallation() {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iOS) {
        return "Sur iPhone : appuie sur <b>Partager</b> (le carré avec la flèche, en bas), " +
               "puis fais défiler et choisis <b>« Sur l'écran d'accueil »</b>.";
    }
    if (/Android/.test(ua)) {
        return "Sur Android : ouvre le menu de ton navigateur (les <b>⋮</b> en haut à droite), " +
               "puis choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.";
    }
    return "Ouvre le menu de ton navigateur, puis choisis <b>« Installer »</b> " +
           "ou <b>« Ajouter à l'écran d'accueil »</b>.";
}

async function installerApp() {
    // Le navigateur ne veut pas proposer l'installation : on ne fait pas
    // semblant, on montre les gestes à faire à la main.
    if (!inviteApp) {
        const zone = document.getElementById("appManuel");
        if (zone) { zone.innerHTML = modeEmploiInstallation(); zone.hidden = false; }
        return;
    }
    inviteApp.prompt();
    const choix = await inviteApp.userChoice;
    inviteApp = null;
    if (choix.outcome === "accepted") showToast("C'est installé — regarde ton écran d'accueil.");
}

// Déjà installée : le panneau n'a plus rien à proposer.
window.addEventListener("appinstalled", function () {
    const p = document.getElementById("panneauApp"); if (p) p.style.display = "none";
});
// Ouverte DEPUIS l'application installée : inutile de proposer de l'installer.
if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    document.addEventListener("DOMContentLoaded", function () {
        const p = document.getElementById("panneauApp"); if (p) p.style.display = "none";
    });
}

// ── SAMII en bulle ──────────────────────────────────────────────────────
// L'historique reste dans la page : il sert de contexte à la réponse
// suivante, et il repart à zéro au rechargement — on ne garde la
// conversation d'un visiteur anonyme nulle part.
let chatHistorique = [];
let chatOccupe = false;

function basculerChat(){
  const c = document.getElementById("chat");
  c.classList.toggle("on");
  if (c.classList.contains("on")) document.getElementById("chatSaisie").focus();
}
function ajouterMsg(texte, deMoi){
  const fil = document.getElementById("chatFil");
  const d = document.createElement("div");
  d.className = "msg " + (deMoi ? "msg--moi" : "msg--bot");
  d.textContent = texte;
  fil.appendChild(d);
  fil.scrollTop = fil.scrollHeight;
  return d;
}
async function envoyerChat(){
  if (chatOccupe) return;
  const champ = document.getElementById("chatSaisie");
  const texte = champ.value.trim();
  if (!texte) return;
  champ.value = "";
  ajouterMsg(texte, true);
  chatOccupe = true;
  const attente = ajouterMsg("…", false);
  try {
    const r = await fetch("/vitrine/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: texte, langue: "fr", historique: chatHistorique }),
    });
    const j = await r.json();
    attente.textContent = j.reply || "Je n'ai pas pu répondre. Réessaie dans un instant.";
    chatHistorique.push({ role: "user", message: texte });
    chatHistorique.push({ role: "model", message: attente.textContent });
    if (chatHistorique.length > 6) chatHistorique = chatHistorique.slice(-6);
  } catch (e) {
    // Le réseau tombe : on le dit dans la bulle plutôt que de laisser
    // « … » à l'écran, ce qui ferait croire à une attente sans fin.
    attente.textContent = "Connexion perdue. Réessaie dans un instant.";
  }
  chatOccupe = false;
}
// ── UN ÉLÉMENT ABSENT NE DOIT PAS TUER TOUTE LA PAGE ────────────────────
//
// Ces trois branchements sont au PREMIER NIVEAU du script : ils s'exécutent
// au chargement, pas sur un clic. getElementById rend null quand l'élément
// n'est pas là, et appeler addEventListener sur null lève une TypeError qui
// arrête TOUT LE SCRIPT — pas seulement la ligne fautive.
//
// Or fileInput et composerSubmit vivent dans le composer, et le composer
// est derrière le ternaire "!connecte ? invitation : composer" (ligne
// ~1106) : ils N'EXISTENT PAS pour un visiteur non connecté.
//
// Résultat pour ce visiteur : la ligne fileInput levait, et tout ce qui
// suit ne s'exécutait jamais — le bouton Publier, les j'aime, le menu
// mobile, le thème. La page s'affichait normalement et NE RÉAGISSAIT À
// RIEN. Aucun message, aucune trace serveur : l'erreur ne vit que dans la
// console du navigateur, que personne n'ouvre.
//
// ATTENTION en modifiant ce commentaire : il est DANS un littéral de
// gabarit. Un accent grave y ferme la chaîne, et une accolade précédée
// d'un dollar y devient une interpolation. Les deux ont cassé ce fichier
// pendant l'écriture de ce correctif — node --check les a attrapés.
//
// Le "?." était déjà utilisé plus haut pour themeBtn : la bonne façon
// était connue, elle n'avait simplement pas été appliquée partout.
document.getElementById("chatSaisie")?.addEventListener("keydown", function(e){
  if (e.key === "Enter") { e.preventDefault(); envoyerChat(); }
});
const savedTheme=localStorage.getItem("samii_community_theme"); if(savedTheme==="light") document.body.classList.add("light");
function upIcon(){const b=document.getElementById("themeBtn");if(!b)return;b.innerHTML=document.body.classList.contains("light")?'<i data-lucide="sun"></i>':'<i data-lucide="moon"></i>';if(typeof lucide!=="undefined")lucide.createIcons();}
upIcon();
document.getElementById("themeBtn")?.addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("samii_community_theme",document.body.classList.contains("light")?"light":"dark");upIcon();});
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}

const MODULES_PAR_CATEGORIE = {
    photo: [], video: [],
    produit: ["marketplace"],
    service: ["marketplace"],
    formation: ["academy"],
    publication: [],
};
const MODULES_LABELS = { marketplace: { label:"Marketplace", icon:"store" }, academy: { label:"Academy", icon:"graduation-cap" } };

let selectedCategory="publication", uploadedImageUrl="", uploadedVideoUrl="";

function updateDiffusionBox(cat) {
    const box = document.getElementById("diffusionBox");
    const opts = document.getElementById("diffusionOptions");
    const extras = MODULES_PAR_CATEGORIE[cat] || [];
    if (!extras.length) { box.classList.remove("show"); opts.innerHTML=""; return; }
    box.classList.add("show");
    opts.innerHTML = extras.map(m => {
        const info = MODULES_LABELS[m];
        return '<label class="diffusion-chip"><input type="checkbox" name="diffusion" value="'+m+'" checked><i data-lucide="'+info.icon+'"></i> '+info.label+'</label>';
    }).join("");
    if (typeof lucide!=="undefined") lucide.createIcons();
}

document.querySelectorAll(".cat-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
        document.querySelectorAll(".cat-btn").forEach(b=>b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedCategory=btn.dataset.cat;
        updateDiffusionBox(selectedCategory);
        if(selectedCategory==="photo"||selectedCategory==="video"){
            document.getElementById("fileInput").accept=selectedCategory==="photo"?"image/*":"video/*";
            document.getElementById("fileInput").click();
        }
    });
});

document.getElementById("fileInput")?.addEventListener("change",async function(){
    const file=this.files[0]; if(!file) return;
    const status=document.getElementById("uploadStatus"); const preview=document.getElementById("uploadPreview");
    status.style.display="block"; status.textContent="⏳ Envoi en cours...";
    try{
        const fd=new FormData(); fd.append("file",file); fd.append("upload_preset","MARKETPLACE OG");
        const isVideo=file.type.startsWith("video"); const rt=isVideo?"video":"image";
        const res=await fetch("https://api.cloudinary.com/v1_1/ojwx5hft/"+rt+"/upload",{method:"POST",body:fd});
        const json=await res.json();
        if(json.secure_url){
            if(isVideo){uploadedVideoUrl=json.secure_url;uploadedImageUrl="";} else {uploadedImageUrl=json.secure_url;uploadedVideoUrl="";}
            preview.style.display="block";
            preview.innerHTML=(isVideo?'<video src="'+json.secure_url+'" controls></video>':'<img src="'+json.secure_url+'" alt="">')+'<button class="upload-remove" type="button" onclick="removeUpload()"><i data-lucide="x"></i></button>';
            if(typeof lucide!=="undefined")lucide.createIcons();
            status.style.display="none"; showToast("✅ Fichier prêt !");
        } else { status.textContent="❌ Échec de l'envoi."; }
    }catch(e){ status.textContent="❌ Erreur réseau."; }
});
function removeUpload(){uploadedImageUrl="";uploadedVideoUrl="";document.getElementById("uploadPreview").style.display="none";document.getElementById("uploadPreview").innerHTML="";document.getElementById("fileInput").value="";}

// Les amorces du premier écran. Toucher une phrase la met dans le champ du
// haut, curseur à la fin, prêt à finir la phrase : devant un champ vide on
// ne poste pas, devant une phrase commencée si.
document.querySelectorAll(".amorce").forEach(function(b){
    b.addEventListener("click",function(){
        const champ=document.getElementById("composerText");
        if(!champ) return;
        champ.value=this.dataset.amorce+" ";
        champ.focus();
        champ.setSelectionRange(champ.value.length,champ.value.length);
        champ.scrollIntoView({behavior:"smooth",block:"center"});
    });
});

document.getElementById("composerSubmit")?.addEventListener("click",async function(){
    const contenu=document.getElementById("composerText").value.trim();
    if(!contenu && !uploadedImageUrl && !uploadedVideoUrl){ showToast("Écris quelque chose ou ajoute un fichier."); return; }
    const diffusionCheckboxes=document.querySelectorAll('input[name="diffusion"]:checked');
    const diffusion=Array.from(diffusionCheckboxes).map(cb=>cb.value);
    this.disabled=true;
    try{
        const res=await fetch(BASE_COM + "/publier",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({contenu,categorie:selectedCategory,image_url:uploadedImageUrl,video_url:uploadedVideoUrl,diffusion})});
        const json=await res.json();
        if(json.success){ window.location.reload(); } else { showToast(json.error||"Erreur."); this.disabled=false; }
    }catch(e){ showToast("Erreur réseau."); this.disabled=false; }
});

async function toggleLike(id,btn){
    try{const res=await fetch(BASE_COM + "/like/"+id,{method:"POST"});const j=await res.json();if(j.success)btn.classList.toggle("liked",j.liked);}catch(e){showToast("Erreur réseau.");}
}
async function toggleAbonner(id,btn){
    try{
        const res=await fetch(BASE_COM + "/abonner/"+id,{method:"POST"});
        const j=await res.json();
        if(!j.success){ showToast(j.error||"Erreur."); return; }
        // Toutes les publications de la même personne changent d'un coup :
        // laisser « S'abonner » sur ses autres publications donnerait
        // l'impression que le clic n'a pas marché.
        const carte=btn.closest(".post-card");
        const auteur=carte && carte.dataset.auteurId;
        const cibles=auteur
            ? document.querySelectorAll('.post-card[data-auteur-id="'+auteur+'"] .btn-abonner')
            : [btn];
        cibles.forEach(b=>{ b.classList.toggle("on",j.abonne); b.textContent=j.abonne?"Abonné":"S'abonner"; });
        showToast(j.abonne?"Tu suis cette personne":"Tu ne la suis plus");
        if(!j.abonne && PAGE_FILTRE==="abonnements" && carte) carte.remove();
    }catch(e){showToast("Erreur réseau.");}
}

async function toggleEnregistrer(id,btn){
    try{
        const res=await fetch(BASE_COM + "/enregistrer/"+id,{method:"POST"});
        const j=await res.json();
        if(!j.success){ showToast(j.error||"Erreur."); return; }
        btn.classList.toggle("saved",j.enregistre);
        const t=btn.querySelector("span"); if(t) t.textContent=j.enregistre?"Enregistré":"Enregistrer";
        showToast(j.enregistre?"🔖 Mis de côté":"Retiré de tes enregistrements");
        // Dans la liste des enregistrements, retirer veut dire faire
        // disparaître la carte : la laisser afficherait une publication qui
        // n'a plus rien à faire dans cette liste.
        if(!j.enregistre && PAGE_FILTRE==="enregistres"){
            const carte=btn.closest(".post-card"); if(carte) carte.remove();
        }
    }catch(e){showToast("Erreur réseau.");}
}

// ── LE MENU SUR TÉLÉPHONE ───────────────────────────────────────────────
// La colonne était simplement supprimée sur mobile. Elle se range et se
// rouvre — c'est le seul endroit d'où on peut se déconnecter.
(function(){
  const cote = document.getElementById("sidebar");
  const voile = document.getElementById("voileMenu");
  const bouton = document.getElementById("burger");
  if(!cote || !voile || !bouton) return;
  const ouvrir = (o) => { cote.classList.toggle("on",o); voile.classList.toggle("on",o); };
  bouton.addEventListener("click", () => ouvrir(!cote.classList.contains("on")));
  voile.addEventListener("click", () => ouvrir(false));
  // Un lien cliqué referme le tiroir : sinon il reste ouvert par-dessus la
  // page qu'on vient de demander.
  cote.querySelectorAll("a").forEach(a => a.addEventListener("click", () => ouvrir(false)));
  document.addEventListener("keydown", e => { if(e.key === "Escape") ouvrir(false); });
})();

// Le voile ne refermait que la fiche « Mettre en avant ». Avec une seconde
// fiche, cliquer à côté laissait celle-ci ouverte sous un voile qui ne
// répondait plus : la page paraissait figée.
function fermerFiches(){
  document.getElementById("sheetVoile").classList.remove("on");
  document.querySelectorAll(".sheet.on").forEach(f => f.classList.remove("on"));
}

function ouvrirApropos(){
  document.getElementById("sheetVoile").classList.add("on");
  document.getElementById("sheetApropos").classList.add("on");
}
function fermerApropos(){
  document.getElementById("sheetVoile").classList.remove("on");
  document.getElementById("sheetApropos").classList.remove("on");
}

// ── MODIFIER SANS QUITTER LE FIL ────────────────────────────────────────
// Corriger un prix ou une faute imposait de supprimer et republier — en
// perdant les j'aime, les commentaires et la place dans le fil. Personne ne
// fait ça : on laisse l'erreur en ligne.
function modifierPost(id){
  const carte = document.querySelector('.post-card[data-post-id="'+id+'"]');
  if(!carte || carte.querySelector(".post-edit")) return;
  const texte = carte.querySelector(".post-text");
  const actuel = texte ? texte.textContent : "";

  const zone = document.createElement("div");
  zone.className = "post-edit";
  const champ = document.createElement("textarea");
  champ.value = actuel;
  champ.maxLength = 5000;
  const actions = document.createElement("div");
  actions.className = "post-edit-actions";
  const annuler = document.createElement("button");
  annuler.type = "button"; annuler.textContent = "Annuler";
  const enregistrer = document.createElement("button");
  enregistrer.type = "button"; enregistrer.className = "enr"; enregistrer.textContent = "Enregistrer";
  actions.append(annuler, enregistrer);
  zone.append(champ, actions);

  if(texte) texte.style.display = "none";
  carte.insertBefore(zone, texte ? texte.nextSibling : carte.firstChild);
  champ.focus();

  const refermer = () => { zone.remove(); if(texte) texte.style.display = ""; };
  annuler.addEventListener("click", refermer);

  enregistrer.addEventListener("click", async () => {
    const contenu = champ.value.trim();
    if(!contenu){ showToast("Le texte ne peut pas être vide."); return; }
    enregistrer.disabled = true;
    try{
      const res = await fetch(BASE_COM + "/modifier/" + id, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contenu })
      });
      const j = await res.json();
      if(!j.success){ showToast(j.error || "Erreur."); enregistrer.disabled = false; return; }
      // textContent, jamais innerHTML : ce texte vient d'être tapé par
      // quelqu'un, et le poser en HTML ferait exécuter ce qu'il contient.
      if(texte) texte.textContent = j.contenu;
      refermer();
      showToast("Publication modifiée.");
    }catch(e){ showToast("Erreur réseau."); enregistrer.disabled = false; }
  });
}

async function supprimerPost(id){
    // Une suppression ne se rattrape pas. On demande, une fois, clairement.
    if(!confirm("Supprimer cette publication ? C'est définitif.")) return;
    try{
        const res=await fetch(BASE_COM + "/supprimer/"+id,{method:"POST"});
        const j=await res.json();
        if(!j.success){ showToast(j.error||"Erreur."); return; }
        const carte=document.querySelector('.post-card[data-post-id="'+id+'"]');
        if(carte) carte.remove(); else window.location.reload();
        showToast("Publication supprimée.");
    }catch(e){showToast("Erreur réseau.");}
}

function toggleCommentBox(id){const box=document.getElementById("comment-box-"+id);box.style.display=box.style.display==="none"?"flex":"none";if(box.style.display==="flex")document.getElementById("comment-input-"+id).focus();}
async function postComment(id){
    const input=document.getElementById("comment-input-"+id); const contenu=input.value.trim(); if(!contenu) return;
    try{const res=await fetch(BASE_COM + "/commenter/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contenu})});
    const j=await res.json(); if(j.success) window.location.reload(); else showToast(j.error||"Erreur.");}catch(e){showToast("Erreur réseau.");}
}
// ── ÉCRIRE À QUELQU'UN DEPUIS LE FIL ─────────────────────────────────
// « Sur chaque profil on doit pouvoir lui laisser un message. » Depuis le
// fil, sans quitter la page : passer par la vitrine pour poser une question
// fait perdre la moitié des gens en route.
// Le bouton se passe LUI-MÊME en argument, et on lit l'auteur depuis la
// carte. Une première version injectait le nom dans l'attribut onclick,
// entre guillemets doubles : ces guillemets fermaient l'attribut, et le
// bouton ne faisait plus rien. Un nom portant une apostrophe aurait cassé
// la page entière.
function ecrireA(bouton) {
  var carte = bouton.closest(".post-card");
  if (!carte) return;
  var qui = carte.getAttribute("data-auteur-id");
  var lien = carte.querySelector(".post-author a");
  var nom = lien ? lien.textContent.trim() : "ce membre";
  if (!qui) return;
  var texte = window.prompt("Ton message à " + nom + " :");
  if (texte === null) return;
  texte = texte.trim();
  if (!texte) return;
  // Adresse ABSOLUE, sans BASE_COM : la messagerie est la même pour toutes
  // les communautés, c'est le service qui décide de laquelle il s'agit.
  fetch("/messages/envoyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinataire: qui, contenu: texte }),
  })
  .then(function (r) { return r.json(); })
  .then(function (rep) {
    if (!rep.success) throw new Error(rep.error || "refusé");
    alert("✅ Message envoyé à " + nom + ".\nSa réponse arrivera dans « Mes messages ».");
  })
  .catch(function (err) { alert("Message non envoyé : " + err.message); });
}

function sharePost(id){const url=window.location.origin+PAGE_COM+"#post-"+id;if(navigator.share)navigator.share({url}).catch(()=>{});else{navigator.clipboard.writeText(url);showToast("🔗 Lien copié !");}}
</script>
<script src="/js/pwa-register.js"></script>
</body></html>`);
});

// Crée réellement l'annonce Marketplace correspondant à une publication
// "produit"/"service" — n'utilise que des données réelles (contenu de la
// publication, pays du profil) ; laisse prix/catégorie vides plutôt que
// d'inventer une valeur (affichage "Sur devis"/"Autre" déjà géré ailleurs).
// `slugCom` est passé par l'appelant, qui seul connaît la communauté :
// cette fonction tourne APRÈS la réponse HTTP et n'a donc plus accès à
// `res`. C'est la même leçon que pour la réponse de l'assistant — une
// fonction de fond qui lit `res` plante au moment exact où elle sert.
async function diffuserVersMarketplace(pub, userId, nomAuteur, slugCom) {
    const titre = (pub.contenu || "Service proposé").slice(0, 180) || "Service proposé";
    const categorieAnnonce = pub.categorie === "service" ? "service-autre" : null;

    let pays = null;
    try {
        const u = await db.query(`SELECT pays FROM utilisateurs WHERE id = $1`, [userId]);
        pays = u[0]?.pays || null;
    } catch { /* pays optionnel */ }

    const rows = await db.query(
        // La communauté voyage avec l'annonce : une vente publiée chez elle
        // reste chez elle. Sans ça, ses membres remplissaient NOTRE
        // Marketplace sans le savoir, et ne retrouvaient jamais leur annonce.
        `INSERT INTO annonces (titre, categorie, prix, pays, description, photo_url, vendeur_id, vendeur_nom, type_vendeur, actif, communaute)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'particulier',true,$8) RETURNING id`,
        [titre, categorieAnnonce, pays, pub.contenu || "", pub.image_url || null, userId, nomAuteur, slugCom]
    );
    return rows[0]?.id || null;
}

// Idem pour Academy — academie_cours n'a aucune colonne obligatoire hors id,
// donc pas besoin d'inventer de données manquantes (prix/durée restent NULL).
async function diffuserVersAcademy(pub, userId, nomAuteur) {
    const titre = (pub.contenu || "Formation").slice(0, 180) || "Formation";
    const rows = await db.query(
        `INSERT INTO academie_cours (titre, description, photo_url, video_url, formateur_id, formateur_nom, type_formateur, actif)
         VALUES ($1,$2,$3,$4,$5,$6,'communaute',true) RETURNING id`,
        [titre, pub.contenu || "", pub.image_url || null, pub.video_url || null, userId, nomAuteur]
    );
    return rows[0]?.id || null;
}

router.post("/publier", requireAuth, async (req, res) => {
    try {
        const { contenu, image_url, video_url, categorie, diffusion } = req.body;
        if (!contenu && !image_url && !video_url) return res.json({ success:false, error:"Ajoute du texte ou un fichier." });

        const cat = CATEGORIES[categorie] ? categorie : "publication";
        const nomAuteur = (req.session.nom || "Membre SAMII").trim();

        // Où l'on publie. Le lecteur du fil filtre là-dessus : si on ne
        // l'écrit pas ici, ce qu'un membre poste chez une partenaire
        // atterrit dans notre communauté et disparaît de la sienne.
        const COM = communauteDe(req);

        const insertRes = await db.query(
            `INSERT INTO publications (auteur_id, contenu, image_url, video_url, categorie, type, communaute) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [req.session.userId, contenu||"", image_url||null, video_url||null, cat, video_url?"video":image_url?"image":"texte", COM.slug]
        );
        const publicationId = insertRes[0]?.id;
        const pub = { contenu, image_url, video_url, categorie: cat };

        await gradeService.ajouterPoints(req.session.userId, 5, "Publication Communauté");

        try {
            await db.query(`INSERT INTO diffusion (contenu_type, contenu_id, module_cible, auteur_id) VALUES ('publication',$1,'community',$2)`, [publicationId, req.session.userId]);
            if (Array.isArray(diffusion)) {
                for (const module of diffusion) {
                    if (!["marketplace","academy"].includes(module)) continue;

                    let resultatId = null;
                    try {
                        if (module === "marketplace" && ["produit","service"].includes(cat)) {
                            resultatId = await diffuserVersMarketplace(pub, req.session.userId, nomAuteur, communauteDeLAction(req, res).slug);
                        } else if (module === "academy" && cat === "formation") {
                            resultatId = await diffuserVersAcademy(pub, req.session.userId, nomAuteur);
                        }
                    } catch (creationErr) {
                        console.warn(`⚠️ Création ${module} depuis publication ${publicationId} :`, creationErr.message);
                    }

                    await db.query(
                        `INSERT INTO diffusion (contenu_type, contenu_id, module_cible, auteur_id, resultat_id) VALUES ('publication',$1,$2,$3,$4)`,
                        [publicationId, module, req.session.userId, resultatId]
                    );
                }
            }
        } catch (dErr) { console.warn("⚠️ diffusion :", dErr.message); }

        res.json({ success:true });
    } catch (err) { console.error("❌ publier :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

// ── METTRE QUELQUE CHOSE EN VENTE ───────────────────────────────────────
//
// « Quand il ajoute ça, ça se trouve dans la communauté. »
//
// Publier depuis le composeur existait déjà, et créait bien une annonce —
// mais avec `prix = NULL`. Une annonce sans prix ne se vend pas : elle
// s'affiche, on la regarde, et il n'y a rien à faire ensuite. C'est le seul
// champ qui sépare « je montre » de « je vends », et il manquait.
//
// UNE ACTION, DEUX ÉCRITURES, ET C'EST VOULU :
//   - une ANNONCE, qui alimente sa vitrine et pourra être achetée ;
//   - une PUBLICATION dans SON fil, pour que sa communauté la voie passer.
// Vendre sans que personne ne le sache ne sert à rien ; poster sans pouvoir
// encaisser non plus.
//
// Si la publication échoue, l'annonce reste : mieux vaut un produit en
// vente que personne n'a vu qu'une annonce perdue.
const TYPES_VENTE = {
    formation: { label: "Formation",  categorie: "formation" },
    ebook:     { label: "Ebook",      categorie: "produit"   },
    produit:   { label: "Produit",    categorie: "produit"   },
    service:   { label: "Service",    categorie: "service"   },
};

router.post("/vendre", requireAuth, async (req, res) => {
    try {
        const COM = communauteDe(req);
        const titre = String(req.body?.titre || "").trim().slice(0, 180);
        const description = String(req.body?.description || "").trim().slice(0, 4000);
        const photo = String(req.body?.photo_url || "").trim().slice(0, 800);
        const type = TYPES_VENTE[req.body?.type] ? req.body.type : "produit";

        if (!titre) return res.json({ success: false, error: "Donne un titre à ce que tu vends." });

        // Le prix arrive d'un champ de saisie : espaces, virgule décimale,
        // « 5.000 » à la française. On normalise avant de refuser.
        const prixBrut = String(req.body?.prix || "").replace(/\s/g, "").replace(",", ".");
        const prix = Number(prixBrut);
        if (!Number.isFinite(prix) || prix <= 0) {
            return res.json({ success: false, error: "Indique un prix — c'est ce qui rend l'offre achetable." });
        }

        const nomAuteur = (req.session.nom || "Membre").trim();
        let pays = null;
        try {
            const u = await db.query(`SELECT pays FROM utilisateurs WHERE id = $1`, [req.session.userId]);
            pays = u[0]?.pays || null;
        } catch { /* le pays reste facultatif */ }

        // La devise suit la communauté : elle vend en FCFA, pas en dinars.
        const devise = COM.devise || "XAF";

        const rows = await db.query(
            `INSERT INTO annonces
               (titre, categorie, prix, devise, pays, description, photo_url,
                vendeur_id, vendeur_nom, type_vendeur, section_vitrine, actif, communaute)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'particulier',$10,true,$11)
             RETURNING id`,
            [titre, TYPES_VENTE[type].categorie, String(prix), devise, pays,
             description, photo || null, req.session.userId, nomAuteur,
             TYPES_VENTE[type].label, communauteDeLAction(req, res).slug],
        );
        const annonceId = rows[0]?.id || null;

        // Et dans son fil, pour que ça existe aux yeux de sa communauté.
        try {
            await db.query(
                `INSERT INTO publications (auteur_id, contenu, image_url, categorie, type, communaute)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [req.session.userId,
                 `${TYPES_VENTE[type].label} · ${titre}\n${prix} ${devise}${description ? "\n\n" + description : ""}`,
                 photo || null, TYPES_VENTE[type].categorie,
                 photo ? "image" : "texte", COM.slug],
            );
        } catch (err) {
            console.warn("⚠️ vente publiée mais pas annoncée dans le fil :", err.message);
        }

        try { await gradeService.ajouterPoints(req.session.userId, 5, "Mise en vente"); } catch { /* les points ne bloquent pas une vente */ }

        res.json({ success: true, annonceId, redirect: `/c/${COM.slug}` });
    } catch (err) {
        console.error("❌ POST /community/vendre :", err.message);
        res.json({ success: false, error: "Impossible de mettre en vente pour l'instant." });
    }
});

// ── QUI VOULAIT PAYER, ET N'A PAS PU ────────────────────────────────────
// Le paiement mobile n'est pas branché. Ceux qui choisissent quand même une
// mise en avant sont la meilleure liste qui existe : ils ont vu le prix et
// ils ont dit oui. Le jour où Orange Money et MTN s'ouvrent, ce sont eux
// qu'on rappelle en premier — encore faut-il les avoir notés.
const DUREES_BOOST = { "24h": 1000, "7j": 5000, "30j": 15000 };

router.post("/boost/interet", requireAuth, async (req, res) => {
    try {
        const duree = String(req.body?.duree || "");
        // Le prix vient d'ici, jamais du navigateur : sinon n'importe qui
        // pourrait déclarer avoir voulu payer 1 FCFA.
        if (!Object.prototype.hasOwnProperty.call(DUREES_BOOST, duree)) {
            return res.json({ success: false, error: "Durée inconnue." });
        }
        await db.query(
            `INSERT INTO journal (action, details) VALUES ($1, $2)`,
            ["boost.interet", JSON.stringify({
                userId: req.session.userId,
                nom: req.session.nom || null,
                communaute: communauteDe(req).slug,
                duree,
                montant: DUREES_BOOST[duree],
                le: new Date().toISOString(),
            })],
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ boost.interet :", err.message);
        res.json({ success: false, error: "Non enregistré." });
    }
});

// ── UNE PUBLICATION, VUE DEPUIS CE SERVICE ──────────────────────────────
//
// Toutes les actions sur une publication se faisaient sur son seul numéro.
// C'est la même porte laissée ouverte que dans les discussions : un membre
// de chez elle pouvait aimer, commenter — et maintenant enregistrer ou
// supprimer — une publication de NOTRE communauté en tapant un identifiant
// qu'il n'a même pas besoin de deviner, puisque ce sont des entiers qui se
// suivent.
//
// Rendre `null` plutôt que lever : l'appelant répond « introuvable », ce qui
// est la vérité depuis cette communauté-là.
async function chargerPublication(id, req, res) {
    const publicationId = parseInt(id, 10);
    if (!publicationId) return null;
    const rows = await db.query(
        `SELECT * FROM publications
          WHERE id = $1 AND COALESCE(communaute, $3) = $2 LIMIT 1`,
        [publicationId, communauteDeLAction(req, res).slug, communautes.DEFAUT]
    );
    return rows[0] || null;
}

// ── ENREGISTRER / RETIRER ───────────────────────────────────────────────
//
// « Un bouton pour enregistrer. » Quelqu'un voit passer une astuce ou une
// formation et n'a pas le temps maintenant. Sans un endroit où la ranger,
// elle défile et elle est perdue.
//
// Un seul bouton qui bascule, comme « J'aime » : deux boutons séparés
// « enregistrer » et « retirer » obligeraient à savoir lequel montrer, donc
// à ne jamais se tromper d'état, et on finit toujours par se tromper.
router.post("/enregistrer/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub || !userId) return res.json({ success:false, error:"Publication introuvable." });

        const dejaLa = await db.query(
            `SELECT id FROM publications_enregistrees WHERE publication_id=$1 AND user_id=$2`,
            [pub.id, userId]);
        if (dejaLa.length) {
            await db.query(`DELETE FROM publications_enregistrees WHERE id=$1`, [dejaLa[0].id]);
            return res.json({ success:true, enregistre:false });
        }
        // ON CONFLICT plutôt qu'un INSERT nu : deux tapes rapides sur un
        // téléphone lancent deux requêtes, et la seconde arrive avant que la
        // première ait fini. Sans ça, la contrainte UNIQUE renvoie une erreur
        // à quelqu'un qui n'a rien fait de mal.
        await db.query(
            `INSERT INTO publications_enregistrees (publication_id, user_id) VALUES ($1,$2)
             ON CONFLICT (publication_id, user_id) DO NOTHING`,
            [pub.id, userId]);
        res.json({ success:true, enregistre:true });
    } catch (err) {
        console.error("❌ enregistrer :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ── S'ABONNER / SE DÉSABONNER ───────────────────────────────────────────
//
// « S'abonner à quelqu'un qui publie bien, qui vend des bonnes choses. »
//
// C'est ce qui transforme un fil en communauté : sans lien entre les gens,
// chaque publication repart de zéro et il faut tout relire pour retrouver
// quelqu'un. Une vendeuse sérieuse se construit un public qui la suit d'une
// vente à l'autre.
//
// On s'abonne à une PERSONNE, pas à une publication — mais on part d'une
// publication, parce que c'est là qu'on la découvre. L'identifiant de
// l'auteur est donc lu dans la publication, jamais pris dans la requête :
// sinon on pourrait faire s'abonner quelqu'un à n'importe qui.
router.post("/abonner/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const COM = communauteDeLAction(req, res);
        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub || !userId) return res.json({ success:false, error:"Publication introuvable." });

        const auteur = String(pub.auteur_id || "");
        if (!auteur) return res.json({ success:false, error:"Publication sans auteur." });
        // La base l'interdit aussi (CHECK) ; on répond ici proprement plutôt
        // que de laisser remonter une erreur SQL à quelqu'un qui a juste
        // cliqué sur son propre bouton.
        if (auteur === String(userId)) {
            return res.json({ success:false, error:"Tu ne peux pas t'abonner à toi-même." });
        }

        const dejaLa = await db.query(
            `SELECT id FROM abonnements_membres WHERE abonne_id=$1 AND auteur_id=$2 AND communaute=$3`,
            [userId, auteur, COM.slug]);
        if (dejaLa.length) {
            await db.query(`DELETE FROM abonnements_membres WHERE id=$1`, [dejaLa[0].id]);
            return res.json({ success:true, abonne:false });
        }
        await db.query(
            `INSERT INTO abonnements_membres (abonne_id, auteur_id, communaute) VALUES ($1,$2,$3)
             ON CONFLICT (abonne_id, auteur_id, communaute) DO NOTHING`,
            [userId, auteur, COM.slug]);
        res.json({ success:true, abonne:true });
    } catch (err) {
        console.error("❌ abonner :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ── MODIFIER ────────────────────────────────────────────────────────────
//
// « Donner la possibilité de modifier et/ou supprimer son produit. »
// Supprimer existait, modifier non — donc corriger un prix ou une faute
// voulait dire supprimer et republier, en perdant les j'aime, les
// commentaires et la place dans le fil. Personne ne fait ça : on laisse
// l'erreur en ligne.
//
// Le contenu seulement, pas la catégorie : une publication rangée dans
// « produit » puis basculée en « formation » disparaît des listes où des
// gens l'avaient trouvée, et réapparaît ailleurs sans prévenir. Si le
// besoin se présente, ça se décide, ça ne se glisse pas ici.
router.post("/modifier/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const COM = communauteDeLAction(req, res);
        const contenu = String(req.body?.contenu || "").trim().slice(0, 5000);
        if (!contenu) return res.json({ success:false, error:"Le texte ne peut pas être vide." });

        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub) return res.json({ success:false, error:"Publication introuvable." });

        // Mêmes droits que la suppression, et refaits ici : le bouton n'est
        // affiché qu'à qui de droit, mais un bouton caché n'empêche pas
        // d'envoyer la requête.
        // L'AUTEUR, ET PERSONNE D'AUTRE — pas même l'administratrice.
        // Réécrire le texte de quelqu'un laisse des mots signés de son nom
        // qu'il n'a jamais écrits, sans qu'il puisse s'en apercevoir. Elle
        // peut retirer une publication (c'est de la modération, et ça se
        // voit) ; elle ne peut pas en changer les mots.
        if (!pub.auteur_id || String(pub.auteur_id) !== String(userId)) {
            return res.status(403).json({ success:false, error:"Seul l'auteur peut modifier sa publication." });
        }

        await db.query(`UPDATE publications SET contenu = $1 WHERE id = $2`, [contenu, pub.id]);
        res.json({ success:true, contenu });
    } catch (err) {
        console.error("❌ modifier :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ── SUPPRIMER ───────────────────────────────────────────────────────────
//
// Deux personnes peuvent supprimer une publication : celle qui l'a écrite,
// et l'administratrice de la communauté où elle est parue. Personne d'autre,
// et surtout pas « n'importe quel administrateur » : l'administratrice d'une
// communauté n'a rien à faire dans les publications d'une autre.
//
// La vérification est refaite ICI et pas seulement à l'affichage du bouton.
// Cacher un bouton n'a jamais empêché personne d'envoyer la requête — c'est
// la leçon qu'on vient d'apprendre sur le Hub.
router.post("/supprimer/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const COM = communauteDeLAction(req, res);
        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub) return res.json({ success:false, error:"Publication introuvable." });

        const estAuteur = pub.auteur_id && String(pub.auteur_id) === String(userId);
        const estAdmine = Boolean(COM.admin && req.session?.email &&
            String(req.session.email).trim().toLowerCase() === String(COM.admin).trim().toLowerCase());
        if (!estAuteur && !estAdmine) {
            return res.status(403).json({ success:false, error:"Cette publication n'est pas la tienne." });
        }

        // Les likes, commentaires et enregistrements partent avec elle. La
        // base le fait pour les enregistrements (ON DELETE CASCADE) ; les
        // deux autres tables sont plus anciennes et n'ont pas cette clause,
        // donc on les nettoie à la main plutôt que de laisser des lignes
        // orphelines fausser les compteurs.
        await db.query(`DELETE FROM publications_likes WHERE publication_id=$1`, [pub.id]);
        await db.query(`DELETE FROM publications_commentaires WHERE publication_id=$1`, [pub.id]);
        await db.query(`DELETE FROM publications WHERE id=$1`, [pub.id]);
        res.json({ success:true });
    } catch (err) {
        console.error("❌ supprimer :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

router.post("/like/:id", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub || !userId) return res.json({ success:false, error:"Publication introuvable." });
        const publicationId = pub.id;
        const existing = await db.query(`SELECT id FROM publications_likes WHERE publication_id=$1 AND user_id=$2`, [publicationId, userId]);
        if (existing.length>0) { await db.query(`DELETE FROM publications_likes WHERE id=$1`, [existing[0].id]); return res.json({ success:true, liked:false }); }
        await db.query(`INSERT INTO publications_likes (publication_id, user_id) VALUES ($1,$2)`, [publicationId, userId]);
        res.json({ success:true, liked:true });
    } catch (err) { console.error("❌ like :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

router.post("/commenter/:id", requireAuth, async (req, res) => {
    try {
        const { contenu } = req.body;
        if (!contenu || !contenu.trim()) return res.json({ success:false, error:"Commentaire vide." });
        const pub = await chargerPublication(req.params.id, req, res);
        if (!pub) return res.json({ success:false, error:"Publication introuvable." });
        await db.query(`INSERT INTO publications_commentaires (publication_id, auteur_id, contenu) VALUES ($1,$2,$3)`, [pub.id, req.session.userId, contenu.trim()]);
        res.json({ success:true });
    } catch (err) { console.error("❌ commenter :", err.message); res.json({ success:false, error:"Erreur serveur." }); }
});

module.exports = router;
