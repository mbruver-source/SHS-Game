// Spielstand im localStorage des Browsers + Export/Import als JSON-Datei.
(function (SHS) {
  'use strict';
  const KEY = 'shs-game-spielstand';

  function laden() {
    try {
      const roh = localStorage.getItem(KEY);
      if (!roh) return null;
      const s = JSON.parse(roh);
      return pruefen(s) ? s : null;
    } catch (e) {
      return null;
    }
  }

  function speichern(stand) {
    try {
      localStorage.setItem(KEY, JSON.stringify(stand));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loeschen() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorieren */ }
  }

  function pruefen(s) {
    return s && s.version === 1 && s.hund && s.hund.werte && Array.isArray(s.leistungsnachweis);
  }

  function exportieren(stand) {
    const blob = new Blob([JSON.stringify(stand, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SHS-Spielstand-${stand.hund.name}-Woche${stand.woche}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function importieren(datei) {
    return datei.text().then((text) => {
      const s = JSON.parse(text);
      if (!pruefen(s)) throw new Error('Die Datei ist kein gültiger SHS-Spielstand.');
      return s;
    });
  }

  SHS.storage = { laden, speichern, loeschen, exportieren, importieren, pruefen };
})(globalThis.SHS = globalThis.SHS || {});
