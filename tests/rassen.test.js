const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS, testHund } = require('./helfer');

test('30 verbreitete Rassen plus Mischling, jede mit Werten, Körperbau und Farbe', () => {
  const liste = SHS.rassen.liste;
  assert.equal(liste.length, 31);
  assert.ok(liste.includes('Mischling'));
  for (const name of liste) {
    const r = SHS.rassen.rasse(name);
    assert.ok(r.werte && r.form && Object.keys(r.farben).length >= 1, name);
    const f = SHS.rassen.fell(name);
    assert.ok(/^#[0-9a-f]{6}$/i.test(f.grund), `${name}: Grundfarbe`);
    const h = SHS.dog.neuerHund('X', name);
    for (const w of Object.values(h.werte)) assert.ok(w >= 5 && w <= 95, `${name}: Wertebereich`);
  }
});

test('Unbekannte Fellvariante fällt auf die erste Variante der Rasse zurück', () => {
  assert.equal(SHS.rassen.fell('Labrador Retriever', 'gibtsnicht').name, 'Gelb');
  assert.equal(SHS.rassen.fell('Labrador Retriever', 'schwarz').name, 'Schwarz');
});

test('Trainingsrhythmus Mo/Mi/Fr: Erholung an den freien Tagen und am Wochenende', () => {
  const s = SHS.career.neuerSpielstand('HF', 'Hund', 'Mischling', 9);
  assert.equal(SHS.career.naechsterTrainingstag(s), 'Montag');
  SHS.career.trainieren(s, 'anzeige');
  const nachMontag = s.hund.energie;
  assert.equal(SHS.career.naechsterTrainingstag(s), 'Mittwoch');
  SHS.career.trainieren(s, 'impuls');
  // Mittwoch: Dienstag-Erholung gutgeschrieben, dann Belastung
  assert.ok(Math.abs(s.hund.energie - (nachMontag + 0.16 - 0.3)) < 1e-9);
  SHS.career.trainieren(s, 'umwelt');
  assert.ok(s.hund.energie > 0.35, 'Drei Einheiten mit Ruhetagen machen den Hund nicht müde');
  SHS.career.wocheBeenden(s);
  assert.ok(s.hund.energie > 0.95, 'Wochenende erholt fast vollständig');
});

test('Gut ausgebildete Hunde umrunden Verstecke häufiger und vollständiger', () => {
  const zaehle = (stufe) => {
    let umrundungen = 0; let bogen = 0;
    for (let i = 0; i < 6; i++) {
      const s = new SHS.SuchLage({ disziplin: 'truemmer', lk: 1, seed: 40 + i, hund: testHund(stufe), gegenstand: 'korken', aussenreize: false });
      s.armHeben(); s.befehlSuch();
      let vorher = null;
      for (let n = 0; n < 400 && s.phase === 'suche'; n++) {
        s.update(0.1);
        const u = s.hund.umrundung;
        if (u && u !== vorher) { umrundungen += 1; bogen += u.punkte.length; }
        vorher = u;
      }
    }
    return { umrundungen, punkteJe: bogen / Math.max(1, umrundungen) };
  };
  const gut = zaehle(85); const schwach = zaehle(15);
  assert.ok(gut.umrundungen > schwach.umrundungen);
  assert.ok(gut.punkteJe > schwach.punkteJe);
});
