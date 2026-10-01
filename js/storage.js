// Spielstände im localStorage des Browsers: mehrere Benutzer (Profile), je Profil mehrere Hunde.
// Export/Import als JSON-Datei. Ein alter Einzel-Spielstand (Version 1) wird automatisch übernommen.
(function (SHS) {
  'use strict';
  const ALT_KEY = 'shs-game-spielstand'; // Version 1 (ein Hund, ein Spielstand)
  const INDEX_KEY = 'shs-game-profile';
  const PROFIL_KEY = (id) => 'shs-game-profil-' + id;

  function lesen(key) {
    try {
      const roh = localStorage.getItem(key);
      return roh ? JSON.parse(roh) : null;
    } catch (e) {
      return null;
    }
  }

  function schreiben(key, wert) {
    try {
      localStorage.setItem(key, JSON.stringify(wert));
      return true;
    } catch (e) {
      return false;
    }
  }

  function pruefenTeam(s) {
    return s && s.version === 1 && s.hund && s.hund.werte && Array.isArray(s.leistungsnachweis);
  }

  function pruefenProfil(p) {
    return p && p.version === 2 && Array.isArray(p.teams) && p.teams.length > 0 && p.teams.every(pruefenTeam);
  }

  // Liste der Profile [{ id, name, hunde, geaendert }]; übernimmt ggf. den alten Einzel-Spielstand.
  function profile() {
    let index = lesen(INDEX_KEY);
    if (!Array.isArray(index)) index = [];
    if (!index.length) {
      const alt = lesen(ALT_KEY);
      if (pruefenTeam(alt)) {
        const p = SHS.career.ausAltemStand(alt);
        speichernProfil(p, index);
        index = lesen(INDEX_KEY) || [];
      }
    }
    return index.sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0));
  }

  function ladenProfil(id) {
    const p = lesen(PROFIL_KEY(id));
    return pruefenProfil(p) ? p : null;
  }

  function speichernProfil(p, indexVorgabe) {
    if (!schreiben(PROFIL_KEY(p.id), p)) return false;
    const index = (indexVorgabe || lesen(INDEX_KEY) || []).filter((x) => x.id !== p.id);
    index.push({ id: p.id, name: p.hfName, hunde: p.teams.map((t) => t.hund.name), geaendert: Date.now() });
    return schreiben(INDEX_KEY, index);
  }

  function loeschenProfil(id) {
    try {
      localStorage.removeItem(PROFIL_KEY(id));
      const index = (lesen(INDEX_KEY) || []).filter((x) => x.id !== id);
      schreiben(INDEX_KEY, index);
    } catch (e) { /* ignorieren */ }
  }

  function exportieren(profil) {
    const blob = new Blob([JSON.stringify(profil, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SHS-Spielstand-${profil.hfName}-Woche${profil.teams[0].woche}.json`.replace(/[^\w.\-äöüÄÖÜß]/g, '_');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // Import: Profil (Version 2) oder alter Einzel-Spielstand (Version 1). Wird als eigenes Profil angelegt.
  function importieren(datei) {
    return datei.text().then((text) => {
      const d = JSON.parse(text);
      let p = null;
      if (pruefenProfil(d)) p = d;
      else if (pruefenTeam(d)) p = SHS.career.ausAltemStand(d);
      if (!p) throw new Error('Die Datei ist kein gültiger SHS-Spielstand.');
      const vorhanden = lesen(INDEX_KEY) || [];
      if (vorhanden.some((x) => x.id === p.id)) p.id = p.id + '-' + Date.now().toString(36);
      return p;
    });
  }

  SHS.storage = { profile, ladenProfil, speichernProfil, loeschenProfil, exportieren, importieren, pruefenProfil, pruefenTeam };
})(globalThis.SHS = globalThis.SHS || {});
