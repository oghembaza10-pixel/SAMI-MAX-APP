// ==========================================================================
// OG TECHNOLOGY — HUB : Moteur front-end (vitrine premium, pas de dashboard)
// ==========================================================================

// ══════════════════════════════════════════════════════════════════════════
// LES MÉTIERS DU HUB
// ══════════════════════════════════════════════════════════════════════════
//
// Ce fichier portait SA PROPRE liste de douze métiers, et un dictionnaire de
// secours de douze libellés — pendant que views/hub.ejs en portait douze
// autres en quatre langues, et que services/metiers.js en déclarait
// trente-quatre. Trois copies, trois vérités, et c'est la moins juste des
// trois qui s'affichait.
//
// Tout vient maintenant de `window.OG_METIERS`, rempli par le serveur depuis
// le registre et déjà traduit. Ce fichier n'a plus de liste : il AFFICHE.

const GROUPES = Array.isArray(window.OG_METIERS) ? window.OG_METIERS : [];
const TOUS = GROUPES.flatMap((g) => g.metiers || []);

// ── COMBIEN ON EN MONTRE AU DÉPART ──────────────────────────────────────
//
// Trente-quatre cartes d'un coup, c'est un catalogue : on ne cherche plus,
// on parcourt. On en montre douze — le nombre qu'il y avait avant, et qui
// tenait bien à l'écran — et « Voir plus de métiers » ouvre le reste SUR
// PLACE. Pas une autre page : quitter le Hub pour voir ses propres métiers
// serait exactement la duplication qu'on vient de retirer.
const VISIBLES_AU_DEPART = 12;

// ── L'ORDRE DE DÉPART ───────────────────────────────────────────────────
//
// Pas les douze premiers du registre : ce sont les sept métiers de la Santé
// suivis de cinq de Beauté, et le Hub aurait l'air réservé aux cabinets. On
// prend le premier de chaque groupe, puis le deuxième, etc. — les sept
// familles sont représentées dès le premier écran.
function ordreDeDepart() {
    const files = GROUPES.map((g) => (g.metiers || []).slice());
    const sortie = [];
    let reste = true;
    while (reste) {
        reste = false;
        for (const f of files) {
            if (f.length) { sortie.push(f.shift()); reste = true; }
        }
    }
    // « Autre activité » n'est pas un métier qu'on choisit dans une grille :
    // c'est ce qu'on prend quand on n'a rien trouvé, et il y a un bouton
    // pour ça. Le garder ici enverrait vers un QG sans métier défini.
    return sortie.filter((m) => m.id !== "autre");
}

const ORDONNES = ordreDeDepart();
let toutAffiche = false;
let filtre = "";

// Accents et casse ne doivent pas empêcher de trouver son métier : quelqu'un
// qui tape « patisserie » cherche « Pâtisserie ».
function sansAccent(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function correspond(m, q) {
    if (!q) return true;
    const aiguille = sansAccent(q);
    return sansAccent(m.label).includes(aiguille)
        || sansAccent(m.groupe).includes(aiguille)
        || sansAccent(m.id).includes(aiguille);
}

function echapper(t) {
    return String(t == null ? "" : t)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function texteVoirPlus(restants) {
    if (typeof t === "function") {
        const base = t("hub.metiers.more");
        if (base && base !== "hub.metiers.more") return base.replace("{n}", restants);
    }
    return "Voir plus de métiers (" + restants + ")";
}

function renderMetierGrid() {
    const grid = document.getElementById("metier-grid");
    if (!grid) return;

    const trouves = ORDONNES.filter((m) => correspond(m, filtre));

    // ── PENDANT UNE RECHERCHE, ON MONTRE TOUT CE QUI CORRESPOND ─────────
    //
    // Limiter les résultats à douze pendant qu'on cherche donnerait
    // « aucun résultat » sur un métier qui existe, simplement parce qu'il
    // était le treizième. Chercher, c'est déjà avoir réduit.
    const limite = (filtre || toutAffiche) ? trouves.length : VISIBLES_AU_DEPART;
    const montres = trouves.slice(0, limite);
    const restants = trouves.length - montres.length;

    if (!montres.length) {
        // RIEN TROUVÉ N'EST PAS UNE IMPASSE. C'est exactement le moment où
        // « Créer mon métier » sert : la personne vient de prouver que son
        // activité n'est pas dans la liste.
        grid.innerHTML = `
            <div class="metier-vide">
                <p>${echapper(typeof t === "function" && t("hub.metiers.none") !== "hub.metiers.none"
                    ? t("hub.metiers.none") : "Aucun métier ne correspond à « " + filtre + " ».")}</p>
                <button type="button" class="metier-card more" data-creer-metier>
                    <span class="metier-card__emoji" aria-hidden="true">✨</span>
                    <h3>${echapper(typeof t === "function" && t("hub.metiers.create") !== "hub.metiers.create"
                        ? t("hub.metiers.create") : "Créer mon métier")}</h3>
                </button>
            </div>`;
        return;
    }

    grid.innerHTML = montres.map((m) => `
        <a class="metier-card" href="/register?metier=${encodeURIComponent(m.id)}" data-metier="${echapper(m.id)}">
            <div class="metier-card__body">
                <span class="metier-card__emoji" aria-hidden="true">${echapper(m.icone)}</span>
                <div>
                    <h3>${echapper(m.label)}</h3>
                    <span>${echapper(m.groupe)}</span>
                </div>
            </div>
        </a>
    `).join("")
    + (restants > 0 ? `
        <button type="button" class="metier-card more" data-voir-plus>
            <span class="metier-card__emoji" aria-hidden="true">＋</span>
            <h3>${echapper(texteVoirPlus(restants))}</h3>
        </button>` : "")
    + `
        <button type="button" class="metier-card more metier-card--creer" data-creer-metier>
            <span class="metier-card__emoji" aria-hidden="true">✨</span>
            <h3>${echapper(typeof t === "function" && t("hub.metiers.create") !== "hub.metiers.create"
                ? t("hub.metiers.create") : "Créer mon métier")}</h3>
        </button>`;

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// Un seul écouteur sur la grille plutôt qu'un par carte : elle est reconstruite
// à chaque frappe, et des écouteurs posés sur des nœuds détruits s'accumulent.
document.addEventListener("click", (e) => {
    if (e.target.closest("[data-voir-plus]")) {
        toutAffiche = true;
        renderMetierGrid();
    }
});


// ══════════════════════════════════════════════════════════════════════════
// « CRÉER MON MÉTIER » — LE QUESTIONNAIRE
// ══════════════════════════════════════════════════════════════════════════
//
// LE PARCOURS PRÉVU QUAND ON NE TROUVE PAS SON ACTIVITÉ. Sept questions,
// posées une par une, dans le ton de SAMII — pas un formulaire de trente
// champs.
//
// ── IL N'INVENTE AUCUN CONTRAT ─────────────────────────────────────────
//
// Il remplit `POST /workspace/create` tel qu'il existe :
//
//     { nom, metier, metierCustom, description, pays, devise }
//
// `metier: "autre"` + `metierCustom: <ce que la personne a écrit>` est le
// chemin que cette route prévoyait DÉJÀ pour un métier libre. Rien n'a été
// ajouté côté serveur.
//
// ── ET IL NE CRÉE RIEN AVANT LA FIN ────────────────────────────────────
//
// Les réponses vivent en mémoire jusqu'au dernier écran. Créer le QG à la
// troisième question laisserait des QG fantômes derrière chaque personne
// qui abandonne — et c'est précisément ce qu'on ne veut pas.

const ETAPES = [
    { cle: "metierCustom", question: "C'est quoi ton activité ?",
      aide: "Dis-le avec tes mots — « je vends des gâteaux », « je répare des téléphones ».",
      exemple: "Pâtisserie maison", obligatoire: true },
    { cle: "nom", question: "Elle s'appelle comment ?",
      aide: "Le nom de ta boutique ou de ton entreprise. C'est lui qui nommera ton QG.",
      exemple: "Chez Amina", obligatoire: true },
    { cle: "prenom", question: "Et toi, ton prénom ?",
      aide: "SAMII s'en sert pour te parler, pas pour remplir un dossier.",
      exemple: "Amina", obligatoire: true },
    { cle: "nomFamille", question: "Ton nom de famille ?",
      aide: "Il apparaîtra sur tes documents — factures, devis.",
      exemple: "Benali", obligatoire: false },
    { cle: "pays", question: "Tu travailles depuis quel pays ?",
      aide: "Ça règle ta devise et la façon dont SAMII compte tes prix.",
      type: "pays", obligatoire: true },
    { cle: "langue", question: "Dans quelle langue tu veux qu'on se parle ?",
      aide: "Tu pourras en changer quand tu veux.",
      type: "langue", obligatoire: true },
    { cle: "description", question: "Autre chose que SAMII devrait savoir ?",
      aide: "Tes clients, ce que tu vends, comment tu livres. Ou rien du tout — on verra en parlant.",
      exemple: "Je livre à Alger, commandes par Instagram", obligatoire: false, multiligne: true },
];

const LANGUES = [
    { code: "fr", label: "Français" },
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
];

const reponses = {};
let etapeActuelle = 0;

function boiteCreation() { return document.getElementById("creer-metier"); }

function ouvrirCreationMetier(metierPreRempli) {
    const boite = boiteCreation();
    if (!boite) return;
    etapeActuelle = 0;
    for (const k of Object.keys(reponses)) delete reponses[k];
    if (metierPreRempli) reponses.metierCustom = metierPreRempli;
    boite.hidden = false;
    document.body.style.overflow = "hidden";
    dessinerEtape();
}

function fermerCreationMetier() {
    const boite = boiteCreation();
    if (!boite) return;
    boite.hidden = true;
    document.body.style.overflow = "";
}

function dessinerEtape() {
    const corps = document.getElementById("creer-metier-corps");
    const pas = document.getElementById("creer-metier-pas");
    const jauge = document.getElementById("creer-metier-jauge");
    if (!corps) return;

    // Dernier écran : on récapitule et on crée.
    if (etapeActuelle >= ETAPES.length) return dessinerRecap();

    const e = ETAPES[etapeActuelle];
    if (pas) pas.textContent = "Question " + (etapeActuelle + 1) + " sur " + ETAPES.length;
    if (jauge) jauge.style.width = Math.round((etapeActuelle / ETAPES.length) * 100) + "%";

    let champ;
    if (e.type === "pays") {
        const pays = Array.isArray(window.OG_PAYS) ? window.OG_PAYS : [];
        champ = '<select class="creer-metier__champ" id="creer-champ">'
            + '<option value="">Choisis ton pays</option>'
            + pays.map((p) => '<option value="' + echapper(p.code) + '"'
                + (reponses.pays === p.code ? " selected" : "") + '>'
                + echapper(p.label) + (p.devise ? " · " + echapper(p.devise) : "") + '</option>').join("")
            + '</select>';
    } else if (e.type === "langue") {
        champ = '<div class="creer-metier__choix">' + LANGUES.map((l) =>
            '<button type="button" class="creer-metier__puce' + (reponses.langue === l.code ? " est-choisi" : "")
            + '" data-langue="' + l.code + '">' + echapper(l.label) + '</button>').join("") + '</div>';
    } else if (e.multiligne) {
        champ = '<textarea class="creer-metier__champ" id="creer-champ" rows="3" placeholder="'
            + echapper(e.exemple || "") + '">' + echapper(reponses[e.cle] || "") + '</textarea>';
    } else {
        champ = '<input class="creer-metier__champ" id="creer-champ" type="text" placeholder="'
            + echapper(e.exemple || "") + '" value="' + echapper(reponses[e.cle] || "") + '">';
    }

    corps.innerHTML =
        '<p class="creer-metier__question">' + echapper(e.question) + '</p>'
        + '<p class="creer-metier__aide">' + echapper(e.aide) + '</p>'
        + champ
        + '<p class="creer-metier__erreur" id="creer-erreur" hidden></p>'
        + '<div class="creer-metier__pieds">'
        + (etapeActuelle > 0 ? '<button type="button" class="creer-metier__retour" data-precedent>Retour</button>' : '<span></span>')
        + '<button type="button" class="creer-metier__suivant" data-suivant>'
        + (etapeActuelle === ETAPES.length - 1 ? "Terminer" : "Continuer") + '</button>'
        + '</div>';

    const champEl = document.getElementById("creer-champ");
    if (champEl) { champEl.focus(); champEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey && !e.multiligne) { ev.preventDefault(); etapeSuivante(); }
    }); }
}

function lireEtape() {
    const e = ETAPES[etapeActuelle];
    if (e.type === "langue") return reponses.langue || "";
    const el = document.getElementById("creer-champ");
    return el ? String(el.value || "").trim() : "";
}

function etapeSuivante() {
    const e = ETAPES[etapeActuelle];
    const valeur = lireEtape();
    if (e.obligatoire && !valeur) {
        const err = document.getElementById("creer-erreur");
        if (err) { err.textContent = "J'ai besoin de cette réponse pour continuer."; err.hidden = false; }
        return;
    }
    reponses[e.cle] = valeur;
    etapeActuelle++;
    dessinerEtape();
}

function dessinerRecap() {
    const corps = document.getElementById("creer-metier-corps");
    const pas = document.getElementById("creer-metier-pas");
    const jauge = document.getElementById("creer-metier-jauge");
    if (pas) pas.textContent = "Dernière étape";
    if (jauge) jauge.style.width = "100%";

    const pays = (window.OG_PAYS || []).find((p) => p.code === reponses.pays);
    corps.innerHTML =
        '<p class="creer-metier__question">Voilà ce que j\'ai compris.</p>'
        + '<ul class="creer-metier__recap">'
        + '<li><b>Activité</b><span>' + echapper(reponses.metierCustom || "—") + '</span></li>'
        + '<li><b>Nom</b><span>' + echapper(reponses.nom || "—") + '</span></li>'
        + '<li><b>Toi</b><span>' + echapper(((reponses.prenom || "") + " " + (reponses.nomFamille || "")).trim() || "—") + '</span></li>'
        + '<li><b>Pays</b><span>' + echapper(pays ? pays.label + (pays.devise ? " · " + pays.devise : "") : "—") + '</span></li>'
        + '<li><b>Langue</b><span>' + echapper((LANGUES.find((l) => l.code === reponses.langue) || {}).label || "—") + '</span></li>'
        + (reponses.description ? '<li><b>À savoir</b><span>' + echapper(reponses.description) + '</span></li>' : '')
        + '</ul>'
        + '<p class="creer-metier__erreur" id="creer-erreur" hidden></p>'
        + '<div class="creer-metier__pieds">'
        + '<button type="button" class="creer-metier__retour" data-precedent>Retour</button>'
        + '<button type="button" class="creer-metier__suivant" data-creer>Créer mon QG</button>'
        + '</div>';
}

async function creerLeQG() {
    const bouton = document.querySelector("[data-creer]");
    const err = document.getElementById("creer-erreur");
    if (bouton) { bouton.disabled = true; bouton.textContent = "SAMII organise ton QG…"; }
    if (err) err.hidden = true;

    // ── PAS DE COMPTE, PAS DE CRÉATION ──────────────────────────────────
    //
    // `POST /workspace/create` est protégé, et il doit le rester. Un
    // visiteur garde donc ses réponses et passe par l'inscription : elles
    // l'attendent de l'autre côté plutôt que d'être perdues, et aucun QG
    // n'est créé au nom de personne.
    if (!window.OG_CONNECTE) {
        try { sessionStorage.setItem("samii.creation", JSON.stringify(reponses)); } catch (e) {}
        window.location.href = "/register?metier=" + encodeURIComponent(reponses.metierCustom || "");
        return;
    }

    const pays = (window.OG_PAYS || []).find((p) => p.code === reponses.pays);
    try {
        const r = await fetch("/workspace/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nom: reponses.nom,
                // Le chemin du métier libre, prévu par la route depuis
                // toujours : `metier: "autre"` + `metierCustom`.
                metier: "autre",
                metierCustom: reponses.metierCustom,
                description: [reponses.description,
                    (reponses.prenom || reponses.nomFamille)
                        ? "Contact : " + ((reponses.prenom || "") + " " + (reponses.nomFamille || "")).trim()
                        : ""].filter(Boolean).join(" — "),
                pays: reponses.pays,
                devise: pays ? pays.devise : "",
            }),
        });
        const data = await r.json();
        if (!data || data.success === false) throw new Error((data && data.error) || "Création impossible.");
        dessinerBienvenue();
    } catch (e) {
        if (err) { err.textContent = e.message || "Création impossible. Réessaie."; err.hidden = false; }
        if (bouton) { bouton.disabled = false; bouton.textContent = "Créer mon QG"; }
    }
}

function dessinerBienvenue() {
    const corps = document.getElementById("creer-metier-corps");
    const pas = document.getElementById("creer-metier-pas");
    if (pas) pas.textContent = "";
    corps.innerHTML =
        '<div class="creer-metier__fin">'
        + '<p class="creer-metier__bienvenue">Bienvenue dans ton QG.</p>'
        + '<p class="creer-metier__aide">SAMII a rangé ton espace. Il t\'attend à l\'intérieur.</p>'
        + '<a class="creer-metier__suivant" href="/qg">Entrer</a>'
        + '</div>';
    // On y va tout seul : la phrase se lit, puis la porte s'ouvre. Rester
    // sur un écran de félicitations qui ne mène nulle part est le meilleur
    // moyen de perdre quelqu'un juste après l'avoir convaincu.
    setTimeout(() => { window.location.href = "/qg"; }, 1800);
}

document.addEventListener("click", (e) => {
    if (e.target.closest("[data-creer-metier]")) {
        const q = (document.getElementById("hero-search") || {}).value || "";
        ouvrirCreationMetier(q.trim());
    } else if (e.target.closest("[data-fermer-creation]")) {
        fermerCreationMetier();
    } else if (e.target.closest("[data-suivant]")) {
        etapeSuivante();
    } else if (e.target.closest("[data-precedent]")) {
        if (etapeActuelle > 0) etapeActuelle--;
        dessinerEtape();
    } else if (e.target.closest("[data-creer]")) {
        creerLeQG();
    } else {
        const puce = e.target.closest("[data-langue]");
        if (puce) { reponses.langue = puce.getAttribute("data-langue"); dessinerEtape(); }
    }
});

document.addEventListener("keydown", (e) => {
    const boite = boiteCreation();
    if (e.key === "Escape" && boite && !boite.hidden) fermerCreationMetier();
});

// ── Toast simple pour "bientôt disponible" ──────────────────────────
function showHubToast(message) {
    let toast = document.getElementById("hub-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "hub-toast";
        toast.className = "hub-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("hub-toast--visible");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove("hub-toast--visible"), 2800);
}

// ── Panneau de recherche : 3 options ─────────────────────────────────
function initSearchPanel() {
    const wrap = document.querySelector(".hero-search-wrap");
    const input = document.getElementById("hero-search");
    const panel = document.getElementById("hero-search-panel");
    if (!wrap || !input || !panel) return;

    function openPanel() { wrap.classList.add("open"); }
    function closePanel() { wrap.classList.remove("open"); }

    // ── LA RECHERCHE CHERCHE ────────────────────────────────────────────
    //
    // Elle ne filtrait RIEN. Mesuré avant ce chantier : taper « dentiste »
    // laissait les treize cartes en place, et ouvrait un panneau de trois
    // actions. Le champ disait « cherche » et ne faisait qu'ouvrir un menu.
    //
    // Il filtre maintenant la grille à chaque frappe. Le panneau d'actions
    // ne s'ouvre plus tant qu'on tape : il masquerait les résultats qu'on
    // vient de demander. Il reste accessible au focus sur un champ vide.
    input.addEventListener("focus", () => { if (!input.value.trim()) openPanel(); });
    input.addEventListener("input", () => {
        filtre = input.value.trim();
        if (filtre) closePanel(); else openPanel();
        renderMetierGrid();
    });

    // Ferme le panneau si on clique en dehors
    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) closePanel();
    });

    panel.querySelectorAll(".hero-search__option").forEach(btn => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action;
            const query = input.value.trim();

            if (action === "create") {
                closePanel();
                if (typeof window.openOnboardingChat === "function") {
                    window.openOnboardingChat();
                } else {
                    // Repli si le script de chat n'a pas chargé, pour ne jamais bloquer la création
                    window.location.href = query ? `/inscription?metier=${encodeURIComponent(query)}` : `/inscription`;
                }
            } else if (action === "find") {
                // ── PLUS DE FAUX « BIENTÔT DISPONIBLE » ─────────────────
                //
                // Ce bouton affichait « Chercher un QG — bientôt disponible ».
                // Une promesse qu'on ne tient pas est pire qu'une absence :
                // on revient vérifier, et on revient encore.
                //
                // Chercher un QG, ça existe : ce sont les QG du visiteur,
                // déjà dans `window.OG_WORKSPACES`. On y renvoie — et si le
                // visiteur n'est pas connecté, vers la connexion, qui est la
                // vraie réponse à « je cherche MON QG ».
                closePanel();
                if (window.OG_CONNECTE) {
                    const cible = document.getElementById("mes-qg") || document.querySelector(".workspaces, [data-workspaces]");
                    if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
                    else window.location.href = "/mes-qg";
                } else {
                    window.location.href = "/login?suite=" + encodeURIComponent("/hub");
                }
            }
        });
    });

    // ── LA LOUPE ET « ENTRÉE » ──────────────────────────────────────────
    //
    // Les deux envoyaient sur `/inscription?metier=<ce qu'on a tapé>`, sans
    // jamais regarder si ce métier existe. Taper « dentiste » quittait donc
    // la page pour un formulaire, alors que Dentiste est dans le registre et
    // qu'il aurait suffi de le montrer.
    //
    // Désormais : s'il y a UN seul résultat, on y va. Sinon on reste sur la
    // grille filtrée — c'est là que la réponse est.
    function allerAuResultat() {
        const q = input.value.trim();
        filtre = q;
        renderMetierGrid();
        const trouves = ORDONNES.filter((m) => correspond(m, q));
        if (q && trouves.length === 1) {
            window.location.href = "/register?metier=" + encodeURIComponent(trouves[0].id);
            return;
        }
        // Rien ne correspond : la personne vient de prouver que son activité
        // n'est pas dans la liste. C'est le moment de la lui faire créer.
        if (q && trouves.length === 0) ouvrirCreationMetier(q);
    }

    const searchBtn = document.getElementById("hero-search-btn");
    if (searchBtn) searchBtn.addEventListener("click", allerAuResultat);

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); allerAuResultat(); }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderMetierGrid();
    initSearchPanel();

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Re-rendu des cartes métier quand la langue change
    if (typeof Language !== "undefined" && Language.onChange) {
        Language.onChange(() => {
            renderMetierGrid();
        });
    }

    // Sidebar : état actif au clic
    const navItems = document.querySelectorAll(".og-item");
    navItems.forEach(item => {
        item.addEventListener("click", function () {
            navItems.forEach(i => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    // Widget SAMII : ouverture / fermeture
    const samiiWidget = document.getElementById("samii-widget");
    const samiiTrigger = document.getElementById("samii-widget-trigger");
    const samiiClose = document.getElementById("samii-widget-close");

    function openSamii() { if (samiiWidget) samiiWidget.dataset.open = "true"; }
    function closeSamii() { if (samiiWidget) samiiWidget.dataset.open = "false"; }

    if (samiiTrigger) samiiTrigger.addEventListener("click", openSamii);
    if (samiiClose) samiiClose.addEventListener("click", closeSamii);

    const samiiForm = document.getElementById("samii-widget-form");
    if (samiiForm) {
        samiiForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = document.getElementById("samii-widget-input");
            const feed = document.getElementById("samii-widget-feed");
            const message = input.value.trim();
            if (!message) return;

            feed.insertAdjacentHTML("beforeend", `
                <div class="samii-msg samii-msg--user">
                    <div class="samii-msg__bubble">${message}</div>
                </div>
            `);
            input.value = "";
            feed.scrollTop = feed.scrollHeight;

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message }),
                });
                const data = await res.json();
                feed.insertAdjacentHTML("beforeend", `
                    <div class="samii-msg samii-msg--bot">
                        <div class="samii-msg__bubble">${data.reply}</div>
                    </div>
                `);
                feed.scrollTop = feed.scrollHeight;
            } catch (err) {
                console.error(err);
            }
        });
    }
});
