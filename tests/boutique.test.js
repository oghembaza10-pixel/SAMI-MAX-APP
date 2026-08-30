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
