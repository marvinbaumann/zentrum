import { update } from '../store.js';
import { esc, icons } from '../ui.js';

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
        <button type="submit" class="btn btn-white">Los geht’s ${icons.arrowRight.replace('<svg', '<svg style="width:18px;height:18px"')}</button>
      </form>
    </div>
  </section>`;
}

export const submits = {
  start(f) {
    const name = f.name.value.trim();
    update(s => { s.settings.name = name; s.settings.onboarded = true; });
    window.scrollTo(0, 0);
  },
};
