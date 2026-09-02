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
    // Cette ligne affirmait « aucun collecteur n'existe encore ». C'était
    // vrai, et ça ne l'est plus : Facebook, Instagram et LinkedIn en ont un.
    // Le test a crié au moment où le fait a changé — c'est exactement son
    // travail, et la ligne suit la réalité au lieu de la figer.
    verifier(couv.filter((c) => c.collecteur).map((c) => c.slug).sort().join() === "facebook,instagram,linkedin",
             "trois plateformes sont mesurables : " + couv.filter((c) => c.collecteur).map((c) => c.slug).join(", "));
    verifier(couv.filter((c) => !c.collecteur).length === 4,
             "les quatre autres ne le sont pas, et chacune dit pourquoi");
    // Celles QUI N'EN ONT PAS doivent dire pourquoi. Celles qui en ont un
    // n'ont rien à expliquer — exiger une raison partout obligerait à en
    // inventer une là où il n'y a pas de problème.
    verifier(couv.filter((c) => !c.collecteur).every((c) => !!c.raison),
             "chaque plateforme NON mesurable dit pourquoi elle ne l'est pas");
    verifier(couv.filter((c) => c.collecteur).every((c) => !c.raison),
             "et celles qui sont mesurables n'affichent aucun motif d'excuse");

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

console.log("── BUFFER_PLATEFORMES : qui Buffer a le droit de servir ──");
{
    // « fb en utilise api meta, whatsapp aussi, telegram — on a tout ça.
    //   Ne mélange pas. Buffer gère que insta. »
    //
    // Deux chemins vers la même page Facebook, c'est le jour où l'on publie
    // deux fois sans comprendre pourquoi. Cette variable tranche depuis
    // Render, sans toucher au code.
    const buffer = require("../engines/social/providers/buffer");
    const ancien = process.env.BUFFER_PLATEFORMES;
    const ancienJeton = process.env.BUFFER_ACCESS_TOKEN;

    // Non posée : couverture complète. Un défaut qui RESTREINDRAIT en
    // silence ferait chercher une heure pourquoi une plateforme ne part pas.
    delete process.env.BUFFER_PLATEFORMES;
    verifier(buffer.plateformesAutorisees().join() === "facebook,instagram,linkedin,tiktok",
             "non posée, Buffer garde ses 4 plateformes");

    process.env.BUFFER_PLATEFORMES = "instagram";
    verifier(buffer.plateformesAutorisees().join() === "instagram",
             "posée à instagram, il ne sert plus qu'Instagram");

    // Écarté n'est PAS échoué : Facebook doit continuer vers Meta.
    process.env.BUFFER_ACCESS_TOKEN = "un-jeton-de-controle-suffisamment-long";
    buffer.oublier();
    const fb = await buffer.chainesPour("facebook");
    verifier(fb.ok === false, "Facebook n'est plus servi par Buffer");
    verifier(fb.passeLaMain === true,
             "mais c'est un CHOIX, pas un échec : il passe la main à Meta");
    verifier(/BUFFER_PLATEFORMES/.test(fb.erreur),
             "et l'erreur nomme la variable qui décide : " + fb.erreur);

    // Les espaces, la casse et une valeur inconnue ne doivent pas faire
    // tomber la publication de tout le monde.
    process.env.BUFFER_PLATEFORMES = " INSTAGRAM , mastodon ";
    verifier(buffer.plateformesAutorisees().join() === "instagram",
             "espaces et casse absorbés, une plateforme inconnue ignorée");

    // ── L'ÉCRAN NE DOIT PAS MENTIR SUR LE CHEMIN ─────────────────────────
    //
    // Trouvé en ouvrant la vraie page /social : elle annonçait
    // « facebook → buffer » alors que Buffer refusait Facebook et passait la
    // main à Meta. `configure()` répond « ai-je mon jeton », pas « vais-je
    // traiter Facebook » — il fallait la seconde question.
    process.env.SOCIAL_PUBLICATION_REELLE = "oui";
    process.env.BUFFER_PLATEFORMES = "instagram";
    verifier(providers.pour("facebook").provider.nom === "meta",
             "Facebook écarté de Buffer : le registre désigne Meta, pas Buffer");
    verifier(providers.pour("instagram").provider.nom === "buffer",
             "Instagram reste chez Buffer");
    // ── ET SURTOUT : PAS DE PUBLICATION FANTÔME ──────────────────────────
    //
    // LinkedIn n'a plus aucun chemin. Retomber sur le mock aurait écrit
    // `statut = 'published'` pour un contenu qui n'est jamais parti — un
    // mensonge en base, découvert des semaines plus tard.
    verifier(providers.pour("linkedin").provider === null,
             "LinkedIn n'a plus aucun chemin : AUCUN provider, pas un mock");
    verifier(/BUFFER_PLATEFORMES/.test(providers.pour("linkedin").raison || ""),
             "le motif distingue « écarté exprès » de « non configuré » : "
             + providers.pour("linkedin").raison);
    const fantome = await providers.publier({
        plateforme: "linkedin", workspaceId: "w1", texte: "Un contenu professionnel assez long.",
    });
    verifier(fantome.ok === false, "et publier() ÉCHOUE au lieu de se déclarer publié");
    verifier(/rien n'a été publié/.test(fantome.erreur), "en le disant : " + fantome.erreur);

    // Et l'écran doit pouvoir le montrer plateforme par plateforme.
    const fbEtat = providers.etat().plateformes.find((p) => p.slug === "facebook");
    const bufferSurFb = fbEtat.providersReels.find((x) => x.nom === "buffer");
    verifier(bufferSurFb.configure === true && bufferSurFb.sert === false,
             "l'état dit « Buffer configuré, mais ne sert pas Facebook »");
    process.env.SOCIAL_PUBLICATION_REELLE = "";

    // Le refus doit être PUREMENT LOCAL : décidé avant le moindre appel
    // réseau. Sinon une panne de Buffer changerait la réponse à « est-ce que
    // Facebook passe par Buffer ? », qui ne dépend que de nous.
    //
    // C'est prouvé en pointant l'adresse sur un port fermé : si un appel
    // partait, il échouerait, et `passeLaMain` disparaîtrait.
    const ancienneAdresse = process.env.BUFFER_ADRESSE;
    process.env.BUFFER_ADRESSE = "http://127.0.0.1:1";   // personne n'écoute
    delete require.cache[require.resolve("../engines/social/providers/buffer")];
    const horsLigne = require("../engines/social/providers/buffer");
    process.env.BUFFER_PLATEFORMES = "instagram";
    process.env.BUFFER_ACCESS_TOKEN = "un-jeton-de-controle-suffisamment-long";
    const sansReseau = await horsLigne.chainesPour("facebook");
    verifier(sansReseau.passeLaMain === true,
             "Buffer injoignable : Facebook passe quand même la main à Meta");

    // Et quand Buffer est vraiment injoignable, l'écran le dit sans jamais
    // recopier le jeton dans le message d'erreur.
    const e = await horsLigne.etat();
    verifier(e.joignable === false, "l'état dit que Buffer est injoignable");
    verifier(!JSON.stringify(e).includes("un-jeton-de-controle"),
             "et le jeton ne fuit pas dans le message d'erreur : " + String(e.raison).slice(0, 70));

    if (ancienneAdresse === undefined) delete process.env.BUFFER_ADRESSE;
    else process.env.BUFFER_ADRESSE = ancienneAdresse;
    delete require.cache[require.resolve("../engines/social/providers/buffer")];

    if (ancien === undefined) delete process.env.BUFFER_PLATEFORMES;
    else process.env.BUFFER_PLATEFORMES = ancien;
    process.env.BUFFER_ACCESS_TOKEN = ancienJeton || "";
    buffer.oublier();
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

    // LinkedIn n'a QUE Buffer : sans lui, il n'y a plus de chemin du tout.
    // La publication réelle étant demandée, on refuse — on ne simule pas.
    verifier(providers.pour("linkedin").provider === null,
             "LinkedIn sans Buffer : aucun chemin, et la simulation n'est pas un repli");
    verifier(/buffer non configuré/.test(providers.pour("linkedin").raison || ""),
             "et le motif nomme le jeton manquant : " + providers.pour("linkedin").raison);

    process.env.BUFFER_ACCESS_TOKEN = ancien || "";
    process.env.SOCIAL_PUBLICATION_REELLE = "";
}


console.log("── Un provider qui ne sert pas une plateforme passe la main ──");
{
    // Vu sur le vrai compte Buffer d'OG Technology : 3 chaînes (LinkedIn
    // page, LinkedIn profil, Instagram), plan gratuit plafonné à 3, et
    // AUCUN Facebook. Buffer est donc configuré mais incapable de servir
    // Facebook — et sans la passe de main, Meta n'avait jamais sa chance.
    process.env.SOCIAL_PUBLICATION_REELLE = "oui";
    const ancien = process.env.BUFFER_ACCESS_TOKEN;
    process.env.BUFFER_ACCESS_TOKEN = "";   // Buffer écarté : non configuré

    // TikTok n'a que Buffer aujourd'hui. On ajoute derrière lui un provider
    // qui passe la main, puis un qui publie.
    let passeAppele = false, prendAppele = false;
    providers.enregistrer({
        nom: "passe", plateformes: ["tiktok"], configure: () => true,
        publier: async () => { passeAppele = true; return { ok: false, passeLaMain: true, erreur: "pas ma plateforme" }; },
    });
    providers.enregistrer({
        nom: "prend", plateformes: ["tiktok"], configure: () => true,
        publier: async () => { prendAppele = true; return { ok: true, id: "ok_tiktok" }; },
    });

    const r = await providers.publier({ plateforme: "tiktok", texte: "Un contenu assez long pour passer." });
    verifier(passeAppele, "le premier provider a bien été essayé");
    verifier(r.ok === true, "le second reprend quand le premier passe la main");
    verifier(prendAppele && r.provider === "prend", "et c'est lui qui a publié", r.provider);

    // ── LE POINT INVERSE, TOUT AUSSI IMPORTANT ───────────────────────────
    //
    // Un VRAI échec ne doit PAS faire essayer le suivant : republier chez
    // le voisin, c'est le même contenu deux fois.
    //
    // Messenger a déjà `meta` en tête, et meta échoue sans passer la main
    // (« workspaceId manquant »). Le provider ajouté derrière ne doit donc
    // jamais être appelé.
    let jamaisAppele = false;
    providers.enregistrer({
        nom: "jamais", plateformes: ["messenger"], configure: () => true,
        publier: async () => { jamaisAppele = true; return { ok: true, id: "ne_devrait_pas_arriver" }; },
    });
    const r2 = await providers.publier({ plateforme: "messenger", texte: "Un contenu assez long pour passer." });
    verifier(r2.ok === false, "un vrai échec reste un échec");
    verifier(jamaisAppele === false, "et le provider suivant n'est PAS appelé — pas de double publication");
    verifier(!/ne_devrait_pas_arriver/.test(JSON.stringify(r2)), "rien n'a été publié en douce");

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

console.log("── Les formats : reel, post, photo ──");
{
    const formats = require("../config/formats-sociaux");

    // Un reel EXIGE une vidéo. Ce n'est pas une préférence de style : sans
    // elle, la plateforme refuse.
    verifier(formats.mediaExige("reel") === "video", "un reel exige une vidéo");
    verifier(formats.mediaExige("post") === null, "un post n'exige rien");
    verifier(formats.mediaConvient("reel", "image").ok === false,
             "une image ne fait pas un reel : " + formats.mediaConvient("reel", "image").raison);
    verifier(formats.mediaConvient("reel", "video").ok === true, "une vidéo, oui");

    // Le choix automatique : c'est CETTE fonction que le cycle appelle, et
    // c'est le seul endroit où « quel format » se décide.
    verifier(formats.choisir({ plateforme: "instagram", mediaType: "video" }).format === "reel",
             "Instagram + une vidéo → un reel");
    verifier(formats.choisir({ plateforme: "instagram", mediaType: "image" }).format === "photo",
             "Instagram + une image → une photo");
    verifier(formats.choisir({ plateforme: "instagram" }).ok === false,
             "Instagram sans média → refus (la plateforme l'exige)");
    verifier(formats.choisir({ plateforme: "linkedin" }).format === "post",
             "LinkedIn sans média → un post, c'est permis");

    // Un format qu'on ne sait pas transporter ne doit jamais être choisi :
    // le préparer produirait un contenu qui échoue à la dernière étape.
    verifier(formats.publiable("story") === false, "on ne sait pas encore envoyer une story");
    verifier(formats.pourPlateforme("instagram").includes("story"),
             "elle est pourtant déclarée sur Instagram — les deux notions sont distinctes");
    verifier(formats.choisir({ plateforme: "instagram", mediaType: "image" }).format !== "story",
             "et le choix automatique ne la retient donc jamais");

    // Couper un format depuis Render, sans déploiement.
    process.env.SOCIAL_FORMATS_COUPES = "reel";
    verifier(formats.estCoupe("reel"), "un format se coupe par variable d'environnement");
    verifier(formats.choisir({ plateforme: "instagram", mediaType: "video" }).ok === false,
             "reels coupés : une vidéo ne trouve plus de format sur Instagram");
    process.env.SOCIAL_FORMATS_COUPES = "";
    verifier(formats.choisir({ plateforme: "instagram", mediaType: "video" }).format === "reel",
             "et ils reviennent dès qu'on découpe");
}

console.log("── Buffer : une vidéo ne part pas dans imageUrl ──");
{
    // Envoyer l'URL d'un .mp4 dans `imageUrl` est la façon la plus simple
    // de faire échouer un reel, avec un message d'erreur qui ne parle même
    // pas de vidéo. Vérifié sur la requête réellement formée.
    // Vérifié sur la requête RÉELLEMENT formée, contre un serveur local qui
    // parle le GraphQL de Buffer. Regarder le texte source aurait prouvé
    // que le code est écrit, pas qu'il envoie la bonne chose.
    const http = require("http");
    const recu = [];
    const faux = http.createServer((req, res) => {
        let corps = "";
        req.on("data", (c) => { corps += c; });
        req.on("end", () => {
            let q = {}; try { q = JSON.parse(corps); } catch { /* illisible */ }
            recu.push(q);
            const t = String(q.query || "");
            res.writeHead(200, { "Content-Type": "application/json" });
            if (/organizations/.test(t)) return res.end(JSON.stringify({ data: { account: { organizations: [{ id: "o1", name: "Essai" }] } } }));
            if (/channels/.test(t)) return res.end(JSON.stringify({ data: { channels: [{ id: "c_ig", name: "insta", service: "instagram" }] } }));
            res.end(JSON.stringify({ data: { createPost: { post: { id: "p1", text: "ok" } } } }));
        });
    });
    await new Promise((r) => faux.listen(0, "127.0.0.1", r));

    const port = faux.address().port;
    const ancienne = { adr: process.env.BUFFER_ADRESSE, jeton: process.env.BUFFER_ACCESS_TOKEN, pf: process.env.BUFFER_PLATEFORMES };
    process.env.BUFFER_ADRESSE = `http://127.0.0.1:${port}`;
    process.env.BUFFER_ACCESS_TOKEN = "un-jeton-de-controle-suffisamment-long";
    process.env.BUFFER_PLATEFORMES = "instagram";
    delete require.cache[require.resolve("../engines/social/providers/buffer")];
    const buffer = require("../engines/social/providers/buffer");

    const envois = () => recu.filter((q) => /createPost/.test(String(q.query || ""))).map((q) => q.variables.input);

    await buffer.publier({ plateforme: "instagram", texte: "Une légende de reel.", media: "https://x.test/v.mp4", mediaType: "video" });
    let dernier = envois().pop();
    verifier(dernier.videoUrl === "https://x.test/v.mp4", "une vidéo part dans videoUrl");
    verifier(!dernier.imageUrl, "et surtout PAS dans imageUrl — c'est ce qui casse un reel");

    await buffer.publier({ plateforme: "instagram", texte: "Une légende de photo.", media: "https://x.test/p.jpg", mediaType: "image" });
    dernier = envois().pop();
    verifier(dernier.imageUrl === "https://x.test/p.jpg" && !dernier.videoUrl, "une image part dans imageUrl");

    // Personne ne déclare le type : l'extension tranche. Imparfait, mais
    // très supérieur à « tout est une image ».
    await buffer.publier({ plateforme: "instagram", texte: "Sans type déclaré.", media: "https://x.test/auto.mp4" });
    dernier = envois().pop();
    verifier(dernier.videoUrl === "https://x.test/auto.mp4", "un .mp4 sans type déclaré est reconnu comme une vidéo");

    faux.close();
    if (ancienne.adr === undefined) delete process.env.BUFFER_ADRESSE; else process.env.BUFFER_ADRESSE = ancienne.adr;
    process.env.BUFFER_ACCESS_TOKEN = ancienne.jeton || "";
    if (ancienne.pf === undefined) delete process.env.BUFFER_PLATEFORMES; else process.env.BUFFER_PLATEFORMES = ancienne.pf;
    delete require.cache[require.resolve("../engines/social/providers/buffer")];
}

console.log("── La vitrine : d'où vient le média ──");
{
    // Sans média, SAMII ne peut pas publier sur Instagram — la plateforme
    // le refuse. La vitrine est la seule source réelle et gratuite : les
    // vrais produits du catalogue, avec leurs vraies photos et vidéos.
    const vitrine = require("../engines/social/vitrine");

    const m = vitrine.mediasDe({
        photo_url: "https://x.test/a.jpg",
        photos_urls: JSON.stringify(["https://x.test/a.jpg", "https://x.test/b.jpg", "/relatif.jpg"]),
        videos: ["https://x.test/v.mp4"],
    });
    verifier(m.images.length === 2, "les doublons sont retirés (photo_url est souvent la première de photos_urls)");
    verifier(!m.images.includes("/relatif.jpg"),
             "une URL relative est écartée : Buffer et Meta téléchargent depuis CHEZ EUX");
    verifier(m.videos.length === 1, "la vidéo est vue");

    verifier(vitrine.urlPubliable("http://x.test/a.jpg") === false, "http:// est refusé, pas seulement le relatif");
    verifier(vitrine.lireListe("{cassé").length === 0, "un JSON illisible ne remonte pas comme une URL");
    verifier(vitrine.lireListe(null).length === 0, "et une colonne vide ne fait rien tomber");
}

console.log("── Le cycle automatique : les garde-fous ──");
{
    // En AUTO, l'erreur ne s'affiche pas sur un écran : elle publie sur les
    // comptes de vrais gens, plusieurs fois, sans que personne regarde.
    const cycle = require("../engines/social/cycle");
    const anciennes = { max: process.env.SOCIAL_MAX_PAR_JOUR, h: process.env.SOCIAL_HEURES };

    delete process.env.SOCIAL_MAX_PAR_JOUR;
    verifier(cycle.maxParJour() === 2, "sans réglage, 2 publications par plateforme et par jour");
    process.env.SOCIAL_MAX_PAR_JOUR = "0";
    verifier(cycle.maxParJour() === 0, "0 est une valeur valide : elle arrête tout");
    process.env.SOCIAL_MAX_PAR_JOUR = "n'importe quoi";
    verifier(cycle.maxParJour() === 2, "une valeur illisible retombe sur le défaut, elle ne débride pas");

    delete process.env.SOCIAL_HEURES;
    verifier(cycle.heuresAutorisees().join() === "9,14,19", "sans réglage : 9 h, 14 h, 19 h");
    process.env.SOCIAL_HEURES = "8, 20 , 99, abc";
    verifier(cycle.heuresAutorisees().join() === "8,20",
             "les espaces passent, 99 et abc sont écartés — une heure invalide ne doit pas ouvrir la journée");

    // Le mode est décidé à UN seul endroit. Le cycle ne le redéduit pas.
    process.env.SOCIAL_MODE = "MANUAL";
    const r = await cycle.preparer();
    verifier(r.fait === false && /MANUAL/.test(r.raison), "en MANUAL, le cycle ne prépare rien : " + r.raison);
    const e = await cycle.envoyer();
    verifier(e.traitees === 0 && /MANUAL/.test(e.raison), "et il n'envoie rien non plus");

    if (anciennes.max === undefined) delete process.env.SOCIAL_MAX_PAR_JOUR;
    else process.env.SOCIAL_MAX_PAR_JOUR = anciennes.max;
    if (anciennes.h === undefined) delete process.env.SOCIAL_HEURES;
    else process.env.SOCIAL_HEURES = anciennes.h;
}

console.log("── AUTO exige DEUX verrous, pas un ──");
{
    // Une variable qu'on change d'un clic finit changée par erreur, et ici
    // l'erreur publie sur les comptes de vrais gens.
    process.env.SOCIAL_MODE = "AUTO";
    process.env.SOCIAL_AUTO_CONFIRME = "";
    verifier(social.mode() === "SEMI_AUTO", "AUTO sans confirmation retombe en SEMI_AUTO");
    process.env.SOCIAL_AUTO_CONFIRME = "oui";
    verifier(social.mode() === "AUTO", "les deux verrous ensemble donnent AUTO");
    process.env.SOCIAL_AUTO_CONFIRME = "";
    process.env.SOCIAL_MODE = "MANUAL";
}

console.log("── Les campagnes : ce que SAMII a à dire ──");
{
    // « Il invite les gens à le rejoindre, ou il parle de développement
    //   personnel, ou il invite les gens à tester SAMII. »
    //
    // Avant, le cycle ne savait raconter qu'un produit du catalogue. Un
    // compte qui ne publie que des fiches produit ne recrute personne.
    const campagnes = require("../config/campagnes-sociales");

    verifier(campagnes.liste().length === 4, "quatre campagnes déclarées");
    for (const c of campagnes.liste()) {
        verifier(!!c.objectif && !!c.cta, `${c.slug} porte un objectif ET un appel à l'action`);
        verifier(["catalogue", "pexels"].includes(c.source), `${c.slug} dit où chercher son média`);
    }
    verifier(campagnes.get("produit").source === "catalogue", "seul « produit » puise dans le catalogue");
    verifier(campagnes.get("rejoindre").source === "pexels",
             "les autres passent par Pexels — elles n'ont aucun produit derrière elles");

    // La rotation. Sans elle, le tirage pondéré sortait deux fois le même
    // sujet dans la journée, et ça se voit.
    const t = campagnes.choisir({ dejaFaites: ["rejoindre", "essayer", "developpement"] });
    verifier(t.ok && t.campagne.slug === "produit",
             "un sujet déjà passé aujourd'hui n'est pas repris tant qu'il en reste");
    const tout = campagnes.choisir({ dejaFaites: campagnes.ORDRE });
    verifier(tout.ok && !!tout.repetition,
             "quand tout est passé, on recommence PLUTÔT que de ne rien publier : " + tout.repetition);

    // Couper depuis Render, comme les plateformes et les formats.
    process.env.SOCIAL_CAMPAGNES_COUPEES = "rejoindre,essayer,developpement";
    verifier(campagnes.listeActives().map((c) => c.slug).join() === "produit",
             "une campagne se coupe par variable d'environnement");
    process.env.SOCIAL_CAMPAGNES_COUPEES = "rejoindre,essayer,developpement,produit";
    verifier(campagnes.choisir({}).ok === false, "tout couper est possible, et c'est dit");
    process.env.SOCIAL_CAMPAGNES_COUPEES = "";

    // Le sujet Pexels est tiré parmi ceux de la campagne, jamais inventé.
    const r = campagnes.recherche("rejoindre");
    verifier(campagnes.get("rejoindre").recherches.includes(r),
             "le sujet de recherche vient de la campagne : " + r);
    verifier(campagnes.recherche("produit") === null,
             "une campagne catalogue n'a pas de sujet Pexels");
}

console.log("── Pexels : la clé part NUE, jamais en Bearer ──");
{
    // Le piège de cette API : presque toutes les autres veulent « Bearer »,
    // celle-ci veut la clé brute. Se tromper donne un 401 muet.
    const http = require("http");
    const recu = [];
    const faux = http.createServer((req, res) => {
        recu.push({ url: req.url, auth: req.headers.authorization || "" });
        res.writeHead(200, { "Content-Type": "application/json", "X-Ratelimit-Remaining": "42" });
        res.end(JSON.stringify({ videos: [{
            id: 1, duration: 20, url: "https://www.pexels.com/video/1/",
            user: { name: "Awa Diallo", url: "https://www.pexels.com/@awa" },
            video_files: [
                { file_type: "video/mp4", width: 2160, height: 3840, link: "https://v.test/4k.mp4" },
                { file_type: "video/mp4", width: 1080, height: 1920, link: "https://v.test/vertical.mp4" },
                { file_type: "video/quicktime", width: 1080, height: 1920, link: "https://v.test/x.mov" },
            ],
        }] }));
    });
    await new Promise((r) => faux.listen(0, "127.0.0.1", r));

    const ancien = { adr: process.env.PEXELS_ADRESSE, cle: process.env.PEXELS_API_KEY };
    process.env.PEXELS_ADRESSE = `http://127.0.0.1:${faux.address().port}`;
    process.env.PEXELS_API_KEY = "CLE-DE-CONTROLE";
    delete require.cache[require.resolve("../services/pexels")];
    const pexels = require("../services/pexels");

    const v = await pexels.video({ recherche: "african entrepreneur" });
    verifier(v.ok === true, "une vidéo est trouvée");
    verifier(recu[0].auth === "CLE-DE-CONTROLE",
             "la clé part NUE — « Bearer » ferait un 401 que rien n'explique");
    verifier(/orientation=portrait/.test(recu[0].url), "on demande du vertical : un reel recadré est raté");
    verifier(/min_duration=5/.test(recu[0].url) && /max_duration=45/.test(recu[0].url),
             "la durée est bornée à la SOURCE, pas filtrée après");

    // Le choix du fichier : ni la 4K (trop lourde), ni le .mov (refusé).
    verifier(v.media === "https://v.test/vertical.mp4",
             "la verticale ≤1080 est retenue, pas la 4K ni le .mov : " + v.media);

    // Le crédit n'est pas une option : les règles de Pexels le demandent, et
    // c'est la condition pour dépasser les limites d'appels.
    verifier(v.credit.auteur === "Awa Diallo", "l'auteur est crédité");
    verifier(v.credit.ligne === "Vidéo : Awa Diallo · Pexels", "la ligne est prête à coller");
    verifier(/pexels\.com/.test(v.credit.lienMedia), "et elle renvoie vers Pexels");

    // Le jeton ne doit jamais se retrouver dans un état affiché.
    const e = await pexels.etat({ recherche: "technology" });
    verifier(!JSON.stringify(e).includes("CLE-DE-CONTROLE"), "la clé ne fuit pas dans l'état");
    verifier(e.appelsRestants === "42",
             "les appels restants viennent de l'en-tête, pas d'un chiffre écrit en dur");

    // Sans clé : refus nommé, jamais une exception.
    process.env.PEXELS_API_KEY = "";
    const sans = await pexels.chercher({ recherche: "x" });
    verifier(sans.ok === false && /PEXELS_API_KEY/.test(sans.erreur),
             "sans clé, il refuse en nommant la variable");

    faux.close();
    if (ancien.adr === undefined) delete process.env.PEXELS_ADRESSE; else process.env.PEXELS_ADRESSE = ancien.adr;
    process.env.PEXELS_API_KEY = ancien.cle || "";
    delete require.cache[require.resolve("../services/pexels")];
}

console.log("── Les collecteurs : l'apprentissage devient possible ──");
{
    // `analytics.COLLECTEURS` était VIDE. Donc `social_analytics` restait
    // vide, donc l'agent d'apprentissage restait sous son seuil de 5 relevés
    // et refusait éternellement de conclure. Il était honnête et
    // définitivement muet — pas par prudence, par absence de données.
    const analytics = require("../engines/social/agents/analytics");
    const branches = Object.keys(analytics.COLLECTEURS);
    verifier(branches.includes("facebook"), "Facebook a un collecteur");
    verifier(branches.includes("instagram"), "Instagram aussi");
    verifier(branches.includes("linkedin"), "LinkedIn aussi");
    verifier(!branches.includes("telegram"),
             "Telegram n'en a PAS : l'API des bots n'expose pas les vues d'un canal, "
             + "et un zéro inventé fausserait toutes les moyennes");

    const couv = analytics.couverture();
    verifier(couv.find((c) => c.slug === "facebook").collecteur === true,
             "et l'écran le dit : Facebook est mesurable");
    verifier(couv.find((c) => c.slug === "telegram").collecteur === false,
             "Telegram ne l'est pas, et c'est affiché plutôt que caché");

    // ── LA GARANTIE QUI COMPTE ───────────────────────────────────────────
    //
    // « Ne pas créer un FAUX système d'apprentissage. » Un collecteur qui
    // rend 0 quand il n'a pas pu mesurer serait pire que pas de collecteur :
    // ce zéro se mélangerait aux vrais et fausserait chaque moyenne.
    const col = require("../engines/social/collecteurs");
    verifier((await col.facebook({ externe_id: null, workspace_id: "w1" })) === null,
             "sans identifiant externe : null, jamais un zéro");
    verifier((await col.facebook({ externe_id: "1_2", workspace_id: null })) === null,
             "sans workspace : null aussi");
    verifier((await col.instagram({ externe_id: "buf_1", workspace_id: "w1", provider: "buffer" })) === null,
             "un identifiant Buffer n'est pas interrogé chez Meta — appel inutile évité");

    // ── LE SCHÉMA RÉEL DE BUFFER ─────────────────────────────────────────
    //
    // Découvert par introspection sur le vrai compte, depuis le Web Shell de
    // Render — seul endroit d'où api.buffer.com est joignable.
    //
    //     Post { metrics: [PostMetric] }
    //     PostMetric { name: String, type: PostMetricType, unit, value: Float }
    //
    // J'avais deviné un OBJET aux champs nommés (`metrics { impressions
    // reach likes }`). C'est une LISTE. La requête aurait échoué.
    //
    // On reconnaît donc par ALIAS sur `type` ET `name` : `type` est une
    // énumération dont les valeurs peuvent changer, `name` est une chaîne
    // pensée pour être lue par un humain, et les deux diffèrent d'un réseau
    // à l'autre.
    const rang = col.rangerMetriques([
        // La PLUS GRANDE est en PREMIER, exprès. Rangée dans l'ordre
        // inverse, « le dernier gagne » donnerait le même résultat que
        // « le plus grand », et l'assertion ne prouverait rien.
        { type: "VIDEO_VIEWS", name: "Video views", value: 1500 },
        { type: "IMPRESSIONS", name: "Impressions", value: 1240 },
        { type: "REACH",       name: "Reach",       value: 980  },
        { type: "LIKES",       name: "Likes",       value: 42   },
        { type: "SAVES",       name: "Saves",       value: 3    },
    ]);
    verifier(rang.portee === 980, "la portée est reconnue");
    verifier(rang.likes === 42, "les likes aussi");
    verifier(rang.vues === 1500,
             "deux métriques dans la même case : on garde la PLUS GRANDE — "
             + "sous-estimer une portée fausserait toute comparaison");
    verifier(rang.saves === undefined,
             "ce qui n'est reconnu par aucun alias n'entre pas dans nos chiffres…");
    verifier(col.ALIAS.vues.includes("impressions") && col.ALIAS.clics.includes("clicks"),
             "…et les alias sont écrits à UN seul endroit");

    // La casse et la ponctuation ne doivent pas décider si une mesure compte.
    verifier(col.normaliser("Video views") === "videoviews", "la normalisation absorbe espaces et casse");
    verifier(Object.keys(col.rangerMetriques([{ type: "LIKES", value: "pas un nombre" }])).length === 0,
             "une valeur illisible est ignorée, pas convertie en 0");
    verifier(Object.keys(col.rangerMetriques(null)).length === 0, "une liste absente ne fait rien tomber");

    // La mise en forme commune : chaque plateforme nomme ses chiffres
    // autrement, on les ramène à un vocabulaire unique une seule fois.
    const m = col.mesure({ vues: "1240", likes: 28, brut: { x: 1 } });
    verifier(m.mesures.vues === 1240, "les chaînes de caractères sont converties en nombres");
    verifier(m.mesures.commentaires === 0, "ce qui manque vaut 0 dans la forme, pas undefined");
    verifier(m.brut.x === 1, "la réponse d'origine est gardée pour plus tard");
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
