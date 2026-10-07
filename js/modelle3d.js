// 3D-Modelle für die WebGL-Ansicht (DOM-frei, in Node testbar).
// Ein Netz ist { p: [x,y,z,…], n: [nx,ny,nz,…], f: [r,g,b,a,…] } aus Dreiecken (ohne Index).
// Koordinaten wie in mathe3d: x = Welt-x, y = Höhe, z = Welt-y; Maße in Metern.
(function (SHS) {
  'use strict';
  const M = SHS.mathe3d;

  // ANNAHME: Höhen der Trümmerteile (die Lage kennt nur die Grundfläche w × h).
  const HOEHEN = { Brett: 0.03, Palette: 0.12, Kiste: 0.28, Stein: 0.2, Rohr: null, Reifen: 0.18, Ziegel: 0.13, Eimer: 0.3 };
  // ANNAHME: Höhen der Behältnisse.
  const BEHAELTNIS_HOEHE = { rund: 0.42, eckig: 0.32 };

  const BEHAELTNIS_FARBEN = {
    Mehrkammereimer: '#e8e8e8',
    Werkzeugkoffer: '#b8322b', Aktenkoffer: '#2c2a28', Holzkiste: '#a7784a', Rucksack: '#3f6b3f', Handtasche: '#7a3f55',
    Reisetasche: '#2f4f7a', Weidenkorb: '#b99459', Kühlbox: '#d9dee3', Sporttasche: '#1f6aa5', Kunststoffkiste: '#5c6f7e',
  };

  // '#rgb', '#rrggbb' oder 'rgba(r,g,b,a)' → [r,g,b,a] (0..1)
  function farbe(c, alpha) {
    if (Array.isArray(c)) return c.length === 4 ? c : [c[0], c[1], c[2], alpha === undefined ? 1 : alpha];
    let r = 0.5; let g = 0.5; let b = 0.5; let a = 1;
    const s = String(c || '').trim();
    if (s[0] === '#') {
      const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7);
      r = parseInt(h.slice(0, 2), 16) / 255; g = parseInt(h.slice(2, 4), 16) / 255; b = parseInt(h.slice(4, 6), 16) / 255;
    } else {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const t = m[1].split(',').map(Number);
        r = t[0] / 255; g = t[1] / 255; b = t[2] / 255; a = t.length > 3 ? t[3] : 1;
      }
    }
    return [r, g, b, alpha === undefined ? a : alpha];
  }

  // Farbe aufhellen (f > 0) oder abdunkeln (f < 0)
  function ton(c, f) {
    const k = farbe(c);
    const z = f >= 0 ? 1 : 0; const a = Math.abs(f);
    return [k[0] + (z - k[0]) * a, k[1] + (z - k[1]) * a, k[2] + (z - k[2]) * a, k[3]];
  }

  // Farbe b mit Anteil t über a legen
  function mische(a, b, t) {
    const x = farbe(a); const y = farbe(b);
    return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, 1];
  }

  function netz() { return { p: [], n: [], f: [] }; }
  function anzahl(nz) { return nz.p.length / 3; }

  function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  // Ecke einfügen: Punkt und Normale werden mit m bzw. nm transformiert
  function ecke(nz, m, nm, x, y, z, nx, ny, nzz, col) {
    const p = M.transformiere(m, x, y, z);
    nz.p.push(p[0], p[1], p[2]);
    const a = nm[0] * nx + nm[3] * ny + nm[6] * nzz;
    const b = nm[1] * nx + nm[4] * ny + nm[7] * nzz;
    const c = nm[2] * nx + nm[5] * ny + nm[8] * nzz;
    const l = Math.hypot(a, b, c) || 1;
    nz.n.push(a / l, b / l, c / l);
    nz.f.push(col[0], col[1], col[2], col[3]);
  }

  // Farbangabe: fester Wert oder Funktion (x, y, z, nx, ny, nz) im lokalen System
  function farbeBei(col, x, y, z, nx, ny, nzz) { return farbe(typeof col === 'function' ? col(x, y, z, nx, ny, nzz) : col); }

  // Einheitswürfel −0,5..0,5, flach schattiert. col: Farbe, Funktion oder { oben, seite }
  function quader(nz, m, col) {
    const nm = M.normalenMatrix(m);
    const flaechen = [
      [[1, 0, 0], [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]]],
      [[-1, 0, 0], [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]]],
      [[0, 1, 0], [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]]],
      [[0, -1, 0], [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]]],
      [[0, 0, 1], [[0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, 0.5]]],
      [[0, 0, -1], [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5]]],
    ];
    for (const [n, q] of flaechen) {
      let c = col;
      if (col && !Array.isArray(col) && typeof col === 'object') c = n[1] > 0 ? col.oben : col.seite;
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const v = q[i];
        ecke(nz, m, nm, v[0], v[1], v[2], n[0], n[1], n[2], farbeBei(c || '#888888', v[0], v[1], v[2], n[0], n[1], n[2]));
      }
    }
  }

  // Zylinder entlang y (−0,5..0,5), Radius 0,5 unten; oben = Radius-Faktor oben (Kegelstumpf).
  function zylinder(nz, m, col, seg, oben, deckel) {
    seg = seg || 16;
    const ro = 0.5 * (oben === undefined ? 1 : oben); const ru = 0.5;
    const nm = M.normalenMatrix(m);
    const neig = ru - ro; // Normalen-Neigung für Kegelstümpfe
    const c = (x, y, z, nx, ny, nzz) => (typeof col === 'function' ? farbe(col(x, y, z, nx, ny, nzz)) : farbe(col));
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2; const a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0); const s0 = Math.sin(a0); const c1 = Math.cos(a1); const s1 = Math.sin(a1);
      const P = [[c0 * ru, -0.5, s0 * ru, c0, s0], [c1 * ru, -0.5, s1 * ru, c1, s1], [c1 * ro, 0.5, s1 * ro, c1, s1], [c0 * ro, 0.5, s0 * ro, c0, s0]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z, nx, nzz] = P[k];
        ecke(nz, m, nm, x, y, z, nx, neig, nzz, c(x, y, z, nx, neig, nzz));
      }
      if (deckel !== false) {
        for (const [y, r, ny] of [[0.5, ro, 1], [-0.5, ru, -1]]) {
          if (r <= 0) continue;
          const pts = ny > 0 ? [[0, 0], [c1 * r, s1 * r], [c0 * r, s0 * r]] : [[0, 0], [c0 * r, s0 * r], [c1 * r, s1 * r]];
          for (const [x, z] of pts) ecke(nz, m, nm, x, y, z, 0, ny, 0, c(x, y, z, 0, ny, 0));
        }
      }
    }
  }

  // Kugel mit Radius 0,5; form(u, v) liefert optional einen Radiusfaktor (für Steine).
  function kugel(nz, m, col, seg, ringe, form) {
    seg = seg || 12; ringe = ringe || 8;
    const nm = M.normalenMatrix(m);
    const pkt = (i, j) => {
      const u = (i % seg) / seg; const v = j / ringe;
      const th = u * Math.PI * 2; const ph = v * Math.PI;
      const nx = Math.sin(ph) * Math.cos(th); const ny = Math.cos(ph); const nzz = Math.sin(ph) * Math.sin(th);
      const f = form ? form(i % seg, j) : 1;
      return [nx * 0.5 * f, ny * 0.5 * f, nzz * 0.5 * f, nx, ny, nzz];
    };
    const c = (q) => (typeof col === 'function' ? farbe(col(q[0], q[1], q[2], q[3], q[4], q[5])) : farbe(col));
    for (let j = 0; j < ringe; j++) {
      for (let i = 0; i < seg; i++) {
        const a = pkt(i, j); const b = pkt(i + 1, j); const cc = pkt(i + 1, j + 1); const d = pkt(i, j + 1);
        for (const q of [a, cc, b, a, d, cc]) ecke(nz, m, nm, q[0], q[1], q[2], q[3], q[4], q[5], c(q));
      }
    }
  }

  // Torus in der x/z-Ebene: Ringradius R, Rohrradius r
  function torus(nz, m, col, R, r, segU, segV) {
    segU = segU || 20; segV = segV || 8;
    const nm = M.normalenMatrix(m);
    const pkt = (i, j) => {
      const u = (i / segU) * Math.PI * 2; const v = (j / segV) * Math.PI * 2;
      const nx = Math.cos(v) * Math.cos(u); const ny = Math.sin(v); const nzz = Math.cos(v) * Math.sin(u);
      return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u), nx, ny, nzz];
    };
    const c = (q) => (typeof col === 'function' ? farbe(col(q[0], q[1], q[2], q[3], q[4], q[5])) : farbe(col));
    for (let i = 0; i < segU; i++) {
      for (let j = 0; j < segV; j++) {
        const a = pkt(i, j); const b = pkt(i + 1, j); const cc = pkt(i + 1, j + 1); const d = pkt(i, j + 1);
        for (const q of [a, b, cc, a, cc, d]) ecke(nz, m, nm, q[0], q[1], q[2], q[3], q[4], q[5], c(q));
      }
    }
  }

  // Flaches Rechteck auf Höhe y (Boden), mit Farbrauschen über ein Raster
  function bodenFlaeche(nz, x, z, w, t, y, col, raster, rauschen, seed) {
    const r = SHS.rng ? SHS.rng(seed || 1) : Math.random;
    const nx = Math.max(1, Math.round(w / raster)); const nzz = Math.max(1, Math.round(t / raster));
    const basis = farbe(col);
    const werte = [];
    for (let j = 0; j <= nzz; j++) { werte.push([]); for (let i = 0; i <= nx; i++) werte[j].push((r() - 0.5) * 2 * rauschen); }
    const I = M.ident(); const nm = M.normalenMatrix(I);
    for (let j = 0; j < nzz; j++) {
      for (let i = 0; i < nx; i++) {
        const p = (ii, jj) => [x + (ii / nx) * w, z + (jj / nzz) * t, ton(basis, werte[jj][ii])];
        const a = p(i, j); const b = p(i + 1, j); const c = p(i + 1, j + 1); const d = p(i, j + 1);
        for (const q of [a, d, c, a, c, b]) ecke(nz, I, nm, q[0], y, q[1], 0, 1, 0, q[2]);
      }
    }
  }

  // ------------------------------------------------------------------ Trümmer
  function oberkante(v) {
    const sockel = v.hoehe > 0 ? v.hoehe : 0;
    if (v.typ === 'Rohr') return sockel + Math.min(v.w, v.h);
    return sockel + (HOEHEN[v.typ] || 0.2);
  }

  function truemmer(nz, v) {
    const T0 = M.kette(M.verschiebe(v.x, 0, v.y), M.drehBoden(v.rot || 0));
    const w = v.w; const h = v.h;
    if (v.hoehe > 0) {
      // Hochlage: Unterbau aus Betonsteinen
      quader(nz, M.kette(T0, M.verschiebe(0, v.hoehe / 2, 0), M.skaliere(w + 0.08, v.hoehe, h + 0.08)), { oben: '#9a8f80', seite: '#8d8172' });
      quader(nz, M.kette(T0, M.verschiebe(0, v.hoehe / 2, 0), M.skaliere(w + 0.085, 0.012, h + 0.085)), '#6f665a');
    }
    const T = v.hoehe > 0 ? M.kette(T0, M.verschiebe(0, v.hoehe, 0)) : T0;
    const r = SHS.rng ? SHS.rng(hash(v.id + v.typ)) : Math.random;
    switch (v.typ) {
      case 'Brett': {
        const d = HOEHEN.Brett;
        for (let i = 0; i < 3; i++) {
          const z = -h / 2 + (h / 3) * (i + 0.5);
          quader(nz, M.kette(T, M.verschiebe(0, d / 2, z), M.skaliere(w, d, h / 3 - 0.006)), ton('#a8794a', (i - 1) * 0.08));
        }
        break;
      }
      case 'Palette': {
        const kh = 0.08;
        for (const x of [-w / 2 + w / 12, 0, w / 2 - w / 12]) quader(nz, M.kette(T, M.verschiebe(x, kh / 2, 0), M.skaliere(w / 6, kh, h)), '#6d5236');
        const latten = 4; const lh = h / (latten * 1.6);
        for (let i = 0; i < latten; i++) {
          const z = -h / 2 + lh / 2 + (i * (h - lh)) / (latten - 1);
          quader(nz, M.kette(T, M.verschiebe(0, kh + 0.011, z), M.skaliere(w, 0.022, lh)), ton('#c29a63', (r() - 0.5) * 0.15));
        }
        break;
      }
      case 'Kiste': {
        const kh = HOEHEN.Kiste;
        quader(nz, M.kette(T, M.verschiebe(0, kh / 2, 0), M.skaliere(w, kh, h)), { oben: '#b48a57', seite: '#a07a4c' });
        // Rahmenleisten
        for (const [x, z, sx, sz] of [[0, -h / 2, w + 0.01, 0.03], [0, h / 2, w + 0.01, 0.03], [-w / 2, 0, 0.03, h + 0.01], [w / 2, 0, 0.03, h + 0.01]]) {
          quader(nz, M.kette(T, M.verschiebe(x, kh + 0.004, z), M.skaliere(sx, 0.012, sz)), '#6b4c2c');
        }
        break;
      }
      case 'Stein': {
        const hs = Math.min(HOEHEN.Stein, Math.min(w, h) * 0.75);
        const rad = [];
        for (let i = 0; i < 10 * 7; i++) rad.push(r.range ? r.range(0.82, 1.08) : 0.9 + r() * 0.2);
        kugel(nz, M.kette(T, M.verschiebe(0, hs * 0.38, 0), M.skaliere(w, hs, h)),
          (x, y) => mische('#6f6c66', '#b9b6ae', Math.max(0, Math.min(1, 0.45 + y * 1.4))), 10, 7,
          (i, j) => (j === 0 || j === 7 ? 1 : rad[(j * 10 + i) % rad.length]));
        break;
      }
      case 'Rohr': {
        const d = Math.min(w, h);
        const L = Math.max(w, h);
        const R = w >= h ? M.drehZ(Math.PI / 2) : M.drehX(Math.PI / 2); // Rohr liegt entlang der längeren Seite
        zylinder(nz, M.kette(T, M.verschiebe(0, d / 2, 0), R, M.skaliere(d, L, d)), (x, y, z, nx) => mische('#4a545d', '#c3ccd4', 0.5 + nx * 0.5), 16);
        zylinder(nz, M.kette(T, M.verschiebe(0, d / 2, 0), R, M.skaliere(d * 0.78, L + 0.004, d * 0.78)), '#1e2328', 16);
        break;
      }
      case 'Reifen': {
        const aussen = Math.max(w, h) / 2;
        const rr = aussen * 0.3; const RR = aussen - rr;
        torus(nz, M.kette(T, M.verschiebe(0, rr * 0.85, 0), M.skaliere(1, 0.85, 1)), '#262626', RR, rr, 22, 8);
        zylinder(nz, M.kette(T, M.verschiebe(0, 0.01, 0), M.skaliere(RR * 2, 0.02, RR * 2)), '#463a28', 16);
        break;
      }
      case 'Ziegel': {
        const zh = 0.065;
        for (const s of [-1, 1]) quader(nz, M.kette(T, M.verschiebe(0, zh / 2, s * h / 4), M.skaliere(w, zh, h / 2 - 0.006)), ton('#b6553a', s * 0.06));
        quader(nz, M.kette(T, M.verschiebe(w * 0.08, zh * 1.5, 0), M.drehY(0.25), M.skaliere(w * 0.7, zh, h / 2)), ton('#b6553a', 0.1));
        break;
      }
      case 'Eimer': {
        const ra = Math.max(w, h);
        const eh = HOEHEN.Eimer;
        zylinder(nz, M.kette(T, M.verschiebe(0, eh / 2, 0), M.skaliere(ra, eh, ra)), '#3e7cb1', 18, 1.14, false);
        zylinder(nz, M.kette(T, M.verschiebe(0, eh * 0.15, 0), M.skaliere(ra * 1.1, 0.01, ra * 1.1)), '#2c5e88', 18);
        zylinder(nz, M.kette(T, M.verschiebe(0, eh - 0.03, 0), M.skaliere(ra * 1.12, 0.01, ra * 1.12)), '#1d3f5c', 18);
        torus(nz, M.kette(T, M.verschiebe(0, eh, 0)), '#9aa3ad', ra * 0.57, 0.01, 18, 4);
        break;
      }
      default:
        quader(nz, M.kette(T, M.verschiebe(0, 0.1, 0), M.skaliere(w, 0.2, h)), '#888888');
    }
  }

  // ------------------------------------------------------------------ Behältnisse
  function behaeltnisHoehe(v) { return v.form === 'eckig' ? BEHAELTNIS_HOEHE.eckig : BEHAELTNIS_HOEHE.rund; }

  function behaeltnis(nz, v) {
    const T = M.verschiebe(v.x, 0, v.y);
    const hh = behaeltnisHoehe(v);
    const col = BEHAELTNIS_FARBEN[v.typ] || '#7d5a3c';
    const loch = '#1a2026';
    if (v.form === 'eckig') {
      const bx = v.r * 2; const bz = v.r * 1.5;
      quader(nz, M.kette(T, M.verschiebe(0, hh / 2, 0), M.skaliere(bx, hh, bz)), { oben: ton(col, 0.08), seite: col });
      quader(nz, M.kette(T, M.verschiebe(0, hh + 0.006, 0), M.skaliere(bx * 0.3, 0.012, 0.04)), ton(col, -0.4)); // Griff
      for (const k of v.kammern) {
        // Öffnung dort, wo die Richtung zur Kammer die Wand trifft
        const dx = k.x - v.x; const dz = k.y - v.y;
        const t = Math.min(dx ? (bx / 2) / Math.abs(dx) : Infinity, dz ? (bz / 2) / Math.abs(dz) : Infinity);
        const px = dx * t; const pz = dz * t;
        const seitlich = Math.abs(px) >= bx / 2 - 1e-6;
        const y = Math.max(0.04, Math.min(hh - 0.04, k.hoehe));
        quader(nz, M.kette(T, M.verschiebe(px * 1.01, y, pz * 1.01), M.skaliere(seitlich ? 0.01 : 0.05, 0.035, seitlich ? 0.05 : 0.01)), loch);
      }
    } else {
      const d = v.r * 2;
      zylinder(nz, M.kette(T, M.verschiebe(0, hh / 2, 0), M.skaliere(d, hh, d)), (x, y) => ton(col, y > 0.42 ? 0.05 : 0), 22, 1.08);
      torus(nz, M.kette(T, M.verschiebe(0, hh, 0)), '#9aa3ad', v.r * 1.04, 0.012, 22, 4);
      zylinder(nz, M.kette(T, M.verschiebe(0, hh + 0.002, 0), M.skaliere(d * 0.9, 0.004, d * 0.9)), '#c4cbd3', 22);
      for (const k of v.kammern) {
        const w = Math.atan2(k.y - v.y, k.x - v.x);
        const y = Math.max(0.04, Math.min(hh - 0.04, k.hoehe));
        const rr = v.r * (1 + 0.04 * (y / hh)) + 0.004;
        quader(nz, M.kette(T, M.verschiebe(Math.cos(w) * rr, y, Math.sin(w) * rr), M.drehBoden(w), M.skaliere(0.01, 0.035, 0.05)), loch);
      }
    }
  }

  function versteckOberkante(lage, v) {
    if (!v) return 0;
    if (lage.disziplin === 'behaeltnis') return behaeltnisHoehe(v);
    if (lage.disziplin === 'truemmer') return oberkante(v);
    return 0;
  }

  // ------------------------------------------------------------------ Boden, Band, Mittelweg
  function boden(lage) {
    const nz = netz();
    const welt = lage.welt; const b = lage.bereich;
    const rand = 8;
    bodenFlaeche(nz, -rand, -rand, welt.w + 2 * rand, welt.h + 2 * rand, -0.004, '#4d7832', 1.0, 0.06, lage.seed + 5);
    bodenFlaeche(nz, 0, 0, welt.w, welt.h, 0, '#5f8f3e', 0.25, 0.07, lage.seed + 3);
    if (lage.disziplin === 'truemmer') {
      bodenFlaeche(nz, b.x, b.y, b.w, b.h, 0.003, '#8f8068', 0.2, 0.05, lage.seed + 7);
      // Kiesel (gleiche Verteilung wie in 2D)
      const r = SHS.rng(lage.seed + 11);
      const farben = ['#9b8b70', '#7d6f58', '#b3a488', '#6a5f4d', '#a39a8b', '#857b6a'];
      const n = Math.round(b.w * b.h * 90);
      for (let i = 0; i < n; i++) {
        const x = b.x + r() * b.w; const z = b.y + r() * b.h; const s = r.range(0.012, 0.035); const f = r.pick(farben);
        quader(nz, M.kette(M.verschiebe(x, 0.003 + s * 0.3, z), M.drehY(r() * 3), M.skaliere(s * 2, s * 0.8, s * 1.6)), f);
      }
    } else {
      bodenFlaeche(nz, b.x, b.y, b.w, b.h, 0.003, '#6c9c47', 0.25, 0.06, lage.seed + 7);
    }
    if (lage.mittelweg) {
      const m = lage.mittelweg;
      bodenFlaeche(nz, m.x, m.y, m.w, m.h, 0.006, '#d8c49a', 0.5, 0.04, lage.seed + 9);
      for (const x of [m.x, m.x + m.w]) {
        for (let y = m.y; y < m.y + m.h; y += 0.4) {
          quader(nz, M.kette(M.verschiebe(x, 0.009, y + 0.12), M.skaliere(0.04, 0.004, 0.24)), '#ffffff');
        }
      }
    }
    absperrung(nz, b);
    return nz;
  }

  // Absperrband rund um den Suchbereich: liegt flach auf dem Boden (wie in der 2D-Ansicht)
  function absperrung(nz, b) {
    const breite = 0.05; const dicke = 0.003; const y = 0.012;
    const ecken = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = ecken[i]; const [bx, bz] = ecken[(i + 1) % 4];
      const L = Math.hypot(bx - ax, bz - az);
      const w = Math.atan2(bz - az, bx - ax);
      quader(nz, M.kette(M.verschiebe((ax + bx) / 2, y, (az + bz) / 2), M.drehBoden(w), M.skaliere(L + breite, dicke, breite)), '#f4f1e8');
    }
  }

  // Alle unbeweglichen Teile einer Suchlage (Boden + Verstecke)
  function statisch(lage) {
    const nz = boden(lage);
    for (const v of lage.verstecke) {
      if (lage.disziplin === 'behaeltnis') behaeltnis(nz, v);
      else truemmer(nz, v);
    }
    return nz;
  }

  // ------------------------------------------------------------------ kleine Einzelteile
  function spielzeug() { const nz = netz(); kugel(nz, M.skaliere(0.14), (x, y) => (y > 0.2 ? '#f06a6a' : '#d93a3a'), 12, 8); return nz; }
  function futter() { const nz = netz(); quader(nz, M.skaliere(0.16, 0.04, 0.1), { oben: '#9a6a38', seite: '#7a4e22' }); return nz; }
  function scheibe() {
    // Kontaktschatten: Mitte dunkel, Rand durchsichtig (Normale nach oben)
    const nz = netz(); const I = M.ident(); const nm = M.normalenMatrix(I); const seg = 20;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2; const a1 = ((i + 1) / seg) * Math.PI * 2;
      ecke(nz, I, nm, 0, 0, 0, 0, 1, 0, [0, 0, 0, 0.42]);
      ecke(nz, I, nm, Math.cos(a1) * 0.5, 0, Math.sin(a1) * 0.5, 0, 1, 0, [0, 0, 0, 0]);
      ecke(nz, I, nm, Math.cos(a0) * 0.5, 0, Math.sin(a0) * 0.5, 0, 1, 0, [0, 0, 0, 0]);
    }
    return nz;
  }
  function einheitsQuader(col) { const nz = netz(); quader(nz, M.ident(), col || '#ffffff'); return nz; }

  // ------------------------------------------------------------------ Hund
  // Teile mit Drehpunkt im Ursprung; Blickrichtung +x, oben +y. Größen über das Maß des Labradors (groesse 1).
  function hundMasse(F) {
    const G = F.groesse;
    const bein = 0.31 * G * F.beine;
    return {
      G, bein,
      rumpfL: 0.64 * G * F.lang, rumpfH: 0.29 * G, rumpfB: 0.27 * G * F.breit,
      hueftX: 0.2 * G * F.lang, beinZ: 0.075 * G * F.breit,
      kopf: 0.17 * G, fang: 0.13 * G * Math.max(0.25, F.fang),
      rute: (F.rute === 'kurz' ? 0.08 : 0.3) * G,
    };
  }

  function hundTeile(F, f) {
    const g = hundMasse(F);
    const grund = farbe(f.grund);
    const ruecken = f.sattel ? farbe(f.sattel) : f.ruecken ? mische(grund, farbe(f.ruecken), farbe(f.ruecken)[3]) : null;
    const fleck = f.flecken ? farbe(f.flecken) : null;
    const rngF = (x, y, z) => { const h = Math.sin(x * 41.3 + y * 17.1 + z * 29.7) * 43758.5453; return h - Math.floor(h); };
    const fell = (x, y, z, nx, ny) => {
      if (fleck && rngF(Math.round(x * 6), Math.round(y * 6), Math.round(z * 6)) > 0.72) return fleck;
      if (ruecken && ny > 0.35) return ruecken;
      return grund;
    };
    const teile = {};
    // Rumpf (Ellipsoid) – Mittelpunkt im Ursprung
    teile.rumpf = netz(); kugel(teile.rumpf, M.skaliere(g.rumpfL, g.rumpfH, g.rumpfB), fell, 14, 9);
    // Brust (vorne etwas tiefer, Kragen hell)
    teile.brust = netz(); kugel(teile.brust, M.skaliere(0.26 * g.G, 0.27 * g.G, g.rumpfB * 1.02),
      (x, y, z, nx, ny) => (f.kragen && nx > 0.4 && ny < 0.3 ? f.kragen : fell(x, y, z, nx, ny)), 12, 8);
    // Hals: von unten (Ursprung) nach oben/vorne
    teile.hals = netz(); zylinder(teile.hals, M.kette(M.verschiebe(0, 0.1 * g.G, 0), M.skaliere(0.13 * g.G, 0.2 * g.G, 0.12 * g.G)), (x, y, z, nx) => (f.kragen && nx > 0.5 ? f.kragen : fell(x, y, z, nx, 0)), 10, 0.85);
    // Kopf mit Fang, Nase, Augen und Ohren – Drehpunkt am Hinterkopf
    const kopf = netz();
    const kopfF = f.kopf || f.grund;
    kugel(kopf, M.kette(M.verschiebe(0.07 * g.G, 0, 0), M.skaliere(g.kopf * 1.25, g.kopf, g.kopf * 0.95)), kopfF, 12, 8);
    const fangF = f.maske || kopfF;
    kugel(kopf, M.kette(M.verschiebe(0.07 * g.G + g.kopf * 0.55 + g.fang * 0.35, -0.03 * g.G, 0), M.skaliere(g.fang * 1.3, g.kopf * 0.55, g.kopf * 0.55)), (x, y, z, nx, ny) => (f.blesse && ny > 0.4 ? f.blesse : fangF), 10, 6);
    kugel(kopf, M.kette(M.verschiebe(0.07 * g.G + g.kopf * 0.55 + g.fang * 0.95, -0.015 * g.G, 0), M.skaliere(0.035 * g.G)), f.nase || '#141010', 8, 5);
    for (const s of [-1, 1]) {
      kugel(kopf, M.kette(M.verschiebe(0.07 * g.G + g.kopf * 0.5, 0.025 * g.G, s * g.kopf * 0.3), M.skaliere(0.022 * g.G)), '#1a120c', 6, 4);
      const ohrF = f.ohren || kopfF;
      const og = F.ohrGr || 1;
      if (F.ohr === 'steh') {
        zylinder(kopf, M.kette(M.verschiebe(0.03 * g.G, g.kopf * 0.55, s * g.kopf * 0.3), M.drehX(-s * 0.25), M.skaliere(0.07 * g.G * og, 0.12 * g.G * og, 0.035 * g.G * og)), ohrF, 8, 0.05);
      } else if (F.ohr === 'haenge') {
        kugel(kopf, M.kette(M.verschiebe(0.02 * g.G, -0.03 * g.G, s * g.kopf * 0.5), M.drehX(s * 0.15), M.skaliere(0.08 * g.G * og, 0.15 * g.G * og, 0.025 * g.G)), ohrF, 8, 6);
      } else {
        kugel(kopf, M.kette(M.verschiebe(0.06 * g.G, g.kopf * 0.42, s * g.kopf * 0.32), M.drehZ(-0.6), M.skaliere(0.08 * g.G * og, 0.03 * g.G, 0.07 * g.G * og)), ohrF, 8, 5);
      }
    }
    teile.kopf = kopf;
    // Beinsegmente (Ober-, Unterschenkel, Mittelfuß): Drehpunkt oben, Länge 1 nach unten (−y);
    // sie werden zwischen zwei Gelenkpunkten ausgerichtet. Gelenkkugeln verdecken die Übergänge.
    const pfote = f.pfoten || null;
    const segment = (d, oben, col) => { const nz = netz(); zylinder(nz, M.kette(M.verschiebe(0, -0.5, 0), M.skaliere(d, 1, d)), col, 8, oben); return nz; };
    teile.beinOben = segment(0.1 * g.G, 1.3, (x, y, z) => fell(x, y, z, 0, 0));
    teile.beinMitte = segment(0.058 * g.G, 1.2, (x, y, z) => (pfote && y < -0.3 ? pfote : fell(x, y, z, 0, 0)));
    teile.beinUnten = segment(0.048 * g.G, 1.1, pfote || f.grund);
    teile.gelenk = netz(); kugel(teile.gelenk, M.ident(), (x, y, z) => fell(x, y, z, 0, 0), 8, 5);
    teile.gelenkUnten = netz(); kugel(teile.gelenkUnten, M.ident(), pfote || f.grund, 8, 5);
    const pf = netz(); kugel(pf, M.skaliere(0.09 * g.G, 0.04 * g.G, 0.07 * g.G), pfote || f.grund, 8, 5);
    teile.pfote = pf;
    // Rute: Drehpunkt am Ansatz, zeigt nach −x
    const rute = netz();
    const ruteF = f.rute || f.grund;
    const dicke = F.rute === 'otter' ? 0.075 : F.rute === 'buschig' ? 0.08 : F.rute === 'kurz' ? 0.05 : 0.045;
    zylinder(rute, M.kette(M.verschiebe(-0.5, 0, 0), M.drehZ(Math.PI / 2), M.skaliere(dicke, 1, dicke)),
      (x, y) => (f.rutenspitze && y > 0.3 ? f.rutenspitze : ruteF), 8, F.rute === 'buschig' ? 0.6 : 0.3);
    teile.rute = rute;
    return { teile, masse: g };
  }

  // Zweigelenkige Kette (inverse Kinematik in der Seitenebene): Gelenkpunkt zwischen H und E
  // mit den Segmentlängen a und b; knick +1 = Gelenk zeigt nach vorn (Knie), −1 = nach hinten (Ellbogen).
  function zweiGelenke(H, E, a, b, knick) {
    const dx = E[0] - H[0]; const dy = E[1] - H[1];
    const d0 = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / d0; const uy = dy / d0;
    const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, d0));
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    return [H[0] + a * (ux * cosA - uy * sinA * knick), H[1] + a * (uy * cosA + ux * sinA * knick)];
  }

  // Segment von P nach Q (Seitenebene, Querversatz z) für ein Netz, das von 0 nach −y zeigt
  function segmentMatrix(P, Q, z) {
    const dx = Q[0] - P[0]; const dy = Q[1] - P[1];
    return M.kette(M.verschiebe(P[0], P[1], z), M.drehZ(Math.atan2(dx, -dy)), M.skaliere(1, Math.hypot(dx, dy), 1));
  }

  const frac = (x) => x - Math.floor(x);

  // Schrittfolge im Trab: diagonale Beinpaare gleichzeitig (Anteil des Schrittzyklus)
  const BEINE = [[1, -1, 0], [1, 1, 0.5], [-1, -1, 0.5], [-1, 1, 0]];

  // Pose aus dem Zustand → Liste { teil, m } im Hundesystem (Ursprung am Boden unter der Rumpfmitte).
  // z: { liegtAnteil, sitztAnteil, weg (zurückgelegte Strecke in m), tempo, kopfW, naseTief, rute, ruteHoch, t }
  // Die Pfoten stehen in der Stützphase fest am Boden: der Schrittzyklus folgt der zurückgelegten Strecke.
  function hundPose(F, z) {
    const g = hundMasse(F);
    const t = z.t || 0;
    const liegt = Math.max(0, Math.min(1, z.liegtAnteil || 0));
    const sitzt = Math.max(0, Math.min(1, z.sitztAnteil || 0)) * (1 - liegt);
    const B = g.bein;
    const schritt = 1.9 * B; // Weg je Schrittzyklus
    const stuetz = 0.55; // Anteil der Stützphase
    const weg = z.weg || 0;
    const lauf = Math.max(0, Math.min(1, (z.tempo || 0) / 0.15)) * (1 - liegt) * (1 - sitzt);
    const atem = Math.sin(t * 2.6) * 0.004 * g.G;
    const stehH = g.bein + g.rumpfH * 0.32;
    const liegH = g.rumpfH * 0.5;
    const wippen = -0.008 * g.G * lauf * (0.5 + 0.5 * Math.cos((4 * Math.PI * weg) / schritt));
    const rumpfY = stehH + (liegH - stehH) * liegt + atem + wippen - sitzt * 0.02 * g.G;
    // Sitzen: Rumpf hinten absenken (Drehung um die Schultern)
    const kipp = sitzt * 0.62;
    const schulter = [g.hueftX, rumpfY];
    const R = (x, y) => {
      const dx = x - schulter[0]; const dy = y - schulter[1];
      return [schulter[0] + dx * Math.cos(kipp) - dy * Math.sin(kipp), schulter[1] + dx * Math.sin(kipp) + dy * Math.cos(kipp)];
    };
    const liste = [];
    const rumpfMitte = R(-0.03 * g.G, rumpfY);
    liste.push({ teil: 'rumpf', m: M.kette(M.verschiebe(rumpfMitte[0], rumpfMitte[1], 0), M.drehZ(kipp)) });
    const brust = R(g.hueftX * 0.95, rumpfY + 0.01 * g.G);
    liste.push({ teil: 'brust', m: M.kette(M.verschiebe(brust[0], brust[1], 0), M.drehZ(kipp)) });
    // Hals und Kopf
    const nase = z.naseTief ? 1 : 0;
    const halsBasis = [g.hueftX + 0.07 * g.G * F.lang, rumpfY + 0.06 * g.G];
    const halsNeig = 0.55 + nase * 1.0 - sitzt * 0.2; // Neigung des Halses nach vorn (rad)
    liste.push({ teil: 'hals', m: M.kette(M.verschiebe(halsBasis[0], halsBasis[1], 0), M.drehY(-(z.kopfW || 0) * 0.4), M.drehZ(-halsNeig)) });
    const halsL = 0.2 * g.G;
    const kopfP = [halsBasis[0] + Math.sin(halsNeig) * halsL * 0.9, halsBasis[1] + Math.cos(halsNeig) * halsL * 0.9];
    const kw = z.kopfW || 0;
    const kx = halsBasis[0] + (kopfP[0] - halsBasis[0]) * Math.cos(kw * 0.4);
    const kz = (kopfP[0] - halsBasis[0]) * Math.sin(kw * 0.4);
    const nicken = -nase * 0.85 + (liegt > 0.5 && !nase ? 0.1 : 0);
    liste.push({ teil: 'kopf', m: M.kette(M.verschiebe(kx, kopfP[1], kz), M.drehY(-kw), M.drehZ(nicken)) });
    // Beine mit Gelenken: vorn Schulter–Ellbogen–Vorderfußwurzel–Pfote, hinten Hüfte–Knie–Sprunggelenk–Pfote
    for (const [vorne, seite, versatz] of BEINE) {
      const vorn = vorne > 0;
      const L = vorn ? { a: 0.5 * B, b: 0.42 * B, c: 0.17 * B, knick: -1 } : { a: 0.44 * B, b: 0.46 * B, c: 0.3 * B, knick: 1 };
      const hx = vorne * g.hueftX + (vorn ? 0 : -0.02 * g.G);
      const H = R(hx, rumpfY - g.rumpfH * (vorn ? 0.2 : 0.25));
      // Gang: Stützphase (Pfote steht, wandert relativ zum Körper nach hinten), Schwungphase (anheben, vorsetzen)
      const u = frac(weg / schritt + versatz);
      const S = stuetz * schritt * lauf;
      let fx; let hub = 0; let schwungT = 0;
      if (u < stuetz) fx = S / 2 - S * (u / stuetz);
      else {
        schwungT = (u - stuetz) / (1 - stuetz);
        const e = schwungT * schwungT * (3 - 2 * schwungT);
        fx = -S / 2 + S * e;
        hub = Math.sin(Math.PI * schwungT) * (vorn ? 0.17 : 0.13) * B * lauf;
      }
      const falt = Math.sin(Math.PI * schwungT) * lauf; // Pfote klappt beim Vorführen ein
      const gangFuss = [hx + (vorn ? 0.02 : 0.05) * g.G + fx, hub];
      const endW = vorn ? 0.06 + falt * 1.4 : -(0.32 + falt * 0.45);
      const gangEnde = [gangFuss[0] + Math.sin(endW) * L.c, gangFuss[1] + Math.cos(endW) * L.c];
      // Liegen: Vorderläufe nach vorn gestreckt, Hinterläufe untergeschlagen (Mittelfuß flach am Boden)
      const liegFuss = vorn ? [hx + 0.85 * B, 0.02 * g.G] : [hx + 0.55 * B, 0.02 * g.G];
      const liegEnde = vorn ? [liegFuss[0] - L.c, 0.035 * g.G] : [liegFuss[0] - L.c * 0.9, 0.04 * g.G];
      // Sitzen: Vorderläufe senkrecht, Hinterläufe gefaltet neben dem Körper
      const sitzFuss = vorn ? [hx + 0.04 * g.G, 0] : [H[0] + 0.5 * B, 0];
      const sitzEnde = vorn ? [sitzFuss[0] + 0.02 * g.G, L.c] : [sitzFuss[0] - L.c, 0.04 * g.G];
      const wg = 1 - liegt - sitzt;
      const misch = (a, b, c) => [a[0] * wg + b[0] * liegt + c[0] * sitzt, a[1] * wg + b[1] * liegt + c[1] * sitzt];
      const fuss = misch(gangFuss, liegFuss, sitzFuss);
      const ende = misch(gangEnde, liegEnde, sitzEnde);
      const K = zweiGelenke(H, ende, L.a, L.b, L.knick);
      const zz = seite * g.beinZ;
      liste.push({ teil: 'beinOben', m: segmentMatrix(H, K, zz) });
      liste.push({ teil: 'beinMitte', m: segmentMatrix(K, ende, zz) });
      liste.push({ teil: 'beinUnten', m: segmentMatrix(ende, fuss, zz) });
      liste.push({ teil: 'gelenk', m: M.kette(M.verschiebe(K[0], K[1], zz), M.skaliere(0.072 * g.G)) });
      liste.push({ teil: 'gelenkUnten', m: M.kette(M.verschiebe(ende[0], ende[1], zz), M.skaliere(0.056 * g.G)) });
      const pfW = Math.atan2(fuss[0] - ende[0], ende[1] - fuss[1]); // Neigung des Mittelfußes
      liste.push({ teil: 'pfote', m: M.kette(M.verschiebe(fuss[0], Math.max(0.018 * g.G, fuss[1] + 0.018 * g.G), zz), M.drehZ(vorn ? -pfW * 0.5 : 0), M.verschiebe(0.025 * g.G, 0, 0)) });
    }
    // Rute: Wedeln je nach Stimmung, hoch/tief
    const freq = 2 + (z.rute || 0) * 12;
    const amp = (liegt > 0.5 ? 0.15 : (z.ruteHoch ? 0.55 : 0.25)) * (0.3 + (z.rute || 0));
    const wedel = Math.sin(t * freq) * amp;
    let hebe = z.ruteHoch ? 0.75 : -0.6;
    if (F.rute === 'ringel') hebe = 1.9;
    if (liegt > 0.5 || sitzt > 0.5) hebe = kipp + 0.05; // Rute liegt hinten auf dem Boden
    const ansatz = R(-g.rumpfL * 0.47, rumpfY + g.rumpfH * 0.25);
    liste.push({ teil: 'rute', m: M.kette(M.verschiebe(ansatz[0], ansatz[1], 0), M.drehY(wedel), M.drehZ(-hebe + kipp), M.skaliere(g.rute, 1, 1)) });
    return liste;
  }

  // ------------------------------------------------------------------ Mensch (HF/WR)
  function menschTeile(z) {
    const t = {};
    t.bein = netz(); zylinder(t.bein, M.kette(M.verschiebe(0, -0.45, 0), M.skaliere(0.13, 0.9, 0.13)), z.hose || '#30343d', 8, 1.1);
    quader(t.bein, M.kette(M.verschiebe(0.04, -0.88, 0), M.skaliere(0.25, 0.07, 0.11)), '#2a2522');
    t.rumpf = netz(); zylinder(t.rumpf, M.kette(M.verschiebe(0, 0.3, 0), M.skaliere(0.26, 0.6, 0.42)), z.jacke, 12, 1.1);
    for (const k of ['arm', 'armL']) {
      t[k] = netz(); zylinder(t[k], M.kette(M.verschiebe(0, -0.3, 0), M.skaliere(0.09, 0.6, 0.09)), ton(z.jacke, -0.1), 8, 1.1);
      kugel(t[k], M.kette(M.verschiebe(0, -0.62, 0), M.skaliere(0.08)), z.haut || '#e8bf98', 6, 4);
    }
    // Klemmbrett des WR in der linken Hand
    if (z.klemmbrett) quader(t.armL, M.kette(M.verschiebe(0.1, -0.6, 0), M.skaliere(0.2, 0.26, 0.015)), { oben: '#f4f1e8', seite: '#f4f1e8' });
    t.kopf = netz();
    kugel(t.kopf, M.skaliere(0.2, 0.23, 0.19), z.haut || '#e8bf98', 10, 7);
    kugel(t.kopf, M.kette(M.verschiebe(-0.015, 0.03, 0), M.skaliere(0.21, 0.2, 0.2)), (x, y, zz, nx, ny) => (ny > 0.05 || nx < -0.3 ? (z.muetze || z.haare || '#5a3b24') : (z.haut || '#e8bf98')), 10, 7);
    return t;
  }

  // z: { gang, tempo, arm (rechter Arm gehoben) }
  function menschPose(z) {
    const tempo = Math.min(1, z.tempo || 0);
    const schwung = Math.sin(z.gang || 0) * 0.45 * tempo;
    const liste = [];
    for (const s of [-1, 1]) liste.push({ teil: 'bein', m: M.kette(M.verschiebe(0, 0.9, s * 0.1), M.drehZ(s * schwung)) });
    liste.push({ teil: 'rumpf', m: M.verschiebe(0, 0.88, 0) });
    liste.push({ teil: 'armL', m: M.kette(M.verschiebe(0, 1.43, -0.25), M.drehX(0.08), M.drehZ(schwung * 0.8)) });
    const gehoben = !!z.arm;
    liste.push({ teil: 'arm', m: M.kette(M.verschiebe(0, 1.43, 0.25), gehoben ? M.drehX(Math.PI * 0.92) : M.drehX(-0.08), M.drehZ(gehoben ? 0.2 : -schwung * 0.8)) });
    liste.push({ teil: 'kopf', m: M.verschiebe(0.01, 1.62, 0) });
    return liste;
  }

  SHS.modelle3d = {
    HOEHEN, BEHAELTNIS_HOEHE, BEHAELTNIS_FARBEN, farbe, ton, mische, netz, anzahl,
    quader, zylinder, kugel, torus, truemmer, behaeltnis, boden, statisch, oberkante, versteckOberkante,
    spielzeug, futter, scheibe, einheitsQuader, hundMasse, hundTeile, hundPose, menschTeile, menschPose,
  };
})(globalThis.SHS = globalThis.SHS || {});
