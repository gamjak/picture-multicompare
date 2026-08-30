# Vierblick

Vierblick vergleicht zwei bis vier lokale Bilder direkt im Browser. Die
Bilddateien werden weder hochgeladen noch gespeichert.

## Direkt als einzelne Datei

`npm run build:standalone` erzeugt `standalone-dist/Vierblick.html`. Diese
Datei lässt sich anschließend ohne lokalen Server direkt im Browser öffnen.

## Lokal starten

1. Abhängigkeiten mit `npm install` installieren.
2. Die Seite mit `npm run dev` starten.
3. Die angezeigte lokale Adresse öffnen.

## Bedienung

- Zwei Bilder werden mit einem vertikalen Trenner verglichen.
- Drei Bilder erscheinen in einer T-förmigen Aufteilung.
- Vier Bilder liegen in den vier Quadranten eines verschiebbaren Kreuzes.
- Der Trenner reagiert auf Maus, Touch und Pfeiltasten.
- Zoom, Bereichsnamen, Positionen und Vollbild lassen sich über die
  Werkzeugleiste steuern.
- „Automatisch ausrichten“ verwendet Bild A als Referenz und korrigiert B bis
  D lokal anhand von drei markanten Punkten. Der Schalter stellt sofort wieder
  die unveränderte, gleichmäßig skalierte und zentrierte Ansicht her.
- Sichere Treffer können mit „Punkte anzeigen“ nachvollzogen werden. Bei einem
  unsicheren Treffer bleibt das Bild zentriert und kann über drei manuell
  gesetzte Punktpaare ausgerichtet werden. Das manuelle Fadenkreuz lässt sich
  auch mit den Pfeiltasten bewegen und mit Eingabe bestätigen.
- Die Ausrichtung ist für kleine Verschiebungen, leichte Drehungen und geringe
  Größenunterschiede gedacht. Perspektivwechsel, starke Beschnitte oder
  bewegte Motive werden nicht verformt oder erzwungen.

## Prüfen

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `.\node_modules\.bin\oxfmt --check`
- `npm run build`
- `npm run build:standalone`
