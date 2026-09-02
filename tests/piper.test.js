// ==========================================================================
// PIPER — CE QU'ON VEUT GARDER VRAI
// ==========================================================================
//
// Ce fichier ne vérifie PAS que Piper parle bien : ça, seule une vraie
// synthèse le dit, et elle a été faite à la main (60 900 octets de WAV
// rendus par le serveur, joués dans un vrai Chromium).
//
// Il verrouille la chose qui casserait en silence : que SAMII se comporte
// EXACTEMENT comme avant quand Piper n'est pas installé. C'est le risque
// réel — un service de confort mal branché qui rend la voix muette chez
// tout le monde parce qu'un binaire manque sur le serveur.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passees = 0;
function verifier(condition, quoi) {
    assert.ok(condition, quoi);
    passees++;
}

// Chaque cas dans un processus séparé : `services/piper.js` lit les
// variables d'environnement au chargement du module, une seule fois. Les
// changer après coup dans le même processus ne changerait rien, et le test
// mesurerait toujours le premier état — en passant au vert sans rien
// prouver.
const { execFileSync } = require("child_process");
function etatAvec(env) {
    const sortie = execFileSync(process.execPath, ["-e",
        `console.log(JSON.stringify(require(${JSON.stringify(path.join(__dirname, "..", "services", "piper.js"))}).etat()))`],
        { env: { ...process.env, PIPER_BIN: "", PIPER_MODELE: "", ...env } });
    return JSON.parse(sortie.toString());
}

console.log("\n── Piper se déclare indisponible, et dit pourquoi ──");
{
    const rien = etatAvec({});
    verifier(rien.disponible === false, "sans variable, Piper est indisponible");
    verifier(/PIPER_BIN/.test(rien.raison), "et la raison nomme la variable manquante");

    const binSeul = etatAvec({ PIPER_BIN: process.execPath });
    verifier(binSeul.disponible === false, "avec le binaire seul, toujours indisponible");
    verifier(/PIPER_MODELE/.test(binSeul.raison), "et la raison nomme le modèle");

    const binFaux = etatAvec({ PIPER_BIN: "/nexiste/pas", PIPER_MODELE: __filename });
    verifier(binFaux.disponible === false, "un binaire qui n'existe pas ne rend pas Piper prêt");
    verifier(/absent|exécutable/i.test(binFaux.raison), "et on dit que le binaire est absent");

    // Le piège vécu : une variable posée sur Render qui pointe vers un
    // fichier absent est PLUS trompeuse qu'une variable vide — elle promet
    // une voix qui ne viendra jamais.
    const modeleFaux = etatAvec({ PIPER_BIN: process.execPath, PIPER_MODELE: "/nexiste/pas.onnx" });
    verifier(modeleFaux.disponible === false, "un modèle qui n'existe pas ne rend pas Piper prêt");

    // Piper exige un .onnx.json à côté du .onnx. Sans lui il démarre puis
    // échoue — un mode de panne bien plus dur à diagnostiquer qu'un refus
    // net au départ.
    const sansJson = etatAvec({ PIPER_BIN: process.execPath, PIPER_MODELE: __filename });
    verifier(sansJson.disponible === false, "un modèle sans son .json ne rend pas Piper prêt");
    verifier(/\.json/.test(sansJson.raison), "et la raison nomme le fichier .json manquant");
}

console.log("── Une mise à l'épreuve : le contrôle sait-il dire oui ? ──");
{
    // Un contrôle qui ne répond jamais « disponible » passerait au vert
    // même si `disponible()` renvoyait `false` en dur. On lui donne donc un
    // jeu de fichiers complet et valide : il DOIT répondre oui.
    const dossier = fs.mkdtempSync(path.join(require("os").tmpdir(), "piper-essai-"));
    const modele = path.join(dossier, "voix.onnx");
    fs.writeFileSync(modele, "modèle factice");
    fs.writeFileSync(modele + ".json", "{}");
    const complet = etatAvec({ PIPER_BIN: process.execPath, PIPER_MODELE: modele });
    verifier(complet.disponible === true,
             "avec binaire + modèle + .json, Piper se déclare disponible");
    verifier(complet.raison === null, "et aucune raison de refus n'est donnée");
    fs.rmSync(dossier, { recursive: true, force: true });
}

console.log("── La synthèse ne lève jamais, elle rend null ──");
{
    // Un service de confort qui lève une exception ferait tomber la requête
    // de chat qui l'appelle. Il doit décliner, pas casser.
    const sortie = execFileSync(process.execPath, ["-e",
        `const p = require(${JSON.stringify(path.join(__dirname, "..", "services", "piper.js"))});
         Promise.all([p.synthetiser("bonjour"), p.synthetiser(""), p.synthetiser(null)])
             .then((r) => console.log(JSON.stringify(r.map((x) => x === null))))
             .catch((e) => console.log("LEVE:" + e.message));`],
        { env: { ...process.env, PIPER_BIN: "", PIPER_MODELE: "" } }).toString().trim();
    verifier(!sortie.startsWith("LEVE:"), "synthetiser ne lève pas quand Piper est absent");
    verifier(sortie === "[true,true,true]", "elle rend null pour du texte, du vide et du null");
}

console.log("── Le navigateur n'appelle Piper QUE s'il n'a pas d'homme ──");
{
    const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "voix-sortie.js"), "utf8");

    // On ne relit pas la forme du code — on isole la branche et on regarde
    // ce qu'elle contient. Le point qui compte : dans la branche « le
    // navigateur A un homme », Piper ne doit PAS apparaître, sinon on fait
    // travailler le serveur pour faire moins bien que Paul ou Thomas.
    const debut = source.indexOf("if (navigateurAUnHomme())");
    assert.ok(debut > 0, "la branche navigateurAUnHomme doit exister");
    const sinon = source.indexOf("} else {", debut);
    const brancheAvecHomme = source.slice(debut, sinon);
    const brancheSansHomme = source.slice(sinon, source.indexOf("if (!dit) dit = await parlerElevenLabs", sinon));

    verifier(!/parlerPiper/.test(brancheAvecHomme),
             "quand le système a un homme, Piper n'est pas appelé");
    verifier(/parlerPiper/.test(brancheSansHomme),
             "quand il n'en a pas, Piper est appelé");
    // Et il doit passer AVANT le repli qui descend la hauteur à 0,72 —
    // sinon on garde le pansement alors qu'une vraie voix est disponible.
    verifier(brancheSansHomme.indexOf("parlerPiper") < brancheSansHomme.indexOf("parlerNavigateur"),
             "et il passe avant le repli « voix descendue au grave »");

    // Le refus mémorisé : sans lui, chaque phrase déclenche un aller-retour
    // réseau inutile sur un serveur où Piper n'est pas installé — avant
    // CHAQUE mot, sur une connexion mobile.
    verifier(/etat\.piper === false/.test(source),
             "un refus du serveur est mémorisé, pas redemandé à chaque phrase");
    // Mais une panne réseau n'est PAS une preuve d'absence : si le catch
    // éteignait Piper, une coupure de trois secondes le tuerait pour toute
    // la session.
    const catchPiper = source.slice(source.indexOf("async function parlerPiper"),
                                    source.indexOf("async function parlerElevenLabs"));
    const apresCatch = catchPiper.slice(catchPiper.lastIndexOf("} catch"));
    verifier(!/etat\.piper\s*=\s*false/.test(apresCatch),
             "une panne réseau n'éteint pas Piper pour la session");
}

console.log(`\n✅ piper : ${passees} vérifications passées`);
