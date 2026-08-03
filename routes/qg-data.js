/**
 * SAMII OS - Route Backend QG Data
 * Architecture Table Mère & Tables Filles - Zéro usine à gaz.
 */

const express = require('express');
const router = express.Router();

router.get('/qg-data', async (req, res) => {
    try {
        const shop = req.query.shop || '';

        // TODO: Remplacer par tes requêtes réelles vers la Table Mère / Base de données
        // Exemple de structure de données consolidée pour le QG marchand :

        const workspaceData = {
            nom: shop ? `Boutique ${shop}` : 'Empire Bondrol OG'
        };

        // Données brutes des commandes (filtrées ou globales)
        const commandesData = [
            {
                'ID Commande': '1001',
                'Nom Client': 'Karim B.',
                'Téléphone': '0550000000',
                'Produit': 'Montre The Sovereign - Or Noir',
                'montant': 25000,
                'Devise': 'DZD',
                'Statut': 'confirmée',
                'Source': 'shopify'
            },
            {
                'ID Commande': '1002',
                'Nom Client': 'Amine M.',
                'Téléphone': '0660000000',
                'Produit': 'Coffret Bracelet Édition Limitée',
                'montant': 12000,
                'Devise': 'DZD',
                'Statut': 'en attente',
                'Source': 'telegram'
            }
        ];

        // Données des clients (VIP, Blacklist, etc.)
        const clientsData = [
            {
                'Nom': 'Karim B.',
                'Téléphone': '0550000000',
                'Total Dépensé': 25000,
                'VIP': true,
                'Blacklist': false,
                'Source': 'shopify'
            }
        ];

        // Métriques de livraison globales
        const livraisonData = {
            livrees: 42,
            en_cours: 5,
            echecs: 1
        };

        // Mission du jour
        const missionData = {
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
            commandes: 7,
            revenus: 37000
        };

        // Performance du mois
        const performanceData = {
            revenus_mois: 450000,
            commandes_mois: 85,
            evolution: '+18% vs mois dernier'
        };

        // Statistiques globales de base
        const statsData = {
            total_commandes: commandesData.length
        };

        return res.status(200).json({
            success: true,
            workspace: workspaceData,
            commandes: commandesData,
            clients: clientsData,
            livraison: livraisonData,
            mission: missionData,
            performance: performanceData,
            stats: statsData
        });

    } catch (error) {
        console.error('❌ Erreur critique route /qg-data :', error.message);
        return res.status(500).json({
            success: false,
            error: 'Erreur interne du serveur QG.'
        });
    }
});

module.exports = router;
