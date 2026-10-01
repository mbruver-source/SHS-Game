# SHS – Spürhundesport (Browserspiel)

Ein 2D-Browserspiel aus Sicht des Hundeführers: Du bildest deinen Hund im Spürhundesport aus
und startest auf Prüfungen nach der **VDH-Spürhundesport-Prüfungsordnung (gültig ab 01.07.2022)**:
Trümmersuche, Flächensuche, Behältnisstrecke, Leistungsklassen 1–3, Einzeldisziplin und Dreikampf.

## Spielen

**Lokal und offline:** `index.html` doppelklicken. Du brauchst weder Installation noch Server
noch Internet.

**Zum Weitergeben/Herunterladen:** `npm run paket` (oder `powershell -ExecutionPolicy Bypass -File tools\paket.ps1`)
erzeugt `dist\SHS-Game-v<version>.zip`. Entpacken und `index.html` öffnen.

Mehrere Benutzer (je mit mehreren Hunden) teilen sich einen Browser; jeder hat seinen eigenen Spielstand im localStorage. Mit **Spielstand exportieren/importieren**
nimmst du ihn auf einen anderen Rechner oder in einen anderen Browser mit.

### Steuerung in der Suchlage

| Taste | Aktion |
|---|---|
| W A S D / Pfeile | Hundeführer bewegen |
| H | Handzeichen: Bereitschaft melden / Anzeige melden |
| Leertaste | „Such!“ (erstes Schicken frei, weitere = Hilfe) |
| Mausklick | Richtungszeichen (Führen, Abzug) |
| R | „Hier!“ |
| B | „Bleib!“ während der Anzeige (Unterstützung, Abzug) |
| E halten | Versteck anfassen (Eigengeruch 3 s) / Antäuschen |
| G | Geruchsansicht (nur Übungssuche) |
| N | Nahaufnahme der Anzeige ein/aus |
| T | Zeitraffer (automatische Vorführung) |
| M | Töne ein/aus |
| P | Pause |

## Entwicklung

- Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build-Schritt.
- Tests: `npm test` (Node ≥ 20, nutzt `node:test`)
- Dev-Server (optional, nur zum Testen): `npm start` → http://localhost:8123
- Aufbau und Spielannahmen: [docs/Konzept.md](docs/Konzept.md)

### Tablet und Handy
Auf Touch-Geräten erscheint in der Suchlage automatisch ein Steuerkreis (links unten, Hundeführer bewegen)
und Tasten für Such!, ✋ Arm, Hier!, Bleib!, Anfassen (halten) und Nahaufnahme. Mit „Touch“ im HUD lässt
sich die Bildschirm-Steuerung auch am PC ein- oder ausschalten. Ein Tipp aufs Spielfeld gibt ein Richtungszeichen.
