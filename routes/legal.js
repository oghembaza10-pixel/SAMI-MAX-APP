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
const MAJ_EN = "26 August 2026";

function page(titre, corps, lang = "fr") {
    return `<!DOCTYPE html>
<html lang="${lang}">
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
  <p class="maj">${lang === "en" ? "Last updated: " + MAJ_EN : "Dernière mise à jour : " + MAJ}</p>
  ${corps}
  <div class="pied">
    OG Technology — SAMII OS · <a href="mailto:${CONTACT}">${CONTACT}</a><br>
    ${lang === "en"
      ? `<a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> ·
         <a href="/data-deletion.html">Data deletion</a> · <a href="/developers">Developers</a> ·
         <a href="?lang=fr">Français</a>`
      : `<a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions</a> ·
         <a href="/suppression-des-donnees">Suppression des données</a> · <a href="/">Accueil</a> ·
         <a href="?lang=en">English</a>`}
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

// ── Les conditions de service ────────────────────────────────────────────
// Meta les réclame au même titre que la confidentialité. Volontairement
// courtes : un contrat que personne ne lit ne protège personne. Ce qui doit
// être compris tient en dix lignes.
const CONDITIONS = `
<p>En utilisant SAMII, tu acceptes ce qui suit. Si un point ne te convient pas,
écris-nous avant de t'engager — on préfère une question à un malentendu.</p>

<h2>1. Ce que fait SAMII</h2>
<p>SAMII répond à tes clients, prend tes commandes et tes rendez-vous, publie pour toi
et relie tes outils. Il agit <b>pour ton compte et sous ton contrôle</b> : tu restes
responsable de ce qui est dit et vendu en ton nom.</p>

<h2>2. Ton compte</h2>
<ul>
  <li>Tu es responsable de tes identifiants et de tes clés d'API.</li>
  <li>Une clé perdue se refait ; elle ne se relit pas. Nous n'en gardons qu'une empreinte.</li>
  <li>Un compte par entreprise. Un espace ne peut pas servir à revendre le service sans
      passer par l'offre agence.</li>
</ul>

<h2>3. Ce qui est interdit</h2>
<ul>
  <li>Envoyer des messages non sollicités en masse. WhatsApp et Meta l'interdisent, et
      c'est ton numéro qui serait suspendu, pas le nôtre.</li>
  <li>Vendre des produits illégaux, contrefaits ou dangereux.</li>
  <li>Utiliser SAMII pour tromper, harceler ou usurper l'identité de quelqu'un.</li>
  <li>Tenter de lire les données d'un autre espace que le tien.</li>
</ul>
<p>Un manquement grave entraîne la fermeture immédiate du compte, sans remboursement
de la période en cours.</p>

<h2>4. Paiement</h2>
<ul>
  <li>Les paliers sont mensuels, sans engagement de durée. Tu arrêtes quand tu veux.</li>
  <li>Certaines créations par intelligence artificielle se facturent à l'usage et
      s'ajoutent au renouvellement suivant. Le compteur est visible avant de lancer.</li>
  <li>Les tarifs peuvent changer ; un changement est annoncé 30 jours à l'avance et ne
      s'applique jamais rétroactivement.</li>
</ul>

<h2>5. Sur l'Académie</h2>
<p>Un développeur qui publie une application sur l'Académie en reste propriétaire.
OG Technology est partenaire et prélève une commission sur les transactions qui s'y
font — le taux est affiché avant l'adhésion et ne change pas pour une transaction déjà
engagée.</p>

<h2>6. Disponibilité</h2>
<p>Nous faisons tourner le service en continu, mais nous ne promettons pas
l'infaillibilité : une plateforme tierce (WhatsApp, Meta, Google) peut tomber sans que
nous puissions l'éviter. Nous ne sommes pas responsables des pertes indirectes causées
par une interruption. En cas de panne prolongée de notre fait, la période concernée est
créditée.</p>

<h2>7. Fin de la relation</h2>
<p>Tu peux fermer ton compte à tout moment. Tes données sont effacées selon
<a href="/suppression-des-donnees">la procédure de suppression</a>. Nous pouvons fermer
un compte en cas de manquement grave, ou avec un préavis de 30 jours autrement.</p>

<h2>8. Contact</h2>
<p>OG Technology — SAMII OS · <a href="mailto:${CONTACT}">${CONTACT}</a></p>
`;

// Trois adresses pour la même page : Meta, Google et les navigateurs des
// utilisateurs ne cherchent pas le même mot. Un lien mort dans un formulaire
// de validation coûte des semaines d'attente.
// Les variantes en .html sont là parce qu'elles ont DÉJÀ été saisies dans le
// tableau de bord Meta. Corriger le formulaire chez Meta plutôt que d'ajouter
// l'alias reviendrait à parier que personne n'a copié ces adresses ailleurs —
// et une URL de confidentialité morte fait échouer une validation entière,
// des semaines après, sans qu'on comprenne pourquoi. Les deux formes vivent.
// ══ VERSIONS ANGLAISES ══════════════════════════════════════════════════
// Traduites et non générées : ce sont des textes juridiques. Une phrase
// approximative sur la responsabilité ou la conservation des données ne se
// rattrape pas — elle engage. Elles disent la même chose que les versions
// françaises, ligne pour ligne.

const CONFIDENTIALITE_EN = `
<p>SAMII is an assistant that answers a merchant's customers, takes their orders and
their bookings, and manages their online presence. To do that, it processes data —
including conversations. This page says which data, why, and what we do not do with it.</p>

<div class="encadre">
  <p style="margin:0"><b>Two roles not to be confused.</b> The merchant using SAMII is the
  <b>controller</b> of their customers' data. OG Technology is their <b>processor</b>: we process
  that data on their behalf, on their instructions, and for no other purpose.</p>
</div>

<h2>1. What we collect</h2>
<table>
  <thead><tr><th>Data</th><th>Where it comes from</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>Merchant account: name, email, phone, trade, country</td><td>Their sign-up</td><td>To create and run their workspace</td></tr>
    <tr><td>Messages exchanged with their customers</td><td>WhatsApp, Telegram, Messenger, Instagram</td><td>To answer, take an order or book an appointment</td></tr>
    <tr><td>End customer's name, phone and address</td><td>The conversation itself</td><td>To deliver the order, confirm the appointment</td></tr>
    <tr><td>Orders, appointments, products</td><td>Typed in or from a conversation</td><td>The core of the service</td></tr>
    <tr><td>Email, calendar, files</td><td>Google, only if the merchant connects their account</td><td>To sort their email, place their appointments</td></tr>
    <tr><td>Pages and social accounts</td><td>Meta, if they connect them</td><td>To publish and answer comments</td></tr>
    <tr><td>Technical log: API calls, errors, timestamps</td><td>Automatic</td><td>To diagnose failures and bill on usage</td></tr>
  </tbody>
</table>

<h2>2. What we do not do</h2>
<ul>
  <li><b>We do not sell any data</b>, to anyone, under any circumstances.</li>
  <li>We do not use a merchant's conversations to train an artificial intelligence model.</li>
  <li>We do not share one merchant's data with another merchant.</li>
  <li>No message is ever sent from a sandbox: a test workspace cannot write to a real phone number.</li>
</ul>

<h2>3. Who the data passes through</h2>
<p>Running the service requires providers. Each one receives only what it needs:</p>
<ul>
  <li><b>Meta</b> (WhatsApp Business, Facebook, Instagram) — to carry messages and publish.</li>
  <li><b>Telegram</b> — to carry messages.</li>
  <li><b>Google</b> — only if the merchant connects Gmail, Calendar or Drive.</li>
  <li><b>AI providers</b> — the text of a message may be sent to them to produce an answer.
      It is not retained by them for training.</li>
  <li><b>Hosting and database</b> — storage of the service.</li>
  <li><b>Payment providers</b> — only for a subscription or a purchase. We never see a card
      number: it does not pass through our servers.</li>
</ul>

<h2>4. How long we keep it</h2>
<ul>
  <li><b>Account and workspace</b>: as long as the account exists, then 30 days after closure.</li>
  <li><b>Orders and appointments</b>: kept as long as the merchant needs them; they can delete them at any time.</li>
  <li><b>Technical logs</b>: 90 days.</li>
  <li><b>Access tokens</b> (Meta, Google): deleted as soon as the merchant disconnects that service.</li>
</ul>

<h2>5. Your rights</h2>
<p>Access, rectification, erasure, portability, objection. One address for all of it:
<a href="mailto:${CONTACT}">${CONTACT}</a>. We answer within 30 days.</p>
<p>An end customer of a merchant who wants their data deleted can ask that merchant directly,
or ask us: we pass it on and make sure it is done.
See also <a href="/data-deletion.html">the dedicated page</a>.</p>

<h2>6. Security</h2>
<ul>
  <li>All traffic is encrypted (HTTPS).</li>
  <li>API keys are stored as a fingerprint: a lost key is re-created, never read back.</li>
  <li>Sensitive tables are closed by default at the database level, not only in the code.</li>
  <li>Each workspace is isolated: a key can only read the workspace it belongs to.</li>
</ul>

<h2>7. Minors</h2>
<p>SAMII is a professional tool. It is not intended for people under 16 and we do not
knowingly collect their data.</p>

<h2>8. Changes</h2>
<p>Any change is published on this page with its date. A significant change is announced to
merchants by email before it takes effect.</p>

<h2>9. Contact us</h2>
<p>OG Technology — SAMII OS<br>
<a href="mailto:${CONTACT}">${CONTACT}</a></p>
`;

const SUPPRESSION_EN = `
<p>You can ask for your data to be deleted at any time, without giving a reason,
and at no cost.</p>

<h2>If you are a merchant</h2>
<ul>
  <li><b>Delete a specific item</b> — an order, an appointment, a product: from your HQ.
      Deletion is immediate and permanent.</li>
  <li><b>Disconnect a service</b> — WhatsApp, Meta, Google: from "My connections".
      The access token is erased immediately.</li>
  <li><b>Delete your whole account</b> — write to <a href="mailto:${CONTACT}">${CONTACT}</a>
      from your account address, with "Account deletion" as the subject. Everything is erased
      within 30 days, except what accounting law requires us to keep (invoices: 10 years).</li>
</ul>

<h2>If you are a customer of a business using SAMII</h2>
<p>Your data (name, phone, address, messages) belongs to the merchant you wrote to.
Two paths, both work:</p>
<ul>
  <li>Ask them directly — they can delete it themselves in seconds.</li>
  <li>Or write to us at <a href="mailto:${CONTACT}">${CONTACT}</a> with the name of the business
      and the phone number concerned. We pass it on and verify it was done.</li>
</ul>

<h2>If you came from Facebook or Instagram</h2>
<p>A deletion request started from your Meta account settings reaches us automatically:
we erase the data linked to that account, and Meta gives you a tracking number so you can
check where the request stands.</p>

<div class="encadre">
  <p style="margin:0"><b>What survives a deletion, and why.</b> Invoices already issued are kept
  for 10 years: accounting law requires it and we cannot depart from that. They contain no
  conversation — only an amount, a date and a company name.</p>
</div>
`;

const CONDITIONS_EN = `
<p>By using SAMII you accept the following. If something here does not suit you, write to us
before you commit — we would rather answer a question than live with a misunderstanding.</p>

<h2>1. What SAMII does</h2>
<p>SAMII answers your customers, takes your orders and your bookings, publishes for you and
connects your tools. It acts <b>on your behalf and under your control</b>: you remain
responsible for what is said and sold in your name.</p>

<h2>2. Your account</h2>
<ul>
  <li>You are responsible for your credentials and your API keys.</li>
  <li>A lost key is re-created, never read back. We keep only a fingerprint of it.</li>
  <li>One account per company. A workspace may not be used to resell the service without going
      through the agency offer.</li>
</ul>

<h2>3. What is not allowed</h2>
<ul>
  <li>Sending unsolicited bulk messages. WhatsApp and Meta forbid it, and it is your number
      that would be suspended, not ours.</li>
  <li>Selling illegal, counterfeit or dangerous goods.</li>
  <li>Using SAMII to deceive, harass or impersonate anyone.</li>
  <li>Attempting to read data from a workspace other than your own.</li>
</ul>
<p>A serious breach results in immediate closure of the account, with no refund of the
current period.</p>

<h2>4. Payment</h2>
<ul>
  <li>Plans are monthly, with no minimum term. You stop whenever you want.</li>
  <li>Some AI creations are billed on usage and added to the next renewal. The counter is
      visible before you start.</li>
  <li>Prices may change; a change is announced 30 days in advance and never applies
      retroactively.</li>
</ul>

<h2>5. About the Academy</h2>
<p>A developer who publishes an application on the Academy remains its owner. OG Technology is
a partner and takes a commission on transactions closed there — the rate is displayed before
joining and does not change for a transaction already under way.</p>

<h2>6. Availability</h2>
<p>We run the service continuously, but we do not promise infallibility: a third-party platform
(WhatsApp, Meta, Google) can go down without us being able to prevent it. We are not liable for
indirect losses caused by an interruption. In case of a prolonged outage on our side, the
affected period is credited.</p>

<h2>7. Ending the relationship</h2>
<p>You can close your account at any time. Your data is erased following
<a href="/data-deletion.html">the deletion procedure</a>. We may close an account in case of a
serious breach, or with 30 days' notice otherwise.</p>

<h2>8. Contact</h2>
<p>OG Technology — SAMII OS · <a href="mailto:${CONTACT}">${CONTACT}</a></p>
`;

// Le choix de langue vient du même endroit que pour les pages de l'Académie :
// une seule règle de détection dans tout le produit.
const langue = require("../services/langue");

function servir(req, res, titreFr, titreEn, corpsFr, corpsEn) {
    const en = langue.detecter(req) === "en";
    return res.send(page(en ? titreEn : titreFr, en ? corpsEn : corpsFr, en ? "en" : "fr"));
}

router.get(["/confidentialite", "/privacy", "/privacy.html", "/politique-de-confidentialite"], (req, res) => {
    servir(req, res, "Politique de confidentialité", "Privacy Policy", CONFIDENTIALITE, CONFIDENTIALITE_EN);
});

router.get(["/conditions", "/terms", "/terms.html", "/conditions-de-service", "/cgu"], (req, res) => {
    servir(req, res, "Conditions de service", "Terms of Service", CONDITIONS, CONDITIONS_EN);
});

router.get(["/suppression-des-donnees", "/data-deletion.html", "/suppression"], (req, res) => {
    servir(req, res, "Suppression des données", "Data Deletion", SUPPRESSION, SUPPRESSION_EN);
});

module.exports = router;
