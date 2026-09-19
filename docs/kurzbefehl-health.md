# Schritte und Gewicht automatisch aus Apple Health nach Zentrum

Zentrum liest Dateien aus dem Ordner `inbox/` deines privaten Daten-Repositories (`zentrum-daten`). Ein Kurzbefehl legt dort kleine Textdateien ab. Beim nächsten Öffnen der App werden sie eingelesen und gelöscht.

Die App versteht in der Datei die Wörter **heute** und **gestern** sowie Datumsangaben wie `19-09-2026`, `19.09.2026` oder `2026-09-19`. Zahlen dürfen Einheiten haben („78,4 kg“).

## Kurzbefehl „Zentrum Sync“

Die Schritte holt der Kurzbefehl als fertige Tagessummen aus Apple Health („Gruppieren nach Tag“), es ist also keine Datumsrechnung nötig.

1. **Health-Werte suchen** → Typ **Schritte**. Filter: **Startdatum** → **ist innerhalb der letzten** → **2 Tage**. Unten **Gruppieren nach: Tag**, **Sortieren nach: Startdatum**.
2. **Wiederholen mit jedem** (Eingabe: die Health-Werte aus 1). In die Schleife kommen zwei Aktionen:
   - **Details von Health-Wert abrufen** → **Startdatum** von **Wiederholungsobjekt**.
   - **Text** mit einer Zeile: `steps,` dann Variable **Startdatum**, dann `,` dann Variable **Wiederholungsobjekt**.
3. Nach der Schleife: **Text kombinieren** → Eingabe **Ergebnisse der Wiederholung**, kombinieren mit **Neue Zeilen**.
4. **Health-Werte suchen** → Typ **Gewicht**, **Sortieren nach Startdatum**, **Neueste zuerst**, **Beschränken** an, 1. Danach **Details von Health-Wert abrufen** → **Startdatum**.
5. **Text** mit zwei Zeilen:
   ```
   [Kombinierter Text aus 3]
   weight,[Startdatum aus 4],[Health-Werte aus 4]
   ```
6. **Base64-codieren** → Eingabe: der Text aus 5.
7. **Zufallszahl** zwischen 1 und 999999.
8. **Inhalt von URL abrufen**:
   - URL: `https://api.github.com/repos/marvinbaumann/zentrum-daten/contents/inbox/` + Variable **Zufallszahl** + `.txt`
   - Methode **PUT**
   - Header: `Authorization` = `Bearer DEIN_SYNC_SCHLÜSSEL`, `Accept` = `application/vnd.github+json`
   - Textkörper **JSON**: `message` (Text) = `health`, `content` (Text) = Variable **Base64-codiert**

Einmal auf „▶“ tippen, Health-Zugriff erlauben. Dann Zentrum öffnen, Tab Körper: unten steht „Letzter Import“.

## Automatisch laufen lassen

„Automation“ → „+“:

- **Tageszeit** 12:00, 18:00 und 22:00 → „Zentrum Sync“ → „Sofort ausführen“.
- **App** → **Renpho** → „wird geschlossen“ → „Zentrum Sync“ → „Sofort ausführen“. So kommt das Gewicht direkt nach dem Wiegen an.

Hinweis: Apple Health lässt sich nur lesen, solange das iPhone entsperrt ist. Läuft eine Automation bei gesperrtem Handy ins Leere, holt der nächste Lauf die Schritte von gestern nach.
