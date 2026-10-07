const test = require('node:test');
const assert = require('node:assert/strict');
const { SHS } = require('./helfer');

const M = SHS.mathe3d;
const MO = SHS.modelle3d;

test('Projektion und Strahl auf den Boden sind zueinander invers (alle vier Kamerawinkel)', () => {
  const welt = { w: 7, h: 7 };
  for (let schritt = 0; schritt < 4; schritt++) {
    const k = M.kamera(welt, (schritt * Math.PI) / 2, 800, 600);
    for (const [x, y] of [[1, 1], [3.5, 3.5], [6, 2], [2.2, 6.4]]) {
      const p = M.projiziere(k.vp, x, y, 0, 800, 600);
      const b = M.strahlBoden(k.inv, p[0], p[1], 800, 600);
      assert.ok(Math.abs(b[0] - x) < 1e-6 && Math.abs(b[1] - y) < 1e-6, `Schritt ${schritt}: ${b} statt ${x},${y}`);
    }
  }
});

test('Kamera zeigt die ganze Welt (auch lange Flächen, hoch- und querformatig)', () => {
  for (const welt of [{ w: 7, h: 7 }, { w: 12, h: 27 }, { w: 15.6, h: 6 }]) {
    for (const [W, H] of [[1200, 700], [400, 800]]) {
      for (let schritt = 0; schritt < 4; schritt++) {
        const k = M.kamera(welt, (schritt * Math.PI) / 2, W, H);
        for (const [x, y] of [[0, 0], [welt.w, 0], [0, welt.h], [welt.w, welt.h]]) {
          const p = M.projiziere(k.vp, x, y, 0, W, H);
          assert.ok(p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H, `Ecke ${x},${y} außerhalb (${W}×${H}, Schritt ${schritt})`);
        }
      }
    }
  }
});

test('Ohne Drehung liegt Norden oben und Osten rechts wie in der 2D-Ansicht', () => {
  const k = M.kamera({ w: 7, h: 7 }, 0, 800, 600);
  const mitte = M.projiziere(k.vp, 3.5, 3.5, 0, 800, 600);
  const nord = M.projiziere(k.vp, 3.5, 1, 0, 800, 600);
  const ost = M.projiziere(k.vp, 6, 3.5, 0, 800, 600);
  assert.ok(nord[1] < mitte[1]);
  assert.ok(ost[0] > mitte[0]);
});

test('Steuerung folgt der Kamera: „vor“ führt immer vom Betrachter weg', () => {
  const welt = { w: 7, h: 7 };
  for (let schritt = 0; schritt < 4; schritt++) {
    const yaw = (schritt * Math.PI) / 2;
    const k = M.kamera(welt, yaw, 800, 600);
    const [dx, dy] = M.eingabeRichtung(0, -1, yaw);
    const a = M.projiziere(k.vp, 3.5, 3.5, 0, 800, 600);
    const b = M.projiziere(k.vp, 3.5 + dx, 3.5 + dy, 0, 800, 600);
    assert.ok(b[1] < a[1] - 10, `Schritt ${schritt}: vor bewegt nicht nach oben`);
    const [rx, ry] = M.eingabeRichtung(1, 0, yaw);
    const c = M.projiziere(k.vp, 3.5 + rx, 3.5 + ry, 0, 800, 600);
    assert.ok(c[0] > a[0] + 10, `Schritt ${schritt}: rechts bewegt nicht nach rechts`);
  }
});

function pruefeNetz(nz, name) {
  assert.ok(nz.p.length > 0, name);
  assert.equal(nz.p.length % 9, 0, `${name}: keine vollständigen Dreiecke`);
  assert.equal(nz.n.length, nz.p.length, name);
  assert.equal(nz.f.length / 4, nz.p.length / 3, name);
  for (const v of nz.p.concat(nz.f)) assert.ok(Number.isFinite(v), `${name}: ungültiger Wert`);
  for (let i = 0; i < nz.n.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(nz.n[i], nz.n[i + 1], nz.n[i + 2]) - 1) < 1e-6, `${name}: Normale nicht normiert`);
  }
}

test('Statische Szenen aller Disziplinen und Leistungsklassen sind gültige Netze', () => {
  for (const d of ['truemmer', 'behaeltnis', 'flaeche']) {
    for (const lk of [1, 2, 3]) pruefeNetz(MO.statisch(SHS.layouts.erzeuge(d, lk, 7 + lk)), `${d} LK ${lk}`);
  }
});

test('Jedes Trümmerteil bleibt auf seiner Grundfläche und Hochlagen stehen erhöht', () => {
  const lage = SHS.layouts.erzeuge('truemmer', 3, 5);
  for (const typ of ['Brett', 'Stein', 'Rohr', 'Reifen', 'Ziegel', 'Kiste', 'Palette', 'Eimer']) {
    for (const hoehe of [0, 0.45]) {
      const v = { id: 'x', typ, x: 0, y: 0, w: 0.5, h: 0.3, rot: 0.7, hoehe };
      const nz = MO.netz();
      MO.truemmer(nz, v);
      pruefeNetz(nz, typ);
      let maxR = 0; let maxY = 0; let minY = Infinity;
      for (let i = 0; i < nz.p.length; i += 3) {
        maxR = Math.max(maxR, Math.hypot(nz.p[i], nz.p[i + 2]));
        maxY = Math.max(maxY, nz.p[i + 1]); minY = Math.min(minY, nz.p[i + 1]);
      }
      assert.ok(maxR <= Math.hypot(0.5, 0.5) / 2 + 0.25, `${typ}: ragt über die Grundfläche hinaus (${maxR})`);
      assert.ok(minY >= -0.03, `${typ}: liegt unter dem Boden`);
      assert.ok(maxY > hoehe, `${typ}: Oberkante nicht über der Hochlage`);
      assert.ok(Math.abs(MO.oberkante(v) - maxY) < 0.12, `${typ}: Oberkante ${MO.oberkante(v)} passt nicht zum Modell (${maxY})`);
    }
  }
  assert.ok(lage.verstecke.length > 0);
});

test('Hund jeder Rasse: Pose steht auf dem Boden, liegt flacher als er steht', () => {
  for (const rasse of SHS.rassen.liste) {
    const F = SHS.rassen.form(rasse);
    const { teile } = MO.hundTeile(F, SHS.rassen.fell(rasse));
    for (const [n, nz] of Object.entries(teile)) pruefeNetz(nz, `${rasse}/${n}`);
    const hoechster = (z) => {
      let max = -Infinity; let min = Infinity;
      for (const { teil, m } of MO.hundPose(F, z)) {
        const nz = teile[teil];
        for (let i = 0; i < nz.p.length; i += 3) {
          const p = M.transformiere(m, nz.p[i], nz.p[i + 1], nz.p[i + 2]);
          max = Math.max(max, p[1]); min = Math.min(min, p[1]);
        }
      }
      return { max, min };
    };
    const steht = hoechster({ t: 0 });
    const liegt = hoechster({ t: 0, liegtAnteil: 1 });
    assert.ok(steht.min > -0.06 && steht.min < 0.08, `${rasse}: Pfoten nicht am Boden (${steht.min})`);
    assert.ok(liegt.max < steht.max, `${rasse}: liegend nicht flacher`);
    assert.ok(liegt.min > -0.08, `${rasse}: liegt unter dem Boden`);
  }
});

test('Mensch-Modelle: gültig, Kopf auf etwa 1,7 m, Arm beim Handzeichen über dem Kopf', () => {
  const teile = MO.menschTeile({ jacke: '#2f5d8c', klemmbrett: true });
  for (const [n, nz] of Object.entries(teile)) pruefeNetz(nz, n);
  const top = (arm) => {
    let max = -Infinity;
    for (const { teil, m } of MO.menschPose({ arm })) {
      const nz = teile[teil];
      for (let i = 0; i < nz.p.length; i += 3) max = Math.max(max, M.transformiere(m, nz.p[i], nz.p[i + 1], nz.p[i + 2])[1]);
    }
    return max;
  };
  assert.ok(top(false) > 1.6 && top(false) < 1.85, `Größe ${top(false)}`);
  assert.ok(top(true) > top(false) + 0.2);
});

test('Farben werden aus Hex und rgba gelesen', () => {
  assert.deepEqual(MO.farbe('#ff0000'), [1, 0, 0, 1]);
  assert.deepEqual(MO.farbe('#fff'), [1, 1, 1, 1]);
  const r = MO.farbe('rgba(51,102,153,0.5)');
  assert.ok(Math.abs(r[0] - 0.2) < 1e-9 && Math.abs(r[3] - 0.5) < 1e-9);
});
