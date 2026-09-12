// ==========================================================================
// SAMII OS — LE CHAT DE LA PAGE D'ACCUEIL
//
// Parle à POST /vitrine/chat, qui existait déjà et qui ne change pas de
// contrat : on lui envoie { message, historique, langue }, il renvoie
// { success, reply, limite, restant }.
//
// L'AFFICHAGE PROGRESSIF N'EST PAS DU VRAI STREAMING. Le serveur renvoie la
// réponse complète en une fois (geminiService.chatLibre n'expose pas de flux).
// On la révèle mot par mot à l'arrivée : le visiteur voit SAMII écrire au
// lieu de voir un rond tourner puis un pavé apparaître. C'est la différence
// de sensation entre « un formulaire » et « quelqu'un me répond », et ça ne
// demande aucun changement côté serveur. Le vrai flux SSE viendra plus tard,
// ce fichier sera le seul à changer.
//
// L'HISTORIQUE VIT DANS LE NAVIGATEUR pour un visiteur sans compte — c'est
// déjà ce que faisait l'ancien chat de la vitrine. Le serveur, lui, journalise
// les tours dans samii_conversations pour qu'on puisse analyser plus tard ce
// que les gens demandent vraiment. Rien n'est inventé ici.
// ==========================================================================
(function () {
    "use strict";

    var T = window.SAMII_T || {};
    var LANG = window.SAMII_LANG || "fr";
    var CONNECTE = window.SAMII_CONNECTE === true;

    var CLOUD     = window.SAMII_CLOUDINARY || {};
    var fil       = document.getElementById("fil");
    var colonne   = document.getElementById("colonne");
    var ouverture = document.getElementById("ouverture");
    var amorces   = document.getElementById("amorces");
    var saisie    = document.getElementById("saisie");
    var champ     = document.getElementById("champ");
    var envoyer   = document.getElementById("envoyer");
    var jauge     = document.getElementById("jauge");
    var cote      = document.getElementById("cote");
    var burger    = document.getElementById("burger");

    if (!saisie || !champ || !colonne) return;   // page servie sans le chat

    var lent = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var historique = [];
    var occupe = false;
    var restant = null;          // renseigné par la première réponse du serveur
    var memoireProposee = CONNECTE;   // un compte connecté n'a rien à proposer

    // ── AFFICHAGE ────────────────────────────────────────────────────────
    function defiler() { if (fil) fil.scrollTop = fil.scrollHeight; }

    function bloc(classe) {
        var d = document.createElement("div");
        d.className = classe;
        colonne.appendChild(d);
        return d;
    }

    function rangerOuverture() {
        if (ouverture) { ouverture.remove(); ouverture = null; }
        if (amorces)   { amorces.remove();   amorces = null; }
    }

    function direMoi(texte, image) {
        var t = bloc("tour tour--moi");
        var b = document.createElement("div");
        b.className = "bulle";
        if (image) {
            var img = document.createElement("img");
            img.className = "bulle__image";
            img.src = image;
            img.alt = "";
            b.appendChild(img);
        }
        if (texte) b.appendChild(document.createTextNode(texte));
        t.appendChild(b);
        defiler();
    }

    // Les trois points d'attente, remplacés par la réponse dès qu'elle arrive.
    function attendre() {
        var t = bloc("tour");
        var p = document.createElement("div"); p.className = "pastille";
        var d = document.createElement("div"); d.className = "points";
        d.innerHTML = "<i></i><i></i><i></i>";
        t.appendChild(p); t.appendChild(d);
        defiler();
        return { tour: t, points: d };
    }

    // Ouvre la bulle de SAMII et renvoie de quoi l'alimenter au fil de l'eau.
    // Le curseur clignotant reste en dernier enfant : chaque morceau s'insère
    // AVANT lui, ce qui donne l'impression d'un texte en train d'être tapé.
    function ouvrirBulle(cible) {
        cible.points.remove();
        var b = document.createElement("div");
        b.className = "bulle";
        cible.tour.appendChild(b);

        var curseur = null;
        if (!lent) {
            curseur = document.createElement("span");
            curseur.className = "curseur";
            b.appendChild(curseur);
        }
        return {
            ajouter: function (texte) {
                if (curseur) curseur.before(document.createTextNode(texte));
                else b.appendChild(document.createTextNode(texte));
                defiler();
            },
            fermer: function () {
                if (curseur) { curseur.remove(); curseur = null; }
                defiler();
            },
            vide: function () { return b.textContent.trim() === ""; },
            ecrire: function (texte) {
                b.textContent = texte;
                curseur = null;
                defiler();
            },
        };
    }

    // Le repli : quand le flux n'est pas disponible, on a le texte complet
    // d'un coup et on le révèle quand même mot par mot. Même sensation, sans
    // le vrai flux — c'est ce que voit un visiteur derrière un proxy qui met
    // les réponses en tampon.
    function reveler(bulle, texte, fini) {
        if (lent) { bulle.ecrire(texte); return fini && fini(); }
        var morceaux = texte.split(/(\s+)/);
        var i = 0;
        (function pas() {
            if (i >= morceaux.length) { bulle.fermer(); return fini && fini(); }
            bulle.ajouter(morceaux[i]);
            var pause = morceaux[i].indexOf("\n\n") !== -1 ? 170 : 14 + Math.random() * 30;
            i++;
            setTimeout(pas, pause);
        })();
    }

    // Le compte n'est PAS un péage : on l'offre, on ne le réclame pas, et on
    // dit explicitement que la conversation peut continuer sans lui.
    function proposerMemoire() {
        var d = bloc("memoire");
        var h = document.createElement("h2");
        h.textContent = T.memTitre || "";
        var p = document.createElement("p");
        p.textContent = T.memTexte || "";
        var actions = document.createElement("div");
        actions.className = "identites";

        var creer = document.createElement("a");
        creer.className = "identite identite--net";
        creer.href = "/register";
        creer.textContent = T.creer || "";

        var deja = document.createElement("a");
        deja.className = "identite";
        deja.href = "/login";
        deja.textContent = T.connecter || "";

        var fin = document.createElement("p");
        fin.className = "memoire__fin";
        fin.textContent = T.memFin || "";

        actions.appendChild(creer);
        actions.appendChild(deja);
        d.appendChild(h); d.appendChild(p); d.appendChild(actions); d.appendChild(fin);
        defiler();
    }

    function peindreJauge() {
        if (!jauge || CONNECTE || restant === null) return;
        if (restant > 0) {
            jauge.className = "jauge" + (restant <= 3 ? " bas" : "");
            jauge.innerHTML = "<b>" + restant + "</b> " + (T.restants || "");
        } else {
            jauge.className = "jauge bas";
            jauge.innerHTML = "<b>" + (T.epuise || "") + "</b>";
        }
    }

    // ── ENVOI ────────────────────────────────────────────────────────────
    function terminer(reponse, json) {
        if (reponse) historique.push({ role: "model", message: reponse });
        if (json && typeof json.restant === "number") restant = json.restant;
        peindreJauge();
        // La proposition de compte n'arrive jamais au premier message :
        // SAMII rend service d'abord, il propose ensuite.
        if (!memoireProposee && json && (json.limite || (restant !== null && restant <= 3))) {
            memoireProposee = true;
            proposerMemoire();
        }
        occupe = false;
        envoyer.disabled = false;
        champ.focus();
    }

    function envoyerMessage(texte) {
        if (occupe || (!texte && !jointeUrl)) return;
        occupe = true;
        envoyer.disabled = true;
        rangerOuverture();
        direMoi(texte, jointeUrl);
        historique.push({ role: "user", message: texte });
        var cible = attendre();

        // ── CONNECTÉ : LA MÊME ROUTE QUE LE CHAT DU QG ───────────────────
        //
        // /api/chat porte la mémoire complète (samii_conversations), les
        // projets et les images. C'est ce qui fait qu'il n'y a QU'UN SAMII :
        // ce qui se dit ici se retrouve dans le QG, et inversement. Faire
        // parler la page d'accueil à /vitrine/chat aurait créé un second
        // assistant, amnésique, sous le même nom.
        if (CONNECTE) return envoyerConnecte(texte, cible);

        var corps = JSON.stringify({ message: texte, historique: historique, langue: LANG });

        // ── LE CHEMIN D'ABORD : LE FLUX ──────────────────────────────────
        // fetch + ReadableStream plutôt que EventSource, parce qu'EventSource
        // ne sait faire que des GET — et l'historique ne tient pas dans une URL.
        if (!window.ReadableStream || !window.TextDecoder) return sansFlux(cible, corps);

        fetch("/vitrine/chat/flux", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: corps,
        })
        .then(function (r) {
            // Le serveur a répondu du JSON : c'est la limite de quota, ou une
            // route absente. On laisse le chemin sans flux s'en occuper.
            var type = r.headers.get("content-type") || "";
            if (!r.ok || type.indexOf("text/event-stream") === -1 || !r.body) {
                throw new Error("pas de flux");
            }
            return lireFlux(r.body, cible);
        })
        .catch(function () { sansFlux(cible, corps); });
    }

    // Lit le flux SSE et alimente la bulle à mesure. Ne rejette JAMAIS après
    // avoir écrit un premier mot : à ce stade le visiteur voit déjà la réponse
    // arriver, et recommencer sur l'autre route la ferait s'écrire deux fois.
    function lireFlux(flux, cible) {
        var lecteur = flux.getReader();
        var decodeur = new TextDecoder();
        var bulle = null;
        var reste = "";
        var complet = "";
        var fini = null;
        var aEcrit = false;

        function traiter(bloc) {
            reste += bloc;
            var lignes = reste.split("\n");
            reste = lignes.pop();
            var evenement = "";
            for (var i = 0; i < lignes.length; i++) {
                var l = lignes[i];
                if (l.indexOf("event:") === 0) { evenement = l.slice(6).trim(); continue; }
                if (l.indexOf("data:") !== 0) continue;
                var d;
                try { d = JSON.parse(l.slice(5).trim()); } catch (e) { continue; }
                if (evenement === "morceau" && d.t) {
                    if (!bulle) bulle = ouvrirBulle(cible);
                    bulle.ajouter(d.t);
                    complet += d.t;
                    aEcrit = true;
                } else if (evenement === "fin") {
                    fini = d;
                }
            }
        }

        return lecteur.read().then(function suite(res) {
            if (!res.done) {
                traiter(decodeur.decode(res.value, { stream: true }));
                return lecteur.read().then(suite);
            }
            traiter(decodeur.decode());
            if (!aEcrit) {
                // Rien n'a été écrit : le flux s'est ouvert puis n'a rien
                // donné. Si le serveur a joint un message de repli, on
                // l'affiche ; sinon on relance sans flux.
                if (fini && fini.reply) {
                    var b = ouvrirBulle(cible);
                    return new Promise(function (ok) {
                        reveler(b, fini.reply, function () { terminer(fini.reply, fini); ok(); });
                    });
                }
                throw new Error("flux vide");
            }
            if (bulle) bulle.fermer();
            terminer(complet, fini || {});
        });
    }

    // ── LE REPLI : L'ANCIENNE ROUTE, INCHANGÉE ───────────────────────────
    function sansFlux(cible, corps) {
        fetch("/vitrine/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: corps,
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            var reponse = (json && json.reply) || T.panne;
            var bulle = ouvrirBulle(cible);
            reveler(bulle, reponse, function () { terminer(reponse, json || {}); });
        })
        .catch(function () {
            var bulle = ouvrirBulle(cible);
            reveler(bulle, T.reseau || "", function () {
                occupe = false;
                envoyer.disabled = false;
            });
        });
    }

    // ══ CONNECTÉ : /api/chat, MÉMOIRE COMPLÈTE, PROJETS, IMAGES ══════════
    //
    // Cette route ne diffuse pas encore en flux — elle passe par le planner du
    // QG, qui peut appeler des outils avant de répondre. On révèle donc le
    // texte mot par mot à l'arrivée, comme sur le chemin de repli : la
    // sensation est la même, et le jour où /api/chat diffusera, seule cette
    // fonction changera.
    function envoyerConnecte(texte, cible) {
        var image = jointeUrl;
        viderJointe();

        fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: texte,
                imageUrl: image || null,
                projetId: projetActif || null,
            }),
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            var reponse = (json && json.reply) || (json && json.quotaExceeded ? T.quota : T.panne);
            var bulle = ouvrirBulle(cible);
            reveler(bulle, reponse, function () { terminer(reponse, json || {}); });
        })
        .catch(function () {
            var bulle = ouvrirBulle(cible);
            reveler(bulle, T.reseau || "", function () {
                occupe = false;
                envoyer.disabled = false;
            });
        });
    }

    // ══ LA PIÈCE JOINTE ══════════════════════════════════════════════════
    //
    // L'envoi va directement de ce navigateur à Cloudinary, avec un préréglage
    // non signé : l'image ne traverse pas notre serveur, qui n'a donc ni à la
    // recevoir, ni à la stocker, ni à la repayer. /api/chat ne reçoit ensuite
    // qu'une adresse. C'est déjà ce que fait le chat du QG — même préréglage,
    // désormais lu depuis config/cloudinary.js.
    var jointeUrl = null;
    var projetActif = null;
    var joindre = document.getElementById("joindre");
    var fichier = document.getElementById("fichier");
    var jointe = document.getElementById("jointe");
    var jointeVue = document.getElementById("jointe-vue");
    var jointeNom = document.getElementById("jointe-nom");
    var jointeRetirer = document.getElementById("jointe-retirer");

    function viderJointe() {
        jointeUrl = null;
        if (fichier) fichier.value = "";
        if (jointe) jointe.hidden = true;
    }

    if (joindre && fichier) {
        joindre.addEventListener("click", function () { fichier.click(); });
        fichier.addEventListener("change", function () {
            var f = fichier.files && fichier.files[0];
            if (!f) return;
            // 10 Mo : la même limite que celle du serveur pour l'audio. Un
            // refus annoncé ici vaut mieux qu'un envoi de trente secondes
            // qui échoue à l'arrivée.
            if (f.size > 10 * 1024 * 1024) { alerter(T.tropLourd); fichier.value = ""; return; }

            jointeNom.textContent = f.name;
            jointeVue.src = URL.createObjectURL(f);
            jointe.hidden = false;
            joindre.classList.add("outil--actif");

            var forme = new FormData();
            forme.append("file", f);
            forme.append("upload_preset", CLOUD.preset);
            fetch("https://api.cloudinary.com/v1_1/" + CLOUD.nuage + "/image/upload", { method: "POST", body: forme })
                .then(function (r) { return r.json(); })
                .then(function (json) {
                    joindre.classList.remove("outil--actif");
                    if (!json || !json.secure_url) throw new Error("envoi refusé");
                    jointeUrl = json.secure_url;
                })
                .catch(function () {
                    joindre.classList.remove("outil--actif");
                    viderJointe();
                    alerter(T.envoiRate);
                });
        });
    }
    if (jointeRetirer) jointeRetirer.addEventListener("click", viderJointe);

    // ══ LE MICRO ═════════════════════════════════════════════════════════
    //
    // On n'envoie pas le message tout seul après transcription : le texte est
    // déposé dans le champ et la personne relit avant d'envoyer. Une
    // transcription se trompe, et un message parti de travers coûte un
    // crédit et une explication.
    var micro = document.getElementById("micro");
    var enregistreur = null;
    var morceauxAudio = [];

    function alerter(texte) {
        if (!texte) return;
        rangerOuverture();
        var cible = attendre();
        var bulle = ouvrirBulle(cible);
        bulle.ecrire(texte);
    }

    if (micro) {
        micro.addEventListener("click", async function () {
            if (enregistreur && enregistreur.state === "recording") {
                enregistreur.stop();
                return;
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
                return alerter(T.microRefus);
            }
            try {
                var flux = await navigator.mediaDevices.getUserMedia({ audio: true });
                morceauxAudio = [];
                enregistreur = new MediaRecorder(flux);
                enregistreur.ondataavailable = function (e) { if (e.data.size) morceauxAudio.push(e.data); };
                enregistreur.onstop = function () {
                    // La piste est coupée explicitement : sans ça, le point
                    // rouge « micro actif » reste allumé dans l'onglet après
                    // l'enregistrement, et on a l'air d'écouter en continu.
                    flux.getTracks().forEach(function (p) { p.stop(); });
                    micro.classList.remove("outil--actif");
                    champ.placeholder = placeholderInitial;

                    var forme = new FormData();
                    forme.append("audio", new Blob(morceauxAudio, { type: "audio/webm" }), "audio.webm");
                    fetch("/api/chat/transcribe", { method: "POST", body: forme })
                        .then(function (r) { return r.json(); })
                        .then(function (json) {
                            var t = (json && json.text || "").trim();
                            if (!t) return alerter(T.microVide);
                            champ.value = champ.value ? champ.value + " " + t : t;
                            champ.focus();
                        })
                        .catch(function () { alerter(T.microVide); });
                };
                enregistreur.start();
                micro.classList.add("outil--actif");
                champ.placeholder = T.ecoute || "";
            } catch (e) {
                alerter(T.microRefus);
            }
        });
    }

    // ══ LES PROJETS ══════════════════════════════════════════════════════
    // Cliquer un projet bascule le fil dans ce projet : /api/chat vérifie
    // l'appartenance de son côté, on ne fait que transmettre le choix.
    var placeholderInitial = champ.placeholder;
    document.querySelectorAll(".sortie--projet").forEach(function (b) {
        b.addEventListener("click", function () {
            var etait = projetActif;
            document.querySelectorAll(".sortie--projet").forEach(function (x) { x.classList.remove("sortie--ici"); });
            if (etait === b.dataset.projet) { projetActif = null; return; }
            projetActif = b.dataset.projet;
            b.classList.add("sortie--ici");
            if (cote) cote.classList.remove("ouverte");
            champ.focus();
        });
    });

    // ── BRANCHEMENTS ─────────────────────────────────────────────────────
    saisie.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = champ.value.trim();
        if (!t && !jointeUrl) return;
        champ.value = "";
        envoyerMessage(t);
    });

    if (amorces) {
        amorces.addEventListener("click", function (e) {
            var b = e.target.closest(".amorce");
            if (b) envoyerMessage(b.textContent.trim());
        });
    }

    if (burger && cote) {
        burger.addEventListener("click", function () { cote.classList.toggle("ouverte"); });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") cote.classList.remove("ouverte");
        });
    }

    // Quelqu'un qui arrive du hub des métiers (/metiers → /?metier=Dentiste)
    // trouve sa phrase déjà écrite, mais on ne l'envoie PAS à sa place : un
    // message coûte un crédit, et c'est au visiteur de décider de le dépenser.
    try {
        var metier = new URLSearchParams(window.location.search).get("metier");
        if (metier) {
            champ.value = String(metier).slice(0, 120);
            champ.focus();
        }
    } catch (e) { /* URL exotique : on ouvre la page normalement */ }
})();
