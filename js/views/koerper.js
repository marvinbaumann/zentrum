import { state, update, dateKey, addDays } from '../store.js';
import { esc, header, sectionLabel, icons, relDay, fmtKg, fmtNum, fmtDM } from '../ui.js';
import { openSheet, field } from '../sheet.js';

export function render(s) {
  const today = dateKey();
  const w = [...s.weight].sort((a, b) => a.date.localeCompare(b.date));
  const latest = w[w.length - 1];
  const prev = w[w.length - 2];
  const weekAgo = [...w].reverse().find(x => x.date <= addDays(latest?.date || today, -7));
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
        <div class="hero" style="padding-bottom:6px">
          <div class="grow"><div class="big" style="font-size:36px">${fmtKg(latest.kg)} <span style="font-size:18px;color:var(--text2);font-weight:600">kg</span></div><div class="muted">${relDay(latest.date)}</div></div>
          ${delta(latest, prev, 'zum Vortag')}${delta(latest, weekAgo, 'zur Vorwoche')}
        </div>
        ${w.length > 1 ? weightChart(w.slice(-30)) : '<div class="note" style="padding:6px 0 14px">Ab dem zweiten Eintrag siehst du hier deinen Verlauf.</div>'}
      ` : `<div class="empty">Noch kein Gewicht eingetragen.<br><span style="font-size:13px">Später kann deine Waage das automatisch per Kurzbefehl senden.</span></div>`}
    </div>
    ${w.length ? `<div class="card">${w.slice(-7).reverse().map(x => `<div class="row"><div class="grow"><div class="title">${fmtKg(x.kg)} kg</div><div class="meta">${relDay(x.date)}</div></div><button type="button" class="mini-btn red" data-action="delWeight" data-date="${x.date}">${icons.trash}</button></div>`).join('')}</div>` : ''}

    ${sectionLabel('Schritte')}
    <div class="card">
      <div class="hero" style="padding-bottom:8px">
        <div class="grow"><div class="big" style="font-size:36px">${fmtNum(stepsToday)}</div><div class="muted">${goal ? (stepsToday >= goal ? 'Tagesziel erreicht 🎉' : `noch ${fmtNum(goal - stepsToday)} bis ${fmtNum(goal)}`) : 'Heute'}</div></div>
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
    <div class="card pad"><div class="note"><strong style="color:var(--text)">Automatisch übertragen.</strong> Sobald die App online ist, richten wir einen Kurzbefehl ein, der Schritte und Gewicht aus Apple Health automatisch hier einträgt.</div></div>
  `;
}

function delta(latest, ref, label) {
  if (!ref) return '';
  const d = latest.kg - ref.kg;
  const color = Math.abs(d) < 0.05 ? 'var(--text2)' : d < 0 ? 'var(--green)' : 'var(--orange)';
  return `<div style="text-align:right"><div style="font-weight:700;color:${color};font-variant-numeric:tabular-nums">${d > 0 ? '+' : ''}${fmtKg(d)}</div><div class="meta" style="font-size:12px;color:var(--text2)">${label}</div></div>`;
}

function weightChart(pts) {
  const W = 320, H = 110, px = 6, py = 12;
  const vals = pts.map(p => p.kg);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { const m = (max + min) / 2; min = m - 0.6; max = m + 0.6; }
  const x = i => px + i * (W - 2 * px) / Math.max(1, pts.length - 1);
  const y = v => py + (H - 2 * py) * (1 - (v - min) / (max - min));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:110px">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--purple)" stop-opacity=".25"/><stop offset="1" stop-color="var(--purple)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#wg)"/>
      <path d="${line}" fill="none" stroke="var(--purple)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(pts[pts.length - 1].kg)}" r="4" fill="var(--purple)" stroke="var(--card)" stroke-width="2"/>
    </svg>
    <div class="chart-foot"><span>${fmtDM(pts[0].date)}</span><span>${fmtKg(min)} – ${fmtKg(max)} kg</span><span>${fmtDM(pts[pts.length - 1].date)}</span></div>`;
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
  addWeight() {
    openSheet({ title: 'Gewicht eintragen',
      html: `${field({ label: 'Gewicht (kg)', name: 'kg', type: 'number', placeholder: 'z. B. 78,4', attrs: 'step="0.1" min="20" max="300" inputmode="decimal" required', autofocus: true })}${field({ label: 'Datum', name: 'date', type: 'date', value: dateKey() })}`,
      onSubmit(d) {
        const kg = parseFloat(String(d.kg).replace(',', '.')); if (!(kg > 0)) return false;
        const date = d.date || dateKey();
        update(s => { s.weight = s.weight.filter(x => x.date !== date); s.weight.push({ date, kg: Math.round(kg * 10) / 10 }); });
      } });
  },
  delWeight(el) { if (confirm('Eintrag löschen?')) update(s => { s.weight = s.weight.filter(x => x.date !== el.dataset.date); }); },
};

export const changes = {
  setSteps(el) { const v = parseInt(el.value, 10); update(s => { if (v > 0) s.steps[dateKey()] = v; else delete s.steps[dateKey()]; }); },
};
