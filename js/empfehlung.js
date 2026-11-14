// Trainingsempfehlung: wertet Hundewerte (gegen Zielwerte der LK), Geruchsbilder, die Fehler der
// letzten Suchen, die nächste Prüfung, den Aufstiegsstand und die Energie aus und schlägt vor,
// was als Nächstes trainiert werden sollte. DOM-frei (testbar).
(function (SHS) {
  'use strict';
  const po = SHS.po;

  // ANNAHME: Zielwerte je Leistungsklasse (Spielbalance, keine PO-Vorgabe).
  const ZIEL = { 1: 45, 2: 60, 3: 75 };
  // Differenzierung wird erst ab LK 2/3 wirklich gefordert (Eigengeruch, baugleicher Gegenstand).
  const GEWICHT = { differenzierung: { 1: 0.5, 2: 0.85, 3: 1.1 } };

  // Welcher Wert mit welchem Training verbessert wird.
  const WERT_TRAINING = {
    nase: 'geruch', ausdauer: 'kondition', impuls: 'impuls', anzeige: 'anzeige', praezision: 'anzeige',
    differenzierung: 'differenzierung', selbststaendig: 'kondition', konzentration: 'umwelt',
  };

  // Welcher Fehler des WR auf welches Training hinweist.
  const FEHLER_TRAINING = {
    aktiv: ['anzeige', 'aktive Anzeige (bellen, scharren)'],
    aktivKratzen: ['anzeige', 'Kratzen am Versteck'],
    aktivLecken: ['anzeige', 'Lecken am Gegenstand'],
    aktivBellen: ['anzeige', 'Bellen in der Anzeige'],
    kratzenLeicht: ['anzeige', 'leichtes Kratzen in der Anzeige'],
    anstossen: ['anzeige', 'Gegenstand angestoßen'],
    aufnehmen: ['anzeige', 'Gegenstand aufgenommen'],
    apportieren: ['anzeige', 'Gegenstand apportiert'],
    halbliegen: ['anzeige', 'nur halb liegende Anzeige'],
    kinnanzeige: ['anzeige', 'Kinnanzeige in der Fläche'],
    lochUnsauber: ['anzeige', 'Anzeige nicht sauber am Loch'],
    ersterFundVerpasst: ['anzeige', 'beim ersten Auffinden nicht angezeigt'],
    startzoegern: ['kondition', 'zögerlicher Suchbeginn'],
    markieren: ['umwelt', 'Markieren/Lösen während der Suche'],
    leine: ['impuls', 'Zug in die Leine'],
    rueckweg: ['geruch', 'Gegenstand erst auf dem Rückweg gefunden'],
    ausgelassen: ['geruch', 'Behältnisse ausgelassen'],
    lokalisiert: ['geruch', 'Gegenstand lokalisiert, aber nicht gefunden'],
    ungenau: ['anzeige', 'ungenaue Anzeige (> 20 cm)'],
    unruhig: ['anzeige', 'unruhige Anzeige (Zurückschauen)'],
    aufstehen: ['anzeige', 'Anzeige vor der Erwiderung aufgelöst'],
    unterstuetzung: ['anzeige', 'Anzeige musste mit „Bleib!“ gestützt werden'],
    verleitung: ['impuls', 'Verleitungen angenommen'],
    randalieren: ['impuls', 'Verstecke verschoben'],
    aussenreiz: ['umwelt', 'Reaktion auf Außenreize'],
    verlassen: ['umwelt', 'Suchbereich verlassen'],
    augensuche: ['kondition', 'Augensuche'],
    hilfe: ['kondition', 'viele Hilfen nötig (unselbstständig)'],
  };

  const HF_HINWEISE = {
    mittelweg: 'Fläche: Als Hundeführer konsequent auf dem Mittelweg bleiben.',
    hilfe: 'Weniger Hörzeichen geben – den Hund selbstständig arbeiten lassen und eher mitgehen.',
    ablegen: 'Den Hund nicht ablegen und führen: Er soll selbstständig suchen und seine Anzeige selbst einnehmen.',
    dauerlob: 'Während der Suche sparsam loben – Dauerlob zählt als Fehler, gelobt wird erst nach der Erwiderung des WR.',
    fehlanzeige: 'Den Hund genauer lesen: Zurückschauen und eine tiefe, ruhige Rute in der Anzeige deuten auf Unsicherheit.',
  };

  function zielwert(lk, wert) {
    const g = GEWICHT[wert] ? GEWICHT[wert][lk] : 1;
    return Math.round(ZIEL[lk] * g);
  }

  // Stärken/Schwächen: Abstand jedes Werts zum Zielwert der aktuellen LK.
  function profil(stand) {
    const lk = stand.lk;
    return Object.entries(SHS.dog.WERTE).map(([k, name]) => {
      const wert = Math.round(stand.hund.werte[k]);
      const ziel = zielwert(lk, k);
      return { key: k, name, wert, ziel, differenz: wert - ziel, training: WERT_TRAINING[k] };
    }).sort((a, b) => a.differenz - b.differenz);
  }

  // Gegenstände: für die LK werden so viele sicher bekannte Gegenstände gebraucht, wie die PO verlangt.
  function geruchsbilder(stand) {
    const benoetigt = po.LK[stand.lk].gegenstaende;
    const sortiert = po.GEGENSTAENDE.map((g) => ({ id: g.id, name: g.name, wert: Math.round((stand.hund.vertrautheit[g.id] || 0) * 100) }))
      .sort((a, b) => b.wert - a.wert);
    const sicher = 60;
    const kandidaten = sortiert.slice(0, benoetigt);
    const fehlend = kandidaten.filter((g) => g.wert < sicher);
    return { benoetigt, sicher, kandidaten, fehlend };
  }

  // Fehlerauswertung der letzten Suchen (neuere zählen stärker).
  function fehlerAuswertung(stand, anzahl) {
    const liste = (stand.suchprotokoll || []).slice(-(anzahl || 8));
    const summe = {}; const gewichtet = {};
    let fehlanzeigen = 0; let nichtGefunden = 0; let intensitaet = 0;
    liste.forEach((e, i) => {
      const w = 0.5 + (0.5 * (i + 1)) / liste.length; // ältere 0.5, neueste 1.0
      for (const [art, n] of Object.entries(e.fehler || {})) {
        summe[art] = (summe[art] || 0) + n;
        gewichtet[art] = (gewichtet[art] || 0) + n * w;
      }
      fehlanzeigen += e.fehlanzeigen || 0;
      if (e.status === 'ok' && !e.gefunden) nichtGefunden += 1;
      intensitaet += e.intensitaet || 0;
    });
    return { anzahl: liste.length, summe, gewichtet, fehlanzeigen, nichtGefunden, intensitaet, liste };
  }

  // Punkte, die ein Fehler kostet: feste Abzüge bzw. der Verlust durch den Notendeckel.
  function verlustPunkte(art, n) {
    const r = po.ABZUEGE[art];
    if (!r || r.alt) return 0;
    if (r.punkte) return Math.min(r.max, r.punkte * n);
    return (r.bereich === 'such' ? po.MAX_SUCHLEISTUNG : po.MAX_ANZEIGELEISTUNG) - po.OBERGRENZE[r.bereich][r.deckel];
  }

  const VERLUST_TEXT = {
    fehlanzeige: 'Fehlanzeigen',
    nichtGefunden: 'Gegenstand nicht gefunden (keine Anzeigeleistung)',
  };

  // Wo gehen in welcher Disziplin die meisten Punkte verloren? Auswertung der letzten Suchen der aktuellen LK.
  function verlusteNachDisziplin(stand, anzahl) {
    const alle = (stand.suchprotokoll || []).filter((e) => e.lk === stand.lk && e.status === 'ok').slice(-(anzahl || 15));
    const out = {};
    for (const d of po.DISZIPLIN_REIHENFOLGE) {
      const liste = alle.filter((e) => e.disziplin === d);
      if (!liste.length) continue;
      const summe = {};
      for (const e of liste) {
        for (const [art, n] of Object.entries(e.fehler || {})) {
          const v = verlustPunkte(art, n);
          if (v > 0) summe[art] = (summe[art] || 0) + v;
        }
        if (e.intensitaet > 0) summe.intensitaet = (summe.intensitaet || 0) + e.intensitaet;
        if (e.fehlanzeigen > 0) summe.fehlanzeige = (summe.fehlanzeige || 0) + e.fehlanzeigen * po.FEHLANZEIGE_ABZUG;
        if (!e.gefunden) summe.nichtGefunden = (summe.nichtGefunden || 0) + po.MAX_ANZEIGELEISTUNG;
      }
      const zeilen = Object.entries(summe)
        .map(([art, v]) => ({ art, text: VERLUST_TEXT[art] || (po.ABZUEGE[art] ? po.ABZUEGE[art].text : art), proSuche: v / liste.length }))
        .sort((a, b) => b.proSuche - a.proSuche);
      out[d] = { suchen: liste.length, zeilen: zeilen.slice(0, 4), gesamt: zeilen.reduce((a, z) => a + z.proSuche, 0) };
    }
    return out;
  }

  function empfehlungen(stand) {
    const lk = stand.lk;
    const punkte = {}; // ziel -> { prio, gruende[] }
    const add = (ziel, prio, grund) => {
      if (!punkte[ziel]) punkte[ziel] = { prio: 0, gruende: [] };
      punkte[ziel].prio += prio;
      if (grund && !punkte[ziel].gruende.includes(grund)) punkte[ziel].gruende.push(grund);
    };

    // 1) Schwächen in den Werten
    for (const p of profil(stand)) {
      if (p.differenz < 0) add(p.training, -p.differenz * 1.2, `${p.name} ${p.wert} (Ziel LK ${lk}: ${p.ziel})`);
    }

    // 2) Geruchsbilder der benötigten Gegenstände
    const gb = geruchsbilder(stand);
    const bedarf = gb.benoetigt === 1 ? 'ein sicher bekannter Gegenstand' : `${gb.benoetigt} sicher bekannte Gegenstände`;
    for (const g of gb.fehlend) add('geruch:' + g.id, (gb.sicher - g.wert) * 0.9, `${g.name} erst zu ${g.wert} % vertraut – für LK ${lk} wird ${bedarf} gebraucht`.replace('wird 2', 'werden 2').replace('wird 3', 'werden 3'));

    // 3) Fehler der letzten Suchen
    const f = fehlerAuswertung(stand);
    for (const [art, n] of Object.entries(f.gewichtet)) {
      const zuordnung = FEHLER_TRAINING[art];
      if (zuordnung) add(zuordnung[0], n * 7, `${zuordnung[1]} (${f.summe[art]}× ${f.anzahl === 1 ? 'in der letzten Suche' : `in den letzten ${f.anzahl} Suchen`})`);
    }
    if (f.fehlanzeigen > 0) add('differenzierung', f.fehlanzeigen * 9, `${f.fehlanzeigen} Fehlanzeige(n) in den letzten Suchen`);
    if (f.nichtGefunden > 0) {
      add('kondition', f.nichtGefunden * 8, `${f.nichtGefunden}× Gegenstand nicht gefunden`);
      add('geruch:' + (gb.kandidaten[0] ? gb.kandidaten[0].id : 'korken'), f.nichtGefunden * 5, `${f.nichtGefunden}× Gegenstand nicht gefunden`);
    }
    if (f.intensitaet > 0) add('kondition', f.intensitaet * 1.5, 'Suchintensität ließ nach');

    // 3b) Größter Punktverlust je Disziplin (ab zwei Suchen)
    const verluste = verlusteNachDisziplin(stand);
    for (const [d, v] of Object.entries(verluste)) {
      const top = v.zeilen.find((z) => z.art !== 'nichtGefunden');
      if (v.suchen >= 2 && top && top.proSuche >= 3) {
        add('uebung:' + d, Math.min(14, top.proSuche * 2), `${po.DISZIPLINEN[d].name}: größter Punktverlust durch „${top.text}“ (Ø −${String(Math.round(top.proSuche * 10) / 10).replace('.', ',')} je Suche)`);
      }
    }

    // 4) Aufstieg: Disziplinen ohne 70 Punkte in der aktuellen LK üben
    if (lk < 3) {
      const best = stand.lkBestwerte[lk] || {};
      for (const d of po.DISZIPLIN_REIHENFOLGE) {
        if (!(best[d] >= po.MINDESTPUNKTE_JE_DISZIPLIN)) {
          add('uebung:' + d, 12, `Für den Aufstieg in LK ${lk + 1} fehlen noch 70 Punkte in der ${po.DISZIPLINEN[d].name}`);
        }
      }
    }

    // 5) Nächste Prüfung in den kommenden zwei Wochen
    const naechste = (stand.ausschreibungen || []).find((a) => !a.erledigt && a.woche >= stand.woche && a.woche - stand.woche <= 2);
    if (naechste) {
      const disz = naechste.art === 'DK' ? po.DISZIPLIN_REIHENFOLGE : [naechste.disziplin];
      for (const d of disz) add('uebung:' + d, 10, `Prüfung am ${SHS.career.datumText(naechste.woche)} (${naechste.verein}) – ${po.DISZIPLINEN[d].name} üben`);
    }

    // Ergebnisliste
    const liste = Object.entries(punkte).map(([ziel, v]) => Object.assign({ ziel, prio: Math.round(v.prio), gruende: v.gruende }, beschreibe(ziel)))
      .filter((e) => e.prio >= 3)
      .sort((a, b) => b.prio - a.prio);

    // Energie: müder Hund zuerst erholen lassen
    const hinweise = [];
    if (SHS.career.istVerletzt(stand)) {
      liste.unshift({ ziel: 'ruhe', prio: 1000, titel: 'Schonung', text: `${stand.hund.name} ist verletzt (${stand.hund.verletzt.art}). Bis Woche ${stand.hund.verletzt.bisWoche} kein Training und keine Prüfung.`, gruende: ['Verletzung durch Überlastung'] });
    } else if (stand.hund.energie < 0.35) {
      liste.unshift({ ziel: 'ruhe', prio: 999, titel: 'Erholung', text: 'Der Hund ist müde. Diese Woche weniger trainieren und die Woche beenden – ausgeruht lernt er mehr.', gruende: [`Energie ${Math.round(stand.hund.energie * 100)} %`] });
    }
    if (naechste && naechste.woche === stand.woche && SHS.career.naechsterTrainingstag(stand) === 'Freitag') {
      hinweise.push('Am Samstag ist Prüfung: Ein hartes Freitagstraining kostet Energie und damit Suchmotivation in der Prüfung.');
    }
    if ((f.summe.mittelweg || 0) > 0) hinweise.push(HF_HINWEISE.mittelweg);
    if ((f.summe.hilfe || 0) >= 3) hinweise.push(HF_HINWEISE.hilfe);
    if (f.fehlanzeigen > 0) hinweise.push(HF_HINWEISE.fehlanzeige);
    if ((f.summe.ablegen || 0) > 0) hinweise.push(HF_HINWEISE.ablegen);
    if ((f.summe.dauerlob || 0) > 0) hinweise.push(HF_HINWEISE.dauerlob);
    return { liste: liste.slice(0, 6), hinweise, profil: profil(stand), geruch: gb, fehler: f, verluste, naechste };
  }

  function beschreibe(ziel) {
    if (ziel.startsWith('geruch:')) {
      const id = ziel.slice(7);
      const g = po.GEGENSTAENDE.find((x) => x.id === id);
      return { titel: `Geruchskonditionierung: ${g ? g.name : id}`, training: 'geruch', gegenstand: id, text: SHS.career.TRAININGS.geruch.text };
    }
    if (ziel.startsWith('uebung:')) {
      const d = ziel.slice(7);
      return { titel: `Übungssuche: ${po.DISZIPLINEN[d].name}`, uebung: d, text: 'Die ganze Suchlage üben – Suche, Anzeige und das Zusammenspiel mit dem HF.' };
    }
    const t = SHS.career.TRAININGS[ziel];
    return { titel: t ? t.name : ziel, training: ziel, text: t ? t.text : '' };
  }

  SHS.empfehlung = { ZIEL, zielwert, profil, geruchsbilder, fehlerAuswertung, verlusteNachDisziplin, empfehlungen };
})(globalThis.SHS = globalThis.SHS || {});
