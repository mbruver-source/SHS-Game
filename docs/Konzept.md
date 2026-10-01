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
- **LK 3, Fläche:** Das zweite Handzeichen gibt der HF auf dem Mittelweg auf Höhe des Hundes (er darf den Mittelweg nicht verlassen).
- **Klassenaufstieg** (mit Marco abgestimmt, 01.10.2026): Die Bestwerte je Disziplin innerhalb einer LK werden über DK und ED gesammelt. Sind alle drei mindestens 70, steigt der Hund in die nächste LK auf. Der Fortschritt wird im Hof angezeigt.
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
| `js/rassen.js` | 30 verbreitete Rassen + Mischling: Spielwerte, Körperbau, Farbvarianten (einzige Quelle) |
| `js/dog.js` | Hundewerte und Such-KI inkl. Bewegungsphysik und Umrunden von Verstecken |
| `js/suchlage.js` | Ablauf einer Suchlage, HF-Bot, kopflose Simulation |
| `js/career.js` | Spielstand, Training, Leistungsnachweis, Aufstieg |
| `js/empfehlung.js` | Trainingsempfehlung: Schwächen, Geruchsbilder, Fehlerauswertung, Rangliste der Trainings |
| `js/competition.js` | KI-Teams, Prüfungssimulation |
| `js/storage.js` | localStorage, Export/Import |
| `js/grafik.js` | Zeichenhilfen: Hund mit Fellzeichnung je Rasse und Farbvariante, Trümmerteile, Kiesboden, 3D-Nahaufnahme der Anzeige |
| `js/search.js` | Canvas-Darstellung und Eingabe der Suchlage |
| `js/nachbetrachtung.js` | Aufzeichnung exportieren/archivieren, Wiedergabe mit Laufweg, Ereignissen, Zeitleiste |
| `js/einfuehrung.js` | Einstieg: geführte erste Suche (Coach) und Rundgang durch den Hof |
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

## Rassen, Bewegung und Training (v0.4)
- **Rassen:** Es gibt 30 in Deutschland verbreitete Rassen plus Mischling; die Reihenfolge ist eine Näherung. Jede Rasse hat drei Arten von Angaben:
  - Spielwerte als Abweichung vom Grundwert
  - Körperbau: Größe, Rumpflänge und -breite, Beinlänge, Fanglänge, Ohrform (Steh-, Kipp- oder Hängeohr), Rutenform, Fellart
  - Farbvarianten
- **Darstellung:** Der Hund wird von oben und von der Seite mit anatomischer Silhouette gezeichnet. Dazu kommen Fellschattierung, Abzeichen und eine Fellstruktur am Rand (lang, doppelt, lockig, rau).
- **Bewegung:**
  - Der Hund läuft in Blickrichtung. Er dreht mit begrenzter Geschwindigkeit und wird in Kurven langsamer.
  - Er beschleunigt und bremst weich.
  - Die Beine bewegen sich im Trab in diagonalen Paaren, der Rumpf biegt sich in Kurven und die Rute schwingt nach.
  - Hinsetzen und Ablegen laufen als Übergang ab. Beim Liegen ist die Atmung zu sehen.
- **Systematisches Absuchen:** Der Ausbildungsstand ergibt sich aus Nase, Selbstständigkeit und Konzentration.
  - Gut ausgebildete Hunde umrunden Verstecke im Trümmerfeld und Behältnisse eng und vollständig, bis etwa 380°.
  - Weniger geübte Hunde laufen nur einen Bogen oder lassen das Versteck aus.
  - Abgesuchte Verstecke werden gemerkt und seltener erneut angelaufen.
- **Trainingsrhythmus Mo – Mi – Fr:**
  - Jede Einheit kostet 30 % Energie.
  - Am freien Tag dazwischen (Di, Do) erholt sich der Hund um 16 %.
  - Am Wochenende erholt er sich um 60 %, ausgelassene Einheiten bringen zusätzliche Ruhe.
  - Ausgeruht (Energie ab 75 %) lernt der Hund 10 % mehr, müde (unter 35 %) nur 45 %.
  - Die Energie bestimmt auch die anfängliche Suchmotivation in Übung und Prüfung. Wer am Freitag vor einer Samstagsprüfung hart trainiert, startet mit einem weniger frischen Hund.

## Automatische Vorführung (v0.5)
- **Drei Arten der Vorführung:** Bei der Prüfungsanmeldung wählst du für alle Disziplinen gemeinsam:
  - selbst führen
  - automatisch und zuschauen (Zeitraffer 1×/2×/4× mit T, Pause mit P)
  - automatisch und sofort auswerten
- **Übungssuche:** Auch hier lässt sich die Suche automatisch vorführen.
- **Ergebnis:** Es hängt vom Trainingsstand ab. Die Werte des Hundes steuern die Hunde-KI, die HF-Erfahrung den automatischen Hundeführer (`HFBot`): wie schnell und sicher er eine Anzeige erkennt und wie oft er unnötig hilft.
- **HF-Erfahrung** (`career.hfErfahrung`): 25 % + 0,8 % je Training + 2 % je Übungssuche + 4 % je Prüfung, höchstens 95 %.
- **Fläche:** Der Hundeführer bewegt sich nur auf dem Mittelweg. Das gilt für Start und Vorbereitung, für das Mitgehen während der Suche und für das zweite Handzeichen in LK 3, das auf dem Mittelweg auf Höhe des Hundes gegeben wird. Ein Handzeichen neben dem Mittelweg wird nicht angenommen; jedes Verlassen kostet Punkte. Der Mittelweg ist im Spiel gestrichelt markiert.

## Trainingsempfehlung (v0.6)
Den eigenen Menüpunkt „Trainingsempfehlung“ erreichst du im Hof (💡 neben „Training“ oder unten in der Leiste). Er zeigt:
- **Empfehlungen:** bis zu 6, gereiht nach Priorität, jeweils mit Begründung und Button zum direkten Trainieren bzw. zur Übungssuche. In die Priorität fließen ein:
  - Abstand der Werte zum Zielwert der LK. ANNAHME: Ziel LK 1 = 45, LK 2 = 60, LK 3 = 75; Differenzierung wird in LK 1 nur zur Hälfte gefordert.
  - Geruchsbilder: so viele Gegenstände, wie die LK verlangt, müssen zu mindestens 60 % vertraut sein.
  - Fehler der letzten 8 eigenen Suchen (Übung und Prüfung, neuere zählen stärker). Zuordnung:
    - aktiv, ungenau, unruhig, aufstehen, Unterstützung → Anzeigetraining
    - Verleitung, Randalieren → Impulskontrolle
    - Außenreiz, Verlassen → Umweltsicherheit
    - Hilfe, Augensuche, nachlassende Intensität, nicht gefunden → Suchkondition
    - Fehlanzeigen → Differenzierung
  - Für den Aufstieg noch fehlende Disziplinen → Übungssuche.
  - Prüfung in den nächsten 2 Wochen → Übungssuche in deren Disziplin(en).
  - Energie unter 35 % → zuerst Erholung.
- **Hinweise für den HF:** Mittelweg, weniger Hilfen, den Hund lesen, kein hartes Freitagstraining vor einer Samstagsprüfung.
- **Stärken und Schwächen:** Balken je Wert mit Ziel-Strich der aktuellen LK.
- **Geruchsbilder:** Stand der für die LK benötigten Gegenstände.
- **Fehler der letzten Suchen:** Häufigkeit je Fehlerart.
- **Protokoll:** Grundlage ist `stand.suchprotokoll` mit den letzten 30 eigenen Suchen.

## Nachbetrachtung (v0.7)
- **Aufzeichnung:** Jede Suche wird aufgezeichnet (`SuchLage.aufzeichnung`).
  - Alle 0,1 s ein Bild mit Position, Richtung, Zustand und Körpersprache des Hundes sowie Position und Arm des HF.
  - Ereignisse mit Zeit und Ort: Fehler des WR, Meldungen des WR, Hund im Geruch, Anzeige (richtig/falsch, mit Abstand), Verleitung, Zurückschauen zum HF, Außenreize.
- **Wiedergabe:** Nach dem Ergebnis über „Nachbetrachtung ansehen“, danach geht es mit „Weiter“ normal weiter. Zusätzlich gibt es im Hof den Punkt „Nachbetrachtung“ mit den letzten 5 Suchen (`stand.aufzeichnungen`, auf ein 0,3-s-Raster verkleinert, ca. 8–20 KB je Suche).
- **Darstellung:**
  - Laufweg nach Zustand gefärbt, Weg des HF gestrichelt.
  - Nummerierte Markierungen; die Ereignisliste springt per Klick an die Stelle.
  - Bewertung des WR, Geruchsfahne und Nahaufnahme zuschaltbar.
  - Zeitleiste und Tempo 1–8×; Leertaste = Play/Pause, Pfeile = ±5 s.
- **Suchlage:** Sie wird aus dem Seed neu erzeugt; verschobene Verstecke und der angebrachte Eigengeruch werden aus der Aufzeichnung übernommen.

## Einführung für neue Spieler (v0.8)
- **Angebot:** Ein neues Team bekommt die Einführung automatisch angeboten. Später geht es jederzeit über „Einführung“ im Hof. Die Einführung zählt nicht als Trainingseinheit.
- **Geführte erste Suche:** Behältnisstrecke LK 1 mit fester Suchlage (Seed 4242), mit Leine, ohne Außenreize, mit dem bestbekannten Gegenstand. Ein Coach reagiert auf den Spielzustand (`einfuehrung.neuerSuchTutor`):
  1. Bewegen
  2. Bereitschaft (H)
  3. „Such!“
  4. Mitgehen, Wind und Körpersprache lesen
  5. Hund im Geruch – nicht eingreifen
  6. Anzeige in der Nahaufnahme prüfen, dann H
  7. Anzeigedauer abwarten
  8. Ergebnis und Nachbetrachtung

  Situationsabhängige Tipps gibt es, wenn der Hund zum HF schaut oder unsicher anzeigt; nach 20 s kommt der Hinweis auf die Geruchsansicht.
- **Hof-Rundgang:** 9 Sprechblasen mit Markierung des jeweiligen Bereichs: Team, Werte/Energie, Wochenplan, Training, Trainingsempfehlung, Aufstieg, Prüfungen, Woche beenden, Nachbetrachtung/Leistungsnachweis.
- **Spielstand:** `stand.einfuehrung` merkt sich, was schon angeboten bzw. gesehen wurde.
