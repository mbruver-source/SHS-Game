const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS, testHund } = require('./helfer');

function lage(disziplin, lk = 1, seed = 11) {
  const s = new SHS.SuchLage({ disziplin, lk, seed, hund: testHund(50), gegenstand: 'korken', leine: true });
  s.phase = 'suche';
  return s;
}

test('Festpunkte: Markieren 10, ausgelassene Behältnisse 0,5 (kaufmännisch gerundet)', () => {
  const r = new SHS.Wertungsrichter(1, 'behaeltnis');
  r.fehler('markieren');
  r.fund();
  assert.equal(r.ergebnis().such, 50);

  const a = new SHS.Wertungsrichter(1, 'behaeltnis');
  a.fehler('ausgelassen'); a.fund();
  assert.equal(a.ergebnis().such, 60); // 59,5 → 60
  const b = new SHS.Wertungsrichter(1, 'behaeltnis');
  b.fehler('ausgelassen'); b.fehler('ausgelassen'); b.fehler('ausgelassen'); b.fund();
  assert.equal(b.ergebnis().such, 59); // 58,5 → 59
  assert.ok(b.ergebnis().begruendung.some((z) => /Ausgelassenes Behältnis \(3×\)/.test(z)));
});

test('Neue Notendeckel: Suche und Anzeige getrennt', () => {
  const r = new SHS.Wertungsrichter(3, 'behaeltnis');
  r.fehler('rueckweg'); // Suche max. SG = 57
  r.fehler('anzeigeGefuehrt'); // Suche max. G = 53
  r.fehler('kinnanzeige'); // Anzeige max. SG = 37
  r.fehler('ersterFundVerpasst'); // Anzeige max. G = 35
  r.fund();
  const e = r.ergebnis();
  assert.equal(e.such, 53);
  assert.equal(e.anzeige, 35);
});

test('Suchlage wertet die neuen Hundeereignisse', () => {
  const s = lage('truemmer');
  for (const typ of ['startzoegern', 'markieren', 'leine', 'lokalisiert', 'ueberlaufen']) s.hundEreignis({ typ });
  assert.deepEqual(Object.keys(s.richter.fehlerListe).sort(),
    ['ersterFundVerpasst', 'leine', 'lokalisiert', 'markieren', 'startzoegern']);
});

test('Führung: Richtungszeichen auf den Gegenstand, Anzeige geführt, HF schickt weg → Abzug', () => {
  const s = lage('truemmer');
  const ziel = s.lage.quellen.find((q) => q.typ === 'ziel');
  s.hund.richtungsZeichen(ziel.x + 0.5, ziel.y);
  s.hund.starteAnzeige(ziel, true, s.ctx);
  assert.equal(s.hund.anzeige.gefuehrt, true);
  s.hund.setzeZustand('anzeige');
  s.ersterSuchFrei = false;
  s.befehlSuch();
  assert.equal(s.richter.fehlerListe.fuehrenIgnoriert, 1);
});

test('Ohne Richtungszeichen keine geführte Anzeige', () => {
  const s = lage('truemmer');
  const ziel = s.lage.quellen.find((q) => q.typ === 'ziel');
  s.hund.starteAnzeige(ziel, true, s.ctx);
  assert.equal(s.hund.anzeige.gefuehrt, false);
});

test('Behältnisstrecke: ausgelassene Behältnisse und Fund auf dem Rückweg', () => {
  const s = lage('behaeltnis', 2, 21);
  const h = s.hund; const vs = s.lage.verstecke; const n = vs.length;
  h.verfolgeStrecke();
  const idx = (platz) => (h.streckeLinks ? platz : n - 1 - platz);
  const geheZu = (platz) => { const k = vs[idx(platz)].kammern[0]; h.x = k.x; h.y = k.y; h.verfolgeStrecke(); };
  geheZu(0); geheZu(4);
  assert.equal(h.ausgelasseneBehaeltnisse(), 3);
  geheZu(n - 1);
  assert.equal(h.ausgelasseneBehaeltnisse(), n - 3);

  // Fund an einem früheren Behältnis nach Erreichen des Endes = Rückweg
  const frueh = vs[idx(2)];
  h.starteAnzeige({ typ: 'ziel', name: 'x', x: frueh.x, y: frueh.y, hoehe: 0, versteckId: frueh.id }, true, s.ctx);
  assert.equal(h.anzeige.rueckweg, true);
  // Fund am letzten Behältnis ist noch Hinweg
  const letztes = vs[idx(n - 1)];
  h.starteAnzeige({ typ: 'ziel', name: 'x', x: letztes.x, y: letztes.y, hoehe: 0, versteckId: letztes.id }, true, s.ctx);
  assert.equal(h.anzeige.rueckweg, false);
});

test('Ausgelassene Behältnisse werden am Ende der Suche gewertet', () => {
  const s = lage('behaeltnis', 2, 21);
  const h = s.hund; const vs = s.lage.verstecke;
  h.verfolgeStrecke();
  const links = h.streckeLinks;
  const k0 = vs[links ? 0 : vs.length - 1].kammern[0];
  h.x = k0.x; h.y = k0.y; h.verfolgeStrecke();
  const kn = vs[links ? 5 : vs.length - 6].kammern[0];
  h.x = kn.x; h.y = kn.y; h.verfolgeStrecke();
  s.beenden();
  assert.equal(s.richter.fehlerListe.ausgelassen, 4);
});

test('Neue Fehlerarten haben alle einen Text und einen Bereich', () => {
  for (const [art, r] of Object.entries(SHS.po.ABZUEGE)) {
    assert.ok(r.text, art);
    assert.ok(r.bereich === 'such' || r.bereich === 'anzeige', art);
    assert.ok(r.punkte > 0 || r.deckel, art);
  }
});

test('Seeded Läufe bleiben reproduzierbar (eigener Zufallsstrom)', () => {
  const opts = { disziplin: 'flaeche', lk: 2, seed: 77, hund: testHund(45), gegenstand: 'korken', leine: true };
  assert.deepEqual(SHS.simuliereSuche(opts, 0.6).fehler, SHS.simuliereSuche(opts, 0.6).fehler);
});

test('„Platz!“: kostet 5, der Hund liegt und sucht danach weiter', () => {
  const s = lage('truemmer');
  s.hund.setzeZustand('sucht');
  s.befehlPlatz();
  assert.equal(s.richter.fehlerListe.ablegen, 1);
  for (let i = 0; i < 10; i++) s.hund.update(0.1, s.ctx);
  assert.equal(s.hund.liegt, true);
  for (let i = 0; i < 40; i++) s.hund.update(0.1, s.ctx);
  assert.equal(s.hund.liegt, false);
  assert.equal(s.hund.zustand === 'sucht' || s.hund.zustand === 'geruch', true);
});

test('„Platz!“ in der Anzeige oder in der Vorbereitung wird nicht gewertet', () => {
  const s = lage('truemmer');
  s.hund.setzeZustand('anzeige');
  s.befehlPlatz();
  const v = new SHS.SuchLage({ disziplin: 'truemmer', lk: 1, seed: 11, hund: testHund(50), gegenstand: 'korken' });
  v.befehlPlatz();
  assert.equal(s.richter.fehlerListe.ablegen, undefined);
  assert.equal(v.richter.fehlerListe.ablegen, undefined);
});

test('Lob: einzeln frei, Dauerlob (4× in 20 s) kostet Punkte', () => {
  const s = lage('truemmer');
  for (let i = 0; i < 3; i++) { s.t += 2; s.befehlLob(); }
  assert.equal(s.richter.fehlerListe.dauerlob, undefined);
  s.t += 2; s.befehlLob();
  assert.equal(s.richter.fehlerListe.dauerlob, 1);
  s.t += 2; s.befehlLob(); // Pause von 8 s bis zur nächsten Wertung
  assert.equal(s.richter.fehlerListe.dauerlob, 1);
  // Lob im Abstand von über 20 s bleibt frei
  const f = lage('truemmer');
  for (let i = 0; i < 6; i++) { f.t += 25; f.befehlLob(); }
  assert.equal(f.richter.fehlerListe.dauerlob, undefined);
});

test('Richterblatt: Teilleistungen mit Note, Abzügen und Deckel', () => {
  const r = new SHS.Wertungsrichter(1, 'truemmer');
  r.fehler('aktivKratzen'); r.fehler('hilfe'); r.fehler('hilfe');
  r.fund();
  const b = r.ergebnis().blatt;
  assert.equal(b.such.punkte, 58);
  assert.equal(b.such.note, 'Vorzüglich');
  assert.equal(b.anzeige.punkte, 35);
  assert.equal(b.anzeige.deckel.punkte, 35);
  const html = SHS.richterblattHtml(b);
  assert.match(html, /Suchleistung/);
  assert.match(html, /höchstens Gut \(35\)/);
  assert.match(html, /class="band aktuell"/);
  assert.match(html, /−2/);
});

test('Richterblatt ohne Fund zeigt keine Anzeigewertung', () => {
  const r = new SHS.Wertungsrichter(1, 'flaeche');
  r.zeitAbgelaufen();
  const html = SHS.richterblattHtml(r.ergebnis().blatt);
  assert.match(html, /kein Fund/);
});

test('Punktverluste je Disziplin aus dem Suchprotokoll', () => {
  const stand = {
    lk: 2,
    suchprotokoll: [
      { disziplin: 'flaeche', lk: 2, status: 'ok', gefunden: true, fehler: { hilfe: 6, aktivKratzen: 1 }, intensitaet: 0, fehlanzeigen: 0 },
      { disziplin: 'flaeche', lk: 2, status: 'ok', gefunden: true, fehler: { hilfe: 4 }, intensitaet: 2, fehlanzeigen: 1 },
      { disziplin: 'flaeche', lk: 1, status: 'ok', gefunden: true, fehler: { hilfe: 15 }, intensitaet: 0, fehlanzeigen: 0 }, // andere LK
      { disziplin: 'truemmer', lk: 2, status: 'abbruch', gefunden: false, fehler: { hilfe: 9 }, intensitaet: 0, fehlanzeigen: 0 }, // abgebrochen
    ],
  };
  const v = SHS.empfehlung.verlusteNachDisziplin(stand);
  assert.deepEqual(Object.keys(v), ['flaeche']);
  assert.equal(v.flaeche.suchen, 2);
  const hilfe = v.flaeche.zeilen.find((z) => z.art === 'hilfe');
  assert.equal(hilfe.proSuche, 5); // (6 + 4) / 2
  const fa = v.flaeche.zeilen.find((z) => z.art === 'fehlanzeige');
  assert.equal(fa.proSuche, 5); // 10 / 2
  const deckel = v.flaeche.zeilen.find((z) => z.art === 'aktivKratzen');
  assert.equal(deckel.proSuche, 2.5); // 40 − 35 = 5 Punkte, bei 2 Suchen
});

test('Unerfahrene HF führen, legen ab und loben zu viel; erfahrene nicht', () => {
  const zaehle = (erfahrung) => {
    const z = { ablegen: 0, dauerlob: 0, anzeigeGefuehrt: 0 };
    for (let i = 0; i < 60; i++) {
      const e = SHS.simuliereSuche({ disziplin: 'truemmer', lk: 2, seed: 300 + i, hund: testHund(55), gegenstand: 'korken', leine: true }, erfahrung);
      for (const k of Object.keys(z)) if (e.fehler && e.fehler[k]) z[k] += 1;
    }
    return z;
  };
  const neu = zaehle(0.1); const alt = zaehle(1);
  assert.ok(neu.ablegen + neu.dauerlob + neu.anzeigeGefuehrt > 0, JSON.stringify(neu));
  assert.deepEqual(alt, { ablegen: 0, dauerlob: 0, anzeigeGefuehrt: 0 });
});

test('Behältnisstrecke: Der Hund lässt gelegentlich ein Behältnis aus', () => {
  let mit = 0;
  for (let i = 0; i < 120; i++) {
    const e = SHS.simuliereSuche({ disziplin: 'behaeltnis', lk: 2, seed: 9000 + i, hund: testHund(50), gegenstand: 'korken', leine: true }, 0.7);
    if (e.fehler && e.fehler.ausgelassen) mit += 1;
  }
  assert.ok(mit >= 1, `ausgelassen in ${mit}/120`);
});

test('Einsteiger: Starthund um +8 stärker, nur einmal; Normal/Profi unverändert', () => {
  const summe = (s) => Object.values(s.hund.werte).reduce((a, b) => a + b, 0);
  const normal = SHS.career.neuerSpielstand('HF', 'A', 'Mischling', 1);
  const einst = SHS.career.neuerSpielstand('HF', 'B', 'Mischling', 1);
  einst.schwierigkeit = 'einsteiger';
  SHS.career.startwerteAnpassen(einst);
  assert.equal(summe(einst) - summe(normal), 8 * 8);
  SHS.career.startwerteAnpassen(einst); // zweiter Aufruf ändert nichts
  assert.equal(summe(einst) - summe(normal), 8 * 8);
  const profi = SHS.career.neuerSpielstand('HF', 'C', 'Mischling', 1);
  profi.schwierigkeit = 'profi';
  SHS.career.startwerteAnpassen(profi);
  assert.equal(summe(profi), summe(normal));
});

test('Weiterer Hund übernimmt die Schwierigkeit des Profils (Starthund-Bonus)', () => {
  const profil = SHS.career.neuesProfil('HF', 'Erster', 'Mischling', 'braungefleckt', 5, 'Rüde');
  profil.schwierigkeit = 'einsteiger';
  const normalSumme = Object.values(profil.teams[0].hund.werte).reduce((a, b) => a + b, 0);
  const zweiter = SHS.career.hundAufnehmen(profil, 'Zweiter', 'Mischling', 'braungefleckt', 'Rüde');
  assert.equal(Object.values(zweiter.hund.werte).reduce((a, b) => a + b, 0) - normalSumme, 64);
});

test('Aufzeichnung der Anzeige enthält Art der aktiven Anzeige, Halbliegen und Kinn', () => {
  let gefunden = null;
  for (let i = 0; i < 80 && !gefunden; i++) {
    const e = SHS.simuliereSuche({ disziplin: 'flaeche', lk: 1, seed: 2000 + i, hund: testHund(10), gegenstand: 'korken', leine: false }, 0.5);
    gefunden = e.suchlage.aufzeichnung.ereignisse.find((x) => x.typ === 'anzeige' && (x.aktiv || x.halb || x.kinn));
  }
  assert.ok(gefunden, 'Anzeige mit Besonderheit gefunden');
  assert.ok('aktivArt' in gefunden && 'halb' in gefunden && 'kinn' in gefunden);
  if (gefunden.aktiv) assert.ok(gefunden.aktivArt);
});

test('Das Richterblatt bleibt im Prüfungsergebnis erhalten (Leistungsnachweis-Details)', () => {
  const e = SHS.simuliereSuche({ disziplin: 'truemmer', lk: 1, seed: 3, hund: testHund(50), gegenstand: 'korken', leine: true }, 0.7);
  const details = JSON.parse(JSON.stringify({ truemmer: { such: e.such, anzeige: e.anzeige, begruendung: e.begruendung, blatt: e.blatt } }));
  assert.ok(SHS.richterblattHtml(details.truemmer.blatt).includes('Suchleistung'));
});
