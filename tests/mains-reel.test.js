// ==========================================================================
// SAMII OS — L'ESCALADE ET LE COÛT, DANS UN VRAI TOUR
// ==========================================================================
//
// POURQUOI CETTE SUITE EXISTE EN PLUS DE `mains-de-samii.test.js`.
//
// ⚠️ ELLE EXISTE PARCE QUE DEUX GARDES ÉTAIENT CREUX, ET LA CAMPAGNE DE
// MUTATIONS LES A TROUVÉS.
//
// Les deux faits les plus importants du chantier G ne vivent pas dans une
// fonction : ils vivent dans l'ENCHAÎNEMENT d'un tour, dans `routes/api.js`.
//
//   1. L'escalade est-elle APPELÉE ? Le garde lisait le texte du fichier et
//      cherchait « niveauAuto.doitMonter( ». Muter l'appel en
//      « if (false && niveauAuto.doitMonter(…)) » laissait la chaîne intacte :
//      le garde restait vert, l'escalade était morte.
//
//   2. Le tour raté est-il REMPLACÉ ? Le garde cherchait
//      « result = await conduire() ». Muter la seconde occurrence en
//      « await conduire() » laissait la PREMIÈRE — donc le motif — en place.
//      Le garde restait vert, et les deux tours pouvaient être facturés.
//
// Un enchaînement ne se lit pas, il se parcourt. On monte donc un serveur
// Express minimal, on y branche la VRAIE route, et on envoie un vrai POST.
//
// ── CE QU'ON REMPLACE, ET SEULEMENT ÇA ───────────────────────────────────
//
// Le moteur. Il n'y a pas de clé Gemini ici, et surtout on veut un
// comportement reproductible : premier tour = aveu d'insuffisance, second =
// vraie réponse. Tout le reste est réel — la route, le planner, le choix du
// niveau, le quota, les crédits, le portefeuille, le journal, le SQL.
//
// Lancer :
//   PGTEST_URL=postgres://samii@127.0.0.1:5432/samii_pgtest npm test
// ==========================================================================
const path = require("path");

const URL = process.env.PGTEST_URL || "";
if (!URL) {
    console.log("⏭️  Aucune PGTEST_URL — suite mains réel ignorée (normal hors développement).");
    process.exit(0);
}
// Même garde-fou que les autres suites qui ÉCRIVENT : une base LOCALE dont le
// nom contient « test », même si quelqu'un colle la mauvaise adresse.
if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
    console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
    process.exit(1);
}
process.env.DATABASE_URL = URL;
process.env.PGSSL = process.env.PGSSL || "off";

const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── LA DOUBLURE DE MOTEUR ────────────────────────────────────────────────
//
// Elle note CE QU'ON LUI ENVOIE : c'est ce journal qui dit à quel niveau
// chaque appel est parti, et combien d'appels un tour a coûté.
const appels = [];
let scenario = "texte";

function poserLaDoublure() {
    const chemin = require.resolve(path.join(RACINE, "services", "geminiService.js"));
    const vrai = require(chemin);
    const doublure = {
        ...vrai,
        chat: async ({ message, context, useTools }) => {
            const charge = vrai.__test_buildToolsPayload(useTools, { ...context, tourDeConversation: true }, "gemini");
            const noms = Array.isArray(charge) ? (charge[0]?.functionDeclarations || []).map((d) => d.name) : [];
            // ⚠️ INSTRUMENT. Première version : on comptait TOUS les appels, et
            // la suite annonçait « 3 appels » là où l'escalade n'en fait que
            // deux. Le troisième est l'extraction de mémoire
            // (`services/memoireUtilisateur.js`, `context.source === "memoire"`),
            // que personne ne demande et que `config/credits.js` documente déjà :
            // « un message du QG déclenche DEUX appels Gemini, pas un ».
            //
            // Un compteur qui mélange les tours et la plomberie ne mesure pas
            // l'escalade. On ne compte donc que ce qui vient du planner.
            if (context?.source !== "memoire") {
                appels.push({ niveau: context?.niveau || null, outils: noms.length });
            }
            // Premier appel : l'aveu qui doit déclencher la montée. Les suivants :
            // une vraie réponse. C'est exactement la séquence que l'escalade
            // existe pour rattraper.
            if (scenario === "aveu" && appels.length === 1) {
                return { type: "text", provider: "gemini",
                         text: "Je n'ai pas accès à tes commandes pour te répondre." };
            }
            return { type: "text", provider: "gemini", text: "Tu as 42 commandes en attente." };
        },
        chatFlux: async (args) => doublure.chat(args),
    };
    require.cache[chemin] = { id: chemin, filename: chemin, loaded: true, exports: doublure };
}

poserLaDoublure();

const db = require(path.join(RACINE, "services", "db"));
const creditsSamii = require(path.join(RACINE, "services", "creditsSamii"));
const portefeuille = require(path.join(RACINE, "services", "portefeuille"));
const NIVEAUX = require(path.join(RACINE, "config", "niveaux"));
const CREDITS = require(path.join(RACINE, "config", "credits"));

const QG = "qg-mains-essai";
const EMAIL = "mains@example.test";

// ── LE SERVEUR MINIMAL ───────────────────────────────────────────────────
//
// Pas `index.js` : il monte quatre-vingt-seize routeurs, la porte, les
// tâches planifiées et les sockets. On veut UNE route, avec une session
// posée à la main — c'est ce qui rend l'échec lisible quand il arrive.
let serveur = null;
let base = "";
let userId = null;

async function monter() {
    const express = require(path.join(RACINE, "node_modules", "express"));
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.session = { loggedIn: true, userId, workspaceId: QG, typeCompte: "marchand", nom: "Essai" };
        next();
    });
    app.use("/api", require(path.join(RACINE, "routes", "api")));
    await new Promise((ok) => { serveur = app.listen(0, ok); });
    base = `http://127.0.0.1:${serveur.address().port}`;
}

async function envoyer(corps) {
    const r = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
    });
    return r.json();
}

async function solde() {
    try { return Number(await portefeuille.soldeDisponible(creditsSamii.compteDe(userId), "USD")) || 0; }
    catch { return 0; }
}

// ── LE NETTOYAGE DU GRAND LIVRE — ÉCRIT DEUX FOIS ────────────────────────
//
// ⚠️ PREMIÈRE VERSION : `DELETE FROM portefeuille_mouvements WHERE compte = <le
// compte du marchand>`. Elle effaçait UN SEUL CÔTÉ de chaque écriture.
//
// Le portefeuille est un livre à parties doubles : créditer le marchand écrit
// aussi la contrepartie sur le compte « SAMII ». En n'effaçant que la ligne du
// marchand, la suite laissait le livre déséquilibré de -1,97 $ — et
// `tests/credits-reel.test.js` l'a dit tout de suite :
//
//     • le grand livre n'est plus équilibré : somme signée = -1.97
//
// Ce garde-là est exactement à sa place, et il vaut mieux que mon nettoyage.
//
// LA SOLUTION EST CELLE DE `journal-reel.test.js`, pour la même raison : on note
// le dernier identifiant AVANT d'écrire, et on efface tout ce qui est venu
// après. C'est exact par construction, quelles que soient les écritures — y
// compris les contreparties qu'on n'a pas prévues.
let departLivre = 0;

async function nettoyer() {
    await db.query(`DELETE FROM journal WHERE workspace_id = $1`, [QG]).catch(() => {});
    await db.query(`DELETE FROM samii_conversations WHERE user_id = $1`, [userId]).catch(() => {});
    await db.query(`DELETE FROM consommation_ia WHERE user_id = $1`, [userId]).catch(() => {});
    // ⚠️ PAS DE `if (departLivre)` ICI. Première version : le nettoyage était
    // conditionné à `departLivre` non nul — or il vaut ZÉRO quand la table de
    // départ est vide, c'est-à-dire sur une base d'essai fraîche. Le `if`
    // sautait donc la suppression précisément dans le cas le plus courant, et
    // laissait 37 lignes derrière lui. Mesuré. `id > 0` est toujours la bonne
    // borne ; il n'y a rien à protéger.
    await db.query(`DELETE FROM portefeuille_mouvements WHERE id > $1`, [departLivre]).catch(() => {});
    await db.query(`DELETE FROM workspaces WHERE id = $1`, [QG]).catch(() => {});
    await db.query(`DELETE FROM utilisateurs WHERE email = $1`, [EMAIL]).catch(() => {});
}

(async () => {
    await require(path.join(RACINE, "services", "schema")).preparer();

    // ── UN COMPTE NEUF À CHAQUE EXÉCUTION ────────────────────────────────
    //
    // ⚠️ INSTRUMENT. Première version : `INSERT … (email, mot_de_passe, …)`.
    // La colonne s'appelle `password_hash` — la suite levait avant d'avoir
    // mesuré quoi que ce soit. Une doublure de base ne l'aurait pas dit : c'est
    // exactement la règle 3 d'AGENTS.md, et elle se paie à chaque fois.
    //
    // Le balayage passe par l'e-mail, parce qu'on ne connaît pas encore
    // l'identifiant d'une exécution précédente interrompue.
    const restes = await db.query(`SELECT id FROM utilisateurs WHERE email = $1`, [EMAIL]);
    for (const r of restes) {
        await db.query(`DELETE FROM consommation_ia WHERE user_id = $1`, [r.id]).catch(() => {});
        await db.query(`DELETE FROM samii_conversations WHERE user_id = $1`, [r.id]).catch(() => {});
        await db.query(`DELETE FROM portefeuille_mouvements WHERE compte = $1`,
                       [creditsSamii.compteDe(r.id)]).catch(() => {});
    }
    await db.query(`DELETE FROM journal WHERE workspace_id = $1`, [QG]).catch(() => {});
    await db.query(`DELETE FROM workspaces WHERE id = $1`, [QG]).catch(() => {});
    await db.query(`DELETE FROM utilisateurs WHERE email = $1`, [EMAIL]).catch(() => {});

    const u = await db.query(
        `INSERT INTO utilisateurs (email, password_hash, nom, type_compte)
         VALUES ($1, 'essai-sans-connexion', 'Essai mains', 'marchand') RETURNING id`, [EMAIL]
    );
    userId = u[0].id;
    await db.query(
        `INSERT INTO workspaces (id, nom, owner_email, owner, metier, statut, palier_abonnement)
         VALUES ($1, 'QG essai mains', $2, $2, 'ecommerce', 'actif', 'pro')`, [QG, EMAIL]
    );

    // Le dernier identifiant du livre AVANT toute écriture de cette suite.
    departLivre = Number(
        (await db.query(`SELECT COALESCE(MAX(id), 0)::bigint AS n FROM portefeuille_mouvements`))[0]?.n || 0
    );

    await monter();

    // ══════════════════════════════════════════════════════════════════════
    // A. LE DÉFAUT DONNE SES OUTILS À SAMII
    // ══════════════════════════════════════════════════════════════════════
    //
    // Aucun `niveau` dans le corps : c'est ce que fait un navigateur dont la
    // barre est sur Auto. Le tour doit peser le message et porter les outils.
    {
        appels.length = 0;
        scenario = "texte";
        const r = await envoyer({ message: "Fais le point sur mon activité ce mois" });
        verifier(r?.niveau?.auto === true,
            `le tour par défaut n'est pas automatique (${JSON.stringify(r?.niveau)})`);
        verifier(appels[0]?.outils > 0,
            `le premier appel au moteur part avec ${appels[0]?.outils} outils : SAMII répond de mémoire`);
        verifier(appels[0]?.niveau === r?.niveau?.id,
            `le niveau annoncé (${r?.niveau?.id}) n'est pas celui envoyé au moteur (${appels[0]?.niveau})`);
    }

    // Et une demande d'écriture atteint le cran de son outil, pour de vrai.
    {
        appels.length = 0;
        const r = await envoyer({ message: "Envoie une facture de 7500 DA à Aminata Diallo" });
        verifier(NIVEAUX.outilsDe(r?.niveau?.id || "").includes("envoyer_facture"),
            `« envoie une facture » retenu à « ${r?.niveau?.id} », qui ne porte pas envoyer_facture`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // B. L'ESCALADE EST APPELÉE, ET ELLE REMPLACE LE TOUR RATÉ
    // ══════════════════════════════════════════════════════════════════════
    {
        appels.length = 0;
        scenario = "aveu";
        const r = await envoyer({ message: "Combien de commandes en attente depuis hier ?" });

        // 1. ELLE A EU LIEU. C'est le garde que le texte ne pouvait pas tenir.
        verifier(!!r?.niveau?.escalade,
            "aucune escalade après un aveu d'insuffisance : routes/api.js n'appelle plus " +
            "doitMonter, ou la condition est morte");
        verifier(r?.niveau?.escalade && r.niveau.escalade.vers !== r.niveau.escalade.de,
            `l'escalade va de « ${r?.niveau?.escalade?.de} » à « ${r?.niveau?.escalade?.vers} » : ` +
            "un tour entier relancé pour retomber au même cran");

        // 2. LE MOTEUR A BIEN ÉTÉ RAPPELÉ, PLUS HAUT.
        verifier(appels.length === 2,
            `${appels.length} appel(s) au moteur : l'escalade doit en faire exactement deux`);
        verifier(appels[1] && NIVEAUX.comparer(appels[1].niveau, appels[0].niveau) > 0,
            `le second appel part au niveau « ${appels[1]?.niveau} », pas au-dessus de ` +
            `« ${appels[0]?.niveau} »`);
        verifier(appels[1]?.outils > appels[0]?.outils,
            `le second appel porte ${appels[1]?.outils} outils contre ${appels[0]?.outils} : ` +
            "monter n'a rien apporté");

        // 3. C'EST LA SECONDE RÉPONSE QUI SORT. Si `result` n'est pas remplacé,
        //    le marchand reçoit l'aveu — et l'a payé.
        verifier(!/n'ai pas accès/i.test(String(r?.reply || "")),
            `la réponse rendue est encore l'aveu (« ${String(r?.reply || "").slice(0, 60)} ») : ` +
            "l'escalade ne remplace pas le résultat");
        verifier(/42 commandes/.test(String(r?.reply || "")),
            `la réponse rendue n'est pas celle du second tour (« ${String(r?.reply || "").slice(0, 60)} »)`);

        // 4. ET LE NIVEAU ANNONCÉ EST CELUI QUI A RÉPONDU, pas celui du départ.
        verifier(r?.niveau?.id === r?.niveau?.escalade?.vers,
            `le niveau annoncé (${r?.niveau?.id}) n'est pas celui qui a répondu ` +
            `(${r?.niveau?.escalade?.vers}) : l'écran affiche un cran qui n'a pas servi`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // C. LE COÛT — UN SEUL MESSAGE FACTURÉ, MÊME AVEC UNE ESCALADE
    // ══════════════════════════════════════════════════════════════════════
    //
    // C'est la promesse économique du chantier : le tour raté est à notre
    // charge. On épuise le quota gratuit, on recharge, et on mesure le débit.
    {
        // Le palier « pro » du QG donne un quota large : on bascule le compte en
        // gratuit pour que le débit ait lieu, puis on épuise le quota.
        await db.query(`UPDATE workspaces SET palier_abonnement = 'free' WHERE id = $1`, [QG]);
        const quota = require(path.join(RACINE, "services", "samiiQuota"));
        const etat = await quota.getEtatQuota(userId, QG);
        // ⚠️ INSTRUMENT. Première version : on remplissait `consommation_ia`.
        // Ce n'est PAS la table que le quota lit — `compterMessagesFenetre`
        // compte les lignes `role = 'user'` de `samii_conversations`. La colonne
        // `etiquette` n'existe même pas, les insertions échouaient en silence,
        // le quota n'était jamais épuisé, et la colonne « coût » affichait 0 :
        // un instrument muet qui ressemblait à « Auto ne coûte rien ».
        for (let i = 0; i < (etat.total || 20) + 2; i++) {
            await db.query(
                `INSERT INTO samii_conversations (user_id, role, contenu, source, created_at)
                 VALUES ($1, 'user', 'saturation du quota', 'web', now())`, [userId]
            ).catch(() => {});
        }
        await creditsSamii.crediter(userId, 2, { rail: "essai", detail: "suite mains réel", ref: `mains-${Date.now()}` });

        const avant = await solde();
        appels.length = 0;
        scenario = "aveu";
        const r = await envoyer({ message: "Combien de commandes en attente depuis hier ?" });
        const apres = await solde();
        const debite = Math.round((avant - apres) * 100) / 100;

        verifier(avant > 0,
            `le solde de départ est ${avant} $ : sans solde, aucun débit ne peut être mesuré`);
        // Sur un compte gratuit, le plafond est « expert » : l'escalade est
        // refusée (cinquième verrou). Le tour ne doit donc coûter QU'un message.
        verifier(debite === CREDITS.PRIX_MESSAGE_USD,
            `le tour a coûté ${debite} $ au lieu de ${CREDITS.PRIX_MESSAGE_USD} $ — ` +
            (r?.niveau?.escalade ? "les deux tours ont été facturés" : "le prix d'un message a changé"));
        verifier(!r?.niveau?.escalade,
            `une escalade a eu lieu sur un compte gratuit (${JSON.stringify(r?.niveau?.escalade)}) : ` +
            "le plafond est « expert », monter n'a nulle part où aller");

        // Et avec un palier qui PERMET de monter : deux tours, un seul message.
        await db.query(`UPDATE workspaces SET palier_abonnement = 'pro' WHERE id = $1`, [QG]);
        // Le quota « pro » est large (150 / 5 h) : on le sature dans la même
        // table que celle que le compteur lit.
        for (let i = 0; i < 200; i++) {
            await db.query(
                `INSERT INTO samii_conversations (user_id, role, contenu, source, created_at)
                 VALUES ($1, 'user', 'saturation du quota', 'web', now())`, [userId]
            ).catch(() => {});
        }
        // ⚠️ INSTRUMENT. Première version : on attendait un débit de 0,03 $ sur
        // le SOLDE. C'était faux, et c'est le code qui avait raison : pour un
        // workspace payant, `routes/api.js` passe par
        // `depassementFacturable` → `enregistrerMessageDepassement()`, qui
        // accumule le dépassement sur l'ABONNEMENT au lieu de toucher au
        // portefeuille. Le solde ne bouge donc pas, et c'est voulu.
        //
        // Le bon compteur est `workspaces.messages_depassement_mois`. Et c'est
        // même une meilleure mesure : il compte les MESSAGES facturés, donc il
        // dit directement si l'escalade en a fait compter deux.
        const compteur = async () => Number(
            (await db.query(`SELECT messages_depassement_mois FROM workspaces WHERE id = $1`, [QG]))[0]
                ?.messages_depassement_mois || 0
        );
        const avant2 = await solde();
        const compte2Avant = await compteur();
        appels.length = 0;
        scenario = "aveu";
        const r2 = await envoyer({ message: "Combien de commandes en attente depuis hier ?" });
        const apres2 = await solde();
        const compte2Apres = await compteur();
        const debite2 = Math.round((avant2 - apres2) * 100) / 100;

        verifier(!!r2?.niveau?.escalade,
            "aucune escalade sur un compte qui peut monter : le filet ne sert à rien");
        verifier(appels.length === 2,
            `${appels.length} appel(s) au moteur alors qu'une escalade a eu lieu`);
        verifier(compte2Apres - compte2Avant === 1,
            `un tour AVEC escalade a fait compter ${compte2Apres - compte2Avant} message(s) au ` +
            "dépassement : le premier tour, celui qu'on a jugé insuffisant, est facturé au marchand");
        verifier(debite2 === 0,
            `le solde d'un workspace payant a été débité de ${debite2} $ : son dépassement doit ` +
            "aller sur l'abonnement, pas sur le portefeuille — sinon il paie deux fois");
    }

    // ══════════════════════════════════════════════════════════════════════
    // D. UN CHOIX MANUEL N'EST JAMAIS MONTÉ DANS LE DOS DE LA PERSONNE
    // ══════════════════════════════════════════════════════════════════════
    {
        appels.length = 0;
        scenario = "aveu";
        const r = await envoyer({ message: "Combien de commandes en attente depuis hier ?", niveau: "rapide" });
        verifier(r?.niveau?.id === "rapide" && r?.niveau?.auto === false,
            `« rapide » demandé à la main donne ${JSON.stringify(r?.niveau)}`);
        verifier(!r?.niveau?.escalade,
            "SAMII est monté d'un cran alors que la personne avait choisi Rapide");
        verifier(appels.length === 1,
            `${appels.length} appel(s) au moteur sur un choix explicite : on a dépensé deux fois`);
        verifier(/n'ai pas accès/i.test(String(r?.reply || "")),
            "la réponse d'un choix explicite a été remplacée : on a décidé à la place de la personne");
    }

    await nettoyer();
    serveur?.close();

    if (echecs.length) {
        console.error(`❌ mains réel : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ mains réel : ${verifs} vérifications passées (vrai tour HTTP, vraie base)`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ mains réel : la suite a levé —", err.message);
    console.error(err.stack?.split("\n").slice(1, 4).join("\n"));
    try { serveur?.close(); } catch { /* déjà fermé */ }
    process.exit(1);
});
