// ==========================================================================
// SAMII OS — LES MOYENS DE PAIEMENT (liste et état)
//
// DEUX ADRESSES, DEUX PUBLICS.
//
// `/paiement/moyens` — ce que la page d'achat demandera pour construire la
// liste dans laquelle l'acheteur choisit. Elle ne renvoie que des moyens qui
// marcheraient vraiment : clés présentes, adaptateur écrit, pays couvert.
// Proposer un moyen qui échouera, c'est perdre la vente au dernier écran —
// celui où l'acheteur avait déjà décidé.
//
// `/paiement/etat` — la réponse à « qu'est-ce qu'il reste à faire pour que
// le paiement passe ? », en une page, à jour, sans avoir à demander. Ce qui
// manque y est nommé variable par variable. Réservée aux fondateurs : la
// liste des clés absentes dit à un attaquant exactement où appuyer.
// ==========================================================================
const express = require("express");
const router = express.Router();
const fournisseurs = require("../config/paiements");
const { estFondateur } = require("../config/fondateurs");

function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

// ── CE QUE VOIT UN ACHETEUR ─────────────────────────────────────────────
router.get("/moyens", (req, res) => {
    const pays = String(req.query.pays || req.session?.pays || "").toUpperCase();
    const liste = fournisseurs.pour({ pays }).map((f) => ({
        id: f.id, nom: f.nom, detail: f.detail, emoji: f.emoji, devises: f.devises,
    }));
    res.json({ success: true, pays: pays || null, moyens: liste });
});

// ── CE QU'IL RESTE À FAIRE ──────────────────────────────────────────────
router.get("/etat", (req, res) => {
    if (!estFondateur(req.session?.email)) return res.status(404).send("Introuvable.");

    const etat = fournisseurs.etat();
    const prets = etat.filter((f) => f.pret && f.configure).length;

    const carte = (f) => {
        // Trois états, trois messages. Un « ❌ » sans phrase ne dit pas quoi
        // faire ; ici chaque cas nomme l'action suivante et à qui elle revient.
        let etatTexte, classe, action;
        if (!f.pret) {
            etatTexte = "Code à écrire";
            classe = "att";
            action = "L'adaptateur n'est pas écrit : il manque la documentation du prestataire (adresse de création d'un paiement, noms des champs, signature des notifications).";
        } else if (!f.configure) {
            etatTexte = "Clés manquantes";
            classe = "man";
            action = `À ajouter sur Render → Environment : ${f.clesManquantes.join(", ")}`;
        } else {
            etatTexte = "Opérationnel";
            classe = "ok";
            action = "Clés présentes et adaptateur écrit. Ce moyen s'affichera aux acheteurs des pays couverts.";
        }

        const pays = f.pays.includes("*")
            ? "Tous les pays non couverts par les autres moyens"
            : `${f.pays.length} pays — ${f.pays.join(", ")}`;

        return `
        <article class="f ${classe}">
          <div class="f-tete">
            <span class="f-emoji">${f.emoji}</span>
            <div>
              <b>${escapeHtml(f.nom)}</b>
              <span>${escapeHtml(f.detail)}</span>
            </div>
            <span class="badge">${etatTexte}</span>
          </div>
          <p class="f-action">${escapeHtml(action)}</p>
          <dl>
            <div><dt>Devises</dt><dd>${f.devises.join(" · ")}</dd></div>
            <div><dt>Couverture</dt><dd>${escapeHtml(pays)}</dd></div>
            <div><dt>Variables</dt><dd>${f.cles.map((c) =>
                `<code class="${process.env[c] ? "vu" : "abs"}">${escapeHtml(c)}</code>`).join(" ")}</dd></div>
          </dl>
        </article>`;
    };

    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moyens de paiement — état</title>
<style>
:root{--bg:#03060b;--panel:#0b1420;--text:#f2f7fc;--muted:#8397ab;
      --ok:#3ddc84;--man:#e3b341;--att:#ff7a8a;--border:rgba(255,255,255,.09)}
*{box-sizing:border-box}
body{margin:0;padding:26px 18px 70px;background:var(--bg);color:var(--text);
     font:15px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.w{max-width:760px;margin:0 auto}
h1{font-size:21px;margin:0 0 6px}
.intro{color:var(--muted);font-size:13.5px;margin:0 0 8px;max-width:64ch}
.compte{color:var(--muted);font-size:13px;margin:0 0 24px}
.compte b{color:var(--text)}
.f{background:var(--panel);border:1px solid var(--border);border-radius:15px;
   padding:17px;margin-bottom:14px}
.f-tete{display:flex;align-items:center;gap:12px;margin-bottom:11px}
.f-emoji{font-size:23px;flex:none}
.f-tete b{display:block;font-size:15px}
.f-tete>div>span{color:var(--muted);font-size:12.5px}
.badge{margin-left:auto;font-size:11px;font-weight:700;padding:5px 11px;
       border-radius:999px;white-space:nowrap}
.ok .badge{background:rgba(61,220,132,.14);color:var(--ok)}
.man .badge{background:rgba(227,179,65,.14);color:var(--man)}
.att .badge{background:rgba(255,122,138,.14);color:var(--att)}
.f-action{margin:0 0 13px;font-size:13px;color:var(--text);line-height:1.6}
.man .f-action{color:var(--man)}
.att .f-action{color:var(--att)}
dl{margin:0;display:grid;gap:7px;border-top:1px solid var(--border);padding-top:12px}
dl>div{display:flex;gap:12px;font-size:12.5px}
dt{color:var(--muted);min-width:96px;flex:none}
dd{margin:0;color:var(--text)}
code{font-size:11.5px;padding:2px 7px;border-radius:5px;background:rgba(255,255,255,.06)}
code.vu{color:var(--ok)} code.abs{color:var(--att)}
.note{margin-top:26px;padding:15px 17px;border:1px solid var(--border);
      border-radius:13px;background:var(--panel);color:var(--muted);font-size:12.5px}
.note b{color:var(--text)}
</style></head><body><div class="w">
<h1>Moyens de paiement</h1>
<p class="intro">Ce que le serveur voit réellement, maintenant. Un moyen ne
s'affiche à un acheteur que si son adaptateur est écrit, ses clés présentes,
et son pays couvert — les trois.</p>
<p class="compte"><b>${prets}</b> moyen${prets > 1 ? "s" : ""} opérationnel${prets > 1 ? "s" : ""} sur ${etat.length}.</p>
${etat.map(carte).join("")}
<div class="note"><b>Le partage.</b> La commission prélevée sur une vente et
sa répartition entre la partenaire et la maison sont définies par communauté
dans <code>config/communautes.js</code>. Le calcul est écrit dans la ligne de
paiement au moment de la vente et n'est jamais recalculé après coup.</div>
</div></body></html>`);
});

module.exports = router;
