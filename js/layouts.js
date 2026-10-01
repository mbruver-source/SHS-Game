// Erzeugt Suchlagen (Weltkoordinaten in Metern, x nach rechts, y nach unten)
// gemäß den Anforderungen der Leistungsklassen (PO III.C).
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const BEHAELTNIS_TYPEN_LK3 = ['Werkzeugkoffer', 'Aktenkoffer', 'Holzkiste', 'Rucksack', 'Handtasche',
    'Reisetasche', 'Weidenkorb', 'Kühlbox', 'Sporttasche', 'Kunststoffkiste'];
  const TRUEMMER_TYPEN = ['Brett', 'Stein', 'Rohr', 'Reifen', 'Ziegel', 'Kiste', 'Palette', 'Eimer'];

  function abstandOk(punkte, x, y, min) {
    return punkte.every((p) => Math.hypot(p.x - x, p.y - y) >= min);
  }

  function verleitungQuelle(typ, name, x, y, versteckId) {
    return { typ, name, x, y, hoehe: 0, versteckId: versteckId || null, staerke: typ === 'futter' ? 1.0 : 0.6, reichweite: 1.2 };
  }

  function behaeltnisstrecke(lk, r) {
    const cfg = po.LK[lk].behaeltnis;
    const abstand = 1.6;
    const y = 3;
    const x0 = 2.2;
    const verstecke = [];
    const typen = cfg.gleich ? null : r.shuffle(BEHAELTNIS_TYPEN_LK3);
    for (let i = 0; i < cfg.anzahl; i++) {
      const x = x0 + i * abstand;
      const kammern = [];
      for (let k = 0; k < cfg.kammern; k++) {
        const w = (k / cfg.kammern) * Math.PI * 2 + r.range(-0.3, 0.3);
        kammern.push({ x: x + Math.cos(w) * 0.3, y: y + Math.sin(w) * 0.3, hoehe: r.range(0.05, 0.35) });
      }
      verstecke.push({
        id: 'b' + i, x, y, r: 0.3,
        typ: cfg.gleich ? 'Mehrkammereimer' : typen[i % typen.length],
        form: cfg.gleich ? 'rund' : r.pick(['eckig', 'rund', 'eckig']),
        kammern,
      });
    }
    const welt = { w: x0 * 2 + (cfg.anzahl - 1) * abstand, h: 6 };
    const bereich = { x: 1.2, y: 1.6, w: welt.w - 2.4, h: 2.8 };

    const ids = r.shuffle(verstecke.map((v, i) => i));
    const zielIdx = ids.pop();
    const ziel = verstecke[zielIdx];
    const kammer = r.pick(ziel.kammern);
    const quellen = [{ typ: 'ziel', name: 'Suchgegenstand', x: kammer.x, y: kammer.y, hoehe: kammer.hoehe, versteckId: ziel.id, staerke: 0.7, reichweite: 0.45 }];
    ziel.hatZiel = true;

    for (let i = 0; i < cfg.spielzeug; i++) {
      const v = verstecke[ids.pop()];
      v.verleitung = 'spielzeug';
      quellen.push(verleitungQuelle('spielzeug', r.pick(po.SPIELZEUG), v.x, v.y, v.id));
    }
    for (let i = 0; i < cfg.futter; i++) {
      const v = verstecke[ids.pop()];
      v.verleitung = 'futter';
      quellen.push(verleitungQuelle('futter', r.pick(po.FUTTER.slice(0, 4)), v.x, v.y, v.id));
    }
    if (cfg.differenzierung) {
      const v = verstecke[ids.pop()];
      const k = r.pick(v.kammern);
      quellen.push({ typ: 'differenzierung', name: 'Baugleicher Gegenstand', x: k.x, y: k.y, hoehe: k.hoehe, versteckId: v.id, staerke: 0.7, reichweite: 0.45 });
    }
    const eigengeruchVersteck = po.LK[lk].eigengeruch && ids.length ? verstecke[ids.pop()].id : null;

    // Der WR gibt den Ansatz vor: links oder rechts der Strecke.
    const links = r.chance(0.5);
    const ansatz = { x: links ? 0.7 : welt.w - 0.7, y, name: links ? 'linkes Ende' : 'rechtes Ende' };
    return { welt, bereich, verstecke, quellen, eigengeruchVersteck, ansatzOptionen: [ansatz], mittelweg: null };
  }

  function truemmerfeld(lk, r) {
    const cfg = po.LK[lk].truemmer;
    const welt = { w: 7, h: 7 };
    const bereich = { x: 1.5, y: 1.5, w: cfg.breite, h: cfg.tiefe };
    const minAbstand = lk === 1 ? 1.0 : lk === 2 ? 0.78 : 0.72;
    const verstecke = [];
    let versuche = 0;
    while (verstecke.length < cfg.verstecke && versuche++ < 3000) {
      const x = r.range(bereich.x + 0.35, bereich.x + bereich.w - 0.35);
      const y = r.range(bereich.y + 0.35, bereich.y + bereich.h - 0.35);
      if (!abstandOk(verstecke, x, y, minAbstand)) continue;
      verstecke.push({
        id: 't' + verstecke.length, x, y,
        typ: r.pick(TRUEMMER_TYPEN),
        w: r.range(0.3, 0.6), h: r.range(0.18, 0.35), rot: r.range(0, Math.PI),
        hoehe: 0,
      });
    }
    const ids = r.shuffle(verstecke.map((v, i) => i));
    for (let i = 0; i < cfg.hochlagen; i++) verstecke[ids[i]].hoehe = r.range(0.35, 0.55);

    const zielV = verstecke[ids.pop()];
    let hoehe = 0;
    if (lk === 2) hoehe = r.range(0, cfg.maxHoehe);
    if (lk === 3) hoehe = zielV.hoehe > 0 ? zielV.hoehe : r.range(0, 0.2);
    const quellen = [{ typ: 'ziel', name: 'Suchgegenstand', x: zielV.x + r.range(-0.08, 0.08), y: zielV.y + r.range(-0.08, 0.08), hoehe, versteckId: zielV.id, staerke: 1.0, reichweite: 0.9 }];
    zielV.hatZiel = true;

    const freierPunkt = () => {
      for (let i = 0; i < 500; i++) {
        const x = r.range(bereich.x + 0.2, bereich.x + bereich.w - 0.2);
        const y = r.range(bereich.y + 0.2, bereich.y + bereich.h - 0.2);
        if (Math.hypot(x - quellen[0].x, y - quellen[0].y) > 0.9 && abstandOk(quellen, x, y, 0.45)) return { x, y };
      }
      return { x: bereich.x + 0.3, y: bereich.y + 0.3 };
    };
    r.shuffle(po.SPIELZEUG.concat(po.SPIELZEUG)).slice(0, cfg.spielzeug).forEach((name) => {
      const p = freierPunkt();
      quellen.push(verleitungQuelle('spielzeug', name, p.x, p.y));
    });
    r.shuffle(po.FUTTER.slice(0, 4).concat(po.FUTTER.slice(0, 4))).slice(0, cfg.futter).forEach((name) => {
      const p = freierPunkt();
      quellen.push(verleitungQuelle('futter', name, p.x, p.y));
    });
    if (cfg.differenzierung) {
      const v = verstecke[ids.pop()];
      quellen.push({ typ: 'differenzierung', name: 'Baugleicher Gegenstand', x: v.x, y: v.y, hoehe: v.hoehe, versteckId: v.id, staerke: 1.0, reichweite: 0.9 });
    }
    const eigengeruchVersteck = po.LK[lk].eigengeruch && ids.length ? verstecke[ids.pop()].id : null;

    const cx = bereich.x + bereich.w / 2;
    const cy = bereich.y + bereich.h / 2;
    const ansatzOptionen = [
      { x: cx, y: bereich.y - 0.7, name: 'Nordseite' },
      { x: bereich.x + bereich.w + 0.7, y: cy, name: 'Ostseite' },
      { x: cx, y: bereich.y + bereich.h + 0.7, name: 'Südseite' },
      { x: bereich.x - 0.7, y: cy, name: 'Westseite' },
    ];
    return { welt, bereich, verstecke, quellen, eigengeruchVersteck, ansatzOptionen, mittelweg: null };
  }

  function flaeche(lk, r) {
    const cfg = po.LK[lk].flaeche;
    const welt = { w: cfg.breite + 2, h: cfg.laenge + 2 };
    const bereich = { x: 1, y: 1, w: cfg.breite, h: cfg.laenge };
    const mitte = bereich.x + bereich.w / 2;
    const mittelweg = { x: mitte - 0.5, y: bereich.y, w: 1, h: bereich.h };

    const punktAusserhalbWeg = (abstandZu) => {
      for (let i = 0; i < 1000; i++) {
        const x = r.range(bereich.x + 0.4, bereich.x + bereich.w - 0.4);
        const y = r.range(bereich.y + 1.5, bereich.y + bereich.h - 1.5);
        if (Math.abs(x - mitte) < 1.2) continue;
        if (abstandOk(abstandZu, x, y, 1.6)) return { x, y };
      }
      return { x: bereich.x + 1, y: bereich.y + 2 };
    };
    const quellen = [];
    const z = punktAusserhalbWeg([]);
    quellen.push({ typ: 'ziel', name: 'Suchgegenstand', x: z.x, y: z.y, hoehe: 0, versteckId: null, staerke: 1.0, reichweite: 1.4 });
    for (let i = 0; i < cfg.spielzeug; i++) {
      const p = punktAusserhalbWeg(quellen);
      quellen.push(verleitungQuelle('spielzeug', po.SPIELZEUG[i % 5], p.x, p.y));
    }
    for (let i = 0; i < cfg.futter; i++) {
      const p = punktAusserhalbWeg(quellen);
      quellen.push(verleitungQuelle('futter', po.FUTTER[i % 5], p.x, p.y));
    }
    if (cfg.differenzierung) {
      const p = punktAusserhalbWeg(quellen);
      quellen.push({ typ: 'differenzierung', name: 'Baugleicher Gegenstand', x: p.x, y: p.y, hoehe: 0, versteckId: null, staerke: 1.0, reichweite: 1.4 });
    }
    const ansatzOptionen = [
      { x: mitte, y: bereich.y - 0.4, name: 'Ansatz A (Anfang des Mittelwegs)' },
      { x: mitte, y: bereich.y + bereich.h + 0.4, name: 'Ansatz B (Ende des Mittelwegs)' },
    ];
    return { welt, bereich, verstecke: [], quellen, eigengeruchVersteck: null, ansatzOptionen, mittelweg };
  }

  function erzeuge(disziplin, lk, seed) {
    const r = SHS.rng(seed);
    let lage;
    if (disziplin === 'behaeltnis') lage = behaeltnisstrecke(lk, r);
    else if (disziplin === 'truemmer') lage = truemmerfeld(lk, r);
    else if (disziplin === 'flaeche') lage = flaeche(lk, r);
    else throw new Error('Unbekannte Disziplin: ' + disziplin);
    lage.disziplin = disziplin;
    lage.lk = lk;
    lage.seed = seed;
    lage.wind = SHS.scent.wind(r.range(0, 360), r.range(0.15, 0.8));
    return lage;
  }

  function imBereich(lage, x, y, rand) {
    const b = lage.bereich;
    const m = rand || 0;
    return x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m;
  }

  SHS.layouts = { erzeuge, imBereich };
})(globalThis.SHS = globalThis.SHS || {});
