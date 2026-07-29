// ==========================================================================
// OG EMPIRE — SAMII : logique de la page de chat dédiée (V2 : voix + photo)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const form   = document.getElementById('samii-page-form');
    const input  = document.getElementById('samii-page-input');
    const feed   = document.getElementById('samii-page-feed');
    const micBtn = document.getElementById('samii-mic-btn');
    const photoBtn   = document.getElementById('samii-photo-btn');
    const photoInput = document.getElementById('samii-photo-input');

    if (!form || !input || !feed) return;

    function addMessage(role, text, imageUrl) {
        const wrapper = document.createElement('div');
        wrapper.className = `samii-msg samii-msg--${role}`;

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.cssText = 'max-width:200px;border-radius:10px;margin-bottom:6px;display:block;';
            wrapper.appendChild(img);
        }

        const bubble = document.createElement('div');
        bubble.className = 'samii-msg__bubble';
        bubble.textContent = text;
        wrapper.appendChild(bubble);

        feed.appendChild(wrapper);
        feed.scrollTop = feed.scrollHeight;
    }

    function speak(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = document.documentElement.lang === 'ar' ? 'ar-SA' : 'fr-FR';
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
    }

    async function sendMessage(message, imageBase64) {
        if (!message && !imageBase64) return;

        addMessage('user', message || '📷 Photo envoyée', imageBase64);
        input.value = '';

        const typingEl = document.createElement('div');
        typingEl.className = 'samii-msg samii-msg--bot';
        typingEl.innerHTML = '<div class="samii-msg__bubble">…</div>';
        feed.appendChild(typingEl);
        feed.scrollTop = feed.scrollHeight;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, image: imageBase64 || null }),
            });
            const data = await res.json();
            typingEl.remove();
            const reply = data.reply || "Je n'ai pas de réponse pour l'instant.";
            addMessage('bot', reply);
            speak(reply);
        } catch (err) {
            console.error(err);
            typingEl.remove();
            const errMsg = 'SAMII démarre actuellement. Réessaie dans quelques instants.';
            addMessage('bot', errMsg);
            speak(errMsg);
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (message) sendMessage(message);
    });

    if (micBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            micBtn.style.display = 'none';
        } else {
            const recognition = new SpeechRecognition();
            recognition.lang = document.documentElement.lang === 'ar' ? 'ar-SA' : 'fr-FR';
            recognition.interimResults = false;
            let listening = false;

            micBtn.addEventListener('click', () => {
                if (listening) {
                    recognition.stop();
                    return;
                }
                recognition.start();
            });

            recognition.addEventListener('start', () => {
                listening = true;
                micBtn.classList.add('samii-mic-btn--active');
            });

            recognition.addEventListener('end', () => {
                listening = false;
                micBtn.classList.remove('samii-mic-btn--active');
            });

            recognition.addEventListener('result', (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript);
            });

            recognition.addEventListener('error', (event) => {
                console.error('❌ Reconnaissance vocale :', event.error);
                listening = false;
                micBtn.classList.remove('samii-mic-btn--active');
            });
        }
    }

    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => photoInput.click());

        photoInput.addEventListener('change', () => {
            const file = photoInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result;
                sendMessage(input.value.trim() || "Que vois-tu sur cette image ?", base64);
                input.value = '';
            };
            reader.readAsDataURL(file);
            photoInput.value = '';
        });
    }
});
