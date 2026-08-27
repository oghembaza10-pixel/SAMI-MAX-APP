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
