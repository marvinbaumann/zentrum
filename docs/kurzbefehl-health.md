# Schritte und Gewicht automatisch aus Apple Health nach Zentrum

Zentrum liest Dateien aus dem Ordner `inbox/` deines privaten Daten-Repositories (`zentrum-daten`). Ein Kurzbefehl auf dem iPhone legt dort kleine Textdateien ab. Beim nächsten Öffnen der App werden sie eingelesen und gelöscht.

Zeilenformat in der Datei (eine Zeile pro Wert):

```
steps,2026-09-19,8432
weight,2026-09-19,78.4
```

## Kurzbefehl „Zentrum Sync“ anlegen (einmalig, ca. 10 Minuten)

App „Kurzbefehle“ öffnen, „+“ oben rechts, Name „Zentrum Sync“. Dann diese Aktionen der Reihe nach hinzufügen (über die Suche unten):

1. **Datum** → „Aktuelles Datum“.
2. **Datum formatieren** → Eingabe: Datum aus Schritt 1, Datumsformat „Eigenes“, Format: `yyyy-MM-dd`. Ergebnis umbenennen in **Heute**.
3. **Datum anpassen** → „Subtrahiere 1 Tag“ von „Aktuelles Datum“. Danach **Datum formatieren** mit Format `yyyy-MM-dd`. Ergebnis umbenennen in **Gestern**.
4. **Health-Werte suchen** → Typ „Schritte“, Filter: Startdatum „ist heute“. Danach **Statistik berechnen** → „Summe“ von den Health-Werten. Ergebnis umbenennen in **SchritteHeute**.
5. Nochmal **Health-Werte suchen** → Typ „Schritte“, Filter: Startdatum „ist gestern“. Danach **Statistik berechnen** → „Summe“. Ergebnis umbenennen in **SchritteGestern**.
6. **Health-Werte suchen** → Typ „Gewicht“, Sortieren nach Startdatum, Reihenfolge „Neueste zuerst“, Limit 1. Ergebnis umbenennen in **Gewicht**. Danach **Details von Health-Wert** → „Startdatum“ von Gewicht, dann **Datum formatieren** mit `yyyy-MM-dd`, umbenennen in **GewichtDatum**.
7. **Text** mit genau diesem Inhalt (Variablen über die Leiste über der Tastatur einfügen):
   ```
   steps,Heute,SchritteHeute
   steps,Gestern,SchritteGestern
   weight,GewichtDatum,Gewicht
   ```
8. **Base64-codieren** → Eingabe: der Text aus Schritt 7. Ergebnis umbenennen in **Inhalt**.
9. **Datum formatieren** → Aktuelles Datum, Format `yyyyMMdd-HHmmss`. Umbenennen in **Stempel**.
10. **Inhalt von URL abrufen**:
    - URL: `https://api.github.com/repos/marvinbaumann/zentrum-daten/contents/inbox/Stempel.txt` (Stempel als Variable einsetzen)
    - Methode: **PUT**
    - Header: `Authorization` = `Bearer DEIN_SYNC_SCHLÜSSEL`, `Accept` = `application/vnd.github+json`
    - Textkörper: **JSON** mit zwei Feldern: `message` = `health`, `content` = Variable **Inhalt**

Einmal manuell ausführen. Zentrum öffnen, Körper-Tab: unten steht „Letzter Import“.

## Automatisch laufen lassen

In „Kurzbefehle“ auf „Automation“ → „+“:

- **Tageszeit** 12:00, 18:00 und 22:00 → „Zentrum Sync“ ausführen, „Sofort ausführen“ aktivieren (ohne Nachfrage).
- **App** → „Renpho“ → „wird geschlossen“ → „Zentrum Sync“ ausführen, „Sofort ausführen“. So kommt das Gewicht direkt nach dem Wiegen an.

Hinweis: Apple Health lässt sich nur lesen, solange das iPhone entsperrt ist. Läuft die 22-Uhr-Automation bei gesperrtem Handy, holt der 12-Uhr-Lauf am nächsten Tag die Schritte von gestern nach.
