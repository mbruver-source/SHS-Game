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
  assert.equal(s.ausschreibungen.length, 3);
  const teams = SHS.competition.kiTeams(s.ausschreibungen[0], 1, SHS.po.MINDEST_TEILNEHMER - 1);
  assert.equal(teams.length + 1, SHS.po.MINDEST_TEILNEHMER);
  const r = SHS.competition.simuliereTeam(teams[0], { ...s.ausschreibungen[0], art: 'DK' }, 1, 1);
  assert.deepEqual(Object.keys(r.einzelwerte).sort(), ['behaeltnis', 'flaeche', 'truemmer']);
});
