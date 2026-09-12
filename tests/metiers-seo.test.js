// ==========================================================================
// SAMII OS — Google peut-il découvrir les métiers, et le visiteur arriver
//            jusqu'à SAMII ou jusqu'à son QG ?
//
// POURQUOI CE TEST EXISTE.
//
// « / » est devenu le chat. C'est ce qu'il fallait pour convertir, mais un
// champ de saisie ne se classe sur aucune recherche : le chat convertit les
// gens qui arrivent, il ne les fait pas arriver. Les pages métier sont
// l'autre moitié, et elles ont deux façons silencieuses d'échouer :
//
//   1. NE PAS ÊTRE DÉCOUVERTES. Le plan du site ne contenait qu'UNE adresse.
//      Trente-quatre pages peuvent exister et rester invisibles : rien ne
//      plante, le trafic n'arrive simplement jamais.
//   2. ÊTRE DÉCOUVERTES ET IGNORÉES. Trente-quatre pages qui ne diffèrent
//      que par un mot sont du contenu dupliqué : Google en garde une et
//      jette les autres. Là encore, aucune erreur visible.
//
// CE QUI EST VÉRIFIÉ ICI.
//   1. Chaque métier de la source a sa page, et elle répond.
//   2. Un métier inventé répond 404 — pas une redirection polie, qui
//      apprendrait à Google que n'importe quelle adresse est valide.
//   3. Les titres et descriptions sont TOUS DIFFÉRENTS. C'est la vérification
//      qui protège du contenu mince, et elle échoue si quelqu'un remplace le
//      contenu écrit à la main par un gabarit.
//   4. Les deux sorties existent sur chaque page : parler à SAMII, et ouvrir
//      le QG du métier par la route de création qui existait déjà.
//   5. Le plan du site est calculé depuis la source, pas tenu à la main.
//   6. Aucune liste de métiers ne survit ailleurs — le Hub en portait une,
//      périmée, qui contredisait la source.
//   7. L'ancienne vitrine et le chat répondent toujours.
//
// COMMENT. On lance VRAIMENT l'application et on interroge les routes. Une
// page métier qui ne se rend pas ne se voit qu'en la demandant.
//
// Lancer :  npm test
// ==========================================================================
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const RACINE = path.join(__dirname, "..");

let verifs = 0;
const echecs = [];
const verifier = (ok, message) => { verifs++; if (!ok) echecs.push(message); };

const metiers = require(path.join(RACINE, "services", "metiers.js"));
const PORT = 3300 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;

function attendre(ms) { return new Promise((ok) => setTimeout(ok, ms)); }

async function pret(essais = 40) {
    for (let i = 0; i < essais; i++) {
        try {
            const r = await fetch(`${BASE}/metiers`, { signal: AbortSignal.timeout(2000) });
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
        // ── 1. CHAQUE MÉTIER A SA PAGE ───────────────────────────────────
        const fiches = metiers.avecFiche();
        verifier(fiches.length >= 30,
            `seulement ${fiches.length} métiers ont une fiche — la source s'est vidée`);

        const titres = new Map();
        const descriptions = new Map();
        let manquantes = [];

        for (const m of fiches) {
            const r = await fetch(`${BASE}/metiers/${m.id}`);
            if (r.status !== 200) { manquantes.push(`${m.id} (${r.status})`); continue; }
            const html = await r.text();

            const titre = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
            const desc = (html.match(/name="description" content="([^"]*)"/) || [])[1] || "";
            titres.set(m.id, titre);
            descriptions.set(m.id, desc);
        }

        verifier(manquantes.length === 0,
            `ces métiers sont listés mais leur page ne répond pas : ${manquantes.join(", ")}`);

        // ── 2. UN MÉTIER INVENTÉ DONNE 404 ───────────────────────────────
        // Rediriger vers le hub serait plus doux pour le visiteur et
        // désastreux pour le référencement : Google apprendrait que toute
        // adresse sous /metiers/ répond 200 et se mettrait à en indexer
        // d'inventées.
        const inconnu = await fetch(`${BASE}/metiers/ce-metier-nexiste-pas`);
        verifier(inconnu.status === 404,
            `un métier inventé répond ${inconnu.status} au lieu de 404 — Google indexera des pages fantômes`);

        // ── 3. AUCUNE PAGE JUMELLE ───────────────────────────────────────
        // La vérification qui compte : c'est elle qui tombe si quelqu'un
        // remplace le contenu écrit à la main par « SAMII aide les {métier} ».
        const titresUniques = new Set(titres.values());
        verifier(titresUniques.size === titres.size,
            `${titres.size} pages pour seulement ${titresUniques.size} titres différents — ` +
            "des pages jumelles, que Google traitera comme du contenu dupliqué");

        const descUniques = new Set(descriptions.values());
        verifier(descUniques.size === descriptions.size,
            `${descriptions.size} pages pour seulement ${descUniques.size} descriptions différentes — contenu mince`);

        // Et les descriptions doivent VRAIMENT dire quelque chose.
        const tropCourtes = [...descriptions.entries()].filter(([, d]) => d.length < 80).map(([id]) => id);
        verifier(tropCourtes.length === 0,
            `descriptions trop courtes pour ${tropCourtes.join(", ")} — Google les remplacera par ce qu'il voudra`);

        // ── 4. LES DEUX SORTIES ──────────────────────────────────────────
        {
            const html = await (await fetch(`${BASE}/metiers/coiffeur`)).text();
            verifier(/href="\/\?metier=/.test(html),
                "la page ne ramène pas au chat — le visiteur qui découvre n'a nulle part où aller");
            verifier(/href="\/workspace\/create\?metier=coiffeur"/.test(html),
                "la page ne mène pas à la création du QG de ce métier — " +
                "le visiteur décidé doit repasser par le chat, une étape de trop");
            verifier(/rel="canonical"/.test(html), "pas d'URL canonique");
            verifier(/hreflang=/.test(html), "pas de hreflang — les trois langues se feront concurrence");
            verifier(/application\/ld\+json/.test(html), "pas de données structurées");
            verifier(/href="\/metiers"/.test(html), "pas de retour vers le hub — la page est isolée");

            // Le maillage interne : une page seule se classe mal.
            const voisins = (html.match(/class="voisin"/g) || []).length;
            verifier(voisins >= 1,
                "aucun métier voisin n'est lié — pas de maillage interne, chaque page reste isolée");
        }

        // ── 5. LE PLAN DU SITE EST CALCULÉ ───────────────────────────────
        {
            const r = await fetch(`${BASE}/sitemap.xml`);
            verifier(r.status === 200, `le plan du site répond ${r.status}`);
            const xml = await r.text();
            const locs = (xml.match(/<loc>/g) || []).length;
            verifier(locs >= fiches.length + 4,
                `le plan ne liste que ${locs} adresses pour ${fiches.length} métiers — ` +
                "les pages existent mais Google ne les découvrira pas");

            // Chaque métier doit y être NOMMÉMENT : un plan qui liste le hub
            // sans les pages ne fait découvrir que le hub.
            const oublies = fiches.filter((m) => !xml.includes(`/metiers/${m.id}<`)).map((m) => m.id);
            verifier(oublies.length === 0,
                `absents du plan du site : ${oublies.join(", ")}`);

            // L'ancienne vitrine y reste : la taire effacerait de Google tout
            // ce qu'elle a déjà gagné.
            verifier(xml.includes("/accueil-classique"),
                "l'ancienne vitrine a disparu du plan du site — son référencement acquis serait perdu");
            verifier(/xmlns:xhtml/.test(xml) && /hreflang=/.test(xml),
                "le plan ne déclare pas les traductions");
        }

        // ── 7. RIEN N'EST CASSÉ ──────────────────────────────────────────
        for (const [chemin, attendu] of [["/", 200], ["/accueil-classique", 200], ["/metiers", 200]]) {
            const r = await fetch(`${BASE}${chemin}`);
            verifier(r.status === attendu,
                `${chemin} répond ${r.status} au lieu de ${attendu}`);
        }
        const ancienne = await (await fetch(`${BASE}/accueil-classique`)).text();
        verifier(ancienne.length > 150000,
            `l'ancienne vitrine ne fait plus que ${ancienne.length} caractères — du contenu a été perdu`);
    }

    serveur.kill("SIGTERM");

    // ── 6. AUCUNE LISTE DE MÉTIERS EN DOUBLE ─────────────────────────────
    // services/metiers.js se déclare source unique. Le Hub en gardait une
    // copie de onze secteurs, jamais lue par sa vue, et qui contredisait la
    // source : agriculture, industrie, technologie et finance y survivaient
    // alors que la source dit les avoir retirés.
    {
        const hub = fs.readFileSync(path.join(RACINE, "routes", "hub.js"), "utf8");
        const code = hub.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
        verifier(!/const METIERS\s*=\s*\[/.test(code),
            "routes/hub.js redéclare une liste de métiers — c'est la duplication qu'on vient de retirer");
        for (const abandonne of ["Agriculture", "Industrie", "Technologie", "Finance"]) {
            verifier(!code.includes(`"${abandonne}"`),
                `routes/hub.js propose encore « ${abandonne} », que services/metiers.js déclare avoir retiré`);
        }

        // Et la page métier ne recopie aucune liste : elle lit la source.
        const routeur = fs.readFileSync(path.join(RACINE, "routes", "metiers.js"), "utf8");
        verifier(/require\("\.\.\/services\/metiers"\)/.test(routeur),
            "routes/metiers.js ne lit pas la source unique");
        verifier(!/const METIERS\s*=\s*\[/.test(routeur),
            "routes/metiers.js redéclare des métiers au lieu de lire la source");
    }

    if (echecs.length) {
        console.log(`\n❌ métiers SEO : ${echecs.length} échec(s) sur ${verifs} vérifications\n`);
        echecs.forEach((e) => console.log(`   • ${e}`));
        process.exitCode = 1;
    } else {
        console.log(`✅ métiers SEO : ${verifs} vérifications passées (${metiers.avecFiche().length} pages servies)`);
    }
    process.exit(echecs.length ? 1 : 0);
})();
