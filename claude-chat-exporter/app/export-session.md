---
description: Claude-Code-Sessions verlustfrei als Markdown (oder PDF/HTML) exportieren – einzeln oder alle auf einmal (Chat Exporter)
argument-hint: [latest | Session-ID | liste | alle] [markdown | pdf | html | all] [--ohne-tools]
---
Exportiere Claude-Code-Sessions mit dem MCP-Server **chat-exporter** (Tools `list_sessions`, `export_session`, `export_all_sessions`).

Argumente des Aufrufs: `$ARGUMENTS`

Regeln:
- Kein Argument oder `latest` → `export_session` mit `session: "latest"` (die aktuell laufende Session ist die neueste Datei).
- `liste` → nur `list_sessions` aufrufen, Liste zeigen, nichts exportieren.
- `alle` → `export_all_sessions` (alle gespeicherten Sessions, Unterordner pro Projekt, INDEX.md als Übersicht; erneute Aufrufe exportieren nur geänderte Sessions). Optional Projekt-Filter, wenn der Nutzer ein Projekt nennt.
- Ein ID-Präfix (z. B. `9a63ac3d`) → `export_session` mit `session: "<Präfix>"`.
- Format: `markdown` ist Standard; `pdf`, `html` oder `all` nur, wenn angegeben.
- `include_tool_calls: true` ist Standard (Tool-Protokoll als Arbeitsnachweis). Nur bei `--ohne-tools` auf `false` setzen.
- Rufe das Tool genau einmal auf, fasse nichts zusammen und nenne am Ende die vollständigen Dateipfade bzw. den Ordner und die INDEX.md.
