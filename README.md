# Picture MultiCompare

Picture MultiCompare vergleicht zwei bis zwölf lokale Bilder gleichzeitig im
Browser. Die Bilddateien werden weder hochgeladen noch gespeichert.

## Direkt als einzelne Datei

`npm run build:standalone` erzeugt
`standalone-dist/Picture-MultiCompare.html`. Diese Datei lässt sich ohne
lokalen Server direkt im Browser öffnen.

## Lokal starten

1. Abhängigkeiten mit `npm install` installieren.
2. Die Seite mit `npm run dev` starten.
3. Die angezeigte lokale Adresse öffnen.

## Bedienung

- Zwei Bilder werden mit einem vertikalen Strich geteilt.
- Drei Bilder erscheinen in einer T-förmigen Aufteilung.
- Vier Bilder bilden ein diagonales X mit Bereichen oben, rechts, unten und
  links.
- Ab fünf Bildern erhält jedes Bild einen eigenen sternförmigen Sektor; A
  beginnt oben, die weiteren Bereiche folgen im Uhrzeigersinn.
- Alle geladenen Bilder sind gleichzeitig sichtbar. Der gemeinsame Mittelpunkt
  reagiert auf Maus, Touch und Pfeiltasten.
- Zoom, Beschriftungen und Vollbild lassen sich über die Werkzeugleiste
  steuern.
- „Automatisch ausrichten“ verwendet Bild A als Referenz und korrigiert B bis
  L lokal anhand von drei markanten Punkten. Der Schalter stellt sofort wieder
  die unveränderte, gleichmäßig skalierte und zentrierte Ansicht her.
- Sichere Treffer können mit „Punkte anzeigen“ nachvollzogen werden. Bei einem
  unsicheren Treffer bleibt das Bild zentriert und kann über drei manuell
  gesetzte Punktpaare ausgerichtet werden.
- Die Ausrichtung ist für kleine Verschiebungen, leichte Drehungen und geringe
  Größenunterschiede gedacht. Perspektivwechsel, starke Beschnitte oder
  bewegte Motive werden nicht verformt oder erzwungen.

## Prüfen

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npx oxfmt --check .`
- `npm run build`
- `npm run build:standalone`
