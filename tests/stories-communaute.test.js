// ==========================================================================
// SAMII OS — LES STORIES D'UNE COMMUNAUTÉ NE SORTENT PAS DE CHEZ ELLE
// ==========================================================================
//
// `GET /stories/:userId` rendait les stories de N'IMPORTE QUEL profil, sans
// regarder sa communauté. `stories` n'a pas de colonne `communaute` : sans
// filtre, la table est donc GLOBALE par défaut — la fuite qui est revenue
// cinq fois dans ce projet (le fil, les discussions, le classement, la
// marketplace, les vitrines).
//
// ── POURQUOI UN VRAI POSTGRES, ET PAS UNE DOUBLURE ────────────────────────
//
// `AGENTS.md` le dit, et c'est décisif ici : « les doublures de base de
// données n'exécutent pas le SQL. Elles prouvent qu'on demande la bonne
// chose, jamais que la base saurait répondre. »
//
// Une doublure devrait décider elle-même qui filtrer. Si elle applique le
// cloisonnement de son côté, le test passe même quand la requête ne filtre
// PAS — elle prouverait l'inverse de ce qu'on croit. Ici, c'est Postgres qui
// applique le WHERE, sur de vraies lignes.
//
// ── CE QUI EST MESURÉ, ET POURQUOI LE TÉMOIN COMPTE ───────────────────────
//
// Deux membres, deux communautés, une story chacun. On demande les quatre
// croisements. Les deux qui doivent passer sont AUSSI VÉRIFIÉS que les deux
// qui doivent être refusées : sans eux, une route cassée qui répondrait 404 à
// tout le monde aurait l'air parfaitement cloisonnée.
//
// Et une vérification que le 404 seul ne donne pas : `stories_vues`. Si la
// route lisait les stories avant de refuser, elle enregistrerait une vue. Zéro
// ligne prouve qu'elle s'est arrêtée AVANT de toucher la table.
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const MAISON = "samii";
const PARTENAIRE = "coindudigital";
const A = `st-com-a-${process.pid}`;   // chez nous
const B = `st-com-b-${process.pid}`;   // chez la partenaire
const LECTEUR = `st-com-lect-${process.pid}`;

(async () => {
    const URL = process.env.PGTEST_URL;
    if (!URL) {
        console.log("⏭️  Aucune PGTEST_URL — cloisonnement des stories non vérifié (normal hors développement).");
        return;
    }
    // Le garde-fou des suites réelles : cette suite ÉCRIT dans utilisateurs,
    // stories et stories_vues.
    if (!/localhost|127\.0\.0\.1|host=\//.test(URL) || !/test/i.test(URL)) {
        console.error("❌ PGTEST_URL doit être une base LOCALE dont le nom contient « test ». Suite refusée.");
        process.exit(1);
    }
    process.env.DATABASE_URL = URL;
    const db = require(path.join(RACINE, "services/db.js"));
    const schema = require(path.join(RACINE, "services/schema.js"));
    const communautes = require(path.join(RACINE, "config/communautes.js"));

    await schema.preparer();

    // ── LE MONTAGE ────────────────────────────────────────────────────────
    const nettoyer = async () => {
        await db.query(`DELETE FROM stories_vues WHERE user_id = ANY($1)`, [[A, B, LECTEUR]]);
        await db.query(`DELETE FROM stories WHERE auteur_id = ANY($1)`, [[A, B]]);
        await db.query(`DELETE FROM utilisateurs WHERE id = ANY($1)`, [[A, B, LECTEUR]]);
    };
    await nettoyer();

    for (const [id, com] of [[A, MAISON], [B, PARTENAIRE], [LECTEUR, MAISON]]) {
        await db.query(
            `INSERT INTO utilisateurs (id, email, password_hash, prenom, nom, communaute)
             VALUES ($1, $2, 'x', 'Membre', 'Témoin', $3)`,
            [id, `${id}@exemple.local`, com],
        );
    }
    for (const id of [A, B]) {
        await db.query(
            `INSERT INTO stories (auteur_id, media_url, type, expires_at, actif)
             VALUES ($1, 'https://exemple.local/photo.jpg', 'photo', now() + interval '24 hours', true)`,
            [id],
        );
    }

    // On vérifie que le montage EST ce qu'on croit : deux auteurs, deux
    // communautés, une story chacun. Sinon tout ce qui suit ne mesure rien.
    const montage = await db.query(
        `SELECT u.communaute, count(s.id)::int AS n
           FROM utilisateurs u JOIN stories s ON s.auteur_id = u.id
          WHERE u.id = ANY($1) GROUP BY u.communaute ORDER BY u.communaute`,
        [[A, B]],
    );
    verifier(montage.length === 2 && montage.every((r) => r.n === 1),
        "montage : il fallait deux auteurs de deux communautés avec une story chacun, " +
        `la base en rend ${JSON.stringify(montage)} — les croisements ci-dessous ne prouveraient rien`);

    // ── LA ROUTE, PILOTÉE À LA MAIN ───────────────────────────────────────
    const routeur = require(path.join(RACINE, "routes/stories.js"));
    const couche = routeur.stack.find((c) => c.route && c.route.path === "/:userId");
    if (!couche) {
        console.error("❌ stories : la route GET /:userId n'existe plus.");
        process.exit(1);
    }
    const poignees = couche.route.stack.map((s) => s.handle);

    // `res.locals.COM` est ce que pose `index.js` depuis la variable
    // d'environnement du service. C'est la SEULE source légitime : ni le
    // compte connecté, ni un paramètre d'URL.
    function visiter(slugDuService, auteur, requete = {}) {
        return new Promise((resolve) => {
            const req = {
                params: { userId: auteur },
                query: requete,
                session: { loggedIn: true, userId: LECTEUR },
            };
            let code = 200;
            const res = {
                locals: { COM: communautes.get(slugDuService) },
                status(c) { code = c; return this; },
                send: (corps) => resolve({ code, corps: String(corps || "") }),
                redirect: () => resolve({ code: 302, corps: "" }),
            };
            let i = 0;
            const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
            next();
        });
    }

    // ── LES DEUX CROISEMENTS QUI DOIVENT ÊTRE REFUSÉS, D'ABORD ────────────
    //
    // ⚠️ L'ORDRE N'EST PAS UN DÉTAIL, ET LA PREMIÈRE VERSION DE CE FICHIER
    // S'EST FAIT PRENDRE. Les visites légitimes enregistrent des vues — c'est
    // leur travail. En les faisant AVANT, la vérification « aucune vue sur la
    // story d'une autre communauté » trouvait la vue laissée par la visite
    // LÉGITIME du service partenaire, et accusait la route à tort.
    //
    // Les refus passent donc d'abord, sur une table de vues vierge.
    const chezEllesNotreMembre = await visiter(PARTENAIRE, A);
    verifier(chezEllesNotreMembre.code === 404,
        `sur le service de la partenaire, les stories de NOTRE membre répondent ` +
        `${chezEllesNotreMembre.code} au lieu de 404 : ce sont nos membres qui apparaissent ` +
        "chez elle, avec leur photo et leur nom");

    const chezNousSonMembre = await visiter(MAISON, B);
    verifier(chezNousSonMembre.code === 404,
        `sur NOTRE service, les stories du membre de la partenaire répondent ` +
        `${chezNousSonMembre.code} au lieu de 404 : ses membres apparaissent chez nous, et une ` +
        "fuite dans ce sens-là est la même faute vue de l'autre côté");

    // ── ET ELLE S'EST ARRÊTÉE AVANT DE LIRE ───────────────────────────────
    //
    // Un 404 ne dit pas QUAND la route a refusé. Si elle avait lu les stories
    // puis changé d'avis, une vue serait enregistrée. Zéro ligne, après les
    // deux refus et RIEN d'autre, prouve qu'elle n'est jamais allée jusqu'à
    // la table.
    // ── ET L'ADRESSE NE DÉCIDE PAS DE LA COMMUNAUTÉ ───────────────────────
    //
    // La règle 1 d'AGENTS.md : « le domaine décide, pas le compte » — et
    // jamais un paramètre d'URL. Ce bug est arrivé QUATRE fois dans ce projet
    // (discussions, actions du fil, publications, messages privés), toujours
    // de la même façon : un identifiant accepté depuis la page.
    //
    // Sans cette mesure, la mutation « la communauté est acceptée depuis
    // l'URL » n'était attrapée que par effet de bord — le harnais ne posait
    // jamais de paramètre, donc l'injection n'était pas éprouvée.
    for (const injection of [{ c: MAISON }, { communaute: MAISON }, { slug: MAISON }]) {
        const force = await visiter(PARTENAIRE, A, injection);
        verifier(force.code === 404,
            `sur le service de la partenaire, ajouter ?${Object.keys(injection)[0]}=${MAISON} à ` +
            `l'adresse fait répondre ${force.code} au lieu de 404 : la communauté est prise ` +
            "dans l'URL, donc il suffit de la taper pour voir ce qui n'est pas à soi");
    }

    const apresRefus = await db.query(
        `SELECT count(*)::int AS n FROM stories_vues WHERE user_id = $1`, [LECTEUR]);
    verifier(apresRefus[0]?.n === 0,
        `${apresRefus[0]?.n} vue(s) enregistrée(s) après deux refus et rien d'autre : la route a ` +
        "LU les stories avant de refuser. Le 404 masque une lecture qui a bien eu lieu, et la " +
        "ligne écrite dans stories_vues en garde la trace");

    // ── LES DEUX QUI DOIVENT PASSER ───────────────────────────────────────
    //
    // Aussi importantes que les refus : une route cassée qui répondrait 404 à
    // tout le monde aurait l'air parfaitement cloisonnée.
    const chezNousNotreMembre = await visiter(MAISON, A);
    verifier(chezNousNotreMembre.code === 200 && /story-slide/.test(chezNousNotreMembre.corps),
        `sur NOTRE service, les stories de notre propre membre ne s'affichent plus ` +
        `(code ${chezNousNotreMembre.code}) : le filtre par communauté est trop large et casse ` +
        "la fonctionnalité — un cloisonnement qui ferme tout n'est pas un cloisonnement");

    const chezEllesSonMembre = await visiter(PARTENAIRE, B);
    verifier(chezEllesSonMembre.code === 200 && /story-slide/.test(chezEllesSonMembre.corps),
        `sur le service de la partenaire, les stories de SON membre ne s'affichent plus ` +
        `(code ${chezEllesSonMembre.code}) : le filtre ne reconnaît pas sa communauté`);

    // Le témoin de la mesure précédente : une visite légitime, elle, LAISSE
    // une trace. Sans lui, le zéro ci-dessus pourrait venir d'un
    // enregistrement de vues cassé et non d'un refus au bon moment.
    const apresLegitimes = await db.query(
        `SELECT count(*)::int AS n FROM stories_vues WHERE user_id = $1`, [LECTEUR]);
    verifier(apresLegitimes[0]?.n === 2,
        `les deux visites légitimes ont enregistré ${apresLegitimes[0]?.n} vue(s) au lieu de 2 : ` +
        "l'enregistrement des vues est cassé, donc le zéro mesuré après les refus ne prouve " +
        "rien — il dirait seulement que rien ne s'enregistre jamais");

    await nettoyer();
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ cloisonnement des stories : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ cloisonnement des stories : ${verifs} vérifications passées`);
}).catch((err) => {
    console.log(`\n❌ cloisonnement des stories : la suite n'a pas pu s'exécuter — ${err.message}\n`);
    process.exit(1);
});
