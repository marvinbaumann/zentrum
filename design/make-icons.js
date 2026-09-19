// Erzeugt die App-Icon-Varianten als SVG. Rendern nach PNG: qlmanage (macOS) – siehe unten.
const fs = require('fs');
const S = 1024;
const bg = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB05C"/><stop offset=".5" stop-color="#FF5E7E"/><stop offset="1" stop-color="#7B4DFF"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="sun" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF3D6"/></radialGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>
</defs>
<rect width="${S}" height="${S}" fill="url(#g)"/>`;

function rays(cx, cy, r1, r2, n, w, opacity = .96, offset = 0) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + offset;
    out += `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}" stroke="#fff" stroke-opacity="${opacity}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return out;
}

const variants = {
  // A: klassische Sonne mit 8 weichen Strahlen
  A: `${bg}<circle cx="512" cy="512" r="420" fill="url(#glow)"/>
    <circle cx="512" cy="512" r="190" fill="#fff" opacity=".35" filter="url(#soft)"/>
    ${rays(512, 512, 285, 372, 8, 62)}
    <circle cx="512" cy="512" r="178" fill="url(#sun)"/>`,
  // B: aufgehende Sonne über sanfter Welle
  B: `${bg}<circle cx="512" cy="560" r="430" fill="url(#glow)"/>
    ${rays(512, 560, 300, 392, 12, 46, .9, Math.PI / 12).split('<line').filter((s, i) => i === 0 || !/y1="(6[0-9]{2}|7[0-9]{2}|8[0-9]{2}|9[0-9]{2})/.test(s)).join('<line')}
    <circle cx="512" cy="560" r="200" fill="#fff" opacity=".35" filter="url(#soft)"/>
    <circle cx="512" cy="560" r="186" fill="url(#sun)"/>
    <path d="M-20 700 C 200 640, 380 760, 512 700 S 820 640, 1044 720 L 1044 1044 L -20 1044 Z" fill="#fff" fill-opacity=".22"/>
    <path d="M-20 790 C 220 740, 380 850, 512 800 S 830 740, 1044 820 L 1044 1044 L -20 1044 Z" fill="#fff" fill-opacity=".28"/>`,
  // C: Sonne mit ruhiger Aura (Atem-Ringe)
  C: `${bg}<circle cx="512" cy="512" r="440" fill="url(#glow)"/>
    <circle cx="512" cy="512" r="400" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="26"/>
    <circle cx="512" cy="512" r="318" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="26"/>
    <circle cx="512" cy="512" r="238" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="26"/>
    <circle cx="512" cy="512" r="170" fill="#fff" opacity=".4" filter="url(#soft)"/>
    <circle cx="512" cy="512" r="150" fill="url(#sun)"/>`,
};

for (const [k, body] of Object.entries(variants)) {
  fs.writeFileSync(`design/icon-${k}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${body}</svg>`);
}
console.log('svg ok');
