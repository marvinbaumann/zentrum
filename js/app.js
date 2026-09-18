import { state, update, onChange, dateKey } from './store.js';
import { icons } from './ui.js';
import { sheetAction, closeSheet } from './sheet.js';
import * as heute from './views/heute.js';
import * as training from './views/training.js';
import * as koerper from './views/koerper.js';
import * as listen from './views/listen.js';

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

export function focusAfterRender(selector) { pendingFocus = selector; }

export function render() {
  const tab = currentTab();
  document.getElementById('app').innerHTML = views[tab].render(state);
  document.getElementById('tabbar').innerHTML = TABS.map(([id, name, icon]) =>
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
  const fn = sheetAction(name) || views[currentTab()][kind === 'action' ? 'actions' : 'changes']?.[name] || globalActions[name];
  if (fn) fn(el, e);
}
document.addEventListener('click', e => dispatch('action', e));
document.addEventListener('change', e => dispatch('change', e));
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  const fn = views[currentTab()].submits?.[f.dataset.submit];
  if (fn) fn(f, e);
});

// Neuer Tag während die App offen ist → neu rendern.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dateKey() !== lastDay) { lastDay = dateKey(); render(); }
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

render();
