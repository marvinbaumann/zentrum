// Zentraler Zustand: eine JSON-Struktur im localStorage, versioniert für spätere Migrationen/Sync.
const KEY = 'zentrum.v1';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
export function weekStart(k) { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateKey(d); }

export const AREAS = {
  supp: { name: 'Supplements', color: 'var(--mint)', icon: 'pill' },
  skin: { name: 'Hautroutine', color: 'var(--pink)', icon: 'drop' },
  other: { name: 'Sonstiges', color: 'var(--blue)', icon: 'sparkles' },
};

function defaultState() {
  const ex = (name, weight, repMin, repMax, sets = 3, increment = 2.5) =>
    ({ id: uid(), name, sets, repMin, repMax, weight, increment, targetReps: repMin });
  return {
    version: 1,
    createdAt: dateKey(),
    settings: { stepsGoal: 10000, name: '', onboarded: false, heroMood: 'auto', splash: true, joker: true, restSeconds: 90, weights: '2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20', jumpLimit: 20 },
    habits: [
      { id: uid(), name: 'Vitamin D3', area: 'supp', dose: '2000 IE', schedule: { type: 'daily' } },
      { id: uid(), name: 'Omega-3', area: 'supp', dose: '1000 mg', schedule: { type: 'daily' } },
      { id: uid(), name: 'Magnesium', area: 'supp', dose: '400 mg', schedule: { type: 'daily' } },
      { id: uid(), name: 'Moisturizer', area: 'skin', schedule: { type: 'daily' } },
      { id: uid(), name: 'Sonnenschutz', area: 'skin', schedule: { type: 'daily' } },
      { id: uid(), name: 'Retinal', area: 'skin', schedule: { type: 'weekly', times: 3 } },
    ],
    log: {},          // { 'YYYY-MM-DD': { habitId: true } }
    steps: {},        // { 'YYYY-MM-DD': number }
    weight: [],       // [{ date, kg }]
    training: {
      days: [
        { id: uid(), name: 'Push', exercises: [ex('Liegestütze', null, 10, 15), ex('Schulterdrücken (KH)', 10, 10, 15), ex('Trizeps-Dips', null, 8, 12)] },
        { id: uid(), name: 'Pull', exercises: [ex('Rudern (KH)', 20, 10, 15), ex('Klimmzüge', null, 5, 10), ex('Bizeps-Curls (KH)', 10, 10, 15)] },
        { id: uid(), name: 'Beine', exercises: [ex('Goblet Squat', 16, 10, 15), ex('Ausfallschritte', null, 10, 15), ex('Glute Bridge', null, 12, 20)] },
      ],
      sessions: [],   // [{ id, date, dayId, dayName, entries: [{ exerciseId, name, weight, reps: [], result, targetBefore }] }]
      selectedDay: null,
    },
    lists: {
      work: { today: [], ideas: [] },
      private: { today: [], ideas: [] },
    },
    appointments: [], // [{ id, date, time, title }]
    checkins: {},     // { 'YYYY-MM-DD': { valence, emotions, tags, good, note, at } }
    people: [],       // [{ id, name, intervalDays, lastContact, birthday, note }]
    vision: [],       // [{ id, caption, area, step, addedAt }] – Bilddaten liegen in IndexedDB + Daten-Repo
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Fehlende Felder ergänzen (schema-tolerant)
      const d = defaultState();
      for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      for (const k of Object.keys(d.settings)) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
      return s;
    }
  } catch (e) { console.warn('State konnte nicht geladen werden', e); }
  return defaultState();
}

export const state = load();

let listeners = [];
export function onChange(fn) { listeners.push(fn); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}

// Mutation + Speichern + Re-Render in einem Schritt.
export function update(fn) {
  fn(state);
  state.updatedAt = new Date().toISOString();
  save();
  listeners.forEach(l => l());
}

export function replaceState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
  save();
  listeners.forEach(l => l());
}

export function resetState() { replaceState(defaultState()); }
