// Regelwerk nach der Spürhundsport-Prüfungsordnung (gültig ab 01.07.2022).
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

  // ANNAHME (Spiel): Mit jeder Leistungsklasse wird es schwieriger. Die wirksamen Hundewerte (Nase, Anzeigesicherheit ...)
  // werden mit diesem Faktor multipliziert, derselbe Hund arbeitet in LK 2 und LK 3 also schlechter als in LK 1.
  const LK_SCHWIERIGKEIT = { 1: 1, 2: 0.8, 3: 0.65 };

  // Teilnoten-Bänder der Richterhilfe „Wertungsabzüge SH-R“ (Untergrenzen je Note).
  // Ungenügend/Mangelhaft werden im Spiel nicht ausgewiesen (mit dem Projektinhaber abgestimmt).
  // ANNAHME: Die Vorlage druckt Anzeige/Befriedigend als „31 – 38“; gemeint ist 31–28.
  const TEILNOTEN = {
    such: [[58, 'Vorzüglich'], [54, 'Sehr Gut'], [48, 'Gut'], [42, 'Befriedigend']],
    anzeige: [[38, 'Vorzüglich'], [36, 'Sehr Gut'], [32, 'Gut'], [28, 'Befriedigend']],
  };
  // „Max. SG“ / „Max. G“ der Richterhilfe = Obergrenze der Teilleistung (oberster Punkt des Bandes).
  const OBERGRENZE = {
    such: { SG: 57, G: 53 },
    anzeige: { SG: 37, G: 35 },
  };

  // Abzüge nach der Richterhilfe „Wertungsabzüge SH-R“.
  // bereich: 'such' (von 60) oder 'anzeige' (von 40).
  // punkte/max: feste Abzugspunkte je Fehler und Deckel je Fehlerart (bei „bis 0“ = ganze Teilleistung).
  // deckel: 'SG' | 'G' = die Teilleistung kann höchstens diese Note erreichen („Max. SG/G“);
  //         mehrere Deckel stapeln nicht, es gilt der niedrigste (ANNAHME).
  // ANNAHME: Wo die Hilfe nur „Wertungsnote“ (Richterermessen) nennt, steht hier ein Punktwert.
  // alt: nicht mehr vergeben, nur für alte Spielstände lesbar.
  const ABZUEGE = {
    // Suche
    hilfe: { bereich: 'such', punkte: 1, max: 15, text: 'Verbale Korrektur / Führen durch den HF' }, // 1 pro (Richterhilfe)
    verleitung: { bereich: 'such', punkte: 5, max: 20, text: 'Annahme einer Verleitung' }, // Wertungsnote (ANNAHME)
    verlassen: { bereich: 'such', punkte: 1, max: 12, text: 'Verlassen des Suchbereichs über eine Hundekörperlänge' }, // 1 pro
    aussenreiz: { bereich: 'such', punkte: 2, max: 8, text: 'Ablenkbarkeit / Reaktion auf Außenreize' }, // Wertungsnote (ANNAHME)
    intensitaet: { bereich: 'such', punkte: 1, max: 10, text: 'Unselbstständigkeit / Konzentrationsschwäche' }, // Wertungsnote, anteilig
    mittelweg: { bereich: 'such', punkte: 3, max: 60, text: 'Verlassen des Mittelwegs durch den HF' }, // Wertungsnote bis 0
    augensuche: { bereich: 'such', punkte: 2, max: 6, text: 'Augensuche' }, // nicht in der Richterhilfe (ANNAHME)
    markieren: { bereich: 'such', punkte: 10, max: 10, text: 'Markieren / Lösen' }, // 10 (einmal)
    leine: { bereich: 'such', punkte: 1, max: 6, text: 'Leineneinwirkung' }, // 1–2 (ANNAHME: 1 je Zug)
    ausgelassen: { bereich: 'such', punkte: 0.5, max: 4, text: 'Ausgelassenes Behältnis' }, // 0,5 je Behältnis
    startzoegern: { bereich: 'such', deckel: 'SG', text: 'Hund beginnt nach dem Ansatz nicht direkt mit der Suche' }, // Max. SG
    rueckweg: { bereich: 'such', deckel: 'SG', text: 'Gegenstand erst auf dem Rückweg gefunden' }, // Max. SG
    lokalisiert: { bereich: 'such', deckel: 'SG', text: 'Gegenstand lokalisiert, Hund kann ihn nicht finden' }, // Max. SG
    anzeigeGefuehrt: { bereich: 'such', deckel: 'G', text: 'Anzeige durch Führung des HF' }, // je nach Intensität max. G
    ablegen: { bereich: 'such', punkte: 5, max: 10, text: 'Ablegen durch Führung (Hund sucht danach weiter)' }, // 5
    dauerlob: { bereich: 'such', punkte: 2, max: 10, text: 'Dauerlob' }, // Wertungsnote (ANNAHME: ab dem 4. Lob in 20 s, −2 je Serie)
    fuehrenIgnoriert: { bereich: 'such', punkte: 5, max: 10, text: 'Hund zeigt beim Führen an, HF ignoriert die Anzeige' }, // 5
    // Anzeige
    ersterFundVerpasst: { bereich: 'anzeige', deckel: 'G', text: 'Hund zeigt beim ersten Auffinden nicht an' }, // Max. G
    aufnehmen: { bereich: 'anzeige', deckel: 'G', text: 'Aufnehmen des Gegenstandes' }, // Max. G
    apportieren: { bereich: 'anzeige', punkte: 5, max: 10, text: 'Apportieren mehr als eine Körperlänge' }, // bis 10 (ANNAHME 5)
    anstossen: { bereich: 'anzeige', deckel: 'G', text: 'Hund stößt den Gegenstand deutlich an' }, // SG–G (ANNAHME: G)
    kratzenLeicht: { bereich: 'anzeige', deckel: 'SG', text: 'Hund kratzt leicht' }, // SG–G (ANNAHME: SG)
    halbliegen: { bereich: 'anzeige', punkte: 2, max: 4, text: 'Hund liegt nur halb (z. B. hinten stehend)' }, // Wertungsnote (ANNAHME)
    kinnanzeige: { bereich: 'anzeige', deckel: 'SG', text: 'Kinnanzeige in der Fläche' }, // Max. SG
    lochUnsauber: { bereich: 'anzeige', punkte: 3, max: 6, text: 'Hund zeigt nicht sauber am Loch an' }, // Wertungsnote (ANNAHME)
    aktivKratzen: { bereich: 'anzeige', deckel: 'G', text: 'Kratzen am Versteck' }, // Max. G
    aktivLecken: { bereich: 'anzeige', deckel: 'SG', text: 'Hund leckt am Gegenstand' }, // Max. SG
    aktivBellen: { bereich: 'anzeige', punkte: 3, max: 6, text: 'Bellen in der Anzeige' }, // Wertungsnote (ANNAHME)
    randalieren: { bereich: 'anzeige', punkte: 3, max: 9, text: 'Verschieben von Verstecken' }, // Wertungsnote (ANNAHME)
    ungenau: { bereich: 'anzeige', punkte: 5, max: 10, text: 'Ungenaue Anzeige (mehr als 20 cm von der Quelle)' }, // Wertungsnote (ANNAHME)
    unruhig: { bereich: 'anzeige', deckel: 'SG', punkte: 1, max: 4, text: 'Hundekopf dreht sich in der Anzeige zum HF' }, // Max. SG, 1 je weiteres Mal (ANNAHME)
    aufstehen: { bereich: 'anzeige', punkte: 6, max: 12, text: 'Anzeige vor der Richtererwiderung verlassen' }, // Wertungsnote (ANNAHME)
    unterstuetzung: { bereich: 'anzeige', punkte: 5, max: 40, text: 'Unterstützung der Anzeige durch den HF' }, // Wertungsnote bis 0
    // Alte Spielstände (vor der Richterhilfe): nicht mehr vergeben.
    aktiv: { bereich: 'anzeige', punkte: 8, max: 16, alt: true, text: 'Aktive Anzeige (bellen, scharren)' },
  };

  // Name der Teilnote (Vorzüglich ... Befriedigend), darunter null.
  function teilnote(punkte, bereich) {
    for (const [schwelle, text] of TEILNOTEN[bereich]) if (punkte >= schwelle) return text;
    return null;
  }

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
    WERTNOTEN_ED, WERTNOTEN_DK, TEILNOTEN, OBERGRENZE, LK_SCHWIERIGKEIT,
    suchzeit, leineErlaubt, wertnote, teilnote, bewertePruefung, platzierung,
  };
})(globalThis.SHS = globalThis.SHS || {});
