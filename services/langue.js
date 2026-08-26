// ==========================================================================
// SAMII OS — FRANÇAIS / ANGLAIS SUR LES PAGES DE L'ACADÉMIE
//
// POURQUOI, ET POURQUOI COMME ÇA.
//
// Les partenaires qui arrivent — Mexique, Nigeria — ne lisent pas le français.
// Leur envoyer l'Académie en français, c'est leur envoyer un mur.
//
// LA CLÉ DE TRADUCTION EST LA PHRASE FRANÇAISE ELLE-MÊME. Pas un identifiant
// du genre `academie.titre_principal`. Trois raisons, et elles comptent :
//   1. Une vue reste lisible. `L("Le travail qui attend")` se comprend en la
//      lisant ; `L("besoins.titre")` oblige à ouvrir un second fichier.
//   2. Une traduction manquante affiche le français, jamais une clé nue. Un
//      visiteur voit une page en deux langues — moche, mais lisible. Avec des
//      identifiants, il verrait « academie.titre_principal ».
//   3. On ne peut pas oublier de déclarer une clé : le texte EST la clé.
//
// Le prix à payer : changer une phrase française casse sa traduction. C'est
// voulu — une phrase modifiée doit être retraduite, et le retour au français
// est le bon signal.
//
// LE CHOIX DE LANGUE SE MÉMORISE. Un partenaire qui met ?lang=en une fois ne
// doit pas le remettre à chaque clic. On le garde en session, et la première
// visite suit l'en-tête du navigateur — un Mexicain arrive en anglais sans
// rien demander.
// ==========================================================================

const LANGUES = ["fr", "en", "ar"];
const DEFAUT = "fr";

// ── Le dictionnaire ──────────────────────────────────────────────────────
// Français → anglais. Les espaces multiples et les retours à la ligne sont
// réduits à un espace avant la recherche : une phrase coupée sur trois lignes
// dans un gabarit reste la même phrase.
const EN = {
    // ── Le bouton de retour ──────────────────────────────────────────────
    // Composé par services/navigation.js : « Retour à » + la base du compte.
    // Les deux morceaux sont traduits séparément parce que la base change
    // selon qui regarde, pas selon la page.
    "Retour": "Back",
    "Retour à": "Back to",
    "le QG": "the HQ",
    "la Tour de contrôle": "the control tower",
    "mon espace": "my workspace",
    "l'accueil": "the home page",

    // ── Navigation, commun ───────────────────────────────────────────────
    // Les titres d'onglet : ce que voit un partenaire dans sa barre de
    // navigateur avant même d'avoir lu la page.
    "L'Académie — SAMII OS": "The Academy — SAMII OS",
    "Construire — Académie SAMII": "Build — SAMII Academy",
    "Le travail qui attend — L'Académie": "Work waiting for you — The Academy",
    "Mon contrat — Académie SAMII": "My agreement — SAMII Academy",
    "Trouver quelqu'un — Académie SAMII": "Find someone — SAMII Academy",
    "Mon espace développeur — SAMII OS": "My developer space — SAMII OS",
    "Apprendre": "Learn",
    "La vitrine": "Marketplace",
    "Mon espace": "My space",
    "Mon contrat": "My agreement",
    "Documentation": "Documentation",
    "Comment ça marche": "How it works",
    "Créer avec SAMII": "Build with SAMII",
    "Créer avec SAMII →": "Build with SAMII →",
    "Le travail qui attend": "Work waiting for you",
    "← L'Académie": "← The Academy",
    "← Retour à l'Académie": "← Back to the Academy",
    "← Tous les besoins": "← All requests",
    "Retour à mes outils": "Back to my tools",
    "Se connecter →": "Sign in →",
    "Chercher": "Search",
    "Tout": "All",
    "Voir tout →": "See everything →",
    "Voir →": "View →",
    "Copier": "Copy",
    "Nom": "Name",
    "État": "Status",
    "Prix": "Price",
    "Délai": "Timeline",
    "Devise": "Currency",
    "Version": "Version",
    "Rôle": "Role",
    "Date": "Date",
    "Quand": "When",
    "Appel": "Call",
    "Réponse": "Response",
    "Permission": "Permission",
    "Créer": "Create",
    "Supprimer": "Delete",
    "Répondre": "Answer",
    "Répondre →": "Answer →",

    // ── La vitrine ───────────────────────────────────────────────────────
    "L'Académie": "The Academy",
    "Les solutions qui font tourner un commerce, et les gens qui les construisent. Dis ton métier, on te montre ce qui existe pour toi.":
        "The solutions that keep a business running, and the people who build them. Tell us your trade and we will show you what exists for you.",
    "Outil SAMII": "SAMII tool",
    "— construit et maintenu par nous, inclus dans ton abonnement.":
        "— built and maintained by us, included in your plan.",
    "Application": "Application",
    "— construite par un développeur de l'Académie, sur notre API.":
        "— built by an Academy developer, on our API.",
    "Tous les métiers": "All trades",
    "Rien ne correspond à cette recherche.": "Nothing matches this search.",
    "Ce qui manque ici, c'est peut-être toi": "What is missing here might be you",
    "Développeur, agence, intégrateur : construis sur l'API de SAMII et pose ton travail dans cette vitrine. Les marchands y sont déjà. Entrer et publier ne coûtent rien — SAMII prend":
        "Developer, agency, integrator: build on the SAMII API and place your work in this marketplace. The merchants are already here. Joining and publishing cost nothing — SAMII takes",
    "% le jour où tu vends, et rien avant.": "% the day you sell, and nothing before.",
    "déjà décrit ce qu'il leur manque, avec un budget.": "already described what they need, with a budget.",
    "Voir le travail qui attend →": "See the work waiting →",
    "Ce qu'il te faut : relancer mes clients, prendre les RDV…":
        "What you need: follow up with customers, take bookings…",
    "solution": "solution",
    "pour": "for",
    "marchand": "merchant",

    // ── Construire sur SAMII ─────────────────────────────────────────────
    "Construire sur SAMII": "Build with SAMII",
    "Tu es dans l'atelier. Ton application demande des permissions, un marchand les accorde, et elle travaille dans son espace — jamais au-delà de ce qu'il a donné.":
        "This is the workshop. Your application requests permissions, a merchant grants them, and it works inside their workspace — never beyond what they gave.",
    "Sur quoi tu construis, exactement": "What exactly you build on",
    "Les cartes que tu vois dans la vitrine — Arsenal, Automatisations, Griot, Miroir — sont les outils que":
        "The cards you see in the marketplace — Arsenal, Automations, Griot, Mirror — are the tools that",
    "SAMII fournit déjà aux marchands": "SAMII already provides to merchants",
    ". Ce ne sont pas des briques de développement, et tu ne construis pas « dedans ».":
        ". They are not developer building blocks, and you do not build \"inside\" them.",
    "Toi, tu construis sur": "You build on",
    "l'API": "the API",
    ": commandes, rendez-vous, clients, espaces, webhooks. Ton application vit chez toi, sur ton serveur, dans le langage que tu veux — elle parle à SAMII par HTTP. Une fois publiée, elle apparaît dans la même vitrine que ces cartes, sous l'étiquette":
        ": orders, appointments, customers, workspaces, webhooks. Your application lives on your own server, in the language you choose — it talks to SAMII over HTTP. Once published, it appears in the same marketplace as these cards, labelled",
    ", et le marchand l'installe comme le reste.": ", and the merchant installs it like anything else.",
    "Ouvrir mon espace développeur →": "Open my developer space →",
    "Terrain d'essai, clés, applications et revenus — tout au même endroit.":
        "Sandbox, keys, applications and revenue — all in one place.",
    "Par où commencer": "Where to start",
    "Lis ce que l'API sait faire": "Read what the API can do",
    "REST, JSON, jeton Bearer. Commandes, rendez-vous, clients, espaces. Aucun SDK à installer : un appel HTTP suffit.":
        "REST, JSON, Bearer token. Orders, appointments, customers, workspaces. No SDK to install: one HTTP call is enough.",
    "Ouvrir la documentation →": "Open the documentation →",
    "Prends une clé sur ton propre espace": "Take a key on your own workspace",
    "Avant de déclarer une application, teste avec ta clé et tes propres données : c'est le chemin le plus court entre une idée et un premier appel qui répond.":
        "Before declaring an application, test with your own key and your own data: it is the shortest path between an idea and a first call that answers.",
    "Mes clés et webhooks →": "My keys and webhooks →",
    "Déclare ton application": "Declare your application",
    "Nom, description, URL de webhook, et surtout : les permissions dont elle a réellement besoin. C'est ce que le marchand verra avant d'approuver — demander trop est le meilleur moyen d'être refusé.":
        "Name, description, webhook URL, and above all: the permissions it genuinely needs. This is what the merchant sees before approving — asking for too much is the surest way to be refused.",
    "Déclarer une application →": "Declare an application →",
    "Publie-la au catalogue": "Publish it to the catalogue",
    "En brouillon, elle n'est installable que par toi — de quoi la finir tranquillement. Publiée, elle apparaît chez les marchands de SAMII.":
        "As a draft, only you can install it — room to finish it calmly. Once published, it appears to SAMII merchants.",
    "Voir le catalogue →": "See the catalogue →",
    "Les trois règles qui ne bougeront pas": "Three rules that will not change",
    "Ton application ne choisit pas ses droits": "Your application does not choose its own rights",
    "Elle demande. C'est l'approbation du marchand qui crée la clé, et cette clé ne peut jamais porter plus que ce qui a été demandé":
        "It requests. The merchant's approval creates the key, and that key can never carry more than what was requested",
    "accordé.": "granted.",
    "Le marchand reprend quand il veut": "The merchant can take it back at any time",
    "Un bouton, et l'accès meurt dans la seconde. Il n'a pas à comprendre ce qu'est une clé pour reprendre ce qu'il a donné. Chaque appel que tu fais est inscrit à son journal.":
        "One button, and access dies within the second. They do not need to understand what a key is to take back what they gave. Every call you make is written to their log.",
    "Une installation vaut pour un seul espace": "One installation, one workspace",
    "Installer ton application chez un client n'ouvre rien chez les autres — même pour une agence qui gère les deux.":
        "Installing your application for one client opens nothing at another — even for an agency managing both.",
    "Et l'argent": "And the money",
    "Publier ne coûte rien. Installer gratuitement ne coûte rien. SAMII prend":
        "Publishing costs nothing. Free installs cost nothing. SAMII takes",
    "% le jour où ton application est vendue — et rien avant.":
        "% the day your application is sold — and nothing before.",
    "Relire le contrat →": "Read the agreement again →",
    "Pourquoi construire ici": "Why build here",
    "Les clients sont déjà là": "The customers are already here",
    "Tu ne pars pas d'une page blanche. Ton application est proposée aux marchands qui utilisent SAMII tous les jours, dans leur écran de travail.":
        "You do not start from an empty room. Your application is offered to merchants who use SAMII every day, inside their working screen.",
    "L'infrastructure est faite": "The infrastructure is done",
    "Commandes, rendez-vous, clients, WhatsApp, Telegram, Instagram, Gmail, agenda : c'est branché. Tu écris ce que toi seul sais faire.":
        "Orders, appointments, customers, WhatsApp, Telegram, Instagram, Gmail, calendar: already wired. You write only what you alone can do.",
    "Les permissions te protègent": "Permissions protect you",
    "Ton application demande, le marchand accorde. Tu ne détiens jamais plus que ce qu'on t'a donné — et lui peut le reprendre d'un geste.":
        "Your application requests, the merchant grants. You never hold more than what you were given — and they can take it back in one move.",
    "Tu gardes tout": "You keep everything",
    "Ton code, ta marque, tes clients. SAMII est ton partenaire de vente, pas le propriétaire de ton travail.":
        "Your code, your brand, your customers. SAMII is your sales partner, not the owner of your work.",
    "Agences &amp; intégrateurs — deux façons de travailler avec nous":
        "Agencies &amp; integrators — two ways to work with us",
    "OFFRE 01": "OPTION 01",
    "OFFRE 02": "OPTION 02",
    "Vous construisez, on porte la machine": "You build, we carry the machine",
    "Vous gardez votre produit et votre marque. SAMII devient le moteur en dessous : une clé pour tout votre portefeuille, un espace isolé par client.":
        "You keep your product and your brand. SAMII becomes the engine underneath: one key for your whole portfolio, an isolated workspace per client.",
    "Une seule clé d'agence, l'espace client visé tient dans un en-tête":
        "A single agency key — the target client workspace fits in one header",
    "Webhooks signés : une commande WhatsApp déclenche le même événement qu'un appel API":
        "Signed webhooks: a WhatsApp order fires the same event as an API call",
    "Vos clients restent vos clients — chacun garde son accès":
        "Your clients stay your clients — each keeps their own access",
    "Facturé à l'usage, pas au client": "Billed on usage, not per client",
    "Lire la documentation →": "Read the documentation →",
    "Vous louez le QG, sous votre marque": "You rent the HQ, under your own brand",
    "Rien à construire. Vous ouvrez l'espace d'un client en quelques minutes, vous les voyez tous d'un seul écran, et un besoin manquant, notre équipe le développe.":
        "Nothing to build. You open a client workspace in minutes, you see them all from one screen, and if something is missing our team builds it.",
    "Multi-espaces, un seul contrat": "Many workspaces, one contract",
    "Confirmations et messages sans limite": "Unlimited confirmations and messages",
    "Un module vous manque ? On le construit": "Missing a module? We build it",
    "Accompagnement dédié — sur devis": "Dedicated support — on quotation",
    "Voir le palier Société →": "See the Enterprise plan →",
    "WhatsApp — deux offres, au choix": "WhatsApp — two options, your choice",
    "A · VOUS AVEZ DÉJÀ WHATSAPP": "A · YOU ALREADY HAVE WHATSAPP",
    "On se pose au-dessus du vôtre": "We sit on top of yours",
    "Compte WhatsApp Business déjà approuvé, numéro déjà en service chez votre fournisseur officiel ? Ne changez rien. SAMII s'y branche.":
        "WhatsApp Business account already approved, number already live with your official provider? Change nothing. SAMII plugs into it.",
    "Votre numéro, votre compte Meta, votre fournisseur : inchangés":
        "Your number, your Meta account, your provider: unchanged",
    "Fournisseur officiel ou API Cloud en direct": "Official provider or Cloud API directly",
    "La réception des messages est déclarée pour vous, sans console tierce":
        "Inbound message delivery is configured for you, with no third-party console",
    "Inclus dans votre abonnement, sans supplément": "Included in your plan, at no extra cost",
    "Brancher mon numéro →": "Connect my number →",
    "B · VOUS N'AVEZ PAS WHATSAPP": "B · YOU DO NOT HAVE WHATSAPP",
    "On vous le fournit": "We provide it",
    "Pas de compte approuvé, pas de vérification à attendre, pas de dossier à monter. Vous passez par le nôtre et vous démarrez aujourd'hui.":
        "No approved account, no verification to wait for, no paperwork. You go through ours and you start today.",
    "WhatsApp Business API par notre compte vérifié": "WhatsApp Business API through our verified account",
    "Aucune démarche de vérification de votre côté": "No verification process on your side",
    "Essai immédiat de 3 jours sur le numéro partagé": "Immediate 3-day trial on the shared number",
    "Sur devis, au palier Société": "On quotation, on the Enterprise plan",
    "Nous contacter →": "Contact us →",

    // ── Les besoins ──────────────────────────────────────────────────────
    "Des marchands décrivent ici ce qu'il leur manque. Publier un besoin ne coûte rien et n'engage à rien. Répondre non plus — SAMII prend":
        "Merchants describe here what they are missing. Posting a request costs nothing and commits you to nothing. Answering costs nothing either — SAMII takes",
    "% le jour où tu es payé, et rien avant.": "% the day you get paid, and nothing before.",
    "besoin": "request",
    "ouvert": "open",
    "Le nombre de réponses est affiché à tout le monde : zéro réponse veut dire que la place est libre. Les propositions chiffrées, elles, ne sont vues que par le marchand — ici on se départage sur le travail, pas en cassant le prix du voisin.":
        "The number of answers is shown to everyone: zero answers means the field is open. The priced proposals, however, are seen only by the merchant — here you win on the work, not by undercutting your neighbour.",
    "Personne n'a encore répondu": "Nobody has answered yet",
    "réponse": "answer",
    "Aucun besoin ne correspond à cette recherche.": "No request matches this search.",
    "Aucun besoin publié pour l'instant. Si tu es marchand, décris le tien ci-dessous — c'est ce qui fait venir ceux qui savent le construire.":
        "No requests posted yet. If you are a merchant, describe yours below — that is what brings in the people who know how to build it.",
    "Décrire mon besoin": "Describe what I need",
    "Tu n'as pas besoin de savoir ce qu'il te faut techniquement — décris le problème. C'est gratuit, tu ne t'engages à rien, et tu choisis qui te répond (ou personne).":
        "You do not need to know the technical answer — describe the problem. It is free, you commit to nothing, and you choose who answers (or nobody).",
    "Connecte-toi pour publier ton besoin.": "Sign in to post your request.",
    "En une phrase, qu'est-ce qu'il te manque ?": "In one sentence, what are you missing?",
    "Raconte": "Tell us more",
    "C'est cette description qui décide qui te répond — quelques phrases valent mieux qu'une ligne.":
        "This description decides who answers you — a few sentences beat a single line.",
    "Ton métier": "Your trade",
    "Non précisé": "Not specified",
    "Budget minimum": "Minimum budget",
    "Budget maximum": "Maximum budget",
    "USD — dollar": "USD — dollar",
    "EUR — euro": "EUR — euro",
    "DZD — dinar algérien": "DZD — Algerian dinar",
    "MAD — dirham marocain": "MAD — Moroccan dirham",
    "XOF — franc CFA": "XOF — CFA franc",
    "NGN — naira": "NGN — naira",
    "Laisse le budget vide si tu ne sais pas : les développeurs te proposeront un prix. Un ordre de grandeur, même large, fait juste gagner du temps à tout le monde.":
        "Leave the budget empty if you do not know: developers will propose a price. A rough range, even a wide one, simply saves everyone time.",
    "Publier mon besoin": "Post my request",
    "Mes besoins": "My requests",
    "Ferme un besoin dès qu'il est réglé : laisser un besoin ouvert fait travailler des gens pour rien, et c'est ce qui vide une place comme celle-ci.":
        "Close a request as soon as it is settled: leaving it open makes people work for nothing, and that is what empties a marketplace like this one.",
    "reçue": "received",
    "Ce que tu sais faire : boutique, rendez-vous, livraison…":
        "What you can build: online shop, bookings, delivery…",
    "Ex. : mes clients me demandent où est leur colis toute la journée":
        "e.g. my customers ask me where their parcel is all day long",
    "Ce que tu fais aujourd'hui, ce qui te fait perdre du temps, et à quoi ressemblerait la bonne solution. Plus c'est concret, mieux on te répond.":
        "What you do today, what wastes your time, and what the right solution would look like. The more concrete, the better the answers.",
    "Facultatif": "Optional",

    // ── Le détail d'un besoin ────────────────────────────────────────────
    "· publié le": "· posted on",
    "Les propositions reçues": "Proposals received",
    "Personne d'autre que toi ne voit ces prix. Prends le temps de comparer : le moins cher n'est pas toujours celui qui a compris ton problème.":
        "Nobody but you sees these prices. Take the time to compare: the cheapest is not always the one who understood your problem.",
    "Personne n'a encore répondu. C'est normal les premiers jours — les développeurs regardent la liste avant de se lancer.":
        "Nobody has answered yet. That is normal in the first days — developers watch the list before stepping in.",
    "Fermer ce besoin": "Close this request",
    "Dès que c'est réglé, ferme-le. Un besoin déjà traité qui reste ouvert fait travailler des gens pour rien — et c'est ce qui vide une place comme celle-ci.":
        "As soon as it is settled, close it. A handled request left open makes people work for nothing — and that is what empties a marketplace like this one.",
    "J'ai choisi quelqu'un": "I have chosen someone",
    "Ce n'est plus d'actualité": "No longer relevant",
    "Ce besoin n'accepte plus de réponses.": "This request no longer accepts answers.",
    "Tu peux la modifier tant que le besoin est ouvert — elle remplacera la précédente. Le marchand voit toujours la dernière version.":
        "You can edit it while the request is open — it replaces the previous one. The merchant always sees the latest version.",
    "Dis comment tu t'y prendrais, en quelques phrases. Ton prix et ton délai ne sont vus que par le marchand. Rien n'est dû tant qu'il n'a pas choisi — et SAMII ne prend ses":
        "Say how you would go about it, in a few sentences. Your price and timeline are seen only by the merchant. Nothing is owed until they choose — and SAMII only takes its",
    "% que le jour où tu es payé.": "% the day you get paid.",
    "Ta proposition": "Your proposal",
    "Envoyée le": "Sent on",
    "Connecte-toi pour répondre à ce besoin.": "Sign in to answer this request.",
    "Comment tu t'y prendrais": "How you would go about it",
    "Le marchand ne te connaît pas : c'est ce texte qui le décide, pas ton prix.":
        "The merchant does not know you: this text decides, not your price.",
    "Ton prix": "Your price",
    "Délai (jours)": "Timeline (days)",
    "Ce que tu as compris du problème, comment tu le résous, ce que tu as déjà fait de semblable.":
        "What you understood of the problem, how you solve it, what similar work you have done.",

    // ── L'espace développeur ─────────────────────────────────────────────
    "Mon espace développeur": "My developer space",
    "Un terrain d'essai déjà rempli, ta clé, tes applications et ce qu'elles rapportent. Rien à installer, rien à configurer ailleurs.":
        "A sandbox already full of data, your key, your applications and what they earn. Nothing to install, nothing to configure elsewhere.",
    "Ta clé d'essai — copie-la maintenant": "Your sandbox key — copy it now",
    "Nous n'en gardons qu'une empreinte : elle ne sera plus jamais affichée.":
        "We keep only a fingerprint of it: it will never be shown again.",
    "1 · Mon terrain d'essai": "1 · My sandbox",
    "Un espace complet avec de vrais clients, de vraies commandes à tous les stades et des rendez-vous passés et à venir. Aucun message n'en sort jamais : personne ne sera dérangé, quoi que tu déclenches.":
        "A complete workspace with real customers, real orders at every stage, and past and future appointments. Nothing ever leaves it: nobody will be disturbed, whatever you trigger.",
    "14 commandes,": "14 orders,",
    "8 rendez-vous,": "8 appointments,",
    "clients — prêts à l'appel.": "customers — ready for your first call.",
    "Créer ce terrain": "Create this sandbox",
    "Nouvelle clé": "New key",
    "Remettre à neuf": "Reset",
    "Pas encore créé.": "Not created yet.",
    "2 · Mon premier appel": "2 · My first call",
    "Colle ça dans un terminal après avoir remplacé la clé. Tu dois voir tes commandes d'essai revenir en JSON — c'est le signe que tout est en place.":
        "Paste this into a terminal after replacing the key. You should see your sandbox orders come back as JSON — that is the sign everything is in place.",
    "Copier la commande": "Copy the command",
    "3 · Le travail qui attend": "3 · Work waiting for you",
    "Des marchands ont décrit ce qu'il leur manque. Répondre ne coûte rien et ne t'engage à rien : tu proposes ton prix, le marchand choisit. SAMII prend":
        "Merchants have described what they are missing. Answering costs nothing and commits you to nothing: you propose your price, the merchant chooses. SAMII takes",
    "% le jour où tu es payé, et rien avant.  ": "% the day you get paid, and nothing before.",
    "Voir tous les besoins →": "See all requests →",
    "Aucun besoin ouvert en ce moment.": "No open requests right now.",
    "Surveiller la liste →": "Watch the list →",
    "Ma proposition": "My proposal",
    "État du besoin": "Request status",
    "4 · Mes applications": "4 · My applications",
    "En brouillon, ton application n'est installable que par toi — de quoi la finir tranquillement. Publiée, elle apparaît dans la vitrine et les marchands peuvent l'installer.":
        "As a draft, only you can install your application — room to finish it calmly. Once published, it appears in the marketplace and merchants can install it.",
    "Installations": "Installs",
    "Permissions demandées": "Permissions requested",
    "Aucune application déclarée.": "No application declared.",
    "5 · Ce que mes clés ont fait": "5 · What my keys actually did",
    "Les derniers appels passés avec tes clés — y compris ceux qui ont été refusés, et pourquoi. C'est là qu'on comprend une intégration qui ne marche pas.":
        "The latest calls made with your keys — including the ones that were refused, and why. This is where a broken integration explains itself.",
    "Aucun appel enregistré pour l'instant.": "No calls recorded yet.",
    "6 · Ce que ça rapporte": "6 · What it earns",
    "ventes": "sales",
    "montant brut": "gross amount",
    "ta part": "your share",
    "à te reverser": "to be paid out",

    // ── Rejoindre l'Académie ─────────────────────────────────────────────
    "pour entrer": "to join",
    "pour publier": "to publish",
    "par transaction": "per transaction",
    "✅ Tu as déjà accepté la version": "✅ You have already accepted version",
    "de ce contrat.": "of this agreement.",
    "Retourner à l'Académie →": "Back to the Academy →",
    "Je viens construire": "I am here to build",
    "Développeur, agence, intégrateur. Tu crées des applications sur SAMII et tu les vends ici.":
        "Developer, agency, integrator. You build applications on SAMII and sell them here.",
    "Je viens chercher": "I am here to find someone",
    "Marchand ou entreprise. Tu cherches quelqu'un pour construire ce dont tu as besoin.":
        "Merchant or company. You are looking for someone to build what you need.",
    "J'ai lu et j'accepte le contrat de l'Académie SAMII (version":
        "I have read and accept the SAMII Academy agreement (version",
    "Je comprends que SAMII est mon partenaire de commercialisation et prélève":
        "I understand that SAMII is my sales partner and takes",
    "sur chaque transaction conclue ici, et que je reste propriétaire de mon code, de ma marque et de mes clients.":
        "on every transaction closed here, and that I remain the owner of my code, my brand and my customers.",
    "Entrer dans l'Académie": "Join the Academy",
    "Ce contrat est daté et conservé avec l'empreinte du texte exact que tu acceptes. Tu peux le relire à tout moment depuis":
        "This agreement is dated and stored with a fingerprint of the exact text you accept. You can read it again at any time from",
    "mon contrat": "my agreement",

    // ── Mon contrat ──────────────────────────────────────────────────────
    "Ce qui te lie à l'Académie, et ce que ça t'a rapporté.":
        "What binds you to the Academy, and what it has earned you.",
    "ventes conclues": "sales closed",
    "ta part (": "your share (",
    "Ce que tu as accepté": "What you accepted",
    "Empreinte du texte": "Text fingerprint",
    "Aucune acceptation enregistrée.": "No acceptance recorded.",
    "Le texte en vigueur — version": "The agreement in force — version",

    // ── Trouver quelqu'un ────────────────────────────────────────────────
    "En construction": "Under construction",
    "Trouver quelqu'un": "Find someone",
    "La place où les marchands décrivent ce qu'il leur faut et où les développeurs et agences de l'Académie répondent. Elle n'est pas encore ouverte — on préfère le dire que de vous laisser la découvrir vide.":
        "The place where merchants describe what they need and where Academy developers and agencies answer. It is not open yet — we would rather say so than let you find it empty.",
    "Des profils avec un passé.": "Profiles with a track record.",
    "Compétences, langues, pays, réalisations — et les missions déjà livrées ici, que personne ne peut inventer.":
        "Skills, languages, countries, work delivered — including the projects completed here, which nobody can invent.",
    "Un besoin décrit en clair.": "A request written in plain words.",
    "Vous écrivez ce qu'il vous faut ; ceux qui savent le faire répondent avec un prix et un délai.":
        "You write what you need; those who can do it answer with a price and a timeline.",
    "L'accord fournit l'accès.": "The agreement grants the access.",
    "Quand vous validez, la clé est créée et les permissions posées — le développeur peut travailler tout de suite, sans que vous ayez à lui envoyer quoi que ce soit.":
        "When you approve, the key is created and the permissions are set — the developer can start immediately, without you sending anything.",
    "L'argent est retenu jusqu'à la livraison.": "The money is held until delivery.",
    "Vous payez à l'accord, le développeur est réglé quand vous validez. SAMII prend":
        "You pay on agreement, the developer is paid when you approve. SAMII takes",
    "%, et rien tant que rien n'est vendu.": "%, and nothing until something is sold.",
    "En attendant, construire →": "In the meantime, build →",
    "Tu es déjà dans l'Académie. Ton profil sera prêt le jour de l'ouverture.":
        "You are already in the Academy. Your profile will be ready on opening day.",
    "Prendre ma place →": "Take my place →",
    "Entrer est gratuit — une page à lire, une case à cocher.":
        "Joining is free — one page to read, one box to tick.",
    "Les premiers inscrits seront les premiers visibles.":
        "The first to join will be the first to be seen.",
};

// ── L'arabe ──────────────────────────────────────────────────────────────
// L'arabe s'écrit de droite à gauche : ce n'est pas qu'une traduction, c'est
// une mise en page miroir. `dir="rtl"` sur la racine suffit pour l'essentiel
// — le navigateur retourne le texte, les listes, les tableaux et les marges.
// Ce qu'il ne retourne PAS, ce sont les positions posées en dur (le sélecteur
// de langue en bas à droite) : elles se corrigent au cas par cas.
//
// Arabe standard moderne, pas de dialecte : un marchand algérien, marocain ou
// égyptien doit lire la même chose sans effort.
const AR = {
    // ── Navigation, commun ───────────────────────────────────────────────
    "L'Académie — SAMII OS": "الأكاديمية — SAMII OS",
    "Le travail qui attend — L'Académie": "العمل في انتظارك — الأكاديمية",
    "Mon espace développeur — SAMII OS": "مساحة المطوّر — SAMII OS",
    "Construire — Académie SAMII": "البناء — أكاديمية SAMII",
    "Mon contrat — Académie SAMII": "عقدي — أكاديمية SAMII",
    "Trouver quelqu'un — Académie SAMII": "البحث عن شخص — أكاديمية SAMII",
    "Retour": "رجوع",
    "Retour à": "العودة إلى",
    "le QG": "مركز القيادة",
    "la Tour de contrôle": "برج المراقبة",
    "mon espace": "مساحتي",
    "l'accueil": "الصفحة الرئيسية",
    "Apprendre": "تعلّم",
    "La vitrine": "المتجر",
    "Mon espace": "مساحتي",
    "Mon contrat": "عقدي",
    "Documentation": "التوثيق",
    "Comment ça marche": "كيف يعمل",
    "Créer avec SAMII": "ابنِ مع SAMII",
    "Créer avec SAMII →": "ابنِ مع SAMII →",
    "Le travail qui attend": "العمل في انتظارك",
    "← L'Académie": "← الأكاديمية",
    "← Retour à l'Académie": "← العودة إلى الأكاديمية",
    "← Tous les besoins": "← كل الطلبات",
    "Se connecter →": "تسجيل الدخول →",
    "Chercher": "بحث",
    "Tout": "الكل",
    "Voir tout →": "عرض الكل →",
    "Voir →": "عرض →",
    "Copier": "نسخ",
    "Nom": "الاسم",
    "État": "الحالة",
    "Prix": "السعر",
    "Délai": "المدة",
    "Devise": "العملة",
    "Version": "الإصدار",
    "Rôle": "الدور",
    "Date": "التاريخ",
    "Quand": "متى",
    "Appel": "الطلب",
    "Réponse": "الرد",
    "Permission": "الإذن",
    "Créer": "إنشاء",
    "Supprimer": "حذف",
    "Répondre": "الرد",
    "Répondre →": "الرد →",
    "Client": "العميل",
    "Métier": "المهنة",
    "Pays": "البلد",
    "Activité": "النشاط",
    "Entrer": "دخول",
    "Aujourd'hui": "اليوم",
    "À traiter": "قيد المعالجة",
    "Attention": "تنبيه",
    "Déconnexion": "تسجيل الخروج",
    "Paramètres": "الإعدادات",
    "Marketplace": "السوق",
    "Academy": "الأكاديمية",
    "Community": "المجتمع",
    "Parrainage": "الإحالة",
    "Pilotage": "القيادة",
    "Ma flotte": "أسطولي",
    "Ressources OG": "موارد OG",
    "Conditions du partenariat": "شروط الشراكة",

    // ── La vitrine ───────────────────────────────────────────────────────
    "L'Académie": "الأكاديمية",
    "Les solutions qui font tourner un commerce, et les gens qui les construisent. Dis ton métier, on te montre ce qui existe pour toi.":
        "الحلول التي تُدير التجارة، والأشخاص الذين يبنونها. قل لنا مهنتك ونعرض لك ما هو متاح.",
    "Outil SAMII": "أداة SAMII",
    "Application": "تطبيق",
    "Tous les métiers": "كل المهن",
    "Rien ne correspond à cette recherche.": "لا شيء يطابق هذا البحث.",
    "Ce qui manque ici, c'est peut-être toi": "ما ينقص هنا قد يكون أنت",

    // ── Les besoins ──────────────────────────────────────────────────────
    "besoin": "طلب",
    "ouvert": "مفتوح",
    "réponse": "رد",
    "Décrire mon besoin": "اشرح ما أحتاجه",
    "Publier mon besoin": "نشر طلبي",
    "Mes besoins": "طلباتي",
    "Ton métier": "مهنتك",
    "Non précisé": "غير محدد",
    "Budget minimum": "الميزانية الدنيا",
    "Budget maximum": "الميزانية القصوى",
    "Ton prix": "سعرك",
    "Délai (jours)": "المدة (أيام)",
    "Raconte": "اشرح أكثر",
    "Ta proposition": "عرضك",
    "Les propositions reçues": "العروض المستلمة",
    "Fermer ce besoin": "إغلاق هذا الطلب",
    "J'ai choisi quelqu'un": "لقد اخترت شخصاً",
    "Ce n'est plus d'actualité": "لم يعد الأمر قائماً",
    "Connecte-toi pour publier ton besoin.": "سجّل الدخول لنشر طلبك.",
    "Connecte-toi pour répondre à ce besoin.": "سجّل الدخول للرد على هذا الطلب.",
    "Aucun besoin ne correspond à cette recherche.": "لا يوجد طلب يطابق هذا البحث.",
    "Personne n'a encore répondu": "لم يردّ أحد بعد",

    // ── L'espace développeur ─────────────────────────────────────────────
    "Mon espace développeur": "مساحة المطوّر",
    "Nouvelle clé": "مفتاح جديد",
    "Remettre à neuf": "إعادة التهيئة",
    "Créer ce terrain": "إنشاء هذه المساحة",
    "Pas encore créé.": "لم يُنشأ بعد.",
    "Copier la commande": "نسخ الأمر",
    "Ma proposition": "عرضي",
    "Installations": "التنصيبات",
    "Permissions demandées": "الأذونات المطلوبة",
    "Aucune application déclarée.": "لا يوجد تطبيق مُصرَّح به.",
    "Aucun appel enregistré pour l'instant.": "لا توجد طلبات مسجّلة حتى الآن.",
    "ventes": "مبيعات",
    "montant brut": "المبلغ الإجمالي",
    "ta part": "حصتك",
    "à te reverser": "مستحق لك",
    "Voir tous les besoins →": "عرض كل الطلبات →",
    "Aucun besoin ouvert en ce moment.": "لا توجد طلبات مفتوحة حالياً.",
    "Surveiller la liste →": "متابعة القائمة →",
    "État du besoin": "حالة الطلب",

    // ── L'Académie, l'adhésion ───────────────────────────────────────────
    "Entrer dans l'Académie": "الانضمام إلى الأكاديمية",
    "Je viens construire": "جئت لأبني",
    "Je viens chercher": "جئت للبحث عن شخص",
    "pour entrer": "للانضمام",
    "pour publier": "للنشر",
    "par transaction": "لكل معاملة",
    "mon contrat": "عقدي",
    "Ce que tu as accepté": "ما وافقت عليه",
    "Aucune acceptation enregistrée.": "لا توجد موافقة مسجّلة.",

    // ── La tour de contrôle ──────────────────────────────────────────────
    "Tour de contrôle": "برج المراقبة",
    "Tour de contrôle — Agence": "برج المراقبة — الوكالة",
    "API &amp; Webhooks": "واجهة البرمجة والـWebhooks",
    "Clés d'agence": "مفاتيح الوكالة",
    "Créer une clé": "إنشاء مفتاح",
    "Révoquer": "إبطال",
    "Aucune clé pour l'instant.": "لا يوجد مفتاح حتى الآن.",
    "Permissions": "الأذونات",
    "Clé": "المفتاح",
    "Dernier usage": "آخر استخدام",
    "URL": "الرابط",
    "Événements": "الأحداث",
    "Dernier code": "آخر رمز",
    "Aucun webhook enregistré.": "لا يوجد Webhook مسجّل.",
    "Enregistrer le webhook": "حفظ الـWebhook",
    "Identifiants de tes espaces": "معرّفات مساحاتك",
    "Identifiant d'espace": "معرّف المساحة",
    "Parcours": "المسار",
    "Aucun client dans ton portefeuille pour l'instant.": "لا يوجد عميل في محفظتك حتى الآن.",
    "Ce que tes clés ont fait": "ما فعلته مفاتيحك",
    "Aucun appel pour l'instant.": "لا توجد طلبات حتى الآن.",
    "Démarrage": "البداية",
    "Nom de la boutique": "اسم المتجر",
    "Email du client": "بريد العميل الإلكتروني",
    "Ouvrir l'espace client": "فتح مساحة العميل",
    "Toutes les familles": "كل الفئات",
    "Escadrilles": "الأسراب",
    "en attente": "قيد الانتظار",
    "7 jours": "٧ أيام",
    "Votre flotte est vide.": "أسطولك فارغ.",
    "Vous pilotez, vos clients gardent la main.": "أنت تقود، وعملاؤك يحتفظون بالتحكم.",
};

const DICTIONNAIRES = { fr: null, en: EN, ar: AR };

function normaliser(texte) {
    return String(texte).replace(/\s+/g, " ").trim();
}

// Sur quelle langue on sert. Priorité, du plus explicite au plus deviné :
// le paramètre d'URL (un lien partagé doit imposer sa langue), puis le choix
// mémorisé, puis l'en-tête du navigateur.
function detecter(req) {
    const demandee = String(req.query?.lang || "").toLowerCase().slice(0, 2);
    if (LANGUES.includes(demandee)) {
        if (req.session) req.session.langue = demandee;
        return demandee;
    }
    const memorisee = req.session?.langue;
    if (LANGUES.includes(memorisee)) return memorisee;

    const entete = String(req.headers?.["accept-language"] || "").toLowerCase();
    // On ne bascule en anglais que si l'anglais est demandé AVANT le français :
    // « fr-FR,en;q=0.9 » veut dire « je préfère le français ».
    const posFr = entete.indexOf("fr");
    const posEn = entete.indexOf("en");
    if (posEn !== -1 && (posFr === -1 || posEn < posFr)) return "en";
    return DEFAUT;
}

// La fonction que reçoivent les gabarits. Une traduction absente renvoie le
// français : une page à moitié traduite reste lisible, une page pleine de
// clés techniques ne l'est pas.
function traducteur(langue) {
    const dico = DICTIONNAIRES[langue];
    if (!dico) return (fr) => fr;
    return (fr) => dico[normaliser(fr)] ?? fr;
}

// L'arabe s'écrit de droite à gauche. C'est la seule langue de la liste dans
// ce cas — d'où une fonction plutôt qu'un champ par langue.
function sens(langue) {
    return langue === "ar" ? "rtl" : "ltr";
}

// Le nom de chaque langue DANS sa propre langue : un arabophone cherche
// « العربية », pas « Arabe ». C'est la règle de tous les sélecteurs sérieux.
const NOMS = { fr: "Français", en: "English", ar: "العربية" };

// Le lien qui bascule la langue en gardant la page où l'on est.
function lienBascule(req, versLangue) {
    const url = new URL(req.originalUrl || "/", "http://x");
    url.searchParams.set("lang", versLangue);
    return url.pathname + url.search;
}

// ── LE PONT ENTRE LES DEUX MÉMOIRES DE LANGUE ────────────────────────────
//
// Le site a deux systèmes de traduction, pour de bonnes raisons historiques :
// celui-ci, rendu par le serveur (l'Académie, les pages légales), et
// /js/i18n.js, rendu par le navigateur (le QG, l'accueil, les connexions).
// Chacun se souvenait du choix de langue de son côté — le serveur en session,
// le navigateur dans localStorage.
//
// Le défaut que ça produisait est difficile à deviner en lisant le code et
// évident en cliquant : on passe l'Académie en arabe, on clique vers le QG,
// et tout revient en français. Deux mémoires, deux réponses, un utilisateur
// qui croit que la traduction ne marche pas.
//
// Ce petit point d'entrée en fait une seule : la barre de langue, quand on y
// clique, la déclare aussi au serveur. Il ne renvoie rien — c'est un dépôt,
// pas une question. On l'appelle sans attendre la réponse : si elle
// n'arrivait pas, la page serait déjà traduite côté navigateur, et seule la
// page SUIVANTE reviendrait au français. Un échec dégrade, il ne casse pas.
function routeur() {
    const express = require("express");
    const r = express.Router();
    r.get("/langue/:code", (req, res) => {
        const code = String(req.params.code || "").toLowerCase().slice(0, 2);
        // Le zh existe côté navigateur et pas ici : on l'accepte sans le
        // mémoriser plutôt que de renvoyer une erreur pour un clic légitime.
        if (LANGUES.includes(code) && req.session) req.session.langue = code;
        res.status(204).end();
    });
    return r;
}

// À poser une fois dans index.js : toutes les vues reçoivent L() et lang,
// y compris celles qui ne sont pas encore traduites — elles continuent de
// fonctionner sans changement.
function middleware(req, res, next) {
    const langue = detecter(req);
    res.locals.lang = langue;
    res.locals.L = traducteur(langue);
    res.locals.dir = sens(langue);
    res.locals.nomsLangues = NOMS;
    res.locals.languesDispo = LANGUES;
    // Gardé pour les gabarits déjà écrits : la « prochaine » langue du cycle.
    res.locals.autreLangue = LANGUES[(LANGUES.indexOf(langue) + 1) % LANGUES.length];
    res.locals.lienLangue = (vers) => lienBascule(req, vers);
    next();
}

module.exports = { LANGUES, DEFAUT, EN, AR, NOMS, sens, detecter, traducteur, middleware, routeur, normaliser };
