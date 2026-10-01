const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');

test('Geführte Suche: der Coach führt durch alle Schritte bis zum Ende', () => {
  const stand = SHS.career.neuerSpielstand('HF', 'Hund', 'Labrador Retriever', 1);
  const opts = SHS.einfuehrung.sucheOptionen(stand);
  const s = new SHS.SuchLage(opts);
  const szene = { s };
  const bot = new SHS.HFBot(s, 0.8, SHS.rng(1));
  const gesehen = new Set();
  // Spieler bewegt sich zuerst (Schritt 1), danach übernimmt der Bot
  for (let i = 0; i < 12; i++) { s.hfBewegen(1, 0, 0.1); opts.tutor.update(szene, 0.1); s.update(0.1); }
  for (let n = 0; n < 6000 && s.phase !== 'ende'; n++) {
    bot.update(0.1); s.update(0.1);
    gesehen.add(opts.tutor.update(szene, 0.1).titel.split(' · ')[0]);
  }
  gesehen.add(opts.tutor.update(szene, 0.1).titel.split(' · ')[0]);
  for (const nr of ['2', '3', '4', '8']) assert.ok(gesehen.has(nr), `Schritt ${nr} erreicht (gesehen: ${[...gesehen]})`);
});

test('Einführungssuche ist für einen frischen Hund lösbar', () => {
  let gefunden = 0;
  for (const rasse of ['Mischling', 'Labrador Retriever', 'Mops', 'Beagle', 'Chihuahua']) {
    const stand = SHS.career.neuerSpielstand('HF', 'Hund', rasse, 2);
    const o = SHS.einfuehrung.sucheOptionen(stand);
    if (SHS.simuliereSuche(o, 0.5).gefunden) gefunden += 1;
  }
  assert.ok(gefunden >= 4, `gefunden: ${gefunden}/5`);
});
