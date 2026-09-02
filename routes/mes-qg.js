// ==========================================================================
// « LEQUEL DE MES QG ? » — LE CHOIX, AU MOMENT DE LA CONNEXION
// ==========================================================================
//
// « Sinon au moment de se connecter je veux avoir le choix de choisir. »
//
// ── POURQUOI DEVINER NE MARCHERA JAMAIS ───────────────────────────────────
//
// J'ai essayé deux heuristiques avant d'écrire ce fichier, et les deux se
// sont trompées sur le compte du fondateur :
//
//   par `updated_at`       → « Ma Boutique Test » : zéro commande, zéro
//                            journal, jamais ouverte. Elle gagnait parce
//                            qu'un réglage y avait été touché.
//   par dernière activité  → deux boutiques actives le MÊME JOUR, donc à
//                            égalité, départagées par un critère arbitraire.
//
// Le problème n'est pas la qualité de l'heuristique : c'est qu'aucune donnée
// en base ne dit « c'est ici que je travaille ». Seule la personne le sait.
// On le lui demande donc, et on retient sa réponse.
//
// ── CE QUE CETTE PAGE N'EST PAS ───────────────────────────────────────────
//
// Ce n'est pas une étape de plus pour tout le monde. Quelqu'un qui n'a QU'UN
// SEUL QG ne la verra jamais : `apresConnexion` l'envoie directement dans sa
// boutique. Ajouter un clic à quelqu'un qui n'a pas de choix à faire serait
// une régression, pas une fonctionnalité.

const express = require("express");
const router = express.Router();
const workspaceService = require("../services/workspaceService");
const db = require("../services/db");

// ── QUI EST CONNECTÉ ──────────────────────────────────────────────────────
//
// Cette page liste les boutiques d'une personne : sans session, elle
// n'aurait aucun sens et fuirait la liste des QG à qui la demanderait.
function exigeConnexion(req, res, suivant) {
    if (!req.session?.loggedIn || !req.session?.email) {
        return res.redirect("/login?suite=" + encodeURIComponent("/mes-qg"));
    }
    suivant();
}

function echapper(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── CE QU'ON MONTRE DE CHAQUE QG ──────────────────────────────────────────
//
// Le nom seul ne suffit pas : le fondateur a DEUX boutiques appelées
// « samiioficiel ». Sans un chiffre pour les distinguer, le choix est un
// tirage au sort avec une étape en plus.
//
// On montre donc ce qui identifie vraiment une boutique : ses commandes, sa
// dernière activité, son métier. Une requête, pas une par QG.
async function qgDeLaPersonne(email) {
    const lignes = await workspaceService.listerParPertinence(email);
    if (!lignes.length) return [];

    const ids = lignes.map((w) => w.id);
    let stats = [];
    try {
        stats = await db.query(
            `SELECT w.id,
                    (SELECT count(*)   FROM commandes o WHERE o.workspace_id = w.id) AS commandes,
                    (SELECT max(o.date_commande) FROM commandes o WHERE o.workspace_id = w.id) AS derniere_commande,
                    (SELECT count(*)   FROM produits  p WHERE p.workspace_id = w.id) AS produits
               FROM workspaces w WHERE w.id = ANY($1)`, [ids]);
    } catch (err) {
        // Les chiffres sont un confort, pas la fonction. Sans eux la page
        // marche encore — elle est juste moins parlante.
        console.warn("⚠️ /mes-qg — chiffres indisponibles :", err.message);
    }
    const parId = new Map(stats.map((s) => [s.id, s]));

    let choisi = null;
    try {
        const u = await db.query(`SELECT qg_principal FROM utilisateurs WHERE email = $1 LIMIT 1`, [email]);
        choisi = u[0]?.qg_principal || null;
    } catch { /* la colonne peut manquer sur une base non migrée */ }

    return lignes.map((w) => {
        const s = parId.get(w.id) || {};
        return {
            id: w.id,
            nom: w.nom || "(sans nom)",
            metier: w.metier || "",
            bacASable: !!w.est_bac_a_sable,
            suspendu: w.statut && w.statut !== "actif",
            commandes: Number(s.commandes || 0),
            produits: Number(s.produits || 0),
            derniereCommande: s.derniere_commande || null,
            epingle: w.id === choisi,
        };
    });
}

router.get("/", exigeConnexion, async (req, res) => {
    try {
        const qg = await qgDeLaPersonne(req.session.email);

        // Aucun QG : rien à choisir, et l'envoyer ici serait une impasse.
        if (!qg.length) return res.redirect("/workspace/create");
        // Un seul : on n'impose pas un clic pour un choix qui n'existe pas.
        if (qg.length === 1) {
            req.session.workspaceId = qg[0].id;
            return req.session.save(() => res.redirect("/qg"));
        }

        // ── LA CASE « TOUJOURS OUVRIR CELUI-CI » DOIT ÊTRE TENUE ─────────
        //
        // Quand quelqu'un l'a cochée, lui reposer la question à chaque
        // connexion, c'est ignorer ce qu'il vient de dire. On file donc
        // directement dans son QG.
        //
        // `?change=1` force la liste : c'est le lien « changer de QG », et
        // sans lui un choix épinglé deviendrait un choix irréversible.
        const change = req.query.change === "1";
        const epingle = qg.find((w) => w.epingle);
        if (epingle && !change) {
            req.session.workspaceId = epingle.id;
            req.session.metier = epingle.metier;
            return req.session.save(() => res.redirect("/qg"));
        }

        res.type("html").send(page(qg, change));
    } catch (err) {
        console.error("❌ GET /mes-qg :", err.message);
        res.redirect("/qg");
    }
});

router.post("/", exigeConnexion, async (req, res) => {
    const voulu = String(req.body?.workspaceId || "").trim();
    const retenir = req.body?.retenir === "oui" || req.body?.retenir === "on";

    // La valeur vient d'un formulaire, donc du dehors. On ne fait JAMAIS
    // confiance à l'identifiant reçu : `choisirQgPrincipal` vérifie que ce
    // QG appartient bien à cette personne avant d'écrire quoi que ce soit.
    const lignes = await workspaceService.listerParPertinence(req.session.email);
    const retenu = lignes.find((w) => w.id === voulu);
    if (!retenu) {
        return res.redirect("/mes-qg?erreur=inconnu");
    }

    if (retenir) {
        const r = await workspaceService.choisirQgPrincipal(req.session.email, voulu);
        if (!r.ok) console.warn("⚠️ /mes-qg — choix non enregistré :", r.erreur);
    }

    req.session.workspaceId = retenu.id;
    req.session.metier = retenu.metier;
    req.session.save(() => res.redirect("/qg"));
});

// ── LA PAGE ───────────────────────────────────────────────────────────────
//
// Écrite ici plutôt qu'en EJS : elle n'a ni barre latérale, ni menu, ni
// traduction à charger. C'est un écran de passage entre la connexion et le
// QG, et lui donner la mécanique complète d'une page du QG l'aurait rendue
// dépendante d'un contexte de session qui n'est justement pas encore choisi.
function page(qg, changement) {
    const carte = (w) => `
    <button type="submit" name="workspaceId" value="${echapper(w.id)}" class="qg ${w.epingle ? "epingle" : ""}">
      <div class="titre">
        <span class="nom">${echapper(w.nom)}</span>
        ${w.epingle ? `<span class="etiq or">votre choix habituel</span>` : ""}
        ${w.bacASable ? `<span class="etiq gris">bac à sable</span>` : ""}
        ${w.suspendu ? `<span class="etiq rouge">suspendu</span>` : ""}
      </div>
      <div class="chiffres">
        ${w.metier ? `<span>${echapper(w.metier)}</span>` : ""}
        <span>${w.commandes} commande${w.commandes > 1 ? "s" : ""}</span>
        <span>${w.produits} produit${w.produits > 1 ? "s" : ""}</span>
        ${w.derniereCommande
            ? `<span>dernière vente le ${echapper(new Date(w.derniereCommande).toLocaleDateString("fr-FR"))}</span>`
            : `<span class="pale">aucune vente</span>`}
      </div>
      <div class="ident">${echapper(w.id)}</div>
    </button>`;

    return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Votre poste de commandement</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--fond:#06080f;--carte:#0e1320;--bord:#1c2436;--or:#e0b341;--bleu:#5ad4ff;--texte:#e8e6df;--pale:#8a8f9e}
*{box-sizing:border-box}
body{margin:0;padding:32px 20px;background:var(--fond);color:var(--texte);font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5}
.boite{max-width:640px;margin:0 auto}
h1{font-family:Cinzel,serif;font-size:1.5rem;margin:0 0 6px;color:var(--or)}
.sous{color:var(--pale);font-size:.9rem;margin-bottom:24px}
.qg{display:block;width:100%;text-align:left;background:var(--carte);border:1px solid var(--bord);
    border-radius:12px;padding:16px 18px;margin-bottom:12px;color:inherit;font:inherit;cursor:pointer;transition:.15s}
.qg:hover{border-color:var(--bleu);transform:translateY(-1px)}
.qg.epingle{border-color:var(--or)}
.titre{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.nom{font-size:1.05rem;font-weight:600}
.etiq{font-size:.7rem;padding:2px 8px;border-radius:10px;background:#1c2436;color:var(--pale)}
.etiq.or{background:#2a2208;color:var(--or)} .etiq.rouge{background:#3a1d1d;color:#ff9b9b}
.chiffres{display:flex;gap:14px;flex-wrap:wrap;font-size:.82rem;color:var(--pale)}
.chiffres .pale{opacity:.6}
.ident{margin-top:8px;font-size:.68rem;color:#4a5268;font-family:ui-monospace,monospace;word-break:break-all}
.retenir{display:flex;align-items:center;gap:9px;margin:18px 2px 0;color:var(--pale);font-size:.88rem}
.retenir input{width:17px;height:17px;accent-color:var(--or)}
.note{margin-top:22px;color:#4a5268;font-size:.78rem}
</style></head><body>
<div class="boite">
  <h1>${changement ? "Changer de poste de commandement" : "Votre poste de commandement"}</h1>
  <p class="sous">Vous avez plusieurs QG. Choisissez celui que vous voulez ouvrir.</p>
  <form method="POST" action="/mes-qg">
    ${qg.map(carte).join("")}
    <label class="retenir">
      <input type="checkbox" name="retenir" value="oui">
      Toujours ouvrir celui-ci à la connexion
    </label>
  </form>
  <p class="note">Vous pourrez en changer à tout moment depuis cette page.</p>
</div></body></html>`;
}

module.exports = router;
