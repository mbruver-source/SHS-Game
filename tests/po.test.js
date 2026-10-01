const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');
const po = SHS.po;

test('Wertnoten Einzeldisziplin wie im SHS-Prüfungsprogramm (shs_core.py)', () => {
  assert.equal(po.wertnote(100, 'ED').abk, 'V');
  assert.equal(po.wertnote(96, 'ED').abk, 'V');
  assert.equal(po.wertnote(95, 'ED').abk, 'SG');
  assert.equal(po.wertnote(90, 'ED').abk, 'SG');
  assert.equal(po.wertnote(89, 'ED').abk, 'G');
  assert.equal(po.wertnote(80, 'ED').abk, 'G');
  assert.equal(po.wertnote(79, 'ED').abk, 'B');
  assert.equal(po.wertnote(70, 'ED').abk, 'B');
  assert.equal(po.wertnote(69, 'ED').abk, 'nB');
});

test('Wertnoten Dreikampf', () => {
  assert.equal(po.wertnote(286, 'DK').abk, 'V');
  assert.equal(po.wertnote(285, 'DK').abk, 'SG');
  assert.equal(po.wertnote(270, 'DK').abk, 'SG');
  assert.equal(po.wertnote(240, 'DK').abk, 'G');
  assert.equal(po.wertnote(210, 'DK').abk, 'B');
});

test('Dreikampf: jede Disziplin braucht mindestens 70 Punkte', () => {
  const ok = po.bewertePruefung({ truemmer: 70, flaeche: 100, behaeltnis: 100 }, 'DK');
  assert.equal(ok.bestanden, true);
  assert.equal(ok.punkte, 270);
  assert.equal(ok.abk, 'SG');
  const nb = po.bewertePruefung({ truemmer: 69, flaeche: 100, behaeltnis: 100 }, 'DK');
  assert.equal(nb.bestanden, false);
  assert.equal(nb.abk, 'nB');
});

test('Disqualifikation und Abbruch', () => {
  assert.equal(po.bewertePruefung({ truemmer: 90 }, 'ED', 'disq').abk, 'DISQ');
  assert.equal(po.bewertePruefung({ truemmer: 90, flaeche: null, behaeltnis: 95 }, 'DK').abk, 'ABBR');
});

test('Platzierung: Gleichstand gleicher Platz, folgender Platz entfällt, nB ohne Platz', () => {
  const t = [95, 90, 90, 80, 60].map((p) => ({ ergebnis: po.bewertePruefung({ x: p }, 'ED') }));
  po.platzierung(t);
  assert.deepEqual(t.map((x) => x.platz), [1, 2, 2, 4, null]);
});

test('Leistungsklassen laut PO', () => {
  assert.equal(po.LK[1].behaeltnis.anzahl, 6);
  assert.equal(po.LK[1].behaeltnis.kammern, 3);
  assert.equal(po.LK[2].behaeltnis.anzahl, 8);
  assert.equal(po.LK[2].behaeltnis.kammern, 4);
  assert.equal(po.LK[3].behaeltnis.anzahl, 10);
  assert.equal(po.LK[3].behaeltnis.kammern, 5);
  assert.deepEqual([1, 2, 3].map((l) => po.LK[l].flaeche.laenge), [20, 25, 30]);
  assert.deepEqual([1, 2, 3].map((l) => po.suchzeit(l, 'flaeche')), [300, 360, 420]);
  assert.deepEqual([1, 2, 3].map((l) => po.suchzeit(l, 'truemmer')), [300, 300, 300]);
  assert.deepEqual(po.LK[1].anzeige.phasen, [3]);
  assert.deepEqual(po.LK[2].anzeige.phasen, [5]);
  assert.deepEqual(po.LK[3].anzeige.phasen, [3, 5]);
  assert.equal(po.leineErlaubt(2, 'truemmer'), true);
  assert.equal(po.leineErlaubt(3, 'truemmer'), false);
});
