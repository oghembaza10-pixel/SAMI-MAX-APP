const express = require("express");
const db = require("../services/db");

const router = express.Router();

function esc(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function getCommunityAdmin(req) {
    if (!req.session?.loggedIn || !req.session?.userId) return null;
    const rows = await db.query(
        `SELECT id, prenom, nom, email, role, communaute
           FROM utilisateurs
          WHERE id = $1
            AND actif = TRUE
          LIMIT 1`,
        [req.session.userId]
    );
    const user = rows[0];
    if (!user || user.role !== "community_admin" || !user.communaute) return null;
    return user;
}

router.get("/admin/communaute", async (req, res) => {
    try {
        const user = await getCommunityAdmin(req);
        if (!user) return res.status(403).send("Accès réservé aux administrateurs de communauté.");

        const community = user.communaute;
        const [members, posts, payments, recentPosts, recentMembers] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS n FROM utilisateurs WHERE communaute = $1 AND actif = TRUE`, [community]),
            db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(like_count),0)::int AS likes, COALESCE(SUM(commentaire_count),0)::int AS comments, COALESCE(SUM(partage_count),0)::int AS shares FROM publications WHERE communaute = $1`, [community]),
            db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(montant),0)::numeric AS total, COALESCE(MAX(devise),'USD') AS devise FROM paiements WHERE communaute = $1 AND LOWER(COALESCE(statut,'')) IN ('paye','paid','success','succeeded','complete','completed')`, [community]),
            db.query(`SELECT id, contenu, created_at, like_count, commentaire_count, partage_count FROM publications WHERE communaute = $1 ORDER BY created_at DESC LIMIT 5`, [community]),
            db.query(`SELECT prenom, nom, email, created_at FROM utilisateurs WHERE communaute = $1 ORDER BY created_at DESC LIMIT 5`, [community]),
        ]);

        const m = members[0] || { n: 0 };
        const p = posts[0] || { n: 0, likes: 0, comments: 0, shares: 0 };
        const pay = payments[0] || { n: 0, total: 0, devise: "USD" };
        const engagement = Number(p.likes || 0) + Number(p.comments || 0) + Number(p.shares || 0);
        const maxMetric = Math.max(Number(m.n || 0), Number(p.n || 0), Number(pay.n || 0), engagement, 1);
        const bar = (value) => Math.max(4, Math.min(100, Math.round((Number(value || 0) / maxMetric) * 100)));

        res.type("html").send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Administration — ${esc(community)}</title>
<style>
:root{color-scheme:dark;--bg:#07090d;--panel:#0e1219;--line:#202734;--gold:#d9b45b;--text:#f5f7fb;--muted:#8d97a8;--green:#4ade80;--blue:#48bfff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#151b27 0,#07090d 48%);font-family:Inter,system-ui,-apple-system,sans-serif;color:var(--text)}
a{color:inherit;text-decoration:none}.wrap{max-width:1280px;margin:auto;padding:30px 22px 60px}.top{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px}.eyebrow{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.title{font-size:30px;font-weight:800;margin:7px 0}.sub{color:var(--muted)}.actions{display:flex;gap:8px;flex-wrap:wrap}.badge,.action{border:1px solid #5b4a25;background:#1b160b;color:#e8c86d;border-radius:999px;padding:9px 13px;font-size:13px;font-weight:700}.action{border-color:var(--line);background:#0e1219;color:var(--text)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:linear-gradient(145deg,#111722,#0b0e14);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 12px 30px #0004}.label{color:var(--muted);font-size:13px}.num{font-size:31px;font-weight:850;margin-top:8px}.accent{color:var(--gold)}.green{color:var(--green)}
.two{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;margin-top:14px}.section-title{font-size:17px;font-weight:800;margin-bottom:15px}.row{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid var(--line)}.row:first-of-type{border-top:0}.small{font-size:12px;color:var(--muted)}.metricline{display:flex;gap:24px;margin-top:12px;color:var(--muted);font-size:13px}.metricline b{color:var(--text)}.empty{color:var(--muted);padding:15px 0}.barrow{margin:15px 0}.barhead{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}.track{height:9px;border-radius:99px;background:#1a202b;overflow:hidden}.fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--blue),var(--gold))}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.actions{width:100%}}
</style></head><body><main class="wrap">
<header class="top"><div><div class="eyebrow">SAMII · Community Admin</div><div class="title">${esc(community)}</div><div class="sub">Bonjour ${esc(user.prenom || user.email)} — votre espace d'administration.</div></div><div class="actions"><a class="action" href="/c/${encodeURIComponent(community)}">Voir la communauté</a><span class="badge">ADMIN COMMUNAUTÉ</span></div></header>
<section class="grid">
<div class="card"><div class="label">Membres actifs</div><div class="num">${m.n}</div></div>
<div class="card"><div class="label">Publications</div><div class="num">${p.n}</div><div class="metricline"><span>♥ <b>${p.likes}</b></span><span>💬 <b>${p.comments}</b></span><span>↗ <b>${p.shares}</b></span></div></div>
<div class="card"><div class="label">Paiements réussis</div><div class="num green">${pay.n}</div></div>
<div class="card"><div class="label">Ventes / transactions</div><div class="num accent">${pay.n}</div><div class="small">Transactions payées</div></div>
</section>
<section class="grid" style="margin-top:14px">
<div class="card"><div class="label">Chiffre d'affaires</div><div class="num accent">${Number(pay.total || 0).toLocaleString("fr-FR",{maximumFractionDigits:2})} ${esc(pay.devise || "USD")}</div></div>
<div class="card"><div class="label">Engagement total</div><div class="num">${engagement}</div></div>
<div class="card"><div class="label">Taux d'activité</div><div class="num">${m.n ? Math.round((Number(p.n||0)/Number(m.n))*100) : 0}<span style="font-size:18px">%</span></div><div class="small">Publications / membres</div></div>
</section>
<section class="two">
<div class="card"><div class="section-title">Vue d'activité</div>
<div class="barrow"><div class="barhead"><span>Membres</span><b>${m.n}</b></div><div class="track"><div class="fill" style="width:${bar(m.n)}%"></div></div></div>
<div class="barrow"><div class="barhead"><span>Publications</span><b>${p.n}</b></div><div class="track"><div class="fill" style="width:${bar(p.n)}%"></div></div></div>
<div class="barrow"><div class="barhead"><span>Engagement</span><b>${engagement}</b></div><div class="track"><div class="fill" style="width:${bar(engagement)}%"></div></div></div>
<div class="barrow"><div class="barhead"><span>Paiements</span><b>${pay.n}</b></div><div class="track"><div class="fill" style="width:${bar(pay.n)}%"></div></div></div>
</div>
<div class="card"><div class="section-title">Nouveaux membres</div>${recentMembers.length ? recentMembers.map(x=>`<div class="row"><div><div>${esc(`${x.prenom||""} ${x.nom||""}`.trim() || x.email)}</div><div class="small">${esc(x.email)}</div></div><div class="small">${new Date(x.created_at).toLocaleDateString("fr-FR")}</div></div>`).join("") : '<div class="empty">Aucun membre pour le moment.</div>'}</div>
</section>
<section class="card" style="margin-top:14px"><div class="section-title">Dernières publications</div>${recentPosts.length ? recentPosts.map(x=>`<div class="row"><div><div>${esc((x.contenu||"").slice(0,140))}${(x.contenu||"").length>140?"…":""}</div><div class="small">${new Date(x.created_at).toLocaleString("fr-FR")}</div></div><div class="small">♥ ${x.like_count||0} · 💬 ${x.commentaire_count||0} · ↗ ${x.partage_count||0}</div></div>`).join("") : '<div class="empty">Aucune publication pour le moment.</div>'}</div>
</main></body></html>`);
    } catch (err) {
        console.error("❌ Community admin:", err.message);
        res.status(500).send("Impossible de charger le tableau de bord de la communauté.");
    }
});

module.exports = router;
