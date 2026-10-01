const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS, testHund } = require('./helfer');
const po = SHS.po;

test('Geruch ist an der Quelle stärker als weit entfernt', () => {
  const q = { x: 0, y: 0, staerke: 1, reichweite: 1 };
  const w = SHS.scent.wind(0, 0.5);
  const nah = SHS.scent.konzentration(q, 0.1, 0, w, 0);
  const fern = SHS.scent.konzentration(q, 4, 0, w, 0);
  const luv = SHS.scent.konzentration(q, -1.5, 0, w, 0);
  const lee = SHS.scent.konzentration(q, 1.5, 0, w, 0);
  assert.ok(nah > fern);
  assert.ok(lee > luv, 'Mit dem Wind (Lee) riecht es stärker als gegen den Wind');
});

test('Suchlagen entsprechen den LK-Anforderungen', () => {
  for (const lk of [1, 2, 3]) {
    const b = SHS.layouts.erzeuge('behaeltnis', lk, 42);
    assert.equal(b.verstecke.length, po.LK[lk].behaeltnis.anzahl);
    assert.ok(b.verstecke.every((v) => v.kammern.length === po.LK[lk].behaeltnis.kammern));
    const f = SHS.layouts.erzeuge('flaeche', lk, 42);
    assert.equal(f.bereich.h, po.LK[lk].flaeche.laenge);
    assert.equal(f.mittelweg.w, 1);
    const t = SHS.layouts.erzeuge('truemmer', lk, 42);
    assert.equal(t.bereich.w, 4);
    for (const lage of [b, f, t]) {
      assert.equal(lage.quellen.filter((q) => q.typ === 'ziel').length, 1);
      const sp = lage.quellen.filter((q) => q.typ === 'spielzeug').length;
      const fu = lage.quellen.filter((q) => q.typ === 'futter').length;
      const di = lage.quellen.filter((q) => q.typ === 'differenzierung').length;
      const cfg = po.LK[lk][lage.disziplin];
      assert.equal(sp, cfg.spielzeug, `${lage.disziplin} LK${lk} Spielzeug`);
      assert.equal(fu, cfg.futter, `${lage.disziplin} LK${lk} Futter`);
      assert.equal(di, cfg.differenzierung ? 1 : 0, `${lage.disziplin} LK${lk} Differenzierung`);
    }
    assert.equal(!!b.eigengeruchVersteck, lk >= 2);
  }
});

test('Gleicher Seed ergibt die gleiche Suchlage und das gleiche Ergebnis', () => {
  const opts = { disziplin: 'truemmer', lk: 2, seed: 77, hund: testHund(55), gegenstand: 'korken', leine: true };
  assert.deepEqual(SHS.simuliereSuche(opts, 0.6), SHS.simuliereSuche(opts, 0.6));
});

test('Kopflose Simulation endet in allen Disziplinen und Klassen mit gültigem Ergebnis', () => {
  for (const lk of [1, 2, 3]) {
    for (const d of po.DISZIPLIN_REIHENFOLGE) {
      for (let i = 0; i < 4; i++) {
        const e = SHS.simuliereSuche({ disziplin: d, lk, seed: 100 + i, hund: testHund(50), gegenstand: 'korken', leine: lk < 3 }, 0.6);
        assert.ok(['ok', 'disq', 'abbruch'].includes(e.status));
        if (e.status === 'ok') assert.ok(e.punkte >= 0 && e.punkte <= 100);
      }
    }
  }
});

test('Ein starker Hund schneidet im Mittel besser ab als ein schwacher', () => {
  const mittel = (stufe) => {
    let s = 0;
    for (let i = 0; i < 15; i++) {
      const e = SHS.simuliereSuche({ disziplin: 'behaeltnis', lk: 2, seed: 300 + i, hund: testHund(stufe), gegenstand: 'korken', leine: true }, stufe / 100);
      s += e.punkte || 0;
    }
    return s / 15;
  };
  assert.ok(mittel(80) > mittel(20));
});

test('Handzeichen ohne Anzeige wird als Fehlanzeige gewertet', () => {
  const s = new SHS.SuchLage({ disziplin: 'truemmer', lk: 1, seed: 5, hund: testHund(50), gegenstand: 'korken' });
  s.armHeben(); // Bereitschaft am Ansatz
  assert.equal(s.phase, 'suche');
  s.befehlSuch();
  s.update(0.1);
  s.armHeben();
  assert.equal(s.richter.fehlanzeigen, 1);
});

test('Verlassen des Mittelwegs in der Fläche kostet Punkte', () => {
  const s = new SHS.SuchLage({ disziplin: 'flaeche', lk: 1, seed: 5, hund: testHund(50), gegenstand: 'korken', aussenreize: false });
  s.hf.x = s.hund.x; s.hf.y = s.hund.y;
  s.armHeben();
  s.befehlSuch();
  for (let i = 0; i < 20; i++) { s.hfBewegen(0, 1, 0.1); s.update(0.1); } // auf dem Mittelweg in die Fläche
  for (let i = 0; i < 20; i++) { s.hfBewegen(1, 0, 0.1); s.update(0.1); } // seitlich herunter
  assert.equal(s.richter.fehlerListe.mittelweg, 1);
});

test('LK 3: Anzeige braucht zwei Handzeichen, dazwischen geht der HF zum Hund', () => {
  const s = new SHS.SuchLage({ disziplin: 'truemmer', lk: 3, seed: 9, hund: testHund(90), gegenstand: 'korken', aussenreize: false });
  s.eigengeruchErledigt = true;
  s.hf.x = s.hund.x; s.hf.y = s.hund.y;
  s.armHeben();
  const ziel = s.quellen.find((q) => q.typ === 'ziel');
  s.hund.setzePosition(ziel.x + 0.1, ziel.y);
  s.hund.starteAnzeige(ziel, true, s.ctx);
  s.hund.anzeige.aktiv = false; s.hund.anzeige.ungenau = false;
  s.hund.w.anzeige = 1; // ruhiger Hund für den Test
  for (let i = 0; i < 25; i++) s.update(0.1);
  s.armHeben();
  for (let i = 0; i < 35; i++) s.update(0.1);
  assert.equal(s.warteZweitesZeichen, true);
  assert.equal(s.phase, 'suche');
  s.hf.x = s.hund.x - 0.4; s.hf.y = s.hund.y;
  s.armHeben();
  for (let i = 0; i < 55; i++) s.update(0.1);
  assert.equal(s.phase, 'ende');
  assert.equal(s.ergebnis.gefunden, true);
});

test('Fläche: der automatische HF bleibt in allen Leistungsklassen auf dem Mittelweg', () => {
  for (const lk of [1, 2, 3]) {
    for (let i = 0; i < 5; i++) {
      const s = new SHS.SuchLage({ disziplin: 'flaeche', lk, seed: 600 + i, hund: testHund(70), gegenstand: 'korken', leine: false });
      const bot = new SHS.HFBot(s, 0.8, SHS.rng(i + 1));
      for (let n = 0; n < 6000 && s.phase !== 'ende'; n++) { bot.update(0.1); s.update(0.1); }
      assert.equal(s.richter.fehlerListe.mittelweg || 0, 0, `LK ${lk}, Seed ${600 + i}`);
    }
  }
});

test('LK 3 Fläche: zweites Handzeichen auf dem Mittelweg auf Höhe des Hundes', () => {
  const s = new SHS.SuchLage({ disziplin: 'flaeche', lk: 3, seed: 3, hund: testHund(90), gegenstand: 'korken', aussenreize: false });
  s.armHeben();
  const ziel = s.quellen.find((q) => q.typ === 'ziel');
  s.hund.setzePosition(ziel.x + 0.1, ziel.y);
  s.hund.starteAnzeige(ziel, true, s.ctx);
  s.hund.anzeige.aktiv = false; s.hund.anzeige.ungenau = false; s.hund.w.anzeige = 1;
  for (let i = 0; i < 25; i++) s.update(0.1);
  s.armHeben();
  for (let i = 0; i < 35; i++) s.update(0.1);
  assert.equal(s.warteZweitesZeichen, true);
  const m = s.lage.mittelweg;
  s.hf.x = s.hund.x; s.hf.y = s.hund.y; // neben dem Hund, aber außerhalb des Mittelwegs
  s.armHeben();
  assert.equal(s.warteZweitesZeichen, true, 'Außerhalb des Mittelwegs wird das Zeichen nicht angenommen');
  s.hf.x = m.x + m.w / 2; s.hf.y = s.hund.y;
  s.armHeben();
  assert.equal(s.warteZweitesZeichen, false);
});
