const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');

test('Fehlerfreie Suche mit Fund = 100 Punkte', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.punkte, 100);
  assert.equal(e.such, 60);
  assert.equal(e.anzeige, 40);
});

test('Ohne Fund nur Suchleistung (max. 60, nicht bestanden)', () => {
  const r = new SHS.Wertungsrichter(1, 'flaeche');
  r.zeitAbgelaufen();
  const e = r.ergebnis();
  assert.equal(e.punkte, 60);
  assert.equal(e.anzeige, 0);
  assert.equal(e.bestanden, false);
});

test('Fehlanzeige kostet 10 Punkte, die dritte führt zur Disqualifikation', () => {
  const r = new SHS.Wertungsrichter(2, 'behaeltnis');
  assert.equal(r.fehlanzeige().abbruch, false);
  r.fund();
  assert.equal(r.ergebnis().punkte, 90);
  const r2 = new SHS.Wertungsrichter(2, 'behaeltnis');
  r2.fehlanzeige(); r2.fehlanzeige();
  assert.equal(r2.fehlanzeige().abbruch, true);
  assert.equal(r2.ergebnis().status, 'disq');
});

test('Abzüge sind je Fehlerart gedeckelt und auf Such-/Anzeigebereich verteilt', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  for (let i = 0; i < 20; i++) r.fehler('hilfe');
  r.fehler('aktiv');
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.such, 60 - SHS.po.ABZUEGE.hilfe.max);
  assert.equal(e.anzeige, 40 - SHS.po.ABZUEGE.aktiv.punkte);
});
