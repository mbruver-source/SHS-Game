// SHS-Wertungsrichter: sammelt Fehler während einer Suchlage und ermittelt die Bewertung
// (60 Punkte Suchleistung + 40 Punkte Anzeigeleistung, PO III.B).
(function (SHS) {
  'use strict';
  const po = SHS.po;
  const NOTE_NAME = { SG: 'Sehr Gut', G: 'Gut' };

  class Wertungsrichter {
    constructor(lk, disziplin) {
      this.lk = lk;
      this.disziplin = disziplin;
      this.fehlerListe = {}; // art -> Anzahl
      this.fehlanzeigen = 0;
      this.intensitaetsAbzug = 0;
      this.gefunden = false;
      this.status = 'laeuft'; // laeuft | fertig | abbruch | disq
      this.statusGrund = '';
      this.protokoll = [];
    }

    fehler(art, notiz) {
      if (!po.ABZUEGE[art]) throw new Error('Unbekannte Fehlerart: ' + art);
      this.fehlerListe[art] = (this.fehlerListe[art] || 0) + 1;
      this.protokoll.push(notiz || po.ABZUEGE[art].text);
    }

    // Anteil (0..1) der Suchzeit ohne intensive/selbstständige Suche.
    setzeIntensitaet(anteilSchwach) {
      const max = po.ABZUEGE.intensitaet.max;
      this.intensitaetsAbzug = Math.round(Math.max(0, Math.min(1, anteilSchwach)) * max);
    }

    // Vom HF angenommene Fehlanzeige: 10 Punkte Abzug, bei der dritten Abbruch/Disqualifikation.
    fehlanzeige() {
      this.fehlanzeigen += 1;
      this.protokoll.push(`Fehlanzeige (${this.fehlanzeigen}.) – ${po.FEHLANZEIGE_ABZUG} Punkte Abzug`);
      if (this.fehlanzeigen >= po.FEHLANZEIGEN_BIS_ABBRUCH) {
        this.status = 'disq';
        this.statusGrund = 'Dreimalige Fehlanzeige – Vorführung abgebrochen (Disqualifikation)';
        return { abbruch: true };
      }
      return { abbruch: false };
    }

    fund() {
      this.gefunden = true;
      this.status = 'fertig';
    }

    zeitAbgelaufen() {
      if (this.status === 'laeuft') this.status = 'fertig';
      this.protokoll.push('Suchzeit abgelaufen – nur die Suchleistung wird bewertet');
    }

    abbruchUngehorsam(grund) {
      this.status = 'abbruch';
      this.statusGrund = grund || 'Abbruch wegen Ungehorsams des Hundes';
    }

    // Punktabzüge eines Bereichs (Notendeckel zählen hier nicht mit).
    abzugFuer(bereich) {
      let summe = 0;
      for (const [art, anzahl] of Object.entries(this.fehlerListe)) {
        const regel = po.ABZUEGE[art];
        if (regel.bereich !== bereich || !regel.punkte) continue;
        summe += Math.min(regel.max, regel.punkte * anzahl);
      }
      if (bereich === 'such') summe += this.intensitaetsAbzug;
      return summe;
    }

    // Niedrigster Notendeckel („Max. SG/G“) eines Bereichs: { punkte, note, text } oder null.
    deckelFuer(bereich) {
      let best = null;
      for (const art of Object.keys(this.fehlerListe)) {
        const regel = po.ABZUEGE[art];
        if (regel.bereich !== bereich || !regel.deckel) continue;
        const grenze = po.OBERGRENZE[bereich][regel.deckel];
        if (!best || grenze < best.punkte) best = { punkte: grenze, note: regel.deckel, text: regel.text };
      }
      return best;
    }

    // Teilleistung = Höchstpunkte minus Punktabzüge, nicht über dem niedrigsten Notendeckel.
    teilPunkte(bereich, hoechst) {
      const deckel = this.deckelFuer(bereich);
      const rest = hoechst - this.abzugFuer(bereich);
      // Halbe Punkte (ausgelassene Behältnisse) werden kaufmännisch auf ganze Punkte gerundet.
      return Math.max(0, Math.round(deckel ? Math.min(deckel.punkte, rest) : rest));
    }

    ergebnis() {
      if (this.status === 'disq' || this.status === 'abbruch') {
        return {
          status: this.status, punkte: null, such: 0, anzeige: 0, fehler: { ...this.fehlerListe }, intensitaet: this.intensitaetsAbzug,
          gefunden: this.gefunden, fehlanzeigen: this.fehlanzeigen,
          begruendung: [this.statusGrund, ...this.protokoll],
        };
      }
      const such = this.teilPunkte('such', po.MAX_SUCHLEISTUNG);
      const anzeige = this.gefunden ? this.teilPunkte('anzeige', po.MAX_ANZEIGELEISTUNG) : 0;
      const punkte = Math.max(0, such + anzeige - this.fehlanzeigen * po.FEHLANZEIGE_ABZUG);
      return {
        status: 'ok', punkte, such, anzeige, fehler: { ...this.fehlerListe }, intensitaet: this.intensitaetsAbzug,
        gefunden: this.gefunden, fehlanzeigen: this.fehlanzeigen,
        bestanden: punkte >= po.MINDESTPUNKTE_JE_DISZIPLIN,
        begruendung: this.begruendung(such, anzeige, punkte),
        blatt: this.blatt(such, anzeige, punkte),
      };
    }

    // Strukturierte Bewertung („Richterblatt“): je Teilleistung Punkte, Note, Abzüge und Deckel.
    blatt(such, anzeige, punkte) {
      const teil = (bereich, hoechst, wert) => {
        const abzuege = [];
        for (const [art, n] of Object.entries(this.fehlerListe)) {
          const r = po.ABZUEGE[art];
          if (r.bereich !== bereich) continue;
          abzuege.push({ text: r.text, anzahl: n, abzug: r.punkte ? Math.min(r.max, r.punkte * n) : 0, deckel: r.deckel || null });
        }
        if (bereich === 'such' && this.intensitaetsAbzug > 0) {
          abzuege.push({ text: po.ABZUEGE.intensitaet.text, anzahl: 1, abzug: this.intensitaetsAbzug, deckel: null });
        }
        const d = this.deckelFuer(bereich);
        return { bereich, punkte: wert, hoechst, note: po.teilnote(wert, bereich), abzuege, deckel: d ? { punkte: d.punkte, note: d.note } : null };
      };
      return {
        such: teil('such', po.MAX_SUCHLEISTUNG, such),
        anzeige: teil('anzeige', po.MAX_ANZEIGELEISTUNG, anzeige),
        gefunden: this.gefunden, fehlanzeigen: this.fehlanzeigen, fehlanzeigeAbzug: this.fehlanzeigen * po.FEHLANZEIGE_ABZUG,
        gesamt: punkte, fazit: this.fazit(punkte),
      };
    }

    fazit(punkte) {
      if (punkte >= 96) return 'Zielstrebig, intensiv und freudig gearbeitet, spontane und ruhige Anzeige.';
      if (punkte >= 90) return 'Sehr gute Arbeit mit kleinen Unsauberkeiten.';
      if (punkte >= 80) return 'Gute Suche, einige Fehler.';
      if (punkte >= 70) return 'Befriedigende Leistung mit deutlichen Fehlern.';
      return 'Die Anforderungen wurden nicht erfüllt.';
    }

    begruendung(such, anzeige, punkte) {
      const zeilen = [];
      const anzahlText = (art) => {
        const n = this.fehlerListe[art];
        return n > 1 ? ` (${n}×)` : '';
      };
      for (const art of Object.keys(this.fehlerListe)) {
        const r = po.ABZUEGE[art];
        if (r.punkte) {
          const abzug = Math.min(r.max, r.punkte * this.fehlerListe[art]);
          zeilen.push(`${r.text}${anzahlText(art)}: −${String(abzug).replace('.', ',')}`);
        } else {
          zeilen.push(`${r.text}${anzahlText(art)}: ${r.bereich === 'such' ? 'Suchleistung' : 'Anzeige'} höchstens ${NOTE_NAME[r.deckel]} (${po.OBERGRENZE[r.bereich][r.deckel]})`);
        }
      }
      if (this.intensitaetsAbzug > 0) zeilen.push(`${po.ABZUEGE.intensitaet.text}: −${this.intensitaetsAbzug}`);
      if (this.fehlanzeigen > 0) zeilen.push(`Fehlanzeigen (${this.fehlanzeigen}×): −${this.fehlanzeigen * po.FEHLANZEIGE_ABZUG}`);
      if (!this.gefunden) zeilen.push('Gegenstand nicht gefunden – keine Anzeigeleistung');
      const fazit = this.fazit(punkte);
      const note = (p, bereich) => { const n = po.teilnote(p, bereich); return n ? ` (${n})` : ''; };
      zeilen.unshift(`Suchleistung ${such}/60${note(such, 'such')}, Anzeigeleistung ${anzeige}/40${this.gefunden ? note(anzeige, 'anzeige') : ''}. ${fazit}`);
      return zeilen;
    }
  }

  // ---------------------------------------------------------------------------
  // Richterblatt als HTML-Text (ohne DOM-Zugriff): Notenbänder, Abzüge, Deckel.
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const zahl = (n) => String(n).replace('.', ',');
  const KURZ = ['V', 'SG', 'G', 'B'];

  function teilHtml(t, titel, ohneWertung) {
    const baender = po.TEILNOTEN[t.bereich];
    const obere = [t.hoechst].concat(baender.map((b) => b[0] - 1));
    const bandHtml = baender.map(([von, name], i) => {
      const bis = obere[i];
      const aktuell = !ohneWertung && t.note === name;
      return `<span class="band${aktuell ? ' aktuell' : ''}" title="${esc(name)}">${KURZ[i]} ${von}–${bis}</span>`;
    }).join('');
    const zeilen = t.abzuege.map((a) => {
      const anz = a.anzahl > 1 ? ` (${a.anzahl}×)` : '';
      const wert = a.abzug ? `−${zahl(a.abzug)}` : '';
      const deckel = a.deckel ? `<span class="deckel">höchstens ${esc(a.deckel === 'SG' ? 'Sehr Gut' : 'Gut')} (${po.OBERGRENZE[t.bereich][a.deckel]})</span>` : '';
      return `<tr><td>${esc(a.text)}${anz}</td><td class="zahl">${wert}${wert && deckel ? ' · ' : ''}${deckel}</td></tr>`;
    }).join('');
    const kopfWert = ohneWertung ? '– (kein Fund)' : `${t.punkte} / ${t.hoechst}${t.note ? ` · ${t.note}` : ''}`;
    return `<section class="blatt-teil"><div class="blatt-kopf"><b>${titel}</b><span>${kopfWert}</span></div>
      <div class="blatt-baender">${bandHtml}</div>
      ${zeilen ? `<table class="blatt-abzuege">${zeilen}</table>` : '<p class="klein">Keine Abzüge.</p>'}
      ${t.deckel && !ohneWertung ? `<p class="klein">Es gilt der niedrigste Deckel: höchstens ${t.deckel.punkte} Punkte.</p>` : ''}</section>`;
  }

  function blattHtml(b) {
    if (!b) return '';
    const fa = b.fehlanzeigen ? `<p class="blatt-fa">Fehlanzeigen ${b.fehlanzeigen}× · −${b.fehlanzeigeAbzug} von der Summe</p>` : '';
    return `<div class="richterblatt">${teilHtml(b.such, 'Suchleistung', false)}${teilHtml(b.anzeige, 'Anzeigeleistung', !b.gefunden)}${fa}</div>`;
  }

  SHS.Wertungsrichter = Wertungsrichter;
  SHS.richterblattHtml = blattHtml;
})(globalThis.SHS = globalThis.SHS || {});
