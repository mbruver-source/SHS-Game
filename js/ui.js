// Bildschirme und Menüs (DOM): Start, Hund anlegen, Hof, Training, Übungssuche, Prüfung, Leistungsnachweis.
(function (SHS) {
  'use strict';
  const po = SHS.po;
  const career = SHS.career;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gegName = (id) => po.GEGENSTAENDE.find((g) => g.id === id).name;
  const diszName = (d) => po.DISZIPLINEN[d].name;

  // profil = Benutzer mit allen Hunden; stand = gerade aktiver Hund (Team) des Profils
  const app = { profil: null, stand: null, root: null, szene: null };

  function speichern() {
    if (!app.profil) return;
    const neu = SHS.erfolge.pruefen(app.profil);
    if (!SHS.storage.speichernProfil(app.profil)) {
      hinweis('Der Spielstand konnte im Browser nicht gespeichert werden. Bitte über „Exportieren“ sichern.');
    }
    neu.forEach((e, i) => setTimeout(() => hinweis(`${e.symbol} Erfolg: ${e.name} – ${e.text}`), 600 + i * 1800));
  }

  // Export als Datei; zusätzlich als Text zum Kopieren (z. B. für das Handy oder wo Downloads gesperrt sind)
  function exportieren() {
    app.profil.letzterExport = app.stand.woche;
    speichern();
    try { SHS.storage.exportieren(app.profil); } catch (e) { /* Download gesperrt */ }
    const text = JSON.stringify(app.profil);
    const bg = dialog(`<h3>Spielstand sichern</h3>
      <p>Die Sicherungsdatei wird heruntergeladen, sofern der Browser das erlaubt. Alternativ kopierst du den Spielstand als Text
      und fügst ihn auf einem anderen Gerät unter „Importieren“ → „Text einfügen“ ein.</p>
      <textarea id="exportText" class="spielstand-text" readonly></textarea>`, [
      { text: 'Schließen' },
      { text: 'Text kopieren', primaer: true, aktion: (d) => {
        const ta = d.querySelector('#exportText');
        const markieren = () => { ta.focus(); ta.select(); hinweis('Text markiert – jetzt kopieren (Strg+C bzw. lange tippen).'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => hinweis('Spielstand kopiert.'), markieren);
        } else markieren();
        return false;
      } },
    ]);
    bg.querySelector('#exportText').value = text;
  }

  // Import: Datei wählen oder Text einfügen
  function importAuswahl() {
    dialog(`<h3>Spielstand importieren</h3><p>Wähle eine Sicherungsdatei oder füge den kopierten Spielstand-Text ein. Der Spielstand wird als eigener Benutzer angelegt.</p>
      <textarea id="importText" class="spielstand-text" placeholder="Spielstand-Text hier einfügen"></textarea>`, [
      { text: 'Abbrechen' },
      { text: 'Datei wählen…', aktion: () => { const f = app.root.querySelector('#importDatei'); if (f) f.click(); } },
      { text: 'Text einfügen', primaer: true, aktion: (d) => {
        const t = d.querySelector('#importText').value.trim();
        if (!t) { hinweis('Bitte zuerst den Spielstand-Text einfügen.'); return false; }
        SHS.storage.importieren({ text: () => Promise.resolve(t) }).then((p) => {
          profilOeffnen(p); speichern(); hinweis(`Spielstand von ${p.hfName} importiert.`); hof();
        }).catch((err) => hinweis(err.message === 'Die Datei ist kein gültiger SHS-Spielstand.' ? 'Der Text ist kein gültiger SHS-Spielstand.' : 'Der Text konnte nicht gelesen werden.'));
        return undefined;
      } },
    ]);
  }

  function profilOeffnen(profil) {
    app.profil = profil;
    app.stand = career.aktivesTeam(profil);
  }

  function teamWechseln(i) {
    app.profil.aktiv = i;
    app.stand = app.profil.teams[i];
    speichern();
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
    const profile = SHS.storage.profile();
    const liste = profile.map((p) => `<li><button class="primaer gross" data-profil="${esc(p.id)}">${esc(p.name)}
        <span class="klein">${esc((p.hunde || []).join(', '))}</span></button>
        <button class="profil-loeschen" data-loeschen="${esc(p.id)}" title="Benutzer löschen">✕</button></li>`).join('');
    zeige(`
      <div class="startseite">
        <div class="logo">🐕‍🦺 <span>SHS</span></div>
        <h1>Spürhundesport</h1>
        <p class="unter">Training und Prüfungen nach der VDH-Spürhundesport-Prüfungsordnung</p>
        ${profile.length ? `<h3>Weiterspielen</h3><ul class="profil-liste">${liste}</ul>` : ''}
        <div class="start-knoepfe">
          <button class="${profile.length ? '' : 'primaer '}gross" data-a="neu">Neuer Benutzer</button>
          <button data-a="import">Spielstand importieren…</button>
          <input type="file" accept=".json,application/json" class="versteckt" id="importDatei">
        </div>
        <p class="version">Version ${esc(SHS.VERSION || '')} · läuft komplett offline · Spielstände bleiben in diesem Browser</p>
      </div>`);
    app.root.querySelector('.startseite').addEventListener('click', (e) => {
      const z = e.target.closest('[data-a],[data-profil],[data-loeschen]');
      if (!z) return;
      if (z.dataset.profil) {
        const p = SHS.storage.ladenProfil(z.dataset.profil);
        if (!p) { hinweis('Dieser Spielstand konnte nicht geladen werden.'); return; }
        profilOeffnen(p);
        hof();
      }
      if (z.dataset.loeschen) {
        const p = SHS.storage.ladenProfil(z.dataset.loeschen);
        dialog(`<h3>Benutzer löschen?</h3><p>Der Spielstand von <b>${esc(p ? p.hfName : '')}</b> mit allen Hunden wird aus diesem Browser gelöscht. Vorher exportieren?</p>`, [
          { text: 'Abbrechen' },
          { text: 'Exportieren', aktion: () => { if (p) SHS.storage.exportieren(p); return false; } },
          { text: 'Löschen', primaer: true, aktion: () => { SHS.storage.loeschenProfil(z.dataset.loeschen); start(); } },
        ]);
      }
      if (z.dataset.a === 'neu') neuesSpiel('profil');
      if (z.dataset.a === 'import') importAuswahl();
    });
    app.root.querySelector('#importDatei').addEventListener('change', importAusDatei);
  }

  function importAusDatei(e) {
    const datei = e.target.files[0];
    if (!datei) return;
    SHS.storage.importieren(datei).then((p) => {
      profilOeffnen(p);
      speichern();
      hinweis(`Spielstand von ${p.hfName} importiert.`);
      hof();
    }).catch((err) => hinweis(err.message));
  }

  // modus 'profil' = neuer Benutzer mit erstem Hund, 'hund' = weiteren Hund ins aktuelle Profil aufnehmen
  function neuesSpiel(modus) {
    const neuerHund = modus === 'hund';
    const rassen = Object.keys(SHS.dog.RASSEN);
    zeige(`
      <div class="karte schmal">
        <h2>${neuerHund ? `Weiteren Hund aufnehmen <small>${esc(app.profil.hfName)}</small>` : 'Neuer Benutzer'}</h2>
        ${neuerHund ? '' : `<label>Dein Name (Hundeführer/in)<input id="hfName" maxlength="30" placeholder="z. B. Alex"></label>
        <label>Schwierigkeit<select id="schwierigkeit">${Object.entries(career.SCHWIERIGKEIT).map(([k, v]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>`}
        <label>Name des Hundes<input id="hundName" maxlength="20" placeholder="z. B. Aiko"></label>
        <label>Geschlecht<select id="geschlecht"><option>Rüde</option><option>Hündin</option></select></label>
        <label>Rasse<select id="rasse">${rassen.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label>Fellfarbe<select id="fell"></select></label>
        <div class="vorschau-reihe"><canvas id="vorschau" class="hund-vorschau"></canvas><canvas id="vorschauSeite" class="hund-vorschau"></canvas></div>
        <div id="rassenInfo" class="rassen-info"></div>
        <p class="hinweis">Dein Hund ist 12 Monate alt. Prüfungen sind ab 15 Monaten möglich – nutze die Zeit für die Grundausbildung.
        Den Korken kennt dein Hund schon ein wenig.</p>
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
      if (e.target.dataset.a === 'zurueck') { if (neuerHund) hof(); else start(); }
      if (e.target.dataset.a === 'los') {
        const hund = app.root.querySelector('#hundName').value.trim() || 'Hund';
        if (neuerHund) {
          if (app.profil.teams.some((t) => t.hund.name === hund)) { hinweis('Einen Hund mit diesem Namen gibt es schon.'); return; }
          app.stand = career.hundAufnehmen(app.profil, hund, q('#rasse').value, q('#fell').value, q('#geschlecht').value);
          speichern();
          hof();
          return;
        }
        const hf = app.root.querySelector('#hfName').value.trim() || 'Hundeführer';
        profilOeffnen(career.neuesProfil(hf, hund, q('#rasse').value, q('#fell').value, SHS.neuerSeed(), q('#geschlecht').value));
        schwierigkeitSetzen(q('#schwierigkeit').value);
        speichern();
        hof();
        einfuehrungAnbieten();
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
      const art = a.meisterschaft ? 'Dreikampf LK 3' : a.art === 'DK' ? `Dreikampf, LK ${s.lk}` : `Einzeldisziplin ${diszName(a.disziplin)}, LK ${s.lk}`;
      const quali = a.meisterschaft ? career.meisterschaftsQualifikation(s, a.meisterschaft) : { ok: true };
      let aktion = `<span class="klein">in ${a.woche - s.woche} Woche(n)</span>`;
      if (diese) {
        const starts = career.eigeneStarts(app.profil, a.id);
        if (a.erledigt) aktion = '<span class="klein">gestartet ✔</span>';
        else if (career.istVerletzt(s)) aktion = '<span class="klein warn">Hund verletzt – kein Start</span>';
        else if (!career.darfPruefen(s)) aktion = `<span class="klein warn">Hund zu jung (mind. ${po.MINDESTALTER_MONATE} Monate)</span>`;
        else if (starts.length >= career.MAX_HUNDE_JE_PRUEFUNG) aktion = `<span class="klein warn">Schon ${career.MAX_HUNDE_JE_PRUEFUNG} Hunde gemeldet (PO)</span>`;
        else if (!quali.ok) aktion = `<span class="klein warn">${esc(quali.grund)}</span>`;
        else aktion = `<button class="primaer" data-pruefung="${a.id}">Starten</button>`;
      } else if (a.meisterschaft) {
        aktion = `<span class="klein ${quali.ok ? '' : 'warn'}">${quali.ok ? `qualifiziert ✔ · in ${a.woche - s.woche} Woche(n)` : esc(quali.grund)}</span>`;
      }
      return `<li class="${diese ? 'diese' : ''} ${a.meisterschaft ? 'meisterschaft' : ''}"><div>${a.meisterschaft ? '🏆 ' : ''}<b>${esc(a.verein)}</b> – ${art}<br>
        <span class="klein">Sa., ${career.datumText(a.woche)}</span></div>${aktion}</li>`;
    }).join('');
    const letzte = s.leistungsnachweis.slice(-3).reverse().map(eintragZeile).join('') || '<tr><td colspan="4" class="klein">Noch keine Prüfungen.</td></tr>';

    zeige(`
      <div class="hof">
        <nav class="hunde-leiste">
          ${app.profil.teams.map((t, i) => `<button class="${t === s ? 'aktiv' : ''}" data-team="${i}">${esc(t.hund.name)} <span class="klein">LK ${t.lk}</span></button>`).join('')}
          <button data-a="hundNeu" title="Weiteren Hund aufnehmen">+ Hund</button>
        </nav>
        <header class="hof-kopf">
          <canvas class="hund-portrait" title="Fellfarbe ändern"></canvas>
          <div class="hof-name"><h1>${esc(h.name)} <small>${esc(h.rasse)} · ${esc(h.geschlecht || 'Rüde')}</small>
            ${career.istLaeufig(s) ? '<span class="abzeichen" title="PO II.1.3: Start am Ende des Prüfungstages">läufig</span>' : ''}
            ${(s.titel || []).map((t) => `<span class="abzeichen titel">🏆 ${esc(t)}</span>`).join('')}
            ${career.istVerletzt(s) ? `<span class="abzeichen verletzt">verletzt: ${esc(h.verletzt.art)} bis Woche ${h.verletzt.bisWoche}</span>` : ''}
            ${career.altersPhase(s) === 'senior' ? '<span class="abzeichen senior">Senior</span>' : ''}</h1>
            <div class="klein">HF ${esc(s.hf.name)} (Erfahrung ${Math.round(career.hfErfahrungProfil(app.profil) * 100)} %) · ${career.alterText(h.alterMonate)} · Leistungsklasse <b>LK ${s.lk}</b></div></div>
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
            <h2>Training <small>${frei ? `nächste Einheit: ${career.naechsterTrainingstag(s)}` : 'diese Woche erledigt'}</small>
              <button class="empf-knopf" data-a="empfehlung">💡 Trainingsempfehlung</button></h2>
            <div class="wochenplan">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((tag, i) => {
              const einheit = [0, 2, 4].indexOf(i);
              const cls = einheit >= 0 ? (einheit < s.trainingsDieseWoche ? 'erledigt' : 'training') : 'ruhe';
              return `<span class="${cls}" title="${einheit >= 0 ? 'Trainingstag' : 'Erholung'}">${tag}</span>`;
            }).join('')}</div>
            <div class="trainings">
              ${Object.entries(career.TRAININGS).map(([k, t]) => `<button data-training="${k}" ${frei ? '' : 'disabled'} title="${esc(t.text)}"><b>${t.name}</b><span>${t.text}</span></button>`).join('')}
              <button data-a="uebung" class="uebung"><b>Übungssuche</b><span>Behältnis, Trümmer oder Fläche frei üben – mit Geruchsansicht. ${frei ? 'Zählt als Trainingseinheit.' : 'Diese Woche ohne Trainingseffekt.'}</span></button>
            </div>
            ${!career.istVerletzt(s) && h.energie < 0.35 && frei ? '<p class="warn klein">⚠ Dein Hund ist müde – Training jetzt erhöht das Verletzungsrisiko deutlich. Besser die Woche beenden.</p>' : ''}
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
            <button data-a="empfehlung">Trainingsempfehlung</button>
            <button data-a="nachbetrachtung">Nachbetrachtung</button>
            <button data-a="einfuehrung">Einführung</button>
            <button data-a="erfolge">Erfolge (${Object.keys(app.profil.erfolge || {}).length}/${SHS.erfolge.ERFOLGE.length})</button>
            <button data-a="statistik">Statistik</button>
            <button data-a="einstellungen">Einstellungen</button>
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
      const z = e.target.closest('[data-training],[data-a],[data-pruefung],[data-team]');
      if (!z) return;
      e.preventDefault();
      if (z.dataset.team !== undefined) { teamWechseln(+z.dataset.team); hof(); return; }
      if (z.dataset.a === 'hundNeu') { neuesSpiel('hund'); return; }
      if (z.dataset.training) trainingStarten(z.dataset.training);
      const a = z.dataset.a;
      if (a === 'uebung') uebungAuswahl();
      if (a === 'woche') wocheBeenden();
      if (a === 'ln') leistungsnachweis();
      if (a === 'regeln') regeln();
      if (a === 'empfehlung') trainingsEmpfehlung();
      if (a === 'nachbetrachtung') nachbetrachtungAuswahl();
      if (a === 'einfuehrung') einfuehrungAnbieten(true);
      if (a === 'export') exportieren();
      if (a === 'erfolge') erfolgeZeigen();
      if (a === 'statistik') leistungsnachweis();
      if (a === 'einstellungen') einstellungen();
      if (a === 'import') importAuswahl();
      if (a === 'start') start();
      if (z.dataset.pruefung) pruefungAnmeldung(s.ausschreibungen.find((x) => x.id === z.dataset.pruefung));
    });
    app.root.querySelector('#importDatei').addEventListener('change', importAusDatei);
  }

  function fellAendern() {
    const h = app.stand.hund;
    const bg = dialog(`<h3>${esc(h.name)} bearbeiten</h3>
      <label>Geschlecht<select id="geschlechtNeu">${['Rüde', 'Hündin'].map((g) => `<option ${g === (h.geschlecht || 'Rüde') ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Fellfarbe (${esc(h.rasse)})<select id="fellNeu">${fellOptionen(h.rasse, h.fell)}</select></label>
      <div class="vorschau-reihe"><canvas id="fv1" class="hund-vorschau"></canvas><canvas id="fv2" class="hund-vorschau"></canvas></div>`, [
      { text: 'Abbrechen' },
      { text: 'Übernehmen', primaer: true, aktion: (d) => { h.fell = d.querySelector('#fellNeu').value; h.geschlecht = d.querySelector('#geschlechtNeu').value; speichern(); hof(); } },
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
    if (art === 'anzeige' && !career.istVerletzt(app.stand)) {
      dialog(`<h3>${t.name}</h3><p>${t.text}</p><p>Mit dem Minispiel bestimmst du selbst, wie gut die Einheit wird: Belohne deinen Hund im richtigen Moment.</p>`, [
        { text: 'Abbrechen' },
        { text: 'Ohne Minispiel', aktion: () => { trainingAusfuehren(art); } },
        { text: 'Mit Minispiel', primaer: true, aktion: () => { anzeigeMinispiel((faktor, text) => trainingAusfuehren(art, undefined, faktor, text)); } },
      ]);
      return;
    }
    if (t.mitGegenstand) {
      const opts = po.GEGENSTAENDE.map((g) => `<option value="${g.id}">${g.name} (${Math.round(app.stand.hund.vertrautheit[g.id] * 100)})</option>`).join('');
      dialog(`<h3>${t.name}</h3><p>${t.text}</p><label>Gegenstand<select id="tg">${opts}</select></label>`, [
        { text: 'Abbrechen' },
        { text: 'Trainieren', primaer: true, aktion: (bg) => { trainingAusfuehren(art, bg.querySelector('#tg').value); } },
      ]);
    } else trainingAusfuehren(art);
  }

  function trainingAusfuehren(art, gegenstand, zusatzFaktor, zusatzText) {
    const r = career.trainieren(app.stand, art, gegenstand, zusatzFaktor);
    if (!r.ok) { hinweis(r.text); return; }
    speichern();
    hof();
    dialog(`<h3>${esc(r.text)}</h3>${zusatzText ? `<p>${esc(zusatzText)}</p>` : ''}<ul>${deltasText(r.deltas)}</ul>${r.deltas.hinweis ? `<p class="hinweis">${r.deltas.hinweis}</p>` : ''}
      ${r.verletzung ? `<div class="regel-box warn"><b>Verletzung!</b> ${esc(app.stand.hund.name)} hat sich überlastet: ${esc(r.verletzung.art)}. Schonung bis Woche ${r.verletzung.bisWoche} (PO 3.5: kein Start mit eingeschränktem Leistungsvermögen).</div>` : ''}`);
  }

  // Minispiel Anzeigetraining: Der Hund liegt am Behälter. Belohnen, wenn er ruhig mit der Nase an der
  // Quelle liegt; nicht belohnen, wenn er zurückschaut, scharrt oder aufsteht. 20 Sekunden.
  function anzeigeMinispiel(fertig) {
    const s = app.stand; const h = s.hund;
    const bg = dialog(`<h3>Anzeigetraining – im richtigen Moment belohnen</h3>
      <canvas class="minispiel"></canvas>
      <div class="minispiel-leiste"><span class="ms-zeit">20 s</span><span class="ms-punkte">0 Punkte</span><span class="ms-status"></span></div>
      <p class="hinweis">Klick auf <b>„Fein!“</b> (oder Leertaste), wenn ${esc(h.name)} ruhig liegt und die Nase am Riechloch hat. Belohnung bei Zurückschauen, Scharren oder Aufstehen verstärkt das falsche Verhalten.</p>
      <div class="knopfreihe"><button class="primaer gross" data-ms="fein">Fein! 🍖</button></div>`, [{ text: 'Abbrechen', aktion: () => { stop(); } }]);
    const c = bg.querySelector('canvas');
    const r = SHS.rng(SHS.neuerSeed());
    let t = 0; let punkte = 0; let richtig = 0; let falsch = 0; let laeuft = true; let letzte = performance.now();
    // Verhalten wechselt: ruhig (gut) / zurückschauen / scharren / aufstehen
    let zustand = 'ruhig'; let dauer = 2; let feedback = 0; let feedbackText = '';
    const naechster = () => {
      const ruhigAnteil = 0.45 + (h.werte.anzeige / 100) * 0.35;
      zustand = r() < ruhigAnteil ? 'ruhig' : r.pick(['blick', 'scharren', 'aufstehen']);
      dauer = zustand === 'ruhig' ? r.range(1.2, 3) : r.range(0.7, 1.6);
    };
    const belohnen = () => {
      if (!laeuft) return;
      if (zustand === 'ruhig') { richtig += 1; punkte += 10; feedbackText = 'Richtig belohnt!'; } else { falsch += 1; punkte -= 8; feedbackText = 'Falscher Moment!'; }
      feedback = 0.8;
      SHS.ton.spiele(zustand === 'ruhig' ? 'such' : 'fehler');
      naechster();
    };
    bg.querySelector('[data-ms=fein]').addEventListener('click', belohnen);
    const taste = (ev) => { if (ev.key === ' ') { ev.preventDefault(); belohnen(); } };
    window.addEventListener('keydown', taste);
    function stop() { laeuft = false; window.removeEventListener('keydown', taste); }
    function frame(jetzt) {
      if (!laeuft) return;
      const dt = Math.min(0.05, (jetzt - letzte) / 1000); letzte = jetzt;
      t += dt; dauer -= dt; if (feedback > 0) feedback -= dt;
      if (dauer <= 0) naechster();
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth; const hh = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      SHS.grafik.zeichneAnzeigeSzene(g, w, hh, {
        rasse: h.rasse, fell: h.fell, disziplin: 'behaeltnis', lk: 1, quelleHoehe: 0.12, quelleTyp: 'ziel',
        abstand: zustand === 'aufstehen' ? 0.35 : 0.08, aktiv: zustand === 'scharren', blick: zustand === 'blick', rute: 0.3, t,
      });
      if (zustand === 'aufstehen') { g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 14px system-ui'; g.fillText('steht auf …', 10, 20); }
      if (feedback > 0) { g.fillStyle = feedbackText.startsWith('Richtig') ? '#1c7c2c' : '#d33'; g.font = 'bold 18px system-ui'; g.fillText(feedbackText, 10, hh - 12); }
      bg.querySelector('.ms-zeit').textContent = `${Math.max(0, Math.ceil(20 - t))} s`;
      bg.querySelector('.ms-punkte').textContent = `${punkte} Punkte`;
      if (t >= 20) {
        stop();
        bg.remove();
        // Faktor 0,6 (schlecht getimt) … 1,5 (sehr gut)
        const faktor = Math.max(0.6, Math.min(1.5, 0.8 + richtig * 0.08 - falsch * 0.12));
        fertig(faktor, `Minispiel: ${richtig}× richtig, ${falsch}× falsch belohnt – Trainingswirkung ×${faktor.toFixed(2)}.`);
        return;
      }
      requestAnimationFrame(frame);
    }
    naechster();
    requestAnimationFrame(frame);
  }

  function schwierigkeitSetzen(wert) {
    app.profil.schwierigkeit = wert;
    for (const t of app.profil.teams) t.schwierigkeit = wert;
    speichern();
  }

  function einstellungen() {
    const p = app.profil;
    dialog(`<h3>Einstellungen – ${esc(p.hfName)}</h3>
      <label>Schwierigkeit<select id="esw">${Object.entries(career.SCHWIERIGKEIT).map(([k, v]) => `<option value="${k}" ${k === (p.schwierigkeit || 'normal') ? 'selected' : ''}>${v.name} (Lernen ×${v.lernen}, Konkurrenz ${v.kiNiveau >= 0 ? '+' : ''}${v.kiNiveau})</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="eton" ${SHS.ton.istAn() ? 'checked' : ''}> Töne</label>`, [
      { text: 'Abbrechen' },
      { text: 'Speichern', primaer: true, aktion: (bg) => { schwierigkeitSetzen(bg.querySelector('#esw').value); SHS.ton.setzeAn(bg.querySelector('#eton').checked); hof(); } },
    ]);
  }

  // Die Woche gilt für alle Hunde des Benutzers gemeinsam.
  function wocheBeenden() {
    const s = app.stand;
    const teams = app.profil.teams;
    const nochOffen = teams.filter((t) => career.darfPruefen(t) && t.ausschreibungen.some((a) => a.woche === t.woche && !a.erledigt)
      && career.eigeneStarts(app.profil, t.ausschreibungen.find((a) => a.woche === t.woche && !a.erledigt).id).length < career.MAX_HUNDE_JE_PRUEFUNG);
    const weiter = () => {
      career.wocheBeendenProfil(app.profil);
      speichern();
      hof();
      const seitExport = app.stand.woche - (app.profil.letzterExport || 1);
      if (seitExport >= 8 && seitExport % 4 === 0) {
        dialog('<h3>Spielstand sichern?</h3><p>Dein Spielstand liegt nur in diesem Browser. Wird der Browserverlauf gelöscht, ist er weg. Eine Sicherungsdatei schützt davor (und nimmt den Spielstand auf andere Geräte mit).</p>', [
          { text: 'Später' }, { text: 'Jetzt exportieren', primaer: true, aktion: () => exportieren() },
        ]);
      }
      const neu15 = teams.filter((t) => t.hund.alterMonate >= po.MINDESTALTER_MONATE && t.hund.alterMonate - 7 / 30.44 < po.MINDESTALTER_MONATE);
      if (neu15.length) {
        dialog(`<h3>${neu15.map((t) => esc(t.hund.name)).join(' und ')} ${neu15.length > 1 ? 'sind' : 'ist'} jetzt 15 Monate alt</h3><p>Ab sofort sind Prüfungen möglich.</p>`);
      }
    };
    const trainingOffen = teams.filter((t) => t !== s && t.trainingsDieseWoche < career.TRAININGS_JE_WOCHE).map((t) => t.hund.name);
    const zeilen = [];
    if (nochOffen.length) zeilen.push(`Diese Woche ist Prüfung – noch nicht gestartet: <b>${nochOffen.map((t) => esc(t.hund.name)).join(', ')}</b>.`);
    if (trainingOffen.length) zeilen.push(`Noch freie Trainingseinheiten bei: ${trainingOffen.map(esc).join(', ')}.`);
    if (zeilen.length) {
      dialog(`<h3>Woche beenden?</h3><p>${zeilen.join('<br>')}</p><p class="hinweis">Die Woche gilt für alle deine Hunde.</p>`,
        [{ text: 'Zurück' }, { text: 'Woche beenden', primaer: true, aktion: weiter }]);
    } else weiter();
  }

  // ------------------------------------------------------------------ Übungssuche
  function uebungAuswahl(vorwahl) {
    vorwahl = vorwahl || {};
    const s = app.stand;
    const gopts = po.GEGENSTAENDE.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
    dialog(`
      <h3>Übungssuche</h3>
      <label>Disziplin<select id="ud">${po.DISZIPLIN_REIHENFOLGE.map((d) => `<option value="${d}" ${d === vorwahl.disziplin ? 'selected' : ''}>${diszName(d)}</option>`).join('')}</select></label>
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
            disziplin: q('#ud').value, lk: +q('#ul').value, seed: SHS.neuerSeed(), hund: s.hund, monat: career.monatDerWoche(s.woche),
            gegenstand: q('#ug').value, ansatzIndex: +q('#ua').value, leine: q('#uleine').checked,
            aussenreize: q('#ureize').checked, modus: 'uebung',
            auto: q('#uauto').checked, hfErfahrung: career.hfErfahrungProfil(app.profil),
          }, (erg, szene) => {
            if (erg) {
              career.protokolliereSuche(s, { art: 'uebung', disziplin: q('#ud').value, lk: +q('#ul').value, ergebnis: erg, regen: !!(szene && szene.s.wetter && szene.s.wetter.regen) });
              SHS.nachbetrachtung.archivieren(s, szene && szene.s, { art: 'Übungssuche', datum: career.datumText(s.woche) });
              const d = career.uebungssucheVerbuchen(s, erg, q('#ug').value);
              speichern();
              hof();
              if (d) {
                const v = d.verletzung; delete d.verletzung;
                dialog(`<h3>Übungssuche verbucht</h3><ul>${deltasText(d)}</ul>${v ? `<div class="regel-box warn"><b>Verletzung!</b> ${esc(s.hund.name)}: ${esc(v.art)}, Schonung bis Woche ${v.bisWoche}.</div>` : ''}`);
              }
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
      onEnde: (erg, szene) => { app.szene = null; onEnde(erg, szene); },
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
        ${career.istLaeufig(s, a.woche) ? `<div class="regel-box"><b>${esc(s.hund.name)} ist läufig.</b> Die Läufigkeit wird der Prüfungsleitung gemeldet; ${esc(s.hund.name)} startet am Ende des Prüfungstages und wird bis dahin vom Gelände separiert (PO II.1.3).</div>` : ''}
        <p>HF <b>${esc(s.hf.name)}</b> mit <b>${esc(s.hund.name)}</b> · Sa., ${career.datumText(a.woche)} · ${a.meisterschaft ? career.MEISTERSCHAFTEN[a.meisterschaft].teilnehmer : po.MINDEST_TEILNEHMER} Teams gemeldet</p>
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
        (${Math.round(career.hfErfahrungProfil(app.profil) * 100)} %, wächst mit Training, Übungssuchen und Prüfungen aller deiner Hunde).
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
      pruefungsAblauf({ ausschreibung: a, lk, plan, vorfuehrung, idx: 0, einzelwerte: {}, details: {}, status: 'ok', startNr: career.istLaeufig(app.stand, a.woche) ? po.MINDEST_TEILNEHMER : 1 + (a.seed % (po.MINDEST_TEILNEHMER - 1)) });
    });
  }

  function pruefungsAblauf(p) {
    const s = app.stand;
    if (p.idx >= p.plan.length || p.status === 'disq') { pruefungAbschluss(p); return; }
    const schritt = p.plan[p.idx];
    const titel = `${p.ausschreibung.verein} · ${diszName(schritt.disziplin)} · LK ${p.lk} · Start-Nr. ${p.startNr}`;
    const suchOpts = {
      disziplin: schritt.disziplin, lk: p.lk, seed: (p.ausschreibung.seed + p.idx * 7919 + 17) >>> 0, monat: career.monatDerWoche(p.ausschreibung.woche),
      hund: s.hund, gegenstand: schritt.gegenstand, ansatzIndex: schritt.ansatzIndex, leine: schritt.leine,
      modus: 'pruefung', titel, auto: p.vorfuehrung === 'auto', hfErfahrung: career.hfErfahrungProfil(app.profil),
    };
    const verbuchen = (erg, szene) => {
      career.protokolliereSuche(s, { art: 'pruefung', disziplin: schritt.disziplin, lk: p.lk, ergebnis: erg, regen: !!(szene && szene.s.wetter && szene.s.wetter.regen) });
      SHS.nachbetrachtung.archivieren(s, (szene && szene.s) || erg.suchlage, { art: `Prüfung ${p.ausschreibung.verein}`, datum: career.datumText(p.ausschreibung.woche) });
      p.details[schritt.disziplin] = erg;
      if (erg.status === 'disq') p.status = 'disq';
      p.einzelwerte[schritt.disziplin] = erg.status === 'ok' ? erg.punkte : null;
      p.idx += 1;
      pruefungsAblauf(p);
    };
    if (p.vorfuehrung === 'sofort') { verbuchen(SHS.simuliereSuche(suchOpts, suchOpts.hfErfahrung)); return; }
    dialog(`<h3>${diszName(schritt.disziplin)}</h3>
      <p>Anmeldung beim WR in Grundstellung: „${esc(s.hf.name)}, ${esc(s.hund.name)}, Start-Nr. ${p.startNr}, Gegenstand ${gegName(schritt.gegenstand)}, LK ${p.lk}.“</p>
      <p>Du gehst mit deinem Hund außer Sicht – der WR versteckt den Gegenstand.</p>
      ${(() => { const w = SHS.wetter.erzeuge(suchOpts.seed, suchOpts.monat); return `<p class="regel-box"><b>Wetter: ${w.symbol} ${esc(w.text)}</b>${w.hinweis ? `<br>${esc(w.hinweis)}` : ''}</p>`; })()}`, [{
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
      // Eigene Hunde, die in derselben LK schon gestartet sind, stehen mit in der Rangliste.
      const eigeneFrueher = career.eigeneStarts(app.profil, a.id).filter((x) => x.lk === p.lk)
        .map((x) => Object.assign({}, x, { eigen: true }));
      const m = a.meisterschaft ? career.MEISTERSCHAFTEN[a.meisterschaft] : null;
      const feld = m ? m.teilnehmer : po.MINDEST_TEILNEHMER;
      const ausschreibungKI = Object.assign({}, a, { niveau: (m ? m.niveau : 0) + career.schwierigkeit(s).kiNiveau });
      const ki = SHS.competition.kiTeams(ausschreibungKI, p.lk, Math.max(1, feld - 1 - eigeneFrueher.length));
      const teilnehmer = ki.map((t, i) => {
        const r = SHS.competition.simuliereTeam(t, ausschreibungKI, p.lk, i + 1);
        return { hf: t.hf, hund: t.hund.name, rasse: t.hund.rasse, einzelwerte: r.einzelwerte, ergebnis: SHS.competition.auswerten(r.einzelwerte, a.art, r.status) };
      });
      teilnehmer.push(...eigeneFrueher);
      teilnehmer.push({ hf: s.hf.name, hund: s.hund.name, rasse: s.hund.rasse, einzelwerte: p.einzelwerte, ergebnis: eigenes, ich: true });
      career.startVermerken(app.profil, a.id, { hf: s.hf.name, hund: s.hund.name, rasse: s.hund.rasse, lk: p.lk, einzelwerte: p.einzelwerte, ergebnis: eigenes });
      po.platzierung(teilnehmer);
      teilnehmer.sort((x, y) => (x.platz || 99) - (y.platz || 99) || (y.ergebnis.punkte - x.ergebnis.punkte));
      const ich = teilnehmer.find((t) => t.ich);
      const eintrag = {
        pruefungId: a.id, woche: a.woche, datum: career.datumText(a.woche), verein: a.verein, art: a.art,
        lk: p.lk, einzelwerte: p.einzelwerte, punkte: eigenes.punkte, note: eigenes.text, abk: eigenes.abk,
        status: p.status, platz: ich.platz, teilnehmer: teilnehmer.length, meisterschaft: a.meisterschaft || null,
        details: Object.fromEntries(Object.entries(p.details).map(([d, r]) => [d, r ? { such: r.such, anzeige: r.anzeige, begruendung: r.begruendung } : null])),
      };
      const { aufstieg } = career.eintragen(s, eintrag);
      speichern();
      const disz = SHS.competition.disziplinenDer(a);
      const zeilen = teilnehmer.map((t) => `<tr class="${t.ich ? 'ich' : t.eigen ? 'eigen' : ''}"><td>${t.platz || '–'}</td><td>${esc(t.hf)}<br><span class="klein">${esc(t.hund)} (${esc(t.rasse)})</span></td>
        ${disz.map((d) => `<td class="zahl">${t.einzelwerte[d] === null ? '–' : t.einzelwerte[d]}</td>`).join('')}
        <td class="zahl"><b>${t.ergebnis.punkte}</b></td><td>${esc(t.ergebnis.text)}</td></tr>`).join('');
      zeige(`
        <div class="karte">
          <h2>Ergebnis: ${esc(a.verein)} – ${a.art === 'DK' ? 'Dreikampf' : 'Einzeldisziplin'} LK ${p.lk}</h2>
          <p class="gross-ergebnis">${esc(s.hund.name)}: <b>${eigenes.punkte}</b> Punkte – <b>${esc(eigenes.text)}</b>${ich.platz ? ` · Platz ${ich.platz} von ${teilnehmer.length}` : ''}</p>
          ${m && ich.platz === 1 ? `<div class="erfolg">🏆 ${esc(s.hund.name)} ist ${esc(m.kurz)}!</div>` : ''}
          ${m && ich.platz && ich.platz <= 3 && ich.platz > 1 ? `<div class="erfolg">🥈 Platz ${ich.platz} bei der ${esc(m.name)}!</div>` : ''}
          ${aufstieg ? `<div class="erfolg">🎉 Klassenaufstieg! ${esc(s.hund.name)} startet ab jetzt in LK ${s.lk}.</div>` : ''}
          <table class="rangliste"><tr><th>Platz</th><th>Team</th>${disz.map((d) => `<th>${diszName(d)}</th>`).join('')}<th>Gesamt</th><th>Wertnote</th></tr>${zeilen}</table>
          <p class="hinweis">Gleiche Punktzahl = gleicher Platz, der folgende Platz entfällt. Nicht bestandene Teams werden nicht platziert.</p>
          <div class="knopfreihe"><button data-a="urkunde">🖨 Urkunde</button>${zweiterHundKnopf(a)}<button class="primaer" data-a="hof">Eingetragen – zurück zum Training</button></div>
        </div>`);
      app.root.querySelector('[data-a=hof]').addEventListener('click', hof);
      app.root.querySelector('[data-a=urkunde]').addEventListener('click', () => urkundeDrucken(s, eintrag));
      const zweiter = app.root.querySelector('[data-zweiter]');
      if (zweiter) {
        zweiter.addEventListener('click', () => {
          teamWechseln(+zweiter.dataset.zweiter);
          pruefungAnmeldung(app.stand.ausschreibungen.find((x) => x.id === a.id));
        });
      }
    }, 30);
  }

  // Weiterer eigener Hund für dieselbe Prüfung (PO: max. 2 Hunde je HF)?
  function zweiterHundKnopf(a) {
    if (career.eigeneStarts(app.profil, a.id).length >= career.MAX_HUNDE_JE_PRUEFUNG) return '';
    const i = app.profil.teams.findIndex((t) => t !== app.stand && career.darfPruefen(t)
      && t.ausschreibungen.some((x) => x.id === a.id && !x.erledigt));
    if (i < 0) return '';
    return `<button data-zweiter="${i}">Mit ${esc(app.profil.teams[i].hund.name)} starten</button>`;
  }

  // ------------------------------------------------------------------ Leistungsnachweis & Regeln
  function eintragZeile(e) {
    const werte = Object.entries(e.einzelwerte).map(([d, v]) => `${diszName(d).replace('suche', '').replace('strecke', '')}: ${v === null ? '–' : v}`).join(', ');
    const note = e.status === 'disq' ? 'Disqualifikation' : `${e.punkte} P. – ${e.note}`;
    return `<tr><td>${e.datum}</td><td>${e.meisterschaft ? '🏆 ' : ''}${esc(e.verein)}<br><span class="klein">${e.art === 'DK' ? 'Dreikampf' : 'Einzeldisziplin'} LK ${e.lk}</span></td>
      <td class="klein">${werte}</td><td><b>${note}</b>${e.platz ? `<br><span class="klein">Platz ${e.platz}/${e.teilnehmer}</span>` : ''}</td>
      <td><button class="klein-knopf" data-urkunde="${esc(e.pruefungId)}" title="Urkunde und Bewertungsbogen drucken">🖨</button></td></tr>`;
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
        ${statistikHtml(s)}
        <div class="knopfreihe"><button class="primaer" data-a="hof">Zurück</button></div>
      </div>`);
    app.root.querySelector('[data-a=hof]').addEventListener('click', hof);
    app.root.querySelector('.ln').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-urkunde]');
      if (b) urkundeDrucken(s, s.leistungsnachweis.find((x) => x.pruefungId === b.dataset.urkunde));
    });
  }

  // Statistik je Hund aus Leistungsnachweis und Suchprotokoll
  function statistikHtml(s) {
    const ln = s.leistungsnachweis;
    const best = ln.filter((e) => e.status !== 'disq' && !['nB', 'ABBR'].includes(e.abk));
    const prot = s.suchprotokoll || [];
    const uebungen = prot.filter((e) => e.art === 'uebung');
    const fundquote = prot.length ? Math.round((prot.filter((e) => e.gefunden).length / prot.length) * 100) : null;
    const schnitt = (liste) => (liste.length ? Math.round(liste.reduce((a, e) => a + (e.punkte || 0), 0) / liste.length) : null);
    const fehler = {};
    for (const e of prot) for (const [k, n] of Object.entries(e.fehler || {})) fehler[k] = (fehler[k] || 0) + n;
    const haeufig = Object.entries(fehler).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => `${esc(po.ABZUEGE[k] ? po.ABZUEGE[k].text : k)} (${n}×)`).join(', ') || '–';
    const kachel = (wert, text) => `<div class="stat-kachel"><b>${wert}</b><span>${text}</span></div>`;
    return `<h3>Statistik</h3><div class="stat-raster">
      ${kachel(ln.length, 'Prüfungen')}
      ${kachel(ln.length ? Math.round((best.length / ln.length) * 100) + ' %' : '–', 'bestanden')}
      ${kachel(ln.length ? Math.max(...ln.map((e) => e.punkte || 0)) : '–', 'beste Punktzahl')}
      ${kachel(uebungen.length, 'Übungssuchen (zuletzt)')}
      ${kachel(fundquote === null ? '–' : fundquote + ' %', 'Fundquote')}
      ${kachel(schnitt(prot) ?? '–', 'Ø Punkte je Suche')}
      ${kachel((s.titel || []).length, 'Titel')}
      ${kachel(s.verlauf.length, 'Trainingseinheiten')}
    </div><p class="klein">Häufigste Fehler: ${haeufig}${(s.titel || []).length ? ` · Titel: ${s.titel.map(esc).join(', ')}` : ''}</p>`;
  }

  // Urkunde mit Bewertungsbogen in einem eigenen Fenster zum Drucken
  function urkundeDrucken(s, e) {
    if (!e) return;
    const disz = Object.keys(e.einzelwerte);
    const zeilen = disz.map((d) => {
      const det = (e.details || {})[d] || {};
      return `<tr><td>${diszName(d)}</td><td>${det.such ?? '–'}</td><td>${det.anzeige ?? '–'}</td><td>${e.einzelwerte[d] === null ? '–' : e.einzelwerte[d]}</td></tr>
        ${det.begruendung ? `<tr class="b"><td colspan="4">${det.begruendung.filter(Boolean).map(esc).join('<br>')}</td></tr>` : ''}`;
    }).join('');
    const h = s.hund;
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Urkunde ${esc(h.name)} ${esc(e.datum)}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; margin: 2cm; color: #222; }
        .rahmen { border: 6px double #3d7a2a; padding: 1.2cm 1.5cm; }
        h1 { text-align: center; font-size: 30pt; margin: 0 0 .2em; color: #3d7a2a; letter-spacing: .05em; }
        h2 { text-align: center; font-weight: normal; margin: 0 0 1em; }
        .gross { text-align: center; font-size: 18pt; margin: .6em 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 1em; font-family: system-ui, sans-serif; font-size: 10.5pt; }
        th, td { border-bottom: 1px solid #bbb; padding: 4px 6px; text-align: left; }
        tr.b td { color: #555; font-size: 9pt; border-bottom: 1px solid #ddd; }
        .fuss { display: flex; justify-content: space-between; margin-top: 2cm; font-family: system-ui, sans-serif; font-size: 10pt; }
        .fuss div { border-top: 1px solid #555; width: 40%; padding-top: 4px; text-align: center; }
        .knopf { text-align: center; margin: 1em; } @media print { .knopf { display: none; } body { margin: 0; } }
      </style></head><body>
      <div class="knopf"><button onclick="window.print()">Drucken</button></div>
      <div class="rahmen">
        <h1>Urkunde</h1>
        <h2>Spürhundesport – ${e.art === 'DK' ? 'SHS-Dreikampf' : 'SHS-Einzeldisziplin'} · Leistungsklasse ${e.lk}</h2>
        <p class="gross"><b>${esc(h.name)}</b> (${esc(h.rasse)}, ${esc(h.geschlecht || 'Rüde')})<br>geführt von <b>${esc(s.hf.name)}</b></p>
        <p class="gross">${e.status === 'disq' ? 'Disqualifikation' : `${e.punkte} Punkte – <b>${esc(e.note)}</b>`}${e.platz ? ` · Platz ${e.platz} von ${e.teilnehmer}` : ''}</p>
        <p style="text-align:center">${esc(e.verein)} · ${esc(e.datum)}</p>
        <table><tr><th>Disziplin</th><th>Suchleistung (60)</th><th>Anzeigeleistung (40)</th><th>Punkte</th></tr>${zeilen}</table>
        <div class="fuss"><div>Prüfungsleiter</div><div>SHS-Wertungsrichter</div></div>
      </div>
      <p style="font-family:system-ui;font-size:8pt;color:#888;text-align:center">Erstellt mit SHS-Game ${esc(SHS.VERSION)} – Spielergebnis, kein offizieller Leistungsnachweis.</p>
      </body></html>`;
    let w = null;
    try { w = window.open('', '_blank'); } catch (err) { w = null; }
    if (w) {
      w.document.write(html);
      w.document.close();
      return;
    }
    // Ohne Pop-up (z. B. eingebettet): Urkunde als Ansicht im Spiel
    const ansicht = document.createElement('div');
    ansicht.className = 'urkunde-ansicht';
    const inhalt = html.slice(html.indexOf('<div class="rahmen">'), html.lastIndexOf('</body>'));
    const stil = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>')).replace(/(^|\})\s*([^{}@]+)\{/g, (m, a, sel) => `${a} ${sel.split(',').map((x) => `.urkunde-ansicht ${x.trim()}`).join(', ')} {`);
    ansicht.innerHTML = `<style>${stil}</style><div class="urkunde-blatt">${inhalt}</div>
      <div class="knopfreihe"><button class="primaer" data-a="zu">Schließen</button></div>`;
    ansicht.querySelector('[data-a=zu]').addEventListener('click', () => ansicht.remove());
    document.body.appendChild(ansicht);
  }

  function erfolgeZeigen() {
    const p = app.profil;
    const erreicht = p.erfolge || {};
    const liste = SHS.erfolge.ERFOLGE.map((e) => `<li class="${erreicht[e.id] ? 'ok' : ''}"><span class="erfolg-symbol">${erreicht[e.id] ? e.symbol : '🔒'}</span>
      <div><b>${esc(e.name)}</b><br><span class="klein">${esc(e.text)}${erreicht[e.id] ? ` · Woche ${erreicht[e.id]}` : ''}</span></div></li>`).join('');
    dialog(`<h3>Erfolge von ${esc(p.hfName)} <small class="klein">${Object.keys(erreicht).length}/${SHS.erfolge.ERFOLGE.length}</small></h3><ul class="erfolge-liste">${liste}</ul>`);
  }

  // ------------------------------------------------------------------ Einführung
  function einfuehrungAnbieten(manuell) {
    const s = app.stand;
    if (!manuell && s.einfuehrung) return;
    s.einfuehrung = s.einfuehrung || { angeboten: true };
    speichern();
    dialog(`<h3>${manuell ? 'Einführung' : `Willkommen, ${esc(s.hf.name)} und ${esc(s.hund.name)}!`}</h3>
      <p>${manuell ? 'Was möchtest du dir ansehen?' : 'Möchtest du mit einer geführten ersten Suche starten? Ein Coach erklärt dir Schritt für Schritt Steuerung, Ablauf nach PO und wie du deinen Hund liest (ca. 3 Minuten).'}</p>
      <p class="hinweis">Die Einführung zählt nicht als Trainingseinheit und lässt sich jederzeit unter „Einführung“ im Hof wiederholen.</p>`, [
      { text: manuell ? 'Schließen' : 'Später' },
      { text: 'Rundgang durch den Hof', aktion: () => { hof(); SHS.einfuehrung.hofRundgang(); } },
      { text: 'Geführte erste Suche', primaer: true, aktion: () => einfuehrungsSuche() },
    ]);
  }

  function einfuehrungsSuche() {
    const s = app.stand;
    suchlageStarten(SHS.einfuehrung.sucheOptionen(s), (erg, szene) => {
      if (erg) {
        career.protokolliereSuche(s, { art: 'uebung', disziplin: 'behaeltnis', lk: 1, ergebnis: erg });
        SHS.nachbetrachtung.archivieren(s, szene && szene.s, { art: 'Einführung', datum: career.datumText(s.woche) });
      }
      s.einfuehrung.sucheGemacht = true;
      speichern();
      hof();
      if (!s.einfuehrung.hofGesehen) {
        s.einfuehrung.hofGesehen = true;
        speichern();
        dialog('<h3>Gut gemacht!</h3><p>Jetzt zeige ich dir noch kurz deinen Hof – hier planst du Training und Prüfungen.</p>', [
          { text: 'Überspringen' },
          { text: 'Rundgang starten', primaer: true, aktion: () => SHS.einfuehrung.hofRundgang() },
        ]);
      }
    });
  }

  // ------------------------------------------------------------------ Nachbetrachtung (Archiv)
  function nachbetrachtungAuswahl() {
    const liste = (app.stand.aufzeichnungen || []).slice().reverse();
    if (!liste.length) {
      dialog('<h3>Nachbetrachtung</h3><p>Noch keine Suchen gespeichert. Nach jeder Übungssuche und Prüfung werden die letzten 5 Suchen hier abgelegt.</p>');
      return;
    }
    const zeilen = liste.map((d, i) => {
      const m = d.meta; const e = m.ergebnis;
      const erg = !e ? '–' : e.status === 'ok' ? `${e.punkte} P.` : e.status === 'disq' ? 'DISQ' : 'ABBR';
      return `<tr><td>${esc(m.datum || '')}</td><td>${esc(m.art || '')}</td><td>${diszName(m.disziplin)} LK ${m.lk}</td><td class="zahl">${erg}</td>
        <td><button data-i="${i}">Ansehen</button></td></tr>`;
    }).join('');
    const bg = dialog(`<h3>Nachbetrachtung – die letzten Suchen</h3><table class="ln">${zeilen}</table>`, [{ text: 'Schließen' }]);
    bg.querySelector('table').addEventListener('click', (ev) => {
      const i = ev.target.dataset.i;
      if (i === undefined) return;
      bg.remove();
      zeige('<div class="szene-host"></div>');
      app.szene = new SHS.nachbetrachtung.Nachbetrachtung(app.root.querySelector('.szene-host'), liste[+i], {
        weiterText: 'Zurück', onEnde: () => { app.szene = null; hof(); },
      });
    });
  }

  // ------------------------------------------------------------------ Trainingsempfehlung
  function trainingsEmpfehlung() {
    const s = app.stand;
    const e = SHS.empfehlung.empfehlungen(s);
    const frei = career.TRAININGS_JE_WOCHE - s.trainingsDieseWoche;
    const tag = career.naechsterTrainingstag(s);
    const karten = e.liste.map((x, i) => {
      let knopf = '';
      if (x.training && frei) knopf = `<button class="primaer" data-training="${x.training}" data-gegenstand="${x.gegenstand || ''}">Am ${tag} trainieren</button>`;
      else if (x.uebung) knopf = `<button class="primaer" data-uebung="${x.uebung}">Übungssuche starten</button>`;
      else if (x.ziel === 'ruhe') knopf = '<button data-a="hof">Zurück und Woche beenden</button>';
      return `<li class="empf"><div class="empf-nr">${i + 1}</div><div class="empf-inhalt">
        <b>${esc(x.titel)}</b><div class="klein">${esc(x.text || '')}</div>
        <ul>${x.gruende.slice(0, 4).map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>
        <div class="empf-aktion">${knopf}</div></li>`;
    }).join('') || '<li class="klein">Keine Schwächen erkennbar – weiter so! Übungssuchen halten den Hund in Form.</li>';
    const profil = e.profil.map((p) => {
      const farbe = p.differenz >= 0 ? 'stark' : p.differenz > -10 ? 'mittel' : 'schwach';
      return `<tr><td>${esc(p.name)}</td><td><div class="ziel-balken ${farbe}"><div style="width:${p.wert}%"></div><i style="left:${p.ziel}%" title="Ziel LK ${s.lk}: ${p.ziel}"></i></div></td>
        <td class="zahl">${p.wert}</td><td class="zahl klein">${p.differenz >= 0 ? '+' : ''}${p.differenz}</td></tr>`;
    }).join('');
    const gb = e.geruch;
    const geruch = gb.kandidaten.map((g) => `<li class="${g.wert >= gb.sicher ? 'ok' : ''}">${g.wert >= gb.sicher ? '✔' : '○'} ${esc(g.name)}: ${g.wert} %</li>`).join('');
    const f = e.fehler;
    const fehlerZeilen = Object.entries(f.summe).sort((a, b) => b[1] - a[1])
      .map(([art, n]) => `<tr><td>${esc(po.ABZUEGE[art] ? po.ABZUEGE[art].text : art)}</td><td class="zahl">${n}×</td></tr>`).join('');
    const ergebnisse = f.liste.slice(-6).map((x) => `${diszName(x.disziplin)} ${x.status === 'ok' ? x.punkte : x.status === 'disq' ? 'DISQ' : 'ABBR'}`).join(' · ');
    zeige(`<div class="empfehlung-seite">
      <div class="karte">
        <h2>Trainingsempfehlung – ${esc(s.hund.name)} <small>LK ${s.lk} · Woche ${s.woche} · ${frei ? `${frei} Einheit(en) frei, nächste am ${tag}` : 'diese Woche keine Einheit mehr frei'}</small></h2>
        <ol class="empf-liste">${karten}</ol>
        ${e.hinweise.length ? `<div class="regel-box"><b>Hinweise für dich als Hundeführer</b><ul>${e.hinweise.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="spalten">
        <section class="karte">
          <h2>Stärken und Schwächen <small>Strich = Ziel für LK ${s.lk}</small></h2>
          <table class="werte">${profil}</table>
          <h3>Geruchsbilder für LK ${s.lk} <small class="klein">(${gb.benoetigt} sicher bekannt, ab ${gb.sicher} %)</small></h3>
          <ul class="geruch-liste">${geruch}</ul>
        </section>
        <section class="karte">
          <h2>Fehler der letzten Suchen <small>${f.anzahl} Suche(n)</small></h2>
          ${f.anzahl ? `<table class="ln">${fehlerZeilen || '<tr><td>Keine Fehler notiert.</td></tr>'}
            ${f.fehlanzeigen ? `<tr><td>Fehlanzeigen</td><td class="zahl">${f.fehlanzeigen}×</td></tr>` : ''}
            ${f.nichtGefunden ? `<tr><td>Gegenstand nicht gefunden</td><td class="zahl">${f.nichtGefunden}×</td></tr>` : ''}</table>
            <p class="klein">Letzte Ergebnisse: ${ergebnisse}</p>`
            : '<p class="klein">Noch keine Suchen protokolliert. Mach eine Übungssuche – danach wertet die Empfehlung auch die Fehler aus.</p>'}
        </section>
      </div>
      ${verlaufHtml(s)}
      <div class="knopfreihe"><button class="primaer" data-a="hof">Zurück zum Training</button></div>
    </div>`);
    // Empfänger nur am Inhalt dieser Seite: Der Klick, der die Seite geöffnet hat, darf hier nicht ankommen.
    app.root.querySelector('.empfehlung-seite').addEventListener('click', (ev) => {
      const z = ev.target.closest('[data-training],[data-uebung],[data-a]');
      if (!z) return;
      if (z.dataset.training) trainingAusfuehren(z.dataset.training, z.dataset.gegenstand || undefined);
      else if (z.dataset.uebung) { hof(); uebungAuswahl({ disziplin: z.dataset.uebung }); } else if (z.dataset.a === 'hof') hof();
    });
  }


  // Entwicklung der Werte: kleine Einzeldiagramme je Wert (eine Linie, Ziel der aktuellen LK gestrichelt).
  function verlaufHtml(s) {
    const h = (s.historie || []).slice();
    if (!h.length || h[h.length - 1].woche !== s.woche) h.push({ woche: s.woche, lk: s.lk, werte: s.hund.werte });
    if (h.length < 2) {
      return '<section class="karte"><h2>Entwicklung der Werte</h2><p class="klein">Der Verlauf erscheint, sobald die erste Woche beendet ist.</p></section>';
    }
    const B = 220; const Hh = 64; const R = { l: 4, r: 4, o: 6, u: 6 };
    const w0 = h[0].woche; const w1 = h[h.length - 1].woche;
    const x = (w) => R.l + ((w - w0) / Math.max(1, w1 - w0)) * (B - R.l - R.r);
    const y = (v) => R.o + (1 - v / 100) * (Hh - R.o - R.u);
    const panels = Object.entries(SHS.dog.WERTE).map(([k, name]) => {
      const ziel = SHS.empfehlung.zielwert(s.lk, k);
      const pfad = h.map((p, i) => `${i ? 'L' : 'M'}${x(p.woche).toFixed(1)},${y(p.werte[k]).toFixed(1)}`).join(' ');
      const schritt = (B - R.l - R.r) / Math.max(1, h.length - 1);
      const punkte = h.map((p) => `<g class="vl-pkt"><rect x="${(x(p.woche) - schritt / 2).toFixed(1)}" y="0" width="${schritt.toFixed(1)}" height="${Hh}" fill="transparent"/>
        <line class="vl-kreuz" x1="${x(p.woche).toFixed(1)}" x2="${x(p.woche).toFixed(1)}" y1="${R.o}" y2="${Hh - R.u}"/>
        <circle class="vl-dot" cx="${x(p.woche).toFixed(1)}" cy="${y(p.werte[k]).toFixed(1)}" r="4"/>
        <title>Woche ${p.woche}: ${name} ${Math.round(p.werte[k])} (LK ${p.lk})</title></g>`).join('');
      const jetzt = Math.round(s.hund.werte[k]);
      const diff = Math.round(s.hund.werte[k] - h[0].werte[k]);
      return `<figure class="vl-panel">
        <figcaption><span>${esc(name)}</span><b>${jetzt}</b><span class="klein">${diff >= 0 ? '+' : ''}${diff}</span></figcaption>
        <svg viewBox="0 0 ${B} ${Hh}" preserveAspectRatio="none" role="img" aria-label="${esc(name)}: von ${Math.round(h[0].werte[k])} auf ${jetzt}">
          <line class="vl-ziel" x1="${R.l}" x2="${B - R.r}" y1="${y(ziel).toFixed(1)}" y2="${y(ziel).toFixed(1)}"><title>Ziel LK ${s.lk}: ${ziel}</title></line>
          <path class="vl-linie" d="${pfad}"/>${punkte}
        </svg></figure>`;
    }).join('');
    const tabelle = `<details class="vl-tabelle"><summary>Als Tabelle anzeigen</summary><div class="tabelle-scroll"><table class="ln">
      <tr><th>Woche</th>${Object.values(SHS.dog.WERTE).map((n) => `<th>${esc(n)}</th>`).join('')}</tr>
      ${h.map((p) => `<tr><td>${p.woche}</td>${Object.keys(SHS.dog.WERTE).map((k) => `<td class="zahl">${Math.round(p.werte[k])}</td>`).join('')}</tr>`).join('')}
      </table></div></details>`;
    return `<section class="karte"><h2>Entwicklung der Werte <small>Woche ${w0}–${w1} · gestrichelt = Ziel für LK ${s.lk}</small></h2>
      <div class="vl-raster">${panels}</div>${tabelle}</section>`;
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
