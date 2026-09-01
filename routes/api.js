// ======================================================
// SAMII OS — API V5 — PostgreSQL + Universel (produit / rendez-vous)
// ======================================================
const express = require("express");
const axios = require("axios");
const multer = require("multer");
const router = express.Router();
const planner = require("../brain/planner");
const db = require("../services/db");
const journalService = require("../services/journalService");
const samiiQuota = require("../services/samiiQuota");
const confirmationsQuota = require("../services/confirmationsQuota");
const samiiMemoire = require("../services/samiiMemoire");
const projetsService = require("../services/projetsService");
const memoireUtilisateur = require("../services/memoireUtilisateur");
const transcription = require("../services/transcription");
const connaissances = require("../services/connaissances");
const geminiService = require("../services/geminiService");
const connectorService = require("../services/connectorService");
const google = require("../services/google");
const metiers = require("../services/metiers");
const evenements = require("../services/evenements");

// Notes vocales du chat QG : jamais plus de ~2 minutes d'audio en usage
// normal, 10 Mo est très large pour ça (webm/opus compresse énormément).
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Télécharge une pièce jointe déjà hébergée (Cloudinary) pour la repasser à
// Gemini en base64 — le payload JSON du chat reste petit (une URL, pas les
// octets), et Gemini n'a pas besoin d'un accès public particulier à l'URL.
async function chargerPieceJointe(url) {
    if (!url || typeof url !== "string" || !url.startsWith("https://")) return null;
    try {
        const res = await axios.get(url, { responseType: "arraybuffer", maxContentLength: 15 * 1024 * 1024 });
        const mimeType = res.headers["content-type"] || "application/octet-stream";
        return { base64: Buffer.from(res.data).toString("base64"), mimeType };
    } catch (err) {
        console.warn("⚠️ chargerPieceJointe :", err.message);
        return null;
    }
}

// Les métiers "rendez-vous" sont définis une seule fois dans
// services/metiers.js. Cette liste vivait ici en double et avait déjà
// divergé (elle contenait des métiers absents de la liste d'inscription,
// et inversement) : un QG pouvait afficher des commandes à un cabinet.
// Les métiers libres saisis à l'onboarding restent traités en "produit",
// comportement inchangé.
function typeParcours(metier) {
    return metiers.estRdv(metier) ? "rdv" : "produit";
}

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.status(401).json({ error: "Non connecté" });
    next();
}

function getMontant(c) {
    return parseFloat(c.montant || 0) || 0;
}

// ── CHAT SAMII ──────────────────────────────────────────
// requireAuth ajouté : cette route lance le planner complet (prompt SAMII
// entier + outils + audience "souverain") et le quota de messages ne
// s'applique que s'il y a un userId — un visiteur anonyme pouvait donc
// consommer des tokens payants sans aucune limite de quota. Ses deux seuls
// appelants (public/js/hub.js et public/js/samii-page.js) sont servis par
// des pages déjà protégées par requireAuth : personne de légitime ne
// l'appelle sans session. Le chat public de la page d'accueil a sa propre
// porte, volontairement bridée (routes/vitrine.js).
router.post("/chat", requireAuth, async (req, res) => {
    try {
        const message = req.body.message;
        const imageUrl = req.body.imageUrl;
        const documentUrl = req.body.documentUrl;
        const documentName = req.body.documentName;
        if (!message && !imageUrl && !documentUrl) return res.json({ success: false, reply: "Écris un message." });

        const userId = req.session?.userId;

        // Projet (à la Claude Projects) : fil de conversation isolé. On
        // vérifie l'appartenance avant de lire/écrire dedans — un ID de
        // projet fourni par le client ne suffit jamais seul.
        let projetId = null;
        if (req.body.projetId && userId) {
            const appartient = await projetsService.appartientA(userId, req.body.projetId);
            if (appartient) projetId = req.body.projetId;
        }

        // Le quota (gratuit = 30 messages/7h glissantes, payant = illimité) est le
        // seul levier commercial — la mémoire, elle, ne dépend jamais du palier
        // (voir samiiMemoire) : un client gratuit qui revient plus tard doit
        // retrouver SAMII qui se souvient de tout, sinon aucune raison de
        // vouloir passer payant.
        if (userId) {
            const quota = await samiiQuota.getEtatQuota(userId, req.session?.workspaceId);
            if (!quota.illimite && quota.restant <= 0) {
                if (quota.depassementFacturable) {
                    // Workspace payant (moyen de paiement déjà lié) : jamais bloqué,
                    // le dépassement s'accumule et se règle au renouvellement —
                    // voir services/samiiQuota.js et engines/abonnementEngine.js.
                    await samiiQuota.enregistrerMessageDepassement(req.session.workspaceId);
                } else {
                    return res.json({
                        success: true,
                        quotaExceeded: true,
                        reply:
                            `Tu as atteint tes ${quota.total} messages gratuits pour les ${quota.fenetreHeures || 7} prochaines heures — ` +
                            `je garde tout ce qu'on s'est dit, on reprend bientôt. ` +
                            `Passe en SAMII Premium (${samiiQuota.PRIX_PREMIUM_USD}$/mois) pour discuter sans limite et avancer sur tes projets sans attendre.`,
                    });
                }
            }
        }

        const grade = await getGrade(userId);
        const memoireActuelle = userId ? await memoireUtilisateur.get(userId) : null;
        const connaissancesTexte = userId ? await connaissances.texteAgrege(userId) : "";
        const context = {
            user: { lang: req.body.lang || "" },
            workspaceId: req.session?.workspaceId || req.body.workspaceId || "",
            client: req.body.client || "",
            commande: req.body.commande || "",
            page: req.body.page || "",
            lastAction: req.body.lastAction || "",
            grade: grade.actuel,
            prenom: grade.prenom,
            connaissances: connaissancesTexte,
            audience: "souverain",
            memoireUtilisateur: memoireActuelle,
            // ── L'IDENTITÉ, RECOPIÉE DE LA SESSION ──────────────────────
            //
            // `resume_journee` lit l'activité d'un compte : commandes,
            // paiements, boîte mail. Il lui faut donc savoir DE QUI on
            // parle — et cette réponse ne peut venir que d'ici.
            //
            // `req.body` est juste au-dessus, avec workspaceId lisible
            // depuis la page. On ne s'en sert pas : ce serait « donne-moi
            // le bilan du workspace du voisin » en une ligne de console.
            identite: {
                userId: req.session?.userId || null,
                workspaceId: req.session?.workspaceId || null,
                isAdmin: req.session?.isAdmin === true,
            },
            COM: res.locals?.COM || null,
        };

        // Pièce jointe : uploadée sur Cloudinary côté client, on ne reçoit
        // que l'URL ici (payload JSON léger), puis on télécharge les octets
        // pour les repasser à Gemini en base64.
        let pieceLabel = "";
        if (imageUrl) {
            context.piece = await chargerPieceJointe(imageUrl);
            pieceLabel = "[Photo jointe] ";
        } else if (documentUrl) {
            context.piece = await chargerPieceJointe(documentUrl);
            pieceLabel = `[Document joint : ${documentName || "fichier"}] `;
        }

        const goal = message || (imageUrl ? "Que vois-tu sur cette image ?" : "Voici un document, analyse-le.");
        const history = await samiiMemoire.getHistorique(userId, projetId);

        const result = await planner.build({ goal }, context, history);

        let messageId = null;
        if (userId) {
            messageId = await samiiMemoire.enregistrerTour(userId, pieceLabel + goal, result.reply, "web", projetId);
            if (projetId) await projetsService.toucher(projetId);
            // Fire-and-forget : n'attend jamais la réponse, ne casse jamais
            // le chat si ça échoue (voir memoireUtilisateur.js).
            memoireUtilisateur.extraireEtMemoriser(userId, goal, result.reply);
        }

        res.json({ ...result, messageId });
    } catch (err) {
        console.error("❌ API chat :", err.message);
        res.json({ success: false, reply: "SAMII démarre. Réessaie dans quelques instants." });
    }
});

// Directives permanentes : réglage fiable (pas une supposition de l'IA),
// appliqué à CHAQUE conversation avec SAMII (voir brain/prompts/index.js).
router.get("/directives", requireAuth, async (req, res) => {
    try {
        const rows = await db.query(`SELECT directives_permanentes FROM utilisateurs WHERE id = $1`, [req.session.userId]);
        res.json({ success: true, directives: rows[0]?.directives_permanentes || "" });
    } catch (err) {
        console.error("❌ GET /api/directives :", err.message);
        res.json({ success: false, directives: "" });
    }
});

router.post("/directives", requireAuth, async (req, res) => {
    const ok = await memoireUtilisateur.setDirectives(req.session.userId, req.body.directives || "");
    res.json({ success: ok });
});

// Base de connaissances permanente : le fichier (PDF/image) part sur
// Cloudinary côté client (même flux que les pièces jointes du chat), on ne
// reçoit ici que l'URL — SAMII (multimodal) lit le fichier une seule fois
// pour en extraire un résumé, qui seul sera relu à chaque conversation
// future (voir brain/prompts/index.js).
router.get("/connaissances", requireAuth, async (req, res) => {
    try {
        const rows = await connaissances.lister(req.session.userId);
        res.json({ success: true, connaissances: rows });
    } catch (err) {
        console.error("❌ GET /api/connaissances :", err.message);
        res.json({ success: false, connaissances: [] });
    }
});

router.post("/connaissances", requireAuth, async (req, res) => {
    try {
        const { titre, fichierUrl, fichierNom, texte } = req.body;
        if (!fichierUrl && !texte) {
            return res.json({ success: false, error: "Fournis un fichier ou du texte." });
        }

        let contenuResume;
        if (texte) {
            contenuResume = texte.trim();
        } else {
            const piece = await chargerPieceJointe(fichierUrl);
            if (!piece) return res.json({ success: false, error: "Impossible de lire ce fichier." });
            const result = await geminiService.chat({
                message: "Résume le contenu utile de ce document pour qu'une IA (SAMII) puisse s'en souvenir durablement et le réutiliser dans de futures conversations avec son auteur. Garde tous les faits, chiffres et décisions concrets, retire le superflu. Réponds uniquement avec le résumé, sans préambule.",
                context: { source: "connaissances", audience: "souverain", piece },
                useTools: false,
            });
            if (result.type !== "text" || !result.text) {
                return res.json({ success: false, error: "SAMII n'a pas réussi à lire ce document." });
            }
            contenuResume = result.text.trim();
        }

        const ligne = await connaissances.ajouter(req.session.userId, {
            titre: titre || fichierNom || "Sans titre",
            contenu_resume: contenuResume,
            fichier_url: fichierUrl || null,
            fichier_nom: fichierNom || null,
        });
        res.json({ success: true, connaissance: ligne });
    } catch (err) {
        console.error("❌ POST /api/connaissances :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.delete("/connaissances/:id", requireAuth, async (req, res) => {
    const ok = await connaissances.retirer(req.session.userId, parseInt(req.params.id, 10));
    res.json({ success: ok });
});

// 👍/👎 sur une réponse de SAMII — construit un historique de ce qui
// marche/marche pas pendant qu'on entraîne SAMII, sans attendre le vrai
// volume de clients.
router.post("/chat/feedback", requireAuth, async (req, res) => {
    try {
        const { messageId, feedback } = req.body;
        if (!messageId || !["up", "down"].includes(feedback)) {
            return res.json({ success: false, error: "Paramètres invalides." });
        }
        const ok = await samiiMemoire.setFeedback(messageId, req.session.userId, feedback);
        res.json({ success: ok });
    } catch (err) {
        console.error("❌ POST /api/chat/feedback :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// Transcrit une note vocale enregistrée dans le navigateur (chat QG) — même
// moteur (Groq Whisper, gratuit) que pour WhatsApp/Telegram, plutôt que la
// reconnaissance vocale native du navigateur (absente sur Firefox, qualité
// très inégale en darija).
router.post("/chat/transcribe", requireAuth, uploadAudio.single("audio"), async (req, res) => {
    try {
        if (!req.file) return res.json({ success: false, error: "Aucun audio reçu." });
        const text = await transcription.transcribeBuffer(req.file.buffer, req.file.originalname || "audio.webm");
        if (!text) return res.json({ success: false, error: "Transcription impossible, réessaie." });
        res.json({ success: true, text });
    } catch (err) {
        console.error("❌ POST /api/chat/transcribe :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// Historique affichable (contrairement à samiiMemoire.getHistorique, pensé
// pour Gemini) — sert à réafficher le fil au chargement de la page ou après
// un changement de projet, pour que ce qu'on VOIT corresponde à ce que
// SAMII SAIT.
router.get("/chat/historique", requireAuth, async (req, res) => {
    try {
        const projetId = req.query.projetId ? parseInt(req.query.projetId, 10) : null;
        if (projetId && !(await projetsService.appartientA(req.session.userId, projetId))) {
            return res.json({ success: false, historique: [] });
        }
        const historique = await samiiMemoire.getHistorique(req.session.userId, projetId);
        res.json({ success: true, historique });
    } catch (err) {
        console.error("❌ GET /api/chat/historique :", err.message);
        res.json({ success: false, historique: [] });
    }
});

// ── PROJETS SAMII (fils de conversation séparés, à la Claude Projects) ──
router.get("/projets", requireAuth, async (req, res) => {
    try {
        const projets = await projetsService.lister(req.session.userId);
        res.json({ success: true, projets });
    } catch (err) {
        console.error("❌ GET /api/projets :", err.message);
        res.json({ success: false, projets: [] });
    }
});

router.post("/projets", requireAuth, async (req, res) => {
    try {
        const nom = (req.body.nom || "").trim();
        if (!nom) return res.json({ success: false, error: "Nom du projet manquant." });
        const projet = await projetsService.creer(req.session.userId, nom);
        res.json({ success: true, projet });
    } catch (err) {
        console.error("❌ POST /api/projets :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/projets/:id/archiver", requireAuth, async (req, res) => {
    try {
        const ok = await projetsService.archiver(req.session.userId, req.params.id);
        res.json({ success: ok });
    } catch (err) {
        console.error("❌ POST /api/projets/:id/archiver :", err.message);
        res.json({ success: false });
    }
});

// ── Résumé de la semaine — un condensé que l'utilisateur peut coller en
// tête d'une nouvelle conversation pour donner du contexte supplémentaire
// à SAMII (la mémoire elle-même est déjà complète, voir samiiMemoire) ──
router.post("/samii-resume", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const rows = await db.query(
            `SELECT role, contenu AS message FROM samii_conversations
             WHERE user_id = $1 AND created_at > now() - interval '7 days'
             ORDER BY created_at ASC`,
            [userId]
        );
        if (!rows.length) {
            return res.json({ success: false, resume: "", message: "Pas encore d'historique cette semaine." });
        }
        const transcript = rows.map(r => `${r.role === "user" ? "Toi" : "SAMII"} : ${r.message}`).join("\n");
        const gemini = require("../services/geminiService");
        const resume = await gemini.summarize(transcript);
        res.json({ success: !!resume, resume });
    } catch (err) {
        console.error("❌ API samii-resume :", err.message);
        res.status(500).json({ success: false, resume: "" });
    }
});

// `requireAuth` : cette route était ouverte à tout Internet, seule de son
// espèce parmi les routes de chat. Sans clé ElevenLabs c'était inoffensif —
// elle répondait `fallback: true` à tout le monde. Le jour où une clé est
// posée, c'est une facture à l'air libre : n'importe qui peut envoyer du
// texte en boucle et le faire lire à nos frais.
//
// Une porte qu'on n'a jamais fermée parce qu'il n'y avait rien derrière est
// une porte qu'on oublie le jour où on range quelque chose dans la pièce.
router.post("/speak", requireAuth, async (req, res) => {
    try {
        const elevenlabs = require("../services/elevenlabs");
        const texte = String(req.body?.text || "");
        // Une réponse de SAMII fait quelques centaines de caractères. Sans
        // borne, un seul appel peut demander la lecture d'un livre.
        if (texte.length > 5000) {
            return res.json({ success: false, error: "Texte trop long." });
        }
        if (!elevenlabs.isEnabled()) return res.json({ success: false, fallback: true });
        const result = await elevenlabs.textToSpeech(texte);
        res.json(result);
    } catch (err) {
        console.error("❌ POST /api/speak :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── CONNECTEURS (PostgreSQL) ─────────────────────────────
router.get("/connecteurs", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });
    try {
        const rows = await db.query(
            `SELECT * FROM connecteurs WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [workspaceId]
        );

        const connecteurs = {};
        rows.forEach(r => {
            const type = (r.type || "").toLowerCase();
            const actif = r.actif === true;
            if (connecteurs[type] && connecteurs[type].actif && !actif) return;

            let config = {};
            try { config = r.config ? JSON.parse(r.config) : {}; } catch { config = {}; }

            connecteurs[type] = { actif, identifiant: config.chatId || "", ...config };
        });

        res.json({ success: true, connecteurs });
    } catch (err) {
        console.error("❌ API connecteurs :", err.message);
        res.status(500).json({ error: "Erreur chargement connecteurs." });
    }
});

// ── QG DATA — universel (produit ou rendez-vous selon métier) ──
router.get("/qg-data", requireAuth, async (req, res) => {
    const workspaceId = req.session.workspaceId;
    if (!workspaceId) return res.status(403).json({ error: "Workspace introuvable." });

    try {
        const wsRows = await db.query(`SELECT * FROM workspaces WHERE id = $1`, [workspaceId]);
        const workspace = wsRows[0];
        if (!workspace) return res.status(404).json({ error: "Workspace introuvable." });

        // Tâche de fond, non-bloquante : prévient le marchand quand son
        // dépannage WhatsApp approche de la fin ou vient d'expirer — pas de
        // cron dans cette appli, le QG est visité assez souvent pour un
        // délai de 3 jours (voir services/whatsapp.js).
        require("../services/whatsapp").verifierEtNotifierDepannage(workspaceId).catch(() => {});

        const parcours = typeParcours(workspace.metier);

        if (parcours === "rdv") {
            return await buildRdvResponse(res, workspace, workspaceId, req.session.userId);
        }
        return await buildProduitResponse(res, workspace, workspaceId, req.session.userId);
    } catch (err) {
        console.error("❌ API qg-data :", err.message);
        res.status(500).json({ error: "Erreur chargement données." });
    }
});

// ── Grade réel du compte (utilisateurs.grade_actuel/score_grade) — le QG
// affichait avant un grade recalculé localement à partir du nombre de
// commandes de la boutique, déconnecté du vrai grade (Arsenal, thèmes...).
async function getGrade(userId) {
    if (!userId) return { actuel: "Soldat", score: 0, prenom: "" };
    try {
        const rows = await db.query(`SELECT grade_actuel, score_grade, prenom FROM utilisateurs WHERE id = $1`, [userId]);
        return { actuel: rows[0]?.grade_actuel || "Soldat", score: rows[0]?.score_grade || 0, prenom: rows[0]?.prenom || "" };
    } catch (err) {
        console.error("❌ getGrade :", err.message);
        return { actuel: "Soldat", score: 0, prenom: "" };
    }
}

// ── Derniers emails Gmail — le bouton "Gmail" du QG ne filtrait jusqu'ici
// que les commandes par source (toujours vide, une commande n'arrive
// jamais par email) : aucune vraie boîte de réception n'était affichée,
// malgré la connexion Google active. Vérifie d'abord que Google est bien
// connecté pour ce workspace avant de faire un vrai appel Gmail (évite un
// aller-retour API inutile à chaque chargement du QG pour un marchand qui
// n'a pas connecté Google).
async function getEmails(workspaceId) {
    try {
        const connecteur = await connectorService.getOne(workspaceId, "google");
        if (!connecteur?.actif) return [];
        const result = await google.listRecentEmails(workspaceId, 8);
        return result.emails || [];
    } catch (err) {
        console.error("❌ getEmails :", err.message);
        return [];
    }
}

// ── YouTube (stats chaîne, dernières vidéos, derniers commentaires) ──
// Même principe que getEmails : ne fait un vrai appel Google que si le
// marchand a réellement connecté Google pour ce workspace.
async function getYoutube(workspaceId) {
    try {
        const connecteur = await connectorService.getOne(workspaceId, "google");
        if (!connecteur?.actif) return { stats: null, videos: [], comments: [] };

        // Les autorisations YouTube ont été retirées de la demande OAuth en
        // attendant la vérification Google. Sans elles, chaque chargement du
        // QG lançait trois appels YouTube qui échouaient en 403 : inutile et
        // bruyant dans les journaux. On s'appuie sur les autorisations
        // réellement accordées, telles que Google les a renvoyées à la
        // connexion — ainsi, le jour où elles reviennent, le bloc se
        // réactive tout seul, sans toucher au code.
        const accordees = String(connecteur.config?.scope || "");
        if (!accordees.includes("youtube")) return { stats: null, videos: [], comments: [] };

        const [statsRes, videosRes, commentsRes] = await Promise.all([
            google.getYoutubeStats(workspaceId),
            google.listMyVideos(workspaceId, 6),
            google.listRecentComments(workspaceId, 6),
        ]);
        return {
            stats: statsRes.stats || null,
            videos: videosRes.videos || [],
            comments: commentsRes.comments || [],
        };
    } catch (err) {
        console.error("❌ getYoutube :", err.message);
        return { stats: null, videos: [], comments: [] };
    }
}

// ── Activité récente (journal) — alimente le panneau temps réel du QG ──
async function getJournal(workspaceId) {
    try {
        const rows = await db.query(
            `SELECT action, details, created_at FROM journal WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 15`,
            [workspaceId]
        );
        return rows;
    } catch (err) {
        console.error("❌ getJournal :", err.message);
        return [];
    }
}

// ── Réponse QG — métiers produit (e-commerce, restaurant...) ──
async function buildProduitResponse(res, workspace, workspaceId, userId) {
    const commandesRows = await db.query(
        `SELECT * FROM commandes WHERE workspace_id = $1 ORDER BY date_commande DESC LIMIT 100`,
        [workspaceId]
    );
    const commandes = commandesRows.map(c => ({
        "ID Commande": c.id,
        "Nom Client": c.nom_client,
        "Téléphone": c.telephone,
        "Produit": c.produit,
        "montant": c.montant,
        "Devise": c.devise || "DZD",
        "Statut": c.statut,
        "Source": c.source,
        "Date Commande": c.date_commande,
        airtableId: c.id,
    }));

    const clientsRows = await db.query(
        `SELECT * FROM clients WHERE workspace_id = $1 ORDER BY total_depense DESC LIMIT 50`,
        [workspaceId]
    );
    const clients = clientsRows.map(c => ({
        "Nom": c.nom,
        "Téléphone": c.telephone,
        "Total Dépensé": c.total_depense,
        "VIP": c.statut === "vip",
        "Blacklist": c.statut === "blacklist",
    }));

    const total_commandes = commandes.length;
    const total_revenus = commandes.reduce((s, c) => s + getMontant(c), 0);
    const en_attente = commandes.filter(c => c.Statut === "en attente").length;
    const confirmees = commandes.filter(c => c.Statut === "confirmée").length;
    const annulees = commandes.filter(c => c.Statut === "annulée").length;
    const vip = clients.filter(c => c.VIP === true).length;
    const blacklist = clients.filter(c => c.Blacklist === true).length;

    const livrees = commandes.filter(c => c.Statut === "livrée").length;
    const en_cours = commandes.filter(c => c.Statut === "en cours").length;
    const echecs = commandes.filter(c => c.Statut === "échoué").length;

    const aujourd = new Date().toISOString().split("T")[0];
    const cmd_aujourd = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 10) : "";
        return d === aujourd;
    });
    const rev_aujourd = cmd_aujourd.reduce((s, c) => s + getMontant(c), 0);

    const moisActuel = aujourd.slice(0, 7);
    const moisPrec = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const cmd_mois = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisActuel;
    });
    const cmd_moisP = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisPrec;
    });
    const rev_mois = cmd_mois.reduce((s, c) => s + getMontant(c), 0);
    const rev_moisP = cmd_moisP.reduce((s, c) => s + getMontant(c), 0);
    const evolution = rev_moisP > 0 ? (((rev_mois - rev_moisP) / rev_moisP) * 100).toFixed(1) + "%" : "—";
    const journal = await getJournal(workspaceId);
    const grade = await getGrade(userId);
    const emails = await getEmails(workspaceId);
    const youtube = await getYoutube(workspaceId);

    // Un métier "produit" (e-commerce...) peut quand même recevoir des
    // rendez-vous (consultation, retrait en boutique...) via le chat SAMII —
    // on ne les cache pas juste parce que le workspace n'est pas classé
    // "métier RDV" (dentiste, avocat...). Le calendrier ne s'affiche côté
    // frontend que s'il y a au moins un rendez-vous.
    const rdvRows = await db.query(
        `SELECT * FROM rendez_vous WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [workspaceId]
    );
    const rendezVous = rdvRows.map(r => ({
        "ID Commande": r.id,
        "Nom Client": r.client_nom,
        "Téléphone": r.client_telephone,
        "Produit": r.motif,
        "DateRdv": r.date_rdv,
        "Statut": r.statut,
        "Source": r.source,
        "Date Commande": r.created_at,
        airtableId: r.id,
    }));

    res.json({
        success: true,
        parcours: "produit",
        workspace: { nom: workspace.nom || "", metier: workspace.metier || "" },
        stats: { total_commandes, total_revenus: total_revenus.toFixed(2), en_attente, confirmees, annulees, vip, blacklist },
        livraison: { livrees, en_cours, echecs },
        mission: { date: aujourd, commandes: cmd_aujourd.length, revenus: rev_aujourd.toFixed(2) },
        performance: { revenus_mois: rev_mois.toFixed(2), commandes_mois: cmd_mois.length, evolution },
        commandes,
        clients,
        journal,
        grade,
        rendezVous,
        emails,
        youtube,
    });
}

// ── Réponse QG — métiers rendez-vous (dentiste, avocat...) ──
async function buildRdvResponse(res, workspace, workspaceId, userId) {
    const rdvRows = await db.query(
        `SELECT * FROM rendez_vous WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [workspaceId]
    );

    const commandes = rdvRows.map(r => ({
        "ID Commande": r.id,
        "Nom Client": r.client_nom,
        "Téléphone": r.client_telephone,
        "Produit": r.motif,
        "DateRdv": r.date_rdv,
        "montant": 0,
        "Devise": workspace.devise || "DZD",
        "Statut": r.statut,
        "Source": r.source,
        "Date Commande": r.created_at,
        airtableId: r.id,
    }));

    const total_rdv = commandes.length;
    const en_attente = commandes.filter(c => c.Statut === "en_attente").length;
    const confirmees = commandes.filter(c => c.Statut === "confirmé").length;
    const annulees = commandes.filter(c => c.Statut === "annulé").length;

    const aujourd = new Date().toISOString().split("T")[0];
    const rdv_aujourd = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 10) : "";
        return d === aujourd;
    });

    const moisActuel = aujourd.slice(0, 7);
    const moisPrec = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const rdv_mois = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisActuel;
    });
    const rdv_moisP = commandes.filter(c => {
        const d = c["Date Commande"] ? new Date(c["Date Commande"]).toISOString().slice(0, 7) : "";
        return d === moisPrec;
    });
    const evolution = rdv_moisP.length > 0
        ? (((rdv_mois.length - rdv_moisP.length) / rdv_moisP.length) * 100).toFixed(1) + "%"
        : "—";
    const journal = await getJournal(workspaceId);
    const grade = await getGrade(userId);
    const emails = await getEmails(workspaceId);
    const youtube = await getYoutube(workspaceId);

    res.json({
        success: true,
        parcours: "rdv",
        workspace: { nom: workspace.nom || "", metier: workspace.metier || "" },
        stats: {
            total_commandes: total_rdv, total_revenus: "0.00",
            en_attente, confirmees, annulees, vip: 0, blacklist: 0,
        },
        livraison: { livrees: 0, en_cours: 0, echecs: 0 },
        mission: { date: aujourd, commandes: rdv_aujourd.length, revenus: "0.00" },
        performance: { revenus_mois: "0.00", commandes_mois: rdv_mois.length, evolution },
        commandes,
        clients: [],
        journal,
        grade,
        emails,
        youtube,
    });
}

// ── CONFIRMER (commande ou rendez-vous, détection automatique) ──
router.post("/commandes/:id/confirmer", requireAuth, async (req, res) => {
    try {
        const checkCmd = await db.query(
            `SELECT id FROM commandes WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkCmd.length) {
            await db.query(`UPDATE commandes SET statut = 'confirmée', confirme_le = now() WHERE id = $1`, [req.params.id]);
            confirmationsQuota.enregistrerSiDepassement(req.session.workspaceId).catch(() => {});
            evenements.publier(req.session.workspaceId, "commande.confirmee", { id: req.params.id, source: "qg" }, { silencieux: true });
            return res.json({ success: true });
        }

        const checkRdv = await db.query(
            `SELECT id FROM rendez_vous WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkRdv.length) {
            await db.query(`UPDATE rendez_vous SET statut = 'confirmé' WHERE id = $1`, [req.params.id]);
            evenements.publier(req.session.workspaceId, "rendezvous.confirme", { id: `RDV-${req.params.id}`, source: "qg" }, { silencieux: true });
            return res.json({ success: true });
        }

        res.status(403).json({ error: "Introuvable." });
    } catch (err) {
        console.error("❌ Confirmer :", err.message);
        res.status(500).json({ error: "Erreur confirmation." });
    }
});

// ── ANNULER (commande ou rendez-vous, détection automatique) ──
router.post("/commandes/:id/annuler", requireAuth, async (req, res) => {
    try {
        const checkCmd = await db.query(
            `SELECT id FROM commandes WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkCmd.length) {
            await db.query(`UPDATE commandes SET statut = 'annulée' WHERE id = $1`, [req.params.id]);
            evenements.publier(req.session.workspaceId, "commande.annulee", { id: req.params.id, source: "qg" }, { silencieux: true });
            return res.json({ success: true });
        }

        const checkRdv = await db.query(
            `SELECT id FROM rendez_vous WHERE id = $1 AND workspace_id = $2`,
            [req.params.id, req.session.workspaceId]
        );
        if (checkRdv.length) {
            await db.query(`UPDATE rendez_vous SET statut = 'annulé' WHERE id = $1`, [req.params.id]);
            evenements.publier(req.session.workspaceId, "rendezvous.annule", { id: `RDV-${req.params.id}`, source: "qg" }, { silencieux: true });
            return res.json({ success: true });
        }

        res.status(403).json({ error: "Introuvable." });
    } catch (err) {
        console.error("❌ Annuler :", err.message);
        res.status(500).json({ error: "Erreur annulation." });
    }
});

// ── FEEDBACK CLIENT ───────────────────────────────────────
router.post("/feedback", requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.json({ success: false, error: "Message vide." });

        await journalService.log({ action: "feedback", details: text.trim(), workspaceId: req.session.workspaceId || null, userId: req.session.userId || null });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /api/feedback :", err.message);
        res.json({ success: false, error: "Erreur serveur." });
    }
});

// ── DEBUG SESSION ─────────────────────────────────────────
router.get("/debug-session", requireAuth, (req, res) => {
    res.json({
        workspaceId: req.session.workspaceId,
        userId: req.session.userId,
        email: req.session.email,
    });
});

// ── NOTIFICATIONS PUSH (PWA) ─────────────────────────────
router.get("/push/public-key", (req, res) => {
    const CONFIG = require("../config");
    res.json({ publicKey: CONFIG.VAPID?.PUBLIC_KEY || "" });
});

router.post("/push/subscribe", requireAuth, async (req, res) => {
    try {
        const { endpoint, keys } = req.body || {};
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ success: false, error: "Abonnement invalide." });
        }
        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
            [req.session.userId, endpoint, keys.p256dh, keys.auth]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /api/push/subscribe :", err.message);
        res.status(500).json({ success: false, error: "Erreur serveur." });
    }
});

router.post("/push/unsubscribe", requireAuth, async (req, res) => {
    try {
        const { endpoint } = req.body || {};
        if (endpoint) await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ POST /api/push/unsubscribe :", err.message);
        res.status(500).json({ success: false, error: "Erreur serveur." });
    }
});

module.exports = router;
