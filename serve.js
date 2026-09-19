// Kleiner Entwicklungs-Server (nur lokal): node serve.js [port] [--lan]
// --lan macht die App im eigenen WLAN erreichbar (z. B. vom iPhone aus).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = __dirname;
const args = process.argv.slice(2);
const lan = args.includes('--lan');
const port = Number(args.find(a => /^\d+$/.test(a))) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Zentrum läuft auf http://127.0.0.1:${port}`);
  if (lan) {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
    ips.forEach(ip => console.log(`Im WLAN erreichbar unter http://${ip}:${port}`));
  }
});
