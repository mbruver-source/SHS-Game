// SHS-Wertungsrichter: sammelt Fehler während einer Suchlage und ermittelt die Bewertung
// (60 Punkte Suchleistung + 40 Punkte Anzeigeleistung, PO III.B).
(function (SHS) {
  'use strict';
  const po = SHS.po;

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

    abzugFuer(bereich) {
      let summe = 0;
      for (const [art, anzahl] of Object.entries(this.fehlerListe)) {
        const regel = po.ABZUEGE[art];
        if (regel.bereich !== bereich) continue;
        summe += Math.min(regel.max, regel.punkte * anzahl);
      }
      if (bereich === 'such') summe += this.intensitaetsAbzug;
      return summe;
    }

    ergebnis() {
      if (this.status === 'disq' || this.status === 'abbruch') {
        return {
          status: this.status, punkte: null, such: 0, anzeige: 0, fehler: { ...this.fehlerListe }, intensitaet: this.intensitaetsAbzug,
          gefunden: this.gefunden, fehlanzeigen: this.fehlanzeigen,
          begruendung: [this.statusGrund, ...this.protokoll],
        };
      }
      const such = Math.max(0, po.MAX_SUCHLEISTUNG - this.abzugFuer('such'));
      const anzeige = this.gefunden ? Math.max(0, po.MAX_ANZEIGELEISTUNG - this.abzugFuer('anzeige')) : 0;
      const punkte = Math.max(0, such + anzeige - this.fehlanzeigen * po.FEHLANZEIGE_ABZUG);
      return {
        status: 'ok', punkte, such, anzeige, fehler: { ...this.fehlerListe }, intensitaet: this.intensitaetsAbzug,
        gefunden: this.gefunden, fehlanzeigen: this.fehlanzeigen,
        bestanden: punkte >= po.MINDESTPUNKTE_JE_DISZIPLIN,
        begruendung: this.begruendung(such, anzeige, punkte),
      };
    }

    begruendung(such, anzeige, punkte) {
      const zeilen = [];
      const anzahlText = (art) => {
        const n = this.fehlerListe[art];
        return n > 1 ? ` (${n}×)` : '';
      };
      for (const art of Object.keys(this.fehlerListe)) {
        const r = po.ABZUEGE[art];
        const abzug = Math.min(r.max, r.punkte * this.fehlerListe[art]);
        zeilen.push(`${r.text}${anzahlText(art)}: −${abzug}`);
      }
      if (this.intensitaetsAbzug > 0) zeilen.push(`${po.ABZUEGE.intensitaet.text}: −${this.intensitaetsAbzug}`);
      if (this.fehlanzeigen > 0) zeilen.push(`Fehlanzeigen (${this.fehlanzeigen}×): −${this.fehlanzeigen * po.FEHLANZEIGE_ABZUG}`);
      if (!this.gefunden) zeilen.push('Gegenstand nicht gefunden – keine Anzeigeleistung');
      let fazit;
      if (punkte >= 96) fazit = 'Zielstrebig, intensiv und freudig gearbeitet, spontane und ruhige Anzeige.';
      else if (punkte >= 90) fazit = 'Sehr gute Arbeit mit kleinen Unsauberkeiten.';
      else if (punkte >= 80) fazit = 'Gute Suche, einige Fehler.';
      else if (punkte >= 70) fazit = 'Befriedigende Leistung mit deutlichen Fehlern.';
      else fazit = 'Die Anforderungen wurden nicht erfüllt.';
      zeilen.unshift(`Suchleistung ${such}/60, Anzeigeleistung ${anzeige}/40. ${fazit}`);
      return zeilen;
    }
  }

  SHS.Wertungsrichter = Wertungsrichter;
})(globalThis.SHS = globalThis.SHS || {});
