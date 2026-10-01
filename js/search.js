// Spielbare Suchlage: Canvas-Darstellung (2D von oben), Tastatur/Maus, HUD.
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const FARBEN = {
    gras: '#5f8f3e', grasDunkel: '#4d7832', bereich: '#6c9c47', band: '#f4f1e8', mittelweg: '#d8c49a',
    eimer: '#e8e8e8', eimerRand: '#9aa3ad', kammer: '#33414f',
    hf: '#2f5d8c', wr: '#7a2f2f', spielzeug: '#d93a3a', futter: '#8a5a2b', ziel: '#ffd23f', diff: '#3fc7ff',
  };

  const fmtZeit = (s) => {
    const v = Math.max(0, Math.ceil(s));
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  };

  class SuchSzene {
    // opts wie SuchLage + { modus: 'uebung'|'pruefung', titel, onEnde(ergebnis, szene),
    //   auto: HF wird automatisch geführt, hfErfahrung (0..1) }
    constructor(container, opts) {
      this.opts = opts;
      this.s = new SHS.SuchLage(opts);
      this.auto = !!opts.auto;
      this.bot = this.auto ? new SHS.HFBot(this.s, opts.hfErfahrung ?? 0.5, SHS.rng((opts.seed * 7 + 13) >>> 0)) : null;
      this.zeitraffer = 1;
      this.lage = this.s.lage;
      this.rot = false; // wird in groesseAnpassen() passend zur Bildschirmform gesetzt
      this.uebung = opts.modus === 'uebung';
      this.geruchsAnsicht = false;
      this.nahAn = true; // Nahaufnahme der Anzeige (Taste N)
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
            ${this.auto ? '<button data-a="tempo" title="Zeitraffer (T)">Tempo 1×</button>' : ''}
            <button data-a="pause" title="Pause (P)">Pause</button>
            <button data-a="hilfe">Steuerung</button>
            <button data-a="touch" title="Bildschirm-Steuerung für Tablet/Handy ein/aus">Touch</button>
            <button data-a="ton" title="Töne ein/aus (M)">${SHS.ton.istAn() ? '🔊' : '🔇'}</button>
            ${this.uebung ? '<button data-a="abbrechen">Abbrechen</button>' : ''}
          </div>
        </div>
        <div class="szene-mitte">
          <canvas class="spielfeld"></canvas>
          <div class="nahaufnahme versteckt"><div class="nah-titel">Nahaufnahme – Anzeige</div><canvas></canvas></div>
          <div class="szene-overlay versteckt"></div>
          <div class="coach coach-suche versteckt"><div class="coach-titel"></div><div class="coach-text"></div></div>
          <div class="touch versteckt">
            <div class="touch-stick"><div class="touch-knopf"></div></div>
            <div class="touch-tasten">
              <button data-t="such">Such!</button>
              <button data-t="arm" class="touch-gross">✋ Arm</button>
              <button data-t="hier">Hier!</button>
              <button data-t="bleib">Bleib!</button>
              <button data-t="anfassen">Anfassen</button>
              <button data-t="nah">Nah</button>
            </div>
          </div>
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
            <tr><td>N</td><td>Nahaufnahme der Anzeige ein/aus</td></tr>
            <tr><td>M</td><td>Töne ein/aus</td></tr>
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
        coach: root.querySelector('.coach-suche'),
        nah: root.querySelector('.nahaufnahme'), nahCanvas: root.querySelector('.nahaufnahme canvas'),
        overlay: root.querySelector('.szene-overlay'), steuerung: root.querySelector('.steuerung'),
      };
      this.el.titel.textContent = this.opts.titel || `${po.DISZIPLINEN[this.lage.disziplin].name} – LK ${this.lage.lk}`;
      root.querySelector('.hud-knoepfe').addEventListener('click', (e) => {
        const a = e.target.dataset.a;
        if (a === 'geruch') this.toggleGeruch();
        if (a === 'pause') this.togglePause();
        if (a === 'hilfe') this.el.steuerung.classList.toggle('versteckt');
        if (a === 'abbrechen') this.beenden(true);
        if (a === 'tempo') this.toggleTempo();
        if (a === 'touch') this.setzeTouch(!this.touchAn);
        if (a === 'ton') this.toggleTon();
        SHS.ton.bereit();
        e.target.blur();
      });
      this.groesseAnpassen();
      this.touchEinrichten();
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
        SHS.ton.bereit(); // Audio darf erst nach einer Nutzeraktion starten
        if (k === 'm') this.toggleTon();
        if (this.pause && k !== 'p') return;
        if (k === 'p') this.togglePause();
        if (k === 'n') this.nahAn = !this.nahAn;
        if (k === 'g' && this.uebung) this.toggleGeruch();
        if (this.auto) { if (k === 't') this.toggleTempo(); return; } // automatische Vorführung: keine Befehle
        if (k === 'h') this.s.armHeben();
        if (k === ' ') this.s.befehlSuch();
        if (k === 'r') this.s.befehlHier();
        if (k === 'b') this.s.befehlBleib();
      };
      this.onKeyUp = (e) => {
        const k = e.key.toLowerCase();
        this.tasten.delete(k);
        if (k === 'e') this.s.anfassenEnde();
      };
      this.onClick = (e) => {
        if (!this.laeuft || this.pause || this.auto) return;
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
      if (SHS.ton.istAn()) SHS.ton.stilleDauer();
      if (this.nachbetrachtungsSzene) this.nachbetrachtungsSzene.aufraeumen();
      this.laeuft = false;
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      if (this.resizeObs) this.resizeObs.disconnect();
    }

    // ---------------------------------------------------------------- Touch-Steuerung
    // Steuerkreis links (HF bewegen), Tasten rechts. Automatisch auf Touch-Geräten, sonst über „Touch“.
    touchEinrichten() {
      const box = this.root.querySelector('.touch');
      this.el.touch = box;
      let gespeichert = null;
      try { gespeichert = localStorage.getItem('shs-game-touch'); } catch (e) { /* ignorieren */ }
      const grob = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      this.setzeTouch(gespeichert === null ? grob : gespeichert === '1', true);
      const stick = box.querySelector('.touch-stick');
      const knopf = box.querySelector('.touch-knopf');
      const bewegen = (ev) => {
        const r = stick.getBoundingClientRect();
        const max = r.width / 2;
        let dx = ev.clientX - (r.left + max); let dy = ev.clientY - (r.top + max);
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        knopf.style.transform = `translate(${dx}px, ${dy}px)`;
        const st = Math.hypot(dx, dy) / max;
        this.joy = st < 0.15 ? null : { x: dx / max, y: dy / max };
      };
      let gefasst = false;
      const loslassen = () => { gefasst = false; this.joy = null; knopf.style.transform = ''; };
      stick.addEventListener('pointerdown', (ev) => {
        gefasst = true;
        try { stick.setPointerCapture(ev.pointerId); } catch (e) { /* ältere Browser */ }
        bewegen(ev); ev.preventDefault();
      });
      stick.addEventListener('pointermove', (ev) => { if (gefasst) bewegen(ev); });
      stick.addEventListener('pointerup', loslassen);
      stick.addEventListener('pointercancel', loslassen);
      const tasten = box.querySelector('.touch-tasten');
      tasten.addEventListener('pointerdown', (ev) => {
        const t = ev.target.closest('[data-t]');
        if (!t || !this.laeuft) return;
        SHS.ton.bereit();
        ev.preventDefault();
        if (t.dataset.t === 'nah') { this.nahAn = !this.nahAn; return; }
        if (this.auto || this.pause) return;
        if (t.dataset.t === 'such') this.s.befehlSuch();
        if (t.dataset.t === 'arm') this.s.armHeben();
        if (t.dataset.t === 'hier') this.s.befehlHier();
        if (t.dataset.t === 'bleib') this.s.befehlBleib();
        if (t.dataset.t === 'anfassen') { this.tasten.add('e'); t.classList.add('gedrueckt'); }
      });
      const ende = (ev) => {
        const t = ev.target.closest('[data-t=anfassen]');
        if (t) { this.tasten.delete('e'); this.s.anfassenEnde(); t.classList.remove('gedrueckt'); }
      };
      tasten.addEventListener('pointerup', ende);
      tasten.addEventListener('pointercancel', ende);
      tasten.addEventListener('pointerleave', ende);
    }

    setzeTouch(an, ohneSpeichern) {
      this.touchAn = !!an;
      if (this.el.touch) this.el.touch.classList.toggle('versteckt', !this.touchAn);
      this.root.classList.toggle('mit-touch', this.touchAn);
      if (this.auto && this.el.touch) this.el.touch.classList.add('nur-ansicht');
      if (!ohneSpeichern) { try { localStorage.setItem('shs-game-touch', this.touchAn ? '1' : '0'); } catch (e) { /* ignorieren */ } }
    }

    toggleTon() {
      SHS.ton.setzeAn(!SHS.ton.istAn());
      const b = this.root.querySelector('[data-a=ton]');
      if (b) b.textContent = SHS.ton.istAn() ? '🔊' : '🔇';
    }

    // Klang zu einer Meldung der Suchlage
    tonZuMeldung(n) {
      const t = n.text;
      let k = null;
      if (/„Such!“/.test(t)) k = 'such';
      else if (/„Hier!“/.test(t)) k = 'hier';
      else if (/„Bleib!“/.test(t)) k = 'bleib';
      else if (/meldet die Anzeige|Zweites Handzeichen/.test(t)) k = 'arm';
      else if (/^Erwidert – Fund/.test(t)) k = 'fund';
      else if (/^Erwidert/.test(t)) k = 'erwidert';
      else if (/^Fehlanzeige|Abbruch|nicht verlassen|reagiert nicht/.test(t)) k = 'fehler';
      else if (/^Außenreiz/.test(t)) {
        k = /Vogel/.test(t) ? 'vogel' : /bellt/.test(t) ? 'fernbellen' : /Klingel/.test(t) ? 'klingel' : /klatscht/.test(t) ? 'klatschen' : 'knacken';
      }
      if (k) SHS.ton.spiele(k);
    }

    // Hecheln (je nach Tempo und Zustand), Wind und Bellen bei aktiver Anzeige
    toene(dt) {
      if (!SHS.ton.istAn() || this.pause || this.s.phase === 'ende') { SHS.ton.stilleDauer && this.tonLief && SHS.ton.stilleDauer(); this.tonLief = false; return; }
      const h = this.s.hund;
      let hecheln = 0;
      if (['sucht', 'geruch', 'verleitung', 'entlaufen', 'hier'].includes(h.zustand)) hecheln = 0.35 + Math.min(1, h.v / 1.6) * 0.65;
      else if (h.zustand === 'anzeige' || h.zustand === 'beiHF' || h.zustand === 'sitzt') hecheln = this.s.phase === 'suche' ? 0.25 : 0.1;
      SHS.ton.dauerton('hecheln', hecheln);
      SHS.ton.dauerton('wind', this.lage.wind.staerke);
      this.tonLief = true;
      this.bellTimer = (this.bellTimer || 0) - dt;
      if (h.aktivAnim && h.zustand === 'anzeige' && this.bellTimer <= 0) { SHS.ton.spiele('bellen'); this.bellTimer = 1.4; }
    }

    toggleGeruch() { this.geruchsAnsicht = !this.geruchsAnsicht; }
    togglePause() { this.pause = !this.pause; }
    toggleTempo() {
      this.zeitraffer = this.zeitraffer === 1 ? 2 : this.zeitraffer === 2 ? 4 : 1;
      const b = this.root.querySelector('[data-a=tempo]');
      if (b) b.textContent = `Tempo ${this.zeitraffer}×`;
    }

    eingabe(dt) {
      let sx = 0; let sy = 0;
      if (this.joy) { sx = this.joy.x; sy = this.joy.y; }
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
        if (this.auto) {
          for (let i = 0; i < this.zeitraffer && this.s.phase !== 'ende'; i++) { this.bot.update(dt); this.s.update(dt); }
        } else {
          this.eingabe(dt);
          this.s.update(dt);
        }
      }
      if (this.wrArm > 0) this.wrArm -= dt;
      if (this.opts.tutor) this.coach(dt);
      this.toene(dt);
      this.zeichne();
      this.hud();
      if (this.s.phase === 'ende' && !this.endeGezeigt) this.zeigeErgebnis();
      requestAnimationFrame(this.frame);
    }

    // Einführung: Coach-Hinweis passend zum Stand der Suche
    coach(dt) {
      const info = this.opts.tutor.update(this, this.pause ? 0 : dt);
      const schluessel = info ? info.titel + info.text : '';
      if (schluessel === this.coachZuletzt) return;
      this.coachZuletzt = schluessel;
      this.el.coach.classList.toggle('versteckt', !info);
      if (!info) return;
      this.el.coach.querySelector('.coach-titel').innerHTML = info.titel;
      this.el.coach.querySelector('.coach-text').innerHTML = info.text;
    }

    // ------------------------------------------------------------------ HUD
    hud() {
      const s = this.s;
      const rest = s.phase === 'vorbereitung' ? s.suchzeit : s.suchzeit - s.zeit;
      this.el.zeit.textContent = `⏱ ${fmtZeit(rest)}`;
      this.el.zeit.classList.toggle('knapp', s.phase === 'suche' && rest < 30);
      this.el.fa.textContent = `Fehlanzeigen ${s.richter.fehlanzeigen}/${po.FEHLANZEIGEN_BIS_ABBRUCH}`;
      const ws = this.lage.wind.staerke;
      const wt = this.s.wetter;
      this.el.wind.textContent = `${wt ? `${wt.symbol} ${wt.temp} °C · ` : ''}Wind ${ws < 0.3 ? 'schwach' : ws < 0.6 ? 'mäßig' : 'frisch'}${wt && wt.drift > 0.45 ? ', drehend' : ''}`;
      if (wt && wt.hinweis) this.el.wind.title = wt.hinweis;
      let phase;
      const mittelwegHinweis = this.lage.mittelweg ? ' Hinweis: Der Hundeführer darf sich nur auf dem Mittelweg bewegen.' : '';
      if (this.pause) phase = 'Pause – P zum Fortsetzen';
      else if (this.auto && s.phase !== 'ende') phase = `Automatische Vorführung (HF-Erfahrung ${Math.round(this.bot.erfahrung * 100)} %) – Tempo mit T, Pause mit P.${mittelwegHinweis}`;
      else if (s.phase === 'vorbereitung') {
        phase = s.eigengeruchNoetig && !s.eigengeruchErledigt
          ? 'Vorbereitung: Eigengeruch am markierten Versteck anbringen (E 3 s halten), dann zurück zum Hund und H drücken.'
          : 'Vorbereitung: Zum Hund am Ansatz gehen und mit H die Bereitschaft melden. Antäuschen mit E ist erlaubt.';
        if (s.hf.anfassen > 0) phase += ` (Anfassen ${s.hf.anfassen.toFixed(1)} s)`;
      } else if (s.phase === 'suche') {
        if (s.warteZweitesZeichen) phase = this.lage.mittelweg ? 'LK 3: Auf dem Mittelweg auf Höhe des Hundes gehen und erneut H drücken.' : 'LK 3: Neben den Hund gehen und erneut H drücken.';
        else if (s.meldung) phase = `Anzeige gemeldet – der WR beobachtet (${Math.max(0, s.meldung.rest).toFixed(1)} s)`;
        else if (s.hund.zustand === 'sitzt' || s.hund.zustand === 'beiHF') phase = 'Hund mit „Such!“ (Leertaste) schicken.';
        else phase = 'Suche läuft – lies deinen Hund. Bei Anzeige: H.' + mittelwegHinweis;
      } else phase = 'Suchlage beendet.';
      if (!this.auto && s.phase === 'vorbereitung') phase += mittelwegHinweis;
      this.el.phase.textContent = phase;

      while (this.nachrichtenGezeigt < s.nachrichten.length) {
        const n = s.nachrichten[this.nachrichtenGezeigt++];
        if (n.von === 'WR' && /^Erwidert/.test(n.text)) this.wrArm = 1.5;
        this.tonZuMeldung(n);
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
        <div class="knopfreihe"><button data-a="nachbetrachtung">Nachbetrachtung ansehen</button>
        <button class="primaer" data-a="weiter">Weiter</button></div>
      </div>`;
      o.classList.remove('versteckt');
      o.querySelector('[data-a=weiter]').addEventListener('click', () => this.beenden(false));
      o.querySelector('[data-a=nachbetrachtung]').addEventListener('click', () => this.nachbetrachtung());
    }

    // Suche nochmal abspielen; "Weiter" führt danach wie gewohnt zum Ablauf zurück.
    nachbetrachtung() {
      const container = this.root.parentElement;
      this.aufraeumen();
      const nb = new SHS.nachbetrachtung.Nachbetrachtung(container, SHS.nachbetrachtung.daten(this.s), {
        weiterText: 'Weiter',
        onEnde: () => { if (this.opts.onEnde) this.opts.onEnde(this.s.ergebnis, this); },
      });
      this.nachbetrachtungsSzene = nb;
    }

    beenden(abgebrochen) {
      if (!this.laeuft) return;
      this.aufraeumen();
      if (this.opts.onEnde) this.opts.onEnde(abgebrochen ? null : this.s.ergebnis, this);
    }

    // ------------------------------------------------------------------ Zeichnen
    zeichne() {
      const g = this.g;
      const W = this.canvas.width / this.dpr; const H = this.canvas.height / this.dpr;
      // Unveränderlicher Hintergrund (Gras, Kies, Mittelweg, Band) einmal vorzeichnen – entlastet Tablets/Handys
      const schluessel = `${this.canvas.width}x${this.canvas.height}:${this.rot}:${this.skala}`;
      if (!this.hgCache || this.hgSchluessel !== schluessel) {
        const c = this.hgCache || document.createElement('canvas');
        c.width = this.canvas.width; c.height = this.canvas.height;
        const echt = this.g;
        this.g = c.getContext('2d');
        this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.zeichneHintergrund(W, H);
        this.g = echt;
        this.hgCache = c; this.hgSchluessel = schluessel;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.hgCache, 0, 0);
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const b = this.lage.bereich;
      this.zeichneVordergrund(W, H, b);
    }

    zeichneHintergrund(W, H) {
      const g = this.g;
      g.fillStyle = FARBEN.grasDunkel;
      g.fillRect(0, 0, W, H);
      const welt = this.lage.welt;
      this.rechteck(0, 0, welt.w, welt.h, FARBEN.gras);
      const b = this.lage.bereich;
      this.rechteck(b.x, b.y, b.w, b.h, FARBEN.bereich);
      this.grasTextur();
      if (this.lage.disziplin === 'truemmer') this.kiesboden();
      if (this.lage.mittelweg) {
        const m = this.lage.mittelweg;
        this.rechteck(m.x, m.y, m.w, m.h, FARBEN.mittelweg);
        // Markierung (Sägemehl/Kreide) – der HF darf den Mittelweg nicht verlassen
        const g2 = this.g;
        g2.save(); g2.setLineDash([6, 4]); g2.strokeStyle = 'rgba(255,255,255,0.9)'; g2.lineWidth = 2;
        for (const x of [m.x, m.x + m.w]) {
          const [ax, ay] = this.w2s(x, m.y); const [bx, by] = this.w2s(x, m.y + m.h);
          g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(bx, by); g2.stroke();
        }
        g2.restore();
      }
      this.rahmen(b.x, b.y, b.w, b.h, FARBEN.band, 2);
    }

    zeichneVordergrund(W, H) {
      const g = this.g;
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
      this.zeichneRegen(W, H);
      this.zeichneNahaufnahme();
      if (this.pause) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#fff'; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText('Pause', W / 2, H / 2);
      }
    }

    // Regen: schräge Striche, die mit dem Wind ziehen
    zeichneRegen(W, H) {
      const wt = this.s.wetter;
      if (!wt || !wt.regen) return;
      const g = this.g;
      const t = performance.now() / 1000;
      const n = wt.regen === 2 ? 140 : 55;
      const wind = this.lage.wind;
      const [wx, wy] = this.rot ? [wind.y, wind.x] : [wind.x, wind.y];
      g.save();
      g.fillStyle = wt.regen === 2 ? 'rgba(40,50,70,0.18)' : 'rgba(60,70,90,0.08)';
      g.fillRect(0, 0, W, H);
      if (wt.schnee) {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < n; i++) {
          const x = ((i * 137.5 + t * 25 * (1 + wx * wind.staerke) + Math.sin(t + i) * 8) % (W + 20)) - 10;
          const y = ((i * 89.3 + t * 45) % (H + 20)) - 10;
          g.beginPath(); g.arc(x, y, 1.6 + (i % 3) * 0.6, 0, Math.PI * 2); g.fill();
        }
        g.restore();
        return;
      }
      g.strokeStyle = 'rgba(210,225,255,0.45)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = ((i * 137.5 + t * 60 * (1 + wx * wind.staerke)) % (W + 40)) - 20;
        const y = ((i * 89.3 + t * 420) % (H + 40)) - 20;
        g.moveTo(x, y); g.lineTo(x + wx * 6 * wind.staerke - 2, y + 12);
      }
      g.stroke();
      g.restore();
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

    // Trümmerfeld auf Schotter-/Kiesuntergrund
    kiesboden() {
      const b = this.lage.bereich;
      this.rechteck(b.x, b.y, b.w, b.h, '#8f8068');
      if (!this.kies) this.kies = SHS.grafik.kiesPunkte(this.lage);
      const g = this.g;
      for (const p of this.kies) {
        const [px, py] = this.w2s(p.x, p.y);
        g.fillStyle = p.f;
        g.beginPath(); g.arc(px, py, Math.max(0.8, p.s * this.skala), 0, Math.PI * 2); g.fill();
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
          SHS.grafik.zeichneTruemmer(g, v, v.w * this.skala, v.h * this.skala);
          g.restore();
        }
        if (zeigeEG && v.id === this.lage.eigengeruchVersteck) {
          const r = 0.45 + Math.sin(t * 4) * 0.05;
          this.kreis(v.x, v.y, r, null, '#ff7bd5');
          this.text('Eigengeruch hier', v.x, v.y - 0.55, '#ff9be0', 11);
        }
      }
    }

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
      const [px, py] = this.w2s(x, y);
      const g = this.g;
      // WR schaut zum Hund
      const h = this.s.hund;
      const blick = this.winkel(Math.atan2(h.y - y, h.x - x));
      g.save();
      g.translate(px, py); g.rotate(blick);
      SHS.grafik.zeichneMensch(g, { sk: this.skala, arm: this.wrArm > 0, jacke: FARBEN.wr, hose: '#2b2b2b', haare: '#9a9a9a', muetze: '#2b2b2b', klemmbrett: true });
      g.restore();
      this.text('WR', x, y + 0.5, '#fff', 10);
      if (this.wrArm > 0) {
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.font = `${Math.max(12, 0.28 * this.skala)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText('✋', px, py - 0.35 * this.skala);
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
      // Kopf: dreht sich zum HF, wenn der Hund zurückschaut
      let kopfW = 0;
      if (h.blickZuHF > 0) {
        const hfW = Math.atan2(this.s.hf.y - h.y, this.s.hf.x - h.x);
        kopfW = this.winkel(hfW) - w;
        while (kopfW > Math.PI) kopfW -= 2 * Math.PI;
        while (kopfW < -Math.PI) kopfW += 2 * Math.PI;
        kopfW = Math.max(-1.6, Math.min(1.6, kopfW));
      } else if (h.zustand === 'geruch') kopfW = Math.sin(t * 6.3) * 0.28 + Math.sin(t * 13.7) * 0.06;
      else if (h.zustand === 'sucht') {
        // Schnüffeln: langsames Pendeln, im Stand kurze, schnelle Bewegungen
        const still = h.v < 0.2;
        kopfW = h.naseTief ? Math.sin(t * (still ? 5.2 : 2.6)) * (still ? 0.22 : 0.3) + Math.sin(t * 9.1) * 0.05 : Math.sin(t * 1.3) * 0.15;
      }
      g.save();
      g.translate(px, py);
      g.rotate(w);
      SHS.grafik.zeichneHund(g, {
        sk, t, rasse: this.opts.hund.rasse, fell: this.opts.hund.fell,
        liegtAnteil: h.liegtAnim, sitztAnteil: h.sitztAnim, gang: h.gangPhase, tempo: h.v, biegung: h.drehRate,
        rute: h.rute, ruteHoch: h.ruteHoch,
        naseTief: h.naseTief, kopfW,
      });
      g.restore();

      // Aktive Anzeige / Verleitung sichtbar machen
      if (h.aktivAnim && Math.sin(t * 6) > 0) {
        this.text(h.zustand === 'verleitung' ? '*schnapp*' : 'Wuff! *scharr*', h.x, h.y - 0.5, '#ffe0e0', 12);
      }
      if (h.zustand === 'geruch' && this.uebung && this.geruchsAnsicht) this.text('im Geruch', h.x, h.y + 0.5, '#bfe3ff', 10);
    }

    // Eingeblendete Nahaufnahme (3D-Optik), solange der Hund anzeigt.
    zeichneNahaufnahme() {
      const h = this.s.hund;
      const a = h.anzeige;
      const sichtbar = this.nahAn && a && (h.zustand === 'anzeige' || h.zustand === 'anzeigeEinnehmen' || this.s.phase === 'ende');
      this.el.nah.classList.toggle('versteckt', !sichtbar);
      if (!sichtbar) return;
      const c = this.el.nahCanvas;
      const dpr = this.dpr;
      const w = c.clientWidth; const hh = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const q = a.quelle;
      let v = this.lage.verstecke.find((x) => x.id === q.versteckId);
      if (!v) v = this.s.naechstesVersteck(q.x, q.y, 0.6);
      SHS.grafik.zeichneAnzeigeSzene(g, w, hh, {
        rasse: this.opts.hund.rasse, fell: this.opts.hund.fell,
        disziplin: this.lage.disziplin, lk: this.lage.lk,
        versteckTyp: v ? v.typ : null, versteckHoehe: v && v.hoehe ? v.hoehe : 0,
        quelleHoehe: q.hoehe || 0, quelleTyp: q.typ,
        abstand: Math.hypot(a.punkt.x - q.x, a.punkt.y - q.y),
        aktiv: a.aktiv && h.zustand === 'anzeige', blick: h.blickZuHF > 0, rute: h.rute,
        t: performance.now() / 1000, zeigeAbstand: this.uebung,
      });
    }

    zeichneHF() {
      const hf = this.s.hf;
      const g = this.g;
      const [px, py] = this.w2s(hf.x, hf.y);
      const sk = this.skala;
      const w = this.winkel(hf.richtung || 0);
      g.save();
      g.translate(px, py);
      g.rotate(w);
      SHS.grafik.zeichneMensch(g, { sk, gang: hf.gang || 0, tempo: hf.tempo || 0, arm: hf.arm, jacke: FARBEN.hf, hose: '#30343d', haare: '#5a3b24' });
      g.restore();
      if (hf.arm) {
        // Handzeichen deutlich sichtbar: Hand über dem Kopf
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.font = `${Math.max(12, 0.28 * sk)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText('✋', px, py - 0.35 * sk);
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
