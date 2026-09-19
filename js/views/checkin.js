// Abend-Check-in: Stimmung, Gefühlswörter, Einflüsse, drei gute Dinge. Unter 30 Sekunden.
import { state, update, dateKey } from '../store.js';
import { esc, icons, relDay } from '../ui.js';
import { openSheet, closeSheet, updateSheet } from '../sheet.js';
import { haptic } from '../fx.js';

export const VALENCE = [
  { v: -3, label: 'Sehr unangenehm', color: '#5B5BD6' },
  { v: -2, label: 'Unangenehm', color: '#6D7BE6' },
  { v: -1, label: 'Eher unangenehm', color: '#7FA6E8' },
  { v: 0, label: 'Neutral', color: '#9AA5B1' },
  { v: 1, label: 'Eher angenehm', color: '#8FD0A8' },
  { v: 2, label: 'Angenehm', color: '#F2C94C' },
  { v: 3, label: 'Sehr angenehm', color: '#FF9F43' },
];
export const valenceOf = v => VALENCE.find(x => x.v === v) || VALENCE[3];

const EMOTIONS = {
  neg: ['gestresst', 'müde', 'überfordert', 'traurig', 'gereizt', 'unruhig', 'enttäuscht', 'einsam', 'angespannt', 'frustriert'],
  mid: ['ruhig', 'ausgeglichen', 'nachdenklich', 'gleichgültig', 'müde', 'zufrieden', 'gelassen', 'abwartend'],
  pos: ['zufrieden', 'dankbar', 'stolz', 'energiegeladen', 'entspannt', 'glücklich', 'motiviert', 'verbunden', 'gelassen', 'begeistert'],
};
const TAGS = ['Training', 'Arbeit', 'Schlaf', 'Partner', 'Familie', 'Freunde', 'Ernährung', 'Natur', 'Erholung', 'Gesundheit', 'Geld', 'Wetter'];

let draft = null;
let step = 0;

function emotionsFor(v) { return v < 0 ? EMOTIONS.neg : v > 0 ? EMOTIONS.pos : EMOTIONS.mid; }

export function todayCheckin(s) { return s.checkins?.[dateKey()] || null; }

/* ---------- Karte auf der Heute-Seite ---------- */
export function card(s) {
  const c = todayCheckin(s);
  const hour = new Date().getHours();
  if (c) {
    const val = valenceOf(c.valence);
    return `<div class="card checkin-card" data-action="openCheckin" role="button">
      <div class="row" style="border-bottom:0">
        <span class="mood-dot" style="background:${val.color}"></span>
        <div class="grow"><div class="title">${esc(val.label)}${c.emotions?.length ? ` · ${esc(c.emotions.slice(0, 3).join(', '))}` : ''}</div>
        <div class="meta">${c.good?.filter(Boolean).length ? esc(c.good.filter(Boolean).join(' · ')) : 'Abend-Check-in erledigt'}</div></div>
        <span class="chev">${icons.chevron}</span>
      </div></div>`;
  }
  return `<div class="card checkin-card invite" data-action="openCheckin" role="button">
    <div class="row" style="border-bottom:0">
      <span class="mood-ring">${VALENCE.map(x => `<i style="background:${x.color}"></i>`).join('')}</span>
      <div class="grow"><div class="title">Wie war dein Tag?</div><div class="meta">${hour >= 17 ? 'Abend-Check-in, 30 Sekunden' : 'Abend-Check-in, jederzeit möglich'}</div></div>
      <span class="chev">${icons.chevron}</span>
    </div></div>`;
}

/* ---------- Ablauf ---------- */
export function openCheckin() {
  const existing = todayCheckin(state);
  draft = existing ? JSON.parse(JSON.stringify(existing)) : { valence: null, emotions: [], tags: [], good: ['', '', ''], note: '' };
  step = existing ? 0 : 0;
  renderStep();
}

function renderStep() {
  const total = 4;
  const v = draft.valence;
  const val = v == null ? null : valenceOf(v);
  let body = '';
  if (step === 0) {
    body = `<div class="ci-q">Wie fühlst du dich gerade?</div>
      <div class="mood-blob" style="--c:${val ? val.color : 'var(--text3)'}"></div>
      <div class="mood-label">${val ? esc(val.label) : 'Tippe auf eine Stufe'}</div>
      <div class="mood-scale">${VALENCE.map(x => `<button type="button" class="mood-step ${v === x.v ? 'on' : ''}" style="--c:${x.color}" data-action="ciValence" data-v="${x.v}" aria-label="${esc(x.label)}"></button>`).join('')}</div>
      <div class="mood-ends"><span>unangenehm</span><span>angenehm</span></div>`;
  } else if (step === 1) {
    body = `<div class="ci-q">Was beschreibt es am besten?</div><div class="ci-sub">Bis zu drei Wörter</div>
      <div class="chips">${[...new Set(emotionsFor(v))].map(w => `<button type="button" class="chip ${draft.emotions.includes(w) ? 'on' : ''}" style="--c:${val.color}" data-action="ciEmotion" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
  } else if (step === 2) {
    body = `<div class="ci-q">Was hat den Tag geprägt?</div><div class="ci-sub">Optional, so viele du willst</div>
      <div class="chips">${TAGS.map(w => `<button type="button" class="chip ${draft.tags.includes(w) ? 'on' : ''}" style="--c:var(--blue)" data-action="ciTag" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
  } else {
    body = `<div class="ci-q">Drei gute Dinge von heute</div><div class="ci-sub">Ein Wort reicht. Kleine Dinge zählen.</div>
      <div class="good-list">${[0, 1, 2].map(i => `<label class="good-row"><span class="good-num">${i + 1}</span><input name="good${i}" value="${esc(draft.good[i] || '')}" placeholder="${['z. B. Sonne beim Spaziergang', 'z. B. gutes Gespräch', 'z. B. Training geschafft'][i]}" data-change="ciGood" data-i="${i}" autocomplete="off" ${i === 0 ? 'data-autofocus' : ''}></label>`).join('')}</div>
      <label class="field" style="margin-top:14px"><span>Ein Satz zum Tag (optional)</span><textarea name="note" data-change="ciNote" placeholder="Was bleibt von heute?" style="min-height:70px">${esc(draft.note || '')}</textarea></label>`;
  }
  const canNext = step > 0 || v != null;
  const sheetHtml = `<div class="ci-dots">${Array.from({ length: total }, (_, i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('')}</div>
      <div class="ci-body">${body}</div>
      <div class="ci-nav">
        ${step > 0 ? `<button type="button" class="btn btn-soft" data-action="ciBack" style="width:auto;padding-inline:18px">Zurück</button>` : `<span></span>`}
        ${step < total - 1 ? `<button type="button" class="btn btn-primary" data-action="ciNext" ${canNext ? '' : 'disabled style="opacity:.4"'} style="width:auto;padding-inline:26px">Weiter</button>` : `<button type="button" class="btn btn-primary" data-action="ciSave" style="width:auto;padding-inline:26px">Fertig</button>`}
      </div>
      ${step > 0 && step < total - 1 ? `<button type="button" class="link-btn ci-skip" data-action="ciSave">Jetzt schon speichern</button>` : ''}`;
  const sheetActions = {
      ciValence: el => { draft.valence = Number(el.dataset.v); draft.emotions = draft.emotions.filter(w => emotionsFor(draft.valence).includes(w)); haptic(); renderStep(); },
      ciEmotion: el => { const w = el.dataset.w; const i = draft.emotions.indexOf(w); if (i >= 0) draft.emotions.splice(i, 1); else if (draft.emotions.length < 3) draft.emotions.push(w); else return; haptic(); renderStep(); },
      ciTag: el => { const w = el.dataset.w; const i = draft.tags.indexOf(w); if (i >= 0) draft.tags.splice(i, 1); else draft.tags.push(w); haptic(); renderStep(); },
      ciGood: el => { draft.good[Number(el.dataset.i)] = el.value.trim(); },
      ciNote: el => { draft.note = el.value.trim(); },
      ciNext: () => { if (draft.valence == null) return; step++; renderStep(); },
      ciBack: () => { step--; renderStep(); },
      ciSave: () => {
        if (draft.valence == null) return;
        // Eingaben des letzten Schritts sicher übernehmen
        document.querySelectorAll('[data-change="ciGood"]').forEach(i => { draft.good[Number(i.dataset.i)] = i.value.trim(); });
        const note = document.querySelector('[data-change="ciNote"]'); if (note) draft.note = note.value.trim();
        const entry = { ...draft, at: new Date().toISOString() };
        update(s => { (s.checkins ||= {})[dateKey()] = entry; });
        haptic();
        closeSheet();
      },
      ciDelete: () => { if (confirm('Check-in von heute löschen?')) { update(s => { delete s.checkins[dateKey()]; }); closeSheet(); } },
  };
  if (!updateSheet({ html: sheetHtml, actions: sheetActions })) openSheet({ title: 'Abend-Check-in', html: sheetHtml, actions: sheetActions });
}

// Zusammenfassung für Rückblicke
export function summarize(s, fromKey, toKey) {
  const entries = Object.entries(s.checkins || {}).filter(([k]) => k >= fromKey && k <= toKey).map(([k, c]) => ({ k, ...c }));
  if (!entries.length) return null;
  const avg = entries.reduce((a, c) => a + (c.valence || 0), 0) / entries.length;
  const words = {}; entries.forEach(c => (c.emotions || []).forEach(w => words[w] = (words[w] || 0) + 1));
  const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const good = entries.flatMap(c => (c.good || []).filter(Boolean));
  return { count: entries.length, avg, top, good };
}
