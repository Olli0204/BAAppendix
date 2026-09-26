# AddIn um Ribbon-Funktion erweitern

> Erweitere das AddIn zusätzlich noch um diese Funktionalität. [pass-bpmn-converter/pass-bpmn-converter](https://github.com/pass-bpmn-converter/pass-bpmn-converter) Erzeuge dafür auch einen neuen Button im Ribbon!

<details><summary>6 previous messages</summary>

> Ich erweitere das bestehende Add-in um den PASS–BPMN-Konverter und ergänze dafür einen eigenen Ribbon-Button. Zuerst prüfe ich die aktuelle Add-in-Struktur und die Schnittstelle des verlinkten Projekts, damit sich die neue Funktion nahtlos in den vorhandenen Workflow einfügt.
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://github.com/pass-bpmn-converter/pass-bpmn-converter`
>
> </details>
>
> Das Referenzprojekt ist ein .NET-9-Kommandozeilentool, das Add-in läuft dagegen unter .NET Framework 4.8. Ich prüfe deshalb gerade die kleinste robuste Integrationsform: Der Ribbon-Workflow soll ohne zusätzliche Installation funktionieren und die bestehenden, noch nicht committed NLP-Änderungen unangetastet lassen.
>
> <details><summary>Created 4 files, edited 23 files, searched the web</summary>
>
> Searched the web for `site:nuget.org/packages/alps.net.api 0.9.1.7 ...`
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPSRibbon.cs` (+32 -1)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs` (+110 -0)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/ImplicitUsings.cs` (+10 -0)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/README.md` (+12 -0)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/Importing/OwlImportComposition.cs` (+1 -1)
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/layout/BpmnDiagramGenerator.cs` (+5 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/BoundaryEvent.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/ConditionalEventDefinition.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/Definitions.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/Escalation.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/LinkEventDefinition.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/MessageFlow.cs` (+3 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/SequenceFlow.cs` (+3 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/bpmndi/BpmnDiagram.cs` (+2 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/dc/Bounds.cs` (+5 -5)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/bpmn/model/dc/Point.cs` (+3 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/conversion/Converter.cs` (+19 -12)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/conversion/graph/Edge.cs` (+3 -3)
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/pass/PassUtility.cs` (+27 -0)
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPS_Visio_AddIn-rewrite.csproj` (+8 -2)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/packages.config` (+1 -1)
>
> - Wrote `./ALPS-Visio-Add-In/FUNCTIONAL_SCOPE.md` (+6 -0)
> - Wrote `./ALPS-Visio-Add-In/MANUAL_TESTING.md` (+15 -0)
> - Wrote `./ALPS-Visio-Add-In/THIRD_PARTY_NOTICES.md` (+15 -0)
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs` (+2 -1)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/Upstream/ImplicitUsings.cs` (+0 -3)
> - Wrote `./ALPS-Visio-Add-In/README.md` (+5 -0)
> - Wrote `./ALPS-Visio-Add-In/THIRD_PARTY_NOTICES.md` (+2 -0)
>
> </details>
>
> Die Kernintegration steht jetzt: Der neue Ribbon-Button öffnet eine PASS-/ALPS-OWL-Datei, lässt das Modell vollständig in-process konvertieren, erzeugt BPMN-Diagrammkoordinaten und speichert eine `.bpmn`-Datei. Ich prüfe nun noch Projektdatei, .NET-4.8-Kompatibilität und die bereits parallel vorhandenen Änderungen auf Konflikte.
>
> <details><summary>Created 4 files, edited 4 files</summary>
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs` (+1 -1)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs` (+1 -1)
> - Wrote `/tmp/bpmn-port-build/BpmnPortBuild.csproj` (+15 -0)
> - Wrote `/tmp/bpmn-port-runtime/BpmnPortRuntime.csproj` (+16 -0)
> - Wrote `/tmp/bpmn-port-runtime/Program.cs` (+25 -0)
> - Wrote `/tmp/bpmn-port-runtime/Program.cs` (+14 -14)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs` (+4 -4)
> - Wrote `/tmp/bpmn-port-build/BpmnPortBuild.csproj` (+3 -0)
> - Wrote `/tmp/bpmn-port-build/OwlImportCompositionStub.cs` (+12 -0)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPS_Visio_AddIn-rewrite.csproj` (+4 -1)
>
> </details>
</details>

Erledigt. Das Add-in enthält jetzt die [PASS–BPMN-Konvertierung](https://github.com/pass-bpmn-converter/pass-bpmn-converter):

- Neuer Ribbon-Bereich „Model Conversion“ mit Button „Convert PASS to BPMN“ in [ALPSRibbon.cs](~/Documents/BA/Codex%20Tryout/ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPSRibbon.cs:104).
- Auswahl einer PASS-/ALPS-OWL/RDF-Datei, Konvertierung und Speichern als `.bpmn` inklusive Diagrammkoordinaten in [BpmnConversionController.cs](~/Documents/BA/Codex%20Tryout/ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/BpmnConversion/BpmnConversionController.cs:19).
- Converter für .NET Framework 4.8 portiert und `alps.net.api` auf 0.9.1.7 aktualisiert.
- Manuelle Abnahmeschritte in [MANUAL_TESTING.md](~/Documents/BA/Codex%20Tryout/ALPS-Visio-Add-In/MANUAL_TESTING.md:140) ergänzt.
- GPL-3.0-Lizenz und Herkunft dokumentiert und in die Build-Ausgabe aufgenommen.

Validierung: Der Converter samt Controller kompiliert gegen .NET Framework 4.8 mit 0 Warnungen/Fehlern. Ein Laufzeittest erzeugte valides BPMN mit Participant, Process, Task, Start-/End-Events, Sequence Flows und BPMN-DI-Layout. Der abschließende VSTO-/Visio-Test muss unter Windows erfolgen.

Wichtig: Der integrierte Converter steht unter GPL-3.0; verteilte Add-in-Binaries müssen deren Bedingungen erfüllen.

> Perfekt. sind die Änderungen gepusht?

<details><summary>1 previous message</summary>

> Ich prüfe den aktuellen Branch, den letzten Commit und den Vergleich mit dem konfigurierten Remote – inklusive der noch nicht committed Änderungen.
</details>

Größtenteils ja: Die BPMN-Integration ist mit Commit `8556173` auf `origin/codex-rewrite` gepusht. Branch und Remote sind synchron.

Noch nicht committed/gepusht sind zwei kleine Nacharbeiten:

- Nullable-Korrekturen im Conversion-Controller
- Aufnahme der GPL-Lizenz in die Build-Ausgabe

Der Working Tree enthält deshalb noch zwei geänderte Dateien.
