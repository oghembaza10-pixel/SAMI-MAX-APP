// ==========================================================================
// SAMII OS — Une conversation est à deux, et pas à trois
//
// POURQUOI CE TEST EXISTE. « Sur chaque profil on doit pouvoir lui laisser
// un message, et il doit avoir un espace Mes messages dans son QG. »
//
// C'est du courrier privé entre deux personnes, dans une base partagée par
// toutes les communautés. Trois choses peuvent mal tourner, et deux d'entre
// elles ne se voient jamais depuis l'application :
//
//   1. LIRE CE QUI N'EST PAS À SOI. Une requête qui accepte un identifiant
//      venu de la page, et « /messages?avec=… » devient une porte ouverte sur
//      les conversations des autres. C'est la forme exacte du bug qu'on a
//      déjà eu trois fois ici — discussions, actions du fil, publications.
//
//   2. ÉCRIRE AU NOM DE QUELQU'UN D'AUTRE. Si l'expéditeur vient du corps de
//      la requête plutôt que de la session, n'importe qui peut faire dire
//      n'importe quoi à n'importe qui.
//
//   3. TRAVERSER LES COMMUNAUTÉS. Un membre de chez elle ne doit pas pouvoir
//      écrire à un membre de chez nous en tapant son identifiant, ni voir sur
//      son domaine les messages qu'il a reçus sur le nôtre.
//
// On INTERROGE les routes plutôt que de relire leur source : ce sont les
// paramètres réellement envoyés à la base qui décident, et une requête
// assemblée en morceaux ne montre pas ses filtres dans son texte.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const REQUETES = [];
let CIBLE_EXISTE = true;

const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p = []) => {
            REQUETES.push({ sql: q, params: p });
            if (/FROM utilisateurs WHERE id = \$1 AND COALESCE\(communaute/i.test(q)) {
                return CIBLE_EXISTE ? [{ id: p[0] }] : [];
            }
            if (/SELECT id, prenom, nom, photo_profil_url, type_compte/i.test(q)) {
                return [{ id: p[0], prenom: "Marlyse", nom: "Kamga" }];
            }
            if (/COUNT\(\*\)::int AS n/i.test(q)) return [{ n: 3 }];
            return [];
        },
    };
    if (nom === "../services/socketService") return { emitToUser: () => {}, emitToShop: () => {} };
    return vraiRequire.apply(this, arguments);
};
const routeur = require(path.join(RACINE, "routes", "messages.js"));
Module.prototype.require = vraiRequire;

const SLUG = "coindudigital";
const COM = communautes.get(SLUG);
const MOI = "u-moi";
const AUTRE = "u-autre";

function appeler(methode, chemin, { corps = {}, query = {}, session } = {}) {
    const couche = routeur.stack.find(
        (c) => c.route && c.route.path === chemin && c.route.methods[methode]);
    if (!couche) return Promise.resolve({ absente: true });
    return new Promise((resolve) => {
        const req = {
            body: corps, query, params: {},
            session: session === null ? {} : { loggedIn: true, userId: MOI, nom: "Ouahid", ...session },
        };
        const res = {
            locals: { COM },
            statusCode: 200,
            status(c) { this.statusCode = c; return this; },
            json: (o) => resolve({ statusCode: res.statusCode, ...o }),
            send: (o) => resolve({ statusCode: res.statusCode, corps: o }),
            redirect: (u) => resolve({ statusCode: 302, vers: u }),
        };
        let i = 0;
        const suivant = () => { const h = couche.route.stack[i++]?.handle; if (h) h(req, res, suivant); };
        suivant();
    });
}

(async () => {
    // ══════════════════════════════════════════════════════════════════════
    // 1. IL FAUT UN COMPTE POUR ÉCRIRE
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    const anonyme = await appeler("post", "/envoyer", {
        corps: { destinataire: AUTRE, contenu: "coucou" }, session: null,
    });
    verifier(anonyme.statusCode === 302 && !REQUETES.some((r) => /INSERT/i.test(r.sql)),
        "un visiteur sans compte peut déposer un message : la messagerie devient une boîte à spam anonyme");

    // ══════════════════════════════════════════════════════════════════════
    // 2. L'EXPÉDITEUR VIENT DE LA SESSION, JAMAIS DE LA PAGE
    //
    // Sans cette règle, on fait écrire n'importe qui à n'importe qui — et le
    // destinataire n'a aucun moyen de savoir que ce n'est pas la bonne
    // personne, puisque le message porte son nom.
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    const usurpation = await appeler("post", "/envoyer", {
        corps: { destinataire: AUTRE, contenu: "bonjour", expediteur_id: "u-victime", expediteur: "u-victime" },
    });
    verifier(usurpation.success === true, "l'envoi normal ne marche plus");
    const insert = REQUETES.find((r) => /INSERT INTO messages_prives/i.test(r.sql));
    verifier(!!insert && insert.params[0] === MOI,
        "l'expéditeur enregistré n'est pas la personne connectée");
    verifier(!!insert && !insert.params.includes("u-victime"),
        "un identifiant glissé dans l'envoi devient l'expéditeur : on peut faire parler quelqu'un d'autre");
    verifier(!!insert && insert.params.includes(SLUG),
        "le message est enregistré sans communauté : il apparaîtra sur tous les domaines à la fois");

    // ══════════════════════════════════════════════════════════════════════
    // 3. ON N'ÉCRIT PAS HORS DE SA COMMUNAUTÉ
    //
    // Le destinataire vient forcément du corps de la requête — on écrit bien
    // à quelqu'un. Il faut donc vérifier qu'il est bien d'ici, sinon un
    // identifiant tapé à la main fait arriver un message dans le QG de
    // quelqu'un qui n'a jamais entendu parler de cette communauté.
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    CIBLE_EXISTE = false;
    const horsCommunaute = await appeler("post", "/envoyer", {
        corps: { destinataire: "u-de-chez-nous", contenu: "salut" },
    });
    CIBLE_EXISTE = true;
    verifier(horsCommunaute.success === false,
        "on peut écrire à un membre d'une AUTRE communauté en tapant son identifiant");
    verifier(!REQUETES.some((r) => /INSERT INTO messages_prives/i.test(r.sql)),
        "le message est quand même écrit en base alors que le destinataire n'est pas de cette communauté");

    const controle = REQUETES.find((r) => /FROM utilisateurs WHERE id/i.test(r.sql));
    verifier(!!controle && /communaute/i.test(controle.sql) && controle.params.includes(SLUG),
        "le contrôle du destinataire ne filtre pas par communauté");

    // ══════════════════════════════════════════════════════════════════════
    // 4. S'ÉCRIRE À SOI-MÊME
    // Sans garde-fou, ça crée une conversation avec soi et un non-lu qu'on
    // ne peut jamais résoudre.
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    const soi = await appeler("post", "/envoyer", { corps: { destinataire: MOI, contenu: "note" } });
    verifier(soi.success === false && !REQUETES.some((r) => /INSERT/i.test(r.sql)),
        "on peut s'écrire à soi-même — un non-lu apparaît qu'aucune lecture n'effacera");

    // ══════════════════════════════════════════════════════════════════════
    // 5. UN MESSAGE VIDE OU DÉMESURÉ NE PART PAS
    // ══════════════════════════════════════════════════════════════════════
    for (const [contenu, quoi] of [
        ["", "un message vide"],
        ["   ", "un message d'espaces"],
        ["x".repeat(5000), "un message de 5000 caractères"],
    ]) {
        REQUETES.length = 0;
        const r = await appeler("post", "/envoyer", { corps: { destinataire: AUTRE, contenu } });
        verifier(r.success === false && !REQUETES.some((q) => /INSERT/i.test(q.sql)),
            `${quoi} est accepté et enregistré`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 6. LIRE : SEULEMENT SA PROPRE CORRESPONDANCE
    //
    // C'est le contrôle le plus important. « /messages?avec=… » prend un
    // identifiant dans l'adresse : si la requête ne l'ancre pas sur la
    // session, taper l'identifiant de deux autres personnes ouvre LEUR
    // conversation.
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    const lecture = await appeler("get", "/", { query: { avec: AUTRE } });
    verifier(lecture.statusCode === 200, "la boîte de réception ne s'ouvre plus");

    const fil = REQUETES.find((r) => /FROM messages_prives m LEFT JOIN/i.test(r.sql));
    verifier(!!fil, "le fil d'une conversation n'est plus lu");
    if (fil) {
        verifier(fil.params[0] === MOI,
            "la conversation n'est pas ancrée sur la personne connectée : on lit celle de deux inconnus en changeant l'adresse");
        verifier(/expediteur_id = \$1|destinataire_id = \$1/.test(fil.sql),
            "la requête du fil ne contraint pas la session à être l'un des deux interlocuteurs");
        verifier(/communaute/i.test(fil.sql) && fil.params.includes(SLUG),
            "le fil n'est pas filtré par communauté : sur son domaine, on lit les messages reçus chez nous");
    }

    // Marquer comme lu : ce qu'on a REÇU, pas ce qu'on a envoyé. Marquer ses
    // propres envois ferait disparaître le compteur de l'autre.
    const marque = REQUETES.find((r) => /UPDATE messages_prives SET lu_le/i.test(r.sql));
    verifier(!!marque, "ouvrir une conversation ne marque plus rien comme lu — la pastille ne redescend jamais");
    verifier(!marque || (/destinataire_id = \$1/.test(marque.sql) && marque.params[0] === MOI),
        "on marque comme lus des messages qu'on n'a pas reçus : le compteur de l'autre personne tombe à zéro sans qu'elle ait rien lu");

    // La liste des conversations, elle aussi, part de la session.
    // « DISTINCT ON », sans nommer la colonne : elle a dû être qualifiée
    // (t.autre) parce que « created_at » existait des deux côtés de la
    // jointure et rendait la requête ambiguë. Un motif collé au nom exact
    // s'est mis à ne plus rien trouver — donc à ne plus rien vérifier — au
    // moment précis où l'on corrigeait la requête.
    const liste = REQUETES.find((r) => /DISTINCT ON \(/i.test(r.sql));
    verifier(!!liste && liste.params[0] === MOI,
        "la liste des conversations n'est pas celle de la personne connectée");
    verifier(!!liste && /communaute/i.test(liste.sql) && liste.params.includes(SLUG),
        "la liste des conversations ignore la communauté");

    // ══════════════════════════════════════════════════════════════════════
    // 7. LA PASTILLE DU QG
    // ══════════════════════════════════════════════════════════════════════
    REQUETES.length = 0;
    const compteur = await appeler("get", "/non-lus");
    verifier(compteur.success === true && compteur.nonLus === 3,
        `le compteur de non-lus ne répond pas (${JSON.stringify(compteur)})`);
    const req7 = REQUETES.find((r) => /COUNT\(\*\)::int AS n/i.test(r.sql));
    verifier(!!req7 && req7.params[0] === MOI && req7.params.includes(SLUG),
        "le compteur compte les messages de quelqu'un d'autre, ou ceux d'une autre communauté");
    verifier(!!req7 && /lu_le IS NULL/i.test(req7.sql),
        "le compteur compte TOUS les messages et pas seulement les non-lus : la pastille ne redescend jamais");

    // ══════════════════════════════════════════════════════════════════════
    // 8. LA PORTE EST OUVERTE CHEZ ELLE, ET LE MODULE EST DANS SA COLONNE
    //
    // Une page fermée par la porte mais dont le lien reste affiché est pire
    // que pas de page du tout : on clique, on rebondit vers l'accueil.
    // ══════════════════════════════════════════════════════════════════════
    const modulesQg = require(path.join(RACINE, "config", "modules-qg.js"));
    for (const slug of [communautes.DEFAUT, SLUG]) {
        const permis = modulesQg.cheminsAutorises(communautes.get(slug));
        for (const chemin of ["/messages", "/messages/envoyer", "/messages/non-lus"]) {
            verifier(modulesQg.chemineAutorise(chemin, permis),
                `/c/${slug} : « ${chemin} » est fermé par la porte — le lien s'affiche et rebondit vers l'accueil`);
        }
        const ids = modulesQg.autorises(communautes.get(slug)).map((m) => m.id);
        verifier(ids.includes("messages"),
            `/c/${slug} : « Mes messages » n'est pas dans la colonne — les questions des clients arrivent et personne ne les voit`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 9. LES ENTRÉES SONT VISIBLES LÀ OÙ SES MEMBRES VIVENT
    //
    // Le module ajouté au registre apparaît dans la colonne du QG — et
    // NULLE PART AILLEURS. La page de sa communauté a sa propre barre
    // latérale, écrite à la main : « je ne vois rien pour les messages sur
    // Le Coin Du Digital » venait de là. Ses membres ne sont pas des
    // marchands, ils ne passent jamais par le QG.
    //
    // On rend donc la page et on regarde ce qui s'y trouve vraiment.
    // ══════════════════════════════════════════════════════════════════════
    {
        const PUBS = [{
            id: 1, auteur_id: "u2", prenom: "Marlyse", nom: "Kamga",
            grade_actuel: "Soldat", type_compte: "marchand", categorie: "formation",
            contenu: "Ma formation est en ligne.", created_at: new Date(), epingle: false,
            nb_likes: 0, nb_commentaires: 0, jaime: false, apercu_commentaires: [],
        }];
        Module.prototype.require = function (nom) {
            if (nom === "../services/db") return {
                query: async (q) => {
                    if (/FROM publications p/.test(q)) return PUBS;
                    if (/score_grade/.test(q)) return [];
                    if (/DISTINCT ON \(s\.auteur_id\)/.test(q)) return [];
                    if (/AS total FROM/.test(q)) return [{ total: 12 }];
                    return [];
                },
            };
            if (nom === "../services/gradeService") return {};
            return vraiRequire.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "routes", "community.js"))];
        const communaute = require(path.join(RACINE, "routes", "community.js"));
        Module.prototype.require = vraiRequire;

        const couche = communaute.stack.find((c) => c.route && c.route.path.includes("/c/:slug"));
        const html = await new Promise((resolve) => {
            const req = { params: { slug: SLUG }, query: {},
                session: { loggedIn: true, userId: MOI, email: "moi@x.cm", nom: "Ouahid G" } };
            const res = { send: resolve, redirect: () => resolve("REDIRIGÉ"), locals: {} };
            let i = 0;
            const next = () => { const h = couche.route.stack[i++]?.handle; if (h) h(req, res, next); };
            next();
        });

        verifier(/href="\/messages"/.test(html),
            "la page de sa communauté n'a aucun lien vers « Mes messages » — ses membres ne passent jamais par le QG, ils ne le verront donc jamais");
        // On vise le BOUTON, pas la fonction. Une première version cherchait
        // « ecrireA( » n'importe où dans la page : la définition de la
        // fonction suffisait à la satisfaire, et retirer tous les boutons ne
        // faisait rien crier.
        const boutonsMessage = [...html.matchAll(/onclick="ecrireA\(([^"]*)\)"/g)].map((m) => m[1]);
        verifier(boutonsMessage.length >= 1,
            "aucun bouton pour écrire à l'auteur d'une publication : il faut passer par sa vitrine, et on perd la moitié des gens en route");

        // LE NOM NE DOIT PAS ÊTRE INJECTÉ DANS L'ATTRIBUT.
        //
        // Une version l'y mettait entre guillemets doubles — ce qui refermait
        // l'attribut au milieu et rendait le bouton mort. Le bouton se passe
        // lui-même, et le nom est lu depuis la carte.
        for (const arg of boutonsMessage) {
            verifier(arg.trim() === "this",
                `le bouton passe « ${arg} » au lieu de « this » : injecter un nom dans l'attribut le referme au premier guillemet, et un nom à apostrophe casse la page`);
        }
        verifier(/id="cpt-messages"/.test(html),
            "pas de compteur de non-lus sur sa page : une question de client attend dans une boîte que personne n'ouvre");

        // L'ATTRIBUT NE DOIT PAS ÊTRE CASSÉ.
        //
        // Une première version écrivait le nom de l'auteur DANS l'attribut
        // onclick, entre guillemets doubles — ce qui refermait l'attribut au
        // milieu. Le bouton ne faisait plus rien, et un nom portant une
        // apostrophe aurait emporté la page entière.
        const onclicks = [...html.matchAll(/onclick="([^"]*)"/g)].map((m) => m[1]);
        for (const code of onclicks) {
            verifier(!/["]/.test(code),
                `un attribut onclick contient un guillemet double : « ${code.slice(0, 60)} » — l'attribut se referme au milieu et le bouton est mort`);
        }
    }

    if (echecs.length) {
        console.error(`❌ messages : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ messages : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ messages : la suite n'a pas pu s'exécuter —", err.stack);
    process.exit(1);
});
