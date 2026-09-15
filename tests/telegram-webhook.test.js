// ==========================================================================
// SAMII OS — LE WEBHOOK TELEGRAM PROUVE QU'IL VIENT DE TELEGRAM
// ==========================================================================
//
// ── CE QUE CETTE SUITE DÉFEND ─────────────────────────────────────────────
//
// POST /telegram/:workspaceId n'avait AUCUNE authentification. Mesuré avant
// correction, sur l'application en marche :
//
//     POST /telegram/ws-dun-autre-marchand
//     {"message":{"message_id":1,"chat":{"id":424242},"text":"bonjour"}}
//     → HTTP 200, traité, et facturé au propriétaire du QG
//
// Le débit part de routes/telegram.js (creditsSamii.facturerActesWorkspace).
// La référence d'idempotence `tg:<ws>:<chat>:<message_id>` ne protège rien,
// puisque c'est l'appelant qui choisit `message_id` : il lui suffit de le
// faire varier pour rejouer autant de fois qu'il veut.
//
// ── POURQUOI ON TESTE CONTRE L'APPLICATION RÉELLE ────────────────────────
//
// Un test qui lirait le fichier et y chercherait « timingSafeEqual » dirait
// seulement qu'on a ÉCRIT une vérification. Il resterait vert le jour où le
// garde est appelé trop tard, après la facturation. Le seul fait qui compte
// est le code HTTP que l'application rend à une requête forgée.
//
// Cette suite lance donc le vrai serveur, comme metiers-seo.test.js.
// ==========================================================================
const { spawn } = require("child_process");
const path = require("path");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const PORT = 3700 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

// La formule est LUE, jamais recopiée : une copie ici finirait par diverger
// de celle du serveur, et le test passerait au vert sur un serveur cassé.
const { secretPour } = require(path.join(RACINE, "routes", "telegram.js"));

const MISE_A_JOUR = {
    message: {
        message_id: 1,
        chat: { id: 424242 },
        from: { first_name: "Test", language_code: "fr" },
        text: "bonjour",
    },
};

function poster(chemin, entetes) {
    return fetch(`${BASE}${chemin}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(entetes || {}) },
        body: JSON.stringify(MISE_A_JOUR),
    });
}

async function pret(essais = 40) {
    for (let i = 0; i < essais; i++) {
        try {
            const r = await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(2000) });
            if (r.status) return true;
        } catch { /* pas encore debout */ }
        await attendre(500);
    }
    return false;
}

(async () => {
    // Un jeton de bot inventé : le serveur le lira dans son environnement et
    // en dérivera le même secret que nous. Aucun appel n'est fait à Telegram.
    const TOKEN_BOT = "123456:jeton-de-test-pour-la-suite";

    const serveur = spawn(process.execPath, [path.join(RACINE, "index.js")], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: "test", TELEGRAM_BOT_TOKEN: TOKEN_BOT },
        stdio: "ignore",
    });

    const debout = await pret();
    verifier(debout, "l'application ne démarre pas — impossible de tester quoi que ce soit");

    if (debout) {
        const BON = secretPour(TOKEN_BOT);

        // ── 1. AUCUN SECRET → REJET ──────────────────────────────────────
        for (const chemin of ["/telegram/", "/telegram/ws-dun-autre-marchand"]) {
            const r = await poster(chemin);
            verifier(r.status === 401,
                `${chemin} sans en-tête de secret répond ${r.status} au lieu de 401 — ` +
                "n'importe qui fait répondre le modèle et débite le marchand");
        }

        // ── 2. MAUVAIS SECRET → REJET ────────────────────────────────────
        for (const faux of ["pas-le-bon", "", BON.slice(0, -1), BON + "x", BON.toUpperCase()]) {
            const r = await poster("/telegram/ws-dun-autre-marchand",
                { "X-Telegram-Bot-Api-Secret-Token": faux });
            verifier(r.status === 401,
                `un secret faux (« ${faux.slice(0, 12)}… », ${faux.length} caractères) est accepté : ${r.status}`);
        }

        // Un secret de longueur DIFFÉRENTE doit être refusé proprement, pas
        // provoquer une exception : timingSafeEqual lève sur deux tampons de
        // tailles différentes, et une 500 ici trahirait la longueur du bon.
        const rCourt = await poster("/telegram/x", { "X-Telegram-Bot-Api-Secret-Token": "a" });
        verifier(rCourt.status === 401,
            `un secret d'un seul caractère donne ${rCourt.status} — s'il vaut 500, la comparaison ` +
            "lève au lieu de refuser, et le code d'erreur renseigne sur la longueur du vrai secret");

        // ── 3. BON SECRET → TRAITEMENT ───────────────────────────────────
        for (const chemin of ["/telegram/", "/telegram/ws-de-test"]) {
            const r = await poster(chemin, { "X-Telegram-Bot-Api-Secret-Token": BON });
            verifier(r.status === 200,
                `${chemin} avec le BON secret répond ${r.status} au lieu de 200 — ` +
                "le webhook légitime est cassé, les clients du marchand ne sont plus servis");
        }

        // ── 4. LE REJET N'A AUCUN EFFET DE BORD ──────────────────────────
        //
        // On le prouve par le temps, pas par une intention : un traitement
        // réel appelle le modèle et la base. Une requête refusée doit revenir
        // immédiatement, sans avoir rien déclenché.
        const t0 = Date.now();
        await poster("/telegram/ws-dun-autre-marchand", { "X-Telegram-Bot-Api-Secret-Token": "faux" });
        const duree = Date.now() - t0;
        verifier(duree < 1500,
            `une requête refusée met ${duree} ms — elle a déclenché un traitement au lieu ` +
            "d'être écartée d'emblée");

        // ── 5. LE SECRET NE FUIT NULLE PART ──────────────────────────────
        //
        // Ni dans le corps, ni dans les en-têtes de la réponse. Un webhook qui
        // renvoie ce qu'il attend annule la protection qu'on vient d'ajouter.
        const r = await poster("/telegram/ws", { "X-Telegram-Bot-Api-Secret-Token": "faux" });
        const corps = await r.text();
        const enTetes = JSON.stringify([...r.headers.entries()]);
        verifier(!corps.includes(BON) && !enTetes.includes(BON),
            "la réponse d'un rejet contient le secret attendu — le refus l'enseigne à l'attaquant");
        verifier(!corps.includes(TOKEN_BOT) && !enTetes.includes(TOKEN_BOT),
            "la réponse d'un rejet contient le token du bot");
    }

    serveur.kill();

    // ── 6. LA FORMULE EST PARTAGÉE, PAS RECOPIÉE ─────────────────────────
    //
    // routes/connector.js pose le secret à setWebhook. S'il le recalculait de
    // son côté, les deux dérivations divergeraient un jour — et ce jour-là
    // TOUS les bots tombent en même temps, sans que rien n'ait été touché
    // dans telegram.js.
    const fs = require("fs");
    const connector = fs.readFileSync(path.join(RACINE, "routes/connector.js"), "utf8");
    verifier(/secret_token:\s*require\(["']\.\/telegram["']\)\.secretPour\(botToken\)/.test(connector),
        "setWebhook ne pose plus le secret dérivé de routes/telegram.js : les bots persos " +
        "s'enregistreraient sans secret et seraient refusés à la première mise à jour");

    // ── 7. LE GARDE PASSE AVANT LE TRAITEMENT ────────────────────────────
    //
    // L'ordre est la moitié de la protection : vérifier après avoir répondu
    // 200 laisserait la facturation se faire.
    const src = fs.readFileSync(path.join(RACINE, "routes/telegram.js"), "utf8");
    for (const route of [/router\.post\("\/",[\s\S]{0,400}?\}\);/, /router\.post\("\/:workspaceId",[\s\S]{0,400}?\}\);/]) {
        const bloc = (src.match(route) || [""])[0];
        const iGarde = bloc.indexOf("verifierSecret");
        const iTraite = bloc.indexOf("handleUpdate");
        verifier(iGarde !== -1 && iTraite !== -1 && iGarde < iTraite,
            "handleUpdate est atteint sans être passé par verifierSecret, ou avant lui — " +
            "le modèle répond et le marchand est débité sur une requête non vérifiée");
    }

    // ── 8. ÉCHOUER FERMÉ, JAMAIS OUVERT ──────────────────────────────────
    //
    // Si aucun secret n'est calculable (token absent), la tentation est de
    // laisser passer « en attendant ». C'est exactement le trou d'origine.
    verifier(/if \(!attendu\)[\s\S]{0,400}?res\.sendStatus\(401\)/.test(src),
        "quand aucun secret n'est calculable, le webhook ne refuse pas : un token manquant " +
        "rouvrirait la porte en grand");
    verifier(!/secretPour\([^)]*\)[^\n]*console\.(log|warn|error)/.test(src)
        && !/console\.(log|warn|error)[^\n]*(attendu|recu|TOKEN\b)/.test(src),
        "le secret ou le token apparaît dans un journal");

    // ── 9. LA COMPARAISON RESTE À TEMPS CONSTANT ─────────────────────────
    //
    // ⚠️ CE GARDE LIT LA SOURCE, il ne mesure pas un comportement — et c'est
    // assumé. Remplacer timingSafeEqual par `===` laisse les huit gardes
    // ci-dessus au vert : vérifié, la mutation survit. Rien d'observable
    // depuis l'extérieur ne distingue les deux, sauf une mesure de temps que
    // le bruit d'une machine partagée rendrait ininterprétable.
    //
    // Une comparaison caractère par caractère s'arrête au premier écart :
    // le temps de réponse révèle alors combien de caractères étaient bons,
    // et le secret se reconstruit octet par octet. C'est lent, mais c'est
    // une attaque réelle sur un secret qui, lui, ne change jamais.
    verifier(/crypto\.timingSafeEqual\(/.test(src),
        "la comparaison du secret n'est plus à temps constant : le temps de réponse laisse " +
        "deviner le secret caractère par caractère");
    verifier(/memeSecret[\s\S]{0,400}?createHash\("sha256"\)[\s\S]{0,200}?createHash\("sha256"\)/.test(src),
        "les deux côtés ne sont plus condensés avant comparaison : timingSafeEqual LÈVE sur " +
        "deux tampons de tailles différentes, et cette exception trahirait la longueur du secret");
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ webhook Telegram : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ webhook Telegram : ${verifs} vérifications passées`);
});
