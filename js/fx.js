// Effekte: Konfetti-Feier und Haptik (iOS-Trick über einen Switch-Schalter).

export function haptic() {
  const el = document.getElementById('haptic');
  if (el) el.click();
}

export function celebrate(colors = ['#34C759', '#00C7BE', '#FF2D55', '#FF9500', '#AF52DE', '#007AFF']) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const dpr = window.devicePixelRatio || 1;
  const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const ctx = c.getContext('2d');
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35,
    vx: (Math.random() - .5) * 18 * dpr, vy: (-14 - Math.random() * 10) * dpr,
    w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  (function frame(t) {
    const el = (t - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, el - 1.6) / .6);
    for (const p of parts) {
      p.vy += .5 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (el < 2.3) requestAnimationFrame(frame); else c.remove();
  })(start);
}
