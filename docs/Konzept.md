# Spielkonzept SHS-Game

## Idee
Du spielst den Hundeführer (HF). Der Hund sucht selbstständig nach seinem Gegenstand. Deine
Aufgabe ist es, die Suche gut zu begleiten, den Hund zu **lesen** und die Anzeige im richtigen
Moment zu melden. Training verbessert die Werte des Hundes. Auf Prüfungen startest du gegen
KI-Teams und wirst nach der PO bewertet.

## Fachliche Grundlage
VDH-Spürhundesport-Prüfungsordnung, gültig ab 01.07.2022. Alles, was die PO konkret festlegt,
steht als Daten in `js/po.js`:
- Leistungsklassen
- Flächengrößen
- Behältnisse und Riechkammern
- Verleitungen
- Suchzeiten
- Anzeigedauer
- Leinenregeln
- 60/40-Punkteaufteilung
- Fehlanzeige −10 und Abbruch bei der dritten
- 70-Punkte-Grenze
- Klassenaufstieg
- Mindestalter 15 Monate
- mindestens 8 Teilnehmer

Die Wertnoten sind identisch zu `shs_core.py` des SHS-Prüfungsprogramms:

| Wertnote | Einzeldisziplin (ED) | Dreikampf (DK) |
|---|---|---|
| V | 96 | 286 |
| SG | 90 | 270 |
| G | 80 | 240 |
| B | 70 | 210 |

## Spielannahmen (die PO nennt hier keine Zahlen)
Alle Werte stehen zentral in `po.ABZUEGE` und lassen sich dort anpassen.

| Fehler | Bereich | Abzug | Deckel |
|---|---|---|---|
| Hilfestellung/Führen (Hörzeichen, Richtungszeichen) | Such | 2 | 15 |
| Annahme einer Verleitung | Such | 5 | 20 |
| Wiederholtes Verlassen des Suchbereichs (ab dem 2.) | Such | 3 | 12 |
| Reaktion auf Außenreize | Such | 2 | 8 |
| Nachlassende Intensität / unselbstständig (anteilig) | Such | bis 10 | 10 |
| Übertreten des Mittelwegs (Fläche) | Such | 3 | 12 |
| Randalieren | Such | 3 | 9 |
| Augensuche | Such | 2 | 6 |
| Aktive Anzeige | Anzeige | 8 | 16 |
| Ungenaue Anzeige (> 20 cm, nicht bei Hochlagen) | Anzeige | 5 | 10 |
| Unruhige Anzeige (Zurückschauen) | Anzeige | 3 | 10 |
| Anzeige vor der Erwiderung aufgelöst | Anzeige | 6 | 12 |
| Unterstützung der Anzeige („Bleib!“) | Anzeige | 5 | 10 |

### Weitere Auslegungen
- **Handzeichen ohne Anzeige:** Hebt der HF den Arm, ohne dass der Hund anzeigt, zählt das als Fehlanzeige.
- **Fehlanzeige:** Der WR löst sie nach der ersten Anzeigephase auf. Danach wird der Hund neu angesetzt; das erste „Such!“ danach ist frei.
- **LK 3, Fläche:** Für das zweite Handzeichen darf der HF den Mittelweg verlassen und neben den Hund gehen.
- **Klassenaufstieg:** Die Bestwerte je Disziplin innerhalb einer LK werden über DK und ED gesammelt. Sind alle drei mindestens 70, steigt der Hund in die nächste LK auf.
- **Gegenstände im DK:** In LK 1 wird in allen drei Disziplinen derselbe Gegenstand gesucht. In LK 2 werden genau 2, in LK 3 genau 3 verschiedene Gegenstände auf die Disziplinen verteilt.

## Simulation
- **Geruch** (`scent.js`): Jede Quelle bildet einen Pool um sich und eine Windfahne. Die Fahne verbreitert sich mit dem Abstand, schwächt sich ab und schwankt leicht durch Turbulenz.
- **Hund** (`dog.js`): Zustandsautomat mit den Zuständen sucht, geruch, anzeigeEinnehmen, anzeige, verleitung, schautHF, aussenreiz, hier, beiHF.
  - **Freie Suche:** Der Hund läuft Wegpunkte an. Er bevorzugt Stellen, die er noch nicht abgesucht hat und die nahe beim HF liegen; ein selbstständiger Hund entfernt sich weiter.
  - **Wahrnehmung:** Ob der Hund den Geruch bemerkt, ist Zufall. Die Wahrscheinlichkeit hängt von der Signalstärke, der Nase und der Vertrautheit mit dem Gegenstand ab.
  - **Im Geruch:** Der Hund folgt dem Konzentrationsgefälle mit etwas Rauschen.
  - **Fehlanzeigen:** Eigengeruch, Differenzierungsgegenstand und Verleitungen können eine Fehlanzeige auslösen. Gegenwert sind die Werte Differenzierung und Impulskontrolle.
- **Körpersprache:** Rutenfrequenz und -höhe, Nase tief oder hoch, Kopfdrehen und Zurückschauen zum HF.
- **Ablauf** (`suchlage.js`): Die Suchlage läuft nach PO ab und funktioniert ohne Darstellung. Für KI-Teilnehmer steuert `HFBot` den Hundeführer, `simuliereSuche()` spielt eine komplette Suche durch.
- **Zufall:** Alle Zufallszahlen kommen aus einem festen Startwert (Seed). Gleiche Eingaben führen zum gleichen Ergebnis.

## Karriere
- **Wochen:** Pro Woche gibt es 3 Trainingseinheiten. Jede Einheit kostet Energie; ein müder Hund lernt weniger. Mit „Woche beenden“ erholt sich der Hund und wird älter.
- **Trainingsarten:**
  - Geruchskonditionierung (je Gegenstand)
  - Anzeigetraining
  - Impulskontrolle
  - Suchkondition
  - Umweltsicherheit
  - Differenzierung
  - Übungssuche
- **Ausschreibungen:** Alle 2–3 Wochen wird eine Prüfung ausgeschrieben, als ED oder DK, in der aktuellen LK.

## Dateien
| Datei | Inhalt |
|---|---|
| `js/po.js` | Regelwerk, Wertnoten, Platzierung |
| `js/rng.js` | reproduzierbarer Zufall |
| `js/scent.js` | Geruchsmodell |
| `js/layouts.js` | Suchlagen je Disziplin/LK |
| `js/judge.js` | Wertungsrichter |
| `js/dog.js` | Hundewerte, Rassen, Such-KI |
| `js/suchlage.js` | Ablauf einer Suchlage, HF-Bot, kopflose Simulation |
| `js/career.js` | Spielstand, Training, Leistungsnachweis, Aufstieg |
| `js/competition.js` | KI-Teams, Prüfungssimulation |
| `js/storage.js` | localStorage, Export/Import |
| `js/grafik.js` | Zeichenhilfen: Hund mit Fellzeichnung je Rasse und Farbvariante, Trümmerteile, Kiesboden, 3D-Nahaufnahme der Anzeige |
| `js/search.js` | Canvas-Darstellung und Eingabe der Suchlage |
| `js/ui.js` | Menüs und Bildschirme |

## Ideen für später
- Sound (Hörzeichen, Bellen, Wind)
- Echte Sprites statt Formen
- Mehrere Hunde je HF (PO erlaubt bis zu 2 je Prüfung)
- Wetter (Regen und Hitze beeinflussen den Geruch)
- Meisterschaften
- Trainingsminispiele, z. B. für das Timing der Belohnung beim Anzeigetraining

## Darstellung
- Suchlage in 2D von oben; die Ausrichtung (quer/hochkant) passt sich der Bildschirmform an.
- **Fell:** Jede Rasse hat Farbvarianten (z. B. Labrador gelb/schwarz/braun, Border Collie schwarz-weiß/rot-weiß/blue merle). Die Variante wird bei der Anlage gewählt und lässt sich im Hof durch Klick auf das Hundebild ändern (`hund.fell`).
- **Nahaufnahme der Anzeige (Taste N):** Sobald der Hund anzeigt, erscheint ein Fenster in 3D-Optik (Perspektive, Schattierung). Es zeigt den Hund in passiver Platzanzeige am Versteck, mit Körpersprache: Zurückschauen zum HF, aktives Scharren/Bellen, Rute. In der Übung wird zusätzlich der Abstand Nase–Quelle eingeblendet, rot ab mehr als 20 cm (Hochlagen ausgenommen).
