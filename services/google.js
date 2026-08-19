// ==========================================================================
// SAMII OS — GOOGLE (Gmail / Calendar / Drive / YouTube) — accès marchand
// Appelé côté Sami (brain/planner.js) et par toute future route qui a besoin
// des outils Google du marchand connecté (routes/auth-google.js).
// ==========================================================================
const axios = require("axios");
const CONFIG = require("../config");
const connectorService = require("../services/connectorService");

// Renvoie un access_token valide pour le workspace, en le renouvelant via le
// refresh_token stocké s'il a expiré — le marchand ne repasse jamais par
// l'écran de consentement après la première connexion.
async function getValidAccessToken(workspaceId) {
    const connecteur = await connectorService.getOne(workspaceId, "google");
    if (!connecteur?.actif || !connecteur.config?.refreshToken) return null;

    const { accessToken, expiresAt, refreshToken } = connecteur.config;
    if (accessToken && expiresAt && Date.now() < expiresAt - 60000) {
        return accessToken;
    }

    try {
        const tokenRes = await axios.post("https://oauth2.googleapis.com/token", null, {
            params: {
                client_id: CONFIG.GOOGLE.OAUTH.CLIENT_ID,
                client_secret: CONFIG.GOOGLE.OAUTH.CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            },
        });
        const { access_token, expires_in } = tokenRes.data;
        await connectorService.save(workspaceId, "google", {
            accessToken: access_token,
            expiresAt: Date.now() + (expires_in || 3600) * 1000,
        });
        return access_token;
    } catch (err) {
        console.error("❌ google.getValidAccessToken :", err.response?.data || err.message);
        return null;
    }
}

// ── Gmail ──────────────────────────────────────────────────────────────
// Liste les derniers emails reçus (sujet, expéditeur, extrait) — utilisé par
// Sami pour répondre à "j'ai reçu quoi sur mon mail récemment ?".
async function listRecentEmails(workspaceId, max = 8) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { connected: false, emails: [] };

    try {
        const listRes = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
            headers: { Authorization: `Bearer ${token}` },
            params: { maxResults: max, labelIds: "INBOX" },
        });
        const ids = (listRes.data.messages || []).map(m => m.id);

        const emails = [];
        for (const id of ids) {
            const msgRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { format: "metadata", metadataHeaders: ["From", "Subject", "Date"] },
            });
            const headers = msgRes.data.payload?.headers || [];
            const getHeader = name => headers.find(h => h.name === name)?.value || "";
            emails.push({
                id,
                de: getHeader("From"),
                sujet: getHeader("Subject"),
                date: getHeader("Date"),
                extrait: msgRes.data.snippet || "",
            });
        }
        return { connected: true, emails };
    } catch (err) {
        console.error("❌ google.listRecentEmails :", err.response?.data || err.message);
        return { connected: true, emails: [], error: true };
    }
}

// Envoie un email au nom du marchand connecté — le message doit être
// encodé au format RFC 2822 puis en base64url (format exigé par l'API Gmail).
async function sendEmail(workspaceId, { to, subject, body }) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { success: false, error: "Google non connecté." };

    try {
        const raw = Buffer.from(
            `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`
        )
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        await axios.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            { raw },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return { success: true };
    } catch (err) {
        console.error("❌ google.sendEmail :", err.response?.data || err.message);
        return { success: false, error: "Échec de l'envoi." };
    }
}

module.exports = { getValidAccessToken, listRecentEmails, sendEmail };
