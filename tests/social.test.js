// ==========================================================================
// LES AGENTS SOCIAUX — CE QU'ON VEUT GARDER VRAI
// ==========================================================================
//
// ── AUCUNE PUBLICATION RÉELLE ─────────────────────────────────────────────
//
// La toute première ligne exécutable de ce fichier efface
// `SOCIAL_PUBLICATION_REELLE`. Même lancée sur une machine où quelqu'un
// l'aurait posée, cette suite ne peut pas publier.
//
// ── CE QU'UNE DOUBLURE PEUT ET NE PEUT PAS PROUVER ────────────────────────
//
// La base est remplacée : ces tests prouvent qu'on DEMANDE la bonne chose,
// jamais que Postgres saurait répondre. C'est le contrôle « base neuve »
// (.github/workflows) qui prouve le second — la leçon de ce matin.
//
// Le moteur d'IA est remplacé aussi : on ne teste pas la qualité d'un texte
// écrit par Gemini, on teste que la chaîne le transporte correctement et
// qu'elle refuse ce qui doit l'être.

process.env.SOCIAL_PUBLICATION_REELLE = "";
process.env.SOCIAL_MODE = "MANUAL";
process.env.SOCIAL_AUTO_CONFIRME = "";
process.env.SOCIAL_AGENTS_COUPES = "";
process.env.SOCIAL_PLATEFORMES_COUPEES = "";
process.env.SOCIAL_MOCK_ECHEC = "";

const assert = require("assert");
const path = require("path");

let passees = 0;
function verifier(condition, quoi) {
    assert.ok(condition, quoi);
    passees++;
}

// ── LA DOUBLURE DE BASE ───────────────────────────────────────────────────
//
// Elle ne joue pas au SQL : elle enregistre ce qu'on lui demande et rend ce
// qu'on lui a dit de rendre. Les tests inspectent ensuite les requêtes
// reçues — c'est ce qui permet de vérifier le cloisonnement par communauté
// sans base réelle.
const dbChemin = require.resolve("../services/db");
const requetes = [];
let reponses = [];
require.cache[dbChemin] = {
    id: dbChemin, filename: dbChemin, loaded: true,
    exports: {
        query: async (texte, params) => {
            requetes.push({ texte, params });
            const suivante = reponses.shift();
            if (suivante instanceof Error) throw suivante;
            return suivante === undefined ? [] : suivante;
        },
        pool: {}, transaction: async (fn) => fn({ query: async () => [] }),
        SSL: false, EST_LOCAL: true,
    },
};
function prevoir(...r) { reponses = r; }

// ── LA DOUBLURE DU MOTEUR D'IA ────────────────────────────────────────────
const geminiChemin = require.resolve("../services/geminiService");
let reponseIA = "";
require.cache[geminiChemin] = {
    id: geminiChemin, filename: geminiChemin, loaded: true,
    exports: {
        chat: async () => ({ type: "text", text: reponseIA }),
        TOOLS: [], etat: () => ({}), sonder: async () => ({}),
    },
};

const store = require("../services/socialStore");
const plateformes = require("../config/plateformes-sociales");
const providers = require("../engines/social/providers");
const mock = require("../engines/social/providers/mock");
const reviewer = require("../engines/social/agents/reviewer");
const social = require("../engines/social");

(async () => {
// ══════════════════════════════════════════════════════════════════════════
console.log("\n── Le registre des plateformes ──");
{
    verifier(plateformes.liste().length === 7, "les 7 plateformes de la V1 sont déclarées");
    verifier(plateformes.get("instagram").mediaRequis === true, "Instagram exige un visuel");
    verifier(plateformes.get("tiktok").mediaAccepte.join() === "video", "TikTok n'accepte que de la vidéo");
    verifier(plateformes.get("whatsapp").genre === "message", "WhatsApp est une messagerie, pas un fil");
    verifier(plateformes.get("facebook").genre === "fil", "Facebook est un fil");
    // Facebook, Instagram, TikTok, LinkedIn, Telegram publient sur un fil ;
    // WhatsApp et Messenger écrivent à quelqu'un. C'est la distinction qui
    // évite qu'un agent traite WhatsApp comme un mur public.
    verifier(plateformes.lesFils().length === 5, "5 fils publics");
    verifier(plateformes.lesMessageries().length === 2, "2 messageries : WhatsApp et Messenger");
    verifier(plateformes.lesMessageries().map((p) => p.slug).sort().join() === "messenger,whatsapp",
             "et ce sont bien celles-là");

    // Couper une plateforme depuis l'environnement, sans déploiement.
    process.env.SOCIAL_PLATEFORMES_COUPEES = "tiktok";
    verifier(plateformes.estCoupee("tiktok"), "TikTok se coupe par variable d'environnement");
    verifier(!plateformes.estCoupee("facebook"), "et couper TikTok ne coupe pas Facebook");
    verifier(!plateformes.listeActives().some((p) => p.slug === "tiktok"), "elle disparaît des plateformes actives");
    process.env.SOCIAL_PLATEFORMES_COUPEES = "";
}

console.log("── Aucune publication réelle par défaut ──");
{
    verifier(providers.publicationReelleAutorisee() === false,
             "sans SOCIAL_PUBLICATION_REELLE=oui, aucune publication réelle");
    // Le point qui compte : même pour une plateforme RÉELLEMENT branchée.
    const { provider } = providers.pour("telegram");
    verifier(provider.nom === "mock", "Telegram, pourtant branché, passe par la simulation");
    const { provider: fb } = providers.pour("facebook");
    verifier(fb.nom === "mock", "Facebook aussi");

    // Et la mise à l'épreuve : le contrôle sait-il dire l'inverse ?
    process.env.SOCIAL_PUBLICATION_REELLE = "oui";
    verifier(providers.pour("telegram").provider.nom === "telegram",
             "avec la bascule, c'est le vrai provider Telegram qui est choisi");
    process.env.SOCIAL_PUBLICATION_REELLE = "";
    verifier(providers.pour("telegram").provider.nom === "mock", "et on revient à la simulation");
}

console.log("── Publication simulée ──");
{
    mock.vider();
    const r = await (providers.publier({ plateforme: "telegram", texte: "Un message d'essai suffisamment long." }));
    verifier(r.ok === true, "la publication simulée réussit");
    verifier(r.simulation === true, "et elle est marquée comme simulation");
    verifier(String(r.id).startsWith("sim_"), "son identifiant dit qu'elle est simulée — impossible à confondre");
    verifier(mock.journal.length === 1, "le mock a bien gardé trace");
}

console.log("── Erreur de plateforme, et isolement ──");
{
    mock.vider();
    const rate = await (providers.publier({ plateforme: "instagram", texte: "ECHEC_SIMULE contenu de test assez long." }));
    verifier(rate.ok === false, "un échec demandé échoue vraiment");
    verifier(!!rate.erreur, "et il porte un motif");

    // Une plateforme en panne ne doit pas emporter les autres.
    process.env.SOCIAL_MOCK_ECHEC = "instagram";
    const ig = await (providers.publier({ plateforme: "instagram", texte: "Contenu normal et assez long pour passer." }));
    const tg = await (providers.publier({ plateforme: "telegram", texte: "Contenu normal et assez long pour passer." }));
    verifier(ig.ok === false, "Instagram tombe");
    verifier(tg.ok === true, "Telegram passe quand même — les plateformes sont isolées");
    process.env.SOCIAL_MOCK_ECHEC = "";
}

console.log("── Une plateforme coupée ne publie pas ──");
{
    process.env.SOCIAL_PLATEFORMES_COUPEES = "linkedin";
    const r = await (providers.publier({ plateforme: "linkedin", texte: "Un contenu parfaitement valide et long." }));
    verifier(r.ok === false, "une plateforme coupée refuse");
    verifier(/coup/i.test(r.erreur), "et le motif dit qu'elle est coupée : " + r.erreur);
    process.env.SOCIAL_PLATEFORMES_COUPEES = "";
}

console.log("── Le relecteur : ce qu'il BLOQUE ──");
{
    const c = reviewer.controlerMecanique;
    // Un vrai texte, pas une chaîne de « x ». La première version de ce test
    // utilisait "x".repeat(300) — qui contient « xxx » et déclenchait le
    // détecteur de marqueurs. Le test faux avait révélé un vrai défaut du
    // code (voir reviewer.js), mais un test doit ressembler à la réalité.
    const LEGENDE = "Nos marchands de Douala reçoivent leurs commandes en direct sur leur QG. "
                  + "Plus besoin de recopier un numero a la main le soir. ";
    verifier(c({ plateforme: "facebook", texte: "" }).bloquants.length > 0, "texte vide → bloqué");
    verifier(c({ plateforme: "facebook", texte: "trop court" }).bloquants.length > 0, "texte de 10 signes → bloqué");
    verifier(c({ plateforme: "instagram", texte: LEGENDE }).bloquants.some((b) => /visuel/i.test(b)),
             "Instagram sans image → bloqué, et le motif nomme le visuel");
    verifier(c({ plateforme: "instagram", texte: LEGENDE, mediaUrl: "http://img" }).bloquants.length === 0,
             "Instagram AVEC image → passe");
    verifier(c({ plateforme: "instagram", texte: LEGENDE.repeat(20), mediaUrl: "i" }).bloquants.some((b) => /2200/.test(b)),
             "au-delà de 2200 signes sur Instagram → bloqué");
    verifier(c({ plateforme: "whatsapp", texte: "Bonjour, voici notre offre du jour.", hashtags: "#promo" }).bloquants.length > 0,
             "un hashtag sur WhatsApp → bloqué");
    verifier(c({ plateforme: "facebook", texte: "Voici notre offre [PRODUIT] du jour, à ne pas manquer." })
                .bloquants.some((b) => /marqueur/i.test(b)),
             "un marqueur [PRODUIT] non remplacé → bloqué");

    // Et la mise à l'épreuve : sait-il approuver ?
    const bon = c({ plateforme: "facebook", texte: LEGENDE.repeat(4), cta: "Écris-nous", hashtags: "#a #b" });
    verifier(bon.bloquants.length === 0, "un contenu correct n'est PAS bloqué");

    // Remarque ≠ blocage : la distinction qui empêche SAMII de censurer.
    const court = c({ plateforme: "facebook", texte: LEGENDE.slice(0, 100) });
    verifier(court.bloquants.length === 0 && court.remarques.length > 0,
             "plus court que visé : c'est une remarque, pas un blocage");
}

console.log("── L'empreinte anti-doublon ──");
{
    const a = store.empreinte("Livraison gratuite cette semaine !");
    const b = store.empreinte("livraison   gratuite cette semaine !!!");
    const c = store.empreinte("Livraison payante cette semaine !");
    verifier(a === b, "deux textes qui ne diffèrent que par la forme ont la même empreinte");
    verifier(a !== c, "deux textes différents ont des empreintes différentes");
    verifier(store.empreinte("") === null, "un texte vide n'a pas d'empreinte");
    verifier(store.empreinte("Été à Douala") === store.empreinte("ete a douala"),
             "les accents ne créent pas de faux doublons");
}

console.log("── Les modes ──");
{
    process.env.SOCIAL_MODE = "MANUAL";
    verifier(social.mode() === "MANUAL", "MANUAL par défaut");

    process.env.SOCIAL_MODE = "SEMI_AUTO";
    verifier(social.mode() === "SEMI_AUTO", "SEMI_AUTO s'active par la variable");

    // LE point : AUTO ne s'active pas tout seul.
    process.env.SOCIAL_MODE = "AUTO";
    process.env.SOCIAL_AUTO_CONFIRME = "";
    verifier(social.mode() === "SEMI_AUTO",
             "AUTO demandé SANS confirmation → retombe sur SEMI_AUTO, rien ne part seul");

    process.env.SOCIAL_AUTO_CONFIRME = "oui";
    verifier(social.mode() === "AUTO", "AUTO n'est atteint qu'avec les DEUX verrous");

    process.env.SOCIAL_MODE = "n_importe_quoi";
    process.env.SOCIAL_AUTO_CONFIRME = "";
    verifier(social.mode() === "MANUAL", "un mode inconnu retombe sur le plus prudent");
    process.env.SOCIAL_MODE = "MANUAL";
}

console.log("── Couper un agent ──");
{
    const base = require("../engines/social/agents/base");
    process.env.SOCIAL_AGENTS_COUPES = "creator,publisher";
    verifier(base.estCoupe("creator"), "le créateur se coupe");
    verifier(base.estCoupe("publisher"), "le publieur aussi");
    verifier(!base.estCoupe("reviewer"), "et le relecteur reste debout");

    prevoir([]);   // la trace, si elle était appelée
    const r = await (base.executer("creator", {}, async () => ({ jamais: true })));
    verifier(r.ok === false && r.coupe === true, "un agent coupé ne s'exécute pas");
    process.env.SOCIAL_AGENTS_COUPES = "";
}

console.log("── La trace ne fuit aucun secret ──");
{
    const base = require("../engines/social/agents/base");
    const propre = base.resumerPourLaTrace({
        texte: "un contenu",
        accessToken: "EAAG-un-vrai-jeton-meta",
        api_key: "sk-secret",
        password: "motdepasse",
        variantes: [1, 2, 3],
    });
    verifier(propre.accessToken === "[masqué]", "un jeton d'accès est masqué dans la trace");
    verifier(propre.api_key === "[masqué]", "une clé d'API est masquée");
    verifier(propre.password === "[masqué]", "un mot de passe est masqué");
    verifier(propre.texte === "un contenu", "le contenu utile, lui, est conservé");
    verifier(propre.variantes === "[3 éléments]", "les gros tableaux sont résumés, pas recopiés");
}

console.log("── Le cloisonnement par communauté ──");
{
    requetes.length = 0;
    prevoir([]);
    await (store.listerPosts({ communaute: "coindudigital" }));
    const q = requetes[requetes.length - 1];
    verifier(/communaute/i.test(q.texte), "lister les posts filtre par communauté");
    verifier(q.params.includes("coindudigital"), "et c'est bien SA communauté qui est passée");

    requetes.length = 0;
    prevoir([]);
    await (store.listerPublications({ communaute: "coindudigital" }));
    verifier(/communaute/i.test(requetes[0].texte), "lister les publications filtre aussi");
}

console.log("── Les statuts sont écrits une seule fois ──");
{
    const attendus = ["draft", "review", "approved", "scheduled", "publishing", "published", "failed", "cancelled"];
    verifier(store.STATUTS.join() === attendus.join(), "les 8 statuts demandés, dans l'ordre");
    verifier(store.statutValide("published"), "un statut connu est accepté");
    verifier(!store.statutValide("publié"), "un statut inventé est refusé");
    let leve = false;
    try { await (store.majStatutPost(1, "n_importe_quoi")); } catch { leve = true; }
    verifier(leve, "écrire un statut inconnu lève au lieu de l'enregistrer");
}

console.log("── Le publieur refuse ce qui n'est pas approuvé ──");
{
    const publisher = require("../engines/social/agents/publisher");
    // La variante existe mais est en 'review' : le relecteur ne l'a pas
    // approuvée. La publier viderait le relecteur de son sens.
    prevoir([{ id: 7, statut: "review", plateforme: "facebook" }], []);
    const r = await (publisher.programmer({ workspaceId: "w1", variantId: 7, plateforme: "facebook" }));
    verifier(r.ok === false, "programmer une variante non approuvée échoue");
    verifier(/approuv/i.test(r.erreur), "et le motif le dit : " + r.erreur);
}

console.log("── WhatsApp refuse d'être traité comme un fil ──");
{
    const wa = require("../engines/social/providers/whatsapp");
    const r = await (wa.publier({ texte: "Bonjour, voici notre offre.", workspaceId: "w1" }));
    verifier(r.ok === false, "sans destinataires, WhatsApp refuse");
    verifier(/destinataire/i.test(r.erreur), "et explique pourquoi : " + r.erreur.slice(0, 60));

    const trop = await (wa.publier({
        texte: "Bonjour.", workspaceId: "w1",
        destinataires: Array.from({ length: 50 }, (_, i) => "+2376000000" + i),
    }));
    verifier(trop.ok === false, "50 destinataires : refusé");
    verifier(/bannir/i.test(trop.erreur), "et le motif dit le vrai risque — le numéro banni");
}

console.log("── L'apprentissage refuse de conclure sans données ──");
{
    const learning = require("../engines/social/agents/learning");
    // Zéro relevé réel.
    prevoir([{ publications_reelles: 0, releves: 0, plateformes: 0 }], []);
    const r = await (learning.apprendre({ workspaceId: "w1" }));
    verifier(r.pretAApprendre === false, "sans relevé réel, il ne prétend rien avoir appris");
    verifier(r.enseignements.length === 0, "et il ne produit AUCUN enseignement");
    verifier(/simulation|relevé/i.test(r.raison), "il dit pourquoi : " + r.raison.slice(0, 70));

    // Sous le seuil, mais pas à zéro : il refuse toujours.
    prevoir([{ publications_reelles: 3, releves: 3, plateformes: 1 }], []);
    const r2 = await (learning.apprendre({ workspaceId: "w1" }));
    verifier(r2.pretAApprendre === false, "3 relevés pour 5 requis : toujours pas d'enseignement");
}

console.log("── L'analyste n'invente pas de statistiques ──");
{
    const analytics = require("../engines/social/agents/analytics");
    const couv = analytics.couverture();
    verifier(couv.length === 7, "la couverture est dite pour les 7 plateformes");
    verifier(couv.every((c) => c.collecteur === false), "aucun collecteur n'existe encore — c'est la vérité d'aujourd'hui");
    verifier(couv.every((c) => !!c.raison), "et chacune dit POURQUOI elle n'en a pas");

    // Une publication simulée n'a pas de statistiques à collecter.
    prevoir([{ id: 1, statut: "published", provider: "mock", plateforme: "telegram" }], []);
    const r = await (analytics.collecter({ publicationId: 1 }));
    verifier(r.disponible === false, "on ne collecte rien sur une publication simulée");
    verifier(/simul/i.test(r.raison), "et le motif le dit : " + r.raison);

    // Sans relevé, aucune recommandation n'est fondée.
    prevoir([], []);
    const cmp = await (analytics.comparer({}));
    verifier(cmp.fiable === false, "sans relevé, l'analyse se déclare NON fiable");
    verifier(/aucune recommandation/i.test(cmp.recommandation), "et refuse de recommander : " + cmp.recommandation);
}


console.log("── Buffer : le provider qui publie vraiment ──");
{
    const buffer = require("../engines/social/providers/buffer");
    const ancien = process.env.BUFFER_ACCESS_TOKEN;

    process.env.BUFFER_ACCESS_TOKEN = "";
    verifier(buffer.configure() === false, "sans jeton, Buffer se déclare non configuré");
    const r = await buffer.publier({ plateforme: "facebook", texte: "Un contenu assez long pour passer." });
    verifier(r.ok === false, "et il refuse de publier");
    verifier(/BUFFER_ACCESS_TOKEN/.test(r.erreur), "en nommant la variable manquante");

    process.env.BUFFER_ACCESS_TOKEN = "un-jeton-de-controle-suffisamment-long";
    verifier(buffer.configure() === true, "avec un jeton, il se déclare configuré");
    process.env.BUFFER_ACCESS_TOKEN = ancien || "";
    buffer.oublier();

    verifier(buffer.plateformes.join() === "facebook,instagram,linkedin,tiktok",
             "Buffer couvre les 4 plateformes qu'il sait servir");
    verifier(!buffer.plateformes.includes("telegram") && !buffer.plateformes.includes("whatsapp"),
             "et PAS Telegram ni WhatsApp — SAMII les fait elle-même");
}

console.log("── Buffer passe devant Meta, et Meta reprend si Buffer part ──");
{
    const ancien = process.env.BUFFER_ACCESS_TOKEN;
    process.env.SOCIAL_PUBLICATION_REELLE = "oui";

    // Meta en direct n'a pas `pages_manage_posts` : Buffer doit gagner.
    process.env.BUFFER_ACCESS_TOKEN = "un-jeton-de-controle-suffisamment-long";
    verifier(providers.pour("facebook").provider.nom === "buffer",
             "Facebook passe par Buffer quand il est configuré");
    verifier(providers.pour("instagram").provider.nom === "buffer", "Instagram aussi");

    // Et le repli : retirer le jeton doit rendre la main à Meta, sans
    // toucher au code.
    process.env.BUFFER_ACCESS_TOKEN = "";
    verifier(providers.pour("facebook").provider.nom === "meta",
             "sans Buffer, Meta reprend la main tout seul");
    verifier(/buffer non configur/i.test(providers.pour("facebook").raison || ""),
             "et l'écran dit pourquoi : " + providers.pour("facebook").raison);

    // LinkedIn n'a QUE Buffer : sans lui, c'est la simulation, pas un échec.
    verifier(providers.pour("linkedin").provider.nom === "mock",
             "LinkedIn sans Buffer retombe en simulation");

    process.env.BUFFER_ACCESS_TOKEN = ancien || "";
    process.env.SOCIAL_PUBLICATION_REELLE = "";
}

console.log("── WhatsApp : d'où vient la liste ──");
{
    const wa = require("../engines/social/providers/whatsapp");
    const ancien = process.env.WHATSAPP_DIFFUSION;

    process.env.WHATSAPP_DIFFUSION = "";
    const vide = await wa.resoudreDestinataires({ workspaceId: null });
    verifier(vide.liste.length === 0, "sans source, aucune liste");

    // Doublons et bruit : une cliente ne doit pas recevoir deux fois.
    process.env.WHATSAPP_DIFFUSION = "+237 600 000 001, +237600000001 , +237600000002, 12";
    const depuisEnv = await wa.resoudreDestinataires({ workspaceId: null });
    verifier(depuisEnv.liste.length === 2, "les doublons sont retirés");
    verifier(!depuisEnv.liste.includes("12"), "et ce qui n'est pas un numéro est écarté");
    verifier(depuisEnv.source === "WHATSAPP_DIFFUSION", "la source est nommée");

    // Ce qu'on demande l'emporte sur ce qui est enregistré.
    const depuisAppel = await wa.resoudreDestinataires({ destinataires: ["+237699999999"], workspaceId: null });
    verifier(depuisAppel.source === "appel", "l'appel l'emporte sur la variable");
    verifier(depuisAppel.liste.join() === "+237699999999", "et c'est bien SON numéro");

    // Le plafond, qui n'est PAS réglable.
    process.env.WHATSAPP_DIFFUSION = Array.from({ length: 50 }, (_, i) => "+23760000" + String(i).padStart(4, "0")).join(",");
    const trop = await wa.publier({ texte: "Bonjour, une offre du jour." });
    verifier(trop.ok === false, "50 destinataires : refusé");
    verifier(/bannir/.test(trop.erreur), "et le motif dit le vrai risque");
    verifier(wa.MAX_DESTINATAIRES === 20, "le plafond est de 20, écrit en dur");

    process.env.WHATSAPP_DIFFUSION = ancien || "";
}

console.log("── Le mode MANUAL bloque la programmation ──");
{
    process.env.SOCIAL_MODE = "MANUAL";
    const r = await (social.programmer({ postId: 1, workspaceId: "w1" }));
    verifier(r.ok === false, "en MANUAL, programmer sans validation humaine est refusé");
    verifier(/MANUAL/.test(r.erreur), "et le motif nomme le mode : " + r.erreur.slice(0, 60));
}

console.log(`\n✅ social : ${passees} vérifications passées`);
})().catch((e) => {
    console.error("\n❌ social :", e.message);
    process.exit(1);
});
