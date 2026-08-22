// ==========================================================================
// SAMII OS — UPLOAD YOUTUBE (marchand connecté via Google OAuth)
// Route séparée du chat de Sami : une vidéo est un vrai fichier binaire,
// impossible à "décrire" en langage — le marchand la dépose ici directement.
// ==========================================================================
const express = require("express");
const multer = require("multer");
const router = express.Router();
const connectorService = require("../services/connectorService");
const google = require("../services/google");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/upload", requireAuth, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId || "";
        const connecteur = workspaceId ? await connectorService.getOne(workspaceId, "google") : null;
        res.render("youtube-upload", {
            connected: !!connecteur?.actif,
            error: null,
            success: false,
        });
    } catch (err) {
        console.error("❌ GET /youtube/upload :", err.message);
        res.status(500).send("Erreur serveur.");
    }
});

// Multer rejette un fichier trop lourd en levant une erreur *avant* le
// handler ci-dessous — sans ce filet, Express affichait une page
// "Internal Server Error" brute au lieu du message clair habituel.
function uploadMiddleware(req, res, next) {
    upload.single("video")(req, res, (err) => {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Vidéo trop lourde — 50 Mo maximum."
                : "Erreur lors de la lecture du fichier.";
            return res.render("youtube-upload", { connected: true, error: message, success: false });
        }
        next();
    });
}

router.post("/upload", requireAuth, uploadMiddleware, async (req, res) => {
    try {
        const workspaceId = req.session?.workspaceId;
        if (!workspaceId) return res.redirect("/hub");

        const connecteur = await connectorService.getOne(workspaceId, "google");
        if (!connecteur?.actif) {
            return res.render("youtube-upload", { connected: false, error: null, success: false });
        }
        if (!req.file) {
            return res.render("youtube-upload", { connected: true, error: "Choisis un fichier vidéo.", success: false });
        }

        const { titre, description } = req.body;
        const result = await google.uploadYoutubeVideo(workspaceId, {
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            title: titre || "Vidéo SAMII",
            description: description || "",
        });

        if (!result.success) {
            return res.render("youtube-upload", { connected: true, error: result.error, success: false });
        }
        res.render("youtube-upload", { connected: true, error: null, success: true, link: result.link });
    } catch (err) {
        console.error("❌ POST /youtube/upload :", err.message);
        res.render("youtube-upload", { connected: true, error: "Erreur serveur lors de l'upload.", success: false });
    }
});

module.exports = router;
