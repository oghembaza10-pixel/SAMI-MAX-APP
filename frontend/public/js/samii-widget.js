/* =====================================================================
   OG EMPIRE — SAMII WIDGET (chat flottant, discret)
   ===================================================================== */
(function() {
  const widget = document.getElementById('samii-widget');
  if (!widget) return;

  const trigger = document.getElementById('samii-widget-trigger');
  const panel = document.getElementById('samii-widget-panel');
  const closeBtn = document.getElementById('samii-widget-close');
  const toggle = document.getElementById('samii-widget-toggle');
  const form = document.getElementById('samii-widget-form');
  const input = document.getElementById('samii-widget-input');
  const feed = document.getElementById('samii-widget-feed');
  const chips = document.querySelectorAll('.samii-chip');

  const STORAGE_KEY = 'og-samii-state';
  const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (state.on === false) toggle.setAttribute('data-samii-on', 'false');
  const label = toggle.querySelector('.samii-widget__toggle-label');
  const syncLabel = () => { label.textContent = toggle.getAttribute('data-samii-on') === 'true' ? 'ON' : 'OFF'; };
  syncLabel();

  const openPanel = () => { widget.setAttribute('data-open', 'true'); setTimeout(() => input.focus(), 300); };
  const closePanel = () => widget.setAttribute('data-open', 'false');

  trigger.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  toggle.addEventListener('click', () => {
    const now = toggle.getAttribute('data-samii-on') === 'true' ? 'false' : 'true';
    toggle.setAttribute('data-samii-on', now);
    syncLabel();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ on: now === 'true' }));
    if (now === 'false') {
      addMessage("SAMII est désormais en veille. Réactivez-moi quand vous êtes prêt.", 'bot');
    } else {
      addMessage("SAMII est de retour, Général. Prêt pour la stratégie.", 'bot');
    }
  });

  function addMessage(text, who = 'bot') {
    const msg = document.createElement('div');
    msg.className = `samii-msg samii-msg--${who}`;
    msg.innerHTML = `<div class="samii-msg__bubble">${text}</div>`;
    feed.appendChild(msg);
    feed.scrollTop = feed.scrollHeight;
  }

  async function sendToSamii(message) {
    if (toggle.getAttribute('data-samii-on') !== 'true') {
      addMessage("SAMII est en veille. Activez-le via le bouton ON/OFF.", 'bot');
      return;
    }
    addMessage(message, 'me');
    const typing = document.createElement('div');
    typing.className = 'samii-msg samii-msg--bot';
    typing.innerHTML = '<div class="samii-msg__bubble"><span class="samii-typing">SAMII réfléchit<span>.</span><span>.</span><span>.</span></span></div>';
    feed.appendChild(typing);
    feed.scrollTop = feed.scrollHeight;

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await r.json();
      typing.remove();
      addMessage(data.reply || "SAMII est momentanément indisponible.", 'bot');
    } catch (err) {
      typing.remove();
      addMessage("Connexion au poste de commandement perdue. Réessayez.", 'bot');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    sendToSamii(val);
  });

  chips.forEach(c => c.addEventListener('click', () => {
    const msg = c.getAttribute('data-msg');
    if (msg) sendToSamii(msg);
  }));

  // Style du "typing"
  const style = document.createElement('style');
  style.textContent = `
    .samii-typing span { display:inline-block; animation: og-blink 1.2s infinite; }
    .samii-typing span:nth-child(2){ animation-delay: .2s; }
    .samii-typing span:nth-child(3){ animation-delay: .4s; }
  `;
  document.head.appendChild(style);
})();
