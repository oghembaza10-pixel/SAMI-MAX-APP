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
    var demarrer  = document.getElementById("demarrer");
    var saisie    = document.getElementById("saisie");
    var champ     = document.getElementById("champ");
    var envoyer   = document.getElementById("envoyer");
    var jauge     = document.getElementById("jauge");
    var cote      = document.getElementById("cote");
    var burger    = document.getElementById("burger");
    // Déclarée ICI et pas 580 lignes plus bas, où elle l'était : elle est lue
    // par `rangerOuverture`, tout en haut. Le hissage des `var` faisait que ça
    // fonctionnait — jusqu'au jour où quelqu'un passe le fichier en `const`.
    var scene     = document.getElementById("scene");

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

    // ── LE PASSAGE ÉCRAN VIDE → CONVERSATION ─────────────────────────────
    //
    // Les deux blocs étaient RETIRÉS du document d'un coup. Le contenu
    // sautait de plusieurs centaines de pixels au moment précis où l'on
    // venait d'appuyer sur envoyer — on ne savait plus si son message était
    // parti ou si la page avait rechargé.
    //
    // On pose donc un état sur la scène, le CSS fait la transition, et on ne
    // retire les nœuds qu'APRÈS. Retirer tout de suite annulerait l'animation
    // qu'on vient de lancer ; ne jamais retirer laisserait deux blocs vides
    // dans le fil, avec leurs marges.
    var range = false;
    function rangerOuverture() {
        if (range) return;
        range = true;
        if (scene) scene.setAttribute("data-commence", "1");
        // Le centrage vertical n'a de sens que sur une page vide : dès qu'il y
        // a une conversation, elle se lit de haut en bas comme partout.
        if (fil) fil.classList.remove("fil--vide");
        // 340 ms : la plus longue des deux transitions CSS, plus une marge.
        // Un `transitionend` serait plus juste, mais il ne se déclenche jamais
        // si l'utilisateur a demandé « moins d'animations » — et le bloc
        // resterait alors pour toujours.
        setTimeout(function () {
            if (ouverture) { ouverture.remove(); ouverture = null; }
            if (demarrer)  { demarrer.remove();  demarrer = null; }
        }, 340);
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
        // SAMII cherche : la boule passe en pulsation. C'est le seul signe
        // visible pendant les deux à cinq secondes où il ne se passe rien à
        // l'écran — et c'est exactement là qu'on perd les gens.
        etatBoule("pense");
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
    // ══ LA BOULE EST VIVANTE ═════════════════════════════════════════════
    //
    // Entre l'envoi et la première lettre, il y a deux à cinq secondes de
    // silence. Sans signe, ce silence ressemble à une panne — et quelqu'un
    // qui croit à une panne renvoie son message, ce qui coûte un tour de
    // plus pour rien.
    //
    // Trois états, trois choses différentes à dire : au repos elle respire,
    // pendant qu'elle cherche elle pulse, pendant qu'elle parle une onde
    // part à chaque mot. Les deux boules (la grande de l'ouverture, la
    // petite de la barre) suivent le même état : la grande disparaît dès
    // que la conversation défile, la petite reste.
    var boules = function () {
        return [].slice.call(document.querySelectorAll(".boule"));
    };
    function etatBoule(etat) {
        boules().forEach(function (b) {
            b.classList.remove("boule--pense", "boule--parle");
            if (etat) b.classList.add("boule--" + etat);
        });
    }
    // Un souffle par mot révélé. `void offsetWidth` force le navigateur à
    // recalculer le style : sans ça, retirer puis remettre la classe dans le
    // même tour ne rejoue pas l'animation — le navigateur ne voit aucun
    // changement. C'est le piège classique des animations déclenchées en JS.
    var dernierSouffle = 0;
    function souffler() {
        var t = Date.now();
        if (t - dernierSouffle < 110) return;   // pas plus de ~9 par seconde
        dernierSouffle = t;
        boules().forEach(function (b) {
            b.classList.remove("boule--mot");
            void b.offsetWidth;
            b.classList.add("boule--mot");
        });
    }

    function reveler(bulle, texte, fini) {
        etatBoule("parle");
        if (lent) { bulle.ecrire(texte); etatBoule(null); return fini && fini(); }
        var morceaux = texte.split(/(\s+)/);
        var i = 0;
        (function pas() {
            if (i >= morceaux.length) {
                bulle.fermer();
                etatBoule(null);            // elle a fini de parler : repos
                return fini && fini();
            }
            bulle.ajouter(morceaux[i]);
            if (morceaux[i].trim()) souffler();
            var pause = morceaux[i].indexOf("\n\n") !== -1 ? 170 : 14 + Math.random() * 30;
            i++;
            setTimeout(pas, pause);
        })();
    }

    // ══ LE RETOUR SUR UNE RÉPONSE ════════════════════════════════════════
    //
    // 👍/👎 sous une réponse de SAMII. Ce n'est pas de la décoration : c'est
    // la seule façon de savoir ce qui marche pendant qu'on entraîne SAMII,
    // avant d'avoir le volume de clients qui le dirait tout seul.
    //
    // ── TROIS CONDITIONS, ET CHACUNE COMPTE ──────────────────────────────
    //
    //   CONNECTÉ    la route est derrière requireAuth, et un visiteur sans
    //               compte n'a aucun tour enregistré à noter.
    //   messageId   l'identifiant du tour en base. Sans lui il n'y a rien à
    //               noter : afficher deux pouces qui ne mènent nulle part
    //               est pire que ne rien afficher.
    //   UNE FOIS    on ne note pas deux fois le même tour. Le garde est posé
    //               sur le NŒUD, pas sur une variable partagée : deux
    //               réponses à l'écran ne se gênent pas l'une l'autre.
    function poserRetour(cible, messageId) {
        if (!CONNECTE || !messageId || !cible || !cible.tour) return;
        var barre = elem("div", "retour");
        [["up", "👍", T.retourBon], ["down", "👎", T.retourMauvais]].forEach(function (p) {
            var b = elem("button", "retour__b", p[1]);
            b.type = "button";
            b.setAttribute("data-retour", p[0]);
            b.setAttribute("aria-label", p[2] || p[0]);
            barre.appendChild(b);
        });
        barre.addEventListener("click", function (ev) {
            var b = ev.target.closest("[data-retour]");
            if (!b || barre.getAttribute("data-envoye")) return;
            barre.setAttribute("data-envoye", "1");
            [].slice.call(barre.children).forEach(function (x) { x.disabled = true; });
            b.classList.add("retour__b--actif");
            fetch("/api/chat/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: messageId, feedback: b.getAttribute("data-retour") }),
            }).catch(function () { /* un avis perdu ne casse pas la conversation */ });
        });
        cible.tour.appendChild(barre);
        defiler();
    }

    // ══ LES CARTES ═══════════════════════════════════════════════════════
    //
    // Un outil rend une structure ; le serveur en fait une carte
    // (services/resultats.js) ; cette fonction la peint DANS LE FIL, à la suite
    // de la réponse, comme un tour de plus.
    //
    // ── POURQUOI PAS DU TEXTE ────────────────────────────────────────────
    //
    // Huit prospects racontés en paragraphe, ça se lit une fois et ça se
    // perd. En carte, ça se parcourt, ça se clique, ça reste dans le fil, et
    // ça porte ce qu'on peut faire ensuite. Le marchand paie un acte : il
    // doit lui en rester quelque chose à l'écran.
    //
    // ── TOUT EST CONSTRUIT EN NŒUDS, JAMAIS EN innerHTML ─────────────────
    //
    // ⚠️ ET CE N'EST PAS UNE PRÉCAUTION THÉORIQUE. Le contenu d'une carte de
    // prospects vient d'une recherche web : des noms et des descriptions
    // écrits par n'importe qui sur n'importe quelle page. Un seul
    // `innerHTML` ici, et une page publique choisit ce qui s'exécute dans le
    // navigateur du marchand — avec sa session ouverte.
    //
    // `textContent` partout. Les liens sont déjà filtrés côté serveur (seuls
    // http/https passent), et on remet `rel="noopener noreferrer"` ici :
    // deux verrous indépendants valent mieux qu'un.
    // ⚠️ UNE SEULE CHAÎNE POUR LA CLASSE DU BOUTON DE GESTE.
    //
    // Elle était écrite deux fois : une fois en la posant sur le bouton, une
    // fois en l'écoutant dans `closest()`. Un renommage a touché l'une et pas
    // l'autre — les boutons s'affichaient, joliment, et ne faisaient
    // strictement rien au clic. Aucune erreur, aucun journal : le geste le
    // plus visible de la carte était mort en silence.
    //
    // Les tests de source n'ont rien vu : les deux chaînes existaient, elles
    // ne se parlaient simplement plus. C'est le navigateur qui l'a dit.
    var CLASSE_GESTE = "resultat__geste";

    function elem(balise, classe, texte) {
        var e = document.createElement(balise);
        if (classe) e.className = classe;
        if (texte) e.textContent = texte;
        return e;
    }

    function peindreResultats(liste) {
        if (!Array.isArray(liste) || !liste.length) return;
        liste.forEach(peindreResultat);
    }

    function peindreResultat(c) {
        if (!c || !Array.isArray(c.elements) || !c.elements.length) return;
        var t = bloc("tour tour--resultat");
        var carte = elem("article", "resultat");
        carte.setAttribute("data-source", String(c.source || ""));

        var tete = elem("header", "resultat__tete");
        if (c.titre) tete.appendChild(elem("h3", "resultat__titre", c.titre));
        if (c.soustitre) tete.appendChild(elem("p", "resultat__soustitre", c.soustitre));
        carte.appendChild(tete);

        if (c.forme === "chiffres") {
            var grille = elem("div", "resultat__chiffres");
            c.elements.forEach(function (e) {
                var tuile = elem("div", "chiffre");
                tuile.appendChild(elem("span", "chiffre__valeur", e.valeur));
                tuile.appendChild(elem("span", "chiffre__titre", e.titre));
                grille.appendChild(tuile);
            });
            carte.appendChild(grille);
        } else {
            var ul = elem("ul", "resultat__liste");
            c.elements.forEach(function (e) {
                var li = elem("li", "resultat__ligne");
                var haut = elem("div", "resultat__ligneHaut");
                haut.appendChild(elem("span", "resultat__nom", e.titre));
                if (e.valeur) haut.appendChild(elem("span", "resultat__etiquette", e.valeur));
                li.appendChild(haut);
                if (e.detail) li.appendChild(elem("p", "resultat__detail", e.detail));
                if (e.contact) li.appendChild(elem("p", "resultat__contact", e.contact));
                if (e.lien) {
                    var a = elem("a", "resultat__lien", e.lien.replace(/^https?:\/\//, "").slice(0, 48));
                    a.href = e.lien;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    li.appendChild(a);
                }
                ul.appendChild(li);
            });
            carte.appendChild(ul);
        }

        // Ce que le bilan n'a PAS pu lire. Dit à voix haute, parce que
        // « 0 » et « pas mesuré » sonnent pareil et ne veulent pas dire la
        // même chose (voir services/briefing.js).
        if (Array.isArray(c.manques) && c.manques.length) {
            var man = elem("div", "resultat__manques");
            c.manques.forEach(function (m) { man.appendChild(elem("p", null, m)); });
            carte.appendChild(man);
        }

        if (Array.isArray(c.liens) && c.liens.length) {
            var src = elem("div", "resultat__sources");
            src.appendChild(elem("span", "resultat__sourcesTitre", T.resultatSources || "Sources"));
            c.liens.forEach(function (l) {
                var a = elem("a", null, l.libelle);
                a.href = l.url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                src.appendChild(a);
            });
            carte.appendChild(src);
        }

        // ── LE PRIX DE CE GESTE, ET CE QU'IL RESTE ───────────────────────
        //
        // Affiché seulement quand ce tour a été débité. Le quota gratuit ne
        // montre rien : il n'y a rien à montrer, et écrire « 0 » ferait
        // croire à une remise. Le solde vient du registre, jamais d'un
        // calcul fait ici.
        if (c.cout && typeof c.cout.montant === "number") {
            var pied = elem("div", "resultat__cout");
            pied.appendChild(elem("span", "resultat__prix", (c.cout.libelle || "") + " · " + c.cout.montant.toFixed(2) + " $"));
            if (typeof c.cout.solde === "number") {
                pied.appendChild(elem("span", "resultat__solde",
                    (T.resultatSolde || "Solde") + " : " + c.cout.solde.toFixed(2) + " $"));
            }
            carte.appendChild(pied);
        }

        // ── LES GESTES ───────────────────────────────────────────────────
        //
        // Le serveur a déjà retiré ceux que cette personne ne peut pas
        // tenir (services/resultats.js). Ici on ne fait que peindre — et on
        // réutilise exactement le mécanisme des puces d'amorce : un libellé
        // court, une demande entière envoyée à SAMII.
        if (Array.isArray(c.gestes) && c.gestes.length) {
            var barre = elem("div", "resultat__gestes");
            c.gestes.forEach(function (g) {
                var b = elem("button", "chip " + CLASSE_GESTE, g.libelle);
                b.type = "button";
                b.setAttribute("data-demande", g.demande);
                barre.appendChild(b);
            });
            barre.addEventListener("click", function (ev) {
                var b = ev.target.closest("." + CLASSE_GESTE);
                if (!b || occupe) return;
                envoyerMessage(b.getAttribute("data-demande"));
            });
            carte.appendChild(barre);
        }

        t.appendChild(carte);
        defiler();
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
        if (CONNECTE) { var img = jointeUrl; viderJointe(); return envoyerConnecte(texte, cible, img); }

        var image = jointeUrl;
        viderJointe();
        var corps = JSON.stringify({ message: texte, historique: historique, langue: LANG, imageUrl: image });

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
        // Compté pour une seule raison : si SAMII s'est repris, la bulle
        // provisoire est vide et c'est la charge finale qui porte le texte.
        var reprises = 0;

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
                } else if (evenement === "reprise") {
                    // ── SAMII S'EST REPRIS ───────────────────────────────
                    //
                    // Il a commencé une phrase, puis a décidé d'appeler un
                    // outil : ce début n'était PAS la réponse. Le serveur le
                    // dit explicitement, et on efface.
                    //
                    // ⚠️ CET ÉVÉNEMENT N'ÉTAIT PAS LU ICI. Le flux anonyme
                    // ne l'émet jamais — il ne porte aucun outil — donc rien
                    // ne manquait tant que ce lecteur ne servait qu'à lui.
                    // Branché sur `/api/chat/flux`, l'ignorer aurait laissé
                    // à l'écran un début de phrase abandonné, suivi de la
                    // vraie réponse : SAMII aurait eu l'air de se contredire.
                    complet = "";
                    aEcrit = false;
                    if (bulle) { bulle.ecrire(""); }
                    reprises++;
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
                // Rien n'a été écrit : soit le flux s'est ouvert sans rien
                // donner, soit SAMII s'est repris pour appeler un outil et
                // c'est la charge finale qui porte la vraie réponse. Dans
                // les deux cas, si le serveur a joint un texte, on l'affiche.
                if (fini && fini.reply) {
                    // ⚠️ APRÈS UNE REPRISE, LA BULLE EXISTE DÉJÀ — vidée.
                    // En rouvrir une seconde laisserait une bulle fantôme au
                    // milieu du fil. On réécrit dans celle qui est là.
                    var b = bulle || ouvrirBulle(cible);
                    return new Promise(function (ok) {
                        reveler(b, fini.reply, function () {
                            peindreResultats(fini.resultats);
                            poserRetour(cible, fini.messageId);
                            terminer(fini.reply, fini);
                            ok();
                        });
                    });
                }
                // Une reprise sans réponse finale ne se rattrape pas en
                // relançant : le tour a déjà été facturé côté serveur, le
                // rejouer le ferait payer deux fois.
                if (reprises) { if (bulle) bulle.fermer(); terminer("", fini || {}); return; }
                throw new Error("flux vide");
            }
            if (bulle) bulle.fermer();
            // Les blocs et le retour arrivent APRÈS le texte, dans cet ordre,
            // et seulement si la charge finale les porte. Le chemin anonyme
            // n'en a aucun : `peindreResultats` et `poserRetour` ne font
            // alors rien, et c'est ce qui permet d'avoir UN seul lecteur.
            peindreResultats(fini && fini.resultats);
            poserRetour(cible, fini && fini.messageId);
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

    // ══ CONNECTÉ : /api/chat/flux, MÉMOIRE COMPLÈTE, PROJETS, IMAGES ═════
    //
    // ── CE QUI VIENT DE CHANGER, ET POURQUOI C'ÉTAIT ABSURDE ─────────────
    //
    // Cette fonction appelait `/api/chat`, qui rend la réponse d'un bloc, et
    // le commentaire d'ici disait « le jour où /api/chat diffusera ». Ce
    // jour-là était déjà passé : `/api/chat/flux` existe, il diffuse, il est
    // testé, et la page de l'assistant s'en servait — à un clic de là.
    //
    // Donc la porte d'entrée du produit, celle que voit quelqu'un qui paie,
    // attendait la réponse entière en silence pendant que la page rangée
    // derrière un bouton « Plus » l'écrivait mot à mot.
    //
    // ── ON NE PORTE PAS UN SECOND LECTEUR ────────────────────────────────
    //
    // Ce fichier a DÉJÀ un lecteur de flux, `lireFlux`, écrit pour le chemin
    // anonyme. Recopier celui de la page de l'assistant aurait fait deux
    // lecteurs à tenir d'accord — et ils auraient divergé, comme tout ce qui
    // est écrit deux fois dans ce projet. `lireFlux` sait maintenant lire les
    // deux flux : ils parlent le même SSE.
    //
    // LE COÛT NE CHANGE PAS. Sans outil : un appel d'IA, comme avant. Avec
    // outil : deux — décider, puis formuler — exactement comme le chemin d'un
    // bloc le faisait déjà.
    function corpsConnecte(texte, image) {
        return JSON.stringify({
            message: texte,
            imageUrl: image || null,
            projetId: projetActif || null,
            // Une DEMANDE, pas une décision : la route la borne au palier.
            niveau: niveauChoisi,
        });
    }

    function envoyerConnecte(texte, cible, image) {
        var corps = corpsConnecte(texte, image);
        if (!window.ReadableStream || !window.TextDecoder) return connecteSansFlux(corps, cible);

        fetch("/api/chat/flux", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: corps,
        })
        .then(function (r) {
            var type = r.headers.get("content-type") || "";
            if (!r.ok || type.indexOf("text/event-stream") === -1 || !r.body) {
                throw new Error("pas de flux");
            }
            return lireFlux(r.body, cible);
        })
        .catch(function () { connecteSansFlux(corps, cible); });
    }

    // ── LE REPLI : LA RÉPONSE D'UN BLOC ──────────────────────────────────
    //
    // Un proxy qui met en tampon, un navigateur sans flux lisible : on
    // retombe sur `/api/chat`, qui rend exactement la même chose d'un seul
    // coup. C'est le comportement d'AVANT ce chantier, gardé entier — mieux
    // vaut une réponse d'un bloc que pas de réponse.
    function connecteSansFlux(corps, cible) {
        fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: corps,
        })
        .then(function (r) { return r.json(); })
        .then(function (json) {
            var reponse = (json && json.reply) || (json && json.quotaExceeded ? T.quota : T.panne);
            var bulle = ouvrirBulle(cible);
            // Les résultats arrivent APRÈS la phrase, jamais pendant. SAMII dit
            // d'abord ce qu'il a trouvé, le résultat se pose ensuite : poser
            // le bloc au milieu du texte couperait la phrase en deux.
            reveler(bulle, reponse, function () {
                peindreResultats(json && json.resultats);
                poserRetour(cible, json && json.messageId);
                terminer(reponse, json || {});
            });
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

    // ── UN SEUL ENVOI VERS CLOUDINARY ────────────────────────────────────
    //
    // Il était écrit en ligne dans le gestionnaire de la pièce jointe. Les
    // fichiers de connaissance en ont besoin aussi — même préréglage, même
    // point d'entrée, y compris pour les PDF que Cloudinary accepte sur
    // `/image/upload`. Deux copies auraient voulu dire deux préréglages à
    // tenir d'accord ; celui-ci est lu depuis config/cloudinary.js et ne
    // vit qu'ici.
    //
    // L'envoi va du navigateur à Cloudinary sans passer par notre serveur :
    // il n'a ni à recevoir le fichier, ni à le stocker, ni à le repayer.
    function versCloudinary(f) {
        var forme = new FormData();
        forme.append("file", f);
        forme.append("upload_preset", CLOUD.preset);
        return fetch("https://api.cloudinary.com/v1_1/" + CLOUD.nuage + "/image/upload", { method: "POST", body: forme })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (!json || !json.secure_url) throw new Error("envoi refusé");
                return json.secure_url;
            });
    }

    // Le niveau choisi dans la barre. Le cran de départ est LU sur le bouton
    // (`data-defaut`), que le serveur remplit depuis config/niveaux.js — on ne
    // l'écrit pas ici. Écrit aux deux endroits, il aurait fini par différer :
    // la barre affichant un niveau pendant que le navigateur en envoie un
    // autre, sans que rien ne le signale.
    //
    // `"rapide"` en dernier recours seulement, si le bouton n'existe pas
    // encore dans le DOM — jamais comme source de vérité.
    // `/api/chat` le lit DÉJÀ et le borne au palier payé — on n'ajoute aucune
    // règle, on rend visible un réglage qui n'avait pas d'interface.
    var niveauChoisi = (function () {
        var n = document.getElementById("cerveau-nom");
        return (n && n.getAttribute("data-defaut")) || "rapide";
    })();

    // Monter la barre à un cran donné, depuis ailleurs que le menu — une puce
    // de démarrage qui promet un outil (voir plus bas). Posé ici en NO-OP :
    // le vrai est branché avec le menu, et si le menu n'existe pas dans le
    // DOM, cliquer une puce ne doit pas lever une exception qui emporterait
    // l'envoi du message. Une puce qui n'arrive pas à monter le niveau part
    // quand même — SAMII répondra avec ce qu'il a, ce qui est moins grave
    // qu'un bouton mort.
    var monterNiveau = function () {};
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

            versCloudinary(f)
                .then(function (url) {
                    joindre.classList.remove("outil--actif");
                    jointeUrl = url;
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
                    // Deux routes, une seule expérience : /vitrine/transcrire
                    // est ouverte à tous, /api/chat/transcribe garde son quota
                    // de membre. Le visiteur ne voit aucune différence — et
                    // c'est le but : il faut avoir essayé pour avoir envie.
                    fetch(CONNECTE ? "/api/chat/transcribe" : "/vitrine/transcrire", { method: "POST", body: forme })
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

    // ── NOUVEAU PROJET ───────────────────────────────────────────────────
    // Connecté, on crée pour de vrai. Sans compte, on explique ce que ça fait
    // et on propose le compte — montrer la fonction est ce qui donne envie de
    // s'inscrire ; la cacher garantit que personne ne la réclame jamais.
    var nouveauProjet = document.getElementById("nouveau-projet");
    if (nouveauProjet) {
        nouveauProjet.addEventListener("click", function () {
            if (cote) cote.classList.remove("ouverte");
            if (!CONNECTE) {
                rangerOuverture();
                var bulle = ouvrirBulle(attendre());
                return reveler(bulle, T.projetSansCompte || "", function () { proposerMemoire(); });
            }
            var nom = window.prompt(T.projetNom || "");
            if (!nom || !nom.trim()) return;
            fetch("/api/projets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nom: nom.trim() }),
            })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                if (json && json.success) return window.location.reload();
                throw new Error("refus");
            })
            .catch(function () {
                var bulle = ouvrirBulle(attendre());
                reveler(bulle, T.reseau || "", function () {});
            });
        });
    }

    // ── BRANCHEMENTS ─────────────────────────────────────────────────────
    // ── ELLE S'EFFACE DÈS QU'ON ÉCRIT ───────────────────────────────────
    //
    // Pas seulement au premier message : dès la PREMIÈRE LETTRE. Quelqu'un
    // qui tape sait déjà ce qu'il veut dire — lui laisser quatre suggestions
    // sous les yeux, c'est lui demander de vérifier qu'il n'a pas mieux à
    // faire que ce qu'il est en train d'écrire.
    //
    // Réversible : si le champ est vidé, l'invitation revient. Elle n'est
    // perdue pour de bon qu'au premier message envoyé (`data-commence`).
    if (champ && scene) {
        champ.addEventListener("input", function () {
            if (scene.getAttribute("data-commence") === "1") return;
            scene.setAttribute("data-ecrit", champ.value.trim() ? "1" : "0");
        });
    }

    saisie.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = champ.value.trim();
        if (!t && !jointeUrl) return;
        champ.value = "";
        envoyerMessage(t);
    });

    // Une puce porte un libellé COURT et une demande ENTIÈRE. On envoie la
    // demande : envoyer « Juste parler » ferait répondre SAMII à deux mots au
    // lieu d'une personne qui a eu une longue journée.
    //
    // ══ ET UNE PUCE QUI PROMET UN OUTIL PORTE LE CRAN QU'IL LUI FAUT ══════
    //
    // ⚠️ MESURÉ, ET C'ÉTAIT UNE PROMESSE CREUSE.
    //
    // La barre présélectionne « Rapide » (config/niveaux.js, PRESELECTION), et
    // Rapide ne porte AUCUN outil : `buildToolsPayload` rend `null`. Une puce
    // « Où en est mon activité ? » cliquée à la première visite partait donc
    // sur un tour SANS OUTIL — SAMII répondait des chiffres de mémoire, avec
    // aplomb, sans avoir rien lu. C'est mot pour mot la panne que
    // `config/niveaux.js` décrit pour les questions de prix.
    //
    // ── ON NE COMPARE PAS DEUX NIVEAUX ICI, ET C'EST VOULU ────────────────
    //
    // Le serveur a déjà listé les crans qui SUFFISENT (`data-suffit`). Ce
    // code ne fait qu'une appartenance. Les deux autres façons de s'y prendre
    // étaient des pièges :
    //
    //   • recopier l'ordre des niveaux ici → une cinquième échelle, qui
    //     divergera de `config/niveaux.js` au premier changement ;
    //   • lire l'ordre sur le menu du DOM → « Auto » y est EN PREMIER, donc
    //     il paraît le plus faible alors qu'il monte jusqu'à Maître. On
    //     aurait remplacé Auto par Expert, c'est-à-dire abaissé le plafond de
    //     quelqu'un en croyant l'aider.
    //
    // ── ON MONTE, ON NE DESCEND JAMAIS ────────────────────────────────────
    //
    // Si le cran en place suffit, on n'y touche pas. Quelqu'un qui travaille
    // en Maître ne doit pas retomber en Expert parce qu'il a cliqué une puce.
    //
    // Et on monte par `poserNiveau`, le MÊME chemin que le menu : la pastille,
    // le nom, la coche et `localStorage` suivent tous. Un second chemin qui
    // n'en mettrait à jour que la moitié laisserait la barre afficher un
    // niveau pendant qu'on en envoie un autre — exactement ce que le
    // commentaire de `niveauChoisi` dit d'éviter.
    if (demarrer) {
        demarrer.addEventListener("click", function (e) {
            var b = e.target.closest(".chip");
            if (!b) return;

            var vise = b.getAttribute("data-niveau");
            if (vise && vise !== niveauChoisi) {
                var suffisants = (b.getAttribute("data-suffit") || "").split(" ");
                if (suffisants.indexOf(niveauChoisi) === -1) monterNiveau(vise);
            }

            envoyerMessage((b.getAttribute("data-demande") || b.textContent).trim());
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

    // ══ MES ESPACES — LE CONTEXTE, PAS UNE AUTRE PAGE ════════════════════
    //
    // Sur bureau la colonne décale le fil ; sous 980px elle glisse par-dessus
    // comme un rideau. Un seul état, deux mises en page — c'est le CSS qui
    // décide, pas le JS. Deux comportements écrits séparément auraient
    // divergé au premier ajustement.
    var espaces = document.getElementById("espaces");
    var appelEspaces = document.getElementById("appel-espaces");
    if (espaces && appelEspaces && scene) {
        // Un SEUL porteur d'état : l'attribut sur la scène. Le CSS en tire
        // la visibilité, la position et la transition. Piloter `hidden` en
        // plus donnait deux vérités possibles — et c'est la mauvaise qui
        // gagnait.
        function estOuvert() { return scene.getAttribute("data-espaces") === "1"; }
        function montrerEspaces(oui) {
            scene.setAttribute("data-espaces", oui ? "1" : "0");
            espaces.setAttribute("aria-hidden", oui ? "false" : "true");
            appelEspaces.setAttribute("aria-expanded", oui ? "true" : "false");
            if (oui) {
                var premier = espaces.querySelector(".sortie, .espaces__fermer");
                if (premier) premier.focus();
            }
        }
        appelEspaces.addEventListener("click", function () {
            montrerEspaces(!estOuvert());
        });
        var fermerEspaces = document.getElementById("espaces-fermer");
        if (fermerEspaces) fermerEspaces.addEventListener("click", function () {
            montrerEspaces(false);
            appelEspaces.focus();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && estOuvert()) {
                montrerEspaces(false);
                appelEspaces.focus();
            }
        });
        // Sur un écran étroit, choisir un espace referme le rideau : le laisser
        // ouvert cacherait la réponse qu'on vient justement de demander.
        espaces.addEventListener("click", function (e) {
            if (window.innerWidth <= 980 && e.target.closest(".sortie--projet")) {
                montrerEspaces(false);
            }
        });
    }

    // ══ ALLER PLUS LOIN — LE RIDEAU ══════════════════════════════════════
    var plusLoin = document.getElementById("plus-loin");
    var rideau = document.getElementById("rideau-plus");
    if (plusLoin && rideau) {
        plusLoin.addEventListener("click", function () {
            var ouvert = rideau.getAttribute("data-ouvert") === "1";
            rideau.setAttribute("data-ouvert", ouvert ? "0" : "1");
            plusLoin.setAttribute("aria-expanded", ouvert ? "false" : "true");
        });
    }

    // ══ COMMENT SAMII DOIT TRAVAILLER ════════════════════════════════════
    //
    // Le niveau part dans le corps de la requête, où `/api/chat` le lisait
    // DÉJÀ et le bornait au palier payé. On ne change aucune règle : on rend
    // visible un réglage qui n'avait pas d'interface.
    //
    // Le choix tient dans `localStorage` : quelqu'un qui travaille en Pro ne
    // doit pas le redire à chaque rechargement. Et il est encadré d'un
    // try/catch — en navigation privée, `localStorage` lève au lieu de
    // rendre null, et une page d'accueil ne doit pas tomber pour ça.
    var cerveau = document.getElementById("cerveau");
    var menuCerveau = document.getElementById("menu-cerveau");
    if (cerveau && menuCerveau) {
        function fermerCerveau() {
            menuCerveau.hidden = true;
            cerveau.setAttribute("aria-expanded", "false");
        }
        function poserNiveau(bouton) {
            niveauChoisi = bouton.getAttribute("data-niveau");
            document.getElementById("cerveau-pic").textContent = bouton.getAttribute("data-pic");
            document.getElementById("cerveau-nom").textContent = bouton.getAttribute("data-nom");
            menuCerveau.querySelectorAll(".choix").forEach(function (c) {
                c.setAttribute("aria-pressed", c === bouton ? "true" : "false");
            });
            try { localStorage.setItem("samii.niveau", niveauChoisi); } catch (e) {}
        }

        // Le même chemin que le menu, appelable d'ailleurs. On cherche le
        // bouton du menu plutôt que d'écrire le niveau à la main : la pastille,
        // le nom et la coche viennent de SES attributs, que le serveur a
        // remplis depuis config/niveaux.js. Un cran absent du menu (palier qui
        // ne le propose pas) ne fait donc rien du tout, ce qui est le bon repli.
        monterNiveau = function (id) {
            var b = menuCerveau.querySelector('.choix[data-niveau="' + id + '"]');
            if (b) poserNiveau(b);
        };

        cerveau.addEventListener("click", function () {
            var ouvert = !menuCerveau.hidden;
            menuCerveau.hidden = ouvert;
            cerveau.setAttribute("aria-expanded", ouvert ? "false" : "true");
        });
        menuCerveau.addEventListener("click", function (e) {
            var b = e.target.closest(".choix");
            if (!b) return;
            poserNiveau(b);
            fermerCerveau();
            if (champ) champ.focus();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !menuCerveau.hidden) { fermerCerveau(); cerveau.focus(); }
        });
        document.addEventListener("mousedown", function (e) {
            if (menuCerveau.hidden) return;
            if (!menuCerveau.contains(e.target) && e.target !== cerveau && !cerveau.contains(e.target)) {
                fermerCerveau();
            }
        });

        // Le choix de la dernière fois, s'il existe encore dans le menu.
        try {
            var garde = localStorage.getItem("samii.niveau");
            if (garde) {
                var b = menuCerveau.querySelector('.choix[data-niveau="' + garde + '"]');
                if (b) poserNiveau(b);
            }
        } catch (e) {}
    }

    // ⚠️ LA PASTILLE DU SOLDE EST RENDUE PAR LE SERVEUR, PAS PAR UN FETCH.
    //
    // Première version : un `fetch("/recharge/etat")`. Cette route N'EXISTE
    // PAS. L'appel échouait en silence, la pastille gardait son tiret pour
    // toujours, et rien n'aurait signalé qu'on appelait une API imaginaire.
    // Le solde part maintenant avec les espaces, en une seule lecture — voir
    // `espacesDe()` dans index.js.

    // ══ COMPRENDRE LES CRÉDITS ══════════════════════════════════════════
    //
    // « Ça va me coûter combien ? » est la question qui arrête les gens juste
    // avant d'essayer. La réponse tient dans une feuille déjà rendue par le
    // serveur : aucun appel réseau, aucune dépendance, rien à charger.
    //
    // Deux entrées mènent au même endroit — la barre latérale et le lien sous
    // le champ — parce que la question se pose à deux moments différents :
    // en explorant, et juste avant d'envoyer.
    var voile = document.getElementById("voile-tarifs");
    if (voile) {
        var rendreLa = null;   // à qui rendre le focus en fermant

        function ouvrirTarifs(e) {
            if (e) e.preventDefault();
            rendreLa = document.activeElement;
            voile.hidden = false;
            // Le fond ne défile plus derrière la feuille : sur mobile, deux
            // zones qui défilent l'une sur l'autre donnent l'impression que
            // la page est cassée.
            document.body.style.overflow = "hidden";
            var fermer = document.getElementById("fermer-tarifs");
            if (fermer) fermer.focus();
        }

        function fermerTarifs() {
            voile.hidden = true;
            document.body.style.overflow = "";
            // On RAMÈNE le focus d'où il venait. Sans ça, quelqu'un qui
            // navigue au clavier se retrouve renvoyé en haut de page et doit
            // tout reparcourir — c'est le genre de détail qui fait qu'une
            // interface est utilisable ou non.
            if (rendreLa && rendreLa.focus) rendreLa.focus();
            rendreLa = null;
        }

        ["ouvrir-tarifs", "lien-tarifs"].forEach(function (id) {
            var b = document.getElementById(id);
            if (b) b.addEventListener("click", ouvrirTarifs);
        });
        var fermer = document.getElementById("fermer-tarifs");
        if (fermer) fermer.addEventListener("click", fermerTarifs);

        // Cliquer à côté ferme. Mais SEULEMENT à côté : un clic qui part sur
        // le contenu et finit sur le voile (une sélection de texte, par
        // exemple) ne doit pas fermer la feuille.
        voile.addEventListener("mousedown", function (e) {
            if (e.target === voile) fermerTarifs();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !voile.hidden) fermerTarifs();
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // CE QUE SAMII SAIT DE TOI — directives, connaissances, résumé, reprise
    // ══════════════════════════════════════════════════════════════════════
    //
    // Ces quatre-là existaient, complètes et testées, sur /samii — la page de
    // l'assistant, rangée en rang `avance` dans la colonne du QG, c'est-à-dire
    // derrière un bouton « Plus ». La porte d'entrée du produit, elle, ne les
    // avait pas. Quelqu'un qui paie tombait donc sur la version diminuée, et
    // la version complète était à deux clics qu'il ne savait pas devoir faire.
    //
    // ⚠️ TOUT EST DERRIÈRE `CONNECTE`, et ce n'est pas une précaution de
    // façade : les quatre routes sont derrière `requireAuth`. Montrer les
    // boutons à un visiteur sans compte lui donnerait quatre commandes qui
    // répondent 302. Le gabarit ne rend même pas le balisage — un visiteur,
    // et Googlebot avec lui, reçoit exactement la page d'avant.
    if (CONNECTE) {

        // ── LA REPRISE ───────────────────────────────────────────────────
        //
        // Sans elle, fermer l'onglet effaçait la conversation À L'ÉCRAN alors
        // qu'elle était intacte en base (samii_conversations). SAMII se
        // souvenait, la page non : on revenait sur un écran vide en croyant
        // avoir tout perdu.
        //
        // On ne rejoue PAS l'animation d'ouverture : une conversation reprise
        // n'est pas une conversation qui commence.
        function reprendre() {
            var url = "/api/chat/historique" + (projetActif ? "?projetId=" + encodeURIComponent(projetActif) : "");
            return fetch(url)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d || !d.success || !Array.isArray(d.historique) || !d.historique.length) return;
                    rangerOuverture();
                    // Vidé nœud par nœud, pas en `innerHTML = ""`. La règle
                    // de ce bloc est ABSOLUE — aucune écriture en innerHTML —
                    // et une règle absolue se garde ; une règle « sauf pour
                    // vider » demande un test plus fin, qui laisse passer ce
                    // qu'il n'a pas prévu. Mesuré : le premier garde écrit
                    // ici acceptait `= ""` et acceptait aussi le reste, par
                    // rétro-action du motif.
                    while (colonne.firstChild) colonne.removeChild(colonne.firstChild);
                    historique.length = 0;
                    d.historique.forEach(function (m) {
                        var estMoi = m.role === "user";
                        if (estMoi) { direMoi(m.message, null); }
                        else {
                            var t = bloc("tour");
                            var p = elem("div", "pastille");
                            var b = elem("div", "bulle", m.message);
                            t.appendChild(p); t.appendChild(b);
                        }
                        historique.push({ role: estMoi ? "user" : "model", message: m.message });
                    });
                    defiler();
                })
                .catch(function () { /* une reprise ratée laisse un écran vide, pas une erreur */ });
        }
        reprendre();

        // Changer de projet change de conversation : le fil doit suivre,
        // sinon on écrit dans un projet en lisant les messages d'un autre.
        document.querySelectorAll(".sortie--projet").forEach(function (b) {
            b.addEventListener("click", function () { setTimeout(reprendre, 0); });
        });

        // ── LES PANNEAUX ─────────────────────────────────────────────────
        //
        // Un seul mécanisme pour les deux : un bouton ouvre, un bouton ferme,
        // et l'ouverture charge une fois. Deux gestionnaires séparés auraient
        // divergé à la première retouche.
        function brancherPanneau(idBouton, idPanneau, auPremierOuvert) {
            var b = document.getElementById(idBouton);
            var p = document.getElementById(idPanneau);
            if (!b || !p) return null;
            var charge = false;
            b.addEventListener("click", function () {
                var ouvre = p.hidden;
                p.hidden = !ouvre;
                b.setAttribute("aria-expanded", ouvre ? "true" : "false");
                if (ouvre && !charge && auPremierOuvert) { charge = true; auPremierOuvert(); }
            });
            var f = p.querySelector("[data-fermer]");
            if (f) f.addEventListener("click", function () {
                p.hidden = true;
                b.setAttribute("aria-expanded", "false");
            });
            return p;
        }

        // ── DIRECTIVES PERMANENTES ───────────────────────────────────────
        //
        // Un réglage FIABLE, pas une supposition de l'IA : ce qui est écrit
        // là s'applique à chaque conversation, partout sur la plateforme
        // (voir brain/prompts/index.js). C'est la différence entre « je lui
        // ai dit une fois » et « il le sait ».
        var dirTexte = document.getElementById("dir-texte");
        var dirMsg = document.getElementById("dir-msg");
        brancherPanneau("dir-ouvrir", "dir-panneau", function () {
            fetch("/api/directives")
                .then(function (r) { return r.json(); })
                .then(function (d) { if (dirTexte) dirTexte.value = (d && d.directives) || ""; })
                .catch(function () { if (dirMsg) dirMsg.textContent = T.dirErreur || ""; });
        });
        var dirSauver = document.getElementById("dir-sauver");
        if (dirSauver) dirSauver.addEventListener("click", function () {
            dirSauver.disabled = true;
            if (dirMsg) dirMsg.textContent = "";
            fetch("/api/directives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ directives: dirTexte ? dirTexte.value : "" }),
            })
            .then(function (r) { return r.json(); })
            .then(function (d) { if (dirMsg) dirMsg.textContent = (d && d.success) ? (T.dirOk || "") : (T.dirErreur || ""); })
            .catch(function () { if (dirMsg) dirMsg.textContent = T.dirErreur || ""; })
            .then(function () { dirSauver.disabled = false; });
        });

        // ── CE QUE SAMII A LU ────────────────────────────────────────────
        //
        // Des fichiers ou du texte que SAMII retient pour de bon. Le fichier
        // part directement vers Cloudinary (voir `versCloudinary`), et seule
        // l'adresse rejoint notre serveur.
        var conListe = document.getElementById("con-liste");
        var conTitre = document.getElementById("con-titre");
        var conTexte = document.getElementById("con-texte");
        var conMsg = document.getElementById("con-msg");
        var conFichier = document.getElementById("con-fichier");
        var fichierUrl = null;
        var fichierNom = null;

        function listerConnaissances() {
            if (!conListe) return;
            conListe.textContent = T.chargement || "…";
            fetch("/api/connaissances")
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var items = (d && d.connaissances) || [];
                    conListe.textContent = "";
                    if (!items.length) { conListe.appendChild(elem("p", "con__vide", T.conVide || "")); return; }
                    items.forEach(function (it) {
                        var ligne = elem("div", "con__item");
                        // ⚠️ textContent, jamais innerHTML : ce titre vient
                        // d'un nom de fichier choisi par la personne, et un
                        // nom de fichier peut contenir du balisage.
                        ligne.appendChild(elem("span", "con__nom", it.titre || ""));
                        var x = elem("button", "con__retirer", T.retirer || "✕");
                        x.type = "button";
                        x.addEventListener("click", function () {
                            ligne.remove();
                            fetch("/api/connaissances/" + encodeURIComponent(it.id), { method: "DELETE" })
                                .catch(function () { /* la ligne est déjà partie de l'écran */ });
                        });
                        ligne.appendChild(x);
                        conListe.appendChild(ligne);
                    });
                })
                .catch(function () { conListe.textContent = T.conErreur || ""; });
        }
        brancherPanneau("con-ouvrir", "con-panneau", listerConnaissances);

        var conChoisir = document.getElementById("con-choisir");
        if (conChoisir && conFichier) {
            conChoisir.addEventListener("click", function () { conFichier.click(); });
            conFichier.addEventListener("change", function () {
                var f = conFichier.files && conFichier.files[0];
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) { if (conMsg) conMsg.textContent = T.tropLourd || ""; conFichier.value = ""; return; }
                if (conMsg) conMsg.textContent = T.conEnvoi || "";
                versCloudinary(f)
                    .then(function (url) {
                        fichierUrl = url;
                        fichierNom = f.name;
                        if (conTitre && !conTitre.value) conTitre.value = f.name;
                        if (conMsg) conMsg.textContent = T.conPret || "";
                    })
                    .catch(function () { if (conMsg) conMsg.textContent = T.envoiRate || ""; })
                    .then(function () { conFichier.value = ""; });
            });
        }

        var conAjouter = document.getElementById("con-ajouter");
        if (conAjouter) conAjouter.addEventListener("click", function () {
            var texte = conTexte ? conTexte.value.trim() : "";
            if (!fichierUrl && !texte) { if (conMsg) conMsg.textContent = T.conRien || ""; return; }
            conAjouter.disabled = true;
            if (conMsg) conMsg.textContent = T.conLecture || "";
            fetch("/api/connaissances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titre: conTitre ? conTitre.value.trim() : "",
                    fichierUrl: fichierUrl,
                    fichierNom: fichierNom,
                    texte: fichierUrl ? null : texte,
                }),
            })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.success) {
                    if (conMsg) conMsg.textContent = T.conRetenu || "";
                    if (conTexte) conTexte.value = "";
                    if (conTitre) conTitre.value = "";
                    fichierUrl = null; fichierNom = null;
                    listerConnaissances();
                } else if (conMsg) {
                    conMsg.textContent = (d && d.error) || T.conErreur || "";
                }
            })
            .catch(function () { if (conMsg) conMsg.textContent = T.conErreur || ""; })
            .then(function () { conAjouter.disabled = false; });
        });

        // ── LE RÉSUMÉ ────────────────────────────────────────────────────
        //
        // Un condensé de la semaine, posé dans le fil ET copié. Il sert à
        // repartir d'où l'on s'est arrêté plutôt que de tout réexpliquer.
        var resume = document.getElementById("resume");
        if (resume) resume.addEventListener("click", function () {
            if (occupe) return;
            resume.disabled = true;
            if (cote) cote.classList.remove("ouverte");
            rangerOuverture();
            var cible = attendre();
            fetch("/api/samii-resume", { method: "POST" })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var texte = (d && d.success && d.resume)
                        ? (T.resumeTitre || "") + "\n\n" + d.resume
                        : ((d && d.message) || T.resumeRate || "");
                    var b = ouvrirBulle(cible);
                    reveler(b, texte, function () { terminer("", {}); });
                    if (d && d.resume && navigator.clipboard) {
                        navigator.clipboard.writeText(d.resume).catch(function () { /* copie refusée : le texte est dans le fil */ });
                    }
                })
                .catch(function () {
                    var b = ouvrirBulle(cible);
                    reveler(b, T.resumeRate || "", function () { terminer("", {}); });
                })
                .then(function () { resume.disabled = false; });
        });
    }
})();
