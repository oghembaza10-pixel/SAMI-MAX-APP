// ==========================================================================
// SAMII OS — CONFIDENTIALITÉ ET SUPPRESSION DES DONNÉES
//
// POURQUOI CES PAGES EXISTENT. Meta refuse de publier une application sans URL
// de politique de confidentialité, et Google refuse de valider un accès Gmail
// ou Agenda sans elle non plus. Elles manquaient — c'est ce qui a bloqué le
// passage en production de WhatsApp.
//
// MAIS CE N'EST PAS UNE FORMALITÉ. SAMII lit les messages WhatsApp et Telegram
// des clients d'un marchand, sa boîte Gmail, son agenda. Ce sont les données
// les plus sensibles qu'une entreprise confie à un outil. Une page écrite pour
// cocher une case chez Meta et qui ne décrit pas la réalité serait pire que
// pas de page du tout : elle mentirait, par écrit, à des gens qui s'engagent.
//
// Donc elle dit exactement ce que le code fait — et rien de plus. Chaque
// affirmation ci-dessous correspond à quelque chose de vérifiable dans ce
// dépôt. Si le produit change, cette page change avec lui.
// ==========================================================================
const express = require("express");
const router = express.Router();
const CONFIG = require("../config");

const CONTACT = process.env.EMAIL_CONTACT || "info@souverain-store.com";
const MAJ = "26 août 2026";

function page(titre, corps) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre} — SAMII OS</title>
<style>
  :root { --enc:#07070a; --or:#c9a961; --ivoire:#f3f1e9; --gris:#9a9ca4; --faible:#6c6e77; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--enc); color:var(--ivoire);
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         line-height:1.75; }
  .l { max-width:780px; margin:0 auto; padding:48px 22px 90px; }
  .marque { font-family:Georgia,serif; font-size:10px; letter-spacing:.46em; text-indent:.46em;
            color:var(--or); text-transform:uppercase; margin-bottom:34px; }
  h1 { font-family:Georgia,serif; font-weight:400; font-size:clamp(1.6rem,4vw,2.2rem); margin:0 0 10px; }
  .maj { color:var(--faible); font-size:.8rem; margin:0 0 40px; }
  h2 { font-size:1rem; font-weight:650; margin:38px 0 12px; color:var(--or); }
  p, li { color:#c9ccd3; font-size:.93rem; }
  ul { padding-left:20px; } li { margin-bottom:9px; }
  a { color:var(--or); }
  table { width:100%; border-collapse:collapse; margin:14px 0; font-size:.88rem; }
  th { text-align:left; padding:9px 10px; color:var(--faible); font-weight:600; font-size:.75rem;
       text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid rgba(255,255,255,.1); }
  td { padding:11px 10px; border-bottom:1px solid rgba(255,255,255,.06); color:#c9ccd3; vertical-align:top; }
  .encadre { border:1px solid rgba(201,169,97,.25); background:rgba(201,169,97,.05);
             border-radius:8px; padding:20px 22px; margin:26px 0; }
  .pied { margin-top:52px; padding-top:22px; border-top:1px solid rgba(255,255,255,.08);
          color:var(--faible); font-size:.82rem; }
</style>
</head>
<body>
<div class="l">
  <div class="marque">O G &nbsp; T E C H N O L O G Y</div>
  <h1>${titre}</h1>
  <p class="maj">Dernière mise à jour : ${MAJ}</p>
  ${corps}
  <div class="pied">
    OG Technology — SAMII OS · <a href="mailto:${CONTACT}">${CONTACT}</a><br>
    <a href="/confidentialite">Confidentialité</a> ·
    <a href="/suppression-des-donnees">Suppression des données</a> ·
    <a href="/">Accueil</a>
  </div>
</div>
</body>
</html>`;
}

// ── La politique de confidentialité ──────────────────────────────────────
const CONFIDENTIALITE = `
<p>SAMII est un assistant qui répond aux clients d'un commerce, prend ses commandes
et ses rendez-vous, et gère sa présence en ligne. Pour cela, il traite des données —
y compris des conversations. Cette page dit lesquelles, pourquoi, et ce que nous n'en
faisons pas.</p>

<div class="encadre">
  <p style="margin:0"><b>Deux rôles à ne pas confondre.</b> Le commerçant qui utilise SAMII est
  <b>responsable</b> des données de ses clients. OG Technology est son
  <b>sous-traitant</b> : nous traitons ces données pour son compte, sur ses instructions,
  et pour aucune autre finalité.</p>
</div>

<h2>1. Ce que nous collectons</h2>
<table>
  <thead><tr><th>Donnée</th><th>D'où elle vient</th><th>Pourquoi</th></tr></thead>
  <tbody>
    <tr><td>Compte du commerçant : nom, email, téléphone, métier, pays</td><td>Son inscription</td><td>Créer et tenir son espace</td></tr>
    <tr><td>Messages échangés avec ses clients</td><td>WhatsApp, Telegram, Messenger, Instagram</td><td>Répondre, prendre une commande ou un rendez-vous</td></tr>
    <tr><td>Nom, téléphone et adresse du client final</td><td>La conversation elle-même</td><td>Livrer la commande, confirmer le rendez-vous</td></tr>
    <tr><td>Commandes, rendez-vous, produits</td><td>Saisie ou conversation</td><td>Le cœur du service</td></tr>
    <tr><td>Emails, agenda, fichiers</td><td>Google, si le commerçant connecte son compte</td><td>Trier ses emails, poser ses rendez-vous</td></tr>
    <tr><td>Pages et comptes sociaux</td><td>Meta, s'il les connecte</td><td>Publier et répondre aux commentaires</td></tr>
    <tr><td>Journal technique : appels d'API, erreurs, horodatages</td><td>Automatique</td><td>Diagnostiquer les pannes, facturer à l'usage</td></tr>
  </tbody>
</table>

<h2>2. Ce que nous ne faisons pas</h2>
<ul>
  <li><b>Nous ne vendons aucune donnée</b>, à personne, dans aucune circonstance.</li>
  <li>Nous n'utilisons pas les conversations d'un commerçant pour entraîner un modèle d'intelligence artificielle.</li>
  <li>Nous ne partageons pas les données d'un commerçant avec un autre commerçant.</li>
  <li>Nous n'envoyons aucun message depuis un espace d'essai : un terrain de test ne peut pas écrire à un vrai numéro.</li>
</ul>

<h2>3. Avec qui les données transitent</h2>
<p>Faire fonctionner le service demande des prestataires. Chacun ne reçoit que ce qui lui
est nécessaire :</p>
<ul>
  <li><b>Meta</b> (WhatsApp Business, Facebook, Instagram) — acheminer les messages et publier.</li>
  <li><b>Telegram</b> — acheminer les messages.</li>
  <li><b>Google</b> — uniquement si le commerçant connecte Gmail, Agenda ou Drive.</li>
  <li><b>Fournisseurs d'intelligence artificielle</b> — le texte d'un message peut leur être transmis
      pour produire une réponse. Il n'est pas conservé chez eux pour entraînement.</li>
  <li><b>Hébergeur et base de données</b> — stockage du service.</li>
  <li><b>Prestataires de paiement</b> — uniquement pour un abonnement ou un achat. Nous ne voyons
      jamais le numéro d'une carte bancaire : il ne passe pas par nos serveurs.</li>
</ul>

<h2>4. Combien de temps</h2>
<ul>
  <li><b>Compte et espace</b> : tant que le compte existe, puis 30 jours après sa fermeture.</li>
  <li><b>Commandes et rendez-vous</b> : conservés tant que le commerçant en a besoin ; il peut les supprimer à tout moment.</li>
  <li><b>Journaux techniques</b> : 90 jours.</li>
  <li><b>Jetons d'accès</b> (Meta, Google) : supprimés dès que le commerçant déconnecte le service concerné.</li>
</ul>

<h2>5. Tes droits</h2>
<p>Accès, rectification, effacement, portabilité, opposition. Une seule adresse pour tout :
<a href="mailto:${CONTACT}">${CONTACT}</a>. Nous répondons sous 30 jours.</p>
<p>Le client final d'un commerçant qui veut faire supprimer ses données peut s'adresser
directement à ce commerçant, ou à nous : nous transmettons et exécutons.
Voir aussi <a href="/suppression-des-donnees">la page dédiée</a>.</p>

<h2>6. Sécurité</h2>
<ul>
  <li>Tout le trafic est chiffré (HTTPS).</li>
  <li>Les clés d'API sont stockées sous forme d'empreinte : perdue, une clé se refait, elle ne se relit pas.</li>
  <li>Les tables sensibles sont fermées par défaut au niveau de la base de données, et non seulement dans le code.</li>
  <li>Chaque espace est cloisonné : une clé ne peut lire que l'espace auquel elle appartient.</li>
</ul>

<h2>7. Mineurs</h2>
<p>SAMII est un outil professionnel. Il n'est pas destiné aux personnes de moins de 16 ans
et nous ne collectons pas sciemment leurs données.</p>

<h2>8. Changements</h2>
<p>Toute modification est publiée sur cette page avec sa date. Un changement important est
annoncé aux commerçants par email avant son entrée en vigueur.</p>

<h2>9. Nous contacter</h2>
<p>OG Technology — SAMII OS<br>
<a href="mailto:${CONTACT}">${CONTACT}</a></p>
`;

// ── La suppression des données ───────────────────────────────────────────
// Meta exige une URL distincte, en clair, qu'un utilisateur peut suivre seul.
const SUPPRESSION = `
<p>Tu peux demander la suppression de tes données à tout moment, sans justification,
et sans que cela te coûte quoi que ce soit.</p>

<h2>Si tu es commerçant</h2>
<ul>
  <li><b>Supprimer une donnée précise</b> — commande, rendez-vous, produit : depuis ton QG,
      la suppression est immédiate et définitive.</li>
  <li><b>Déconnecter un service</b> — WhatsApp, Meta, Google : depuis « Mes connexions ».
      Le jeton d'accès est effacé immédiatement.</li>
  <li><b>Supprimer tout ton compte</b> — écris à <a href="mailto:${CONTACT}">${CONTACT}</a>
      depuis l'adresse de ton compte, avec « Suppression de compte » en objet.
      Tout est effacé sous 30 jours, sauf ce que la loi comptable nous oblige à garder
      (factures : 10 ans).</li>
</ul>

<h2>Si tu es client d'un commerce qui utilise SAMII</h2>
<p>Tes données (nom, téléphone, adresse, messages) appartiennent au commerçant à qui tu as
écrit. Deux chemins, les deux fonctionnent :</p>
<ul>
  <li>Demande-lui directement — il peut les supprimer lui-même en quelques secondes.</li>
  <li>Ou écris-nous à <a href="mailto:${CONTACT}">${CONTACT}</a> en indiquant le nom du
      commerce et le numéro de téléphone concerné. Nous transmettons et vérifions l'exécution.</li>
</ul>

<h2>Si tu viens de Facebook ou Instagram</h2>
<p>Une demande de suppression lancée depuis les paramètres de ton compte Meta nous parvient
automatiquement : nous effaçons les données liées à ce compte, et Meta te fournit un
numéro de suivi pour vérifier où en est la demande.</p>

<div class="encadre">
  <p style="margin:0"><b>Ce qui survit à une suppression, et pourquoi.</b> Les factures déjà émises
  sont conservées 10 ans : la loi comptable l'impose et nous ne pouvons pas y déroger.
  Elles ne contiennent aucune conversation — seulement un montant, une date et une raison sociale.</p>
</div>
`;

// Trois adresses pour la même page : Meta, Google et les navigateurs des
// utilisateurs ne cherchent pas le même mot. Un lien mort dans un formulaire
// de validation coûte des semaines d'attente.
router.get(["/confidentialite", "/privacy", "/politique-de-confidentialite"], (req, res) => {
    res.send(page("Politique de confidentialité", CONFIDENTIALITE));
});

router.get(["/suppression-des-donnees", "/data-deletion", "/suppression"], (req, res) => {
    res.send(page("Suppression des données", SUPPRESSION));
});

module.exports = router;
