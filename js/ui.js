// Bildschirme und Menüs (DOM): Start, Hund anlegen, Hof, Training, Übungssuche, Prüfung, Leistungsnachweis.
(function (SHS) {
  'use strict';
  const po = SHS.po;
  const career = SHS.career;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gegName = (id) => po.GEGENSTAENDE.find((g) => g.id === id).name;
  const diszName = (d) => po.DISZIPLINEN[d].name;

  const app = { stand: null, root: null, szene: null };

  function speichern() {
    if (app.stand && !SHS.storage.speichern(app.stand)) {
      hinweis('Der Spielstand konnte im Browser nicht gespeichert werden. Bitte über „Exportieren“ sichern.');
    }
  }

  function zeige(html) {
    if (app.szene) { app.szene.aufraeumen(); app.szene = null; }
    app.root.innerHTML = html;
    app.root.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function hinweis(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4500);
  }

  function dialog(html, knoepfe) {
    const bg = document.createElement('div');
    bg.className = 'dialog-bg';
    bg.innerHTML = `<div class="dialog">${html}<div class="dialog-knoepfe"></div></div>`;
    const leiste = bg.querySelector('.dialog-knoepfe');
    (knoepfe || [{ text: 'OK', primaer: true }]).forEach((k) => {
      const b = document.createElement('button');
      b.textContent = k.text;
      if (k.primaer) b.className = 'primaer';
      b.addEventListener('click', () => { if (k.aktion && k.aktion(bg) === false) return; bg.remove(); });
      leiste.appendChild(b);
    });
    document.body.appendChild(bg);
    return bg;
  }

  // Zeichnet den Hund (Draufsicht, auf Gras) in ein Canvas – für Anmeldung und Hof.
  function canvasVorbereiten(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width; const h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }

  function hundPortrait(canvas, rasse, fell, liegt) {
    const { g, w, h } = canvasVorbereiten(canvas);
    g.fillStyle = '#6c9c47';
    g.fillRect(0, 0, w, h);
    const sk = Math.min(w / 1.1, h / 0.5);
    g.save();
    g.translate(w / 2 - sk * 0.05, h / 2);
    SHS.grafik.zeichneHund(g, { sk, t: 0.3, rasse, fell, liegt: !!liegt, rute: 0.6, ruteHoch: true, naseTief: false, kopfW: 0.15 });
    g.restore();
  }

  // Seitenansicht in Platzanzeige am Mehrkammereimer (wie die Nahaufnahme im Spiel).
  function hundSeitenansicht(canvas, rasse, fell) {
    const { g, w, h } = canvasVorbereiten(canvas);
    SHS.grafik.zeichneAnzeigeSzene(g, w, h, {
      rasse, fell, disziplin: 'behaeltnis', lk: 1, quelleHoehe: 0.12, quelleTyp: 'ziel', abstand: 0.1, rute: 0.3, t: 0.5,
    });
  }

  function fellOptionen(rasse, gewaehlt) {
    return Object.entries(SHS.grafik.fellVarianten(rasse))
      .map(([k, v]) => `<option value="${k}" ${k === gewaehlt ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  }

  // ------------------------------------------------------------------ Start
  function start() {
    const vorhanden = SHS.storage.laden();
    zeige(`
      <div class="startseite">
        <div class="logo">🐕‍🦺 <span>SHS</span></div>
        <h1>Spürhundesport</h1>
        <p class="unter">Training und Prüfungen nach der VDH-Spürhundesport-Prüfungsordnung</p>
        <div class="start-knoepfe">
          ${vorhanden ? `<button class="primaer gross" data-a="weiter">Weiterspielen – ${esc(vorhanden.hund.name)}, Woche ${vorhanden.woche}</button>` : ''}
          <button class="${vorhanden ? '' : 'primaer '}gross" data-a="neu">Neues Spiel</button>
          <button data-a="import">Spielstand importieren…</button>
          <input type="file" accept=".json,application/json" class="versteckt" id="importDatei">
        </div>
        <p class="version">Version ${esc(SHS.VERSION || '')} · läuft komplett offline · Spielstand bleibt in diesem Browser</p>
      </div>`);
    app.root.querySelector('.start-knoepfe').addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'weiter') { app.stand = vorhanden; hof(); }
      if (a === 'neu') {
        if (vorhanden) {
          dialog('<h3>Neues Spiel?</h3><p>Der bisherige Spielstand in diesem Browser wird überschrieben. Vorher exportieren?</p>', [
            { text: 'Abbrechen' },
            { text: 'Exportieren', aktion: () => { SHS.storage.exportieren(vorhanden); return false; } },
            { text: 'Neu beginnen', primaer: true, aktion: () => neuesSpiel() },
          ]);
        } else neuesSpiel();
      }
      if (a === 'import') app.root.querySelector('#importDatei').click();
    });
    app.root.querySelector('#importDatei').addEventListener('change', importAusDatei);
  }

  function importAusDatei(e) {
    const datei = e.target.files[0];
    if (!datei) return;
    SHS.storage.importieren(datei).then((s) => {
      app.stand = s;
      speichern();
      hinweis('Spielstand importiert.');
      hof();
    }).catch((err) => hinweis(err.message));
  }

  function neuesSpiel() {
    const rassen = Object.keys(SHS.dog.RASSEN);
    zeige(`
      <div class="karte schmal">
        <h2>Neues Team</h2>
        <label>Dein Name (Hundeführer/in)<input id="hfName" maxlength="30" placeholder="z. B. Alex"></label>
        <label>Name des Hundes<input id="hundName" maxlength="20" placeholder="z. B. Aiko"></label>
        <label>Rasse<select id="rasse">${rassen.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label>Fellfarbe<select id="fell"></select></label>
        <div class="vorschau-reihe"><canvas id="vorschau" class="hund-vorschau"></canvas><canvas id="vorschauSeite" class="hund-vorschau"></canvas></div>
        <div id="rassenInfo" class="rassen-info"></div>
        <p class="hinweis">Dein Hund ist 12 Monate alt. Prüfungen sind ab 15 Monaten möglich – nutze die Zeit für die Grundausbildung.
        Den Korken kennt er schon ein wenig.</p>
        <div class="knopfreihe"><button data-a="zurueck">Zurück</button><button class="primaer" data-a="los">Los geht's</button></div>
      </div>`);
    const q = (s) => app.root.querySelector(s);
    const vorschau = () => {
      hundPortrait(q('#vorschau'), q('#rasse').value, q('#fell').value);
      hundSeitenansicht(q('#vorschauSeite'), q('#rasse').value, q('#fell').value);
    };
    const info = () => {
      const r = q('#rasse').value;
      const mod = SHS.dog.RASSEN[r];
      const teile = Object.entries(mod).filter(([k]) => SHS.dog.WERTE[k])
        .map(([k, v]) => `${SHS.dog.WERTE[k]} ${v > 0 ? '+' : ''}${v}`);
      q('#rassenInfo').textContent = teile.join(' · ');
      q('#fell').innerHTML = fellOptionen(r);
      vorschau();
    };
    q('#rasse').addEventListener('change', info);
    q('#fell').addEventListener('change', vorschau);
    info();
    app.root.querySelector('.knopfreihe').addEventListener('click', (e) => {
      if (e.target.dataset.a === 'zurueck') start();
      if (e.target.dataset.a === 'los') {
        const hf = app.root.querySelector('#hfName').value.trim() || 'Hundeführer';
        const hund = app.root.querySelector('#hundName').value.trim() || 'Hund';
        app.stand = career.neuerSpielstand(hf, hund, q('#rasse').value, SHS.neuerSeed());
        app.stand.hund.fell = q('#fell').value;
        speichern();
        hof();
      }
    });
  }

  // ------------------------------------------------------------------ Hof (Hauptbildschirm)
  function balken(wert, max) {
    const p = Math.round((wert / (max || 100)) * 100);
    return `<div class="balken"><div style="width:${p}%"></div></div>`;
  }

  function hof() {
    const s = app.stand;
    const h = s.hund;
    const frei = career.TRAININGS_JE_WOCHE - s.trainingsDieseWoche;
    const werte = Object.entries(SHS.dog.WERTE).map(([k, n]) =>
      `<tr><td>${n}</td><td>${balken(h.werte[k])}</td><td class="zahl">${Math.round(h.werte[k])}</td></tr>`).join('');
    const vertraut = po.GEGENSTAENDE.map((g) =>
      `<tr><td>${g.name}</td><td>${balken(h.vertrautheit[g.id] * 100)}</td><td class="zahl">${Math.round(h.vertrautheit[g.id] * 100)}</td></tr>`).join('');
    const ausschreibungen = s.ausschreibungen.map((a) => {
      const diese = a.woche === s.woche;
      const art = a.art === 'DK' ? 'Dreikampf' : `Einzeldisziplin ${diszName(a.disziplin)}`;
      let aktion = `<span class="klein">in ${a.woche - s.woche} Woche(n)</span>`;
      if (diese) {
        aktion = career.darfPruefen(s)
          ? `<button class="primaer" data-pruefung="${a.id}">Starten</button>`
          : `<span class="klein warn">Hund zu jung (mind. ${po.MINDESTALTER_MONATE} Monate)</span>`;
      }
      return `<li class="${diese ? 'diese' : ''}"><div><b>${esc(a.verein)}</b> – ${art}, LK ${s.lk}<br>
        <span class="klein">Sa., ${career.datumText(a.woche)}</span></div>${aktion}</li>`;
    }).join('');
    const letzte = s.leistungsnachweis.slice(-3).reverse().map(eintragZeile).join('') || '<tr><td colspan="4" class="klein">Noch keine Prüfungen.</td></tr>';

    zeige(`
      <div class="hof">
        <header class="hof-kopf">
          <canvas class="hund-portrait" title="Fellfarbe ändern"></canvas>
          <div class="hof-name"><h1>${esc(h.name)} <small>${esc(h.rasse)}</small></h1>
            <div class="klein">HF ${esc(s.hf.name)} (Erfahrung ${Math.round(career.hfErfahrung(s) * 100)} %) · ${career.alterText(h.alterMonate)} · Leistungsklasse <b>LK ${s.lk}</b></div></div>
          <div class="woche"><div>Woche ${s.woche}</div><div class="klein">bis Sa., ${career.datumText(s.woche)}</div></div>
        </header>
        <div class="spalten">
          <section class="karte">
            <h2>Dein Hund</h2>
            <div class="energie" title="Sinkt mit jedem Training, erholt sich an den freien Tagen (Di, Do) und am Wochenende.">Energie ${balken(h.energie * 100)}</div>
            <table class="werte">${werte}</table>
            <h3>Geruchsbild der Gegenstände</h3>
            <table class="werte">${vertraut}</table>
          </section>
          <section class="karte">
            <h2>Training <small>${frei ? `nächste Einheit: ${career.naechsterTrainingstag(s)}` : 'diese Woche erledigt'}</small></h2>
            <div class="wochenplan">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((tag, i) => {
              const einheit = [0, 2, 4].indexOf(i);
              const cls = einheit >= 0 ? (einheit < s.trainingsDieseWoche ? 'erledigt' : 'training') : 'ruhe';
              return `<span class="${cls}" title="${einheit >= 0 ? 'Trainingstag' : 'Erholung'}">${tag}</span>`;
            }).join('')}</div>
            <div class="trainings">
              ${Object.entries(career.TRAININGS).map(([k, t]) => `<button data-training="${k}" ${frei ? '' : 'disabled'} title="${esc(t.text)}"><b>${t.name}</b><span>${t.text}</span></button>`).join('')}
              <button data-a="uebung" class="uebung"><b>Übungssuche</b><span>Behältnis, Trümmer oder Fläche frei üben – mit Geruchsansicht. ${frei ? 'Zählt als Trainingseinheit.' : 'Diese Woche ohne Trainingseffekt.'}</span></button>
            </div>
            <div class="knopfreihe"><button class="primaer" data-a="woche">Woche beenden ▶</button></div>
            ${aufstiegHtml(s)}
            <h2>Ausschreibungen</h2>
            <ul class="ausschreibungen">${ausschreibungen}</ul>
          </section>
        </div>
        <section class="karte">
          <h2>Leistungsnachweis <small><a href="#" data-a="ln">alle anzeigen</a></small></h2>
          <table class="ln">${letzte}</table>
          <div class="knopfreihe links">
            <button data-a="regeln">Regeln (PO-Kurzfassung)</button>
            <button data-a="export">Spielstand exportieren</button>
            <button data-a="import">Importieren…</button>
            <button data-a="start">Hauptmenü</button>
            <input type="file" accept=".json,application/json" class="versteckt" id="importDatei">
          </div>
        </section>
      </div>`);

    hundPortrait(app.root.querySelector('.hund-portrait'), h.rasse, h.fell, true);
    app.root.querySelector('.hund-portrait').addEventListener('click', fellAendern);
    app.root.querySelector('.hof').addEventListener('click', (e) => {
      const z = e.target.closest('[data-training],[data-a],[data-pruefung]');
      if (!z) return;
      e.preventDefault();
      if (z.dataset.training) trainingStarten(z.dataset.training);
      const a = z.dataset.a;
      if (a === 'uebung') uebungAuswahl();
      if (a === 'woche') wocheBeenden();
      if (a === 'ln') leistungsnachweis();
      if (a === 'regeln') regeln();
      if (a === 'export') SHS.storage.exportieren(s);
      if (a === 'import') app.root.querySelector('#importDatei').click();
      if (a === 'start') start();
      if (z.dataset.pruefung) pruefungAnmeldung(s.ausschreibungen.find((x) => x.id === z.dataset.pruefung));
    });
    app.root.querySelector('#importDatei').addEventListener('change', importAusDatei);
  }

  function fellAendern() {
    const h = app.stand.hund;
    const bg = dialog(`<h3>Fellfarbe von ${esc(h.name)}</h3>
      <label>Fellfarbe (${esc(h.rasse)})<select id="fellNeu">${fellOptionen(h.rasse, h.fell)}</select></label>
      <div class="vorschau-reihe"><canvas id="fv1" class="hund-vorschau"></canvas><canvas id="fv2" class="hund-vorschau"></canvas></div>`, [
      { text: 'Abbrechen' },
      { text: 'Übernehmen', primaer: true, aktion: (d) => { h.fell = d.querySelector('#fellNeu').value; speichern(); hof(); } },
    ]);
    const zeichne = () => {
      const f = bg.querySelector('#fellNeu').value;
      hundPortrait(bg.querySelector('#fv1'), h.rasse, f);
      hundSeitenansicht(bg.querySelector('#fv2'), h.rasse, f);
    };
    bg.querySelector('#fellNeu').addEventListener('change', zeichne);
    zeichne();
  }

  // Fortschritt zum Klassenaufstieg: Bestwerte der aktuellen LK je Disziplin (ED und DK zählen).
  function aufstiegHtml(s) {
    if (s.lk >= 3) {
      return '<div class="aufstieg"><b>Leistungsklasse 3</b> – die höchste Stufe ist erreicht.</div>';
    }
    const best = s.lkBestwerte[s.lk];
    const felder = po.DISZIPLIN_REIHENFOLGE.map((d) => {
      const v = best[d];
      const ok = v >= po.MINDESTPUNKTE_JE_DISZIPLIN;
      return `<span class="${ok ? 'ok' : ''}">${ok ? '✔' : '○'} ${diszName(d)}: ${v === undefined ? '–' : v + ' P.'}</span>`;
    }).join('');
    const fehlt = po.DISZIPLIN_REIHENFOLGE.filter((d) => !(best[d] >= po.MINDESTPUNKTE_JE_DISZIPLIN)).length;
    return `<div class="aufstieg"><b>Aufstieg in LK ${s.lk + 1}</b> <span class="klein">– in jeder Disziplin mind. 70 Punkte in LK ${s.lk}
      (Bestwerte aus Dreikampf und Einzeldisziplinen)${fehlt ? `, noch ${fehlt} offen` : ''}</span>
      <div class="aufstieg-felder">${felder}</div></div>`;
  }

  function deltasText(d) {
    return Object.entries(d).filter(([k, v]) => k !== 'hinweis' && Math.abs(v) >= 0.05)
      .map(([k, v]) => `<li>${esc(SHS.dog.WERTE[k] || k)} <b>+${v.toFixed(1)}</b></li>`).join('') || '<li>Kaum Fortschritt.</li>';
  }

  function trainingStarten(art) {
    const t = career.TRAININGS[art];
    if (t.mitGegenstand) {
      const opts = po.GEGENSTAENDE.map((g) => `<option value="${g.id}">${g.name} (${Math.round(app.stand.hund.vertrautheit[g.id] * 100)})</option>`).join('');
      dialog(`<h3>${t.name}</h3><p>${t.text}</p><label>Gegenstand<select id="tg">${opts}</select></label>`, [
        { text: 'Abbrechen' },
        { text: 'Trainieren', primaer: true, aktion: (bg) => { trainingAusfuehren(art, bg.querySelector('#tg').value); } },
      ]);
    } else trainingAusfuehren(art);
  }

  function trainingAusfuehren(art, gegenstand) {
    const r = career.trainieren(app.stand, art, gegenstand);
    if (!r.ok) { hinweis(r.text); return; }
    speichern();
    hof();
    dialog(`<h3>${esc(r.text)}</h3><ul>${deltasText(r.deltas)}</ul>${r.deltas.hinweis ? `<p class="hinweis">${r.deltas.hinweis}</p>` : ''}`);
  }

  function wocheBeenden() {
    const s = app.stand;
    const verpasst = s.ausschreibungen.filter((a) => a.woche === s.woche && !a.erledigt);
    const weiter = () => {
      career.wocheBeenden(s);
      speichern();
      hof();
      if (s.hund.alterMonate >= po.MINDESTALTER_MONATE && s.hund.alterMonate - 7 / 30.44 < po.MINDESTALTER_MONATE) {
        dialog(`<h3>${esc(s.hund.name)} ist jetzt 15 Monate alt</h3><p>Ab sofort darf er an Prüfungen teilnehmen.</p>`);
      }
    };
    if (verpasst.length && career.darfPruefen(s)) {
      dialog('<h3>Prüfung diese Woche</h3><p>Diese Woche findet eine Prüfung statt, für die du noch nicht gestartet bist. Woche trotzdem beenden?</p>',
        [{ text: 'Zurück' }, { text: 'Woche beenden', primaer: true, aktion: weiter }]);
    } else weiter();
  }

  // ------------------------------------------------------------------ Übungssuche
  function uebungAuswahl() {
    const s = app.stand;
    const gopts = po.GEGENSTAENDE.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
    dialog(`
      <h3>Übungssuche</h3>
      <label>Disziplin<select id="ud">${po.DISZIPLIN_REIHENFOLGE.map((d) => `<option value="${d}">${diszName(d)}</option>`).join('')}</select></label>
      <label>Leistungsklasse<select id="ul">${[1, 2, 3].map((l) => `<option ${l === s.lk ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Gegenstand<select id="ug">${gopts}</select></label>
      <label>Ansatz<select id="ua"></select></label>
      <label class="check"><input type="checkbox" id="uleine" checked> mit Leine (wo erlaubt)</label>
      <label class="check"><input type="checkbox" id="ureize" checked> Außenreize</label>
      <label class="check"><input type="checkbox" id="uauto"> Automatisch vorführen (zuschauen)</label>
      <p class="hinweis">In der Übung kannst du mit G die Geruchsfahne einblenden.</p>`, [
      { text: 'Abbrechen' },
      {
        text: 'Suche starten', primaer: true, aktion: (bg) => {
          const q = (id) => bg.querySelector(id);
          suchlageStarten({
            disziplin: q('#ud').value, lk: +q('#ul').value, seed: SHS.neuerSeed(), hund: s.hund,
            gegenstand: q('#ug').value, ansatzIndex: +q('#ua').value, leine: q('#uleine').checked,
            aussenreize: q('#ureize').checked, modus: 'uebung',
            auto: q('#uauto').checked, hfErfahrung: career.hfErfahrung(s),
          }, (erg) => {
            if (erg) {
              const d = career.uebungssucheVerbuchen(s, erg, q('#ug').value);
              speichern();
              hof();
              if (d) dialog(`<h3>Übungssuche verbucht</h3><ul>${deltasText(d)}</ul>`);
            } else hof();
          });
        },
      },
    ]);
    const bg = document.querySelector('.dialog-bg:last-child');
    const ansatzFuellen = () => {
      const d = bg.querySelector('#ud').value;
      const ops = d === 'truemmer' ? ['Nordseite', 'Ostseite', 'Südseite', 'Westseite']
        : d === 'flaeche' ? ['Ansatz A (Anfang des Mittelwegs)', 'Ansatz B (Ende des Mittelwegs)'] : ['bestimmt der WR'];
      bg.querySelector('#ua').innerHTML = ops.map((o, i) => `<option value="${i}">${o}</option>`).join('');
    };
    bg.querySelector('#ud').addEventListener('change', ansatzFuellen);
    ansatzFuellen();
  }

  function suchlageStarten(opts, onEnde) {
    zeige('<div class="szene-host"></div>');
    const host = app.root.querySelector('.szene-host');
    app.szene = new SHS.SuchSzene(host, Object.assign({}, opts, {
      onEnde: (erg) => { app.szene = null; onEnde(erg); },
    }));
  }

  // ------------------------------------------------------------------ Prüfung
  function pruefungAnmeldung(a) {
    const s = app.stand;
    const lk = s.lk;
    const disz = SHS.competition.disziplinenDer(a);
    const benoetigt = a.art === 'DK' ? po.LK[lk].gegenstaende : 1;
    // Vorauswahl: die bestbekannten Gegenstände so verteilen, dass die LK-Vorgabe erfüllt ist.
    const nachVertrautheit = po.GEGENSTAENDE.map((g) => g.id).sort((x, y) => s.hund.vertrautheit[y] - s.hund.vertrautheit[x]);
    const zeilen = disz.map((d, i) => {
      const vorwahl = nachVertrautheit[i % benoetigt];
      const gopts = po.GEGENSTAENDE.map((g) => `<option value="${g.id}" ${g.id === vorwahl ? 'selected' : ''}>${g.name} (${Math.round(s.hund.vertrautheit[g.id] * 100)})</option>`).join('');
      const ansatz = d === 'truemmer' ? ['Nordseite', 'Ostseite', 'Südseite', 'Westseite']
        : d === 'flaeche' ? ['Ansatz A (Anfang des Mittelwegs)', 'Ansatz B (Ende des Mittelwegs)'] : null;
      const leine = po.leineErlaubt(lk, d);
      return `<tr data-d="${d}"><td><b>${diszName(d)}</b><br><span class="klein">${po.suchzeit(lk, d) / 60} min Suchzeit</span></td>
        <td><select class="g">${gopts}</select></td>
        <td>${ansatz ? `<select class="a">${ansatz.map((o, k) => `<option value="${k}">${o}</option>`).join('')}</select>` : '<span class="klein">bestimmt der WR</span>'}</td>
        <td>${leine ? `<label class="check"><input type="checkbox" class="l" checked> ${d === 'flaeche' ? '5-m-Schleppleine' : '2-m-Leine'}</label>` : '<span class="klein">ohne Leine</span>'}</td></tr>`;
    }).join('');
    const anf = po.LK[lk];
    zeige(`
      <div class="karte">
        <h2>Anmeldung: ${esc(a.verein)} – ${a.art === 'DK' ? 'SHS-Dreikampf' : 'SHS-Einzeldisziplin'}, LK ${lk}</h2>
        <p>HF <b>${esc(s.hf.name)}</b> mit <b>${esc(s.hund.name)}</b> · Sa., ${career.datumText(a.woche)} · ${po.MINDEST_TEILNEHMER} Teams gemeldet</p>
        <div class="regel-box">
          <b>Anforderungen LK ${lk}:</b> ${anf.gegenstaende === 1 ? 'ein Suchgegenstand' : anf.gegenstaende + ' Suchgegenstände'}${lk === 1 ? ', keine Verleitungen' : lk === 2 ? ', Spielzeug- und Eigengeruchsverleitungen' : ', Spielzeug-, Futter- und Eigengeruchsverleitungen sowie Differenzierung'}.
          Anzeigedauer ${lk === 3 ? '3 s, dann neben den Hund und 5 s' : anf.anzeige.phasen[0] + ' s'}.
          ${a.art === 'DK' && benoetigt > 1 ? `<br>Jeder deiner ${benoetigt} Gegenstände muss mindestens einmal gesucht werden.` : ''}
          ${a.art === 'DK' && benoetigt === 1 ? '<br>In LK 1 wird in allen Disziplinen derselbe Gegenstand gesucht.' : ''}
        </div>
        <table class="anmeldung"><tr><th>Disziplin</th><th>Gegenstand</th><th>Ansatz</th><th>Leine</th></tr>${zeilen}</table>
        <p class="hinweis">Die Zahl hinter dem Gegenstand zeigt, wie gut ${esc(s.hund.name)} dessen Geruchsbild kennt.
        ${disz.includes('flaeche') ? '<br><b>Fläche:</b> Der Hundeführer darf sich nur auf dem Mittelweg bewegen.' : ''}</p>
        <label>Vorführung<select id="vorfuehrung">
          <option value="selbst">Selbst führen</option>
          <option value="auto">Automatisch nach Trainingsstand – zuschauen</option>
          <option value="sofort">Automatisch nach Trainingsstand – sofort auswerten</option>
        </select></label>
        <p class="hinweis">Automatisch: Das Ergebnis ergibt sich aus den Werten von ${esc(s.hund.name)} und deiner HF-Erfahrung
        (${Math.round(career.hfErfahrung(s) * 100)} %, wächst mit Training, Übungssuchen und Prüfungen).
        Energie von ${esc(s.hund.name)}: ${Math.round(s.hund.energie * 100)} %.</p>
        <div class="knopfreihe"><button data-a="zurueck">Zurück</button><button class="primaer" data-a="melden">Anmelden und starten</button></div>
      </div>`);
    app.root.querySelector('.knopfreihe').addEventListener('click', (e) => {
      if (e.target.dataset.a === 'zurueck') hof();
      if (e.target.dataset.a !== 'melden') return;
      const plan = [...app.root.querySelectorAll('tr[data-d]')].map((tr) => ({
        disziplin: tr.dataset.d,
        gegenstand: tr.querySelector('.g').value,
        ansatzIndex: tr.querySelector('.a') ? +tr.querySelector('.a').value : 0,
        leine: tr.querySelector('.l') ? tr.querySelector('.l').checked : false,
      }));
      const verschieden = new Set(plan.map((p) => p.gegenstand)).size;
      if (a.art === 'DK' && verschieden !== benoetigt) {
        hinweis(`In LK ${lk} müssen genau ${benoetigt} verschiedene Gegenstände eingesetzt werden (gewählt: ${verschieden}).`);
        return;
      }
      const vorfuehrung = app.root.querySelector('#vorfuehrung').value;
      pruefungsAblauf({ ausschreibung: a, lk, plan, vorfuehrung, idx: 0, einzelwerte: {}, details: {}, status: 'ok', startNr: 1 + (a.seed % po.MINDEST_TEILNEHMER) });
    });
  }

  function pruefungsAblauf(p) {
    const s = app.stand;
    if (p.idx >= p.plan.length || p.status === 'disq') { pruefungAbschluss(p); return; }
    const schritt = p.plan[p.idx];
    const titel = `${p.ausschreibung.verein} · ${diszName(schritt.disziplin)} · LK ${p.lk} · Start-Nr. ${p.startNr}`;
    const suchOpts = {
      disziplin: schritt.disziplin, lk: p.lk, seed: (p.ausschreibung.seed + p.idx * 7919 + 17) >>> 0,
      hund: s.hund, gegenstand: schritt.gegenstand, ansatzIndex: schritt.ansatzIndex, leine: schritt.leine,
      modus: 'pruefung', titel, auto: p.vorfuehrung === 'auto', hfErfahrung: career.hfErfahrung(s),
    };
    const verbuchen = (erg) => {
      p.details[schritt.disziplin] = erg;
      if (erg.status === 'disq') p.status = 'disq';
      p.einzelwerte[schritt.disziplin] = erg.status === 'ok' ? erg.punkte : null;
      p.idx += 1;
      pruefungsAblauf(p);
    };
    if (p.vorfuehrung === 'sofort') { verbuchen(SHS.simuliereSuche(suchOpts, suchOpts.hfErfahrung)); return; }
    dialog(`<h3>${diszName(schritt.disziplin)}</h3>
      <p>Anmeldung beim WR in Grundstellung: „${esc(s.hf.name)}, ${esc(s.hund.name)}, Start-Nr. ${p.startNr}, Gegenstand ${gegName(schritt.gegenstand)}, LK ${p.lk}.“</p>
      <p>Du gehst mit deinem Hund außer Sicht – der WR versteckt den Gegenstand.</p>`, [{
      text: 'Zum Suchbereich', primaer: true, aktion: () => {
        suchlageStarten(suchOpts, verbuchen);
      },
    }]);
  }

  function pruefungAbschluss(p) {
    const s = app.stand;
    const a = p.ausschreibung;
    // Nicht gelaufene Disziplinen nach Disqualifikation
    for (const sch of p.plan) if (!(sch.disziplin in p.einzelwerte)) p.einzelwerte[sch.disziplin] = null;
    const eigenes = SHS.competition.auswerten(p.einzelwerte, a.art, p.status);
    zeige('<div class="karte"><h2>Auswertung läuft…</h2><p>Die übrigen Teams werden gerichtet.</p></div>');
    setTimeout(() => {
      const ki = SHS.competition.kiTeams(a, p.lk, po.MINDEST_TEILNEHMER - 1);
      const teilnehmer = ki.map((t, i) => {
        const r = SHS.competition.simuliereTeam(t, a, p.lk, i + 1);
        return { hf: t.hf, hund: t.hund.name, rasse: t.hund.rasse, einzelwerte: r.einzelwerte, ergebnis: SHS.competition.auswerten(r.einzelwerte, a.art, r.status) };
      });
      teilnehmer.push({ hf: s.hf.name, hund: s.hund.name, rasse: s.hund.rasse, einzelwerte: p.einzelwerte, ergebnis: eigenes, ich: true });
      po.platzierung(teilnehmer);
      teilnehmer.sort((x, y) => (x.platz || 99) - (y.platz || 99) || (y.ergebnis.punkte - x.ergebnis.punkte));
      const ich = teilnehmer.find((t) => t.ich);
      const eintrag = {
        pruefungId: a.id, woche: a.woche, datum: career.datumText(a.woche), verein: a.verein, art: a.art,
        lk: p.lk, einzelwerte: p.einzelwerte, punkte: eigenes.punkte, note: eigenes.text, abk: eigenes.abk,
        status: p.status, platz: ich.platz, teilnehmer: teilnehmer.length,
      };
      const { aufstieg } = career.eintragen(s, eintrag);
      speichern();
      const disz = SHS.competition.disziplinenDer(a);
      const zeilen = teilnehmer.map((t) => `<tr class="${t.ich ? 'ich' : ''}"><td>${t.platz || '–'}</td><td>${esc(t.hf)}<br><span class="klein">${esc(t.hund)} (${esc(t.rasse)})</span></td>
        ${disz.map((d) => `<td class="zahl">${t.einzelwerte[d] === null ? '–' : t.einzelwerte[d]}</td>`).join('')}
        <td class="zahl"><b>${t.ergebnis.punkte}</b></td><td>${esc(t.ergebnis.text)}</td></tr>`).join('');
      zeige(`
        <div class="karte">
          <h2>Ergebnis: ${esc(a.verein)} – ${a.art === 'DK' ? 'Dreikampf' : 'Einzeldisziplin'} LK ${p.lk}</h2>
          <p class="gross-ergebnis">${esc(s.hund.name)}: <b>${eigenes.punkte}</b> Punkte – <b>${esc(eigenes.text)}</b>${ich.platz ? ` · Platz ${ich.platz} von ${teilnehmer.length}` : ''}</p>
          ${aufstieg ? `<div class="erfolg">🎉 Klassenaufstieg! ${esc(s.hund.name)} startet ab jetzt in LK ${s.lk}.</div>` : ''}
          <table class="rangliste"><tr><th>Platz</th><th>Team</th>${disz.map((d) => `<th>${diszName(d)}</th>`).join('')}<th>Gesamt</th><th>Wertnote</th></tr>${zeilen}</table>
          <p class="hinweis">Gleiche Punktzahl = gleicher Platz, der folgende Platz entfällt. Nicht bestandene Teams werden nicht platziert.</p>
          <div class="knopfreihe"><button class="primaer" data-a="hof">Eingetragen – zurück zum Training</button></div>
        </div>`);
      app.root.querySelector('[data-a=hof]').addEventListener('click', hof);
    }, 30);
  }

  // ------------------------------------------------------------------ Leistungsnachweis & Regeln
  function eintragZeile(e) {
    const werte = Object.entries(e.einzelwerte).map(([d, v]) => `${diszName(d).replace('suche', '').replace('strecke', '')}: ${v === null ? '–' : v}`).join(', ');
    const note = e.status === 'disq' ? 'Disqualifikation' : `${e.punkte} P. – ${e.note}`;
    return `<tr><td>${e.datum}</td><td>${esc(e.verein)}<br><span class="klein">${e.art === 'DK' ? 'Dreikampf' : 'Einzeldisziplin'} LK ${e.lk}</span></td>
      <td class="klein">${werte}</td><td><b>${note}</b>${e.platz ? `<br><span class="klein">Platz ${e.platz}/${e.teilnehmer}</span>` : ''}</td></tr>`;
  }

  function leistungsnachweis() {
    const s = app.stand;
    const zeilen = s.leistungsnachweis.slice().reverse().map(eintragZeile).join('') || '<tr><td>Noch keine Einträge.</td></tr>';
    const best = [1, 2, 3].map((lk) => `<tr><td>LK ${lk}</td>${po.DISZIPLIN_REIHENFOLGE.map((d) => {
      const v = s.lkBestwerte[lk][d];
      return `<td class="zahl ${v >= 70 ? 'ok' : ''}">${v === undefined ? '–' : v}</td>`;
    }).join('')}</tr>`).join('');
    zeige(`
      <div class="karte">
        <h2>Leistungsnachweis – ${esc(s.hund.name)}</h2>
        <table class="ln">${zeilen}</table>
        <h3>Bestwerte je Leistungsklasse (Aufstieg bei ≥ 70 in jeder Disziplin)</h3>
        <table class="ln"><tr><th></th>${po.DISZIPLIN_REIHENFOLGE.map((d) => `<th>${diszName(d)}</th>`).join('')}</tr>${best}</table>
        <div class="knopfreihe"><button class="primaer" data-a="hof">Zurück</button></div>
      </div>`);
    app.root.querySelector('[data-a=hof]').addEventListener('click', hof);
  }

  function regeln() {
    dialog(`
      <h3>Spürhundesport – Kurzfassung der PO (VDH, gültig ab 01.07.2022)</h3>
      <div class="regeln">
      <p><b>Disziplinen:</b> Trümmersuche, Flächensuche, Behältnisstrecke – je 100 Punkte (60 Suchleistung + 40 Anzeigeleistung). Dreikampf = alle drei (300 P.), Einzeldisziplin = eine.</p>
      <p><b>Bestanden:</b> mindestens 70 Punkte in jeder Disziplin. Wertnoten Einzeldisziplin: V ≥ 96, SG ≥ 90, G ≥ 80, B ≥ 70. Dreikampf: V ≥ 286, SG ≥ 270, G ≥ 240, B ≥ 210.</p>
      <p><b>Suchzeit:</b> 5 Minuten, Fläche LK 2: 6, LK 3: 7 Minuten. Die Zeit bis zur Anzeige spielt keine Rolle; ohne Fund wird nur die Suchleistung bewertet.</p>
      <p><b>Anzeige:</b> passive Platzanzeige, Nase max. 20 cm von der Geruchsquelle. Der HF meldet die Anzeige durch Heben des Arms. Dauer bis zur Erwiderung des WR: LK 1 3 s, LK 2 5 s, LK 3 3 s – dann neben den Hund – 5 s.</p>
      <p><b>Fehlanzeige:</b> vom HF angenommen = 10 Punkte Abzug, nach der dritten Abbruch (Disqualifikation).</p>
      <p><b>LK 1:</b> 1 Gegenstand, keine Verleitungen; Trümmer 4×4 m, 6 Mehrkammereimer (3 Kammern), Fläche 10×20 m.<br>
      <b>LK 2:</b> 2 Gegenstände, Spielzeug- und Eigengeruchsverleitung; 8 Eimer (4 Kammern), Fläche 10×25 m.<br>
      <b>LK 3:</b> 3 Gegenstände, zusätzlich Futterverleitungen und ein baugleicher Gegenstand (Differenzierung), Hochlagen; 10 unterschiedliche Behältnisse (5 Kammern), Fläche 10×30 m, ohne Leine.</p>
      <p><b>Fläche:</b> Der HF darf sich nur auf dem 1 m breiten Mittelweg bewegen.</p>
      <p><b>Leine:</b> Trümmer und Behältnis bis LK 2 an 2-m-Leine möglich, Fläche bis LK 2 mit 5-m-Schleppleine (nicht in der Hand). Ab LK 3 ohne Leine.</p>
      <p><b>Führen</b> ist erlaubt, kostet aber Punkte. Fehler in der Suche u. a.: nachlassende Intensität, unselbstständiges Suchen, ständige Hilfen, Verlassen des Suchbereichs, Reaktion auf Außenreize, Annahme von Verleitungen, Augensuche, Randalieren. In der Anzeige: aktiv (bellen, scharren), ungenau, unruhig, Unterstützung durch den HF.</p>
      <p><b>Klassenaufstieg:</b> der Reihe nach, wenn in jeder Suchdisziplin mind. 70 Punkte erreicht wurden. Teilnahme ab 15 Monaten.</p>
      <p class="hinweis">Die Höhe der einzelnen Abzüge legt die PO nicht fest – das Spiel nutzt eigene, dokumentierte Annahmen.</p>
      </div>`);
  }

  SHS.ui = { app, start, hof };
})(globalThis.SHS = globalThis.SHS || {});
