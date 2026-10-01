// Kleiner statischer Entwicklungs-Server (nur zum Testen; das Spiel selbst braucht keinen Server).
// Aufruf: node tools/server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8123;
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const datei = path.join(root, url === '/' ? 'index.html' : url);
  if (!datei.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(datei, (err, data) => {
    if (err) { res.writeHead(404); res.end('Nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': typen[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`SHS-Game: http://localhost:${port}`));
