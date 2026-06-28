const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Configuration sécurisée de l'agent Sami
const samii = new Client({
    authStrategy: new LocalAuth({ clientId: "samii-business" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Génération du QR Code dans les logs
samii.on('qr', (qr) => {
    console.log('--- QR Code pour Samii ---');
    qrcode.generate(qr, { small: true });
});

// Confirmation de connexion
samii.on('ready', () => {
    console.log('Samii est connecté et opérationnel.');
});

// Gestion sécurisée des erreurs de connexion
samii.on('auth_failure', msg => {
    console.error('Erreur d\'authentification Samii :', msg);
});

// Réception des messages
samii.on('message', msg => {
    try {
        console.log('Message reçu de :', msg.from);
        // Ici, ton script pourra traiter le message sans bloquer le reste
    } catch (err) {
        console.error('Erreur lors de la réception du message :', err);
    }
});

// Fonction d'envoi sécurisée (pour ne pas faire planter Samii)
async function envoyerMessage(numero, texte) {
    try {
        if (!samii.info) throw new Error("Samii n'est pas encore connecté.");
        await samii.sendMessage(numero, texte);
        console.log('Message envoyé avec succès à', numero);
    } catch (err) {
        console.error('Erreur lors de l\'envoi par Samii :', err.message);
    }
}

// Lancement avec sécurité
samii.initialize().catch(err => {
    console.error('Erreur fatale au lancement de Samii :', err);
});
