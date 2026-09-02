// ==========================================================================
// PIPER — UNE VRAIE VOIX D'HOMME FRANÇAISE, SUR NOTRE SERVEUR
// ==========================================================================
//
// ── LE TROU QUE ÇA BOUCHE ─────────────────────────────────────────────────
//
// Mesuré dans un vrai navigateur, avec les voix du système :
//
//     Windows / Edge  → « Microsoft Paul »  ✅ une vraie voix d'homme
//     macOS           → « Thomas »          ✅ une vraie voix d'homme
//     Android         → AUCUNE voix d'homme française n'existe
//     navigateur nu   → aucune voix du tout
//
// Dans les deux derniers cas, `voix-sortie.js` prend la voix disponible et
// lui descend la hauteur à 0,72. Ça sonne plus grave — ce n'est pas un
// homme. C'est un pansement, et il a été posé en le sachant.
//
// Or au Cameroun, la marchande est sur Android. Le cas « pas de voix
// d'homme » n'est pas le cas rare : c'est le cas le plus courant.
//
// Piper synthétise la phrase ICI, sur le serveur, avec un vrai modèle de
// voix masculine française, et renvoie un fichier audio. Le téléphone n'a
// plus qu'à le jouer — il n'a besoin d'aucune voix installée.
//
// ── POURQUOI UN PROCESSUS SÉPARÉ, ET PAS UNE BIBLIOTHÈQUE ─────────────────
//
// Piper est sous licence GPL. Lié dans notre code, cette licence se
// propagerait à SAMII, qui est un produit fermé. Appelé comme un programme
// séparé — on lance un exécutable, on lui passe du texte, il rend un
// fichier — il reste un outil qu'on utilise, pas du code qu'on intègre.
// C'est la distinction classique, et c'est pour ça que ce fichier lance un
// binaire au lieu de faire `require("piper")`.
//
// ⚠️ Chaque VOIX a par ailleurs sa propre licence, indépendante de celle du
// moteur. À vérifier voix par voix avant un usage commercial.
//
// ── RIEN N'EST INSTALLÉ PAR DÉFAUT ────────────────────────────────────────
//
// Sans les deux variables ci-dessous, ce service répond « indisponible » et
// la chaîne de voix se comporte exactement comme avant. Aucun
// téléchargement, aucun binaire, aucun ralentissement. Voir
// `scripts/installer-piper.sh` pour l'installation sur Render.
//
// ── CE QUE JE N'AI PAS PU VÉRIFIER ────────────────────────────────────────
//
// L'environnement où j'ai écrit ce fichier ne peut pas joindre Hugging
// Face (refus du proxy). Je n'ai donc PAS pu télécharger un modèle de voix
// ni entendre Piper parler. Ce qui est vérifié : que le service se déclare
// indisponible proprement quand rien n'est installé, que la route refuse
// les anonymes et borne la taille, et que la chaîne de voix reprend son
// comportement d'avant. Ce qui reste à vérifier sur Render, en une
// commande : que le binaire produit bien un son. `/api/voix/piper/etat` est
// là pour ça.

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const BINAIRE = (process.env.PIPER_BIN || "").trim();
const MODELE = (process.env.PIPER_MODELE || "").trim();

// Une phrase de SAMII fait quelques centaines de caractères. Au-delà, ce
// n'est plus une réponse : c'est quelqu'un qui fait chauffer notre serveur.
const MAX_CARACTERES = 800;

// La synthèse d'une phrase prend une seconde ou deux. Dix, c'est que
// quelque chose est bloqué — on rend la main plutôt que de laisser la
// marchande devant une bulle qui tourne.
const DELAI_MAX_MS = 10000;

function disponible() {
    if (!BINAIRE || !MODELE) return false;
    try {
        // On regarde vraiment sur le disque : une variable posée sur Render
        // qui pointe vers un fichier absent est plus trompeuse qu'une
        // variable vide — elle promet une voix qui ne viendra pas.
        fs.accessSync(BINAIRE, fs.constants.X_OK);
        fs.accessSync(MODELE, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

// Ce que le fondateur voit sur /api/voix/piper/etat : pourquoi c'est
// éteint, précisément. « Il manque PIPER_MODELE » et « le fichier pointé
// par PIPER_MODELE n'existe pas » sont deux problèmes différents, et se
// réparent différemment.
function etat() {
    const rapport = {
        disponible: false,
        binaire: BINAIRE || null,
        modele: MODELE || null,
        raison: null,
    };
    if (!BINAIRE) { rapport.raison = "PIPER_BIN n'est pas posée."; return rapport; }
    if (!MODELE) { rapport.raison = "PIPER_MODELE n'est pas posée."; return rapport; }
    try { fs.accessSync(BINAIRE, fs.constants.X_OK); }
    catch { rapport.raison = `Le binaire ${BINAIRE} est absent ou non exécutable.`; return rapport; }
    try { fs.accessSync(MODELE, fs.constants.R_OK); }
    catch { rapport.raison = `Le modèle de voix ${MODELE} est absent ou illisible.`; return rapport; }
    // Piper exige un fichier .onnx.json à côté du .onnx : sans lui il
    // démarre puis échoue, ce qui est plus dur à diagnostiquer qu'un refus
    // net ici.
    if (!fs.existsSync(MODELE + ".json")) {
        rapport.raison = `Le fichier ${path.basename(MODELE)}.json manque à côté du modèle.`;
        return rapport;
    }
    rapport.disponible = true;
    return rapport;
}

// Rend un Buffer WAV, ou null. Jamais d'exception : un service de confort
// qui fait tomber une requête de chat serait un mauvais échange.
async function synthetiser(texte) {
    if (!disponible()) return null;
    const propre = String(texte || "").trim().slice(0, MAX_CARACTERES);
    if (!propre) return null;

    // Un fichier par appel, dans le dossier temporaire du système, avec un
    // nom aléatoire : deux marchandes qui parlent en même temps ne doivent
    // pas s'écrire l'une sur l'autre.
    const sortie = path.join(os.tmpdir(),
        `piper-${crypto.randomBytes(8).toString("hex")}.wav`);

    try {
        await new Promise((resoudre, rejeter) => {
            // execFile et NON exec : le texte part comme argument séparé,
            // jamais interprété par un shell. Sans ça, une réponse de SAMII
            // contenant un point-virgule ou une apostrophe deviendrait une
            // commande exécutée sur le serveur.
            const enfant = execFile(BINAIRE,
                ["--model", MODELE, "--output_file", sortie],
                { timeout: DELAI_MAX_MS },
                (err) => (err ? rejeter(err) : resoudre()));
            enfant.stdin.end(propre);
        });
        const audio = await fs.promises.readFile(sortie);
        // Piper écrit un en-tête WAV de 44 octets même quand il n'a rien
        // synthétisé. Un fichier quasi vide n'est pas une voix.
        return audio.length > 1000 ? audio : null;
    } catch (err) {
        console.error("❌ Piper :", err.message);
        return null;
    } finally {
        fs.promises.unlink(sortie).catch(() => { /* déjà parti */ });
    }
}

module.exports = { disponible, etat, synthetiser, MAX_CARACTERES };
