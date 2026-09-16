// ==========================================================================
// SAMII OS — LE MÉTIER DEVIENT UNE COMPÉTENCE, PAS UNE ÉTIQUETTE
// ==========================================================================
//
// CE QUE LES 34 MÉTIERS PERMETTAIENT AVANT.
//
// Mesuré consommateur par consommateur, avant d'écrire une ligne :
//
//   • des pages SEO             /metiers/:id
//   • une liste déroulante      à l'inscription
//   • un énuméré                pour l'outil d'onboarding
//   • des filtres SQL           besoins, vitrine, boutique
//   • typeParcours()            rdv ou produit — le SEUL usage comportemental
//   • le mot du métier          dans une phrase du prompt, et uniquement si
//                               `audience === "client"`
//
// Les trois phrases écrites pour CHAQUE métier — ce que ça fait perdre, ce
// qui cloche, ce qui marche — n'atteignaient jamais le raisonnement de
// SAMII. Et le chat public ne connaissait aucun métier du tout :
// `grep -c metier routes/vitrine.js` rendait 0.
//
// ── CE QUE CETTE SUITE MESURE ────────────────────────────────────────────
//
// Pas « le fichier existe ». Trois capacités, chacune avec sa contre-preuve :
//
//   1. RECONNAÎTRE sans inventer. Le piège est le faux positif : deviner un
//      métier faux contamine toute la conversation, et la personne n'a aucun
//      moyen de comprendre d'où ça vient.
//   2. ARBITRER. « J'ai 20 commandes en retard » doit être opérationnel, pas
//      commercial — même dit par un e-commerçant.
//   3. SUIVRE. Ce qu'on dit de soi dans le chat public doit exister encore
//      dans le QG.
//
// Lancer :  npm test
// ==========================================================================

const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const C = require(path.join(RACINE, "services", "competences.js"));
const metiers = require(path.join(RACINE, "services", "metiers.js"));
const { detect } = require(path.join(RACINE, "brain", "prompts", "sovereign", "tables.js"));

// ══════════════════════════════════════════════════════════════════════════
// 1. AUCUNE RÉGRESSION SUR LES 34 MÉTIERS
// ══════════════════════════════════════════════════════════════════════════
{
    // 34 au chantier 9, puis 36 : le chantier 9c a ajouté « grossiste » et
    // « location_voitures », deux des six secteurs qu'il approfondit et qui
    // n'existaient pas. Les créer ailleurs aurait fabriqué le registre
    // parallèle que ce projet a déjà payé trois fois.
    //
    // Le nombre est FIGÉ, pas « au moins » : c'est ce qui fait crier quand
    // quelqu'un en perd un ou en ajoute un sans y penser.
    verifier(metiers.METIERS.length === 36,
        `${metiers.METIERS.length} métiers au lieu de 36 : le registre en aurait perdu ou inventé`);
    verifier(metiers.avecFiche().length === metiers.METIERS.length,
        `${metiers.avecFiche().length} fiches pour ${metiers.METIERS.length} métiers : un métier ` +
        "listé sans fiche répond 404 sur sa page publique");

    for (const m of metiers.METIERS) {
        const f = metiers.fiche(m.id);
        verifier(f && f.perte && f.defaut && f.reponse,
            `le métier « ${m.id} » a perdu une de ses trois phrases`);
        verifier(Array.isArray(f.mots),
            `la fiche de « ${m.id} » ne porte pas de tableau « mots » : un appelant recevrait ` +
            "undefined et finirait par écrire sa propre valeur de repli");
        verifier(["rdv", "produit"].includes(f.parcours),
            `le parcours de « ${m.id} » vaut « ${f.parcours} »`);
    }

    // Le vocabulaire vit dans la source UNIQUE, pas dans un second fichier.
    verifier(typeof metiers.VOCABULAIRE === "object",
        "le vocabulaire n'est pas exporté par services/metiers.js : il vivrait ailleurs, " +
        "et divergerait de la liste au premier métier ajouté");
    const inconnus = Object.keys(metiers.VOCABULAIRE).filter((id) => !metiers.estValide(id));
    verifier(!inconnus.length,
        `le vocabulaire nomme des métiers qui n'existent pas : ${inconnus.join(", ")}`);

    // ── CES MOTS SONT MAINTENANT LUS, PAS SEULEMENT COMPARÉS ─────────────
    //
    // Ils étaient écrits sans accents ni apostrophes — « medecin »,
    // « cabinet d avocat » — parce qu'ils ne servaient qu'à reconnaître ce
    // qu'on tape. Ils sont désormais AFFICHÉS sur les fiches publiques : ce
    // sont les mots sous lesquels les clients cherchent le métier. On les a
    // donc écrits en français correct.
    //
    // C'est sûr parce que `normaliser()` s'applique aux deux côtés de la
    // comparaison : elle met en minuscules, retire les accents et remplace
    // l'apostrophe par une espace. « médecin » et « medecin » deviennent la
    // même clé.
    //
    // ⚠️ MAIS ELLE NE TOUCHE PAS AU TRAIT D'UNION. Écrire « bien-être » au
    // lieu de « bien être » donnerait la clé « bien-etre », et le mot ne
    // serait plus jamais reconnu — sans erreur, sans trace, juste un métier
    // qu'on ne devine plus. C'est la seule façon dont une correction
    // d'orthographe peut casser la reconnaissance, donc c'est ce qu'on garde.
    const avecTiret = [];
    let motsVus = 0;
    for (const [id, mots] of Object.entries(metiers.VOCABULAIRE)) {
        for (const mot of mots) {
            motsVus++;
            if (C.normaliser(mot).includes("-")) avecTiret.push(`${id} : « ${mot} »`);
        }
    }
    verifier(avecTiret.length === 0,
        `${avecTiret.length} mot(s) de vocabulaire gardent un trait d'union une fois normalisés : ` +
        `${avecTiret.slice(0, 4).join(", ")} — normaliser() ne le remplace pas, contrairement à ` +
        "l'apostrophe ; ces mots ne seraient plus jamais reconnus dans une phrase libre");

    // Le volume, pour qu'une disparition se voie. Mesuré : 177 mots.
    verifier(motsVus >= 170,
        `le vocabulaire ne compte plus que ${motsVus} mots — des entrées ont disparu`);

    // Et chaque mot doit rester utilisable comme clé : normalisé, il ne doit
    // ni être vide ni garder d'accent.
    const abimes = [];
    for (const [id, mots] of Object.entries(metiers.VOCABULAIRE)) {
        for (const mot of mots) {
            const n = C.normaliser(mot);
            if (!n || /[À-ɏ]/.test(n)) abimes.push(`${id} : « ${mot} » → « ${n} »`);
        }
    }
    verifier(abimes.length === 0,
        `mot(s) inutilisables après normalisation : ${abimes.slice(0, 4).join(", ")}`);
}

// ══════════════════════════════════════════════════════════════════════════
// 2. RECONNAÎTRE — et surtout, NE PAS INVENTER
// ══════════════════════════════════════════════════════════════════════════
{
    // ── MÉTIER CONNU, DÉCLARÉ ────────────────────────────────────────────
    const attendus = [
        ["Je vends des vêtements sur Instagram", "pretaporter"],
        ["je suis coiffeur à Bamako", "coiffeur"],
        ["j'ai un restaurant", "restaurant"],
        ["je répare des voitures", "garage"],
        ["je fais des gâteaux pour les mariages", "patisserie"],
        ["j'ai une pharmacie de garde", "pharmacie"],
        ["je travaille dans l'immobilier", "immobilier"],
        ["mon activité c'est la livraison", "livreur"],
    ];
    for (const [phrase, id] of attendus) {
        const d = C.deviner(phrase);
        verifier(d.metier === id,
            `« ${phrase} » donne « ${d.metier || "rien"} » au lieu de « ${id} »`);
    }

    // ── LE FAUX POSITIF : LA GARDE QUI COMPTE LE PLUS ────────────────────
    //
    // ⚠️ MESURÉ AVANT D'ÉCRIRE LA GARDE. Un index construit sur le texte des
    // fiches rendait `restaurant` ou `patisserie` sur « j'ai 20 commandes en
    // retard », et `ecommerce` sur « comment augmenter mes ventes ».
    //
    // SAMII aurait décidé que quelqu'un est pâtissier parce qu'il parle de
    // commandes en retard, puis lui aurait parlé de gâteaux pendant toute la
    // conversation. Deviner faux est bien pire que ne pas deviner.
    const jamais = [
        "j'ai 20 commandes en retard",
        "comment augmenter mes ventes ?",
        "bonjour",
        "mes clients ne répondent plus",
        "le restaurant d'en face a baissé ses prix",
        "combien coûte une livraison vers Oran ?",
        "tu peux m'aider ?",
    ];
    for (const phrase of jamais) {
        const d = C.deviner(phrase);
        verifier(d.metier === null,
            `« ${phrase} » fait deviner le métier « ${d.metier} » : une phrase où personne ne ` +
            "déclare son activité range la personne dans un métier, et tout ce qui suit en hérite");
    }

    // ── DÉCLARÉ MAIS NON RECONNU : UN TROISIÈME ÉTAT, PAS UN ÉCHEC ───────
    //
    // « Je suis apiculteur » — la personne a bien parlé de son activité, on
    // ne sait juste pas laquelle. C'est LE moment de demander, et le seul.
    const flou = C.deviner("je suis apiculteur depuis dix ans");
    verifier(flou.declare === true && flou.metier === null,
        `une déclaration d'activité non reconnue rend ${JSON.stringify(flou)} : SAMII ne saurait ` +
        "pas qu'il vient d'entendre quelqu'un se présenter");
    verifier(C.deviner("bonjour").declare === false,
        "« bonjour » est pris pour une déclaration d'activité");

    // ── PLUSIEURS ACTIVITÉS ──────────────────────────────────────────────
    const deux = C.deviner("j'ai un restaurant et je fais aussi traiteur");
    verifier(deux.candidats.includes("restaurant") && deux.candidats.includes("traiteur"),
        `deux activités déclarées, un seul candidat gardé (${deux.candidats.join(", ")}) : ` +
        "on déciderait à la place de la personne qu'elle n'a qu'un métier");
    verifier(deux.metier === "restaurant",
        `le métier principal retenu est « ${deux.metier} »`);

    // ── LE MOT TROP GÉNÉRAL ──────────────────────────────────────────────
    //
    // ⚠️ TROUVÉ EN MESURANT. « salon » était dans le vocabulaire du coiffeur :
    // « mon salon de thé marche bien » ressortait donc AUSSI en coiffeur.
    const the = C.deviner("mon salon de thé marche bien");
    verifier(!the.candidats.includes("coiffeur"),
        `« mon salon de thé » est rangé en coiffeur (${the.candidats.join(", ")}) : un mot trop ` +
        "général range les gens dans le mauvais métier");

    // Et les frontières de mot tiennent : « labo » ne doit pas se trouver
    // dans « collaborateur ».
    verifier(C.deviner("je travaille comme collaborateur").metier !== "laboratoire",
        "« collaborateur » est reconnu comme un laboratoire : les frontières de mot ne tiennent pas");
}

// ══════════════════════════════════════════════════════════════════════════
// 3. ARBITRER — le message commande, le métier éclaire
// ══════════════════════════════════════════════════════════════════════════
{
    // ── L'EXEMPLE QUI DONNE SON SENS AU CHANTIER ─────────────────────────
    //
    // Un e-commerçant qui a 20 commandes en retard n'a pas un problème de
    // marketing. Si le métier l'emportait, SAMII répondrait par une
    // stratégie de vente à quelqu'un qui est en train de perdre ses clients
    // par la livraison.
    const retard = C.arbitrer({ metier: "ecommerce", message: "J'ai 20 commandes en retard" });
    verifier(retard.domaine === "logistique",
        `« 20 commandes en retard » chez un e-commerçant donne « ${retard.domaine} » au lieu de ` +
        "« logistique » : SAMII répondrait vente à quelqu'un qui a un problème de livraison");
    verifier(retard.priorite === "operationnelle",
        `la priorité est « ${retard.priorite} » : l'urgence ne serait pas la bonne`);
    verifier(retard.raisons.some((r) => /l'emporte/.test(r)),
        `la tension métier/message n'est pas nommée (${retard.raisons.join(" ; ")}) : on ne pourrait ` +
        "pas relire un arbitrage qui paraît absurde");

    // ── DOMAINE CONTRADICTOIRE ───────────────────────────────────────────
    //
    // Un coiffeur (terrain naturel : la relation client) qui demande comment
    // vendre plus doit obtenir une réponse commerciale.
    const vendre = C.arbitrer({ metier: "coiffeur", message: "Comment augmenter mes ventes ?" });
    verifier(vendre.domaine === "business",
        `un coiffeur qui demande à vendre plus obtient « ${vendre.domaine} »`);
    verifier(vendre.domaineNaturel === "crm",
        `le terrain naturel du coiffeur est « ${vendre.domaineNaturel} » au lieu de « crm »`);

    // ── LE MÉTIER REPREND LA MAIN QUAND LE MESSAGE NE DIT RIEN ───────────
    const bonjour = C.arbitrer({ metier: "coiffeur", message: "bonjour" });
    verifier(bonjour.domaine === "crm",
        `« bonjour » chez un coiffeur donne « ${bonjour.domaine} » : la seule information ` +
        "disponible — son métier — serait ignorée");

    // ── MÉTIER INCONNU : ON NE TOMBE PAS ─────────────────────────────────
    const sansMetier = C.arbitrer({ metier: null, message: "Comment augmenter mes ventes ?" });
    verifier(sansMetier.domaine === "business" && sansMetier.fiche === null,
        `sans métier connu, l'arbitrage rend ${JSON.stringify(sansMetier).slice(0, 120)}`);
    const bidon = C.arbitrer({ metier: "astronaute", message: "bonjour" });
    verifier(bidon.domaine === "default" && bidon.fiche === null,
        `un métier inconnu fabrique un domaine (${bidon.domaine}) au lieu de dire qu'il ne sait pas`);

    // ── LE PARCOURS DÉCIDE DU TERRAIN, PAS UNE TABLE DE PLUS ─────────────
    //
    // 34 déclarations de domaine auraient divergé de `parcours` au premier
    // métier modifié. On vérifie donc que le terrain se DÉDUIT.
    for (const m of metiers.METIERS) {
        const attendu = m.parcours === "rdv" ? "crm" : "business";
        verifier(C.domaineNaturel(m.id) === attendu,
            `le terrain de « ${m.id} » (parcours ${m.parcours}) est « ${C.domaineNaturel(m.id)} » ` +
            `au lieu de « ${attendu} » : le domaine serait déclaré à part et divergerait`);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4. LE DÉTECTEUR CORRIGÉ — et pas de neuvième domaine
// ══════════════════════════════════════════════════════════════════════════
{
    // ⚠️ CETTE CORRECTION EST DANS LA SOURCE UNIQUE, PAS DANS UNE COUCHE.
    //
    // `detect()` rendait `business` sur « commandes en retard », parce que le
    // mot « commande » est sur la ligne du dessous et que la fonction rend à
    // la première correspondance. Corriger ça dans competences.js aurait créé
    // la deuxième table de règles qu'on veut éviter — et le chantier 8, qui
    // appelle `detect` pour choisir une mission, serait resté faux.
    const operationnels = [
        "j'ai 20 commandes en retard",
        "le client n'a pas reçu sa commande",
        "je suis en rupture de stock",
        "mes livraisons sont bloquées",
    ];
    for (const p of operationnels) {
        verifier(detect(p) === "logistique",
            `« ${p} » est classé « ${detect(p) }» au lieu de « logistique »`);
    }

    // Et on n'a rien cassé de ce qui marchait.
    const inchanges = [
        ["comment augmenter mes ventes", "business"],
        ["j'ai une boutique de chaussures", "business"],
        ["fais-moi une pub instagram", "marketing"],
        ["mon budget est serré cette année", "finance"],
        ["il y a un bug dans mon code", "programmation"],
        ["quelle stratégie pour l'année prochaine", "strategie"],
    ];
    for (const [p, attendu] of inchanges) {
        verifier(detect(p) === attendu,
            `« ${p} » est passé de « ${attendu} » à « ${detect(p)} » : le chantier 9 aurait ` +
            "déplacé une frontière qui marchait");
    }

    // ── AUCUN NOUVEAU DOMAINE ────────────────────────────────────────────
    const CONNUS = ["business", "strategie", "programmation", "marketing", "finance", "logistique", "securite", "crm", "default"];
    const sortis = new Set();
    for (const m of metiers.METIERS) sortis.add(C.domaineNaturel(m.id));
    for (const p of [...operationnels, ...inchanges.map((x) => x[0]), "bonjour"]) {
        sortis.add(C.arbitrer({ metier: "ecommerce", message: p }).domaine);
    }
    const inventes = [...sortis].filter((d) => !CONNUS.includes(d));
    verifier(!inventes.length,
        `la couche de compétence invente des domaines : ${inventes.join(", ")} — il y aurait deux ` +
        "classements du même message dans le projet");
}

// ══════════════════════════════════════════════════════════════════════════
// 5. CE QUE SAMII REÇOIT
// ══════════════════════════════════════════════════════════════════════════
{
    const bloc = C.pourLePrompt({ metier: "coiffeur", message: "comment remplir mes heures creuses" });
    verifier(bloc && bloc.cequiCoute && bloc.cequiCloche && bloc.cequiMarche,
        `le bloc envoyé à SAMII ne porte pas les trois phrases du métier : ${JSON.stringify(bloc)} — ` +
        "c'est exactement la connaissance qui n'arrivait jamais avant ce chantier");
    verifier(bloc.cequiCoute === metiers.fiche("coiffeur").perte,
        "le bloc recopie une phrase au lieu de la lire dans la source unique");

    // ── LE BLOC RESTE COMPACT ────────────────────────────────────────────
    //
    // `brain/prompts/index.js` sérialise le contexte ENTIER dans le prompt.
    // Tout ce qu'on pose ici est payé en jetons à chaque message, dans les
    // deux chats. Une fiche recopiée en entier, c'est la facture qui monte
    // sans que rien ne le dise.
    const taille = JSON.stringify(bloc).length;
    verifier(taille < 900,
        `le bloc métier pèse ${taille} caractères : il part dans CHAQUE message des deux chats`);

    // ── LA TENSION EST DITE À SAMII ──────────────────────────────────────
    const tendu = C.pourLePrompt({ metier: "ecommerce", message: "j'ai 20 commandes en retard" });
    verifier(tendu.attention && /logistique/.test(tendu.attention),
        `SAMII n'est pas prévenu que le message sort du terrain du métier : ${JSON.stringify(tendu)}`);
    const calme = C.pourLePrompt({ metier: "ecommerce", message: "comment augmenter mes ventes" });
    verifier(!calme.attention,
        "SAMII est averti d'une tension qui n'existe pas : l'avertissement perdrait tout son sens");

    // ── RIEN À DIRE → RIEN ENVOYÉ ────────────────────────────────────────
    verifier(C.pourLePrompt({ metier: null, message: "bonjour" }) === null,
        "un bloc vide est quand même posé dans le contexte : il occuperait des jetons sans rien apprendre");
}

// ══════════════════════════════════════════════════════════════════════════
// 6. LE MÉTIER ENTRE DANS LE CHOIX D'AGENT (chantier 8 × chantier 9)
// ══════════════════════════════════════════════════════════════════════════
{
    const agents = require(path.join(RACINE, "brain", "agents.js"));
    const PRO = { niveau: "pro", palier: "pro", mode: "autonome", audience: "souverain", workspaceId: "w1" };

    // Un e-commerçant en retard de livraison ne déclenche PAS une chaîne de
    // publication. C'est le croisement des deux chantiers.
    const retard = agents.choisir({
        message: "J'ai 20 commandes en retard",
        context: { ...PRO, metier: "ecommerce" },
    });
    verifier(retard.besoin === "reponse",
        `« 20 commandes en retard » ouvre la mission ${retard.missions.join(", ")} : SAMII ` +
        "préparerait une publication à quelqu'un qui a un problème de livraison");
    verifier(retard.domaine === "logistique",
        `le domaine retenu pour le choix d'agent est « ${retard.domaine} »`);

    // Et une vraie demande de contenu ouvre bien la chaîne, métier ou pas.
    const pub = agents.choisir({
        message: "Écris-moi une publication Facebook pour ma nouvelle collection",
        context: { ...PRO, metier: "pretaporter" },
    });
    verifier(pub.missions.includes("publication_sociale"),
        `une demande de publication chez un prêt-à-porter n'ouvre aucune chaîne ` +
        `(domaine=${pub.domaine}, raisons=${pub.raisons.join(" ; ")})`);
    verifier(pub.raisons.some((r) => /pretaporter/.test(r)),
        `le métier n'apparaît pas dans les raisons du choix (${pub.raisons.join(" ; ")}) : ` +
        "on ne saurait pas qu'il a été lu");

    // Le métier ne contourne AUCUNE permission : niveau Expert, pas de chaîne.
    const brime = agents.choisir({
        message: "Écris-moi une publication Facebook pour ma nouvelle collection",
        context: { ...PRO, niveau: "expert", metier: "pretaporter" },
    });
    verifier(brime.besoin === "reponse",
        "le métier fait sauter le plancher de niveau : connaître le métier de quelqu'un lui " +
        "ouvrirait des missions que son niveau n'autorise pas");
}

// ══════════════════════════════════════════════════════════════════════════
// 7. LE CONTEXTE SUIT : CHAT PUBLIC → INSCRIPTION → QG
// ══════════════════════════════════════════════════════════════════════════
//
// Deux interfaces, un seul SAMII. Ce que quelqu'un dit de lui avant d'avoir
// un compte doit exister encore après.
{
    const fs = require("fs");
    const vitrine = fs.readFileSync(path.join(RACINE, "routes", "vitrine.js"), "utf8");
    const api = fs.readFileSync(path.join(RACINE, "routes", "api.js"), "utf8");
    const inscription = fs.readFileSync(path.join(RACINE, "routes", "inscription.js"), "utf8");

    verifier(/competences\.deviner\(/.test(vitrine),
        "le chat public ne cherche aucun métier : quelqu'un pourrait expliquer son commerce " +
        "pendant dix messages sans que rien n'en soit gardé");
    verifier(/req\.session\.metier = vu\.metier/.test(vitrine),
        "le métier reconnu dans le chat public n'est pas posé en session : il serait perdu " +
        "à l'inscription");
    verifier(/!req\.session\.metier/.test(vitrine),
        "le chat public écrase un métier déjà connu : une phrase mal lue remplacerait ce que " +
        "la personne a réellement déclaré à l'inscription");

    // Le canal existait déjà. On vérifie qu'on s'y branche au lieu d'en créer un.
    verifier(/req\.session\.metier/.test(inscription),
        "routes/inscription.js ne lit plus le métier de la session : le pont serait coupé " +
        "à l'arrivée");

    // Les DEUX chats lisent le métier par la MÊME fonction.
    verifier(/competences\.pourLePrompt\(/.test(vitrine) && /competences\.pourLePrompt\(/.test(api),
        "les deux chats ne lisent pas le métier par la même fonction : il y aurait deux SAMII");

    // Et le QG le prend là où il est déjà, sans requête de plus.
    verifier(/req\.session\?\.metier \|\| memoireActuelle\?\.profil\?\.metier/.test(api),
        "le QG ne lit pas le métier de la session : il interrogerait la base à chaque message, " +
        "ou pire, ne saurait rien");

    // ── AUCUNE DUPLICATION DE RÈGLES ─────────────────────────────────────
    //
    // La garde contre le défaut que ce chantier devait éviter : une deuxième
    // table de domaines, ou une deuxième liste de métiers.
    const competencesSrc = fs.readFileSync(path.join(RACINE, "services", "competences.js"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    verifier(!/\bbusiness\b[\s\S]{0,80}\bmarketing\b[\s\S]{0,80}\bfinance\b[\s\S]{0,200}=/.test(
        competencesSrc.replace(/const (OPERATIONNELS|COMMERCIAUX)[\s\S]{0,120};/g, "")),
    "services/competences.js redéclare la liste des domaines : il y aurait deux classements");
    verifier(!/METIERS\s*=\s*\[/.test(competencesSrc),
        "services/competences.js redéclare une liste de métiers");
    verifier(/require\("\.\/metiers"\)/.test(competencesSrc) && /sovereign\/tables/.test(competencesSrc),
        "la couche de compétence ne lit pas les sources existantes : elle aurait les siennes");
}

// ══════════════════════════════════════════════════════════════════════════
// 8. LA CONNAISSANCE ATTEINT-ELLE VRAIMENT LE PROMPT ?
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CETTE SECTION A ÉTÉ AJOUTÉE APRÈS DEUX MUTATIONS SURVÉCUES, ET C'ÉTAIENT
// LES DEUX PLUS GRAVES.
//
// Neutraliser le bloc métier dans `brain/prompts/index.js`, puis dans
// `brain/prompts/vitrine.js`, ne faisait rien crier. Les vérifications
// d'au-dessus mesuraient que `pourLePrompt()` rend bien un objet et que les
// routes l'appellent — pas que SAMII le REÇOIT.
//
// Autrement dit : j'aurais pu ne rien brancher du tout dans les deux
// prompts, et la suite serait restée verte. C'est exactement « fichier
// modifié n'est pas fonctionnalité terminée ».
//
// On rend donc les deux prompts pour de vrai, et on cherche la phrase dans
// le texte qui partira au modèle.
(async () => {
    const fiche = metiers.fiche("coiffeur");
    const bloc = C.pourLePrompt({ metier: "coiffeur", message: "comment remplir mes heures creuses" });

    // ── LE CHAT PUBLIC ───────────────────────────────────────────────────
    //
    // On rend la consigne du VISITEUR par le constructeur canonique, avec
    // audience "public". Ce garde interrogeait brain/prompts/vitrine.js, qui
    // était un second cerveau complet ; ce fichier ne porte plus que la
    // mission, et c'est brain/prompts/index.js qui assemble. L'intention du
    // garde n'a pas bougé : la connaissance métier doit atteindre le texte
    // qui part au modèle pour un visiteur.
    const SAMII_PROMPT = require(path.join(RACINE, "brain", "prompts", "index.js"));
    const texteVitrine = await SAMII_PROMPT("comment remplir mes heures creuses", {
        audience: "public", langue: "fr", nbEchanges: 1, competence: bloc,
    });

    verifier(texteVitrine.includes(fiche.perte),
        "le chat public n'envoie PAS à SAMII ce que ce métier fait perdre : la connaissance " +
        "resterait exactement là où elle était avant le chantier 9 — dans une page web");
    verifier(texteVitrine.includes(fiche.defaut) && texteVitrine.includes(fiche.reponse),
        "le chat public n'envoie qu'une partie de la fiche métier");
    verifier(/ne récites JAMAIS|ne récite JAMAIS/i.test(texteVitrine),
        "rien n'interdit à SAMII de réciter la fiche : un visiteur s'entendrait expliquer son " +
        "propre métier par une machine");

    // Sans métier connu, rien ne doit être ajouté — le prompt public part à
    // chaque message et chaque ligne est payée.
    const texteNu = await SAMII_PROMPT("comment remplir mes heures creuses", {
        audience: "public", langue: "fr", nbEchanges: 1, competence: null,
    });
    verifier(!texteNu.includes("CE QUE TU SAIS DE SON MÉTIER"),
        "le chat public ajoute un bloc métier vide quand il ne connaît personne");
    verifier(texteVitrine.length > texteNu.length,
        "le bloc métier n'ajoute rien au prompt public : il n'est pas inséré");

    // ── LE CHAT DU QG ────────────────────────────────────────────────────
    //
    // Le prompt du QG est asynchrone (il charge les lois souveraines). Sans
    // base il les rate et continue — c'est son comportement normal, et c'est
    // ce qui permet de le rendre ici.
    const promptQG = require(path.join(RACINE, "brain", "prompts", "index.js"));
    const texteQG = await promptQG("comment remplir mes heures creuses", {
        audience: "souverain", niveau: "expert", metier: "coiffeur", competence: bloc,
    });

    verifier(texteQG.includes(fiche.perte),
        "le QG n'envoie PAS à SAMII ce que ce métier fait perdre : un marchand connecté, dont " +
        "on connaît pourtant le métier depuis son inscription, serait traité comme un inconnu");
    verifier(texteQG.includes(fiche.defaut) && texteQG.includes(fiche.reponse),
        "le QG n'envoie qu'une partie de la fiche métier");
    verifier(/ne récites JAMAIS|ne récite JAMAIS/i.test(texteQG),
        "rien n'interdit à SAMII de réciter la fiche dans le QG");
    verifier(/éclaire, il ne commande pas|réponds à CE QU'ELLE DEMANDE/i.test(texteQG),
        "le QG ne dit pas à SAMII que le métier éclaire sans commander : il répondrait métier " +
        "à quelqu'un qui pose une autre question");

    const texteQGNu = await promptQG("bonjour", { audience: "souverain", niveau: "expert" });
    verifier(!texteQGNu.includes("CE QUE TU SAIS DE SON MÉTIER"),
        "le QG ajoute un bloc métier vide : il partirait dans chaque message sans rien apprendre");

    // ── LA TENSION ARRIVE AUSSI, MOT POUR MOT ────────────────────────────
    const tendu = C.pourLePrompt({ metier: "ecommerce", message: "j'ai 20 commandes en retard" });
    const texteTendu = await promptQG("j'ai 20 commandes en retard", {
        audience: "souverain", niveau: "expert", metier: "ecommerce", competence: tendu,
    });
    // ⚠️ ON CHERCHE DANS LA SECTION LISIBLE, PAS DANS TOUT LE PROMPT.
    //
    // Première version : `texteTendu.includes(tendu.attention)`. Elle passait
    // même en retirant l'avertissement du bloc — parce que le prompt
    // sérialise AUSSI le contexte entier (`JSON.stringify(context)`), et que
    // `competence` s'y trouve. L'assertion était donc satisfaite par le vidage
    // JSON, pas par la consigne.
    //
    // Ce n'est pas un détail : une phrase noyée dans un objet JSON au milieu
    // d'un prompt n'a pas le même poids qu'une consigne écrite en clair sous
    // son titre. On vérifie donc qu'elle est DANS la section, c'est-à-dire
    // avant le vidage du contexte.
    const sectionQG = texteTendu.slice(
        texteTendu.indexOf("CE QUE TU SAIS DE SON MÉTIER"),
        texteTendu.indexOf("CONTEXTE ACTUEL"));
    verifier(sectionQG.includes(tendu.attention),
        "l'avertissement « le message sort du terrain de ce métier » n'est pas écrit en clair " +
        "dans la section métier : noyé dans le vidage JSON du contexte, il n'a pas le poids " +
        "d'une consigne — SAMII répondrait vente à quelqu'un qui a un problème de livraison");

    // ── VERDICT ──────────────────────────────────────────────────────────
    if (echecs.length) {
        console.log(`\n❌ compétences : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exit(1);
    }
    console.log(`✅ compétences : ${verifs} vérifications passées`);
    process.exit(0);
})().catch((err) => {
    console.error("❌ compétences : la suite n'a pas pu être jouée —", err.message);
    console.error(err.stack);
    process.exit(1);
});

