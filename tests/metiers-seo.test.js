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

        // Les longueurs se comptent sur le texte DÉCODÉ. Dans la source, une
        // apostrophe s'écrit « &#39; » — cinq caractères pour un seul à
        // l'écran. Compter la source ferait croire qu'une description de 151
        // caractères en fait 163, et ferait crier un garde pour rien.
        const lire = (s) => String(s || "")
            .replace(/&#39;/g, "’").replace(/&quot;/g, "\"")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

        const titres = new Map();
        const descriptions = new Map();
        const h1s = new Map();
        let manquantes = [];

        for (const m of fiches) {
            const r = await fetch(`${BASE}/metiers/${m.id}`);
            if (r.status !== 200) { manquantes.push(`${m.id} (${r.status})`); continue; }
            const html = await r.text();

            const titre = lire((html.match(/<title>([^<]*)<\/title>/) || [])[1]);
            const desc = lire((html.match(/name="description" content="([^"]*)"/) || [])[1]);
            const h1 = lire((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]).replace(/<[^>]+>/g, "").trim();
            titres.set(m.id, titre);
            descriptions.set(m.id, desc);
            h1s.set(m.id, h1);
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

        // ── 3 bis. LE TITRE ET LE H1 NE SONT PAS LA MÊME CHOSE ───────────
        //
        // Ils l'ont été : une seule chaîne servie aux deux endroits, sur les
        // trente-quatre fiches. Deux dégâts, mesurés avant correction.
        //
        //   1. Le <h1> affiché se terminait par « — SAMII ». C'est un suffixe
        //      de balise title ; dans un titre de page, ça se lit comme une
        //      coquille laissée par mégarde.
        //   2. Trente titres sur trente-quatre dépassaient 60 caractères
        //      (médiane 67, maximum 83) : Google les coupait dans ses
        //      résultats, et ce qui disparaissait était la fin de la promesse.
        //
        // Ces deux gardes existent parce que la régression est invisible : une
        // page dont le titre est trop long s'affiche parfaitement, se teste
        // parfaitement, et perd des clics sans que rien ne le signale.
        const memes = [...titres.entries()].filter(([id, t]) => t === h1s.get(id)).map(([id]) => id);
        verifier(memes.length === 0,
            `<title> et <h1> sont identiques sur ${memes.length} fiche(s) (${memes.slice(0, 4).join(", ")}) — ` +
            "le titre sert une liste de résultats, le H1 sert quelqu'un qui vient d'arriver ; " +
            "les confondre donne un H1 qui se termine par « — SAMII »");

        const h1Suffixes = [...h1s.entries()].filter(([, h]) => /—\s*SAMII\s*$/.test(h)).map(([id]) => id);
        verifier(h1Suffixes.length === 0,
            `le H1 se termine par « — SAMII » sur ${h1Suffixes.length} fiche(s) (${h1Suffixes.slice(0, 4).join(", ")}) — ` +
            "c'est un suffixe de balise title, pas un titre de page");

        const h1Manquants = [...h1s.entries()].filter(([, h]) => !h || h.length < 10).map(([id]) => id);
        verifier(h1Manquants.length === 0,
            `H1 absent ou vide sur : ${h1Manquants.join(", ")}`);

        // ── 3 ter. LES LONGUEURS QUE GOOGLE AFFICHE ──────────────────────
        const LIMITE_TITRE = 60;
        const tropLongs = [...titres.entries()].filter(([, t]) => t.length > LIMITE_TITRE)
            .map(([id, t]) => `${id} (${t.length})`);
        verifier(tropLongs.length === 0,
            `${tropLongs.length} titre(s) dépassent ${LIMITE_TITRE} caractères : ${tropLongs.slice(0, 5).join(", ")} — ` +
            "Google les coupe, et c'est la fin de la promesse qui disparaît");

        const LIMITE_DESC = 155;
        const descLongues = [...descriptions.entries()].filter(([, d]) => d.length > LIMITE_DESC)
            .map(([id, d]) => `${id} (${d.length})`);
        verifier(descLongues.length === 0,
            `${descLongues.length} description(s) dépassent ${LIMITE_DESC} caractères : ${descLongues.slice(0, 5).join(", ")} — ` +
            "au-delà, Google coupe et choisit lui-même la fin, souvent au milieu d'un mot");

        // ── 3 quater. LE PLANCHER DE SUBSTANCE ───────────────────────────
        //
        // C'est la vérification qui dit si ces pages méritent d'exister. Une
        // fiche mesurait 136 à 184 mots de texte visible (médiane 154), dont
        // près de la moitié de décor commun aux trente-quatre. Le plancher ne
        // fixe pas un objectif — il empêche de DESCENDRE. Quelqu'un qui
        // « nettoie » un gabarit peut vider une page sans s'en apercevoir :
        // elle répondra toujours 200.
        //
        // Il est volontairement placé sous le minimum actuel : un garde calé
        // au ras de la mesure du jour devient rouge au premier mot retiré,
        // pour une raison qui n'est pas une régression.
        const PLANCHER_MOTS = 110;
        const maigres = [];
        // ── ET LA PHRASE LA PLUS SPÉCIFIQUE N'EST IMPRIMÉE QU'UNE FOIS ───
        //
        // Elle l'était deux fois sur les trente-quatre fiches : une fois en
        // promesse sous le titre, une fois dans le pavé « Ce que SAMII fait ».
        // Sur 154 mots dont la moitié est du décor commun, répéter la seule
        // phrase qui distingue la page de ses trente-trois voisines, c'est
        // diviser par deux ce qui la rend unique.
        //
        // Le plancher de mots ci-dessus ne protège PAS de ça — une répétition
        // AJOUTE des mots, elle en fait donc monter le compte. Vérifié en
        // remettant la ligne : le plancher restait vert. Il faut ce garde-ci.
        //
        // On ne compte que le texte VISIBLE : la réponse figure aussi dans le
        // JSON-LD de la FAQ, où c'est légitime — c'en est la réponse.
        const repetees = [];
        for (const m of fiches) {
            const html = await (await fetch(`${BASE}/metiers/${m.id}`)).text();
            const texte = html
                .replace(/<head[\s\S]*?<\/head>/i, " ")
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<!--[\s\S]*?-->/g, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/&[a-z]+;|&#\d+;/gi, " ")
                .replace(/\s+/g, " ").trim();
            const mots = texte.split(" ").filter(Boolean).length;
            if (mots < PLANCHER_MOTS) maigres.push(`${m.id} (${mots})`);

            // Les entités deviennent une espace dans `texte` (« l&#39;attente »
            // → « l attente ») : on applique la même transformation à la
            // phrase d'origine, sinon aucune des deux ne se retrouve.
            const memeForme = (s) => String(s).replace(/['’]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
            const reponse = memeForme(metiers.fiche(m.id).reponse);
            const fois = memeForme(texte).split(reponse).length - 1;
            if (fois > 1) repetees.push(`${m.id} (${fois}×)`);
        }
        verifier(maigres.length === 0,
            `${maigres.length} fiche(s) sous ${PLANCHER_MOTS} mots de texte visible : ${maigres.slice(0, 5).join(", ")} — ` +
            "une page vide répond 200 comme les autres, et Google l'ignore sans rien dire");
        verifier(repetees.length === 0,
            `la phrase « ce que SAMII fait » est imprimée plusieurs fois sur ${repetees.length} fiche(s) : ` +
            `${repetees.slice(0, 5).join(", ")} — c'est la seule phrase qui distingue la page de ses ` +
            "voisines, la répéter divise par deux ce qui la rend unique");

        // ── 3 quinquies. LE BLOC COMMUN, ET SES DEUX VARIANTES ───────────
        //
        // Il porte « comment ça se passe » et la FAQ. Deux variantes, une par
        // parcours : un dentiste et un avocat vendent un créneau, un
        // restaurant et une boutique vendent un objet qui part. Servir la
        // mauvaise variante ne casse rien — la page s'affiche, elle raconte
        // simplement la vie de quelqu'un d'autre.
        {
            const parcoursDe = new Map(fiches.map((m) => [m.id, m.parcours === "rdv" ? "rdv" : "produit"]));
            const sansBloc = [];
            const mauvaiseVariante = [];
            const faqInvisible = [];
            const sansMots = [];

            // Signatures : une phrase qui n'existe QUE dans une variante.
            const SIGNE = {
                rdv: "Une annulation libère le créneau",
                produit: "SAMII répond, note l'article et l'adresse",
            };
            const oppose = { rdv: "produit", produit: "rdv" };

            // Deux fiches par parcours suffisent à prouver l'aiguillage ; on
            // passe quand même les trente-quatre, la boucle est bon marché et
            // c'est le genre d'erreur qui ne touche qu'un métier.
            for (const m of fiches) {
                const html = await (await fetch(`${BASE}/metiers/${m.id}`)).text();
                const p = parcoursDe.get(m.id);
                const lu = lire(html);

                if (!/class="marche"/.test(html) || !/class="questions"/.test(html)) { sansBloc.push(m.id); continue; }
                if (!lu.includes(SIGNE[p]) || lu.includes(SIGNE[oppose[p]])) mauvaiseVariante.push(`${m.id} (${p})`);

                // ── LA FAQ DÉCLARÉE EST LA FAQ AFFICHÉE ──────────────────
                //
                // Elle ne vivait QUE dans le JSON-LD : deux questions
                // annoncées à Google, jamais montrées. C'est du balisage
                // trompeur, la même faute que le fil d'Ariane refusée plus
                // haut. Le garde compare les deux, question ET réponse.
                const blocsLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((b) => b[1]);
                let faq = null;
                try { faq = blocsLd.map((b) => JSON.parse(b)).find((o) => o && o["@type"] === "FAQPage"); } catch { /* signalé ailleurs */ }
                // Les apostrophes s'écrivent &#39; dans la page et « ' » dans
                // le JSON : sans cette mise à plat, aucune des deux ne se
                // retrouve, et le garde crie pour une raison typographique.
                const plat = (s) => String(s || "").replace(/[’\x27]/g, "'").replace(/\s+/g, " ").trim();
                const visible = plat(lu.replace(/<head[\s\S]*?<\/head>/i, " ")
                    .replace(/<script[\s\S]*?<\/script>/gi, " ")
                    .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, " "));
                const questions = (faq && faq.mainEntity) || [];
                if (questions.length < 3) faqInvisible.push(`${m.id} : ${questions.length} question(s) déclarée(s)`);
                for (const q of questions) {
                    if (!visible.includes(plat(q.name)) ||
                        !visible.includes(plat(q.acceptedAnswer && q.acceptedAnswer.text))) {
                        faqInvisible.push(`${m.id} : « ${String(q.name).slice(0, 40)} » déclarée mais pas affichée`);
                    }
                }

                // ── LE VOCABULAIRE EST VRAIMENT EXPLOITÉ ─────────────────
                //
                // Il vit dans services/metiers.js depuis longtemps — bazin,
                // wax, maquis, shawarma, riad, omra, tresses, vidange — et
                // n'apparaissait sur aucune page publique. Ce sont pourtant
                // les mots que les gens tapent dans Google.
                // ⚠️ ON REGARDE DANS LE BLOC, PAS DANS LA PAGE. Première
                // version de ce garde : il cherchait les mots n'importe où
                // dans le texte visible. Mesuré en supprimant le bloc pour de
                // vrai, il n'a crié que sur 3 fiches sur 33 — parce que
                // « consultation », « coiffure » ou « livraison » figurent
                // déjà dans les phrases du métier. Un garde qui passe quand la
                // chose qu'il surveille a disparu ne surveille rien.
                const dispo = (metiers.fiche(m.id).mots || []);
                if (dispo.length > 1) {
                    const bloc = plat(((html.match(/<section class="motsdits">([\s\S]*?)<\/section>/) || [])[1] || "")
                        .replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&[a-z]+;|&#\d+;/gi, " "));
                    const montres = dispo.filter((mot) => bloc.includes(plat(mot)));
                    if (montres.length === 0) sansMots.push(m.id);
                }
            }

            verifier(sansBloc.length === 0,
                `le bloc commun (« comment ça se passe » + questions) manque sur : ${sansBloc.join(", ")}`);
            verifier(mauvaiseVariante.length === 0,
                `mauvaise variante de parcours sur ${mauvaiseVariante.length} fiche(s) : ${mauvaiseVariante.slice(0, 5).join(", ")} — ` +
                "la page s'affiche quand même, elle raconte simplement la vie de quelqu'un d'autre");
            verifier(faqInvisible.length === 0,
                `${faqInvisible.length} problème(s) de FAQ : ${faqInvisible.slice(0, 3).join(" ; ")} — ` +
                "déclarer à Google des questions qu'on ne montre pas est du balisage trompeur");
            verifier(sansMots.length === 0,
                `le vocabulaire n'est affiché sur aucune de ces fiches : ${sansMots.join(", ")} — ` +
                "les mots que les gens tapent restent enfermés dans le code");

            // ── ET PAS DE BOURRAGE ───────────────────────────────────────
            //
            // Une liste de mots-clés sans fin est exactement ce que Google
            // sanctionne. Elle est bornée dans routes/metiers.js ; le garde
            // vérifie que la borne tient sur la fiche qui en a le plus.
            const htmlPap = lire(await (await fetch(`${BASE}/metiers/pretaporter`)).text());
            const liste = (htmlPap.match(/class="motsdits__liste"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
            const combien = (liste.match(/<span>/g) || []).length;
            verifier(combien > 0 && combien <= 8,
                `« prêt-à-porter » affiche ${combien} mots (elle en a 14 en réserve) — au-delà de 8 ` +
                "la ligne cesse d'être une information et devient un empilement de mots-clés");

            // Le mot qui répète le libellé n'apprend rien : « Dentiste » suivi
            // de « dentiste ».
            const htmlDent = lire(await (await fetch(`${BASE}/metiers/dentiste`)).text());
            const listeD = (htmlDent.match(/class="motsdits__liste"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
            verifier(!/<span>dentiste<\/span>/i.test(listeD),
                "la liste de mots répète le libellé du métier — « Dentiste » suivi de « dentiste »");

            // ── ET LE CAS QUI SE CACHE DERRIÈRE UN TRAIT D'UNION ─────────
            //
            // « Prêt-à-porter » et « prêt à porter » sont le même mot. Le
            // premier filtre ne le voyait pas : il mettait l'apostrophe à
            // plat mais pas le tiret, et la fiche affichait son propre titre
            // en tête de sa liste de mots. Le garde sur « dentiste » ne
            // pouvait pas l'attraper — ce libellé-là n'a pas de tiret.
            const listeP = (htmlPap.match(/class="motsdits__liste"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
            verifier(!/<span>pr[êe]t [àa] porter<\/span>/i.test(listeP),
                "« prêt à porter » est affiché dans la liste de mots de « Prêt-à-porter » — " +
                "le trait d'union du libellé cache la répétition");

            // ── UN MÉTIER SANS VOCABULAIRE N'EST PAS UNE PANNE ───────────
            //
            // « autre » n'en a aucun. Le bloc doit disparaître, pas s'afficher
            // vide. On regarde le CORPS : les règles CSS portent les mêmes
            // noms de classe et feraient passer un garde trop naïf.
            const corpsAutre = lire(await (await fetch(`${BASE}/metiers/autre`)).text())
                .replace(/<style[\s\S]*?<\/style>/gi, " ");
            verifier(!/<section class="motsdits">/.test(corpsAutre),
                "« autre » n'a aucun vocabulaire et affiche quand même le bloc — une liste vide sous un titre");
            verifier(/class="marche"/.test(corpsAutre) && /class="questions"/.test(corpsAutre),
                "« autre » a perdu le bloc commun : l'absence de vocabulaire ne doit emporter que la liste de mots");
        }

        // ── 3 sexies. LE BLOC COMMUN NE DOIT PAS NOYER LE PROPRE ─────────
        //
        // C'est le risque de ce chantier, et il faut le mesurer plutôt que
        // l'espérer. Mesure avant/après, en 5-grammes :
        //
        //   avant 9a   154 mots, 53 % propre  → ≈ 82 mots vraiment à elle
        //   après 9a   140 mots, 47 % propre  → ≈ 66
        //   après 9b   389 mots, 20 % propre  → ≈ 78
        //
        // La page a triplé, la PART propre a chuté, et la QUANTITÉ propre a
        // à peine bougé : le bloc commun règle le contenu trop mince, il ne
        // différencie pas. C'est 9c qui différenciera.
        //
        // Le garde porte donc sur l'ABSOLU, pas sur la proportion : chaque
        // fiche doit garder une quantité de texte qui n'appartient qu'à elle.
        // Un garde sur la proportion tomberait au premier mot ajouté au bloc
        // commun, ce qui est un choix, pas une régression. Un garde sur
        // l'absolu tombe si on rogne ce qui fait la page — ce qui est bien une
        // régression.
        {
            const cinqGrammes = (t) => {
                const mots = t.toLowerCase().split(/\s+/).filter(Boolean);
                const out = [];
                for (let i = 0; i + 5 <= mots.length; i++) out.push(mots.slice(i, i + 5).join(" "));
                return out;
            };
            const nu = (html) => html
                .replace(/<head[\s\S]*?<\/head>/i, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
                .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, " ").replace(/\s+/g, " ").trim();

            const parPage = new Map();
            const combien = new Map();
            for (const m of fiches) {
                const s = cinqGrammes(nu(await (await fetch(`${BASE}/metiers/${m.id}`)).text()));
                parPage.set(m.id, s);
                for (const g of new Set(s)) combien.set(g, (combien.get(g) || 0) + 1);
            }
            // Mesuré à 66 au plus bas (opticien), 77 en médiane. Le plancher
            // est posé sous le minimum : calé au ras de la mesure du jour, il
            // deviendrait rouge pour une reformulation anodine.
            const PLANCHER_PROPRE = 45;
            const noyees = [];
            for (const m of fiches) {
                const s = parPage.get(m.id);
                const propres = s.filter((g) => combien.get(g) === 1).length;
                if (propres < PLANCHER_PROPRE) noyees.push(`${m.id} (${propres})`);
            }
            verifier(noyees.length === 0,
                `${noyees.length} fiche(s) gardent moins de ${PLANCHER_PROPRE} suites de mots qui n'appartiennent ` +
                `qu'à elles : ${noyees.slice(0, 5).join(", ")} — le bloc commun a noyé ce qui distingue la page`);
        }

        // ── 4. LES DEUX SORTIES ──────────────────────────────────────────
        {
            const html = await (await fetch(`${BASE}/metiers/coiffeur`)).text();
            verifier(/href="\/\?metier=/.test(html),
                "la page ne ramène pas au chat — le visiteur qui découvre n'a nulle part où aller");
            // ── LA CIBLE CHANGE, L'INTENTION NON ─────────────────────────
            //
            // Ce garde exigeait /workspace/create?metier=coiffeur. Son but :
            // que le visiteur DÉCIDÉ aille droit à la création, sans repasser
            // par le chat. Le but est bon ; l'adresse ne l'était pas.
            //
            // Mesuré : /workspace/create est derrière requireAuth, et répond
            // 302 vers /login. Or cette page est faite POUR les visiteurs de
            // Google, qui ne sont jamais connectés. Le garde était donc vert
            // pendant que le bouton déposait les gens sur un mur de connexion.
            //
            // /register?metier= est la porte du Hub : non connecté → le
            // formulaire d'inscription ; connecté → /workspace/create en
            // gardant le métier. Une seule étape, et elle aboutit.
            verifier(/href="\/register\?metier=coiffeur"/.test(html),
                "la page ne mène pas à la création du QG de ce métier — " +
                "le visiteur décidé doit repasser par le chat, une étape de trop");
            verifier(!/href="\/workspace\/create\?metier=/.test(html),
                "le bouton repointe sur /workspace/create, qui est derrière requireAuth : " +
                "un visiteur de Google y reçoit un 302 vers /login, sans son métier");
            verifier(/rel="canonical"/.test(html), "pas d'URL canonique");
            // ── ON NE DÉCLARE PAS UNE LANGUE QU'ON NE SERT PAS ───────────
            //
            // Ce garde exigeait hreflang, pour empêcher trois versions de se
            // concurrencer. Le raisonnement vaut quand les trois versions
            // EXISTENT. Mesuré sur les trente-quatre fiches, elles n'existent
            // pas : la version « anglaise » garde 45 à 63 % du vocabulaire
            // français (médiane 53 %), l'arabe 44 à 61 %. Les intertitres sont
            // traduits, la substance vient de services/metiers.js, qui est en
            // français.
            //
            // Et le canonical de ces variantes pointait déjà sur l'URL
            // française : hreflang disait « voici l'anglais », canonical
            // répondait « non ». Devant ce conflit, Google ignore le hreflang.
            // La déclaration n'a donc jamais rien protégé.
            //
            // Le garde défend maintenant la règle vraie : UNE page, en
            // français, avec un canonical ferme. Le jour où une fiche sera
            // réellement traduite, on redéclarera — pour elle seule.
            verifier(!/hreflang=/.test(html),
                "hreflang est revenu sur les fiches : il annonce un anglais et un arabe qui "
                + "n'existent pas (53 % du texte reste français), et le canonical le contredit");
            // ── ET ?lang= NE DOIT PAS FABRIQUER UNE PAGE CONCURRENTE ─────
            //
            // Vérifié SUR LES SOURCES, pas par une requête, et c'est délibéré.
            // Une requête vers ?lang=en fait écrire une SESSION (le choix de
            // langue s'y range, Set-Cookie: connect.sid). Cette suite lance
            // son propre serveur SANS base : l'écriture échoue, la connexion
            // se ferme, et la requête suivante meurt sur UND_ERR_SOCKET.
            // Mesuré : 1 réussite sur 10 sans base, 9 sur 10 avec.
            //
            // Le garde aurait donc été rouge une fois sur deux pour une
            // raison qui n'a rien à voir avec ce qu'il surveille — et un
            // garde qui clignote finit par être ignoré, puis supprimé.
            //
            // La règle se lit très bien dans les sources : la route calcule
            // le canonical à partir de l'ID seul, jamais du paramètre de
            // langue, et le gabarit ne sert que celui-là.
            const srcRoute = fs.readFileSync(path.join(RACINE, "routes/metiers.js"), "utf8");
            const srcVue = fs.readFileSync(path.join(RACINE, "views/metier.ejs"), "utf8");
            verifier(/canonique:\s*`\$\{BASE\}\/metiers\/\$\{fiche\.id\}`/.test(srcRoute),
                "le canonical d'une fiche n'est plus calculé depuis le seul identifiant : "
                + "?lang=en fabriquerait une page concurrente, à moitié française");
            verifier(/<link rel="canonical" href="<%= canonique %>">/.test(srcVue),
                "la fiche ne sert plus `canonique` comme canonical");
            verifier(/application\/ld\+json/.test(html), "pas de données structurées");
            verifier(/href="\/metiers"/.test(html), "pas de retour vers le hub — la page est isolée");

            // ── LE FIL D'ARIANE, DÉCLARÉ ET NON SEULEMENT DESSINÉ ────────
            //
            // Il existait à l'écran depuis le début — <nav class="fil"> —
            // mais Google n'y voyait que trois liens à la suite. Déclaré, il
            // devient le chemin affiché sous le titre dans les résultats
            // (SAMII › Les métiers › Dentiste) au lieu de l'URL brute.
            //
            // Le garde ne se contente pas de trouver le mot BreadcrumbList :
            // il LIT le JSON et vérifie que chaque échelon est complet. Une
            // donnée structurée à moitié écrite n'affiche rien du tout, et
            // ne lève aucune erreur.
            const blocs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
                .map((b) => b[1]);
            let objets = [];
            let lisible = true;
            try { objets = blocs.map((b) => JSON.parse(b)); } catch { lisible = false; }
            verifier(lisible, "un bloc de données structurées n'est pas du JSON valide — Google l'ignore en entier");

            const fil = objets.find((o) => o && o["@type"] === "BreadcrumbList");
            verifier(!!fil, "pas de BreadcrumbList : le fil d'Ariane est dessiné mais jamais déclaré");

            const echelons = (fil && fil.itemListElement) || [];
            verifier(echelons.length === 3,
                `le fil déclaré compte ${echelons.length} échelon(s) au lieu de 3 (SAMII › Les métiers › le métier)`);
            const malFormes = echelons.filter((e, i) =>
                !e || e["@type"] !== "ListItem" || e.position !== i + 1 || !e.name || !/^https?:\/\//.test(e.item || ""));
            verifier(malFormes.length === 0,
                `${malFormes.length} échelon(s) du fil sont incomplets — il faut @type, position, name et une adresse absolue`);

            // Le dernier échelon EST la page : s'il pointe ailleurs, le fil
            // décrit un chemin qui n'existe pas.
            const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
            verifier(echelons[2] && echelons[2].item === canon,
                `le dernier échelon du fil (${echelons[2] && echelons[2].item}) n'est pas l'adresse canonique de la page (${canon})`);

            // Et il doit décrire le fil VISIBLE. Déclarer un chemin que le
            // visiteur ne voit pas, c'est ce que Google appelle du balisage
            // trompeur — et ça se sanctionne.
            const filVisible = ((html.match(/<nav class="fil"[\s\S]*?<\/nav>/) || [""])[0])
                .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, "’").replace(/\s+/g, " ").trim();
            const absents = echelons.filter((e) => e && e.name &&
                !filVisible.includes(String(e.name).replace(/['’]/g, "’"))).map((e) => e.name);
            verifier(absents.length === 0,
                `le fil déclaré nomme « ${absents.join(", ")} », qu'on ne trouve pas dans le fil affiché ` +
                `(« ${filVisible} ») — déclarer un chemin qu'on ne montre pas est du balisage trompeur`);

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

            // ── lastmod : LA SEULE DES TROIS INDICATIONS QUE GOOGLE LIT ──
            //
            // Le plan ne donnait que changefreq et priority, que Google
            // déclare ignorer. Sans lastmod, il n'a aucun moyen de savoir
            // qu'une fiche n'a pas bougé, et recharge les trente-quatre à
            // chaque passage.
            //
            // La date est CALCULÉE depuis le fichier qui porte le contenu,
            // jamais saisie à la main — une date tenue à la main devient
            // fausse au premier oubli, et une date fausse apprend à Google à
            // ne plus lire ce champ du tout.
            const blocs = xml.split("<url>").slice(1);
            const sansDate = blocs.filter((b) => /\/metiers/.test(b) && !/<lastmod>/.test(b)).length;
            verifier(sansDate === 0,
                `${sansDate} entrée(s) de métier n'ont pas de lastmod — Google rechargera les ` +
                "trente-quatre fiches à chaque passage, y compris celles qui n'ont pas bougé");

            const dates = [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
            verifier(dates.length >= fiches.length + 1,
                `seulement ${dates.length} lastmod pour ${fiches.length} fiches et leur hub`);
            const malDatees = dates.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
            verifier(malDatees.length === 0,
                `date(s) au mauvais format : ${malDatees.slice(0, 3).join(", ")} — il faut AAAA-MM-JJ`);
            // Une date future annonce un changement qui n'a pas eu lieu.
            const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            const futures = dates.filter((d) => d > demain);
            verifier(futures.length === 0,
                `date(s) dans le futur : ${futures.slice(0, 3).join(", ")}`);

            // Et l'ordre : le schéma décrit une séquence loc → lastmod.
            const malPlacees = blocs.filter((b) => /<lastmod>/.test(b) &&
                b.indexOf("<lastmod>") < b.indexOf("</loc>")).length;
            verifier(malPlacees === 0,
                `${malPlacees} entrée(s) placent lastmod avant la fin de <loc>`);
        }

        // ── 6. LE HUB A SA PROPRE ADRESSE CANONIQUE ──────────────────────
        //
        // Il n'en avait pas, alors que les trente-quatre fiches qu'il liste en
        // ont toutes une. Mesuré : /metiers, /metiers?lang=en et
        // /metiers?lang=ar répondaient 200 avec le même contenu et aucune
        // canonique — trois adresses indexables pour une seule page, et c'est
        // celle qui porte la priorité la plus haute du plan après l'accueil.
        {
            const html = await (await fetch(`${BASE}/metiers`)).text();
            const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
            verifier(!!canon, "le hub /metiers n'a pas d'URL canonique : ?lang= en fabrique des copies indexables");
            verifier(/\/metiers$/.test(canon || ""),
                `la canonique du hub est « ${canon} » — elle doit pointer sur /metiers, sans paramètre`);

            // Calculée sur APP_URL comme celle des fiches, jamais sur l'en-tête
            // Host : sinon le même contenu s'annonce sous le domaine ET sous
            // l'adresse Render brute, et Google les met en concurrence.
            const srcR = fs.readFileSync(path.join(RACINE, "routes/metiers.js"), "utf8");
            verifier(/canonique:\s*`\$\{BASE\}\/metiers`/.test(srcR),
                "la canonique du hub n'est plus calculée depuis BASE (APP_URL)");
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
