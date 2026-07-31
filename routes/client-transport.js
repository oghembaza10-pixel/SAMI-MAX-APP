// ==========================================================================
// SAMII OS — CLIENT : TRANSPORT — Bus, train, TGV, métro, tous pays
// ==========================================================================
const express = require("express");
const router  = express.Router();
const gemini  = require("../services/geminiService");

function requireAuth(req, res, next) {
    if (!req.session?.loggedIn) return res.redirect("/login");
    next();
}

// ── Base de liens officiels — pas exhaustive, mais large, à enrichir au fil du temps ──
const LIENS_OFFICIELS = {
    DZ: {
        train: { nom: "SNTF", url: "https://www.sntf.dz" },
        bus:   { nom: "ETUSA", url: "https://etusa.dz" },
        metro: { nom: "Métro d'Alger", url: "https://www.metroalger-dz.com" },
    },
    MA: {
        train: { nom: "ONCF", url: "https://www.oncf-voyages.ma" },
        bus:   { nom: "CTM", url: "https://www.ctm.ma" },
        tgv:   { nom: "Al Boraq", url: "https://www.oncf-voyages.ma" },
    },
    TN: {
        train: { nom: "SNCFT", url: "https://www.sncft.com.tn" },
        bus:   { nom: "SNTRI", url: "https://www.sntri.com.tn" },
        metro: { nom: "Transtu", url: "https://www.transtu.tn" },
    },
    FR: {
        train: { nom: "SNCF Connect", url: "https://www.sncf-connect.com" },
        bus:   { nom: "BlaBlaCar Bus", url: "https://www.blablacar.fr/bus" },
        tgv:   { nom: "SNCF Connect (TGV)", url: "https://www.sncf-connect.com" },
        metro: { nom: "RATP", url: "https://www.ratp.fr" },
    },
    BE: { train: { nom: "SNCB", url: "https://www.belgiantrain.be" }, bus: { nom: "FlixBus", url: "https://www.flixbus.be" } },
    CH: { train: { nom: "CFF", url: "https://www.cff.ch" }, bus: { nom: "FlixBus", url: "https://www.flixbus.ch" } },
    DE: { train: { nom: "Deutsche Bahn", url: "https://www.bahn.de" }, tgv: { nom: "ICE (Deutsche Bahn)", url: "https://www.bahn.de" } },
    ES: { train: { nom: "Renfe", url: "https://www.renfe.com" }, tgv: { nom: "AVE (Renfe)", url: "https://www.renfe.com" } },
    IT: { train: { nom: "Trenitalia", url: "https://www.trenitalia.com" }, tgv: { nom: "Frecciarossa", url: "https://www.trenitalia.com" } },
    UK: { train: { nom: "National Rail", url: "https://www.nationalrail.co.uk" } },
    CA: { train: { nom: "VIA Rail Canada", url: "https://www.viarail.ca" }, bus: { nom: "FlixBus Canada", url: "https://www.flixbus.ca" } },
    US: { train: { nom: "Amtrak", url: "https://www.amtrak.com" }, bus: { nom: "Greyhound", url: "https://www.greyhound.com" } },
    EG: { train: { nom: "Egyptian National Railways", url: "https://enr.gov.eg" } },
    SA: { train: { nom: "SAR (Saudi Railways)", url: "https://www.sar.com.sa" } },
    AE: { metro: { nom: "Dubai Metro (RTA)", url: "https://www.rta.ae" } },
    SN: { train: { nom: "TER Sénégal", url: "https://www.ter.sn" } },
    CI: { bus: { nom: "SOTRA (Abidjan)", url: "https://www.sotra.ci" } },
    TR: { train: { nom: "TCDD Taşımacılık", url: "https://www.tcddtasimacilik.gov.tr" } },
    IN: { train: { nom: "IRCTC (Indian Railways)", url: "https://www.irctc.co.in" } },
    CN: { train: { nom: "12306 (China Railway)", url: "https://www.12306.cn" } },
    JP: { train: { nom: "JR (Japan Rail)", url: "https://www.jrpass.com" }, tgv: { nom: "Shinkansen", url: "https://www.jrpass.com" } },
};

router.get("/", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Transport — SAMII</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/client-style.css">
    <style>
        .tr-shell { max-width: 700px; margin: 0 auto; padding: 40px 24px 80px; }
        .tr-back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); text-decoration: none; font-size: .82rem; margin-bottom: 24px; }
        .tr-back:hover { color: var(--cyan-tech); }

        .tr-title { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .tr-icon-box {
            width: 44px; height: 44px; border-radius: 12px;
            background: radial-gradient(circle, rgba(157,92,255,0.25), rgba(95,212,255,0.08));
            border: 1px solid rgba(157,92,255,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; flex-shrink: 0;
        }
        .tr-shell h1 { font-family: var(--font-display); color: #fff; font-size: 1.5rem; }
        .tr-shell p.sub { color: var(--text-muted); font-size: .85rem; margin: 8px 0 22px; line-height: 1.6; }

        .tr-types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .tr-type-btn {
            display: flex; flex-direction: column; align-items: center; gap: 6px;
            padding: 14px 6px; border-radius: 12px;
            background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted); cursor: pointer; text-align: center; font-family: var(--font-body);
            transition: all .2s ease;
        }
        .tr-type-btn .icon { font-size: 1.3rem; }
        .tr-type-btn .label { font-weight: 700; color: var(--text-main); font-size: .74rem; }
        .tr-type-btn.active { border-color: #9d5cff; background: rgba(157,92,255,0.08); box-shadow: 0 0 18px rgba(157,92,255,0.15); }
        .tr-type-btn.active .label { color: #9d5cff; }

        .tr-card { background: var(--bg-glass); backdrop-filter: blur(12px); border: var(--border-soft); border-radius: 16px; padding: 24px; }
        label { display: block; font-family: var(--font-mono); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 14px 0 6px; }
        input {
            width: 100%; padding: 11px 13px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3);
            color: var(--text-main); font-size: .88rem; font-family: var(--font-body);
        }
        input:focus { outline: none; border-color: var(--cyan-tech); box-shadow: 0 0 0 3px rgba(95,212,255,0.15); }
        .tr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        /* Autocomplete pays */
        .tr-pays-wrap { position: relative; }
        .tr-pays-list {
            position: absolute; top: calc(100% + 4px); left: 0; right: 0;
            background: #0d0a1a; border: 1px solid rgba(157,92,255,0.3); border-radius: 10px;
            max-height: 220px; overflow-y: auto; z-index: 20; display: none;
        }
        .tr-pays-list.open { display: block; }
        .tr-pays-item { padding: 10px 14px; cursor: pointer; font-size: .85rem; color: var(--text-main); }
        .tr-pays-item:hover { background: rgba(157,92,255,0.12); }

        button.tr-submit {
            width: 100%; padding: 14px; margin-top: 18px;
            background: linear-gradient(135deg, #9d5cff, #b47fff);
            border: none; border-radius: 10px; font-weight: 700; cursor: pointer; color: #fff; font-size: .95rem;
        }
        button.tr-submit:disabled { opacity: .6; cursor: not-allowed; }
        .tr-msg { text-align: center; margin-top: 14px; font-size: .85rem; color: #e55; min-height: 20px; }

        .tr-results { margin-top: 26px; display: none; flex-direction: column; gap: 14px; }
        .tr-result-card {
            background: var(--bg-panel); border: 1px solid rgba(157,92,255,0.2);
            border-radius: 14px; padding: 18px 20px; color: var(--text-main); font-size: .87rem; line-height: 1.7;
            white-space: pre-wrap;
        }
        .tr-buy-btn {
            display: block; text-align: center; padding: 13px;
            background: linear-gradient(135deg, #3ddc84, #24a85c);
            color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: .9rem;
        }
        .tr-sources { font-size: .78rem; color: var(--text-muted); }
    </style>
</head>
<body>
<div class="tr-shell">
    <a href="/client-qg" class="tr-back">← Retour à mon espace</a>

    <div class="tr-title">
        <div class="tr-icon-box">🚌</div>
        <h1>Transport</h1>
    </div>
    <p class="sub">Choisis ton pays et ton moyen de transport — SAMII cherche les infos pour toi, où que tu sois.</p>

    <div class="tr-types" id="tr-types">
        <button type="button" class="tr-type-btn active" data-type="bus">
            <span class="icon">🚌</span><span class="label">Bus</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="train">
            <span class="icon">🚆</span><span class="label">Train</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="tgv">
            <span class="icon">⚡</span><span class="label">TGV</span>
        </button>
        <button type="button" class="tr-type-btn" data-type="metro">
            <span class="icon">🚇</span><span class="label">Métro/Tram</span>
        </button>
    </div>

    <div class="tr-card">
        <form id="form-tr">
            <input type="hidden" name="type" id="input-type" value="bus">
            <input type="hidden" name="pays" id="input-pays-code" value="">

            <label>Pays</label>
            <div class="tr-pays-wrap">
                <input type="text" id="input-pays-nom" placeholder="Tape le nom de ton pays..." autocomplete="off" required>
                <div class="tr-pays-list" id="tr-pays-list"></div>
            </div>

            <div class="tr-row">
                <div>
                    <label>Ville de départ</label>
                    <input name="depart" placeholder="Ex : Alger" required>
                </div>
                <div>
                    <label>Ville d'arrivée (optionnel)</label>
                    <input name="arrivee" placeholder="Ex : Oran">
                </div>
            </div>

            <button type="submit" class="tr-submit">🚌 Chercher</button>
        </form>
        <div class="tr-msg" id="msg"></div>
    </div>

    <div class="tr-results" id="results">
        <div class="tr-result-card" id="result-content"></div>
        <div id="lien-officiel" style="display:none;"></div>
        <div class="tr-sources" id="sources"></div>
    </div>
</div>

<script>
// Liste large de pays — le client tape, ça filtre. Pas limité à quelques pays.
const PAYS = [
    { code: "DZ", nom: "Algérie" }, { code: "MA", nom: "Maroc" }, { code: "TN", nom: "Tunisie" },
    { code: "FR", nom: "France" }, { code: "BE", nom: "Belgique" }, { code: "CH", nom: "Suisse" },
    { code: "DE", nom: "Allemagne" }, { code: "ES", nom: "Espagne" }, { code: "IT", nom: "Italie" },
    { code: "UK", nom: "Royaume-Uni" }, { code: "CA", nom: "Canada" }, { code: "US", nom: "États-Unis" },
    { code: "EG", nom: "Égypte" }, { code: "SA", nom: "Arabie Saoudite" }, { code: "AE", nom: "Émirats Arabes Unis" },
    { code: "SN", nom: "Sénégal" }, { code: "CI", nom: "Côte d'Ivoire" }, { code: "ML", nom: "Mali" },
    { code: "CM", nom: "Cameroun" }, { code: "TR", nom: "Turquie" }, { code: "IN", nom: "Inde" },
    { code: "CN", nom: "Chine" }, { code: "JP", nom: "Japon" }, { code: "QA", nom: "Qatar" },
    { code: "LY", nom: "Libye" }, { code: "MR", nom: "Mauritanie" }, { code: "JO", nom: "Jordanie" },
    { code: "LB", nom: "Liban" }, { code: "PT", nom: "Portugal" }, { code: "NL", nom: "Pays-Bas" },
];

const inputPaysNom  = document.getElementById('input-pays-nom');
const inputPaysCode = document.getElementById('input-pays-code');
const paysListEl    = document.getElementById('tr-pays-list');

function renderPaysList(filtre) {
    const resultats = PAYS.filter(p => p.nom.toLowerCase().includes(filtre.toLowerCase()));
    paysListEl.innerHTML = resultats.map(p =>
        \`<div class="tr-pays-item" data-code="\${p.code}" data-nom="\${p.nom}">\${p.nom}</div>\`
    ).join('') || '<div class="tr-pays-item" style="color:var(--text-muted);">Aucun résultat — tape quand même, SAMII essaiera de comprendre.</div>';
    paysListEl.classList.add('open');
}

inputPaysNom.addEventListener('input', () => renderPaysList(inputPaysNom.value));
inputPaysNom.addEventListener('focus', () => renderPaysList(inputPaysNom.value));
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tr-pays-wrap')) paysListEl.classList.remove('open');
});
paysListEl.addEventListener('click', (e) => {
    const item = e.target.closest('.tr-pays-item[data-code]');
    if (!item) return;
    inputPaysNom.value = item.dataset.nom;
    inputPaysCode.value = item.dataset.code;
    paysListEl.classList.remove('open');
});

let currentType = 'bus';
document.querySelectorAll('.tr-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tr-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        document.getElementById('input-type').value = currentType;
    });
});

document.getElementById('form-tr').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg     = document.getElementById('msg');
    const results = document.getElementById('results');
    const btn     = e.target.querySelector('button');
    const data    = Object.fromEntries(new FormData(e.target));

    // Si le client a tapé un pays absent de la liste, on envoie quand même le texte tapé
    if (!data.pays) data.pays = inputPaysNom.value;

    btn.disabled = true;
    msg.textContent = '🚌 SAMII cherche les infos...';
    results.style.display = 'none';

    try {
        const res  = await fetch('/client-qg/transport/chercher', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success) {
            msg.textContent = '';
            document.getElementById('result-content').textContent = json.reponse;

            const lienEl = document.getElementById('lien-officiel');
            if (json.lienOfficiel) {
                lienEl.style.display = 'block';
                lienEl.innerHTML = \`<a href="\${json.lienOfficiel.url}" target="_blank" class="tr-buy-btn">🎟️ Acheter sur \${json.lienOfficiel.nom} →</a>\`;
            } else {
                lienEl.style.display = 'none';
            }

            const srcEl = document.getElementById('sources');
            srcEl.innerHTML = (json.sources || []).length
                ? '🔗 ' + json.sources.map(s => \`<a href="\${s.uri}" target="_blank" style="color:var(--cyan-tech);text-decoration:none;">\${s.title}</a>\`).join(' · ')
                : '';
            results.style.display = 'flex';
        } else {
            msg.textContent = json.error || '❌ Erreur. Réessaie.';
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
        const { type, pays, depart, arrivee } = req.body;
        if (!depart) return res.json({ success: false, error: "Indique ta ville de départ." });
        if (!pays) return res.json({ success: false, error: "Indique ton pays." });

        const typesLabel = {
            bus: "bus", train: "train", tgv: "TGV / train à grande vitesse", metro: "métro ou tramway",
        };

        const prompt = "Tu es SAMII, assistant transport pour un particulier.\n\n"
            + `Type de transport : ${typesLabel[type] || "transport"}\n`
            + `Pays : ${pays}\n`
            + `Départ : ${depart}\n`
            + (arrivee ? `Arrivée : ${arrivee}\n` : "")
            + "\nUtilise la recherche web pour trouver des informations concrètes et actuelles : horaires probables, fréquence, prix approximatif, opérateur/compagnie officielle. Réponds directement, en 4-6 lignes claires, sans JSON ni markdown.";

        const result = await gemini.chatWithSearch({
            message: prompt,
            context: { source: "client_transport" },
        });

        // Cherche le lien officiel par code pays si connu, sinon essaie de matcher le texte tapé
        let lienOfficiel = LIENS_OFFICIELS[pays]?.[type] || null;

        res.json({
            success: true,
            reponse: result.text,
            sources: result.sources || [],
            lienOfficiel,
        });

    } catch (err) {
        console.error("❌ POST /client-qg/transport/chercher :", err.message);
        res.json({ success: false, error: "Erreur lors de la recherche. Réessaie." });
    }
});

module.exports = router;
