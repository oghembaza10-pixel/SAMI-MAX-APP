// ==========================================================================
// SAMII OS — L'ENVELOPPE DE TOUS NOS EMAILS
//
// POURQUOI. Un email de confirmation, c'est souvent la PREMIÈRE chose qu'un
// client voit de nous — avant même le produit. Les nôtres étaient cinq lignes
// d'Arial sur fond blanc : rien qui ressemble à la marque, rien qui rassure,
// rien qui donne envie de cliquer. Une seule enveloppe ici, utilisée par tous
// les envois, et on ne peut plus en oublier un au moment d'une refonte.
//
// LES RÈGLES DU MAIL, QUI NE SONT PAS CELLES DU WEB. Ce fichier a l'air
// vieillot exprès :
//   • tableaux et non flexbox/grid — Outlook rend encore via Word ;
//   • styles en ligne uniquement — Gmail coupe une partie des <style> ;
//   • aucune police externe — les polices web ne se chargent pas partout, on
//     s'appuie sur les serif système, qui donnent déjà le ton ;
//   • largeur 600 px, la seule qui passe partout ;
//   • bouton en VML pour Outlook, sinon il perd le fond et devient invisible ;
//   • toujours un lien de repli sous le bouton — un client sur dix bloque les
//     boutons, et un email d'activation qu'on ne peut pas ouvrir est un client
//     perdu au premier jour ;
//   • une ligne de pré-en-tête cachée : c'est le texte gris affiché à côté de
//     l'objet dans la boîte de réception. Sans elle, le client lit le début du
//     code HTML. C'est le détail qui sépare un email pro d'un email bricolé.
//
// Le fond est sombre et l'accent doré, comme le reste de la marque, mais posé
// sur un fond neutre : un email tout noir se retourne mal dans les clients qui
// forcent leur propre mode sombre.
// ==========================================================================

const OR = "#c9a961";
const OR_CLAIR = "#f0d99b";
const ENCRE = "#0a0a0c";
const PANNEAU = "#131316";
const IVOIRE = "#f3f1e9";
const GRIS = "#8b8d95";
const BORDURE = "rgba(201,169,97,0.22)";

const SERIF = "'Didot','Bodoni MT','Playfair Display',Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const SITE = process.env.APP_URL || "https://samii.souverain-store.com";
const CONTACT = "info@souverain-store.com";

function echapper(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

// Bouton « à toute épreuve » : le VML n'est lu que par Outlook, les autres
// clients l'ignorent grâce aux commentaires conditionnels et affichent le <a>.
function bouton(url, libelle) {
    if (!url || !libelle) return "";
    const u = echapper(url);
    return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr><td align="center" bgcolor="${OR}" style="border-radius:4px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${u}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="8%" stroke="f" fillcolor="${OR}">
                    <w:anchorlock/><center style="color:${ENCRE};font-family:${SANS};font-size:14px;font-weight:bold;">${echapper(libelle)}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-- -->
                  <a href="${u}" target="_blank" rel="noopener"
                     style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:14px;font-weight:600;
                            letter-spacing:.04em;color:${ENCRE};text-decoration:none;border-radius:4px;background:${OR};">
                    ${echapper(libelle)}
                  </a>
                  <!--<![endif]-->
                </td></tr>
              </table>`;
}

/**
 * Fabrique le HTML complet d'un email.
 *
 * @param {string}  titre       Le titre affiché en haut du message.
 * @param {string}  preheader   Le texte gris à côté de l'objet dans la boîte
 *                              de réception. Écris-le : c'est lui qui décide
 *                              si le mail est ouvert.
 * @param {string}  corps       HTML du message (paragraphes déjà échappés).
 * @param {object}  cta         { url, libelle } — bouton principal, optionnel.
 * @param {string}  note        Petite ligne grise sous le bouton (expiration,
 *                              « ce n'est pas vous ? »…). Optionnel.
 * @param {boolean} lienDeRepli Affiche l'URL en clair sous le bouton (vrai par
 *                              défaut dès qu'il y a un bouton).
 */
function construire({ titre, preheader = "", corps = "", cta = null, note = "", lienDeRepli = true }) {
    const url = cta?.url || "";
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${echapper(titre)}</title>
</head>
<body style="margin:0;padding:0;background:#ececed;">
<!-- Pré-en-tête : lu par la boîte de réception, jamais affiché dans le mail.
     Les caractères invisibles qui suivent empêchent le client d'aller
     chercher la suite du texte dans le corps du message. -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ececed;">
  ${echapper(preheader)}&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ececed;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:100%;background:${ENCRE};border-radius:6px;overflow:hidden;">

        <!-- Filet doré : la signature de la marque, en une ligne de 3 px -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${OR};">&nbsp;</td></tr>

        <tr>
          <td align="center" style="padding:38px 40px 8px;">
            <div style="font-family:${SERIF};font-size:13px;letter-spacing:.42em;text-indent:.42em;
                        text-transform:uppercase;color:${OR};">OG&nbsp;Technology</div>
            <div style="font-family:${SANS};font-size:10px;letter-spacing:.28em;text-indent:.28em;
                        text-transform:uppercase;color:${GRIS};padding-top:7px;">SAMII&nbsp;OS</div>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 40px 0;">
            <h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:27px;line-height:1.3;color:${IVOIRE};">
              ${echapper(titre)}
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 0;font-family:${SANS};font-size:15px;line-height:1.72;color:#c8cad1;">
            ${corps}
          </td>
        </tr>

        ${url ? `<tr><td align="center" style="padding:32px 40px 0;">${bouton(url, cta.libelle)}</td></tr>` : ""}

        ${url && lienDeRepli ? `
        <tr>
          <td align="center" style="padding:20px 40px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${GRIS};">
            Le bouton ne s'affiche pas ? Copie ce lien dans ton navigateur :<br />
            <a href="${echapper(url)}" style="color:${OR_CLAIR};word-break:break-all;text-decoration:underline;">${echapper(url)}</a>
          </td>
        </tr>` : ""}

        ${note ? `
        <tr>
          <td align="center" style="padding:22px 40px 0;font-family:${SANS};font-size:12px;line-height:1.65;color:${GRIS};">
            ${note}
          </td>
        </tr>` : ""}

        <tr><td style="padding:34px 40px 0;"><div style="height:1px;background:${BORDURE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

        <tr>
          <td align="center" style="padding:20px 40px 36px;font-family:${SANS};font-size:11px;line-height:1.75;color:#6c6e77;">
            <a href="${SITE}" style="color:${GRIS};text-decoration:none;">samii.souverain-store.com</a>
            &nbsp;·&nbsp;
            <a href="mailto:${CONTACT}" style="color:${GRIS};text-decoration:none;">${CONTACT}</a>
            <br />
            OG Technology — SAMII OS
          </td>
        </tr>

      </table>

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
        <tr>
          <td align="center" style="padding:16px 24px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#9a9ca3;">
            Tu reçois cet email parce que tu as un compte SAMII OS.
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

// Paragraphe prêt à poser dans `corps`. Le HTML passé ici doit déjà être sûr :
// utilise echapper() sur tout ce qui vient d'un utilisateur.
function p(html) {
    return `<p style="margin:0 0 14px;">${html}</p>`;
}

module.exports = { construire, p, echapper, COULEURS: { OR, OR_CLAIR, ENCRE, PANNEAU, IVOIRE, GRIS } };
