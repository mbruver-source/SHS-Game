// Zeichenhilfen (Canvas 2D, von oben): Hund mit rassetypischer Fellzeichnung und Trümmerteile.
// Reine Zeichenfunktionen ohne Spiellogik – werden von search.js und ui.js genutzt.
(function (SHS) {
  'use strict';

  // Fellzeichnung je Rasse und Farbvariante (erste Variante = Standard).
  // grund = Körper, kopf = Kopf (sonst grund), sattel = dunkler Rückenfleck, maske = Fang,
  // kragen/blesse/pfoten = weiße Abzeichen, flecken = Platten/Merle, ohrForm 'steh' oder 'kipp'.
  const FELL = {
    'Labrador Retriever': {
      gelb: { name: 'Gelb', grund: '#e3c27a', kopf: '#e3c27a', ohren: '#cfa862', rute: '#dcb86f', nase: '#3b2b20', ohrForm: 'kipp', schattierung: '#c9a35d' },
      schwarz: { name: 'Schwarz', grund: '#1f1e1d', kopf: '#1f1e1d', ohren: '#171615', rute: '#1f1e1d', nase: '#050505', ohrForm: 'kipp', schattierung: '#3a3836' },
      braun: { name: 'Braun (Schoko)', grund: '#5b3a24', kopf: '#5b3a24', ohren: '#4a2f1d', rute: '#5b3a24', nase: '#2e1c12', ohrForm: 'kipp', schattierung: '#734b30' },
    },
    'Malinois': {
      falb: { name: 'Falb mit Maske', grund: '#c99250', kopf: '#c99250', maske: '#241911', ohren: '#241911', rute: '#c08848', rutenspitze: '#241911', ohrForm: 'steh', ruecken: 'rgba(36,25,17,0.28)' },
      mahagoni: { name: 'Mahagoni', grund: '#9a5a2c', kopf: '#9a5a2c', maske: '#1e140e', ohren: '#1e140e', rute: '#8e5329', rutenspitze: '#1e140e', ohrForm: 'steh', ruecken: 'rgba(30,20,14,0.35)' },
    },
    'Beagle': {
      dreifarbig: { name: 'Dreifarbig', grund: '#f3eee4', kopf: '#b9773d', sattel: '#221c18', ohren: '#a86a33', rute: '#221c18', rutenspitze: '#f7f3ec', ohrForm: 'kipp', blesse: '#f7f3ec' },
      zitrone: { name: 'Zitronen-Weiß', grund: '#f5f0e4', kopf: '#e2c47e', sattel: '#e5c983', ohren: '#d8b66b', rute: '#e5c983', rutenspitze: '#f7f3ec', ohrForm: 'kipp', blesse: '#f7f3ec' },
      rotweiss: { name: 'Rot-Weiß', grund: '#f3eee4', kopf: '#b2622c', sattel: '#b2622c', ohren: '#a0582a', rute: '#b2622c', rutenspitze: '#f7f3ec', ohrForm: 'kipp', blesse: '#f7f3ec' },
    },
    'Deutscher Schäferhund': {
      schwarzbraun: { name: 'Schwarz-Braun', grund: '#b67d3e', kopf: '#b67d3e', sattel: '#1d1916', maske: '#1d1916', ohren: '#1d1916', rute: '#2a2420', ohrForm: 'steh' },
      grau: { name: 'Grau (wildfarben)', grund: '#9c8d74', kopf: '#9c8d74', ruecken: 'rgba(30,28,25,0.55)', maske: '#2b2824', ohren: '#2b2824', rute: '#5e564b', ohrForm: 'steh' },
      schwarz: { name: 'Schwarz', grund: '#1c1b1a', kopf: '#1c1b1a', ohren: '#141312', rute: '#1c1b1a', ohrForm: 'steh', schattierung: '#363432' },
    },
    'Border Collie': {
      schwarzweiss: { name: 'Schwarz-Weiß', grund: '#1d1d1f', kopf: '#1d1d1f', kragen: '#f2f2f0', blesse: '#f2f2f0', ohren: '#1d1d1f', rute: '#1d1d1f', rutenspitze: '#f2f2f0', pfoten: '#f2f2f0', ohrForm: 'kipp' },
      rotweiss: { name: 'Rot-Weiß', grund: '#7a4326', kopf: '#7a4326', kragen: '#f2f2f0', blesse: '#f2f2f0', ohren: '#6a3a21', rute: '#7a4326', rutenspitze: '#f2f2f0', pfoten: '#f2f2f0', ohrForm: 'kipp' },
      merle: { name: 'Blue Merle', grund: '#8e98a5', kopf: '#8e98a5', flecken: '#2a2e35', kragen: '#f2f2f0', blesse: '#f2f2f0', ohren: '#2a2e35', rute: '#8e98a5', rutenspitze: '#f2f2f0', pfoten: '#f2f2f0', ohrForm: 'kipp' },
    },
    'Mischling': {
      braungefleckt: { name: 'Braun gefleckt', grund: '#8c6b4f', kopf: '#8c6b4f', flecken: '#5e4532', ohren: '#5e4532', rute: '#8c6b4f', ohrForm: 'kipp', maske: '#6e523c' },
      schwarz: { name: 'Schwarz mit Brustfleck', grund: '#222120', kopf: '#222120', kragen: '#ece8e0', ohren: '#1a1918', rute: '#222120', ohrForm: 'kipp' },
      weissbraun: { name: 'Weiß-Braun', grund: '#efe9df', kopf: '#9a6a43', flecken: '#9a6a43', ohren: '#86593a', rute: '#efe9df', ohrForm: 'kipp' },
      grau: { name: 'Grau gestromt', grund: '#7d7a74', kopf: '#7d7a74', ruecken: 'rgba(40,38,35,0.35)', ohren: '#4b4945', rute: '#7d7a74', ohrForm: 'steh', maske: '#4b4945' },
    },
  };

  function fellVarianten(rasse) {
    return FELL[rasse] || FELL.Mischling;
  }

  function fellFuer(rasse, variante) {
    const v = fellVarianten(rasse);
    return v[variante] || v[Object.keys(v)[0]];
  }

  function ellipse(g, x, y, rx, ry, farbe, rand) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    if (farbe) { g.fillStyle = farbe; g.fill(); }
    if (rand) { g.strokeStyle = rand; g.lineWidth = 1; g.stroke(); }
  }

  // Zeichnet den Hund am Ursprung, Blickrichtung +x (vorher translate/rotate setzen).
  // z: { sk (px pro m), t (s), rasse, fell (Variante), liegt, rute (0..1), ruteHoch, naseTief, kopfW (rad), aktiv }
  function zeichneHund(g, z) {
    const f = fellFuer(z.rasse, z.fell);
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

  // z: { rasse, fell, disziplin, lk, versteckTyp, versteckHoehe, quelleHoehe, quelleTyp,
  //      abstand (m), aktiv, blick, rute, t, zeigeAbstand }
  function zeichneAnzeigeSzene(g, W, H, z) {
    const f = fellFuer(z.rasse, z.fell);
    // px pro Meter so wählen, dass Hund (inkl. Rute), Abstand und Versteck ins Bild passen
    const abstand = Math.max(0.02, z.abstand || 0.1);
    const S = Math.min(W / (abstand + 1.62), H * 1.25);
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
    const objX = Math.max(W * 0.58, (abstand + 1.04) * S + 4);
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

    // Hund in passiver Platzanzeige, Nase auf die Quelle gerichtet
    const naseX = objX - abstand * S;
    // Liegend erreicht die Nase höchstens ca. 30 cm; Hochlagen darüber werden von unten verwiesen.
    const naseY = Math.max(boden - 0.3 * S, quelleY);
    const nachOben = quelleY < naseY - 0.02 * S;
    const brustX = naseX - 0.27 * S;
    const koerperX = brustX - 0.24 * S;
    const atem = 1 + Math.sin(t * 2.6) * 0.025;

    ellipse(g, koerperX + 0.05 * S, boden + 1, 0.42 * S, 0.045 * S, 'rgba(0,0,0,0.28)');

    // Rute am Boden, leicht wedelnd
    const wedel = Math.sin(t * (2 + (z.rute || 0.2) * 10)) * 0.025 * S * (z.rute || 0.2);
    g.strokeStyle = volumen(g, f.rute || f.grund, boden - 0.08 * S, boden);
    g.lineWidth = 0.045 * S; g.lineCap = 'round';
    g.beginPath(); g.moveTo(koerperX - 0.24 * S, boden - 0.08 * S);
    g.quadraticCurveTo(koerperX - 0.38 * S, boden - 0.02 * S, koerperX - 0.5 * S, boden - 0.025 * S + wedel); g.stroke();
    if (f.rutenspitze) {
      g.strokeStyle = f.rutenspitze;
      g.beginPath(); g.moveTo(koerperX - 0.46 * S, boden - 0.025 * S + wedel * 0.8); g.lineTo(koerperX - 0.5 * S, boden - 0.025 * S + wedel); g.stroke();
    }

    // Hinterhand (Keule) und Körper
    const kh = 0.13 * S * atem;
    g.save();
    g.beginPath(); g.ellipse(koerperX, boden - kh, 0.28 * S, kh, 0, 0, Math.PI * 2);
    g.ellipse(koerperX - 0.17 * S, boden - 0.105 * S, 0.12 * S, 0.105 * S, 0, 0, Math.PI * 2);
    g.ellipse(brustX, boden - 0.14 * S, 0.1 * S, 0.12 * S, 0, 0, Math.PI * 2);
    g.fillStyle = volumen(g, f.grund, boden - 0.28 * S, boden);
    g.fill();
    g.clip();
    if (f.ruecken) { g.fillStyle = f.ruecken; g.fillRect(koerperX - 0.3 * S, boden - 0.3 * S, 0.55 * S, 0.12 * S); }
    if (f.sattel) {
      g.fillStyle = volumen(g, f.sattel, boden - 0.28 * S, boden - 0.08 * S);
      g.beginPath(); g.ellipse(koerperX - 0.03 * S, boden - 0.22 * S, 0.25 * S, 0.1 * S, 0, 0, Math.PI * 2); g.fill();
    }
    if (f.flecken) {
      ellipse(g, koerperX - 0.12 * S, boden - 0.17 * S, 0.08 * S, 0.06 * S, f.flecken);
      ellipse(g, koerperX + 0.12 * S, boden - 0.2 * S, 0.06 * S, 0.05 * S, f.flecken);
    }
    if (f.kragen) ellipse(g, brustX + 0.03 * S, boden - 0.12 * S, 0.08 * S, 0.12 * S, f.kragen);
    g.restore();
    // Hinterpfote
    ellipse(g, koerperX - 0.05 * S, boden - 0.018 * S, 0.06 * S, 0.02 * S, f.pfoten || ton(f.grund, -0.15));

    // Vorderläufe nach vorn gestreckt (der hintere etwas dunkler), aktiv = Scharren
    const scharr = z.aktiv ? Math.max(0, Math.sin(t * 12)) * 0.06 * S : 0;
    const lauf = (yOff, farbe, hebung) => {
      const x0 = brustX - 0.02 * S; const x1 = brustX + 0.19 * S;
      const y = boden - 0.04 * S - yOff;
      g.strokeStyle = farbe; g.lineWidth = 0.05 * S; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + 0.008 * S, x1, y - hebung); g.stroke();
      ellipse(g, x1 + 0.02 * S, y - hebung + 0.004 * S, 0.038 * S, 0.022 * S, f.pfoten || ton(f.grund, -0.1));
    };
    lauf(0.025 * S, ton(f.grund, -0.25), 0);
    lauf(0, ton(f.grund, 0.05), scharr);

    // Kopf: zur Quelle gerichtet oder (Blick zurück) zum HF gedreht
    const halsX = brustX + 0.04 * S; const halsY = boden - 0.22 * S;
    let kopfX = naseX - 0.16 * S; let kopfY = naseY - (nachOben ? -0.06 : 0.03) * S;
    if (nachOben) kopfX = naseX - 0.13 * S;
    let winkel = Math.atan2(naseY - kopfY, naseX - kopfX) + 0.15;
    if (z.blick) { kopfX = halsX + 0.02 * S; kopfY = halsY - 0.08 * S; winkel = Math.PI + 0.5; }
    // Hals
    g.strokeStyle = volumen(g, f.kopf || f.grund, halsY - 0.06 * S, boden - 0.1 * S);
    g.lineWidth = 0.11 * S; g.lineCap = 'round';
    g.beginPath(); g.moveTo(brustX - 0.02 * S, boden - 0.15 * S); g.lineTo(kopfX, kopfY); g.stroke();
    if (f.kragen) { g.strokeStyle = f.kragen; g.lineWidth = 0.05 * S; g.beginPath(); g.moveTo(brustX, boden - 0.12 * S); g.lineTo((brustX + kopfX) / 2, (boden - 0.12 * S + kopfY) / 2 + 0.02 * S); g.stroke(); }

    g.save();
    g.translate(kopfX, kopfY);
    g.rotate(winkel);
    if (Math.cos(winkel) < 0) g.scale(1, -1); // Kopf nach hinten gedreht: Oberseite bleibt oben
    const k = (f.kopf || f.grund);
    // Ohr hinten
    if (f.ohrForm === 'steh') {
      g.fillStyle = f.ohren || ton(k, -0.2);
      g.beginPath(); g.moveTo(-0.03 * S, -0.05 * S); g.lineTo(-0.02 * S, -0.15 * S); g.lineTo(0.035 * S, -0.06 * S); g.closePath(); g.fill();
    }
    // Schädel und Fang
    g.fillStyle = volumen(g, k, -0.07 * S, 0.06 * S);
    g.beginPath(); g.ellipse(0, 0, 0.075 * S, 0.062 * S, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0.03 * S, -0.045 * S); g.lineTo(0.16 * S, -0.018 * S); g.lineTo(0.16 * S, 0.02 * S); g.lineTo(0.03 * S, 0.05 * S); g.closePath(); g.fill();
    if (f.maske) {
      g.fillStyle = f.maske;
      g.beginPath(); g.moveTo(0.07 * S, -0.035 * S); g.lineTo(0.16 * S, -0.018 * S); g.lineTo(0.16 * S, 0.02 * S); g.lineTo(0.07 * S, 0.04 * S); g.closePath(); g.fill();
    }
    if (f.blesse) { g.fillStyle = f.blesse; g.fillRect(-0.01 * S, -0.058 * S, 0.15 * S, 0.016 * S); }
    // Auge, Nase
    ellipse(g, 0.035 * S, -0.022 * S, 0.011 * S, 0.008 * S, '#120d0a');
    ellipse(g, 0.038 * S, -0.025 * S, 0.003 * S, 0.003 * S, 'rgba(255,255,255,0.8)');
    ellipse(g, 0.163 * S, 0, 0.016 * S, 0.016 * S, f.nase || '#111');
    // Hängeohr vorn
    if (f.ohrForm !== 'steh') {
      g.fillStyle = volumen(g, f.ohren || ton(k, -0.15), -0.04 * S, 0.08 * S);
      g.beginPath(); g.ellipse(-0.025 * S, 0.02 * S, 0.035 * S, 0.06 * S, 0.3, 0, Math.PI * 2); g.fill();
    }
    g.restore();

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

  SHS.grafik = { FELL, fellVarianten, fellFuer, zeichneHund, zeichneTruemmer, kiesPunkte, zeichneAnzeigeSzene };
})(globalThis.SHS = globalThis.SHS || {});
