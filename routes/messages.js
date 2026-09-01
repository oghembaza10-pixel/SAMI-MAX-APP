// ==========================================================================
// SAMII OS — MES MESSAGES — écrire à quelqu'un depuis son profil
//
// « Sur chaque profil, on doit pouvoir lui laisser un message. Et il doit
// avoir un espace Mes messages dans son QG pour les lire. »
//
// CE QUI MANQUAIT. On voyait un produit sur la marketplace, on voyait qui le
// vendait, on pouvait ouvrir son profil — et il n'y avait aucun moyen de lui
// poser une question. Le seul chemin était WhatsApp, qui suppose un numéro
// public et une application installée. Une marketplace où l'on ne peut pas
// parler au vendeur n'est pas une marketplace, c'est un catalogue.
//
// TROIS RÈGLES TENUES DANS TOUT LE FICHIER.
//
// 1. UNE CONVERSATION EST À DEUX. Chaque lecture filtre sur la session, et
//    jamais sur un identifiant venu de la page. La règle vaut aussi pour
//    l'administratrice de la communauté : modérer un fil public est une
//    chose, lire le courrier de ses membres en est une autre.
//
// 2. CHACUNE CHEZ SOI. La communauté vient du service (res.locals.COM),
//    comme partout ailleurs. Quelqu'un présent des deux côtés ne doit pas
//    voir sur le domaine d'une partenaire les messages reçus chez nous.
//
// 3. RIEN N'EST RENDU SANS ÉCHAPPEMENT. Ces textes sont écrits par des
//    inconnus et affichés à d'autres inconnus.
// ==========================================================================
const express = require("express");
const router = express.Router();
const db = require("../services/db");
const communautes = require("../config/communautes");

const MAX_LONGUEUR = 2000;

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

function communauteDe(res) {
    return res.locals?.COM?.slug || communautes.DEFAUT;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function initiales(prenom, nom) {
    return ((String(prenom || "").trim()[0] || "") + (String(nom || "").trim()[0] || "")).toUpperCase() || "?";
}

function ilYA(date) {
    if (!date) return "";
    const s = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
    try { return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); }
    catch { return ""; }
}

// ── COMBIEN DE MESSAGES NON LUS ──────────────────────────────────────────
// Exporté : la pastille du QG s'en sert sur chaque page. Isolé dans son
// try/catch — un compteur qui échoue ne doit pas empêcher le QG de s'ouvrir.
async function nonLus(userId, communaute) {
    if (!userId) return 0;
    try {
        const rows = await db.query(
            `SELECT COUNT(*)::int AS n FROM messages_prives
              WHERE destinataire_id = $1 AND lu_le IS NULL
                AND COALESCE(communaute, $3) = $2`,
            [userId, communaute, communautes.DEFAUT],
        );
        return rows[0]?.n || 0;
    } catch (err) {
        console.warn("⚠️ messages non lus :", err.message);
        return 0;
    }
}

// ── LE COMPTEUR DE LA COLONNE DU QG ──────────────────────────────────────
//
// Une route à part plutôt qu'un champ de plus dans /api/qg-data : ce
// compteur s'affiche sur TOUTES les pages du QG, y compris celles qui
// n'appellent jamais qg-data. Le greffer là-bas aurait laissé la pastille
// vide sur la moitié des pages, sans que rien ne l'explique.
router.get("/non-lus", requireAuth, async (req, res) => {
    const n = await nonLus(req.session.userId, communauteDe(res));
    res.json({ success: true, nonLus: n });
});

// ── ENVOYER ──────────────────────────────────────────────────────────────
//
// Appelée depuis la vitrine et depuis la fiche produit. Le destinataire vient
// du corps de la requête — c'est inévitable, on écrit bien à quelqu'un — mais
// l'EXPÉDITEUR vient toujours de la session. Sans ça, n'importe qui pourrait
// faire écrire n'importe qui.
router.post("/envoyer", requireAuth, async (req, res) => {
    const moi = req.session.userId;
    const destinataire = String(req.body?.destinataire || "").trim();
    const contenu = String(req.body?.contenu || "").trim();
    const annonceId = String(req.body?.annonce || "").trim().slice(0, 64) || null;

    if (!destinataire) return res.json({ success: false, error: "Destinataire manquant." });
    if (!contenu) return res.json({ success: false, error: "Écris ton message d'abord." });
    if (contenu.length > MAX_LONGUEUR) {
        return res.json({ success: false, error: `Message trop long (${MAX_LONGUEUR} caractères maximum).` });
    }
    // S'écrire à soi-même n'est pas une erreur grave, mais ça crée une
    // conversation qui n'existe pas et un non-lu qu'on ne peut pas résoudre.
    if (String(destinataire) === String(moi)) {
        return res.json({ success: false, error: "Tu ne peux pas t'écrire à toi-même." });
    }

    try {
        const com = communauteDe(res);

        // LE DESTINATAIRE DOIT ÊTRE DE CETTE COMMUNAUTÉ.
        //
        // Sans ce contrôle, un identifiant tapé à la main dans la requête
        // permettrait d'écrire à n'importe quel membre de la plateforme
        // depuis le domaine d'une partenaire — et le message atterrirait
        // dans le QG de quelqu'un qui n'a jamais entendu parler d'elle.
        const cible = await db.query(
            `SELECT id FROM utilisateurs WHERE id = $1 AND COALESCE(communaute, $3) = $2`,
            [destinataire, com, communautes.DEFAUT],
        );
        if (!cible.length) {
            return res.json({ success: false, error: "Ce membre n'existe pas dans cette communauté." });
        }

        await db.query(
            `INSERT INTO messages_prives (expediteur_id, destinataire_id, contenu, communaute, annonce_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [moi, destinataire, contenu, com, annonceId],
        );

        // On prévient en direct si la personne est connectée. Le message est
        // déjà en base : un échec ici ne perd rien, il retarde seulement.
        try {
            require("../services/socketService").emitToUser(destinataire, "message-prive", {
                de: req.session.nom || "Un membre",
            });
        } catch { /* le temps réel est un confort, pas une garantie */ }

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /messages/envoyer :", err.message);
        res.json({ success: false, error: "Message non envoyé. Réessaie." });
    }
});

// ── LA BOÎTE DE RÉCEPTION ────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    const moi = req.session.userId;
    const com = communauteDe(res);
    const COM = res.locals?.COM || communautes.get(communautes.DEFAUT);
    const avec = String(req.query.avec || "").trim();

    try {
        // Les conversations : une ligne par personne, avec le dernier message
        // et le nombre de non-lus. DISTINCT ON plutôt que deux requêtes —
        // c'est la même question, elle ne doit avoir qu'une réponse.
        const conversations = await db.query(
            `SELECT DISTINCT ON (autre)
                    autre, contenu, created_at, non_lus, prenom, nom, photo_profil_url
               FROM (
                 SELECT CASE WHEN m.expediteur_id = $1 THEN m.destinataire_id ELSE m.expediteur_id END AS autre,
                        m.contenu, m.created_at,
                        (SELECT COUNT(*)::int FROM messages_prives x
                          WHERE x.destinataire_id = $1 AND x.lu_le IS NULL
                            AND x.expediteur_id = CASE WHEN m.expediteur_id = $1 THEN m.destinataire_id ELSE m.expediteur_id END
                            AND COALESCE(x.communaute, $3) = $2) AS non_lus
                   FROM messages_prives m
                  WHERE (m.expediteur_id = $1 OR m.destinataire_id = $1)
                    AND COALESCE(m.communaute, $3) = $2
               ) t
               LEFT JOIN utilisateurs u ON u.id = t.autre
              ORDER BY autre, created_at DESC`,
            [moi, com, communautes.DEFAUT],
        ).then((rows) => rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

        // Le fil ouvert, s'il y en a un.
        let fil = [];
        let interlocuteur = null;
        if (avec) {
            // LES DEUX SENS, ET SEULEMENT CETTE PAIRE. `$1` est toujours la
            // session : impossible d'ouvrir la conversation de deux autres
            // personnes en changeant l'adresse.
            fil = await db.query(
                `SELECT m.*, u.prenom, u.nom, u.photo_profil_url
                   FROM messages_prives m LEFT JOIN utilisateurs u ON u.id = m.expediteur_id
                  WHERE ((m.expediteur_id = $1 AND m.destinataire_id = $2)
                      OR (m.expediteur_id = $2 AND m.destinataire_id = $1))
                    AND COALESCE(m.communaute, $4) = $3
                  ORDER BY m.created_at ASC LIMIT 200`,
                [moi, avec, com, communautes.DEFAUT],
            );
            const q = await db.query(
                `SELECT id, prenom, nom, photo_profil_url, type_compte FROM utilisateurs WHERE id = $1`, [avec]);
            interlocuteur = q[0] || null;

            // Marquer comme lu : seulement CE QU'ON A REÇU. Marquer aussi ses
            // propres envois ferait disparaître le compteur de l'autre.
            await db.query(
                `UPDATE messages_prives SET lu_le = now()
                  WHERE destinataire_id = $1 AND expediteur_id = $2 AND lu_le IS NULL`,
                [moi, avec],
            );
        }

        res.send(page({ COM, moi, conversations, fil, interlocuteur, avec }));
    } catch (err) {
        console.error("❌ GET /messages :", err.message);
        res.status(500).send("La messagerie n'a pas pu s'ouvrir. Réessaie dans un instant.");
    }
});

// ==========================================================================
// LA PAGE
// ==========================================================================
function page({ COM, moi, conversations, fil, interlocuteur, avec }) {
    const style = communautes.styleDe(COM);
    const retour = communautes.accueil(COM);

    const listeHtml = conversations.length ? conversations.map((c) => {
        const nom = escapeHtml(`${c.prenom || "Membre"} ${c.nom || ""}`.trim());
        const actif = String(c.autre) === String(avec);
        return `
        <a class="conv${actif ? " conv--actif" : ""}" href="/messages?avec=${encodeURIComponent(c.autre)}">
            <span class="ava">${escapeHtml(initiales(c.prenom, c.nom))}${c.photo_profil_url
                ? `<img src="${escapeHtml(c.photo_profil_url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
            <span class="conv__txt">
                <b>${nom}${c.non_lus > 0 ? `<i class="pastille">${c.non_lus}</i>` : ""}</b>
                <span>${escapeHtml(String(c.contenu || "").slice(0, 60))}</span>
            </span>
            <span class="conv__quand">${escapeHtml(ilYA(c.created_at))}</span>
        </a>`;
    }).join("") : `<p class="vide">Aucun message pour l'instant.<br>Les questions laissées sur ta vitrine ou sous tes produits arriveront ici.</p>`;

    const filHtml = !avec
        ? `<div class="accueil">
             <div class="accueil__ic">✉️</div>
             <h2>Tes messages</h2>
             <p>Choisis une conversation à gauche.<br>
             Quand quelqu'un t'écrit depuis ta vitrine ou depuis un de tes produits, ça arrive ici.</p>
           </div>`
        : `<div class="fil-tete">
             <a class="retour-mob" href="/messages">←</a>
             <span class="ava">${escapeHtml(initiales(interlocuteur?.prenom, interlocuteur?.nom))}${interlocuteur?.photo_profil_url
                ? `<img src="${escapeHtml(interlocuteur.photo_profil_url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
             <div>
               <b>${escapeHtml(`${interlocuteur?.prenom || "Membre"} ${interlocuteur?.nom || ""}`.trim())}</b>
               <a href="/vitrine/${encodeURIComponent(avec)}">Voir sa page</a>
             </div>
           </div>
           <div class="fil" id="fil">${fil.length ? fil.map((m) => {
               const demoi = String(m.expediteur_id) === String(moi);
               return `<div class="bulle${demoi ? " bulle--moi" : ""}">
                   <p>${escapeHtml(m.contenu).replace(/\n/g, "<br>")}</p>
                   <span>${escapeHtml(ilYA(m.created_at))}</span>
               </div>`;
           }).join("") : `<p class="vide">Écris le premier message.</p>`}</div>
           <form class="repondre" id="formRep">
             <input id="champ" placeholder="Écris ton message…" maxlength="${MAX_LONGUEUR}" autocomplete="off">
             <button type="submit">Envoyer</button>
           </form>`;

    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mes messages — ${escapeHtml(COM.nom || "SAMII")}</title>
<style>
:root{${style}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
a{color:inherit;text-decoration:none}
.haut{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);
  position:sticky;top:0;background:var(--bg);z-index:5}
.haut h1{font-size:17px;font-weight:800}
.haut a{color:var(--muted);font-size:13px}
.grille{display:grid;grid-template-columns:1fr;max-width:1100px;margin:0 auto;min-height:calc(100vh - 56px)}
@media(min-width:860px){.grille{grid-template-columns:320px 1fr}}
.colonne{border-right:1px solid var(--border);padding:10px}
/* Sur téléphone, une seule des deux colonnes à la fois : côte à côte, elles
   donnent deux zones de 160 px où rien n'est lisible. */
@media(max-width:859px){
  .colonne{border-right:0;${avec ? "display:none" : ""}}
  .panneau{${avec ? "" : "display:none"}}
}
.conv{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px}
.conv:hover{background:var(--panel)}
.conv--actif{background:var(--panel)}
.conv__txt{flex:1;min-width:0}
.conv__txt b{display:flex;align-items:center;gap:6px;font-size:13.5px}
.conv__txt span{display:block;color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv__quand{color:var(--muted);font-size:11px;white-space:nowrap}
.pastille{background:var(--blue);color:var(--sur-accent,#001018);font-size:10px;font-weight:800;
  border-radius:999px;padding:1px 6px;font-style:normal}
.ava{width:38px;height:38px;flex:none;border-radius:12px;display:grid;place-items:center;font-size:12px;
  font-weight:900;color:#fff;background:linear-gradient(135deg,var(--blue),var(--blue-2));
  position:relative;overflow:hidden}
.ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.panneau{display:flex;flex-direction:column;min-height:0}
.fil-tete{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)}
.fil-tete b{display:block;font-size:14px}
.fil-tete a{color:var(--blue);font-size:12px}
.retour-mob{font-size:20px;color:var(--muted)}
@media(min-width:860px){.retour-mob{display:none}}
.fil{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.bulle{max-width:min(80%,520px);background:var(--panel);border:1px solid var(--border);
  border-radius:14px;padding:10px 13px;align-self:flex-start}
.bulle--moi{align-self:flex-end;background:rgba(0,150,255,.14);border-color:rgba(0,150,255,.3)}
.bulle p{font-size:14px;overflow-wrap:anywhere}
.bulle span{display:block;color:var(--muted);font-size:10.5px;margin-top:4px}
.repondre{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border)}
.repondre input{flex:1;padding:12px 14px;border-radius:12px;border:1px solid var(--border);
  background:var(--panel);color:var(--text);font:inherit;font-size:14px}
.repondre button{padding:12px 18px;border:0;border-radius:12px;background:var(--blue);
  color:var(--sur-accent,#001018);font-weight:800;cursor:pointer}
.vide{color:var(--muted);font-size:13px;padding:22px;text-align:center}
.accueil{margin:auto;text-align:center;padding:40px 20px;max-width:380px}
.accueil__ic{font-size:38px;margin-bottom:10px}
.accueil h2{font-size:18px;margin-bottom:8px}
.accueil p{color:var(--muted);font-size:13.5px}
</style></head>
<body>
<div class="haut">
  <a href="${escapeHtml(retour)}">← ${escapeHtml(COM.marque || "Retour")}</a>
  <h1>Mes messages</h1>
</div>
<div class="grille">
  <div class="colonne">${listeHtml}</div>
  <div class="panneau">${filHtml}</div>
</div>
<script>
(function(){
  var f = document.getElementById("formRep");
  if (!f) return;
  var champ = document.getElementById("champ");
  var fil = document.getElementById("fil");
  // On arrive en bas du fil : sans ça, une conversation longue s'ouvre sur
  // son premier message, c'est-à-dire sur le plus vieux.
  if (fil) fil.scrollTop = fil.scrollHeight;

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var texte = champ.value.trim();
    if (!texte) return;
    var bouton = f.querySelector("button");
    bouton.disabled = true;
    fetch("/messages/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinataire: ${JSON.stringify(String(avec || ""))}, contenu: texte }),
    })
    .then(function (r) { return r.json(); })
    .then(function (rep) {
      if (!rep.success) throw new Error(rep.error || "refusé");
      // Le message s'affiche tout de suite : attendre un rechargement pour
      // voir ce qu'on vient d'écrire donne l'impression que rien n'est parti.
      var d = document.createElement("div");
      d.className = "bulle bulle--moi";
      var p = document.createElement("p");
      p.textContent = texte;           // textContent, jamais innerHTML
      var s = document.createElement("span");
      s.textContent = "à l'instant";
      d.appendChild(p); d.appendChild(s);
      fil.appendChild(d);
      fil.scrollTop = fil.scrollHeight;
      champ.value = "";
    })
    .catch(function (err) { alert("Message non envoyé : " + err.message); })
    .finally(function () { bouton.disabled = false; champ.focus(); });
  });
})();
</script>
</body></html>`;
}

module.exports = router;
module.exports.nonLus = nonLus;
