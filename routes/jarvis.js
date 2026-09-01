// ==========================================================================
// SAMII JARVIS — la bulle de cristal
//
// « Je veux une page spéciale. Une grosse bulle de cristal qui parle avec
//   moi. Qu'il m'explique ce qui s'est passé, et qu'on puisse discuter. »
//
// ── CE QUE CETTE PAGE N'EST PAS ─────────────────────────────────────────
//
// Ce n'est PAS un deuxième SAMII. Elle n'a pas son cerveau, pas sa mémoire,
// pas ses règles. Elle envoie du texte à `POST /api/chat` — exactement la
// même route que le chat écrit — et lit la réponse à voix haute.
//
// C'est la décision qui compte dans tout ce chantier. Une page vocale avec
// sa propre route aurait sa propre mémoire, son propre quota, ses propres
// outils : deux SAMII qui divergent, et le jour où on ajoute un outil au
// planner, la voix ne l'aurait pas. Ici la voix est une PEAU, pas un
// cerveau.
//
//   micro → /api/chat/transcribe (Groq Whisper, déjà en place)
//         → /api/chat            (brain/planner, mémoire, quota)
//         → VoixSortie           (Kokoro, sinon navigateur)
//
// ── POURQUOI /jarvis ET PAS /samii/jarvis ───────────────────────────────
//
// Le module `assistant` (qui possède /samii) est dans MINIMAL : les membres
// d'une communauté partenaire l'ont. Ranger cette page sous /samii l'aurait
// donc ouverte chez elles par simple préfixe — or elle raconte l'activité
// d'un compte et, pour le fondateur, celle de toute la plateforme.
//
// Elle a donc son propre chemin et son propre module, absent de MINIMAL :
// fermé par défaut chez les partenaires, ouvrable un jour en une ligne.
// ==========================================================================
const express = require("express");
const router = express.Router();
const communautes = require("../config/communautes");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login?suite=/jarvis");
    next();
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

router.get("/", requireAuth, (req, res) => {
    const COM = res.locals?.COM || communautes.get(communautes.DEFAUT);
    const assistant = escapeHtml(COM.assistant || "SAMII");
    // Le prénom vient de la session, posée à la connexion. On ne le demande
    // pas à la page : un prénom lu depuis le navigateur, c'est SAMII qui
    // salue quelqu'un d'autre.
    const prenom = escapeHtml(String(req.session?.nom || "").trim().split(" ")[0] || "");
    const salut = prenom ? `Bonjour ${prenom}.` : "Bonjour.";

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${assistant} JARVIS</title>
<style>
:root{
    --fond:#04060d; --fond2:#080c18;
    --or:#C5A059; --bleu:#5ad4ff; --violet:#8b7dff;
    --texte:#e8e6df; --doux:#8a8f9e;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{
    background:radial-gradient(ellipse at 50% 30%,#0d1428 0%,var(--fond) 60%);
    color:var(--texte); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
    min-height:100vh; display:flex; flex-direction:column; align-items:center;
    padding:20px 16px 32px; overflow-x:hidden;
}

/* ── L'EN-TÊTE ───────────────────────────────────────────────────── */
.entete{width:100%;max-width:760px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}
.entete a{color:var(--doux);text-decoration:none;font-size:.82rem;}
.entete a:hover{color:var(--or);}
.marque{font-size:.78rem;letter-spacing:.22em;color:var(--doux);text-transform:uppercase;}
.marque b{color:var(--or);font-weight:700;}

/* ── LA BULLE DE CRISTAL ─────────────────────────────────────────── */
/* Trois couches superposees : le halo qui respire, la sphere elle-meme,
   et le reflet. Tout est en CSS — pas d'image, pas de bibliotheque 3D :
   une sphere en WebGL couterait 200 Ko et une batterie de telephone. */
.scene{position:relative;width:min(72vw,300px);height:min(72vw,300px);margin:22px 0 10px;display:grid;place-items:center;}

.halo{
    position:absolute;inset:-18%;border-radius:50%;
    background:radial-gradient(circle,rgba(90,212,255,.22) 0%,rgba(139,125,255,.10) 45%,transparent 70%);
    filter:blur(14px); animation:respire 5s ease-in-out infinite;
}
@keyframes respire{0%,100%{transform:scale(1);opacity:.75;}50%{transform:scale(1.09);opacity:1;}}

.bulle{
    position:relative;width:100%;height:100%;border-radius:50%;
    background:
        radial-gradient(circle at 32% 28%,rgba(255,255,255,.55) 0%,rgba(255,255,255,.06) 18%,transparent 34%),
        radial-gradient(circle at 68% 74%,rgba(139,125,255,.42) 0%,transparent 52%),
        radial-gradient(circle at 50% 50%,rgba(90,212,255,.26) 0%,rgba(12,18,38,.92) 68%);
    box-shadow:
        inset 0 0 60px rgba(90,212,255,.28),
        inset 0 -24px 60px rgba(139,125,255,.20),
        0 0 70px rgba(90,212,255,.30),
        0 18px 60px rgba(0,0,0,.65);
    border:1px solid rgba(255,255,255,.10);
    transition:box-shadow .5s ease, transform .5s ease;
    animation:flotte 7s ease-in-out infinite;
}
@keyframes flotte{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}

/* Les etats. Chacun a SA couleur et SA vitesse : on doit pouvoir savoir
   ce qui se passe d'un coup d'oeil, de l'autre bout de la piece, sans lire. */
.bulle.ecoute{
    box-shadow:inset 0 0 70px rgba(90,212,255,.55),0 0 110px rgba(90,212,255,.55),0 18px 60px rgba(0,0,0,.65);
    animation:flotte 7s ease-in-out infinite, pulse 1.1s ease-in-out infinite;
}
.bulle.reflechit{
    box-shadow:inset 0 0 70px rgba(197,160,89,.45),0 0 100px rgba(197,160,89,.42),0 18px 60px rgba(0,0,0,.65);
    animation:flotte 7s ease-in-out infinite, tourne 2.6s linear infinite;
}
.bulle.parle{
    box-shadow:inset 0 0 80px rgba(139,125,255,.60),0 0 130px rgba(139,125,255,.55),0 18px 60px rgba(0,0,0,.65);
    animation:flotte 7s ease-in-out infinite, pulse .58s ease-in-out infinite;
}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.045);}}
@keyframes tourne{0%{filter:hue-rotate(0deg);}100%{filter:hue-rotate(360deg);}}

/* Les anneaux : visibles seulement quand il se passe quelque chose. */
.anneau{position:absolute;inset:-6%;border-radius:50%;border:1px solid rgba(90,212,255,.35);opacity:0;transition:opacity .4s;}
.anneau.b{inset:-14%;border-color:rgba(139,125,255,.28);animation-delay:.5s;}
.scene.actif .anneau{opacity:1;animation:onde 2.4s ease-out infinite;}
@keyframes onde{0%{transform:scale(.92);opacity:.55;}100%{transform:scale(1.22);opacity:0;}}

/* Le coeur : le nom, grave dans le verre. Les DEUX PREMIERES LETTRES ont
   ete essayees d'abord — « SA » avec de l'espacement se lit « S A », ce qui
   ne veut rien dire. Le nom entier, petit et discret, se lit. */
.coeur{position:absolute;inset:0;display:grid;place-items:center;font-size:.86rem;letter-spacing:.42em;
    color:rgba(255,255,255,.5);text-shadow:0 0 20px rgba(90,212,255,.7);pointer-events:none;
    padding-left:.42em; font-weight:300; text-transform:uppercase;}

/* ── L'ÉTAT, EN TOUTES LETTRES ───────────────────────────────────── */
/* La couleur seule ne suffit pas : elle ne dit rien a qui ne la distingue
   pas, et rien du tout a un lecteur d'ecran. */
.etat{min-height:24px;font-size:.86rem;color:var(--doux);letter-spacing:.04em;text-align:center;margin-bottom:6px;}
.etat b{color:var(--bleu);font-weight:600;}

/* ── LES BOUTONS ─────────────────────────────────────────────────── */
.commandes{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;margin:8px 0 18px;}
.bouton{
    display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.05);color:var(--texte);border-radius:999px;
    padding:11px 20px;font-size:.9rem;cursor:pointer;transition:.2s;font-family:inherit;
}
.bouton:hover{background:rgba(255,255,255,.10);border-color:rgba(90,212,255,.5);}
.bouton:disabled{opacity:.4;cursor:not-allowed;}
.bouton.principal{background:linear-gradient(135deg,rgba(90,212,255,.22),rgba(139,125,255,.22));border-color:rgba(90,212,255,.45);font-weight:600;}
.bouton.actif{background:rgba(90,212,255,.28);border-color:var(--bleu);color:#fff;}

/* ── LA CONVERSATION ─────────────────────────────────────────────── */
.fil{width:100%;max-width:760px;display:flex;flex-direction:column;gap:12px;}
.tour{padding:13px 16px;border-radius:14px;font-size:.94rem;line-height:1.6;max-width:88%;white-space:pre-wrap;word-break:break-word;}
.tour.moi{align-self:flex-end;background:rgba(90,212,255,.14);border:1px solid rgba(90,212,255,.24);border-bottom-right-radius:4px;}
.tour.lui{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-bottom-left-radius:4px;}
.tour.lui b{color:var(--or);}

.suggestions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;max-width:760px;}
.suggestion{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);color:var(--doux);
    border-radius:999px;padding:8px 14px;font-size:.8rem;cursor:pointer;transition:.2s;font-family:inherit;}
.suggestion:hover{color:var(--texte);border-color:rgba(90,212,255,.4);}

.saisie{width:100%;max-width:760px;display:flex;gap:8px;margin-top:16px;}
.saisie input{
    flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
    border-radius:999px;padding:13px 18px;color:var(--texte);font-size:.94rem;font-family:inherit;
}
.saisie input:focus{outline:none;border-color:rgba(90,212,255,.55);}

.note{max-width:760px;font-size:.74rem;color:#5d6474;text-align:center;margin-top:22px;line-height:1.6;}

@media (prefers-reduced-motion: reduce){
    .halo,.bulle,.anneau{animation:none !important;}
}
</style>
</head>
<body>

<div class="entete">
    <a href="/samii">&larr; Chat écrit</a>
    <span class="marque"><b>${assistant}</b> Jarvis</span>
    <a href="/qg">Mon QG</a>
</div>

<div class="scene" id="scene">
    <div class="halo"></div>
    <div class="anneau"></div>
    <div class="anneau b"></div>
    <div class="bulle" id="bulle"></div>
    <div class="coeur">${assistant}</div>
</div>

<p class="etat" id="etat" aria-live="polite">${salut} Touche la bulle et parle-moi.</p>

<div class="commandes">
    <button class="bouton principal" id="btn-micro">🎙️ Parler</button>
    <button class="bouton" id="btn-voix" title="Activer ou couper la voix">🔇 Voix coupée</button>
    <button class="bouton" id="btn-stop" style="display:none">⏹ Stop</button>
</div>

<div class="suggestions" id="suggestions">
    <button class="suggestion">Qu'est-ce qui s'est passé aujourd'hui ?</button>
    <button class="suggestion">Montre-moi les problèmes prioritaires.</button>
    <button class="suggestion">Qu'est-ce que tu me conseilles de faire ?</button>
</div>

<div class="fil" id="fil"></div>

<form class="saisie" id="saisie">
    <input id="champ" placeholder="…ou écris-moi." autocomplete="off">
    <button class="bouton" type="submit">Envoyer</button>
</form>

<p class="note">
    Tout ce que tu dis passe par le même ${assistant} que le chat écrit :
    même mémoire, mêmes outils.<br>
    La voix est générée sur ton appareil — rien n'est envoyé à un service vocal payant.
</p>

<script src="/js/voix-sortie.js"></script>
<script>
(function () {
    "use strict";
    var bulle = document.getElementById("bulle");
    var scene = document.getElementById("scene");
    var etat  = document.getElementById("etat");
    var fil   = document.getElementById("fil");
    var champ = document.getElementById("champ");
    var btnMicro = document.getElementById("btn-micro");
    var btnVoix  = document.getElementById("btn-voix");
    var btnStop  = document.getElementById("btn-stop");

    // Un seul endroit change l'apparence de la bulle. Quand deux endroits
    // le font, la bulle reste allumee en bleu apres une erreur reseau et
    // on croit que l'assistant ecoute encore.
    function poser(nom, texte) {
        bulle.className = "bulle" + (nom ? " " + nom : "");
        scene.className = "scene" + (nom ? " actif" : "");
        if (texte) etat.innerHTML = texte;
    }

    function ajouter(qui, texte) {
        var d = document.createElement("div");
        d.className = "tour " + qui;
        d.textContent = texte;
        fil.appendChild(d);
        d.scrollIntoView({ behavior: "smooth", block: "end" });
        return d;
    }

    // ── LA VOIX ─────────────────────────────────────────────────────
    // Coupee au depart, et c'est deliberé : une page qui se met a parler
    // toute seule quand on l'ouvre au bureau, on la referme.
    btnVoix.addEventListener("click", function () {
        if (window.VoixSortie.estActive()) {
            window.VoixSortie.desactiver();
            btnVoix.textContent = "🔇 Voix coupée";
            btnVoix.classList.remove("actif");
        } else {
            window.VoixSortie.activer();
            btnVoix.textContent = "🔊 Voix active";
            btnVoix.classList.add("actif");
            // ON PARLE TOUT DE SUITE, et ce n'est pas de la coquetterie :
            // sans ce mot, « la voix ne marche pas » et « il ne repond pas »
            // se ressemblent exactement. Ici, le clic prouve la chaine
            // audio en une seconde, independamment du cerveau.
            window.VoixSortie.parler("Je t'écoute.").then(function (ok) {
                if (!ok) {
                    poser("", "La voix ne sort pas sur cet appareil. Vérifie le volume et l'onglet.");
                }
            });
        }
    });

    window.VoixSortie.surEvenement(function (evenement) {
        if (evenement === "parle-debut") { poser("parle", "<b>" + "${assistant}" + " parle…</b>"); btnStop.style.display = ""; }
        if (evenement === "parle-fin")   { poser("", "Je t'écoute."); btnStop.style.display = "none"; }
        if (evenement === "voix-prete")  { btnVoix.textContent = "🔊 Voix active"; }
    });

    btnStop.addEventListener("click", function () {
        window.VoixSortie.stop();
        poser("", "Je t'écoute.");
        btnStop.style.display = "none";
    });

    // ── ENVOYER AU CERVEAU ──────────────────────────────────────────
    var enCours = false;
    async function envoyer(texte) {
        if (!texte || enCours) return;
        enCours = true;
        ajouter("moi", texte);
        champ.value = "";
        poser("reflechit", "<b>${assistant} réfléchit…</b>");

        // ── POURQUOI UN DELAI D'ATTENTE, ET POURQUOI IL EST VISIBLE ────
        //
        // Premiere version : aucun delai. Une requete qui ne revenait jamais
        // laissait la bulle tourner en or pour l'eternite, sans un mot. Vu
        // de l'exterieur, ca ne se distingue pas d'une page morte — et c'est
        // exactement ce qui s'est passe : « il parle pas, il repond pas ».
        //
        // La chaine derriere /api/chat peut etre longue : 17 cles Gemini en
        // rotation, deux nouvelles tentatives espacees, puis Groq, puis
        // OpenRouter, puis DeepSeek. Une minute est possible. Ce qui n'est
        // pas acceptable, c'est le silence pendant cette minute.
        var horloge = null;
        var abandon = new AbortController();
        var depart = Date.now();
        var minuteur = setInterval(function () {
            var s = Math.round((Date.now() - depart) / 1000);
            if (s >= 8) poser("reflechit", "<b>${assistant} cherche…</b> " + s + " s");
        }, 1000);
        horloge = setTimeout(function () { abandon.abort(); }, 45000);

        try {
            var rep = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: texte, page: "jarvis" }),
                signal: abandon.signal
            });

            // Le corps n'est pas toujours du JSON : un proxy, une limite de
            // debit ou une page d'erreur renvoient du HTML. Lire d'abord le
            // texte permet de DIRE ce qui s'est passe au lieu de tomber dans
            // un « erreur reseau » qui n'explique rien.
            var brut = await rep.text();
            var data = null;
            try { data = JSON.parse(brut); } catch (e) { data = null; }

            if (!data) {
                ajouter("lui", "Le serveur a répondu " + rep.status
                    + ", mais pas en JSON. Voici le début de sa réponse : "
                    + brut.slice(0, 160));
                poser("", "Réponse inattendue du serveur.");
                return;
            }
            if (!rep.ok) {
                ajouter("lui", "Le serveur a refusé (" + rep.status + ") : "
                    + (data.error || data.reply || "sans explication."));
                poser("", "Refus du serveur (" + rep.status + ").");
                return;
            }

            var reponse = data.reply || "Je n'ai pas de réponse pour le moment.";
            ajouter("lui", reponse);
            poser("", "Je t'écoute.");
            // On parle APRES avoir affiche : si la voix echoue, le texte
            // est deja la. L'inverse laisserait un ecran vide en cas de
            // pepin audio.
            window.VoixSortie.parler(reponse);
        } catch (err) {
            if (err.name === "AbortError") {
                ajouter("lui", "Je n'ai pas eu de réponse au bout de 45 secondes. "
                    + "Le moteur est saturé ou une clé est à bout de quota. Réessaie.");
                poser("", "Aucune réponse en 45 s.");
            } else {
                ajouter("lui", "Je n'ai pas réussi à joindre le serveur — " + err.message);
                poser("", "Connexion perdue.");
            }
        } finally {
            clearInterval(minuteur);
            clearTimeout(horloge);
            enCours = false;
        }
    }

    document.getElementById("saisie").addEventListener("submit", function (e) {
        e.preventDefault();
        envoyer(champ.value.trim());
    });

    document.getElementById("suggestions").addEventListener("click", function (e) {
        if (e.target.classList.contains("suggestion")) envoyer(e.target.textContent.trim());
    });

    // ── LE MICRO ────────────────────────────────────────────────────
    // Meme chaine que le chat ecrit : on enregistre, on envoie a
    // /api/chat/transcribe (Groq Whisper), on recupere du texte. On ne
    // duplique pas la transcription, on l'appelle.
    var enregistreur = null, morceaux = [], enregistre = false;

    async function commencer() {
        var flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        morceaux = [];
        enregistreur = new MediaRecorder(flux);
        enregistreur.addEventListener("dataavailable", function (e) { if (e.data.size) morceaux.push(e.data); });
        enregistreur.addEventListener("stop", async function () {
            flux.getTracks().forEach(function (t) { t.stop(); });
            poser("reflechit", "<b>Je transcris…</b>");
            var forme = new FormData();
            forme.append("audio", new Blob(morceaux, { type: enregistreur.mimeType || "audio/webm" }), "audio.webm");
            try {
                var r = await fetch("/api/chat/transcribe", { method: "POST", body: forme });
                var d = await r.json();
                if (d.success && d.text) { envoyer(d.text); }
                else { poser("", "Je n'ai pas bien entendu. Réessaie."); }
            } catch (err) {
                poser("", "La transcription n'a pas abouti.");
            }
        });
        enregistreur.start();
        enregistre = true;
        btnMicro.textContent = "⏸ J'ai fini";
        poser("ecoute", "<b>Je t'écoute…</b>");
    }

    function arreter() {
        enregistre = false;
        btnMicro.textContent = "🎙️ Parler";
        if (enregistreur) enregistreur.stop();
    }

    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
        btnMicro.disabled = true;
        btnMicro.textContent = "🎙️ Micro indisponible";
    } else {
        // La bulle est un bouton, meme si elle n'en a pas l'air : c'est
        // exactement ce qu'il a demande — on touche la bulle et on parle.
        function basculer() {
            if (enregistre) { arreter(); return; }
            commencer().catch(function () {
                poser("", "Autorise le micro dans ton navigateur.");
                btnMicro.textContent = "🎙️ Parler";
                enregistre = false;
            });
        }
        btnMicro.addEventListener("click", basculer);
        scene.addEventListener("click", basculer);
        scene.style.cursor = "pointer";
    }
})();
</script>
</body>
</html>`);
});

module.exports = router;
