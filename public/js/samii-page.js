// ==========================================================================
// OG TECHNOLOGY — SAMII : logique de la page de chat dédiée
// (voix + fichiers réellement envoyés à SAMII + Projets à la Claude)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const form        = document.getElementById('samii-page-form');
    const input        = document.getElementById('samii-page-input');
    const feed         = document.getElementById('samii-page-feed');
    const micBtn       = document.getElementById('samii-mic-btn');
    const attachBtn    = document.getElementById('samii-attach-btn');
    const attachMenu   = document.getElementById('samii-attach-menu');
    const photoInput   = document.getElementById('samii-photo-input');
    const docInput     = document.getElementById('samii-doc-input');
    const attachPreview = document.getElementById('samii-attach-preview');
    const resumeBtn     = document.getElementById('samii-resume-btn');
    const projetSelect  = document.getElementById('samii-projet-select');
    const nouveauProjetBtn = document.getElementById('samii-nouveau-projet-btn');

    if (!form || !input || !feed) return;

    const CLOUDINARY_CLOUD_NAME = 'ojwx5hft';
    const CLOUDINARY_UPLOAD_PRESET = 'MARKETPLACE OG';

    let pendingAttachment = null; // { type: 'image'|'document', url, name }
    let projetActuel = localStorage.getItem('samii_projet_actuel') || '';
    const welcomeHtml = feed.innerHTML; // message d'accueil d'origine, réutilisé quand un fil est vide

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

    // ── PROJETS (à la Claude Projects) ───────────────────
    async function chargerProjets() {
        if (!projetSelect) return;
        try {
            const res = await fetch('/api/projets');
            const data = await res.json();
            if (!data.success) return;

            projetSelect.querySelectorAll('option[data-projet]').forEach(o => o.remove());
            data.projets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = String(p.id);
                opt.dataset.projet = '1';
                opt.textContent = '📁 ' + p.nom;
                projetSelect.appendChild(opt);
            });

            if (projetActuel && data.projets.some(p => String(p.id) === projetActuel)) {
                projetSelect.value = projetActuel;
            } else {
                projetActuel = '';
                localStorage.removeItem('samii_projet_actuel');
            }
        } catch (err) {
            console.error('❌ chargerProjets :', err);
        }
    }

    async function chargerHistorique() {
        try {
            const url = projetActuel ? `/api/chat/historique?projetId=${projetActuel}` : '/api/chat/historique';
            const res = await fetch(url);
            const data = await res.json();
            if (!data.success) return;

            if (!data.historique.length) {
                feed.innerHTML = welcomeHtml;
                return;
            }
            feed.innerHTML = '';
            data.historique.forEach(m => addMessage(m.role === 'user' ? 'user' : 'bot', m.message));
        } catch (err) {
            console.error('❌ chargerHistorique :', err);
        }
    }

    projetSelect?.addEventListener('change', () => {
        projetActuel = projetSelect.value || '';
        if (projetActuel) localStorage.setItem('samii_projet_actuel', projetActuel);
        else localStorage.removeItem('samii_projet_actuel');
        chargerHistorique();
    });

    nouveauProjetBtn?.addEventListener('click', async () => {
        const nom = prompt('Nom du projet (ex : "Ouvrir ma boutique", "Mon mariage"...)');
        if (!nom || !nom.trim()) return;
        try {
            const res = await fetch('/api/projets', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom: nom.trim() }),
            });
            const data = await res.json();
            if (!data.success) { toast(data.error || 'Erreur'); return; }
            await chargerProjets();
            projetSelect.value = String(data.projet.id);
            projetActuel = String(data.projet.id);
            localStorage.setItem('samii_projet_actuel', projetActuel);
            chargerHistorique();
            toast('📁 Projet créé : ' + data.projet.nom);
        } catch {
            toast('Erreur réseau.');
        }
    });

    chargerProjets().then(() => {
        if (projetActuel) chargerHistorique();
    });

    // ── ENVOI ─────────────────────────────────────────────
    async function sendMessage(message) {
        const attachment = pendingAttachment;
        if (!message && !attachment) return;

        addMessage(
            'user',
            message,
            attachment?.type === 'image' ? attachment.url : null,
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
                    message: message || '',
                    imageUrl: attachment?.type === 'image' ? attachment.url : null,
                    documentUrl: attachment?.type === 'document' ? attachment.url : null,
                    documentName: attachment?.type === 'document' ? attachment.name : null,
                    projetId: projetActuel || null,
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

    // ── PIÈCE JOINTE : upload Cloudinary réel, puis aperçu ───
    function showAttachmentPreview(attachment, previewSrc) {
        if (!attachPreview) return;
        attachPreview.style.display = 'flex';
        attachPreview.innerHTML = '';

        if (attachment.type === 'image') {
            const img = document.createElement('img');
            img.src = previewSrc || attachment.url;
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

    async function uploaderVersCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const json = await response.json();
        if (!response.ok || !json.secure_url) throw new Error('upload échoué');
        return json.secure_url;
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
        photoInput.addEventListener('change', async () => {
            const file = photoInput.files[0];
            if (!file) return;
            photoInput.value = '';

            const previewLocal = URL.createObjectURL(file);
            toast('⏳ Envoi de la photo...');
            try {
                const url = await uploaderVersCloudinary(file);
                pendingAttachment = { type: 'image', url, name: file.name };
                showAttachmentPreview(pendingAttachment, previewLocal);
                toast('📷 Image prête à envoyer');
            } catch {
                toast('❌ Échec de l\'envoi, réessaie.');
            }
        });
    }

    if (docInput) {
        docInput.addEventListener('change', async () => {
            const file = docInput.files[0];
            if (!file) return;
            docInput.value = '';
            if (file.size > 8 * 1024 * 1024) {
                toast('⚠️ Fichier trop lourd (max 8 Mo)');
                return;
            }
            toast('⏳ Envoi du document...');
            try {
                const url = await uploaderVersCloudinary(file);
                pendingAttachment = { type: 'document', url, name: file.name };
                showAttachmentPreview(pendingAttachment);
                toast('📄 Document prêt à envoyer');
            } catch {
                toast('❌ Échec de l\'envoi, réessaie.');
            }
        });
    }

    // ── MICRO : enregistrement + transcription Groq Whisper ──────────────
    // Remplace l'ancienne reconnaissance vocale native du navigateur
    // (indisponible sur Firefox, qualité très inégale en darija) par le même
    // moteur que WhatsApp/Telegram : on enregistre localement, on envoie
    // l'audio à /api/chat/transcribe, et le texte revient prêt à envoyer.
    if (micBtn) {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            micBtn.style.display = 'none';
        } else {
            let mediaRecorder = null;
            let chunks = [];
            let recording = false;

            async function startRecording() {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                chunks = [];
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size) chunks.push(e.data); });
                mediaRecorder.addEventListener('stop', async () => {
                    stream.getTracks().forEach(t => t.stop());
                    await envoyerAudio(new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }));
                });
                mediaRecorder.start();
                recording = true;
                micBtn.classList.add('samii-mic-btn--active');
            }

            function stopRecording() {
                recording = false;
                micBtn.classList.remove('samii-mic-btn--active');
                mediaRecorder?.stop();
            }

            async function envoyerAudio(blob) {
                toast('🎙️ SAMII écoute...');
                try {
                    const form = new FormData();
                    form.append('audio', blob, 'audio.webm');
                    const res = await fetch('/api/chat/transcribe', { method: 'POST', body: form });
                    const data = await res.json();
                    if (data.success && data.text) {
                        sendMessage(data.text);
                    } else {
                        toast(data.error || '🎙️ Je n\'ai pas bien entendu, réessaie');
                    }
                } catch (err) {
                    console.error('❌ Transcription :', err);
                    toast('🎙️ Erreur réseau, réessaie');
                }
            }

            micBtn.addEventListener('click', async () => {
                if (recording) { stopRecording(); return; }
                try {
                    await startRecording();
                } catch (err) {
                    console.error('❌ Micro :', err);
                    toast('🎙️ Autorise le micro dans ton navigateur');
                }
            });
        }
    }

    // ── RÉSUMÉ DE LA SEMAINE : copiable pour repartir de là, pas de zéro ──
    if (resumeBtn) {
        resumeBtn.addEventListener('click', async () => {
            resumeBtn.disabled = true;
            toast('📋 Génération du résumé...');
            try {
                const res = await fetch('/api/samii-resume', { method: 'POST' });
                const data = await res.json();
                if (!data.success || !data.resume) {
                    toast(data.message || 'Impossible de générer le résumé pour le moment');
                    return;
                }
                addMessage('bot', `📋 Résumé de ta semaine (colle-le au début d'une nouvelle conversation pour repartir de là) :\n\n${data.resume}`);
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(data.resume).then(() => toast('✅ Résumé copié dans le presse-papier'));
                }
            } catch (err) {
                console.error(err);
                toast('⚠️ Erreur pendant la génération du résumé');
            } finally {
                resumeBtn.disabled = false;
            }
        });
    }
});
