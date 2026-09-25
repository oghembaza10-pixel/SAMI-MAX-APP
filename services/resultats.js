// ==========================================================================
// SAMII OS — LES CARTES : UN RÉSULTAT QUI RESTE
// ==========================================================================
//
// ── LE PROBLÈME, DIT SIMPLEMENT ──────────────────────────────────────────
//
// Quand SAMII appelle un outil, cet outil rend une VRAIE structure :
// `rechercher_prospects` rend huit entreprises avec leur lien et leur
// secteur, `resume_journee` rend des compteurs. Le planner passe cette
// structure au modèle, le modèle en fait une phrase, et la structure est
// jetée.
//
// Mesuré : `planner.ask()` rend une CHAÎNE. Le seul renseignement structuré
// qui survivait au tour était `actes: [{nom, reussi}]` — de quoi facturer,
// pas de quoi afficher.
//
// Résultat à l'écran : un mur de texte. Le marchand paie un acte, reçoit un
// paragraphe, le lit, le perd. Rien ne reste, rien ne se reprend, rien ne se
// montre à quelqu'un d'autre.
//
// ── CE QUE CE FICHIER FAIT, ET RIEN D'AUTRE ──────────────────────────────
//
// Il traduit la sortie d'un outil en une CARTE : un objet d'affichage, plat,
// sans logique, que le fil du chat sait peindre. Un adaptateur par outil,
// déclarés dans une table.
//
// ⚠️ IL N'INVENTE RIEN. Chaque champ d'une carte vient d'un champ rendu par
// l'outil. Quand la donnée manque, le champ est absent — jamais rempli par
// une valeur plausible. Une carte qui affiche un chiffre que personne n'a
// calculé est pire qu'une carte absente : elle est crue.
//
// ⚠️ LA STRUCTURE BRUTE NE QUITTE JAMAIS LE SERVEUR. C'est la carte qui part
// au navigateur, pas le `functionResult`. `resume_journee` rend les aperçus
// de la boîte mail ; l'adaptateur en tire un compteur, et les objets des
// messages restent ici. Passer l'objet entier « au cas où » aurait été le
// chemin court pour envoyer un jour à la page des données que personne
// n'avait décidé d'y mettre.
//
// ── LES GESTES SOUS LA CARTE ─────────────────────────────────────────────
//
// Une carte se termine par ce qu'on peut faire ensuite. Deux sortes :
//
//   UN GESTE SANS OUTIL   c'est une phrase qu'on renvoie à SAMII
//                         (« Trouve-moi leurs coordonnées »). Toujours
//                         permis : c'est un message, comme un autre.
//
//   UN GESTE AVEC OUTIL   il nomme un outil précis. Il n'est proposé QUE si
//                         cette personne, à ce niveau, le tient vraiment —
//                         même table que le chantier précédent
//                         (config/audiences.js, `outilsDuTour`).
//
// Proposer un bouton qui ne peut pas aboutir est la version cliquable du
// défaut qu'on vient de réparer dans le prompt : annoncer un geste qu'on ne
// sait pas faire. En pire, parce qu'un bouton, on appuie dessus.
// ==========================================================================

const AUDIENCES = require("../config/audiences");

// Le nombre d'éléments qu'une carte montre. Au-delà, elle devient une page
// qu'on fait défiler — et une carte qu'on fait défiler n'est plus une carte.
// Le reste n'est pas perdu : la réponse de SAMII en parle, et le marchand
// peut demander la suite.
const MAX_ELEMENTS = 8;
const MAX_LIENS = 4;

// ── LES ADAPTATEURS ──────────────────────────────────────────────────────
//
// Une entrée par outil qui rend une structure affichable. Un outil absent de
// cette table ne produit pas de carte, et c'est le bon défaut : sa réponse
// reste du texte, comme avant. On n'ajoute une entrée que lorsqu'on a lu ce
// que l'outil rend VRAIMENT — pas ce qu'on suppose qu'il rend.
const ADAPTATEURS = {
    // ── « TROUVE-MOI DES CLIENTS » ───────────────────────────────────────
    //
    // Sortie réelle (brain/planner.js, rechercherProspects) :
    //   { success, prospects: [{ nom, lien, reseau_social, contact_pro,
    //                            secteur, explication }], sources: [...] }
    rechercher_prospects(d) {
        if (!d || d.success === false || !Array.isArray(d.prospects) || !d.prospects.length) return null;
        const liste = d.prospects.slice(0, MAX_ELEMENTS);
        return {
            forme: "liste",
            titre: `${d.prospects.length} prospect${d.prospects.length > 1 ? "s" : ""} trouvé${d.prospects.length > 1 ? "s" : ""}`,
            elements: liste.map((p) => ({
                titre: texte(p.nom),
                // Le secteur est une étiquette, pas une phrase : il tient
                // sur la même ligne que le nom.
                valeur: texte(p.secteur),
                detail: texte(p.explication),
                // `contact_pro` n'est rempli par l'outil que lorsque
                // l'entreprise le publie elle-même pour être contactée. On
                // le montre tel quel ou pas du tout.
                contact: texte(p.contact_pro),
                lien: lien(p.lien) || lien(p.reseau_social),
            })).filter((e) => e.titre),
            liens: sources(d.sources),
            gestes: [
                // Sans outil : ce sont des phrases renvoyées à SAMII. Elles
                // coûtent un message, comme n'importe quel message.
                { libelle: "Écris-moi un premier message", demande: "Écris-moi un premier message à envoyer à ces prospects." },
                { libelle: "Cherche plus loin", demande: "Cherche-moi d'autres prospects du même profil, différents de ceux-là." },
                // AVEC outil : `envoyer_email` est dans la famille écriture,
                // donc accordé à partir du niveau Pro (config/niveaux.js).
                // À « Expert », ce bouton n'est pas grisé — il n'existe pas.
                // C'est la différence entre « tu ne peux pas » et « on ne te
                // l'a pas proposé » : la première frustre, la seconde ne
                // ment pas.
                { libelle: "Envoie-leur un email", demande: "Prépare et envoie un premier email à ces prospects.", outil: "envoyer_email" },
            ],
        };
    },

    // ── « QU'EST-CE QUI S'EST PASSÉ ? » ──────────────────────────────────
    //
    // Sortie réelle (brain/planner.js, resumeJournee → services/briefing.js) :
    //   { success, periode, perimetre, donnees: { commandes, paiements,
    //     rendezVous, messagesNonLus, emails: { nombre, apercus } },
    //     indisponibles: [ "..." ] }
    //
    // ⚠️ `indisponibles` EST AFFICHÉ, et ce n'est pas un détail. « 0 erreur »
    // et « on ne compte pas les erreurs » sonnent pareil et ne veulent pas
    // dire la même chose — services/briefing.js écrit cette distinction
    // exprès. Une carte qui montrerait les compteurs en taisant ce qui n'a
    // pas pu être lu ferait croire à un bilan complet.
    resume_journee(d) {
        if (!d || d.success === false || !d.donnees) return null;
        const j = d.donnees;
        const elements = [];
        const compteur = (titre, valeur) => {
            const n = nombre(valeur);
            if (n !== null) elements.push({ titre, valeur: String(n) });
        };
        compteur("Commandes", j.commandes);
        compteur("Paiements", j.paiements);
        compteur("Rendez-vous", j.rendezVous);
        compteur("Messages non lus", j.messagesNonLus);
        compteur("Emails", j.emails && j.emails.nombre);
        if (!elements.length) return null;
        return {
            forme: "chiffres",
            titre: "Ton bilan",
            soustitre: [texte(d.perimetre), texte(d.periode)].filter(Boolean).join(" · "),
            elements,
            // Ce qui n'a pas pu être lu, dit à voix haute.
            manques: Array.isArray(d.indisponibles) ? d.indisponibles.slice(0, 4).map(texte).filter(Boolean) : [],
            gestes: [
                { libelle: "Qu'est-ce que je fais en premier ?", demande: "D'après ce bilan, qu'est-ce que je devrais faire en premier aujourd'hui ?" },
            ],
        };
    },
};

// ── LES PETITES MAINS ────────────────────────────────────────────────────
//
// Tout ce qui entre dans une carte passe par là. Une valeur qui n'est pas du
// texte lisible devient absente plutôt que « [object Object] » à l'écran.
function texte(v) {
    if (typeof v !== "string") return "";
    const t = v.trim();
    return t && t !== "undefined" && t !== "null" ? t.slice(0, 400) : "";
}

// `0` est une valeur, pas une absence — d'où le test sur le type plutôt que
// sur la vérité. Un bilan qui cache « 0 commande » ne dit pas la vérité.
function nombre(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return null;
}

// Seuls http(s). Une carte affiche des liens venus d'une recherche web :
// `javascript:` dans un href est du code qui s'exécute au clic, et l'outil
// qui remplit ce champ lit des pages que n'importe qui peut publier.
function lien(v) {
    const t = texte(v);
    return /^https?:\/\//i.test(t) ? t : "";
}

function sources(liste) {
    if (!Array.isArray(liste)) return [];
    return liste
        .map((s) => ({ libelle: texte(s && (s.title || s.titre)) || texte(s && s.uri) || "source", url: lien(s && (s.uri || s.url || s.link)) }))
        .filter((s) => s.url)
        .slice(0, MAX_LIENS);
}

// ── LE FILTRE DES GESTES ─────────────────────────────────────────────────
//
// La même table que le prompt, et pour la même raison. Un geste qui nomme un
// outil que cette personne ne tient pas est retiré — pas grisé, pas affiché
// avec un cadenas : retiré. Un bouton visible est une promesse.
function gestesPermis(gestes, audience, niveau) {
    if (!Array.isArray(gestes)) return [];
    const possibles = new Set(AUDIENCES.outilsDuTour(audience, niveau));
    return gestes
        .filter((g) => g && texte(g.libelle) && texte(g.demande))
        .filter((g) => !g.outil || possibles.has(g.outil))
        .slice(0, 3);
}

// ── LE PRIX DE CE GESTE-LÀ, S'IL Y EN A UN ───────────────────────────────
//
// `credits.lignes` vient de config/credits.js : une ligne par acte facturé,
// plus celle du message. On ne montre QUE la ligne de cet acte-ci — le prix
// du message n'appartient pas à la carte, il appartient au tour.
//
// Pas de ligne pour cet acte = pas de bloc de prix. Le silence est juste :
// ce qui ne fait que LIRE ses propres données est compris dans le message
// (voir config/credits.js), et afficher « 0 » ferait croire à une remise.
function coutDe(nomActe, credits) {
    if (!credits || !Array.isArray(credits.lignes)) return null;
    const ligne = credits.lignes.find((l) => l && l.quoi === nomActe);
    if (!ligne || !(ligne.montant > 0)) return null;
    const cout = { montant: ligne.montant, libelle: texte(ligne.libelle) || nomActe };
    // Le solde APRÈS le débit, tel que le registre le rend. Absent quand le
    // tour n'a pas été débité (quota gratuit) : on ne l'estime pas.
    if (typeof credits.solde === "number") cout.solde = credits.solde;
    return cout;
}

// ── LA PORTE D'ENTRÉE ────────────────────────────────────────────────────
//
// `actes` est le journal du tour, tel que brain/planner.js le remplit :
// [{ nom, reussi, donnees }]. On ne fabrique une carte que pour un acte
// RÉUSSI — un acte raté n'a rien produit à montrer, et sa réponse texte dit
// déjà ce qui a échoué.
function depuisLesActes(actes, { audience = "", niveau = null, credits = null } = {}) {
    if (!Array.isArray(actes)) return [];
    const liste = [];
    for (const acte of actes) {
        if (!acte || typeof acte !== "object" || acte.reussi === false) continue;
        const adapter = ADAPTATEURS[acte.nom];
        if (!adapter) continue;
        let carte = null;
        try {
            carte = adapter(acte.donnees);
        } catch (err) {
            // Une carte ratée ne casse pas la réponse : le texte de SAMII
            // est déjà parti, il porte l'essentiel. On le dit au journal et
            // on continue.
            console.error(`❌ résultats (${acte.nom}) :`, err.message);
            continue;
        }
        if (!carte || !Array.isArray(carte.elements) || !carte.elements.length) continue;
        carte.source = acte.nom;
        carte.gestes = gestesPermis(carte.gestes, audience, niveau);
        const cout = coutDe(acte.nom, credits);
        if (cout) carte.cout = cout;
        liste.push(carte);
    }
    return liste;
}

module.exports = { depuisLesActes, gestesPermis, ADAPTATEURS, MAX_ELEMENTS };
