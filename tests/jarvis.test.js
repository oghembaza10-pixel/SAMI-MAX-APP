// ==========================================================================
// SAMII OS — SAMII JARVIS, la bulle de cristal
//
// CE QUI EST VÉRIFIÉ ICI, ET POURQUOI CHAQUE POINT EXISTE.
//
//  1. LA PAGE N'A PAS SON PROPRE CERVEAU. Elle envoie à /api/chat, la même
//     route que le chat écrit. Une page vocale avec sa propre route aurait
//     sa propre mémoire et son propre quota : deux SAMII qui divergent.
//
//  2. ELLE EST FERMÉE CHEZ UNE PARTENAIRE. Cette page raconte l'activité
//     d'un compte — et, pour le fondateur, celle de toute la plateforme.
//     On interroge LA VRAIE PORTE, pas une liste recopiée.
//
//  3. L'IDENTITÉ VIENT DE LA SESSION. Le briefing lit des commandes et des
//     paiements. Un identifiant accepté depuis la page, et n'importe qui
//     demande le bilan de n'importe qui. Ce bug est arrivé quatre fois ici.
//
//  4. UNE SOURCE ABSENTE EST ANNONCÉE. GitHub, Render, Gmail non connecté :
//     une IA à qui l'on donne un tableau vide comble le vide. La liste
//     `indisponibles` est ce qui l'en empêche.
//
//  5. LA VOIX A TROIS FOURNISSEURS ET UN REPLI. Si Kokoro ne charge pas,
//     SAMII doit parler quand même.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const fs = require("fs");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));
const modulesQg   = require(path.join(RACINE, "config", "modules-qg"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const MAISON     = communautes.get(communautes.DEFAUT);
const PARTENAIRE = communautes.get("coindudigital");

// ── UNE BASE SIMULÉE ────────────────────────────────────────────────────
// Elle ne prouve pas que le SQL est valide (seul un vrai Postgres le dit,
// et il a servi à l'écriture de ce chantier). Elle sert à vérifier CE QU'ON
// DEMANDE : avec quels paramètres, et donc pour quel compte.
const requetes = [];
const fausseBase = {
    query: async (q, args = []) => {
        requetes.push({ sql: q.replace(/\s+/g, " ").trim(), args });
        if (/COUNT\(\*\) FILTER/i.test(q)) {
            return [{ n: 3, total: 25000, confirmees: 2, annulees: 0, devise: "XAF" }];
        }
        if (/GROUP BY action/i.test(q)) return [{ action: "commande.creee", n: 4 }];
        if (/ILIKE '%erreur%'/i.test(q)) return [];
        if (/COUNT\(\*\)::int AS n/i.test(q)) return [{ n: 5 }];
        return [];
    },
};

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "./db" || nom === "../services/db") return fausseBase;
    // Gmail sans OAuth : le cas normal tant que personne n'a cliqué.
    if (nom === "./google") return { listRecentEmails: async () => ({ connected: false }) };
    if (nom === "../routes/messages") return { nonLus: async () => 2 };
    return vraiRequire.apply(this, arguments);
};
// `briefing.js` demande routes/messages AU MOMENT DE L'APPEL (le comptage
// des non-lus y vit déjà, et l'exiger en tête créerait un cycle). Une
// doublure posée sur Module.prototype.require ne l'attrape donc pas : on
// remplit le cache directement, sinon la suite tape sur un vrai Postgres et
// noie ses vraies erreurs sous des avertissements de connexion.
function poserDansLeCache(chemin, exports) {
    const resolu = require.resolve(chemin);
    require.cache[resolu] = { id: resolu, filename: resolu, loaded: true, exports };
}
poserDansLeCache(path.join(RACINE, "routes", "messages.js"), { nonLus: async () => 2 });
// Gmail sans OAuth : le cas normal tant que personne n'a cliqué. Requis au
// moment de l'appel lui aussi, donc même traitement.
poserDansLeCache(path.join(RACINE, "services", "google.js"), {
    listRecentEmails: async () => ({ connected: false }),
});
delete require.cache[require.resolve(path.join(RACINE, "services", "briefing.js"))];
const briefing = require(path.join(RACINE, "services", "briefing.js"));
delete require.cache[require.resolve(path.join(RACINE, "routes", "jarvis.js"))];
const jarvis = require(path.join(RACINE, "routes", "jarvis.js"));
Module.prototype.require = vraiRequire;

function rendre(COM, session) {
    return new Promise((resoudre, rejeter) => {
        const couche = jarvis.stack.find((c) => c.route && c.route.path === "/");
        const handlers = couche.route.stack.map((s) => s.handle);
        const req = { session, query: {} };
        const res = {
            locals: { COM },
            send: resoudre,
            redirect: (u) => resoudre(`__REDIRECTION__${u}`),
            status() { return this; },
        };
        try {
            handlers[0](req, res, () => handlers[1](req, res, () => resoudre("")));
        } catch (err) { rejeter(err); }
    });
}

(async () => {
    const SESSION = { loggedIn: true, nom: "Inès Audrey", userId: "u-1", workspaceId: "ws-1" };
    const page = await rendre(MAISON, SESSION);

    // ── 1. UN SEUL CERVEAU ──────────────────────────────────────────────
    verifier(page.includes("/api/chat\""),
        "la page Jarvis n'appelle pas /api/chat — elle s'est fabriqué un deuxième cerveau, avec sa propre mémoire et son propre quota");
    verifier(page.includes("/api/chat/transcribe"),
        "la page Jarvis ne réutilise pas la transcription existante (/api/chat/transcribe)");
    // Une route vocale dédiée serait exactement l'erreur qu'on veut éviter.
    verifier(!/\/api\/(jarvis|voice|vocal)/.test(page),
        "la page Jarvis appelle une route vocale à elle — la voix doit passer par le cerveau, pas à côté");

    // ── 2. LA PORTE ─────────────────────────────────────────────────────
    const permisElle = modulesQg.cheminsAutorises(PARTENAIRE);
    verifier(!modulesQg.chemineAutorise("/jarvis", permisElle),
        "/jarvis est OUVERT sur le service d'une partenaire — ses membres peuvent lire l'activité qu'on y raconte");
    verifier(modulesQg.chemineAutorise("/jarvis", modulesQg.cheminsAutorises(MAISON)),
        "/jarvis est fermé chez nous — la page est injoignable");
    // Le rangement sous /samii aurait ouvert la page par simple préfixe :
    // c'est la raison d'être du chemin séparé, et elle doit rester vraie.
    verifier(modulesQg.chemineAutorise("/samii", permisElle),
        "le module assistant n'est plus donné aux partenaires — si c'est voulu, ce test doit changer, mais ce n'est pas ce qu'on a décidé");
    const moduleJarvis = modulesQg.MODULES.find((m) => m.id === "jarvis");
    verifier(moduleJarvis && !modulesQg.MINIMAL.includes("jarvis"),
        "le module jarvis est entré dans MINIMAL : chaque nouvelle partenaire en hériterait sans que personne l'ait décidé");

    // ── 3. L'IDENTITÉ NE VIENT PAS DE LA PAGE ───────────────────────────
    const planner = require(path.join(RACINE, "brain", "planner.js"));
    const sansIdentite = await planner.resumeJournee({});
    verifier(sansIdentite.success === false,
        "sans identité, le briefing répond quand même — il raconte alors la journée de personne, ou celle de tout le monde");

    requetes.length = 0;
    await briefing.collecter({ userId: "u-1", workspaceId: "ws-A", isAdmin: false }, MAISON);
    const marchand = requetes.filter((r) => r.args.includes("ws-A"));
    verifier(marchand.length >= 3,
        `un marchand devrait être cloisonné sur son workspace : seules ${marchand.length} requêtes le filtrent`);

    requetes.length = 0;
    await briefing.collecter({ userId: "u-1", workspaceId: "ws-A", isAdmin: true }, MAISON);
    verifier(!requetes.some((r) => r.args.includes("ws-A")),
        "le fondateur reste enfermé dans un workspace — son tableau de bord ne voit pas la plateforme");

    // Et le cloisonnement par communauté, la fuite qui est revenue cinq fois.
    requetes.length = 0;
    await briefing.collecter({ userId: "u-1", workspaceId: "ws-A" }, PARTENAIRE);
    verifier(requetes.some((r) => r.args.includes("coindudigital")),
        "les nouveaux comptes ne sont pas filtrés par communauté — on annonce à une partenaire les inscriptions de la maison");

    // ── 4. CE QU'ON N'A PAS, ON LE DIT ──────────────────────────────────
    const { donnees, indisponibles } = await briefing.collecter({ userId: "u-1", workspaceId: "ws-A" }, MAISON);
    const tout = indisponibles.join(" ").toLowerCase();
    verifier(/github/.test(tout),
        "GitHub n'est pas annoncé comme absent — SAMII parlera de commits qu'il n'a jamais vus");
    verifier(/render/.test(tout),
        "Render n'est pas annoncé comme absent");
    verifier(/gmail/.test(tout) && donnees.emails === null,
        "Gmail non connecté n'est pas annoncé — SAMII inventera un nombre d'emails");
    verifier(/erreur/.test(tout),
        "on laisse croire que zéro erreur enregistrée veut dire zéro erreur — rien n'écrit encore les erreurs en base");

    // La consigne au modèle est la seule barrière contre l'invention : si
    // elle disparaît de la description de l'outil, plus rien ne l'arrête.
    const source = fs.readFileSync(path.join(RACINE, "services", "geminiService.js"), "utf8");
    const bloc = source.slice(source.indexOf("resume_journee"), source.indexOf("resume_journee") + 1200);
    verifier(/indisponibles/.test(bloc) && /invente/i.test(bloc),
        "la description de resume_journee n'interdit plus d'inventer les sources manquantes");

    // ── 5. LA VOIX, ET SON REPLI ────────────────────────────────────────
    //
    // PREMIÈRE VERSION DE CE BLOC : elle cherchait le mot « speechSynthesis »
    // dans le fichier. J'ai supprimé le repli pour l'éprouver — et le test
    // s'est tu, parce que le mot apparaît ailleurs, dans une ligne qui ne
    // fait pas parler. Une assertion qui lit la source ne mesure pas ce
    // qu'elle croit mesurer.
    //
    // On FAIT donc parler la voix, dans une fenêtre simulée où Kokoro n'existe
    // pas — le cas de tout le monde à la première seconde, et le cas définitif
    // sur une connexion trop lente pour télécharger 80 Mo.
    const voix = fs.readFileSync(path.join(RACINE, "public", "js", "voix-sortie.js"), "utf8");

    function fenetreSimulee() {
        const dits = [];
        const fenetre = {
            navigator: {},
            speechSynthesis: {
                cancel() {},
                getVoices: () => [{ name: "Amélie", lang: "fr-FR" }],
                speak(u) { dits.push(u.text); setTimeout(() => u.onend && u.onend(), 0); },
            },
            SpeechSynthesisUtterance: function (texte) { this.text = texte; },
            Audio: function () { this.play = () => Promise.reject(new Error("pas de son ici")); },
            fetch: async () => ({ json: async () => ({ success: false, fallback: true }) }),
        };
        // eslint-disable-next-line no-new-func
        new Function("window", voix)(fenetre);
        return { voixSortie: fenetre.VoixSortie, dits };
    }

    const { voixSortie, dits } = fenetreSimulee();
    // Rien ne doit sortir tant que personne n'a allumé la voix : une page qui
    // se met à parler toute seule au bureau, on la referme.
    await voixSortie.parler("silence attendu");
    verifier(dits.length === 0,
        "SAMII parle sans qu'on ait activé la voix — une page ouverte au bureau se met à parler toute seule");

    voixSortie.activer();
    const aParle = await voixSortie.parler("**Bonjour** — deux commandes aujourd'hui.");
    verifier(aParle === true && dits.length === 1,
        "sans Kokoro ni ElevenLabs, SAMII devient muet : le repli navigateur ne prend pas le relais");
    verifier(dits[0] && !/[*#]/.test(dits[0]),
        `le markdown est lu tel quel : SAMII dirait « ${dits[0]} »`);
    verifier(!/https?:/.test(voixSortie.pourLOreille("va sur https://exemple.com/x")),
        "les URL sont épelées à voix haute");

    // ── SAMII EST UN « IL » ─────────────────────────────────────────────
    //
    // « Elle parle avec une voix féminine alors que SAMII c'est un masculin. »
    //
    // Kokoro n'a qu'une voix française et elle est féminine (ff_siwis, le
    // second f pour female). Le navigateur, lui, en a de vraies masculines.
    // On vérifie donc que le choix tombe sur l'homme quand il existe.
    function fenetreAvecVoix(listeVoix) {
        const fenetre = {
            navigator: {},
            speechSynthesis: {
                cancel() {},
                getVoices: () => listeVoix,
                speak(u) { setTimeout(() => u.onend && u.onend(), 0); },
            },
            SpeechSynthesisUtterance: function (t) { this.text = t; },
            Audio: function () { this.play = () => Promise.reject(new Error("pas de son")); },
            fetch: async () => ({ json: async () => ({ success: false }) }),
        };
        // eslint-disable-next-line no-new-func
        new Function("window", voix)(fenetre);
        return fenetre.VoixSortie;
    }

    const apple = fenetreAvecVoix([
        { name: "Amélie", lang: "fr-CA" }, { name: "Thomas", lang: "fr-FR" },
    ]).voixRetenue();
    verifier(apple && apple.name === "Thomas",
        `sur Apple, SAMII prendrait « ${apple && apple.name} » — une voix féminine pour un assistant masculin`);

    const windows = fenetreAvecVoix([
        { name: "Microsoft Hortense - French (France)", lang: "fr-FR" },
        { name: "Microsoft Paul - French (France)", lang: "fr-FR" },
    ]).voixRetenue();
    verifier(windows && /Paul/.test(windows.name),
        `sur Windows, SAMII prendrait « ${windows && windows.name} » au lieu de la voix masculine disponible`);

    // Le cas où AUCUN masculin n'existe : on ne doit pas rester muet.
    const androide = fenetreAvecVoix([{ name: "Google français", lang: "fr-FR" }]).voixRetenue();
    verifier(androide && androide.name === "Google français",
        "sans voix masculine française, SAMII ne parle plus du tout — mieux vaut une voix imparfaite que le silence");

    // ── LE PREMIER MESSAGE, QUAND LES VOIX N'ARRIVENT QU'APRÈS ──────────
    //
    // LE BUG QUI A FAIT PARLER UNE FEMME. `getVoices()` rend une liste VIDE
    // au premier appel sur Chrome et Edge — le système charge ses voix en
    // asynchrone puis annonce « voiceschanged ». Personne ne l'écoutait.
    //
    // Le tout premier message (celui du bouton « Voix active ») tombait donc
    // toujours avant la liste : aucune voix posée, voix par défaut du
    // système, féminine. Le choix masculin ne servait à rien, faute d'avoir
    // quelque chose à choisir.
    function fenetreRetardee(listeVoix, retardMs) {
        const dits = [];
        let pretes = false;
        const abonnes = [];
        setTimeout(() => { pretes = true; abonnes.forEach((f) => f()); }, retardMs);
        const fenetre = {
            navigator: {},
            speechSynthesis: {
                cancel() {},
                getVoices: () => (pretes ? listeVoix : []),
                addEventListener: (nom, fn) => { if (nom === "voiceschanged") abonnes.push(fn); },
                speak(u) { dits.push({ voix: u.voice && u.voice.name, pitch: u.pitch });
                           setTimeout(() => u.onend && u.onend(), 0); },
            },
            SpeechSynthesisUtterance: function (t) { this.text = t; },
            Audio: function () { this.play = () => Promise.reject(new Error("pas de son")); },
            fetch: async () => ({ json: async () => ({ success: false }) }),
        };
        // eslint-disable-next-line no-new-func
        new Function("window", voix)(fenetre);
        return { V: fenetre.VoixSortie, dits };
    }

    const edge = fenetreRetardee([
        { name: "Microsoft Hortense", lang: "fr-FR" },
        { name: "Microsoft Paul - French (France)", lang: "fr-FR" },
    ], 120);
    edge.V.activer();
    await edge.V.parler("Je t'écoute.");
    verifier(edge.dits[0] && /Paul/.test(String(edge.dits[0].voix)),
        `au PREMIER message, SAMII prend « ${edge.dits[0] && edge.dits[0].voix} » — les voix n'étaient pas encore chargées et on n'a pas attendu`);

    // Là où aucune voix masculine n'existe (Android n'en a souvent qu'une,
    // féminine), on descend le ton. Ce n'est pas une vraie voix d'homme,
    // c'est le moins mauvais choix — mais ne rien faire serait pire.
    const seuleFeminine = fenetreRetardee([{ name: "Google français", lang: "fr-FR" }], 80);
    seuleFeminine.V.activer();
    await seuleFeminine.V.parler("Deux commandes aujourd'hui.");
    verifier(seuleFeminine.dits[0] && seuleFeminine.dits[0].pitch < 0.9,
        `sans voix masculine, le ton n'est pas descendu (pitch ${seuleFeminine.dits[0] && seuleFeminine.dits[0].pitch}) — SAMII reste une femme`);

    // Et là où un vrai masculin existe, on n'y touche PAS : descendre Thomas
    // le rendrait caverneux.
    const vraiMasculin = fenetreRetardee([
        { name: "Amélie", lang: "fr-CA" }, { name: "Thomas", lang: "fr-FR" },
    ], 80);
    vraiMasculin.V.activer();
    await vraiMasculin.V.parler("Bonjour.");
    verifier(vraiMasculin.dits[0] && vraiMasculin.dits[0].pitch === 1,
        `le ton d'une vraie voix masculine est modifié (pitch ${vraiMasculin.dits[0] && vraiMasculin.dits[0].pitch}) — Thomas n'a pas besoin d'être descendu`);

    voixSortie.desactiver();
    const apresCoupure = dits.length;
    await voixSortie.parler("on ne doit plus rien entendre");
    verifier(dits.length === apresCoupure,
        "couper la voix ne la coupe pas — SAMII continue de parler après qu'on lui a demandé de se taire");

    // Les trois fournisseurs restent joignables. Ce sont des vérifications de
    // présence, assumées comme telles : on ne peut pas charger 80 Mo de
    // Kokoro dans une suite de tests.
    verifier(/kokoro/i.test(voix), "le fournisseur Kokoro a disparu");
    verifier(/api\/speak/.test(voix), "ElevenLabs n'est plus atteignable — la route redevient morte");
    // CE TEST LISAIT LA SOURCE, et la correction du premier message l'a
    // cassé alors que le comportement était intact. Une assertion qui suit
    // la FORME du code casse quand la forme change, et se tait quand c'est
    // le sens qui change. On mesure donc ce qui compte vraiment : le temps
    // avant le premier mot. Attendre 80 Mo de modèle, c'est un silence qu'on
    // prend pour une panne.
    const chrono = fenetreRetardee([{ name: "Thomas", lang: "fr-FR" }], 50);
    chrono.V.activer();
    const depart = Date.now();
    await chrono.V.parler("Vite.");
    const attente = Date.now() - depart;
    verifier(attente < 900,
        `il s'est écoulé ${attente} ms avant le premier mot — la voix attend probablement le chargement de Kokoro`);

    // ── 6. LA PAGE ELLE-MÊME ────────────────────────────────────────────
    verifier(page.includes("Bonjour Inès"),
        "le prénom de la session n'apparaît pas dans l'accueil");
    verifier(!page.includes("value=\"u-1\"") && !/workspaceId["\s:=]+ws-1/.test(page),
        "la page publie des identifiants internes dans son HTML");
    const chezElle = await rendre(PARTENAIRE, SESSION);
    // Le nom est échappé dans le HTML : « L'assistant » s'écrit
    // « L&#39;assistant ». Chercher la chaîne brute ne trouvait jamais rien,
    // et le test passait pour la mauvaise raison.
    const sonNom = PARTENAIRE.assistant.replace(/'/g, "&#39;");
    verifier(!/\bSAMII\b/.test(chezElle),
        "la page Jarvis écrit encore SAMII sur le domaine d'une partenaire — y compris dans une bulle d'aide ou un commentaire livré au navigateur");
    verifier(chezElle.includes(sonNom),
        `la page Jarvis ne porte pas le nom de son assistant à elle (« ${PARTENAIRE.assistant} »)`);

    if (echecs.length) {
        console.error(`❌ jarvis : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ jarvis : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ jarvis : la page n'a pas pu être rendue —", err.message);
    console.error(err.stack);
    process.exit(1);
});
