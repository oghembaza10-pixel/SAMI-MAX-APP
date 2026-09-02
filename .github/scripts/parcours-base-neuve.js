// ==========================================================================
// LE PARCOURS QUE FERA VRAIMENT LA PREMIÈRE PERSONNE
// ==========================================================================
//
// Ce fichier n'est pas une suite de tests : il ne remplace aucun module, ne
// simule aucune base. Il parle au VRAI serveur, par HTTP, comme un
// navigateur — sur une base Postgres neuve, vide, créée il y a trente
// secondes.
//
// Il refait, dans l'ordre, ce que fait quelqu'un qui arrive :
//
//   1. il ouvre l'accueil
//   2. il crée un compte           ← `theme_visuel` cassait ici
//   3. il est renvoyé quelque part ← ce « quelque part » doit répondre 200
//   4. il parle à SAMII            ← `samii_connaissances` cassait ici
//   5. il ouvre ses pages          ← `auto_post_config` cassait ici
//
// ── UNE CHOSE QUE CE FICHIER NE FAIT PAS ──────────────────────────────────
//
// Il ne juge pas la QUALITÉ de la réponse de SAMII. Sans clé d'IA, aucune
// réponse intelligente n'est possible et ce n'est pas ce qu'on contrôle
// ici. Ce qu'on contrôle, c'est que la demande ARRIVE au moteur au lieu de
// tomber dans un `catch` parce qu'une table manque. La différence entre les
// deux se lit dans le journal du serveur, que l'étape suivante du workflow
// relit.

const BASE = "http://127.0.0.1:10000";

// `secure: true` sur le cookie de session en production : sans cet en-tête,
// le serveur pose un cookie que le navigateur ne renverrait qu'en HTTPS, et
// tout le parcours se ferait déconnecté — en répondant 302 vers /login à
// chaque étape, ce qui ressemble à un succès quand on ne regarde que « pas
// d'erreur ». C'est exactement le piège dans lequel je suis tombé en
// vérifiant à la main.
const ENTETES = { "Content-Type": "application/json", "X-Forwarded-Proto": "https" };

let echecs = 0;
function verifier(condition, quoi, detail) {
    if (condition) { console.log(`  ✅ ${quoi}${detail ? " → " + detail : ""}`); }
    else { echecs++; console.log(`  ❌ ${quoi}${detail ? " → " + detail : ""}`); }
}

async function aller(chemin, cookie, accept = "text/html") {
    return fetch(BASE + chemin, {
        headers: { cookie: cookie || "", accept, "X-Forwarded-Proto": "https" },
        redirect: "manual",
    });
}
const cookiesDe = (r) => (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");

(async () => {
    console.log("\n── 1. L'accueil s'affiche ─────────────────────────────");
    {
        const r = await aller("/", "");
        verifier(r.status === 200 || r.status === 302, "GET /", "statut " + r.status);
    }

    console.log("\n── 2. Un compte se crée sur une base vide ─────────────");
    // Un email différent à chaque exécution : deux passages sur la même base
    // ne doivent pas se marcher dessus (et le second est un vrai cas — le
    // code retombe alors sur une connexion classique).
    const email = `controle-${Date.now()}@exemple.test`;
    let cookie = "";
    let destination = null;
    {
        const r = await fetch(BASE + "/register", {
            method: "POST", headers: ENTETES, redirect: "manual",
            body: JSON.stringify({
                nom: "Contrôle", prenom: "Base", email,
                telephone: "+237600000000", metier: "E-commerce",
                password: "MotDePasseDeControle2026", type_compte: "marchand",
            }),
        });
        cookie = cookiesDe(r);
        let corps = null;
        try { corps = JSON.parse(await r.clone().text()); } catch { /* réponse HTML */ }

        // `/register` répond en JSON `{ success, redirect }`. Un `success:false`
        // porte le message d'erreur du serveur : on l'affiche, c'est lui qui
        // nomme la colonne manquante.
        verifier(corps?.success === true, "POST /register",
                 corps ? JSON.stringify(corps).slice(0, 180) : "statut " + r.status);
        destination = corps?.redirect || r.headers.get("location");
    }

    console.log("\n── 3. Il atterrit sur une page qui existe ─────────────");
    {
        verifier(!!destination, "le serveur dit où aller", destination || "(nulle part)");
        if (destination) {
            const r = await aller(destination, cookie);
            // Une redirection en chaîne est admise ; le point d'arrivée, non :
            // il doit répondre 200. Un 302 vers /login voudrait dire que la
            // session ne tient pas, un 404 que la page est fermée par la porte.
            let etape = r, chemin = destination, sauts = 0;
            while (etape.status === 302 && sauts < 3) {
                chemin = etape.headers.get("location");
                etape = await aller(chemin, cookie);
                sauts++;
            }
            verifier(etape.status === 200, "l'atterrissage répond 200",
                     destination + (sauts ? " → " + chemin : "") + " = " + etape.status);
        }
    }

    console.log("\n── 4. Un message atteint le moteur ───────────────────");
    {
        const r = await fetch(BASE + "/api/chat", {
            method: "POST",
            headers: { ...ENTETES, cookie },
            body: JSON.stringify({ message: "Bonjour" }),
        });
        const texte = await r.text();
        verifier(r.status === 200, "POST /api/chat répond", "statut " + r.status);

        // ── CE CONTRÔLE A ÉTÉ ÉCRIT DEUX FOIS ──────────────────────────
        //
        // La première version cherchait « does not exist » dans la réponse.
        // Je l'ai mise à l'épreuve en retirant vraiment `samii_connaissances`
        // du schéma : elle a répondu ✅. Elle ne pouvait pas faire autrement
        // — le message d'erreur du chat ne nomme plus la table (c'est voulu :
        // on ne raconte pas sa plomberie à l'écran). Le contrôle regardait
        // donc une chose que le code ne dit plus.
        //
        // Ce qui distingue vraiment les deux cas, c'est `success` :
        //   table présente, pas de clé d'IA → success:true  + repli poli
        //   table absente                   → success:false + le catch
        // Mesuré dans les deux états, pas supposé.
        let corps = null;
        try { corps = JSON.parse(texte); } catch { /* réponse non-JSON */ }
        verifier(corps?.success === true,
                 "la demande atteint le moteur (pas un catch)", texte.slice(0, 160));
    }

    console.log("\n── 5. Les pages du marchand s'ouvrent ────────────────");
    {
        // Ces cinq-là couvrent les endroits où les trois bugs du jour se
        // sont manifestés. `/autopost` est nommément celui qui arrêtait le
        // processus entier.
        for (const chemin of ["/qg", "/autopost", "/marketplace", "/messages", "/settings"]) {
            const r = await aller(chemin, cookie);
            // 200 = la page s'ouvre. 302 = la porte l'a fermée pour cette
            // communauté, c'est un comportement voulu. 500 = une erreur, et
            // c'est ce qu'on cherche.
            verifier(r.status !== 500, "GET " + chemin, "statut " + r.status);
        }
    }

    console.log("\n── 6. Le serveur est toujours debout ─────────────────");
    {
        const r = await fetch(BASE + "/health", { headers: { "X-Forwarded-Proto": "https" } });
        const corps = await r.text();
        verifier(r.status === 200, "GET /health", "statut " + r.status + " " + corps.slice(0, 120));
    }

    console.log(echecs === 0
        ? "\n✅ Le parcours passe entièrement sur une base neuve.\n"
        : `\n❌ ${echecs} étape(s) en échec sur une base neuve.\n`);
    process.exit(echecs === 0 ? 0 : 1);
})().catch((e) => {
    console.error("\n❌ Le parcours s'est interrompu :", e.message);
    process.exit(1);
});
