// ==========================================================================
// SAMII OS — LA VOIX DE SAMII (sortie)
//
// POURQUOI CE FICHIER EXISTE. `POST /api/speak` existait depuis des mois et
// AUCUNE page ne l'appelait. SAMII pouvait donc parler, et personne ne
// l'avait jamais entendu. Ce fichier est le fil qui manquait.
//
// ── POURQUOI TROIS FOURNISSEURS ET PAS UN ───────────────────────────────
//
// Parce qu'aucun ne tient tout seul :
//
//   Kokoro      belle voix, 0 €, tourne CHEZ CELUI QUI ÉCOUTE — mais il
//               faut télécharger ~80 Mo la première fois. Sur une connexion
//               lente, le premier mot se ferait attendre une minute.
//   Navigateur  moche, mais instantané, zéro octet, présent partout depuis
//               dix ans. C'est le filet.
//   ElevenLabs  la plus belle, et payante. Le code existe déjà
//               (services/elevenlabs.js) et dort faute de clé.
//
// L'ordre est donc : on parle TOUT DE SUITE avec le navigateur, on charge
// Kokoro en arrière-plan, et on passe à Kokoro dès qu'il est prêt. Personne
// n'attend, et la voix s'améliore toute seule en cours de route.
//
// ── LE POINT D'ARCHITECTURE ─────────────────────────────────────────────
//
// Ce fichier ne sait RIEN de SAMII. Il reçoit du texte, il le dit. Le
// cerveau (brain/planner + geminiService) n'a pas connaissance de la voix,
// et la voix n'a pas connaissance du cerveau. C'est ce qui permet d'ajouter
// un quatrième fournisseur demain sans ouvrir un seul fichier du cerveau —
// exactement comme la cascade Gemini → Groq → OpenRouter → DeepSeek.
// ==========================================================================
(function (global) {
    "use strict";

    // Le CDN autorisé pour les modules du navigateur. On épingle une
    // version : « latest » veut dire que la voix de SAMII peut changer un
    // matin sans que personne n'ait rien déployé.
    const KOKORO_MODULE = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";
    const KOKORO_MODELE = "onnx-community/Kokoro-82M-v1.0-ONNX";
    // q8 : le meilleur compromis poids/qualité. fp32 pèse quatre fois plus
    // pour une différence qu'on n'entend pas sur un haut-parleur de
    // téléphone.
    const KOKORO_PRECISION = "q8";

    const etat = {
        fournisseur: "navigateur",
        kokoro: null,
        kokoroEnCours: false,
        kokoroEchoue: false,
        // null = pas encore demandé, true/false = réponse du serveur.
        // Retenu pour ne pas refaire un aller-retour réseau avant chaque
        // phrase sur un serveur où Piper n'est pas installé.
        piper: null,
        parle: false,
        actif: false,          // l'utilisateur a-t-il allumé la voix ?
        audio: null,
        voixNavigateur: null,
    };

    const ecouteurs = [];
    function prevenir(evenement, charge) {
        ecouteurs.forEach((fn) => {
            try { fn(evenement, charge); } catch (err) { console.warn("voix:", err); }
        });
    }

    // ── LE TEXTE QU'ON DIT N'EST PAS LE TEXTE QU'ON AFFICHE ─────────────
    //
    // SAMII répond en markdown : des astérisques, des puces, parfois un
    // bloc de code. Lu tel quel, ça donne « étoile étoile commandes étoile
    // étoile ». Et un bloc de code lu à voix haute est une minute perdue.
    function pourLOreille(texte) {
        return String(texte || "")
            .replace(/```[\s\S]*?```/g, " (je te mets le code à l'écran) ")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[*_#>|]/g, " ")
            .replace(/^\s*[-–—]\s*/gm, ", ")
            .replace(/https?:\/\/\S+/g, " un lien ")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    // ── FOURNISSEUR 1 : LE NAVIGATEUR (le filet) ────────────────────────
    function navigateurDisponible() {
        return typeof global.speechSynthesis !== "undefined"
            && typeof global.SpeechSynthesisUtterance !== "undefined";
    }

    // Les voix arrivent de façon asynchrone sur Chrome : au premier appel la
    // liste est souvent vide, et elle se remplit une fraction de seconde
    // plus tard. Sans cette attente, SAMII parle anglais au premier
    // message et français à partir du deuxième.
    // ── SAMII EST UN « IL » ─────────────────────────────────────────────
    //
    // « Elle parle avec une voix féminine alors que SAMII c'est un
    //   masculin. »
    //
    // L'API des navigateurs ne dit PAS le genre d'une voix : il n'y a ni
    // champ, ni convention. Il n'y a que le nom. On tient donc deux listes,
    // construites sur les voix françaises réellement livrées par les
    // systèmes courants — Thomas sur Apple, Paul et Claude sur Windows,
    // Google français sur Android/Chrome (féminine).
    //
    // Ces listes seront incomplètes un jour ou l'autre : un système sortira
    // une voix qu'on ne connaît pas. D'où le troisième niveau — à défaut de
    // masculin identifié, on prend une voix française qui n'est PAS
    // reconnue comme féminine, plutôt que la première venue. Se tromper en
    // silence vers le neutre vaut mieux que se tromper vers le féminin.
    const MASCULINES_FR = /thomas|paul|claude|henri|nicolas|guillaume|mathieu|daniel|yannick|jacques|pierre|antoine|male|homme/i;
    const FEMININES_FR  = /am[ée]lie|audrey|marie|virginie|hortense|julie|chantal|c[ée]line|siwis|charlotte|louise|female|femme|google fran[çc]ais/i;

    function choisirVoixNavigateur() {
        const voix = global.speechSynthesis.getVoices() || [];
        if (!voix.length) return null;
        const fr = voix.filter((v) => (v.lang || "").toLowerCase().startsWith("fr"));
        if (!fr.length) return null;
        // 1. Un masculin nommé, et de préférence de bonne qualité.
        const masculines = fr.filter((v) => MASCULINES_FR.test(v.name));
        if (masculines.length) {
            return masculines.find((v) => /natural|enhanced|premium|neural/i.test(v.name)) || masculines[0];
        }
        // 2. À défaut, tout sauf un féminin connu.
        const neutres = fr.filter((v) => !FEMININES_FR.test(v.name));
        if (neutres.length) return neutres[0];
        // 3. Il ne reste que du féminin : mieux que le silence.
        return fr[0];
    }

    // Le navigateur a-t-il vraiment une voix masculine française ? La
    // réponse décide de l'ordre des fournisseurs, plus bas.
    function navigateurAUnHomme() {
        if (!navigateurDisponible()) return false;
        return (global.speechSynthesis.getVoices() || [])
            .some((v) => (v.lang || "").toLowerCase().startsWith("fr") && MASCULINES_FR.test(v.name));
    }

    // ── LE BUG QUI FAISAIT PARLER UNE FEMME ─────────────────────────────
    //
    // `getVoices()` renvoie une LISTE VIDE au premier appel sur Chrome et
    // Edge : le système charge ses voix de façon asynchrone et prévient
    // ensuite par l'événement `voiceschanged`. Personne ne l'écoutait.
    //
    // Conséquence, et elle tombait toujours au pire moment : au tout premier
    // message — celui du bouton « Voix active » — la liste était vide, aucune
    // voix n'était posée sur l'énoncé, et le navigateur prenait SA voix par
    // défaut. Qui est féminine sur la plupart des systèmes. Le choix
    // masculin écrit juste au-dessus ne servait à rien tant qu'il n'avait
    // rien à choisir.
    //
    // On attend donc la liste. Une seconde au maximum : passé ce délai, un
    // système qui n'a rien annoncé n'a probablement rien à annoncer, et
    // mieux vaut une voix par défaut que le silence.
    let voixPretes = null;
    function attendreLesVoix() {
        if (voixPretes) return voixPretes;
        voixPretes = new Promise((resoudre) => {
            if (!navigateurDisponible()) return resoudre();
            if ((global.speechSynthesis.getVoices() || []).length) return resoudre();
            let fini = false;
            const finir = () => { if (!fini) { fini = true; resoudre(); } };
            try { global.speechSynthesis.addEventListener("voiceschanged", finir, { once: true }); }
            catch { /* vieux navigateur sans addEventListener sur cet objet */ }
            setTimeout(finir, 1000);
        });
        return voixPretes;
    }

    async function parlerNavigateur(texte) {
        if (!navigateurDisponible()) return false;
        await attendreLesVoix();
        return new Promise((resoudre) => {
            global.speechSynthesis.cancel();
            const dire = new global.SpeechSynthesisUtterance(texte);
            dire.lang = "fr-FR";
            dire.rate = 1.02;
            const voix = etat.voixNavigateur || choisirVoixNavigateur();
            if (voix) { etat.voixNavigateur = voix; dire.voice = voix; }

            // ── QUAND IL N'Y A AUCUNE VOIX MASCULINE ────────────────────
            //
            // Sur Android il n'existe souvent qu'une seule voix française,
            // et elle est féminine. On ne peut pas la remplacer — mais on
            // peut la descendre. Un pitch à 0,72 rend une voix nettement
            // plus grave, et c'est la différence entre « ça ne va pas » et
            // « ça passe ».
            //
            // Ce n'est PAS une vraie voix d'homme, et il ne faut pas le
            // prétendre : c'est le moins mauvais choix là où le système ne
            // propose rien d'autre. Là où un masculin existe, on n'y touche
            // pas — le baisser rendrait Thomas caverneux.
            const estMasculine = voix && MASCULINES_FR.test(voix.name);
            dire.pitch = estMasculine ? 1 : 0.72;

            dire.onend = () => resoudre(true);
            dire.onerror = () => resoudre(false);
            global.speechSynthesis.speak(dire);
        });
    }

    // ── FOURNISSEUR 2 : KOKORO (0 €, dans le navigateur) ────────────────
    //
    // WebGPU si la machine l'a, WASM sinon. On ne teste pas la marque du
    // navigateur — on teste la capacité : une liste de navigateurs se
    // périme, une capacité non.
    async function chargerKokoro() {
        if (etat.kokoro || etat.kokoroEnCours || etat.kokoroEchoue) return etat.kokoro;
        etat.kokoroEnCours = true;
        prevenir("voix-chargement", { fournisseur: "kokoro" });
        try {
            const { KokoroTTS } = await import(KOKORO_MODULE);
            const appareil = global.navigator?.gpu ? "webgpu" : "wasm";
            etat.kokoro = await KokoroTTS.from_pretrained(KOKORO_MODELE, {
                dtype: KOKORO_PRECISION,
                device: appareil,
            });
            etat.fournisseur = "kokoro";
            prevenir("voix-prete", { fournisseur: "kokoro", appareil });
            return etat.kokoro;
        } catch (err) {
            // Pas de nouvelle tentative : si le module ne charge pas, il ne
            // chargera pas davantage au message suivant, et réessayer à
            // chaque phrase transformerait une gêne en blocage.
            etat.kokoroEchoue = true;
            console.warn("🔇 Kokoro indisponible, on reste sur la voix du navigateur :", err.message);
            prevenir("voix-repli", { raison: err.message });
            return null;
        } finally {
            etat.kokoroEnCours = false;
        }
    }

    function parlerKokoro(texte) {
        return new Promise(async (resoudre) => {
            try {
                // Voix française de Kokoro. Une seule est publiée à ce jour ;
                // le jour où il y en a d'autres, c'est ici que ça se choisit
                // — et par communauté (config/communautes.js a déjà le champ
                // `assistant`), pas en dur.
                const audio = await etat.kokoro.generate(texte, { voice: "ff_siwis" });
                const blob = audio.toBlob();
                const url = URL.createObjectURL(blob);
                const lecteur = new Audio(url);
                etat.audio = lecteur;
                lecteur.onended = () => { URL.revokeObjectURL(url); resoudre(true); };
                lecteur.onerror = () => { URL.revokeObjectURL(url); resoudre(false); };
                await lecteur.play();
            } catch (err) {
                console.warn("🔇 Kokoro a échoué sur cette phrase :", err.message);
                resoudre(false);
            }
        });
    }

    // ── FOURNISSEUR 3 : ELEVENLABS (payant, dort sans clé) ──────────────
    // ── PIPER : UNE VRAIE VOIX D'HOMME, SYNTHÉTISÉE SUR LE SERVEUR ──────
    //
    // Le seul fournisseur qui donne un homme français là où le téléphone
    // n'en a aucun — le cas d'Android, donc le cas le plus courant chez la
    // marchande à Douala.
    //
    // `etat.piper` retient le résultat : `null` tant qu'on n'a pas essayé,
    // puis `true`/`false`. Sans ça, un serveur sans Piper installé se
    // ferait interroger à chaque phrase pour la même réponse — un
    // aller-retour réseau inutile avant CHAQUE mot, sur une connexion
    // mobile.
    async function parlerPiper(texte) {
        if (etat.piper === false) return false;
        try {
            const rep = await fetch("/api/voix/piper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: texte }),
            });
            // Piper renvoie du WAV brut quand il a réussi, du JSON quand il
            // décline. Le type de contenu tranche, pas une devinette sur le
            // corps.
            if (!rep.ok || !(rep.headers.get("content-type") || "").includes("audio")) {
                etat.piper = false;
                return false;
            }
            etat.piper = true;
            const url = URL.createObjectURL(await rep.blob());
            return await new Promise((resoudre) => {
                const lecteur = new Audio(url);
                etat.audio = lecteur;
                // On rend la mémoire dans les deux cas : sans ça, chaque
                // phrase laisse un blob derrière elle et l'onglet grossit
                // pendant toute la conversation.
                const finir = (ok) => { URL.revokeObjectURL(url); resoudre(ok); };
                lecteur.onended = () => finir(true);
                lecteur.onerror = () => finir(false);
                lecteur.play().catch(() => finir(false));
            });
        } catch {
            // Une panne réseau n'est pas une preuve que Piper est absent :
            // on ne met pas `etat.piper` à false ici, sinon une coupure de
            // trois secondes éteindrait la voix pour toute la session.
            return false;
        }
    }

    async function parlerElevenLabs(texte) {
        try {
            const rep = await fetch("/api/speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: texte }),
            });
            const data = await rep.json();
            if (!data.success || !data.audio) return false;
            return await new Promise((resoudre) => {
                const lecteur = new Audio(data.audio);
                etat.audio = lecteur;
                lecteur.onended = () => resoudre(true);
                lecteur.onerror = () => resoudre(false);
                lecteur.play().catch(() => resoudre(false));
            });
        } catch {
            return false;
        }
    }

    // ── L'API PUBLIQUE ──────────────────────────────────────────────────

    async function parler(texte) {
        const dire = pourLOreille(texte);
        if (!dire || !etat.actif) return false;

        stop();
        etat.parle = true;
        prevenir("parle-debut", { texte: dire });

        // ── L'ORDRE DÉPEND DU GENRE, PAS DE LA QUALITÉ ─────────────────
        //
        // Kokoro n'a QU'UNE voix française, et elle est féminine : dans
        // « ff_siwis », le second f veut dire female. Il n'existe pas de
        // voix masculine française dans ce modèle — vérifié, ce n'est pas
        // un réglage qu'on aurait raté.
        //
        // Or SAMII est un « il ». Une belle voix qui n'est pas la sienne
        // vaut moins qu'une voix plus synthétique qui l'est. Quand le
        // navigateur a un vrai masculin français, il passe donc DEVANT
        // Kokoro. Sinon Kokoro reprend la tête, faute de mieux.
        //
        // Le jour où Kokoro publie une voix « fm_… », il suffira de
        // l'ajouter et de retirer cette inversion.
        // On attend la liste AVANT de décider qui parle : sans ça,
        // `navigateurAUnHomme()` répondait non au premier message — la liste
        // étant vide — et laissait Kokoro, qui n'a qu'une voix française et
        // féminine, prendre la main. La décision se prenait donc toujours
        // sur une information absente.
        await attendreLesVoix();

        let dit = false;
        if (navigateurAUnHomme()) {
            dit = await parlerNavigateur(dire);
            if (!dit && etat.kokoro) dit = await parlerKokoro(dire);
        } else {
            // ── AUCUN MASCULIN SUR CE SYSTÈME ───────────────────────────
            //
            // C'est le cas d'Android, donc le plus courant chez la
            // marchande. Avant, on n'avait ici que des mauvais choix :
            // Kokoro n'a qu'une voix française et elle est féminine, et le
            // navigateur ne pouvait offrir qu'une voix descendue au grave.
            // On prenait la seconde — pas parce qu'elle était bonne, mais
            // parce qu'elle était LA SIENNE.
            //
            // Piper change ça : c'est une vraie voix d'homme, synthétisée
            // sur notre serveur, qui ne demande RIEN au téléphone. Il passe
            // donc en premier ici — et seulement ici. Là où le système a
            // déjà un Paul ou un Thomas, on ne va pas faire travailler le
            // serveur pour faire moins bien.
            //
            // S'il n'est pas installé, il décline en un aller-retour et on
            // retombe exactement sur le comportement d'avant.
            dit = await parlerPiper(dire);
            if (!dit) dit = await parlerNavigateur(dire);
            if (!dit && etat.kokoro) dit = await parlerKokoro(dire);
        }
        if (!dit) dit = await parlerElevenLabs(dire);
        if (!dit) dit = await parlerNavigateur(dire);

        etat.parle = false;
        prevenir("parle-fin", { reussi: dit });
        return dit;
    }

    function stop() {
        if (navigateurDisponible()) global.speechSynthesis.cancel();
        if (etat.audio) { try { etat.audio.pause(); } catch { /* déjà arrêté */ } etat.audio = null; }
        etat.parle = false;
    }

    // Allumer la voix est un GESTE DE L'UTILISATEUR, et ça n'est pas un
    // détail d'ergonomie : les navigateurs refusent de jouer un son tant que
    // personne n'a cliqué sur la page. Charger Kokoro ici, au clic, c'est
    // aussi ne rien télécharger chez quelqu'un qui ne veut pas de voix.
    function activer() {
        etat.actif = true;
        prevenir("voix-activee", {});
        chargerKokoro();
        return true;
    }

    function desactiver() {
        etat.actif = false;
        stop();
        prevenir("voix-desactivee", {});
    }

    global.VoixSortie = {
        parler,
        stop,
        activer,
        desactiver,
        estActive: () => etat.actif,
        parleEnCeMoment: () => etat.parle,
        fournisseur: () => (navigateurAUnHomme() ? "navigateur (voix masculine)"
            : etat.kokoro ? "kokoro (féminine, faute de masculin français)" : "navigateur"),
        // Exposé pour pouvoir vérifier le choix depuis un test ou la console.
        voixRetenue: () => choisirVoixNavigateur(),
        disponible: () => navigateurDisponible() || typeof Audio !== "undefined",
        surEvenement: (fn) => { if (typeof fn === "function") ecouteurs.push(fn); },
        pourLOreille,
    };
})(window);
