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

## Prüfen

- `npm test`
- `npm run typecheck`
- `npm run build`
