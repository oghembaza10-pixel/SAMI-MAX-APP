const express = require("express");
const db = require("../services/db");
const communautes = require("../config/communautes");

const router = express.Router();

function esc(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ── POURQUOI L'ACCÈS EST REFUSÉ ─────────────────────────────────────────
//
// « Audrey n'a pas pu se connecter à son admin. » Elle est tombée sur une
// page blanche avec une ligne : « Accès réservé aux administrateurs de
// communauté. »
//
// Cette phrase répondait à QUATRE situations différentes : pas connectée,
// compte introuvable, compte désactivé, ou connectée avec une autre adresse.
// Impossible de savoir laquelle — ni pour elle, ni pour nous à distance. Et
// aucune issue sur la page : pas de bouton, pas de lien, rien.
//
// Le plus probable, et le plus bête : elle n'était pas connectée. On ne
// refuse plus quelqu'un qui n'a simplement pas encore ouvert sa session, on
// l'envoie se connecter.
//
// Cette fonction rend donc un MOTIF, pas un oui/non. Le refus reste le même
// pour qui n'a rien à faire ici ; ce qui change, c'est qu'on sait pourquoi.
async function getCommunityAdmin(req) {
    if (!req.session?.loggedIn || !req.session?.userId) return { motif: "deconnecte" };
    const rows = await db.query(
        `SELECT id, prenom, nom, email, role, communaute, actif
           FROM utilisateurs
          WHERE id = $1
          LIMIT 1`,
        [req.session.userId]
    );
    const user = rows[0];
    // `actif` sortait du WHERE : un compte désactivé était donc indiscernable
    // d'un compte inexistant, alors que ce n'est pas du tout la même panne.
    if (!user) return { motif: "compte_introuvable" };
    if (user.actif === false) return { motif: "compte_desactive", user };

    // Deux chemins vers cet espace, et c'est volontaire.
    //
    // Le rôle `community_admin` en base, pour un accès accordé au cas par
    // cas. Et l'adresse déclarée dans config/communautes.js, pour que la
    // créatrice d'une communauté y entre sans qu'on ait à lancer une requête
    // SQL — un accès qui dépend d'un geste manuel sur la base est un accès
    // que personne ne sait plus expliquer six mois plus tard.
    const parRole = user.role === "community_admin" && user.communaute;
    if (parRole) return { user };

    // Comparaison sur l'adresse nettoyée des deux côtés. Une adresse tapée
    // sur un téléphone arrive souvent avec une majuscule automatique ou une
    // espace collée par le presse-papier — et « Audreyined133@gmail.com » ne
    // valait pas « audreyined133@gmail.com ».
    const email = String(user.email || "").trim().toLowerCase();
    for (const com of communautes.liste()) {
        if (com.admin && String(com.admin).trim().toLowerCase() === email) {
            return { user: { ...user, communaute: com.slug } };
        }
    }
    return { motif: "pas_admin", user };
}

// La page de refus, à SA marque et avec une sortie. Une impasse blanche sur
// un téléphone, à 22 h, sur le lien qu'on vient de vous envoyer, ça ne se
// répare pas tout seul : ça se raconte à quelqu'un le lendemain.
function pageRefus(res, COM, titre, explication, action) {
    const fond = COM.couleurs?.["--bg"] || "#03060b";
    const encre = COM.couleurs?.["--text"] || "#f5fbff";
    const accent = COM.couleurs?.["--blue"] || "#00d9ff";
    const sur = COM.couleurs?.["--sur-accent"] || "#001018";
    return res.status(403).send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(COM.nom)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:${fond};color:${encre};font-family:system-ui,-apple-system,sans-serif;padding:28px;">
  <div style="max-width:420px;text-align:center;">
    <h1 style="font-size:19px;margin:0 0 12px;">${esc(titre)}</h1>
    <p style="font-size:14px;line-height:1.6;opacity:.8;margin:0 0 22px;">${explication}</p>
    ${action}
  </div>
</body></html>`);
}

router.get("/admin/communaute", async (req, res) => {
    try {
        const COMhote = res.locals?.COM || communautes.get(communautes.DEFAUT);
        const { user, motif } = await getCommunityAdmin(req);

        // Pas connectée : ce n'est pas un refus, c'est une session qui manque.
        // On l'envoie sur SA page de connexion, pas sur la nôtre.
        if (motif === "deconnecte") {
            return res.redirect(COMhote.ecosysteme
                ? "/login"
                : `/c/${COMhote.slug}/connexion`);
        }
        if (motif === "compte_desactive") {
            return pageRefus(res, COMhote, "Ce compte est désactivé",
                "Il existe, mais il a été mis hors service. Écris-nous pour le réactiver.",
                `<a href="${communautes.accueil(COMhote)}" style="display:inline-block;padding:12px 22px;border-radius:11px;background:${COMhote.couleurs?.["--blue"] || "#00d9ff"};color:${COMhote.couleurs?.["--sur-accent"] || "#001018"};text-decoration:none;font-weight:700;font-size:13.5px;">Retour</a>`);
        }
        if (motif) {
            // On affiche SON adresse à elle — c'est la sienne, elle ne
            // découvre rien — et jamais celle attendue : ça reviendrait à
            // donner l'e-mail de l'administratrice à n'importe quel membre
            // connecté qui tape cette adresse.
            //
            // Cette seule ligne suffit à trancher à distance : « je suis
            // connectée avec X » répond en un message à la question qu'on
            // aurait mis trois allers-retours à poser.
            const connectee = user?.email
                ? `Tu es connectée avec <strong>${esc(user.email)}</strong>, et ce n'est pas le compte déclaré pour cette communauté.`
                : "Ce compte n'est pas celui déclaré pour cette communauté.";
            return pageRefus(res, COMhote, "Cet espace n'est pas ouvert à ce compte",
                `${connectee}<br><br>Déconnecte-toi et reviens avec l'adresse que tu nous as donnée.`,
                `<a href="/logout" style="display:inline-block;padding:12px 22px;border-radius:11px;background:${COMhote.couleurs?.["--blue"] || "#00d9ff"};color:${COMhote.couleurs?.["--sur-accent"] || "#001018"};text-decoration:none;font-weight:700;font-size:13.5px;">Changer de compte</a>
                 <div style="margin-top:14px;"><a href="${communautes.accueil(COMhote)}" style="color:inherit;opacity:.6;font-size:12.5px;">Retour à la communauté</a></div>`);
        }

        const community = user.communaute;
        // Sa marque, pas la nôtre : cette page est SON espace, et
        // « SAMII · Community Admin » écrit en haut la lui reprend.
        const COM = communautes.get(community);
        const [members, posts, payments, recentPosts, recentMembers] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs WHERE communaute = $1 AND actif = TRUE`, [community]),
            // Les compteurs se lisent dans les tables de likes et de
            // commentaires. Les colonnes like_count / commentaire_count /
            // partage_count n'ont jamais existé dans ce schéma : la requête
            // d'origine échouait, et la page rendait 500 pour tout le monde.
            // Il n'y a pas de table de partages — on ne compte donc pas des
            // partages imaginaires.
            db.query(`
                SELECT COUNT(*)::int AS n,
                       (SELECT COUNT(*) FROM publications_likes pl
                         JOIN publications px ON px.id = pl.publication_id
                        WHERE px.communaute = $1)::int AS likes,
                       (SELECT COUNT(*) FROM publications_commentaires pc
                         JOIN publications px ON px.id = pc.publication_id
                        WHERE px.communaute = $1)::int AS comments,
                       0::int AS shares
                  FROM publications WHERE communaute = $1`, [community]),
            // CE QUI LUI REVIENT, pas seulement ce qui a été encaissé.
            //
            // L'argent des ventes arrive sur NOTRE compte Stripe — c'est le
            // montage convenu. Sa part lui est ensuite reversée. Tant qu'elle
            // ne voit que le chiffre d'affaires brut, elle n'a aucun moyen de
            // savoir ce qu'on lui doit : soit elle croit que tout est à elle,
            // soit elle doit nous croire sur parole. Les deux finissent mal.
            //
            // `part_partenaire` est calculée et ÉCRITE au moment de chaque
            // vente, jamais recalculée après coup. C'est ce chiffre-là qui
            // fait foi, et c'est celui qu'elle doit voir en premier.
            db.query(`SELECT COUNT(*)::int AS n,
                             COALESCE(SUM(montant),0)::numeric AS total,
                             COALESCE(SUM(part_partenaire),0)::numeric AS du_partenaire,
                             COALESCE(MAX(devise),'USD') AS devise
                        FROM paiements
                       WHERE communaute = $1
                         AND LOWER(COALESCE(statut,'')) IN ('paye','paid','success','succeeded','complete','completed')`, [community]),
            db.query(`
                SELECT p.id, p.contenu, p.created_at,
                       (SELECT COUNT(*) FROM publications_likes pl WHERE pl.publication_id = p.id)::int AS like_count,
                       (SELECT COUNT(*) FROM publications_commentaires pc WHERE pc.publication_id = p.id)::int AS commentaire_count,
                       0::int AS partage_count
                  FROM publications p
                 WHERE p.communaute = $1
                 ORDER BY p.created_at DESC LIMIT 5`, [community]),
            db.query(`SELECT prenom, nom, email, created_at FROM utilisateurs WHERE communaute = $1 ORDER BY created_at DESC LIMIT 5`, [community]),
        ]);

        const m = members[0] || { n: 0 };
        const p = posts[0] || { n: 0, likes: 0, comments: 0, shares: 0 };
        const pay = payments[0] || { n: 0, total: 0, devise: "USD" };
        const engagement = Number(p.likes || 0) + Number(p.comments || 0) + Number(p.shares || 0);
        const maxMetric = Math.max(Number(m.n || 0), Number(p.n || 0), Number(pay.n || 0), engagement, 1);
        const bar = (value) => Math.max(4, Math.min(100, Math.round((Number(value || 0) / maxMetric) * 100)));

        // ── SA PALETTE, PAS LA NÔTRE ─────────────────────────────────────
        //
        // Ce tableau de bord était en noir profond — notre look. C'est le
        // seul écran qu'elle ouvrira tous les matins ; il doit ressembler à
        // sa marque, pas à la nôtre.
        //
        // Les valeurs par défaut restent les nôtres, pour que la maison
        // garde exactement son apparence : une communauté qui ne déclare pas
        // de couleurs n'a rien à changer.
        const c = COM.couleurs || {};
        const T = {
            bg:     c["--bg"]         || "#07090d",
            panel:  c["--panel"]      || "#0e1219",
            texte:  c["--text"]       || "#f5f7fb",
            doux:   c["--muted"]      || "#8d97a8",
            trait:  c["--border"]     || "#202734",
            accent: c["--blue"]       || "#48bfff",
            or:     c["--gold"]       || "#d9b45b",
            sur:    c["--sur-accent"] || "#001018",
            creux:  c["--creux"]      || "rgba(255,255,255,.04)",
        };
        // Une page claire et une page sombre ne veulent pas la même ombre :
        // sur du blanc, une ombre noire dense salit ; sur du noir, une ombre
        // légère ne se voit pas.
        const claire = Boolean(c["--bg"]);
        const ombre = claire ? "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)" : "0 12px 30px #0004";

        // L'argent se lit en entier. « 1 250 000 FCFA » et « 1250000 FCFA »
        // portent la même information et ne se lisent pas à la même vitesse.
        const devise = String(pay.devise || "").toUpperCase();
        const sou = (v) => `${Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}<span class="dev">${esc(devise)}</span>`;

        const initiales = String(user.prenom || user.email || "?").trim().slice(0, 1).toUpperCase();
        const prenom = esc(user.prenom || String(user.email || "").split("@")[0]);

        res.type("html").send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(COM.nom)} — administration</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:${T.bg}; --panel:${T.panel}; --text:${T.texte}; --muted:${T.doux};
  --line:${T.trait}; --accent:${T.accent}; --or:${T.or}; --sur:${T.sur};
  --creux:${T.creux}; --ombre:${ombre};
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
     font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
     -webkit-font-smoothing:antialiased;line-height:1.5}
a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin:auto;padding:26px 18px 72px}

/* ── L'en-tête ─────────────────────────────────────────────────────── */
.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;
     padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:26px}
.ident{display:flex;gap:13px;align-items:center;min-width:0}
.pastille{width:46px;height:46px;border-radius:14px;flex-shrink:0;display:grid;place-items:center;
          background:var(--accent);color:var(--sur);font-weight:800;font-size:18px}
.eyebrow{color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
.title{font-size:22px;font-weight:800;margin:2px 0 1px;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:13px}
.actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}
.btn{border:1px solid var(--line);background:var(--panel);color:var(--text);
     border-radius:11px;padding:10px 15px;font-size:13px;font-weight:600;white-space:nowrap}
.btn:hover{border-color:var(--accent)}
.btn--plein{background:var(--accent);color:var(--sur);border-color:var(--accent);font-weight:700}

/* ── Le chiffre qui compte ─────────────────────────────────────────── */
.hero{background:var(--panel);border:1px solid var(--line);border-radius:20px;
      padding:28px 26px;box-shadow:var(--ombre);margin-bottom:14px;
      display:flex;justify-content:space-between;align-items:flex-end;gap:26px;flex-wrap:wrap}
.hero .label{color:var(--muted);font-size:13px;font-weight:600}
.hero .montant{font-size:clamp(34px,7vw,50px);font-weight:800;color:var(--or);
               letter-spacing:-.03em;margin-top:6px;line-height:1.05}
.dev{font-size:.42em;font-weight:700;margin-left:8px;opacity:.75;letter-spacing:0}
.hero .note{color:var(--muted);font-size:12.5px;margin-top:8px;max-width:44ch}
.hero-cote{text-align:right}
.hero-cote .label{font-size:12px}
.hero-cote .v{font-size:20px;font-weight:700;margin-top:3px}

/* ── Les tuiles ────────────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;
      padding:19px;box-shadow:var(--ombre)}
.label{color:var(--muted);font-size:12.5px;font-weight:600}
.num{font-size:27px;font-weight:800;margin-top:7px;letter-spacing:-.02em}
.metricline{display:flex;gap:16px;margin-top:9px;color:var(--muted);font-size:12px}
.metricline b{color:var(--text);font-weight:700}
.small{font-size:12px;color:var(--muted)}

/* ── Les deux colonnes du bas ──────────────────────────────────────── */
.two{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-top:12px}
.section-title{font-size:15px;font-weight:700;margin-bottom:14px;letter-spacing:-.01em}
.row{display:flex;justify-content:space-between;gap:14px;padding:13px 0;border-top:1px solid var(--line)}
.row:first-of-type{border-top:0;padding-top:0}
.row-nom{font-size:13.5px;font-weight:600}
.empty{color:var(--muted);font-size:13px;padding:18px 0;line-height:1.6}
.barrow{margin:0 0 16px}
.barrow:last-child{margin-bottom:0}
.barhead{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}
.barhead b{font-weight:700}
.track{height:7px;border-radius:99px;background:var(--creux);overflow:hidden}
.fill{height:100%;border-radius:99px;background:var(--accent)}
.fill--or{background:var(--or)}

@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}}
@media(max-width:560px){
  .wrap{padding:20px 14px 56px}
  .top{flex-direction:column;align-items:stretch;gap:14px}
  .actions{width:100%}.btn{flex:1;text-align:center}
  .hero{padding:22px 20px}
  .hero-cote{text-align:left}
}
</style></head><body><main class="wrap">

<header class="top">
  <div class="ident">
    <div class="pastille">${esc(initiales)}</div>
    <div style="min-width:0">
      <div class="eyebrow">Espace d'administration</div>
      <div class="title">${esc(COM.nom)}</div>
      <div class="sub">Bonjour ${prenom} — voici où en est ta communauté.</div>
    </div>
  </div>
  <div class="actions">
    <a class="btn" href="${esc(communautes.accueil(COM))}">Voir ma communauté</a>
    <a class="btn btn--plein" href="/qg">Ma boutique</a>
  </div>
</header>

<!-- LE CHIFFRE QU'ELLE VIENT VOIR. L'argent des ventes arrive sur notre
     compte et lui est reversé : tant qu'elle ne voit que le chiffre
     d'affaires brut, soit elle croit que tout est à elle, soit elle doit
     nous croire sur parole. Les deux finissent mal. Sa part d'abord, en
     grand ; le volume total à côté, en petit, pour qu'elle puisse vérifier. -->
<section class="hero">
  <div>
    <div class="label">Ce qui te revient</div>
    <div class="montant">${sou(pay.du_partenaire)}</div>
    <div class="note">Ta part sur les ventes déjà encaissées${pay.n ? ` — ${pay.n} vente${pay.n > 1 ? "s" : ""}` : ""}.</div>
  </div>
  <div class="hero-cote">
    <div class="label">Volume encaissé</div>
    <div class="v">${sou(pay.total)}</div>
    <div class="small" style="margin-top:4px">Total avant partage</div>
  </div>
</section>

<section class="grid">
  <div class="card"><div class="label">Membres</div><div class="num">${m.n}</div></div>
  <div class="card"><div class="label">Publications</div><div class="num">${p.n}</div>
    <div class="metricline"><span>♥ <b>${p.likes}</b></span><span>💬 <b>${p.comments}</b></span></div></div>
  <div class="card"><div class="label">Engagement</div><div class="num">${engagement}</div>
    <div class="small" style="margin-top:7px">J'aime et commentaires</div></div>
  <div class="card"><div class="label">Activité</div>
    <div class="num">${m.n ? Math.round((Number(p.n||0)/Number(m.n))*100) : 0}<span style="font-size:17px;font-weight:700">%</span></div>
    <div class="small" style="margin-top:7px">Publications par membre</div></div>
</section>

<section class="two">
  <div class="card">
    <div class="section-title">Dernières publications</div>
    ${recentPosts.length ? recentPosts.map(x=>`<div class="row">
      <div style="min-width:0"><div class="row-nom">${esc((x.contenu||"").slice(0,120))}${(x.contenu||"").length>120?"…":""}</div>
      <div class="small">${new Date(x.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</div></div>
      <div class="small" style="white-space:nowrap">♥ ${x.like_count||0} · 💬 ${x.commentaire_count||0}</div></div>`).join("")
      : `<div class="empty">Rien n'a encore été publié.<br>Publie la première chose depuis <a href="${esc(communautes.accueil(COM))}" style="color:var(--accent);font-weight:600">ta communauté</a> — c'est ce qui lance un fil.</div>`}
  </div>
  <div class="card">
    <div class="section-title">Vue d'ensemble</div>
    <div class="barrow"><div class="barhead"><span>Membres</span><b>${m.n}</b></div><div class="track"><div class="fill" style="width:${bar(m.n)}%"></div></div></div>
    <div class="barrow"><div class="barhead"><span>Publications</span><b>${p.n}</b></div><div class="track"><div class="fill" style="width:${bar(p.n)}%"></div></div></div>
    <div class="barrow"><div class="barhead"><span>Engagement</span><b>${engagement}</b></div><div class="track"><div class="fill" style="width:${bar(engagement)}%"></div></div></div>
    <div class="barrow"><div class="barhead"><span>Ventes</span><b>${pay.n}</b></div><div class="track"><div class="fill fill--or" style="width:${bar(pay.n)}%"></div></div></div>
  </div>
</section>

<section class="card" style="margin-top:12px">
  <div class="section-title">Nouveaux membres</div>
  ${recentMembers.length ? recentMembers.map(x=>`<div class="row">
    <div style="min-width:0"><div class="row-nom">${esc(`${x.prenom||""} ${x.nom||""}`.trim() || x.email)}</div>
    <div class="small">${esc(x.email)}</div></div>
    <div class="small" style="white-space:nowrap">${new Date(x.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</div></div>`).join("")
    : `<div class="empty">Personne ne s'est encore inscrit.<br>Partage le lien de ta communauté : <strong>${esc(COM.hote || "")}${esc(communautes.accueil(COM))}</strong></div>`}
</section>

</main></body></html>`);
    } catch (err) {
        console.error("❌ Community admin:", err.message);
        res.status(500).send("Impossible de charger le tableau de bord de la communauté.");
    }
});

module.exports = router;
