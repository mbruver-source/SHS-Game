// Baut dist/artifact/index.html für die Veröffentlichung als Claude-Artifact (zum Spielen auf dem Handy).
// Die Artifact-Umgebung legt das HTML-Grundgerüst selbst an; deshalb nur Titel, Stylesheet und Body-Inhalt.
// Aufruf: node tools/artifact.js  -> gibt zusätzlich die Liste der mitzuveröffentlichenden Dateien aus.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const quelle = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = quelle.slice(quelle.indexOf('<body>') + 6, quelle.lastIndexOf('</body>')).trim();
const seite = `<title>SHS Spürhundesport</title>
<link rel="stylesheet" href="css/style.css">
${body}
`;
const ziel = path.join(root, 'dist', 'artifact');
fs.mkdirSync(ziel, { recursive: true });
fs.writeFileSync(path.join(ziel, 'index.html'), seite);

const dateien = { 'css/style.css': 'css/style.css' };
for (const m of body.matchAll(/src="(js\/[^"]+)"/g)) dateien[m[1]] = m[1];
console.log(JSON.stringify(dateien));
