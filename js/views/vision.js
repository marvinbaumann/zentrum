// Bilder-Screen: ein Bild pro Tag nach dem Startscreen, plus Verwaltung in den Einstellungen.
import { state, update, dateKey, uid } from '../store.js';
import { esc, icons } from '../ui.js';
import { openSheet, closeSheet, field } from '../sheet.js';
import { imgPut, imgDel, imgUrl, imgForget, compress } from '../images.js';
import { uploadImage, deleteRemoteImage, isConnected } from '../sync.js';

export const AREAS = { health: 'Health', wealth: 'Wealth', love: 'Love', happiness: 'Happiness', other: 'Sonstiges' };

export function pickToday(s) {
  const list = s.vision || [];
  if (!list.length) return null;
  const seed = parseInt(dateKey().replace(/-/g, ''), 10);
  return list[seed % list.length];
}

const SEEN_KEY = 'zentrum.visionDay';
export function visionSeenToday() { try { return localStorage.getItem(SEEN_KEY) === dateKey(); } catch { return false; } }

// Erscheint nur beim ersten Öffnen des Tages: eine Visualisierung für den Tag, nicht bei jedem Aufruf.
export async function showVision(s, onDone) {
  const v = pickToday(s);
  if (!v || visionSeenToday() || document.querySelector('.vision')) { onDone?.(); return; }
  const url = await imgUrl(v.id);
  if (!url) { onDone?.(); return; }
  try { localStorage.setItem(SEEN_KEY, dateKey()); } catch {}
  const el = document.createElement('div');
  el.className = 'vision';
  el.innerHTML = `
    <img src="${url}" alt="">
    <div class="vision-shade"></div>
    <div class="vision-body">
      <div class="vision-area">${esc(AREAS[v.area] || '')}</div>
      <div class="vision-caption">${esc(v.caption || '')}</div>
      ${v.step ? `<div class="vision-step"><span>Heute dafür</span>${esc(v.step)}</div>` : ''}
      <button type="button" class="btn btn-white vision-go">Weiter ${icons.arrowRight.replace('<svg', '<svg style="width:18px;height:18px"')}</button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('splash-open');
  let done = false;
  const close = () => { if (done) return; done = true; el.classList.add('out'); document.body.classList.remove('splash-open'); setTimeout(() => el.remove(), 450); onDone?.(); };
  el.querySelector('.vision-go').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el || e.target.tagName === 'IMG' || e.target.classList.contains('vision-shade')) close(); });
}

/* ---------- Verwaltung ---------- */
export async function openVisionManager() {
  const list = state.vision || [];
  const thumbs = await Promise.all(list.map(async v => ({ v, url: await imgUrl(v.id) })));
  openSheet({
    title: 'Meine Bilder',
    html: `
      <div class="note" style="padding:0 2px 12px">Jeden Morgen erscheint eines deiner Bilder, mit deinem Satz dazu. Bilder bleiben privat auf deinem iPhone${isConnected() ? ' und in deinem Daten-Repository' : ''}.</div>
      ${thumbs.map(({ v, url }) => `<div class="row">
        <span class="thumb" style="background-image:url('${url || ''}')"></span>
        <div class="grow"><div class="title">${esc(v.caption || 'Ohne Titel')}</div><div class="meta">${esc(AREAS[v.area] || '')}${v.step ? ` · ${esc(v.step)}` : ''}</div></div>
        <div class="ex-edit"><button type="button" class="mini-btn" data-action="visEdit" data-id="${v.id}">${icons.pencil}</button><button type="button" class="mini-btn red" data-action="visDel" data-id="${v.id}">${icons.trash}</button></div>
      </div>`).join('') || '<div class="empty">Noch keine Bilder.</div>'}
      <div class="stack"><label class="btn btn-primary" style="cursor:pointer">${icons.plus.replace('<svg', '<svg style="width:16px;height:16px"')} Bild hinzufügen<input type="file" accept="image/*" data-change="visAdd" style="display:none"></label></div>`,
    actions: {
      visAdd: async el => {
        const f = el.files?.[0]; if (!f) return;
        try {
          const blob = await compress(f);
          const id = uid();
          await imgPut(id, blob);
          openVisionForm({ id, caption: '', area: 'health', step: '' }, true, blob);
        } catch (e) { alert(e.message); }
      },
      visEdit: el => openVisionForm(state.vision.find(v => v.id === el.dataset.id), false),
      visDel: async el => {
        const id = el.dataset.id;
        if (!confirm('Bild entfernen?')) return;
        update(s => { s.vision = s.vision.filter(v => v.id !== id); });
        imgForget(id); await imgDel(id); deleteRemoteImage(id).catch(() => {});
        openVisionManager();
      },
    },
  });
}

async function openVisionForm(v, isNew, blob) {
  const url = await imgUrl(v.id);
  openSheet({
    title: isNew ? 'Neues Bild' : 'Bild bearbeiten',
    html: `<div class="vision-preview" style="background-image:url('${url || ''}')"></div>
      ${field({ label: 'Dein Satz dazu', name: 'caption', value: v.caption || '', placeholder: 'z. B. Der Körper, in dem ich mich stark fühle', autofocus: isNew, attrs: 'maxlength="80"' })}
      ${field({ label: 'Bereich', name: 'area', value: v.area || 'health', options: Object.entries(AREAS).map(([value, label]) => ({ value, label })) })}
      ${field({ label: 'Was du heute dafür tust (optional)', name: 'step', value: v.step || '', placeholder: 'z. B. Training durchziehen, 10.000 Schritte', attrs: 'maxlength="80"' })}
      <div class="hint">Bild plus konkreter Schritt wirkt stärker als das Bild allein.</div>`,
    onSubmit(d) {
      const entry = { id: v.id, caption: d.caption.trim(), area: d.area, step: d.step.trim(), addedAt: v.addedAt || dateKey() };
      update(s => { s.vision ||= []; const i = s.vision.findIndex(x => x.id === v.id); if (i >= 0) s.vision[i] = entry; else s.vision.push(entry); });
      if (isNew && blob) uploadImage(v.id, blob).catch(e => console.warn(e));
      setTimeout(openVisionManager, 300);
    },
  });
  // Abbrechen bei neuem Bild → lokale Datei wieder entfernen
  if (isNew) {
    const cancel = document.querySelector('#sheet-root [data-action="__closeSheet"]');
    cancel?.addEventListener('click', () => { if (!state.vision?.some(x => x.id === v.id)) { imgForget(v.id); imgDel(v.id); } }, { once: true });
  }
}
