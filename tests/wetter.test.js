const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS, testHund } = require('./helfer');

test('Wetter: Jahreszeit bestimmt die Temperatur, gleicher Seed = gleiches Wetter', () => {
  const sommer = []; const winter = [];
  for (let i = 0; i < 40; i++) { sommer.push(SHS.wetter.erzeuge(i, 7).temp); winter.push(SHS.wetter.erzeuge(i, 1).temp); }
  const mittel = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mittel(sommer) > mittel(winter) + 10);
  assert.deepEqual(SHS.wetter.erzeuge(5, 3), SHS.wetter.erzeuge(5, 3));
});

test('Wetter wirkt auf die Geruchsquellen und der Wind dreht während der Suche', () => {
  let regen = null; let seed = 0;
  for (; seed < 500 && !regen; seed++) { const w = SHS.wetter.erzeuge(seed, 11); if (w.regen === 2) regen = w; }
  const s = new SHS.SuchLage({ disziplin: 'flaeche', lk: 1, seed: seed - 1, monat: 11, hund: testHund(50), gegenstand: 'korken' });
  const ohne = new SHS.SuchLage({ disziplin: 'flaeche', lk: 1, seed: seed - 1, monat: 11, hund: testHund(50), gegenstand: 'korken', wetter: false });
  assert.ok(s.quellen[0].staerke < ohne.quellen[0].staerke, 'Starkregen schwächt den Geruch');
  s.armHeben(); s.befehlSuch();
  const r0 = s.lage.wind.richtung;
  for (let i = 0; i < 300; i++) s.update(0.1);
  assert.notEqual(Math.round(s.lage.wind.richtung), Math.round(r0));
});

test('Ungehorsam: entlaufener Hund, der auf dreimaliges „Hier!“ nicht kommt -> Abbruch', () => {
  const h = testHund(5);
  const s = new SHS.SuchLage({ disziplin: 'truemmer', lk: 1, seed: 8, hund: h, gegenstand: 'korken', aussenreize: false });
  s.armHeben(); s.befehlSuch(); s.update(0.1);
  s.hund.reizZiel = { x: 0.3, y: 0.3 };
  s.hund.setzeZustand('entlaufen');
  s.hund.rnd = () => 0.99; // Hund ignoriert die Hörzeichen
  for (let i = 0; i < 3; i++) { s.letzteHilfe = -99; s.befehlHier(); }
  assert.equal(s.phase, 'ende');
  assert.equal(s.ergebnis.status, 'abbruch');
});

test('Ungehorsam: Hund verlässt den Vorführplatz -> Abbruch', () => {
  const s = new SHS.SuchLage({ disziplin: 'truemmer', lk: 1, seed: 8, hund: testHund(50), gegenstand: 'korken', aussenreize: false });
  s.armHeben(); s.befehlSuch();
  s.hund.setzePosition(-2, -2);
  s.hund.setzeZustand('entlaufen'); s.hund.reizZiel = { x: -3, y: -3 };
  for (let i = 0; i < 20 && s.phase !== 'ende'; i++) s.update(0.1);
  assert.equal(s.ergebnis.status, 'abbruch');
});

test('Läufigkeit nur bei Hündinnen, wiederkehrend', () => {
  const p = SHS.career.neuesProfil('A', 'Luna', 'Mischling', null, 3, 'Hündin');
  const t = p.teams[0];
  t.hund.alterMonate = 20;
  const wochen = Array.from({ length: 52 }, (_, i) => SHS.career.istLaeufig(t, i + 1)).filter(Boolean).length;
  assert.equal(wochen, 6, 'zweimal im Jahr je 3 Wochen');
  t.hund.geschlecht = 'Rüde';
  assert.equal(SHS.career.istLaeufig(t, 5), false);
});
