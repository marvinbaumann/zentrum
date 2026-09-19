# Zentrum

Persönliches Dashboard für Gesundheit, Training, Arbeit und Alltag. Eine Web-App, die auf dem iPhone als Home-Screen-App läuft.

## Lokal starten

```bash
node serve.js
```

Dann http://127.0.0.1:5173 öffnen. Kein Build-Schritt, keine Abhängigkeiten.

## Aufbau

- `index.html`, `styles.css` – Gerüst und Design (Apple-inspiriert, hell/dunkel automatisch)
- `js/store.js` – Zustand, Speicherung im Browser (localStorage), Datums-Helfer
- `js/habits.js` – Tages-Standards, Wochenziele, Streak-Berechnung
- `js/views/heute.js` – Heute-Ansicht, Einstellungen, Standards verwalten
- `js/views/training.js` – Trainingsplan und Progressive-Overload-Logik
- `js/views/koerper.js` – Gewicht und Schritte mit Verlauf
- `js/views/listen.js` – Arbeit und Privat: Termine, Heute, Ideen
- `sw.js`, `manifest.json`, `icons/` – Offline-Fähigkeit und Home-Screen-Installation

## Progressive Overload

Jede Übung hat eine Rep-Range (z. B. 10–15), ein Gewicht und ein aktuelles Rep-Ziel. Schaffen alle Sätze das Ziel, steigt das Ziel um eins. Schaffen alle Sätze das Maximum, geht das Gewicht um die Steigerung hoch und das Ziel zurück auf das Minimum.

## Cloud-Sicherung

Optional: In den Einstellungen "Cloud-Sicherung einrichten". Die App speichert dann den kompletten Zustand als `zentrum.json` in einem privaten GitHub-Repository (Standard: `zentrum-daten`). Jede Änderung wird nach 1,5 s hochgeladen, beim Öffnen wird der neuere Stand geholt. Der Schlüssel (GitHub Personal Access Token mit `repo`-Recht) liegt nur im Browser-Speicher des Geräts, nie im Code.
