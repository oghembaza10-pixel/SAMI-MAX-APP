// ==========================================================================
// L'ÉCRAN ET L'API INTERNE DES AGENTS SOCIAUX
// ==========================================================================
//
// ── RÉSERVÉ AU FONDATEUR, POUR L'INSTANT ─────────────────────────────────
//
// Ces agents écrivent au nom d'OG Technology et peuvent, une fois la
// simulation levée, publier sur de vrais comptes. Tant que rien n'a été
// éprouvé en conditions réelles, la porte est celle du fondateur —
// `session.isAdmin`, posée par `/admin/login`, comme `/jarvis/moteur`.
//
// Ouvrir ça aux marchands viendra quand le système aura fait ses preuves,
// et ce sera une décision, pas un oubli.
//
// ── L'API INTERNE ─────────────────────────────────────────────────────────
//
// Elle est faite pour être appelée par SAMII elle-même (un outil du
// planificateur, plus tard) autant que par cet écran. D'où le JSON partout
// et l'absence de logique dans les vues.

const express = require("express");
const router = express.Router();

const social = require("../engines/social");
const store = require("../services/socialStore");
const plateformes = require("../config/plateformes-sociales");

// ── LA PORTE ──────────────────────────────────────────────────────────────
//
// 404 et non 403 : une page dont on ignore l'existence ne se cherche pas.
// Même geste que `/jarvis/moteur`.
function requireFondateur(req, res, next) {
    if (req.session?.isAdmin !== true) return res.status(404).send("Not found");
    next();
}
router.use(requireFondateur);

function echapper(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ══════════════════════════════════════════════════════════════════════════
// API INTERNE
// ══════════════════════════════════════════════════════════════════════════

// L'état complet : mode, agents coupés, plateformes, simulation.
router.get("/api/etat", (req, res) => res.json(social.etat()));

// Le stratège propose des sujets.
router.post("/api/strategie", async (req, res) => {
    const r = await social.strategist.planifier({
        workspaceId: req.body?.workspaceId || null,
        objectif: req.body?.objectif,
        contrainte: req.body?.contrainte,
        nbSujets: Math.min(Number(req.body?.nbSujets) || 3, 10),
    });
    res.status(r.ok ? 200 : 422).json(r);
});

// La chaîne complète : créer → adapter → relire. Ne publie jamais.
router.post("/api/preparer", async (req, res) => {
    const r = await social.preparer({
        workspaceId: req.body?.workspaceId || null,
        communaute: req.body?.communaute || res.locals?.COM?.slug || "samii",
        theme: req.body?.theme,
        objectif: req.body?.objectif,
        angle: req.body?.angle,
        cibles: req.body?.cibles,
        media: req.body?.media,
        mediaType: req.body?.mediaType,
        creePar: req.session?.adminEmail || "fondateur",
    });
    res.status(r.ok ? 200 : 422).json(r);
});

// Programmer les variantes approuvées. `force` = la validation humaine que
// le mode MANUAL exige : c'est le clic sur le bouton qui la porte.
router.post("/api/programmer", async (req, res) => {
    const r = await social.programmer({
        postId: Number(req.body?.postId),
        quand: req.body?.quand || null,
        workspaceId: req.body?.workspaceId || null,
        force: req.body?.force === true,
    });
    res.status(r.ok ? 200 : 422).json(r);
});

// Faire passer le publieur maintenant, à la main.
router.post("/api/publier-maintenant", async (req, res) => {
    res.json(await social.passer());
});

// Ce que l'analyste sait — et surtout ce qu'il ne sait pas.
router.get("/api/analyse", async (req, res) => {
    res.json(await social.analytics.comparer({
        workspaceId: req.query?.workspaceId || null,
        depuisJours: Math.min(Number(req.query?.jours) || 30, 365),
    }));
});

// Ce que l'apprentissage a le droit de conclure.
router.get("/api/apprentissage", async (req, res) => {
    res.json(await social.learning.apprendre({ workspaceId: req.query?.workspaceId || null }));
});

router.get("/api/posts", async (req, res) => {
    res.json(await store.listerPosts({
        workspaceId: req.query?.workspaceId || null,
        communaute: res.locals?.COM?.slug || "samii",
        statut: req.query?.statut || null,
    }));
});

router.get("/api/publications", async (req, res) => {
    res.json(await store.listerPublications({
        workspaceId: req.query?.workspaceId || null,
        communaute: res.locals?.COM?.slug || "samii",
    }));
});

router.get("/api/runs", async (req, res) => {
    res.json(await store.listerRuns({
        agent: req.query?.agent || null,
        postId: req.query?.postId ? Number(req.query.postId) : null,
    }));
});

// ══════════════════════════════════════════════════════════════════════════
// L'ÉCRAN
// ══════════════════════════════════════════════════════════════════════════
//
// CONTENU · PLATEFORME · STATUT · DATE · AGENT · RÉSULTAT, comme demandé.
// Volontairement une seule page sans dépendance : elle sert à VOIR ce que
// les agents ont fait, pas à être belle.

const COULEUR_STATUT = {
    draft: "#8a8f9e", review: "#e0b341", approved: "#5ad4ff",
    scheduled: "#7d5cff", publishing: "#7d5cff", published: "#3ddc84",
    failed: "#ff6b6b", cancelled: "#5a5a66",
};

router.get("/", async (req, res) => {
    const etat = social.etat();
    const communaute = res.locals?.COM?.slug || "samii";
    const [posts, publications, runs] = await Promise.all([
        store.listerPosts({ communaute, limite: 30 }).catch(() => []),
        store.listerPublications({ communaute, limite: 50 }).catch(() => []),
        store.listerRuns({ limite: 30 }).catch(() => []),
    ]);

    const pastille = (s) =>
        `<span style="background:${COULEUR_STATUT[s] || "#555"};color:#06080f;padding:2px 8px;border-radius:10px;font-size:.75rem;font-weight:600">${echapper(s)}</span>`;

    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agents sociaux SAMII</title>
<style>
 body{background:#06080f;color:#e8e6df;font-family:system-ui,Arial,sans-serif;margin:0;padding:24px;line-height:1.5}
 h1{font-size:1.3rem;margin:0 0 4px} h2{font-size:1rem;margin:28px 0 10px;color:#5ad4ff}
 .sous{color:#8a8f9e;font-size:.85rem;margin-bottom:20px}
 .bandeau{background:#0e1320;border:1px solid #1c2436;border-radius:10px;padding:14px 16px;margin-bottom:18px}
 .alerte{border-color:#e0b341;background:#1d1707}
 table{width:100%;border-collapse:collapse;font-size:.85rem}
 th{text-align:left;color:#8a8f9e;font-weight:600;padding:8px 10px;border-bottom:1px solid #1c2436}
 td{padding:8px 10px;border-bottom:1px solid #141a28;vertical-align:top}
 .vide{color:#8a8f9e;font-style:italic;padding:14px 0}
 .puce{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.75rem;background:#1c2436;margin-right:4px}
 .coupe{background:#3a1d1d;color:#ff9b9b}
 .scroll{overflow-x:auto}
 code{background:#141a28;padding:1px 5px;border-radius:4px;font-size:.8rem}
</style></head><body>

<h1>Agents sociaux SAMII</h1>
<div class="sous">Ce que les agents ont préparé, programmé et publié.</div>

<div class="bandeau ${etat.publication.publicationReelle ? "alerte" : ""}">
  <b>Mode :</b> ${echapper(etat.mode)}
  ${etat.mode !== etat.modeDemande ? `<span class="puce">demandé : ${echapper(etat.modeDemande)} — AUTO exige SOCIAL_AUTO_CONFIRME=oui</span>` : ""}
  &nbsp;·&nbsp;
  <b>Publication :</b> ${etat.publication.publicationReelle
      ? "⚠️ RÉELLE — ce qui part atteint de vrais comptes"
      : "simulation (aucune publication réelle)"}
  <div style="margin-top:8px">
    <b>Agents :</b> ${etat.agents.map((a) => `<span class="puce ${a.coupe ? "coupe" : ""}">${echapper(a.nom)}${a.coupe ? " coupé" : ""}</span>`).join("")}
  </div>
  <div style="margin-top:6px">
    <b>Plateformes :</b> ${etat.publication.plateformes.map((p) =>
      // Aucun provider = rien ne partira sur cette plateforme. C'est
      // l'information la plus importante de cette ligne : elle ne peut pas
      // rester dans une infobulle qu'on ne survole jamais.
      `<span class="puce ${p.coupee || !p.providerUtilise ? "coupe" : ""}" title="${echapper(p.note || "")}">${
        echapper(p.slug)} → ${echapper(p.providerUtilise || "aucun chemin")}${
        (p.providersReels || []).length > 1
          ? " (" + p.providersReels.map((x) =>
              x.nom + (!x.configure ? "✗" : x.sert === false ? "⛔" : "")).join(" puis ") + ")"
          : ""}</span>`).join("")}
    ${etat.publication.plateformes.filter((p) => !p.providerUtilise && !p.coupee).map((p) =>
      `<div style="margin-top:6px;color:#e0b341">⚠️ <b>${echapper(p.slug)}</b> : ${echapper(p.note || "aucun provider")}</div>`).join("")}
  </div>
</div>

<h2>Publications</h2>
<div class="scroll">
${publications.length ? `<table>
<tr><th>Contenu</th><th>Plateforme</th><th>Statut</th><th>Date</th><th>Provider</th><th>Résultat</th></tr>
${publications.map((p) => `<tr>
  <td>${echapper((p.titre || p.texte || "").slice(0, 70))}</td>
  <td>${echapper(p.v_plateforme || p.plateforme)}</td>
  <td>${pastille(p.statut)}</td>
  <td>${echapper(new Date(p.publiee_le || p.programmee_le || p.created_at).toLocaleString("fr-FR"))}</td>
  <td>${echapper(p.provider || "—")}</td>
  <td>${p.erreur ? `<span style="color:#ff9b9b">${echapper(p.erreur.slice(0, 120))}</span>` : echapper(p.externe_id || "—")}${p.essais > 1 ? ` <span class="puce">${p.essais} essais</span>` : ""}</td>
</tr>`).join("")}
</table>` : `<div class="vide">Aucune publication. Prépare un contenu avec <code>POST /social/api/preparer</code>.</div>`}
</div>

<h2>Contenus préparés</h2>
<div class="scroll">
${posts.length ? `<table>
<tr><th>Titre</th><th>Thème</th><th>Statut</th><th>Mode</th><th>Créé</th></tr>
${posts.map((p) => `<tr>
  <td>${echapper((p.titre || "").slice(0, 70))}</td>
  <td>${echapper((p.theme || "—").slice(0, 40))}</td>
  <td>${pastille(p.statut)}</td>
  <td>${echapper(p.mode)}</td>
  <td>${echapper(new Date(p.created_at).toLocaleString("fr-FR"))}</td>
</tr>`).join("")}
</table>` : `<div class="vide">Aucun contenu préparé.</div>`}
</div>

<h2>Ce que les agents ont fait</h2>
<div class="scroll">
${runs.length ? `<table>
<tr><th>Agent</th><th>Post</th><th>Statut</th><th>Durée</th><th>Quand</th><th>Erreur</th></tr>
${runs.map((r) => `<tr>
  <td>${echapper(r.agent)}</td>
  <td>${r.post_id || "—"}</td>
  <td>${echapper(r.statut)}</td>
  <td>${r.duree_ms ? r.duree_ms + " ms" : "—"}</td>
  <td>${echapper(new Date(r.created_at).toLocaleString("fr-FR"))}</td>
  <td>${r.erreur ? `<span style="color:#ff9b9b">${echapper(r.erreur.slice(0, 100))}</span>` : "—"}</td>
</tr>`).join("")}
</table>` : `<div class="vide">Aucun agent n'a encore tourné.</div>`}
</div>

<h2>Buffer</h2>
<div class="bandeau">
${await (async () => {
    const b = require("../engines/social/providers/buffer");
    const e = await b.etat();
    if (!e.configure) return `<div>⚠️ ${echapper(e.raison)}</div>`;
    if (!e.joignable) return `<div style="color:#ff9b9b">❌ Buffer injoignable : ${echapper(e.raison)}</div>`;
    return `<div><b>Organisation :</b> ${echapper(e.organisation?.nom || "—")}</div>`
      + `<div style="margin-top:6px"><b>Chaînes connectées :</b> `
      + (e.chainesBuffer.length
          ? e.chainesBuffer.map((c) => `<span class="puce">${echapper(c.service)} · ${echapper(c.nom)}</span>`).join("")
          : "<i>aucune — connecte tes comptes dans Buffer d'abord</i>") + "</div>"
      // Ce que Buffer a le DROIT de servir. Sans cette ligne, le ⚠️ en face
      // de Facebook se lit comme une panne, alors que c'est une décision :
      // Facebook passe par Meta, WhatsApp par Green API, Telegram par SAMII.
      + `<div style="margin-top:6px"><b>Autorisé à servir :</b> `
      + `<span class="puce">${e.autorisees.map(echapper).join("</span><span class=\"puce\">")}</span>`
      + (process.env.BUFFER_PLATEFORMES ? "" : " <i>(BUFFER_PLATEFORMES non posée — couverture complète)</i>")
      + `</div>`
      + `<div style="margin-top:10px">`
      + Object.entries(e.parPlateforme).map(([slug, v]) => {
          // « Écarté exprès » n'est pas « en panne ». Le premier n'appelle
          // aucune action, le second si — l'écran doit les distinguer.
          const exprès = !v.pret && /volontairement hors de Buffer/.test(v.raison || "");
          return `<div>${v.pret ? "✅" : exprès ? "⛔" : "⚠️"} <b>${echapper(slug)}</b> : ${
            v.pret ? v.chaines.map((c) => echapper(c.nom)).join(", ")
                   : `<span style="color:${exprès ? "#8c93a8" : "#e0b341"}">${echapper(v.raison)}</span>`}</div>`;
        }).join("")
      + `</div>`;
})()}
</div>

<h2>Ce qu'on ne sait pas encore</h2>
<div class="bandeau">
${(await social.analytics.couverture()).map((c) =>
  `<div>${echapper(c.nom)} : ${c.collecteur ? "✅ statistiques collectables" : "— " + echapper(c.raison)}</div>`).join("")}
</div>

</body></html>`);
});

module.exports = router;
