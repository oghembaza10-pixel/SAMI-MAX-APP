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

    function direMoi(texte) {
        var t = bloc("tour tour--moi");
        var b = document.createElement("div");
        b.className = "bulle";
        b.textContent = texte;
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
        if (occupe || !texte) return;
        occupe = true;
        envoyer.disabled = true;
        rangerOuverture();
        direMoi(texte);
        historique.push({ role: "user", message: texte });
        var cible = attendre();
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

    // ── BRANCHEMENTS ─────────────────────────────────────────────────────
    saisie.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = champ.value.trim();
        if (!t) return;
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
