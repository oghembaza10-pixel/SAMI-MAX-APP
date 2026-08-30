// ==========================================================================
// SAMII OS — DISCUSSIONS — Tchat général + tchats de groupe
// Tables déjà existantes en base (discussions, discussion_messages,
// discussion_membres), jamais branchées avant ce chantier.
// ==========================================================================
const express = require("express");
const router = express.Router();
const communautes = require("../config/communautes");

// ── CHACUNE SES CONVERSATIONS ───────────────────────────────────────────
//
// Rien ne cloisonnait les discussions. « Les groupes à rejoindre » listait
// TOUS les groupes de la base : les membres d'une partenaire voyaient les
// nôtres, pouvaient les rejoindre, et lire ce qui s'y dit. Ce n'est pas une
// fuite de marque comme les autres — c'est une fuite de conversations
// privées entre deux entreprises qui n'ont rien à partager.
//
// La communauté vient du SERVICE (res.locals.COM, posé dans index.js) :
// sur son domaine, ses groupes ; sur le nôtre, les nôtres.
function communauteDe(res) {
    return res.locals?.COM?.slug || communautes.DEFAUT;
}
const db = require("../services/db");
const socketService = require("../services/socketService");
const planner = require("../brain/planner");
const CONFIG = require("../config");

const SAMII_USER_ID = CONFIG.SAMII_IA_USER_ID;

// SAMII n'intervient pas sur chaque message (ce serait envahissant dans un
// vrai tchat entre humains) — seulement quand on l'appelle directement, ou
// quand le message ressemble à une vraie question (prix, produit, aide).
function samiiDoitRepondre(texte) {
    const t = texte.toLowerCase();
    if (/@?samii\b/.test(t) || /\bsami\b/.test(t)) return true;
    if (/\?/.test(t)) return true;
    return /\b(prix|combien|coûte|coute|tarif|comment|où|ou trouve|besoin d'aide|aide moi|c'est quoi)\b/.test(t);
}

function requireAuth(req, res, next) { if (!req.session?.loggedIn) return res.redirect("/login"); next(); }
function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function initiales(nom){ return String(nom||"").trim().split(" ").map(p=>p.charAt(0).toUpperCase()).slice(0,2).join("") || "OG"; }
function timeAgo(date) {
    const s = Math.floor((Date.now()-new Date(date).getTime())/1000);
    if (s<60) return "à l'instant";
    const m=Math.floor(s/60); if(m<60) return `il y a ${m} min`;
    const h=Math.floor(m/60); if(h<24) return `il y a ${h} h`;
    const d=Math.floor(h/24); return `il y a ${d} j`;
}

// Le chat général — UN PAR COMMUNAUTÉ, et c'est tout l'enjeu.
//
// Il n'y en avait qu'un pour toute la base. Sur le service d'une
// partenaire, ses membres seraient donc entrés dans NOTRE salle générale et
// y auraient écrit, au milieu de nos conversations, sans que ni eux ni nous
// ne comprenions pourquoi. Le nom de la salle portait même notre marque.
//
// La salle se crée toute seule à la première visite, sous le nom de la
// communauté : personne n'a à la préparer à l'avance.
async function getOrCreateGeneral(res) {
    const slug = communauteDe(res);
    const rows = await db.query(
        `SELECT * FROM discussions
          WHERE type = 'general' AND COALESCE(communaute, $2) = $1 LIMIT 1`,
        [slug, communautes.DEFAUT]);
    if (rows[0]) return rows[0];

    const COM = res.locals?.COM || communautes.get(slug);
    const created = await db.query(
        `INSERT INTO discussions (type, nom, created_by, communaute)
         VALUES ('general',$1,NULL,$2) RETURNING *`,
        [`Chat général · ${COM.nom}`, slug]
    );
    return created[0];
}

async function estMembre(discussionId, userId) {
    const rows = await db.query(
        `SELECT 1 FROM discussion_membres WHERE discussion_id = $1 AND user_id = $2`,
        [discussionId, userId]
    );
    return rows.length > 0;
}

// ==========================================================================
// LISTE DES DISCUSSIONS
// ==========================================================================
router.get("/", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    // La marque du service : sur son domaine, ce salon est le sien.
    const COM = res.locals?.COM || communautes.get(communautes.DEFAUT);
    let general, mesGroupes = [], groupesARejoindre = [];

    try {
        general = await getOrCreateGeneral(res);

        mesGroupes = await db.query(
            `SELECT d.*, (SELECT contenu FROM discussion_messages WHERE discussion_id = d.id ORDER BY created_at DESC LIMIT 1) AS dernier_message,
                    (SELECT COUNT(*) FROM discussion_membres WHERE discussion_id = d.id) AS nb_membres
             FROM discussions d
             JOIN discussion_membres dm ON dm.discussion_id = d.id
             WHERE dm.user_id = $1 AND d.type = 'groupe'
               AND COALESCE(d.communaute, $3) = $2
             ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC`,
            [userId, communauteDe(res), communautes.DEFAUT]
        );

        groupesARejoindre = await db.query(
            `SELECT d.*, (SELECT COUNT(*) FROM discussion_membres WHERE discussion_id = d.id) AS nb_membres
             FROM discussions d
             WHERE d.type = 'groupe'
               AND COALESCE(d.communaute, $3) = $2
               AND d.id NOT IN (
                 SELECT discussion_id FROM discussion_membres WHERE user_id = $1
             )
             ORDER BY d.created_at DESC LIMIT 20`,
            [userId, communauteDe(res), communautes.DEFAUT]
        );
    } catch (err) {
        console.error("❌ GET /discussions :", err.message);
        return res.status(500).send("Erreur de chargement des discussions.");
    }

    const groupesHtml = mesGroupes.length ? mesGroupes.map(g => `
        <a class="disc-item" href="/discussions/${g.id}">
            <div class="disc-avatar">${initiales(g.nom)}</div>
            <div class="disc-info">
                <strong>${escapeHtml(g.nom)}</strong>
                <span>${g.dernier_message ? escapeHtml(g.dernier_message).slice(0,50) : `${g.nb_membres} membre${g.nb_membres>1?"s":""}`}</span>
            </div>
        </a>`).join("") : `<p class="disc-empty">Tu n'as encore rejoint aucun groupe.</p>`;

    const decouvrirHtml = groupesARejoindre.length ? groupesARejoindre.map(g => `
        <div class="disc-item disc-item--decouvrir">
            <div class="disc-avatar">${initiales(g.nom)}</div>
            <div class="disc-info">
                <strong>${escapeHtml(g.nom)}</strong>
                <span>${g.nb_membres} membre${g.nb_membres>1?"s":""}</span>
            </div>
            <button class="disc-join-btn" data-id="${g.id}" type="button">Rejoindre</button>
        </div>`).join("") : `<p class="disc-empty">Aucun groupe à découvrir pour l'instant.</p>`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discussions — ${escapeHtml(COM.nom)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; padding-bottom:40px; }
.disc-shell { max-width:640px; margin:0 auto; padding:20px 16px 60px; }
.disc-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.disc-header h1 { font-size:20px; margin:0; }
.disc-header a { color:var(--muted); text-decoration:none; font-size:13px; }
.disc-section-title { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin:22px 0 10px; }
.disc-item { display:flex; align-items:center; gap:12px; padding:12px; border-radius:14px; background:var(--panel); border:1px solid var(--border); text-decoration:none; color:var(--text); margin-bottom:8px; }
.disc-item:hover { border-color:var(--blue); }
.disc-avatar { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-weight:900; font-size:13px; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.disc-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.disc-info strong { font-size:13.5px; }
.disc-info span { font-size:11.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.disc-join-btn { padding:8px 14px; border-radius:10px; border:1px solid var(--border); background:rgba(0,217,255,.1); color:var(--blue); font-weight:700; font-size:11.5px; cursor:pointer; }
.disc-empty { color:var(--muted); font-size:12.5px; padding:14px 0; }
.disc-general { border-color:rgba(215,179,76,.4); background:rgba(215,179,76,.06); }
.disc-general .disc-avatar { background:linear-gradient(135deg,#d7b34c,#a9822f); }
.new-group-form { display:flex; gap:8px; margin-top:10px; }
.new-group-form input { flex:1; padding:11px 13px; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13px; }
.new-group-form button { padding:11px 16px; border:none; border-radius:10px; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; font-weight:800; font-size:12.5px; cursor:pointer; }
</style>
</head>
<body>
<div class="disc-shell">
    <div class="disc-header">
        <h1>💬 Discussions</h1>
        <a href="/community">← Communauté</a>
    </div>

    <a class="disc-item disc-general" href="/discussions/${general.id}">
        <div class="disc-avatar">👑</div>
        <div class="disc-info">
            <strong>${escapeHtml(general.nom)}</strong>
            <span>Le fil ouvert à tous les membres de ${escapeHtml(COM.nom)}</span>
        </div>
    </a>

    <div class="disc-section-title">Mes groupes</div>
    ${groupesHtml}

    <form class="new-group-form" id="formNouveauGroupe">
        <input type="text" id="nomGroupe" placeholder="Nom du nouveau groupe" maxlength="80" required>
        <button type="submit">Créer</button>
    </form>

    <div class="disc-section-title">Découvrir des groupes</div>
    ${decouvrirHtml}
</div>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

document.getElementById("formNouveauGroupe").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = document.getElementById("nomGroupe").value.trim();
    if (!nom) return;
    const res = await fetch("/discussions/groupe", {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nom })
    });
    const json = await res.json();
    if (json.success) window.location.href = "/discussions/" + json.id;
    else alert(json.error || "Erreur.");
});

document.querySelectorAll(".disc-join-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "...";
        const res = await fetch("/discussions/" + btn.dataset.id + "/rejoindre", { method:"POST" });
        const json = await res.json();
        if (json.success) window.location.href = "/discussions/" + btn.dataset.id;
        else { btn.disabled = false; btn.textContent = "Rejoindre"; alert(json.error || "Erreur."); }
    });
});
</script>
</body>
</html>`);
});

// ==========================================================================
// CRÉER UN GROUPE
// ==========================================================================
router.post("/groupe", requireAuth, async (req, res) => {
    try {
        const nom = (req.body.nom || "").trim().slice(0, 80);
        if (!nom) return res.json({ success:false, error:"Nom du groupe requis." });

        const rows = await db.query(
            `INSERT INTO discussions (type, nom, created_by, communaute) VALUES ('groupe',$1,$2,$3) RETURNING id`,
            [nom, req.session.userId, communauteDe(res)]
        );
        const discussionId = rows[0].id;

        await db.query(
            `INSERT INTO discussion_membres (discussion_id, user_id, role) VALUES ($1,$2,'admin')`,
            [discussionId, req.session.userId]
        );

        res.json({ success:true, id: discussionId });
    } catch (err) {
        console.error("❌ POST /discussions/groupe :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ==========================================================================
// REJOINDRE UN GROUPE
// ==========================================================================
router.post("/:id/rejoindre", requireAuth, async (req, res) => {
    try {
        const discussionId = parseInt(req.params.id, 10);
        const existe = await db.query(
            `SELECT id FROM discussions
              WHERE id = $1 AND type = 'groupe' AND COALESCE(communaute, $3) = $2`,
            [discussionId, communauteDe(res), communautes.DEFAUT]);
        if (!existe.length) return res.json({ success:false, error:"Groupe introuvable." });

        const dejaMembre = await estMembre(discussionId, req.session.userId);
        if (!dejaMembre) {
            await db.query(
                `INSERT INTO discussion_membres (discussion_id, user_id, role) VALUES ($1,$2,'membre')`,
                [discussionId, req.session.userId]
            );
        }
        res.json({ success:true });
    } catch (err) {
        console.error("❌ POST /discussions/:id/rejoindre :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ==========================================================================
// FIL DE DISCUSSION (page + envoi de message)
// ==========================================================================
router.get("/:id", requireAuth, async (req, res) => {
    const discussionId = parseInt(req.params.id, 10);
    const userId = req.session.userId;
    const COM = res.locals?.COM || communautes.get(communautes.DEFAUT);
    let discussion, messages = [];

    try {
        const rows = await db.query(`SELECT * FROM discussions WHERE id = $1`, [discussionId]);
        discussion = rows[0];
        if (!discussion) return res.status(404).send("Discussion introuvable.");

        if (discussion.type === "groupe" && !(await estMembre(discussionId, userId))) {
            return res.status(403).send(`<div style="background:#03060b;color:#f5fbff;font-family:sans-serif;padding:60px;text-align:center;">
                <h2>🔒 Ce groupe est privé</h2><p><a href="/discussions/${discussionId}/rejoindre" style="color:#00d9ff;">Rejoins-le d'abord</a> ou <a href="/discussions" style="color:#00d9ff;">retourne aux discussions</a>.</p></div>`);
        }

        messages = await db.query(
            `SELECT dm.*, u.prenom, u.nom FROM discussion_messages dm
             LEFT JOIN utilisateurs u ON u.id = dm.expediteur_id
             WHERE dm.discussion_id = $1 ORDER BY dm.created_at ASC LIMIT 200`,
            [discussionId]
        );
    } catch (err) {
        console.error("❌ GET /discussions/:id :", err.message);
        return res.status(500).send("Erreur de chargement.");
    }

    const messagesHtml = messages.map(m => {
        const estIa = m.expediteur_id === SAMII_USER_ID;
        const moi = !estIa && m.expediteur_id === userId;
        const nom = estIa ? `${COM.assistant} 🤖` : (`${m.prenom || ""} ${m.nom || ""}`.trim() || "Membre");
        return `
        <div class="msg-row ${moi ? "msg-row--moi" : ""} ${estIa ? "msg-row--ia" : ""}">
            ${!moi ? `<div class="msg-avatar">${estIa ? "🤖" : initiales(nom)}</div>` : ""}
            <div class="msg-bubble">
                ${!moi ? `<span class="msg-author">${escapeHtml(nom)}${estIa ? ' <span class="msg-ia-badge">IA</span>' : ''}</span>` : ""}
                ${m.contenu ? `<p>${escapeHtml(m.contenu)}</p>` : ""}
                ${m.media_url ? `<img src="${escapeHtml(m.media_url)}" alt="">` : ""}
                <time>${timeAgo(m.created_at)}</time>
            </div>
        </div>`;
    }).join("");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(discussion.nom)} — ${escapeHtml(COM.nom)}</title>
<script src="https://unpkg.com/lucide@latest"></script>
<script src="/socket.io/socket.io.js"></script>
<style>
:root { --bg:#03060b; --panel:rgba(9,18,29,.88); --text:#f5fbff; --muted:#7f96a8; --blue:#00d9ff; --blue-2:#0077ff; --border:rgba(0,217,255,.16); }
* { box-sizing:border-box; }
html,body { height:100%; margin:0; }
body { display:flex; flex-direction:column; background:var(--bg); color:var(--text); font-family:Inter,sans-serif; }
.chat-header { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border); background:var(--panel); position:sticky; top:0; z-index:5; }
.chat-header a { color:var(--muted); text-decoration:none; }
.chat-header strong { font-size:14.5px; }
.chat-body { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
.msg-row { display:flex; gap:8px; align-items:flex-end; max-width:80%; }
.msg-row--moi { align-self:flex-end; flex-direction:row-reverse; max-width:80%; }
.msg-avatar { width:28px; height:28px; border-radius:8px; display:grid; place-items:center; font-size:10px; font-weight:900; color:white; background:linear-gradient(135deg,var(--blue),var(--blue-2)); flex-shrink:0; }
.msg-bubble { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:9px 13px; }
.msg-row--moi .msg-bubble { background:linear-gradient(135deg,rgba(0,217,255,.22),rgba(0,119,255,.14)); border-color:rgba(0,217,255,.35); }
.msg-author { display:block; font-size:10.5px; color:var(--blue); font-weight:700; margin-bottom:3px; }
.msg-row--ia .msg-avatar { background:linear-gradient(135deg,#9d5cff,#d7b34c); }
.msg-row--ia .msg-bubble { border-color:rgba(157,92,255,.4); background:rgba(157,92,255,.08); }
.msg-ia-badge { display:inline-block; font-size:8.5px; font-weight:900; letter-spacing:.04em; color:#9d5cff; background:rgba(157,92,255,.15); border:1px solid rgba(157,92,255,.35); border-radius:5px; padding:1px 5px; margin-left:4px; vertical-align:middle; }
.msg-bubble p { margin:0; font-size:13px; line-height:1.5; word-break:break-word; }
.msg-bubble img { max-width:100%; border-radius:10px; margin-top:6px; }
.msg-bubble time { display:block; font-size:9.5px; color:var(--muted); margin-top:4px; text-align:right; }
.chat-input-row { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--border); background:var(--panel); }
.chat-input-row input { flex:1; padding:12px 14px; border-radius:20px; border:1px solid var(--border); background:rgba(0,0,0,.3); color:var(--text); font-size:13.5px; outline:none; }
.chat-input-row button { width:42px; height:42px; border-radius:50%; border:none; background:linear-gradient(135deg,var(--blue),var(--blue-2)); color:#001018; display:grid; place-items:center; cursor:pointer; flex-shrink:0; }
</style>
</head>
<body>
<div class="chat-header">
    <a href="/discussions"><i data-lucide="arrow-left"></i></a>
    <strong>${discussion.type === "general" ? "👑 " : "👥 "}${escapeHtml(discussion.nom)}</strong>
</div>
<div class="chat-body" id="chatBody">${messagesHtml}</div>
<form class="chat-input-row" id="formMessage">
    <input type="text" id="inputMessage" placeholder="Écris un message..." autocomplete="off" required>
    <button type="submit"><i data-lucide="send"></i></button>
</form>
<script>
if (typeof lucide !== "undefined") lucide.createIcons();

const discussionId = ${discussionId};
const monId = "${escapeHtml(userId)}";
const chatBody = document.getElementById("chatBody");
chatBody.scrollTop = chatBody.scrollHeight;

const socket = io();
socket.emit("join", "discussion-" + discussionId);

function ajouterMessage(m) {
    const moi = !m.est_ia && m.expediteur_id === monId;
    const row = document.createElement("div");
    row.className = "msg-row" + (moi ? " msg-row--moi" : "") + (m.est_ia ? " msg-row--ia" : "");
    row.innerHTML = (!moi ? '<div class="msg-avatar">' + (m.est_ia ? "🤖" : (m.nom_initiales || "OG")) + '</div>' : "") +
        '<div class="msg-bubble">' +
        (!moi ? '<span class="msg-author">' + (m.nom_auteur || "Membre") + (m.est_ia ? ' <span class="msg-ia-badge">IA</span>' : '') + '</span>' : "") +
        (m.contenu ? '<p></p>' : "") +
        '<time>à l\\'instant</time></div>';
    if (m.contenu) row.querySelector("p").textContent = m.contenu;
    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
}

socket.on("nouveau-message-discussion", (m) => {
    if (m.discussion_id !== discussionId) return;
    ajouterMessage(m);
});

document.getElementById("formMessage").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("inputMessage");
    const contenu = input.value.trim();
    if (!contenu) return;
    input.value = "";
    await fetch("/discussions/" + discussionId + "/message", {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ contenu })
    });
});
</script>
</body>
</html>`);
});

router.post("/:id/message", requireAuth, async (req, res) => {
    try {
        const discussionId = parseInt(req.params.id, 10);
        const contenu = (req.body.contenu || "").trim().slice(0, 2000);
        if (!contenu) return res.json({ success:false, error:"Message vide." });

        const discRows = await db.query(`SELECT * FROM discussions WHERE id = $1`, [discussionId]);
        const discussion = discRows[0];
        if (!discussion) return res.json({ success:false, error:"Discussion introuvable." });

        if (discussion.type === "groupe" && !(await estMembre(discussionId, req.session.userId))) {
            return res.status(403).json({ success:false, error:"Tu n'es pas membre de ce groupe." });
        }

        const rows = await db.query(
            `INSERT INTO discussion_messages (discussion_id, expediteur_id, contenu, type) VALUES ($1,$2,$3,'texte') RETURNING *`,
            [discussionId, req.session.userId, contenu]
        );
        const message = rows[0];

        await db.query(`UPDATE discussions SET updated_at = now() WHERE id = $1`, [discussionId]);

        const nomAuteur = (req.session.nom || "Membre").trim();
        socketService.emitToShop(`discussion-${discussionId}`, "nouveau-message-discussion", {
            discussion_id: discussionId,
            expediteur_id: message.expediteur_id,
            contenu: message.contenu,
            nom_auteur: nomAuteur,
            nom_initiales: initiales(nomAuteur),
            created_at: message.created_at,
        });

        res.json({ success:true });

        // SAMII répond après coup (pas d'attente sur l'envoi du message
        // humain) — seulement dans le tchat général, seulement quand c'est
        // pertinent (mention directe ou vraie question), jamais sur les
        // groupes privés non sollicités.
        if (discussion.type === "general" && samiiDoitRepondre(contenu)) {
            repondreCommeSamii(discussionId, contenu, nomAuteur, COM).catch(err => {
                console.error("❌ Réponse SAMII (discussion) :", err.message);
            });
        }
    } catch (err) {
        console.error("❌ POST /discussions/:id/message :", err.message);
        res.json({ success:false, error:"Erreur serveur." });
    }
});

// ── SAMII répond dans le tchat général, comme un membre de plus, mais
// clairement identifié comme IA (jamais un humain) ──────────────────────
async function repondreCommeSamii(discussionId, contenu, nomAuteur, COM) {
    // Passée en paramètre plutôt que lue globalement : cette fonction est
    // appelée en tâche de fond, après la réponse HTTP, et n'a donc plus
    // accès à `res`. Sans elle, la ligne qui nomme l'assistant plantait
    // au moment exact où il répond — c'est-à-dire jamais en relecture,
    // et toujours en production.
    COM = COM || require("../config/communautes").get(require("../config/communautes").DEFAUT);
    const historiqueRows = await db.query(
        `SELECT dm.contenu, dm.expediteur_id, u.prenom FROM discussion_messages dm
         LEFT JOIN utilisateurs u ON u.id = dm.expediteur_id
         WHERE dm.discussion_id = $1 ORDER BY dm.created_at DESC LIMIT 20`,
        [discussionId]
    );
    const history = historiqueRows.reverse().map(m => ({
        role: m.expediteur_id === SAMII_USER_ID ? "model" : "user",
        message: m.expediteur_id === SAMII_USER_ID ? m.contenu : `${m.prenom || "Membre"}: ${m.contenu}`,
    }));

    const reply = await planner.ask(contenu, {
        source: "discussion-generale",
        audience: "community",
        memberName: nomAuteur,
        instructions: [
            // Il se présente sous le nom de la communauté où il parle. Le
            // moteur est le même ; c'est l'étiquette qui change. Ce qui ne
            // change JAMAIS : il dit qu'il est une IA. Un assistant renommé
            // reste un assistant, il ne devient pas quelqu'un.
            `Tu es ${COM.assistant}, et tu participes ici comme IA CLAIREMENT identifiée — jamais tu ne prétends être un humain.`,
            "Réponds naturellement, utilement et brièvement (2-5 phrases), comme une vraie participation à la discussion — jamais un menu ou un formulaire.",
            `Ce salon réunit de vrais membres de ${COM.nom} — ${COM.moteurTexte} Tu peux partager de vraies astuces, de l'actu pertinente pour eux, ou répondre à une question posée, pour que les gens apprennent et participent.`,
            "Ne fabrique jamais de faits, de chiffres ou d'actualités que tu ne connais pas vraiment.",
            "Réponds dans la langue/dialecte du message auquel tu réagis.",
        ].join("\n"),
    }, history);

    const rows = await db.query(
        `INSERT INTO discussion_messages (discussion_id, expediteur_id, contenu, type) VALUES ($1,$2,$3,'texte') RETURNING *`,
        [discussionId, SAMII_USER_ID, reply]
    );
    const message = rows[0];
    await db.query(`UPDATE discussions SET updated_at = now() WHERE id = $1`, [discussionId]);

    socketService.emitToShop(`discussion-${discussionId}`, "nouveau-message-discussion", {
        discussion_id: discussionId,
        expediteur_id: SAMII_USER_ID,
        contenu: message.contenu,
        nom_auteur: `${COM.assistant} 🤖`,
        nom_initiales: "IA",
        est_ia: true,
        created_at: message.created_at,
    });
}

module.exports = router;
