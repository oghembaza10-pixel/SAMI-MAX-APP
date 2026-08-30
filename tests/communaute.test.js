// ==========================================================================
// SAMII OS — Une communauté partenaire est-elle vraiment close ?
//
// POURQUOI CE TEST EXISTE. « J'étais sur sa page, je me suis retrouvé dans
// mon QG. » Il y avait un bouton vers /qg dans l'en-tête, plus quatre autres
// liens qui sortaient : les stories, le profil d'un auteur, le classement,
// les réglages. Aucun ne se voyait — ce sont des icônes et des noms
// cliquables, pas des portes marquées « sortie ».
//
// CE QUE ÇA COÛTE QUAND ÇA ARRIVE. Une créatrice envoie son monde chez elle.
// Un visiteur clique sur une icône, atterrit sur une marque qu'il n'a jamais
// demandée, et ne retrouve jamais le chemin du retour. Elle, elle a dépensé
// sa crédibilité pour envoyer des gens ailleurs.
//
// LA RÈGLE VÉRIFIÉE ICI. Sur une communauté partenaire, tout lien mène soit
// chez elle (/c/<slug>), soit vers une ancre, soit vers l'extérieur assumé
// (une police, un mailto). Les ressources statiques (icônes, feuilles de
// style) sont admises : elles ne font naviguer personne.
//
// Les portes d'entrée d'un compte — /register et /login — sont admises à une
// condition : qu'elles portent ?c=<slug>, la mémoire du chemin de retour.
// Sans ce marqueur, le visiteur finirait dans notre QG après inscription.
//
// COMMENT. On rend vraiment la page, avec une base simulée. Pas d'analyse de
// source : c'est le HTML servi qu'on inspecte, celui que verra le visiteur.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");

const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

// ── Une base simulée : on teste le gabarit, pas les requêtes ────────────
const Module = require("module");
const vraiRequire = Module.prototype.require;
const PUBLICATIONS = [{
    id: 1, auteur_id: "u2", prenom: "Marlyse", nom: "Kamga",
    grade_actuel: "Créatrice", type_compte: "marchand", categorie: "formation",
    contenu: "Ma formation est en ligne.", created_at: new Date(), epingle: false,
    nb_likes: 3, nb_commentaires: 1, jaime: false, apercu_commentaires: [],
}];
// Ce que la page a VRAIMENT demandé à la base : on garde les requêtes pour
// pouvoir vérifier qu'elles filtrent bien par communauté.
const REQUETES = [];

Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p) => {
            REQUETES.push({ sql: q, params: p || [] });
            if (/FROM publications p/.test(q)) return PUBLICATIONS;
            if (/score_grade/.test(q)) return [{ id: "u2", prenom: "M", nom: "K", grade_actuel: "C", score_grade: 10, type_compte: "marchand" }];
            if (/DISTINCT ON \(s\.auteur_id\)/.test(q)) return [{ auteur_id: "u9", prenom: "Ines", nom: "A", created_at: new Date(), vue: false }];
            if (/AS total FROM/.test(q)) return [{ total: 42 }];
            return [];
        },
    };
    if (nom === "../services/gradeService") return {};
    return vraiRequire.apply(this, arguments);
};

const routeur = require(path.join(RACINE, "routes", "community.js"));
Module.prototype.require = vraiRequire;

const couche = routeur.stack.find((c) => c.route && c.route.path.includes("/c/:slug"));
if (!couche) {
    console.error("❌ communauté : la route /c/:slug n'existe plus.");
    process.exit(1);
}
const poignees = couche.route.stack.map((s) => s.handle);

function rendre(slug, connecte) {
    return new Promise((resolve) => {
        const req = {
            params: slug ? { slug } : {},
            query: {},
            session: connecte ? { loggedIn: true, userId: "u1", nom: "Ouahid Ghembaza" } : {},
        };
        const res = { send: resolve, redirect: () => resolve("REDIRIGÉ") };
        let i = 0;
        const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
        next();
    });
}

// Une adresse qui ne fait naviguer personne : image, police, feuille.
const RESSOURCE = /\.(png|jpe?g|svg|ico|webp|css|js|json|woff2?)($|\?)/i;

function liensSortants(html, slug) {
    const tous = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    return [...new Set(tous)].filter((u) => {
        if (u.startsWith("#") || u.startsWith("mailto:") || u.startsWith("http")) return false;
        if (RESSOURCE.test(u)) return false;
        if (u.startsWith(`/c/${slug}`)) return false;
        // Les portes d'entrée d'un compte, à condition de porter le retour.
        if (/^\/(register|login)\?c=/.test(u)) return false;
        // ── LA RÈGLE A ÉVOLUÉ, ET C'EST ASSUMÉ ──────────────────────────
        // À l'origine, sa communauté vivait DANS notre site : tout ce qui
        // sortait de /c/<slug> l'emmenait chez nous, donc tout devait rester
        // dedans. Elle a maintenant son propre service, et ces pages-là
        // portent SA marque quand elles y sont servies — son espace
        // marchand, son espace client, ses réglages. Les lui interdire
        // reviendrait à lui interdire sa propre boutique.
        //
        // Ce qui reste interdit, c'est NOTRE catalogue : marketplace,
        // academy, arsenal, coffre, hub, developpeurs, apps, et notre
        // communauté. Ces pages n'ont pas été converties et affichent
        // toujours « OG · TECHNOLOGY ».
        if (/^\/(qg|client-qg|settings|discussions)(\/|$|#|\?)/.test(u)) return false;
        // Sortir de son compte n'est pas sortir de sa communauté. Il n'y
        // avait AUCUN moyen de se déconnecter sur cette page — ni ici, ni
        // dans l'en-tête. Sur un téléphone qu'on prête, ce qui est courant,
        // c'est le compte de quelqu'un d'autre qu'on garde ouvert.
        //
        // /logout ne rend pas de page : il vide la session et renvoie à
        // l'accueil. Aucune marque à fuiter.
        if (u === "/logout") return false;
        return true;
    });
}

(async () => {
    // ── 1. La communauté partenaire est close ────────────────────────────
    for (const slug of Object.keys(communautes.COMMUNAUTES)) {
        if (slug === communautes.DEFAUT) continue;

        for (const connecte of [false, true]) {
            const html = await rendre(slug, connecte);
            verifier(html !== "REDIRIGÉ",
                `/c/${slug} (${connecte ? "connecté" : "visiteur"}) redirige au lieu de s'afficher — on doit pouvoir lire sans compte`);
            if (html === "REDIRIGÉ") continue;

            const fuites = liensSortants(html, slug);
            verifier(fuites.length === 0,
                `/c/${slug} (${connecte ? "connecté" : "visiteur"}) : ${fuites.length} lien(s) sortent de sa communauté — ${fuites.join(", ")}`);

            // Notre marque n'apparaît pas chez elle. On ignore les commentaires
            // et les scripts : c'est ce que LIT le visiteur qui compte.
            const lisible = html
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/<style[\s\S]*?<\/style>/g, "")
                .replace(/<script[\s\S]*?<\/script>/g, "");
            verifier(!/SAMII/.test(lisible),
                `/c/${slug} (${connecte ? "connecté" : "visiteur"}) : « SAMII » est visible sur la page d'une partenaire`);

            // Sa marque, elle, doit y être.
            const com = communautes.get(slug);
            verifier(html.includes(com.nom),
                `/c/${slug} : son nom « ${com.nom} » n'apparaît pas`);
        }

        // ── 2. Le visiteur ne voit pas le composeur, le membre si ────────
        const visiteur = await rendre(slug, false);
        const membre = await rendre(slug, true);
        verifier(/composer invite/.test(visiteur) && !/id="composerText"/.test(visiteur),
            `/c/${slug} : un visiteur devrait voir l'invitation, pas le champ de publication`);
        verifier(/id="composerText"/.test(membre),
            `/c/${slug} : un membre connecté devrait voir le champ de publication`);

        // ── 2 bis. Son fil est le SIEN ──────────────────────────────────
        // « Dans l'application il y'a rien. » Le fil n'était filtré par
        // aucune communauté : ce qu'un membre publiait chez elle atterrissait
        // dans notre communauté, et le nôtre s'affichait chez elle. Elle
        // avait notre marque en moins et notre contenu quand même.
        REQUETES.length = 0;
        await rendre(slug, true);
        const filDuFil = REQUETES.find((r) => /FROM publications p/.test(r.sql));
        verifier(!!filDuFil, `/c/${slug} : le fil n'est plus lu du tout`);
        if (filDuFil) {
            verifier(/communaute/.test(filDuFil.sql),
                `/c/${slug} : le fil ne filtre par aucune communauté — ce qui est publié chez elle s'affiche chez nous, et inversement`);
            verifier(filDuFil.params.includes(slug),
                `/c/${slug} : le fil est filtré, mais pas sur SON identifiant (${JSON.stringify(filDuFil.params)})`);
        }

        // ── 2 ter. Son classement et ses membres sont les SIENS ─────────
        // Sur sa page s'affichaient les cinq premiers de TOUTE la plateforme,
        // et « 17 membres » qui étaient les nôtres. Des gens qu'elle n'a
        // jamais vus, sous sa marque, présentés comme sa communauté. C'est la
        // même fuite que le fil, au même endroit du code — elle est revenue
        // une fois, elle peut revenir deux.
        for (const [nom, motif] of [["classement", /score_grade/], ["compteur de membres", /COUNT\(\*\)[\s\S]*FROM utilisateurs/]]) {
            const r = REQUETES.find((q) => motif.test(q.sql) && /FROM utilisateurs/.test(q.sql));
            verifier(!!r, `/c/${slug} : le ${nom} n'est plus lu`);
            if (r) {
                verifier(/communaute/.test(r.sql),
                    `/c/${slug} : le ${nom} ne filtre par aucune communauté — ce sont NOS membres qui s'affichent sous sa marque`);
                verifier(r.params.includes(slug),
                    `/c/${slug} : le ${nom} est filtré, mais pas sur SON identifiant (${JSON.stringify(r.params)})`);
            }
        }

        // ── 2 quater. LA GARDE GÉNÉRALE ─────────────────────────────────
        //
        // « Même base de données, mais les deux séparés. » Un seul Postgres,
        // deux communautés qui ne doivent jamais se voir. La séparation ne
        // tient alors qu'à une chose : un WHERE sur `communaute`, à écrire
        // dans CHAQUE requête qui touche une table partagée.
        //
        // Ça ne tient pas. J'ai corrigé quatre fuites de cette exact famille
        // en une semaine — le fil, le classement, le compteur de membres, les
        // stories. Trois d'entre elles avaient été écrites par quelqu'un qui
        // savait pourtant qu'il fallait filtrer.
        //
        // Les vérifications au-dessus nommaient chacune UNE requête. Celle-ci
        // les prend TOUTES, y compris celles qui n'existent pas encore : on
        // rend la page, on regarde tout ce qui est parti à la base, et toute
        // requête qui lit une table partagée sans filtrer échoue. Une requête
        // ajoutée demain sans WHERE est attrapée le jour même, sans que
        // personne ait à penser à mettre à jour ce test.
        const TABLES_PARTAGEES = /\bFROM\s+(publications|utilisateurs|stories|paiements|annonces)\b/i;
        REQUETES.length = 0;
        await rendre(slug, true);
        for (const r of REQUETES) {
            const m = r.sql.match(TABLES_PARTAGEES);
            if (!m) continue;
            // Une lecture par identifiant précis est déjà close : on ne lit
            // qu'une ligne qu'on a le droit de lire. Ce qui fuit, ce sont les
            // listes et les comptages.
            const parId = /\bWHERE\s+[\w.]*id\s*=\s*\$\d/i.test(r.sql)
                       || /publication_id\s*=\s*\$\d/i.test(r.sql);
            if (parId) continue;
            verifier(/communaute/.test(r.sql),
                `/c/${slug} : une requête lit « ${m[1]} » sans filtrer par communauté — ce sont NOS données qui remonteraient chez elle : ${r.sql.replace(/\s+/g, " ").trim().slice(0, 120)}`);
        }

    // ── 3 quinquies. On s'inscrit chez elle, pas chez nous ──────────────
        //
        // Le dernier endroit où notre marque apparaissait encore dans son
        // parcours : la page d'inscription. Un visiteur lisait sa communauté,
        // cliquait « Créer mon compte », et tombait sur une page noire et cyan
        // intitulée SAMII. Au milieu du parcours, la marque changeait — juste au
        // moment où on donne son email, c'est-à-dire au moment où on abandonne.
        //
        // Ce qui est vérifié : sa marque et pas la nôtre, aucun lien qui sorte,
        // et surtout que les formulaires envoient aux MÊMES adresses que les
        // nôtres. Une page d'inscription qui referait l'authentification de son
        // côté finirait par diverger — et un jour, une faille d'un seul côté.
        const auth = require(path.join(RACINE, "routes", "auth-communaute.js"));
        function rendreAuth(slug, quoi) {
            const couche = auth.stack.find((c) => c.route && c.route.path.includes(quoi));
            return new Promise((resolve) => {
                const req = { params: { slug }, session: {} };
                let code = 200;
                const res = { status(c) { code = c; return this; }, send: (h) => resolve({ code, html: h }) };
                couche.route.stack[0].handle(req, res, () => {});
            });
        }

        for (const [quoi, cible] of [["inscription", "/register"], ["connexion", "/login"]]) {
            const r = await rendreAuth(slug, quoi);
            verifier(r.code === 200, `/c/${slug}/${quoi} répond ${r.code}`);

            const lisible = r.html
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/<style[\s\S]*?<\/style>/g, "")
                .replace(/<script[\s\S]*?<\/script>/g, "");
            verifier(!/SAMII/.test(lisible),
                `/c/${slug}/${quoi} : « SAMII » est visible au moment où le visiteur donne son email`);
            verifier(r.html.includes(communautes.get(slug).marque),
                `/c/${slug}/${quoi} : sa marque n'apparaît pas sur SA page d'inscription`);

            const fuites = liensSortants(r.html, slug);
            verifier(fuites.length === 0,
                `/c/${slug}/${quoi} : ${fuites.length} lien(s) sortent — ${fuites.join(", ")}`);

            verifier(r.html.includes(`fetch(${JSON.stringify(cible)}`),
                `/c/${slug}/${quoi} : le formulaire n'envoie pas à ${cible} — l'authentification est en train d'être dupliquée`);
            verifier(r.html.includes(JSON.stringify(slug)),
                `/c/${slug}/${quoi} : le marqueur de communauté ne part pas avec le formulaire — le compte serait rattaché à la maison`);
        }

        // ── 2 quinquies. Retrouver sa boutique ──────────────────────────
        //
        // « Je vois "ouvrir une boutique" et j'ai déjà ouvert une boutique,
        // mais il n'y a aucune chose pour revenir dans mon espace boutique. »
        //
        // Le panneau proposait toujours d'en OUVRIR une. Deux dégâts : on ne
        // retrouve pas la sienne, et on doute qu'elle existe — puisqu'on nous
        // propose encore de la créer.
        const avecBoutique = await new Promise((resolve) => {
            const req = {
                params: { slug }, query: {},
                session: { loggedIn: true, userId: "u1", nom: "O G", workspaceId: "w1" },
            };
            const res = { send: resolve, redirect: () => resolve("REDIRIGÉ"), status() { return this; } };
            let i = 0;
            const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
            next();
        });
        verifier(/Ma boutique/.test(avecBoutique),
            `/c/${slug} : un membre qui A une boutique ne voit aucun moyen d'y revenir`);
        verifier(!/Ouvrir ma boutique/.test(avecBoutique),
            `/c/${slug} : on propose d'ouvrir une boutique à quelqu'un qui en a déjà une`);
        verifier(/class="btn-boutique"/.test(avecBoutique),
            `/c/${slug} : le retour vers sa boutique n'est pas en haut de page — sur téléphone le panneau latéral passe sous le fil, donc invisible`);

        // Et l'inverse : sans boutique, on doit pouvoir en ouvrir une.
        verifier(/Ouvrir ma boutique/.test(membre),
            `/c/${slug} : un membre SANS boutique ne peut plus en ouvrir une`);

        // ── 3. Son application lui appartient ────────────────────────────
        const com = communautes.get(slug);
        if (com.app) {
            verifier(membre.includes(`/c/${slug}/manifest.json`),
                `/c/${slug} : la page ne pointe pas vers SON manifeste`);
            verifier(!/href="\/manifest\.json"/.test(membre),
                `/c/${slug} : la page pointe encore vers le manifeste d'OG Technology`);
        }
    }

    // ── 3 ter. Un lien de travers ne devient pas notre communauté ────────
    //
    // `communautes.get()` retombe sur la maison pour tout slug inconnu. Dans
    // une adresse, ça donnait ceci : /c/coin-du-digital — l'orthographe la
    // plus naturelle de son nom — répondait 200 en servant NOTRE communauté,
    // sans un mot. Une créatrice colle son lien en story avec une lettre de
    // travers et envoie tout son public chez nous, sous une adresse qui a
    // l'air d'être la sienne.
    //
    // Vu de l'extérieur, ça ne ressemble pas à une panne : ça ressemble à
    // « le site est redevenu comme avant ». C'est pour ça que ça peut durer.
    async function statut(slug) {
        return new Promise((resolve) => {
            const req = { params: { slug }, query: {}, session: {} };
            let code = 200;
            const res = {
                status(c) { code = c; return this; },
                send: (html) => resolve({ code, html }),
                redirect: (c, url) => resolve({ code: typeof c === "number" ? c : 302, url: url || c }),
            };
            let i = 0;
            const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
            next();
        });
    }

    for (const faute of ["coin-du-digital", "nimportequoi", "samii-bis", "qg"]) {
        const r = await statut(faute);
        const sert = r.html || "";
        verifier(!(r.code === 200 && /Communauté SAMII/.test(sert)),
            `/c/${faute} : une adresse inconnue sert NOTRE communauté en 200 — son public atterrit chez nous sans que rien ne le signale`);
    }

    // Les orthographes déclarées ramènent à l'adresse unique.
    for (const [variante, canonique] of Object.entries(communautes.ALIAS)) {
        const r = await statut(variante);
        verifier(r.code === 301 && r.url === `/c/${canonique}`,
            `/c/${variante} devrait rediriger vers /c/${canonique} (reçu ${r.code} ${r.url || ""})`);
    }

    // ── 3 bis. L'adresse fait foi, jamais la session ─────────────────────
    // Quelqu'un qui visite /c/coindudigital garde le slug en session — c'est
    // ce qui lui fait retrouver sa communauté après inscription. Mais si la
    // page se fiait à cette mémoire, revenir sur /community afficherait SA
    // communauté à la place de la nôtre : l'adresse dirait une chose, la
    // page en montrerait une autre.
    const collant = await new Promise((resolve) => {
        const req = {
            params: {}, query: {},
            session: { loggedIn: true, userId: "u1", nom: "O G", communaute: "coindudigital" },
        };
        const res = { send: resolve, redirect: () => resolve("REDIRIGÉ") };
        let i = 0;
        const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
        next();
    });
    verifier(!/Le Coin Du Digital/.test(collant),
        "/community affiche la communauté gardée en session au lieu de la maison — l'adresse et la page ne disent pas la même chose");

    // ── 3 quater. Une palette est complète, ou elle ne l'est pas ─────────
    //
    // La feuille de style a été écrite pour un fond sombre. Quatre valeurs y
    // étaient codées en dur : le texte des boutons pleins, le voile de
    // l'en-tête, les surfaces en creux, les halos du fond. Sur la palette
    // blanche demandée par Audrey, ça donnait un en-tête noir sur une page
    // blanche, un champ de saisie gris foncé, un voile cyan sur toute la
    // page — et surtout un bouton « Créer mon compte » écrit en noir SUR du
    // noir : le bouton existait, on ne pouvait pas le lire.
    //
    // Les quatre sont devenues des variables. Ce test vérifie qu'une
    // communauté qui redéfinit sa palette les redéfinit TOUTES : en oublier
    // une, c'est hériter d'une valeur pensée pour le thème inverse.
    const JETONS_REQUIS = [
        "--bg", "--panel", "--text", "--muted", "--blue", "--blue-2",
        "--gold", "--border", "--sur-accent", "--voile", "--creux",
        "--halo-1", "--halo-2",
    ];
    for (const com of communautes.liste()) {
        if (!com.couleurs) continue;   // la maison garde la feuille d'origine
        const manquants = JETONS_REQUIS.filter((j) => !(j in com.couleurs));
        verifier(manquants.length === 0,
            `/c/${com.slug} : sa palette ne définit pas ${manquants.join(", ")} — ces valeurs retomberont sur celles du thème sombre, au milieu de ses couleurs à elle`);
    }

    // La maison garde ses propres pages : /c/samii/inscription n'a aucune
    // raison d'exister à côté de /register.
    const maisonAuth = await rendreAuth(communautes.DEFAUT, "inscription");
    verifier(maisonAuth.code === 404,
        `/c/${communautes.DEFAUT}/inscription répond ${maisonAuth.code} au lieu de 404 — deux pages d'inscription pour la maison`);
    const inconnuAuth = await rendreAuth("nimportequoi", "inscription");
    verifier(inconnuAuth.code === 404,
        `/c/nimportequoi/inscription répond ${inconnuAuth.code} au lieu de 404`);

    // ── 4. La communauté maison n'a pas été abîmée ───────────────────────
    const maison = await rendre(null, true);
    verifier(maison !== "REDIRIGÉ", "la communauté maison ne s'affiche plus");
    if (maison !== "REDIRIGÉ") {
        verifier(/SAMII/.test(maison), "la communauté maison a perdu sa marque");
        verifier(/href="\/qg"/.test(maison), "la communauté maison a perdu son lien vers le QG");
        verifier(/Écosystème/.test(maison), "la communauté maison a perdu son panneau Écosystème");
    }

    if (echecs.length) {
        console.error(`❌ communauté : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ communauté : ${verifs} vérifications passées (${Object.keys(communautes.COMMUNAUTES).length} communautés)`);
})();
