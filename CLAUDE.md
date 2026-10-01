# SHS-Game – Hinweise für Claude-Sitzungen

Browserspiel zum Spürhundesport (SHS-PO, gültig ab 01.07.2022) aus Sicht des Hundeführers.
Zuerst `docs/Konzept.md` lesen (Aufbau, Spielannahmen, Dateien).

## Grundregeln
- **Muss offline per Doppelklick auf `index.html` laufen** (`file://`): keine ES-Module, keine CDNs,
  keine Web-Fonts, kein Build-Schritt. Jede JS-Datei hängt sich per
  `(function (SHS) { ... })(globalThis.SHS = globalThis.SHS || {})` an den Namensraum `SHS`.
  Neue Dateien in `index.html` (Reihenfolge beachten) und ggf. `tests/helfer.js` eintragen.
- Logik (po, scent, layouts, judge, rassen, dog, wetter, suchlage, career, empfehlung, erfolge, competition) bleibt DOM-frei, damit sie
  in Node testbar ist. DOM/Canvas/Audio nur in `ton.js`, `grafik.js`, `search.js`, `nachbetrachtung.js` (Wiedergabeteil), `einfuehrung.js` (Hof-Rundgang), `ui.js`, `storage.js`, `main.js`.
- PO-Werte gehören nach `js/po.js`. Wo die PO keine Zahl nennt: als ANNAHME markieren und in
  `docs/Konzept.md` dokumentieren.
- Wertnoten müssen identisch zu `shs_core.py` im (separaten) SHS-Prüfungsprogramm bleiben.
- Version nur in `js/version.js` pflegen (und `package.json`).
- Bei Unklarheiten erst nachfragen, sonst sinnvolle Annahme treffen und dokumentieren.

## Befehle
- Tests: `node --test "tests/*.test.js"` (bzw. `npm test`)
- Dev-Server: `node tools/server.js 8123`
- Download-Paket: `powershell -ExecutionPolicy Bypass -File tools\paket.ps1` → `dist\SHS-Game-v<version>.zip`

## Git / GitHub
- Remote: https://github.com/mbruver-source/SHS-Game, Branch `main`. Online spielbar über GitHub Pages: https://mbruver-source.github.io/SHS-Game/
- Pro fertiger Version: Version in `js/version.js` + `package.json` erhöhen, Tests grün, Paket bauen,
  committen, Tag `vX.Y.Z` setzen und `git push origin main --tags` (so abgestimmt am 01.10.2026).

## Online-Version (Handy)
- Läuft ausschließlich über GitHub Pages (siehe oben); ein Push auf `main` aktualisiert die Seite.
- Der frühere private Claude-Artifact-Link wurde am 01.10.2026 auf Wunsch gelöscht.
