// Spielbare Suchlage: Canvas-Darstellung (2D von oben), Tastatur/Maus, HUD.
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const FARBEN = {
    gras: '#5f8f3e', grasDunkel: '#4d7832', bereich: '#6c9c47', band: '#f4f1e8', mittelweg: '#d8c49a',
    eimer: '#e8e8e8', eimerRand: '#9aa3ad', kammer: '#33414f', truemmer: ['#8b6b4a', '#9d9d9d', '#6f7a83', '#3d3d3d', '#a5542f', '#7b5b3a', '#b08a5a', '#5d6b78'],
    hf: '#2f5d8c', wr: '#7a2f2f', spielzeug: '#d93a3a', futter: '#8a5a2b', ziel: '#ffd23f', diff: '#3fc7ff',
  };

  const fmtZeit = (s) => {
    const v = Math.max(0, Math.ceil(s));
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  };

  class SuchSzene {
    // opts wie SuchLage + { modus: 'uebung'|'pruefung', titel, onEnde(ergebnis, szene) }
    constructor(container, opts) {
      this.opts = opts;
      this.s = new SHS.SuchLage(opts);
      this.lage = this.s.lage;
      this.rot = false; // wird in groesseAnpassen() passend zur Bildschirmform gesetzt
      this.uebung = opts.modus === 'uebung';
      this.geruchsAnsicht = false;
      this.pause = false;
      this.tasten = new Set();
      this.nachrichtenGezeigt = 0;
      this.wrArm = 0;
      this.baueDom(container);
      this.bindeEingabe();
      this.letzteZeit = performance.now();
      this.geruchCache = null;
      this.geruchCacheZeit = -1;
      this.laeuft = true;
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    baueDom(container) {
      container.innerHTML = '';
      const root = document.createElement('div');
      root.className = 'szene';
      root.innerHTML = `
        <div class="hud-oben">
          <div class="hud-titel"></div>
          <div class="hud-werte">
            <span class="hud-zeit" title="verbleibende Suchzeit"></span>
            <span class="hud-fa" title="Fehlanzeigen"></span>
            <span class="hud-wind" title="Wind"></span>
          </div>
          <div class="hud-knoepfe">
            ${this.uebung ? '<button data-a="geruch" title="Geruchsansicht (G)">Geruchsansicht</button>' : ''}
            <button data-a="pause" title="Pause (P)">Pause</button>
            <button data-a="hilfe">Steuerung</button>
            ${this.uebung ? '<button data-a="abbrechen">Abbrechen</button>' : ''}
          </div>
        </div>
        <div class="szene-mitte">
          <canvas class="spielfeld"></canvas>
          <div class="szene-overlay versteckt"></div>
        </div>
        <div class="hud-unten">
          <div class="hud-phase"></div>
          <ul class="hud-log"></ul>
        </div>
        <div class="steuerung versteckt">
          <b>Steuerung</b>
          <table>
            <tr><td>W A S D / Pfeile</td><td>Hundeführer bewegen</td></tr>
            <tr><td>H</td><td>Handzeichen (Arm heben): Bereitschaft melden / Anzeige melden</td></tr>
            <tr><td>Leertaste</td><td>„Such!“ – erstes Schicken frei, jedes weitere = Hilfe</td></tr>
            <tr><td>Mausklick</td><td>Richtungszeichen (Führen, Punktabzug)</td></tr>
            <tr><td>R</td><td>„Hier!“ (Hilfe)</td></tr>
            <tr><td>B</td><td>„Bleib!“ während der Anzeige (Unterstützung, Abzug)</td></tr>
            <tr><td>E halten</td><td>Versteck anfassen (Eigengeruch, 3 s) / Antäuschen</td></tr>
            ${this.uebung ? '<tr><td>G</td><td>Geruchsansicht ein/aus (nur Übung)</td></tr>' : ''}
            <tr><td>P</td><td>Pause</td></tr>
          </table>
          <p><b>Den Hund lesen:</b> Schnelle, hohe Rute und kurze Kopfdrehungen = Hund ist im Geruch.
          Liegt der Hund und schaut immer wieder zu dir zurück, ist er unsicher – vielleicht eine Fehlanzeige.</p>
        </div>`;
      container.appendChild(root);
      this.root = root;
      this.canvas = root.querySelector('canvas');
      this.g = this.canvas.getContext('2d');
      this.el = {
        titel: root.querySelector('.hud-titel'), zeit: root.querySelector('.hud-zeit'),
        fa: root.querySelector('.hud-fa'), wind: root.querySelector('.hud-wind'),
        phase: root.querySelector('.hud-phase'), log: root.querySelector('.hud-log'),
        overlay: root.querySelector('.szene-overlay'), steuerung: root.querySelector('.steuerung'),
      };
      this.el.titel.textContent = this.opts.titel || `${po.DISZIPLINEN[this.lage.disziplin].name} – LK ${this.lage.lk}`;
      root.querySelector('.hud-knoepfe').addEventListener('click', (e) => {
        const a = e.target.dataset.a;
        if (a === 'geruch') this.toggleGeruch();
        if (a === 'pause') this.togglePause();
        if (a === 'hilfe') this.el.steuerung.classList.toggle('versteckt');
        if (a === 'abbrechen') this.beenden(true);
        e.target.blur();
      });
      this.groesseAnpassen();
      this.resizeObs = new ResizeObserver(() => this.groesseAnpassen());
      this.resizeObs.observe(root.querySelector('.szene-mitte'));
    }

    groesseAnpassen() {
      const box = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(320, box.width);
      const h = Math.max(240, box.height);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.dpr = dpr;
      // Ausrichtung wählen, die den Platz am besten nutzt (z. B. lange Fläche quer auf breiten Bildschirmen).
      const pad = 24;
      const welt = this.lage.welt;
      const skalaNormal = Math.min((w - 2 * pad) / welt.w, (h - 2 * pad) / welt.h);
      const skalaGedreht = Math.min((w - 2 * pad) / welt.h, (h - 2 * pad) / welt.w);
      this.rot = skalaGedreht > skalaNormal * 1.05;
      const vw = this.rot ? welt.h : welt.w;
      const vh = this.rot ? welt.w : welt.h;
      this.skala = this.rot ? skalaGedreht : skalaNormal;
      this.ox = (w - vw * this.skala) / 2;
      this.oy = (h - vh * this.skala) / 2;
      this.geruchCache = null;
    }

    // Welt (m) -> Bildschirm (px)
    w2s(x, y) {
      const vx = this.rot ? y : x;
      const vy = this.rot ? x : y;
      return [this.ox + vx * this.skala, this.oy + vy * this.skala];
    }

    s2w(px, py) {
      const vx = (px - this.ox) / this.skala;
      const vy = (py - this.oy) / this.skala;
      return this.rot ? [vy, vx] : [vx, vy];
    }

    winkel(w) {
      return this.rot ? Math.atan2(Math.cos(w), Math.sin(w)) : w;
    }

    bindeEingabe() {
      this.onKeyDown = (e) => {
        if (!this.laeuft) return;
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
        if (e.repeat) { this.tasten.add(k); return; }
        this.tasten.add(k);
        if (this.pause && k !== 'p') return;
        if (k === 'h') this.s.armHeben();
        if (k === ' ') this.s.befehlSuch();
        if (k === 'r') this.s.befehlHier();
        if (k === 'b') this.s.befehlBleib();
        if (k === 'g' && this.uebung) this.toggleGeruch();
        if (k === 'p') this.togglePause();
      };
      this.onKeyUp = (e) => {
        const k = e.key.toLowerCase();
        this.tasten.delete(k);
        if (k === 'e') this.s.anfassenEnde();
      };
      this.onClick = (e) => {
        if (!this.laeuft || this.pause) return;
        const r = this.canvas.getBoundingClientRect();
        const [x, y] = this.s2w(e.clientX - r.left, e.clientY - r.top);
        this.s.richtungsZeichen(x, y);
      };
      this.onBlur = () => this.tasten.clear();
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      this.canvas.addEventListener('click', this.onClick);
    }

    aufraeumen() {
      this.laeuft = false;
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      if (this.resizeObs) this.resizeObs.disconnect();
    }

    toggleGeruch() { this.geruchsAnsicht = !this.geruchsAnsicht; }
    togglePause() { this.pause = !this.pause; }

    eingabe(dt) {
      let sx = 0; let sy = 0;
      const t = this.tasten;
      if (t.has('w') || t.has('arrowup')) sy -= 1;
      if (t.has('s') || t.has('arrowdown')) sy += 1;
      if (t.has('a') || t.has('arrowleft')) sx -= 1;
      if (t.has('d') || t.has('arrowright')) sx += 1;
      if (sx || sy) {
        const [dx, dy] = this.rot ? [sy, sx] : [sx, sy];
        this.s.hfBewegen(dx, dy, dt);
      }
      if (t.has('e')) this.s.anfassen(dt);
    }

    frame(jetzt) {
      if (!this.laeuft) return;
      const dt = Math.min(0.05, (jetzt - this.letzteZeit) / 1000);
      this.letzteZeit = jetzt;
      if (!this.pause && this.s.phase !== 'ende') {
        this.eingabe(dt);
        this.s.update(dt);
      }
      if (this.wrArm > 0) this.wrArm -= dt;
      this.zeichne();
      this.hud();
      if (this.s.phase === 'ende' && !this.endeGezeigt) this.zeigeErgebnis();
      requestAnimationFrame(this.frame);
    }

    // ------------------------------------------------------------------ HUD
    hud() {
      const s = this.s;
      const rest = s.phase === 'vorbereitung' ? s.suchzeit : s.suchzeit - s.zeit;
      this.el.zeit.textContent = `⏱ ${fmtZeit(rest)}`;
      this.el.zeit.classList.toggle('knapp', s.phase === 'suche' && rest < 30);
      this.el.fa.textContent = `Fehlanzeigen ${s.richter.fehlanzeigen}/${po.FEHLANZEIGEN_BIS_ABBRUCH}`;
      const ws = this.lage.wind.staerke;
      this.el.wind.textContent = `Wind ${ws < 0.3 ? 'schwach' : ws < 0.6 ? 'mäßig' : 'frisch'}`;
      let phase;
      if (this.pause) phase = 'Pause – P zum Fortsetzen';
      else if (s.phase === 'vorbereitung') {
        phase = s.eigengeruchNoetig && !s.eigengeruchErledigt
          ? 'Vorbereitung: Eigengeruch am markierten Versteck anbringen (E 3 s halten), dann zurück zum Hund und H drücken.'
          : 'Vorbereitung: Zum Hund am Ansatz gehen und mit H die Bereitschaft melden. Antäuschen mit E ist erlaubt.';
        if (s.hf.anfassen > 0) phase += ` (Anfassen ${s.hf.anfassen.toFixed(1)} s)`;
      } else if (s.phase === 'suche') {
        if (s.warteZweitesZeichen) phase = 'LK 3: Neben den Hund gehen und erneut H drücken.';
        else if (s.meldung) phase = `Anzeige gemeldet – der WR beobachtet (${Math.max(0, s.meldung.rest).toFixed(1)} s)`;
        else if (s.hund.zustand === 'sitzt' || s.hund.zustand === 'beiHF') phase = 'Hund mit „Such!“ (Leertaste) schicken.';
        else phase = 'Suche läuft – lies deinen Hund. Bei Anzeige: H.';
      } else phase = 'Suchlage beendet.';
      this.el.phase.textContent = phase;

      while (this.nachrichtenGezeigt < s.nachrichten.length) {
        const n = s.nachrichten[this.nachrichtenGezeigt++];
        if (n.von === 'WR' && /^Erwidert/.test(n.text)) this.wrArm = 1.5;
        const li = document.createElement('li');
        li.className = n.von === 'WR' ? 'wr' : 'info';
        li.textContent = (n.von === 'WR' ? 'WR: ' : '') + n.text;
        this.el.log.prepend(li);
        while (this.el.log.children.length > 6) this.el.log.lastChild.remove();
      }
    }

    zeigeErgebnis() {
      this.endeGezeigt = true;
      const e = this.s.ergebnis;
      const o = this.el.overlay;
      let kopf;
      if (e.status === 'disq') kopf = '<h2>Disqualifikation</h2>';
      else if (e.status === 'abbruch') kopf = '<h2>Abbruch</h2>';
      else kopf = `<h2>${e.punkte} Punkte <small>${e.bestanden ? '– bestanden (≥ 70)' : '– nicht bestanden'}</small></h2>
        <p>Suchleistung <b>${e.such}</b>/60 · Anzeigeleistung <b>${e.anzeige}</b>/40${e.fehlanzeigen ? ` · Fehlanzeigen −${e.fehlanzeigen * 10}` : ''}</p>`;
      o.innerHTML = `<div class="ergebnis-karte">
        ${kopf}
        <h3>Begründung des Wertungsrichters</h3>
        <ul>${e.begruendung.filter(Boolean).map((z) => `<li>${z}</li>`).join('')}</ul>
        <p class="hinweis">Der gelbe Ring zeigt, wo der Gegenstand lag.</p>
        <button class="primaer" data-a="weiter">Weiter</button>
      </div>`;
      o.classList.remove('versteckt');
      o.querySelector('[data-a=weiter]').addEventListener('click', () => this.beenden(false));
    }

    beenden(abgebrochen) {
      if (!this.laeuft) return;
      this.aufraeumen();
      if (this.opts.onEnde) this.opts.onEnde(abgebrochen ? null : this.s.ergebnis, this);
    }

    // ------------------------------------------------------------------ Zeichnen
    zeichne() {
      const g = this.g;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const W = this.canvas.width / this.dpr; const H = this.canvas.height / this.dpr;
      g.fillStyle = FARBEN.grasDunkel;
      g.fillRect(0, 0, W, H);
      const welt = this.lage.welt;
      this.rechteck(0, 0, welt.w, welt.h, FARBEN.gras);
      const b = this.lage.bereich;
      this.rechteck(b.x, b.y, b.w, b.h, FARBEN.bereich);
      this.grasTextur();
      if (this.lage.mittelweg) {
        const m = this.lage.mittelweg;
        this.rechteck(m.x, m.y, m.w, m.h, FARBEN.mittelweg);
      }
      this.rahmen(b.x, b.y, b.w, b.h, FARBEN.band, 2);
      if (this.geruchsAnsicht) this.zeichneGeruch();
      this.zeichneAnsatz();
      this.zeichneVerstecke();
      this.zeichneQuellen();
      this.zeichneReize();
      this.zeichneWR();
      this.zeichneLeine();
      this.zeichneHund();
      this.zeichneHF();
      this.zeichneWind(W);
      if (this.pause) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#fff'; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText('Pause', W / 2, H / 2);
      }
    }

    rechteck(x, y, w, h, farbe) {
      const [ax, ay] = this.w2s(x, y); const [bx, by] = this.w2s(x + w, y + h);
      this.g.fillStyle = farbe;
      this.g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }

    rahmen(x, y, w, h, farbe, lw) {
      const [ax, ay] = this.w2s(x, y); const [bx, by] = this.w2s(x + w, y + h);
      this.g.strokeStyle = farbe; this.g.lineWidth = lw;
      this.g.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }

    grasTextur() {
      if (!this.grasPunkte) {
        const r = SHS.rng(this.lage.seed + 3);
        this.grasPunkte = [];
        const n = Math.round(this.lage.welt.w * this.lage.welt.h * 6);
        for (let i = 0; i < n; i++) this.grasPunkte.push([r() * this.lage.welt.w, r() * this.lage.welt.h, r()]);
      }
      const g = this.g;
      for (const [x, y, v] of this.grasPunkte) {
        const [px, py] = this.w2s(x, y);
        g.fillStyle = v < 0.5 ? 'rgba(30,60,20,0.18)' : 'rgba(170,210,120,0.15)';
        g.fillRect(px, py, 2, 2);
      }
    }

    kreis(x, y, rM, farbe, rand) {
      const [px, py] = this.w2s(x, y);
      const g = this.g;
      g.beginPath(); g.arc(px, py, Math.max(1, rM * this.skala), 0, Math.PI * 2);
      if (farbe) { g.fillStyle = farbe; g.fill(); }
      if (rand) { g.strokeStyle = rand; g.lineWidth = 1.5; g.stroke(); }
    }

    text(t, x, y, farbe, groesse, align) {
      const [px, py] = this.w2s(x, y);
      const g = this.g;
      g.font = `${groesse || 11}px system-ui, sans-serif`;
      g.textAlign = align || 'center';
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillText(t, px + 1, py + 1);
      g.fillStyle = farbe || '#fff';
      g.fillText(t, px, py);
    }

    zeichneAnsatz() {
      for (const a of this.lage.ansatzOptionen) {
        const aktiv = a === this.s.ansatz;
        this.kreis(a.x, a.y, 0.22, aktiv ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)', aktiv ? '#fff' : null);
      }
      this.text('Ansatz', this.s.ansatz.x, this.s.ansatz.y - 0.35, '#fff', 10);
    }

    zeichneVerstecke() {
      const g = this.g;
      const s = this.s;
      const zeigeEG = s.phase === 'vorbereitung' && s.eigengeruchNoetig && !s.eigengeruchErledigt;
      const t = performance.now() / 1000;
      for (const v of this.lage.verstecke) {
        if (this.lage.disziplin === 'behaeltnis') {
          if (v.form === 'eckig') {
            const [px, py] = this.w2s(v.x, v.y);
            const r = v.r * this.skala;
            g.fillStyle = '#7d5a3c'; g.fillRect(px - r, py - r * 0.75, r * 2, r * 1.5);
            g.strokeStyle = '#4a3422'; g.lineWidth = 1.5; g.strokeRect(px - r, py - r * 0.75, r * 2, r * 1.5);
          } else {
            this.kreis(v.x, v.y, v.r, FARBEN.eimer, FARBEN.eimerRand);
            this.kreis(v.x, v.y, v.r * 0.75, null, '#c4cbd3');
          }
          for (const k of v.kammern) this.kreis(k.x, k.y, 0.035, FARBEN.kammer);
          if (this.lage.lk === 3 && this.skala > 28) {
            const idx = this.lage.verstecke.indexOf(v);
            const dy = idx % 2 ? v.r + 0.3 : -(v.r + 0.18);
            this.text(v.typ, v.x + (this.rot ? dy : 0), v.y + (this.rot ? 0 : dy), 'rgba(255,255,255,0.85)', 9);
          }
        } else {
          const [px, py] = this.w2s(v.x, v.y);
          g.save();
          g.translate(px, py);
          g.rotate(this.rot ? Math.PI / 2 - v.rot : v.rot);
          const w = v.w * this.skala; const h = v.h * this.skala;
          if (v.hoehe > 0) {
            g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
          }
          g.fillStyle = FARBEN.truemmer[Math.abs(this.hashTyp(v.typ)) % FARBEN.truemmer.length];
          g.fillRect(-w / 2, -h / 2, w, h);
          g.strokeStyle = v.hoehe > 0 ? '#f0e6c8' : 'rgba(0,0,0,0.4)';
          g.lineWidth = v.hoehe > 0 ? 2 : 1;
          g.strokeRect(-w / 2, -h / 2, w, h);
          g.restore();
        }
        if (zeigeEG && v.id === this.lage.eigengeruchVersteck) {
          const r = 0.45 + Math.sin(t * 4) * 0.05;
          this.kreis(v.x, v.y, r, null, '#ff7bd5');
          this.text('Eigengeruch hier', v.x, v.y - 0.55, '#ff9be0', 11);
        }
      }
    }

    hashTyp(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

    zeichneQuellen() {
      for (const q of this.s.quellen) {
        if (q.typ === 'spielzeug') {
          this.kreis(q.x, q.y, 0.07, FARBEN.spielzeug, '#7a1010');
        } else if (q.typ === 'futter') {
          const [px, py] = this.w2s(q.x, q.y);
          this.g.fillStyle = FARBEN.futter;
          this.g.fillRect(px - 0.08 * this.skala, py - 0.05 * this.skala, 0.16 * this.skala, 0.1 * this.skala);
        }
      }
      // Auflösung nach dem Ende bzw. in der Übung mit Geruchsansicht
      const zeigen = this.s.phase === 'ende' || (this.uebung && this.geruchsAnsicht);
      if (!zeigen) return;
      for (const q of this.s.quellen) {
        if (q.typ === 'ziel') { this.kreis(q.x, q.y, 0.18, null, FARBEN.ziel); this.kreis(q.x, q.y, 0.05, FARBEN.ziel); }
        if (q.typ === 'differenzierung') this.kreis(q.x, q.y, 0.16, null, FARBEN.diff);
      }
    }

    zeichneGeruch() {
      const s = this.s;
      if (!this.geruchCache || s.t - this.geruchCacheZeit > 0.25) {
        const W = this.canvas.width / this.dpr; const H = this.canvas.height / this.dpr;
        const zelle = 6;
        const cw = Math.ceil(W / zelle); const ch = Math.ceil(H / zelle);
        const off = this.geruchCache || document.createElement('canvas');
        off.width = cw; off.height = ch;
        const og = off.getContext('2d');
        const img = og.createImageData(cw, ch);
        for (let j = 0; j < ch; j++) {
          for (let i = 0; i < cw; i++) {
            const [x, y] = this.s2w(i * zelle + zelle / 2, j * zelle + zelle / 2);
            let ziel = 0; let verl = 0; let andere = 0;
            for (const q of s.quellen) {
              const c = SHS.scent.konzentration(q, x, y, this.lage.wind, s.t);
              if (q.typ === 'ziel') ziel += c;
              else if (q.typ === 'spielzeug' || q.typ === 'futter') verl += c;
              else andere += c;
            }
            const o = (j * cw + i) * 4;
            const a = Math.min(1, ziel * 1.4 + verl * 0.9 + andere * 1.2);
            img.data[o] = Math.min(255, 255 * (verl * 1.2 + andere * 0.8));
            img.data[o + 1] = Math.min(255, 120 * ziel + 60 * andere);
            img.data[o + 2] = Math.min(255, 255 * ziel * 1.5 + andere * 200);
            img.data[o + 3] = Math.round(a * 170);
          }
        }
        og.putImageData(img, 0, 0);
        this.geruchCache = off;
        this.geruchCacheZeit = s.t;
      }
      const g = this.g;
      const [ax, ay] = this.w2s(0, 0);
      const [bx, by] = this.w2s(this.lage.welt.w, this.lage.welt.h);
      g.save();
      g.beginPath();
      g.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(this.geruchCache, 0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
      g.restore();
    }

    zeichneReize() {
      for (const r of this.s.reize) {
        const x = Math.max(0.3, Math.min(this.lage.welt.w - 0.3, r.x));
        const y = Math.max(0.3, Math.min(this.lage.welt.h - 0.3, r.y));
        this.text('❗ ' + r.art, x, y, '#ffe680', 12);
      }
    }

    zeichneWR() {
      const x = 0.45; const y = this.lage.welt.h - 0.55;
      this.kreis(x, y, 0.22, FARBEN.wr, '#fff');
      this.text('WR', x, y + 0.5, '#fff', 10);
      if (this.wrArm > 0) {
        const [px, py] = this.w2s(x, y);
        this.g.strokeStyle = '#fff'; this.g.lineWidth = 3;
        this.g.beginPath(); this.g.moveTo(px + 6, py); this.g.lineTo(px + 10, py - 0.6 * this.skala); this.g.stroke();
        this.kreis(x + (this.rot ? -0.6 : 0.2), y + (this.rot ? 0.2 : -0.6), 0.07, '#ffd9b3');
      }
    }

    zeichneLeine() {
      const s = this.s; const h = s.hund;
      if (!(s.leine || s.schleppleine)) return;
      const [ax, ay] = this.w2s(s.hf.x, s.hf.y);
      const [bx, by] = this.w2s(h.x, h.y);
      const g = this.g;
      g.strokeStyle = s.schleppleine ? 'rgba(250,120,40,0.8)' : 'rgba(30,30,30,0.85)';
      g.lineWidth = 1.5;
      g.beginPath();
      if (s.schleppleine) {
        // Schleppleine hängt hinter dem Hund (nicht in der Hand)
        const w = h.richtung + Math.PI;
        const [cx, cy] = this.w2s(h.x + Math.cos(w) * 2.5, h.y + Math.sin(w) * 2.5);
        g.moveTo(bx, by); g.quadraticCurveTo((bx + cx) / 2 + 6, (by + cy) / 2 + 6, cx, cy);
      } else {
        const d = Math.hypot(bx - ax, by - ay); const durchhang = Math.max(0, 2 * this.skala - d) * 0.4;
        g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + durchhang, bx, by);
      }
      g.stroke();
    }

    zeichneHund() {
      const h = this.s.hund;
      const g = this.g;
      const [px, py] = this.w2s(h.x, h.y);
      const sk = this.skala;
      const t = performance.now() / 1000;
      let w = this.winkel(h.richtung);
      if (h.kopfschlag > 0) w += Math.sin(t * 40) * 0.25;
      const farbe = this.opts.hund.farbe || '#8a6a50';
      g.save();
      g.translate(px, py);
      g.rotate(w);
      const laenge = (h.liegt ? 0.55 : 0.62) * sk;
      const breite = (h.liegt ? 0.3 : 0.24) * sk;
      // Schatten
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(3, 3, laenge / 2, breite / 2, 0, 0, Math.PI * 2); g.fill();
      // Rute
      const freq = 2 + h.rute * 12;
      const ausschlag = (h.ruteHoch ? 0.6 : 0.25) * (0.3 + h.rute);
      const rw = Math.PI + Math.sin(t * freq) * ausschlag;
      g.strokeStyle = farbe; g.lineWidth = Math.max(2, 0.05 * sk); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-laenge / 2, 0);
      g.lineTo(-laenge / 2 + Math.cos(rw) * 0.28 * sk * (h.ruteHoch ? 1 : 0.8), Math.sin(rw) * 0.28 * sk);
      g.stroke();
      // Beine (liegend: Vorderpfoten nach vorn)
      if (h.liegt) {
        g.fillStyle = farbe;
        g.fillRect(laenge / 2 - 0.02 * sk, -breite / 2 + 0.02 * sk, 0.16 * sk, 0.06 * sk);
        g.fillRect(laenge / 2 - 0.02 * sk, breite / 2 - 0.08 * sk, 0.16 * sk, 0.06 * sk);
      }
      // Körper
      g.fillStyle = farbe;
      g.beginPath(); g.ellipse(0, 0, laenge / 2, breite / 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
      // Kopf: dreht sich zum HF, wenn der Hund zurückschaut
      let kopfW = 0;
      if (h.blickZuHF > 0) {
        const hfW = Math.atan2(this.s.hf.y - h.y, this.s.hf.x - h.x);
        kopfW = this.winkel(hfW) - w;
        while (kopfW > Math.PI) kopfW -= 2 * Math.PI;
        while (kopfW < -Math.PI) kopfW += 2 * Math.PI;
        kopfW = Math.max(-1.6, Math.min(1.6, kopfW));
      } else if (h.zustand === 'geruch') kopfW = Math.sin(t * 9) * 0.35;
      else if (h.zustand === 'sucht') kopfW = Math.sin(t * 2.5) * 0.25;
      const hals = laenge / 2;
      g.translate(hals, 0);
      g.rotate(kopfW);
      const kopfR = 0.11 * sk;
      g.fillStyle = farbe;
      g.beginPath(); g.ellipse(kopfR * 0.6, 0, kopfR * 1.25, kopfR, 0, 0, Math.PI * 2); g.fill();
      g.stroke();
      // Ohren
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(kopfR * 0.2, -kopfR * 0.9, kopfR * 0.5, kopfR * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(kopfR * 0.2, kopfR * 0.9, kopfR * 0.5, kopfR * 0.3, 0, 0, Math.PI * 2); g.fill();
      // Nase: tief = dunkel/groß
      g.fillStyle = h.naseTief ? '#111' : '#444';
      g.beginPath(); g.arc(kopfR * 1.8, 0, kopfR * (h.naseTief ? 0.35 : 0.25), 0, Math.PI * 2); g.fill();
      g.restore();

      // Aktive Anzeige / Verleitung sichtbar machen
      if (h.aktivAnim && Math.sin(t * 6) > 0) {
        this.text(h.zustand === 'verleitung' ? '*schnapp*' : 'Wuff! *scharr*', h.x, h.y - 0.5, '#ffe0e0', 12);
      }
      if (h.zustand === 'geruch' && this.uebung && this.geruchsAnsicht) this.text('im Geruch', h.x, h.y + 0.5, '#bfe3ff', 10);
    }

    zeichneHF() {
      const hf = this.s.hf;
      const g = this.g;
      const [px, py] = this.w2s(hf.x, hf.y);
      const sk = this.skala;
      const w = this.winkel(hf.richtung || 0);
      g.save();
      g.translate(px, py);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(3, 3, 0.25 * sk, 0.25 * sk, 0, 0, Math.PI * 2); g.fill();
      g.rotate(w);
      g.fillStyle = FARBEN.hf;
      g.beginPath(); g.ellipse(0, 0, 0.16 * sk, 0.27 * sk, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1b3a5a'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#f0c9a0';
      g.beginPath(); g.arc(0.02 * sk, 0, 0.11 * sk, 0, Math.PI * 2); g.fill();
      g.restore();
      if (hf.arm) {
        g.strokeStyle = '#f0c9a0'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(px + 0.12 * sk, py); g.lineTo(px + 0.2 * sk, py - 0.55 * sk); g.stroke();
        g.fillStyle = '#f0c9a0';
        g.beginPath(); g.arc(px + 0.2 * sk, py - 0.58 * sk, 0.06 * sk, 0, Math.PI * 2); g.fill();
      }
      if (hf.anfassen > 0) {
        const a = Math.min(1, hf.anfassen / 3);
        g.strokeStyle = '#ff7bd5'; g.lineWidth = 3;
        g.beginPath(); g.arc(px, py, 0.35 * sk, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2); g.stroke();
      }
    }

    zeichneWind(W) {
      const g = this.g;
      const w = this.lage.wind;
      const cx = W - 46; const cy = 46;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
      const a = this.winkel(Math.atan2(w.y, w.x));
      g.save(); g.translate(cx, cy); g.rotate(a);
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 3;
      const l = 10 + w.staerke * 14;
      g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
      g.beginPath(); g.moveTo(l + 6, 0); g.lineTo(l - 4, -6); g.lineTo(l - 4, 6); g.closePath(); g.fill();
      g.restore();
      g.font = '10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('Wind', cx, cy + 44);
    }
  }

  SHS.SuchSzene = SuchSzene;
})(globalThis.SHS = globalThis.SHS || {});
