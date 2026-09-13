// ==========================================================================
// SAMII OS — UNE MISSION QUI SURVIT À LA REQUÊTE ET AU REDÉMARRAGE
// ==========================================================================
//
// POURQUOI CETTE SUITE EXIGE UNE VRAIE BASE.
//
// Tout ce qu'on veut prouver ici — le verrou, la reprise, la double
// exécution, l'abandon d'un processus — se joue dans des requêtes SQL
// concurrentes. Une base simulée dirait oui à tout, y compris à deux
// processus qui prennent la même mission en même temps. Ce serait une suite
// verte qui ne protège rien.
//
// Elle se saute donc d'elle-même sans PGTEST_URL, comme portefeuille.test.js
// et pour la même raison.
//
// ── CE QU'ON MESURE ──────────────────────────────────────────────────────
//
// Pas « le fichier existe ». Le comportement sous pannes :
//
//   • deux battements simultanés ne prennent pas la même mission
//   • un processus tué au milieu ne bloque pas la mission pour toujours
//   • une reprise ne refait pas les étapes déjà faites
//   • une mission annulée s'arrête à l'étape suivante, pas à la fin
//   • une mission qui tourne sans rien produire ne coûte rien
//   • une étape qui échoue trois fois arrête la mission au lieu de boucler
//
// ── CE QUI EST SIMULÉ ────────────────────────────────────────────────────
//
// Les agents. Aucune clé d'IA ici, donc leurs `executer` sont remplacés par
// des fonctions dont on choisit le comportement. TOUT LE RESTE est le vrai
// code : le SQL, le verrou, le curseur d'étape, la vérification, les
// permissions.
//
// Lancer :  PGTEST_URL=postgres://…/…test npm test
// ==========================================================================

const path = require("path");
const RACINE = path.join(__dirname, "..");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite missions longues ignorée (normal hors développement).");
    process.exit(0);
}
if (!/localhost|127\.0\.0\.1/.test(URL) || !/test/.test(URL)) {
    console.log("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const db = require(path.join(RACINE, "services", "db.js"));
const REGISTRE = require(path.join(RACINE, "config", "agents.js"));
const longues = require(path.join(RACINE, "services", "missionsLongues.js"));

const PRO = { niveau: "pro", palier: "pro", mode: "autonome", audience: "souverain",
    workspaceId: "ws-essai", identite: { userId: "u-essai" } };

// ── LA CHAÎNE D'ESSAI ────────────────────────────────────────────────────
//
// Trois maillons dont on pilote le comportement. On n'utilise PAS la vraie
// chaîne « stratégie » : elle appelle le modèle, et on veut choisir quand ça
// réussit, quand ça échoue, et combien de temps ça prend.
const journal = [];
let comportement = "ok";

function poserLaChaine() {
    REGISTRE.AGENTS.__e1__ = {
        id: "__e1__", libelle: "Un", famille: "essai", interne: true, effet: "lecture", outils: [],
        executer: async (entree) => {
            journal.push("__e1__");
            if (comportement === "casse1") throw new Error("le premier maillon a cassé");
            if (comportement === "lent") await new Promise((r) => setTimeout(r, 300));
            return { analyse: "ce qui bloque", vuEntree: Object.keys(entree) };
        },
    };
    REGISTRE.AGENTS.__e2__ = {
        id: "__e2__", libelle: "Deux", famille: "essai", interne: true, effet: "prepare", outils: [],
        executer: async (entree) => {
            journal.push("__e2__");
            if (comportement === "casse2") throw new Error("le deuxième maillon a cassé");
            if (comportement === "vide") return { plan: "" };
            return { plan: "le plan", reçuDuPrecedent: Boolean(entree.analyse),
                actes: [{ nom: "preparer_strategie", reussi: true }] };
        },
    };
    REGISTRE.AGENTS.__e3__ = {
        id: "__e3__", libelle: "Trois", famille: "essai", interne: true, effet: "lecture", outils: [],
        executer: async () => { journal.push("__e3__"); return { controle: "RIEN À SIGNALER" }; },
    };
    REGISTRE.MISSIONS.__longue__ = {
        id: "__longue__", libelle: "Essai long", domaines: [],
        agents: ["__e1__", "__e2__", "__e3__"], effet: "prepare",
        niveauMin: "pro", outil: null, long: true,
        attendu: {
            champs: ["analyse", "plan"],
            verifier: (r) => (String(r.plan || "").trim() ? [] : ["aucun plan n'a été produit"]),
        },
    };
}

function retirerLaChaine() {
    delete REGISTRE.AGENTS.__e1__; delete REGISTRE.AGENTS.__e2__; delete REGISTRE.AGENTS.__e3__;
    delete REGISTRE.MISSIONS.__longue__;
}

// Fait tourner le battement jusqu'à ce que la mission ne soit plus vivante.
// Borné : une mission qui n'avance pas ne doit pas faire tourner le test
// pour toujours — ce serait exactement le défaut qu'on cherche à interdire.
async function jusquALaFin(id, maxBattements = 12) {
    for (let i = 0; i < maxBattements; i++) {
        const l = await longues.lire(id);
        if (!l || !longues.VIVANTS.includes(l.etat)) return l;
        // Les étapes posent une échéance dans le futur ; on l'avance pour ne
        // pas attendre réellement. C'est le SEUL raccourci de cette suite, et
        // il ne touche pas à la logique — seulement à l'horloge.
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [id]);
        await longues.battement({ limite: 5 });
    }
    return longues.lire(id);
}

(async () => {
    // Le schéma, par le vrai chemin du projet.
    await require(path.join(RACINE, "services", "schema.js")).preparer();
    await db.query(`DELETE FROM missions_longues WHERE user_id = 'u-essai'`);
    poserLaChaine();

    // ══════════════════════════════════════════════════════════════════════
    // 1. LE CHEMIN NOMINAL — une étape par battement, pas trois d'un coup
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "ça baisse" }, context: PRO });
        verifier(c.ok, `la création échoue : ${c.erreur}`);
        verifier(c.mission.etat === "attente" && c.mission.etape === 0,
            `une mission naît dans l'état « ${c.mission?.etat} » à l'étape ${c.mission?.etape}`);
        verifier(c.mission.etapes_total === 3,
            `${c.mission.etapes_total} étapes annoncées au lieu de 3`);

        // ── UN SEUL MAILLON PAR BATTEMENT ────────────────────────────────
        //
        // C'est TOUTE la différence avec une réponse lente. Si un battement
        // déroulait la chaîne entière, on aurait rebâti exactement ce qu'on
        // corrige : un travail qui tient dans un seul souffle.
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });
        verifier(journal.length === 1,
            `${journal.length} maillon(s) exécuté(s) au premier battement : la chaîne entière ` +
            "tourne d'un coup, donc rien n'a changé par rapport à une requête longue");

        const apres1 = await longues.lire(c.mission.id);
        verifier(apres1.etape === 1 && apres1.etat === "en_cours",
            `après un battement : étape ${apres1.etape}, état « ${apres1.etat} »`);
        verifier(apres1.verrou_jusqu === null,
            "le verrou n'est pas rendu après l'étape : la mission serait bloquée jusqu'à " +
            "l'expiration du bail, donc deux minutes perdues à chaque étape");

        const fin = await jusquALaFin(c.mission.id);
        verifier(fin.etat === "terminee", `la mission finit en « ${fin.etat} » : ${fin.erreur}`);
        verifier(journal.join(",") === "__e1__,__e2__,__e3__",
            `l'ordre des maillons est « ${journal.join(" → ")} »`);
        verifier(fin.resultat?.plan === "le plan",
            `le résultat ne porte pas ce qui a été produit : ${JSON.stringify(fin.resultat).slice(0, 140)}`);
        verifier(fin.fin_le !== null, "une mission terminée n'a pas de date de fin");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. LE PASSAGE DE RELAIS, SANS FUITE DE CONTEXTE
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        const fin = await jusquALaFin(c.mission.id);
        verifier(fin.passe?.reçuDuPrecedent === true,
            "le deuxième maillon n'a pas reçu ce que le premier a produit : chaque étape " +
            "repartirait de zéro, et les trois appels de modèle seraient perdus");

        const vu = fin.passe?.vuEntree || [];
        verifier(!vu.includes("palier") && !vu.includes("niveau") && !vu.includes("identite"),
            `FUITE : un maillon reçoit le contexte d'appel (${vu.join(", ")}) — il hériterait des ` +
            "droits de son voisin, et le battement tourne hors de toute requête");
        verifier(vu.includes("situation"),
            `le premier maillon n'a pas reçu l'entrée de la mission (${vu.join(", ")})`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3. DEUX BATTEMENTS SIMULTANÉS NE PRENNENT PAS LA MÊME MISSION
    // ══════════════════════════════════════════════════════════════════════
    //
    // LE DÉFAUT CLASSIQUE DES FILES ÉCRITES À LA MAIN : lire les missions
    // dues, puis les verrouiller. Entre les deux, une fenêtre — deux
    // processus lisent la même ligne, tous deux la croient libre, et la
    // mission s'exécute deux fois. Ça ne se voit qu'en production, sous
    // charge, et ça double la facture d'IA.
    {
        comportement = "lent"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);

        const [a, b] = await Promise.all([longues.battement({ limite: 5 }), longues.battement({ limite: 5 })]);
        const total = a.length + b.length;
        verifier(total === 1,
            `${total} battements ont pris la même mission : elle s'exécuterait deux fois, et ` +
            "chaque maillon coûte un appel d'IA");
        verifier(journal.length === 1,
            `${journal.length} exécutions du premier maillon pour un seul battement dû`);
        comportement = "ok";
    }

    // ══════════════════════════════════════════════════════════════════════
    // 4. LE REDÉMARRAGE — reprendre sans refaire
    // ══════════════════════════════════════════════════════════════════════
    //
    // On simule la seule chose qui compte : le processus meurt AU MILIEU,
    // laissant la mission verrouillée. Un nouveau processus doit la reprendre
    // — mais à la bonne étape, sans rejouer ce qui est fait.
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });   // étape 1 faite

        // Le processus meurt : le verrou reste posé, et il ne sera jamais rendu.
        await db.query(
            `UPDATE missions_longues SET verrou_jusqu = NOW() + interval '2 minutes', verrou_par = 'processus-mort'
              WHERE id = $1`, [c.mission.id]);

        // Un autre battement passe : il ne doit RIEN prendre, le bail court.
        journal.length = 0;
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });
        verifier(journal.length === 0,
            "une mission verrouillée par un autre processus est reprise quand même : deux " +
            "processus travailleraient dessus en même temps");

        // Le bail expire (le temps passe). La mission redevient prenable.
        await db.query(`UPDATE missions_longues SET verrou_jusqu = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        const fin = await jusquALaFin(c.mission.id);

        verifier(fin.etat === "terminee", `après reprise, la mission finit en « ${fin.etat} » : ${fin.erreur}`);
        verifier(!journal.includes("__e1__"),
            `le premier maillon a été REJOUÉ après la reprise (${journal.join(" → ")}) : on paierait ` +
            "deux fois le même appel d'IA, et le curseur d'étape ne servirait à rien");
        verifier(journal.join(",") === "__e2__,__e3__",
            `la reprise a exécuté « ${journal.join(" → ")} » au lieu de reprendre à la 2e étape`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 5. L'ABANDON RÉPÉTÉ NE TOURNE PAS EN ROND
    // ══════════════════════════════════════════════════════════════════════
    //
    // Si le processus meurt À CHAQUE FOIS sur la même mission, la reprendre
    // indéfiniment relance la panne indéfiniment. Trois abandons et la
    // mission échoue.
    {
        comportement = "ok";
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        for (let i = 0; i < longues.ESSAIS_MAX; i++) {
            await db.query(
                `UPDATE missions_longues SET etat='en_cours', verrou_jusqu = NOW() - interval '1 second'
                  WHERE id = $1`, [c.mission.id]);
            await longues.reprendreLesAbandonnees();
        }
        const l = await longues.lire(c.mission.id);
        verifier(l.etat === "echouee",
            `après ${longues.ESSAIS_MAX} abandons, la mission est en « ${l.etat} » : elle ` +
            "relancerait la panne une fois par battement, pour toujours");
        verifier(/abandonn/i.test(String(l.erreur)),
            `le motif ne dit pas que le processus meurt dessus : « ${l.erreur} »`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 6. L'ANNULATION S'APPLIQUE À L'ÉTAPE SUIVANTE, PAS À LA FIN
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });   // étape 1 faite

        const arretee = await longues.annuler(c.mission.id, { userId: "u-essai" });
        verifier(arretee?.etat === "annulee", `l'annulation rend ${JSON.stringify(arretee)}`);

        journal.length = 0;
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });
        verifier(journal.length === 0,
            `${journal.length} maillon(s) exécuté(s) APRÈS l'annulation : on continuerait de ` +
            "payer des appels d'IA pour un travail que la personne a arrêté");

        // ── ANNULÉE APRÈS AVOIR ÉTÉ PRISE, AVANT D'AVOIR TOURNÉ ──────────
        //
        // ⚠️ AJOUTÉ APRÈS UNE MUTATION SURVÉCUE. Retirer la relecture de
        // l'état au début de chaque étape ne faisait rien crier : `prendre()`
        // filtre déjà sur les états vivants, donc une mission annulée n'est
        // jamais ramassée au battement suivant.
        //
        // Mais il y a une fenêtre, et elle est réelle : le battement prend
        // TROIS missions d'un coup, puis les traite une par une. Une mission
        // annulée pendant qu'on traite la première du lot a déjà été prise —
        // et sans cette relecture, son étape partirait quand même.
        //
        // Un appel de modèle payé pour un travail que la personne venait
        // d'arrêter, et son état passerait de « annulée » à « en cours ».
        {
            journal.length = 0;
            const tardive = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
            const prises = await longues.prendre(5);
            verifier(prises.some((x) => String(x.id) === String(tardive.mission.id)),
                "la mission n'a pas été prise : le cas ne mesure rien");
            // Elle est annulée APRÈS avoir été prise.
            await db.query(`UPDATE missions_longues SET etat = 'annulee' WHERE id = $1`, [tardive.mission.id]);
            const ligne = prises.find((x) => String(x.id) === String(tardive.mission.id));
            await longues.avancerDUneEtape(ligne);
            verifier(journal.length === 0,
                `un maillon a tourné sur une mission annulée entre la prise et l'exécution : ` +
                "le battement prend plusieurs missions d'un coup, donc la fenêtre est réelle — " +
                "on paierait un appel de modèle pour un travail arrêté");
            verifier((await longues.lire(tardive.mission.id)).etat === "annulee",
                "une mission annulée est repassée en cours par l'étape qui la suivait");
        }

        // ── UN AUTRE N'ANNULE PAS MA MISSION ─────────────────────────────
        const c2 = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        verifier(await longues.annuler(c2.mission.id, { userId: "quelquun-dautre" }) === null,
            "n'importe qui peut annuler la mission d'un autre");
        verifier((await longues.lire(c2.mission.id)).etat === "attente",
            "la mission a bougé alors que l'annulation venait de quelqu'un d'autre");

        // Une mission terminée ne s'annule pas : elle est faite.
        await db.query(`UPDATE missions_longues SET etat='terminee' WHERE id=$1`, [c2.mission.id]);
        verifier(await longues.annuler(c2.mission.id, { userId: "u-essai" }) === null,
            "on « annule » une mission déjà terminée : ça ferait croire qu'on a défait quelque chose");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7. LE DÉLAI MAXIMUM
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(
            `UPDATE missions_longues SET expire_le = NOW() - interval '1 minute',
                    prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });
        const l = await longues.lire(c.mission.id);
        verifier(l.etat === "echouee" && /délai/i.test(String(l.erreur)),
            `une mission expirée continue (état « ${l.etat} », motif « ${l.erreur} ») : elle ` +
            "consommerait à chaque battement sans jamais aboutir");
        verifier(journal.length === 0,
            "un maillon a tourné alors que le délai était dépassé");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8. UNE ÉTAPE QUI ÉCHOUE — on retente, puis on s'arrête
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "casse2"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        const fin = await jusquALaFin(c.mission.id, 20);
        verifier(fin.etat === "echouee", `une étape qui casse toujours finit en « ${fin.etat} »`);
        verifier(fin.essais <= longues.ESSAIS_MAX,
            `${fin.essais} essais pour un maximum de ${longues.ESSAIS_MAX} : la mission boucle`);
        verifier(/__e2__/.test(String(fin.erreur)),
            `le motif ne nomme pas l'étape fautive : « ${fin.erreur} »`);

        // ── ET ELLE N'EST PAS FACTURÉE ───────────────────────────────────
        verifier(fin.facturee === false,
            "une mission échouée est marquée facturée : on ferait payer un travail jamais rendu");
        comportement = "ok";
    }

    // ══════════════════════════════════════════════════════════════════════
    // 9. « TOUTES LES ÉTAPES SONT PASSÉES » N'EST PAS « ÇA A MARCHÉ »
    // ══════════════════════════════════════════════════════════════════════
    //
    // Le défaut du chantier 8, qu'on ne refait pas : une mission qui rend du
    // vide serait annoncée comme réussie.
    {
        comportement = "vide"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        const fin = await jusquALaFin(c.mission.id, 20);
        verifier(fin.etat === "echouee",
            `les trois étapes sont passées mais le plan est vide, et la mission est en ` +
            `« ${fin.etat} » : SAMII annoncerait une stratégie qui n'existe pas`);
        verifier(/plan/i.test(String(fin.erreur)),
            `le motif ne dit pas ce qui manque : « ${fin.erreur} »`);
        comportement = "ok";
    }

    // ══════════════════════════════════════════════════════════════════════
    // 10. LA FACTURATION SUIT LES ACTES, PAS LE TEMPS
    // ══════════════════════════════════════════════════════════════════════
    {
        comportement = "ok";
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        const fin = await jusquALaFin(c.mission.id);
        verifier(Array.isArray(fin.cout_actes) && fin.cout_actes.length === 1,
            `${JSON.stringify(fin.cout_actes)} acte(s) relevé(s) : seuls les actes déclarés par ` +
            "les agents comptent, jamais la durée de la mission");
        verifier(fin.cout_actes[0]?.reussi === true,
            "un acte est compté sans être réussi");

        // Une mission échouée n'accumule aucun acte des étapes non atteintes.
        comportement = "casse1";
        const k = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        const ko = await jusquALaFin(k.mission.id, 20);
        verifier((ko.cout_actes || []).length === 0,
            `une mission cassée à la première étape a relevé ${JSON.stringify(ko.cout_actes)} acte(s) : ` +
            "on facturerait un travail qui n'a jamais eu lieu");
        comportement = "ok";
    }

    // ══════════════════════════════════════════════════════════════════════
    // 11. LES PERMISSIONS — au lancement, et GELÉES
    // ══════════════════════════════════════════════════════════════════════
    {
        const brime = await longues.creer({
            missionId: "__longue__", entree: { situation: "s" },
            context: { ...PRO, niveau: "expert" },
        });
        verifier(!brime.ok && brime.refuse,
            "un tour Expert lance une mission longue qui demande Pro : le plancher de niveau " +
            "ne servirait à rien, et le temps long serait la porte dérobée");

        const inconnue = await longues.creer({ missionId: "__jamais__", entree: {}, context: PRO });
        verifier(!inconnue.ok, "une mission inconnue est enregistrée quand même");

        // Une mission qui délègue n'a pas d'étapes à dérouler.
        const bloc = await longues.creer({ missionId: "publication_sociale", entree: {}, context: PRO });
        verifier(!bloc.ok && /bloc/i.test(String(bloc.erreur)),
            `une mission qui s'exécute d'un bloc est acceptée en mission longue : ${bloc.erreur}`);

        // ── LES DROITS SONT GELÉS DANS LA LIGNE ──────────────────────────
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        verifier(c.mission.niveau === "pro" && c.mission.palier === "pro",
            `les droits ne sont pas gelés au lancement (${c.mission.niveau}/${c.mission.palier}) : ` +
            "une mission s'arrêterait au milieu si l'abonnement change, ou gagnerait des droits");
        verifier(c.mission.user_id === "u-essai" && c.mission.workspace_id === "ws-essai",
            `le propriétaire n'est pas enregistré : ${c.mission.user_id}/${c.mission.workspace_id}`);
        await longues.annuler(c.mission.id, { userId: "u-essai" });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 12. LE COUPE-CIRCUIT ARRÊTE UNE MISSION EN COURS
    // ══════════════════════════════════════════════════════════════════════
    //
    // Pas seulement les prochaines. Couper un agent un dimanche soir doit
    // arrêter ce qui tourne, sinon le coupe-circuit ne protège de rien
    // pendant l'heure qui suit.
    {
        comportement = "ok"; journal.length = 0;
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });   // étape 1 faite

        const avant = process.env.SOCIAL_AGENTS_COUPES;
        process.env.SOCIAL_AGENTS_COUPES = "__e2__";
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        await longues.battement({ limite: 5 });
        const l = await longues.lire(c.mission.id);
        verifier(l.etat === "echouee" && /coupé/i.test(String(l.erreur)),
            `couper un maillon n'arrête pas la mission en cours (état « ${l.etat} », « ${l.erreur} ») : ` +
            "le coupe-circuit ne protégerait que les missions à venir");
        if (avant === undefined) delete process.env.SOCIAL_AGENTS_COUPES;
        else process.env.SOCIAL_AGENTS_COUPES = avant;
    }

    // ══════════════════════════════════════════════════════════════════════
    // 13. LE BATTEMENT EST BRANCHÉ, ET IL NE LÈVE JAMAIS
    // ══════════════════════════════════════════════════════════════════════
    {
        const fs = require("fs");
        const boot = fs.readFileSync(path.join(RACINE, "kernel", "bootstrap.js"), "utf8");
        verifier(/missionsLongues\.battement|missionsLongues"\)[\s\S]{0,400}battement/.test(boot),
            "le battement n'est branché sur aucun planificateur : les missions seraient créées " +
            "et n'avanceraient jamais — pire que de ne rien lancer");
        verifier(/reprendreLesAbandonnees/.test(boot),
            "rien ne reprend les missions abandonnées : un processus tué laisserait des missions " +
            "figées jusqu'à l'expiration du bail, puis en boucle");

        // Une mission qui explose ne doit pas arrêter les autres.
        comportement = "ok";
        const c = await longues.creer({ missionId: "__longue__", entree: { situation: "s" }, context: PRO });
        await db.query(`UPDATE missions_longues SET mission = 'mission_effacee_du_registre' WHERE id = $1`, [c.mission.id]);
        await db.query(`UPDATE missions_longues SET prochaine_le = NOW() - interval '1 second' WHERE id = $1`, [c.mission.id]);
        let aLeve = false;
        try { await longues.battement({ limite: 5 }); } catch { aLeve = true; }
        verifier(!aLeve,
            "le battement lève sur une mission cassée : un incident isolé arrêterait toutes " +
            "les missions de tout le monde");
        verifier((await longues.lire(c.mission.id)).etat === "echouee",
            "une mission dont le registre ne connaît plus le nom reste vivante pour toujours");
    }

    // ── MÉNAGE ───────────────────────────────────────────────────────────
    retirerLaChaine();
    await db.query(`DELETE FROM missions_longues WHERE user_id = 'u-essai'`);

    if (echecs.length) {
        console.log(`\n❌ missions longues : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ missions longues : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ missions longues : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});
