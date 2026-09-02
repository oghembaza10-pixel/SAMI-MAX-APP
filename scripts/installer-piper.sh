#!/usr/bin/env bash
# ==========================================================================
# INSTALLER LA VOIX D'HOMME FRANÇAISE (Piper)
# ==========================================================================
#
# À lancer UNE FOIS, dans la « Build Command » de Render, à la suite de
# l'installation des paquets :
#
#     yarn install && bash scripts/installer-piper.sh
#
# Puis poser ces deux variables d'environnement sur le même service :
#
#     PIPER_BIN     = /opt/render/project/src/.piper/piper/piper
#     PIPER_MODELE  = /opt/render/project/src/.piper/fr_FR-tom-medium.onnx
#
# Sans ces deux variables, SAMII se comporte exactement comme avant : le
# service de voix se déclare indisponible et la chaîne retombe sur le
# navigateur. Rien ne casse si cette installation échoue.
#
# ── POURQUOI PAS DANS package.json ────────────────────────────────────────
#
# Un « postinstall » téléchargerait 100 Mo à chaque installation de
# dépendances, y compris chez quelqu'un qui n'a jamais demandé la voix. On
# le laisse explicite : celui qui l'installe sait ce qu'il installe.
#
# ── LICENCES, À VÉRIFIER AVANT USAGE COMMERCIAL ───────────────────────────
#
# Le MOTEUR : ce script prend le binaire de `rhasspy/piper`, sous licence
# MIT. Ce dépôt est ARCHIVÉ depuis août 2025 — il ne reçoit plus de
# correctifs. Son successeur vivant, `OHF-Voice/piper1-gpl`, est sous GPL,
# ce qui demande plus de précautions pour un produit fermé. C'est un
# arbitrage : on prend ici la version MIT, figée mais sans contrainte de
# licence. À reconsidérer si une faille est trouvée dans ce binaire.
#
# Dans les deux cas, SAMII appelle Piper comme un PROGRAMME SÉPARÉ (voir
# services/piper.js) et ne l'intègre pas à son code.
#
# La VOIX : chaque modèle a sa propre licence, indépendante de celle du
# moteur, héritée du jeu de données qui l'a entraîné. Celle de `fr_FR-tom`
# est à vérifier sur sa fiche Hugging Face avant tout usage commercial.
# Ce script ne peut pas le faire à ta place.

set -euo pipefail

DOSSIER="${PIPER_DOSSIER:-.piper}"
VOIX="${PIPER_VOIX:-fr_FR-tom-medium}"

# La voix par défaut, et les autres masculines françaises connues :
#   fr_FR-tom-medium     — le plus naturel, ~63 Mo
#   fr_FR-gilles-low     — plus léger, ~20 Mo, qualité moindre
# Pour en changer : PIPER_VOIX=fr_FR-gilles-low bash scripts/installer-piper.sh
case "$VOIX" in
    fr_FR-tom-medium)   CHEMIN="fr/fr_FR/tom/medium/$VOIX" ;;
    fr_FR-gilles-low)   CHEMIN="fr/fr_FR/gilles/low/$VOIX" ;;
    *) echo "❌ Voix inconnue : $VOIX (attendu fr_FR-tom-medium ou fr_FR-gilles-low)"; exit 1 ;;
esac

BINAIRE_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
VOIX_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/$CHEMIN"

mkdir -p "$DOSSIER"
cd "$DOSSIER"

if [ -x "piper/piper" ]; then
    echo "✅ Le moteur est déjà là."
else
    echo "⬇️  Moteur Piper…"
    curl -fsSL --retry 3 -o piper.tar.gz "$BINAIRE_URL"
    tar xzf piper.tar.gz
    rm -f piper.tar.gz
    chmod +x piper/piper
    echo "✅ Moteur installé."
fi

if [ -s "$VOIX.onnx" ] && [ -s "$VOIX.onnx.json" ]; then
    echo "✅ La voix $VOIX est déjà là."
else
    echo "⬇️  Voix $VOIX…"
    # Les deux fichiers sont indispensables : sans le .json, Piper démarre
    # puis échoue, ce qui est bien plus dur à diagnostiquer qu'une absence.
    curl -fsSL --retry 3 -o "$VOIX.onnx"      "$VOIX_URL.onnx"
    curl -fsSL --retry 3 -o "$VOIX.onnx.json" "$VOIX_URL.onnx.json"
    echo "✅ Voix installée."
fi

# ── ON NE DIT PAS « INSTALLÉ » SANS L'AVOIR ENTENDU ───────────────────────
#
# Deux fichiers présents ne prouvent pas qu'ils fonctionnent : un
# téléchargement tronqué laisse un fichier de la bonne taille apparente.
# On synthétise donc une phrase pour de vrai, et on vérifie qu'il en sort
# un son.
echo "🔎 Essai de synthèse…"
ESSAI="$(mktemp -d)/essai.wav"
echo "Bonjour, je suis SAMII." | ./piper/piper --model "$VOIX.onnx" --output_file "$ESSAI" 2>/dev/null || true

TAILLE=$(stat -c %s "$ESSAI" 2>/dev/null || echo 0)
if [ "$TAILLE" -lt 1000 ]; then
    echo "❌ Piper n'a produit aucun son ($TAILLE octets). NE POSE PAS les variables."
    exit 1
fi

RACINE="$(cd .. && pwd)/$DOSSIER"
echo ""
echo "✅ Piper parle — $TAILLE octets de son produits."
echo ""
echo "   Pose maintenant ces deux variables sur ce service Render :"
echo "     PIPER_BIN     = $RACINE/piper/piper"
echo "     PIPER_MODELE  = $RACINE/$VOIX.onnx"
echo ""
echo "   Puis vérifie sur /api/voix/piper/etat (fondateur seulement)."
