// ==========================================================================
// SAMII OS — S'INSCRIRE ET SE CONNECTER CHEZ UNE PARTENAIRE
//
// POURQUOI CE FICHIER EXISTE.
// Une créatrice envoie son public sur sa communauté. Tout y est à elle : sa
// marque, ses couleurs, son application. Puis quelqu'un clique sur « Créer
// mon compte » — et tombe sur une page noire et cyan intitulée SAMII.
//
// Au milieu du parcours, la marque change. Pour le visiteur, ce n'est pas
// « ah, la technologie derrière » : c'est « je me suis trompé de site », ou
// pire, « on m'a redirigé ailleurs ». C'est exactement le moment où on
// abandonne une inscription — celui où on donne son email.
//
// CE QU'ON NE FAIT PAS : réécrire l'authentification. Les mots de passe, les
// jetons de confirmation, la régénération de session, la limitation des
// tentatives : tout ça existe et fonctionne. Le dupliquer, c'est se garantir
// deux comportements qui divergeront, et un jour une faille d'un seul côté.
//
// CE QU'ON FAIT : une page à sa marque, dont les formulaires envoient aux
// MÊMES adresses (/register et /login). Seule l'apparence change. Le jour où
// on renforce l'authentification, les deux en profitent le même jour.
//
// LE MARQUEUR `c`. Il part dans le corps du formulaire, et le slug est aussi
// posé en session à l'affichage de la page. Sans lui, le compte créé serait
// rattaché à la maison et la personne finirait dans NOTRE QG après
// inscription — le bug qu'on a déjà corrigé une fois.
// ==========================================================================
const express = require("express");
const router = express.Router();
const communautes = require("../config/communautes");

function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

// Une communauté partenaire, ou rien. La maison garde ses propres pages :
// /c/samii/inscription n'a aucune raison d'exister à côté de /register.
function partenaire(req, res) {
    const slug = req.params.slug;
    if (!communautes.existe(slug)) return null;
    const COM = communautes.get(slug);
    if (COM.slug === communautes.DEFAUT) return null;
    // La mémoire du chemin de retour : c'est elle qui ramène la personne
    // chez elle après l'inscription, au lieu de la laisser dans notre QG.
    if (req.session) req.session.communaute = COM.slug;
    return COM;
}

// ── LE GABARIT COMMUN ───────────────────────────────────────────────────
function page(COM, { titre, sousTitre, corps, bas }) {
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(titre)} — ${escapeHtml(COM.nom)}</title>
<meta name="robots" content="noindex">
<link rel="manifest" href="/c/${COM.slug}/manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#03060b;--panel:rgba(9,18,29,.88);--text:#f5fbff;--muted:#7f96a8;
      --blue:#00d9ff;--blue-2:#0077ff;--gold:#d7b34c;--border:rgba(0,217,255,.16);
      --sur-accent:#001018;--creux:rgba(0,0,0,.22);}
/* Sa palette, posée APRÈS : à spécificité égale, c'est la dernière règle
   qui gagne. Écrite avant, elle serait silencieusement écrasée. */
:root{${communautes.styleDe(COM)}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
     padding:26px 18px;background:var(--bg);color:var(--text);
     font:15px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
     -webkit-font-smoothing:antialiased}
.boite{width:100%;max-width:430px}
.marque{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:22px}
.sigle{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;
       background:linear-gradient(135deg,var(--blue),var(--gold));color:var(--sur-accent);
       font-weight:800;font-size:15px;flex:none}
.marque b{font-size:16px;letter-spacing:.02em}
.carte{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:26px 22px}
h1{font-size:21px;margin:0 0 6px;text-align:center}
.sous{color:var(--muted);font-size:13.5px;text-align:center;margin:0 0 22px;line-height:1.6}
label{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;
      color:var(--muted);margin:14px 0 6px;font-weight:600}
input{width:100%;padding:12px 13px;border-radius:11px;border:1px solid var(--border);
      background:var(--creux);color:var(--text);font:inherit;font-size:14px;outline:none}
input:focus{border-color:var(--blue)}
.duo{display:flex;gap:10px}.duo>div{flex:1}
.roles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.role{position:relative;cursor:pointer}
.role input{position:absolute;opacity:0;pointer-events:none}
/* Les cartes de choix sont des <label> : sans ça elles héritaient des
   majuscules et de l'interlettrage des étiquettes de champ, et « Découvrir /
   lire, acheter » se lisait comme un titre administratif. */
.role span{display:block;padding:13px 12px;border:1px solid var(--border);border-radius:12px;
           text-align:center;font-size:13px;font-weight:600;transition:.15s;
           text-transform:none;letter-spacing:0;color:var(--text)}
.role small{display:block;font-weight:400;font-size:11px;color:var(--muted);margin-top:3px}
.role input:checked+span{border-color:var(--blue);background:var(--creux)}
button{width:100%;margin-top:20px;padding:14px;border:0;border-radius:12px;cursor:pointer;
       background:linear-gradient(135deg,var(--blue),var(--gold));color:var(--sur-accent);
       font:inherit;font-weight:800;font-size:14.5px}
button:disabled{opacity:.6;cursor:default}
.msg{min-height:20px;margin-top:12px;text-align:center;font-size:13px;color:#ff8fa3}
.msg.ok{color:var(--gold)}
.pied{text-align:center;margin-top:18px;font-size:13px;color:var(--muted)}
.pied a{color:var(--blue);text-decoration:none;font-weight:600}
.retour{display:block;text-align:center;margin-top:16px;color:var(--muted);
        font-size:12.5px;text-decoration:none}
.retour:hover{color:var(--text)}
.note{margin-top:16px;padding:12px 13px;border:1px solid var(--border);border-radius:11px;
      background:var(--creux);color:var(--muted);font-size:11.5px;line-height:1.6}
</style>
</head>
<body>
<div class="boite">
  <div class="marque">
    <span class="sigle">${escapeHtml(COM.sigle)}</span>
    <b>${escapeHtml(COM.marque)} ${escapeHtml(COM.marqueSuite)}</b>
  </div>
  <div class="carte">
    <h1>${escapeHtml(titre)}</h1>
    <p class="sous">${sousTitre}</p>
    ${corps}
    <div class="msg" id="msg"></div>
  </div>
  <p class="pied">${bas}</p>
  <a class="retour" href="/c/${COM.slug}">← Revenir à ${escapeHtml(COM.nom)}</a>
</div>
</body>
</html>`;
}

// Le script partagé par les deux formulaires. Il suit la redirection que
// l'API renvoie : c'est elle qui sait où la personne doit atterrir — chez
// elle, jamais chez nous.
function scriptEnvoi(action, slug) {
    return `<script>
document.getElementById("f").addEventListener("submit", async function (e) {
    e.preventDefault();
    const bouton = this.querySelector("button");
    const msg = document.getElementById("msg");
    const donnees = Object.fromEntries(new FormData(this).entries());
    donnees.c = ${JSON.stringify(slug)};
    bouton.disabled = true; msg.className = "msg"; msg.textContent = "Un instant…";
    try {
        const r = await fetch(${JSON.stringify(action)}, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(donnees),
        });
        const d = await r.json();
        if (d.success) {
            msg.className = "msg ok";
            msg.textContent = "C'est bon — on t'emmène.";
            window.location.href = d.redirect || ${JSON.stringify("/c/" + slug)};
            return;
        }
        msg.textContent = d.error || "Quelque chose n'a pas fonctionné.";
    } catch (err) {
        msg.textContent = "Connexion perdue. Réessaie dans un instant.";
    }
    bouton.disabled = false;
});
</script>`;
}

// ── S'INSCRIRE ──────────────────────────────────────────────────────────
router.get("/:slug/inscription", (req, res) => {
    const COM = partenaire(req, res);
    if (!COM) return res.status(404).send("Introuvable.");

    const corps = `
    <form id="f" autocomplete="on">
      <div class="duo">
        <div><label for="prenom">Prénom</label><input id="prenom" name="prenom" required autocomplete="given-name"></div>
        <div><label for="nom">Nom</label><input id="nom" name="nom" autocomplete="family-name"></div>
      </div>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email">
      <label for="telephone">WhatsApp <span style="text-transform:none;letter-spacing:0">— facultatif</span></label>
      <input id="telephone" name="telephone" type="tel" autocomplete="tel" placeholder="+237…">
      <label for="password">Mot de passe</label>
      <input id="password" name="password" type="password" required minlength="6" autocomplete="new-password">

      <label>Tu viens pour…</label>
      <div class="roles">
        <label class="role">
          <input type="radio" name="type_compte" value="client" checked>
          <span>Découvrir<small>lire, acheter</small></span>
        </label>
        <label class="role">
          <input type="radio" name="type_compte" value="marchand">
          <span>Vendre<small>ouvrir ma boutique</small></span>
        </label>
      </div>

      <button type="submit">Créer mon compte</button>
    </form>
    <div class="note">Ton compte est actif tout de suite. L'email de confirmation
    sert à récupérer ton accès si tu perds ton mot de passe.</div>
    ${scriptEnvoi("/register", COM.slug)}`;

    res.send(page(COM, {
        titre: "Créer ton compte",
        sousTitre: `Trente secondes, et tu peux publier, commenter et acheter sur ${escapeHtml(COM.nom)}.`,
        corps,
        bas: `Tu as déjà un compte ? <a href="/c/${COM.slug}/connexion">Se connecter</a>`,
    }));
});

// ── SE CONNECTER ────────────────────────────────────────────────────────
router.get("/:slug/connexion", (req, res) => {
    const COM = partenaire(req, res);
    if (!COM) return res.status(404).send("Introuvable.");

    const corps = `
    <form id="f" autocomplete="on">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email">
      <label for="password">Mot de passe</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">
      <button type="submit">Se connecter</button>
    </form>
    ${scriptEnvoi("/login", COM.slug)}`;

    res.send(page(COM, {
        titre: "Content de te revoir",
        sousTitre: `Connecte-toi pour publier et retrouver tes achats.`,
        corps,
        bas: `Pas encore de compte ? <a href="/c/${COM.slug}/inscription">En créer un</a>`,
    }));
});

module.exports = router;
