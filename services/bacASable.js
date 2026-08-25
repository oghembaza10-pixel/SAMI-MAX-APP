// ==========================================================================
// SAMII OS — LE BAC À SABLE DU DÉVELOPPEUR
//
// LA PIÈCE QUI DÉCIDE SI UN DÉVELOPPEUR RESTE OU PART.
//
// Un développeur qui arrive veut faire un appel et voir une réponse. S'il doit
// d'abord créer un compte marchand, remplir un catalogue, saisir de fausses
// commandes à la main — il part. Et s'il n'a pas de terrain d'essai, il teste
// sur un vrai marchand : une commande fantôme part chez un vrai client, et
// c'est nous qui portons la faute.
//
// CE QUE FONT LES AUTRES, ET CE QU'ILS RATENT. Shopify donne un « development
// store » : il faut le créer, puis y ajouter soi-même produits et commandes —
// une demi-journée avant le premier appel utile. Meta donne des « utilisateurs
// de test » : des coquilles vides, sans historique, sur lesquelles la moitié
// des points d'entrée ne renvoient rien. Dans les deux cas, le développeur
// construit son décor avant de construire son produit.
//
// Ici, un clic donne un espace DÉJÀ VIVANT : des clients, des commandes à
// différents stades, des rendez-vous passés et à venir, cohérents avec le
// métier choisi. Le premier appel renvoie quelque chose d'intéressant dès la
// première minute.
//
// TROIS GARANTIES QUI NE DOIVENT PAS BOUGER.
//   1. Un bac à sable est un espace comme un autre, marqué `est_bac_a_sable`.
//      Aucune duplication de code métier : les mêmes routes, la même API, les
//      mêmes règles. Un décor spécial mentirait sur le comportement réel.
//   2. Rien n'en sort. Aucun message n'est envoyé depuis un bac à sable —
//      c'est vérifié à l'envoi, pas seulement promis ici (services/notify.js
//      et les canaux). Une fausse commande ne doit jamais écrire à un vrai
//      numéro.
//   3. Il se remet à zéro et se supprime. Un développeur doit pouvoir salir,
//      recommencer, et ne rien laisser derrière lui.
// ==========================================================================
const crypto = require("crypto");
const db = require("./db");
const metiers = require("./metiers");
const apiPartenaire = require("./apiPartenaire");

// Les décors, par métier. Choisis pour que chaque point d'entrée de l'API
// renvoie quelque chose : des commandes à tous les stades, des rendez-vous
// avant et après aujourd'hui, des clients qui reviennent.
const DECORS = {
    boutique: {
        nom: "Boutique d'essai",
        metier: "ecommerce",
        clients: [
            { nom: "Amina Belkacem", tel: "213661112233" },
            { nom: "Karim Haddad", tel: "213770445566" },
            { nom: "Sofia Merabet", tel: "213551778899" },
            { nom: "Yacine Ould", tel: "213699334455" },
        ],
        produits: ["Veste en cuir — L", "Sneakers blanches — 42", "Sac à main cuir", "Montre acier"],
        montants: [7500, 12000, 9800, 4500, 15900],
    },
    restaurant: {
        nom: "Restaurant d'essai",
        metier: "restaurant",
        clients: [
            { nom: "Nabil Cherif", tel: "213770111222" },
            { nom: "Lina Zerrouki", tel: "213661333444" },
            { nom: "Omar Benali", tel: "213551555666" },
        ],
        produits: ["Menu du jour ×2", "Pizza royale + boisson", "Couscous familial", "Plateau grillades"],
        montants: [1800, 2400, 3600, 5200],
    },
    clinique: {
        nom: "Cabinet d'essai",
        metier: "dentiste",
        clients: [
            { nom: "Fatima Larbi", tel: "213661777888" },
            { nom: "Rachid Belaid", tel: "213770999000" },
            { nom: "Sarah Mansouri", tel: "213551222333" },
        ],
        produits: [],
        montants: [3000, 5000, 8000],
        motifs: ["Détartrage", "Contrôle annuel", "Douleur molaire", "Pose d'appareil"],
    },
};

const STATUTS_COMMANDE = ["en attente", "confirmée", "expédiée", "livrée", "annulée"];

function auHasard(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
}

function identifiant() {
    return `WS-BAC-${crypto.randomBytes(4).toString("hex")}`;
}

// ── Création ─────────────────────────────────────────────────────────────

// LE PROPRIÉTAIRE D'UN ESPACE, C'EST SON EMAIL. Pas son identifiant. Toute la
// base est bâtie comme ça — workspaces.owner et workspaces.owner_email portent
// la même adresse (voir services/workspaceService.js), et c'est sur elle que
// joignent notify.js, gradeService.js et l'abonnement. Un bac à sable créé
// avec un UUID dans `owner` serait invisible à son propre auteur, et l'INSERT
// échouerait de toute façon : owner_email est NOT NULL. C'est exactement ce
// qui s'est passé en production.

// Un développeur n'a qu'un bac à sable par décor : le retrouver plutôt que
// d'en empiler dix au fil des essais.
async function existant(email, decor) {
    const rows = await db.query(
        `SELECT id, nom, metier FROM workspaces
          WHERE (owner = $1 OR owner_email = $1) AND est_bac_a_sable = TRUE AND bac_decor = $2 LIMIT 1`,
        [String(email), decor],
    );
    return rows[0] || null;
}

async function lister(email) {
    if (!email) return [];
    try {
        return await db.query(
            // Pas de created_at ici : la colonne n'existe pas sur tous les
            // environnements, et la liste n'en a pas besoin. Ne demander que
            // ce qu'on affiche évite de dépendre d'un schéma qu'on ne
            // maîtrise pas entièrement.
            `SELECT id, nom, metier, bac_decor FROM workspaces
              WHERE (owner = $1 OR owner_email = $1) AND est_bac_a_sable = TRUE ORDER BY id`,
            [String(email)],
        );
    } catch (err) {
        console.error("❌ bacASable.lister :", err.message);
        return [];
    }
}

async function creer(email, decorId = "boutique") {
    const decor = DECORS[decorId];
    if (!decor) throw new Error("Décor inconnu.");
    if (!email) throw new Error("Reconnecte-toi : ta session ne porte pas d'adresse email.");

    const deja = await existant(email, decorId);
    if (deja) return { workspaceId: deja.id, existant: true };

    const workspaceId = identifiant();
    await db.query(
        `INSERT INTO workspaces (id, nom, owner, owner_email, metier, pays, devise, palier_abonnement,
                                 est_bac_a_sable, bac_decor)
         VALUES ($1, $2, $3, $3, $4, 'DZ', 'DZD', 'pro', TRUE, $5)`,
        [workspaceId, decor.nom, String(email), decor.metier, decorId],
    );

    await remplir(workspaceId, decorId);
    return { workspaceId, existant: false };
}

// Le décor lui-même. Toutes les dates sont relatives à maintenant : un bac à
// sable créé il y a trois mois doit rester crédible aujourd'hui, sinon le
// développeur teste sur des rendez-vous tous passés.
async function remplir(workspaceId, decorId) {
    const decor = DECORS[decorId] || DECORS.boutique;

    if (decor.produits.length) {
        for (let i = 0; i < 14; i++) {
            const client = auHasard(decor.clients);
            // Des commandes à tous les stades : sans ça, un développeur qui
            // filtre par statut croit que son filtre est cassé.
            const statut = STATUTS_COMMANDE[i % STATUTS_COMMANDE.length];
            await db.query(
                `INSERT INTO commandes
                    (id, workspace_id, nom_client, telephone, adresse, produit, statut, source, montant, date_commande)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,'bac-a-sable',$8, NOW() - ($9 || ' days')::interval)`,
                [`BAC-${crypto.randomBytes(4).toString("hex")}`, workspaceId, client.nom, client.tel,
                 "12 rue des Frères Bouadou, Alger", auHasard(decor.produits), statut,
                 auHasard(decor.montants), String(i)],
            ).catch(() => {});
        }
    }

    const motifs = decor.motifs || ["Rendez-vous", "Retrait de commande", "Essayage"];
    for (let i = 0; i < 8; i++) {
        const client = auHasard(decor.clients);
        // Quatre passés, quatre à venir : les deux moitiés de l'agenda
        // doivent exister pour qu'un filtre de dates se teste vraiment.
        const jours = i < 4 ? -(i + 1) : (i - 3);
        await db.query(
            `INSERT INTO rendez_vous
                (workspace_id, client_nom, client_telephone, motif, date_rdv, statut, source)
             VALUES ($1,$2,$3,$4, NOW() + ($5 || ' days')::interval, $6, 'bac-a-sable')`,
            [workspaceId, client.nom, client.tel, auHasard(motifs), String(jours),
             i < 4 ? "termine" : (i % 2 ? "confirme" : "en_attente")],
        ).catch(() => {});
    }
}

// ── Remise à zéro et suppression ─────────────────────────────────────────

// Vider sans supprimer l'espace : le développeur garde sa clé et son URL de
// webhook, il ne reconfigure rien.
async function reinitialiser(email, workspaceId) {
    const bac = await verifierProprietaire(email, workspaceId);
    await db.query(`DELETE FROM commandes WHERE workspace_id = $1`, [workspaceId]).catch(() => {});
    await db.query(`DELETE FROM rendez_vous WHERE workspace_id = $1`, [workspaceId]).catch(() => {});
    await remplir(workspaceId, bac.bac_decor);
    return true;
}

async function supprimer(email, workspaceId) {
    await verifierProprietaire(email, workspaceId);
    await db.query(`DELETE FROM commandes WHERE workspace_id = $1`, [workspaceId]).catch(() => {});
    await db.query(`DELETE FROM rendez_vous WHERE workspace_id = $1`, [workspaceId]).catch(() => {});
    await db.query(`UPDATE api_cles SET actif = FALSE WHERE workspace_id = $1`, [workspaceId]).catch(() => {});
    await db.query(`DELETE FROM workspaces WHERE id = $1 AND est_bac_a_sable = TRUE`, [workspaceId]);
    return true;
}

// Toute opération passe par ici. Sans cette vérification, un identifiant
// d'espace deviné suffirait à vider les commandes d'un vrai marchand — la
// double condition (propriétaire ET bac à sable) rend ça impossible.
async function verifierProprietaire(email, workspaceId) {
    if (!email) throw new Error("Bac à sable introuvable.");
    const rows = await db.query(
        `SELECT id, bac_decor FROM workspaces
          WHERE id = $1 AND (owner = $2 OR owner_email = $2) AND est_bac_a_sable = TRUE`,
        [workspaceId, String(email)],
    );
    if (!rows[0]) throw new Error("Bac à sable introuvable.");
    return rows[0];
}

// ── La clé d'essai ───────────────────────────────────────────────────────
// Créée à la demande, avec toutes les portées : sur un décor sans conséquence,
// borner les droits n'apprend rien au développeur et lui fait perdre du temps.
// Ce sont les clés de production qui se limitent.
async function creerCle(email, workspaceId) {
    await verifierProprietaire(email, workspaceId);
    const portees = require("./portees").IDS;
    return apiPartenaire.creerCle(workspaceId, "Clé du bac à sable", portees);
}

module.exports = { DECORS, creer, lister, existant, reinitialiser, supprimer, creerCle };
