# Anhang zur Bachelorarbeit „KI-gestützte Softwareentwicklung – Eine empirische Evaluation aktueller Werkzeuge“

Dieses Repository enthält das Untersuchungsmaterial zur Bachelorarbeit von **Oliver Kamps** (Wirtschaftsinformatik, Universität Münster, betreut von Dr.-Ing. Matthes Elstermann, Abgabe am 28.09.2026).

Die Arbeit vergleicht zwei Coding-Agenten, **Claude Code** und **ChatGPT Codex**. Beide haben nacheinander und unabhängig voneinander dasselbe bestehende C#-Visio-Add-In für die subjektorientierte Prozessmodellierung mit ALPS refaktoriert, erweitert und mit drei weiteren Projekten zusammengeführt. Das Material ist zu umfangreich für den gedruckten Anhang: Allein die Sitzungsmitschnitte umfassen rund 22.000 Zeilen bzw. 180.000 Wörter. Deshalb liegt es hier.

> **Maßgeblicher Stand:** Für die Arbeit gilt der Stand mit dem Tag `abgabe-2026-09-28`. Spätere Änderungen gehören nicht zur Arbeit.

## Inhalt

```
.
├── Konversationen mit den Agenten/
│   ├── Claude/                        # 3 Sitzungen des Claude-Laufs
│   └── Codex/                         # 7 Sitzungen des Codex-Laufs
├── Kontextdateien/                    # CLAUDE.md und AGENTS.md (Stand am Ende der Umsetzung)
├── Codex Zusätzliche Kontextdateien/  # REFACTORING.md, FUNCTIONAL_SCOPE.md, MANUAL_TESTING.md
├── Screenshots/
│   ├── Claude/                        # Bildschirmaufnahmen aus der Prüfung in Visio
│   └── Codex/                         # jeweils nach Umsetzungsblock bzw. Problem sortiert
└── claude-chat-exporter/              # Werkzeug, mit dem die Claude-Sitzungen exportiert wurden
```

### Konversationen mit den Agenten

Die Sitzungen sind als Markdown-Ausdruck abgelegt und innerhalb eines Laufs zeitlich nummeriert. Sie enthalten die Aufträge im Wortlaut, die Antworten der Agenten und die Zwischenschritte (Werkzeugaufrufe), die die Anwendungen aufklappbar mitführen. Nicht enthalten ist, was ein Agent intern erwogen und wieder verworfen hat.

| Datei | Thema der Sitzung |
|---|---|
| `Claude/Claude-1.md` | Einstieg, Analyse und Refaktorierung des Add-Ins, erste Erweiterungen |
| `Claude/Claude-2.md` | Weitere Verbesserungen, Integrationen und Fehlerbehebung |
| `Claude/Claude-3.md` | NL-Checker: zusätzliche LLM-Provider |
| `Codex/Codex-1.md` | Überarbeitung des Branches `rewrite-hiwi` |
| `Codex/Codex-2.md` | Projekt nach Altlasten durchsuchen und aufräumen |
| `Codex/Codex-3.md` | Überblick über den Projektstand, Weiterentwicklung |
| `Codex/Codex-4.md` | Ribbon-Funktion für den PASS-nach-BPMN-Konverter |
| `Codex/Codex-5.md` | Integration der ALPS-Verifikation |
| `Codex/Codex-6.md` | README und Testprojekt |
| `Codex/Codex-7.md` | Umbenennung des Add-Ins |

Die Claude-Sitzungen wurden mit dem hier beiliegenden `claude-chat-exporter` exportiert, die Codex-Sitzungen mit der Exportfunktion der ChatGPT-Anwendung.

### Kontextdateien

- `Kontextdateien/CLAUDE.md`: Kontextdatei des Claude-Laufs
- `Kontextdateien/AGENTS.md`: Kontextdatei des Codex-Laufs

Beide Dateien haben die Agenten von sich aus angelegt und im Verlauf fortgeschrieben. Sie sind Aussagen der Agenten über das Projekt und kein geprüfter Beleg über den Code.

### Zusätzliche Dokumente des Codex-Laufs

- `REFACTORING.md`: Dokumentation der Refaktorierung
- `FUNCTIONAL_SCOPE.md`: Beschreibung des Funktionsumfangs
- `MANUAL_TESTING.md`: Checkliste für die manuelle Abnahme. Sie wurde nicht abgearbeitet und belegt daher keine durchgeführte Prüfung.

### Screenshots

Bildschirmaufnahmen aus der manuellen Prüfung des Add-Ins in Visio, getrennt nach Lauf und nach dem Umsetzungsblock bzw. Problem, bei dem sie entstanden sind. Die Aufnahmen dienten den Agenten während der Arbeit als Rückmeldung, weil sie das laufende Add-In nicht selbst beobachten konnten. In die Arbeit selbst wurden nur die Aufnahmen übernommen, die einen Befund tragen.

### claude-chat-exporter

Ein für diese Arbeit entwickeltes Werkzeug, das Claude-Chats und Claude-Code-Sitzungen lokal als Markdown, HTML oder PDF exportiert. Installation und Nutzung beschreibt [`claude-chat-exporter/README.md`](claude-chat-exporter/README.md). Die Abhängigkeiten (`node_modules/`) sind nicht eingecheckt und lassen sich über `npm install` wiederherstellen.

## Nicht in diesem Repository

Der Programmcode beider Umsetzungen und seine Versionsgeschichte liegen im Repository des Add-Ins, jeweils in einem eigenen Branch:

- `claude-code-rewrite`: Umsetzung mit Claude Code
- `codex-rewrite`: Umsetzung mit ChatGPT Codex
- Beide zweigen vom Ausgangsstand `rewrite-hiwi-25` ab.

Dort liegen auch die übrigen Artefakte der Agenten: die beiden `README.md`-Dateien, die Testprojekte und die OWL-Testmodelle.

Ursprüngliches Add-In-Repository: <https://github.com/MatthesElstermann/ALPS-Visio-Add-In>

## Hinweise

- Das Material ist unverändert so abgelegt, wie es während der Umsetzung entstanden ist. In den Mitschnitten kommen daher lokale Dateipfade vor.
- Die Agenten arbeiteten mit den Modellständen, die im Untersuchungszeitraum aktuell waren. Die Befunde gelten für diese Stände (siehe Abschnitt 4.4 der Arbeit).
