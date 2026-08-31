// ==========================================================================
// SAMII OS — Voir les gens, et pouvoir aller les voir
//
// POURQUOI CE TEST EXISTE. Trois demandes arrivées ensemble, qui ne parlent
// que d'une chose : dans sa communauté, on ne voyait personne.
//
//   « Quand on est dans la marketplace ou dans la communauté et on clique
//     sur un profil, il faut que ça affiche ce qu'il a publié. Ça doit être
//     cliquable, les liens des gens. »
//   « Dans la vitrine, ils doivent pouvoir ajouter leur profil et leurs
//     photos, et ça paraît sur la communauté comme sur la marketplace. Il
//     faut qu'on voie la photo de profil de la personne. »
//   « Remets les annonces une par une comme au début. C'était beaucoup plus
//     pro, ça fait un peu comme Facebook, c'est beaucoup mieux. »
//
// CE QUI S'ÉTAIT PASSÉ. Le nom d'un auteur n'était un lien que si
// `COM.ecosysteme` — c'est-à-dire chez NOUS. Chez une partenaire, le même
// code rendait un `<span>`. Personne ne l'a écrit exprès : la condition
// avait été posée pour empêcher ses membres de sortir vers nos pages, et
// elle a emporté avec elle la seule page qui leur appartient vraiment.
//
// LE PIÈGE DE CE TEST. On pourrait vérifier que la source ne contient plus
// `COM.ecosysteme ?` près de « vitrine ». Ça tiendrait une semaine. On REND
// donc la page, pour les deux communautés, et on lit le HTML servi — celui
// que les gens verront.
//
// La deuxième règle vérifiée ici compte autant que la première : la photo se
// POSE sur les initiales, elle ne les remplace pas. Une base de plusieurs
// années contient des adresses d'images mortes ; le jour où l'une casse, on
// veut les initiales dessous, pas une icône brisée.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const communautes = require(path.join(RACINE, "config", "communautes"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const PHOTO = "https://res.cloudinary.com/ojwx5hft/image/upload/marlyse.jpg";

// Deux membres : une qui a mis sa photo, une qui n'en a pas. Les deux
// doivent bien s'afficher — c'est le cas « sans photo » qui casse en
// silence quand on remplace les initiales au lieu de les recouvrir.
const PUBLICATIONS = [
    {
        id: 1, auteur_id: "u2", prenom: "Marlyse", nom: "Kamga",
        grade_actuel: "Soldat", type_compte: "marchand", categorie: "formation",
        contenu: "Ma formation est en ligne.", created_at: new Date(), epingle: false,
        nb_likes: 3, nb_commentaires: 1, jaime: false, apercu_commentaires: [],
        photo_profil_url: PHOTO,
    },
    {
        id: 2, auteur_id: "u3", prenom: "Blaise", nom: "Ndongo",
        grade_actuel: "Soldat", type_compte: "client", categorie: "service",
        contenu: "Je cherche un graphiste.", created_at: new Date(), epingle: false,
        nb_likes: 0, nb_commentaires: 0, jaime: false, apercu_commentaires: [],
        photo_profil_url: null,
    },
];

const REQUETES = [];
const Module = require("module");
const vraiRequire = Module.prototype.require;
Module.prototype.require = function (nom) {
    if (nom === "../services/db") return {
        query: async (q, p) => {
            REQUETES.push({ sql: q, params: p || [] });
            if (/FROM publications p/.test(q)) return PUBLICATIONS;
            if (/score_grade/.test(q)) return [{
                id: "u2", prenom: "Marlyse", nom: "Kamga", grade_actuel: "Caporal",
                score_grade: 10, type_compte: "marchand", photo_profil_url: PHOTO,
            }];
            if (/DISTINCT ON \(s\.auteur_id\)/.test(q)) return [];
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
    console.error("❌ profils : la route /c/:slug n'existe plus.");
    process.exit(1);
}
const poignees = couche.route.stack.map((s) => s.handle);

function rendre(slug) {
    return new Promise((resolve) => {
        const req = {
            params: slug ? { slug } : {},
            query: {},
            session: { loggedIn: true, userId: "u1", email: "moi@example.cm", nom: "Ouahid Ghembaza" },
        };
        const res = { send: resolve, redirect: () => resolve("REDIRIGÉ") };
        let i = 0;
        const next = () => { const h = poignees[i++]; if (h) h(req, res, next); };
        next();
    });
}

(async () => {
    // ══════════════════════════════════════════════════════════════════════
    // 1. LE FIL SUR UNE SEULE COLONNE
    //
    // Le fil est passé un temps sur deux colonnes, à sa demande, puis il a
    // tranché dans l'autre sens en voyant le résultat. Une seule règle CSS
    // sépare les deux, et rien d'autre dans la page ne dit laquelle est en
    // vigueur : sans ce contrôle, la question se reposera au prochain
    // remaniement de la feuille de style.
    // ══════════════════════════════════════════════════════════════════════
    for (const slug of [communautes.DEFAUT, "coindudigital"]) {
        const html = await rendre(slug);
        const regle = (html.match(/#feedContainer\s*\{[^}]*\}/) || [""])[0];
        verifier(/grid-template-columns\s*:\s*1fr/.test(regle),
            `/c/${slug} : le fil n'est plus sur une seule colonne (${regle.replace(/\s+/g, " ").slice(0, 120)})`);
        verifier(!/auto-fill|auto-fit/.test(regle),
            `/c/${slug} : le fil reprend plusieurs colonnes selon la largeur — « une par une, comme au début »`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. LES PROFILS SONT CLIQUABLES — CHEZ ELLE AUSSI
    // ══════════════════════════════════════════════════════════════════════
    for (const slug of [communautes.DEFAUT, "coindudigital"]) {
        const html = await rendre(slug);

        for (const auteur of ["u2", "u3"]) {
            verifier(html.includes(`/vitrine/${auteur}`),
                `/c/${slug} : on ne peut pas cliquer sur l'auteur « ${auteur} » — son nom s'affiche, mais il ne mène nulle part`);
        }

        // Le nom SEUL ne suffit pas : c'est le portrait qu'on vise du doigt
        // sur un téléphone. On vérifie donc que chaque carte porte DEUX
        // chemins vers la même page — le portrait et le nom.
        for (const auteur of ["u2", "u3"]) {
            const liens = [...html.matchAll(
                new RegExp(`<a[^>]*href="/vitrine/${auteur}"`, "g"))].length;
            verifier(liens >= 2,
                `/c/${slug} : l'auteur « ${auteur} » n'a que ${liens} lien(s) vers sa page — le portrait ou le nom n'est pas cliquable`);
        }

        // Le repli non cliquable ne doit plus exister nulle part : c'est lui
        // qui rendait les noms morts sur son service.
        verifier(!/<div class="rank-item">/.test(html),
            `/c/${slug} : le classement affiche des membres sur lesquels on ne peut pas cliquer`);

        // Et le lien doit mener à une page qui EXISTE sur ce service : sans
        // le module « vitrine », le lien tomberait sur la porte fermée et
        // rebondirait vers l'accueil — pire que pas de lien du tout.
        const modulesQg = require(path.join(RACINE, "config", "modules-qg.js"));
        const permis = modulesQg.cheminsAutorises(communautes.get(slug));
        verifier(modulesQg.chemineAutorise("/vitrine/u2", permis),
            `/c/${slug} : les profils sont cliquables mais /vitrine est fermé sur ce service — chaque clic rebondit vers l'accueil`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3. LA PHOTO DE PROFIL S'AFFICHE — ET LES INITIALES RESTENT DESSOUS
    // ══════════════════════════════════════════════════════════════════════
    {
        const html = await rendre("coindudigital");

        verifier(html.includes(PHOTO),
            "la photo de profil d'un membre n'apparaît pas dans le fil — le fil reste un mur d'initiales");

        // Le repli : les initiales de CHACUN sont toujours écrites, y compris
        // pour celle qui a une photo. Une adresse morte retire l'image et
        // découvre les lettres ; si on les avait remplacées, il ne resterait
        // rien.
        for (const [init, qui] of [["MK", "Marlyse Kamga"], ["BN", "Blaise Ndongo"]]) {
            verifier(html.includes(`>${init}`),
                `les initiales de ${qui} ont disparu : le jour où une adresse d'image casse, sa carte n'affiche plus rien`);
        }

        // Le repli ne sert à rien s'il n'est pas déclenché : l'image doit se
        // retirer d'elle-même quand elle ne charge pas.
        const carte = html.slice(html.indexOf(PHOTO) - 300, html.indexOf(PHOTO) + 300);
        verifier(/onerror=/.test(carte),
            "une photo de profil qui ne charge pas laisse une icône cassée sur la carte — pas de repli");

        // Sans photo, aucune image n'est envoyée : un <img> vide affiche une
        // icône brisée dans plusieurs navigateurs.
        const nbImages = [...html.matchAll(/class="post-avatar"[^>]*>[^<]*<img/g)].length;
        verifier(nbImages <= 1,
            `${nbImages} portraits portent une image alors qu'un seul membre a une photo`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 4. LA REQUÊTE DEMANDE VRAIMENT LA PHOTO
    //
    // Le contrôle ci-dessus passerait encore si la page cessait de lire la
    // colonne, tant que la base simulée la renvoie quand même. Ici on
    // regarde ce que la page a RÉELLEMENT demandé.
    // ══════════════════════════════════════════════════════════════════════
    {
        REQUETES.length = 0;
        await rendre("coindudigital");
        const fil = REQUETES.find((r) => /FROM publications p/.test(r.sql));
        verifier(!!fil && /photo_profil_url/.test(fil.sql),
            "le fil ne demande plus la photo des auteurs à la base : elle ne s'affichera que par accident");
        const rang = REQUETES.find((r) => /score_grade/.test(r.sql));
        verifier(!!rang && /photo_profil_url/.test(rang.sql),
            "le classement ne demande plus la photo des membres");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 5. LA VITRINE NE MÉLANGE PAS LES COMMUNAUTÉS
    //
    // C'est la page où mènent maintenant tous ces liens, depuis n'importe
    // quel service. Elle lisait `publications` et `annonces` par identifiant
    // d'auteur SEULEMENT : quelqu'un qui a un pied chez nous et un pied chez
    // elle y voyait ses deux vies mélangées, sous la marque du domaine
    // visité. C'est la même fuite que le fil, les discussions, le classement
    // et la marketplace — elle revient à chaque table qu'on n'a pas encore
    // visitée, parce qu'une lecture sans filtre est GLOBALE par défaut.
    // ══════════════════════════════════════════════════════════════════════
    {
        const LUES = [];
        Module.prototype.require = function (nom) {
            if (nom === "../services/db") return {
                query: async (q, p) => {
                    LUES.push({ sql: q, params: p || [] });
                    if (/FROM utilisateurs WHERE id/.test(q)) return [{
                        id: "u2", prenom: "Marlyse", nom: "Kamga", created_at: new Date(),
                        photo_profil_url: PHOTO, vitrine_theme: "signature",
                    }];
                    return [];
                },
            };
            if (nom === "../services/pixelsService") return { getPixels: async () => ({}), pixelEventHtml: () => "" };
            return vraiRequire.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "routes", "vitrine-page.js"))];
        const { renderVitrine } = require(path.join(RACINE, "routes", "vitrine-page.js"));
        Module.prototype.require = vraiRequire;

        const COM = communautes.get("coindudigital");
        let page = "";
        await renderVitrine("u2", { session: { userId: "u2", loggedIn: true }, protocol: "https", get: () => "coindudigital.example" }, {
            locals: { COM },
            send: (h) => { page = h; },
            status() { return this; },
        });

        for (const [motif, quoi] of [[/FROM annonces/i, "ses produits"], [/FROM publications p/i, "ses publications"]]) {
            const lecture = LUES.find((r) => motif.test(r.sql));
            verifier(!!lecture, `la vitrine ne lit plus ${quoi}`);
            verifier(!!lecture && /communaute/i.test(lecture.sql),
                `la vitrine lit ${quoi} sans filtrer par communauté — sur son domaine, la page d'un membre affiche aussi ce qu'il fait chez nous`);
            verifier(!!lecture && lecture.params.includes(COM.slug),
                `la vitrine filtre ${quoi}, mais pas sur SA communauté (${JSON.stringify(lecture?.params)})`);
        }

        // Et la page ne signe pas avec notre marque sur son domaine.
        verifier(!/propulsée par <a[^>]*>SAMII/.test(page),
            "la vitrine d'un de ses membres est signée « propulsée par SAMII » sur son domaine");

        // Le propriétaire peut changer sa photo DEPUIS SA PAGE : c'est la
        // demande. Le réglage existait déjà, mais dans Paramètres, entre la
        // langue et le thème du QG — là où personne ne va chercher sa photo.
        verifier(/id="fichier-photo"/.test(page),
            "le propriétaire ne peut pas changer sa photo depuis sa propre vitrine");
        verifier(/id="fichier-banniere"/.test(page),
            "le propriétaire ne peut pas changer sa couverture depuis sa propre vitrine");
    }

    // ══════════════════════════════════════════════════════════════════════
    // 6. ENREGISTRER SA PHOTO : SA PAGE, ET SEULEMENT LA SIENNE
    // ══════════════════════════════════════════════════════════════════════
    {
        const ECRITS = [];
        Module.prototype.require = function (nom) {
            if (nom === "../services/db") return {
                query: async (q, p) => { ECRITS.push({ sql: q, params: p || [] }); return []; },
            };
            if (nom === "../services/geminiService") return {};
            return vraiRequire.apply(this, arguments);
        };
        delete require.cache[require.resolve(path.join(RACINE, "routes", "vitrine.js"))];
        delete require.cache[require.resolve(path.join(RACINE, "routes", "vitrine-page.js"))];
        const routeurV = require(path.join(RACINE, "routes", "vitrine.js"));
        Module.prototype.require = vraiRequire;

        const c = routeurV.stack.find((s) => s.route && s.route.path === "/apparence" && s.route.methods.post);
        verifier(!!c, "la route qui enregistre la photo depuis la vitrine n'existe pas");

        const appeler = (corps, session) => new Promise((resolve) => {
            const req = { body: corps, session, params: {}, query: {} };
            const res = {
                statusCode: 200,
                status(n) { this.statusCode = n; return this; },
                json: (o) => resolve({ statusCode: res.statusCode, ...o }),
            };
            let i = 0;
            const suivant = () => { const h = c.route.stack[i++]?.handle; if (h) h(req, res, suivant); };
            suivant();
        });

        if (c) {
            // Déconnecté : rien.
            ECRITS.length = 0;
            const anonyme = await appeler({ photo_profil_url: "https://x.test/a.jpg" }, {});
            verifier(anonyme.success !== true && !ECRITS.length,
                "n'importe qui, sans compte, peut écrire une photo de profil en base");

            // Connecté : on écrit, mais sur SOI.
            ECRITS.length = 0;
            const moi = await appeler(
                { photo_profil_url: "https://x.test/a.jpg", id: "u-victime", userId: "u-victime" },
                { loggedIn: true, userId: "u-moi" });
            verifier(moi.success === true, "le propriétaire ne peut pas enregistrer sa photo");
            const ecrit = ECRITS.find((e) => /UPDATE utilisateurs/i.test(e.sql));
            verifier(!!ecrit && ecrit.params.includes("u-moi"),
                "l'enregistrement n'écrit pas sur la personne connectée");
            verifier(!ecrit || !ecrit.params.includes("u-victime"),
                "on peut changer la photo de quelqu'un d'autre en glissant son identifiant dans l'envoi");
            verifier(!!ecrit && !/bio_vitrine|langue_preferee|theme_visuel|pays/i.test(ecrit.sql),
                "enregistrer une photo réécrit aussi la bio, le pays, la langue ou le thème — les autres réglages sont effacés au passage");

            // Une adresse qui n'est pas une image distante n'entre pas : ces
            // valeurs finissent dans un attribut src montré à des inconnus,
            // sur le fil comme sur la marketplace.
            for (const mauvaise of ["javascript:alert(1)", "data:text/html,<script>", "/local.jpg"]) {
                ECRITS.length = 0;
                const r = await appeler({ photo_profil_url: mauvaise }, { loggedIn: true, userId: "u-moi" });
                verifier(r.success !== true && !ECRITS.length,
                    `« ${mauvaise} » est accepté comme photo de profil et sera rendu dans un attribut src`);
            }
        }
    }

    if (echecs.length) {
        console.error(`❌ profils : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ profils : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ profils : la suite n'a pas pu s'exécuter —", err.stack);
    process.exit(1);
});
