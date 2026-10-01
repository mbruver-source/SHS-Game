// Lädt die Spiel-Skripte in Node (sie hängen sich an globalThis.SHS).
const path = require('path');

const DATEIEN = ['version', 'po', 'rng', 'scent', 'layouts', 'judge', 'rassen', 'dog', 'suchlage', 'career', 'empfehlung', 'competition'];
for (const f of DATEIEN) require(path.join(__dirname, '..', 'js', f + '.js'));

function testHund(stufe) {
  const SHS = globalThis.SHS;
  const h = SHS.dog.neuerHund('Test', 'Mischling');
  for (const k of Object.keys(h.werte)) h.werte[k] = stufe;
  for (const k of Object.keys(h.vertrautheit)) h.vertrautheit[k] = stufe / 100;
  return h;
}

module.exports = { SHS: globalThis.SHS, testHund };
