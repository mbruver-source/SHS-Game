// Hundemodell (Werte, Rassen) und Such-KI während einer Suchlage.
(function (SHS) {
  'use strict';
  const po = SHS.po;

  const WERTE = {
    nase: 'Nase',
    ausdauer: 'Ausdauer',
    impuls: 'Impulskontrolle',
    anzeige: 'Anzeigesicherheit',
    praezision: 'Präzision',
    differenzierung: 'Differenzierung',
    selbststaendig: 'Selbstständigkeit',
    konzentration: 'Konzentration',
  };

  const RASSEN = {
    'Labrador Retriever': { nase: 6, impuls: -6, anzeige: 3, konzentration: 2 },
    'Malinois': { ausdauer: 8, impuls: -8, selbststaendig: 6, konzentration: 2 },
    'Beagle': { nase: 12, impuls: -10, konzentration: -6, selbststaendig: 4 },
    'Deutscher Schäferhund': { konzentration: 6, anzeige: 4, nase: 2, selbststaendig: -2 },
    'Border Collie': { konzentration: 4, praezision: 5, selbststaendig: -4, ausdauer: 4 },
    'Mischling': { nase: 2, impuls: 2, anzeige: 2, differenzierung: 2 },
  };

  function neuerHund(name, rasse) {
    const mod = RASSEN[rasse] || RASSEN.Mischling;
    const werte = {};
    for (const k of Object.keys(WERTE)) werte[k] = Math.max(5, Math.min(95, 30 + (mod[k] || 0)));
    const vertrautheit = {};
    for (const g of po.GEGENSTAENDE) vertrautheit[g.id] = 0.1;
    return { name, rasse, alterMonate: 12, werte, vertrautheit, energie: 1 };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------------------------------------------------------------------------------
  // SuchHund: der Hund während einer Suchlage. Gibt über ctx.melde(ereignis) Ereignisse
  // an die Suchlage (Wertungsrichter) weiter.
  class SuchHund {
    constructor(hund, gegenstandId, lage, rnd) {
      this.hund = hund;
      this.w = {};
      for (const k of Object.keys(WERTE)) this.w[k] = clamp(hund.werte[k], 0, 100) / 100;
      this.vertraut = clamp(hund.vertrautheit[gegenstandId] ?? 0.3, 0.05, 1);
      this.lage = lage;
      this.rnd = rnd;
      this.x = 0; this.y = 0;
      this.richtung = 0;
      this.zustand = 'sitzt';
      this.zustandSeit = 0;
      this.motivation = 1;
      this.ziel = null; // aktueller Wegpunkt
      this.pause = 0;
      this.ignoriert = new Set(); // Quellen, die der Hund als "nicht mein Gegenstand" abgehakt hat
      this.verleitungErledigt = new Set();
      this.besuche = new Map();
      this.hinweis = null; // Richtungszeichen des HF
      this.anzeige = null;
      this.schwachZeit = 0;
      this.suchZeit = 0;
      this.signal = 0;
      this.signalSpitze = 0;
      this.geruchSeit = 0;
      this.stabil = 0; // "Bleib"-Unterstützung
      this.augensucheGemeldet = false;
      // Darstellung / Körpersprache
      this.rute = 0.3;
      this.ruteHoch = true;
      this.naseTief = false;
      this.blickZuHF = 0;
      this.aktivAnim = false;
      this.kopfschlag = 0;
      this.liegt = false;
      this.reizZiel = null;
    }

    setzePosition(x, y) { this.x = x; this.y = y; }

    setzeZustand(z) {
      this.zustand = z;
      this.zustandSeit = 0;
    }

    // Wie stark der Hund eine Quelle für "seinen" Gegenstand hält.
    aehnlichkeit(q) {
      if (this.ignoriert.has(q)) return 0;
      const d = this.w.differenzierung;
      switch (q.typ) {
        case 'ziel': return 1;
        case 'differenzierung': return 0.15 + 0.75 * (1 - d);
        case 'eigengeruch': return 0.55 * (1 - d);
        default: return 0;
      }
    }

    empfindlichkeit() {
      return (0.4 + 0.6 * this.vertraut) * (0.55 + this.w.nase * 0.9);
    }

    zielSignal(x, y, ctx) {
      let s = 0;
      for (const q of ctx.quellen) {
        const a = this.aehnlichkeit(q);
        if (a <= 0) continue;
        s += SHS.scent.konzentration(q, x, y, this.lage.wind, ctx.t) * a;
      }
      return s * this.empfindlichkeit();
    }

    // Stärkste Quelle in Nasennähe (für Ankunft am Geruch).
    naechsteRelevanteQuelle(ctx) {
      let best = null; let bestD = Infinity;
      for (const q of ctx.quellen) {
        if (this.aehnlichkeit(q) <= 0) continue;
        const d = Math.hypot(q.x - this.x, q.y - this.y);
        if (d < bestD) { bestD = d; best = q; }
      }
      return best ? { q: best, d: bestD } : null;
    }

    // ---- Befehle des HF --------------------------------------------------------
    such() {
      if (this.zustand === 'anzeige' || this.zustand === 'anzeigeEinnehmen') this.anzeigeAufloesen(false);
      this.setzeZustand('sucht');
      this.ziel = null;
      this.motivation = clamp(this.motivation + 0.08, 0, 1);
    }

    hier() {
      if (this.zustand === 'anzeige') this.anzeigeAufloesen(false);
      this.setzeZustand('hier');
    }

    richtungsZeichen(x, y) {
      this.hinweis = { x, y, rest: 6 };
      if (this.zustand === 'schautHF' || this.zustand === 'beiHF') this.setzeZustand('sucht');
      this.ziel = null;
    }

    bleib() { this.stabil = 4; }

    aussenreiz(p, ctx) {
      if (this.zustand === 'anzeige' || this.zustand === 'sitzt' || this.zustand === 'beiHF') return;
      if (this.rnd() < 0.85 * (1 - this.w.konzentration)) {
        this.reizZiel = p;
        this.setzeZustand('aussenreiz');
        ctx.melde({ typ: 'aussenreiz' });
      }
    }

    anzeigeAufloesen(meldeAufstehen) {
      const a = this.anzeige;
      this.anzeige = null;
      this.liegt = false;
      this.aktivAnim = false;
      if (a && !a.richtig) this.ignoriert.add(a.quelle);
      if (meldeAufstehen) this.setzeZustand(a && a.richtig ? 'geruch' : 'sucht');
    }

    // ---- Simulation -------------------------------------------------------------
    update(dt, ctx) {
      this.zustandSeit += dt;
      if (this.stabil > 0) this.stabil -= dt;
      if (this.hinweis) { this.hinweis.rest -= dt; if (this.hinweis.rest <= 0) this.hinweis = null; }
      if (this.kopfschlag > 0) this.kopfschlag -= dt;

      const sucht = ['sucht', 'geruch', 'verleitung', 'schautHF', 'aussenreiz'].includes(this.zustand);
      if (sucht && ctx.suchePhase) {
        this.suchZeit += dt;
        this.motivation = clamp(this.motivation - dt * 0.0024 * (1.45 - this.w.ausdauer), 0.15, 1);
        if (this.motivation < 0.45 || this.zustand === 'schautHF') this.schwachZeit += dt;
        if (!this.augensucheGemeldet && this.motivation < 0.4 && this.rnd() < dt * 0.02 * (1.2 - this.w.nase)) {
          this.augensucheGemeldet = true;
          ctx.melde({ typ: 'augensuche' });
        }
      }
      this.markiereBesuch(dt);

      switch (this.zustand) {
        case 'sitzt': this.liegt = false; this.rute = 0.6; break;
        case 'beiHF': this.rute = 0.4; break;
        case 'sucht': this.updateSucht(dt, ctx); break;
        case 'geruch': this.updateGeruch(dt, ctx); break;
        case 'verleitung': this.updateVerleitung(dt, ctx); break;
        case 'schautHF': this.updateSchautHF(dt, ctx); break;
        case 'aussenreiz': this.updateAussenreiz(dt, ctx); break;
        case 'hier': this.updateHier(dt, ctx); break;
        case 'anzeigeEinnehmen': this.updateAnzeigeEinnehmen(dt, ctx); break;
        case 'anzeige': this.updateAnzeige(dt, ctx); break;
        default: break;
      }

      if (sucht) this.pruefeVerleitungen(ctx);
      if (ctx.leine) this.leineBegrenzen(ctx);
    }

    markiereBesuch(dt) {
      const k = Math.round(this.x * 2) + ',' + Math.round(this.y * 2);
      this.besuche.set(k, (this.besuche.get(k) || 0) + dt);
    }

    besuchsWert(x, y) {
      return this.besuche.get(Math.round(x * 2) + ',' + Math.round(y * 2)) || 0;
    }

    bewegeZu(p, speed, dt) {
      const dx = p.x - this.x; const dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) return 0;
      const zielWinkel = Math.atan2(dy, dx);
      let diff = zielWinkel - this.richtung;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.richtung += clamp(diff, -dt * 7, dt * 7);
      const s = Math.min(d, speed * dt);
      this.x += (dx / d) * s; this.y += (dy / d) * s;
      return d - s;
    }

    tempo(basis) {
      return basis * (0.45 + 0.55 * this.motivation);
    }

    waehleWegpunkt(ctx) {
      const lage = this.lage;
      const b = lage.bereich;
      const r = this.rnd;
      const kandidaten = [];
      if (lage.disziplin === 'behaeltnis') {
        for (const v of lage.verstecke) {
          for (const k of v.kammern) {
            const wx = v.x + (k.x - v.x) * 1.5; const wy = v.y + (k.y - v.y) * 1.5;
            kandidaten.push({ x: wx, y: wy, versteck: v });
          }
        }
      } else {
        for (let i = 0; i < 16; i++) {
          kandidaten.push({ x: r.range(b.x + 0.2, b.x + b.w - 0.2), y: r.range(b.y + 0.2, b.y + b.h - 0.2) });
        }
        for (const v of lage.verstecke) kandidaten.push({ x: v.x + r.range(-0.2, 0.2), y: v.y + r.range(-0.2, 0.2), versteck: v });
      }
      const nahHF = 0.08 + 0.4 * (1 - this.w.selbststaendig);
      let best = null; let bestScore = -Infinity;
      for (const c of kandidaten) {
        let dHF = Math.hypot(c.x - ctx.hf.x, c.y - ctx.hf.y);
        if (lage.disziplin === 'flaeche') dHF = Math.abs(c.y - ctx.hf.y) * 1.3 + Math.abs(c.x - ctx.hf.x) * 0.15;
        const neu = 1 / (1 + this.besuchsWert(c.x, c.y) * (lage.disziplin === 'behaeltnis' ? 1.2 : 2.5));
        let score = neu * 1.6 - dHF * nahHF - Math.hypot(c.x - this.x, c.y - this.y) * 0.12 + r() * 0.35;
        if (this.hinweis) score -= Math.hypot(c.x - this.hinweis.x, c.y - this.hinweis.y) * 0.8;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return best;
    }

    updateSucht(dt, ctx) {
      this.liegt = false;
      this.naseTief = this.motivation > 0.45;
      this.rute = 0.35 + 0.35 * this.motivation;
      this.ruteHoch = true;
      this.signal = this.zielSignal(this.x, this.y, ctx);
      // Wahrnehmung ist nicht garantiert: je schwächer Signal und Nase, desto eher läuft der Hund drüber.
      const pWahrnehmung = clamp((this.signal - 0.1) / 0.3, 0, 1) * (0.35 + 0.65 * this.w.nase);
      if (ctx.suchePhase && this.rnd() < pWahrnehmung * dt * 4) {
        this.setzeZustand('geruch');
        this.kopfschlag = 0.5;
        this.geruchSeit = 0;
        this.signalSpitze = this.signal;
        return;
      }
      // Unselbstständiger Hund bleibt stehen und schaut zum HF, wenn dieser steht.
      if (ctx.hf.stillSeit > 2.5 && this.rnd() < dt * 0.25 * (1 - this.w.selbststaendig)) {
        this.setzeZustand('schautHF');
        return;
      }
      if (this.pause > 0) { this.pause -= dt; return; }
      if (!this.ziel) this.ziel = this.waehleWegpunkt(ctx);
      const basis = this.lage.disziplin === 'behaeltnis' ? 0.9 : this.lage.disziplin === 'truemmer' ? 1.0 : 1.5;
      const rest = this.bewegeZu(this.ziel, this.tempo(basis), dt);
      if (rest < 0.05) {
        const v = this.ziel.versteck;
        this.pause = v ? this.rnd.range(0.4, 1.0) * (1.3 - this.motivation * 0.5) : this.rnd.range(0.05, 0.3);
        if (v && this.lage.disziplin === 'truemmer' && this.rnd() < 0.025 * (1 - this.w.impuls)) {
          ctx.melde({ typ: 'randalieren', versteck: v });
        }
        // Seltene spontane Fehlanzeige an einem Versteck bei geringer Anzeigesicherheit.
        if (v && this.rnd() < 0.01 * (1 - this.w.anzeige) * (1.5 - this.motivation)) {
          this.starteAnzeige({ typ: 'leer', name: 'leeres Versteck', x: v.x, y: v.y, hoehe: 0 }, false, ctx);
          return;
        }
        this.ziel = null;
      }
    }

    updateGeruch(dt, ctx) {
      this.geruchSeit += dt;
      this.naseTief = true;
      this.rute = 1;
      this.ruteHoch = true;
      const n = this.naechsteRelevanteQuelle(ctx);
      if (n && n.d < 0.3) {
        this.ankunftAnQuelle(n.q, ctx);
        return;
      }
      // Gradient: 8 Richtungen abtasten, beste mit Rauschen wählen.
      const r = 0.35;
      let best = { s: this.zielSignal(this.x, this.y, ctx), x: this.x, y: this.y };
      const rausch = 0.15 + 0.35 * (1 - this.w.nase);
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2;
        const px = this.x + Math.cos(w) * r; const py = this.y + Math.sin(w) * r;
        const s = this.zielSignal(px, py, ctx) * (1 + this.rnd.gauss() * rausch * 0.3);
        if (s > best.s) best = { s, x: px, y: py };
      }
      this.signal = best.s;
      if (this.signal > this.signalSpitze) { this.signalSpitze = this.signal; }
      // Nahe an der Quelle direkt hinarbeiten
      if (n && n.d < 0.8 && this.signal > 0.3) best = { s: best.s, x: n.q.x, y: n.q.y };
      this.bewegeZu(best, 0.55 + 0.25 * this.motivation, dt);
      if (this.signal < 0.06 || this.geruchSeit > 14) {
        this.setzeZustand('sucht');
        this.ziel = null;
      }
    }

    ankunftAnQuelle(q, ctx) {
      if (q.typ === 'ziel') {
        this.starteAnzeige(q, true, ctx);
        return;
      }
      const p = this.aehnlichkeit(q) * 0.85;
      if (this.rnd() < p) this.starteAnzeige(q, false, ctx);
      else {
        this.ignoriert.add(q);
        this.setzeZustand('sucht');
        this.ziel = null;
      }
    }

    starteAnzeige(q, richtig, ctx) {
      const hochlage = (q.hoehe || 0) > 0.4;
      const ungenau = !hochlage && this.rnd() < 0.55 * (1 - this.w.praezision);
      const abstand = ungenau ? this.rnd.range(0.26, 0.45) : this.rnd.range(0.06, 0.17);
      const winkel = Math.atan2(this.y - q.y, this.x - q.x);
      this.anzeige = {
        quelle: q, richtig, ungenau,
        aktiv: this.rnd() < 0.35 * (1 - this.w.anzeige),
        punkt: { x: q.x + Math.cos(winkel) * abstand, y: q.y + Math.sin(winkel) * abstand },
        unsicher: !richtig,
      };
      this.setzeZustand('anzeigeEinnehmen');
      ctx.melde({ typ: 'anzeigeBeginn', richtig });
    }

    updateAnzeigeEinnehmen(dt) {
      const a = this.anzeige;
      this.rute = a.richtig ? 0.9 : 0.4;
      this.bewegeZu(a.punkt, 0.6, dt);
      if (Math.hypot(a.punkt.x - this.x, a.punkt.y - this.y) < 0.03 || this.zustandSeit > 2) {
        this.richtung = Math.atan2(a.quelle.y - this.y, a.quelle.x - this.x);
        this.liegt = true;
        this.setzeZustand('anzeige');
      }
    }

    updateAnzeige(dt, ctx) {
      const a = this.anzeige;
      this.liegt = true;
      this.naseTief = true;
      this.aktivAnim = a.aktiv;
      this.ruteHoch = false;
      this.rute = a.richtig ? 0.25 : 0.1;
      if (this.blickZuHF > 0) this.blickZuHF -= dt;
      const ruhe = this.w.anzeige * (this.stabil > 0 ? 1.6 : 1);
      const unsicher = a.richtig ? 1 : 2.2;
      if (this.blickZuHF <= 0 && this.rnd() < dt * 0.35 * (1 - ruhe) * unsicher) {
        this.blickZuHF = 0.9;
        ctx.melde({ typ: 'blick' });
      }
      const aufloeseRate = dt * 0.05 * Math.max(0.05, 1 - ruhe) * (a.richtig ? 1 : 3) * (ctx.anzeigeGemeldet ? 0.6 : 1);
      if (this.zustandSeit > 1.5 && this.rnd() < aufloeseRate) {
        ctx.melde({ typ: 'aufstehen' });
        if (ctx.anzeigeGemeldet) {
          // Hund steht kurz auf und legt sich wieder ab - Fehler, aber Anzeige bleibt.
          this.zustandSeit = 0;
          this.blickZuHF = 0.6;
        } else {
          this.anzeigeAufloesen(true);
        }
      }
    }

    updateSchautHF(dt, ctx) {
      this.liegt = false;
      this.rute = 0.4;
      this.naseTief = false;
      this.blickZuHF = 1;
      this.richtung = Math.atan2(ctx.hf.y - this.y, ctx.hf.x - this.x);
      if (ctx.hf.stillSeit < 0.3 || this.zustandSeit > 6 + 8 * this.w.selbststaendig) {
        this.blickZuHF = 0;
        this.setzeZustand('sucht');
        this.ziel = null;
      }
    }

    updateAussenreiz(dt, ctx) {
      this.naseTief = false;
      this.rute = 0.7;
      const p = this.reizZiel;
      if (p) {
        if (this.w.konzentration < 0.3 && this.zustandSeit < 1.2) this.bewegeZu(p, 1.6, dt);
        else this.richtung = Math.atan2(p.y - this.y, p.x - this.x);
      }
      if (this.zustandSeit > 1.8 + (1 - this.w.konzentration) * 2) {
        this.setzeZustand('sucht');
        this.ziel = null;
      }
    }

    updateHier(dt, ctx) {
      this.liegt = false;
      this.naseTief = false;
      const rest = this.bewegeZu(ctx.hf, 2.2, dt);
      if (rest < 0.7) this.setzeZustand('beiHF');
    }

    updateVerleitung(dt, ctx) {
      const v = this.verleitungsZiel;
      this.naseTief = true;
      this.rute = 0.9;
      const rest = this.bewegeZu(v, this.tempo(1.6), dt);
      if (rest > 0.15) return;
      if (!this.verleitungGeprueft) {
        this.verleitungGeprueft = true;
        this.verleitungGenommen = this.rnd() < 0.65 * (1 - this.w.impuls) + 0.03;
        if (this.verleitungGenommen) ctx.melde({ typ: 'verleitung', quelle: v });
      }
      const dauer = this.verleitungGenommen ? 2.5 : 1.0;
      this.aktivAnim = this.verleitungGenommen;
      if (this.zustandSeit > dauer) {
        this.aktivAnim = false;
        if (this.rnd() < 0.12 * (1 - this.w.differenzierung)) {
          this.starteAnzeige(v, false, ctx);
          return;
        }
        this.setzeZustand('sucht');
        this.ziel = null;
      }
    }

    pruefeVerleitungen(ctx) {
      if (this.zustand === 'verleitung' || this.zustand === 'aussenreiz') return;
      for (const q of ctx.quellen) {
        if (q.typ !== 'spielzeug' && q.typ !== 'futter') continue;
        if (this.verleitungErledigt.has(q)) continue;
        const reichweite = q.typ === 'futter' ? 1.3 : 0.9;
        if (Math.hypot(q.x - this.x, q.y - this.y) > reichweite) continue;
        this.verleitungErledigt.add(q);
        const reiz = (q.typ === 'futter' ? 0.85 : 0.65) * (1 - this.w.impuls);
        if (this.rnd() < reiz) {
          this.verleitungsZiel = q;
          this.verleitungGeprueft = false;
          this.setzeZustand('verleitung');
        }
        return;
      }
    }

    leineBegrenzen(ctx) {
      const d = Math.hypot(this.x - ctx.hf.x, this.y - ctx.hf.y);
      const max = 2;
      if (d > max) {
        this.x = ctx.hf.x + ((this.x - ctx.hf.x) / d) * max;
        this.y = ctx.hf.y + ((this.y - ctx.hf.y) / d) * max;
      }
    }
  }

  SHS.dog = { WERTE, RASSEN, neuerHund, SuchHund, clamp, dist };
})(globalThis.SHS = globalThis.SHS || {});
