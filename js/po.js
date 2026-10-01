// Regelwerk nach der Spürhundesport-Prüfungsordnung (gültig ab 01.07.2022).
// Alles, was die PO konkret festlegt, steht hier als Daten. Wo die PO keine Zahlen
// nennt (Höhe einzelner Abzüge), stehen markierte Spielannahmen (ANNAHME) - siehe docs/Konzept.md.
(function (SHS) {
  'use strict';

  const DISZIPLINEN = {
    behaeltnis: { id: 'behaeltnis', name: 'Behältnisstrecke' },
    truemmer: { id: 'truemmer', name: 'Trümmersuche' },
    flaeche: { id: 'flaeche', name: 'Flächensuche' },
  };
  const DISZIPLIN_REIHENFOLGE = ['truemmer', 'flaeche', 'behaeltnis'];

  const MAX_SUCHLEISTUNG = 60;
  const MAX_ANZEIGELEISTUNG = 40;
  const MAX_JE_DISZIPLIN = 100;
  const MINDESTPUNKTE_JE_DISZIPLIN = 70;
  const FEHLANZEIGE_ABZUG = 10;
  const FEHLANZEIGEN_BIS_ABBRUCH = 3;
  const MINDESTALTER_MONATE = 15;
  const MINDEST_TEILNEHMER = 8;

  // Wertnoten identisch zu shs_core.py des SHS-Prüfungsprogramms.
  const WERTNOTEN_ED = [
    [96, 'Vorzüglich', 'V'],
    [90, 'Sehr Gut', 'SG'],
    [80, 'Gut', 'G'],
    [70, 'Befriedigend', 'B'],
  ];
  const WERTNOTEN_DK = [
    [286, 'Vorzüglich', 'V'],
    [270, 'Sehr Gut', 'SG'],
    [240, 'Gut', 'G'],
    [210, 'Befriedigend', 'B'],
  ];

  // SHS-Gegenstände (PO III.A.3): Kleingegenstände max. 8,0 x 2,5 x 1,5 cm.
  const GEGENSTAENDE = [
    { id: 'feuerzeug', name: 'Feuerzeug' },
    { id: 'klammer', name: 'Wäscheklammer' },
    { id: 'korken', name: 'Korken' },
    { id: 'schluessel', name: 'Schlüssel' },
    { id: 'leder', name: 'Lederstück' },
  ];

  const SPIELZEUG = ['Ball', 'Kong', 'Beißwurst', 'Dummy', 'Apportierholz'];
  const FUTTER = ['Schweineohr', 'Rinderohr', 'Ochsenziemer', 'Trockenpansen', 'Nassfutter (Folie)'];

  // Anforderungen der Leistungsklassen (PO III.C).
  const LK = {
    1: {
      gegenstaende: 1,
      eigengeruch: false,
      anzeige: { phasen: [3] },
      leine: { truemmer: true, behaeltnis: true, flaeche: true },
      truemmer: { breite: 4, tiefe: 4, verstecke: 10, spielzeug: 0, futter: 0, differenzierung: false, maxHoehe: 0, hochlagen: 0 },
      behaeltnis: { anzahl: 6, kammern: 3, gleich: true, spielzeug: 0, futter: 0, differenzierung: false },
      flaeche: { breite: 10, laenge: 20, spielzeug: 0, futter: 0, differenzierung: false },
      suchzeit: { truemmer: 300, behaeltnis: 300, flaeche: 300 },
    },
    2: {
      gegenstaende: 2,
      eigengeruch: true,
      anzeige: { phasen: [5] },
      leine: { truemmer: true, behaeltnis: true, flaeche: true },
      truemmer: { breite: 4, tiefe: 4, verstecke: 14, spielzeug: 5, futter: 0, differenzierung: false, maxHoehe: 0.2, hochlagen: 0 },
      behaeltnis: { anzahl: 8, kammern: 4, gleich: true, spielzeug: 2, futter: 0, differenzierung: false },
      flaeche: { breite: 10, laenge: 25, spielzeug: 5, futter: 0, differenzierung: false },
      suchzeit: { truemmer: 300, behaeltnis: 300, flaeche: 360 },
    },
    3: {
      gegenstaende: 3,
      eigengeruch: true,
      // LK3: 3 s nach dem ersten Handzeichen, HF geht neben den Hund, 5 s nach dem zweiten.
      anzeige: { phasen: [3, 5] },
      leine: { truemmer: false, behaeltnis: false, flaeche: false },
      truemmer: { breite: 4, tiefe: 4, verstecke: 16, spielzeug: 5, futter: 5, differenzierung: true, maxHoehe: 0.5, hochlagen: 5 },
      behaeltnis: { anzahl: 10, kammern: 5, gleich: false, spielzeug: 2, futter: 2, differenzierung: true },
      flaeche: { breite: 10, laenge: 30, spielzeug: 5, futter: 5, differenzierung: true },
      suchzeit: { truemmer: 300, behaeltnis: 300, flaeche: 420 },
    },
  };

  // ANNAHME: Die PO nennt die Fehler, aber nicht deren Punktwert. Werte hier zentral anpassbar.
  // bereich: 'such' (von 60) oder 'anzeige' (von 40); max: Deckel je Fehlerart.
  const ABZUEGE = {
    hilfe: { bereich: 'such', punkte: 2, max: 15, text: 'Hilfestellung/Führen durch den HF' },
    verleitung: { bereich: 'such', punkte: 5, max: 20, text: 'Annahme einer Verleitung' },
    verlassen: { bereich: 'such', punkte: 3, max: 12, text: 'Wiederholtes Verlassen des Suchbereichs' },
    aussenreiz: { bereich: 'such', punkte: 2, max: 8, text: 'Reaktion auf Außenreize' },
    intensitaet: { bereich: 'such', punkte: 1, max: 10, text: 'Abbruch der Suchintensität / unselbstständiges Suchen' },
    mittelweg: { bereich: 'such', punkte: 3, max: 12, text: 'Übertreten des Mittelwegs durch den HF' },
    randalieren: { bereich: 'such', punkte: 3, max: 9, text: 'Verschieben von Versteckmöglichkeiten' },
    augensuche: { bereich: 'such', punkte: 2, max: 6, text: 'Augensuche' },
    aktiv: { bereich: 'anzeige', punkte: 8, max: 16, text: 'Aktive Anzeige (bellen, scharren, aufnehmen, lecken)' },
    ungenau: { bereich: 'anzeige', punkte: 5, max: 10, text: 'Ungenaue Anzeige (mehr als 20 cm von der Quelle)' },
    unruhig: { bereich: 'anzeige', punkte: 3, max: 10, text: 'Unruhige Anzeige (Hoch-/Zurückschauen zum HF)' },
    aufstehen: { bereich: 'anzeige', punkte: 6, max: 12, text: 'Anzeige vor der Erwiderung des WR aufgelöst' },
    unterstuetzung: { bereich: 'anzeige', punkte: 5, max: 10, text: 'Unterstützung der Anzeige durch den HF' },
  };

  function suchzeit(lk, disziplin) {
    return LK[lk].suchzeit[disziplin];
  }

  function leineErlaubt(lk, disziplin) {
    return !!LK[lk].leine[disziplin];
  }

  function wertnote(punkte, art) {
    const tabelle = art === 'DK' ? WERTNOTEN_DK : WERTNOTEN_ED;
    for (const [schwelle, text, abk] of tabelle) {
      if (punkte >= schwelle) return { text, abk };
    }
    return { text: 'nicht Bestanden', abk: 'nB' };
  }

  // Prüfungsergebnis: einzelwerte = Punkte je Disziplin (null = Disziplin abgebrochen).
  function bewertePruefung(einzelwerte, art, status) {
    if (status === 'disq') {
      return { punkte: 0, text: 'Disqualifiziert', abk: 'DISQ', bestanden: false };
    }
    const werte = Object.values(einzelwerte);
    if (werte.some((w) => w === null)) {
      const summe = werte.reduce((a, w) => a + (w || 0), 0);
      return { punkte: summe, text: 'Abbruch', abk: 'ABBR', bestanden: false };
    }
    const summe = werte.reduce((a, w) => a + w, 0);
    const bestanden = werte.every((w) => w >= MINDESTPUNKTE_JE_DISZIPLIN);
    if (!bestanden) return { punkte: summe, text: 'nicht Bestanden', abk: 'nB', bestanden: false };
    const note = wertnote(summe, art);
    return { punkte: summe, text: note.text, abk: note.abk, bestanden: true };
  }

  // Platzierung je LK: höhere Punkte besser; Gleichstand = gleicher Platz, freie Plätze entfallen.
  // Nicht bestandene/abgebrochene/disqualifizierte Teams erhalten keinen Platz.
  function platzierung(teilnehmer) {
    const bestandene = teilnehmer.filter((t) => t.ergebnis.bestanden)
      .sort((a, b) => b.ergebnis.punkte - a.ergebnis.punkte);
    let platz = 0;
    let letzte = null;
    bestandene.forEach((t, i) => {
      if (t.ergebnis.punkte !== letzte) {
        platz = i + 1;
        letzte = t.ergebnis.punkte;
      }
      t.platz = platz;
    });
    teilnehmer.filter((t) => !t.ergebnis.bestanden).forEach((t) => { t.platz = null; });
    return teilnehmer;
  }

  SHS.po = {
    DISZIPLINEN, DISZIPLIN_REIHENFOLGE, LK, ABZUEGE, GEGENSTAENDE, SPIELZEUG, FUTTER,
    MAX_SUCHLEISTUNG, MAX_ANZEIGELEISTUNG, MAX_JE_DISZIPLIN, MINDESTPUNKTE_JE_DISZIPLIN,
    FEHLANZEIGE_ABZUG, FEHLANZEIGEN_BIS_ABBRUCH, MINDESTALTER_MONATE, MINDEST_TEILNEHMER,
    WERTNOTEN_ED, WERTNOTEN_DK,
    suchzeit, leineErlaubt, wertnote, bewertePruefung, platzierung,
  };
})(globalThis.SHS = globalThis.SHS || {});
