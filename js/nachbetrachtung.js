// Nachbetrachtung einer Suche: Aufzeichnung abspielen mit Laufweg, Ereignis-Markierungen,
// Geruchsfahne und Zeitleiste. Die Zeichnung der Suchlage nutzt SuchSzene (search.js).
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const ARCHIV_MAX = 5;
  const PFAD_FARBEN = {
    sucht: 'rgba(255,255,255,0.75)', geruch: '#3fa9ff', verleitung: '#ff9a3c', schautHF: '#c9c9c9',
    aussenreiz: '#ffd23f', hier: '#c9c9c9', beiHF: '#c9c9c9', sitzt: '#c9c9c9', anzeigeEinnehmen: '#3ddc84', anzeige: '#3ddc84',
  };
  const MARKER = {
    fehler: { farbe: '#e5484d', symbol: '!' }, fehlanzeige: { farbe: '#e5484d', symbol: '✗' },
    anzeige: { farbe: '#30a46c', symbol: '✓' }, geruch: { farbe: '#3fa9ff', symbol: '~' },
    verleitung: { farbe: '#ff9a3c', symbol: 'V' }, hinweis: { farbe: '#8d8d8d', symbol: '?' },
    wr: { farbe: '#2f5d8c', symbol: 'W' }, info: { farbe: '#8d8d8d', symbol: 'i' },
  };
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- Daten (DOM-frei)
  // Speicherbare Kurzform einer Suchlage: Kopfdaten, Verstecke/Quellen und die Aufzeichnung.
  // schritt = jedes wievielte Bild behalten (0,1 s Raster); für das Archiv 3 (≈ 0,3 s).
  function daten(s, meta, schritt) {
    const n = schritt || 1;
    const frames = s.aufzeichnung.frames.filter((f, i, arr) => i % n === 0 || i === arr.length - 1)
      .map((f) => f.map((v, i) => (i === 4 || i === 8 ? v : r2(v))));
    return {
      version: 1,
      meta: Object.assign({
        disziplin: s.opts.disziplin, lk: s.opts.lk, seed: s.opts.seed, ansatzIndex: s.opts.ansatzIndex || 0,
        leine: s.leine, schleppleine: s.schleppleine, suchzeit: s.suchzeit,
        wetter: s.wetter || null, windBasis: s.windBasis,
        hund: { name: s.opts.hund.name, rasse: s.opts.hund.rasse, fell: s.opts.hund.fell },
        ergebnis: s.ergebnis ? { status: s.ergebnis.status, punkte: s.ergebnis.punkte, such: s.ergebnis.such, anzeige: s.ergebnis.anzeige, begruendung: s.ergebnis.begruendung } : null,
      }, meta || {}),
      verstecke: s.lage.verstecke.map((v) => ({ id: v.id, x: r2(v.x), y: r2(v.y), rot: r2(v.rot || 0) })),
      quellen: s.quellen.map((q) => ({ typ: q.typ, name: q.name, x: r2(q.x), y: r2(q.y), hoehe: r2(q.hoehe || 0), versteckId: q.versteckId || null, staerke: q.staerke, reichweite: q.reichweite })),
      frames,
      ereignisse: s.aufzeichnung.ereignisse.map((e) => Object.assign({}, e, { x: r2(e.x), y: r2(e.y) })),
    };
  }

  // Die letzten Suchen im Spielstand archivieren (verkleinert).
  function archivieren(stand, s, meta) {
    if (!s || !s.aufzeichnung) return;
    if (!stand.aufzeichnungen) stand.aufzeichnungen = [];
    stand.aufzeichnungen.push(daten(s, Object.assign({ woche: stand.woche }, meta), 3));
    if (stand.aufzeichnungen.length > ARCHIV_MAX) stand.aufzeichnungen.splice(0, stand.aufzeichnungen.length - ARCHIV_MAX);
  }

  // Zustand des Hundes/HF zum Zeitpunkt t (lineare Interpolation zwischen Bildern).
  function zustandBei(frames, t) {
    let lo = 0; let hi = frames.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames[m][0] <= t) lo = m; else hi = m; }
    const a = frames[lo]; const b = frames[hi];
    const u = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
    const lerp = (i) => a[i] + (b[i] - a[i]) * u;
    let dw = b[3] - a[3];
    while (dw > Math.PI) dw -= 2 * Math.PI;
    while (dw < -Math.PI) dw += 2 * Math.PI;
    return {
      x: lerp(1), y: lerp(2), richtung: a[3] + dw * u, zustand: SHS.ZUSTAENDE[a[4]] || 'sucht',
      liegtAnim: lerp(5), sitztAnim: lerp(6), v: lerp(7), flags: a[8], rute: lerp(9),
      hfx: lerp(10), hfy: lerp(11), hfRichtung: a[12], signal: lerp(13), drehRate: lerp(14) || 0,
    };
  }

  // ---------------------------------------------------------------- Wiedergabe (DOM/Canvas)
  class Nachbetrachtung {
    // d = daten(...); opts = { titel, onEnde() }
    constructor(container, d, opts) {
      this.d = d;
      this.opts = opts || {};
      const m = d.meta;
      const lage = SHS.layouts.erzeuge(m.disziplin, m.lk, m.seed);
      for (const v of d.verstecke) {
        const ziel = lage.verstecke.find((x) => x.id === v.id);
        if (ziel) Object.assign(ziel, v);
      }
      this.lage = lage;
      this.frames = d.frames;
      this.ende = d.frames.length ? d.frames[d.frames.length - 1][0] : 0;
      this.t = 0;
      this.tempo = 2;
      this.spielt = true;
      this.zeigePfad = true;
      this.zeigeMarker = true;
      this.gangPhase = 0;
      this.letzterPunkt = null;

      // Ein "SuchLage"-ähnlicher Zustand, den die Zeichenroutinen von SuchSzene lesen
      const hund = { x: 0, y: 0, richtung: 0, zustand: 'sitzt', liegtAnim: 0, sitztAnim: 1, v: 0, rute: 0.4, ruteHoch: true, naseTief: false, blickZuHF: 0, aktivAnim: false, kopfschlag: 0, drehRate: 0, gangPhase: 0, anzeige: null };
      this.s = {
        lage, quellen: d.quellen, ansatz: lage.ansatzOptionen[Math.min(m.ansatzIndex, lage.ansatzOptionen.length - 1)],
        phase: 'ende', eigengeruchNoetig: false, eigengeruchErledigt: true, reize: [], leine: m.leine, schleppleine: m.schleppleine,
        hf: { x: 0, y: 0, arm: false, anfassen: 0, richtung: 0 }, hund, t: 0,
        naechstesVersteck: (x, y, max) => {
          let best = null; let bd = max;
          for (const v of lage.verstecke) { const dd = Math.hypot(v.x - x, v.y - y); if (dd < bd) { bd = dd; best = v; } }
          return best;
        },
      };
      this.baueDom(container);
      this.anwenden(0);
      this.letzteZeit = performance.now();
      this.laeuft = true;
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    baueDom(container) {
      container.innerHTML = '';
      const m = this.d.meta;
      const erg = m.ergebnis;
      const root = document.createElement('div');
      root.className = 'szene nachbetrachtung';
      root.innerHTML = `
        <div class="hud-oben">
          <div class="hud-titel">Nachbetrachtung: ${po.DISZIPLINEN[m.disziplin].name} · LK ${m.lk}${erg ? ` · ${erg.status === 'ok' ? erg.punkte + ' Punkte' : erg.status === 'disq' ? 'Disqualifikation' : 'Abbruch'}` : ''}</div>
          <div class="hud-knoepfe">
            <label class="check"><input type="checkbox" data-o="pfad" checked> Laufweg</label>
            <label class="check"><input type="checkbox" data-o="marker" checked> Ereignisse</label>
            <label class="check"><input type="checkbox" data-o="geruch"> Geruchsfahne</label>
            <label class="check"><input type="checkbox" data-o="nah" checked> Nahaufnahme</label>
          </div>
        </div>
        <div class="nb-haupt">
          <div class="szene-mitte">
            <canvas class="spielfeld"></canvas>
            <div class="nahaufnahme versteckt"><div class="nah-titel">Nahaufnahme – Anzeige</div><canvas></canvas></div>
          </div>
          <ol class="nb-liste"></ol>
        </div>
        <div class="nb-steuerung">
          <button data-a="play">⏸</button>
          <input type="range" class="nb-zeit" min="0" max="${this.ende}" step="0.1" value="0">
          <span class="nb-zeitanzeige"></span>
          <select class="nb-tempo">${[1, 2, 4, 8].map((v) => `<option value="${v}" ${v === this.tempo ? 'selected' : ''}>${v}×</option>`).join('')}</select>
          <button class="primaer" data-a="weiter">${this.opts.weiterText || 'Weiter'}</button>
        </div>
        <div class="nb-legende">
          <span><i style="background:${PFAD_FARBEN.sucht}"></i>sucht</span>
          <span><i style="background:${PFAD_FARBEN.geruch}"></i>im Geruch</span>
          <span><i style="background:${PFAD_FARBEN.anzeige}"></i>Anzeige</span>
          <span><i style="background:${PFAD_FARBEN.verleitung}"></i>Verleitung</span>
          <span><i style="background:${PFAD_FARBEN.aussenreiz}"></i>Außenreiz</span>
          <span><i style="background:#c9c9c9"></i>steht/schaut zum HF</span>
          <span><i class="hf"></i>Hundeführer</span>
          <span><b style="color:#ffd23f">◎</b> Gegenstand</span>
        </div>`;
      container.appendChild(root);
      this.root = root;

      // Zeichner: eine SuchSzene ohne eigene Spiellogik
      const z = Object.create(SHS.SuchSzene.prototype);
      Object.assign(z, {
        opts: { hund: this.d.meta.hund }, s: this.s, lage: this.lage, rot: false, uebung: true,
        geruchsAnsicht: false, nahAn: true, pause: false, wrArm: 0, root,
        canvas: root.querySelector('.spielfeld'),
        el: { nah: root.querySelector('.nahaufnahme'), nahCanvas: root.querySelector('.nahaufnahme canvas') },
      });
      z.g = z.canvas.getContext('2d');
      const nb = this;
      const leineOriginal = SHS.SuchSzene.prototype.zeichneLeine;
      z.zeichneLeine = function () { nb.zeichnePfad(this); leineOriginal.call(this); };
      this.z = z;
      z.groesseAnpassen();
      this.resizeObs = new ResizeObserver(() => z.groesseAnpassen());
      this.resizeObs.observe(root.querySelector('.szene-mitte'));

      // Ereignisliste
      const liste = root.querySelector('.nb-liste');
      this.marker = this.d.ereignisse.filter((e) => e.typ !== 'info' || /Außenreiz|Verleitung/.test(e.text));
      liste.innerHTML = this.marker.map((e, i) => {
        const typ = e.typ === 'wr' && /^Fehlanzeige/.test(e.text) ? 'fehlanzeige' : e.typ;
        const mk = MARKER[typ] || MARKER.info;
        return `<li data-i="${i}"><span class="nb-nr" style="background:${mk.farbe}">${i + 1}</span>
          <span class="nb-t">${this.zeitText(e.t)}</span> ${e.typ === 'wr' ? 'WR: ' : ''}${escapeHtml(e.text)}</li>`;
      }).join('') || '<li class="klein">Keine Ereignisse aufgezeichnet.</li>';
      if (erg && erg.begruendung) {
        liste.insertAdjacentHTML('beforeend', `<li class="nb-bewertung"><b>Bewertung</b><ul>${erg.begruendung.filter(Boolean).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></li>`);
      }
      liste.addEventListener('click', (ev) => {
        const li = ev.target.closest('li[data-i]');
        if (!li) return;
        const e = this.marker[+li.dataset.i];
        this.springe(Math.max(0, e.t - 1.5));
        this.spielt = true;
        this.aktualisiereKnopf();
      });

      // Steuerung
      this.slider = root.querySelector('.nb-zeit');
      this.slider.addEventListener('input', () => { this.springe(+this.slider.value); });
      root.querySelector('.nb-tempo').addEventListener('change', (ev) => { this.tempo = +ev.target.value; });
      root.querySelector('.nb-steuerung').addEventListener('click', (ev) => {
        const a = ev.target.dataset.a;
        if (a === 'play') {
          if (this.t >= this.ende) this.springe(0);
          this.spielt = !this.spielt;
          this.aktualisiereKnopf();
        }
        if (a === 'weiter') this.beenden();
      });
      root.querySelector('.hud-knoepfe').addEventListener('change', (ev) => {
        const o = ev.target.dataset.o;
        if (o === 'pfad') this.zeigePfad = ev.target.checked;
        if (o === 'marker') this.zeigeMarker = ev.target.checked;
        if (o === 'geruch') this.z.geruchsAnsicht = ev.target.checked;
        if (o === 'nah') this.z.nahAn = ev.target.checked;
      });
      this.onKey = (ev) => {
        if (ev.key === ' ') { ev.preventDefault(); this.spielt = !this.spielt; this.aktualisiereKnopf(); }
        if (ev.key === 'ArrowRight') this.springe(Math.min(this.ende, this.t + 5));
        if (ev.key === 'ArrowLeft') this.springe(Math.max(0, this.t - 5));
      };
      window.addEventListener('keydown', this.onKey);
    }

    zeitText(t) {
      const v = Math.max(0, Math.round(t));
      return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    }

    aktualisiereKnopf() {
      this.root.querySelector('[data-a=play]').textContent = this.spielt ? '⏸' : '▶';
    }

    springe(t) {
      this.t = Math.max(0, Math.min(this.ende, t));
      this.letzterPunkt = null;
      this.anwenden(0);
    }

    // Aufgezeichneten Zustand auf Hund/HF übertragen.
    anwenden(dt) {
      if (!this.frames.length) return;
      const f = zustandBei(this.frames, this.t);
      const h = this.s.hund;
      if (this.letzterPunkt) this.gangPhase += (Math.hypot(f.x - this.letzterPunkt.x, f.y - this.letzterPunkt.y) / 0.5) * Math.PI * 2;
      this.letzterPunkt = { x: f.x, y: f.y };
      Object.assign(h, {
        x: f.x, y: f.y, richtung: f.richtung, zustand: f.zustand, liegtAnim: f.liegtAnim, sitztAnim: f.sitztAnim,
        v: dt > 0 && this.spielt ? f.v : 0, rute: f.rute, naseTief: !!(f.flags & 1), ruteHoch: !!(f.flags & 2),
        blickZuHF: f.flags & 4 ? 1 : 0, aktivAnim: !!(f.flags & 8), drehRate: f.drehRate, gangPhase: this.gangPhase,
      });
      this.s.hf.x = f.hfx; this.s.hf.y = f.hfy; this.s.hf.richtung = f.hfRichtung; this.s.hf.arm = !!(f.flags & 16);
      this.s.t = this.t;
      // Wind wie während der Suche (dreht mit dem Wetter)
      if (this.d.meta.wetter) {
        const w = SHS.wetter.windZu(this.d.meta.wetter, this.d.meta.windBasis, this.t);
        const r = (w.richtung * Math.PI) / 180;
        Object.assign(this.lage.wind, { x: Math.cos(r), y: Math.sin(r), richtung: w.richtung, staerke: w.staerke });
        this.s.wetter = this.d.meta.wetter;
      }
      // Anzeige für die Nahaufnahme: letztes Anzeige-Ereignis bis jetzt
      h.anzeige = null;
      if (f.zustand === 'anzeige' || f.zustand === 'anzeigeEinnehmen') {
        for (const e of this.d.ereignisse) {
          if (e.t > this.t + 0.05) break;
          if (e.typ === 'anzeige' || e.typ === 'fehlanzeige') h.anzeige = { quelle: e.quelle, punkt: e.punkt, aktiv: e.aktiv, ungenau: e.ungenau, richtig: e.richtig };
        }
      }
      this.slider.value = this.t;
      this.root.querySelector('.nb-zeitanzeige').textContent = `${this.zeitText(this.t)} / ${this.zeitText(this.ende)}`;
      // aktuelles Ereignis in der Liste hervorheben
      let aktiv = -1;
      this.marker.forEach((e, i) => { if (e.t <= this.t) aktiv = i; });
      this.root.querySelectorAll('.nb-liste li[data-i]').forEach((li) => li.classList.toggle('aktiv', +li.dataset.i === aktiv));
    }

    zeichnePfad(z) {
      const g = z.g;
      if (this.zeigePfad && this.frames.length > 1) {
        // gesamter Weg blass, bis zur aktuellen Zeit kräftig und nach Zustand gefärbt
        g.save();
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        this.frames.forEach((f, i) => { const [x, y] = z.w2s(f[1], f[2]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
        g.lineWidth = 3;
        for (let i = 1; i < this.frames.length && this.frames[i][0] <= this.t; i++) {
          const a = this.frames[i - 1]; const b = this.frames[i];
          const [ax, ay] = z.w2s(a[1], a[2]); const [bx, by] = z.w2s(b[1], b[2]);
          g.strokeStyle = PFAD_FARBEN[SHS.ZUSTAENDE[b[4]]] || PFAD_FARBEN.sucht;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
        // Weg des HF gestrichelt
        g.setLineDash([4, 4]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(47,93,140,0.85)';
        g.beginPath();
        let start = true;
        for (const f of this.frames) {
          if (f[0] > this.t) break;
          const [x, y] = z.w2s(f[10], f[11]);
          if (start) { g.moveTo(x, y); start = false; } else g.lineTo(x, y);
        }
        g.stroke();
        g.restore();
      }
    }

    zeichneMarker() {
      if (!this.zeigeMarker) return;
      const z = this.z; const g = z.g;
      g.save();
      g.font = 'bold 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      this.marker.forEach((e, i) => {
        if (e.t > this.t) return;
        const typ = e.typ === 'wr' && /^Fehlanzeige/.test(e.text) ? 'fehlanzeige' : e.typ;
        if (typ === 'wr' || typ === 'info') return; // nur in der Liste
        const mk = MARKER[typ] || MARKER.info;
        const [x, y] = z.w2s(e.x, e.y);
        g.fillStyle = mk.farbe; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y - 14, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - 2); g.stroke();
        g.fillStyle = '#fff'; g.fillText(String(i + 1), x, y - 14);
      });
      g.restore();
    }

    frame(jetzt) {
      if (!this.laeuft) return;
      const dt = Math.min(0.05, (jetzt - this.letzteZeit) / 1000);
      this.letzteZeit = jetzt;
      if (this.spielt) {
        this.t = Math.min(this.ende, this.t + dt * this.tempo);
        if (this.t >= this.ende) { this.spielt = false; this.aktualisiereKnopf(); }
      }
      this.anwenden(dt);
      this.z.zeichne();
      this.zeichneMarker();
      requestAnimationFrame(this.frame);
    }

    aufraeumen() {
      this.laeuft = false;
      window.removeEventListener('keydown', this.onKey);
      if (this.resizeObs) this.resizeObs.disconnect();
    }

    beenden() {
      if (!this.laeuft) return;
      this.aufraeumen();
      if (this.opts.onEnde) this.opts.onEnde();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  SHS.nachbetrachtung = { daten, archivieren, zustandBei, Nachbetrachtung, ARCHIV_MAX };
})(globalThis.SHS = globalThis.SHS || {});
