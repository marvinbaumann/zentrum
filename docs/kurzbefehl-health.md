# Schritte und Gewicht automatisch aus Apple Health nach Zentrum

Zentrum liest Dateien aus dem Ordner `inbox/` deines privaten Daten-Repositories (`zentrum-daten`). Ein Kurzbefehl legt dort kleine Textdateien ab. Beim nächsten Öffnen der App werden sie eingelesen und gelöscht.

Die App versteht in der Datei die Wörter **heute** und **gestern** sowie Datumsangaben wie `19-09-2026`, `19.09.2026` oder `2026-09-19`. Zahlen dürfen Einheiten haben („78,4 kg“).

## Kurzbefehl „Zentrum Sync“ (7 Aktionen)

App „Kurzbefehle“ → „+“ → Name „Zentrum Sync“. Aktionen der Reihe nach (unten „Aktionen suchen“):

1. **Health-Werte suchen** → Typ **Schritte**. Filter hinzufügen: **Startdatum** → **ist heute**. Danach **Statistik berechnen** → **Summe** (Eingabe: die Health-Werte von eben).
2. **Health-Werte suchen** → Typ **Schritte**. Filter: **Startdatum** → **ist gestern**. Danach **Statistik berechnen** → **Summe**.
3. **Health-Werte suchen** → Typ **Gewicht**. Sortieren nach **Startdatum**, Reihenfolge **Neueste zuerst**, **Limit** einschalten, 1. Danach **Details von Health-Wert abrufen** → **Startdatum**.
4. **Text** mit genau drei Zeilen. Die blauen Variablen fügst du über „Variable auswählen“ ein und tippst dann die passende Aktion an:
   ```
   steps,heute,[Summe aus Schritt 1]
   steps,gestern,[Summe aus Schritt 2]
   weight,[Startdatum aus Schritt 3],[Health-Werte aus Schritt 3]
   ```
5. **Base64-codieren** → Eingabe: der Text.
6. **Zufallszahl** → zwischen 1 und 999999. (Nur damit jede Datei einen eigenen Namen hat.)
7. **Inhalt von URL abrufen**:
   - URL: `https://api.github.com/repos/marvinbaumann/zentrum-daten/contents/inbox/` und direkt dahinter die Variable **Zufallszahl** und dann `.txt`
   - Methode: **PUT**
   - Header: `Authorization` = `Bearer DEIN_SYNC_SCHLÜSSEL` (der Schlüssel aus den Zentrum-Einstellungen), `Accept` = `application/vnd.github+json`
   - Textkörper: **JSON**. Zwei Felder: `message` (Text) = `health`, `content` (Text) = Variable **Base64-codiert**

Einmal auf „▶“ tippen, Health-Zugriff erlauben. Dann Zentrum öffnen, Tab Körper: unten steht „Letzter Import“.

## Automatisch laufen lassen

„Automation“ → „+“:

- **Tageszeit** 12:00, 18:00 und 22:00 → „Zentrum Sync“ → „Sofort ausführen“.
- **App** → **Renpho** → „wird geschlossen“ → „Zentrum Sync“ → „Sofort ausführen“. So kommt das Gewicht direkt nach dem Wiegen an.

Hinweis: Apple Health lässt sich nur lesen, solange das iPhone entsperrt ist. Läuft eine Automation bei gesperrtem Handy ins Leere, holt der nächste Lauf die Schritte von gestern nach.
