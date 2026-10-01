const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');
const career = SHS.career;

test('Hund startet mit 12 Monaten und darf erst ab 15 Monaten prüfen', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 1);
  assert.equal(career.darfPruefen(s), false);
  for (let i = 0; i < 14; i++) career.wocheBeenden(s); // 3 Monate ≈ 13,05 Wochen
  assert.ok(s.hund.alterMonate >= 15);
  assert.equal(career.darfPruefen(s), true);
});

test('Training steigert Werte, höchstens drei Einheiten je Woche', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 2);
  const vorher = s.hund.werte.anzeige;
  assert.equal(career.trainieren(s, 'anzeige').ok, true);
  assert.ok(s.hund.werte.anzeige > vorher);
  career.trainieren(s, 'impuls');
  career.trainieren(s, 'umwelt');
  assert.equal(career.trainieren(s, 'kondition').ok, false);
  career.wocheBeenden(s);
  assert.equal(career.trainieren(s, 'kondition').ok, true);
});

test('Klassenaufstieg erst, wenn in jeder Disziplin der LK mindestens 70 erreicht sind', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 3);
  const eintrag = (werte) => ({ pruefungId: 'x', lk: 1, art: 'ED', einzelwerte: werte, status: 'ok' });
  assert.equal(career.eintragen(s, eintrag({ truemmer: 85 })).aufstieg, false);
  assert.equal(career.eintragen(s, eintrag({ flaeche: 69 })).aufstieg, false);
  assert.equal(career.eintragen(s, eintrag({ behaeltnis: 90 })).aufstieg, false);
  assert.equal(career.eintragen(s, eintrag({ flaeche: 72 })).aufstieg, true);
  assert.equal(s.lk, 2);
});

test('Disqualifikation zählt nicht für den Aufstieg', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 4);
  career.eintragen(s, { pruefungId: 'x', lk: 1, art: 'DK', einzelwerte: { truemmer: 90, flaeche: 90, behaeltnis: null }, status: 'disq' });
  assert.equal(s.lk, 1);
  assert.deepEqual(s.lkBestwerte[1], {});
});

test('Es gibt immer kommende Ausschreibungen und eine Prüfung hat mindestens 8 Teams', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 5);
  assert.equal(s.ausschreibungen.filter((a) => !a.meisterschaft).length, 3);
  const teams = SHS.competition.kiTeams(s.ausschreibungen[0], 1, SHS.po.MINDEST_TEILNEHMER - 1);
  assert.equal(teams.length + 1, SHS.po.MINDEST_TEILNEHMER);
  const r = SHS.competition.simuliereTeam(teams[0], { ...s.ausschreibungen[0], art: 'DK' }, 1, 1);
  assert.deepEqual(Object.keys(r.einzelwerte).sort(), ['behaeltnis', 'flaeche', 'truemmer']);
});

test('HF-Erfahrung wächst mit Training, Übungssuchen und Prüfungen', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 6);
  const start = career.hfErfahrung(s);
  career.trainieren(s, 'anzeige');
  const nachTraining = career.hfErfahrung(s);
  career.uebungssucheVerbuchen(s, { gefunden: true }, 'korken');
  const nachUebung = career.hfErfahrung(s);
  career.eintragen(s, { pruefungId: 'x', lk: 1, art: 'ED', einzelwerte: { truemmer: 80 }, status: 'ok' });
  assert.ok(start < nachTraining && nachTraining < nachUebung && nachUebung < career.hfErfahrung(s));
});

test('Meisterschaften: ausgeschrieben, Qualifikation über LK-3-Dreikampf bzw. Landesmeisterschaft', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 12);
  const lm = s.ausschreibungen.find((a) => a.meisterschaft === 'LM');
  assert.ok(lm, 'Landesmeisterschaft in den nächsten 12 Wochen');
  assert.equal(career.meisterschaftsQualifikation(s, 'LM').ok, false);
  s.lk = 3;
  career.eintragen(s, { pruefungId: 'x', lk: 3, art: 'DK', einzelwerte: { truemmer: 85, flaeche: 80, behaeltnis: 85 }, punkte: 250, abk: 'G', status: 'ok', datum: '01.01.2027' });
  assert.equal(career.meisterschaftsQualifikation(s, 'LM').ok, true);
  assert.equal(career.meisterschaftsQualifikation(s, 'BM').ok, false);
  career.eintragen(s, { pruefungId: lm.id, meisterschaft: 'LM', lk: 3, art: 'DK', einzelwerte: {}, punkte: 280, abk: 'SG', status: 'ok', platz: 1, datum: '13.03.2027' });
  assert.equal(career.meisterschaftsQualifikation(s, 'BM').ok, true);
  assert.deepEqual(s.titel, ['Landesmeister 2027']);
});

test('Überlastung kann zu Verletzung führen; verletzt = kein Training, kein Start, heilt aus', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 21);
  s.hund.alterMonate = 20;
  s.hund.energie = 0.05;
  let verletzt = false;
  for (let i = 0; i < 40 && !verletzt; i++) {
    s.trainingsDieseWoche = 0; s.hund.energie = 0.05; s.woche += 0;
    const r = career.trainieren(s, 'kondition');
    verletzt = !!r.verletzung;
    s.verlauf.length = 0;
    s.seed += 1;
  }
  assert.ok(verletzt, 'bei sehr niedriger Energie tritt irgendwann eine Verletzung auf');
  assert.equal(career.istVerletzt(s), true);
  s.trainingsDieseWoche = 0;
  assert.equal(career.trainieren(s, 'anzeige').ok, false);
  assert.equal(career.darfPruefen(s), false);
  for (let i = 0; i < 4; i++) career.wocheBeenden(s);
  assert.equal(career.istVerletzt(s), false);
});

test('Alter und Schwierigkeit wirken auf den Lernfaktor', () => {
  const s = career.neuerSpielstand('HF', 'Hund', 'Mischling', 22);
  s.hund.alterMonate = 30;
  assert.equal(career.altersLernFaktor(s), 1);
  s.hund.alterMonate = 110;
  assert.ok(career.altersLernFaktor(s) < 0.85);
  assert.equal(career.altersPhase(s), 'senior');
  s.schwierigkeit = 'einsteiger';
  assert.ok(career.schwierigkeit(s).lernen > 1);
});
