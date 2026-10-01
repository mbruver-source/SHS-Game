const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');
const career = SHS.career;

// einfacher localStorage-Ersatz für Node
function speicherAttrappe() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  return m;
}

test('Profil mit mehreren Hunden: gemeinsamer Kalender, eigene Werte', () => {
  const p = career.neuesProfil('Alex', 'Aiko', 'Malinois', 'falb', 77);
  career.wocheBeendenProfil(p);
  const b = career.hundAufnehmen(p, 'Bella', 'Beagle', 'dreifarbig');
  assert.equal(p.teams.length, 2);
  assert.equal(p.aktiv, 1);
  assert.equal(b.woche, p.teams[0].woche, 'neuer Hund startet in der aktuellen Woche');
  assert.deepEqual(b.ausschreibungen.map((a) => a.id), p.teams[0].ausschreibungen.map((a) => a.id), 'gleiche Ausschreibungen');
  career.trainieren(p.teams[0], 'anzeige');
  assert.equal(p.teams[1].trainingsDieseWoche, 0, 'Training ist je Hund');
  career.wocheBeendenProfil(p);
  assert.equal(p.teams[0].woche, p.teams[1].woche);
});

test('HF-Erfahrung zählt über alle Hunde', () => {
  const p = career.neuesProfil('Alex', 'Aiko', 'Mischling', 'braungefleckt', 5);
  career.hundAufnehmen(p, 'Bella', 'Mischling');
  const vorher = career.hfErfahrungProfil(p);
  career.trainieren(p.teams[1], 'impuls');
  assert.ok(career.hfErfahrungProfil(p) > vorher);
});

test('Prüfung: höchstens 2 eigene Hunde je Ausschreibung werden vermerkt', () => {
  const p = career.neuesProfil('Alex', 'Aiko', 'Mischling', null, 6);
  career.startVermerken(p, 'p3', { hund: 'Aiko', lk: 1 });
  career.startVermerken(p, 'p3', { hund: 'Bella', lk: 1 });
  assert.equal(career.eigeneStarts(p, 'p3').length, career.MAX_HUNDE_JE_PRUEFUNG);
  assert.equal(career.eigeneStarts(p, 'p4').length, 0);
});

test('Speicher: mehrere Benutzer, alter Einzel-Spielstand wird übernommen', () => {
  const m = speicherAttrappe();
  const alt = career.neuerSpielstand('Marco', 'Aiko', 'Labrador Retriever', 9);
  m.set('shs-game-spielstand', JSON.stringify(alt));
  const liste = SHS.storage.profile();
  assert.equal(liste.length, 1);
  assert.equal(liste[0].name, 'Marco');
  assert.deepEqual(liste[0].hunde, ['Aiko']);
  const neu = career.neuesProfil('Kim', 'Bello', 'Pudel', 'schwarz', 10);
  assert.equal(SHS.storage.speichernProfil(neu), true);
  assert.equal(SHS.storage.profile().length, 2);
  const geladen = SHS.storage.ladenProfil(neu.id);
  assert.equal(geladen.teams[0].hund.name, 'Bello');
  SHS.storage.loeschenProfil(neu.id);
  assert.equal(SHS.storage.profile().length, 1);
  assert.ok(m.has('shs-game-spielstand'), 'alter Spielstand bleibt als Sicherung erhalten');
});

test('Erfolge werden einmalig vergeben', () => {
  const p = SHS.career.neuesProfil('A', 'Aiko', 'Mischling', null, 4);
  assert.deepEqual(SHS.erfolge.pruefen(p).map((e) => e.id), []);
  SHS.career.protokolliereSuche(p.teams[0], { art: 'uebung', disziplin: 'truemmer', lk: 1, ergebnis: { status: 'ok', punkte: 100, gefunden: true, fehler: {} } });
  const neu = SHS.erfolge.pruefen(p).map((e) => e.id);
  assert.ok(neu.includes('erste_suche') && neu.includes('fund') && neu.includes('fehlerfrei'));
  assert.deepEqual(SHS.erfolge.pruefen(p), [], 'nicht doppelt');
});
