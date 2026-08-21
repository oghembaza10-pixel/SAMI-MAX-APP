// ==========================================================================
// SAMII OS — GOOGLE (Gmail / Calendar / Drive / YouTube) — accès marchand
// Appelé côté Sami (brain/planner.js) et par toute future route qui a besoin
// des outils Google du marchand connecté (routes/auth-google.js).
// ==========================================================================
const axiosBase = require("axios");
const CONFIG = require("../config");
const connectorService = require("../services/connectorService");

// Délai par défaut sur tous les appels Google — sans ça, un appel qui coince
// (réseau, proxy intermédiaire) laisse la requête pendre indéfiniment côté
// serveur, et la page du marchand reste bloquée sans jamais afficher
// d'erreur (vu en test le 19/08 sur l'upload YouTube). uploadYoutubeVideo
// applique son propre délai plus long, plus bas, vu la taille des fichiers.
const axios = axiosBase.create({ timeout: 20000 });

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
        // invalid_grant = refresh_token définitivement mort (révoqué par le
        // marchand, ou — cas vu en pratique tant que l'appli Google reste en
        // mode "Test" — expiré au bout de 7 jours). Sans ce garde-fou, la
        // page Paramètres → Outils continuait d'afficher "Google connecté"
        // indéfiniment (connectorService.save() met toujours actif=true),
        // pendant que Sami répondait en boucle "Google n'est pas encore
        // connecté" — le marchand n'avait aucun signal pour comprendre qu'il
        // fallait re-cliquer sur "Connecter Google". On désactive donc le
        // connecteur pour que l'état affiché redevienne cohérent avec la
        // réalité. Une erreur réseau/temporaire ne déclenche pas ça.
        if (err.response?.data?.error === "invalid_grant") {
            await connectorService.disconnect(workspaceId, "google");
        }
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

// ── Calendar ───────────────────────────────────────────────────────────
// Agenda Google du marchand — distinct de la table interne `rendez_vous`
// (booking client, engines/commerceEngine.js) : un rendez-vous client y est
// aussi recopié en best-effort (voir syncRdvToCalendar) pour que le marchand
// le voie directement dans son vrai agenda, sans dupliquer la logique métier.
async function listUpcomingEvents(workspaceId, max = 10) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { connected: false, events: [] };

    try {
        const res = await axios.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    maxResults: max,
                    singleEvents: true,
                    orderBy: "startTime",
                    timeMin: new Date().toISOString(),
                },
            }
        );
        const events = (res.data.items || []).map(e => ({
            titre: e.summary || "(sans titre)",
            debut: e.start?.dateTime || e.start?.date || "",
            fin: e.end?.dateTime || e.end?.date || "",
        }));
        return { connected: true, events };
    } catch (err) {
        console.error("❌ google.listUpcomingEvents :", err.response?.data || err.message);
        return { connected: true, events: [], error: true };
    }
}

async function createCalendarEvent(workspaceId, { summary, description = "", startISO, endISO, invites = [], avecMeet = false }) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { success: false, error: "Google non connecté." };

    try {
        const body = {
            summary,
            description,
            start: { dateTime: startISO },
            end: { dateTime: endISO },
        };
        if (invites.length) body.attendees = invites.map(email => ({ email }));
        // Le lien Meet est généré par l'API Agenda elle-même (pas Drive) —
        // conferenceDataVersion=1 est obligatoire dans l'URL pour que Google
        // tienne compte de ce champ, sinon il est silencieusement ignoré.
        if (avecMeet) {
            body.conferenceData = {
                createRequest: {
                    requestId: `samii-${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                },
            };
        }

        const res = await axios.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            body,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    conferenceDataVersion: avecMeet ? 1 : 0,
                    // Sans ça, Google Calendar n'envoie jamais l'email
                    // d'invitation aux participants ajoutés.
                    sendUpdates: invites.length ? "all" : "none",
                },
            }
        );
        return {
            success: true,
            eventId: res.data.id,
            link: res.data.htmlLink,
            meetLink: res.data.hangoutLink || "",
        };
    } catch (err) {
        console.error("❌ google.createCalendarEvent :", err.response?.data || err.message);
        return { success: false, error: "Échec de la création de l'événement." };
    }
}

// Best-effort : appelé après la création d'un rendez-vous client (voir
// engines/commerceEngine.js) — n'échoue jamais bruyamment, un marchand sans
// Google connecté continue de recevoir ses RDV normalement dans SAMII.
async function syncRdvToCalendar(workspaceId, { motif, dateDebut, clientNom }) {
    try {
        const connecteur = await connectorService.getOne(workspaceId, "google");
        if (!connecteur?.actif || !connecteur.config?.refreshToken || !dateDebut) return;
        const fin = new Date(new Date(dateDebut).getTime() + 30 * 60000);
        await createCalendarEvent(workspaceId, {
            summary: `RDV — ${clientNom || "Client"}${motif ? " (" + motif + ")" : ""}`,
            description: "Rendez-vous pris via SAMII.",
            startISO: new Date(dateDebut).toISOString(),
            endISO: fin.toISOString(),
        });
    } catch (err) {
        console.error("❌ google.syncRdvToCalendar :", err.message);
    }
}

// ── Drive ──────────────────────────────────────────────────────────────
// Lecture seule (scope drive.readonly) — sert par ex. à retrouver des PDF
// que le marchand veut faire lire à Sami pour alimenter l'Academy.
async function listDriveFiles(workspaceId, max = 10) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { connected: false, files: [] };

    try {
        const res = await axios.get("https://www.googleapis.com/drive/v3/files", {
            headers: { Authorization: `Bearer ${token}` },
            params: { pageSize: max, fields: "files(id,name,mimeType,webViewLink)", orderBy: "modifiedTime desc" },
        });
        return { connected: true, files: res.data.files || [] };
    } catch (err) {
        console.error("❌ google.listDriveFiles :", err.response?.data || err.message);
        return { connected: true, files: [], error: true };
    }
}

// ── YouTube ────────────────────────────────────────────────────────────
// Upload réel d'une vidéo sur la chaîne du marchand connecté — appelé depuis
// une route avec fichier (pas depuis le chat texte de Sami : une vidéo ne
// peut pas être "décrite" en langage, il faut le vrai fichier).
async function uploadYoutubeVideo(workspaceId, { buffer, mimeType, title, description = "" }) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { success: false, error: "Google non connecté." };

    try {
        const metadata = {
            snippet: { title, description },
            status: { privacyStatus: "public" },
        };
        const boundary = "samii_youtube_upload";
        const multipartBody = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
            buffer,
            Buffer.from(`\r\n--${boundary}--`),
        ]);

        const res = await axios.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
            multipartBody,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": `multipart/related; boundary=${boundary}`,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                // Sans ça, un envoi qui coince côté Google (ou un proxy
                // intermédiaire qui coupe silencieusement) laissait la requête
                // pendre indéfiniment — la page restait bloquée sans jamais
                // afficher d'erreur au marchand.
                timeout: 120000,
            }
        );
        return { success: true, videoId: res.data.id, link: `https://youtube.com/watch?v=${res.data.id}` };
    } catch (err) {
        console.error("❌ google.uploadYoutubeVideo :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.error?.message || "Échec de l'upload YouTube." };
    }
}

// ── Sheets ─────────────────────────────────────────────────────────────
// Crée une nouvelle feuille Google Sheets et l'écrit en une passe — sert
// aux rapports que Sami génère à la demande du marchand (ventes, stock...),
// jamais pour modifier une feuille existante (accès complet demandé, mais
// ce premier usage reste volontairement simple et non destructif).
async function creerRapportSheets(workspaceId, { titre, lignes }) {
    const token = await getValidAccessToken(workspaceId);
    if (!token) return { success: false, error: "Google non connecté." };

    try {
        const createRes = await axios.post(
            "https://sheets.googleapis.com/v4/spreadsheets",
            { properties: { title: titre } },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const spreadsheetId = createRes.data.spreadsheetId;

        if (Array.isArray(lignes) && lignes.length) {
            await axios.put(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1`,
                { values: lignes },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { valueInputOption: "RAW" },
                }
            );
        }

        return { success: true, spreadsheetId, link: createRes.data.spreadsheetUrl };
    } catch (err) {
        console.error("❌ google.creerRapportSheets :", err.response?.data || err.message);
        return { success: false, error: err.response?.data?.error?.message || "Échec de la création de la feuille." };
    }
}

module.exports = {
    getValidAccessToken,
    listRecentEmails,
    sendEmail,
    listUpcomingEvents,
    createCalendarEvent,
    syncRdvToCalendar,
    listDriveFiles,
    uploadYoutubeVideo,
    creerRapportSheets,
};
