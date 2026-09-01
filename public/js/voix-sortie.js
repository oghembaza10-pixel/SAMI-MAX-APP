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
    function choisirVoixNavigateur() {
        const voix = global.speechSynthesis.getVoices() || [];
        if (!voix.length) return null;
        const fr = voix.filter((v) => (v.lang || "").toLowerCase().startsWith("fr"));
        return fr.find((v) => /google|natural|enhanced|premium/i.test(v.name)) || fr[0] || null;
    }

    function parlerNavigateur(texte) {
        return new Promise((resoudre) => {
            if (!navigateurDisponible()) return resoudre(false);
            global.speechSynthesis.cancel();
            const dire = new global.SpeechSynthesisUtterance(texte);
            dire.lang = "fr-FR";
            dire.rate = 1.02;
            dire.pitch = 1;
            const voix = etat.voixNavigateur || choisirVoixNavigateur();
            if (voix) { etat.voixNavigateur = voix; dire.voice = voix; }
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

        let dit = false;
        // Kokoro s'il est déjà chargé — jamais en l'attendant. Attendre
        // 80 Mo avant le premier mot, c'est un silence qu'on prend pour une
        // panne.
        if (etat.kokoro) dit = await parlerKokoro(dire);
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
        fournisseur: () => (etat.kokoro ? "kokoro" : "navigateur"),
        disponible: () => navigateurDisponible() || typeof Audio !== "undefined",
        surEvenement: (fn) => { if (typeof fn === "function") ecouteurs.push(fn); },
        pourLOreille,
    };
})(window);
