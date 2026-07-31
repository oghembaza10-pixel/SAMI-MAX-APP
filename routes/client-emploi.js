// ==========================================================================
// SAMII OS — CLIENT : MISSIONS & EMPLOI — mise en relation locale
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
    <title>Missions & Emploi — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .em-shell { max-width: 780px; margin: 0 auto; padding: 40px 24px 80px; }
        .em-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .em-back:hover { color: var(--cyan-tech); }

        .em-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .em-icon-box {
            width: 46px; height: 46px; border-radius: 13px;
            background: radial-gradient(circle, rgba(157,92,255,0.28), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.45);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.35rem; flex-shrink: 0;
        }
        .em-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.55rem; }
        .em-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 22px; line-height: 1.6; }

        .em-mode-switch {
            display: flex; gap: 8px; margin-bottom: 22px;
            background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .em-mode-btn {
            flex: 1; padding: 12px; border-radius: 9px; border: none;
            background: transparent; color: var(--text-muted); cursor: pointer;
            font-family: var(--font-body); font-size: .85rem; font-weight: 600;
        }
        .em-mode-btn.active { background: #9d5cff; color: #fff; }

        .em-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input, textarea {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        textarea { resize: vertical; min-height: 70px; }
        input:focus, textarea:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.15); }
        .em-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        button.em-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, #9d5cff, #b47fff);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #fff; font-size: .95rem;
        }
        button.em-submit:disabled { opacity: .6; cursor: not-allowed; }
        .em-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }
        .em-msg.ok { color: #3ddc84; }

        .em-results { margin-top: 24px; display: none; flex-direction: column; gap: 10px; }
        .em-result-item {
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.2);
            border-radius: 14px; padding: 16px 18px;
        }
        .em-result-item h3 { color: #fff; font-size: .95rem; margin-bottom: 2px; }
        .em-result-item .entreprise { color: #9d5cff; font-size: .8rem; font-weight: 600; margin-bottom: 8px; }
        .em-result-item p { color: var(--text-muted); font-size: .8rem; line-height: 1.5; margin-bottom: 8px; }
        .em-result-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: .78rem; }
        .em-chip { padding: 3px 10px; border-radius: 20px; background: rgba(95,212,255,0.08); border: 1px solid rgba(95,212,255,0.25); color: var(--cyan-tech); }
        .em-contact-btn {
            display: inline-block; margin-top: 10px; padding: 9px 16px;
            background: #3ddc84; color: #04220f; text-decoration: none; border-radius: 8px;
            font-weight: 700; font-size: .82rem;
        }
        .em-empty { color: var(--text-muted); font-size: .85rem; text-align: center; padding: 20px 0; }

        @media (max-width: 560px) { .em-row { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
<div class="em-shell">
    <a href="/client-qg" class="em-back">← Retour à mon espace</a>

    <div class="em-title">
        <div class="em-icon-box">💼</div>
        <h1>Missions & Emploi</h1>
    </div>
    <p class="sub">Trouve une offre près de toi, ou publie ton besoin de recrutement.</p>

    <div class="em-mode-switch">
        <button type="button" class="em-mode-btn active" data-mode="chercher">🔍 Chercher un emploi</button>
        <button type="button" class="em-mode-btn" data-mode="proposer">📢 Publier une offre</button>
    </div>

    <!-- ── CHERCHER ── -->
    <div id="bloc-chercher">
        <div class="em-card">
            <form id="form-chercher">
                <label>Quel poste ou métier cherches-tu ?</label>
                <input name="titre_poste" placeholder="Ex : vendeur, livreur, community manager..." required>

                <div class="em-row">
                    <div>
                        <label>Ville</label>
                        <input name="ville" placeholder="Ex : Alger" required>
                    </div>
                    <div>
                        <label>Pays</label>
                        <input name="pays" placeholder="Ex : Algérie" required>
                    </div>
                </div>

                <button type="submit" class="em-submit">🔍 Chercher</button>
            </form>
            <div class="em-msg" id="msg-chercher"></div>
        </div>
        <div class="em-results" id="results"></div>
    </div>

    <!-- ── PROPOSER ── -->
    <div id="bloc-proposer" style="display:none;">
        <div class="em-card">
            <form id="form-proposer">
                <label>Titre du poste</label>
                <input name="titre_poste" placeholder="Ex : vendeur, livreur, community manager..." required>

                <div class="em-row">
                    <div>
                        <label>Type de contrat</label>
                        <input name="type_contrat" placeholder="Ex : CDI, mission ponctuelle, stage..." required>
                    </div>
                    <div>
                        <label>Salaire / rémunération</label>
                        <input name="salaire" placeholder="Ex : 40 000 DZD/mois" required>
                    </div>
                </div>

                <label>Nom de ton entreprise / activité</label>
                <input name="entreprise_nom" placeholder="Ex : Boutique Le Souverain" required>

                <div class="em-row">
                    <div>
                        <label>Ville</label>
                        <input name="ville" placeholder="Ex : Alger" required>
                    </div>
                    <div>
                        <label>Pays</label>
                        <input name="pays" placeholder="Ex : Algérie" required>
                    </div>
                </div>

                <div class="em-row">
                    <div>
                        <label>Téléphone de contact</label>
                        <input name="contact_telephone" placeholder="Ton numéro" required>
                    </div>
                    <div>
                        <label>Email de contact (optionnel)</label>
                        <input name="contact_email" placeholder="ton@email.com">
                    </div>
                </div>

                <label>Description du poste</label>
                <textarea name="description" placeholder="Décris la mission, les compétences requises..."></textarea>

                <button type="submit" class="em-submit">📢 Publier l'offre</button>
            </form>
            <div class="em-msg" id="msg-proposer"></div>
        </div>
    </div>
</div>

<script>
document.querySelectorAll('.em-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.em-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        document.getElementById('bloc-chercher').style.display = mode === 'chercher' ? 'block' : 'none';
        document.getElementById('bloc-proposer').style.display = mode === 'proposer' ? 'block' : 'none';
    });
});

function renderResults(list) {
    const container = document.getElementById('results');
    if (!list.length) {
        container.innerHTML = '<div class="em-empty">Aucune offre trouvée pour ce poste dans cette ville pour l\\'instant. Reviens bientôt !</div>';
        container.style.display = 'flex';
        return;
    }
    container.innerHTML = list.map(o => \`
        <div class="em-result-item">
            <h3>\${o.titre_poste}</h3>
            <div class="entreprise">\${o.entreprise_nom || ''}</div>
            <p>\${o.description || 'Pas de description.'}</p>
            <div class="em-result-meta">
                <span class="em-chip">📋 \${o.type_contrat}</span>
                <span class="em-chip">💰 \${o.salaire}</span>
                <span class="em-chip">📍 \${o.ville}</span>
            </div>
            <a href="tel:\${o.contact_telephone}" class="em-contact-btn">📞 Contacter →</a>
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
    msg.className = 'em-msg';

    try {
        const res  = await fetch('/client-qg/emploi/chercher', {
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
    msg.className = 'em-msg';

    try {
        const res  = await fetch('/client-qg/emploi/proposer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
            msg.textContent = '✅ Ton offre est publiée !';
            msg.className = 'em-msg ok';
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
        const { titre_poste, ville } = req.body;
        if (!titre_poste || !ville) {
            return res.json({ success: false, error: "Indique le poste et la ville." });
        }

        const resultats = await airtable.find(
            "EMPLOIS",
            `AND({actif}=1, SEARCH(LOWER("${titre_poste}"), LOWER({titre_poste})), SEARCH(LOWER("${ville}"), LOWER({ville})))`,
            30
        );

        res.json({
            success: true,
            resultats: resultats.map(r => r.fields),
        });

    } catch (err) {
        console.error("❌ POST /client-qg/emploi/chercher :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche." });
    }
});

router.post("/proposer", requireAuth, async (req, res) => {
    try {
        const { titre_poste, type_contrat, entreprise_nom, ville, pays, salaire, description, contact_telephone, contact_email } = req.body;

        if (!titre_poste || !type_contrat || !entreprise_nom || !ville || !pays || !salaire || !contact_telephone) {
            return res.json({ success: false, error: "Tous les champs obligatoires doivent être remplis." });
        }

        await airtable.create("EMPLOIS", {
            titre_poste,
            type_contrat,
            entreprise_nom,
            ville,
            pays,
            salaire,
            description: description || "",
            contact_telephone,
            contact_email: contact_email || "",
            actif: true,
            date_creation: new Date().toISOString(),
        });

        res.json({ success: true });

    } catch (err) {
        console.error("❌ POST /client-qg/emploi/proposer :", err.message);
        res.json({ success: false, error: "Erreur lors de la publication." });
    }
});

module.exports = router;
