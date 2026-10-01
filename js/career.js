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
    stand.historie = [];
    verlaufMerken(stand);
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

  function neuesProfil(hfName, hundName, rasse, fell, seed, geschlecht) {
    const team = neuerSpielstand(hfName, hundName, rasse, seed);
    team.hund.fell = fell;
    team.hund.geschlecht = geschlecht || 'Rüde';
    return { version: 2, id: 'p' + (seed >>> 0).toString(36) + Date.now().toString(36), hfName, seed: seed >>> 0, teams: [team], aktiv: 0, pruefungsStarts: {} };
  }

  function ausAltemStand(stand) {
    return { version: 2, id: 'p' + (stand.seed >>> 0).toString(36) + 'alt', hfName: stand.hf.name, seed: stand.seed, teams: [stand], aktiv: 0, pruefungsStarts: {} };
  }

  function aktivesTeam(profil) {
    return profil.teams[Math.min(profil.aktiv || 0, profil.teams.length - 1)];
  }

  // Weiteren Hund aufnehmen: startet mit 12 Monaten in der aktuellen Woche des Profils.
  function hundAufnehmen(profil, hundName, rasse, fell, geschlecht) {
    const vorlage = profil.teams[0];
    const team = neuerSpielstand(profil.hfName, hundName, rasse, profil.seed);
    team.hund.fell = fell;
    team.hund.geschlecht = geschlecht || 'Rüde';
    team.woche = vorlage.woche;
    team.historie = [];
    verlaufMerken(team);
    team.ausschreibungen = [];
    aktualisiereAusschreibungen(team);
    // bereits gelaufene Prüfungen dieses Profils bleiben für den neuen Hund unberührt (eigene erledigt-Flags)
    team.schwierigkeit = profil.schwierigkeit || 'normal';
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

  function monatDerWoche(woche) {
    return datumDerWoche(woche).getMonth() + 1;
  }

  function datumText(woche) {
    return datumDerWoche(woche).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function alterText(monate) {
    const m = Math.floor(monate);
    return m >= 24 ? `${Math.floor(m / 12)} J. ${m % 12} Mon.` : `${m} Monate`;
  }

  // Läufigkeit (PO II.1.3): Hündinnen ab 8 Monaten etwa alle 6 Monate für rund 3 Wochen.
  // ANNAHME: Zyklus 26 Wochen, Beginn je Hündin aus dem Namen abgeleitet.
  function istLaeufig(stand, woche) {
    const h = stand.hund;
    if (h.geschlecht !== 'Hündin' || h.alterMonate < 8) return false;
    let phase = 0;
    for (const c of String(h.name)) phase = (phase * 31 + c.charCodeAt(0)) % 26;
    return ((woche ?? stand.woche) + phase) % 26 < 3;
  }

  function pronomen(stand) {
    return stand.hund.geschlecht === 'Hündin' ? 'sie' : 'er';
  }

  // ---------------------------------------------------------------- Gesundheit, Alter, Schwierigkeit
  // ANNAHME: Training im müden Zustand (Energie < 35 %) kann zu einer Verletzung führen (1–3 Wochen Pause).
  const VERLETZUNGEN = ['Zerrung', 'Pfotenverletzung', 'Muskelkater', 'Prellung'];
  function verletzungsRisiko(stand) {
    const e = stand.hund.energie;
    return e < 0.35 ? 0.04 + 0.25 * (0.35 - e) / 0.35 : 0.004;
  }

  function istVerletzt(stand) {
    const v = stand.hund.verletzt;
    return !!(v && stand.woche < v.bisWoche);
  }

  // Altersphase: jung (< 18 Monate), Hochphase, Senior (ab 8 Jahren)
  function altersPhase(stand) {
    const m = stand.hund.alterMonate;
    if (m < 18) return 'jung';
    if (m >= 96) return 'senior';
    return 'hoch';
  }

  // Lernfaktor nach Alter: junge Hunde lernen schneller, Senioren langsamer.
  function altersLernFaktor(stand) {
    const m = stand.hund.alterMonate;
    if (m < 15) return 1.15;
    if (m >= 96) return Math.max(0.5, 0.85 - (m - 96) / 120);
    return 1;
  }

  // Schwierigkeitsgrad je Benutzer: Lerntempo und Stärke der KI-Konkurrenz
  const SCHWIERIGKEIT = {
    einsteiger: { name: 'Einsteiger', lernen: 1.25, kiNiveau: -8 },
    normal: { name: 'Normal', lernen: 1, kiNiveau: 0 },
    profi: { name: 'Profi', lernen: 0.85, kiNiveau: 6 },
  };
  function schwierigkeit(stand) {
    return SCHWIERIGKEIT[stand.schwierigkeit] || SCHWIERIGKEIT.normal;
  }

  function darfPruefen(stand) {
    if (istVerletzt(stand)) return false;
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

  // Nach einer Einheit: Verletzungsrisiko bei Überlastung prüfen.
  function verletzungPruefen(stand, r, energieVorher) {
    const risiko = energieVorher < 0.35 ? 0.04 + 0.25 * (0.35 - energieVorher) / 0.35 : 0.004;
    if (r() >= risiko) return null;
    const wochen = r.int(1, 3);
    stand.hund.verletzt = { art: r.pick(VERLETZUNGEN), bisWoche: stand.woche + wochen };
    return stand.hund.verletzt;
  }

  // zusatzFaktor: z. B. aus dem Minispiel des Anzeigetrainings (0,6 … 1,5)
  function trainieren(stand, art, gegenstandId, zusatzFaktor) {
    if (stand.trainingsDieseWoche >= TRAININGS_JE_WOCHE) {
      return { ok: false, text: 'Diese Woche sind keine Trainingseinheiten mehr frei.' };
    }
    if (istVerletzt(stand)) {
      return { ok: false, text: `${stand.hund.name} ist verletzt (${stand.hund.verletzt.art}) und muss sich bis Woche ${stand.hund.verletzt.bisWoche} schonen.` };
    }
    const t = TRAININGS[art];
    if (!t) return { ok: false, text: 'Unbekanntes Training.' };
    const h = stand.hund;
    const r = rndFuer(stand, art.length * 31);
    const einheit = einheitBeginnen(stand);
    const energieVorher = h.energie;
    const muede = einheit.faktor < 1;
    const faktor = einheit.faktor * r.range(0.75, 1.25) * altersLernFaktor(stand) * schwierigkeit(stand).lernen * (zusatzFaktor || 1);
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
    const verletzung = verletzungPruefen(stand, r, energieVorher);
    const text = `${einheit.tag}: ${t.name}${einheit.zustand ? ` (Hund ${einheit.zustand})` : ''}`;
    stand.verlauf.push({ woche: stand.woche, text });
    return { ok: true, text, deltas: d, muede, verletzung };
  }

  // Übungssuche als Trainingseinheit: kleiner Zuwachs abhängig vom Ergebnis.
  function uebungssucheVerbuchen(stand, ergebnis, gegenstandId) {
    if (stand.trainingsDieseWoche >= TRAININGS_JE_WOCHE || istVerletzt(stand)) return null;
    const h = stand.hund;
    const energieVorher = h.energie;
    const f = einheitBeginnen(stand).faktor * altersLernFaktor(stand) * schwierigkeit(stand).lernen;
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
    const verletzung = verletzungPruefen(stand, rndFuer(stand, 77), energieVorher);
    if (verletzung) d.verletzung = verletzung;
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
      regen: !!(e.suchlage && e.suchlage.wetter && e.suchlage.wetter.regen) || !!eintrag.regen,
    });
    if (stand.suchprotokoll.length > 30) stand.suchprotokoll.splice(0, stand.suchprotokoll.length - 30);
  }

  // Wöchentlicher Schnappschuss der Werte für den Verlauf (max. 104 Wochen).
  function verlaufMerken(stand) {
    if (!stand.historie) stand.historie = [];
    const werte = {};
    for (const [k, v] of Object.entries(stand.hund.werte)) werte[k] = Math.round(v * 10) / 10;
    const letzter = stand.historie[stand.historie.length - 1];
    if (letzter && letzter.woche === stand.woche) stand.historie.pop();
    stand.historie.push({ woche: stand.woche, lk: stand.lk, werte });
    if (stand.historie.length > 104) stand.historie.shift();
  }

  function wocheBeenden(stand) {
    const h = stand.hund;
    const ausgefallen = TRAININGS_JE_WOCHE - stand.trainingsDieseWoche; // ausgelassene Einheiten = zusätzliche Ruhe
    h.energie = clamp(h.energie + ERHOLUNG_WOCHENENDE + ausgefallen * ERHOLUNG_RUHETAG, 0, 1);
    h.alterMonate = Math.round((h.alterMonate + 7 / 30.44) * 100) / 100;
    if (h.verletzt && stand.woche + 1 >= h.verletzt.bisWoche) h.verletzt = null; // ausgeheilt
    // Nicht trainierte Gerüche verblassen leicht.
    for (const k of Object.keys(h.vertrautheit)) h.vertrautheit[k] = clamp(h.vertrautheit[k] - 0.004, 0.05, 1);
    stand.woche += 1;
    verlaufMerken(stand);
    stand.trainingsDieseWoche = 0;
    aktualisiereAusschreibungen(stand);
  }

  const VEREINE = ['SV Waldheide', 'HSV Am Bruch', 'VdH Nordkreis', 'Hundefreunde Rheinaue', 'SHS-Team Mittelland',
    'HSF Lindenhof', 'Gebrauchshundverein Talblick', 'Spürnasen e.V.', 'HV Kirchberg', 'Nasenarbeit Süd'];

  // Hält immer die nächsten Ausschreibungen vor (ab Woche 2, alle 2–3 Wochen).
  function aktualisiereAusschreibungen(stand) {
    stand.ausschreibungen = stand.ausschreibungen.filter((a) => a.woche >= stand.woche && !a.erledigt);
    const regulaer = () => stand.ausschreibungen.filter((a) => !a.meisterschaft);
    let letzte = regulaer().reduce((m, a) => Math.max(m, a.woche), stand.woche);
    while (regulaer().length < 3) {
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
    // Meisterschaften in den nächsten 12 Wochen
    for (let w = stand.woche; w <= stand.woche + 12; w++) {
      for (const [typ, m] of Object.entries(MEISTERSCHAFTEN)) {
        if (w % m.abstand !== m.versatz) continue;
        const id = `${typ.toLowerCase()}${w}`;
        if (stand.ausschreibungen.some((a) => a.id === id) || (stand.erledigteMeisterschaften || []).includes(id)) continue;
        stand.ausschreibungen.push({ id, woche: w, verein: m.name, art: 'DK', disziplin: null, meisterschaft: typ, seed: (stand.seed + w * 2654435761) >>> 0 });
      }
    }
    stand.ausschreibungen.sort((a, b) => a.woche - b.woche);
  }

  // ---------------------------------------------------------------- Meisterschaften
  // ANNAHME (Spiel): Landesmeisterschaft alle 20 Wochen, Bundesmeisterschaft alle 40 Wochen.
  // Immer SHS-Dreikampf LK 3. Qualifikation:
  //  - LM: in LK 3 einen Dreikampf mit mindestens "Gut" (240 Punkte) bestanden
  //  - BM: bei einer Landesmeisterschaft Platz 1–3 oder mindestens 270 Punkte
  const MEISTERSCHAFTEN = {
    LM: { name: 'Landesmeisterschaft Spürhundesport', kurz: 'Landesmeister', abstand: 20, versatz: 12, teilnehmer: 16, niveau: 3 },
    BM: { name: 'Bundesmeisterschaft Spürhundesport', kurz: 'Bundessieger', abstand: 40, versatz: 32, teilnehmer: 20, niveau: 7 },
  };

  function meisterschaftsQualifikation(stand, typ) {
    if (stand.lk < 3) return { ok: false, grund: 'Nur für Hunde in LK 3' };
    const ln = stand.leistungsnachweis.filter((e) => e.status !== 'disq');
    if (typ === 'LM') {
      const q = ln.some((e) => e.lk === 3 && e.art === 'DK' && !e.meisterschaft && e.punkte >= 240 && e.abk !== 'nB' && e.abk !== 'ABBR');
      return q ? { ok: true } : { ok: false, grund: 'Qualifikation: Dreikampf LK 3 mit mind. 240 Punkten' };
    }
    const q = ln.some((e) => e.meisterschaft === 'LM' && ((e.platz && e.platz <= 3) || e.punkte >= 270));
    return q ? { ok: true } : { ok: false, grund: 'Qualifikation: Landesmeisterschaft Platz 1–3 oder mind. 270 Punkte' };
  }

  // Trägt ein Prüfungsergebnis ein und prüft den Klassenaufstieg (PO III.A.5).
  function eintragen(stand, eintrag) {
    stand.leistungsnachweis.push(eintrag);
    if (eintrag.meisterschaft) {
      stand.erledigteMeisterschaften = (stand.erledigteMeisterschaften || []).concat(eintrag.pruefungId);
      if (eintrag.platz === 1) {
        stand.titel = (stand.titel || []).concat(`${MEISTERSCHAFTEN[eintrag.meisterschaft].kurz} ${eintrag.datum.slice(-4)}`);
      }
    }
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
    TRAININGS, TRAININGS_JE_WOCHE, TRAININGSTAGE, naechsterTrainingstag, hfErfahrung, protokolliereSuche, verlaufMerken,
    MAX_HUNDE_JE_PRUEFUNG, neuesProfil, ausAltemStand, aktivesTeam, hundAufnehmen, wocheBeendenProfil,
    hfErfahrungProfil, eigeneStarts, startVermerken,
    neuerSpielstand, trainieren, uebungssucheVerbuchen, wocheBeenden, eintragen, klasseBestanden,
    SCHWIERIGKEIT, schwierigkeit, istVerletzt, verletzungsRisiko, altersPhase, altersLernFaktor,
    MEISTERSCHAFTEN, meisterschaftsQualifikation, darfPruefen, istLaeufig, pronomen, datumText, monatDerWoche, alterText, aktualisiereAusschreibungen,
  };
})(globalThis.SHS = globalThis.SHS || {});
