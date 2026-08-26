// ==========================================================================
// SAMII OS — CE QUI MARCHE EN VIDÉO
//
// LA BOUCLE QU'ON FERME. Jusqu'ici, un marchand qui voulait publier partait
// d'une page blanche : le Griot lui demandait « de quoi veux-tu parler ? »,
// et c'est exactement la question à laquelle il ne sait pas répondre. Cette
// page répond à sa place, avec des chiffres relevés et non devinés : voilà ce
// qui marche cette semaine dans ton métier, et voilà le bouton pour en faire
// ta vidéo.
//
// POURQUOI LE CLASSEMENT N'EST PAS PAR VUES. Une vidéo à 50 000 vues et 200
// likes marche moins bien qu'une à 5 000 vues et 600 likes : la première a été
// poussée par la plateforme, la seconde a touché quelqu'un. C'est la seconde
// qu'un marchand doit copier. On classe donc par engagement, et on affiche les
// deux chiffres pour qu'il puisse juger lui-même.
// ==========================================================================
const express = require("express");
const router = express.Router();

const tendancesVideo = require("../services/tendancesVideo");
const workspaceService = require("../services/workspaceService");
const metiers = require("../services/metiers");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function echapper(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

// Ce que cherche un marchand qui ne sait pas quoi chercher. Sa première visite
// ne doit pas commencer par un champ vide : on part de son métier.
const SUGGESTIONS = {
    ecommerce:  "boutique en ligne astuces vente",
    boutique:   "vitrine mode tendance",
    restaurant: "recette restaurant présentation plat",
    fastfood:   "street food burger tendance",
    patisserie: "pâtisserie décoration gâteau",
    coiffeur:   "coiffure transformation avant après",
    barbier:    "barbier dégradé technique",
    esthetique: "soin visage routine",
    salle_sport:"entraînement salle de sport motivation",
    dentiste:   "conseils santé dentaire",
};

router.get("/", requireAuth, async (req, res) => {
    const workspace = req.session.workspaceId
        ? await workspaceService.getById(req.session.workspaceId).catch(() => null)
        : null;

    const metier = workspace?.metier || "";
    const requete = String(req.query.q || "").trim() || SUGGESTIONS[metier] || "";
    const periode = String(req.query.periode || "semaine");
    const source = String(req.query.source || "youtube");
    const pays = String(req.query.pays || workspace?.pays || "").toUpperCase().slice(0, 2);

    let resultat = null;
    let erreur = "";
    if (requete) {
        try {
            resultat = await tendancesVideo.tendances({
                requete, source, pays, periode, workspaceId: req.session.workspaceId,
            });
        } catch (err) {
            // Le message dit quoi faire, pas ce qui a planté. « SOURCE_NON_
            // CONFIGUREE » ne veut rien dire pour un restaurateur.
            erreur = err.code === "SOURCE_NON_CONFIGUREE"
                ? "Cette source n'est pas encore branchée. YouTube fonctionne dès maintenant."
                : (err.response?.status === 403
                    ? "La source a atteint sa limite pour aujourd'hui. Réessaie demain — les résultats déjà relevés restent visibles."
                    : err.message);
        }
    }

    const videos = resultat?.videos || [];
    const lecture = videos.length ? tendancesVideo.lecture(videos) : "";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ce qui marche en vidéo — SAMII</title>
<link rel="stylesheet" href="/css/qg-style.css">
<style>
  :root { --or:#c9a961; --or-clair:#f0d99b; --cyan:#5fd4ff; --vert:#3ddc84; }
  /* Le fond est posé ici et pas seulement dans la feuille commune : une page
     qui compte sur un fichier externe pour son fond devient illisible — texte
     blanc sur blanc — le jour où ce fichier tarde ou change. */
  body { background:#07070a; color:#f3f1e9; }
  .tv { max-width:1080px; margin:0 auto; padding:36px 20px 80px; }
  .tv-retour { display:inline-block; color:var(--text-muted,#8b8d95); text-decoration:none; font-size:.82rem; margin-bottom:22px; }
  .tv-retour:hover { color:var(--cyan); }
  .tv h1 { font-family:var(--font-display,Georgia,serif); color:#fff; font-size:1.5rem; margin:0 0 8px; }
  .tv-sous { color:var(--text-muted,#8b8d95); font-size:.86rem; line-height:1.7; max-width:64ch; margin:0 0 26px; }

  .tv-form { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
  .tv-form input, .tv-form select {
    box-sizing:border-box; padding:12px 15px; border-radius:6px;
    border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.03);
    color:#f3f1e9; font-size:.86rem; font-family:inherit;
  }
  .tv-form input { flex:1 1 280px; }
  .tv-form button { padding:12px 26px; border:none; border-radius:6px; background:var(--or);
                    color:#07070a; font-weight:700; font-size:.76rem; letter-spacing:.06em;
                    text-transform:uppercase; cursor:pointer; }
  .tv-form button:hover { background:var(--or-clair); }

  .tv-lecture { padding:13px 16px; border-radius:6px; margin-bottom:8px; font-size:.84rem; line-height:1.6;
                background:rgba(95,212,255,.06); border:1px solid rgba(95,212,255,.22); color:#bfe6f7; }
  .tv-err { padding:13px 16px; border-radius:6px; margin-bottom:20px; font-size:.85rem;
            background:rgba(229,85,85,.08); border:1px solid rgba(229,85,85,.3); color:#f0a8a8; }
  .tv-quand { color:#6c6e77; font-size:.74rem; margin:0 0 22px; }

  .tv-grille { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
  .tv-carte { border:1px solid rgba(255,255,255,.08); border-radius:10px; overflow:hidden;
              background:linear-gradient(180deg,#16161a,#101013); display:flex; flex-direction:column; }
  .tv-carte img { width:100%; aspect-ratio:16/9; object-fit:cover; display:block; background:#0b0b0e; }
  .tv-corps { padding:15px 16px; display:flex; flex-direction:column; flex:1; }
  .tv-carte h3 { margin:0 0 6px; font-size:.88rem; font-weight:650; line-height:1.45; color:#f3f1e9; }
  .tv-chaine { font-size:.75rem; color:#6c6e77; margin:0 0 12px; }
  .tv-chiffres { display:flex; gap:14px; flex-wrap:wrap; margin-top:auto; padding-top:12px;
                 border-top:1px solid rgba(255,255,255,.06); font-family:var(--font-mono,monospace); font-size:.73rem; }
  .tv-chiffres b { color:var(--or); font-weight:600; }
  .tv-eng { color:var(--vert); }
  .tv-actions { display:flex; gap:8px; margin-top:12px; }
  .tv-actions a { flex:1; text-align:center; padding:9px; border-radius:5px; text-decoration:none;
                  font-size:.72rem; letter-spacing:.05em; text-transform:uppercase; font-weight:600; }
  .tv-voir { border:1px solid rgba(255,255,255,.14); color:#8b8d95; }
  .tv-voir:hover { color:#f3f1e9; background:rgba(255,255,255,.05); }
  .tv-faire { background:var(--or); color:#07070a; }
  .tv-faire:hover { background:var(--or-clair); }

  .tv-vide { padding:44px 24px; border:1px dashed rgba(201,169,97,.25); border-radius:10px;
             text-align:center; color:#8b8d95; font-size:.88rem; line-height:1.7; }
</style>
</head>
<body data-theme="og">
<div class="tv">
  <a class="tv-retour" href="/qg">← Retour au QG</a>
  <h1>👁️ Ce qui marche en vidéo</h1>
  <p class="tv-sous">
    Des chiffres relevés chez la plateforme, pas des estimations : vues, likes, engagement réel.
    Classé par <b>engagement</b> et non par vues — une vidéo très vue mais peu aimée a été poussée
    par l'algorithme ; une vidéo moins vue mais très aimée a touché quelqu'un. C'est celle-là qu'il
    faut copier.
  </p>

  <form class="tv-form" method="GET" action="/samii/tendances">
    <input type="text" name="q" value="${echapper(requete)}"
           placeholder="Ce que tu vends, ou ton métier : vestes hiver, coiffure, couscous…" required>
    <select name="periode">
      ${Object.entries(tendancesVideo.PERIODES).map(([id, p]) =>
        `<option value="${id}"${periode === id ? " selected" : ""}>${p.label}</option>`).join("")}
    </select>
    <select name="pays">
      <option value="">Tous pays</option>
      ${[["DZ","Algérie"],["MA","Maroc"],["TN","Tunisie"],["FR","France"],["MX","Mexique"],["NG","Nigeria"],["SN","Sénégal"],["US","États-Unis"]]
        .map(([c, n]) => `<option value="${c}"${pays === c ? " selected" : ""}>${n}</option>`).join("")}
    </select>
    <button type="submit">Chercher</button>
  </form>

  ${erreur ? `<div class="tv-err">${echapper(erreur)}</div>` : ""}
  ${lecture ? `<div class="tv-lecture">${echapper(lecture)}</div>` : ""}
  ${resultat ? `<p class="tv-quand">Relevé ${resultat.duCache ? "il y a moins de 6 h" : "à l'instant"} · source ${echapper(resultat.source)}</p>` : ""}

  <div class="tv-grille">
    ${videos.map((v) => `
      <div class="tv-carte">
        ${v.vignette ? `<img src="${echapper(v.vignette)}" alt="" loading="lazy">` : ""}
        <div class="tv-corps">
          <h3>${echapper(v.titre)}</h3>
          <p class="tv-chaine">${echapper(v.chaine)}</p>
          <div class="tv-chiffres">
            <span><b>${v.vues.toLocaleString("fr-FR")}</b> vues</span>
            <span><b>${v.likes.toLocaleString("fr-FR")}</b> likes</span>
            <span class="tv-eng">${v.engagement} % d'engagement</span>
          </div>
          <div class="tv-actions">
            <a class="tv-voir" href="${echapper(v.lien)}" target="_blank" rel="noopener noreferrer">Voir</a>
            <a class="tv-faire" href="/samii/griot?idee=${encodeURIComponent(v.titre)}">En faire la mienne</a>
          </div>
        </div>
      </div>`).join("")}
  </div>

  ${!videos.length && !erreur ? `
    <div class="tv-vide">
      ${requete
        ? "Rien de marquant sur cette recherche pour cette période. Essaie des mots plus larges, ou une période plus longue."
        : "Dis en quelques mots ce que tu vends — on te montre ce qui marche en ce moment."}
    </div>` : ""}
</div>
</body>
</html>`);
});

module.exports = router;
