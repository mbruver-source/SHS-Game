const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SHS } = require('./helfer');

const root = path.join(__dirname, '..');

test('Versionsnummer ist überall gleich (Cache-Schutz in index.html)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, SHS.VERSION);
  for (const html of ['index.html', 'impressum.html', 'datenschutz.html']) {
    const inhalt = fs.readFileSync(path.join(root, html), 'utf8');
    const verweise = [...inhalt.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(verweise.length > 0, html);
    for (const v of verweise) assert.ok(v.endsWith(`?v=${SHS.VERSION}`), `${html}: ${v} ohne ?v=${SHS.VERSION}`);
  }
});

test('index.html bindet alle Skripte aus js/ ein', () => {
  const inhalt = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const f of fs.readdirSync(path.join(root, 'js'))) assert.ok(inhalt.includes(`js/${f}?v=`), `js/${f} fehlt in index.html`);
});
