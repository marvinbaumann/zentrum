import { state, update, onChange, dateKey } from './store.js';
import { icons } from './ui.js';
import { sheetAction, closeSheet } from './sheet.js';
import * as heute from './views/heute.js';
import * as training from './views/training.js';
import * as koerper from './views/koerper.js';
import * as listen from './views/listen.js';
import * as welcome from './views/welcome.js';
import { initSync } from './sync.js';
import { showSplash } from './views/splash.js';
import { showVision } from './views/vision.js';

const views = { heute, training, koerper, listen };
const TABS = [
  ['heute', 'Heute', 'sun'],
  ['training', 'Training', 'dumbbell'],
  ['koerper', 'Körper', 'heart'],
  ['listen', 'Listen', 'list'],
];

let lastDay = dateKey();
let pendingFocus = null;

export function currentTab() {
  const h = location.hash.replace('#', '');
  return views[h] ? h : 'heute';
}
const activeView = () => state.settings.onboarded ? views[currentTab()] : welcome;

export function focusAfterRender(selector) { pendingFocus = selector; }

export function render() {
  const tab = currentTab();
  const view = activeView();
  document.getElementById('app').innerHTML = view.render(state);
  document.body.classList.toggle('no-tabs', view === welcome);
  document.getElementById('tabbar').innerHTML = view === welcome ? '' : TABS.map(([id, name, icon]) =>
    `<a class="tab ${id === tab ? 'active' : ''}" href="#${id}">${icons[icon]}<span>${name}</span></a>`).join('');
  if (pendingFocus) { const el = document.querySelector(pendingFocus); if (el) el.focus(); pendingFocus = null; }
}

onChange(render);
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

const globalActions = {
  __closeSheet: () => closeSheet(),
};

function dispatch(kind, e) {
  const el = e.target.closest(`[data-${kind}]`);
  if (!el) return;
  const name = el.dataset[kind];
  const fn = sheetAction(name) || activeView()[kind === 'action' ? 'actions' : 'changes']?.[name] || globalActions[name];
  if (fn) fn(el, e);
}
document.addEventListener('click', e => dispatch('action', e));
document.addEventListener('change', e => dispatch('change', e));
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  const fn = activeView().submits?.[f.dataset.submit];
  if (fn) fn(f, e);
});

// Neuer Tag während die App offen ist → neu rendern. Nach längerer Pause → Startscreen.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (dateKey() !== lastDay) { lastDay = dateKey(); render(); }
  if (state.settings.onboarded && hiddenAt && Date.now() - hiddenAt > 2 * 60 * 60 * 1000) startScreens();
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Statusleiste auf dem iPhone an Hell/Dunkel anpassen (iOS liest die Farbe aus theme-color).
function syncThemeColor() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#000000' : '#F2F2F7');
}
syncThemeColor();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);

render();
initSync();
function startScreens() {
  if (state.settings.splash !== false) showSplash(state, () => showVision(state));
  else showVision(state);
}
if (state.settings.onboarded) startScreens();
document.addEventListener('images:update', () => {});
