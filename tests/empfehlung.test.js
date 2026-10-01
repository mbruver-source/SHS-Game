const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');

function stand() {
  const s = SHS.career.neuerSpielstand('HF', 'Hund', 'Mischling', 11);
  for (const k of Object.keys(s.hund.werte)) s.hund.werte[k] = 60;
  for (const k of Object.keys(s.hund.vertrautheit)) s.hund.vertrautheit[k] = 0.8;
  s.lkBestwerte[1] = { truemmer: 80, flaeche: 80, behaeltnis: 80 };
  s.ausschreibungen = [];
  return s;
}

test('Schwacher Wert führt zur passenden Trainingsempfehlung', () => {
  const s = stand();
  s.hund.werte.impuls = 20;
  const e = SHS.empfehlung.empfehlungen(s);
  assert.equal(e.liste[0].training, 'impuls');
  assert.ok(e.liste[0].gruende.some((g) => g.includes('Impulskontrolle')));
});

test('Fehler aus den letzten Suchen fließen ein (aktive Anzeige -> Anzeigetraining)', () => {
  const s = stand();
  for (let i = 0; i < 3; i++) {
    SHS.career.protokolliereSuche(s, { art: 'uebung', disziplin: 'truemmer', lk: 1, ergebnis: { status: 'ok', punkte: 80, gefunden: true, fehlanzeigen: 0, fehler: { aktiv: 1, unruhig: 2 } } });
  }
  const e = SHS.empfehlung.empfehlungen(s);
  assert.equal(e.liste[0].training, 'anzeige');
  assert.equal(e.fehler.summe.unruhig, 6);
});

test('Unbekannte Gegenstände für die LK werden zur Geruchskonditionierung empfohlen', () => {
  const s = stand();
  s.lk = 2;
  s.hund.vertrautheit = { feuerzeug: 0.2, klammer: 0.1, korken: 0.9, schluessel: 0.1, leder: 0.1 };
  const e = SHS.empfehlung.empfehlungen(s);
  assert.ok(e.liste.some((x) => x.training === 'geruch' && x.gegenstand === 'feuerzeug'));
});

test('Fehlende Disziplin für den Aufstieg wird als Übungssuche empfohlen', () => {
  const s = stand();
  s.lkBestwerte[1] = { truemmer: 80, behaeltnis: 75 };
  const e = SHS.empfehlung.empfehlungen(s);
  assert.ok(e.liste.some((x) => x.uebung === 'flaeche'));
});

test('Müder Hund: Erholung steht an erster Stelle', () => {
  const s = stand();
  s.hund.energie = 0.2;
  assert.equal(SHS.empfehlung.empfehlungen(s).liste[0].ziel, 'ruhe');
});
