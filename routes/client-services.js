// ==========================================================================
// SAMII OS — CLIENT : SERVICES — Mise en relation locale (livraison, garde, etc.)
// ==========================================================================
const express = require("express");
const router  = express.Router();
const airtable = require("../services/airtable");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

router.get("/", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Services — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .sv-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .sv-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .sv-back:hover { color: var(--cyan-tech); }

        .sv-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .sv-icon-box {
            width: 46px; height: 46px; border-radius: 13px;
            background: radial-gradient(circle, rgba(157,92,255,0.28), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.45);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.35rem; flex-shrink: 0;
        }
        .sv-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.55rem; }
        .sv-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 22px; line-height: 1.6; }

        .sv-mode-switch {
            display: flex; gap: 8px; margin-bottom: 22px;
            background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .sv-mode-btn {
            flex: 1; padding: 12px; border-radius: 9px; border: none;
            background: transparent; color: var(--text-muted); cursor: pointer;
            font-family: var(--font-body); font-size: .85rem; font-weight: 600;
        }
        .sv-mode-btn.active { background: #9d5cff; color: #fff; }

        .sv-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.15); }
        .sv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        button.sv-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, #9d5cff, #b47fff);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #fff; font-size: .95rem;
        }
        button.sv-submit:disabled { opacity: .6; cursor: not-allowed; }
        .sv-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }
        .sv-msg.ok { color: #3ddc84; }

        .sv-results { margin-top: 24px; display: none; flex-direction: column; gap: 10px; }
        .sv-result-item {
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.2);
            border-radius: 14px; padding: 16px 18px;
        }
        .sv-result-item h3 { color: #fff; font-size: .95rem; margin-bottom: 4px; }
        .sv-result-item p { color: var(--text-muted); font-size: .8rem; line-height: 1.5; margin-bottom: 8px; }
        .sv-result-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: .78rem; }
        .sv-chip { padding: 3px 10px; border-radius: 20px; background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.25); color: var(--cyan-tech); }
        .sv-contact-btn {
            display: inline-block; margin-top: 10px; padding: 9px 16px;
            background: #3ddc84; color: #04220f; text-decoration: none; border-radius: 8px;
            font-weight: 700; font-size: .82rem;
        }
        .sv-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 20px 0; }

        @media (max-width: 560px) { .sv-row { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
<div class="sv-shell">
    <a href="/client-qg" class="sv-back">← Retour à mon espace</a>

    <div class="sv-title">
        <div class="sv-icon-box">🛎️</div>
        <h1>Services</h1>
    </div>
    <p class="sub">Trouve un prestataire près de toi, ou propose ton propre service.</p>

    <div class="sv-mode-switch">
        <button type="button" class="sv-mode-btn active" data-mode="chercher">🔍 Chercher un service</button>
        <button type="button" class="sv-mode-btn" data-mode="proposer">💼 Proposer mon service</button>
    </div>

    <!-- ── CHERCHER ── -->
    <div id="bloc-chercher">
        <div class="sv-card">
            <form id="form-chercher">
                <label>Quel service cherches-tu ?</label>
                <input name="type_service" placeholder="Ex : livraison, garde d'enfant, garde d'animal..." required>

                <div class="sv-row">
                    <div>
                        <label>Ville</label>
                        <input name="ville" placeholder="Ex : Alger" required>
                    </div>
                    <div>
                        <label>Pays</label>
                        <input name="pays" placeholder="Ex : Algérie" required>
                    </div>
                </div>

                <button type="submit" class="sv-submit">🔍 Chercher</button>
            </form>
            <div class="sv-msg" id="msg-chercher"></div>
        </div>
        <div class="sv-results" id="results"></div>
    </div>

    <!-- ── PROPOSER ── -->
    <div id="bloc-proposer" style="display:none;">
        <div class="sv-card">
            <form id="form-proposer">
                <label>Quel service proposes-tu ?</label>
                <input name="type_service" placeholder="Ex : livraison, garde d'enfant, garde d'animal..." required>

                <label>Ton nom</label>
                <input name="nom_prestataire" placeholder="Ton nom" required>

                <div class="sv-row">
                    <div>
                        <label>Téléphone</label>
                        <input name="telephone" placeholder="Ton numéro" required>
                    </div>
                    <div>
                        <label>Tarif</label>
                        <input name="tarif" placeholder="Ex : 500 DZD/heure" required>
                    </div>
                </div>

                <div class="sv-row">
                    <div>
                        <label>Ville</label>
                        <input name="ville" placeholder="Ex : Alger" required>
                    </div>
                    <div>
                        <label>Pays</label>
                        <input name="pays" placeholder="Ex : Algérie" required>
                    </div>
                </div>

                <label>Description (optionnel)</label>
                <textarea name="description" placeholder="Décris ton service, ton expérience..."></textarea>

                <button type="submit" class="sv-submit">💼 Publier mon service</button>
            </form>
            <div class="sv-msg" id="msg-proposer"></div>
        </div>
    </div>
</div>

<script>
document.querySelectorAll('.sv-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sv-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        document.getElementById('bloc-chercher').style.display = mode === 'chercher' ? 'block' : 'none';
        document.getElementById('bloc-proposer').style.display = mode === 'proposer' ? 'block' : 'none';
    });
});

function renderResults(list) {
    const container = document.getElementById('results');
    if (!list.length) {
        container.innerHTML = '<div class="sv-empty">Aucun prestataire trouvé pour ce service dans cette ville pour l\\'instant. Reviens bientôt, ou sois le premier à le proposer !</div>';
        container.style.display = 'flex';
        return;
    }
    container.innerHTML = list.map(s => \`
        <div class="sv-result-item">
            <h3>\${s.nom_prestataire}</h3>
            <p>\${s.description || 'Pas de description.'}</p>
            <div class="sv-result-meta">
                <span class="sv-chip">💰 \${s.tarif}</span>
                <span class="sv-chip">📍 \${s.ville}</span>
            </div>
            <a href="tel:\${s.telephone}" class="sv-contact-btn">📞 Contacter →</a>
        </div>
    \`).join('');
    container.style.display = 'flex';
}

document.getElementById('form-chercher').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg-chercher');
    const btn  = e.target.querySelector('button');
    const data = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '🔍 Recherche en cours...';
    msg.className = 'sv-msg';

    try {
        const res  = await fetch('/client-qg/services/chercher', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = '';
            renderResults(json.resultats || []);
        } else {
            msg.textContent = json.error || '❌ Erreur.';
        }
    } catch (err) {
        msg.textContent = '❌ Erreur réseau.';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('form-proposer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg  = document.getElementById('msg-proposer');
    const btn  = e.target.querySelector('button');
    const data = Object.fromEntries(new FormData(e.target));

    btn.disabled = true;
    msg.textContent = '⏳ Publication en cours...';
    msg.className = 'sv-msg';

    try {
        const res  = await fetch('/client-qg/services/proposer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = '✅ Ton service est publié !';
            msg.className = 'sv-msg ok';
            e.target.reset();
        } else {
            msg.textContent = json.error || '❌ Erreur.';
        }
    } catch (err) {
        msg.textContent = '❌ Erreur réseau.';
    } finally {
        btn.disabled = false;
    }
});
</script>
</body>
</html>`);
});

router.post("/chercher", requireAuth, async (req, res) => {
    try {
        const { type_service, ville, pays } = req.body;
        if (!type_service || !ville) {
            return res.json({ success: false, error: "Indique le service et la ville." });
        }

        const resultats = await airtable.find(
            "SERVICES",
            `AND({actif}=1, SEARCH(LOWER("${type_service}"), LOWER({type_service})), SEARCH(LOWER("${ville}"), LOWER({ville})))`,
            30
        );

        res.json({
            success: true,
            resultats: resultats.map(r => r.fields),
        });

    } catch (err) {
        console.error("❌ POST /client-qg/services/chercher :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche." });
    }
});

router.post("/proposer", requireAuth, async (req, res) => {
    try {
        const { type_service, nom_prestataire, telephone, tarif, ville, pays, description } = req.body;

        if (!type_service || !nom_prestataire || !telephone || !tarif || !ville || !pays) {
            return res.json({ success: false, error: "Tous les champs obligatoires doivent être remplis." });
        }

        await airtable.create("SERVICES", {
            type_service,
            nom_prestataire,
            telephone,
            tarif,
            ville,
            pays,
            description: description || "",
            email_prestataire: req.session.email || "",
            actif: true,
            date_creation: new Date().toISOString(),
        });

        res.json({ success: true });

    } catch (err) {
        console.error("❌ POST /client-qg/services/proposer :", err.message);
        res.json({ success: false, error: "Erreur lors de la publication." });
    }
});

module.exports = router;
