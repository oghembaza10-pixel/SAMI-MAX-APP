// ==========================================================================
// SONDER CLOUDINARY — POURQUOI UNE VIDÉO NE PART PLUS
// ==========================================================================
//
//     node scripts/sonder-cloudinary.js
//
// La communauté envoie ses photos et vidéos DIRECTEMENT du navigateur vers
// Cloudinary, avec un préréglage non signé. Le serveur ne voit jamais le
// fichier : il ne reçoit que l'URL, à la fin. Donc quand un envoi échoue,
// il n'y a RIEN dans les journaux de Render — l'échec se produit entre le
// navigateur et Cloudinary, et le seul message est un « Échec de l'envoi »
// affiché à l'écran.
//
// Cette sonde refait EXACTEMENT le même appel que le navigateur : même
// adresse, même préréglage, même type de ressource. Elle envoie deux
// fichiers minuscules — une image d'un pixel et une vidéo d'une seconde —
// et affiche la réponse de Cloudinary telle quelle.
//
// Envoyer les DEUX est le cœur de la sonde : si l'image passe et que la
// vidéo échoue, le problème est propre à la vidéo (préréglage, quota
// vidéo). Si les deux échouent, c'est le compte entier. Un seul essai
// n'aurait pas permis de trancher.
//
// Elle n'écrit rien dans SAMII. Les deux fichiers de contrôle atterrissent
// dans le compte Cloudinary — leurs identifiants sont affichés pour que tu
// puisses les supprimer.

const CLOUD = process.env.CLOUDINARY_CLOUD || "ojwx5hft";
const PRESET = process.env.CLOUDINARY_PRESET || "MARKETPLACE OG";

// Une image GIF de 1 pixel et une vidéo MP4 noire d'une seconde, en dur :
// la sonde ne dépend d'aucun fichier ni d'ffmpeg sur la machine.
const IMAGE_1PX = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const VIDEO_1S  = "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";

async function envoyer(type, base64, nom) {
    const donnees = new FormData();
    donnees.append("file", `data:${type === "video" ? "video/mp4" : "image/gif"};base64,${base64}`);
    donnees.append("upload_preset", PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/${type}/upload`;
    const debut = Date.now();
    try {
        const r = await fetch(url, { method: "POST", body: donnees });
        const corps = await r.json().catch(() => ({}));
        return { ok: r.ok && !!corps.secure_url, statut: r.status, ms: Date.now() - debut, corps };
    } catch (err) {
        return { ok: false, statut: 0, ms: Date.now() - debut, corps: { error: { message: err.message } } };
    }
}

(async () => {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   CLOUDINARY — le même appel que fait le navigateur           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log(`   compte      ${CLOUD}`);
    console.log(`   préréglage  « ${PRESET} »\n`);

    for (const [type, donnee, quoi] of [
        ["image", IMAGE_1PX, "une image de 1 pixel"],
        ["video", VIDEO_1S,  "une vidéo noire d'une seconde (2 Ko)"],
    ]) {
        console.log(`━━━ ${type.toUpperCase()} — ${quoi}`);
        const r = await envoyer(type, donnee);
        if (r.ok) {
            console.log(`   ✅ acceptée en ${r.ms} ms`);
            console.log(`   identifiant : ${r.corps.public_id}   (à supprimer si tu veux)`);
            console.log(`   URL         : ${r.corps.secure_url}`);
        } else {
            console.log(`   ❌ REFUSÉE — HTTP ${r.statut} en ${r.ms} ms`);
            const detail = r.corps?.error?.message || JSON.stringify(r.corps);
            console.log(`   réponse : ${detail.slice(0, 300)}`);
            // NE PAS CONFONDRE UN REFUS DE CLOUDINARY AVEC UN RÉSEAU FERMÉ.
            // Un 403 dont le corps est VIDE ne vient pas de Cloudinary : il
            // vient d'un intermédiaire réseau qui a refusé la connexion.
            // Cloudinary, lui, explique toujours ("Upload preset not found",
            // "Invalid upload preset", "resource type not allowed"...).
            // Sans cette distinction, on cherche un quota alors qu'on n'est
            // simplement jamais sorti de la machine.
            if (r.statut === 403 && detail === "{}") {
                console.log("   ⚠️ corps VIDE : ce refus vient d'un intermédiaire réseau,");
                console.log("      PAS de Cloudinary. Relance depuis le Shell Render.");
            }
        }
        console.log("");
    }

    console.log("   → Si l'image passe et pas la vidéo : le préréglage ou le quota");
    console.log("     vidéo est en cause, pas le compte.");
    console.log("   → Si les deux échouent : c'est le compte Cloudinary lui-même");
    console.log("     (quota mensuel épuisé, préréglage renommé ou désactivé).\n");
    process.exit(0);
})();
