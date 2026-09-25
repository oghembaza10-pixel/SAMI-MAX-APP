// ==========================================================================
// SAMII OS — LA COUCHE DE COMPÉTENCE
// ==========================================================================
//
// CE QUE LES 34 MÉTIERS PERMETTAIENT AVANT CE FICHIER.
//
// Mesuré, consommateur par consommateur, avant d'écrire une ligne :
//
//   • des pages SEO publiques        routes/metiers.js → /metiers/:id
//   • une liste déroulante           à l'inscription
//   • un énuméré pour l'onboarding   geminiService.js, l'outil qui range le
//                                    marchand dans une case
//   • des filtres SQL                besoins, vitrine, boutique
//   • `typeParcours()`               rdv ou produit — routes/api.js:704
//   • le MOT du métier               dans une phrase du prompt, et
//                                    UNIQUEMENT si `audience === "client"`
//
// Et dans le QG, l'identifiant brut (« coiffeur ») qui traverse le prompt à
// l'intérieur du `JSON.stringify(context)`, parce que `memoireUtilisateur`
// remonte `profil.metier`.
//
// AUTREMENT DIT : la PERTE, le DÉFAUT et la RÉPONSE — les trois phrases
// écrites pour chacun des 34 métiers, la seule vraie connaissance du
// fichier — n'atteignaient JAMAIS le raisonnement de SAMII. Elles servaient
// à remplir des pages web. Le chat public, lui, ne connaissait aucun métier
// du tout : `grep -c metier routes/vitrine.js` → 0.
//
// Un métier était une ÉTIQUETTE. Ce fichier en fait une COMPÉTENCE.
//
// ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────
//
// Il ne crée pas 34 systèmes. Il ne recopie aucun métier. Il ne déclare
// aucun nouveau domaine : les huit domaines de
// `brain/prompts/sovereign/tables.js` — business, strategie, programmation,
// marketing, finance, logistique, securite, crm — sont ceux qui servent
// déjà au chantier 8 pour choisir une mission, et ce sont les mêmes ici.
//
// Une deuxième table aurait divergé de la première au premier changement.
// ==========================================================================

const metiers = require("./metiers");
// Le plafond d'outils d'une audience, croisé au niveau du tour. Ce fichier ne
// recroise rien lui-même : il DEMANDE au registre. Deux calculs séparés
// finiraient par ne plus dire la même chose, et c'est exactement ce défaut-là
// qu'on répare ici.
const AUDIENCES = require("../config/audiences");
const { detect } = require("../brain/prompts/sovereign/tables");

// ── NORMALISER ───────────────────────────────────────────────────────────
//
// Sans accents et sans casse. Quelqu'un qui tape depuis un téléphone écrit
// « patisserie », « j'ai » devient « jai », et « répare » perd son accent.
// Comparer des chaînes brutes, c'est ne reconnaître que les gens qui
// écrivent correctement.
function normaliser(texte) {
    return String(texte || "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/['’]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ══════════════════════════════════════════════════════════════════════════
// RECONNAÎTRE UN MÉTIER DANS UNE PHRASE LIBRE
// ══════════════════════════════════════════════════════════════════════════
//
// ── LA GARDE QUI CHANGE TOUT : IL FAUT UNE DÉCLARATION ───────────────────
//
// Un métier n'est reconnu que dans une phrase où la personne DIT ce qu'elle
// fait. Pas « il y a le mot restaurant quelque part » : « je suis », « j'ai
// un », « je vends », « je répare »…
//
// CE QUE ÇA ÉVITE, MESURÉ. Sans cette garde, « j'ai 20 commandes en retard »
// ressortait en `restaurant` (2 mots communs) ou `patisserie` (2 mots
// communs), et « comment augmenter mes ventes » en `ecommerce`. SAMII aurait
// décidé que quelqu'un est pâtissier parce qu'il parle de commandes en
// retard, puis lui aurait parlé de gâteaux pendant toute la conversation.
//
// Deviner faux est bien pire que ne pas deviner : une erreur de métier
// contamine tout ce qui suit, et la personne n'a aucun moyen de comprendre
// d'où ça vient.
//
// C'est la même discipline que le « geste annoncé » de services/niveauAuto.js
// — et elle vient de la même leçon.
const DECLARATION = new RegExp([
    "\\bje suis\\b", "\\bje tiens\\b", "\\bje gere\\b", "\\bje dirige\\b",
    "\\bj ai (un|une|mon|ma)\\b", "\\bjai (un|une|mon|ma)\\b",
    "\\bmon (activite|commerce|metier|business|magasin|salon|atelier)\\b",
    "\\bma (boutique|societe|entreprise|clinique|pharmacie)\\b",
    "\\bnotre (activite|commerce|entreprise|societe)\\b",
    "\\bje travaille (dans|comme|en)\\b",
    "\\bje (vends|fais|repare|soigne|coiffe|livre|loue|forme|construis|cuisine)\\b",
    "\\bnous (sommes|vendons|faisons)\\b", "\\bon (est|vend|fait)\\b",
    "\\bactivite ?:", "\\bmetier ?:",
].join("|"));

// L'index mots → métier, construit UNE FOIS au chargement depuis la source
// unique. Les mots les plus longs d'abord : « salon de coiffure » doit
// gagner contre « salon », sinon un salon de thé devient un coiffeur.
const INDEX = (() => {
    const entrees = [];
    for (const m of metiers.METIERS) {
        for (const mot of metiers.VOCABULAIRE[m.id] || []) {
            entrees.push({ metier: m.id, mot: normaliser(mot) });
        }
    }
    return entrees.sort((a, b) => b.mot.length - a.mot.length);
})();

// ── DEVINER ──────────────────────────────────────────────────────────────
//
// Rend TOUJOURS un objet, jamais null : un appelant doit pouvoir distinguer
// trois états, et ils appellent trois comportements différents.
//
//   declare=false               la personne n'a pas parlé de son activité.
//                               SAMII ne demande rien, il répond.
//   declare=true, metier=null   elle a parlé de son activité mais on n'a pas
//                               reconnu laquelle. C'est LE bon moment pour
//                               demander — et le seul.
//   declare=true, metier=<id>   on sait.
function deviner(message) {
    const texte = normaliser(message);
    if (!texte) return { declare: false, metier: null, mot: null, candidats: [] };

    const declare = DECLARATION.test(texte);
    if (!declare) return { declare: false, metier: null, mot: null, candidats: [] };

    const touches = [];
    for (const e of INDEX) {
        // Frontières de mot : sans elles, « labo » se trouve dans
        // « collaborateur » et « cafe » dans « cafeteria » — l'un des deux
        // est même un autre métier de la liste.
        const motif = new RegExp(`(^|[^a-z0-9])${e.mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
        if (motif.test(texte) && !touches.some((t) => t.metier === e.metier)) {
            touches.push(e);
        }
    }

    return {
        declare: true,
        metier: touches[0]?.metier || null,
        mot: touches[0]?.mot || null,
        // ── PLUSIEURS ACTIVITÉS ──────────────────────────────────────────
        //
        // « J'ai un restaurant et je fais aussi traiteur » : on rend les
        // deux. Le premier est le principal (mot le plus long, donc le plus
        // spécifique) ; les autres sont du contexte que SAMII doit garder.
        // Écraser le second serait décider à la place de la personne qu'elle
        // n'a qu'un métier.
        candidats: touches.map((t) => t.metier),
    };
}

// ══════════════════════════════════════════════════════════════════════════
// LE LEVIER D'UN MÉTIER
// ══════════════════════════════════════════════════════════════════════════
//
// `parcours` existe depuis toujours : « rdv » ou « produit ». Ce n'est pas
// une étiquette, c'est ce autour de quoi l'activité tourne — et donc ce que
// SAMII doit regarder en premier.
//
//   rdv      le stock, c'est l'AGENDA. Une heure vide ne se revend pas.
//            Le domaine naturel est la relation client (crm).
//   produit  le stock, c'est la MARCHANDISE. Le domaine naturel est le
//            commerce (business).
//
// On ne déclare donc aucun domaine par métier : on le DÉDUIT d'un champ qui
// existe déjà et que 34 lignes renseignent. Trente-quatre déclarations de
// plus auraient divergé de `parcours` au premier métier modifié.
const DOMAINE_NATUREL = { rdv: "crm", produit: "business" };

function domaineNaturel(metierId) {
    const m = metiers.METIERS.find((x) => x.id === metierId);
    if (!m) return null;
    return DOMAINE_NATUREL[m.parcours] || "business";
}

// ══════════════════════════════════════════════════════════════════════════
// ARBITRER — le métier éclaire, le message commande
// ══════════════════════════════════════════════════════════════════════════
//
// LA RÈGLE, ET C'EST ELLE QUI FAIT LA DIFFÉRENCE.
//
// « J'ai 20 commandes en retard », dit par un e-commerçant. Le métier dit
// `business`. Le message dit `logistique`. Si le métier gagnait, SAMII
// répondrait par une stratégie de vente à quelqu'un qui est en train de
// perdre ses clients par la livraison.
//
//   LE MESSAGE COMMANDE. LE MÉTIER ÉCLAIRE.
//
// Le métier ne reprend la main que lorsque le message ne dit rien de précis
// (`default`) — « bonjour », « tu peux m'aider ? ». Là, savoir qu'on parle à
// un coiffeur plutôt qu'à un grossiste change tout, et c'est la seule
// information disponible.
//
// ── POURQUOI PAS « LE MÉTIER DONNE UN POIDS » ────────────────────────────
//
// Parce qu'un poids se règle, et qu'un réglage qu'on ne sait pas expliquer
// ne se règle jamais. Une frontière nette se lit, se teste, et se casse
// bruyamment quand elle est fausse.
const OPERATIONNELS = ["logistique", "crm", "securite"];
const COMMERCIAUX = ["business", "marketing", "strategie", "finance"];

function arbitrer({ metier = null, message = "" } = {}) {
    const fiche = metier ? metiers.fiche(metier) : null;
    const naturel = metier ? domaineNaturel(metier) : null;
    const duMessage = detect(String(message || ""));
    const raisons = [];

    let retenu;
    if (duMessage && duMessage !== "default") {
        retenu = duMessage;
        raisons.push(`le message porte sur « ${duMessage} »`);
        // On NOMME la tension au lieu de l'effacer. C'est ce qui permettra
        // d'écrire « je vois que tu me parles livraison plutôt que vente »
        // en disant la vérité, et c'est ce qu'on relira le jour où un
        // arbitrage paraîtra absurde.
        if (naturel && naturel !== duMessage) {
            raisons.push(`le métier ${metier} tire vers « ${naturel} », le message l'emporte`);
        }
    } else if (naturel) {
        retenu = naturel;
        raisons.push(`rien de précis dans le message, le métier ${metier} oriente vers « ${naturel} »`);
    } else {
        retenu = "default";
        raisons.push("ni métier connu ni sujet détecté");
    }

    const priorite = OPERATIONNELS.includes(retenu) ? "operationnelle"
        : COMMERCIAUX.includes(retenu) ? "commerciale"
            : "conversation";

    return {
        metier: metier || null,
        fiche,
        parcours: fiche?.parcours || null,
        domaineNaturel: naturel,
        domaineMessage: duMessage,
        domaine: retenu,
        priorite,
        raisons,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// CE QUE SAMII REÇOIT
// ══════════════════════════════════════════════════════════════════════════
//
// Un bloc COMPACT. `brain/prompts/index.js` sérialise le contexte entier
// dans le prompt (`JSON.stringify(context)`) : tout ce qu'on pose ici est
// payé en jetons à CHAQUE message, dans les deux chats. Une fiche complète
// recopiée quatre fois, c'est la facture qui monte sans que rien ne le dise.
//
// On envoie donc les trois phrases écrites pour ce métier — et rien d'autre.
// Ce sont elles qui n'avaient jamais atteint SAMII.
//
// Rend `null` quand il n'y a rien à dire : une clé posée à `null` dans le
// contexte occupe quand même de la place dans le prompt et n'apprend rien.
// ── `audience` ET `niveau` NE SONT PAS DÉCORATIFS ────────────────────────
//
// Ils décident de `sait_faire`, la seule ligne de ce bloc qui PROMET quelque
// chose. Sans eux, on retombe sur le côté sûr : aucun geste annoncé. C'est
// voulu — une route qui oublie de les passer fait taire SAMII sur ce point
// au lieu de lui faire dire une chose fausse. Voir `config/audiences.js`,
// `outilsDuTour`.
function pourLePrompt({ metier = null, message = "", audience = "", niveau = null } = {}) {
    const a = arbitrer({ metier, message });
    if (!a.fiche && a.domaine === "default") return null;

    const bloc = { domaine: a.domaine, priorite: a.priorite };
    if (a.fiche) {
        bloc.metier = a.fiche.label;
        bloc.parcours = a.fiche.parcours === "rdv"
            ? "l'activité tourne autour de rendez-vous à honorer"
            : "l'activité tourne autour de commandes à livrer";
        bloc.cequiCoute = a.fiche.perte;
        bloc.cequiCloche = a.fiche.defaut;
        bloc.cequiMarche = a.fiche.reponse;
    }
    // ── LE SECTEUR, EN PROJECTION — JAMAIS EN ENTIER ─────────────────────
    //
    // Six métiers portent maintenant un contexte opérationnel complet dans
    // services/metiers.js : objets, données, problèmes, actions, workflows,
    // outils, mémoire, expertise. Recopié tel quel, ce bloc pèse plusieurs
    // milliers de caractères — payés à CHAQUE message, dans les deux chats,
    // pour une information dont l'essentiel ne sert pas au tour en cours.
    //
    // On envoie donc ce qui change la RÉPONSE, et rien d'autre :
    //
    //   • `univers`   : les objets du métier. C'est eux qui font que
    //                   « stock » veut dire ingrédients chez un restaurateur
    //                   et références chez un e-commerçant. C'est le cœur.
    //   • `regarder`  : les données à demander avant de conclure.
    //   • `façon`     : comment raisonner — la ligne d'expertise.
    //   • `sait_faire`: les actions que SAMII exécute VRAIMENT ici, nommées
    //                   par leur outil. Ce qu'il ne sait que comprendre n'a
    //                   pas besoin d'être annoncé : il en parlera très bien
    //                   sans qu'on le lui dise, et l'annoncer ferait croire
    //                   qu'il sait le faire.
    //
    // Les problèmes, les workflows et la mémoire restent lisibles par le
    // reste du produit via `metiers.fiche(id).secteur` — ils ne partent pas
    // dans le prompt tant qu'aucun tour de conversation n'en a besoin.
    const s = a.fiche && a.fiche.secteur;
    if (s) {
        bloc.secteur = {
            univers: s.objets,
            regarder: (s.donnees || []).slice(0, 5),
            façon: s.expertise,
        };
        // ── CE QU'IL SAIT FAIRE **POUR CETTE PERSONNE-LÀ** ───────────────
        //
        // ⚠️ CETTE INTERSECTION MANQUAIT, ET ELLE A COÛTÉ CHER.
        //
        // `metiers.js` nomme les gestes d'un secteur par leur outil :
        // `confirmer_commande` chez un e-commerçant, `prendre_rendez_vous`
        // chez un dentiste. Ces noms sont justes — mais ils décrivent LE
        // MÉTIER, pas ce que SAMII tient dans LA CONVERSATION EN COURS.
        //
        // Or la famille `commerce` (confirmer une commande, poser un
        // rendez-vous) n'est accordée qu'en parlant à un CLIENT du marchand,
        // sur Telegram ou WhatsApp. Le marchand, chez lui, ne l'a jamais —
        // et c'est juste : il ne doit pas confirmer la commande d'un client
        // depuis son propre chat.
        //
        // La projection ignorait ce plafond. Mesuré sur les 36 secteurs :
        // 63 gestes annoncés sur 136 (46 %) ne pouvaient pas partir, dans
        // 34 secteurs sur 36. Le prompt du marchand e-commerce disait
        // « tu sais faire toi-même : confirmer_commande, annuler_commande… »
        // puis, six mots plus loin, « ne promets aucun geste que tu ne peux
        // pas exécuter ».
        //
        // Un assistant qui annonce et ne fait pas est pire qu'un assistant
        // qui se tait : le premier se paie et déçoit, le second laisse la
        // personne demander autrement.
        const possibles = new Set(AUDIENCES.outilsDuTour(audience, niveau));
        const faisables = (s.actions || [])
            .filter((x) => x && x.fait && possibles.has(x.fait))
            .map((x) => x.fait);
        if (faisables.length) {
            bloc.secteur.sait_faire = [...new Set(faisables)];
            // ── L'AUDIENCE VOYAGE AVEC LA PROMESSE ───────────────────────
            //
            // L'audience est passée DEUX FOIS pour un même tour : ici, et au
            // constructeur de consigne. Rien n'obligeait les deux à être la
            // même — une route pouvait calculer la liste pour un marchand et
            // l'imprimer dans la consigne d'un client.
            //
            // Ce n'est pas une crainte théorique : le garde de
            // tests/secteurs.test.js faisait exactement ça, et c'est lui qui
            // l'a révélé. Quand deux endroits doivent s'accorder et que rien
            // ne les compare, ils divergent.
            //
            // La liste porte donc POUR QUI elle a été calculée, et
            // brain/prompts/index.js refuse de l'imprimer si ce n'est pas la
            // même personne. Une désynchronisation fait taire la promesse au
            // lieu de la déplacer sur quelqu'un d'autre.
            bloc.secteur.pourAudience = String(audience || "");
        }
    }

    // La tension, quand il y en a une. C'est l'information la plus utile du
    // bloc : elle dit à SAMII de ne pas répondre au métier mais à la
    // question.
    if (a.domaineNaturel && a.domaineMessage !== "default" && a.domaineNaturel !== a.domaineMessage) {
        bloc.attention = `Le message porte sur « ${a.domaineMessage} », pas sur le terrain habituel de ce métier. Réponds à ce qui est demandé.`;
    }
    return bloc;
}

module.exports = {
    deviner, arbitrer, domaineNaturel, pourLePrompt, normaliser,
    DECLARATION, DOMAINE_NATUREL, OPERATIONNELS, COMMERCIAUX,
};
