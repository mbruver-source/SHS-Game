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
      suchprotokoll: [],
    };
    stand.hund.vertrautheit.korken = 0.3; // erster Gegenstand ist schon angefüttert
    aktualisiereAusschreibungen(stand);
    return stand;
  }

  function rndFuer(stand, salz) {
    let teamSalz = 0;
    for (const c of String(stand.hund.name)) teamSalz = (teamSalz * 31 + c.charCodeAt(0)) >>> 0;
    return SHS.rng((stand.seed + stand.woche * 7919 + stand.trainingsDieseWoche * 104729 + (salz || 0) + teamSalz) >>> 0);
  }

  // ---------------------------------------------------------------- Profil (Benutzer) mit mehreren Hunden
  // Ein Profil gehört einem Hundeführer. Jeder Hund ist ein "Team" (Spielstand der Version 1) mit eigenen
  // Werten, Training, LK und Leistungsnachweis. Kalender (Woche, Ausschreibungen) und HF sind gemeinsam.
  const MAX_HUNDE_JE_PRUEFUNG = 2; // PO: ein HF darf maximal 2 Hunde vorführen

  function neuesProfil(hfName, hundName, rasse, fell, seed) {
    const team = neuerSpielstand(hfName, hundName, rasse, seed);
    team.hund.fell = fell;
    return { version: 2, id: 'p' + (seed >>> 0).toString(36) + Date.now().toString(36), hfName, seed: seed >>> 0, teams: [team], aktiv: 0, pruefungsStarts: {} };
  }

  function ausAltemStand(stand) {
    return { version: 2, id: 'p' + (stand.seed >>> 0).toString(36) + 'alt', hfName: stand.hf.name, seed: stand.seed, teams: [stand], aktiv: 0, pruefungsStarts: {} };
  }

  function aktivesTeam(profil) {
    return profil.teams[Math.min(profil.aktiv || 0, profil.teams.length - 1)];
  }

  // Weiteren Hund aufnehmen: startet mit 12 Monaten in der aktuellen Woche des Profils.
  function hundAufnehmen(profil, hundName, rasse, fell) {
    const vorlage = profil.teams[0];
    const team = neuerSpielstand(profil.hfName, hundName, rasse, profil.seed);
    team.hund.fell = fell;
    team.woche = vorlage.woche;
    team.ausschreibungen = [];
    aktualisiereAusschreibungen(team);
    // bereits gelaufene Prüfungen dieses Profils bleiben für den neuen Hund unberührt (eigene erledigt-Flags)
    profil.teams.push(team);
    profil.aktiv = profil.teams.length - 1;
    return team;
  }

  function wocheBeendenProfil(profil) {
    for (const t of profil.teams) wocheBeenden(t);
  }

  // HF-Erfahrung über alle Hunde des Profils.
  function hfErfahrungProfil(profil) {
    let trainings = 0; let uebungen = 0; let pruefungen = 0;
    for (const t of profil.teams) {
      const u = t.verlauf.filter((v) => v.typ === 'uebung').length;
      uebungen += u; trainings += t.verlauf.length - u; pruefungen += t.leistungsnachweis.length;
    }
    return clamp(0.25 + trainings * 0.008 + uebungen * 0.02 + pruefungen * 0.04, 0, 0.95);
  }

  // Eigene Starts in einer Prüfung (für Rangliste und PO-Grenze von 2 Hunden je HF).
  function eigeneStarts(profil, pruefungId) {
    if (!profil.pruefungsStarts) profil.pruefungsStarts = {};
    return profil.pruefungsStarts[pruefungId] || [];
  }

  function startVermerken(profil, pruefungId, eintrag) {
    if (!profil.pruefungsStarts) profil.pruefungsStarts = {};
    if (!profil.pruefungsStarts[pruefungId]) profil.pruefungsStarts[pruefungId] = [];
    profil.pruefungsStarts[pruefungId].push(eintrag);
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
    stand.verlauf.push({ woche: stand.woche, text: 'Übungssuche', typ: 'uebung' });
    return d;
  }

  // Erfahrung des Hundeführers (0..1): wächst mit Trainings, Übungssuchen und Prüfungen.
  // Bestimmt bei automatischer Vorführung, wie gut der HF seinen Hund liest und führt.
  function hfErfahrung(stand) {
    const uebungen = stand.verlauf.filter((v) => v.typ === 'uebung').length;
    const trainings = stand.verlauf.length - uebungen;
    const pruefungen = stand.leistungsnachweis.length;
    return clamp(0.25 + trainings * 0.008 + uebungen * 0.02 + pruefungen * 0.04, 0, 0.95);
  }

  // Protokoll der eigenen Suchen (Übung und Prüfung) für die Trainingsempfehlung.
  function protokolliereSuche(stand, eintrag) {
    if (!eintrag.ergebnis) return;
    if (!stand.suchprotokoll) stand.suchprotokoll = [];
    const e = eintrag.ergebnis;
    stand.suchprotokoll.push({
      woche: stand.woche, art: eintrag.art, disziplin: eintrag.disziplin, lk: eintrag.lk,
      status: e.status, punkte: e.punkte, gefunden: !!e.gefunden, fehlanzeigen: e.fehlanzeigen || 0,
      fehler: e.fehler || {}, intensitaet: e.intensitaet || 0,
    });
    if (stand.suchprotokoll.length > 30) stand.suchprotokoll.splice(0, stand.suchprotokoll.length - 30);
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
    TRAININGS, TRAININGS_JE_WOCHE, TRAININGSTAGE, naechsterTrainingstag, hfErfahrung, protokolliereSuche,
    MAX_HUNDE_JE_PRUEFUNG, neuesProfil, ausAltemStand, aktivesTeam, hundAufnehmen, wocheBeendenProfil,
    hfErfahrungProfil, eigeneStarts, startVermerken,
    neuerSpielstand, trainieren, uebungssucheVerbuchen, wocheBeenden, eintragen, klasseBestanden,
    darfPruefen, datumText, alterText, aktualisiereAusschreibungen,
  };
})(globalThis.SHS = globalThis.SHS || {});
