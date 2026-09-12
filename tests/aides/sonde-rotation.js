// ==========================================================================
// SONDE — combien de clés Gemini sont essayées quand le flux échoue ?
//
// POURQUOI UN PROCESSUS SÉPARÉ.
//
// geminiService garde en mémoire les clés mises au repos (`saturees`) et la
// clé par laquelle recommencer (`depart`). Deux scénarios lancés à la suite
// dans le même processus se marchent donc dessus : le premier met les trois
// clés au repos, et le second n'appelle plus rien du tout.
//
// La première version du test comparait justement ces deux scénarios dans un
// seul processus. Elle mesurait le repos des clés, pas la rotation — et elle
// passait même quand on retirait le code qu'elle était censée surveiller.
//
// Cette sonde tourne donc UNE fois, avec UN scénario, dans un processus neuf,
// et n'imprime qu'un nombre : les appels réellement reçus.
//
// Usage :  node tests/aides/sonde-rotation.js "<message d'erreur de Google>"
// ==========================================================================
const http = require("http");
const path = require("path");
const RACINE = path.join(__dirname, "..", "..");

const MESSAGE = process.argv[2] || "boom";
const STATUT = Number(process.argv[3] || 400);

// ON COMPTE SÉPARÉMENT LE FLUX ET LE REPLI.
//
// Compter le total ne suffit pas, et c'est une leçon payée : sans le
// drainage du corps d'erreur, le flux abandonne après UNE clé, puis le repli
// chatLibre() en essaie trois — le total reste élevé et masque exactement la
// panne qu'on cherche. Les deux phases n'appellent pas la même méthode de
// Google (streamGenerateContent contre generateContent), donc l'URL les
// sépare sans ambiguïté.
let fluxAppels = 0;
let blocAppels = 0;
const faussegoogle = http.createServer((req, res) => {
    if (String(req.url).includes("streamGenerateContent")) fluxAppels++;
    else blocAppels++;
    res.writeHead(STATUT, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: STATUT, message: MESSAGE } }));
});

faussegoogle.listen(0, "127.0.0.1", async () => {
    const port = faussegoogle.address().port;

    // Au moins 20 caractères : config.js écarte ce qui est trop court pour
    // être une clé. Trois clés, pour que « on essaie la suivante » et « on
    // abandonne » donnent des nombres différents.
    process.env.GEMINI_API_KEY   = "cle-de-test-numero-un-aaaaaaaa";
    process.env.GEMINI_API_KEY_2 = "cle-de-test-numero-deux-bbbbbb";
    process.env.GEMINI_API_KEY_3 = "cle-de-test-numero-trois-cccc";
    // Les relais de secours doivent rester muets : on compte les appels à
    // Gemini, pas ceux de chatLibre() qui prendrait le relais derrière.
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    const axios = require(path.join(RACINE, "node_modules", "axios"));
    const vraiPost = axios.post;
    axios.post = function (url, corps, options) {
        return vraiPost.call(this, String(url).replace(
            /^https:\/\/generativelanguage\.googleapis\.com/, `http://127.0.0.1:${port}`,
        ), corps, options);
    };

    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    const CONFIG = require(path.join(RACINE, "config.js"));

    try {
        await gemini.chatLibreFlux({ systemPrompt: "x", message: "y", history: [] }, () => {});
    } catch { /* peu importe : ce sont les nombres d'appels qui parlent */ }

    console.log(JSON.stringify({
        flux: fluxAppels,
        bloc: blocAppels,
        cles: (CONFIG.GEMINI.API_KEYS || []).length,
    }));
    faussegoogle.close();
    process.exit(0);
});
