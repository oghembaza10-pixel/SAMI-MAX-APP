// ==========================================================================
// SAMII OS — GÉNÉRATION VIDÉO/IMAGE VIA OPENROUTER (WAN 2.6, MiniMax H3)
// ==========================================================================
// Contrairement à Runware (réponse synchrone), l'API vidéo d'OpenRouter est
// asynchrone : soumission → interrogation régulière → téléchargement une
// fois "completed". Voir services/griotCoutService.js pour la facturation
// (6x le prix fournisseur).
const CONFIG = require("../config");

const BASE = "https://openrouter.ai/api/v1";

const MODELES = {
    wan: "alibaba/wan-2.6",
    h3: "minimax/hailuo-3",
};

function headers() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.OPENROUTER.API_KEY}`,
    };
}

// Interroge le statut toutes les 5s, jusqu'à 4 minutes — au-delà, la
// génération est considérée trop longue pour rester dans une seule requête
// HTTP synchrone (risque de timeout proxy côté hébergeur).
const INTERVALLE_POLL_MS = 5000;
const TIMEOUT_TOTAL_MS = 4 * 60 * 1000;

async function genererVideo({ moteur, prompt, dureeSecondes, imageBase64 }) {
    if (!CONFIG.OPENROUTER.API_KEY) {
        return { success: false, error: "Clé OpenRouter non configurée." };
    }
    const model = MODELES[moteur];
    if (!model) {
        return { success: false, error: `Moteur inconnu : ${moteur}` };
    }

    const debut = Date.now();
    try {
        const body = { model, prompt };
        if (dureeSecondes) body.duration = dureeSecondes;
        if (imageBase64) body.frame_images = [{ frame_type: "first_frame", image: imageBase64 }];

        const soumission = await fetch(`${BASE}/videos`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(body),
        });
        const job = await soumission.json();
        if (!soumission.ok || !job.id) {
            return { success: false, error: job.error?.message || "Échec de la soumission à OpenRouter." };
        }

        const pollingUrl = job.polling_url || `${BASE}/videos/${job.id}`;

        while (Date.now() - debut < TIMEOUT_TOTAL_MS) {
            await new Promise((r) => setTimeout(r, INTERVALLE_POLL_MS));

            const statutRes = await fetch(pollingUrl, { headers: headers() });
            const statut = await statutRes.json();

            if (statut.status === "completed") {
                const dureeMs = Date.now() - debut;
                return {
                    success: true,
                    videoUrl: `${BASE}/videos/${job.id}/content?index=0`,
                    jobId: job.id,
                    dureeMs,
                };
            }
            if (["failed", "cancelled", "expired"].includes(statut.status)) {
                return { success: false, error: `Génération ${statut.status} côté OpenRouter.`, dureeMs: Date.now() - debut };
            }
            // "pending" / "processing" → on continue de patienter
        }

        return {
            success: false,
            error: "La génération prend plus de 4 minutes — réessaie, ou vérifie le statut plus tard sur OpenRouter.",
            dureeMs: Date.now() - debut,
        };
    } catch (err) {
        console.error("❌ openrouterVideo.genererVideo :", err.message);
        return { success: false, error: err.message, dureeMs: Date.now() - debut };
    }
}

module.exports = { genererVideo, MODELES };
