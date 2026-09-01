// ==========================================================================
// SAMII OS — LE CANAL WHATSAPP OFFICIEL (Meta Cloud API)
//
// « Maintenant qu'on a Meta API, on n'a pas besoin de Green API. On a SAMII
// API. Je veux que tout le monde utilise cette API de Meta. »
//
// UN SEUL NUMÉRO POUR TOUTE LA PLATEFORME. Ça règle beaucoup de choses — un
// numéro vérifié, des modèles approuvés, une vraie délivrabilité — et ça en
// casse deux, que Green API réglait sans qu'on y pense parce que là-bas le
// téléphone du marchand répondait tout seul :
//
//   1. À QUI PARLE-T-ON ? Le message arrive nu. Rien dedans ne dit à quelle
//      boutique le client s'adresse.
//   2. A-T-ON LE DROIT DE PARLER ? WhatsApp n'autorise le texte libre que
//      dans les 24 h qui suivent le dernier message DU CLIENT.
//
// Ce fichier répond aux deux, et il est le SEUL endroit où ces deux
// questions se posent. Ailleurs dans le code, on dit « envoie ça à ce
// client » et on ne se demande ni quelle heure il est ni quelle boutique
// c'est. Une règle appliquée à trente endroits est une règle qu'on oubliera
// au trente et unième — et l'oubli, ici, c'est soit un message qui n'arrive
// jamais, soit un modèle facturé pour rien.
// ==========================================================================
const db = require("./db");
const CONFIG = require("../config");
const fournisseurs = require("./whatsappFournisseurs");

const FENETRE_MS = 24 * 60 * 60 * 1000;

// Le canal officiel, tel qu'il est posé sur Render. Pas de repli codé en
// dur : un numéro d'envoi qui se replie en silence sur une valeur écrite
// dans le code, c'est SAMII qui parle depuis un numéro que personne n'a
// choisi. Mieux vaut ne rien envoyer et le dire.
function canalOfficiel() {
    const c = CONFIG.META?.WHATSAPP_CLOUD || {};
    if (!c.TOKEN || !c.PHONE_NUMBER_ID) return null;
    return { fournisseur: "cloud", token: c.TOKEN, phoneNumberId: c.PHONE_NUMBER_ID };
}

function estConfigure() {
    return Boolean(canalOfficiel());
}

// Meta rend les numéros sans « + » ni espaces. On range tout sous la même
// forme, sinon le même client crée deux lignes et perd sa fenêtre de 24 h à
// chaque fois qu'il change de format.
function normaliser(numero) {
    return String(numero || "").replace(/[^\d]/g, "");
}

// ── LE CODE DE BOUTIQUE ──────────────────────────────────────────────────
//
// Le lien « Contacter la boutique » ouvre WhatsApp avec un texte déjà écrit
// qui porte ce code entre crochets. Le client n'a qu'à appuyer sur envoyer.
//
// Les crochets ne sont pas décoratifs : sans délimiteur, il faudrait deviner
// où le code commence dans une phrase que le client peut avoir modifiée —
// et beaucoup ajoutent un mot avant d'envoyer.
const MARQUE = /\[([A-Z0-9][A-Z0-9-]{2,23})\]/;

function codeDe(texte) {
    const m = MARQUE.exec(String(texte || "").toUpperCase());
    return m ? m[1] : null;
}

// Le code EST l'identifiant de l'espace de travail, en majuscules. Pas de
// table de correspondance à tenir à jour : une boutique renommée garde son
// lien, et un code inventé ne tombe sur rien.
function lienContact(workspaceId, nomBoutique = "") {
    const numero = String(CONFIG.META?.WHATSAPP_CLOUD?.NUMERO || CONFIG.WHATSAPP?.NUMBER || "").replace(/[^\d]/g, "");
    const code = String(workspaceId || "").toUpperCase();
    const texte = `Bonjour, je viens de ${nomBoutique || "votre boutique"} [${code}]`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}

// ── LE CARNET ────────────────────────────────────────────────────────────

async function contact(numero) {
    const n = normaliser(numero);
    if (!n) return null;
    try {
        const rows = await db.query(`SELECT * FROM whatsapp_contacts WHERE numero = $1`, [n]);
        return rows[0] || null;
    } catch (err) {
        console.warn("⚠️ WhatsApp contact :", err.message);
        return null;
    }
}

// Appelée à CHAQUE message entrant. Elle fait trois choses d'un coup :
// elle note l'heure (c'est elle qui rouvre la fenêtre de 24 h), elle retient
// la boutique si le message en porte le code, et elle garde le nom du client.
//
// COALESCE sur workspace_id : un client qui écrit une deuxième fois sans
// remettre le code ne doit pas perdre la boutique qu'on connaissait déjà.
// C'est tout l'intérêt de se souvenir — sinon SAMII redemanderait sans fin.
async function noterEntrant({ numero, texte, nom }) {
    const n = normaliser(numero);
    if (!n) return null;
    const code = codeDe(texte);
    try {
        const rows = await db.query(
            `INSERT INTO whatsapp_contacts (numero, workspace_id, nom_client, dernier_entrant)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (numero) DO UPDATE SET
                 workspace_id    = COALESCE($2, whatsapp_contacts.workspace_id),
                 nom_client      = COALESCE(NULLIF($3, ''), whatsapp_contacts.nom_client),
                 dernier_entrant = now()
             RETURNING *`,
            [n, code, String(nom || "").slice(0, 120)],
        );
        return rows[0] || null;
    } catch (err) {
        console.warn("⚠️ WhatsApp noterEntrant :", err.message);
        return null;
    }
}

async function noterSortant(numero) {
    const n = normaliser(numero);
    if (!n) return;
    try {
        await db.query(
            `INSERT INTO whatsapp_contacts (numero, dernier_sortant) VALUES ($1, now())
             ON CONFLICT (numero) DO UPDATE SET dernier_sortant = now()`,
            [n],
        );
    } catch (err) {
        console.warn("⚠️ WhatsApp noterSortant :", err.message);
    }
}

// ── LA FENÊTRE DES 24 HEURES ─────────────────────────────────────────────
//
// Ouverte : on peut écrire ce qu'on veut, gratuitement, et SAMII répond
// normalement — c'est ce qu'il fait déjà.
// Fermée : seul un modèle approuvé passe, et il se facture.
//
// En cas de doute (base injoignable), on répond FERMÉE. Se tromper dans ce
// sens envoie un modèle payant à quelqu'un qu'on aurait pu joindre
// gratuitement ; se tromper dans l'autre envoie un texte libre que WhatsApp
// jette en silence — le client n'a rien, et personne ne le sait.
async function fenetreOuverte(numero) {
    const c = await contact(numero);
    if (!c?.dernier_entrant) return false;
    return (Date.now() - new Date(c.dernier_entrant).getTime()) < FENETRE_MS;
}

// ── LE SEUL POINT D'ENTRÉE POUR ÉCRIRE À UN CLIENT ───────────────────────
//
// L'appelant dit ce qu'il veut dire, et donne le modèle à utiliser si la
// fenêtre est fermée. C'est ici, et nulle part ailleurs, qu'on décide lequel
// des deux part.
//
// Sans modèle fourni et fenêtre fermée, on ne tente RIEN : un texte libre
// hors fenêtre est accepté par l'API puis jeté par WhatsApp. L'appel réussit,
// le message n'arrive pas. C'est la panne la plus trompeuse du lot — mieux
// vaut un échec franc qui dit pourquoi.
async function ecrire({ to, texte, modele }) {
    const canal = canalOfficiel();
    if (!canal) return { success: false, error: "Le canal WhatsApp officiel n'est pas configuré (token ou numéro manquant)." };

    const ouverte = await fenetreOuverte(to);

    if (ouverte && texte) {
        const r = await fournisseurs.envoyer(canal, { to, message: texte });
        if (r.success) await noterSortant(to);
        return { ...r, voie: "texte" };
    }

    if (!modele?.nom) {
        return {
            success: false,
            voie: "aucune",
            error: "Fenêtre de 24 h fermée et aucun modèle fourni : WhatsApp rejetterait un texte libre sans le dire.",
        };
    }

    const r = await fournisseurs.envoyerModele(canal, {
        to,
        nom: modele.nom,
        langue: modele.langue || "fr",
        variables: modele.variables || [],
        variablesBouton: modele.variablesBouton || [],
        replide: texte || "",
    });
    if (r.success) await noterSortant(to);
    return { ...r, voie: "modele" };
}

module.exports = {
    estConfigure,
    canalOfficiel,
    normaliser,
    codeDe,
    lienContact,
    contact,
    noterEntrant,
    noterSortant,
    fenetreOuverte,
    ecrire,
    FENETRE_MS,
};
