// ==========================================================================
// SAMII OS — « Je clique sur ma boutique et ça ne mène nulle part »
//
// POURQUOI CE TEST EXISTE. La page chargeait, chargeait, et on ne bougeait
// pas d'un pixel. Aucune erreur nulle part — du point de vue du serveur,
// tout allait bien.
//
// DEUX PAGES SE RENVOYAIENT LA BALLE. /qg, sans boutique en session,
// redirigeait vers /workspace/create ; /workspace/create, s'il trouvait une
// boutique existante, redirigeait vers /qg. Il suffisait que les deux ne
// s'accordent pas sur « à qui est cette boutique » pour que ça tourne sans
// fin :
//
//   /qg comparait `owner` au caractère près.
//   /workspace/create cherchait sur « owner OU owner_email ».
//
// Deux colonnes, une majuscule d'écart, et la personne n'arrive jamais.
//
// C'est une régression que j'ai introduite : avant, /qg sans boutique menait
// au Hub, qui AFFICHAIT la liste — une page terminale. En le remplaçant par
// /workspace/create pour les partenaires, j'ai fermé la boucle.
//
// CE QUI EST VÉRIFIÉ. La règle de propriété est unique et tolérante à la
// casse ; et surtout : quel que soit l'état de la session, on finit toujours
// sur une PAGE, jamais dans un aller-retour.
//
// Lancer :  npm test
// ==========================================================================
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const workspaceService = require(path.join(RACINE, "services", "workspaceService"));

(async () => {
    // ── 1. La règle de propriété, seule ──────────────────────────────────
    const MOI = "ines@example.cm";
    const CAS = [
        [{ owner: MOI, ownerEmail: MOI }, MOI, true, "sa boutique, adresses identiques"],
        [{ owner: "Ines@Example.CM", ownerEmail: "" }, MOI, true, "la même adresse avec des majuscules — ce que fait un clavier de téléphone"],
        [{ owner: " " + MOI + " ", ownerEmail: "" }, MOI, true, "la même adresse avec des espaces autour"],
        // LE CAS QUI FAISAIT LA BOUCLE : la recherche trouvait la boutique
        // par owner_email, et le contrôle de propriété la refusait parce
        // qu'il ne regardait que owner.
        [{ owner: "AncienCompte@example.cm", ownerEmail: MOI }, MOI, true, "les deux colonnes diffèrent — c'est exactement ce qui bouclait"],
        [{ owner: "quelquun@autre.cm", ownerEmail: "quelquun@autre.cm" }, MOI, false, "la boutique de quelqu'un d'autre"],
        [null, MOI, false, "aucune boutique"],
    ];
    for (const [w, email, attendu, quoi] of CAS) {
        verifier(workspaceService.appartientA(w, email) === attendu,
            `propriété mal jugée — ${quoi} : attendu ${attendu}`);
    }
    // Une agence gère les boutiques qu'elle a ouvertes.
    verifier(workspaceService.appartientA(
        { owner: "client@example.cm", agenceId: "ag-1" }, "agence@example.cm",
        { typeCompte: "agence", userId: "ag-1" }) === true,
        "une agence ne reconnaît plus les boutiques qu'elle a ouvertes");
    verifier(workspaceService.appartientA(
        { owner: "client@example.cm", agenceId: "ag-2" }, "agence@example.cm",
        { typeCompte: "agence", userId: "ag-1" }) === false,
        "une agence entre dans les boutiques d'une AUTRE agence");

    // ── 2. LES DEUX PAGES NE PEUVENT PLUS SE RENVOYER LA BALLE ──────────
    //
    // On lit les deux sources et on vérifie l'invariant : /workspace/create
    // ne redirige vers /qg qu'après avoir posé la MÊME question que /qg.
    // Si l'une des deux se remet à juger la propriété toute seule, la
    // boucle revient — et elle ne se voit pas en relisant une seule page.
    const fs = require("fs");
    const qg = fs.readFileSync(path.join(RACINE, "index.js"), "utf8");
    const creation = fs.readFileSync(path.join(RACINE, "routes", "workspace.js"), "utf8");

    verifier(/workspaceService\.appartientA\(/.test(qg),
        "/qg ne passe plus par la règle partagée de propriété — il rejuge tout seul, et le désaccord recrée la boucle");
    verifier(/workspaceService\.appartientA\(/.test(creation),
        "/workspace/create ne passe plus par la règle partagée — il renverra vers /qg des boutiques que /qg refuse");
    verifier(!/workspace\.owner\s*!==\s*req\.session\.email/.test(qg),
        "/qg compare de nouveau les adresses au caractère près : une majuscule suffit à refuser sa propre boutique");

    // /qg doit CHERCHER la boutique avant de renoncer. C'est ce qui rend la
    // sortie terminale : quand il sort, il n'y a vraiment rien à trouver,
    // donc /workspace/create n'a rien à renvoyer.
    verifier(/getByOwner\(req\.session\.email\)/.test(qg),
        "/qg ne cherche plus les boutiques de la personne avant de la renvoyer ailleurs — il délègue, et l'autre page le lui redélègue");

    // ── 3. UNE ERREUR S'AFFICHE, ELLE NE SE REDIRIGE PAS ────────────────
    //
    // Le catch de /qg renvoyait aussi vers la création de boutique. C'est
    // la pire des trois sorties : si le QG échoue au rendu, il échouera
    // encore au tour suivant. La création retrouve la boutique, renvoie au
    // QG, qui replante… Un manège sans fin, et la vraie panne reste dans
    // des journaux que personne ne regarde à ce moment-là.
    const bloc = qg.slice(qg.indexOf('app.get("/qg", requireAuth'),
                          qg.indexOf('app.get("/qg/:metier"'));
    const catchQg = bloc.slice(bloc.lastIndexOf("} catch"));
    verifier(!/accueilMarchand/.test(catchQg),
        "le catch de /qg redirige vers la création de boutique — une panne de rendu devient une boucle infinie au lieu d'une erreur visible");
    verifier(/res\.status\(500\)/.test(catchQg),
        "le catch de /qg ne rend plus d'erreur : la panne est invisible pour la personne comme pour nous");

    // Et il ne reste qu'une seule sortie vers la création, atteinte
    // seulement quand la personne n'a vraiment aucune boutique.
    //
    // On retire les commentaires avant de compter : les explications de
    // cette route CITENT accueilMarchand() pour raconter le bug, et un test
    // qui compte des phrases plutôt que du code se met à échouer dès qu'on
    // écrit bien.
    const codeSeul = bloc.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    const sorties = [...codeSeul.matchAll(/accueilMarchand\(/g)].length;
    verifier(sorties === 1,
        `/qg a ${sorties} sortie(s) vers la création de boutique — il n'en faut qu'une, les mains vides`);

    // ══════════════════════════════════════════════════════════════════════
    // 4. « TOUT LE MONDE PEUT CRÉER SA BOUTIQUE »
    //
    // « Quand un de ses clients veut créer la boutique, il met "créer ma
    // boutique", il n'a pas accès. Ça, même moi, ça me faisait ça hier. »
    //
    // La cause n'était ni un droit ni une panne : à l'inscription, la case
    // cochée d'avance est « Découvrir » — `type_compte = 'client'`. Et /qg
    // renvoyait TOUT compte client vers le fil d'actualité avant même de
    // regarder s'il avait une boutique. Le bouton « Ouvrir ma boutique »,
    // lui, pointait précisément sur /qg. Le bouton menait donc à la porte
    // qui le refusait, et la page revenait d'où elle venait, sans un mot.
    //
    // Deux invariants à tenir, et le second est le plus facile à perdre :
    // une fois la boutique créée, le compte doit CESSER d'être « client »,
    // sinon la personne a une boutique où elle ne peut pas entrer.
    // ══════════════════════════════════════════════════════════════════════

    // ── a. Créer une boutique fait la marchande ─────────────────────────
    const ECRITURES = [];
    const Module = require("module");
    const vraiRequire = Module.prototype.require;
    Module.prototype.require = function (nom) {
        if (nom === "../services/db") return {
            query: async (q, p) => { ECRITURES.push({ sql: q, params: p || [] }); return []; },
        };
        return vraiRequire.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(RACINE, "services", "workspaceService.js"))];
    const wsPromu = require(path.join(RACINE, "services", "workspaceService.js"));
    Module.prototype.require = vraiRequire;

    const sessionClient = { typeCompte: "client", userId: "u-1" };
    ECRITURES.length = 0;
    verifier(await wsPromu.promouvoirEnMarchand(sessionClient) === true,
        "promouvoirEnMarchand refuse de promouvoir un compte « client »");
    verifier(sessionClient.typeCompte === "marchand",
        "la session reste « client » après la création de sa boutique — /qg la renverra au fil d'actualité, boutique ou pas");
    const ecrit = ECRITURES.find((e) => /UPDATE utilisateurs/i.test(e.sql));
    verifier(!!ecrit,
        "rien n'est écrit en base : à la prochaine connexion, le compte redevient « client » et la porte se referme");
    verifier(!!ecrit && /type_compte\s*=\s*'marchand'/i.test(ecrit.sql) && ecrit.params.includes("u-1"),
        "la promotion n'écrit pas le bon type, ou pas sur la bonne personne");

    // Une agence n'est pas un client : ce chemin ne doit jamais la toucher.
    const sessionAgence = { typeCompte: "agence", userId: "ag-1" };
    ECRITURES.length = 0;
    await wsPromu.promouvoirEnMarchand(sessionAgence);
    verifier(sessionAgence.typeCompte === "agence",
        "une agence est rétrogradée en marchand : elle perd les boutiques de ses clients");
    verifier(!ECRITURES.length,
        "une agence déclenche quand même une écriture en base");

    // ── b. La création promeut, dans les deux parcours ──────────────────
    // Le formulaire ET la conversation avec SAMII créent des boutiques. Un
    // seul des deux corrigé, et la moitié des gens reste enfermée dehors.
    // Les commentaires sont retirés d'abord : ce fichier CITE
    // workspaceService.create() pour dire que les deux parcours partagent la
    // même fonction, et le test comptait cette phrase comme un troisième
    // parcours — puis accusait un bug qui n'existait pas.
    for (const [nom, source] of [["le formulaire", creation.split("\n")
        .filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n")]]) {
        const blocsCreation = source.split("workspaceService.create(").slice(1);
        verifier(blocsCreation.length >= 2,
            `${nom} : il n'y a plus deux parcours de création — le contrôle ci-dessous ne vérifie plus rien`);
        for (let i = 0; i < blocsCreation.length; i++) {
            verifier(/promouvoirEnMarchand/.test(blocsCreation[i]),
                `un parcours de création de boutique (n°${i + 1}) laisse le compte en « client » : la boutique existe, la personne ne peut pas y entrer`);
        }
    }

    // ── c. /qg regarde les faits avant de fermer ────────────────────────
    // Il refusait sur le seul type de compte. Il doit d'abord chercher une
    // boutique à son nom — et n'a le droit de renvoyer au fil que s'il n'en
    // trouve aucune.
    //
    // La tranche s'arrête à `const communautesM`, la ligne qui suit
    // immédiatement ce bloc. Une première version allait jusqu'à
    // `estAgenceProprietaire` : elle englobait la recherche de boutique du
    // corps principal, donc elle disait oui même après avoir supprimé celle
    // de la branche « client ». Un test qui regarde trop large ne regarde
    // rien — le repère est vérifié juste en dessous pour que le jour où il
    // bouge, ce soit une panne bruyante et pas un test devenu creux.
    const debutClient = bloc.indexOf('typeCompte === "client"');
    const finClient = bloc.indexOf("const communautesM", debutClient);
    verifier(debutClient > 0 && finClient > debutClient,
        "/qg : la branche des comptes « client » ne se délimite plus — les deux contrôles qui suivent ne vérifient plus rien");
    const clientCode = bloc.slice(debutClient, finClient > 0 ? finClient : debutClient + 1200);
    verifier(/getByOwner/.test(clientCode),
        "/qg renvoie un compte « client » sans jamais chercher s'il a une boutique — c'est exactement le mur qu'on vient d'enlever");
    verifier(/promouvoirEnMarchand/.test(clientCode),
        "/qg laisse entrer un compte « client » sans corriger son type : il refera le mur au prochain clic");

    // ── d. Le bouton ne pointe plus sur la porte fermée ─────────────────
    const feed = fs.readFileSync(path.join(RACINE, "routes", "community.js"), "utf8");
    const boutonCode = feed.split("\n")
        .filter((l) => !/^\s*(\/\/|\*)/.test(l))
        .join("\n");
    const ouvrir = boutonCode.slice(boutonCode.indexOf("libelle: \"Ouvrir ma boutique\"") - 400,
                                   boutonCode.indexOf("libelle: \"Ouvrir ma boutique\"") + 40);
    verifier(/accueilMarchand\(/.test(ouvrir),
        "« Ouvrir ma boutique » ne mène plus là où l'on CRÉE une boutique — s'il pointe sur /qg, il pointe sur la porte qui le refuse");

    if (echecs.length) {
        console.error(`❌ boutique : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.error("   • " + e);
        process.exit(1);
    }
    console.log(`✅ boutique : ${verifs} vérifications passées`);
})().catch((err) => {
    console.error("❌ boutique : la suite n'a pas pu s'exécuter —", err.message);
    process.exit(1);
});
