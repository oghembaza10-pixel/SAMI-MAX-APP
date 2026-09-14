// ==========================================================================
// SAMII OS — EXÉCUTER DU CODE SANS OUVRIR LA MACHINE
// ==========================================================================
//
// C'EST LA CAPACITÉ LA PLUS DANGEREUSE DU PROJET.
//
// Un outil qui se trompe envoie un mauvais e-mail. Du code qui s'échappe lit
// la base, les clés, les commandes de tous les marchands. Cette suite mesure
// donc autant ce qui MARCHE que ce qui est REFUSÉ.
//
// ── CE QUI A ÉTÉ MESURÉ SUR CETTE MACHINE ────────────────────────────────
//
//   docker              binaire présent, DÉMON INJOIGNABLE
//   unshare             namespaces utilisateur + PID fonctionnels
//   ulimit -t           coupe une boucle infinie à 2 s
//   ulimit -v           inutilisable pour Node (V8 meurt au démarrage)
//   --max-old-space-size le bon levier mémoire
//   remontage en lecture seule dans le namespace : REFUSÉ
//
// Et le fait qui commande tout : AVEC UNSHARE SEUL, LE CODE A ÉCRIT DANS
// /tmp DE L'HÔTE ET A LU /etc/passwd. Le fichier était là après coup.
//
// D'où la règle : par défaut, on N'EXÉCUTE PAS. Ce n'est pas un bout de code
// inachevé, c'est le seul état honnête tant que le mur des fichiers manque.
//
// ── CE QUI EST PROUVÉ ICI, ET CE QUI NE L'EST PAS ────────────────────────
//
// PROUVÉ  : le refus par défaut, les limites de temps et de mémoire, la
//           capture des sorties, le nettoyage, les noms de fichiers refusés,
//           l'environnement vidé, la boucle de correction, les permissions,
//           l'impossibilité pour le chat public et pour un client d'atteindre
//           cet outil.
// NON DISPONIBLE : l'isolement du système de fichiers. Aucun test ne peut le
//           prouver ici puisqu'il n'existe pas — la suite vérifie au
//           contraire qu'on REFUSE d'exécuter tant qu'il manque.
//
// Lancer :  npm test
// ==========================================================================

const path = require("path");
const fs = require("fs");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const BACS = require(path.join(RACINE, "config", "bacs.js"));
const bac = require(path.join(RACINE, "services", "bacDExecution.js"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux.js"));
const MOTEURS = require(path.join(RACINE, "config", "moteurs.js"));
const REGISTRE = require(path.join(RACINE, "config", "agents.js"));
const agents = require(path.join(RACINE, "brain", "agents.js"));

const DRAPEAU = "EXECUTION_CODE_SANS_ISOLATION_FICHIERS";
const VALEUR = "JE SAIS QUE LE CODE PEUT LIRE ET ECRIRE SUR LA MACHINE";

const MAITRE = { niveau: "maitre", palier: "pro", mode: "autonome", audience: "souverain", workspaceId: "w1" };

// ══════════════════════════════════════════════════════════════════════════
// 1. PAR DÉFAUT, ON N'EXÉCUTE PAS
// ══════════════════════════════════════════════════════════════════════════
//
// LA GARDE LA PLUS IMPORTANTE DE LA SUITE. Tant qu'aucun bac ne ferme le
// système de fichiers, l'exécution est refusée — quelles que soient les
// permissions de la personne.
{
    delete process.env[DRAPEAU];
    BACS.oublierLesSondes();

    const choix = BACS.choisir();
    verifier(choix.bac === null,
        `un bac est retenu par défaut (${choix.bac?.id}) alors qu'aucun ne ferme le système de ` +
        "fichiers : du code écrit par un modèle pourrait lire la base et les clés");
    verifier(choix.ecartes.some((e) => e.id === "processus" && /fichiers/i.test(e.raison)),
        `le bac « processus » est écarté sans dire que l'isolement des fichiers manque ` +
        `(${JSON.stringify(choix.ecartes)})`);

    // Le conteneur est déclaré mais absent — comme gemini-pro au chantier 7.
    verifier(BACS.BACS.conteneur.garanties.fichiers === "etanche",
        "le conteneur ne déclare pas un système de fichiers étanche : c'est pourtant la seule " +
        "raison de le préférer");
    verifier(BACS.BACS.processus.garanties.fichiers === "non_etanche",
        `le bac « processus » annonce « ${BACS.BACS.processus.garanties.fichiers} » pour les ` +
        "fichiers : mesuré, il a écrit /tmp/EVASION sur l'hôte et lu /etc/passwd. Toute autre " +
        "valeur est un mensonge qui coûterait la base");
}

// ══════════════════════════════════════════════════════════════════════════
// 1 bis. LE SYSTÈME CONNAÎT SON PROPRE NIVEAU DE GARANTIE
// ══════════════════════════════════════════════════════════════════════════
//
// « Bac isolé » ne veut rien dire : isolé de quoi, et jusqu'où ? Chaque axe
// porte un mot, chaque mot a été vérifié par une commande, et une exigence
// non tenue vaut REFUS — pas « presque ».
{
    const etat = BACS.etat();

    // Tous les axes déclarés sur tous les bacs, avec un mot du vocabulaire.
    for (const b of etat.bacs) {
        for (const axe of BACS.AXES) {
            const v = b.garanties[axe];
            verifier(v && (BACS.NIVEAUX_DE_GARANTIE.includes(v) || v === "etanche"),
                `le bac « ${b.id} » ne dit rien de l'axe « ${axe} » (${v}) : un axe muet est un ` +
                "trou qu'on ne voit pas");
        }
    }

    // Une exigence non tenue est un refus, jamais un avertissement.
    verifier(BACS.axeTenu({ fichiers: "non_etanche" }, "fichiers", "etanche") === false,
        "« non_etanche » satisfait une exigence d'étanchéité : on appellerait « sécurisé » un bac " +
        "qui écrit sur l'hôte");
    verifier(BACS.axeTenu({ reseau: "non_garanti" }, "reseau", "ferme") === false,
        "« non_garanti » satisfait une exigence : ne pas savoir vaudrait oui");
    verifier(BACS.axeTenu({ reseau: "ferme" }, "reseau", "ferme") === true,
        "un axe réellement tenu est quand même refusé");

    // ── ON NE PEUT PAS ABAISSER UNE EXIGENCE POUR « FAIRE PASSER » ───────
    //
    // ⚠️ CE CAS A ÉTÉ TROUVÉ PAR UNE MUTATION SURVÉCUE. Retirer le refus
    // explicite de « non_etanche » et « non_garanti » ne faisait rien crier :
    // la comparaison d'égalité suffisait pour les données d'aujourd'hui, donc
    // la ligne semblait morte.
    //
    // Elle ne l'est pas. Le jour où quelqu'un, pressé, écrit
    // `EXIGENCES.fichiers = "non_etanche"` pour débloquer une exécution, la
    // seule égalité dirait OUI — l'exigence serait « satisfaite » par un bac
    // qui écrit sur l'hôte. C'est exactement le glissement qui mène à appeler
    // « sécurisé » ce qui ne l'est pas, et il ne se verrait dans aucun test.
    //
    // « non_etanche » et « non_garanti » ne peuvent donc JAMAIS satisfaire
    // quoi que ce soit, même une exigence qui les nommerait.
    verifier(BACS.axeTenu({ fichiers: "non_etanche" }, "fichiers", "non_etanche") === false,
        "abaisser l'exigence à « non_etanche » suffit à la satisfaire : n'importe qui pourrait " +
        "débloquer l'exécution en réécrivant l'exigence au lieu de fermer le mur");
    verifier(BACS.axeTenu({ reseau: "non_garanti" }, "reseau", "non_garanti") === false,
        "abaisser l'exigence à « non_garanti » suffit à la satisfaire : « on ne sait pas » " +
        "deviendrait une garantie");

    // Ce qui manque est NOMMÉ, axe par axe.
    const absents = BACS.manques(BACS.BACS.processus.garanties);
    verifier(absents.length === 1 && absents[0].axe === "fichiers",
        `les manques du bac « processus » sont ${JSON.stringify(absents)} : on attend exactement ` +
        "un axe — les fichiers — et pas un de plus, sinon une garantie réelle est sous-déclarée");
    verifier(absents[0].exige === "etanche" && absents[0].obtenu === "non_etanche",
        `le manque n'est pas explicite : ${JSON.stringify(absents[0])}`);

    verifier(etat.retenu === null,
        `l'état annonce le bac « ${etat.retenu} » comme retenu alors qu'aucun ne tient les ` +
        "garanties exigées");
}

// ══════════════════════════════════════════════════════════════════════════
// 1 ter. LE RÉSEAU EST FERMÉ — LE SEUL MUR MANQUANT QU'ON POUVAIT FERMER
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE TROU N'AVAIT PAS ÉTÉ MESURÉ AU PREMIER JET, ET IL ÉTAIT GRAVE.
//
// Sans `--net`, le code exécuté avait le réseau COMPLET : une connexion TCP
// vers 1.1.1.1:443 aboutissait, le DNS résolvait. Combiné au système de
// fichiers non étanche, ça faisait la pire des situations — lire un fichier
// de la machine, puis l'envoyer dehors. Un vol complet, sans rien casser.
{
    const src = fs.readFileSync(path.join(RACINE, "services", "bacDExecution.js"), "utf8");
    verifier(/"--net"/.test(src),
        "la commande d'isolement ne ferme pas le réseau : le code exécuté pourrait envoyer " +
        "dehors tout ce qu'il lit sur la machine");
    verifier(BACS.BACS.processus.garanties.reseau === "ferme",
        `le bac annonce « ${BACS.BACS.processus.garanties.reseau} » pour le réseau`);
}

// ══════════════════════════════════════════════════════════════════════════
// 2. LE DRAPEAU NE S'ACTIVE PAS PAR DISTRACTION
// ══════════════════════════════════════════════════════════════════════════
{
    for (const valeur of ["1", "true", "oui", "yes", "ok", ""]) {
        process.env[DRAPEAU] = valeur;
        BACS.oublierLesSondes();
        verifier(BACS.choisir().bac === null,
            `« ${DRAPEAU}=${valeur} » suffit à ouvrir l'exécution : un drapeau qu'on active ` +
            "avec « 1 » finit activé par erreur, et ici l'erreur ouvre la machine");
    }
    delete process.env[DRAPEAU];
    BACS.oublierLesSondes();
}

// ══════════════════════════════════════════════════════════════════════════
// 3. LES PERMISSIONS — AVANT MÊME DE PARLER DE BAC
// ══════════════════════════════════════════════════════════════════════════
//
// Deux verrous INDÉPENDANTS : le droit de la personne (ici) et la sûreté de
// la machine (au-dessus). Aucun des deux ne suffit seul, et c'est voulu.
{
    for (const niveau of ["rapide", "expert", "pro"]) {
        const r = agents.autoriser({ missionId: "executer_code", context: { ...MAITRE, niveau } });
        verifier(!r.autorise,
            `un tour ${niveau} peut exécuter du code : la capacité la plus dangereuse du projet ` +
            "serait ouverte à un abonnement qui ne la paie pas");
    }
    verifier(agents.autoriser({ missionId: "executer_code", context: MAITRE }).autorise,
        "le niveau Maître ne peut pas exécuter de code alors que c'est son niveau");

    // ── LES DEUX TABLES DOIVENT DIRE LA MÊME CHOSE ───────────────────────
    //
    // La mission exige Maître ; la famille d'outils est accordée à Maître.
    // Si elles divergeaient, c'est celle qui autorise le plus qui gagnerait
    // dans l'un des deux chemins — exactement le défaut trouvé au chantier 8.
    verifier(REGISTRE.mission("executer_code").niveauMin === "maitre",
        `la mission exige « ${REGISTRE.mission("executer_code").niveauMin} » et non « maitre »`);
    for (const n of ["rapide", "expert", "pro"]) {
        verifier(!NIVEAUX.outilsDe(n).includes("executer_code"),
            `le niveau ${n} porte l'outil « executer_code » alors que la mission exige Maître`);
    }
    verifier(NIVEAUX.outilsDe("maitre").includes("executer_code"),
        "le niveau Maître ne porte pas « executer_code » : la mission serait inatteignable");

    // ── LE COUPE-CIRCUIT VAUT AUSSI ICI ──────────────────────────────────
    const avant = process.env.SOCIAL_AGENTS_COUPES;
    process.env.SOCIAL_AGENTS_COUPES = "executeur";
    verifier(!agents.autoriser({ missionId: "executer_code", context: MAITRE }).autorise,
        "couper l'exécuteur n'empêche pas la mission : le coupe-circuit ne protégerait pas " +
        "la capacité qui en a le plus besoin");
    if (avant === undefined) delete process.env.SOCIAL_AGENTS_COUPES;
    else process.env.SOCIAL_AGENTS_COUPES = avant;
}

// ══════════════════════════════════════════════════════════════════════════
// 4. NI LE CHAT PUBLIC NI UN CLIENT NE PEUVENT EXÉCUTER
// ══════════════════════════════════════════════════════════════════════════
{
    const gemini = require(path.join(RACINE, "services", "geminiService.js"));
    const noms = (p) => (p?.[0]?.functionDeclarations || []).map((f) => f.name);

    // ── LE CHAT PUBLIC ───────────────────────────────────────────────────
    //
    // Il passe par `chatLibre`, qui ne porte AUCUN outil : la capacité lui
    // est structurellement hors de portée. On le vérifie plutôt que de le
    // supposer, parce que « structurellement » est exactement le genre
    // d'affirmation qui cesse d'être vraie sans prévenir.
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
    verifier(!/executer_code/.test(vitrine),
        "le chat public nomme « executer_code » : un visiteur sans compte pourrait faire " +
        "tourner du code sur notre infrastructure");
    verifier(/chatLibre/.test(vitrine) && !/planner\.(ask|build)/.test(vitrine),
        "le chat public passe par le planner complet : il porterait les outils, dont celui-ci");

    // ── UN CLIENT DE MARCHAND ────────────────────────────────────────────
    const chezUnClient = noms(gemini.__test_buildToolsPayload(true, { audience: "client", workspaceId: "ws1", tourDeConversation: true }, "gemini"));
    verifier(!chezUnClient.includes("executer_code"),
        `un client de boutique se voit offrir « executer_code » (${chezUnClient.length} outils) : ` +
        "n'importe qui écrivant à une boutique pourrait exécuter un programme chez nous");

    // ── LES RELAIS ───────────────────────────────────────────────────────
    for (const relais of ["groq", "openrouter", "deepseek"]) {
        verifier(!noms(gemini.__test_buildToolsPayload(false, { niveau: "maitre", audience: "souverain", tourDeConversation: true }, relais)).includes("executer_code"),
            `le relais ${relais} reçoit « executer_code » : une panne de Gemini confierait ` +
            "l'exécution de code à un moteur qu'on sait moins discipliné");
        verifier(!MOTEURS.moteur(relais).outilsFiables.includes("code"),
            `${relais} déclare porter la famille « code »`);
    }
    verifier(noms(gemini.__test_buildToolsPayload(false, { niveau: "maitre", audience: "souverain", tourDeConversation: true }, "gemini")).includes("executer_code"),
        "Gemini ne porte pas « executer_code » au niveau Maître : la capacité serait inatteignable");

    // ── LA FAMILLE EST SÉPARÉE D'« AGENTS » ──────────────────────────────
    //
    // Les ranger ensemble aurait voulu dire qu'ouvrir la préparation de
    // publications ouvre aussi l'exécution de code.
    verifier(!NIVEAUX.FAMILLES.agents.includes("executer_code"),
        "« executer_code » est rangé dans la famille « agents » : accorder les publications " +
        "accorderait l'exécution de code du même geste");
    verifier(NIVEAUX.outilsDe("pro").includes("preparer_publication")
        && !NIVEAUX.outilsDe("pro").includes("executer_code"),
        "le niveau Pro obtient les deux capacités d'un bloc : elles doivent s'ouvrir séparément");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. LA FACTURATION EST À PART
// ══════════════════════════════════════════════════════════════════════════
{
    const CREDITS = require(path.join(RACINE, "config", "credits.js"));
    verifier(CREDITS.ACTES.executer_code || CREDITS.GRATUITS.executer_code,
        "« executer_code » n'a pas de prix décidé : la facturation improviserait");
    const ratee = CREDITS.factureDuTour([{ nom: "executer_code", reussi: false }]);
    const reussie = CREDITS.factureDuTour([{ nom: "executer_code", reussi: true }]);
    verifier(ratee.montant < reussie.montant,
        "un programme qui échoue est facturé comme un qui réussit");

    // Le bac ne connaît pas les prix, et la facturation ne connaît pas le bac.
    const srcBac = fs.readFileSync(path.join(RACINE, "services", "bacDExecution.js"), "utf8");
    verifier(!/credits|facture|prix/i.test(srcBac.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
        "le bac d'exécution parle de facturation : génération, exécution, permissions et prix " +
        "doivent rester quatre endroits distincts");
    verifier(!/autoriser|palier|niveau/i.test(srcBac.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
        "le bac d'exécution vérifie des permissions : elles seraient contournables dès qu'un " +
        "deuxième appelant apparaîtrait");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE BAC LUI-MÊME — exécution réelle, drapeau posé
// ══════════════════════════════════════════════════════════════════════════
(async () => {
    process.env[DRAPEAU] = VALEUR;
    BACS.oublierLesSondes();

    const dispo = BACS.choisir();
    const peutExecuter = dispo.bac !== null;
    verifier(peutExecuter,
        "même avec le drapeau posé, aucun bac ne démarre : les mesures de l'environnement sont fausses");

    if (peutExecuter) {
        // ── CODE SIMPLE ──────────────────────────────────────────────────
        {
            const r = await bac.executer({ code: 'console.log("resultat:", 6*7); console.error("un avertissement");' });
            verifier(r.ok && /resultat: 42/.test(r.stdout),
                `un programme simple n'aboutit pas : ${JSON.stringify(r).slice(0, 200)}`);
            verifier(/avertissement/.test(r.stderr),
                `stderr n'est pas récupéré : ${JSON.stringify(r.stderr)}`);
            verifier(r.degrade === true,
                "l'exécution ne se déclare pas dégradée alors que l'isolement des fichiers manque : " +
                "on croirait la machine protégée");
        }

        // ── CODE AVEC ERREUR ─────────────────────────────────────────────
        {
            const r = await bac.executer({ code: "throw new Error('ça casse ici');" });
            verifier(!r.ok && !r.refuse,
                "un programme qui lève est rendu comme réussi");
            verifier(/ça casse ici/.test(r.stderr),
                `le message d'erreur n'est pas récupéré : ${JSON.stringify(r.stderr).slice(0, 150)}`);
            verifier(r.code !== 0,
                `le code de sortie d'un programme en erreur vaut ${r.code}`);
        }

        // ── TEMPS DÉPASSÉ ────────────────────────────────────────────────
        //
        // Une boucle infinie. Sans limite, elle bloque un cœur du serveur
        // jusqu'au redémarrage — et c'est le genre de programme qu'un modèle
        // écrit sans le vouloir.
        {
            const debut = Date.now();
            const r = await bac.executer({ code: "while(true){}", limites: { tempsMs: 4000, cpuSecondes: 2 } });
            const duree = Date.now() - debut;
            verifier(!r.ok && r.tue,
                `une boucle infinie n'est pas arrêtée : ${JSON.stringify(r).slice(0, 200)}`);
            verifier(duree < 8000,
                `la boucle a tourné ${duree} ms : la limite ne tient pas`);
            verifier(/dépass/i.test(String(r.raison)),
                `l'arrêt n'est pas expliqué (« ${r.raison} ») : on chercherait un bug là où il ` +
                "n'y a qu'une limite atteinte");
        }

        // ── UN PROGRAMME QUI DORT ────────────────────────────────────────
        //
        // ⚠️ AJOUTÉ APRÈS UNE MUTATION SURVÉCUE. Retirer l'horloge murale ne
        // faisait rien crier : la boucle infinie du test précédent est coupée
        // par `ulimit -t`, qui compte le temps de CALCUL. Toute la limite
        // d'horloge était donc écrite et jamais mesurée.
        //
        // Or un programme qui DORT ne consomme aucun CPU. `ulimit -t` ne le
        // verra jamais. Sans l'horloge murale, un `setTimeout` de dix minutes
        // — que n'importe quel modèle écrit sans y penser en attendant une
        // réponse — tiendrait un processus dix minutes sur notre machine.
        {
            const debut = Date.now();
            const r = await bac.executer({
                code: 'setTimeout(()=>console.log("jamais"), 120000);',
                limites: { tempsMs: 2500, cpuSecondes: 30 },
            });
            const duree = Date.now() - debut;
            verifier(r.tue && !r.ok,
                `un programme qui dort n'est pas arrêté : ${JSON.stringify(r).slice(0, 180)} — ` +
                "il ne consomme aucun CPU, donc la limite de calcul ne le verra jamais");
            verifier(duree < 9000,
                `le programme endormi a tenu ${duree} ms malgré une limite à 2500 ms`);
            verifier(/temps dépassé/i.test(String(r.raison)),
                `l'arrêt n'est pas attribué à l'horloge (« ${r.raison} »)`);

            // ── L'ARRÊT DOIT TUER LE GROUPE, PAS L'ENVELOPPE ─────────────
            //
            // ⚠️ CETTE GARDE EXISTE PARCE QUE LA MUTATION CORRESPONDANTE NE
            // FAISAIT PAS ÉCHOUER LA SUITE : ELLE LA BLOQUAIT POUR TOUJOURS.
            //
            // `unshare --fork` fait du programme le PID 1 d'un nouvel espace
            // de noms. Tuer l'enveloppe que Node connaît laisse le programme
            // vivant, ses tuyaux de sortie ouverts, et la promesse n'est
            // JAMAIS résolue. Mesuré en cassant la garde : 20 dossiers de bac
            // et 2 processus orphelins laissés derrière, et le test qui ne
            // rend aucun verdict.
            //
            // En service, ce serait pire qu'un test bloqué : une requête HTTP
            // qui ne répond jamais, un dossier de plus à chaque tentative, et
            // un serveur qui s'éteint doucement sans une ligne d'erreur.
            //
            // On mesure donc la seule chose observable de l'extérieur : après
            // un arrêt, PLUS RIEN ne tourne et PLUS RIEN ne traîne.
            const { execSync } = require("child_process");
            const restants = Number(execSync("pgrep -c unshare 2>/dev/null || echo 0").toString().trim().split("\n")[0]);
            verifier(restants === 0,
                `${restants} processus d'exécution survivent à l'arrêt : l'enveloppe a été tuée, ` +
                "pas le groupe — le programme continue de tourner sur la machine, et en service " +
                "la requête HTTP ne répondrait jamais");
            const bacsRestants = Number(execSync("ls -d /tmp/samii-bac-* 2>/dev/null | wc -l").toString().trim());
            verifier(bacsRestants === 0,
                `${bacsRestants} dossier(s) de bac laissés après un arrêt : un par tentative, ` +
                "c'est un disque plein en quelques jours");
        }

        // ── LA MÊME LIMITE, DEUX FOIS DE SUITE ───────────────────────────
        //
        // ⚠️ AJOUTÉ APRÈS UN DÉFAUT LATENT DANS MON PROPRE CODE.
        //
        // L'expression qui reconnaît la plainte de `unshare` était globale, et
        // servait à la fois à `.test()` et à `.replace()`. Une expression
        // globale garde un curseur entre les appels : mesuré, `test()` rend
        // vrai, puis FAUX, puis vrai, sur la même chaîne.
        //
        // L'objet vivant au niveau du module, UNE EXÉCUTION SUR DEUX n'aurait
        // pas été attribuée à la limite de calcul — et la boucle aurait payé
        // un appel d'IA pour corriger un programme sans faute, une fois sur
        // deux. Aucun test à un seul appel ne pouvait le voir.
        {
            const a = await bac.executer({ code: "while(true){}", limites: { tempsMs: 4000, cpuSecondes: 2 } });
            const b = await bac.executer({ code: "while(true){}", limites: { tempsMs: 4000, cpuSecondes: 2 } });
            verifier(a.tue && b.tue,
                `deux boucles infinies de suite : la première est attribuée (${a.tue}), la seconde ` +
                `(${b.tue}) — un état qui traîne entre deux exécutions, donc une sur deux mal lue`);
            verifier(String(a.raison) === String(b.raison),
                `la même limite est expliquée de deux façons : « ${a.raison} » puis « ${b.raison} »`);
            verifier(!/unshare/.test(String(a.stderr) + String(b.stderr)),
                `la plomberie du bac reste dans stderr : « ${a.stderr || b.stderr} » — le modèle ` +
                "essaierait de corriger une erreur qui n'est pas dans le code");
        }

        // ── MÉMOIRE DÉPASSÉE ─────────────────────────────────────────────
        {
            const r = await bac.executer({
                code: "const a=[];while(true){a.push(new Array(1e6).fill(7));}",
                limites: { memoireMo: 32, tempsMs: 15000, cpuSecondes: 10 },
            });
            verifier(!r.ok,
                "une allocation sans fin est rendue comme réussie : elle ferait tomber le serveur");
            verifier(r.tue && /mémoire|calcul|dépass/i.test(String(r.raison)),
                `l'arrêt pour mémoire n'est pas nommé (« ${r.raison} »)`);
        }

        // ── L'ENVIRONNEMENT EST VIDÉ ─────────────────────────────────────
        //
        // LA FUITE LA PLUS FACILE À OUBLIER. Le processus de SAMII porte les
        // clés Gemini, l'URL de la base, le secret de session. Les passer au
        // code exécuté rendrait tous les autres murs inutiles : plus besoin
        // de sortir du bac, il suffirait de lire son environnement.
        {
            process.env.SECRET_DE_TEST_CHANTIER_10 = "ceci-ne-doit-jamais-sortir";
            const r = await bac.executer({ code: 'console.log(JSON.stringify(process.env));' });
            verifier(!/ceci-ne-doit-jamais-sortir/.test(r.stdout),
                "FUITE : le code exécuté voit l'environnement de SAMII — donc les clés d'API, " +
                "l'URL de la base et le secret de session");
            verifier(!/DATABASE_URL|GEMINI|SESSION_SECRET/.test(r.stdout),
                `des variables sensibles sont visibles dans le bac : ${r.stdout.slice(0, 200)}`);
            delete process.env.SECRET_DE_TEST_CHANTIER_10;
        }

        // ── LE DOSSIER EST DÉTRUIT APRÈS USAGE ───────────────────────────
        {
            const r = await bac.executer({ code: 'console.log(process.cwd());' });
            const dossier = String(r.stdout || "").trim().split("\n")[0];
            verifier(/samii-bac-/.test(dossier),
                `le bac ne tourne pas dans un dossier jetable : « ${dossier} »`);
            verifier(!fs.existsSync(dossier),
                `LE BAC N'EST PAS DÉTRUIT : ${dossier} existe encore — un dossier par exécution, ` +
                "c'est un disque plein en quelques jours, et un disque plein est une panne totale");
        }

        // Et même quand le programme plante.
        {
            const r1 = await bac.executer({ code: 'console.log(process.cwd()); throw new Error("boum");' });
            const dossier = String(r1.stdout || "").trim().split("\n")[0];
            verifier(dossier && !fs.existsSync(dossier),
                "le bac d'un programme qui plante n'est pas détruit : ce sont justement ceux-là " +
                "qu'on relance le plus");
        }

        // ── UN FICHIER AU NOM INTERDIT ───────────────────────────────────
        for (const nom of ["../evasion.txt", "/etc/passwd", ".npmrc", "sous/dossier.txt", ".env"]) {
            const r = await bac.executer({ code: "console.log(1)", fichiers: { [nom]: "x" } });
            verifier(r.refuse && /nom de fichier refusé/i.test(String(r.raison)),
                `le nom de fichier « ${nom} » est accepté : un modèle peut l'écrire sans mauvaise ` +
                "intention, simplement parce que c'était dans son contexte");
        }
        // Et un nom normal passe.
        {
            const r = await bac.executer({
                code: 'console.log(require("fs").readFileSync("donnees.txt","utf8").trim());',
                fichiers: { "donnees.txt": "bonjour du fichier" },
            });
            verifier(r.ok && /bonjour du fichier/.test(r.stdout),
                `un fichier au nom normal n'est pas fourni au programme : ${JSON.stringify(r).slice(0, 180)}`);
        }

        // ── LES LIMITES NE SE DESSERRENT PAS DEPUIS L'APPELANT ───────────
        //
        // Un modèle qui écrit « tempsMs: 600000 » dans ses arguments
        // obtiendrait dix minutes de calcul sur notre machine.
        {
            const l = BACS.limites({ tempsMs: 600000, memoireMo: 8192, cpuSecondes: 3600 });
            verifier(l.tempsMs <= BACS.LIMITES.tempsMs && l.memoireMo <= BACS.LIMITES.memoireMo
                && l.cpuSecondes <= BACS.LIMITES.cpuSecondes,
            `les limites se desserrent depuis l'appelant : ${JSON.stringify(l)}`);
            // Mais elles se resserrent.
            verifier(BACS.limites({ tempsMs: 500 }).tempsMs === 500,
                "on ne peut pas demander des limites PLUS serrées que le défaut");
        }

        // ── LANGAGE INCONNU ──────────────────────────────────────────────
        {
            const r = await bac.executer({ langage: "brainfuck", code: "+++" });
            verifier(r.refuse && /langage/i.test(String(r.raison)),
                "un langage non déclaré est quand même exécuté");
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7. LA BOUCLE : exécuter → lire l'erreur → corriger → réexécuter
    // ══════════════════════════════════════════════════════════════════════
    //
    // C'est ce qui sépare « SAMII écrit du code » de « SAMII résout un
    // problème ». La correction demande un appel d'IA : aucune clé ici, donc
    // on double `socle.demander` — le reste (exécution, détection, reprise,
    // arrêt) est le vrai code.
    if (peutExecuter) {
        const socle = require(path.join(RACINE, "engines", "social", "agents", "base.js"));
        const boucle = require(path.join(RACINE, "services", "boucleDeCode.js"));
        const vraiDemander = socle.demander;
        let corrections = 0;
        let reponseCorrection = 'console.log("corrigé:", 21*2);';
        socle.demander = async () => { corrections++; return reponseCorrection; };

        // ── ELLE CORRIGE, PUIS ELLE ABOUTIT ──────────────────────────────
        {
            corrections = 0;
            const r = await boucle.resoudre({ code: "throw new Error('faute de frappe');", but: "calculer 42" }, {});
            verifier(r.execute === true, `la boucle n'aboutit pas après correction : ${JSON.stringify(r).slice(0, 200)}`);
            verifier(r.corrections === 1, `${r.corrections} correction(s) au lieu d'une`);
            verifier(corrections === 1, `${corrections} appel(s) d'IA pour une seule correction`);
            verifier(/corrigé: 42/.test(r.sortie), `la sortie du programme corrigé est « ${r.sortie} »`);
            verifier(/échoué|reprendre/i.test(String(r.consigne)),
                "SAMII n'est pas prévenu qu'il a fallu corriger : il dirait « voilà le résultat » " +
                "comme si ça avait marché du premier coup");
        }

        // ── ELLE NE BOUCLE PAS SANS FIN ──────────────────────────────────
        //
        // Chaque tour coûte un appel d'IA plus une exécution. Sur un bug que
        // le modèle ne sait pas voir, une boucle sans borne fait monter la
        // facture sans jamais aboutir.
        {
            corrections = 0;
            reponseCorrection = "throw new Error('toujours cassé');";
            const r = await boucle.resoudre({ code: "throw new Error('cassé');", but: "x" }, {});
            verifier(r.execute === false, "un programme jamais réparé est rendu comme réussi");
            verifier(corrections <= boucle.MAX_CORRECTIONS,
                `${corrections} appels d'IA pour une boucle bornée à ${boucle.MAX_CORRECTIONS}`);
            verifier(/n'a pas abouti|prétendre/i.test(String(r.consigne)),
                "SAMII n'est pas prévenu que rien n'a abouti : il inventerait un résultat");
        }

        // ── ON NE CORRIGE PAS UN PROGRAMME QU'ON A TUÉ ───────────────────
        //
        // Un programme arrêté par une limite n'a pas d'erreur à lire : il
        // tournait, simplement trop. Demander une correction ferait deviner
        // le modèle, et deviner coûte un appel pour rien.
        {
            corrections = 0;
            const r = await boucle.resoudre({ code: "while(true){}", limites: { tempsMs: 3000, cpuSecondes: 2 } }, {});
            verifier(r.execute === false, "une boucle infinie est rendue comme un succès");
            verifier(corrections === 0,
                `${corrections} appel(s) d'IA pour corriger un programme tué par une limite : ` +
                "il n'y a pas d'erreur à lire, seulement un programme trop long");
            verifier(/limite|dépass/i.test(String(r.raison) + String(r.consigne)),
                `l'arrêt n'est pas expliqué à SAMII (« ${r.raison} »)`);
        }

        // ── UNE CORRECTION IDENTIQUE ARRÊTE LA BOUCLE ────────────────────
        {
            corrections = 0;
            reponseCorrection = "throw new Error('cassé');";   // le même programme
            const r = await boucle.resoudre({ code: "throw new Error('cassé');", but: "x" }, {});
            verifier(corrections === 1,
                `${corrections} appels d'IA alors que la première correction n'a rien changé : ` +
                "on paierait deux exécutions identiques");
            verifier(r.execute === false, "un programme inchangé est rendu comme réparé");
        }

        socle.demander = vraiDemander;
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8. LA MISSION ENTIÈRE, PAR LE PONT DU PLANNER
    // ══════════════════════════════════════════════════════════════════════
    {
        const planner = require(path.join(RACINE, "brain", "planner.js"));

        // ── LE REFUS EST EXPLIQUÉ, PAS DÉGUISÉ EN BUG ────────────────────
        delete process.env[DRAPEAU];
        BACS.oublierLesSondes();
        const refuse = await planner.executeFunction("executer_code", { code: "console.log(1)" }, MAITRE);
        verifier(refuse.success === false, "l'exécution aboutit alors qu'aucun bac n'est sûr");
        verifier(/pas exécuter de code|pas disponible/i.test(String(refuse.error)),
            `le refus ne dit pas que c'est NOTRE machine qui n'est pas prête (« ${refuse.error} ») : ` +
            "le marchand croirait son programme fautif");

        // ── UN NIVEAU INSUFFISANT EST REFUSÉ AVANT LE BAC ────────────────
        process.env[DRAPEAU] = VALEUR;
        BACS.oublierLesSondes();
        const brime = await planner.executeFunction("executer_code", { code: "console.log(1)" },
            { ...MAITRE, niveau: "pro" });
        verifier(brime.success === false,
            "un tour Pro exécute du code : le plafond de niveau ne servirait à rien");

        // ── ET AU NIVEAU MAÎTRE, ÇA MARCHE ───────────────────────────────
        if (peutExecuter) {
            const ok = await planner.executeFunction("executer_code",
                { code: 'console.log("total:", 19+23);', but: "additionner" }, MAITRE);
            verifier(ok.success === true,
                `le pont du planner n'aboutit pas : ${JSON.stringify(ok).slice(0, 200)}`);
            verifier(/total: 42/.test(String(ok.sortie)),
                `la sortie ne remonte pas au modèle : ${JSON.stringify(ok.sortie)}`);

            // ── AUCUN RENSEIGNEMENT SUR NOTRE MACHINE NE REMONTE ─────────
            const texte = JSON.stringify(ok);
            verifier(!/\/tmp\/|samii-bac-|unshare|ulimit/.test(texte),
                `le chemin du bac ou la commande d'isolement remontent au modèle : ${texte.slice(0, 200)} — ` +
                "ce sont des renseignements sur notre infrastructure, pas sur le problème du marchand");
            for (const id of Object.keys(REGISTRE.AGENTS)) {
                verifier(!texte.includes(id),
                    `le nom du spécialiste « ${id} » remonte au modèle : il n'y a qu'un seul SAMII`);
            }

            // ── DOUBLE EXÉCUTION ─────────────────────────────────────────
            const entree = { code: 'const t=Date.now();while(Date.now()-t<120){};console.log("un");', but: "x" };
            const [a, b] = await Promise.all([
                agents.executer({ missionId: "executer_code", entree, context: MAITRE }),
                agents.executer({ missionId: "executer_code", entree, context: MAITRE }),
            ]);
            verifier((a.ok && !b.ok) || (b.ok && !a.ok),
                "deux exécutions identiques lancées en même temps aboutissent toutes les deux : " +
                "un double clic ferait tourner deux fois le même calcul sur notre machine");
        }

        // Le pont existe vraiment.
        const src = fs.readFileSync(path.join(RACINE, "brain", "planner.js"), "utf8");
        verifier(/case "executer_code"/.test(src),
            "le planner n'a plus de case pour « executer_code » : l'outil serait déclaré au modèle, " +
            "le modèle l'appellerait, et SAMII répondrait « Fonction inconnue »");
    }

    delete process.env[DRAPEAU];
    BACS.oublierLesSondes();

    // ── VERDICT ──────────────────────────────────────────────────────────
    if (echecs.length) {
        console.log(`\n❌ exécution de code : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ exécution de code : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ exécution de code : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
