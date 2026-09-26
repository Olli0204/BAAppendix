# Chat Exporter für Claude Desktop

Exportiert Claude-Chats und Claude-Code-Sessions als **Markdown** (Standard), **HTML** oder **PDF** – komplett lokal, ohne Cloud. Auch **alle bisherigen Sessions auf einmal**, mit Übersicht (`INDEX.md`), für die nachträgliche Dokumentation.

Drei Einsatzorte, ein Kern (`server/` + `cli.js`):

| Wo | Der „Button“ | Was exportiert wird |
|---|---|---|
| **Claude Desktop – normale Chats** | **+**-Menü im Eingabefeld → **„Diesen Chat exportieren“** (Format wählbar) – oder einfach schreiben: „Exportiere diesen Chat als PDF“ | Der Verlauf, den Claude im Kontext hat (Claude übergibt ihn an das Tool; lange Chats in Häppchen) |
| **Mac-App „Chat Exporter“** (Spotlight / `~/Applications`) | Doppelklick → Session(s) wählen (⌘-Klick für mehrere, oder „Alle Sessions“) → Format → fertig | Jede gespeicherte **Claude-Code-Session**, verlustfrei aus `~/.claude/projects` |
| **Claude Code** (Terminal oder Code-Tab der Desktop-App) | `/export-session`, `/export-session alle` bzw. „Exportiere alle Sessions als Markdown“ – oder automatisch bei jedem Session-Ende (SessionEnd-Hook) | Wie Mac-App: verlustfrei aus dem lokalen Transkript |

## Installation (einmalig)

```bash
bash install.sh
```

Das Skript
1. packt bei Bedarf die Erweiterung (`claude-chat-exporter.mcpb`),
2. legt eine Laufzeit-Kopie unter `~/Library/Application Support/Claude Chat Exporter/` ab (außerhalb von iCloud Drive – Dateien in `~/Documents` werden von macOS ausgelagert und beim ersten Zugriff minutenlang nachgeladen, was den Start blockiert),
3. kompiliert die Mac-App nach `~/Applications/Chat Exporter.app` (Node.js wird zur Laufzeit gesucht: Homebrew, `/usr/local/bin`, PATH),
4. öffnet die `.mcpb` in Claude Desktop → dort **„Installieren“** klicken und optional den Export-Ordner wählen (Standard: `~/Downloads`).

### Claude Code (Terminal und Code-Tab der Desktop-App)

```bash
bash install.sh --claude-code --no-desktop
```

Registriert den MCP-Server im User-Scope (`claude mcp add --scope user chat-exporter …`), legt den Slash-Command `~/.claude/commands/export-session.md` an und setzt `cleanupPeriodDays: 730` in `~/.claude/settings.json` (Transkripte werden 2 Jahre statt 30 Tage aufbewahrt). Danach eine **neue Session starten** (laufende Sessions laden neue MCP-Server erst nach `/mcp`).

**Automatisch bei jedem Session-Ende (optional, manuell eintragen):** Das Hook-Skript `session-end-export.sh` liegt nach der Installation in der Laufzeit-Kopie. In `~/.claude/settings.json` einen `SessionEnd`-Hook ergänzen, dann landet jede beendete Claude-Code-Session als PDF + Markdown + HTML mit Tool-Protokoll in `~/Documents/Claude-Sessions` (Zielordner über `CHAT_EXPORTER_DIR`, Format über `CHAT_EXPORTER_FORMAT`; Fehler in `~/Library/Logs/claude-chat-exporter-hook.log`):

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "CHAT_EXPORTER_DIR=\"$HOME/Documents/Claude-Sessions\" bash \"$HOME/Library/Application Support/Claude Chat Exporter/session-end-export.sh\"",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

Hinweis: Die Desktop-App reicht installierte Erweiterungen auch in Code-Sessions durch; wer den Exporter nur in Claude Code braucht, kann die Desktop-Erweiterung weglassen, sonst erscheinen die Tools doppelt.

Rückgängig: `bash uninstall.sh` (die Desktop-Erweiterung selbst über Claude Desktop → Einstellungen → Erweiterungen entfernen).

### Auf einem zweiten Mac (z. B. Laptop)

Sessions liegen immer lokal in `~/.claude/projects` des jeweiligen Macs, der Export muss also auf jedem Gerät installiert werden. Voraussetzungen: Node.js (`brew install node`) und, für die Registrierung in Claude Code, die `claude`-CLI auf dem PATH (fehlt sie, gibt der Installer den `claude mcp add`-Befehl zum Nachholen aus). Benötigt werden nur `claude-chat-exporter.mcpb`, `install.sh`, `app/` und `icon.png`; ist `~/Documents` per iCloud synchronisiert, liegt der Projektordner bereits unter demselben Pfad.

```bash
bash "$HOME/Documents/BA/claude-chat-exporter/install.sh" --claude-code --no-desktop
```

**Zuerst installieren, dann exportieren:** Claude Code räumt Transkripte standardmäßig nach 30 Tagen weg. Der Installer setzt `cleanupPeriodDays` auf 730, das schützt aber nur, was zu dem Zeitpunkt noch da ist. Danach in einer neuen Claude-Code-Session `/export-session alle` oder im Terminal `cli.js export-all --out ~/Documents/BA/Claude-Sessions` (bei iCloud-Sync landen die Exporte beider Macs im selben Ordner; der Index ist pro Ordner, Session-IDs kollidieren nicht).

## Nutzung

**Claude Desktop:** In einem beliebigen Chat schreiben

> „Exportiere diesen Chat als **PDF**“ · „Speichere diesen Chat als **Markdown**“ · „… als **HTML**“ · „… in **allen Formaten**“

oder im Eingabefeld **+** → **Chat Exporter** → **„Diesen Chat exportieren“**. Claude ruft das Export-Tool auf und nennt den Dateipfad.

**Mac-App:** Spotlight → „Chat Exporter“ → Session aus der Liste (neueste zuerst) → Format → mit/ohne Tool-Protokoll.

**Alle bisherigen Sessions auf einmal (Dokumentation im Nachhinein):**

```bash
node "$HOME/Library/Application Support/Claude Chat Exporter/cli.js" export-all --out ~/Documents/BA/Claude-Sessions
```

Ergebnis: ein Unterordner pro Projekt, eine Markdown-Datei pro Session (`2026-09-19_titel_a089779a.md`, Session-ID im Namen) mit Tool-Protokoll, dazu `INDEX.md` mit einer Tabelle aller Sessions (Datum, Titel, Nachrichten, Link). Ein erneuter Aufruf exportiert nur Sessions, die sich seit dem letzten Lauf geändert haben, und aktualisiert die Übersicht. Optionen: `--format pdf|html|all`, `--no-tools`, `--project FILTER`, `--min-messages N` (Standard 2), `--force`. Ohne `--out` landet alles in `~/Downloads/Claude-Sessions`. Dasselbe in Claude Code: `/export-session alle` oder „Exportiere alle Sessions als Markdown“; in der Mac-App der erste Listeneintrag „Alle Sessions exportieren“.

**Einzelne Sessions im Terminal:**

```bash
node "$HOME/Library/Application Support/Claude Chat Exporter/cli.js" list
node "$HOME/Library/Application Support/Claude Chat Exporter/cli.js" export latest --tools
node "$HOME/Library/Application Support/Claude Chat Exporter/cli.js" export 9a63ac3d --format all --out ~/Desktop
```

**Claude Code (nach `--claude-code`):** `/export-session` (Enter = laufende Session als Markdown mit Tool-Protokoll nach `~/Downloads`), `/export-session liste`, `/export-session alle`, `/export-session 9a63ac3d pdf --ohne-tools`. Mit dem SessionEnd-Hook zusätzlich automatisch bei jedem Session-Ende.

### Dateinamen

`2026-09-19_mein-chat-titel.md` – Datum + Titel-Slug; bei Kollision `-2`, `-3`, … Beim Massen-Export zusätzlich die Session-ID: `2026-09-19_mein-chat-titel_a089779a.md` (wird bei Änderungen überschrieben statt dupliziert).

## Was exportiert wird (und was nicht)

- ✅ Markdown wortgetreu · HTML gestylt & druckbar · PDF (A4, Seitenzahlen, Code-Blöcke, Listen, Zitate, Links)
- ✅ Claude-Code-Sessions **verlustfrei**, egal wie lang (die JSONL-Datei wird gestreamt, kein Kontext-Limit)
- ✅ Beim Fortsetzen einer Session doppelt angehängte Einträge werden erkannt (Deduplizierung über `uuid`)
- ✅ Interne Marker von Claude Code (Slash-Command-Echos, Task-Benachrichtigungen, Kompaktierungs-Zusammenfassungen, API-Fehlermeldungen, `<system-reminder>`) bleiben außen vor
- ✅ Optional: Tool-Aufrufe als kompakte Protokoll-Notizen (`🔧 Bash — …`), nützlich als Arbeitsnachweis
- ❌ Tool-Ergebnisse, Thinking, Subagenten-Verläufe (Sidechains), Bilder/Artefakte (Bilder erscheinen als Platzhalter)
- ⚠️ Desktop-Chats: exportiert wird, was Claude im Kontext hat. Bei sehr langen Chats kann der Anfang komprimiert sein – für Rohdaten aller Chats den offiziellen Datenexport nutzen (claude.ai → Einstellungen → Datenschutz).
- ⚠️ Emojis fehlen im PDF (Standard-PDF-Fonts); in Markdown/HTML bleiben sie erhalten.

## Entwicklung

```bash
npm install          # Dependencies
npm test             # Smoke-Test: Server über stdio + alle Tools + Fixture-Sessions im aktuellen JSONL-Format
npm run validate     # Manifest prüfen
npm run pack         # claude-chat-exporter.mcpb bauen
npm run setup        # = bash install.sh --rebuild
```

Struktur: `server/index.js` (MCP-Server: 7 Tools + 1 Prompt) · `server/sessions.js` (JSONL-Parser) · `server/bulk.js` (Massen-Export + INDEX.md) · `server/renderers/` (md/html/pdf) · `server/store.js` (Chunk-Exporte) · `cli.js` · `app/ChatExporter.applescript` (Mac-App) · `app/export-session.md` (Slash-Command) · `app/session-end-export.sh` (SessionEnd-Hook) · `manifest.json` (MCPB 0.3).

Tools: `export_chat`, `begin_export` → `append_messages` → `finalize_export` (lange Chats), `list_sessions`, `export_session`, `export_all_sessions`.

## Sicherung der Transkripte

Claude Code löscht Transkripte standardmäßig nach 30 Tagen. `install.sh --claude-code` setzt `cleanupPeriodDays` auf 730. Zusätzlich empfohlen: `cp -R ~/.claude/projects ~/Documents/BA/Claude-Session-Backup`.
