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
  const total = required.length + (stepsItem ? 1 : 0);
  const done = required.filter(r => r.done).length + (stepsItem?.done ? 1 : 0);
  return { required, weekly, stepsItem, total, done, pct: total ? done / total : 0 };
}

export function isPerfectDay(s, key) {
  const d = dayItems(s, key);
  return d.total > 0 && d.done === d.total;
}

// Serie perfekter Tage bis heute (heute zählt, sobald erledigt; sonst ab gestern).
export function streak(s, key = dateKey()) {
  let n = 0, k = key;
  if (!isPerfectDay(s, k)) k = addDays(k, -1);
  while (k >= s.createdAt && isPerfectDay(s, k)) { n++; k = addDays(k, -1); if (n > 5000) break; }
  return n;
}

export function bestStreak(s) {
  let best = 0, cur = 0, k = s.createdAt, today = dateKey();
  while (k <= today) { if (isPerfectDay(s, k)) { cur++; best = Math.max(best, cur); } else cur = 0; k = addDays(k, 1); }
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
