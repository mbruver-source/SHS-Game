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
  r.fehler('aktivBellen');
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.such, 60 - SHS.po.ABZUEGE.hilfe.max);
  assert.equal(e.anzeige, 40 - SHS.po.ABZUEGE.aktivBellen.punkte);
});

test('Notendeckel „Max. G“ begrenzt die Anzeige auf 35', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('aktivKratzen');
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.anzeige, 35);
  assert.equal(e.such, 60);
  assert.ok(e.begruendung.some((z) => /höchstens Gut \(35\)/.test(z)));
  assert.ok(!e.begruendung.some((z) => /NaN/.test(z)));
});

test('Deckel plus Punktabzüge: der niedrigere Wert gilt', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('aktivLecken'); // Max. SG = 37
  r.fehler('aufstehen'); // −6 → 34
  r.fund();
  assert.equal(r.ergebnis().anzeige, 34);
  const r2 = new SHS.Wertungsrichter(1, 'truemmer');
  r2.fehler('aktivLecken');
  r2.fehler('ungenau'); // −5 → 35, Deckel 37 greift nicht
  r2.fund();
  assert.equal(r2.ergebnis().anzeige, 35);
});

test('Zwei Deckel stapeln nicht, der niedrigste gilt', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('aktivLecken'); // 37
  r.fehler('aktivKratzen'); // 35
  r.fund();
  assert.equal(r.ergebnis().anzeige, 35);
});

test('Unruhige Anzeige: Max. SG, jedes weitere Mal −1', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('unruhig');
  r.fund();
  assert.equal(r.ergebnis().anzeige, 37);
  r.fehler('unruhig'); r.fehler('unruhig');
  assert.equal(r.ergebnis().anzeige, 37); // 40 − 3 = 37
  r.fehler('unruhig'); r.fehler('unruhig');
  assert.equal(r.ergebnis().anzeige, 36); // Abzug bei 4 gedeckelt: 40 − 4
});

test('„Bis 0“-Regeln können die ganze Teilleistung aufbrauchen', () => {
  const r = new SHS.Wertungsrichter(1, 'flaeche');
  for (let i = 0; i < 25; i++) r.fehler('mittelweg');
  for (let i = 0; i < 9; i++) r.fehler('unterstuetzung');
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.such, 0);
  assert.equal(e.anzeige, 0);
  assert.equal(e.punkte, 0);
});

test('Ohne Fund: Deckel der Anzeige ohne Wirkung, eine Fehlanzeige kostet weiter 10', () => {
  const r = new SHS.Wertungsrichter(2, 'truemmer');
  r.fehler('aktivKratzen');
  r.fehlanzeige();
  r.zeitAbgelaufen();
  const e = r.ergebnis();
  assert.equal(e.anzeige, 0);
  assert.equal(e.punkte, 50);
});

test('Teilnoten-Bänder der Richterhilfe', () => {
  const po = SHS.po;
  assert.equal(po.teilnote(58, 'such'), 'Vorzüglich');
  assert.equal(po.teilnote(57, 'such'), 'Sehr Gut');
  assert.equal(po.teilnote(48, 'such'), 'Gut');
  assert.equal(po.teilnote(42, 'such'), 'Befriedigend');
  assert.equal(po.teilnote(41, 'such'), null);
  assert.equal(po.teilnote(37, 'anzeige'), 'Sehr Gut');
  assert.equal(po.teilnote(28, 'anzeige'), 'Befriedigend');
});

test('Alte Fehlerart „aktiv“ aus Spielständen bleibt lesbar und rechenbar', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('aktiv');
  r.fund();
  assert.equal(r.ergebnis().anzeige, 32);
});
