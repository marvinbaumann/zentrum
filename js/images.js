// Bilder lokal in IndexedDB halten (Blobs), Komprimierung über Canvas.
const DB = 'zentrum', STORE = 'images';
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
    const req = fn(st);
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const imgPut = (id, blob) => tx('readwrite', st => st.put(blob, id));
export const imgGet = id => tx('readonly', st => st.get(id));
export const imgDel = id => tx('readwrite', st => st.delete(id));
export const imgKeys = () => tx('readonly', st => st.getAllKeys());

const urls = new Map();
export async function imgUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await imgGet(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob); urls.set(id, u); return u;
}
export function imgForget(id) { const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } }

// Datei → komprimiertes JPEG (max. Kante 1400 px)
export function compress(file, max = 1400, quality = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob(b => b ? res(b) : rej(new Error('Bild konnte nicht verarbeitet werden')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('Bild konnte nicht gelesen werden')); };
    img.src = src;
  });
}
export const blobToBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
