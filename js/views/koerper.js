import { state, update, dateKey, addDays, parseKey } from '../store.js';
import { esc, header, sectionLabel, icons, relDay, fmtKg, fmtNum, fmtDM } from '../ui.js';
import { openSheet, field } from '../sheet.js';
import { haptic, celebrate } from '../fx.js';

// Geglätteter Trend (exponentiell, wie Happy Scale): Tagesrauschen raus, Richtung rein.
export function trendSeries(w) {
  let ema = null; return w.map(x => { ema = ema == null ? x.kg : ema + 0.3 * (x.kg - ema); return { date: x.date, kg: x.kg, trend: Math.round(ema * 100) / 100 }; });
}
export function trendInfo(t) {
  if (t.length < 2) return null;
  const last = t[t.length - 1];
  const ref = [...t].reverse().find(x => x.date <= addDays(last.date, -7)) || t[0];
  const days = Math.max(1, (parseKey(last.date) - parseKey(ref.date)) / 864e5);
  const perWeek = (last.trend - ref.trend) / days * 7;
  const a = Math.abs(perWeek);
  const dir = perWeek < 0 ? 'sinkend' : 'steigend';
  const label = a < 0.1 ? 'stabil' : a < 0.4 ? `leicht ${dir}` : `deutlich ${dir}`;
  return { perWeek, label, weekRef: ref.trend };
}

// Monats-Test: einfache, wiederholbare Messungen für Beweglichkeit, Kraft und Ausdauer
export const TESTS = [
  { key: 'squatHold', name: 'Deep Squat Hold', unit: 's', better: 'up', hint: 'Sekunden in der tiefen Hocke, Fersen unten' },
  { key: 'deadHang', name: 'Dead Hang', unit: 's', better: 'up', hint: 'Sekunden an der Stange' },
  { key: 'toeTouch', name: 'Fingerspitzen zum Boden', unit: 'cm', better: 'down', hint: 'Abstand mit gestreckten Beinen, 0 = Boden berührt' },
  { key: 'balance', name: 'Einbeinstand, Augen zu', unit: 's', better: 'up', hint: 'Sekunden, schwächere Seite' },
  { key: 'pullups', name: 'Klimmzüge am Stück', unit: '', better: 'up', hint: 'saubere Wiederholungen' },
  { key: 'pushups', name: 'Liegestütze am Stück', unit: '', better: 'up', hint: 'saubere Wiederholungen' },
  { key: 'vo2', name: 'VO2max (Apple Watch)', unit: '', better: 'up', hint: 'Health → Cardiofitness' },
  { key: 'rhr', name: 'Ruhepuls', unit: 'bpm', better: 'down', hint: 'Health → Ruheherzfrequenz, 7-Tage-Schnitt' },
];
// Erholung aus Apple Health (per Kurzbefehl): Schlaf, Ruhepuls, HRV, VO2max
function latestHealth(s, key) { const days = Object.keys(s.health || {}).filter(d => s.health[d][key] != null).sort(); const d = days[days.length - 1]; return d ? { date: d, value: s.health[d][key] } : null; }
function avgHealth(s, key, n = 7) { const vals = Object.entries(s.health || {}).filter(([, h]) => h[key] != null).sort((a, b) => a[0].localeCompare(b[0])).slice(-n).map(([, h]) => h[key]); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; }
function fmtH(h) { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
function recoveryCard(s) {
  if (!s.health || !Object.keys(s.health).length) return `${sectionLabel('Erholung')}<div class="card pad"><div class="note"><strong style="color:var(--text)">Apple Watch anbinden.</strong> Erweitere den Kurzbefehl „Zentrum Sync“ um Schlaf, Ruhepuls, HRV, VO2max und Trainings, dann erscheinen sie hier automatisch. Anleitung in docs/kurzbefehl-health.md, Abschnitt Apple Watch.</div></div>`;
  const sleep = latestHealth(s, 'sleep'), rhr = latestHealth(s, 'rhr'), hrv = latestHealth(s, 'hrv'), vo2 = latestHealth(s, 'vo2');
  const sleepAvg = avgHealth(s, 'sleep'), rhrAvg = avgHealth(s, 'rhr'), hrvAvg = avgHealth(s, 'hrv');
  const today = dateKey();
  const last14 = Array.from({ length: 14 }, (_, i) => { const k = addDays(today, i - 13); return { k, v: s.health[k]?.sleep || 0 }; });
  const W = 320, H = 70, gap = 5, bw = (W - gap * 13) / 14, max = Math.max(9, ...last14.map(x => x.v));
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:70px">${last14.map((d, i) => `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(H - d.v / max * (H - 6)).toFixed(1)}" width="${bw.toFixed(1)}" height="${(d.v / max * (H - 6)).toFixed(1)}" rx="4" fill="${d.v >= 7 ? 'var(--indigo)' : d.v > 0 ? 'color-mix(in srgb, var(--indigo) 45%, transparent)' : 'var(--field)'}"/>`).join('')}<line x1="0" x2="${W}" y1="${(H - 7 / max * (H - 6)).toFixed(1)}" y2="${(H - 7 / max * (H - 6)).toFixed(1)}" stroke="var(--indigo)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/></svg><div class="chart-foot"><span>${fmtDM(last14[0].k)}</span><span>Schlaf, Linie = 7 h</span><span>Heute</span></div>`;
  const delta = (v, avg, goodDown) => { if (v == null || avg == null) return ''; const d = v - avg; if (Math.abs(d) < 0.5) return '<small style="color:var(--text2)">= Ø</small>'; const good = goodDown ? d < 0 : d > 0; return `<small style="color:${good ? 'var(--green)' : 'var(--orange)'}">${d > 0 ? '+' : ''}${Math.round(d)} zu Ø</small>`; };
  return `${sectionLabel('Erholung', '<span class="pill" style="--c:var(--indigo)">Apple Watch</span>')}
  <div class="card">
    <div class="stats" style="padding-top:14px">
      <div class="stat"><div class="v">${sleep ? fmtH(sleep.value) : '–'}<small>h</small></div><div class="l">Schlaf ${sleep ? relDay(sleep.date) : ''}${sleepAvg ? ` · Ø ${fmtH(sleepAvg)}` : ''}</div></div>
      <div class="stat"><div class="v">${rhr ? rhr.value : '–'}</div><div class="l">Ruhepuls ${rhr ? delta(rhr.value, rhrAvg, true) : ''}</div></div>
      <div class="stat"><div class="v">${hrv ? hrv.value : '–'}</div><div class="l">HRV ms ${hrv ? delta(hrv.value, hrvAvg, false) : ''}</div></div>
    </div>
    ${vo2 ? `<div class="row" style="border-bottom:0;padding-top:0"><div class="grow"><div class="title">VO2max ${String(vo2.value).replace('.', ',')}</div><div class="meta">Apple Watch Schätzung, Stand ${relDay(vo2.date)}</div></div></div>` : ''}
    ${s.health[today]?.exercise ? `<div class="row" style="border-bottom:0;padding-top:0"><div class="grow"><div class="title">${s.health[today].exercise} Trainingsminuten heute</div><div class="meta">Apple Watch, Ring „Trainieren“</div></div></div>` : ''}
    ${chart}
  </div>`;
}

function testsCard(s) {
  const list = [...(s.tests || [])].sort((a, b) => a.date.localeCompare(b.date));
  const last = list[list.length - 1], prev = list[list.length - 2];
  const daysSince = last ? Math.round((parseKey(dateKey()) - parseKey(last.date)) / 864e5) : null;
  const due = last ? Math.max(0, 30 - daysSince) : 0;
  const fmtV = (t, v) => v == null || v === '' ? '–' : `${String(v).replace('.', ',')}${t.unit ? ` ${t.unit}` : ''}`;
  return `${sectionLabel('Monats-Test', `<button class="link-btn" data-action="addTest">+ Test</button>`)}
  <div class="card">
    ${last ? `<div class="row" style="border-bottom:1px solid var(--sep)"><div class="grow"><div class="title">Letzter Test ${relDay(last.date)}</div><div class="meta">${due > 0 ? `Nächster Test in ${due} Tagen` : 'Nächster Test ist fällig'}</div></div>${due === 0 ? '<span class="pill" style="--c:var(--orange)">fällig</span>' : ''}</div>
      ${TESTS.map(t => { const v = last.values?.[t.key], pv = prev?.values?.[t.key]; let d = ''; if (v != null && v !== '' && pv != null && pv !== '') { const diff = Number(v) - Number(pv); const good = t.better === 'up' ? diff > 0 : diff < 0; d = diff === 0 ? '<span class="trail">=</span>' : `<span class="trail" style="color:${good ? 'var(--green)' : 'var(--orange)'};font-weight:600">${diff > 0 ? '+' : ''}${String(Math.round(diff * 10) / 10).replace('.', ',')}</span>`; }
        return `<div class="row"><div class="grow"><div class="title" style="font-size:16px">${esc(t.name)}</div></div><span class="trail" style="color:var(--text);font-weight:600">${fmtV(t, v)}</span>${d}</div>`; }).join('')}`
    : `<div class="empty">Noch kein Test. Miss einmal im Monat Beweglichkeit, Kraft und Ausdauer, dann siehst du hier deinen Fortschritt.<br><span style="font-size:13px">Dauert 10 Minuten, am besten am Sonntag nach dem Flow.</span></div>`}
  </div>`;
}

export function render(s) {
  const today = dateKey();
  const w = [...s.weight].sort((a, b) => a.date.localeCompare(b.date));
  const latest = w[w.length - 1];
  const t = trendSeries(w);
  const ti = trendInfo(t);
  const latestTrend = t[t.length - 1]?.trend;
  const goal = s.settings.stepsGoal || 0;
  const stepsToday = s.steps[today] || 0;
  const last14 = Array.from({ length: 14 }, (_, i) => { const k = addDays(today, i - 13); return { k, v: s.steps[k] || 0 }; });
  const last7 = last14.slice(7);
  const avg7 = Math.round(last7.reduce((a, b) => a + b.v, 0) / 7);
  const hit7 = goal ? last7.filter(x => x.v >= goal).length : 0;

  return `
    ${header('Körper', 'Gewicht & Bewegung')}

    ${sectionLabel('Gewicht', `<button class="link-btn" data-action="addWeight">+ Eintrag</button>`)}
    <div class="card">
      ${latest ? `
        <div class="hero" style="padding-bottom:4px">
          <div class="grow"><div class="big num" style="font-size:40px">${fmtKg(latest.kg)} <span style="font-size:18px;color:var(--text2);font-weight:600">kg</span></div><div class="muted">${relDay(latest.date)}</div></div>
          ${ti ? `<div class="trend-badge" style="--c:${Math.abs(ti.perWeek) < 0.1 ? 'var(--text2)' : ti.perWeek < 0 ? 'var(--green)' : 'var(--orange)'}"><b>${esc(ti.label)}</b>${Math.abs(ti.perWeek) >= 0.1 ? `<span>${ti.perWeek > 0 ? '+' : ''}${fmtKg(ti.perWeek)} kg / Woche</span>` : '<span>Trend hält</span>'}</div>` : ''}
        </div>
        ${ti ? `<div class="stats" style="padding:6px 0 4px">
          <div class="stat"><div class="v">${fmtKg(latestTrend)}<small>kg</small></div><div class="l">Trend heute</div></div>
          <div class="stat"><div class="v" style="color:${latest.kg - latestTrend < -0.05 ? 'var(--green)' : latest.kg - latestTrend > 0.05 ? 'var(--orange)' : 'inherit'}">${latest.kg - latestTrend > 0 ? '+' : ''}${fmtKg(latest.kg - latestTrend)}</div><div class="l">Heute zum Trend</div></div>
          <div class="stat"><div class="v" style="color:${latestTrend - ti.weekRef < -0.05 ? 'var(--green)' : latestTrend - ti.weekRef > 0.05 ? 'var(--orange)' : 'inherit'}">${latestTrend - ti.weekRef > 0 ? '+' : ''}${fmtKg(latestTrend - ti.weekRef)}</div><div class="l">Trend zur Vorwoche</div></div>
        </div>` : ''}
        ${w.length > 1 ? weightChart(t.slice(-45)) : '<div class="note" style="padding:6px 0 14px">Ab dem zweiten Eintrag siehst du hier deinen Verlauf. Die Linie zeigt den geglätteten Trend, die Punkte die Tageswerte.</div>'}
      ` : `<div class="empty">Noch kein Gewicht eingetragen.<br><span style="font-size:13px">Später kann deine Waage das automatisch per Kurzbefehl senden.</span></div>`}
    </div>
    ${w.length ? `<div class="card">${w.slice(-7).reverse().map(x => `<div class="row"><div class="grow"><div class="title">${fmtKg(x.kg)} kg</div><div class="meta">${relDay(x.date)}</div></div><button type="button" class="mini-btn red" data-action="delWeight" data-date="${x.date}">${icons.trash}</button></div>`).join('')}</div>` : ''}

    ${sectionLabel('Schritte')}
    <div class="card">
      <div class="hero" style="padding-bottom:8px">
        <div class="grow"><div class="big num" style="font-size:38px">${fmtNum(stepsToday)}</div><div class="muted">${goal ? (stepsToday >= goal ? 'Tagesziel erreicht 🎉' : `noch ${fmtNum(goal - stepsToday)} bis ${fmtNum(goal)}`) : 'Heute'}</div></div>
        <div class="inline-input"><input type="number" inputmode="numeric" value="${stepsToday || ''}" placeholder="Heute" data-change="setSteps" style="width:110px"></div>
      </div>
      ${goal ? `<div class="bar" style="--c:var(--green);margin-bottom:14px"><i style="width:${Math.min(100, stepsToday / goal * 100)}%"></i></div>` : ''}
      ${stepsChart(last14, goal)}
      <div class="stats">
        <div class="stat"><div class="v">${fmtNum(avg7)}</div><div class="l">Ø 7 Tage</div></div>
        <div class="stat"><div class="v">${hit7}<small>/7</small></div><div class="l">Ziel erreicht</div></div>
        <div class="stat"><div class="v">${fmtNum(Math.max(...last14.map(x => x.v)))}</div><div class="l">Bestwert</div></div>
      </div>
    </div>
    ${recoveryCard(s)}
    ${testsCard(s)}
    <div class="card pad"><div class="note"><strong style="color:var(--text)">Automatisch übertragen.</strong> Ein Kurzbefehl auf dem iPhone schickt Schritte und das Gewicht deiner Waage aus Apple Health hierher.${s.lastImport ? ` Letzter Import: ${new Date(s.lastImport).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr.` : ' Noch kein Import angekommen.'}</div></div>
  `;
}

function deltaVal(d, label) {
  const color = Math.abs(d) < 0.05 ? 'var(--text2)' : d < 0 ? 'var(--green)' : 'var(--orange)';
  return `<div style="text-align:right;min-width:64px"><div style="font-weight:700;color:${color};font-variant-numeric:tabular-nums">${d > 0 ? '+' : ''}${fmtKg(d)}</div><div class="meta" style="font-size:11px;color:var(--text2);line-height:1.2">${label}</div></div>`;
}

function weightChart(pts) {
  const W = 320, H = 110, px = 8, py = 12;
  const vals = pts.flatMap(p => [p.kg, p.trend]);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { const m = (max + min) / 2; min = m - 0.6; max = m + 0.6; }
  const x = i => px + i * (W - 2 * px) / Math.max(1, pts.length - 1);
  const y = v => py + (H - 2 * py) * (1 - (v - min) / (max - min));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:110px">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--purple)" stop-opacity=".22"/><stop offset="1" stop-color="var(--purple)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#wg)"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2.2" fill="var(--purple)" opacity=".35"/>`).join('')}
      <path d="${line}" fill="none" stroke="var(--purple)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(pts[pts.length - 1].trend)}" r="4.5" fill="var(--purple)" stroke="var(--card)" stroke-width="2"/>
    </svg>
    <div class="chart-foot"><span>${fmtDM(pts[0].date)}</span><span>Linie = Trend · Punkte = Tageswerte</span><span>${fmtDM(pts[pts.length - 1].date)}</span></div>`;
}

function stepsChart(days, goal) {
  const W = 320, H = 90, gap = 5, bw = (W - gap * (days.length - 1)) / days.length;
  const max = Math.max(goal || 0, ...days.map(d => d.v), 1);
  const y = v => H - (v / max) * (H - 8);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:90px">
      ${days.map((d, i) => `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${y(d.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - y(d.v)).toFixed(1)}" rx="4" fill="${goal && d.v >= goal ? 'var(--green)' : 'var(--field)'}" ${goal && d.v >= goal ? '' : 'stroke="var(--sep)" stroke-width="1"'}/>`).join('')}
      ${goal ? `<line x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>` : ''}
    </svg>
    <div class="chart-foot"><span>${fmtDM(days[0].k)}</span><span>Ziel ${fmtNum(goal)}</span><span>Heute</span></div>`;
}

export const actions = {
  addTest() {
    const list = [...(state.tests || [])].sort((a, b) => a.date.localeCompare(b.date)); const last = list[list.length - 1];
    openSheet({ title: 'Monats-Test', submitLabel: 'Speichern',
      html: `<div class="note" style="padding:0 2px 12px">Trag ein, was du gemessen hast. Leere Felder sind okay. Immer gleiche Bedingungen: ausgeruht, nach dem Aufwärmen.</div>
        ${field({ label: 'Datum', name: 'date', type: 'date', value: dateKey() })}
        ${TESTS.map(t => { const auto = t.key === 'vo2' ? latestHealth(state, 'vo2')?.value : t.key === 'rhr' ? (avgHealth(state, 'rhr') != null ? Math.round(avgHealth(state, 'rhr')) : null) : null; return field({ label: `${t.name}${t.unit ? ` (${t.unit})` : ''}${auto != null ? ' · aus Apple Watch' : ''}`, name: t.key, type: 'text', value: auto != null ? String(auto).replace('.', ',') : '', placeholder: last?.values?.[t.key] != null && last.values[t.key] !== '' ? `zuletzt ${String(last.values[t.key]).replace('.', ',')}` : t.hint, attrs: 'inputmode="decimal" autocomplete="off"' }); }).join('')}`,
      onSubmit(d) {
        const values = {}; let any = false;
        for (const t of TESTS) { const v = parseFloat(String(d[t.key] || '').replace(',', '.')); if (!isNaN(v)) { values[t.key] = v; any = true; } }
        if (!any) { alert('Bitte mindestens einen Wert eintragen.'); return false; }
        const date = d.date || dateKey();
        update(s => { s.tests = (s.tests || []).filter(x => x.date !== date); s.tests.push({ date, values }); });
        haptic();
        if (last) { const improved = TESTS.filter(t => values[t.key] != null && last.values?.[t.key] != null && (t.better === 'up' ? values[t.key] > last.values[t.key] : values[t.key] < last.values[t.key])).length; if (improved >= 3) celebrate(['#34C759', '#00C7BE', '#FFD60A', '#FFFFFF']); }
      } });
  },
  addWeight() {
    openSheet({ title: 'Gewicht eintragen',
      html: `${field({ label: 'Gewicht (kg)', name: 'kg', type: 'text', placeholder: 'z. B. 78,4', attrs: 'inputmode="decimal" autocomplete="off" required', autofocus: true })}${field({ label: 'Datum', name: 'date', type: 'date', value: dateKey() })}`,
      onSubmit(d) {
        const kg = parseFloat(String(d.kg).trim().replace(',', '.')); if (!(kg > 20 && kg < 400)) { alert('Bitte ein Gewicht zwischen 20 und 400 kg eingeben, z. B. 78,4.'); return false; }
        const date = d.date || dateKey();
        update(s => { s.weight = s.weight.filter(x => x.date !== date); s.weight.push({ date, kg: Math.round(kg * 10) / 10 }); });
      } });
  },
  delWeight(el) { if (confirm('Eintrag löschen?')) update(s => { s.weight = s.weight.filter(x => x.date !== el.dataset.date); }); },
};

export const changes = {
  setSteps(el) { const v = parseInt(el.value, 10); update(s => { if (v > 0) s.steps[dateKey()] = v; else delete s.steps[dateKey()]; }); },
};
