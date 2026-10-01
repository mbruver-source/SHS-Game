// Ablauf einer Suchlage nach PO (ohne Darstellung): Vorbereitung (Eigengeruch, Antäuschen),
// Start per Handzeichen, Suche, Anzeige mit Anzeigedauer je LK, Bewertung.
// Wird von der Spielszene (search.js) und kopflos für KI-Teilnehmer (HFBot) genutzt.
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const HF_TEMPO = 1.5;
  const HILFE_SPERRE = 2; // s – Mehrfachbefehle kurz hintereinander zählen einmal

  class SuchLage {
    // opts: { disziplin, lk, seed, hund, gegenstand, ansatzIndex, leine, modus, aussenreize }
    constructor(opts) {
      this.opts = opts;
      this.lage = SHS.layouts.erzeuge(opts.disziplin, opts.lk, opts.seed);
      this.rnd = SHS.rng((opts.seed ^ 0x5f3759df) >>> 0);
      this.richter = new SHS.Wertungsrichter(opts.lk, opts.disziplin);
      this.suchzeit = po.suchzeit(opts.lk, opts.disziplin);
      this.leine = !!opts.leine && po.leineErlaubt(opts.lk, opts.disziplin) && opts.disziplin !== 'flaeche';
      this.schleppleine = opts.disziplin === 'flaeche' && opts.lk <= 2 && !!opts.leine;
      const idx = Math.min(opts.ansatzIndex || 0, this.lage.ansatzOptionen.length - 1);
      this.ansatz = this.lage.ansatzOptionen[idx];
      this.quellen = this.lage.quellen.slice();
      this.hund = new SHS.dog.SuchHund(opts.hund, opts.gegenstand, this.lage, this.rnd);
      this.hund.setzePosition(this.ansatz.x, this.ansatz.y);
      this.hund.richtung = Math.atan2(this.lage.bereich.y + this.lage.bereich.h / 2 - this.ansatz.y,
        this.lage.bereich.x + this.lage.bereich.w / 2 - this.ansatz.x);
      this.hf = { x: this.ansatz.x - 0.6, y: this.ansatz.y, arm: false, stillSeit: 0, anfassen: 0, richtung: 0 };
      this.t = 0;
      this.phase = 'vorbereitung'; // vorbereitung | suche | ende
      this.zeit = 0; // gemessene Suchzeit
      this.eigengeruchNoetig = !!this.lage.eigengeruchVersteck;
      this.eigengeruchErledigt = false;
      this.ersterSuchFrei = true;
      this.letzteHilfe = -99;
      this.meldung = null; // laufende Anzeige-Meldung
      this.warteZweitesZeichen = false;
      this.ausserhalb = false;
      this.verlassenZaehler = 0;
      this.aufMittelweg = true;
      this.naechsterReiz = 25 + this.rnd() * 40;
      this.reize = [];
      this.nachrichten = [];
      this.armTimer = 0;
      this.ergebnis = null;
      this.meldeWR(this.einleitung());
    }

    einleitung() {
      const lk = this.opts.lk;
      const teile = [`${po.DISZIPLINEN[this.opts.disziplin].name}, LK ${lk}. Ansatz: ${this.ansatz.name}.`];
      if (this.eigengeruchNoetig) {
        const v = this.lage.verstecke.find((x) => x.id === this.lage.eigengeruchVersteck);
        teile.push(`Bitte die Eigengeruchsverleitung am markierten Versteck (${v.typ}) anbringen – 3 Sekunden mit beiden Händen anfassen (E halten).`);
      }
      teile.push('Danach zurück zum Hund und mit Handzeichen (H) die Bereitschaft melden.');
      return teile.join(' ');
    }

    meldeWR(text) { this.nachrichten.push({ t: this.t, von: 'WR', text }); }
    meldeInfo(text) { this.nachrichten.push({ t: this.t, von: 'info', text }); }

    get ctx() {
      return {
        t: this.t,
        hf: this.hf,
        quellen: this.quellen,
        leine: this.leine && this.phase !== 'ende',
        suchePhase: this.phase === 'suche',
        anzeigeGemeldet: !!this.meldung,
        melde: (e) => this.hundEreignis(e),
      };
    }

    // ---------------------------------------------------------------- HF-Aktionen
    hfBewegen(dx, dy, dt) {
      if (this.phase === 'ende') return;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return;
      const nx = this.hf.x + (dx / len) * HF_TEMPO * dt;
      const ny = this.hf.y + (dy / len) * HF_TEMPO * dt;
      const w = this.lage.welt;
      this.hf.x = Math.max(0.2, Math.min(w.w - 0.2, nx));
      this.hf.y = Math.max(0.2, Math.min(w.h - 0.2, ny));
      this.hf.richtung = Math.atan2(dy, dx);
      this.hf.stillSeit = 0;
      this.hf.bewegt = true;
    }

    hilfe(text) {
      if (this.t - this.letzteHilfe < HILFE_SPERRE) return;
      this.letzteHilfe = this.t;
      this.richter.fehler('hilfe', text);
    }

    befehlSuch() {
      if (this.phase === 'vorbereitung') {
        this.meldeWR('Erst mit Handzeichen (H) am Ansatz die Bereitschaft melden.');
        return;
      }
      if (this.phase !== 'suche' || this.meldung) return;
      if (this.ersterSuchFrei) this.ersterSuchFrei = false;
      else this.hilfe('Wiederholtes Hörzeichen „Such!“');
      this.hund.such();
      this.meldeInfo('HF: „Such!“');
    }

    befehlHier() {
      if (this.phase !== 'suche' || this.meldung) return;
      this.hilfe('Hörzeichen „Hier!“ während der Suche');
      this.hund.hier();
      this.ersterSuchFrei = true; // erneutes Ansetzen danach ist kein weiterer Fehler
      this.meldeInfo('HF: „Hier!“');
    }

    richtungsZeichen(x, y) {
      if (this.phase !== 'suche' || this.meldung) return;
      this.hilfe('Richtungszeichen / Führen des Hundes');
      this.hund.richtungsZeichen(x, y);
      this.meldeInfo('HF zeigt eine Richtung an.');
    }

    befehlBleib() {
      if (this.phase !== 'suche') return;
      if (this.hund.zustand === 'anzeige' || this.hund.zustand === 'anzeigeEinnehmen') {
        this.richter.fehler('unterstuetzung');
        this.hund.bleib();
        this.meldeInfo('HF: „Bleib!“ – Unterstützung der Anzeige');
      }
    }

    // E halten: Eigengeruch anbringen bzw. antäuschen (nur in der Vorbereitung).
    anfassen(dt) {
      if (this.phase !== 'vorbereitung') return;
      const eg = this.lage.verstecke.find((x) => x.id === this.lage.eigengeruchVersteck);
      const v = eg && !this.eigengeruchErledigt && Math.hypot(eg.x - this.hf.x, eg.y - this.hf.y) < 0.9
        ? eg : this.naechstesVersteck(this.hf.x, this.hf.y, 0.9);
      if (this.opts.disziplin === 'flaeche') {
        if (!this.hfAufMittelweg()) { this.hf.anfassen = 0; return; }
        this.hf.anfassen += dt;
        if (this.hf.anfassen > 0.8 && !this.hf.antaeuschGemeldet) { this.hf.antaeuschGemeldet = true; this.meldeInfo('Antäuschen auf dem Mittelweg.'); }
        return;
      }
      if (!v) { this.hf.anfassen = 0; return; }
      this.hf.anfassen += dt;
      if (v.id === this.lage.eigengeruchVersteck && !this.eigengeruchErledigt) {
        if (this.hf.anfassen >= 3) {
          this.eigengeruchErledigt = true;
          this.quellen.push({ typ: 'eigengeruch', name: 'Eigengeruch HF', x: v.x, y: v.y, hoehe: 0, versteckId: v.id, staerke: 0.75, reichweite: 0.8 });
          this.meldeWR('Eigengeruchsverleitung angebracht. Zurück zum Hund.');
          this.hf.anfassen = 0;
        }
      } else if (this.hf.anfassen > 0.8 && !this.hf.antaeuschGemeldet) {
        this.hf.antaeuschGemeldet = true;
        this.meldeInfo(`Antäuschen am Versteck (${v.typ}).`);
      }
    }

    anfassenEnde() { this.hf.anfassen = 0; this.hf.antaeuschGemeldet = false; }

    naechstesVersteck(x, y, max) {
      let best = null; let bd = max;
      for (const v of this.lage.verstecke) {
        const d = Math.hypot(v.x - x, v.y - y);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    }

    hfAufMittelweg() {
      const m = this.lage.mittelweg;
      if (!m) return true;
      const x = this.hf.x; const y = this.hf.y;
      if (y < m.y - 0.1 || y > m.y + m.h + 0.1) return true; // außerhalb der Fläche (Ansatz)
      return x >= m.x - 0.05 && x <= m.x + m.w + 0.05;
    }

    // H: Handzeichen (Arm heben)
    armHeben() {
      this.hf.arm = true;
      this.armTimer = 1.2;
      if (this.phase === 'vorbereitung') {
        if (this.eigengeruchNoetig && !this.eigengeruchErledigt) {
          this.meldeWR('Die Eigengeruchsverleitung ist noch nicht angebracht.');
          return;
        }
        const dHund = Math.hypot(this.hf.x - this.hund.x, this.hf.y - this.hund.y);
        if (dHund > 1.3) {
          this.meldeWR('Bitte erst zum Hund am Ansatz zurückkehren.');
          return;
        }
        this.phase = 'suche';
        this.meldeWR('Erwidert – die Zeit läuft. Hund mit „Such!“ (Leertaste) schicken.');
        return;
      }
      if (this.phase !== 'suche') return;

      if (this.meldung) {
        if (this.warteZweitesZeichen) {
          const d = Math.hypot(this.hf.x - this.hund.x, this.hf.y - this.hund.y);
          if (d > 1.0) { this.meldeWR('Erst neben den Hund begeben.'); return; }
          this.warteZweitesZeichen = false;
          this.meldung.phase = 1;
          this.meldung.rest = this.meldung.phasen[1];
          this.meldeInfo('Zweites Handzeichen.');
        }
        return;
      }

      const z = this.hund.zustand;
      if (z !== 'anzeige' && z !== 'anzeigeEinnehmen') {
        this.meldeWR('Handzeichen ohne Anzeige des Hundes – wird als Fehlanzeige gewertet.');
        this.fehlanzeigeWerten();
        return;
      }
      const phasen = po.LK[this.opts.lk].anzeige.phasen.slice();
      this.meldung = { phasen, phase: 0, rest: phasen[0], anzeige: this.hund.anzeige, unruhig: 0 };
      this.meldeInfo('HF meldet die Anzeige (Arm gehoben).');
    }

    fehlanzeigeWerten() {
      const r = this.richter.fehlanzeige();
      this.meldeWR(`Fehlanzeige! ${po.FEHLANZEIGE_ABZUG} Punkte Abzug (${this.richter.fehlanzeigen}/${po.FEHLANZEIGEN_BIS_ABBRUCH}).`);
      if (this.hund.anzeige) this.hund.anzeigeAufloesen(false);
      this.hund.setzeZustand('beiHF');
      this.hund.liegt = false;
      this.ersterSuchFrei = true;
      if (r.abbruch) this.beenden('Dreimalige Fehlanzeige – die Vorführung wird abgebrochen.');
      else this.meldeInfo('Hund neu ansetzen mit „Such!“.');
    }

    // ---------------------------------------------------------------- Ereignisse
    hundEreignis(e) {
      if (this.phase !== 'suche') return;
      switch (e.typ) {
        case 'verleitung':
          this.richter.fehler('verleitung', `Annahme einer Verleitung (${e.quelle.name})`);
          this.meldeInfo(`Der Hund greift nach der Verleitung (${e.quelle.name})!`);
          break;
        case 'aussenreiz':
          this.richter.fehler('aussenreiz');
          this.meldeInfo('Der Hund reagiert auf den Außenreiz.');
          break;
        case 'randalieren':
          this.richter.fehler('randalieren');
          e.versteck.x += this.rnd.range(-0.1, 0.1); e.versteck.y += this.rnd.range(-0.1, 0.1);
          e.versteck.rot = (e.versteck.rot || 0) + this.rnd.range(-0.4, 0.4);
          this.meldeInfo('Der Hund verschiebt ein Versteck.');
          break;
        case 'augensuche':
          this.richter.fehler('augensuche');
          break;
        case 'blick':
          if (this.meldung && this.meldung.unruhig < 4) {
            this.meldung.unruhig += 1;
            this.richter.fehler('unruhig');
          }
          break;
        case 'aufstehen':
          if (this.meldung) this.richter.fehler('aufstehen');
          break;
        default: break;
      }
    }

    // ---------------------------------------------------------------- Simulation
    update(dt) {
      if (this.phase === 'ende') return;
      this.t += dt;
      if (!this.hf.bewegt) this.hf.stillSeit += dt;
      this.hf.bewegt = false;
      if (this.armTimer > 0) { this.armTimer -= dt; if (this.armTimer <= 0 && !this.meldung) this.hf.arm = false; }
      if (this.meldung) this.hf.arm = true;

      this.hund.update(dt, this.ctx);

      if (this.phase !== 'suche') return;
      this.zeit += dt;

      this.pruefeBereich();
      this.pruefeMittelweg();
      this.aussenreize(dt);
      this.updateMeldung(dt);

      if (this.phase === 'suche' && this.zeit >= this.suchzeit) {
        this.richter.zeitAbgelaufen();
        this.meldeWR('Die Suchzeit ist abgelaufen.');
        this.beenden();
      }
    }

    updateMeldung(dt) {
      const m = this.meldung;
      if (!m || this.warteZweitesZeichen) return;
      if (this.hund.zustand !== 'anzeige' && this.hund.zustand !== 'anzeigeEinnehmen') {
        // Hund hat die Anzeige komplett aufgelöst
        this.meldung = null;
        this.hf.arm = false;
        if (m.anzeige.richtig) {
          this.richter.fehler('aufstehen');
          this.meldeWR('Der Hund hat die Anzeige vor der Erwiderung aufgelöst.');
        } else this.fehlanzeigeWerten();
        return;
      }
      m.rest -= dt;
      if (m.rest > 0) return;
      if (!m.anzeige.richtig) {
        this.meldung = null;
        this.hf.arm = false;
        this.fehlanzeigeWerten();
        return;
      }
      if (m.phase + 1 < m.phasen.length) {
        this.warteZweitesZeichen = true;
        this.meldeWR('Erwidert. Bitte neben den Hund begeben und erneut das Handzeichen geben.');
        return;
      }
      // Erfolgreiche Anzeige
      if (m.anzeige.aktiv) this.richter.fehler('aktiv');
      if (m.anzeige.ungenau) this.richter.fehler('ungenau');
      this.richter.fund();
      this.meldeWR('Erwidert – Fund! Die Zeitmessung endet.');
      this.meldung = null;
      this.beenden();
    }

    pruefeBereich() {
      const h = this.hund;
      if (['sitzt', 'beiHF', 'hier'].includes(h.zustand)) { this.ausserhalb = false; return; }
      const draussen = !SHS.layouts.imBereich(this.lage, h.x, h.y, 0.7);
      if (draussen && !this.ausserhalb) {
        this.verlassenZaehler += 1;
        if (this.verlassenZaehler >= 2) this.richter.fehler('verlassen');
        this.meldeInfo('Der Hund verlässt den Suchbereich.');
      }
      this.ausserhalb = draussen;
    }

    pruefeMittelweg() {
      if (!this.lage.mittelweg) return;
      // LK3: Für das zweite Handzeichen muss der HF neben den Hund – das ist kein Übertreten.
      if (this.meldung) { this.aufMittelweg = this.hfAufMittelweg(); return; }
      const auf = this.hfAufMittelweg();
      if (!auf && this.aufMittelweg) {
        this.richter.fehler('mittelweg');
        this.meldeWR('Der Mittelweg darf nicht verlassen werden!');
      }
      this.aufMittelweg = auf;
    }

    aussenreize(dt) {
      if (this.opts.aussenreize === false) return;
      this.naechsterReiz -= dt;
      this.reize = this.reize.filter((r) => (r.rest -= dt) > 0);
      if (this.naechsterReiz > 0) return;
      this.naechsterReiz = 30 + this.rnd() * 45;
      const w = this.lage.welt;
      const seite = this.rnd.int(0, 3);
      const p = seite === 0 ? { x: this.rnd() * w.w, y: -1 } : seite === 1 ? { x: w.w + 1, y: this.rnd() * w.h }
        : seite === 2 ? { x: this.rnd() * w.w, y: w.h + 1 } : { x: -1, y: this.rnd() * w.h };
      const art = this.rnd.pick(['Vogel fliegt auf', 'Hund bellt in der Ferne', 'Fahrradklingel', 'Zuschauer klatscht', 'Ast knackt']);
      this.reize.push({ ...p, art, rest: 2.5 });
      this.meldeInfo(`Außenreiz: ${art}.`);
      this.hund.aussenreiz(p, this.ctx);
    }

    beenden(grund) {
      if (this.phase === 'ende') return;
      if (grund) this.meldeWR(grund);
      this.phase = 'ende';
      this.hf.arm = false;
      const h = this.hund;
      const anteil = h.suchZeit > 5 ? h.schwachZeit / h.suchZeit : 0;
      this.richter.setzeIntensitaet(anteil);
      this.ergebnis = this.richter.ergebnis();
    }

    // Für Übungssuche: Konzentration des Zielgeruchs an einem Punkt (Geruchsansicht).
    geruchAn(x, y, nurZiel) {
      let s = 0;
      for (const q of this.quellen) {
        if (nurZiel && q.typ !== 'ziel') continue;
        s += SHS.scent.konzentration(q, x, y, this.lage.wind, this.t);
      }
      return s;
    }
  }

  // ---------------------------------------------------------------------------------
  // HFBot: steuert einen Hundeführer automatisch (KI-Teilnehmer).
  // erfahrung 0..1 = wie gut der HF seinen Hund liest.
  class HFBot {
    constructor(lage, erfahrung, rnd) {
      this.s = lage;
      this.erfahrung = erfahrung;
      this.rnd = rnd;
      this.schritt = 'eigengeruch';
      this.warte = 0;
      this.gesendet = false;
      this.anzeigeBeobachtet = 0;
    }

    gehe(ziel, dt) {
      const hf = this.s.hf;
      const dx = ziel.x - hf.x; const dy = ziel.y - hf.y;
      if (Math.hypot(dx, dy) < 0.15) return true;
      this.s.hfBewegen(dx, dy, dt);
      return false;
    }

    update(dt) {
      const s = this.s;
      if (s.phase === 'ende') return;
      if (s.phase === 'vorbereitung') {
        if (this.schritt === 'eigengeruch') {
          if (!s.eigengeruchNoetig || s.eigengeruchErledigt) { this.schritt = 'zurueck'; return; }
          const v = s.lage.verstecke.find((x) => x.id === s.lage.eigengeruchVersteck);
          if (this.gehe({ x: v.x - 0.5, y: v.y }, dt)) s.anfassen(dt);
          return;
        }
        if (this.gehe({ x: s.hund.x - 0.5, y: s.hund.y }, dt)) s.armHeben();
        return;
      }
      // Suche
      const h = s.hund;
      if (!this.gesendet) { s.befehlSuch(); this.gesendet = true; return; }
      if (s.meldung) {
        if (s.warteZweitesZeichen) {
          if (this.gehe({ x: h.x - 0.5, y: h.y }, dt)) s.armHeben();
        }
        return;
      }
      if (h.zustand === 'anzeige') {
        this.anzeigeBeobachtet += dt;
        const entscheiden = 0.6 + (1 - this.erfahrung) * 0.8;
        if (this.anzeigeBeobachtet > entscheiden) {
          const glaubt = h.anzeige.richtig
            ? this.rnd() < 0.8 + 0.2 * this.erfahrung
            : this.rnd() < 0.55 * (1 - this.erfahrung);
          if (glaubt) s.armHeben();
          else { s.befehlSuch(); }
          this.anzeigeBeobachtet = 0;
        }
        return;
      }
      this.anzeigeBeobachtet = 0;
      if (h.zustand === 'beiHF') { s.befehlSuch(); return; }
      // Unselbstständiger Hund: erfahrene HF gehen weiter statt erneut zu schicken.
      if (h.zustand === 'schautHF') {
        this.warte += dt;
        if (this.warte > 4 - 2 * this.erfahrung && this.rnd() < 0.3 * (1 - this.erfahrung)) { s.befehlSuch(); this.warte = 0; }
      } else this.warte = 0;
      if (s.lage.mittelweg) {
        // Langsam den Mittelweg abgehen (hin und zurück), der Hund quert seitlich.
        const m = s.lage.mittelweg;
        if (this.richtungY === undefined) this.richtungY = s.hf.y < m.y + m.h / 2 ? 1 : -1;
        if (h.zustand === 'geruch' || h.zustand === 'anzeigeEinnehmen') return;
        if (Math.abs(h.y - s.hf.y) > 3) { this.gehe({ x: m.x + m.w / 2, y: h.y }, dt); return; }
        if (this.weg === undefined) this.weg = 0;
        this.weg += dt;
        if (this.weg % 3 < 1.4) {
          const ny = s.hf.y + this.richtungY;
          if (ny > m.y + m.h - 0.5) this.richtungY = -1;
          if (ny < m.y + 0.5) this.richtungY = 1;
          this.gehe({ x: m.x + m.w / 2, y: s.hf.y + this.richtungY }, dt * 0.6);
        }
      } else {
        const d = Math.hypot(h.x - s.hf.x, h.y - s.hf.y);
        const abstand = s.leine ? 1.4 : 2.2;
        if (d > abstand) this.gehe({ x: h.x, y: h.y }, dt);
      }
    }
  }

  // Kopflose Simulation einer kompletten Suchlage.
  function simuliere(opts, erfahrung) {
    const s = new SuchLage(Object.assign({ modus: 'sim' }, opts));
    const bot = new HFBot(s, erfahrung, SHS.rng((opts.seed * 7 + 13) >>> 0));
    const dt = 0.1;
    let schritte = 0;
    while (s.phase !== 'ende' && schritte++ < 6000) {
      bot.update(dt);
      s.update(dt);
    }
    if (s.phase !== 'ende') s.beenden();
    return s.ergebnis;
  }

  SHS.SuchLage = SuchLage;
  SHS.HFBot = HFBot;
  SHS.simuliereSuche = simuliere;
})(globalThis.SHS = globalThis.SHS || {});
