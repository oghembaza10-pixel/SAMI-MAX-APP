// ==========================================================================
// SAMII OS — Le flux du QG coûte-t-il plus cher que la réponse d'un bloc ?
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE.
//
// Streamer une réponse qui peut appeler un outil est le genre de chose qu'on
// fait naïvement en DEUX appels : un premier sans flux pour voir si le modèle
// veut un outil, un second en flux pour le texte. Ça marche parfaitement, ça
// ne casse rien, ça ne prévient personne — et ça double la facture d'IA de
// tous les messages du QG.
//
// On COMPTE donc les appels réellement partis, dans les deux chemins, et on
// exige qu'ils soient identiques. C'est la seule façon de le savoir : lire le
// code ne le prouve pas, et la facture arrive un mois trop tard.
//
// On vérifie aussi que le flux ne facture pas davantage. Un tour reste un
// tour : un message, plus les actes réussis.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

// La clé AVANT tout require : geminiService lit la liste des clés au
// CHARGEMENT du module. Posée après, elle arrive trop tard — la liste est
// vide, la rotation n'essaie personne, et tout part sur les relais. C'est ce
// qui s'est passé au premier essai, et la suite mesurait alors le repli au
// lieu de mesurer le flux.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "cle-essai-flux";

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── LA DOUBLURE DU RÉSEAU ────────────────────────────────────────────────
//
// On remplace UNIQUEMENT axios : tout le reste — construction du corps,
// choix des outils, profondeur, planner — est le vrai code. Chaque POST est
// compté, avec son mode (flux ou bloc).
const appels = [];
let scenario = "texte";      // "texte" | "outil"

function fluxSSE(morceaux) {
    // Un vrai flux Gemini : des lignes « data: {…} » séparées par des lignes
    // vides. On le rend comme un itérable asynchrone, comme axios le ferait.
    return {
        async *[Symbol.asyncIterator]() {
            for (const m of morceaux) yield Buffer.from(`data: ${JSON.stringify(m)}\n\n`, "utf8");
        },
    };
}

const axiosDouble = {
    post: async (url, body, options) => {
        const flux = Boolean(options?.responseType === "stream");
        appels.push({ flux, avecOutils: Boolean(body?.tools), url: String(url).split("?")[0] });

        if (!flux) {
            // Le chemin d'un bloc.
            if (scenario === "outil" && appels.filter((a) => !a.flux).length === 1) {
                return { data: { candidates: [{ content: { parts: [
                    { functionCall: { name: "consulter_agenda", args: {} }, thoughtSignature: "sig" },
                ] } }] } };
            }
            return { data: { candidates: [{ content: { parts: [{ text: "Voici ta réponse." }] } }] } };
        }

        // Le chemin en flux.
        if (scenario === "outil") {
            // LE CAS RÉALISTE : le modèle commence souvent par un préambule
            // (« Je regarde ça… ») AVANT d'émettre l'appel d'outil. Ce texte
            // ne doit jamais atteindre l'écran : la vraie réponse le
            // remplacerait, et SAMII aurait l'air de se contredire.
            return { data: fluxSSE([
                { candidates: [{ content: { parts: [{ text: "Je regarde ça…" }] } }] },
                { candidates: [{ content: { parts: [
                    { functionCall: { name: "consulter_agenda", args: {} }, thoughtSignature: "sig" },
                ] } }] },
            ]) };
        }
        return { data: fluxSSE([
            { candidates: [{ content: { parts: [{ text: "Voici " }] } }] },
            { candidates: [{ content: { parts: [{ text: "ta réponse." }] } }] },
        ]) };
    },
    get: async () => ({ data: {} }),
    // services/google.js crée sa propre instance. Sans ça, il tombe au
    // chargement et emporte le planner avec lui.
    create: () => axiosDouble,
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
};

const Module = require("module");
const vrai = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "axios") return axiosDouble;
    return vrai.apply(this, arguments);
};
for (const m of ["services/geminiService.js", "brain/planner.js"]) {
    delete require.cache[require.resolve(path.join(RACINE, m))];
}
const planner = require(path.join(RACINE, "brain", "planner.js"));
Module.prototype.require = vrai;

const CONTEXTE = { audience: "souverain", niveau: "expert", identite: { userId: "u1" } };

(async () => {
    // ── 1. SANS OUTIL : UN SEUL APPEL, DES DEUX CÔTÉS ────────────────────
    {
        scenario = "texte";

        appels.length = 0;
        const bloc = await planner.build({ goal: "Bonjour" }, CONTEXTE, []);
        const appelsBloc = appels.length;

        appels.length = 0;
        const morceaux = [];
        const flux = await planner.buildFlux({ goal: "Bonjour" }, CONTEXTE, [], (m) => morceaux.push(m));
        const appelsFlux = appels.length;

        verifier(appelsBloc === 1, `la réponse d'un bloc a fait ${appelsBloc} appel(s) au lieu de 1`);
        verifier(appelsFlux === appelsBloc,
            `LE FLUX COÛTE PLUS CHER : ${appelsFlux} appels contre ${appelsBloc} sans flux. ` +
            "Chaque message du QG serait facturé double, et rien ne le signalerait");

        // Et il a bien streamé : plusieurs morceaux, pas un bloc déguisé.
        verifier(morceaux.length >= 2,
            `le flux n'a émis que ${morceaux.length} morceau(x) : ce n'est pas du streaming, ` +
            "c'est la réponse entière envoyée d'un coup");
        verifier(morceaux.join("") === flux.reply,
            `ce qui a été streamé (« ${morceaux.join("")} ») ne fait pas la réponse finale ` +
            `(« ${flux.reply} ») : la personne verrait le texte changer sous ses yeux`);
        verifier(bloc.reply === flux.reply,
            "les deux chemins ne rendent pas la même réponse");
    }

    // ── 2. AVEC OUTIL : DEUX APPELS, DES DEUX CÔTÉS ──────────────────────
    //
    // Décider, puis formuler. C'est ce que le chemin sans flux fait déjà
    // aujourd'hui : le flux ne doit pas en ajouter un troisième.
    {
        scenario = "outil";

        appels.length = 0;
        const bloc = await planner.build({ goal: "Regarde mon agenda" }, CONTEXTE, []);
        const appelsBloc = appels.length;

        appels.length = 0;
        const morceaux = [];
        let reprises = 0;
        const flux = await planner.buildFlux({ goal: "Regarde mon agenda" }, CONTEXTE, [],
            (m) => morceaux.push(m), () => { reprises++; });
        const appelsFlux = appels.length;

        verifier(appelsBloc === 2, `avec outil, le chemin d'un bloc a fait ${appelsBloc} appel(s) au lieu de 2`);
        verifier(appelsFlux === appelsBloc,
            `AVEC OUTIL, LE FLUX COÛTE PLUS CHER : ${appelsFlux} appels contre ${appelsBloc}`);

        // L'acte est bien rapporté des deux côtés — sans quoi la facturation
        // des actes, elle, deviendrait muette dans le flux.
        verifier(bloc.actes.length === 1 && flux.actes.length === 1,
            `l'acte n'est pas rapporté pareil : ${bloc.actes.length} sans flux, ${flux.actes.length} en flux — ` +
            "la facturation des actes deviendrait muette d'un côté");
        verifier(flux.actes[0].nom === "consulter_agenda",
            `l'acte rapporté en flux est « ${flux.actes[0]?.nom} »`);

        // ── LE PRÉAMBULE DOIT ÊTRE EFFACÉ ────────────────────────────────
        //
        // Trouvé en cassant la garde précédente : le modèle commence souvent
        // par « Je regarde ça… » AVANT d'émettre l'appel d'outil, et ce texte
        // atteignait l'écran. Il n'est pas la réponse — la vraie arrive après
        // l'outil. Sans signal, il resterait affiché pendant tout le temps de
        // l'outil puis disparaîtrait d'un coup : SAMII aurait l'air de se
        // contredire.
        verifier(reprises === 1,
            `${reprises} signal(aux) d'effacement alors qu'un préambule a été streamé puis ` +
            "remplacé par un outil : la personne verrait une phrase qui s'annule toute seule");
    }

    // ── 3. LE NIVEAU PART BIEN AU MOTEUR, DANS LES DEUX CHEMINS ──────────
    {
        scenario = "texte";

        appels.length = 0;
        await planner.build({ goal: "Bonjour" }, { ...CONTEXTE, niveau: "rapide" }, []);
        const outilsBloc = appels[0]?.avecOutils;

        appels.length = 0;
        await planner.buildFlux({ goal: "Bonjour" }, { ...CONTEXTE, niveau: "rapide" }, [], () => {});
        const outilsFlux = appels[0]?.avecOutils;

        verifier(outilsBloc === false,
            "le niveau Rapide envoie quand même des outils au moteur (chemin d'un bloc)");
        verifier(outilsFlux === false,
            "le niveau Rapide envoie des outils au moteur EN FLUX : le niveau ne serait pas " +
            "appliqué du tout sur ce chemin");

        appels.length = 0;
        await planner.buildFlux({ goal: "Regarde mon agenda" }, { ...CONTEXTE, niveau: "expert" }, [], () => {});
        verifier(appels[0]?.avecOutils === true,
            "le niveau Expert n'envoie aucun outil en flux : la lecture de l'agenda serait impossible");
    }

    // ── 4. LE FLUX NE FACTURE PAS DAVANTAGE ──────────────────────────────
    //
    // Un tour reste un tour : un message, plus les actes réussis. Le
    // transport n'entre pas dans la facture.
    {
        const CREDITS = require(path.join(RACINE, "config", "credits.js"));
        const sansOutil = CREDITS.factureDuTour([]);
        const avecOutil = CREDITS.factureDuTour([{ nom: "consulter_agenda", reussi: true }]);
        verifier(sansOutil.montant === avecOutil.montant,
            "lire son propre agenda est facturé en supplément — ce n'est pourtant qu'une lecture");

        const api = require("fs").readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
        // Un SEUL endroit facture, et les deux routes y passent : deux
        // facturations séparées finiraient par ne plus compter pareil.
        const debits = (api.match(/creditsSamii\.debiterTour\(/g) || []).length;
        verifier(debits === 1,
            `routes/api.js facture à ${debits} endroits : le flux et le bloc finiraient par ` +
            "ne plus compter la même chose");
        verifier(/async function conduireLeTour/.test(api),
            "les deux routes ne partagent plus la même conduite du tour : l'une des deux " +
            "oubliera un jour de vérifier le quota, ou de facturer, ou d'enregistrer la mémoire");
    }

    if (echecs.length) {
        console.log(`\n❌ flux QG : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ flux QG : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ flux QG : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
