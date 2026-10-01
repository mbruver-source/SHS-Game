// Setzt eine neue Versionsnummer überall gleichzeitig:
//   js/version.js, package.json und die ?v=…-Anhänge in index.html (verhindert gemischte Dateistände im Browser-Cache).
// Aufruf: node tools/version.js 1.2.3
const fs = require('fs');
const path = require('path');

const neu = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(neu || '')) {
  console.error('Bitte Version im Format X.Y.Z angeben, z. B.: node tools/version.js 1.2.3');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const datei = (n) => path.join(root, n);

const vjs = fs.readFileSync(datei('js/version.js'), 'utf8').replace(/SHS\.VERSION = '[^']+'/, `SHS.VERSION = '${neu}'`);
fs.writeFileSync(datei('js/version.js'), vjs);

const pkg = JSON.parse(fs.readFileSync(datei('package.json'), 'utf8'));
pkg.version = neu;
fs.writeFileSync(datei('package.json'), JSON.stringify(pkg, null, 2) + '\n');

for (const html of ['index.html', 'impressum.html', 'datenschutz.html']) {
  const inhalt = fs.readFileSync(datei(html), 'utf8')
    .replace(/((?:src|href)="(?:js|css)\/[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${neu}"`);
  fs.writeFileSync(datei(html), inhalt);
}
console.log(`Version ${neu} gesetzt.`);
