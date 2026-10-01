// Zeichenhilfen (Canvas 2D, von oben): Hund mit rassetypischer Fellzeichnung und Trümmerteile.
// Reine Zeichenfunktionen ohne Spiellogik – werden von search.js und ui.js genutzt.
(function (SHS) {
  'use strict';

  // Fellzeichnung je Rasse (Draufsicht).
  // grund = Körper, kopf = Kopf (sonst grund), sattel = dunkler Rückenfleck, maske = Fang,
  // kragen/blesse/pfoten = weiße Abzeichen, ohrForm 'steh' (Stehohr) oder 'kipp' (Hängeohr).
  const FELL = {
    'Labrador Retriever': { grund: '#e3c27a', kopf: '#e3c27a', ohren: '#cfa862', rute: '#dcb86f', nase: '#3b2b20', ohrForm: 'kipp', schattierung: '#c9a35d' },
    'Malinois': { grund: '#c99250', kopf: '#c99250', maske: '#241911', ohren: '#241911', rute: '#c08848', rutenspitze: '#241911', ohrForm: 'steh', ruecken: 'rgba(36,25,17,0.28)' },
    'Beagle': { grund: '#f3eee4', kopf: '#b9773d', sattel: '#221c18', ohren: '#a86a33', rute: '#221c18', rutenspitze: '#f7f3ec', ohrForm: 'kipp', blesse: '#f7f3ec' },
    'Deutscher Schäferhund': { grund: '#b67d3e', kopf: '#b67d3e', sattel: '#1d1916', maske: '#1d1916', ohren: '#1d1916', rute: '#2a2420', ohrForm: 'steh' },
    'Border Collie': { grund: '#1d1d1f', kopf: '#1d1d1f', kragen: '#f2f2f0', blesse: '#f2f2f0', ohren: '#1d1d1f', rute: '#1d1d1f', rutenspitze: '#f2f2f0', pfoten: '#f2f2f0', ohrForm: 'kipp' },
    'Mischling': { grund: '#8c6b4f', kopf: '#8c6b4f', flecken: '#5e4532', ohren: '#5e4532', rute: '#8c6b4f', ohrForm: 'kipp', maske: '#6e523c' },
  };

  function fellFuer(rasse) {
    return FELL[rasse] || FELL.Mischling;
  }

  function ellipse(g, x, y, rx, ry, farbe, rand) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    if (farbe) { g.fillStyle = farbe; g.fill(); }
    if (rand) { g.strokeStyle = rand; g.lineWidth = 1; g.stroke(); }
  }

  // Zeichnet den Hund am Ursprung, Blickrichtung +x (vorher translate/rotate setzen).
  // z: { sk (px pro m), t (s), rasse, liegt, rute (0..1), ruteHoch, naseTief, kopfW (rad), aktiv }
  function zeichneHund(g, z) {
    const f = fellFuer(z.rasse);
    const sk = z.sk;
    const laenge = (z.liegt ? 0.55 : 0.62) * sk;
    const breite = (z.liegt ? 0.3 : 0.24) * sk;
    const L = laenge / 2; const B = breite / 2;
    const kontur = 'rgba(0,0,0,0.35)';

    // Schatten
    ellipse(g, 3, 3, L, B, 'rgba(0,0,0,0.25)');

    // Rute
    const freq = 2 + (z.rute || 0) * 12;
    const ausschlag = (z.ruteHoch ? 0.6 : 0.25) * (0.3 + (z.rute || 0));
    const rw = Math.PI + Math.sin(z.t * freq) * ausschlag;
    const rl = 0.28 * sk * (z.ruteHoch ? 1 : 0.8);
    const ex = -L + Math.cos(rw) * rl; const ey = Math.sin(rw) * rl;
    g.lineCap = 'round';
    g.strokeStyle = f.rute || f.grund;
    g.lineWidth = Math.max(2, 0.055 * sk);
    g.beginPath(); g.moveTo(-L * 0.9, 0); g.lineTo(ex, ey); g.stroke();
    if (f.rutenspitze) {
      g.strokeStyle = f.rutenspitze;
      g.beginPath(); g.moveTo(-L + Math.cos(rw) * rl * 0.75, Math.sin(rw) * rl * 0.75); g.lineTo(ex, ey); g.stroke();
    }

    // Vorderpfoten (liegend nach vorn gestreckt)
    if (z.liegt) {
      const pf = f.pfoten || f.grund;
      g.fillStyle = f.grund;
      g.fillRect(L - 0.03 * sk, -B + 0.02 * sk, 0.17 * sk, 0.065 * sk);
      g.fillRect(L - 0.03 * sk, B - 0.085 * sk, 0.17 * sk, 0.065 * sk);
      g.fillStyle = pf;
      g.fillRect(L + 0.09 * sk, -B + 0.02 * sk, 0.05 * sk, 0.065 * sk);
      g.fillRect(L + 0.09 * sk, B - 0.085 * sk, 0.05 * sk, 0.065 * sk);
    }

    // Körper mit Abzeichen (auf den Körper beschnitten)
    g.save();
    g.beginPath(); g.ellipse(0, 0, L, B, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = f.grund; g.fillRect(-L, -B, laenge, breite);
    if (f.schattierung) ellipse(g, -L * 0.1, 0, L * 0.85, B * 0.35, f.schattierung + '55');
    if (f.ruecken) ellipse(g, -L * 0.1, 0, L * 0.75, B * 0.55, f.ruecken);
    if (f.sattel) ellipse(g, -L * 0.15, 0, L * 0.62, B * 0.95, f.sattel);
    if (f.flecken) {
      ellipse(g, -L * 0.45, -B * 0.45, L * 0.3, B * 0.5, f.flecken);
      ellipse(g, L * 0.25, B * 0.55, L * 0.22, B * 0.45, f.flecken);
    }
    if (f.kragen) {
      g.fillStyle = f.kragen;
      g.fillRect(L * 0.55, -B, L * 0.45, breite);
    }
    g.restore();
    ellipse(g, 0, 0, L, B, null, kontur);

    // Kopf
    g.save();
    g.translate(L, 0);
    g.rotate(z.kopfW || 0);
    const kr = 0.11 * sk;
    if (f.kragen) ellipse(g, -kr * 0.2, 0, kr * 0.75, kr * 1.05, f.kragen);
    // Ohren
    g.fillStyle = f.ohren || f.kopf;
    if (f.ohrForm === 'steh') {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(kr * 0.05, s * kr * 0.45);
        g.lineTo(-kr * 0.55, s * kr * 1.25);
        g.lineTo(kr * 0.5, s * kr * 0.75);
        g.closePath(); g.fill();
      }
    }
    ellipse(g, kr * 0.6, 0, kr * 1.25, kr, f.kopf || f.grund);
    if (f.maske) {
      g.save();
      g.beginPath(); g.ellipse(kr * 0.6, 0, kr * 1.25, kr, 0, 0, Math.PI * 2); g.clip();
      ellipse(g, kr * 1.55, 0, kr * 0.7, kr * 0.65, f.maske);
      g.restore();
    }
    if (f.blesse) {
      g.fillStyle = f.blesse;
      g.fillRect(-kr * 0.3, -kr * 0.13, kr * 2.1, kr * 0.26);
    }
    ellipse(g, kr * 0.6, 0, kr * 1.25, kr, null, kontur);
    if (f.ohrForm !== 'steh') {
      ellipse(g, kr * 0.15, -kr * 0.95, kr * 0.55, kr * 0.32, f.ohren || f.kopf, kontur);
      ellipse(g, kr * 0.15, kr * 0.95, kr * 0.55, kr * 0.32, f.ohren || f.kopf, kontur);
    }
    // Nase: tief = größer/dunkler
    g.fillStyle = z.naseTief ? (f.nase || '#111') : '#444';
    g.beginPath(); g.arc(kr * 1.8, 0, kr * (z.naseTief ? 0.33 : 0.24), 0, Math.PI * 2); g.fill();
    g.restore();
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

  SHS.grafik = { FELL, fellFuer, zeichneHund, zeichneTruemmer, kiesPunkte };
})(globalThis.SHS = globalThis.SHS || {});
