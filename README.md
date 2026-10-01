# SHS – Spürhundesport

Ein Browserspiel zum **Spürhundesport (SHS)**. Du bist Hundeführerin oder Hundeführer und
bildest deinen Hund aus. Dann startest du auf Prüfungen nach der Spürhundesport-Prüfungsordnung
(gültig ab 01.07.2022): Trümmersuche, Flächensuche und Behältnisstrecke, Leistungsklassen 1 bis 3,
Einzeldisziplin und Dreikampf, bis hin zu Landes- und Bundesmeisterschaft.

**Online spielen:** https://mbruver-source.github.io/SHS-Game/ (läuft im Browser, auch auf Tablet und Handy)

## Worum es geht

Der Hund sucht selbstständig. Du begleitest ihn, liest seine Körpersprache und meldest die Anzeige im
richtigen Moment mit dem Handzeichen. Der Wertungsrichter bewertet nach PO: 60 Punkte Suchleistung,
40 Punkte Anzeigeleistung, ab 70 Punkten ist eine Disziplin bestanden.

- **Suchlagen:** Trümmerfeld, Fläche mit Mittelweg und Behältnisstrecke, aufgebaut nach den Vorgaben
  jeder Leistungsklasse. Dazu kommen Verleitungen, Eigengeruch und Differenzierung.
- **Simulierter Geruch:** Die Geruchsfahne hängt von Wind und Wetter ab. Der Hund nimmt Geruch wahr,
  arbeitet ihn aus und zeigt an, mal sauber, mal unsicher.
- **Training:** Mo, Mi und Fr wird trainiert, an den Tagen dazwischen erholt sich der Hund.
  Es gibt eine Trainingsempfehlung und ein Minispiel im Anzeigetraining.
- **Prüfungen:** gegen KI-Teams, mit Rangliste, Leistungsnachweis, Klassenaufstieg, Meisterschaften und Urkunde.
- **Nachbetrachtung:** Jede Suche lässt sich mit Laufweg, Geruchsfahne und Fehlerstellen nochmal ansehen.
- **Mehrere Benutzer** mit mehreren Hunden, 30 Rassen in verschiedenen Fellfarben, Rüde oder Hündin.
- **Einführung** für den Einstieg, Erfolge, Statistik, Werteverlauf, Töne und Touch-Bedienung.

## Spielen

**Online:** über den Link oben. Der Spielstand bleibt im Browser des jeweiligen Geräts.

**Offline am PC:** Das Repository als ZIP herunterladen (grüner Button „Code“ → „Download ZIP“), entpacken und
`index.html` doppelklicken. Du brauchst weder Installation noch Server noch Internet.

**Spielstand mitnehmen:** Im Spiel unter „Spielstand exportieren“ eine Datei speichern oder den Text kopieren.
Auf dem anderen Gerät unter „Importieren“ wieder einlesen.

### Steuerung in der Suchlage

| Taste | Aktion |
|---|---|
| W A S D / Pfeile | Hundeführer bewegen |
| H | Handzeichen: Bereitschaft melden bzw. Anzeige melden |
| Leertaste | „Such!“ (das erste Schicken ist frei, jedes weitere zählt als Hilfe) |
| Mausklick | Richtungszeichen (Führen, kostet Punkte) |
| R | „Hier!“ |
| B | „Bleib!“ während der Anzeige (Unterstützung, kostet Punkte) |
| E halten | Versteck anfassen (Eigengeruch, 3 s) bzw. antäuschen |
| G | Geruchsansicht (nur in der Übungssuche) |
| N | Nahaufnahme der Anzeige ein/aus |
| T | Zeitraffer bei automatischer Vorführung |
| M | Töne ein/aus |
| P | Pause |

Auf Tablet und Handy erscheinen ein Steuerkreis und Tasten auf dem Bildschirm.

## Hinweise

- Das Spiel ist ein **privates Fanprojekt**. Es steht in keiner Verbindung zum VDH oder zu einem
  Mitgliedsverband. Ergebnisse im Spiel sind keine Prüfungsergebnisse.
- Die Regeln sind nach der Prüfungsordnung sinngemäß umgesetzt. Wo die PO keine Zahlen nennt, etwa die
  Höhe einzelner Punktabzüge, nutzt das Spiel eigene Annahmen. Sie sind in
  [docs/Konzept.md](docs/Konzept.md) dokumentiert und zentral in `js/po.js` einstellbar.

## Entwicklung

- Reines HTML, CSS und JavaScript, ohne Abhängigkeiten und ohne Build-Schritt. Das Spiel läuft per Doppelklick (`file://`).
- Tests: `npm test` bzw. `node --test "tests/*.test.js"` (Node ab Version 20)
- Dev-Server (optional): `npm start`, dann http://localhost:8123
- Download-Paket (Windows): `npm run paket` erzeugt `dist\SHS-Game-v<version>.zip`
- Aufbau, Spielannahmen und Dateien: [docs/Konzept.md](docs/Konzept.md); Versionen: [CHANGELOG.md](CHANGELOG.md)

## Lizenz

[MIT](LICENSE)
