// Einstieg für neue Spieler: geführte erste Suche (Coach in der Suchszene) und Rundgang durch den Hof.
(function (SHS) {
  'use strict';

  // ---------------------------------------------------------------- Geführte erste Suche
  // Liefert Optionen für die Übungssuche der Einführung.
  function sucheOptionen(stand) {
    const h = stand.hund;
    const bester = Object.keys(h.vertrautheit).sort((a, b) => h.vertrautheit[b] - h.vertrautheit[a])[0] || 'korken';
    return {
      disziplin: 'behaeltnis', lk: 1, seed: 4242, hund: h, gegenstand: bester, ansatzIndex: 0, wetter: false,
      leine: true, aussenreize: false, modus: 'uebung', titel: 'Einführung – deine erste Suche',
      tutor: neuerSuchTutor(),
    };
  }

  // Coach: prüft den Zustand der Suche und liefert den passenden Hinweis.
  function neuerSuchTutor() {
    const t = { schritt: 'bewegen', seit: 0, start: null, gegangen: 0, letzterHf: null, geruchGezeigt: false };
    t.update = function (szene, dt) {
      const s = szene.s; const h = s.hund;
      t.seit += dt;
      if (!t.start) t.start = { x: s.hf.x, y: s.hf.y };
      const weiter = (neu) => { t.schritt = neu; t.seit = 0; };

      switch (t.schritt) {
        case 'bewegen':
          if (Math.hypot(s.hf.x - t.start.x, s.hf.y - t.start.y) > 1) weiter('bereit');
          return {
            titel: '1 · Du bist der Hundeführer',
            text: 'Du bist die blaue Figur, dein Hund sitzt am Ansatz neben dir. Beweg dich mit <b>W A S D</b> oder den <b>Pfeiltasten</b> ein Stück.<br>Rot unten links steht der Wertungsrichter (WR). Er hat den Gegenstand in einem der sechs Eimer versteckt.',
          };
        case 'bereit':
          if (s.phase === 'suche') weiter('schicken');
          return {
            titel: '2 · Bereitschaft melden',
            text: 'Geh zurück zu deinem Hund am Ansatz und heb den Arm: Taste <b>H</b> (Handzeichen).<br>Der WR erwidert, ab dann läuft die Suchzeit von 5 Minuten.',
          };
        case 'schicken':
          if (h.zustand !== 'sitzt') weiter('lesen');
          return {
            titel: '3 · „Such!“',
            text: 'Schick deinen Hund mit der <b>Leertaste</b> los. Das erste „Such!“ ist frei.<br>Jedes weitere Hörzeichen zählt als Hilfe und kostet Punkte.',
          };
        case 'lesen':
          if (h.zustand === 'geruch') weiter('geruch');
          else if (h.zustand === 'anzeige' || h.zustand === 'anzeigeEinnehmen') weiter('anzeige');
          if (h.zustand === 'schautHF') {
            return {
              titel: 'Tipp · Dein Hund wartet auf dich',
              text: 'Er bleibt stehen und schaut zu dir. Das ist unselbstständig und kostet Punkte.<br>Geh einfach ein paar Schritte weiter an der Strecke entlang. Ein erneutes „Such!“ hilft auch, zählt aber als Hilfe.',
            };
          }
          return {
            titel: '4 · Mitgehen und den Hund lesen',
            text: `Geh an der Leine mit an den Eimern entlang. Achte auf die <b>Körpersprache</b>:
              tiefe Nase heißt suchen; wird die Rute schnell und der Kopf pendelt kurz hin und her, hat er Geruch.<br>
              Der <b>Wind-Pfeil</b> oben rechts zeigt, wohin der Geruch weht.${t.seit > 20 ? '<br><i>Kleiner Trick für die Übung: Mit <b>G</b> blendest du die Geruchsfahne ein.</i>' : ''}`,
          };
        case 'geruch':
          if (h.zustand === 'anzeige' || h.zustand === 'anzeigeEinnehmen') weiter('anzeige');
          else if (h.zustand === 'sucht' && t.seit > 3) weiter('lesen');
          return {
            titel: '5 · Er hat Geruch!',
            text: 'Schnelle Rute, kurze Kopfbewegungen: Dein Hund arbeitet den Geruch aus.<br><b>Nicht eingreifen</b>, keine Hörzeichen geben. Lass ihn die Quelle selbst finden.',
          };
        case 'anzeige':
          if (s.meldung) weiter('warten');
          else if (h.zustand !== 'anzeige' && h.zustand !== 'anzeigeEinnehmen') weiter('lesen');
          if (h.anzeige && !h.anzeige.richtig && h.blickZuHF > 0) {
            return {
              titel: '6 · Vorsicht – unsicher?',
              text: 'Dein Hund liegt, schaut aber immer wieder zu dir zurück. Das ist ein Zeichen von Unsicherheit, vielleicht eine <b>Fehlanzeige</b> (−10 Punkte).<br>Abwarten: Ein unsicherer Hund steht oft wieder auf und sucht weiter.',
            };
          }
          return {
            titel: '6 · Passive Platzanzeige',
            text: 'Dein Hund liegt und verweist. Oben links siehst du die <b>Nahaufnahme</b>: Liegt er ruhig mit der Nase an der Austrittsöffnung (höchstens 20 cm)?<br>Wenn du überzeugt bist: Arm heben mit <b>H</b>.',
          };
        case 'warten':
          if (s.phase === 'ende') weiter('ende');
          else if (!s.meldung && s.phase === 'suche') weiter('lesen');
          return {
            titel: '7 · Der WR beobachtet',
            text: 'Du hast die Anzeige gemeldet. In LK 1 muss dein Hund jetzt <b>3 Sekunden</b> ruhig liegen bleiben, bis der WR erwidert.<br>Nicht eingreifen, ein „Bleib!“ würde als Unterstützung abgezogen.',
          };
        case 'ende':
        default:
          return {
            titel: '8 · Geschafft!',
            text: 'Der WR gibt seine Bewertung: 60 Punkte Such- und 40 Punkte Anzeigeleistung, ab 70 ist die Disziplin bestanden.<br>Schau dir mit <b>„Nachbetrachtung ansehen“</b> deinen Laufweg, die Geruchsfahne und alle Fehler an.',
          };
      }
    };
    return t;
  }

  // ---------------------------------------------------------------- Rundgang durch den Hof
  const HOF_SCHRITTE = [
    { ziel: '.hof-kopf', titel: 'Dein Team', text: 'Name, Rasse und Alter deines Hundes, seine Leistungsklasse und deine Erfahrung als Hundeführer. Ein Klick aufs Hundebild ändert die Fellfarbe.' },
    { ziel: '.werte', titel: 'Werte und Energie', text: 'Die Werte bestimmen, wie dein Hund sucht und anzeigt. Die Energie sinkt mit jedem Training und erholt sich an freien Tagen.' },
    { ziel: '.wochenplan', titel: 'Wochenplan Mo – Mi – Fr', text: 'Drei Trainings pro Woche, dazwischen Erholung. Ein ausgeruhter Hund lernt mehr.' },
    { ziel: '.trainings', titel: 'Training', text: 'Jede Trainingsart verbessert bestimmte Werte. Mit der Übungssuche übst du ganze Suchlagen, auch automatisch zum Zuschauen.' },
    { ziel: '.empf-knopf', titel: 'Trainingsempfehlung', text: 'Hier steht, wo dein Hund Schwächen hat und was du als Nächstes trainieren solltest. Dafür werden auch die Fehler deiner letzten Suchen ausgewertet.' },
    { ziel: '.aufstieg', titel: 'Aufstieg', text: 'In jeder Disziplin mindestens 70 Punkte in der aktuellen Leistungsklasse, dann geht es eine LK höher.' },
    { ziel: '.ausschreibungen', titel: 'Prüfungen', text: 'Ab 15 Monaten darf dein Hund starten. In der Woche der Prüfung erscheint hier „Starten“. Du kannst selbst führen oder automatisch vorführen lassen.' },
    { ziel: '[data-a=woche]', titel: 'Woche beenden', text: 'Damit geht es in die nächste Woche: Der Hund erholt sich am Wochenende und wird älter.' },
    { ziel: '[data-a=nachbetrachtung]', titel: 'Nachbetrachtung und Leistungsnachweis', text: 'Die letzten Suchen kannst du hier nochmal abspielen, Prüfungsergebnisse stehen im Leistungsnachweis. Die Einführung findest du jederzeit unter „Einführung“.' },
  ];

  function hofRundgang(onEnde) {
    let i = 0;
    const blase = document.createElement('div');
    blase.className = 'coach coach-blase';
    document.body.appendChild(blase);
    let markiert = null;
    const aufraeumen = () => {
      if (markiert) markiert.classList.remove('coach-ziel');
      blase.remove();
      window.removeEventListener('resize', zeigen);
      if (onEnde) onEnde();
    };
    function zeigen() {
      while (i < HOF_SCHRITTE.length && !document.querySelector(HOF_SCHRITTE[i].ziel)) i += 1;
      if (i >= HOF_SCHRITTE.length) { aufraeumen(); return; }
      const sch = HOF_SCHRITTE[i];
      const el = document.querySelector(sch.ziel);
      if (markiert) markiert.classList.remove('coach-ziel');
      markiert = el;
      el.classList.add('coach-ziel');
      el.scrollIntoView({ block: 'center' });
      blase.innerHTML = `<div class="coach-titel">${sch.titel} <span class="klein">${i + 1}/${HOF_SCHRITTE.length}</span></div>
        <div>${sch.text}</div>
        <div class="knopfreihe"><button data-c="ende">Beenden</button><button class="primaer" data-c="weiter">${i + 1 < HOF_SCHRITTE.length ? 'Weiter' : 'Fertig'}</button></div>`;
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const b = blase.getBoundingClientRect();
        let top = r.bottom + 10;
        if (top + b.height > window.innerHeight - 8) top = Math.max(8, r.top - b.height - 10);
        const left = Math.min(window.innerWidth - b.width - 8, Math.max(8, r.left));
        blase.style.top = `${top}px`; blase.style.left = `${left}px`;
      });
    }
    blase.addEventListener('click', (ev) => {
      const c = ev.target.dataset.c;
      if (c === 'ende') aufraeumen();
      if (c === 'weiter') { i += 1; zeigen(); }
    });
    window.addEventListener('resize', zeigen);
    zeigen();
  }

  SHS.einfuehrung = { sucheOptionen, neuerSuchTutor, hofRundgang, HOF_SCHRITTE };
})(globalThis.SHS = globalThis.SHS || {});
