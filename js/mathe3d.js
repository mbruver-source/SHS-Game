// 3D-Mathematik für die WebGL-Ansicht (DOM-frei, in Node testbar).
// Matrizen sind 4×4, spaltenweise (wie WebGL). Welt → GL: x → x, Höhe → y, Welt-y → z.
(function (SHS) {
  'use strict';

  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

  // a · b
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  // Mehrere Matrizen von links nach rechts verketten: kette(A, B, C) = A·B·C
  function kette(...ms) { return ms.reduce((a, b) => mul(a, b)); }

  function verschiebe(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function skaliere(x, y, z) { return [x, 0, 0, 0, 0, y === undefined ? x : y, 0, 0, 0, 0, z === undefined ? x : z, 0, 0, 0, 0, 1]; }
  function drehX(a) { const c = Math.cos(a); const s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function drehY(a) { const c = Math.cos(a); const s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function drehZ(a) { const c = Math.cos(a); const s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

  // Drehung in der Bodenebene passend zur 2D-Darstellung (Winkel w im Welt-x/y-System, y nach unten).
  function drehBoden(w) { return drehY(-w); }

  function perspektive(fovy, aspekt, nah, fern) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (nah - fern);
    return [f / aspekt, 0, 0, 0, 0, f, 0, 0, 0, 0, (fern + nah) * nf, -1, 0, 0, 2 * fern * nah * nf, 0];
  }

  function normiere(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function kreuz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function punkt(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function lookAt(auge, ziel, oben) {
    const z = normiere([auge[0] - ziel[0], auge[1] - ziel[1], auge[2] - ziel[2]]);
    const x = normiere(kreuz(oben, z));
    const y = kreuz(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -punkt(x, auge), -punkt(y, auge), -punkt(z, auge), 1];
  }

  function invertiere(m) {
    const inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (Math.abs(det) < 1e-12) return ident();
    det = 1 / det;
    return inv.map((v) => v * det);
  }

  // Punkt (x, y, z, 1) mit m transformieren → [x, y, z, w]
  function transformiere(m, x, y, z) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
  }

  // Richtungsvektor (ohne Verschiebung)
  function richtung(m, x, y, z) {
    return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  }

  // Normalenmatrix (3×3, inverse Transponierte der linken oberen 3×3) als 9 Werte, spaltenweise.
  function normalenMatrix(m) {
    const a = m[0]; const b = m[1]; const c = m[2]; const d = m[4]; const e = m[5]; const f = m[6]; const g = m[8]; const h = m[9]; const i = m[10];
    const A = e * i - f * h; const B = -(d * i - f * g); const C = d * h - e * g;
    const det = a * A + b * B + c * C || 1;
    return [A / det, B / det, C / det,
      -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
      (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
  }

  // Weltpunkt (Meter, Höhe) → Bildschirm (px). Liefert [px, py, tiefe] oder null hinter der Kamera.
  function projiziere(vp, wx, wy, hoehe, W, H) {
    const p = transformiere(vp, wx, hoehe || 0, wy);
    if (p[3] <= 1e-6) return null;
    return [(p[0] / p[3] * 0.5 + 0.5) * W, (1 - (p[1] / p[3] * 0.5 + 0.5)) * H, p[2] / p[3]];
  }

  // Bildschirmpunkt → Schnittpunkt mit dem Boden (Höhe 0) als [wx, wy] oder null.
  function strahlBoden(invVP, px, py, W, H) {
    const nx = (px / W) * 2 - 1; const ny = 1 - (py / H) * 2;
    const a = transformiere(invVP, nx, ny, -1); const b = transformiere(invVP, nx, ny, 1);
    const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    const p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    const dy = p1[1] - p0[1];
    if (Math.abs(dy) < 1e-9) return null;
    const t = -p0[1] / dy;
    if (t < 0) return null;
    return [p0[0] + (p1[0] - p0[0]) * t, p0[2] + (p1[2] - p0[2]) * t];
  }

  const NEIGUNG = (50 * Math.PI) / 180; // Blickwinkel über dem Boden
  const FOV = (30 * Math.PI) / 180;

  // Kamera, die um die Weltmitte kreist. yaw in rad (0 = von Süden, wie die 2D-Ansicht), 90°-Schritte im Spiel.
  // Abstand und Zielpunkt werden so gewählt, dass die ganze Welt (inkl. Personenhöhe) ins Bild passt.
  function kamera(welt, yaw, W, H, opts) {
    const o = opts || {};
    const neigung = o.neigung || NEIGUNG;
    const rand = o.rand || 0.9;
    const aspekt = W / Math.max(1, H);
    const cx = welt.w / 2; const cz = welt.h / 2;
    const ecken = [];
    for (const [x, z] of [[0, 0], [welt.w, 0], [0, welt.h], [welt.w, welt.h]]) { ecken.push([x, 0, z]); ecken.push([x, 1.2, z]); }
    const bauen = (d, verschX, verschZ) => {
      const zx = cx + verschX; const zz = cz + verschZ;
      const auge = [zx + Math.sin(yaw) * Math.cos(neigung) * d, Math.sin(neigung) * d, zz + Math.cos(yaw) * Math.cos(neigung) * d];
      const view = lookAt(auge, [zx, 0, zz], [0, 1, 0]);
      const proj = perspektive(FOV, aspekt, Math.max(0.05, d * 0.05), d * 4 + 20);
      return { auge, ziel: [zx, 0, zz], view, proj, vp: mul(proj, view), d };
    };
    const ausdehnung = (k) => {
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const e of ecken) {
        const p = transformiere(k.vp, e[0], e[1], e[2]);
        if (p[3] <= 0) return null;
        const x = p[0] / p[3]; const y = p[1] / p[3];
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };
    // Abstand per Bisektion, danach Zielpunkt so verschieben, dass das Bild mittig sitzt
    let vx = 0; let vz = 0; let k = null;
    const diag = Math.hypot(welt.w, welt.h);
    for (let runde = 0; runde < 3; runde++) {
      let lo = diag * 0.3; let hi = diag * 8;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const a = ausdehnung(bauen(mid, vx, vz));
        if (a && Math.max(-a.x0, a.x1, -a.y0, a.y1) <= rand) hi = mid; else lo = mid;
      }
      k = bauen(hi, vx, vz);
      const a = ausdehnung(k);
      if (!a) break;
      // Bildmitte in der Höhe ausgleichen: Ziel entlang der Blickrichtung am Boden verschieben
      const dy = (a.y0 + a.y1) / 2;
      if (Math.abs(dy) < 0.005) break;
      const schritt = dy * k.d * 0.5;
      vx += -Math.sin(yaw) * schritt; vz += -Math.cos(yaw) * schritt;
    }
    k.inv = invertiere(k.vp);
    k.yaw = yaw;
    return k;
  }

  // Bildschirmrichtung der Steuerung (sx nach rechts, sy nach unten) → Weltrichtung, abhängig vom Kamerawinkel.
  function eingabeRichtung(sx, sy, yaw) {
    const c = Math.cos(yaw); const s = Math.sin(yaw);
    return [sx * c + sy * s, -sx * s + sy * c];
  }

  SHS.mathe3d = {
    ident, mul, kette, verschiebe, skaliere, drehX, drehY, drehZ, drehBoden, perspektive, lookAt, invertiere,
    transformiere, richtung, normalenMatrix, projiziere, strahlBoden, kamera, eingabeRichtung, normiere,
  };
})(globalThis.SHS = globalThis.SHS || {});
