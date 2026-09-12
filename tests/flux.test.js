// ==========================================================================
// SAMII OS — La réponse s'écrit-elle vraiment sous les yeux du visiteur ?
//
// POURQUOI CE TEST EXISTE.
//
// Le streaming est la seule chose qui sépare ce chat d'un formulaire. Contenu
// identique, durée identique — mais un rond qui tourne puis un pavé, c'est une
// machine ; des mots qui arrivent, c'est quelqu'un. Les gens visés connaissent
// déjà ce format ailleurs et repèrent la différence avant d'avoir lu une phrase.
//
// Or un streaming cassé ne se voit PAS en regardant le code : la réponse
// finit quand même par s'afficher. On ne peut donc pas se fier à la lecture.
// Il faut mesurer que les morceaux arrivent SÉPARÉMENT, et dans le temps.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. chatLibreFlux découpe vraiment : le rappel est appelé plusieurs fois,
//      et le texte recollé est exactement celui qu'a envoyé le modèle.
//   2. Un JSON coupé en plein milieu par la frontière d'un paquet TCP est
//      recollé — c'est le défaut le plus courant d'un lecteur SSE, et il ne
//      se manifeste que sur les réponses longues, donc jamais en test manuel.
//   3. Quand le flux échoue, on retombe sur la réponse d'un bloc. Un
//      streaming qui casse le chat serait un très mauvais marché.
//   4. Le corps d'erreur d'une requête en flux est lu avant classification —
//      sans ça une clé morte en tête de liste bloque tout, et la rotation
//      sur dix-sept clés ne sert plus à rien.
//   5. La route /chat/flux partage le limiteur de /chat : sinon il suffirait
//      d'alterner entre les deux pour doubler le quota gratuit.
//   6. L'ancienne route /chat existe toujours et répond toujours en JSON.
//
// COMMENT. On monte un faux Gemini qui parle vraiment SSE, sur une vraie
// socket, et on branche le service dessus. Pas de simulacre de fonction :
// c'est le découpage réseau qu'on veut éprouver, et c'est précisément ce
// qu'un simulacre effacerait.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const { spawnSync } = require("child_process");
const http = require("http");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── UN FAUX GEMINI QUI PARLE SSE ─────────────────────────────────────────
// `scenario` décide de ce que la fausse Google renvoie : une suite de
// morceaux, une erreur, ou un JSON coupé en deux paquets.
let scenario = { type: "morceaux", valeurs: ["Bonjour ", "Ouahid, ", "trois commandes."] };
let appels = 0;

const faussegoogle = http.createServer((req, res) => {
    appels++;
    if (scenario.type === "erreur") {
        res.writeHead(scenario.statut, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { code: scenario.statut, message: scenario.message } }));
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const trame = (t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`;

    if (scenario.type === "coupe") {
        // Le cas vicieux : on coupe une trame en plein milieu du JSON, comme
        // le ferait une frontière de paquet TCP sur une longue réponse.
        const entier = trame("premier") + trame("second");
        const milieu = Math.floor(entier.length / 2);
        res.write(entier.slice(0, milieu));
        setTimeout(() => { res.write(entier.slice(milieu)); res.end(); }, 20);
        return;
    }
    // Les morceaux partent espacés dans le temps : s'ils partaient d'un bloc,
    // le test passerait même avec un lecteur qui attend la fin.
    let i = 0;
    const suivant = () => {
        if (i >= scenario.valeurs.length) return res.end();
        res.write(trame(scenario.valeurs[i++]));
        setTimeout(suivant, 15);
    };
    suivant();
});

function lancer() {
    return new Promise((ok) => faussegoogle.listen(0, "127.0.0.1", () => ok(faussegoogle.address().port)));
}

(async () => {
    const port = await lancer();

    // On détourne l'adresse de Google AVANT de charger le service : KEYS et
    // l'URL sont figées au chargement du module.
    //
    // TROIS clés, pas une : c'est le seul moyen d'observer la rotation. Avec
    // une seule clé, « on essaie la suivante » et « on abandonne » produisent
    // exactement le même nombre d'appels, et le test ne verrait rien.
    // Au moins 20 caractères : config.js écarte les valeurs trop courtes pour
    // être des clés, garde-fou qui évite qu'un « true » ou un identifiant
    // traîne dans la liste. Des clés de test courtes seraient silencieusement
    // ignorées et le test tournerait à vide.
    process.env.GEMINI_API_KEY   = "cle-de-test-numero-un-aaaaaaaa";
    process.env.GEMINI_API_KEY_2 = "cle-de-test-numero-deux-bbbbbb";
    process.env.GEMINI_API_KEY_3 = "cle-de-test-numero-trois-cccc";
    const axios = require(path.join(RACINE, "node_modules", "axios"));
    const vraiPost = axios.post;
    axios.post = function (url, corps, options) {
        const redirigee = String(url).replace(
            /^https:\/\/generativelanguage\.googleapis\.com/,
            `http://127.0.0.1:${port}`,
        );
        return vraiPost.call(this, redirigee, corps, options);
    };

    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    const CONFIG = require(path.join(RACINE, "config.js"));
    const NB_CLES = (CONFIG.GEMINI.API_KEYS || []).length || 1;
    verifier(NB_CLES >= 3,
        `le service n'a chargé que ${NB_CLES} clé(s) — impossible d'observer la rotation`);

    verifier(typeof gemini.chatLibreFlux === "function",
        "chatLibreFlux n'est pas exporté — la page d'accueil ne peut pas diffuser");

    // ── 1. LES MORCEAUX ARRIVENT SÉPARÉMENT ──────────────────────────────
    {
        scenario = { type: "morceaux", valeurs: ["Bonjour ", "Ouahid, ", "trois commandes."] };
        const recus = [];
        const r = await gemini.chatLibreFlux(
            { systemPrompt: "tu es SAMII", message: "salut", history: [] },
            (m) => recus.push(m),
        );
        verifier(recus.length === 3,
            `le rappel a reçu ${recus.length} morceau(x) au lieu de 3 — la réponse arrive d'un bloc, ce n'est pas du streaming`);
        verifier(r.text === "Bonjour Ouahid, trois commandes.",
            `le texte recollé est « ${r.text} » au lieu de la réponse complète`);
        verifier(r.provider === "gemini",
            `le fournisseur annoncé est « ${r.provider} » — on ne sait plus d'où vient la réponse`);
    }

    // ── 2. UN JSON COUPÉ EN DEUX PAQUETS EST RECOLLÉ ─────────────────────
    // Sans le tampon « reste », la moitié de trame fait échouer JSON.parse,
    // le morceau est perdu, et la réponse arrive amputée — au hasard, sur les
    // longues réponses seulement.
    {
        scenario = { type: "coupe" };
        const recus = [];
        const r = await gemini.chatLibreFlux(
            { systemPrompt: "x", message: "y", history: [] },
            (m) => recus.push(m),
        );
        verifier(r.text === "premiersecond",
            `une trame coupée par un paquet TCP a donné « ${r.text} » au lieu de « premiersecond » — le tampon de recollage ne marche pas`);
    }

    // ── 3. LE REPLI QUAND LE FLUX ÉCHOUE ─────────────────────────────────
    // 500 : ni quota, ni clé morte. La rotation ne s'applique pas, l'erreur
    // remonte, et chatLibreFlux doit retomber sur chatLibre — qui échouera
    // aussi ici (même faux serveur), mais SANS jeter d'exception : l'appelant
    // doit toujours recevoir un objet, jamais une explosion.
    {
        scenario = { type: "erreur", statut: 500, message: "boom" };
        let explose = null;
        let r = null;
        try {
            r = await gemini.chatLibreFlux({ systemPrompt: "x", message: "y", history: [] }, () => {});
        } catch (err) { explose = err; }
        verifier(!explose,
            `chatLibreFlux a jeté « ${explose && explose.message} » au lieu de retomber sur la réponse d'un bloc`);
        verifier(r && "text" in r,
            "le repli ne renvoie pas la même forme que chatLibre — l'appelant doit deviner par quel chemin ça a répondu");
    }

    // ── 4. UNE CLÉ MORTE EN FLUX EST RECONNUE ────────────────────────────
    //
    // Le corps d'une erreur en flux est LUI AUSSI un flux. Sans le drainer,
    // estCleMorte() ne peut pas lire « API key not valid », renvoie faux, et
    // l'erreur remonte au lieu de passer à la clé suivante — la panne des
    // dix-sept clés, réintroduite par la porte de derrière.
    //
    // CE QU'ON MESURE, ET POURQUOI PAS AUTRE CHOSE. Deux versions de cette
    // vérification ont passé alors que le code était cassé :
    //   — la première lisait l'ordre des mots dans le fichier source, et a
    //     échoué sur un COMMENTAIRE qui nommait estCleMorte avant l'appel ;
    //   — la seconde comparait le nombre total d'appels entre deux scénarios
    //     lancés dans le même processus. Or geminiService garde les clés mises
    //     au repos : le second scénario n'appelait plus rien, et le total
    //     restait élevé parce que le REPLI, lui, essayait bien trois clés.
    //
    // On compte donc les appels DU FLUX SEUL (streamGenerateContent), dans un
    // processus neuf par scénario. Avec le drainage, une clé invalide fait
    // essayer les trois ; sans lui, le flux abandonne après une seule.
    {
        const sonde = (message) => {
            const r = spawnSync(process.execPath,
                [path.join(RACINE, "tests", "aides", "sonde-rotation.js"), message, "400"],
                { encoding: "utf8", timeout: 60000 });
            const derniere = String(r.stdout).trim().split("\n").pop();
            try { return JSON.parse(derniere); } catch { return { flux: -1, cles: 0 }; }
        };

        const cleMorte = sonde("API key not valid. Please pass a valid API key.");
        const requeteFautive = sonde("Invalid JSON payload received.");

        verifier(cleMorte.cles >= 3,
            `la sonde n'a chargé que ${cleMorte.cles} clé(s) — impossible d'observer la rotation`);
        verifier(cleMorte.flux === cleMorte.cles,
            `une clé invalide n'a fait essayer que ${cleMorte.flux} clé(s) sur ${cleMorte.cles} en flux — ` +
            "le corps d'erreur n'est pas drainé, donc estCleMorte() ne peut pas lire le message, " +
            "et une clé morte en tête de liste bloquerait toutes les autres");
        verifier(requeteFautive.flux === 1,
            `une erreur qui n'a rien à voir avec la clé a fait ${requeteFautive.flux} tentatives — ` +
            "on brûle toutes les clés pour un bug qui est chez nous");
    }

    // ── 5. LES DEUX ROUTES PARTAGENT LE MÊME COMPTEUR ────────────────────
    {
        const src = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
        const flux = src.match(/router\.post\("\/chat\/flux",\s*([a-zA-Z]+)/);
        const normal = src.match(/router\.post\("\/chat",\s*([a-zA-Z]+)/);
        verifier(flux && normal && flux[1] === normal[1],
            "/chat/flux et /chat n'utilisent pas le même limiteur — alterner entre les deux doublerait le quota gratuit");

        // Et la normalisation des entrées est partagée, pas recopiée : deux
        // copies finiraient par diverger, et l'une ouvrirait la porte que
        // l'autre ferme.
        // « = preparerEntree(req) » et pas « preparerEntree(req) » tout court :
        // sinon on compte aussi la ligne qui DÉCLARE la fonction, et le
        // compte est faux de un — ce qui a fait échouer la première version.
        verifier((src.match(/=\s*preparerEntree\(req\)/g) || []).length === 2,
            "les deux routes ne passent pas par la même normalisation d'entrée");

        // Le tampon des proxys : sans cet en-tête, nginx garde tout jusqu'à
        // la fin et rend le streaming invisible — en production seulement.
        verifier(/X-Accel-Buffering/.test(src),
            "X-Accel-Buffering absent — un proxy mettra la réponse en tampon et le flux sera perdu en production");

        // ── 6. L'ANCIENNE ROUTE EXISTE TOUJOURS ──────────────────────────
        verifier(/router\.post\("\/chat",/.test(src),
            "la route /chat a disparu — les navigateurs sans flux n'ont plus rien");
    }

    // ── LE CLIENT SAIT-IL RETOMBER ? ─────────────────────────────────────
    {
        const js = fs.readFileSync(path.join(RACINE, "public", "js", "samii-accueil.js"), "utf8");
        verifier(/\/vitrine\/chat\/flux/.test(js) && /"\/vitrine\/chat"/.test(js),
            "le client ne connaît pas les deux routes — il ne peut pas retomber");
        verifier(/sansFlux\(cible, corps\)/.test(js),
            "aucun repli vers la route sans flux");
        verifier(/text\/event-stream/.test(js),
            "le client ne vérifie pas que la réponse est bien un flux — une réponse JSON serait lue comme du SSE");
    }

    faussegoogle.close();
    axios.post = vraiPost;

    if (echecs.length) {
        console.log(`\n❌ flux : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exitCode = 1;
    } else {
        console.log(`✅ flux : ${verifs} vérifications passées`);
    }
})();
