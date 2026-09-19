import { addDays, weekStart, parseKey, dateKey } from './store.js';

export function isScheduled(h, key) {
  if (h.archived) return false;
  const t = h.schedule?.type || 'daily';
  if (t === 'days') return (h.schedule.days || []).includes(parseKey(key).getDay());
  return true; // daily + weekly erscheinen jeden Tag
}
export const isWeekly = h => h.schedule?.type === 'weekly';
export function isDone(s, h, key) { return !!s.log[key]?.[h.id]; }
export function weeklyCount(s, h, key) {
  const ws = weekStart(key); let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(s, h, addDays(ws, i))) n++;
  return n;
}

// Alle Punkte des Tages: Pflicht (täglich / bestimmte Tage), Wochenziele, Schritte.
export function dayItems(s, key) {
  const required = [], weekly = [];
  for (const h of s.habits) {
    if (!isScheduled(h, key)) continue;
    if (isWeekly(h)) weekly.push({ habit: h, done: isDone(s, h, key), count: weeklyCount(s, h, key), times: h.schedule.times || 1 });
    else required.push({ habit: h, done: isDone(s, h, key) });
  }
  const goal = s.settings.stepsGoal || 0;
  const steps = s.steps[key] || 0;
  const stepsItem = goal > 0 ? { steps, goal, done: steps >= goal } : null;
  let trainingItem = null;
  if (s.settings.trainingDaily !== false) {
    const plan = (s.training?.sessions || []).find(x => x.date === key) || null;
    const free = s.freeWorkouts?.[key] || null;
    trainingItem = { plan, free, done: !!(plan || free) };
  }
  const total = required.length + (stepsItem ? 1 : 0) + (trainingItem ? 1 : 0);
  const done = required.filter(r => r.done).length + (stepsItem?.done ? 1 : 0) + (trainingItem?.done ? 1 : 0);
  return { required, weekly, stepsItem, trainingItem, total, done, pct: total ? done / total : 0 };
}

export const GOOD_THRESHOLD = 0.8;

// Tagesstufe: 'perfect' (alles), 'good' (≥ 80 %), 'partial' (etwas), 'none'
export function dayLevel(s, key) {
  const d = dayItems(s, key);
  if (!d.total) return 'none';
  if (d.done === d.total) return 'perfect';
  if (d.pct >= GOOD_THRESHOLD) return 'good';
  return d.done > 0 ? 'partial' : 'none';
}
export function isPerfectDay(s, key) { return dayLevel(s, key) === 'perfect'; }
export function isGoodDay(s, key) { const l = dayLevel(s, key); return l === 'perfect' || l === 'good'; }

// Serie: aufeinanderfolgende gute oder perfekte Tage. Ein Joker pro Woche fängt einen
// schwachen Tag auf, ohne die Serie zu brechen (nicht für heute, heute ist noch offen).
export function streakInfo(s, key = dateKey()) {
  let n = 0, k = key, jokers = {};
  if (!isGoodDay(s, k)) k = addDays(k, -1);
  while (k >= s.createdAt) {
    if (isGoodDay(s, k)) { n++; }
    else if (s.settings.joker !== false && !jokers[weekStart(k)] && n > 0) { jokers[weekStart(k)] = k; }
    else break;
    k = addDays(k, -1);
    if (n > 5000) break;
  }
  return { n, jokerDays: jokers };
}
export function streak(s, key = dateKey()) { return streakInfo(s, key).n; }

export function bestStreak(s) {
  let best = 0, k = s.createdAt, today = dateKey();
  while (k <= today) { best = Math.max(best, streakInfo(s, k).n); k = addDays(k, 1); }
  return best;
}

export function habitStreak(s, h, key = dateKey()) {
  let n = 0, k = key;
  if (!isDone(s, h, k)) k = addDays(k, -1);
  while (k >= s.createdAt) {
    if (!isScheduled(h, k)) { k = addDays(k, -1); continue; }
    if (!isDone(s, h, k)) break;
    n++; k = addDays(k, -1); if (n > 5000) break;
  }
  return n;
}

// Letzter Tag mit irgendeiner Aktivität (Haken, Schritte, Check-in, Training)
export function lastActivity(s) {
  let last = null;
  const consider = k => { if (k && (!last || k > last)) last = k; };
  for (const k of Object.keys(s.log || {})) if (Object.keys(s.log[k]).length) consider(k);
  for (const k of Object.keys(s.steps || {})) consider(k);
  for (const k of Object.keys(s.checkins || {})) consider(k);
  for (const se of s.training?.sessions || []) consider(se.date);
  for (const k of Object.keys(s.freeWorkouts || {})) consider(k);
  return last;
}
