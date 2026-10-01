// Erfolge (Abzeichen) je Benutzer: werden nach Training, Suchen, Prüfungen und Wochenende geprüft.
// DOM-frei; die Anzeige übernimmt ui.js.
(function (SHS) {
  'use strict';

  const alleTeams = (p) => p.teams;
  const alleLN = (p) => p.teams.flatMap((t) => t.leistungsnachweis);
  const allesProtokoll = (p) => p.teams.flatMap((t) => t.suchprotokoll || []);
  const bestanden = (e) => e.status !== 'disq' && e.abk && !['nB', 'ABBR', 'DISQ'].includes(e.abk);

  const ERFOLGE = [
    { id: 'erste_suche', symbol: '🐾', name: 'Erste Suche', text: 'Eine Übungssuche abgeschlossen.', pruef: (p) => allesProtokoll(p).length > 0 },
    { id: 'fund', symbol: '🎯', name: 'Gefunden!', text: 'Den Gegenstand gefunden und richtig gemeldet.', pruef: (p) => allesProtokoll(p).some((e) => e.gefunden) },
    { id: 'fehlerfrei', symbol: '💯', name: 'Fehlerfrei', text: 'Eine Suche mit 100 Punkten.', pruef: (p) => allesProtokoll(p).some((e) => e.punkte === 100) },
    { id: 'ohne_hilfe', symbol: '🤫', name: 'Stiller Hundeführer', text: 'Eine Prüfungsdisziplin mit Fund und ohne jede Hilfe.', pruef: (p) => allesProtokoll(p).some((e) => e.art === 'pruefung' && e.gefunden && !(e.fehler || {}).hilfe) },
    { id: 'wetterfest', symbol: '🌧', name: 'Wetterfest', text: 'Bei Regen oder Schnee eine Suche mit mindestens 70 Punkten.', pruef: (p) => allesProtokoll(p).some((e) => e.regen && e.punkte >= 70) },
    { id: 'erste_pruefung', symbol: '📜', name: 'Geprüft', text: 'Die erste Prüfung bestanden.', pruef: (p) => alleLN(p).some(bestanden) },
    { id: 'vorzueglich', symbol: '⭐', name: 'Vorzüglich', text: 'Eine Prüfung mit der Wertnote „Vorzüglich“.', pruef: (p) => alleLN(p).some((e) => e.abk === 'V') },
    { id: 'dreikampf', symbol: '🏅', name: 'Dreikämpfer', text: 'Einen Dreikampf bestanden.', pruef: (p) => alleLN(p).some((e) => e.art === 'DK' && bestanden(e)) },
    { id: 'lk2', symbol: '2️⃣', name: 'Aufsteiger', text: 'Ein Hund hat LK 2 erreicht.', pruef: (p) => alleTeams(p).some((t) => t.lk >= 2) },
    { id: 'lk3', symbol: '3️⃣', name: 'Spitzenklasse', text: 'Ein Hund hat LK 3 erreicht.', pruef: (p) => alleTeams(p).some((t) => t.lk >= 3) },
    { id: 'meisterschaft', symbol: '🏟', name: 'Auf großer Bühne', text: 'An einer Meisterschaft teilgenommen.', pruef: (p) => alleLN(p).some((e) => e.meisterschaft) },
    { id: 'titel', symbol: '🏆', name: 'Champion', text: 'Eine Meisterschaft gewonnen.', pruef: (p) => alleTeams(p).some((t) => (t.titel || []).length > 0) },
    { id: 'fleissig', symbol: '💪', name: 'Fleißig', text: '50 Trainingseinheiten absolviert.', pruef: (p) => alleTeams(p).reduce((n, t) => n + t.verlauf.length, 0) >= 50 },
    { id: 'rudel', symbol: '🐕', name: 'Rudel', text: 'Zwei oder mehr Hunde im Training.', pruef: (p) => p.teams.length >= 2 },
    { id: 'nase', symbol: '👃', name: 'Supernase', text: 'Ein Hund mit Nase 80 oder mehr.', pruef: (p) => alleTeams(p).some((t) => t.hund.werte.nase >= 80) },
    { id: 'jahr', symbol: '📅', name: 'Ein Jahr dabei', text: '52 Wochen gespielt.', pruef: (p) => p.teams[0].woche >= 53 },
  ];

  // Prüft alle Erfolge und liefert die neu erreichten (und vermerkt sie im Profil).
  function pruefen(profil) {
    if (!profil.erfolge) profil.erfolge = {};
    const neu = [];
    for (const e of ERFOLGE) {
      if (profil.erfolge[e.id]) continue;
      let ok = false;
      try { ok = e.pruef(profil); } catch (err) { ok = false; }
      if (ok) { profil.erfolge[e.id] = profil.teams[0].woche; neu.push(e); }
    }
    return neu;
  }

  SHS.erfolge = { ERFOLGE, pruefen };
})(globalThis.SHS = globalThis.SHS || {});
