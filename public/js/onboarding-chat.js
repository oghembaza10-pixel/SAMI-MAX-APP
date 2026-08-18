// ==========================================================================
// SAMII OS — Onboarding conversationnel : créer son QG en parlant à Sami
// (au lieu du formulaire classique /workspace/create, toujours dispo en repli)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('onboarding-chat-overlay');
    const feed = document.getElementById('onboarding-chat-feed');
    const form = document.getElementById('onboarding-chat-form');
    const input = document.getElementById('onboarding-chat-input');
    const closeBtn = document.getElementById('onboarding-chat-close');
    if (!overlay || !feed || !form || !input) return;

    let history = [];
    let enCours = false;

    function addBubble(role, text) {
        const el = document.createElement('div');
        el.className = `onboarding-chat-msg onboarding-chat-msg--${role}`;
        el.textContent = text;
        feed.appendChild(el);
        feed.scrollTop = feed.scrollHeight;
        return el;
    }

    function open() {
        overlay.classList.add('open');
        if (!feed.children.length) {
            addBubble('bot', "Salut 👋 Comment tu veux appeler ton activité ?");
        }
        setTimeout(() => input.focus(), 100);
    }

    function close() {
        overlay.classList.remove('open');
    }

    window.openOnboardingChat = open;

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texte = input.value.trim();
        if (!texte || enCours) return;

        addBubble('user', texte);
        history.push({ role: 'user', message: texte });
        input.value = '';
        enCours = true;

        const typing = addBubble('typing', 'Sami écrit...');

        try {
            const res = await fetch('/workspace/onboarding-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: texte, history }),
            });
            const data = await res.json();
            typing.remove();

            if (!data.success) {
                addBubble('bot', data.error || "Un souci, réessaie.");
                enCours = false;
                return;
            }

            addBubble('bot', data.reply);
            history.push({ role: 'model', message: data.reply });

            if (data.redirect) {
                setTimeout(() => { window.location.href = data.redirect; }, 900);
                return;
            }
        } catch (err) {
            typing.remove();
            addBubble('bot', "Erreur réseau, réessaie.");
        }
        enCours = false;
        input.focus();
    });
});
