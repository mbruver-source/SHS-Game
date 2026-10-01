// Karriere: Spielstand, Wochen, Training, Leistungsnachweis und Klassenaufstieg.
(function (SHS) {
  'use strict';
  const po = SHS.po;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const TRAININGS_JE_WOCHE = 3;
  const STARTDATUM = '2026-10-05';

  const TRAININGS = {
    geruch: { name: 'Geruchskonditionierung', text: 'Der Hund lernt das Geruchsbild eines Gegenstands (Futterbelohnung am Gegenstand).', mitGegenstand: true },
    anzeige: { name: 'Anzeigetraining', text: 'Passive Platzanzeige: ruhig, nah an der Quelle, ausdauernd bis zur Erwiderung.' },
    impuls: { name: 'Impulskontrolle', text: 'Suchen an Spielzeug- und Futterverleitungen vorbei.' },
    kondition: { name: 'Suchkondition', text: 'Längere, selbstständige Suchen auf wechselnden Flächen.' },
    umwelt: { name: 'Umweltsicherheit', text: 'Suchen unter Ablenkung: Geräusche, Zuschauer, fremde Hunde.' },
    differenzierung: { name: 'Differenzierung', text: 'Den eigenen Gegenstand von baugleichen Gegenständen unterscheiden.' },
  };

  function neuerSpielstand(hfName, hundName, rasse, seed) {
    const stand = {
      version: 1,
      seed: seed >>> 0,
      hf: { name: hfName },
      hund: SHS.dog.neuerHund(hundName, rasse),
      woche: 1,
      trainingsDieseWoche: 0,
      lk: 1,
      lkBestwerte: { 1: {}, 2: {}, 3: {} },
      leistungsnachweis: [],
      ausschreibungen: [],
      verlauf: [],
    };
    stand.hund.vertrautheit.korken = 0.3; // erster Gegenstand ist schon angefüttert
    aktualisiereAusschreibungen(stand);
    return stand;
  }

  function rndFuer(stand, salz) {
    return SHS.rng((stand.seed + stand.woche * 7919 + stand.trainingsDieseWoche * 104729 + (salz || 0)) >>> 0);
  }

  function datumDerWoche(woche) {
    const d = new Date(STARTDATUM + 'T12:00:00');
    d.setDate(d.getDate() + (woche - 1) * 7 + 5); // Samstag der Woche
    return d;
  }

  function datumText(woche) {
    return datumDerWoche(woche).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function alterText(monate) {
    const m = Math.floor(monate);
    return m >= 24 ? `${Math.floor(m / 12)} J. ${m % 12} Mon.` : `${m} Monate`;
  }

  function darfPruefen(stand) {
    return stand.hund.alterMonate >= po.MINDESTALTER_MONATE;
  }

  // Zuwachs mit abnehmendem Ertrag: je höher der Wert, desto kleiner der Schritt.
  function steigere(werte, key, basis, faktor) {
    const alt = werte[key];
    const zuwachs = basis * Math.pow(1 - alt / 100, 1.1) * faktor;
    werte[key] = clamp(Math.round((alt + zuwachs) * 10) / 10, 0, 100);
    return werte[key] - alt;
  }

  // Trainingsrhythmus Mo – Mi – Fr: an den freien Tagen dazwischen (Di, Do) erholt sich der Hund
  // teilweise, am Wochenende vollständig. Ausgeruht lernt er etwas mehr, müde deutlich weniger.
  const TRAININGSTAGE = ['Montag', 'Mittwoch', 'Freitag'];
  const BELASTUNG = 0.3; // Energieverbrauch je Trainingseinheit
  const ERHOLUNG_RUHETAG = 0.16; // Erholung am freien Tag zwischen zwei Einheiten
  const ERHOLUNG_WOCHENENDE = 0.6; // Sa + So

  function naechsterTrainingstag(stand) {
    return TRAININGSTAGE[stand.trainingsDieseWoche] || null;
  }

  function lernFaktor(energie) {
    if (energie < 0.35) return { faktor: 0.45, zustand: 'müde – wenig Fortschritt' };
    if (energie >= 0.75) return { faktor: 1.1, zustand: 'ausgeruht' };
    return { faktor: 1, zustand: '' };
  }

  // Beginn einer Einheit: Erholung seit der letzten Einheit gutschreiben.
  function einheitBeginnen(stand) {
    const h = stand.hund;
    if (stand.trainingsDieseWoche > 0) h.energie = clamp(h.energie + ERHOLUNG_RUHETAG, 0, 1);
    return { tag: naechsterTrainingstag(stand), ...lernFaktor(h.energie) };
  }

  function einheitBeenden(stand, belastung) {
    stand.hund.energie = clamp(stand.hund.energie - belastung, 0, 1);
    stand.trainingsDieseWoche += 1;
  }

  function trainieren(stand, art, gegenstandId) {
    if (stand.trainingsDieseWoche >= TRAININGS_JE_WOCHE) {
      return { ok: false, text: 'Diese Woche sind keine Trainingseinheiten mehr frei.' };
    }
    const t = TRAININGS[art];
    if (!t) return { ok: false, text: 'Unbekanntes Training.' };
    const h = stand.hund;
    const r = rndFuer(stand, art.length * 31);
    const einheit = einheitBeginnen(stand);
    const muede = einheit.faktor < 1;
    const faktor = einheit.faktor * r.range(0.75, 1.25) * (h.alterMonate < 15 ? 1.15 : 1);
    const d = {};
    const add = (k, b) => { d[k] = (d[k] || 0) + steigere(h.werte, k, b, faktor); };
    switch (art) {
      case 'geruch': {
        const g = gegenstandId || 'korken';
        const alt = h.vertrautheit[g] || 0;
        h.vertrautheit[g] = clamp(alt + 0.16 * (1 - alt) * faktor, 0, 1);
        d['Vertrautheit ' + po.GEGENSTAENDE.find((x) => x.id === g).name] = (h.vertrautheit[g] - alt) * 100;
        add('nase', 3);
        break;
      }
      case 'anzeige': add('anzeige', 9); add('praezision', 6); break;
      case 'impuls': add('impuls', 10); add('konzentration', 2); break;
      case 'kondition': add('ausdauer', 9); add('selbststaendig', 6); add('nase', 2); break;
      case 'umwelt': add('konzentration', 10); add('selbststaendig', 2); break;
      case 'differenzierung': {
        const bekannte = Object.values(h.vertrautheit).filter((v) => v >= 0.4).length;
        add('differenzierung', bekannte >= 2 ? 10 : 4);
        if (bekannte < 2) d.hinweis = 'Differenzierung wirkt erst richtig, wenn der Hund mindestens zwei Gegenstände sicher kennt.';
        break;
      }
      default: break;
    }
    einheitBeenden(stand, BELASTUNG);
    const text = `${einheit.tag}: ${t.name}${einheit.zustand ? ` (Hund ${einheit.zustand})` : ''}`;
    stand.verlauf.push({ woche: stand.woche, text });
    return { ok: true, text, deltas: d, muede };
  }

  // Übungssuche als Trainingseinheit: kleiner Zuwachs abhängig vom Ergebnis.
  function uebungssucheVerbuchen(stand, ergebnis, gegenstandId) {
    if (stand.trainingsDieseWoche >= TRAININGS_JE_WOCHE) return null;
    const h = stand.hund;
    const f = einheitBeginnen(stand).faktor;
    const d = {};
    d.nase = steigere(h.werte, 'nase', 3, f);
    d.selbststaendig = steigere(h.werte, 'selbststaendig', 3, f);
    if (ergebnis && ergebnis.gefunden) {
      d.anzeige = steigere(h.werte, 'anzeige', 2, f);
      const alt = h.vertrautheit[gegenstandId] || 0;
      h.vertrautheit[gegenstandId] = clamp(alt + 0.06 * (1 - alt), 0, 1);
    }
    einheitBeenden(stand, BELASTUNG * 0.9);
    return d;
  }

  function wocheBeenden(stand) {
    const h = stand.hund;
    const ausgefallen = TRAININGS_JE_WOCHE - stand.trainingsDieseWoche; // ausgelassene Einheiten = zusätzliche Ruhe
    h.energie = clamp(h.energie + ERHOLUNG_WOCHENENDE + ausgefallen * ERHOLUNG_RUHETAG, 0, 1);
    h.alterMonate = Math.round((h.alterMonate + 7 / 30.44) * 100) / 100;
    // Nicht trainierte Gerüche verblassen leicht.
    for (const k of Object.keys(h.vertrautheit)) h.vertrautheit[k] = clamp(h.vertrautheit[k] - 0.004, 0.05, 1);
    stand.woche += 1;
    stand.trainingsDieseWoche = 0;
    aktualisiereAusschreibungen(stand);
  }

  const VEREINE = ['SV Waldheide', 'HSV Am Bruch', 'VdH Nordkreis', 'Hundefreunde Rheinaue', 'SHS-Team Mittelland',
    'HSF Lindenhof', 'Gebrauchshundverein Talblick', 'Spürnasen e.V.', 'HV Kirchberg', 'Nasenarbeit Süd'];

  // Hält immer die nächsten Ausschreibungen vor (ab Woche 2, alle 2–3 Wochen).
  function aktualisiereAusschreibungen(stand) {
    stand.ausschreibungen = stand.ausschreibungen.filter((a) => a.woche >= stand.woche && !a.erledigt);
    let letzte = stand.ausschreibungen.reduce((m, a) => Math.max(m, a.woche), stand.woche);
    while (stand.ausschreibungen.length < 3) {
      const r = SHS.rng((stand.seed + letzte * 92821) >>> 0);
      letzte += r.int(2, 3);
      const dk = r.chance(0.5);
      stand.ausschreibungen.push({
        id: `p${letzte}`,
        woche: letzte,
        verein: r.pick(VEREINE),
        art: dk ? 'DK' : 'ED',
        disziplin: dk ? null : r.pick(po.DISZIPLIN_REIHENFOLGE),
        seed: (stand.seed + letzte * 15485863) >>> 0,
      });
    }
    stand.ausschreibungen.sort((a, b) => a.woche - b.woche);
  }

  // Trägt ein Prüfungsergebnis ein und prüft den Klassenaufstieg (PO III.A.5).
  function eintragen(stand, eintrag) {
    stand.leistungsnachweis.push(eintrag);
    const a = stand.ausschreibungen.find((x) => x.id === eintrag.pruefungId);
    if (a) a.erledigt = true;
    let aufstieg = false;
    if (eintrag.status !== 'disq') {
      const best = stand.lkBestwerte[eintrag.lk];
      for (const [d, p] of Object.entries(eintrag.einzelwerte)) {
        if (p !== null && (best[d] === undefined || p > best[d])) best[d] = p;
      }
      if (eintrag.lk === stand.lk && stand.lk < 3 && klasseBestanden(stand, stand.lk)) {
        stand.lk += 1;
        aufstieg = true;
      }
    }
    return { aufstieg };
  }

  function klasseBestanden(stand, lk) {
    const best = stand.lkBestwerte[lk];
    return po.DISZIPLIN_REIHENFOLGE.every((d) => (best[d] || 0) >= po.MINDESTPUNKTE_JE_DISZIPLIN);
  }

  SHS.career = {
    TRAININGS, TRAININGS_JE_WOCHE, TRAININGSTAGE, naechsterTrainingstag,
    neuerSpielstand, trainieren, uebungssucheVerbuchen, wocheBeenden, eintragen, klasseBestanden,
    darfPruefen, datumText, alterText, aktualisiereAusschreibungen,
  };
})(globalThis.SHS = globalThis.SHS || {});
