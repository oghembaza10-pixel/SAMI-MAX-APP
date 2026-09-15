// ==========================================================================
// SAMII OS — LE JAVASCRIPT RÉELLEMENT SERVI DOIT COMPILER
// ==========================================================================
//
// ── POURQUOI CETTE SUITE EXISTE ───────────────────────────────────────────
//
// /community a servi pendant des semaines un script en ligne de 600 lignes
// qui ne compilait pas. Chromium levait « SyntaxError: Invalid or unexpected
// token » au chargement : AUCUN bouton, AUCUNE feuille, AUCUN envoi ne
// fonctionnait sur cette page.
//
// La cause tenait en un caractère. routes/community.js construit sa page
// dans un littéral de gabarit — res.send(`...`) — et un `\n` écrit là-dedans
// est consommé par le parseur de JavaScript du FICHIER : il devient un vrai
// retour à la ligne dans le HTML émis, au milieu d'une chaîne du script, qui
// se retrouve non terminée.
//
//     alert("✅ Message envoyé à " + nom + ".\nSa réponse arrivera…");
//                                            ↑ il fallait \\n
//
// ── CE QUI N'A PAS SUFFI ──────────────────────────────────────────────────
//
// Cinq suites « communauté » étaient vertes pendant ce temps. Elles lisent
// les SOURCES et vérifient que le code dit les bonnes choses. Aucune ne
// compilait ce qui sort réellement du serveur — et c'est précisément entre
// les deux que le bug vivait : la source était valide, sa sortie non.
//
// Un gabarit qui fabrique du code est un compilateur. Personne ne vérifiait
// ce qu'il compilait.
//
// ── CE QUE CETTE SUITE FAIT ───────────────────────────────────────────────
//
// Elle demande les pages au vrai serveur, extrait chaque <script> en ligne
// et le passe au parseur. Rien d'autre. C'est une classe de défaut, pas un
// cas particulier : toute page qui se construit par concaténation peut le
// reproduire demain.
//
// Les blocs application/ld+json sont EXCLUS : ce sont des données, pas du
// code, et les compiler donnerait un faux rouge sur les fiches métier —
// erreur que j'ai commise en auditant, avant de filtrer sur le type.
// ==========================================================================
const { spawn } = require("child_process");
const path = require("path");
const vm = require("vm");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const PORT = 3400 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Les pages publiques qui portent du script en ligne. On ne demande RIEN
// avec ?lang= : ce paramètre fait écrire une session, et une suite qui
// démarre son serveur sans base verrait la connexion se fermer.
const PAGES = ["/", "/hub", "/metiers", "/metiers/dentiste", "/academy",
    "/community", "/marketplace", "/accueil-classique", "/login", "/register"];

function scriptsDe(html) {
    return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
        .filter((m) => !/\bsrc=/.test(m[1]))
        .filter((m) => {
            const type = (m[1].match(/type=["']([^"']+)/) || [])[1];
            return !type || /javascript|module/i.test(type);
        })
        .map((m) => m[2]);
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
    const serveur = spawn(process.execPath, [path.join(RACINE, "index.js")], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: "test" },
        stdio: "ignore",
    });

    const debout = await pret();
    verifier(debout, "l'application ne démarre pas — impossible de tester quoi que ce soit");

    if (debout) {
        let totalScripts = 0;
        for (const page of PAGES) {
            const r = await fetch(`${BASE}${page}`, { redirect: "follow" });
            if (r.status !== 200) continue;          // /register etc. peuvent rediriger
            const scripts = scriptsDe(await r.text());
            totalScripts += scripts.length;

            scripts.forEach((code, i) => {
                let erreur = null;
                try {
                    // `new vm.Script` compile sans exécuter : on veut savoir si
                    // le navigateur saurait LIRE ce texte, pas ce qu'il ferait.
                    new vm.Script(code);
                } catch (e) { erreur = e.message; }

                verifier(!erreur,
                    `${page} sert un script en ligne (#${i + 1}, ${code.split("\n").length} lignes) ` +
                    `qui ne compile pas : « ${erreur} ». Tout ce qu'il contient est mort dans le ` +
                    "navigateur — boutons, feuilles, envois. Cherchez un \\n qui aurait dû être \\\\n " +
                    "dans le littéral de gabarit qui fabrique cette page.");
            });
        }

        // Un garde qui ne trouve aucun script ne garde rien : il resterait vert
        // le jour où l'extraction cesse de fonctionner.
        verifier(totalScripts >= 8,
            `${totalScripts} scripts en ligne trouvés sur ${PAGES.length} pages — l'extraction ne ` +
            "voit plus rien, et ce garde passerait au vert sur un site entièrement cassé");
    }

    serveur.kill();
})().then(() => {
    if (echecs.length) {
        console.log(`\n❌ scripts servis : ${echecs.length} problème(s) sur ${verifs} vérifications\n`);
        for (const e of echecs) console.log(`   • ${e}`);
        console.log("");
        process.exit(1);
    }
    console.log(`✅ scripts servis : ${verifs} vérifications passées`);
});
