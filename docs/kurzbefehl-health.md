# Schritte und Gewicht automatisch aus Apple Health nach Zentrum

Zentrum liest Dateien aus dem Ordner `inbox/` deines privaten Daten-Repositories (`zentrum-daten`). Ein Kurzbefehl legt dort kleine Textdateien ab. Beim nächsten Öffnen der App werden sie eingelesen und gelöscht.

Die App versteht in der Datei die Wörter **heute** und **gestern** sowie Datumsangaben wie `19-09-2026`, `19.09.2026` oder `2026-09-19`. Zahlen dürfen Einheiten haben („78,4 kg“).

## Kurzbefehl „Zentrum Sync“

App „Kurzbefehle“ → „+“ → Name „Zentrum Sync“. Aktionen der Reihe nach:

1. **Datum** (liefert „Aktuelles Datum“).
2. **Datum anpassen** → „Subtrahieren 1 Tag von Aktuelles Datum“ (liefert „Angepasstes Datum“). Kein Formatieren nötig.
3. **Health-Werte suchen** → Typ **Schritte**, Filter **Startdatum ist heute**. Danach **Statistik berechnen** → **Summe**.
4. **Health-Werte suchen** → Typ **Schritte**, Filter **Startdatum ist am** → Variable **Angepasstes Datum**. Danach **Statistik berechnen** → **Summe**.
5. **Health-Werte suchen** → Typ **Gewicht**, Filter **Startdatum ist innerhalb der letzten 90 Tage**. Unten: **Sortieren nach Startdatum**, **Neueste zuerst**, **Beschränken** an, Limit **1**. Danach **Details von Health-Wert abrufen** → **Startdatum**.
6. **Text** mit drei Zeilen (Variablen über „Variable auswählen“ einfügen und die passende Aktion antippen):
   ```
   steps,heute,[Summe aus Schritt 3]
   steps,gestern,[Summe aus Schritt 4]
   weight,[Startdatum aus Schritt 5],[Health-Werte aus Schritt 5]
   ```
   Die Wörter „heute“ und „gestern“ sind normaler Text, die App rechnet sie selbst um. Datumsformat und Einheiten („78,4 kg“) sind egal.
7. **Base64-codieren** → Eingabe: der Text aus Schritt 6.
8. **Zufallszahl** zwischen 1 und 999999 (nur für einen eindeutigen Dateinamen).
9. **Inhalt von URL abrufen**:
   - URL: `https://api.github.com/repos/marvinbaumann/zentrum-daten/contents/inbox/` + Variable **Zufallszahl** + `.txt`
   - Methode **PUT**
   - Header: `Authorization` = `Bearer DEIN_SYNC_SCHLÜSSEL`, `Accept` = `application/vnd.github+json`
   - Textkörper **JSON**: `message` (Text) = `health`, `content` (Text) = Variable **Base64-codiert**

Einmal auf „▶“ tippen, Health-Zugriff erlauben. Dann Zentrum öffnen, Tab Körper: unten steht „Letzter Import“.

### Alternative ohne Datumsrechnung (nur falls „ist am“ Probleme macht)

Schritte 1–4 ersetzen durch: **Health-Werte suchen** (Schritte, „Startdatum ist innerhalb der letzten 2 Tage“, **Gruppieren nach Tag**, Sortieren nach Startdatum) → **Wiederholen mit jedem** mit darin **Details von Health-Wert abrufen** (Startdatum) und **Text** `steps,[Startdatum],[Wiederholungsobjekt]` → danach **Text kombinieren** (Neue Zeilen). Diesen kombinierten Text in Schritt 6 statt der beiden Schritte-Zeilen einfügen.

## Automatisch laufen lassen

„Automation“ → „+“:

- **Tageszeit** 12:00, 18:00 und 22:00 → „Zentrum Sync“ → „Sofort ausführen“.
- **App** → **Renpho** → „wird geschlossen“ → „Zentrum Sync“ → „Sofort ausführen“. So kommt das Gewicht direkt nach dem Wiegen an.

Hinweis: Apple Health lässt sich nur lesen, solange das iPhone entsperrt ist. Läuft eine Automation bei gesperrtem Handy ins Leere, holt der nächste Lauf die Schritte von gestern nach.
