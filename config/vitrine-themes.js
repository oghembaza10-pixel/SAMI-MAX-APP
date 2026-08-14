// ==========================================================================
// SAMII OS — PALETTES DE LA VITRINE PUBLIQUE (boutique d'un marchand)
// Variables CSS appliquées sur la page /vitrine/:userId. Choisies par le
// marchand dans Réglages > Ma boutique (utilisateurs.vitrine_theme).
// ==========================================================================
const THEMES = {
    signature: {
        label: "Signature (noir/or)",
        vars: {
            "--bg": "#03060b", "--panel": "rgba(9,18,29,.88)", "--text": "#f5fbff",
            "--muted": "#7f96a8", "--blue": "#00d9ff", "--blue-2": "#0077ff",
            "--gold": "#d7b34c", "--border": "rgba(0,217,255,.16)",
        },
    },
    "bleu-tech": {
        label: "Bleu Tech",
        vars: {
            "--bg": "#020a14", "--panel": "rgba(6,24,38,.9)", "--text": "#eaf6ff",
            "--muted": "#6f8aa3", "--blue": "#00e5ff", "--blue-2": "#0066ff",
            "--gold": "#5fd4ff", "--border": "rgba(0,229,255,.18)",
        },
    },
    minimal: {
        label: "Minimaliste (clair)",
        vars: {
            "--bg": "#f5f6f8", "--panel": "#ffffff", "--text": "#0b0d10",
            "--muted": "#5b6472", "--blue": "#0077ff", "--blue-2": "#0055cc",
            "--gold": "#c9971f", "--border": "rgba(0,0,0,.1)",
        },
    },
    vibrant: {
        label: "Vibrant",
        vars: {
            "--bg": "#120a1e", "--panel": "rgba(35,16,52,.9)", "--text": "#fdf3ff",
            "--muted": "#b48fc9", "--blue": "#ff6b9d", "--blue-2": "#ff9a3d",
            "--gold": "#ffd23f", "--border": "rgba(255,107,157,.2)",
        },
    },
};

function getTheme(id) {
    return THEMES[id] || THEMES.signature;
}

function cssVarsString(id) {
    const theme = getTheme(id);
    return Object.entries(theme.vars).map(([k, v]) => `${k}:${v};`).join(" ");
}

module.exports = { THEMES, getTheme, cssVarsString };
