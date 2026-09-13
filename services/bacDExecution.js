// ==========================================================================
// SAMII OS — L'EXÉCUTION DE CODE, DANS UN BAC
// ==========================================================================
//
// CE FICHIER N'ÉCRIT PAS DE CODE ET NE DÉCIDE DE RIEN.
//
// C'est délibéré, et c'est la séparation qui compte le plus dans ce chantier.
// Quatre choses distinctes, quatre endroits :
//
//   ÉCRIRE le code       le modèle, via brain/planner.js
//   DÉCIDER si on a le droit   brain/agents.js (niveau, palier, posture)
//   EXÉCUTER             ici, et ici seulement
//   FACTURER             config/credits.js
//
// Les mélanger, c'est se retrouver avec une permission vérifiée à l'endroit
// qui exécute — donc contournable dès qu'un deuxième appelant apparaît.
//
// Ce fichier reçoit du code déjà écrit, déjà autorisé, et rend ce qui s'est
// passé. Il ne demande jamais « est-ce que j'ai le droit ? » : la porte est
// ailleurs, et elle est passée avant qu'on arrive ici.
//
// ── CE N'EST PAS UNE SANDBOX DE PRODUCTION ───────────────────────────────
//
// Il ne faut pas l'appeler ainsi, et le code lui-même ne le prétend jamais :
// chaque bac DÉCLARE son niveau de garantie, axe par axe, et ce que cette
// machine tient a été mesuré commande par commande (voir config/bacs.js).
//
// GARANTI ICI, vérifié :
//   horloge     un programme qui dort 120 s est arrêté à 2,5 s
//   cpu         une boucle infinie est coupée à la seconde près
//   memoire     « Allocation failed » à la limite posée
//   processus   namespaces utilisateur + PID
//   reseau      unshare --net — ENETUNREACH, DNS muet
//   arrêt       le GROUPE est tué, pas la seule enveloppe
//   nettoyage   dossier jetable effacé même quand le programme plante
//
// NON GARANTI ICI, mesuré :
//   fichiers    le code a écrit /tmp/EVASION sur l'hôte et lu /etc/passwd.
//               Le remontage en lecture seule est refusé dans le namespace
//               utilisateur de ce conteneur.
//
// CONSÉQUENCE : `executer()` REFUSE par défaut. L'architecture est prête ;
// l'étanchéité demande une infrastructure dédiée (un démon de conteneurs).
// Ce n'est pas un bout de code inachevé — c'est la seule réponse honnête
// tant que le mur manque.
// ==========================================================================

const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const BACS = require("../config/bacs");

// ── LE DOSSIER JETABLE ───────────────────────────────────────────────────
//
// Un par exécution, effacé quoi qu'il arrive. « Quoi qu'il arrive » veut dire
// : même si le code plante, même s'il est tué, même si une exception remonte
// — d'où le `finally`. Un dossier oublié par exécution, c'est un disque plein
// en quelques jours, et un disque plein est une panne totale.
async function creerDossier() {
    return fs.mkdtemp(path.join(os.tmpdir(), "samii-bac-"));
}

async function effacerDossier(dossier) {
    if (!dossier) return;
    try {
        await fs.rm(dossier, { recursive: true, force: true });
        return true;
    } catch (err) {
        // On le dit fort : un nettoyage qui échoue en silence, on ne
        // l'apprend qu'une fois le disque plein.
        console.error(`❌ bac non effacé (${dossier}) :`, err.message);
        return false;
    }
}

// ── LES FICHIERS QUE LE CODE PEUT AVOIR SOUS LA MAIN ─────────────────────
//
// Refusés : les chemins absolus, les remontées (`..`), les sous-dossiers.
// Un nom de fichier vient du modèle : il peut être « ../../etc/passwd » sans
// aucune mauvaise intention, simplement parce que c'était dans son contexte.
const NOM_VALIDE = /^[a-zA-Z0-9_.-]{1,64}$/;

// La plainte que `unshare` émet après que le noyau a tué son enfant. Elle
// ne dit rien du programme exécuté : c'est notre outil d'isolement qui
// commente son propre nettoyage. Elle sert à ATTRIBUER l'arrêt, puis elle est
// retirée de ce qu'on montre.
//
// ── DEUX EXPRESSIONS, ET C'EST OBLIGATOIRE ───────────────────────────────
//
// Une seule expression avec `/g` servant à la fois à `.test()` et à
// `.replace()` aurait été un défaut silencieux, et un vilain : une expression
// globale garde un curseur entre les appels. Mesuré sur cette machine —
// `test()` rend vrai, puis FAUX, puis vrai, sur la même chaîne.
//
// Comme l'objet vit au niveau du module, il est partagé par toutes les
// exécutions : UNE EXÉCUTION SUR DEUX n'aurait pas été attribuée à la limite
// de calcul. La boucle aurait alors payé un appel d'IA pour corriger un
// programme sans aucune faute, une fois sur deux, sans que rien ne le dise.
const BRUIT_UNSHARE = /unshare: [^\n]*/;          // pour reconnaître
const BRUIT_UNSHARE_TOUT = /unshare: [^\n]*\n?/g; // pour effacer

// ── TUER TOUT CE QUI A ÉTÉ LANCÉ ─────────────────────────────────────────
//
// Le groupe entier, jamais le seul processus que Node connaît. Et on retente
// sur le processus seul si le groupe a déjà disparu : entre les deux, un bac
// qu'on n'arrive pas à arrêter est pire qu'un bac absent.
function tuerLeGroupe(enfant) {
    try { process.kill(-enfant.pid, "SIGKILL"); return; } catch { /* groupe déjà parti */ }
    try { enfant.kill("SIGKILL"); } catch { /* déjà mort */ }
}

function nomAcceptable(nom) {
    const n = String(nom || "");
    if (!NOM_VALIDE.test(n)) return false;
    if (n === "." || n === "..") return false;
    if (n.startsWith(".")) return false;   // pas de .npmrc, pas de .env
    return true;
}

// ══════════════════════════════════════════════════════════════════════════
// EXÉCUTER
// ══════════════════════════════════════════════════════════════════════════
//
// Rend TOUJOURS un objet, ne lève JAMAIS. Un appelant qui doit envelopper
// chaque appel dans un try/catch finit par en oublier un, et c'est la file
// entière qui tombe pour un programme mal écrit.
//
//   { ok, refuse, stdout, stderr, code, dureeMs, tue, raison, bac, degrade }
//
//   refuse   on n'a même pas essayé (aucun bac sûr, langage inconnu, fichier
//            au nom interdit). À ne pas confondre avec un programme qui a
//            échoué : l'un est notre limite, l'autre est son erreur à lui.
//   tue      le programme a été arrêté par une limite. `raison` dit laquelle.
async function executer({ langage = "javascript", code = "", fichiers = {}, limites = {} } = {}) {
    const debut = Date.now();

    const lang = BACS.langage(langage);
    if (!lang) {
        return { ok: false, refuse: true, raison: `langage non pris en charge : ${langage}`, stdout: "", stderr: "", dureeMs: 0 };
    }
    if (!String(code || "").trim()) {
        return { ok: false, refuse: true, raison: "aucun code à exécuter", stdout: "", stderr: "", dureeMs: 0 };
    }

    // ── LA PORTE DU BAC ──────────────────────────────────────────────────
    //
    // Elle est ici parce qu'elle porte sur la MACHINE, pas sur la personne.
    // Les droits de la personne ont été vérifiés bien avant, dans
    // brain/agents.js. Les deux questions sont différentes et doivent le
    // rester : « as-tu le droit » et « peut-on le faire sans danger ».
    const choix = BACS.choisir();
    if (!choix.bac) {
        return {
            ok: false, refuse: true, stdout: "", stderr: "", dureeMs: 0,
            raison: choix.raison,
            ecartes: choix.ecartes,
        };
    }

    // Les noms de fichiers d'abord : inutile de créer un dossier pour
    // refuser juste après.
    for (const nom of Object.keys(fichiers)) {
        if (!nomAcceptable(nom)) {
            return {
                ok: false, refuse: true, stdout: "", stderr: "", dureeMs: 0,
                raison: `nom de fichier refusé : « ${nom} » — seuls des noms simples, dans le dossier du bac`,
            };
        }
    }

    const l = BACS.limites(limites);
    let dossier = null;

    try {
        dossier = await creerDossier();
        await fs.writeFile(path.join(dossier, lang.fichier), String(code), "utf8");
        for (const [nom, contenu] of Object.entries(fichiers)) {
            await fs.writeFile(path.join(dossier, nom), String(contenu ?? ""), "utf8");
        }

        const resultat = await lancer({ bac: choix.bac, lang, dossier, limites: l });
        return {
            ...resultat,
            bac: choix.bac.id,
            degrade: choix.degrade,
            dureeMs: Date.now() - debut,
        };
    } catch (err) {
        return {
            ok: false, refuse: false, stdout: "", stderr: String(err.message || err),
            raison: "l'exécution n'a pas pu être lancée", dureeMs: Date.now() - debut,
            bac: choix.bac.id,
        };
    } finally {
        // ── LE NETTOYAGE, QUOI QU'IL ARRIVE ──────────────────────────────
        //
        // Dans un `finally`, jamais après le `return` du chemin heureux. Un
        // programme qui plante laisserait sinon son dossier derrière lui, et
        // c'est précisément le programme qui plante qu'on relance le plus.
        await effacerDossier(dossier);
    }
}

// ── LA COMMANDE, ET SES MURS ─────────────────────────────────────────────
//
// L'ordre des enveloppes compte :
//
//   unshare   sépare les processus (le code ne voit pas la machine)
//     ulimit  borne CPU, taille de fichier, nombre de processus
//       node  borne le tas V8
//
// `ulimit -v` est volontairement absent : mesuré sur cette machine, il
// empêche Node de démarrer (« Failed to reserve virtual memory for
// CodeRange »). La mémoire se borne par `--max-old-space-size`, qui est dans
// la commande du langage.
function commandeIsolee({ bac, lang, limites }) {
    const programme = lang.commande(limites).map((x) => `'${String(x).replace(/'/g, "'\\''")}'`).join(" ");
    const bornes = `ulimit -t ${limites.cpuSecondes} -f ${limites.fichierKo} -u ${limites.processusMax}`;
    const ligne = `${bornes} && exec ${programme}`;

    if (bac.id === "conteneur") {
        // Déclaré, jamais exécuté ici : le démon ne répond pas sur cette
        // machine. La forme est écrite pour que le jour où il existe, il n'y
        // ait rien à inventer — et pour que ce qui manque se lise.
        return {
            commande: "docker",
            args: ["run", "--rm", "--network", "none",
                "--memory", `${limites.memoireMo}m`, "--cpus", "1",
                "--pids-limit", String(limites.processusMax),
                "--read-only", "--tmpfs", "/travail:rw,size=8m",
                "-v", `${"${DOSSIER}"}:/travail:ro`, "-w", "/travail",
                "node:20-alpine", "sh", "-c", ligne],
        };
    }

    return {
        commande: "unshare",
        // ── `--net` FERME VRAIMENT LE RÉSEAU ─────────────────────────────
        //
        // ⚠️ AJOUTÉ APRÈS MESURE, ET LE TROU ÉTAIT SÉRIEUX. Sans ce drapeau,
        // le code exécuté avait le réseau COMPLET : mesuré, une connexion TCP
        // vers 1.1.1.1:443 aboutissait et le DNS résolvait example.com.
        //
        // Comme le système de fichiers n'est pas étanche non plus, les deux
        // se combinaient en la pire des situations : lire un fichier de la
        // machine, puis l'envoyer dehors. Un vol complet, sans rien casser.
        //
        // Avec `--net`, l'espace réseau est vide : mesuré, ENETUNREACH, et le
        // DNS ne répond plus. C'est le seul des deux murs manquants que cette
        // machine permet de fermer — on le ferme.
        args: ["--user", "--map-root-user", "--pid", "--fork", "--mount-proc", "--net",
            "bash", "-c", ligne],
    };
}

function lancer({ bac, lang, dossier, limites }) {
    return new Promise((resolve) => {
        const { commande, args } = commandeIsolee({ bac, lang, limites });

        const enfant = spawn(commande, args, {
            cwd: dossier,
            // ── L'ENVIRONNEMENT EST VIDÉ ─────────────────────────────────
            //
            // Pas `process.env`. Le processus de SAMII porte les clés Gemini,
            // l'URL de la base, le secret de session. Les passer au code
            // exécuté rendrait tout le reste inutile : plus besoin de sortir
            // du bac pour tout voler, il suffirait de lire son environnement.
            env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: dossier, LANG: "C.UTF-8" },
            stdio: ["ignore", "pipe", "pipe"],
            // ── UN GROUPE À PART, POUR POUVOIR TOUT TUER ─────────────────
            //
            // ⚠️ TROUVÉ PAR LE TEST DU PROGRAMME QUI DORT, ET C'ÉTAIT GRAVE.
            //
            // `unshare --fork` fait du programme le PID 1 d'un nouvel espace
            // de noms, et `unshare` n'est que son parent. Tuer l'enfant que
            // Node connaît — l'enveloppe — NE TUAIT PAS le programme à
            // l'intérieur. Mesuré : la suite entière restait bloquée, et un
            // processus orphelin continuait de tourner après coup.
            //
            // Autrement dit, « arrêt » ne marchait pas. Un programme qui dort
            // dix minutes aurait tenu ses dix minutes, limite ou pas.
            //
            // `detached` lui donne son propre groupe ; on tue alors le GROUPE
            // (`-pid`), ce qui emporte l'enveloppe et tout ce qu'elle a lancé.
            detached: true,
        });

        let stdout = "";
        let stderr = "";
        let tue = false;
        let raison = null;

        // ── L'HORLOGE MURALE ─────────────────────────────────────────────
        //
        // `ulimit -t` compte le temps CPU : un programme qui DORT ne le
        // consomme pas et ne serait jamais coupé. Celui-ci coupe quoi qu'il
        // fasse.
        const minuteur = setTimeout(() => {
            tue = true;
            raison = `arrêté après ${limites.tempsMs} ms (temps dépassé)`;
            // SIGKILL et pas SIGTERM : un programme peut ignorer SIGTERM, et
            // un bac qu'on peut refuser de quitter n'est pas un bac.
            //
            // Le GROUPE et pas le processus : voir `detached` plus haut. Un
            // `enfant.kill()` seul laissait tourner le programme isolé.
            tuerLeGroupe(enfant);
        }, limites.tempsMs);

        // On tronque À LA VOLÉE, pas à la fin : un programme qui écrit un
        // gigaoctet ne doit pas d'abord le faire tenir en mémoire.
        const ajouter = (cible, morceau) => {
            if (cible.length >= limites.sortieMax) return cible;
            return (cible + morceau).slice(0, limites.sortieMax);
        };
        enfant.stdout.on("data", (d) => { stdout = ajouter(stdout, d.toString("utf8")); });
        enfant.stderr.on("data", (d) => { stderr = ajouter(stderr, d.toString("utf8")); });

        enfant.on("error", (err) => {
            clearTimeout(minuteur);
            resolve({ ok: false, refuse: false, stdout, stderr: String(err.message), code: null, tue: false,
                raison: `le bac n'a pas pu démarrer : ${err.message}` });
        });

        enfant.on("close", (code, signal) => {
            clearTimeout(minuteur);

            // ── ATTRIBUER L'ARRÊT, DANS LE BON ORDRE ─────────────────────
            //
            // ⚠️ L'ORDRE DE CES TROIS TESTS A ÉTÉ CORRIGÉ APRÈS MESURE.
            //
            // Première version : le signal était examiné en premier. Or une
            // mémoire dépassée remonte ici en SIGSEGV — mesuré, code 139 —
            // alors que stderr dit clairement « FATAL ERROR … Allocation
            // failed ». Le test du signal gagnait, et SAMII annonçait « arrêté
            // par le signal SIGSEGV » à quelqu'un dont le programme avait
            // simplement demandé trop de mémoire. On envoyait chercher un bug
            // de bas niveau là où il n'y avait qu'une limite atteinte.
            //
            // La preuve la plus PARLANTE passe donc en premier, la plus vague
            // en dernier.

            // 1. Ce que le moteur dit lui-même. Le plus fiable.
            if (!tue && /heap out of memory|Allocation failed|FATAL ERROR/i.test(stderr)) {
                tue = true;
                raison = `arrêté : ${limites.memoireMo} Mo de mémoire dépassés`;
            }

            // 2. LA SIGNATURE DE `unshare` QUAND LE NOYAU TUE L'ENFANT.
            //
            // Mesuré : une boucle infinie sous `ulimit -t 2` sort au bout de
            // deux secondes avec le code 1 et cette seule ligne sur stderr —
            // `unshare` se plaint de son propre nettoyage après que le noyau a
            // tué le processus. Aucun signal ne remonte jusqu'à nous.
            //
            // Sans ce cas, un programme parfaitement arrêté par sa limite de
            // calcul était rapporté comme « s'est arrêté avec le code 1 », et
            // la boucle de correction payait un appel d'IA pour corriger un
            // programme qui n'avait aucune faute.
            if (!tue && BRUIT_UNSHARE.test(stderr) && code !== 0) {
                tue = true;
                raison = `arrêté : ${limites.cpuSecondes} s de calcul dépassées`;
            }

            // 3. Un vrai signal, quand il arrive jusqu'ici.
            if (!tue && signal) {
                tue = true;
                raison = signal === "SIGXCPU" || signal === "SIGKILL"
                    ? `arrêté : ${limites.cpuSecondes} s de calcul dépassées`
                    : `arrêté par le signal ${signal}`;
            }

            resolve({
                ok: !tue && code === 0,
                refuse: false,
                // ── ON NE MONTRE PAS NOS PLOMBERIES ──────────────────────
                //
                // La plainte de `unshare` parle de NOTRE bac, pas du programme
                // du marchand. Laissée dans stderr, elle part au modèle, qui
                // essaie alors de corriger une erreur qui n'est pas dans le
                // code — et qui la répète à la personne.
                stdout, stderr: stderr.replace(BRUIT_UNSHARE_TOUT, "").trim(), code, tue,
                raison: raison || (code === 0 ? null : `le programme s'est arrêté avec le code ${code}`),
            });
        });
    });
}

module.exports = { executer, nomAcceptable, effacerDossier, __test_commandeIsolee: commandeIsolee };
