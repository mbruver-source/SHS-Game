const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS, testHund } = require('./helfer');

function suche() {
  return SHS.simuliereSuche({ disziplin: 'truemmer', lk: 2, seed: 21, hund: testHund(60), gegenstand: 'korken', leine: true }, 0.6).suchlage;
}

test('Suche wird aufgezeichnet: Bilder im 0,1-s-Raster und Ereignisse mit Position', () => {
  const s = suche();
  const f = s.aufzeichnung.frames;
  assert.ok(f.length > 50);
  assert.ok(f[1][0] - f[0][0] < 0.25);
  assert.ok(s.aufzeichnung.ereignisse.some((e) => e.typ === 'wr'));
  assert.ok(s.aufzeichnung.ereignisse.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y)));
  // jeder vom WR notierte Fehler taucht als Ereignis auf
  const fehlerAnzahl = Object.values(s.richter.fehlerListe).reduce((a, b) => a + b, 0);
  assert.equal(s.aufzeichnung.ereignisse.filter((e) => e.typ === 'fehler').length, fehlerAnzahl);
});

test('Interpolation liefert Zwischenpositionen', () => {
  const frames = [[0, 0, 0, 0, 2, 0, 0, 1, 0, 0.5, 0, 0, 0, 0, 0], [1, 2, 4, 0, 2, 0, 0, 1, 0, 0.5, 1, 1, 0, 0, 0]];
  const z = SHS.nachbetrachtung.zustandBei(frames, 0.5);
  assert.equal(z.x, 1); assert.equal(z.y, 2); assert.equal(z.zustand, 'sucht'); assert.equal(z.hfx, 0.5);
});

test('Archiv behält nur die letzten 5 Suchen und ist klein genug für den Browser-Speicher', () => {
  const stand = SHS.career.neuerSpielstand('HF', 'Hund', 'Mischling', 3);
  for (let i = 0; i < 7; i++) SHS.nachbetrachtung.archivieren(stand, suche(), { art: 'Test' + i });
  assert.equal(stand.aufzeichnungen.length, SHS.nachbetrachtung.ARCHIV_MAX);
  assert.equal(stand.aufzeichnungen[4].meta.art, 'Test6');
  assert.ok(JSON.stringify(stand.aufzeichnungen).length < 300000);
});
