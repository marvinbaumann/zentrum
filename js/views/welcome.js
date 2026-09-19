import { update } from '../store.js';
import { esc, icons } from '../ui.js';
import { connect } from '../sync.js';

export function render(s) {
  return `
  <section class="welcome">
    <div class="welcome-glow"></div>
    <div class="welcome-body">
      <div class="welcome-mark">${icons.sparkles}</div>
      <h1>Willkommen<br>in deinem Zentrum.</h1>
      <p>Gesundheit, Training, Arbeit und Alltag. Alles an einem Ort, ganz auf dich zugeschnitten.</p>
      <form data-submit="start" class="welcome-form" autocomplete="off">
        <label><span>Wie darf ich dich nennen?</span><input name="name" value="${esc(s.settings.name || '')}" placeholder="Dein Name" maxlength="30" autocapitalize="words"></label>
        <label><span>Sync-Schlüssel, falls du schon Daten hast (optional)</span><input name="token" placeholder="ghp_…" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <button type="submit" class="btn btn-white" id="welcome-go">Los geht’s ${icons.arrowRight.replace('<svg', '<svg style="width:18px;height:18px"')}</button>
      </form>
    </div>
  </section>`;
}

export const submits = {
  async start(f) {
    const name = f.name.value.trim();
    const token = f.token.value.trim();
    const btn = f.querySelector('#welcome-go');
    if (token) {
      btn.disabled = true; btn.textContent = 'Verbinde …';
      try {
        const res = await connect(token, 'zentrum-daten');
        if (res === 'pulled') { window.scrollTo(0, 0); return; } // Daten aus der Cloud übernommen
      } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Los geht’s'; return; }
    }
    update(s => { s.settings.name = name; s.settings.onboarded = true; });
    window.scrollTo(0, 0);
  },
};
