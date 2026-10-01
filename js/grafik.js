// Zeichenhilfen (Canvas 2D, von oben): Hund mit rassetypischer Fellzeichnung und Trümmerteile.
// Reine Zeichenfunktionen ohne Spiellogik – werden von search.js und ui.js genutzt.
(function (SHS) {
  'use strict';

  // Fellfarben und Körperbau kommen aus js/rassen.js.
  function fellVarianten(rasse) { return SHS.rassen.farben(rasse); }
  function fellFuer(rasse, variante) { return SHS.rassen.fell(rasse, variante); }

  function ellipse(g, x, y, rx, ry, farbe, rand) {
    g.beginPath();
    g.ellipse(x, y, Math.max(1e-3, rx), Math.max(1e-3, ry), 0, 0, Math.PI * 2);
    if (farbe) { g.fillStyle = farbe; g.fill(); }
    if (rand) { g.strokeStyle = rand; g.lineWidth = 1; g.stroke(); }
  }

  // Rumpfprofil eines Labradors von oben (Meter): [x, halbe Breite], vom Rutenansatz zum Hals.
  const RUMPF = [[-0.35, 0.045], [-0.31, 0.1], [-0.24, 0.118], [-0.15, 0.104], [-0.05, 0.098],
    [0.05, 0.12], [0.13, 0.125], [0.2, 0.108], [0.25, 0.078], [0.3, 0.058]];

  // Geschlossene, weiche Kurve durch Punkte (Mittelpunkt-Spline).
  function glattPfad(g, punkte) {
    const n = punkte.length;
    const mitte = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mitte(punkte[n - 1], punkte[0]);
    g.beginPath();
    g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mitte(punkte[i], punkte[(i + 1) % n]);
      g.quadraticCurveTo(punkte[i][0], punkte[i][1], m[0], m[1]);
    }
    g.closePath();
  }

  // Punkte entlang einer quadratischen Kurve als sich verjüngende Kette zeichnen (Rute).
  function verjuengt(g, p0, p1, p2, r0, r1, farbe, spitzeFarbe) {
    const n = 36;
    for (let i = 0; i <= n; i++) {
      const u = i / n; const v = 1 - u;
      const x = v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0];
      const y = v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1];
      g.fillStyle = spitzeFarbe && u > 0.78 ? spitzeFarbe : farbe;
      g.beginPath(); g.arc(x, y, Math.max(1e-4, r0 + (r1 - r0) * u), 0, Math.PI * 2); g.fill();
    }
  }

  // Zeichnet den Hund von oben am Ursprung, Blickrichtung +x (vorher translate/rotate setzen).
  // z: { sk (px pro m), t, rasse, fell, liegt|liegtAnteil, sitztAnteil, gang (rad), tempo (m/s),
  //      biegung (rad/s), rute (0..1), ruteHoch, naseTief, kopfW (rad) }
  function zeichneHund(g, z) {
    const F = SHS.rassen.form(z.rasse);
    const f = fellFuer(z.rasse, z.fell);
    const k = z.sk * F.groesse;
    const t = z.t || 0;
    const liegt = z.liegtAnteil !== undefined ? z.liegtAnteil : (z.liegt ? 1 : 0);
    const sitzt = (z.sitztAnteil || 0) * (1 - liegt);
    const tempo = z.tempo || 0;
    const gang = z.gang || 0;
    const biege = Math.max(-0.45, Math.min(0.45, (z.biegung || 0) * 0.13));
    const atem = 1 + Math.sin(t * 2.6) * 0.022 * (0.3 + liegt);
    const breitF = F.breit * (1 + 0.12 * liegt) * atem;
    const versatz = (x) => biege * x * x * 5; // Rumpfbiegung in Kurven

    const profil = RUMPF.map(([x, w]) => {
      let xx = x < 0.2 ? x * F.lang : x + 0.2 * (F.lang - 1);
      let ww = w * breitF;
      if (xx < 0) { xx *= 1 - 0.42 * sitzt; if (x < -0.1) ww *= 1 + 0.25 * sitzt; }
      return [xx, ww];
    });
    const links = profil.map(([x, w]) => [x * k, (-w + versatz(x)) * k]);
    const rechts = profil.map(([x, w]) => [x * k, (w + versatz(x)) * k]).reverse();
    const umriss = links.concat(rechts);
    const rumpX = profil[0][0]; const halsX = profil[profil.length - 1][0];
    const P = (x, y) => [x * k, (y + versatz(x)) * k]; // Punkt im Hundekoordinatensystem

    // Schatten
    g.save(); g.translate(0.03 * k, 0.03 * k);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    glattPfad(g, umriss); g.fill();
    g.restore();

    const beinFarbe = ton(f.grund, -0.12);
    const pfote = f.pfoten || ton(f.grund, -0.18);
    const bein = (von, bis, dicke) => {
      g.strokeStyle = beinFarbe; g.lineWidth = dicke * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(von[0], von[1]); g.lineTo(bis[0], bis[1]); g.stroke();
      ellipse(g, bis[0] + 0.012 * k, bis[1], 0.032 * k, 0.024 * k, pfote);
    };

    // Beine: Trab (diagonale Paare), Sitz oder Liegen (Sphinx)
    const vorneX = 0.17 + 0.2 * (F.lang - 1); const hintenX = -0.26 * F.lang;
    if (liegt > 0.5) {
      const vor = 0.2 * Math.min(1.2, F.beine + 0.2);
      for (const s of [-1, 1]) {
        bein(P(vorneX - 0.04, s * 0.065 * F.breit), P(vorneX + vor, s * 0.06 * F.breit), 0.045);
        ellipse(g, ...P(hintenX + 0.04, s * 0.115 * breitF), 0.1 * k * F.lang, 0.05 * k, ton(f.grund, -0.05));
        ellipse(g, ...P(hintenX + 0.16, s * 0.15 * breitF), 0.034 * k, 0.022 * k, pfote);
      }
    } else if (sitzt > 0.5) {
      for (const s of [-1, 1]) {
        ellipse(g, ...P(vorneX + 0.09, s * 0.06), 0.032 * k, 0.024 * k, pfote);
        ellipse(g, ...P(-0.1 * F.lang, s * 0.125 * breitF), 0.085 * k, 0.05 * k, ton(f.grund, -0.05));
        ellipse(g, ...P(0.0, s * 0.14 * breitF), 0.032 * k, 0.022 * k, pfote);
      }
    } else {
      const schritt = Math.min(1, tempo / 1.4) * 0.085 * Math.max(0.6, F.beine);
      const beine = [[vorneX, -1, 0], [vorneX, 1, Math.PI], [hintenX, -1, Math.PI], [hintenX, 1, 0]];
      for (const [x0, s, ph] of beine) {
        const dx = Math.sin(gang + ph) * schritt;
        bein(P(x0, s * 0.07 * F.breit), P(x0 + 0.03 + dx, s * 0.088 * F.breit), 0.04);
      }
    }

    // Rute (hinter dem Rumpf), schwingt nach und wedelt
    const rTyp = F.rute;
    if (rTyp !== 'ringel') {
      const freq = 2 + (z.rute || 0) * 12;
      const amp = (liegt > 0.5 ? 0.15 : (z.ruteHoch ? 0.55 : 0.25)) * (0.3 + (z.rute || 0));
      const wedel = Math.sin(t * freq) * amp;
      const laenge = { normal: 0.3, otter: 0.3, buschig: 0.33, kurz: 0.06 }[rTyp] || 0.3;
      const dicke = { normal: 0.03, otter: 0.05, buschig: 0.06, kurz: 0.035 }[rTyp] || 0.03;
      const basis = P(rumpX + 0.02, 0);
      const winkel = Math.PI + wedel - biege * 1.4 + (liegt > 0.5 ? 0.5 : 0);
      const kontroll = [basis[0] + Math.cos(winkel - wedel * 0.7) * laenge * 0.55 * k, basis[1] + Math.sin(winkel - wedel * 0.7) * laenge * 0.55 * k];
      const ende = [basis[0] + Math.cos(winkel) * laenge * k, basis[1] + Math.sin(winkel) * laenge * k];
      verjuengt(g, basis, kontroll, ende, dicke * k * 0.55, (rTyp === 'buschig' ? 0.028 : 0.01) * k, f.rute, f.rutenspitze);
    }

    // Rumpf mit Volumen (Wirbelsäule hell, Flanken dunkler) und Abzeichen
    const breite = 0.13 * k * breitF;
    const grad = g.createLinearGradient(0, -breite, 0, breite);
    grad.addColorStop(0, ton(f.grund, -0.28)); grad.addColorStop(0.42, ton(f.grund, 0.1));
    grad.addColorStop(0.58, ton(f.grund, 0.1)); grad.addColorStop(1, ton(f.grund, -0.32));
    glattPfad(g, umriss);
    g.fillStyle = grad; g.fill();
    g.save(); g.clip();
    if (f.schattierung) ellipse(g, ...P(-0.03, 0), 0.26 * k * F.lang, 0.03 * k, f.schattierung + '66');
    if (f.ruecken) ellipse(g, ...P(-0.05, 0), 0.27 * k * F.lang, 0.065 * k * F.breit, f.ruecken);
    if (f.sattel) ellipse(g, ...P(-0.07 * F.lang, 0), 0.2 * k * F.lang, 0.11 * k * breitF, f.sattel);
    if (f.flecken) {
      ellipse(g, ...P(-0.2 * F.lang, -0.06), 0.07 * k, 0.06 * k, f.flecken);
      ellipse(g, ...P(0.06 * F.lang, 0.07), 0.06 * k, 0.05 * k, f.flecken);
      ellipse(g, ...P(-0.05 * F.lang, 0.02), 0.035 * k, 0.03 * k, f.flecken);
    }
    if (f.kragen) { g.fillStyle = f.kragen; const a = P(halsX - 0.12, 0); g.fillRect(a[0], a[1] - 0.15 * k, 0.2 * k, 0.3 * k); }
    g.restore();
    // Fellstruktur am Rand
    if (F.fell !== 'kurz') {
      g.fillStyle = ton(f.grund, F.fell === 'locken' ? 0.08 : -0.04);
      g.strokeStyle = ton(f.grund, -0.05); g.lineWidth = Math.max(1, 0.012 * k);
      for (let i = 0; i < umriss.length; i++) {
        const a = umriss[i]; const b = umriss[(i + 1) % umriss.length];
        for (let u = 0; u < 1; u += 0.34) {
          const x = a[0] + (b[0] - a[0]) * u; const y = a[1] + (b[1] - a[1]) * u;
          if (F.fell === 'locken') { g.beginPath(); g.arc(x, y, 0.022 * k, 0, Math.PI * 2); g.fill(); } else {
            const nx = y > 0 ? 1 : -1;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.015 * k, y + nx * (F.fell === 'draht' ? 0.012 : 0.022) * k); g.stroke();
          }
        }
      }
    }
    glattPfad(g, umriss);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke();

    // Ringelrute liegt auf dem Rücken
    if (rTyp === 'ringel') {
      const c = P(rumpX + 0.07, 0.02);
      g.strokeStyle = f.rute; g.lineWidth = 0.04 * k;
      g.beginPath(); g.arc(c[0], c[1], 0.045 * k, 0.5, Math.PI * 2.1); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.stroke();
    }

    // Kopf am Hals: Schädel, Fang, Ohren, Augen
    const hals = P(halsX, 0);
    g.save();
    g.translate(hals[0], hals[1]);
    const nicken = Math.sin(gang * 2) * 0.04 * Math.min(1, tempo);
    g.rotate((z.kopfW || 0) + nicken + biege * 0.6);
    if (z.naseTief) g.scale(0.9, 1);
    const kb = Math.pow(F.breit, 0.6); // Kopfbreite
    const kopf = f.kopf || f.grund;
    ellipse(g, 0.0, 0, 0.05 * k, 0.058 * k * kb, kopf); // Halsansatz
    const ohrFarbe = f.ohren || kopf;
    if (F.ohr === 'steh') {
      for (const s of [-1, 1]) {
        g.fillStyle = ohrFarbe;
        g.beginPath(); g.moveTo(0.005 * k, s * 0.03 * k * kb); g.lineTo(0.05 * k, s * 0.05 * k * kb);
        g.lineTo(-0.005 * k, s * (0.06 * kb + 0.055 * F.ohrGr) * k); g.closePath(); g.fill();
      }
    }
    const sl = 0.075; // Schädel-Halblänge
    const fl = 0.02 + 0.085 * F.fang; // Fanglänge
    const sg = g.createRadialGradient(0.07 * k, -0.02 * k, 0.01 * k, 0.07 * k, 0, 0.09 * k);
    sg.addColorStop(0, ton(kopf, 0.15)); sg.addColorStop(1, ton(kopf, -0.2));
    g.fillStyle = sg;
    g.beginPath(); g.ellipse(0.065 * k, 0, sl * k, 0.066 * k * kb, 0, 0, Math.PI * 2); g.fill();
    // Fang
    const fx0 = 0.11 * k; const fx1 = (0.11 + fl) * k;
    g.beginPath(); g.moveTo(fx0, -0.045 * k * kb); g.quadraticCurveTo(fx1, -0.04 * k * kb, fx1, 0);
    g.quadraticCurveTo(fx1, 0.04 * k * kb, fx0, 0.045 * k * kb); g.closePath();
    g.fillStyle = kopf; g.fill();
    if (f.maske) {
      g.save(); g.clip();
      g.fillStyle = f.maske; g.fillRect(fx0 - 0.01 * k, -0.06 * k, fx1, 0.12 * k);
      g.restore();
    }
    if (f.blesse) { g.fillStyle = f.blesse; g.fillRect(0.02 * k, -0.011 * k, fx1 - 0.03 * k, 0.022 * k); }
    // Augen
    for (const s of [-1, 1]) ellipse(g, 0.1 * k, s * 0.036 * k * kb, 0.009 * k, 0.007 * k, '#140f0c');
    // Nase
    g.fillStyle = z.naseTief ? (f.nase || '#141010') : ton(f.nase || '#141010', 0.15);
    g.beginPath(); g.ellipse(fx1 - 0.008 * k, 0, 0.016 * k, 0.022 * k * Math.min(1.2, kb), 0, 0, Math.PI * 2); g.fill();
    // Kipp- und Hängeohren über dem Schädel
    if (F.ohr === 'kipp') {
      for (const s of [-1, 1]) {
        g.fillStyle = ohrFarbe;
        g.beginPath(); g.moveTo(0.0, s * 0.045 * k * kb); g.lineTo(0.045 * k, s * 0.055 * k * kb);
        g.lineTo(0.05 * k, s * (0.07 * kb + 0.025 * F.ohrGr) * k); g.closePath(); g.fill();
      }
    } else if (F.ohr === 'haenge') {
      for (const s of [-1, 1]) {
        const og = g.createLinearGradient(0, s * 0.04 * k, 0, s * 0.1 * k);
        og.addColorStop(0, ton(ohrFarbe, -0.1)); og.addColorStop(1, ton(ohrFarbe, 0.1));
        g.fillStyle = og;
        g.beginPath(); g.ellipse(0.045 * k, s * (0.06 * kb + 0.012 * F.ohrGr) * k, (0.035 + 0.02 * F.ohrGr) * k, 0.028 * k, s * 0.25, 0, Math.PI * 2); g.fill();
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0.065 * k, 0, sl * k, 0.066 * k * kb, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------ Mensch (HF, WR) von oben
  // Am Ursprung, Blickrichtung +x. z: { sk, gang (rad), tempo (0..1), arm (Handzeichen), jacke, hose, haare,
  //   haut, klemmbrett (WR), hinweisArm (WR erwidert) }
  function zeichneMensch(g, z) {
    const k = z.sk;
    const tempo = Math.min(1, z.tempo || 0);
    const schwung = Math.sin(z.gang || 0) * 0.13 * tempo;
    const haut = z.haut || '#e8bf98';
    // Schatten
    ellipse(g, 0.04 * k, 0.04 * k, 0.17 * k, 0.26 * k, 'rgba(0,0,0,0.25)');
    // Beine/Schuhe: beim Gehen abwechselnd vor und zurück
    for (const s of [-1, 1]) {
      const x = s * schwung;
      ellipse(g, x * k, s * 0.09 * k, 0.085 * k, 0.05 * k, z.hose || '#3b4250');
      ellipse(g, (x + 0.06) * k, s * 0.09 * k, 0.045 * k, 0.04 * k, '#2a2522');
    }
    // Arme: schwingen gegengleich, der rechte ist beim Handzeichen gehoben
    const armFarbe = ton(z.jacke, -0.1);
    const arm = (s, gehoben) => {
      g.strokeStyle = armFarbe; g.lineCap = 'round'; g.lineWidth = 0.075 * k;
      g.beginPath(); g.moveTo(0, s * 0.19 * k);
      let hx; let hy;
      if (gehoben) { hx = 0.16; hy = s * 0.3; } else { hx = -s * schwung * 1.2 + 0.03; hy = s * 0.23; }
      g.lineTo(hx * k, hy * k); g.stroke();
      ellipse(g, hx * k, hy * k, (gehoben ? 0.05 : 0.04) * k, (gehoben ? 0.05 : 0.04) * k, haut);
      return [hx, hy];
    };
    arm(-1, false);
    const rechteHand = arm(1, !!z.arm);
    // Oberkörper (Jacke) mit Schulterrundung
    const jg = g.createLinearGradient(0, -0.2 * k, 0, 0.2 * k);
    jg.addColorStop(0, ton(z.jacke, -0.2)); jg.addColorStop(0.5, ton(z.jacke, 0.12)); jg.addColorStop(1, ton(z.jacke, -0.25));
    g.fillStyle = jg;
    g.beginPath(); g.ellipse(0, 0, 0.12 * k, 0.215 * k, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke();
    // Klemmbrett des WR
    if (z.klemmbrett) {
      g.fillStyle = '#f4f1e8'; g.fillRect(0.06 * k, -0.24 * k, 0.12 * k, 0.09 * k);
      g.strokeStyle = '#7a5a3a'; g.strokeRect(0.06 * k, -0.24 * k, 0.12 * k, 0.09 * k);
    }
    // Kopf mit Haaren (von oben), Nase zeigt die Blickrichtung
    ellipse(g, 0.07 * k, 0, 0.022 * k, 0.018 * k, haut);
    const kg = g.createRadialGradient(-0.02 * k, -0.02 * k, 0.01 * k, 0, 0, 0.1 * k);
    kg.addColorStop(0, ton(z.haare || '#5a3b24', 0.25)); kg.addColorStop(1, z.haare || '#5a3b24');
    g.fillStyle = kg;
    g.beginPath(); g.ellipse(0, 0, 0.085 * k, 0.078 * k, 0, 0, Math.PI * 2); g.fill();
    if (z.muetze) { g.fillStyle = z.muetze; g.beginPath(); g.ellipse(0.01 * k, 0, 0.07 * k, 0.07 * k, 0, 0, Math.PI * 2); g.fill(); }
    return rechteHand;
  }

  // ------------------------------------------------------------------ Trümmerfeld
  function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  // Unregelmäßige Steinform, einmal je Versteck berechnet.
  function steinPunkte(v) {
    if (!v._stein) {
      const r = SHS.rng(hash(v.id + v.typ));
      v._stein = [];
      for (let i = 0; i < 9; i++) v._stein.push([i / 9 * Math.PI * 2 + r.range(-0.2, 0.2), r.range(0.75, 1.05)]);
    }
    return v._stein;
  }

  // Zeichnet ein Trümmerteil am Ursprung (bereits translatiert/rotiert), w/h in px.
  function zeichneTruemmer(g, v, w, h) {
    const hoch = v.hoehe > 0;
    // Schatten: Hochlagen werfen einen größeren, weiter versetzten Schatten
    const so = hoch ? 4 + v.hoehe * 22 : 3;
    g.fillStyle = hoch ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.3)';
    g.save(); g.translate(so, so);
    umriss(g, v, w, h); g.fill();
    g.restore();

    switch (v.typ) {
      case 'Brett': brett(g, w, h, '#a8794a', '#7d5632'); break;
      case 'Palette': palette(g, w, h); break;
      case 'Kiste': kiste(g, w, h); break;
      case 'Stein': stein(g, v, w, h); break;
      case 'Rohr': rohr(g, w, h); break;
      case 'Reifen': reifen(g, w, h); break;
      case 'Ziegel': ziegel(g, w, h); break;
      case 'Eimer': eimer(g, w, h); break;
      default: g.fillStyle = '#888'; g.fillRect(-w / 2, -h / 2, w, h);
    }
    if (hoch) {
      // Hochlage: helle Oberkante als Hinweis auf erhöhte Lage
      g.strokeStyle = 'rgba(255,248,220,0.85)'; g.lineWidth = 1.5;
      umriss(g, v, w, h); g.stroke();
    }
  }

  function umriss(g, v, w, h) {
    g.beginPath();
    if (v.typ === 'Stein') {
      steinPunkte(v).forEach(([a, f], i) => {
        const x = Math.cos(a) * w / 2 * f; const y = Math.sin(a) * h / 2 * f;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath();
    } else if (v.typ === 'Reifen' || v.typ === 'Eimer') {
      const r = Math.max(w, h) / 2;
      g.arc(0, 0, r, 0, Math.PI * 2);
    } else g.rect(-w / 2, -h / 2, w, h);
  }

  function brett(g, w, h, hell, dunkel) {
    g.fillStyle = hell; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = dunkel; g.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      const y = -h / 2 + (h * i) / 4;
      g.beginPath(); g.moveTo(-w / 2 + 2, y); g.bezierCurveTo(-w / 6, y - 1.5, w / 6, y + 1.5, w / 2 - 2, y); g.stroke();
    }
    g.fillStyle = dunkel;
    for (const x of [-w / 2 + 3, w / 2 - 3]) for (const y of [-h / 4, h / 4]) { g.beginPath(); g.arc(x, y, 0.9, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.strokeRect(-w / 2, -h / 2, w, h);
  }

  function palette(g, w, h) {
    g.fillStyle = '#6d5236';
    for (const x of [-w / 2, -w / 12, w / 2 - w / 6]) g.fillRect(x, -h / 2, w / 6, h);
    const latten = 4; const lh = h / (latten * 1.6);
    for (let i = 0; i < latten; i++) {
      const y = -h / 2 + (i * (h - lh)) / (latten - 1);
      g.fillStyle = '#c29a63'; g.fillRect(-w / 2, y, w, lh);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.8; g.strokeRect(-w / 2, y, w, lh);
    }
  }

  function kiste(g, w, h) {
    brett(g, w, h, '#b48a57', '#82603a');
    g.strokeStyle = '#6b4c2c'; g.lineWidth = 2;
    g.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
    g.beginPath(); g.moveTo(-w / 2 + 2, -h / 2 + 2); g.lineTo(w / 2 - 2, h / 2 - 2); g.stroke();
  }

  function stein(g, v, w, h) {
    const grad = g.createRadialGradient(-w * 0.15, -h * 0.2, 1, 0, 0, Math.max(w, h) / 1.6);
    grad.addColorStop(0, '#b9b6ae'); grad.addColorStop(1, '#6f6c66');
    g.fillStyle = grad;
    umriss(g, v, w, h); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(60,58,54,0.5)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-w * 0.2, -h * 0.1); g.lineTo(w * 0.05, h * 0.12); g.lineTo(w * 0.22, h * 0.05); g.stroke();
  }

  function rohr(g, w, h) {
    const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, '#5b6670'); grad.addColorStop(0.35, '#b9c3cc'); grad.addColorStop(1, '#45505a');
    g.fillStyle = grad; g.fillRect(-w / 2, -h / 2, w, h);
    ellipse(g, w / 2, 0, h * 0.18, h / 2, '#55606a');
    ellipse(g, w / 2, 0, h * 0.11, h * 0.36, '#1e2328');
    ellipse(g, -w / 2, 0, h * 0.18, h / 2, '#6c7782', 'rgba(0,0,0,0.4)');
  }

  function reifen(g, w, h) {
    const r = Math.max(w, h) / 2;
    g.fillStyle = '#262626'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3d3d3d'; g.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); g.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97); g.stroke();
    }
    g.fillStyle = 'rgba(70,58,40,0.95)'; g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.stroke();
  }

  function ziegel(g, w, h) {
    g.fillStyle = '#b6553a'; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = '#d9c7b0'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0);
    g.moveTo(-w / 6, -h / 2); g.lineTo(-w / 6, 0);
    g.moveTo(w / 6, 0); g.lineTo(w / 6, h / 2);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.strokeRect(-w / 2, -h / 2, w, h);
  }

  function eimer(g, w, h) {
    const r = Math.max(w, h) / 2;
    ellipse(g, 0, 0, r, r, '#3e7cb1', 'rgba(0,0,0,0.45)');
    ellipse(g, 0, 0, r * 0.78, r * 0.78, '#2c5e88');
    g.strokeStyle = '#9aa3ad'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, 0, r * 0.95, -0.4, Math.PI + 0.4, true); g.stroke();
  }

  // Kies-/Schotteruntergrund für das Trümmerfeld (einmal je Suchlage erzeugt).
  function kiesPunkte(lage) {
    const r = SHS.rng(lage.seed + 11);
    const b = lage.bereich;
    const punkte = [];
    const n = Math.round(b.w * b.h * 90);
    const farben = ['#9b8b70', '#7d6f58', '#b3a488', '#6a5f4d', '#a39a8b', '#857b6a'];
    for (let i = 0; i < n; i++) {
      punkte.push({ x: b.x + r() * b.w, y: b.y + r() * b.h, s: r.range(0.012, 0.035), f: r.pick(farben) });
    }
    return punkte;
  }

  // ------------------------------------------------------------------ Nahaufnahme Anzeige (3D-Optik)
  // Farbe aufhellen/abdunkeln (#rrggbb, f > 0 heller, f < 0 dunkler)
  function ton(hex, f) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    const kanal = (c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f));
    const r = kanal(n >> 16); const gg = kanal((n >> 8) & 255); const b = kanal(n & 255);
    return `rgb(${r},${gg},${b})`;
  }

  // Körper mit Licht von oben (Zylinder-Schattierung)
  function volumen(g, hex, y0, y1) {
    const grad = g.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, ton(hex, 0.28));
    grad.addColorStop(0.45, hex);
    grad.addColorStop(1, ton(hex, -0.38));
    return grad;
  }

  const BEHAELTNIS_FARBEN = {
    Werkzeugkoffer: '#b8322b', Aktenkoffer: '#2c2a28', Holzkiste: '#a7784a', Rucksack: '#3f6b3f', Handtasche: '#7a3f55',
    Reisetasche: '#2f4f7a', Weidenkorb: '#b99459', Kühlbox: '#d9dee3', Sporttasche: '#1f6aa5', Kunststoffkiste: '#5c6f7e',
  };

  // Quader in Schrägansicht: Vorderfläche + Oberseite + rechte Seite.
  function quader(g, x, yBoden, b, h, t, farbe) {
    const dx = t * 0.55; const dy = t * 0.35;
    g.fillStyle = volumen(g, farbe, yBoden - h, yBoden);
    g.fillRect(x, yBoden - h, b, h);
    g.fillStyle = ton(farbe, 0.3);
    g.beginPath(); g.moveTo(x, yBoden - h); g.lineTo(x + dx, yBoden - h - dy); g.lineTo(x + b + dx, yBoden - h - dy); g.lineTo(x + b, yBoden - h); g.closePath(); g.fill();
    g.fillStyle = ton(farbe, -0.3);
    g.beginPath(); g.moveTo(x + b, yBoden - h); g.lineTo(x + b + dx, yBoden - h - dy); g.lineTo(x + b + dx, yBoden - dy); g.lineTo(x + b, yBoden); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    g.strokeRect(x, yBoden - h, b, h);
  }

  function zylinderStehend(g, x, yBoden, b, h, farbe) {
    const ry = b * 0.16;
    const grad = g.createLinearGradient(x, 0, x + b, 0);
    grad.addColorStop(0, ton(farbe, -0.25)); grad.addColorStop(0.35, ton(farbe, 0.35)); grad.addColorStop(1, ton(farbe, -0.4));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(x, yBoden - h); g.lineTo(x, yBoden); g.ellipse(x + b / 2, yBoden, b / 2, ry, 0, Math.PI, 0, true);
    g.lineTo(x + b, yBoden - h); g.closePath(); g.fill();
    ellipse(g, x + b / 2, yBoden - h, b / 2, ry, ton(farbe, 0.15), 'rgba(0,0,0,0.3)');
    ellipse(g, x + b / 2, yBoden - h, b / 2.4, ry * 0.8, ton(farbe, -0.05));
  }

  // Liegender Hund (Sphinx-Platz) von der Seite. Koordinaten intern in "Hundemetern":
  // Ursprung = Boden unter der Brust, x nach vorn (rechts), y nach unten.
  // p: { S (px/m), boden, naseX, naseY, nachOben, F (Form), f (Fell), t, blick, aktiv, rute }
  function zeichneHundLiegend(g, p) {
    const { F, f, t } = p;
    const K = p.S * F.groesse; // px pro Hundemeter
    const L = F.lang;
    const h = 0.24 * Math.pow(F.breit, 0.35); // Rumpfhöhe im Liegen
    const fang = 0.02 + 0.085 * F.fang;
    const kopfLaenge = 0.125 + fang;
    const atem = 1 + Math.sin(t * 2.6) * 0.022;

    // Kopfhaltung: Nase zur Quelle, bei Hochlagen nach oben, beim Zurückschauen zum HF gedreht
    let winkel; let kx; let ky; // Kopfursprung (Hinterkopf) in px
    const kopfPx = kopfLaenge * K;
    if (p.blick) {
      winkel = Math.PI + 0.35;
    } else {
      winkel = p.nachOben ? -0.55 : Math.max(-0.2, Math.min(0.75, Math.atan2(p.naseY - (p.boden - 0.2 * K), kopfPx * 0.9)));
    }
    kx = p.naseX - Math.cos(winkel) * kopfPx;
    ky = p.naseY - Math.sin(winkel) * kopfPx;
    // Brust liegt hinter dem Kopf
    const brustX = (p.blick ? p.naseX - 0.05 * K : kx) - 0.05 * K;
    if (p.blick) { kx = brustX + 0.03 * K; ky = p.boden - (h + 0.07) * K; }

    // Schatten
    ellipse(g, brustX - 0.25 * K * L, p.boden + 1, 0.48 * K * L, 0.045 * K, 'rgba(0,0,0,0.28)');

    g.save();
    g.translate(brustX, p.boden);
    g.scale(K, K);
    const px = 1 / K; // 1 Pixel in Hundemetern
    const kopfL = [(kx - brustX) / K, (ky - p.boden) / K];

    // Rute
    const T = [-0.6 * L, -0.55 * h];
    const wedel = Math.sin(t * (2 + (p.rute || 0.2) * 10)) * 0.02 * (p.rute || 0.2) * 3;
    const rTyp = F.rute;
    if (rTyp === 'ringel') {
      g.strokeStyle = volumen(g, f.rute, -h - 0.1, -h + 0.05); g.lineWidth = 0.04;
      g.beginPath(); g.arc(-0.55 * L, -0.95 * h, 0.055, Math.PI * 0.2, Math.PI * 1.9); g.stroke();
    } else if (rTyp === 'kurz') {
      ellipse(g, T[0] - 0.02, T[1], 0.035, 0.025, f.rute);
    } else {
      const ende = [-0.6 * L - 0.32, -0.03 + wedel];
      const kontroll = [-0.6 * L - 0.1, -0.06];
      const r0 = rTyp === 'otter' ? 0.032 : rTyp === 'buschig' ? 0.035 : 0.02;
      const r1 = rTyp === 'buschig' ? 0.02 : 0.007;
      verjuengt(g, T, kontroll, ende, r0, r1, f.rute, f.rutenspitze);
      if (rTyp === 'buschig' || F.fell === 'lang') {
        // buschige/befederte Rute: weicher Haarsaum
        g.save(); g.globalAlpha = 0.35;
        verjuengt(g, T, kontroll, ende, r0 * 1.5, r1 * 1.8, ton(f.rute, 0.1));
        g.restore();
      }
    }

    // Hinterer (ferner) Vorderlauf
    const vorLauf = 0.24 * Math.pow(F.beine, 0.5);
    const lauf = (dy, farbe, hebung) => {
      g.strokeStyle = farbe; g.lineWidth = 0.05 * Math.pow(F.breit, 0.5); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-0.03, -0.06 + dy); g.quadraticCurveTo(vorLauf * 0.5, -0.03 + dy, vorLauf, -0.025 + dy - hebung); g.stroke();
      ellipse(g, vorLauf + 0.02, -0.022 + dy - hebung, 0.04, 0.022, f.pfoten || ton(f.grund, -0.12));
    };
    lauf(-0.022, ton(f.grund, -0.3), 0);

    // Rumpf (atmet)
    g.save();
    g.scale(1, atem);
    g.beginPath();
    g.moveTo(T[0], T[1]);
    g.bezierCurveTo(-0.52 * L, -0.92 * h, -0.3 * L, -0.96 * h, -0.14 * L, -0.9 * h);
    g.bezierCurveTo(-0.06, -0.87 * h, -0.04, -1.02 * h, 0.0, -1.0 * h);
    g.bezierCurveTo(0.075, -0.93 * h, 0.09, -0.4 * h, 0.045, -0.12 * h);
    g.lineTo(0.0, -0.01);
    g.lineTo(-0.3 * L, 0);
    g.bezierCurveTo(-0.45 * L, 0.005, -0.62 * L - 0.04, -0.04 * h, -0.64 * L - 0.02, -0.3 * h);
    g.quadraticCurveTo(-0.65 * L, -0.5 * h, T[0], T[1]);
    g.closePath();
    g.fillStyle = volumen(g, f.grund, -h, 0);
    g.fill();
    g.save(); g.clip();
    if (f.schattierung) ellipse(g, -0.3 * L, -0.9 * h, 0.3 * L, 0.08 * h, f.schattierung + '55');
    if (f.ruecken) { g.fillStyle = f.ruecken; g.fillRect(-0.7 * L, -1.1 * h, 0.75 * L, 0.35 * h); }
    if (f.sattel) { g.fillStyle = volumen(g, f.sattel, -h, -0.4 * h); g.beginPath(); g.ellipse(-0.3 * L, -0.85 * h, 0.3 * L, 0.32 * h, 0, 0, Math.PI * 2); g.fill(); }
    if (f.flecken) {
      ellipse(g, -0.42 * L, -0.6 * h, 0.08, 0.06, f.flecken);
      ellipse(g, -0.15 * L, -0.75 * h, 0.07, 0.05, f.flecken);
      ellipse(g, -0.3 * L, -0.3 * h, 0.045, 0.04, f.flecken);
    }
    if (f.kragen) ellipse(g, 0.04, -0.5 * h, 0.06, 0.5 * h, f.kragen);
    // Keule (angewinkelter Hinterlauf)
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath(); g.ellipse(-0.47 * L, -0.36 * h, 0.15, 0.36 * h, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.2 * px;
    g.beginPath(); g.ellipse(-0.47 * L, -0.36 * h, 0.15, 0.36 * h, 0, -Math.PI * 0.55, Math.PI * 0.6); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = px; g.stroke();
    // Fellstruktur: weicher, unregelmäßiger Rand entlang des Körperumrisses
    if (F.fell !== 'kurz') {
      const stil = {
        lang: { b: 0.022, d: [0.012, 0.006], a: 0.55 },
        doppel: { b: 0.026, d: [0.008, 0.005], a: 0.5 },
        locken: { b: 0.032, d: [0.001, 0.02], a: 0.85 },
        draht: { b: 0.016, d: [0.004, 0.006], a: 0.6 },
      }[F.fell];
      g.save();
      g.globalAlpha = stil.a;
      g.strokeStyle = ton(f.grund, 0.05); g.lineWidth = stil.b; g.lineCap = 'round'; g.lineJoin = 'round';
      g.setLineDash(stil.d);
      g.stroke();
      g.restore();
    }
    g.restore();

    // Hinterpfote vor der Keule
    ellipse(g, -0.3 * L, -0.022, 0.065, 0.022, f.pfoten || ton(f.grund, -0.12));

    // Hals: vom Widerrist/Brust zum Hinterkopf
    const kd = 0.088 * Math.pow(F.breit, 0.4); // Kopfhöhe
    const ca = Math.cos(winkel); const sa = Math.sin(winkel);
    const flip = ca < 0 ? -1 : 1;
    // Punkt im Kopfkoordinatensystem (rotiert, ggf. gespiegelt) -> Hundekoordinaten
    const imKopf = (x, y) => [kopfL[0] + ca * x - sa * y * flip, kopfL[1] + sa * x + ca * y * flip];
    const kopfOben = imKopf(0, -kd * 0.55);
    const kopfUnten = imKopf(0.03, kd * 0.55);
    g.beginPath();
    g.moveTo(-0.05, -0.98 * h);
    g.quadraticCurveTo((kopfOben[0] - 0.05) / 2, Math.min(kopfOben[1], -h) - 0.02, kopfOben[0], kopfOben[1]);
    g.lineTo(kopfUnten[0], kopfUnten[1]);
    g.quadraticCurveTo(0.08, -0.35 * h, 0.04, -0.15 * h);
    g.closePath();
    g.fillStyle = volumen(g, f.kopf || f.grund, -h - 0.1, -0.1);
    g.fill();
    if (f.kragen) { g.save(); g.clip(); ellipse(g, 0.05, -0.45 * h, 0.07, 0.45 * h, f.kragen); g.restore(); }

    // Naher Vorderlauf (bei aktiver Anzeige scharrend)
    const scharr = p.aktiv ? Math.max(0, Math.sin(t * 12)) * 0.06 : 0;
    lauf(0, ton(f.grund, -0.02), scharr);

    // Kopf
    g.save();
    g.translate(kopfL[0], kopfL[1]);
    g.rotate(winkel);
    if (flip < 0) g.scale(1, -1);
    const kopf = f.kopf || f.grund;
    const s = 0.125; const spitze = s + fang;
    const ohr = f.ohren || kopf;
    if (F.ohr === 'steh') {
      g.fillStyle = volumen(g, ohr, -kd - 0.1, -kd * 0.5);
      g.beginPath(); g.moveTo(0.0, -kd * 0.7); g.lineTo(0.06, -kd * 0.8);
      g.lineTo(0.012, -kd * 0.85 - 0.085 * F.ohrGr); g.closePath(); g.fill();
      g.fillStyle = 'rgba(230,180,160,0.35)';
      g.beginPath(); g.moveTo(0.015, -kd * 0.78); g.lineTo(0.045, -kd * 0.82); g.lineTo(0.017, -kd * 0.85 - 0.06 * F.ohrGr); g.closePath(); g.fill();
    }
    g.beginPath();
    g.moveTo(-0.01, -kd * 0.55);
    g.quadraticCurveTo(0.05, -kd * 1.08, s - 0.005, -kd * 0.62);
    g.lineTo(s + 0.008, -kd * (fang < 0.06 ? 0.5 : 0.4));
    g.lineTo(spitze - 0.008, -kd * 0.32);
    g.quadraticCurveTo(spitze + 0.012, -kd * 0.25, spitze + 0.004, -kd * 0.02);
    g.lineTo(spitze - 0.012, kd * 0.2);
    g.quadraticCurveTo(s, kd * 0.52, s * 0.5, kd * 0.62);
    g.quadraticCurveTo(-0.03, kd * 0.55, -0.025, 0);
    g.closePath();
    g.fillStyle = volumen(g, kopf, -kd, kd * 0.6);
    g.fill();
    g.save(); g.clip();
    if (f.maske) { g.fillStyle = f.maske; g.fillRect(s * 0.8, -kd, fang + 0.1, kd * 2); }
    if (f.blesse) { g.fillStyle = f.blesse; g.fillRect(0.02, -kd * 0.95, spitze, kd * 0.2); }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = px; g.stroke();
    // Auge, Lefze, Nase
    ellipse(g, s * 0.72, -kd * 0.36, 0.012, 0.008, '#140e0b');
    ellipse(g, s * 0.72 + 0.004, -kd * 0.4, 0.003, 0.003, 'rgba(255,255,255,0.8)');
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = px;
    g.beginPath(); g.moveTo(spitze - 0.006, kd * 0.12); g.quadraticCurveTo(s + fang * 0.4, kd * 0.3, s * 0.92, kd * 0.22); g.stroke();
    ellipse(g, spitze, -kd * 0.12, 0.016, 0.013, f.nase || '#141010');
    // Kipp- und Hängeohren
    if (F.ohr === 'kipp') {
      g.fillStyle = volumen(g, ohr, -kd - 0.06, -kd * 0.4);
      g.beginPath(); g.moveTo(0.0, -kd * 0.72);
      g.quadraticCurveTo(0.01, -kd * 0.75 - 0.07 * F.ohrGr, 0.075, -kd * 0.62);
      g.lineTo(0.05, -kd * 0.8); g.closePath(); g.fill();
    } else if (F.ohr === 'haenge') {
      g.fillStyle = volumen(g, ohr, -kd * 0.6, kd * 0.6 + 0.06 * F.ohrGr);
      g.beginPath(); g.moveTo(0.0, -kd * 0.62);
      g.bezierCurveTo(0.065, -kd * 0.78, 0.075, kd * 0.35 + 0.05 * F.ohrGr, 0.025, kd * 0.5 + 0.06 * F.ohrGr);
      g.quadraticCurveTo(-0.03, kd * 0.2, 0.0, -kd * 0.62);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
    }
    g.restore();
    g.restore();
  }

  // z: { rasse, fell, disziplin, lk, versteckTyp, versteckHoehe, quelleHoehe, quelleTyp,
  //      abstand (m), aktiv, blick, rute, t, zeigeAbstand }
  function zeichneAnzeigeSzene(g, W, H, z) {
    const f = fellFuer(z.rasse, z.fell);
    // px pro Meter so wählen, dass Hund (inkl. Rute), Abstand und Versteck ins Bild passen
    const abstand = Math.max(0.02, z.abstand || 0.1);
    const F = SHS.rassen.form(z.rasse);
    const hundLaenge = 1.15 * F.groesse * Math.max(1, F.lang) + 0.08; // Rute bis Nase in m
    const S = Math.min(W / (abstand + hundLaenge + 0.55), H * 1.25);
    const horizont = H * 0.3;
    const boden = H * 0.86;
    const t = z.t;

    // Hintergrund: Himmel/Hecke und Boden mit Fluchtlinien
    const himmel = g.createLinearGradient(0, 0, 0, horizont);
    himmel.addColorStop(0, '#cfe3f1'); himmel.addColorStop(1, '#eef5ea');
    g.fillStyle = himmel; g.fillRect(0, 0, W, horizont);
    g.fillStyle = '#4f7a3a'; g.fillRect(0, horizont - H * 0.06, W, H * 0.06);
    const kies = z.disziplin === 'truemmer';
    const bodenGrad = g.createLinearGradient(0, horizont, 0, H);
    bodenGrad.addColorStop(0, kies ? '#a3967f' : '#7fa95c');
    bodenGrad.addColorStop(1, kies ? '#7c6e58' : '#4f7a35');
    g.fillStyle = bodenGrad; g.fillRect(0, horizont, W, H - horizont);
    g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(W / 2 + i * 8, horizont); g.lineTo(W / 2 + i * W * 0.35, H); g.stroke(); }
    const r = SHS.rng(7);
    for (let i = 0; i < 160; i++) {
      const yy = horizont + Math.pow(r(), 0.7) * (H - horizont);
      const p = (yy - horizont) / (H - horizont);
      g.fillStyle = kies ? (r() < 0.5 ? 'rgba(60,50,40,0.35)' : 'rgba(230,220,200,0.35)') : (r() < 0.5 ? 'rgba(30,60,20,0.3)' : 'rgba(180,220,130,0.3)');
      g.fillRect(r() * W, yy, 1 + p * 3, 1 + p * 2);
    }

    // Versteck rechts, Geruchsquelle an der linken Vorderseite
    const objX = Math.max(W * 0.58, (abstand + hundLaenge) * S + 4);
    const hoch = (z.versteckHoehe || 0) > 0;
    const hochUnten = hoch ? z.versteckHoehe * S : 0;
    let quelleY = boden - Math.max(0.03, z.quelleHoehe || 0) * S;
    // Schatten des Verstecks
    if (z.disziplin !== 'flaeche') ellipse(g, objX + 0.2 * S, boden + 2, 0.24 * S, 0.035 * S, 'rgba(0,0,0,0.25)');
    if (z.disziplin === 'behaeltnis') {
      if (z.lk < 3) {
        const b = 0.3 * S; const h = 0.36 * S;
        zylinderStehend(g, objX, boden, b, h, '#e9ecef');
        g.strokeStyle = 'rgba(0,0,0,0.15)';
        for (const yy of [0.33, 0.66]) { g.beginPath(); g.moveTo(objX, boden - h * yy); g.lineTo(objX + b, boden - h * yy); g.stroke(); }
        const kammern = z.lk === 1 ? 3 : 4;
        for (let i = 0; i < kammern; i++) ellipse(g, objX + b * (0.2 + i * 0.6 / kammern), boden - h * (0.2 + ((i * 37) % 60) / 100), 2.2, 1.6, '#2b333b');
      } else {
        const farbe = BEHAELTNIS_FARBEN[z.versteckTyp] || '#8a6a4a';
        quader(g, objX, boden, 0.42 * S, 0.3 * S, 0.22 * S, farbe);
        for (let i = 0; i < 5; i++) ellipse(g, objX + 0.42 * S * (0.12 + i * 0.18), boden - 0.3 * S * (0.25 + ((i * 41) % 50) / 100), 2, 1.5, '#15181b');
      }
      quelleY = Math.min(quelleY, boden - 0.04 * S);
      ellipse(g, objX + 3, quelleY, 2.4, 1.8, '#11161a');
    } else if (z.disziplin === 'truemmer') {
      if (hoch) quader(g, objX - 0.02 * S, boden, 0.36 * S, hochUnten, 0.24 * S, '#8d8172'); // Unterbau der Hochlage
      const yb = boden - hochUnten;
      switch (z.versteckTyp) {
        case 'Rohr': {
          const d = 0.16 * S;
          const grad = g.createLinearGradient(0, yb - d, 0, yb);
          grad.addColorStop(0, '#9aa6b0'); grad.addColorStop(0.4, '#d3dbe2'); grad.addColorStop(1, '#4a545d');
          g.fillStyle = grad; g.fillRect(objX + d * 0.3, yb - d, 0.5 * S, d);
          ellipse(g, objX + d * 0.3, yb - d / 2, d * 0.3, d / 2, '#7d8992', 'rgba(0,0,0,0.4)');
          ellipse(g, objX + d * 0.3, yb - d / 2, d * 0.2, d * 0.36, '#1e2328');
          break;
        }
        case 'Reifen': {
          const rr = 0.2 * S;
          ellipse(g, objX + rr, yb - rr * 0.35, rr, rr * 0.38, '#222');
          ellipse(g, objX + rr, yb - rr * 0.42, rr * 0.55, rr * 0.18, '#5b5245');
          break;
        }
        case 'Stein': {
          const grad = g.createRadialGradient(objX + 0.1 * S, yb - 0.16 * S, 2, objX + 0.16 * S, yb - 0.08 * S, 0.22 * S);
          grad.addColorStop(0, '#c9c6be'); grad.addColorStop(1, '#6d6a64');
          g.fillStyle = grad;
          g.beginPath(); g.moveTo(objX, yb); g.bezierCurveTo(objX - 0.02 * S, yb - 0.2 * S, objX + 0.3 * S, yb - 0.26 * S, objX + 0.36 * S, yb); g.closePath(); g.fill();
          break;
        }
        case 'Eimer': zylinderStehend(g, objX, yb, 0.26 * S, 0.28 * S, '#3e7cb1'); break;
        case 'Brett': quader(g, objX, yb, 0.55 * S, 0.035 * S, 0.22 * S, '#a8794a'); break;
        case 'Palette': quader(g, objX, yb, 0.55 * S, 0.12 * S, 0.3 * S, '#c29a63'); break;
        case 'Ziegel': quader(g, objX, yb, 0.24 * S, 0.07 * S, 0.12 * S, '#b6553a'); break;
        default: quader(g, objX, yb, 0.36 * S, 0.3 * S, 0.24 * S, '#b48a57');
      }
      quelleY = Math.min(quelleY, boden - 0.03 * S);
    }

    // Gegenstand bzw. Verleitung direkt an der Quelle sichtbar
    if (z.disziplin === 'flaeche' && (z.quelleTyp === 'ziel' || z.quelleTyp === 'differenzierung')) {
      g.fillStyle = '#5d6670';
      g.beginPath(); g.ellipse(objX + 0.03 * S, boden - 0.012 * S, 0.04 * S, 0.012 * S, 0, 0, Math.PI * 2); g.fill();
    }
    if (z.quelleTyp === 'spielzeug') ellipse(g, objX - 0.02 * S, quelleY - 4, 6, 6, '#d93a3a', '#7a1010');
    else if (z.quelleTyp === 'futter') { g.fillStyle = '#8a5a2b'; g.fillRect(objX - 0.06 * S, quelleY - 4, 0.08 * S, 6); }

    // Hund in passiver Platzanzeige (Seitenansicht), Nase auf die Quelle gerichtet
    const naseX = objX - abstand * S;
    // Liegend erreicht die Nase höchstens ca. 30 cm (kleine Hunde weniger); Hochlagen darüber werden von unten verwiesen.
    const naseY = Math.max(boden - (0.12 + 0.18 * F.groesse) * S, quelleY);
    const nachOben = quelleY < naseY - 0.02 * S;
    zeichneHundLiegend(g, { S, boden, naseX, naseY, nachOben, F, f, t, blick: z.blick, aktiv: z.aktiv, rute: z.rute });

    // Fläche: Gegenstand liegt im Gras, Halme im Vordergrund
    if (z.disziplin === 'flaeche') {
      const gr = SHS.rng(3);
      for (let i = 0; i < 70; i++) {
        const x = gr() * W; const y = boden - 0.02 * S + gr() * (H - boden + 0.04 * S);
        const l = (0.04 + gr() * 0.06) * S; const neig = (gr() - 0.5) * 0.5;
        g.strokeStyle = gr() < 0.5 ? 'rgba(60,110,40,0.9)' : 'rgba(110,160,70,0.85)';
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + neig * l * 0.5, y - l * 0.6, x + neig * l, y - l); g.stroke();
      }
    }

    if (z.aktiv && Math.sin(t * 6) > 0) {
      g.font = `bold ${Math.round(W / 22)}px system-ui, sans-serif`;
      g.fillStyle = '#b5432a'; g.textAlign = 'left';
      g.fillText('Wuff!', naseX - 0.1 * S, naseY - 0.14 * S);
    }

    // Abstand Nase – Quelle (nur Übung)
    if (z.zeigeAbstand) {
      const cm = Math.round(abstand * 100);
      const zuWeit = cm > 20 && !(z.quelleHoehe > 0.4);
      const farbe = zuWeit ? '#d33' : '#1c7c2c';
      g.strokeStyle = farbe; g.lineWidth = 1.5; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(naseX + 0.01 * S, naseY); g.lineTo(objX, quelleY); g.stroke();
      g.setLineDash([]);
      const text = `Nase – Quelle ≈ ${cm} cm${zuWeit ? ' (zu weit)' : ''}`;
      g.font = `600 ${Math.max(10, Math.round(W / 30))}px system-ui, sans-serif`;
      const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(W - tw - 16, H - 24, tw + 10, 18);
      g.fillStyle = farbe; g.textAlign = 'left';
      g.fillText(text, W - tw - 11, H - 10);
    }
  }

  SHS.grafik = { zeichneMensch, fellVarianten, fellFuer, zeichneHund, zeichneTruemmer, kiesPunkte, zeichneAnzeigeSzene };
})(globalThis.SHS = globalThis.SHS || {});
