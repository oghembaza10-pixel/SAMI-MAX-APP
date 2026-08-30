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
        for (const interdit of ["/marketplace", "/academy", "/arsenal", "/coffre", "/community", "/hub"]) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : « ${interdit} » est dans la colonne de la page de son assistant`);
        }
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : depuis la page de son assistant, aucun lien ne ramène chez elle`);
    }

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
        for (const interdit of ["/marketplace", "/arsenal", "/community", "/hub"]) {
            verifier(!liens.includes(interdit),
                `/c/${slug} : une route qui oublie de passer la communauté rend « ${interdit} » sur SON domaine — l'oubli doit tomber du côté sûr`);
        }
        verifier(liens.includes(`/c/${slug}`),
            `/c/${slug} : sans \`communaute\`, la colonne ne ramène plus chez elle`);
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
