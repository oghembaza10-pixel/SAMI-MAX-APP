// ==========================================================================
// SAMII OS — La clé de secours est-elle vraiment utilisée ?
//
// POURQUOI CE TEST EXISTE. « J'ai ajouté une clé Gemini pour que SAMII tombe
// plus en panne. Après que le gratuit tombe en panne, on passe dessus, comme
// ça SAMII tombe jamais en panne. »
//
// C'est exactement ce que fait la rotation de clés. Le problème, c'est qu'on
// ne s'en aperçoit JAMAIS si elle ne marche pas : le jour où la première clé
// s'épuise, SAMII se tait, et le silence ressemble à une panne réseau. La
// seule preuve qu'une clé de secours sert à quelque chose, c'est un test qui
// épuise la première et regarde si la seconde est appelée.
//
// LE TROU QU'ON BOUCHE ICI. Le contrôle de quota lisait le code d'erreur
// UNIQUEMENT dans le corps JSON (`data.error.code`). Un 429 émis par la
// façade de Google, un proxy ou une passerelle n'a pas ce corps — il n'a
// qu'un statut HTTP, parfois une page HTML. La condition tombait à faux,
// l'erreur remontait, et la rotation n'avait pas lieu. Les clés de secours
// n'étaient donc pas essayées précisément le jour de forte charge où elles
// existent pour servir.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// Des clés déclarées comme sur Render. Les valeurs sont assez longues pour
// ressembler à de vraies clés : le ramassage écarte les valeurs trop courtes
// pour ne pas confondre une clé avec un « true » ou un identifiant.
process.env.GEMINI_API_KEY   = "cle-principale-AIzaXXXXXXXXXXXXX";
process.env.GEMINI_API_KEY_2 = "cle-secours-2-AIzaXXXXXXXXXXXXXX";
process.env.GEMINI_API_KEY_3 = "cle-secours-3-AIzaXXXXXXXXXXXXXX";
// Celle qu'il a posée sous le nom qu'il voulait, tiret compris.
process.env["SAMII-API-Key"] = "cle-samii-AIzaXXXXXXXXXXXXXXXXX";
// Des noms qui ressemblent mais qui ne sont PAS des clés : ils ne doivent
// pas entrer dans la rotation, sinon SAMII passe son temps à essayer de
// parler à Gemini avec un secret de webhook.
process.env.GEMINI_WEBHOOK_SECRET = "secret-a-ne-pas-confondre-XXXXXX";
process.env.GOOGLE_OAUTH_CLIENT_KEY = "391218285322-e6r6XXXXXXXXXXXX";
process.env.SAMII_API_KEY_VIDE = "x";   // trop courte pour être une clé
// LA MÊME CLÉ SOUS DEUX NOMS. C'est le cas le plus probable en vrai : on
// renomme une variable sur Render et on oublie de supprimer l'ancienne, ou
// on recolle la même clé deux fois. Sans dédoublonnage, elle est essayée
// deux fois de suite — et le jour où elle sature, deux bascules sont
// perdues à ré-essayer la clé qui vient justement d'échouer.
process.env.GEMINI_API_KEY_9 = "cle-secours-3-AIzaXXXXXXXXXXXXXX";

// Ce que l'API a répondu, et à quelle clé. On fabrique les erreurs à la
// main : ce sont les FORMES d'erreur qui comptent, pas le réseau.
const PRINCIPALE = process.env.GEMINI_API_KEY;
const SECOURS_2  = process.env.GEMINI_API_KEY_2;
const SECOURS_3  = process.env.GEMINI_API_KEY_3;
const PAYANTE    = process.env["SAMII-API-Key"];

const APPELS = [];
let reponses = [];

function erreur(forme) {
    const e = new Error("429");
    e.response = forme;
    return e;
}

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "axios") return {
        post: async (url) => {
            const cle = String(url).split("key=")[1];
            APPELS.push(cle);
            const suite = reponses.shift();
            if (suite instanceof Error) throw suite;
            return suite ?? { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } };
        },
    };
    return vraiRequire.apply(this, arguments);
};
// Le service garde en mémoire la clé sur laquelle il s'est arrêté (voir la
// section 5). Pour les contrôles qui parlent de « la première clé essayée »,
// il faut donc repartir d'un service NEUF — sinon le curseur d'un cas
// précédent décale le suivant et le test mesure autre chose que ce qu'il dit.
function chargerService() {
    const vrai = Module.prototype.require;
    Module.prototype.require = function (nom) {
        if (nom === "axios") return {
            post: async (url) => {
                const cle = String(url).split("key=")[1];
                APPELS.push(cle);
                const suite = reponses.shift();
                if (suite instanceof Error) throw suite;
                return suite ?? { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } };
            },
        };
        return vrai.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
    delete require.cache[require.resolve(path.join(RACINE, "services", "geminiService.js"))];
    const service = require(path.join(RACINE, "services", "geminiService.js"));
    Module.prototype.require = vrai;
    return service;
}

Module.prototype.require = vraiRequire;
let gemini = chargerService();

const CONFIG = require(path.join(RACINE, "config.js"));

(async () => {
    // ── 1. Les trois clés sont bien vues ────────────────────────────────
    //
    // Le nom de la variable est TOUT : une clé posée sur Render sous un autre
    // nom (« API_KEY », « GEMINI_KEY », le nom qu'elle porte dans la console
    // Google...) n'est jamais lue, et la panne qu'on croyait avoir évitée
    // arrive quand même. C'est la première chose qui casse, et la plus
    // silencieuse.
    const TROUVEES = CONFIG.GEMINI.API_KEYS;
    for (const [valeur, nom] of [
        ["cle-principale-AIzaXXXXXXXXXXXXX", "GEMINI_API_KEY"],
        ["cle-secours-2-AIzaXXXXXXXXXXXXXX", "GEMINI_API_KEY_2"],
        ["cle-secours-3-AIzaXXXXXXXXXXXXXX", "GEMINI_API_KEY_3"],
        ["cle-samii-AIzaXXXXXXXXXXXXXXXXX", "SAMII-API-Key (le nom qu'il a choisi, tiret compris)"],
    ]) {
        verifier(TROUVEES.includes(valeur),
            `la clé posée sous « ${nom} » n'est pas ramassée — elle est sur Render et ne servira jamais, sans une seule ligne d'erreur pour le dire`);
    }

    // Ce qui n'est PAS une clé ne doit pas entrer : SAMII passerait son temps
    // à présenter un secret de webhook à Gemini et à récolter des 400.
    for (const [valeur, quoi] of [
        ["secret-a-ne-pas-confondre-XXXXXX", "un secret de webhook"],
        ["391218285322-e6r6XXXXXXXXXXXX", "un identifiant client OAuth"],
        ["x", "une valeur trop courte pour être une clé"],
    ]) {
        verifier(!TROUVEES.includes(valeur),
            `${quoi} est pris pour une clé Gemini et sera essayé à chaque bascule`);
    }

    verifier(TROUVEES[0] === "cle-principale-AIzaXXXXXXXXXXXXX",
        "la clé principale n'est plus essayée en premier — le gratuit doit s'épuiser AVANT qu'on passe sur la suivante");
    verifier(new Set(TROUVEES).size === TROUVEES.length,
        "la même clé apparaît deux fois : elle sera essayée deux fois de suite, et sa saturation comptera pour deux bascules perdues");

    // ── 2. Chaque forme de 429 déclenche la bascule ─────────────────────
    //
    // Les trois formes viennent de vraies réponses de Google. La troisième —
    // un 429 sans corps JSON exploitable — est celle qui ne basculait pas.
    const FORMES = [
        [{ status: 429, data: { error: { code: 429, status: "RESOURCE_EXHAUSTED" } } },
            "le 429 complet, avec code et statut dans le corps"],
        [{ status: 429, data: { error: { status: "RESOURCE_EXHAUSTED" } } },
            "un 429 qui annonce RESOURCE_EXHAUSTED sans répéter le code"],
        [{ status: 429, data: "<html>Too Many Requests</html>" },
            "un 429 rendu en HTML par une passerelle — sans corps JSON, c'est celui qui ne basculait pas"],
        [{ status: 429 }, "un 429 nu, sans aucun corps"],
    ];

    for (const [forme, description] of FORMES) {
        APPELS.length = 0;
        gemini = chargerService();    // curseur remis à zéro : on parle bien de LA PREMIÈRE clé
        reponses = [erreur(forme)];   // la 1re clé sature, la 2e répondra
        try {
            await gemini.chat({ message: "bonjour", useTools: false });
        } catch { /* le service relaie ailleurs, ce n'est pas ce qu'on mesure */ }

        verifier(APPELS.includes(SECOURS_2),
            `${description} : SAMII n'essaie PAS la clé de secours — elle est posée sur Render et ne sert jamais`);
        verifier(APPELS[0] === PRINCIPALE,
            `${description} : la clé principale n'a pas été essayée en premier`);
    }

    // ── 3. UNE CLÉ MORTE SE SAUTE, ELLE N'ARRÊTE PAS TOUT ───────────────
    //
    // Neuf clés valides sur dix-sept en service : huit ont été révoquées ou
    // leur projet Google fermé. Elles répondent 400 « API key not valid ».
    //
    // La rotation ne bougeait QUE sur un quota : une clé morte coupait la
    // boucle et partait droit sur le relais. Une seule clé morte en tête de
    // liste suffisait donc à ce que Gemini ne soit JAMAIS utilisé — pas une
    // fois, quelles que soient les seize clés valides derrière.
    for (const [forme, description] of [
        [{ status: 400, data: { error: { code: 400, message: "API key not valid. Please pass a valid API key." } } },
            "une clé révoquée (400 API key not valid)"],
        [{ status: 400, data: { error: { code: 400, status: "INVALID_ARGUMENT", message: "API_KEY_INVALID" } } },
            "une clé refusée (API_KEY_INVALID)"],
        [{ status: 403, data: { error: { code: 403, message: "Requests to this API are blocked." } } },
            "une clé désactivée (403)"],
    ]) {
        APPELS.length = 0;
        gemini = chargerService();
        reponses = [erreur(forme)];
        try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* peu importe */ }
        verifier(APPELS.includes(SECOURS_2),
            `${description} en tête de liste arrête toute la rotation — Gemini n'est jamais utilisé, à aucune requête`);
    }

    // ── 4. Mais un 400 qui vient de NOUS remonte tout de suite ──────────
    //
    // Un corps de requête malformé, un modèle inconnu : rejouer sur dix-sept
    // clés ne corrigerait rien, ferait dix-sept appels ratés au lieu d'un, et
    // masquerait notre bug derrière un faux problème de clés.
    APPELS.length = 0;
    gemini = chargerService();
    reponses = [erreur({ status: 400, data: { error: { code: 400, message: "Invalid JSON payload received." } } })];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* attendu */ }
    verifier(!APPELS.includes(SECOURS_2),
        "une requête malformée fait tourner toutes les clés : dix-sept appels ratés, et la vraie cause devient invisible");

    // ── 5. Toutes les clés sont essayées avant d'abandonner ─────────────
    APPELS.length = 0;
    gemini = chargerService();
    reponses = [
        erreur({ status: 429 }),
        erreur({ status: 429 }),
        { data: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } },
    ];
    try { await gemini.chat({ message: "bonjour", useTools: false }); } catch { /* peu importe */ }
    verifier(APPELS.includes(SECOURS_3),
        "quand les deux premières clés sont épuisées, la troisième n'est jamais atteinte — la chaîne s'arrête à deux");

    // ══════════════════════════════════════════════════════════════════════
    // 6. ON NE REPART PLUS DE LA CLÉ QU'ON SAIT SATURÉE
    //
    // Sur les dix-sept clés en service, la n°1 répondait 429 en annonçant
    // elle-même « Please retry in 46.9s ». Or la boucle recommençait toujours
    // à l'indice 0 : chaque requête, pendant ces 47 secondes, commençait par
    // un aller-retour vers une clé dont on savait déjà qu'elle dirait non.
    // Depuis Douala, c'est une seconde perdue avant que SAMII ne commence
    // seulement à réfléchir — à chaque message.
    // ══════════════════════════════════════════════════════════════════════
    {
        APPELS.length = 0;
        gemini = chargerService();

        // 1re requête : la clé #1 sature, la #2 répond.
        reponses = [erreur({ status: 429 })];
        await gemini.chat({ message: "un", useTools: false });
        const premiere = [...APPELS];
        verifier(premiere[0] === PRINCIPALE && premiere[1] === SECOURS_2,
            `la première requête ne suit pas l'ordre attendu (${premiere.length} appel(s))`);

        // 2e requête : plus rien ne doit toucher la clé saturée.
        APPELS.length = 0;
        reponses = [];
        await gemini.chat({ message: "deux", useTools: false });
        verifier(APPELS[0] === SECOURS_2,
            "la requête suivante recommence par la clé qu'on vient de voir saturée — un aller-retour perdu à chaque message tant que son quota n'est pas revenu");
        verifier(!APPELS.includes(PRINCIPALE),
            "la clé saturée est encore contactée alors qu'une autre vient de répondre");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7. LA CLÉ PAYANTE EST UN DERNIER RECOURS, PAS UN REFUGE
    //
    // « SAMII-API-Key, voici le nom de la clé PAYANTE. » « Après que le
    // gratuit tombe en panne, on passe dessus. »
    //
    // Une clé payante n'a pas de plafond : elle répond toujours oui. C'est ce
    // qui la rend dangereuse combinée au curseur ci-dessus — elle répond, elle
    // devient le point de départ, et elle le RESTE. Le quota gratuit revient
    // une minute plus tard, personne ne le voit, et on paie chaque message
    // jusqu'au prochain redéploiement. Le gratuit dit non bruyamment ; une
    // clé sans plafond ne dira jamais rien.
    // ══════════════════════════════════════════════════════════════════════
    {
        verifier(CONFIG.GEMINI.PAYANTES.includes(PAYANTE),
            "la clé payante n'est pas identifiée comme telle — rien n'empêchera le service de s'y installer");
        verifier(TROUVEES[TROUVEES.length - 1] === PAYANTE,
            "la clé payante n'est pas en dernier : elle sera facturée avant même que le gratuit ait servi");

        APPELS.length = 0;
        gemini = chargerService();

        // Toutes les gratuites saturent. Elles annoncent un repos TRÈS court
        // pour que le test puisse observer leur retour sans attendre —
        // c'est le vrai délai annoncé par Google qui est lu, pas une valeur
        // codée en dur dans le service.
        const bref = { status: 429, data: { error: { code: 429, message: "Please retry in 0.05s" } } };
        reponses = [erreur(bref), erreur(bref), erreur(bref)];
        await gemini.chat({ message: "un", useTools: false });
        verifier(APPELS[APPELS.length - 1] === PAYANTE,
            "quand tout le gratuit est saturé, la clé payante n'est jamais atteinte — SAMII se tait alors qu'il y a de quoi répondre");

        // Le repos écoulé, la requête suivante RETOURNE au gratuit. C'est la
        // propriété qui protège la facture : la payante ne doit jamais être
        // préférée à une gratuite redevenue disponible.
        await new Promise((r) => setTimeout(r, 120));
        APPELS.length = 0;
        reponses = [];
        await gemini.chat({ message: "deux", useTools: false });
        verifier(APPELS[0] === PRINCIPALE,
            "le quota gratuit est revenu et SAMII reste sur la payante — on paie chaque message sans que rien ne le dise");
        verifier(!APPELS.includes(PAYANTE),
            "la clé payante est encore appelée alors qu'une gratuite vient de répondre");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8. UNE CLÉ QUI VIENT DE DIRE NON N'EST PAS RE-DÉRANGÉE
    //
    // Le plafond gratuit se compte PAR PROJET GOOGLE, pas par clé. Deux
    // exécutions du script de contrôle l'ont prouvé : 15 clés valides, puis
    // 4 dix minutes plus tard, sans qu'une seule clé change — le script
    // épuisait lui-même le compteur partagé qu'il mesurait.
    //
    // En production, ça voulait dire : le compteur d'un projet s'épuise, et
    // la rotation essaie quand même TOUTES les clés de ce projet, une par
    // une, à ~300 ms le refus. Quatorze clés dans le même projet, ce sont
    // quatre à cinq secondes de vide avant d'atteindre le relais — pour
    // quelqu'un qui attend une réponse dans un chat.
    // ══════════════════════════════════════════════════════════════════════
    {
        APPELS.length = 0;
        gemini = chargerService();

        // Google annonce lui-même une minute d'attente.
        const long = { status: 429, data: { error: { code: 429, message: "Please retry in 60s" } } };
        reponses = [erreur(long), erreur(long), erreur(long)];
        await gemini.chat({ message: "un", useTools: false });
        const premierTour = APPELS.length;
        verifier(premierTour >= 4,
            `le premier tour n'a essayé que ${premierTour} clé(s) — il devait toutes les parcourir`);

        // Deuxième requête : les trois gratuites ont dit « dans 60 secondes ».
        // Aucune ne doit être recontactée ; on va droit à la payante.
        APPELS.length = 0;
        reponses = [];
        await gemini.chat({ message: "deux", useTools: false });
        for (const [cle, nom] of [[PRINCIPALE, "#1"], [SECOURS_2, "#2"], [SECOURS_3, "#3"]]) {
            verifier(!APPELS.includes(cle),
                `la clé ${nom} vient d'annoncer 60 secondes d'attente et elle est redérangée tout de suite — c'est un aller-retour perdu par message, multiplié par le nombre de clés du même projet`);
        }
        verifier(APPELS.includes(PAYANTE),
            "toutes les gratuites sont au repos et la payante n'est pas atteinte — SAMII se tait alors qu'il a de quoi répondre");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 9. LA CLÉ PAYANTE NE SORT PAS DE CHEZ NOUS
    //
    // « Gemini payante reste chez nous. »
    //
    // Les deux services Render partagent ce dépôt. Une variable recopiée par
    // mégarde d'un service à l'autre — il y en a une quarantaine — et la
    // communauté d'une partenaire consomme NOTRE facture Gemini, sans
    // plafond pour l'arrêter et sans que rien ne le signale avant le relevé.
    //
    // C'est le domaine qui décide, pas la présence de la variable.
    // ══════════════════════════════════════════════════════════════════════
    {
        const avant = process.env.COMMUNAUTE_PAR_DEFAUT;

        process.env.COMMUNAUTE_PAR_DEFAUT = "coindudigital";
        delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
        const chezElle = require(path.join(RACINE, "config.js"));
        verifier(!chezElle.GEMINI.API_KEYS.includes(PAYANTE),
            "sur le service d'une partenaire, la clé payante est utilisable : sa communauté consomme notre facture, sans plafond pour l'arrêter");
        verifier(chezElle.GEMINI.API_KEYS.includes(PRINCIPALE),
            "le service d'une partenaire a perdu les clés gratuites au passage — SAMII n'y répond plus du tout");
        verifier(chezElle.GEMINI.PAYANTES.length === 0,
            "la liste des payantes n'est pas vidée chez une partenaire : le service pourrait encore s'y référer");

        // Chez nous — marqueur absent, ou marqueur qui vaut la maison.
        for (const marqueur of [undefined, "samii"]) {
            if (marqueur === undefined) delete process.env.COMMUNAUTE_PAR_DEFAUT;
            else process.env.COMMUNAUTE_PAR_DEFAUT = marqueur;
            delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
            const chezNous = require(path.join(RACINE, "config.js"));
            verifier(chezNous.GEMINI.API_KEYS.includes(PAYANTE),
                `chez nous (COMMUNAUTE_PAR_DEFAUT=${marqueur ?? "absent"}), la payante est écartée — on a acheté un dernier recours qui ne sert jamais`);
        }

        // ── L'OUBLI TOMBE DU CÔTÉ SÛR ───────────────────────────────────
        //
        // Si le registre des communautés devient illisible, on ne SAIT PLUS
        // chez qui on est. Entre payer pour quelqu'un d'autre et se passer
        // d'un dernier recours, le second se répare et le premier se
        // facture — sans plafond et sans alerte.
        process.env.COMMUNAUTE_PAR_DEFAUT = "peu-importe";
        const vraiR = Module.prototype.require;
        Module.prototype.require = function (nom) {
            if (String(nom).includes("config/communautes")) throw new Error("registre illisible");
            return vraiR.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
        let aveugle;
        try { aveugle = require(path.join(RACINE, "config.js")); }
        finally { Module.prototype.require = vraiR; }
        verifier(aveugle && !aveugle.GEMINI.API_KEYS.includes(PAYANTE),
            "registre illisible : on ne sait plus chez qui on est et la clé payante reste utilisable — c'est le cas où l'oubli se facture");

        if (avant === undefined) delete process.env.COMMUNAUTE_PAR_DEFAUT;
        else process.env.COMMUNAUTE_PAR_DEFAUT = avant;
        delete require.cache[require.resolve(path.join(RACINE, "config.js"))];
    }

    if (echecs.length) {
        console.error(`❌ clés Gemini : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ clés Gemini : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ clés Gemini : la suite n'a pas pu s'exécuter —", err.stack);
    process.exit(1);
});
