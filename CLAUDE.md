# SHS-Game – Hinweise für Claude-Sitzungen

Browserspiel zum Spürhundesport (VDH-SHS-PO, gültig ab 01.07.2022) aus Sicht des Hundeführers.
Zuerst `docs/Konzept.md` lesen (Aufbau, Spielannahmen, Dateien).

## Grundregeln
- **Muss offline per Doppelklick auf `index.html` laufen** (`file://`): keine ES-Module, keine CDNs,
  keine Web-Fonts, kein Build-Schritt. Jede JS-Datei hängt sich per
  `(function (SHS) { ... })(globalThis.SHS = globalThis.SHS || {})` an den Namensraum `SHS`.
  Neue Dateien in `index.html` (Reihenfolge beachten) und ggf. `tests/helfer.js` eintragen.
- Logik (po, scent, layouts, judge, rassen, dog, suchlage, career, empfehlung, competition) bleibt DOM-frei, damit sie
  in Node testbar ist. DOM/Canvas nur in `grafik.js`, `search.js`, `ui.js`, `storage.js`, `main.js`.
- PO-Werte gehören nach `js/po.js`. Wo die PO keine Zahl nennt: als ANNAHME markieren und in
  `docs/Konzept.md` dokumentieren.
- Wertnoten müssen identisch zu `shs_core.py` im SHS-Prüfungsprogramm bleiben
  (`C:\Users\mbruv\Documents\SHS-Pruefungsprogramm-Git`).
- Version nur in `js/version.js` pflegen (und `package.json`).
- Bei Unklarheiten erst nachfragen, sonst sinnvolle Annahme treffen und dokumentieren.

## Befehle
- Tests: `node --test "tests/*.test.js"` (bzw. `npm test`)
- Dev-Server: `node tools/server.js 8123`
- Download-Paket: `powershell -ExecutionPolicy Bypass -File tools\paket.ps1` → `dist\SHS-Game-v<version>.zip`
