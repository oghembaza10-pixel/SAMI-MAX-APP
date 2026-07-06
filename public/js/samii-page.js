// ==========================================================================
// OG EMPIRE — SAMII : logique de la page de chat dédiée
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('samii-page-form');
    const input = document.getElementById('samii-page-input');
    const feed = document.getElementById('samii-page-feed');

    if (!form || !input || !feed) return;

    function addMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `samii-msg samii-msg--${role}`;

        const bubble = document.createElement('div');
        bubble.className = 'samii-msg__bubble';
        bubble.textContent = text;

        wrapper.appendChild(bubble);
        feed.appendChild(wrapper);
        feed.scrollTop = feed.scrollHeight;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (!message) return;

        addMessage('user', message);
        input.value = '';

        // Petit indicateur "SAMII écrit..." pendant l'attente de la réponse
        const typingEl = document.createElement('div');
        typingEl.className = 'samii-msg samii-msg--bot';
        typingEl.innerHTML = '<div class="samii-msg__bubble">…</div>';
        feed.appendChild(typingEl);
        feed.scrollTop = feed.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await res.json();
            typingEl.remove();
            addMessage('bot', data.reply || "Je n'ai pas de réponse pour l'instant.");
        } catch (err) {
            console.error(err);
            typingEl.remove();
            addMessage('bot', 'SAMII démarre actuellement. Réessaie dans quelques instants.');
        }
    });

});
