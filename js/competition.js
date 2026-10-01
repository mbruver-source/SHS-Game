// Prüfungen mit KI-Teilnehmern: Teams erzeugen, Suchen simulieren, Rangliste je LK.
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const HF_NAMEN = ['Anja K.', 'Thomas B.', 'Sabine M.', 'Jürgen W.', 'Petra L.', 'Michael S.', 'Claudia R.',
    'Stefan H.', 'Nicole F.', 'Andreas P.', 'Katrin D.', 'Uwe T.', 'Melanie G.', 'Frank N.'];
  const HUNDE_NAMEN = ['Ayko', 'Bella', 'Cara', 'Dex', 'Emmi', 'Finn', 'Gina', 'Hector', 'Ilvy', 'Jaro',
    'Kira', 'Lasse', 'Mila', 'Nala', 'Odin', 'Pepper', 'Quinn', 'Rocky', 'Sky', 'Toni'];

  function kiTeams(pruefung, lk, anzahl) {
    const r = SHS.rng((pruefung.seed ^ 0x9e3779b9) >>> 0);
    const hf = r.shuffle(HF_NAMEN);
    const hunde = r.shuffle(HUNDE_NAMEN);
    const rassen = Object.keys(SHS.dog.RASSEN);
    const teams = [];
    for (let i = 0; i < anzahl; i++) {
      const hund = SHS.dog.neuerHund(hunde[i % hunde.length], r.pick(rassen));
      const niveau = 38 + (lk - 1) * 18 + (pruefung.niveau || 0) + r.gauss() * 10;
      for (const k of Object.keys(hund.werte)) hund.werte[k] = Math.max(10, Math.min(95, niveau + r.gauss() * 9));
      for (const g of po.GEGENSTAENDE) hund.vertrautheit[g.id] = Math.max(0.3, Math.min(1, 0.45 + lk * 0.12 + r.gauss() * 0.12));
      hund.alterMonate = 18 + r.int(0, 60);
      teams.push({ hf: hf[i % hf.length], hund, erfahrung: Math.max(0.1, Math.min(1, 0.4 + lk * 0.12 + r.gauss() * 0.15)), ki: true });
    }
    return teams;
  }

  function disziplinenDer(pruefung) {
    return pruefung.art === 'DK' ? po.DISZIPLIN_REIHENFOLGE.slice() : [pruefung.disziplin];
  }

  // Simuliert alle Disziplinen eines KI-Teams.
  function simuliereTeam(team, pruefung, lk, nr) {
    const einzelwerte = {};
    let status = 'ok';
    disziplinenDer(pruefung).forEach((d, i) => {
      if (status === 'disq') { einzelwerte[d] = null; return; }
      const e = SHS.simuliereSuche({
        disziplin: d, lk, seed: (pruefung.seed + nr * 1009 + i * 7919) >>> 0,
        hund: team.hund, gegenstand: po.GEGENSTAENDE[(nr + i) % po.GEGENSTAENDE.length].id,
        ansatzIndex: nr % 2, leine: lk < 3, monat: pruefung.woche ? SHS.career.monatDerWoche(pruefung.woche) : undefined,
      }, team.erfahrung);
      if (e.status === 'disq') status = 'disq';
      einzelwerte[d] = e.status === 'ok' ? e.punkte : null;
    });
    return { einzelwerte, status };
  }

  function auswerten(einzelwerte, art, status) {
    return po.bewertePruefung(einzelwerte, art, status);
  }

  SHS.competition = { kiTeams, simuliereTeam, auswerten, disziplinenDer };
})(globalThis.SHS = globalThis.SHS || {});
