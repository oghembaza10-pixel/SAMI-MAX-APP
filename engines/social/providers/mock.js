// ==========================================================================
// LE PROVIDER DE SIMULATION — CELUI QUI TOURNE AUJOURD'HUI
// ==========================================================================
//
// « Pour l'instant utiliser des MOCKS. AUCUNE publication réelle. »
//
// Tant que `SOCIAL_PUBLICATION_REELLE` n'est pas explicitement à "oui",
// c'est CE provider qui traite tout — y compris Facebook et Telegram, qui
// sont pourtant réellement branchés. C'est voulu : la bascule est une
// décision, pas un effet de bord d'un déploiement.
//
// ── UN MOCK QUI DIT TOUJOURS OUI NE PROUVE RIEN ───────────────────────────
//
// Une simulation qui réussit à tous les coups laisse croire que le chemin
// d'échec fonctionne, alors qu'il n'a jamais été emprunté. Ce provider sait
// donc échouer sur demande :
//
//     texte contenant "ECHEC_SIMULE"  → il rate
//     SOCIAL_MOCK_ECHEC=instagram     → Instagram rate, les autres passent
//
// C'est ce qui permet aux tests de vérifier le nouvel essai, le statut
// `failed`, et le fait qu'une plateforme en panne n'arrête pas les autres.

const crypto = require("crypto");

// Ce qu'on a « publié », gardé en mémoire pour que les tests puissent le
// relire. Volontairement PAS en base : une simulation ne doit rien laisser
// derrière elle qui ressemble à une vraie publication.
const journal = [];

function echecDemande(plateforme, texte) {
    if (String(texte || "").includes("ECHEC_SIMULE")) return "échec demandé par le texte";
    const coupees = String(process.env.SOCIAL_MOCK_ECHEC || "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (coupees.includes(String(plateforme).toLowerCase())) {
        return `échec demandé par SOCIAL_MOCK_ECHEC pour ${plateforme}`;
    }
    return null;
}

async function publier({ plateforme, texte, media, mediaType }) {
    const raison = echecDemande(plateforme, texte);
    if (raison) {
        journal.push({ plateforme, ok: false, raison, le: new Date().toISOString() });
        return { ok: false, erreur: raison };
    }

    // Un identifiant qui RESSEMBLE à un vrai mais qu'on ne peut pas
    // confondre : le préfixe dit ce que c'est. Une ligne de
    // `social_publications` portant `sim_…` ne sera jamais prise pour une
    // vraie publication, ni par un humain ni par l'agent d'analyse.
    const id = "sim_" + crypto.randomBytes(6).toString("hex");
    journal.push({
        plateforme, ok: true, id,
        longueur: String(texte || "").length,
        media: media ? mediaType || "media" : null,
        le: new Date().toISOString(),
    });
    return { ok: true, id, url: `simulation://${plateforme}/${id}` };
}

module.exports = {
    nom: "mock",
    // Il ne s'enregistre POUR aucune plateforme : il n'est jamais choisi par
    // le registre, seulement par la bascule de simulation. S'il apparaissait
    // dans `PROVIDERS`, il pourrait masquer un vrai provider par accident.
    plateformes: [],
    publier,
    // Pour les tests, et pour l'écran d'état : ce qui a été « publié ».
    journal,
    vider: () => { journal.length = 0; },
};
