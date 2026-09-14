// ==========================================================================
// SAMII OS — À QUI PARLE-T-ON, ET DONC QUE PEUT-IL TENIR
// ==========================================================================
//
// ── CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE UNE LIGNE ─────────────────────────
//
// Sonde sur `buildToolsPayload`, avec les contextes que les vraies routes
// construisent, avant toute correction :
//
//   chat public anonyme                    →   0 outils
//   CLIENT d'un marchand (WhatsApp/TG/FB)  →  14 outils   ⚠
//   membre d'une communauté                →  14 outils   ⚠
//   marchand hors QG (entraînement/Academy)→   9 outils
//   marchand dans son QG — rapide          →   0 outils
//   marchand dans son QG — expert          →   5 outils
//   marchand dans son QG — pro             →  11 outils
//   fondateur — maître                     →  12 outils
//   AUDIENCE ABSENTE                       →  17 outils   ⚠⚠
//
// Les quatorze du client contenaient les NEUF du marchand : consulter_gmail,
// envoyer_email, envoyer_facture, consulter_agenda, creer_evenement_agenda,
// lister_fichiers_drive, creer_rapport_sheets, resume_journee,
// rechercher_prospects.
//
// Ce n'est pas une injection. Aucun attaquant n'est nécessaire : un client
// qui écrit « regarde mes mails » à une boutique demandait à SAMII d'ouvrir
// la boîte Gmail DU MARCHAND, avec le connecteur DU MARCHAND.
//
// Et une audience absente donnait TOUT, `executer_code` compris : le calcul
// demandait « est-ce que ce n'est pas souverain ? », et « absente » n'est pas
// « souverain ». Un oubli dans une route ouvrait le maximum, en silence.
//
// ── LA RÈGLE MESURÉE ICI ─────────────────────────────────────────────────
//
//     OUTILS = AUDIENCE ∩ NIVEAU ∩ MOTEUR
//
// Trois axes, trois registres, aucun quatrième. L'audience existait déjà
// comme dimension — elle voyageait dans un booléen incapable de dire autre
// chose que « souverain ou pas ». Elle a maintenant sa table.
//
// Lancer :  node tests/audiences.test.js
// ==========================================================================

const AUDIENCES = require("../config/audiences");
const NIVEAUX = require("../config/niveaux");
const gemini = require("../services/geminiService");
const fs = require("fs");
const path = require("path");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const noms = (p) => (p?.[0]?.functionDeclarations || []).map((f) => f.name);
const outils = (useTools, ctx, moteur = "gemini") => noms(gemini.__test_buildToolsPayload(useTools, ctx, moteur));

// `useTools` tel que brain/planner.js le calcule, à la lettre. On ne le
// réinvente pas : si la ligne change là-bas, cette suite doit le refléter.
const uT = (ctx) => ctx.allowActions !== false && ctx.audience !== "souverain";

// Les outils PRIVÉS du marchand : tout ce qui touche à SON compte. Lus dans
// le registre, jamais recopiés — la prochaine famille ajoutée sera couverte
// sans que personne y pense.
const PRIVES = [...NIVEAUX.FAMILLES.lecture, ...NIVEAUX.FAMILLES.ecriture,
    ...NIVEAUX.FAMILLES.agents, ...NIVEAUX.FAMILLES.code];

// ══════════════════════════════════════════════════════════════════════════
// 1. LES CINQ POSTURES, AVEC LES CONTEXTES DES VRAIES ROUTES
// ══════════════════════════════════════════════════════════════════════════
{
    const POSTURES = [
        {
            nom: "chat public anonyme (routes/vitrine.js)",
            ctx: { audience: "public", tourDeConversation: true },
            attendus: [],
        },
        {
            nom: "client d'un marchand (WhatsApp / Telegram / Messenger)",
            ctx: { source: "whatsapp", audience: "client", workspaceId: "ws1", metier: "restaurant", tourDeConversation: true },
            attendus: NIVEAUX.FAMILLES.commerce,
        },
        {
            nom: "membre d'une communauté (discussions, Telegram groupe)",
            ctx: { source: "discussion-generale", audience: "community", tourDeConversation: true },
            attendus: NIVEAUX.FAMILLES.commerce,
        },
        {
            nom: "marchand hors QG (entraînement admin / Academy)",
            ctx: { audience: "souverain", tourDeConversation: true },
            attendus: [...NIVEAUX.FAMILLES.lecture, ...NIVEAUX.FAMILLES.ecriture],
        },
        {
            nom: "marchand dans son QG — niveau Expert",
            ctx: { audience: "souverain", niveau: "expert", tourDeConversation: true },
            attendus: NIVEAUX.outilsDe("expert"),
        },
        {
            nom: "fondateur — niveau Maître",
            ctx: { audience: "souverain", niveau: "maitre", tourDeConversation: true },
            attendus: NIVEAUX.outilsDe("maitre"),
        },
    ];

    for (const p of POSTURES) {
        const rendus = outils(uT(p.ctx), p.ctx);
        const manquants = p.attendus.filter((n) => !rendus.includes(n));
        const enTrop = rendus.filter((n) => !p.attendus.includes(n));

        verifier(!manquants.length,
            `${p.nom} : outil(s) MANQUANT(S) — ${manquants.join(", ")}. Une capacité a été retirée`);
        verifier(!enTrop.length,
            `${p.nom} : outil(s) EN TROP — ${enTrop.join(", ")}. Cette audience ne devrait pas les tenir`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. CE QU'UN CLIENT NE PEUT JAMAIS RECEVOIR — NOMMÉMENT
// ══════════════════════════════════════════════════════════════════════════
//
// La liste que le chantier nomme explicitement. On la vérifie outil par
// outil, sur TOUS les canaux client, et sur tous les moteurs : un relais de
// secours ne doit pas rouvrir ce qu'on vient de fermer.
{
    const INTERDITS_AU_CLIENT = [
        "consulter_gmail", "envoyer_email", "envoyer_facture",
        "creer_evenement_agenda", "lister_fichiers_drive", "creer_rapport_sheets",
        "consulter_agenda", "resume_journee", "rechercher_prospects",
        "preparer_publication", "preparer_strategie", "executer_code",
    ];

    const CANAUX_CLIENT = [
        { nom: "WhatsApp", ctx: { source: "whatsapp", audience: "client", workspaceId: "ws1" } },
        { nom: "Telegram", ctx: { source: "telegram", audience: "client", workspaceId: "ws1" } },
        { nom: "Messenger", ctx: { source: "facebook", audience: "client", workspaceId: "ws1" } },
        { nom: "Instagram", ctx: { source: "instagram", audience: "client", workspaceId: "ws1" } },
        { nom: "commentaire Facebook", ctx: { source: "facebook_comment", audience: "client", workspaceId: "ws1" } },
        { nom: "commentaire Instagram", ctx: { source: "instagram_comment", audience: "client", workspaceId: "ws1" } },
        { nom: "communauté", ctx: { source: "discussion-generale", audience: "community" } },
    ];

    for (const canal of CANAUX_CLIENT) {
        for (const moteur of ["gemini", "gemini-flash", "gemini-pro", "groq", "openrouter", "deepseek"]) {
            const rendus = outils(true, { ...canal.ctx, tourDeConversation: true }, moteur);
            const fuites = rendus.filter((n) => INTERDITS_AU_CLIENT.includes(n));
            verifier(!fuites.length,
                `${canal.nom} via ${moteur} : un client reçoit ${fuites.join(", ")} — ` +
                "ce sont les outils du MARCHAND, sur SON compte");
        }
    }

    // Et même si quelqu'un lui posait un niveau élevé dans le contexte : un
    // client n'a pas de niveau, et un niveau ne peut rien lui accorder de
    // plus que ce que son audience permet.
    for (const niveau of NIVEAUX.ORDRE) {
        const rendus = outils(true, { audience: "client", workspaceId: "ws1", niveau, tourDeConversation: true });
        const fuites = rendus.filter((n) => PRIVES.includes(n));
        verifier(!fuites.length,
            `un client à qui l'on pose le niveau « ${niveau} » reçoit ${fuites.join(", ")} : ` +
            "le niveau aurait le pouvoir d'élargir l'audience, alors qu'il ne peut que la restreindre");
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 3. MAIS LE CLIENT GARDE TOUT CE QUI EST À LUI
// ══════════════════════════════════════════════════════════════════════════
//
// Le risque inverse, et il casserait le produit : à force de fermer, un
// client ne pourrait plus commander. C'est le seul geste qui fait vivre une
// boutique.
{
    const client = { source: "whatsapp", audience: "client", workspaceId: "ws1", tourDeConversation: true };
    const rendus = outils(true, client);

    for (const outil of NIVEAUX.FAMILLES.commerce) {
        verifier(rendus.includes(outil),
            `un client a perdu « ${outil} » : la séparation aurait cassé le produit qu'elle protège`);
    }

    // Pendant une panne Gemini aussi. Un client qui commande un samedi soir
    // doit être servi par le relais.
    for (const relais of ["groq", "openrouter", "deepseek"]) {
        verifier(outils(true, client, relais).includes("passer_commande"),
            `pendant une bascule sur ${relais}, un client ne peut plus commander`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE MARCHAND ET LE FONDATEUR GARDENT LES LEURS
// ══════════════════════════════════════════════════════════════════════════
{
    // Chaque niveau rend EXACTEMENT ce que config/niveaux.js déclare. Ni
    // plus (l'audience n'ajoute rien), ni moins (elle ne retranche rien de
    // ce qui est à lui).
    for (const id of NIVEAUX.ORDRE) {
        const attendus = NIVEAUX.outilsDe(id).slice().sort();
        const rendus = outils(false, { audience: "souverain", niveau: id, tourDeConversation: true }).slice().sort();
        verifier(rendus.join(",") === attendus.join(","),
            `niveau « ${id} » : le souverain reçoit [${rendus.join(", ")}] au lieu de ` +
            `[${attendus.join(", ")}] — l'axe audience aurait pris le pas sur l'axe niveau`);
    }

    // Hors QG (entraînement, Academy) : lecture + écriture, et la table le
    // dit. Cette valeur vivait en dur dans geminiService ; si quelqu'un la
    // change, c'est ici qu'on le voit.
    const horsQg = outils(false, { audience: "souverain", tourDeConversation: true }).slice().sort();
    const attenduHorsQg = AUDIENCES.outilsSansNiveau("souverain").slice().sort();
    verifier(horsQg.join(",") === attenduHorsQg.join(","),
        `hors QG, le souverain reçoit [${horsQg.join(", ")}] au lieu de [${attenduHorsQg.join(", ")}]`);
    verifier(horsQg.includes("consulter_gmail") && horsQg.includes("envoyer_email"),
        "le marchand a perdu sa boîte mail dans son entraînement");

    // JAMAIS la famille commerce : ces outils agissent sur le carnet d'un
    // CLIENT. Garde-fou antérieur à ce chantier, qu'on ne desserre pas.
    //
    // ⚠️ ET ON LE VÉRIFIE AVEC `useTools` DANS LES DEUX SENS.
    //
    // Une mutation a survécu ici, et elle mérite d'être expliquée plutôt que
    // contournée : remplacer `context.audience !== "souverain"` par `true`
    // dans brain/planner.js ne casse plus rien. C'est exactement ce que ce
    // chantier visait — le booléen ne porte PLUS la décision d'audience, la
    // table la porte. Mais « ça ne casse plus rien » est une affirmation, et
    // une affirmation se mesure : si le plafond du souverain contenait un
    // jour la famille commerce, ce booléen redeviendrait la seule chose qui
    // l'en empêche, et sa mutation deviendrait grave sans prévenir.
    for (const id of [...NIVEAUX.ORDRE, null]) {
        for (const drapeau of [true, false]) {
            const ctx = { audience: "souverain", tourDeConversation: true };
            if (id) ctx.niveau = id;
            const commerce = outils(drapeau, ctx).filter((n) => NIVEAUX.FAMILLES.commerce.includes(n));
            verifier(!commerce.length,
                `le souverain (niveau ${id || "aucun"}, useTools=${drapeau}) porte ${commerce.join(", ")} : ` +
                "il agirait sur les commandes et rendez-vous d'un client");
        }
    }

    // La même chose, dite à la source : le plafond du souverain ne contient
    // aucun outil de commerce. C'est CE fait qui rend le booléen inoffensif.
    const plafondSouverain = AUDIENCES.outilsDe("souverain");
    verifier(!plafondSouverain.some((n) => NIVEAUX.FAMILLES.commerce.includes(n)),
        "le plafond de l'audience « souverain » contient des outils de commerce : le garde-fou " +
        "ne tient plus que par le booléen `useTools` de brain/planner.js, qui n'est pas fait pour ça");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. FERMÉ PAR DÉFAUT
// ══════════════════════════════════════════════════════════════════════════
//
// Mesuré avant correction : audience absente → 17 outils, tout le projet.
{
    const INCONNUES = [undefined, null, "", "marchand", "admin", "MARCHAND", "souverain ", "client2"];
    for (const a of INCONNUES) {
        const ctx = { tourDeConversation: true, niveau: "maitre" };
        if (a !== undefined) ctx.audience = a;
        const rendus = outils(true, ctx);
        verifier(!rendus.length,
            `audience ${JSON.stringify(a)} : ${rendus.length} outils accordés (${rendus.join(", ")}) — ` +
            "un oubli ou une faute de frappe dans une route donnerait le maximum de pouvoir, en silence");
    }

    verifier(!AUDIENCES.existe("marchand"),
        "« marchand » est déclaré comme audience : cette valeur n'est posée par AUCUNE route, " +
        "et la croire valide masquerait les vraies");
    verifier(AUDIENCES.outilsDe("inconnue").length === 0,
        "le registre accorde des outils à une audience qu'il ne connaît pas");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LES TROIS AXES SONT BIEN TROIS, ET CHACUN NE FAIT QUE RETRANCHER
// ══════════════════════════════════════════════════════════════════════════
{
    const base = { audience: "souverain", niveau: "maitre", tourDeConversation: true };
    const chezGemini = outils(false, base);

    // Le moteur retranche.
    for (const relais of ["groq", "openrouter", "deepseek"]) {
        const chezRelais = outils(false, base, relais);
        verifier(chezRelais.length < chezGemini.length,
            `${relais} porte autant d'outils que Gemini : le filtre moteur ne retranche plus rien`);
        verifier(chezRelais.every((n) => chezGemini.includes(n)),
            `${relais} porte un outil que Gemini ne porte pas : un axe AJOUTE au lieu de retrancher`);
    }

    // Le niveau retranche.
    const expert = outils(false, { ...base, niveau: "expert" });
    verifier(expert.every((n) => chezGemini.includes(n)) && expert.length < chezGemini.length,
        "le niveau Expert n'est plus un sous-ensemble du niveau Maître : les deux axes ne " +
        "s'intersectent plus, ils se contredisent");

    // L'audience retranche : rien de ce qu'une audience accorde ne dépasse
    // ce que le catalogue complet contient.
    const tous = new Set(gemini.TOOLS[0].functionDeclarations.map((f) => f.name));
    for (const id of Object.keys(AUDIENCES.AUDIENCES)) {
        const inconnus = AUDIENCES.outilsDe(id).filter((n) => !tous.has(n));
        verifier(!inconnus.length,
            `l'audience « ${id} » nomme un outil qui n'existe pas : ${inconnus.join(", ")}`);
    }

    // Et la valeur par défaut d'une audience ne dépasse jamais son plafond.
    for (const id of Object.keys(AUDIENCES.AUDIENCES)) {
        const plafond = new Set(AUDIENCES.outilsDe(id));
        const defaut = AUDIENCES.outilsSansNiveau(id);
        verifier(defaut.every((n) => plafond.has(n)),
            `l'audience « ${id} » accorde par défaut plus que son propre plafond`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LES VRAIES ROUTES DÉCLARENT UNE AUDIENCE CONNUE
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ SANS CE BLOC, TOUT CE QUI PRÉCÈDE NE MESURE QUE DES CONTEXTES ÉCRITS
// PAR MOI. C'est l'erreur d'instrument que ce projet m'a déjà servie deux
// fois : « la fonction sait traiter la valeur » ≠ « quelqu'un la pose ».
//
// Et depuis ce chantier, l'oubli n'est plus sans conséquence : une route
// sans audience tombe à ZÉRO outil. C'est le bon défaut pour la sécurité, et
// c'est une panne muette pour le produit. Il faut donc le voir ici.
{
    const RACINE = path.join(__dirname, "..");
    const FICHIERS = [
        "routes/telegram.js", "routes/webhook-whatsapp.js", "routes/auth-meta.js",
        "routes/api.js", "routes/admin.js", "routes/discussions.js",
        "routes/client-academie.js", "services/telegramCommunity.js",
    ];

    let appelsVus = 0;
    for (const f of FICHIERS) {
        const brut = fs.readFileSync(path.join(RACINE, f), "utf8");
        // On retire les commentaires AVANT de mesurer : une garde satisfaite
        // par sa propre explication ne garde rien.
        const code = brut.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

        // Chaque appel au planner doit porter une audience déclarée.
        const appels = code.match(/planner\.(ask|askFlux|build|buildFlux)\s*\(/g) || [];
        appelsVus += appels.length;

        const audiences = [...code.matchAll(/audience:\s*"([a-z_]+)"/g)].map((m) => m[1]);
        if (!appels.length) continue;

        verifier(audiences.length > 0,
            `${f} appelle le planner (${appels.length} fois) mais ne déclare AUCUNE audience : ` +
            "ce chemin repart désormais avec zéro outil, sans un mot");

        for (const a of audiences) {
            verifier(AUDIENCES.existe(a),
                `${f} déclare l'audience « ${a} », qui n'existe pas dans config/audiences.js — ` +
                "ce chemin n'a plus aucun outil");
        }
    }

    verifier(appelsVus >= 8,
        `seuls ${appelsVus} appels au planner ont été trouvés : la sonde ne lit plus les vraies ` +
        "routes, et ce bloc ne mesure rien");
}

// ── VERDICT ──────────────────────────────────────────────────────────────
if (echecs.length) {
    console.log(`\n❌ audiences : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
    echecs.forEach((e) => console.log(`   • ${e}`));
    process.exit(1);
}
console.log(`✅ audiences : ${verifs} vérifications passées`);
process.exit(0);
