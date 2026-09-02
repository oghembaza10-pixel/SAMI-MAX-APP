// ==========================================================================
// LE REGISTRE DES FORMATS — post, reel, story, carrousel
// ==========================================================================
//
// « qu'il mette des reels, des posts, etc. »
//
// ── POURQUOI UN FICHIER SÉPARÉ ────────────────────────────────────────────
//
// Un « Reel » n'est pas une plateforme, c'est une FORME. La même plateforme
// en accepte plusieurs (Instagram : post, reel, story, carrousel), et la
// même forme existe sur plusieurs plateformes (un Reel Instagram et un
// TikTok sont deux vidéos verticales courtes).
//
// Mettre ça dans `plateformes-sociales.js` aurait mélangé deux axes et
// obligé à recopier « un reel exige une vidéo » sept fois. Ce dépôt a déjà
// payé le prix de la règle recopiée deux fois (la décision TLS, qui a
// divergé). Une fois suffit.
//
// ── LA RÈGLE QUI COMPTE VRAIMENT ──────────────────────────────────────────
//
// Chaque format dit ce qu'il EXIGE. Un reel sans vidéo n'est pas un reel
// dégradé : c'est une publication qui échouera chez la plateforme. Le
// relecteur s'en sert pour refuser AVANT l'appel d'API, et le cycle
// automatique s'en sert pour ne pas choisir un format qu'il ne peut pas
// nourrir.
//
// ── CE QUE CE FICHIER NE PROMET PAS ───────────────────────────────────────
//
// Déclarer qu'Instagram accepte les reels ne veut pas dire que SAMII SAIT
// en publier un aujourd'hui. Il faut aussi qu'un provider transporte la
// vidéo, et qu'il existe une vidéo à transporter. `publiable()` répond à la
// première question ; la vitrine (`engines/social/vitrine.js`) répond à la
// seconde. Les trois sont distinctes et le restent.

// ── LES FORMATS ───────────────────────────────────────────────────────────
const FORMATS = {
    post: {
        nom: "Post",
        // Le format par défaut, celui qui marche partout. `media: null` veut
        // dire « il n'en exige aucun » — la plateforme peut quand même en
        // exiger un de son côté (Instagram), et c'est elle qui tranche.
        media: null,
        duree: null,
        description: "une publication classique dans le fil",
    },
    photo: {
        nom: "Photo",
        media: "image",
        duree: null,
        description: "une image et sa légende",
    },
    carrousel: {
        nom: "Carrousel",
        media: "image",
        // Plusieurs images. Le minimum est 2 : un carrousel d'une seule
        // image est un post, et l'envoyer comme carrousel se fait refuser.
        mediaMultiple: [2, 10],
        duree: null,
        description: "plusieurs images que l'on fait défiler",
    },
    reel: {
        nom: "Reel",
        media: "video",
        // Fourchette de durée en secondes. En dehors, les plateformes
        // coupent ou refusent — mieux vaut ne pas envoyer.
        duree: [3, 90],
        vertical: true,
        description: "une vidéo verticale courte, poussée par l'algorithme",
    },
    video: {
        nom: "Vidéo",
        media: "video",
        duree: [3, 600],
        vertical: false,
        description: "une vidéo classique dans le fil",
    },
    story: {
        nom: "Story",
        media: "image",
        // Une story accepte aussi la vidéo — `mediaAussi` dit « celui-là
        // convient également », sans faire croire qu'il est équivalent.
        mediaAussi: ["video"],
        duree: [1, 60],
        vertical: true,
        ephemere: true,
        description: "disparaît au bout de 24 heures",
    },
};

const ORDRE = ["post", "photo", "carrousel", "reel", "video", "story"];

// ── QUI ACCEPTE QUOI ──────────────────────────────────────────────────────
//
// Écrit ici plutôt que déduit : Instagram accepte les reels, Telegram non,
// et aucune règle générale ne permet de le deviner.
//
// L'ordre compte : c'est l'ordre de PRÉFÉRENCE quand le cycle automatique
// doit choisir seul. Un reel devant un post sur Instagram, parce que c'est
// ce que l'algorithme pousse — mais le cycle ne le prendra que s'il a
// réellement une vidéo à mettre dedans.
const PAR_PLATEFORME = {
    facebook:  ["post", "photo", "reel", "video", "carrousel", "story"],
    instagram: ["reel", "carrousel", "photo", "story"],
    tiktok:    ["reel", "video"],
    linkedin:  ["post", "photo", "video", "carrousel"],
    telegram:  ["post", "photo", "video"],
    whatsapp:  ["post", "photo", "video"],
    messenger: ["post", "photo"],
};

// ── LES FORMATS QU'UN PROVIDER SAIT RÉELLEMENT TRANSPORTER ────────────────
//
// La différence entre « la plateforme accepte » et « nous savons envoyer ».
// Buffer publie une image ou une vidéo ; il ne fait pas de story, et un
// carrousel demanderait plusieurs médias que notre appel n'envoie pas
// encore. Le dire ici évite de préparer un contenu qui échouera à la
// dernière étape.
const TRANSPORTABLES = ["post", "photo", "reel", "video"];

function existe(slug) {
    return Object.prototype.hasOwnProperty.call(FORMATS, String(slug || "").toLowerCase());
}

function get(slug) {
    const propre = String(slug || "").toLowerCase();
    return existe(propre) ? { slug: propre, ...FORMATS[propre] } : null;
}

function liste() {
    return ORDRE.filter(existe).map((slug) => ({ slug, ...FORMATS[slug] }));
}

// Les formats qu'une plateforme accepte, dans l'ordre de préférence.
function pourPlateforme(slug) {
    return (PAR_PLATEFORME[String(slug || "").toLowerCase()] || []).filter(existe);
}

// Est-ce que SAMII sait vraiment envoyer ce format aujourd'hui ?
function publiable(format) {
    return TRANSPORTABLES.includes(String(format || "").toLowerCase());
}

// ── LE MÉDIA EXIGÉ ────────────────────────────────────────────────────────
//
// Rend le type de média sans lequel ce format n'a pas de sens, ou null.
// C'est LA fonction que le relecteur et le cycle appellent : elle évite
// qu'ils redéduisent chacun de leur côté qu'un reel a besoin d'une vidéo.
function mediaExige(format) {
    const f = get(format);
    return f ? f.media : null;
}

// Est-ce que ce média convient à ce format ? Utilisé avant de préparer, et
// de nouveau avant de publier — les deux moments où se tromper coûte cher.
function mediaConvient(format, mediaType) {
    const f = get(format);
    if (!f) return { ok: false, raison: `format inconnu : ${format}` };
    if (!f.media) return { ok: true };

    const type = String(mediaType || "").toLowerCase();
    if (!type) {
        return { ok: false, raison: `le format « ${f.nom} » exige ${f.media}, aucun média n'est fourni` };
    }
    const acceptes = [f.media, ...(f.mediaAussi || [])];
    if (!acceptes.includes(type)) {
        return { ok: false, raison: `le format « ${f.nom} » exige ${acceptes.join(" ou ")}, pas ${type}` };
    }
    return { ok: true };
}

// ── COUPER UN FORMAT DEPUIS RENDER ────────────────────────────────────────
//
// Même principe que les plateformes coupées : si les reels se mettent à
// être refusés un dimanche, on les coupe sans déploiement.
//
//     SOCIAL_FORMATS_COUPES=story,carrousel
//
// Lu à chaque appel, jamais mis en cache au chargement.
function estCoupe(slug) {
    const coupes = String(process.env.SOCIAL_FORMATS_COUPES || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return coupes.includes(String(slug || "").toLowerCase());
}

// ── CHOISIR UN FORMAT AVEC CE QU'ON A SOUS LA MAIN ────────────────────────
//
// Le cycle automatique appelle ceci, et rien d'autre. Il donne la
// plateforme et ce dont il dispose réellement ; on rend le meilleur format
// possible, ou un refus motivé.
//
// L'ordre de PAR_PLATEFORME fait le reste : sur Instagram, une vidéo
// disponible donne un reel, une image donne un carrousel ou une photo.
// Personne n'a besoin d'écrire ce choix ailleurs.
function choisir({ plateforme, mediaType } = {}) {
    const possibles = pourPlateforme(plateforme)
        .filter((f) => !estCoupe(f))
        .filter(publiable);

    if (!possibles.length) {
        return { ok: false, raison: `aucun format transportable pour ${plateforme}` };
    }

    for (const f of possibles) {
        if (mediaConvient(f, mediaType).ok) return { ok: true, format: f };
    }

    return {
        ok: false,
        raison: `aucun format de ${plateforme} ne convient à ${mediaType || "un contenu sans média"} `
              + `(possibles : ${possibles.join(", ")})`,
    };
}

module.exports = {
    FORMATS, ORDRE, PAR_PLATEFORME, TRANSPORTABLES,
    existe, get, liste, pourPlateforme, publiable,
    mediaExige, mediaConvient, estCoupe, choisir,
};
