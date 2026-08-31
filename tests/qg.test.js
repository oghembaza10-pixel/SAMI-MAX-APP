// ==========================================================================
// SAMII OS — Le QG d'un membre de partenaire est-il vraiment le sien ?
//
// POURQUOI CE TEST EXISTE. « Ouvrir ma boutique » depuis la communauté d'une
// partenaire menait dans NOTRE QG : quatorze entrées — Marketplace, Academy,
// Arsenal, Coffre OG, API & Webhooks, Parrainage — et « OG · TECHNOLOGY »
// écrit en haut à gauche. Rien de tout ça n'est à elle, rien ne lui a été
// promis. Elle envoie son monde chez elle, son monde tombe sur notre
// catalogue.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. La maison n'a rien perdu — c'est un partage, pas un rabotage.
//   2. Le QG d'une partenaire ne contient QUE ce qui lui a été accordé.
//   3. Sa marque en haut, pas la nôtre.
//   4. Son lien « communauté » ramène chez ELLE, pas chez nous.
//   5. LA GARANTIE STRUCTURELLE : un module ajouté demain au QG de la
//      maison n'apparaît PAS chez elle. C'est une liste blanche ; si elle
//      devenait une liste noire, chaque nouveau module fuiterait jusqu'à ce
//      que quelqu'un pense à l'exclure — et personne n'y pense.
//
// COMMENT. On rend vraiment le gabarit. C'est ce rendu qui a révélé qu'un
// gabarit EJS n'a pas de `require` : la relecture du code ne l'avait pas vu,
// et ça aurait donné un QG en erreur 500 en production.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");
const ejs = require(path.join(RACINE, "node_modules", "ejs"));

const communautes = require(path.join(RACINE, "config", "communautes"));
const modulesQg = require(path.join(RACINE, "config", "modules-qg"));

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const VUE = path.join(RACINE, "views", "qg-template.ejs");

function rendre(slug, typeCompte = "marchand") {
    return new Promise((resolve, reject) => {
        ejs.renderFile(VUE, {
            workspaceId: "w1", nom: "Ma boutique", metier: "ecommerce", description: "",
            langue: "fr", pays: "CM", devise: "XAF", connecteurs: [], samii: { mode: "auto" },
            logo: "", shop: "", themeVisuel: "og", attente: false, vueAgence: false,
            typeCompte, userId: "u-demo", loggedIn: true,
            communaute: communautes.get(slug),
            modulesQg,
        }, { views: [path.join(RACINE, "views")] },
        (err, html) => (err ? reject(err) : resolve(html)));
    });
}

// Les adresses de la colonne de gauche, telles qu'elles sont servies.
function liensNav(html) {
    return [...html.matchAll(/<a href="([^"]+)" class="qg-nav__item/g)].map((m) => m[1]);
}
function marque(html) {
    return (html.match(/qg-logo__text">([^<]+)/) || [])[1] || "";
}

(async () => {
    // ── 1. La maison n'a rien perdu ──────────────────────────────────────
    // La colonne de gauche a été sortie du gabarit et reconstruite à partir
    // de données : si un module avait disparu au passage, il aurait disparu
    // pour tout le monde, sans bruit.
    const maison = await rendre("samii");
    const ATTENDUS_MAISON = ["/hub", "/marketplace", "/community", "/academy", "/qg",
        "/connect/tools", "/developpeurs", "/apps", "/arsenal", "/coffre", "/samii",
        "/parrainage", "/billing", "/settings", "/logout"];
    const nav = liensNav(maison);
    for (const lien of ATTENDUS_MAISON) {
        verifier(nav.includes(lien), `le QG de la maison a perdu « ${lien} » dans le passage aux données`);
    }
    verifier(nav.some((l) => l.startsWith("/vitrine/")), "le QG de la maison a perdu le lien vers la vitrine");
    verifier(marque(maison) === "OG · TECHNOLOGY",
        `la maison affiche « ${marque(maison)} » au lieu de « OG · TECHNOLOGY »`);

    // Le QG Agence n'apparaît que pour un compte agence — comportement
    // d'origine, à ne pas perdre non plus.
    verifier(!nav.includes("/agence"), "le QG Agence s'affiche pour un marchand simple");
    verifier(liensNav(await rendre("samii", "agence")).includes("/agence"),
        "le QG Agence a disparu pour un compte agence");

    // ── 2 à 4. Chez une partenaire ───────────────────────────────────────
    for (const slug of Object.keys(communautes.COMMUNAUTES)) {
        if (slug === communautes.DEFAUT) continue;
        const COM = communautes.get(slug);
        const html = await rendre(slug);
        const liens = liensNav(html);

        // Sa marque, pas la nôtre.
        verifier(!/OG · TECHNOLOGY/.test(marque(html)),
            `/c/${slug} : « OG · TECHNOLOGY » est écrit en haut du QG de ses membres`);
        verifier(marque(html).includes(COM.marque),
            `/c/${slug} : sa marque « ${COM.marque} » n'apparaît pas en haut de SON QG`);

        // Rien de ce qui ne lui a pas été donné. On demande la liste au code
        // qui la calcule plutôt que de relire la configuration : si le filtre
        // laissait tout passer, lire la configuration donnerait quand même la
        // bonne réponse et le test serait aveugle à la panne.
        const accordes = new Set(modulesQg.autorises(COM).map((m) => m.id));
        const INTERDITS = modulesQg.MODULES
            .filter((m) => !accordes.has(m.id) && typeof m.href === "string")
            .map((m) => m.href);
        verifier(INTERDITS.length > 0,
            `/c/${slug} : plus aucun module n'est refusé — la liste blanche laisse tout passer`);
        for (const interdit of INTERDITS) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : « ${interdit} » est dans le QG de ses membres alors qu'il ne lui a pas été accordé`);
        }

        // Ce qui LUI a été donné doit y être — un QG vide ne sert personne.
        verifier(liens.includes("/connect/tools"),
            `/c/${slug} : « Connecter mes outils » manque, c'est pourtant le module qu'on lui laisse`);
        verifier(liens.includes("/qg"), `/c/${slug} : ses membres n'ont plus de lien vers leur propre QG`);
        verifier(liens.includes("/settings"), `/c/${slug} : ses membres n'ont plus accès à leurs réglages`);
        verifier(liens.includes("/logout"), `/c/${slug} : ses membres ne peuvent plus se déconnecter`);

        // ── PAS DE GRADES MILITAIRES DANS SON QG ─────────────────────────
        // « Enlève les grades aussi, Soldat etc. » Le casque, « SOLDAT », la
        // jauge qui se remplit vers « CAPORAL » : c'est notre jeu, et il
        // trône en haut de chaque page du QG.
        if (COM.grades === false) {
            verifier(!/class="qg-grade-bar"/.test(html),
                `/c/${slug} : la barre de grade (🪖 SOLDAT → CAPORAL) est toujours en haut de son QG`);
            verifier(!/>SOLDAT</.test(html),
                `/c/${slug} : « SOLDAT » s'affiche dans son QG`);
        }

        // Le chemin du retour mène chez ELLE.
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : le lien « communauté » de son QG ne ramène pas chez elle`);
        verifier(!liens.includes("/community"),
            `/c/${slug} : le lien « communauté » de son QG mène dans la nôtre`);
    }

    // ── 4 bis. Sur son domaine, tout porte SA marque ────────────────────
    //
    // « Pour créer une boutique je tombe dans les QG de OG. » Le QG lisait la
    // communauté du COMPTE. Un compte de la maison — le nôtre, en train de
    // tester — qui ouvre son QG depuis le domaine d'une partenaire y voyait
    // donc notre catalogue complet : Marketplace, Arsenal, Coffre OG, et
    // « OG · TECHNOLOGY » écrit en haut, sur SON domaine à elle.
    //
    // La règle : un service partenaire ne sert qu'une communauté, donc il
    // porte sa marque pour TOUT LE MONDE. Qui veut notre QG vient sur notre
    // domaine. C'est ce que ce test fige : quelle que soit l'appartenance du
    // compte, la page rendue sur son service est la sienne.
    // On teste la DÉCISION elle-même — pas le gabarit, qui reçoit déjà une
    // communauté toute choisie et ne dirait donc rien de ce bug.
    const M = communautes.DEFAUT;
    const cas = [
        // [service, compte, attendu, ce que ça veut dire]
        [null, M, M, "la maison, sans service partenaire déclaré : rien ne change"],
        [null, "coindudigital", "coindudigital", "sur notre domaine, un membre partenaire garde sa communauté"],
        ["coindudigital", M, "coindudigital", "LE BUG : notre compte sur SON domaine doit voir SON QG"],
        ["coindudigital", null, "coindudigital", "un compte sans communauté sur son domaine voit le sien"],
        ["coindudigital", "coindudigital", "coindudigital", "son membre sur son domaine"],
        [M, "coindudigital", "coindudigital", "« samii » déclaré ne force rien : ce n'est pas une marque partenaire"],
        ["nimportequoi", M, M, "un service mal configuré retombe sur le compte, il ne casse pas"],
    ];
    for (const [service, compte, attendu, pourquoi] of cas) {
        const obtenu = communautes.pourLeQG(service, compte).slug;
        verifier(obtenu === attendu,
            `QG servi par « ${service} » à un compte « ${compte} » → ${obtenu}, attendu ${attendu} (${pourquoi})`);
    }

    // ── 4 ter. L'ESPACE CLIENT aussi ────────────────────────────────────
    //
    // « C'est un mélange de ouf. » Exact. La communauté, la vitrine, le QG
    // marchand et les pages d'inscription portaient sa marque — et l'espace
    // client, lui, affichait encore « OG · TECHNOLOGY », Marketplace,
    // Academy, « Devenir livreur » et « SAMII t'aide au quotidien ».
    //
    // Ce n'était pas une vue oubliée par distraction : chaque gabarit
    // écrivait la marque en dur, donc chacun devait être corrigé
    // séparément, donc il en restait toujours un. Ce test couvre celui-là ;
    // le hub, /samii et la page d'accueil restent à convertir.
    const VUE_CLIENT = path.join(RACINE, "views", "client-qg.ejs");
    function rendreClient(slug) {
        return new Promise((resolve, reject) => {
            ejs.renderFile(VUE_CLIENT, {
                nom: "Test", codeParrainage: "X", telephone: "", commandes: [],
                COM: communautes.get(slug), loggedIn: true, userId: "u1",
                workspaceId: null, shop: null,
            }, { views: [path.join(RACINE, "views")] },
            (err, html) => (err ? reject(err) : resolve(html)));
        });
    }

    const clientMaison = await rendreClient(communautes.DEFAUT);
    for (const attendu of ["/marketplace", "/academy", "/livreur", "/community"]) {
        verifier(liensNav(clientMaison).includes(attendu),
            `l'espace client de la maison a perdu « ${attendu} »`);
    }
    verifier(marque(clientMaison) === "OG · TECHNOLOGY",
        `l'espace client de la maison affiche « ${marque(clientMaison)} »`);

    for (const slug of Object.keys(communautes.COMMUNAUTES)) {
        if (slug === communautes.DEFAUT) continue;
        const html = await rendreClient(slug);
        const liens = liensNav(html);

        verifier(!/OG · TECHNOLOGY/.test(marque(html)),
            `/c/${slug} : « OG · TECHNOLOGY » est écrit en haut de l'espace client`);
        for (const interdit of ["/marketplace", "/academy", "/livreur", "/community"]) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : « ${interdit} » est dans l'espace client de ses membres`);
        }
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : l'espace client ne ramène pas vers sa communauté`);

        // Ce que LIT le visiteur — commentaires et scripts exclus.
        const lisible = html
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<script[\s\S]*?<\/script>/g, "")
            .replace(/<style[\s\S]*?<\/style>/g, "");
        verifier(!/SAMII/.test(lisible),
            `/c/${slug} : « SAMII » est visible dans l'espace client de ses membres`);
    }

    // ── 5. Liste blanche, et non liste noire ─────────────────────────────
    // On ajoute un module comme on le ferait demain, sans rien dire à
    // personne. Il doit apparaître chez nous et rester invisible chez elle.
    // C'est la seule vérification qui protège l'AVENIR : toutes les autres
    // ne parlent que des modules d'aujourd'hui.
    modulesQg.MODULES.push({
        id: "__module_de_demain", libelle: "Module de demain", cle: "qg.nav.demain",
        icone: "sparkles", href: "/module-de-demain", rang: "more",
    });
    try {
        const maisonApres = liensNav(await rendre("samii"));
        verifier(maisonApres.includes("/module-de-demain"),
            "un module ajouté au catalogue n'apparaît même pas chez nous — le filtre est trop serré");

        for (const slug of Object.keys(communautes.COMMUNAUTES)) {
            if (slug === communautes.DEFAUT) continue;
            const apres = liensNav(await rendre(slug));
            verifier(!apres.includes("/module-de-demain"),
                `/c/${slug} : un module ajouté au QG de la maison est apparu chez elle tout seul — c'est une liste noire, il faut une liste blanche`);
        }
    } finally {
        modulesQg.MODULES.pop();
    }

    // ── La page de l'assistant ───────────────────────────────────────────
    // Elle avait sa propre colonne écrite en dur : « OG · TECHNOLOGY » en
    // haut, Marketplace, Academy, Arsenal, Coffre OG, et un « Community »
    // qui ramenait chez nous. C'est la page la plus sûrement visitée par
    // les membres d'une partenaire — l'assistant est ce qu'on lui donne —
    // et donc l'endroit où se tromper coûtait le plus cher.
    //
    // On la rend pour de vrai : une vue qui plante ne se voit qu'en
    // production, et une colonne partagée mal branchée retombe
    // silencieusement sur la nav de la maison.
    const VUE_SAMII = path.join(RACINE, "views", "samii.ejs");
    function rendreSamii(slug) {
        return new Promise((resolve, reject) => {
            ejs.renderFile(VUE_SAMII, {
                workspaceId: "w1", shop: "", estParticulier: false,
                communaute: communautes.get(slug), typeCompte: "marchand",
                userId: "u1", loggedIn: true, modulesQg,
            }, { views: [path.join(RACINE, "views")] },
            (err, html) => (err ? reject(err) : resolve(html)));
        });
    }

    const samiiMaison = await rendreSamii(communautes.DEFAUT);
    for (const attendu of ["/hub", "/marketplace", "/community", "/academy", "/arsenal", "/coffre", "/samii", "/settings"]) {
        verifier(liensNav(samiiMaison).includes(attendu),
            `la page de l'assistant a perdu « ${attendu} » chez nous`);
    }
    verifier(marque(samiiMaison) === "OG · TECHNOLOGY",
        `la page de l'assistant de la maison affiche « ${marque(samiiMaison)} »`);

    for (const slug of Object.keys(communautes.COMMUNAUTES)) {
        if (slug === communautes.DEFAUT) continue;
        const html = await rendreSamii(slug);
        const liens = liensNav(html);
        verifier(!/OG · TECHNOLOGY/.test(html),
            `/c/${slug} : « OG · TECHNOLOGY » est écrit sur la page de SON assistant`);
        for (const interdit of ["/academy", "/arsenal", "/coffre", "/community", "/hub"]) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : « ${interdit} » est dans la colonne de la page de son assistant`);
        }
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : depuis la page de son assistant, aucun lien ne ramène chez elle`);
    }

    // ── LA BARRE PARTAGÉE DE « CONNECTER MES OUTILS » ────────────────────
    //
    // « Qu'est-ce que ça fout chez elle, ça ? On voulait lui laisser Connect
    // Tools, mais pas ce qu'il y a avec. Là je vois Arsenal, je vois
    // Marketplace. »
    //
    // Cette barre (views/partials/sidebar.ejs) est incluse par DIX vues,
    // dont /connect/tools — le seul module métier qu'on lui a laissé. Elle
    // listait Accueil, Marketplace, Academy, Arsenal en dur. La porte
    // empêchait d'y entrer, mais les liens restaient affichés : on clique,
    // on rebondit, on croit que c'est cassé.
    const VUE_BARRE = path.join(RACINE, "views", "partials", "sidebar.ejs");
    function rendreBarre(slug, viaLeService) {
        // Les deux façons dont une vue peut recevoir la communauté : passée
        // par la route, ou seulement posée sur res.locals. Les dix vues qui
        // incluent cette barre ne la passent pas — c'est le second cas qui
        // compte le plus.
        const donnees = viaLeService
            ? { COM: communautes.get(slug) }
            : { communaute: communautes.get(slug) };
        return new Promise((resolve, reject) => {
            ejs.renderFile(VUE_BARRE, { ...donnees, modulesQg, userId: "u1", typeCompte: "marchand" },
                { views: [path.join(RACINE, "views")] },
                (err, html) => (err ? reject(err) : resolve(html)));
        });
    }
    const liensBarre = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

    for (const viaLeService of [true, false]) {
        const commentPasse = viaLeService ? "posée par le service" : "passée par la route";
        const barreMaison = await rendreBarre(communautes.DEFAUT, viaLeService);
        for (const attendu of ["/hub", "/marketplace", "/academy", "/community", "/discussions", "/arsenal"]) {
            verifier(liensBarre(barreMaison).includes(attendu),
                `la barre partagée de la maison a perdu « ${attendu} » (${commentPasse})`);
        }

        for (const slug of Object.keys(communautes.COMMUNAUTES)) {
            if (slug === communautes.DEFAUT) continue;
            const liens = liensBarre(await rendreBarre(slug, viaLeService));
            for (const interdit of ["/hub", "/academy", "/community", "/arsenal"]) {
                verifier(!liens.includes(interdit),
                    `/c/${slug} : « ${interdit} » est dans la barre de « Connecter mes outils » (${commentPasse}) — le module qu'on lui a laissé lui sert le sommaire de tout le reste`);
            }
            verifier(liens.includes(`/c/${slug}`),
                `/c/${slug} : la barre de « Connecter mes outils » ne ramène pas chez elle (${commentPasse})`);
            verifier(liens.includes("/logout"),
                `/c/${slug} : impossible de se déconnecter depuis « Connecter mes outils » (${commentPasse})`);
        }
    }
    verifier(!/og\.png/.test(await rendreBarre("coindudigital", true)),
        "notre logo est affiché en haut de la barre sur son service");

    // ── LA MARKETPLACE, OUVERTE MAIS SANS L'ALGÉRIE ──────────────────────
    //
    // « On va relâcher la Marketplace pour Inès. Mais tu enlèves ce qui est
    // algérien, genre local. Tu laisses juste Local, et on ne veut pas
    // savoir si c'est algérien ou camerounais. »
    //
    // Un drapeau algérien sur une communauté camerounaise dit à ses membres
    // qu'ils sont sur le site de quelqu'un d'autre. Et mettre un drapeau
    // camerounais ferait la même erreur dans l'autre sens : elle vend aussi
    // hors du Cameroun. « Local » sans pays, c'est ce qui est près de chez
    // soi, où que ce soit.
    // Déclarée ici : le bloc de la porte, qui définit PARTENAIRE et regles,
    // vient plus bas dans ce fichier.
    const ELLE = communautes.get("coindudigital");
    const sesRegles = modulesQg.cheminsAutorises(ELLE);
    verifier(modulesQg.autorises(ELLE).some((m) => m.id === "marketplace"),
        "la Marketplace n'est plus donnée au Coin Du Digital — c'est pourtant ce qui a été demandé");
    verifier(modulesQg.chemineAutorise("/marketplace", sesRegles) &&
             modulesQg.chemineAutorise("/marketplace/publier", sesRegles),
        "la Marketplace est dans ses modules mais la porte la referme");
    verifier(!modulesQg.MINIMAL.includes("marketplace"),
        "la Marketplace a été ajoutée à MINIMAL — la prochaine partenaire hériterait d'une décision prise pour Inès seule");

    const mk = ELLE.marketplace || {};
    verifier(typeof mk.local === "string" && !/🇩🇿|Algér/i.test(mk.local),
        `l'espace local de sa Marketplace s'appelle « ${mk.local} » — il ne doit nommer aucun pays`);
    verifier(!/🇨🇲|Cameroun/i.test(mk.local || ""),
        "l'espace local nomme le Cameroun — « on ne veut pas savoir si c'est algérien ou camerounais »");
    verifier(Array.isArray(mk.conversions) && mk.conversions.length > 0
        && !mk.conversions.includes("DZD") && !mk.conversions.includes("MAD"),
        `les prix de sa Marketplace se convertissent en ${JSON.stringify(mk.conversions)} — le dinar algérien et le dirham ne lui parlent pas`);

    // Le franc CFA doit être connu du convertisseur, sinon la conversion
    // rend le montant en euros sans le dire et le prix devient faux.
    const devises = require(path.join(RACINE, "services", "devises"));
    for (const d of mk.conversions || []) {
        verifier(Math.abs(devises.depuisEUR(1, d) - 655.957) < 0.01,
            `1 € ne fait pas 655,957 ${d} — la parité du franc CFA est fixée par accord, ce n'est pas un taux de marché`);
    }

    // ── SA MARKETPLACE EST VIDE, ET CLOISONNÉE ──────────────────────────
    //
    // « Tu lui mets une Marketplace VIDE, rattachée aux comptes des membres
    // et à leur profil. Tu enlèves ce qui est à nous : les fournisseurs. »
    //
    // La table `annonces` n'avait AUCUNE notion de communauté. Sa
    // Marketplace aurait donc affiché nos 203 annonces — produits CJ,
    // fournisseurs importés, annonces de tous les marchands. C'est la même
    // fuite que le fil, les discussions et le classement : elle revient à
    // chaque table qu'on n'a pas encore visitée, parce qu'une table sans
    // colonne `communaute` est GLOBALE par défaut.
    // On INTERROGE la route au lieu de relire son texte : la requête
    // principale assemble son WHERE dans un tableau (clauses.join), donc le
    // mot « communaute » n'apparaît nulle part dans la chaîne SQL. Une
    // relecture de source aurait crié à tort — et, pire, se serait tue le
    // jour où quelqu'un aurait assemblé un filtre absent de la même façon.
    const REQ_MK = [];
    const Module = require("module");
    const vraiRequire = Module.prototype.require;
    Module.prototype.require = function (nom) {
        if (nom === "../services/db") return {
            query: async (q, p) => { REQ_MK.push({ sql: q, params: p || [] }); return []; },
        };
        if (nom === "../services/journalService") return { ecrire: async () => {} };
        if (nom === "../services/gradeService") return { ajouterPoints: async () => {} };
        if (nom === "../services/chargily") return {};
        return vraiRequire.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(RACINE, "routes", "marketplace.js"))];
    const routeurMk = require(path.join(RACINE, "routes", "marketplace.js"));
    Module.prototype.require = vraiRequire;

    async function ouvrirMarketplace(slug) {
        REQ_MK.length = 0;
        const couche = routeurMk.stack.find((c) => c.route && c.route.path === "/" && c.route.methods.get);
        await new Promise((resolve) => {
            const req = { query: {}, params: {}, session: { loggedIn: true, userId: "u1", email: "u@x.cm" } };
            const res = {
                locals: { COM: communautes.get(slug) },
                status() { return this; }, type() { return this; },
                send: resolve, json: resolve, redirect: () => resolve(), render: () => resolve(),
            };
            let i = 0;
            const suite = () => { const h = couche.route.stack[i++]?.handle; if (h) h(req, res, suite); else resolve(); };
            suite();
        });
        return REQ_MK.filter((r) => /FROM annonces/i.test(r.sql));
    }

    const sesLectures = await ouvrirMarketplace("coindudigital");
    verifier(sesLectures.length > 0, "la Marketplace ne lit plus aucune annonce");
    for (const r of sesLectures) {
        verifier(/communaute/.test(r.sql),
            `la Marketplace lit les annonces sans filtrer par communauté — les 203 nôtres s'afficheraient chez elle : ${r.sql.replace(/\s+/g, " ").trim().slice(0, 100)}`);
        verifier(r.params.includes("coindudigital"),
            `la Marketplace filtre, mais pas sur SA communauté (${JSON.stringify(r.params)})`);
    }
    const nosLectures = await ouvrirMarketplace(communautes.DEFAUT);
    for (const r of nosLectures) {
        verifier(r.params.includes(communautes.DEFAUT),
            "sur notre service, la Marketplace ne lit plus nos propres annonces");
    }

    // Les fournisseurs et l'import sont à nous.
    verifier(ELLE.marketplace?.fournisseurs === false,
        "les fournisseurs (Import International, régions, catalogue CJ) sont de nouveau proposés chez elle — ce sont NOS accords, pas les siens");
    verifier(communautes.get(communautes.DEFAUT).marketplace?.fournisseurs !== false,
        "les fournisseurs ont disparu de NOTRE Marketplace");

    // La barre du bas suit ses modules : sur un téléphone, c'est la
    // navigation principale, celle qu'on a sous le pouce.
    const { mobileNav } = require(path.join(RACINE, "views", "partials", "mobileNav"));
    const barreElle = mobileNav("/marketplace", ELLE, { userId: "u1" });
    for (const interdit of ["/arsenal", "/academy", "/coffre"]) {
        verifier(!barreElle.includes(`href="${interdit}"`),
            `la barre du bas affiche « ${interdit} » sur son service — on appuie, on rebondit`);
    }
    verifier(mobileNav("/marketplace", communautes.get(communautes.DEFAUT)).includes('href="/arsenal"'),
        "la barre du bas de la maison a perdu l'Arsenal");

    // ── L'OUBLI DOIT TOMBER DU CÔTÉ SÛR ──────────────────────────────────
    // Les tests ci-dessus prouvent que la colonne est juste quand la route
    // lui passe la communauté. Ils ne prouvent RIEN sur la route qui
    // oublie de la passer — et c'est toujours celle-là qui casse.
    //
    // On rend donc la vue SANS `communaute`, en ne laissant que `COM` (posé
    // par index.js sur res.locals à chaque requête, dans toutes les vues).
    // Le service doit suffire.
    function rendreSansCommunaute(slug) {
        return new Promise((resolve, reject) => {
            ejs.renderFile(VUE_SAMII, {
                workspaceId: "w1", shop: "", estParticulier: false,
                COM: communautes.get(slug),   // res.locals, pas la route
                typeCompte: "marchand", userId: "u1", loggedIn: true, modulesQg,
            }, { views: [path.join(RACINE, "views")] },
            (err, html) => (err ? reject(err) : resolve(html)));
        });
    }
    for (const slug of Object.keys(communautes.COMMUNAUTES)) {
        if (slug === communautes.DEFAUT) continue;
        const liens = liensNav(await rendreSansCommunaute(slug));
        for (const interdit of ["/arsenal", "/community", "/hub"]) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : une route qui oublie de passer la communauté rend « ${interdit} » sur SON domaine — l'oubli doit tomber du côté sûr`);
        }
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : sans \`communaute\`, la colonne ne ramène plus chez elle`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // LA PORTE : « enlève tout ce qui relève de chez nous »
    // ══════════════════════════════════════════════════════════════════════
    //
    // Jusqu'ici on avait retiré nos modules de sa COLONNE. Ils restaient
    // servis à qui tapait l'adresse : /hub, /marketplace, /arsenal
    // répondaient toujours. Cacher un bouton ne ferme pas une porte.
    //
    // Ce bloc décide, adresse par adresse, ce qui s'ouvre chez elle.
    const fs = require("fs");
    const PARTENAIRE = communautes.get("coindudigital");
    const regles = modulesQg.cheminsAutorises(PARTENAIRE);

    verifier(modulesQg.cheminsAutorises(communautes.get(communautes.DEFAUT)) === null,
        "la maison s'est mise à filtrer ses propres adresses — ce garde ne doit rien changer chez nous");

    // ── Ce qui doit rester fermé ─────────────────────────────────────────
    for (const notre of ["/hub", "/academy",
                         "/arsenal", "/coffre", "/parrainage", "/billing", "/cartes",
                         "/agence", "/apps", "/developpeurs", "/api/v1", "/api/v1/produits",
                         "/api-docs", "/community", "/stories", "/drivers", "/livreur",
                         "/guerre", "/missions", "/tools", "/dashboard", "/partenariat",
                         "/admin", "/admin/utilisateurs", "/youtube", "/autopost", "/ads",
                         // Retirés sur sa demande : l'espace acheteur parle
                         // de NOTRE réseau, et le suivi de livraison est
                         // branché sur des transporteurs qu'elle n'a pas.
                         "/client-qg", "/livraisons"]) {
        verifier(!modulesQg.chemineAutorise(notre, regles),
            `« ${notre} » s'ouvre encore sur son service — c'est chez nous, ses membres n'ont rien à y faire`);
    }

    // ── Ce qui doit rester ouvert ────────────────────────────────────────
    // L'autre moitié du travail, et la plus facile à oublier : une porte
    // trop fermée casse son application sans que rien ne le dise.
    for (const sien of ["/qg", "/workspace/create", "/connect/tools", "/connect/whatsapp",
                        // « On va relâcher la Marketplace pour Inès. »
                        "/marketplace", "/marketplace/publier", "/marketplace/produit/42",
                        "/discussions", "/discussions/12", "/samii", "/samii/griot",
                        "/automatisations", "/vitrine/u1", "/settings", "/profile",
                        "/c/coindudigital", "/c/coindudigital/inscription",
                        "/admin/communaute", "/paiement/checkout",
                        "/api/qg-data", "/health", "/webhook/stripe-paiement",
                        "/login", "/register", "/logout", "/",
                        // Montées à la racine : elles ne ressemblent à aucun
                        // module, et la première version de cette porte les
                        // fermait toutes sans que rien ne le dise.
                        "/auth/google", "/auth/google/callback", "/auth/meta",
                        "/auth/shopify/callback", "/connect/woocommerce",
                        "/langue/fr", "/langue/en",
                        // La loi ne se met pas en liste blanche. Meta et
                        // Google vérifient aussi que ces adresses répondent.
                        "/privacy", "/privacy.html", "/terms", "/terms.html",
                        "/confidentialite", "/politique-de-confidentialite",
                        "/conditions-de-service", "/cgu",
                        "/suppression-des-donnees", "/data-deletion.html"]) {
        verifier(modulesQg.chemineAutorise(sien, regles),
            `« ${sien} » est fermé sur son service — c'est à elle, ou son application ne marche plus sans`);
    }

    // ── Les segments, pas les préfixes ───────────────────────────────────
    // « /c » ouvert ne doit pas ouvrir « /coffre », et « /apps » fermé ne
    // doit pas fermer autre chose que /apps.
    verifier(!modulesQg.chemineAutorise("/coffre", regles),
        "« /c » est ouvert et laisse passer « /coffre » — la comparaison ne porte pas sur des segments entiers");
    verifier(!modulesQg.chemineAutorise("/apps-de-chez-nous", regles),
        "un chemin qui commence comme un module autorisé passe la porte");

    // Les deux règles sont testées à VIDE, sur des listes fabriquées ici.
    // Sur les vraies listes, elles se couvrent l'une l'autre : casser une
    // seule des deux ne se voit pas, parce que la seconde rattrape. C'est
    // rassurant en production et inutile dans un test — une protection dont
    // on ne peut pas prouver qu'elle marche est une protection qu'on
    // supprimera un jour « puisque tout passe quand même ».
    const SEGMENTS = { ouverts: ["/c"], fermes: [] };
    verifier(modulesQg.chemineAutorise("/c/coindudigital", SEGMENTS),
        "un sous-chemin d'une adresse ouverte est refusé");
    verifier(!modulesQg.chemineAutorise("/coffre", SEGMENTS),
        "« /c » ouvert laisse passer « /coffre » : la comparaison n'est pas faite sur des segments entiers");

    const PRECISION = { ouverts: ["/api"], fermes: ["/api/v1"] };
    verifier(modulesQg.chemineAutorise("/api/qg-data", PRECISION),
        "une adresse couverte seulement par la règle ouverte est refusée");
    verifier(!modulesQg.chemineAutorise("/api/v1/produits", PRECISION),
        "une règle courte et ouverte annule une règle longue et fermée — l'ordre des listes déciderait à notre place");

    // ── PERSONNE NE MONTE UNE ROUTE SANS DÉCIDER À QUI ELLE EST ──────────
    //
    // Le vrai risque n'est pas la liste d'aujourd'hui : c'est la route
    // montée dans six mois, qui tombera du bon ou du mauvais côté par
    // hasard. On relit donc index.js et on exige que CHAQUE adresse montée
    // ait été classée ici. Une nouvelle route fait échouer ce test tant que
    // quelqu'un n'a pas tranché — c'est le but, pas un effet de bord.
    const CLASSEES = {
        // à elle
        "/": true, "/c": true, "/health": true, "/webhook": true,
        "/webhook/chargily": true, "/webhook/meta": true, "/webhook/whatsapp": true,
        "/webhook/paiement-afrique": true, "/webhook/stripe-paiement": true,
        "/billing/webhook": true, "/login": true, "/register": true,
        "/password-reset": true, "/logout": true, "/api": true, "/paiement": true,
        "/verification": true, "/telegram": true,
        "/qg": true, "/qg/:metier": true, "/qg/:metier/connecter": true,
        "/workspace": true, "/connect": true,
        "/discussions": true, "/samii": true, "/automatisations": true,
        "/vitrine": true, "/settings": true, "/profile": true,
        "/samii/chasseur-stock": true, "/samii/diplomate": true, "/samii/griot": true,
        "/samii/memoire-client": true, "/samii/messager-eclair": true,
        "/samii/miroir": true, "/samii/oeil-concurrentiel": true,
        "/samii/opportunites": true, "/samii/oracle-financier": true,
        "/samii/radar-prospects": true, "/samii/tendances": true,
        "/samii/top-produits": true,
        // Montées à la racine, sans préfixe. « Se connecter avec Google » et
        // « Connecter mes outils » passent par là — et « Connecter mes
        // outils » est justement ce qu'on lui a laissé.
        "/admin/communaute": true,
        "/auth/google": true, "/auth/google/callback": true,
        "/auth/meta": true, "/auth/meta/callback": true,
        "/auth/shopify": true, "/auth/shopify/callback": true,
        "/auth/shopify/token": true,
        "/auth/woocommerce/callback": true, "/auth/woocommerce/return": true,
        "/connect/woocommerce": true, "/webhook/woocommerce": true,
        // à nous
        "/hub": false, "/academy": false, "/arsenal": false,
        // Ouverte pour Inès : « on va relâcher la Marketplace ».
        "/marketplace": true,
        "/coffre": false, "/parrainage": false, "/billing": false, "/cartes": false,
        "/agence": false, "/apps": false, "/developpeurs": false, "/api/v1": false,
        "/api-docs": false, "/community": false, "/stories": false, "/drivers": false,
        "/livreur": false, "/guerre": false, "/missions": false, "/tools": false,
        "/dashboard": false, "/partenariat": false, "/admin": false, "/ads": false,
        "/client-qg": false, "/livraisons": false,
        "/youtube": false, "/autopost": false, "/inscription": false,
        "/test-telegram": false,
    };
    const source = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
    const montees = new Set([...source.matchAll(
        /app\.(?:use|get|post|all)\(\s*["'](\/[^"']*)["']/g)].map((m) => m[1]));

    // Les routeurs montés SANS préfixe — app.use(require("./routes/x")) —
    // définissent leurs adresses chez eux. Ils ne ressemblent à aucun
    // module, et c'est précisément ce qui les rend dangereux : la première
    // version de cette porte fermait /auth/google et le sélecteur de
    // langue, sans que rien ici ne le dise. On va donc les lire aussi.
    for (const [, fichier] of source.matchAll(
        /app\.use\(\s*(?:["']\/["']\s*,\s*)?require\(\s*["']\.\/routes\/([a-z0-9-]+)["']\s*\)/gi)) {
        let routeur;
        try {
            routeur = fs.readFileSync(path.join(RACINE, "routes", `${fichier}.js`), "utf8");
        } catch { continue; }
        for (const [, chemin] of routeur.matchAll(
            /router\.(?:get|post|put|delete|all)\(\s*["'](\/[^"']*)["']/g)) {
            montees.add(chemin);
        }
    }
    for (const route of [...montees].sort()) {
        if (!(route in CLASSEES)) {
            verifier(false,
                `« ${route} » est montée dans index.js mais personne n'a dit si elle est à elle ou à nous — ajoute-la à CLASSEES dans ce test`);
            continue;
        }
        verifier(modulesQg.chemineAutorise(route, regles) === CLASSEES[route],
            `« ${route} » est ${CLASSEES[route] ? "fermée alors qu'elle devrait être à elle" : "ouverte alors qu'elle est à nous"}`);
    }

    // ── AUCUNE ROUTE OUVERTE NE DOIT MENER À UNE PORTE FERMÉE ────────────
    //
    // La porte, seule, ne suffit pas : elle produit des culs-de-sac. Un
    // membre de chez elle ouvrait « Mes affaires », n'avait pas encore de
    // boutique, et la route le renvoyait vers /hub — qui est maintenant
    // fermé. Il rebondissait donc sur son fil, sans jamais comprendre
    // pourquoi le bouton ne marche pas. La page qu'il voulait — créer sa
    // boutique — était juste derrière.
    //
    // On lit donc les redirections écrites en dur dans les routes qui lui
    // sont ouvertes, et on exige qu'elles mènent quelque part où elle a le
    // droit d'aller.
    const montageParFichier = [...source.matchAll(
        /app\.use\(\s*["'](\/[^"']*)["']\s*,(?:[^)]*?)require\(\s*["']\.\/routes\/([a-z0-9-]+)["']/gi)]
        .map(([, prefixe, fichier]) => ({ prefixe, fichier }));
    verifier(montageParFichier.length > 20,
        "la lecture des montages d'index.js ne trouve presque rien — ce contrôle ne vérifie plus grand-chose");

    // index.js d'abord : ses propres routes (/qg, /samii) sont ouvertes chez
    // elle, et c'est là que vivait la redirection des comptes acheteurs vers
    // /client-qg. Sans cette ligne, fermer /client-qg créait un cul-de-sac
    // que ce contrôle n'aurait pas vu — il ne lisait que routes/.
    for (const { prefixe, fichier } of [{ prefixe: "/qg", fichier: null }, ...montageParFichier]) {
        if (!modulesQg.chemineAutorise(prefixe, regles)) continue;  // fermée : peu importe
        let corps;
        try {
            corps = fichier
                ? fs.readFileSync(path.join(RACINE, "routes", `${fichier}.js`), "utf8")
                : source;
        } catch { continue; }
        for (const [, cible] of corps.matchAll(/res\.redirect\(\s*["'](\/[^"'?]*)["']/g)) {
            verifier(modulesQg.chemineAutorise(cible, regles),
                `${fichier ? `routes/${fichier}.js` : "index.js"} (${prefixe}, ouvert chez elle) renvoie vers « ${cible} », qui est fermé — ses membres rebondissent sans explication`);
        }
    }

    // ── ET LES APPELS DU NAVIGATEUR ? ────────────────────────────────────
    //
    // Le contrôle ci-dessus lit les redirections du SERVEUR. Il ne voit pas
    // les fetch() écrits dans le JavaScript de la page — et c'est là que la
    // porte a fait le plus de dégâts : les six appels de la communauté
    // (publier, vendre, aimer, commenter…) visaient « /community/… » en dur.
    // La porte a fermé cette adresse, donc les six appels, SANS un mot :
    // 404 JSON, « Erreur » à l'écran, et rien dans les journaux qui dise que
    // la publication n'est jamais partie.
    //
    // Une adresse en dur dans un fetch est un lien comme un autre. Elle doit
    // passer la même porte.
    for (const fichier of ["community.js", "vitrine-page.js", "discussions.js"]) {
        let corps;
        try {
            corps = fs.readFileSync(path.join(RACINE, "routes", fichier), "utf8");
        } catch { continue; }
        for (const [, cible] of corps.matchAll(/fetch\(\s*["'](\/[^"'?`]*)["']/g)) {
            verifier(modulesQg.chemineAutorise(cible, regles),
                `routes/${fichier} : le navigateur appelle « ${cible} », que la porte ferme sur son service — l'action échoue en silence`);
        }
    }

    // La décision elle-même : chez nous le Hub, chez elle la création de
    // boutique. Testée à part, parce que c'est elle qui a été fausse.
    verifier(communautes.accueilMarchand(communautes.get(communautes.DEFAUT)) === "/hub",
        "un marchand de chez nous ne passe plus par le Hub");
    verifier(communautes.accueilMarchand(PARTENAIRE) === "/workspace/create",
        "un marchand de chez elle sans boutique n'est plus envoyé vers la création de boutique");
    verifier(modulesQg.chemineAutorise(communautes.accueilMarchand(PARTENAIRE), regles),
        "l'adresse de repli d'un marchand de chez elle est elle-même fermée — c'est une boucle");
    verifier(modulesQg.chemineAutorise(communautes.accueil(PARTENAIRE), regles),
        "la porte renvoie vers une adresse qu'elle refuse elle-même — boucle de redirection infinie");

    // ── `communautes` EST-IL VRAIMENT DÉCLARÉ LÀ OÙ ON S'EN SERT ? ───────
    //
    // Quinze fichiers ont dû apprendre à demander la communauté avant de
    // rediriger. Dans l'un d'eux, la déclaration existait déjà — mais À
    // L'INTÉRIEUR d'une fonction. Vue de loin, elle avait l'air d'être là ;
    // au point d'usage, elle n'existait pas. GET /login plantait pour toute
    // personne déjà connectée, et rien ne s'en apercevait au démarrage :
    // c'est un chemin qu'on ne prend qu'une fois connecté.
    //
    // Ce contrôle ne coûte rien et ferme la porte à toute une famille : une
    // variable de module utilisée sans être déclarée au niveau du module.
    const fichiersRoutes = fs.readdirSync(path.join(RACINE, "routes"))
        .filter((f) => f.endsWith(".js"));
    for (const f of fichiersRoutes) {
        const corps = fs.readFileSync(path.join(RACINE, "routes", f), "utf8");
        const lignes = corps.split("\n");
        // « config/communautes.js » cité dans un commentaire ou une page
        // d'aide n'est pas un usage — d'où le refus de « .js ».
        const usages = lignes.filter((l) =>
            /\bcommunautes\.(?!js\b)[a-zA-Z]/.test(l) && !/require\(/.test(l));
        if (!usages.length) continue;
        const auNiveauDuModule = lignes.some((l) =>
            /^(?:const|let|var)\s+communautes\s*=\s*require\(/.test(l));
        verifier(auNiveauDuModule,
            `routes/${f} : « communautes.… » est utilisé ${usages.length} fois, mais n'est déclaré nulle part au niveau du module — ReferenceError au moment où la ligne s'exécute, pas au démarrage`);
    }

    if (echecs.length) {
        console.error(`❌ QG : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ QG : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ QG : le gabarit n'a pas pu être rendu —", err.message);
    process.exit(1);
});
