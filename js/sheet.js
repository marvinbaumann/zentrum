import { esc } from './ui.js';

let sheetActions = {};

export function openSheet({ title, html, submitLabel = 'Sichern', onSubmit = null, actions = {} }) {
  sheetActions = actions;
  const root = document.getElementById('sheet-root');
  root.classList.remove('open');
  root.innerHTML = `
    <div class="overlay" data-action="__closeSheet"></div>
    <div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <div class="sheet-head">
        <button type="button" class="link-btn" data-action="__closeSheet">${onSubmit ? 'Abbrechen' : 'Schließen'}</button>
        <div class="sheet-title">${esc(title)}</div>
        ${onSubmit ? `<button type="submit" class="link-btn bold" form="sheet-form">${esc(submitLabel)}</button>` : '<span class="link-spacer"></span>'}
      </div>
      <form id="sheet-form" class="sheet-body" autocomplete="off">${html}</form>
    </div>`;
  const form = root.querySelector('#sheet-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (cb.name.endsWith('[]')) return;
      data[cb.name] = cb.checked;
    });
    form.querySelectorAll('input[type=checkbox][name$="[]"]').forEach(cb => {
      const key = cb.name.slice(0, -2);
      data[key] = data[key] || [];
      if (!Array.isArray(data[key])) data[key] = [];
      if (cb.checked) data[key].push(cb.value);
    });
    if (onSubmit && onSubmit(data) === false) return;
    closeSheet();
  });
  setTimeout(() => root.classList.add('open'), 20);
  const first = form.querySelector('[data-autofocus]');
  if (first) setTimeout(() => first.focus(), 320);
}

// Inhalt eines offenen Sheets austauschen, ohne es neu einzublenden (kein Flackern bei Schritt-Wechseln).
export function updateSheet({ html, actions = {} }) {
  const root = document.getElementById('sheet-root');
  const form = root.querySelector('#sheet-form');
  if (!form || !root.classList.contains('open')) return false;
  sheetActions = actions;
  form.innerHTML = html;
  const first = form.querySelector('[data-autofocus]');
  if (first) setTimeout(() => first.focus(), 50);
  return true;
}

export function closeSheet() {
  const root = document.getElementById('sheet-root');
  root.classList.remove('open');
  sheetActions = {};
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 280);
}

export function sheetAction(name) { return sheetActions[name]; }

export function field({ label, name, type = 'text', value = '', placeholder = '', options = null, attrs = '', autofocus = false }) {
  let input;
  if (options) {
    input = `<select name="${name}">${options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea name="${name}" placeholder="${esc(placeholder)}" ${attrs} ${autofocus ? 'data-autofocus' : ''}>${esc(value)}</textarea>`;
  } else {
    input = `<input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs} ${autofocus ? 'data-autofocus' : ''}>`;
  }
  return `<label class="field"><span>${esc(label)}</span>${input}</label>`;
}

export function toggle({ label, name, checked }) {
  return `<div class="toggle"><span>${esc(label)}</span><label class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><i></i></label></div>`;
}
