// 3D-Ansicht der Suche (WebGL 1, ohne Bibliotheken). Zeichnet Boden, Verstecke, Hund, HF, WR und Leine;
// Texte und Hinweise legt SuchSzene im 2D-Canvas darüber. Spiellogik bleibt unberührt.
(function (SHS) {
  'use strict';
  const M = SHS.mathe3d;
  const MO = SHS.modelle3d;

  const VS = `
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec4 aFarbe;
    uniform mat4 uVP; uniform mat4 uM; uniform mat3 uN;
    varying vec3 vNorm; varying vec4 vFarbe; varying vec3 vLokal; varying vec3 vWelt;
    void main() {
      vec4 w = uM * vec4(aPos, 1.0);
      vNorm = normalize(uN * aNorm);
      // Modellkoordinaten in Metern (Skalierung der Teile herausgerechnet), damit die Körnung überall gleich fein ist
      vLokal = aPos * vec3(length(uM[0].xyz), length(uM[1].xyz), length(uM[2].xyz));
      vFarbe = aFarbe; vWelt = w.xyz;
      gl_Position = uVP * w;
    }`;
  // Licht: warme Sonne + Himmelslicht von oben/Bodenreflex von unten. Die Oberflächenstruktur (Gras, Kies,
  // Holz, Fell) entsteht als Rauschen im Modellraum – ohne Texturdateien, also auch offline.
  const FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec3 vNorm; varying vec4 vFarbe; varying vec3 vLokal; varying vec3 vWelt;
    uniform vec3 uLicht; uniform float uUnbeleuchtet; uniform float uAlpha;
    uniform float uKoernung; uniform float uMaserung; uniform float uBoden; uniform vec4 uSchatten;
    uniform vec3 uMitte; uniform float uRadius; uniform vec3 uDunst;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float rausch(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      if (uSchatten.a > 0.0) { gl_FragColor = uSchatten; return; }
      vec3 n = normalize(vNorm);
      vec3 c = vFarbe.rgb;
      if (uUnbeleuchtet < 0.5) {
        vec2 q = vLokal.xz + vLokal.y * vec2(0.37, 0.61);
        if (uBoden > 0.5) {
          float gras = smoothstep(0.02, 0.1, c.g - max(c.r, c.b));
          float flecken = rausch(q * 0.55) * 0.6 + rausch(q * 1.9) * 0.4;
          float halme = rausch(vec2(q.x * 150.0 + q.y * 20.0, q.y * 34.0)) * 0.6 + rausch(q * 70.0) * 0.4;
          float koerner = rausch(q * 55.0) * 0.55 + rausch(q * 140.0) * 0.45;
          float fein = mix(koerner, halme, gras);
          c *= 0.8 + 0.4 * fein * mix(1.25, 1.0, gras);
          c *= 0.93 + 0.14 * flecken;
          c = mix(c, c * vec3(1.16, 1.06, 0.72), gras * smoothstep(0.5, 0.9, flecken) * 0.3);
        } else if (uKoernung > 0.0) {
          float k = mix(rausch(q * 85.0) * 0.6 + rausch(q * 22.0) * 0.4, rausch(q * 85.0) * 0.4 + rausch(vec2(q.x * 240.0, q.y * 30.0)) * 0.4 + rausch(q * 14.0) * 0.2, uMaserung);
          c *= 1.0 + (k - 0.5) * uKoernung;
        }
        float diffus = max(dot(n, uLicht), 0.0);
        vec3 himmel = mix(vec3(0.34, 0.36, 0.3), vec3(0.6, 0.66, 0.74), 0.5 + 0.5 * n.y);
        c *= himmel + vec3(1.0, 0.94, 0.82) * 0.62 * diffus;
        float weit = smoothstep(uRadius, uRadius + 9.0, length(vWelt.xz - uMitte.xz));
        c = mix(c, uDunst, weit * 0.85);
      }
      gl_FragColor = vec4(c, vFarbe.a * uAlpha);
    }`;
  const VS_TEX = `
    attribute vec3 aPos; attribute vec2 aUV;
    uniform mat4 uVP; varying vec2 vUV;
    void main() { vUV = aUV; gl_Position = uVP * vec4(aPos, 1.0); }`;
  const FS_TEX = `
    precision mediump float;
    varying vec2 vUV; uniform sampler2D uTex;
    void main() { gl_FragColor = texture2D(uTex, vUV); }`;

  const LICHT = M.normiere([-0.55, 0.8, 0.3]);
  const DUNST = [0.3, 0.42, 0.26]; // Rasen in der Ferne: gedämpft, zugleich Hintergrundfarbe
  // Schattenwurf: flacht jedes Modell entlang der Lichtrichtung auf den Boden ab (Höhe knapp über dem Absperrband)
  const SCHATTEN_M = [1, 0, 0, 0, -LICHT[0] / LICHT[1], 0, -LICHT[2] / LICHT[1], 0, 0, 0, 1, 0, 0, 0.016, 0, 1];
  const SCHATTEN_FARBE = [0.03, 0.07, 0.03, 0.4];

  function programm(gl, vs, fs) {
    const sh = (typ, src) => {
      const s = gl.createShader(typ);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  class Ansicht3D {
    // Prüft einmalig, ob der Browser WebGL kann.
    static verfuegbar() {
      if (Ansicht3D._verfuegbar === undefined) {
        try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
          Ansicht3D._verfuegbar = !!gl;
          const ext = gl && gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        } catch (e) { Ansicht3D._verfuegbar = false; }
      }
      return Ansicht3D._verfuegbar;
    }

    constructor(canvas) {
      this.canvas = canvas;
      const opts = { antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: false };
      const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL nicht verfügbar');
      this.gl = gl;
      this.verloren = false;
      this.onLost = (e) => { e.preventDefault(); this.verloren = true; };
      canvas.addEventListener('webglcontextlost', this.onLost);
      this.p = programm(gl, VS, FS);
      this.a = { pos: gl.getAttribLocation(this.p, 'aPos'), norm: gl.getAttribLocation(this.p, 'aNorm'), farbe: gl.getAttribLocation(this.p, 'aFarbe') };
      this.u = {};
      for (const n of ['uVP', 'uM', 'uN', 'uLicht', 'uUnbeleuchtet', 'uAlpha', 'uKoernung', 'uMaserung', 'uBoden', 'uSchatten', 'uMitte', 'uRadius', 'uDunst']) this.u[n] = gl.getUniformLocation(this.p, n);
      this.pt = programm(gl, VS_TEX, FS_TEX);
      this.at = { pos: gl.getAttribLocation(this.pt, 'aPos'), uv: gl.getAttribLocation(this.pt, 'aUV') };
      this.ut = { uVP: gl.getUniformLocation(this.pt, 'uVP'), uTex: gl.getUniformLocation(this.pt, 'uTex') };
      this.puffer = [];
      this.lage = null;
      this.modelle = {};
      this.leinePuffer = null;
      this.geruch = null;
      this.einfach = {
        spielzeug: this.netzPuffer(MO.spielzeug()), futter: this.netzPuffer(MO.futter()), schatten: this.netzPuffer(MO.scheibe()),
      };
    }

    // Netz → Vertex-Puffer (verschachtelt: Position 3, Normale 3, Farbe 4)
    netzPuffer(nz, puf) {
      const gl = this.gl;
      const n = nz.p.length / 3;
      const daten = new Float32Array(n * 10);
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        daten[o] = nz.p[i * 3]; daten[o + 1] = nz.p[i * 3 + 1]; daten[o + 2] = nz.p[i * 3 + 2];
        daten[o + 3] = nz.n[i * 3]; daten[o + 4] = nz.n[i * 3 + 1]; daten[o + 5] = nz.n[i * 3 + 2];
        daten[o + 6] = nz.f[i * 4]; daten[o + 7] = nz.f[i * 4 + 1]; daten[o + 8] = nz.f[i * 4 + 2]; daten[o + 9] = nz.f[i * 4 + 3];
      }
      const p = puf || { buf: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf);
      gl.bufferData(gl.ARRAY_BUFFER, daten, puf ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      p.anzahl = n;
      if (!puf) this.puffer.push(p.buf);
      return p;
    }

    zeichneNetz(p, m, alpha) {
      if (!p || !p.anzahl) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf);
      gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(this.a.norm, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(this.a.farbe, 4, gl.FLOAT, false, 40, 24);
      gl.uniformMatrix4fv(this.u.uM, false, m);
      gl.uniformMatrix3fv(this.u.uN, false, M.normalenMatrix(m));
      gl.uniform1f(this.u.uAlpha, alpha === undefined ? 1 : alpha);
      gl.drawArrays(gl.TRIANGLES, 0, p.anzahl);
    }

    // Statische Szene bei neuer Suchlage aufbauen
    setzeLage(lage) {
      if (this.lage === lage) return;
      this.lage = lage;
      for (const k of ['bodenNetz', 'objekteNetz']) if (this[k]) this.gl.deleteBuffer(this[k].buf);
      this.bodenNetz = this.netzPuffer(MO.boden(lage));
      this.objekteNetz = this.netzPuffer(MO.objekte(lage));
      if (this.geruch) this.gl.deleteTexture(this.geruch.tex);
      this.hv = null;
      this.geruch = null;
    }

    hundModell(rasse, fell) {
      const k = 'hund:' + rasse + ':' + fell;
      if (!this.modelle[k]) {
        const F = SHS.rassen.form(rasse);
        const { teile } = MO.hundTeile(F, SHS.rassen.fell(rasse, fell));
        const p = {};
        for (const n of Object.keys(teile)) p[n] = this.netzPuffer(teile[n]);
        this.modelle[k] = { F, p };
      }
      return this.modelle[k];
    }

    menschModell(k, z) {
      if (!this.modelle[k]) {
        const teile = MO.menschTeile(z);
        const p = {};
        for (const n of Object.keys(teile)) p[n] = this.netzPuffer(teile[n]);
        this.modelle[k] = p;
      }
      return this.modelle[k];
    }

    groesse(breite, hoehe) {
      if (this.canvas.width !== breite || this.canvas.height !== hoehe) {
        this.canvas.width = breite; this.canvas.height = hoehe;
      }
    }

    // sz: SuchSzene (oder Zeichner der Nachbetrachtung) mit lage, s, kam, opts.hund
    zeichne(sz) {
      const gl = this.gl;
      if (this.verloren || gl.isContextLost()) { this.verloren = true; return; }
      const lage = sz.lage; const s = sz.s; const kam = sz.kam;
      this.setzeLage(lage);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(DUNST[0], DUNST[1], DUNST[2], 1);
      gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.depthMask(true);

      gl.useProgram(this.p);
      gl.enableVertexAttribArray(this.a.pos); gl.enableVertexAttribArray(this.a.norm); gl.enableVertexAttribArray(this.a.farbe);
      gl.uniformMatrix4fv(this.u.uVP, false, kam.vp);
      gl.uniform3fv(this.u.uLicht, LICHT);
      gl.uniform1f(this.u.uUnbeleuchtet, 0);
      gl.uniform4f(this.u.uSchatten, 0, 0, 0, 0);
      gl.uniform3f(this.u.uMitte, lage.welt.w / 2, 0, lage.welt.h / 2);
      gl.uniform1f(this.u.uRadius, Math.hypot(lage.welt.w, lage.welt.h) / 2 + 1.5);
      gl.uniform3fv(this.u.uDunst, DUNST);
      gl.uniform1f(this.u.uBoden, 1); gl.uniform1f(this.u.uKoernung, 0);
      this.zeichneNetz(this.bodenNetz, M.ident());
      gl.uniform1f(this.u.uBoden, 0);

      // Alles, was einen Schatten wirft, wird gesammelt und danach ein zweites Mal flach auf den Boden gezeichnet
      const werfer = [];
      const netz = (p, m, koernung) => {
        gl.uniform1f(this.u.uKoernung, koernung);
        this.zeichneNetz(p, m);
        werfer.push([p, m]);
      };
      gl.uniform1f(this.u.uMaserung, 1);
      netz(this.objekteNetz, M.ident(), 0.3);
      gl.uniform1f(this.u.uMaserung, 0);
      const h = s.hund;
      const wr = { x: 0.45, y: lage.welt.h - 0.55 };

      // Sichtbare Verleitungen
      for (const q of s.quellen) {
        if (q.typ !== 'spielzeug' && q.typ !== 'futter') continue;
        const v = q.versteckId ? lage.verstecke.find((x) => x.id === q.versteckId) : null;
        const y = MO.versteckOberkante(lage, v);
        netz(this.einfach[q.typ], M.verschiebe(q.x, y + (q.typ === 'spielzeug' ? 0.07 : 0.02), q.y), 0.1);
      }

      // Hund
      const t = performance.now() / 1000;
      const hm = this.hundModell(sz.opts.hund.rasse, sz.opts.hund.fell);
      const hv = this.hundGlaetten(sz, t);
      const w = hv.richtung;
      const basis = M.kette(M.verschiebe(h.x, 0, h.y), M.drehBoden(w));
      const pose = MO.hundPose(hm.F, {
        t, liegtAnteil: h.liegtAnim, sitztAnteil: h.sitztAnim, weg: hv.weg, tempo: hv.v,
        kopfW: hv.kopfW + (h.kopfschlag > 0 ? Math.sin(t * 40) * 0.25 : 0), naseTief: h.naseTief, rute: h.rute, ruteHoch: h.ruteHoch,
      });
      for (const teil of pose) netz(hm.p[teil.teil], M.mul(basis, teil.m), 0.34);

      // Hundeführer und Wertungsrichter
      const hf = s.hf;
      const hfm = this.menschModell('hf', { jacke: '#2f5d8c', hose: '#30343d', haare: '#5a3b24' });
      const hfBasis = M.kette(M.verschiebe(hf.x, 0, hf.y), M.drehBoden(hf.richtung || 0));
      for (const teil of MO.menschPose({ gang: hf.gang || 0, tempo: hf.tempo || 0, arm: hf.arm })) netz(hfm[teil.teil], M.mul(hfBasis, teil.m), 0.12);
      const wrm = this.menschModell('wr', { jacke: '#7a2f2f', hose: '#2b2b2b', haare: '#9a9a9a', muetze: '#2b2b2b', klemmbrett: true });
      const wrBasis = M.kette(M.verschiebe(wr.x, 0, wr.y), M.drehBoden(Math.atan2(h.y - wr.y, h.x - wr.x)));
      for (const teil of MO.menschPose({ arm: sz.wrArm > 0 })) netz(wrm[teil.teil], M.mul(wrBasis, teil.m), 0.12);

      // Leine
      gl.uniform1f(this.u.uKoernung, 0);
      if (s.leine || s.schleppleine) { this.zeichneLeine(sz, hm, w); werfer.push([this.leinePuffer, M.ident()]); }

      this.zeichneSchatten(werfer, h, sz);

      // Geruchsansicht als Bodentextur
      if (sz.geruchsAnsicht) this.zeichneGeruch(sz);
    }

    // Schattenwurf der Sonne: die Modelle flach auf den Boden projiziert. Der Stencil-Puffer sorgt dafür,
    // dass sich überlagernde Schatten nicht doppelt abdunkeln. Dazu ein weicher Kontaktschatten unter dem Hund.
    zeichneSchatten(werfer, h, sz) {
      const gl = this.gl;
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(this.u.uUnbeleuchtet, 1);
      const G = SHS.rassen.form(sz.opts.hund.rasse).groesse;
      this.zeichneNetz(this.einfach.schatten, M.kette(M.verschiebe(h.x, 0.014, h.y), M.drehBoden(h.richtung), M.skaliere(0.8 * G, 1, 0.4 * G * (1 + 0.3 * (h.liegtAnim || 0)))), 0.6);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.uniform4fv(this.u.uSchatten, SCHATTEN_FARBE);
      for (const [p, m] of werfer) this.zeichneNetz(p, M.mul(SCHATTEN_M, m));
      gl.uniform4f(this.u.uSchatten, 0, 0, 0, 0);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniform1f(this.u.uUnbeleuchtet, 0);
    }

    // Darstellungswerte des Hundes weich nachführen: Körperrichtung, Kopfdrehung, Tempo und
    // zurückgelegter Weg (Schrittzyklus; Drehen auf der Stelle zählt als kurze Schritte).
    hundGlaetten(sz, t) {
      const h = sz.s.hund;
      const kopfZiel = sz.kopfWinkel ? sz.kopfWinkel(t) : 0;
      let hv = this.hv;
      if (!hv) hv = this.hv = { richtung: h.richtung, kopfW: kopfZiel, v: h.v || 0, weg: 0, gang: h.gangPhase || 0, zeit: t };
      const dt = Math.max(0, Math.min(0.1, t - hv.zeit));
      hv.zeit = t;
      let d = h.richtung - hv.richtung;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > 2.5) hv.richtung = h.richtung; // Sprung (z. B. Zeitleiste der Nachbetrachtung)
      else hv.richtung += d * Math.min(1, dt * 12);
      hv.kopfW += (kopfZiel - hv.kopfW) * Math.min(1, dt * 9);
      hv.v += ((h.v || 0) - hv.v) * Math.min(1, dt * 6);
      let dg = (h.gangPhase || 0) - hv.gang;
      if (dg < 0 || dg > 25) dg = 0; // Sprung in der Wiedergabe
      hv.gang = h.gangPhase || 0;
      const drehen = Math.abs(d) * 0.12 + Math.abs(h.drehRate || 0) * dt * 0.06;
      hv.weg += (dg * 0.5) / (2 * Math.PI) + (hv.v < 0.3 ? drehen : 0);
      if (hv.v < 0.3 && drehen > 0.002) hv.v = Math.max(hv.v, 0.2); // beim Drehen auf der Stelle trippeln
      return hv;
    }

    zeichneLeine(sz, hm, w) {
      const s = sz.s; const h = s.hund;
      const g = MO.hundMasse(hm.F);
      const hals = [h.x + Math.cos(w) * (g.hueftX + 0.06 * g.G), (g.bein + g.rumpfH * 0.5) * (1 - 0.6 * (h.liegtAnim || 0)), h.y + Math.sin(w) * (g.hueftX + 0.06 * g.G)];
      const punkte = [];
      const n = 16;
      if (s.schleppleine) {
        // Schleppleine schleift hinter dem Hund über den Boden
        const zw = w + Math.PI;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const quer = Math.sin(u * Math.PI) * 0.25;
          punkte.push([hals[0] + Math.cos(zw) * 2.5 * u - Math.sin(zw) * quer, hals[1] * (1 - Math.min(1, u * 4)) + 0.01, hals[2] + Math.sin(zw) * 2.5 * u + Math.cos(zw) * quer]);
        }
      } else {
        const hw = s.hf.richtung || 0;
        const hand = [s.hf.x + Math.cos(hw) * 0.15 + Math.sin(hw) * 0.25, 0.85, s.hf.y + Math.sin(hw) * 0.15 - Math.cos(hw) * 0.25];
        const d = Math.hypot(hand[0] - hals[0], hand[2] - hals[2]);
        const durchhang = Math.max(0, 2 - d) * 0.35;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const y = hand[1] + (hals[1] - hand[1]) * u - Math.sin(u * Math.PI) * durchhang;
          punkte.push([hand[0] + (hals[0] - hand[0]) * u, Math.max(0.01, y), hand[2] + (hals[2] - hand[2]) * u]);
        }
      }
      const nz = MO.netz();
      const farbe = s.schleppleine ? '#f07828' : '#1e1e1e';
      for (let i = 0; i < n; i++) {
        const a = punkte[i]; const b = punkte[i + 1];
        const dx = b[0] - a[0]; const dy = b[1] - a[1]; const dz = b[2] - a[2];
        const L = Math.hypot(dx, dy, dz);
        if (L < 1e-5) continue;
        const gier = Math.atan2(dz, dx); const neig = Math.asin(Math.max(-1, Math.min(1, dy / L)));
        MO.quader(nz, M.kette(M.verschiebe((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), M.drehBoden(gier), M.drehZ(neig), M.skaliere(L + 0.004, 0.012, 0.012)), farbe);
      }
      this.leinePuffer = this.netzPuffer(nz, this.leinePuffer || { buf: this.neuerPuffer() });
      this.zeichneNetz(this.leinePuffer, M.ident());
    }

    neuerPuffer() { const b = this.gl.createBuffer(); this.puffer.push(b); return b; }

    // Geruchskarte in Weltkoordinaten (alle 0,25 s Spielzeit neu), als halbdurchsichtige Bodentextur
    zeichneGeruch(sz) {
      const gl = this.gl; const s = sz.s; const lage = sz.lage; const welt = lage.welt;
      const zelle = Math.max(0.1, Math.sqrt((welt.w * welt.h) / 6000));
      const nx = Math.ceil(welt.w / zelle); const ny = Math.ceil(welt.h / zelle);
      if (!this.geruch) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const quad = new Float32Array([0, 0.03, 0, 0, 0, welt.w, 0.03, 0, 1, 0, welt.w, 0.03, welt.h, 1, 1,
          0, 0.03, 0, 0, 0, welt.w, 0.03, welt.h, 1, 1, 0, 0.03, welt.h, 0, 1]);
        const buf = this.neuerPuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        this.geruch = { tex, buf, zeit: -1, daten: new Uint8Array(nx * ny * 4) };
      }
      const gr = this.geruch;
      if (gr.zeit < 0 || Math.abs(s.t - gr.zeit) > 0.25) {
        const d = gr.daten;
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const x = (i + 0.5) * zelle; const y = (j + 0.5) * zelle;
            let ziel = 0; let verl = 0; let andere = 0;
            for (const q of s.quellen) {
              const c = SHS.scent.konzentration(q, x, y, lage.wind, s.t);
              if (q.typ === 'ziel') ziel += c;
              else if (q.typ === 'spielzeug' || q.typ === 'futter') verl += c;
              else andere += c;
            }
            const o = (j * nx + i) * 4;
            const a = Math.min(1, ziel * 1.4 + verl * 0.9 + andere * 1.2);
            d[o] = Math.min(255, 255 * (verl * 1.2 + andere * 0.8));
            d[o + 1] = Math.min(255, 120 * ziel + 60 * andere);
            d[o + 2] = Math.min(255, 255 * ziel * 1.5 + andere * 200);
            d[o + 3] = Math.round(a * 170);
          }
        }
        gl.bindTexture(gl.TEXTURE_2D, gr.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nx, ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
        gr.zeit = s.t;
      }
      gl.disableVertexAttribArray(this.a.norm); gl.disableVertexAttribArray(this.a.farbe);
      gl.useProgram(this.pt);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gr.tex);
      gl.uniform1i(this.ut.uTex, 0);
      gl.uniformMatrix4fv(this.ut.uVP, false, sz.kam.vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, gr.buf);
      gl.enableVertexAttribArray(this.at.pos); gl.enableVertexAttribArray(this.at.uv);
      gl.vertexAttribPointer(this.at.pos, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(this.at.uv, 2, gl.FLOAT, false, 20, 12);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(this.at.uv);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enableVertexAttribArray(this.a.pos); gl.enableVertexAttribArray(this.a.norm); gl.enableVertexAttribArray(this.a.farbe);
    }

    // Puffer und Kontext freigeben (Browser erlauben nur wenige gleichzeitige WebGL-Kontexte)
    freigeben() {
      const gl = this.gl;
      if (!gl) return;
      this.canvas.removeEventListener('webglcontextlost', this.onLost);
      if (!gl.isContextLost()) {
        for (const b of this.puffer) gl.deleteBuffer(b);
        if (this.geruch) gl.deleteTexture(this.geruch.tex);
        gl.deleteProgram(this.p); gl.deleteProgram(this.pt);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
      this.gl = null;
    }
  }

  SHS.Ansicht3D = Ansicht3D;
})(globalThis.SHS = globalThis.SHS || {});
