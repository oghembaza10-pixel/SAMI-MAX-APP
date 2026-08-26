// ==========================================================================
// SAMII OS — THE ENGLISH DEVELOPER & PARTNER PAGE
//
// POURQUOI ELLE EXISTE, ET POURQUOI EN ANGLAIS SEULEMENT.
//
// Les partenaires qui arrivent — Mexique, Nigeria — ne lisent pas le français.
// Leur envoyer /academy/construire, c'est leur envoyer un mur. Et traduire les
// pages existantes au moment d'un rendez-vous, c'est risquer de casser ce qui
// marche une heure avant de le montrer.
//
// Donc une page séparée, autonome, qui ne touche à rien. Elle dit la même
// chose que la version française, mais pour quelqu'un qui décide s'il devient
// partenaire — pas pour un développeur qui cherche sa clé d'API.
//
// CE QU'ELLE NE FAIT PAS. Elle ne promet rien qui n'existe pas. Chaque
// affirmation correspond à quelque chose de livré : l'API et ses permissions,
// le bac à sable, la place des besoins, la commission de l'Académie, le statut
// de fournisseur de technologie vérifié par Meta. Ce qui n'est pas fini n'y
// figure pas — un partenaire qui découvre un écart après signature ne revient
// jamais.
// ==========================================================================
const express = require("express");
const router = express.Router();
const academie = require("../config/academie");

const TAUX = Math.round(academie.TAUX_COMMISSION * 100);
const CONTACT = process.env.EMAIL_CONTACT || "info@souverain-store.com";

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Build with SAMII — Partners & Developers</title>
<style>
  :root { --ink:#07070a; --pan:#101013; --pan2:#16161a; --gold:#c9a961; --gold-l:#f0d99b;
          --ivory:#f3f1e9; --grey:#9a9ca4; --faint:#6c6e77; --cyan:#5fd4ff; --green:#3ddc84; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ink); color:var(--ivory); line-height:1.7;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .w { max-width:860px; margin:0 auto; padding:46px 22px 90px; }
  .brand { font-family:Georgia,serif; font-size:10px; letter-spacing:.46em; text-indent:.46em;
           color:var(--gold); text-transform:uppercase; margin-bottom:30px; }
  h1 { font-family:Georgia,serif; font-weight:400; font-size:clamp(1.7rem,4.5vw,2.4rem); margin:0 0 14px; }
  .lead { color:var(--grey); font-size:1rem; margin:0 0 12px; }
  h2 { font-size:.76rem; letter-spacing:.16em; text-transform:uppercase; color:var(--gold);
       font-weight:650; margin:46px 0 14px; }
  h3 { font-size:.98rem; font-weight:650; margin:24px 0 6px; }
  p, li { color:#c9ccd3; font-size:.93rem; }
  ul { padding-left:20px; } li { margin-bottom:8px; }
  a { color:var(--gold); }
  .badge { display:inline-block; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase;
           padding:5px 12px; border-radius:20px; border:1px solid rgba(61,220,132,.35);
           color:var(--green); margin-bottom:22px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin-top:16px; }
  .card { border:1px solid rgba(255,255,255,.09); border-radius:10px; padding:22px 20px;
          background:linear-gradient(180deg,var(--pan2),var(--pan)); }
  .card h3 { margin-top:0; }
  .card .tag { font-family:ui-monospace,monospace; font-size:.66rem; letter-spacing:.1em;
               text-transform:uppercase; color:var(--faint); display:block; margin-bottom:9px; }
  .box { border:1px solid rgba(201,169,97,.28); background:rgba(201,169,97,.05);
         border-radius:10px; padding:22px 24px; margin:26px 0; }
  .box p { margin:0; }
  table { width:100%; border-collapse:collapse; margin:14px 0; font-size:.88rem; }
  th { text-align:left; padding:9px 10px; color:var(--faint); font-weight:600; font-size:.72rem;
       text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid rgba(255,255,255,.1); }
  td { padding:11px 10px; border-bottom:1px solid rgba(255,255,255,.06); vertical-align:top; color:#c9ccd3; }
  .foot { margin-top:56px; padding-top:22px; border-top:1px solid rgba(255,255,255,.08);
          color:var(--faint); font-size:.84rem; }
  .cta { display:inline-block; margin-top:8px; padding:13px 28px; background:var(--gold); color:#07070a;
         border-radius:5px; text-decoration:none; font-weight:700; font-size:.78rem;
         letter-spacing:.06em; text-transform:uppercase; }
  .cta:hover { background:var(--gold-l); }
</style>
</head>
<body>
<div class="w">
  <div class="brand">O G &nbsp; T E C H N O L O G Y</div>
  <span class="badge">✅ Meta-verified Tech Provider</span>

  <h1>Build with SAMII</h1>
  <p class="lead">SAMII is not another WhatsApp chatbot. It is an operational AI headquarters that
  connects WhatsApp, Instagram, Messenger, Telegram, Gmail, Calendar, orders and appointments
  into one place — and acts on them.</p>
  <p class="lead">This page is for partners and developers: agencies, integrators, and anyone
  who wants to build on top of it or resell it.</p>

  <h2>Two ways to work with us</h2>
  <div class="cards">
    <div class="card">
      <span class="tag">Option 1</span>
      <h3>As an agency or integrator</h3>
      <p>You resell SAMII to your clients. Each client gets their own headquarters; you manage
      them all from one place and keep the relationship and the margin. You build nothing —
      we run and maintain the system.</p>
    </div>
    <div class="card">
      <span class="tag">Option 2</span>
      <h3>As a developer, on our API</h3>
      <p>You build your own application on top of SAMII. Your existing Meta and n8n
      infrastructure stays exactly as it is — SAMII sits above it as the operational
      intelligence layer. We only earn when you earn.</p>
    </div>
  </div>

  <h2>What is already live</h2>
  <table>
    <thead><tr><th>Capability</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>WhatsApp Business — Meta Cloud API, 360dialog, Green API</td><td>Live</td></tr>
      <tr><td>Telegram — full order &amp; appointment flow</td><td>Live</td></tr>
      <tr><td>Facebook &amp; Messenger — auto-reply and publishing</td><td>Live</td></tr>
      <tr><td>Real-time headquarters — orders and bookings appear instantly</td><td>Live</td></tr>
      <tr><td>Gmail, Google Calendar, Google Drive</td><td>Live</td></tr>
      <tr><td>AI content studio — scripts, images, video, direct publishing</td><td>Live</td></tr>
      <tr><td>Voice messages — transcribed and understood</td><td>Live</td></tr>
      <tr><td>Partner API — scoped keys, webhooks, access log</td><td>Live</td></tr>
      <tr><td>Instagram publishing</td><td>Pending Meta review</td></tr>
    </tbody>
  </table>

  <h2>The developer space</h2>

  <h3>A sandbox that is already alive</h3>
  <p>One click gives you a complete workspace with real customers, orders at every stage, and
  past and future appointments. Your first API call returns something meaningful within a
  minute. Nothing ever leaves a sandbox — no message can reach a real phone number.</p>

  <h3>Your key, and a call that answers</h3>
  <p>The example request is written with <em>your</em> key and <em>your</em> workspace, ready to
  paste. Not a generic snippet to adapt.</p>

  <h3>What your keys actually did</h3>
  <p>The blind spot of every large developer portal: they show you the configuration, never the
  work. Here you see every call your keys made — including the ones that were refused, and why.
  That is where a broken integration explains itself.</p>

  <h3>Work waiting for you</h3>
  <p>Merchants post what they need, with a budget. Developers answer with a price and a
  timeline. Publishing a need costs nothing; answering costs nothing.</p>

  <h2>Three rules that will not change</h2>
  <ul>
    <li><b>Your app does not choose its own rights.</b> It requests scopes; the merchant grants them.</li>
    <li><b>The merchant can revoke at any time</b>, without asking us.</li>
    <li><b>One installation, one workspace.</b> A key can never read another merchant's data.</li>
  </ul>

  <div class="box">
    <p><b>And the money.</b> Entering costs nothing. Publishing costs nothing. Installing costs
    nothing. SAMII takes ${TAUX}% the day you get paid — and nothing before. You keep ownership
    of everything you build.</p>
  </div>

  <h2>Why here</h2>
  <ul>
    <li><b>The merchants are already here.</b> You are not launching into an empty marketplace.</li>
    <li><b>The infrastructure is done</b> — channels, AI, payments, delivery tracking, real-time dashboard.</li>
    <li><b>Meta-verified Tech Provider.</b> Your clients connect their own WhatsApp number and keep
        their own brand. We provide the intelligence layer.</li>
  </ul>

  <h2>Talk to us</h2>
  <p>We work with a small number of technology partners per region.
  <a href="mailto:${CONTACT}">${CONTACT}</a></p>
  <a class="cta" href="mailto:${CONTACT}">Get in touch →</a>

  <div class="foot">
    OG Technology — SAMII OS ·
    <a href="/privacy.html">Privacy</a> ·
    <a href="/terms.html">Terms</a> ·
    <a href="/academy">Marketplace (FR)</a>
  </div>
</div>
</body>
</html>`;

// Trois adresses : celle qu'on envoie par email, celle qu'un partenaire devine,
// et l'équivalent anglais de /academy/construire.
router.get(["/developers", "/partners", "/academy/build"], (req, res) => {
    res.send(PAGE);
});

module.exports = router;
