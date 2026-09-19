# Morgengruß um 10 Uhr als Mitteilung

Eine Web-App kann auf dem iPhone keine geplanten Mitteilungen selbst senden. Der Umweg über „Kurzbefehle“ ist zuverlässig und dauert drei Minuten. Die Sätze holt sich der Kurzbefehl aus der App, du kannst sie also jederzeit hier ändern: `greetings.json`.

## Kurzbefehl „Zentrum Morgengruß“

App „Kurzbefehle“ → „+“ → Name „Zentrum Morgengruß“. Aktionen:

1. **Inhalt von URL abrufen** → URL: `https://marvinbaumann.github.io/zentrum/greetings.json`
2. **Wert für Wörterbuch abrufen** → Schlüssel `lines` aus „Inhalt von URL“.
3. **Objekt aus Liste abrufen** → „Zufälliges Objekt“ aus dem Ergebnis.
4. **Mitteilung anzeigen** → Titel: `Guten Morgen, Marvin ☀️`, Text: das Objekt aus Schritt 3. „Mit Ton“ nach Wunsch.

Einmal manuell ausführen, dann erscheint sofort eine Mitteilung zum Testen.

## Automation

„Automation“ → „+“ → **Tageszeit** 10:00, täglich → „Zentrum Morgengruß“ ausführen → **„Sofort ausführen“** aktivieren, „Bei Ausführung benachrichtigen“ ausschalten.
