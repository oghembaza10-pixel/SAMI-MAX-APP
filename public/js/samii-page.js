// ==========================================================================
// OG EMPIRE — SAMII : logique de la page de chat dédiée (V3 : voix + fichiers)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const form        = document.getElementById('samii-page-form');
    const input        = document.getElementById('samii-page-input');
    const feed         = document.getElementById('samii-page-feed');
    const micBtn       = document.getElementById('samii-mic-btn');
    const langSelect   = document.getElementById('samii-lang-select');
    const attachBtn    = document.getElementById('samii-attach-btn');
    const attachMenu   = document.getElementById('samii-attach-menu');
    const photoInput   = document.getElementById('samii-photo-input');
    const docInput     = document.getElementById('samii-doc-input');
    const attachPreview = document.getElementById('samii-attach-preview');

    if (!form || !input || !feed) return;

    let pendingAttachment = null; // { type: 'image'|'document', data, name }

    // ── TOAST discret (remplace les alert()) ─────────────
    function toast(text) {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = `
            position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
            background:var(--bg-panel); border:1px solid rgba(95,212,255,0.3);
            color:#fff; padding:10px 18px; border-radius:20px; font-size:.82rem;
            z-index:999; opacity:0; transition:opacity .3s ease;
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2500);
    }

    // ── MESSAGES ──────────────────────────────────────────
    function addMessage(role, text, imageUrl, fileLabel) {
        const wrapper = document.createElement('div');
        wrapper.className = `samii-msg samii-msg--${role}`;

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.cssText = 'max-width:220px;border-radius:12px;margin-bottom:6px;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
            wrapper.appendChild(img);
        }

        if (fileLabel) {
            const fileTag = document.createElement('div');
            fileTag.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(95,212,255,0.1);border:1px solid rgba(95,212,255,0.25);border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:.78rem;color:var(--cyan-tech);';
            fileTag.innerHTML = `<i data-lucide="file-text" style="width:14px;height:14px;"></i> ${fileLabel}`;
            wrapper.appendChild(fileTag);
        }

        if (text) {
            const bubble = document.createElement('div');
            bubble.className = 'samii-msg__bubble';
            bubble.textContent = text;
            wrapper.appendChild(bubble);
        }

        feed.appendChild(wrapper);
        feed.scrollTop = feed.scrollHeight;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function addTypingIndicator() {
        const el = document.createElement('div');
        el.className = 'samii-msg samii-msg--bot samii-typing';
        el.innerHTML = `
            <div class="samii-msg__bubble" style="display:flex;gap:4px;align-items:center;padding:14px 18px;">
                <span class="samii-dot"></span><span class="samii-dot"></span><span class="samii-dot"></span>
            </div>`;
        feed.appendChild(el);
        feed.scrollTop = feed.scrollHeight;
        return el;
    }

    // ── ENVOI ─────────────────────────────────────────────
    async function sendMessage(message) {
        const attachment = pendingAttachment;
        if (!message && !attachment) return;

        addMessage(
            'user',
            message,
            attachment?.type === 'image' ? attachment.data : null,
            attachment?.type === 'document' ? attachment.name : null
        );

        input.value = '';
        clearAttachment();

        const typingEl = addTypingIndicator();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message || (attachment?.type === 'image' ? "Que vois-tu sur cette image ?" : "Voici un document."),
                    image: attachment?.type === 'image' ? attachment.data : null,
                    document: attachment?.type === 'document' ? { name: attachment.name, data: attachment.data } : null,
                }),
            });
            const data = await res.json();
            typingEl.remove();
            const reply = data.reply || "Je n'ai pas de réponse pour l'instant.";
            addMessage('bot', reply);
        } catch (err) {
            console.error(err);
            typingEl.remove();
            const errMsg = 'SAMII réfléchit un peu plus longtemps que prévu. Réessaie dans un instant.';
            addMessage('bot', errMsg);
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (message || pendingAttachment) sendMessage(message);
    });

    // ── PIÈCE JOINTE : aperçu + suppression ──────────────
    function showAttachmentPreview(attachment) {
        if (!attachPreview) return;
        attachPreview.style.display = 'flex';
        attachPreview.innerHTML = '';

        if (attachment.type === 'image') {
            const img = document.createElement('img');
            img.src = attachment.data;
            img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:8px;';
            attachPreview.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.innerHTML = '<i data-lucide="file-text"></i>';
            icon.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(95,212,255,0.1);border-radius:8px;color:var(--cyan-tech);';
            attachPreview.appendChild(icon);
        }

        const label = document.createElement('span');
        label.textContent = attachment.name || 'Image';
        label.style.cssText = 'font-size:.78rem;color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        attachPreview.appendChild(label);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i data-lucide="x"></i>';
        removeBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;';
        removeBtn.addEventListener('click', clearAttachment);
        attachPreview.appendChild(removeBtn);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function clearAttachment() {
        pendingAttachment = null;
        if (attachPreview) { attachPreview.style.display = 'none'; attachPreview.innerHTML = ''; }
    }

    // ── MENU PIÈCE JOINTE (photo ou document) ────────────
    if (attachBtn && attachMenu) {
        attachBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            attachMenu.classList.toggle('samii-attach-menu--open');
        });
        document.addEventListener('click', () => attachMenu.classList.remove('samii-attach-menu--open'));

        attachMenu.querySelectorAll('[data-attach-type]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.attachType;
                attachMenu.classList.remove('samii-attach-menu--open');
                if (type === 'image') photoInput?.click();
                if (type === 'document') docInput?.click();
            });
        });
    }

    if (photoInput) {
        photoInput.addEventListener('change', () => {
            const file = photoInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                pendingAttachment = { type: 'image', data: reader.result, name: file.name };
                showAttachmentPreview(pendingAttachment);
                toast('📷 Image prête à envoyer');
            };
            reader.readAsDataURL(file);
            photoInput.value = '';
        });
    }

    if (docInput) {
        docInput.addEventListener('change', () => {
            const file = docInput.files[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) {
                toast('⚠️ Fichier trop lourd (max 8 Mo)');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                pendingAttachment = { type: 'document', data: reader.result, name: file.name };
                showAttachmentPreview(pendingAttachment);
                toast('📄 Document prêt à envoyer');
            };
            reader.readAsDataURL(file);
            docInput.value = '';
        });
    }

    // ── MICRO : reconnaissance vocale avec sélecteur de langue ──
    if (micBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            micBtn.style.display = 'none';
        } else {
            const recognition = new SpeechRecognition();
            recognition.interimResults = false;
            let listening = false;

            function currentLang() {
                return langSelect?.value || 'fr-FR';
            }

            micBtn.addEventListener('click', () => {
                if (listening) {
                    recognition.stop();
                    return;
                }
                recognition.lang = currentLang();
                try {
                    recognition.start();
                } catch (err) {
                    console.warn('Reconnaissance déjà active.');
                }
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
                input.value = transcript;
                sendMessage(transcript);
            });

            recognition.addEventListener('error', (event) => {
                console.error('❌ Reconnaissance vocale :', event.error);
                listening = false;
                micBtn.classList.remove('samii-mic-btn--active');
                if (event.error === 'not-allowed') {
                    toast('🎙️ Autorise le micro dans ton navigateur');
                } else if (event.error !== 'no-speech') {
                    toast('🎙️ Je n\'ai pas bien entendu, réessaie');
                }
            });
        }
    }
});
