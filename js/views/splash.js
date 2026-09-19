// Herzlicher Startscreen: erscheint beim Öffnen, verschwindet mit einem Tipp oder nach ein paar Sekunden.
import { dateKey } from '../store.js';
import { esc } from '../ui.js';
import { streak } from '../habits.js';

const LINES = {
  morning: [
    'Schön, dass du da bist. Der Tag gehört dir.',
    'Heute ist ein guter Tag, um gut zu dir zu sein.',
    'Du musst nicht alles schaffen. Nur anfangen.',
    'Ein klarer Kopf beginnt mit einem ruhigen Moment.',
    'Was du heute pflegst, dankt dir morgen.',
  ],
  day: [
    'Schön, dass du reinschaust. Weiter geht’s, Schritt für Schritt.',
    'Jeder Tag, an dem du dich kümmerst, zählt.',
    'Fortschritt ist leise. Du hörst ihn erst später.',
    'Kleine Dinge, mit Liebe gemacht, werden groß.',
    'Dein Körper trägt dich durch alles. Sei gut zu ihm.',
  ],
  evening: [
    'Gut gemacht heute. Alles, was jetzt noch kommt, ist Bonus.',
    'Der Abend ist zum Ankommen da. Mach den Tag in Ruhe rund.',
    'Du hast dich heute um dich gekümmert. Das ist nicht selbstverständlich.',
    'Atme einmal tief durch. Du hast alles, was du brauchst.',
  ],
  night: [
    'Ruh dich aus. Morgen geht es weiter.',
    'Erholung ist auch Fortschritt. Schlaf gut.',
    'Der Tag ist vorbei. Du hast dein Bestes gegeben.',
  ],
};

function bucket(h) { return h < 5 || h >= 22 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : 'evening'; }
function greeting(h) { return h < 5 || h >= 22 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend'; }

export function showSplash(s) {
  if (document.querySelector('.splash')) return;
  const h = new Date().getHours();
  const b = bucket(h);
  const pool = LINES[b];
  const seed = parseInt(dateKey().replace(/-/g, ''), 10) + ['night', 'morning', 'day', 'evening'].indexOf(b);
  let line = pool[seed % pool.length];
  const st = streak(s);
  if (st >= 3 && seed % 3 === 0) line = `${st} Tage in Folge. Das bist du, jeden Tag aufs Neue.`;
  const name = (s.settings.name || '').trim();

  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Startscreen schließen');
  el.innerHTML = `
    <div class="welcome-glow"></div>
    <div class="splash-body">
      <div class="splash-greet">${esc(greeting(h))}${name ? `,<br>${esc(name)}.` : '.'}</div>
      <div class="splash-line">${esc(line)}</div>
    </div>
    <div class="splash-hint">Tippen zum Starten</div>`;
  document.body.appendChild(el);
  document.body.classList.add('splash-open');
  let done = false;
  const close = () => {
    if (done) return; done = true;
    el.classList.add('out');
    document.body.classList.remove('splash-open');
    setTimeout(() => el.remove(), 450);
  };
  el.addEventListener('click', close);
  el.addEventListener('touchend', e => { e.preventDefault(); close(); }, { passive: false });
  setTimeout(close, 5000);
}
