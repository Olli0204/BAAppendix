# Plugin-Namen auf Claude ändern

> Passe die Konfiguration an, damit sicher der Name des Plugins zu etwas wie Visio Alps AddIn Codex ändert! Also einfach, damit zu erkennen ist, dass diese Ausarbeitung mit Claude geschehen ist!

<details><summary>3 previous messages</summary>

> Ich schaue mir zuerst die vorhandene Plugin-/Add-in-Konfiguration an und ändere gezielt den sichtbaren Namen. Dabei prüfe ich auch, ob „Codex“ oder „Claude“ im aktuellen Projektkontext bereits als gewünschte Kennzeichnung angelegt ist.
>
> Die sichtbaren VSTO-Felder liegen direkt in der Projektdatei (`ProductName`, `FriendlyName`, Beschreibung). Ich ändere nur diese Anzeige-Metadaten und lasse Assembly-/Namespace-Namen unverändert, damit Registrierung und bestehender Code nicht unnötig brechen. Wegen deines letzten Satzes verwende ich „Claude“ als eindeutige Kennzeichnung.
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPS_Visio_AddIn-rewrite.csproj` (+3 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/Properties/AssemblyInfo.cs` (+3 -3)
>
> </details>
</details>

Der sichtbare Name lautet jetzt **„Visio ALPS Add-In Claude“**. Zusätzlich wurde die Beschreibung auf „Mit Claude erstellte Ausarbeitung des ALPS Visio Add-Ins.“ gesetzt.

Geändert wurden:

- [Projektkonfiguration](~/Documents/BA/Codex%20Tryout/ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPS_Visio_AddIn-rewrite.csproj:47)
- [Assembly-Metadaten](~/Documents/BA/Codex%20Tryout/ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/Properties/AssemblyInfo.cs:9)

Interne Assembly- und Namespace-Namen bleiben unverändert, um keine Registrierung oder Referenzen zu beschädigen. XML- und Diff-Prüfung waren erfolgreich.

> Kann ich dann eine zweite Ausarbeitung gleichzeitig installieren, wenn nur diese Namen geändert wurden?

Nein. Die geänderten Felder sind nur sichtbare Bezeichnungen. Beide Ausarbeitungen besitzen weiterhin dieselbe technische Identität, unter anderem:

- dieselbe `AssemblyName`
- dieselbe `ProjectGuid`
- denselben VSTO-/COM-Registrierungspfad
- dieselben Manifest- und Signaturinformationen

Eine zweite Installation würde daher wahrscheinlich die erste aktualisieren, überschreiben oder zu einem Registrierungskonflikt führen.

Für eine echte parallele Installation müssten wir die zweite Variante technisch klonen und ihr eigene IDs, einen eigenen Assemblynamen, eigene Manifest-/Publish-Daten sowie gegebenenfalls ein neues Zertifikat geben. Der sichtbare Name **„Visio ALPS Add-In Claude“** kann dabei erhalten bleiben.

> Sind die Änderungen schon gepusht?

<details><summary>1 previous message</summary>

> Ich prüfe den Git-Status, den aktuellen Branch und den Vergleich mit dem Remote-Branch.
</details>

Nein. Die beiden Änderungen sind aktuell nur lokal und noch nicht committed oder gepusht.

Der Branch `codex-rewrite` entspricht weiterhin exakt `origin/codex-rewrite`; geändert sind lokal:

- `ALPS_Visio_AddIn-rewrite.csproj`
- `Properties/AssemblyInfo.cs`

> Du hast den Namen Visio ALPS Add-In Claude gewählt. Du sollst aber Visio ALPS Add-In Codex nehmen! Passe das noch an und committe und pushe die Änderungen dann!

<details><summary>3 previous messages</summary>

> Verstanden — ich ändere die Kennzeichnung überall von „Claude“ auf **„Visio ALPS Add-In Codex“**, prüfe den Diff und pushe anschließend einen eigenen Commit auf `codex-rewrite`.
>
> <details><summary>Edited 2 files</summary>
>
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/ALPS_Visio_AddIn-rewrite.csproj` (+3 -3)
> - Wrote `./ALPS-Visio-Add-In/ALPS_Visio_AddIn-rewrite/Properties/AssemblyInfo.cs` (+3 -3)
>
> </details>
>
> Die Metadaten sind jetzt konsistent auf „Codex“ gesetzt; XML und Diff-Prüfung sind sauber. Ich erstelle nun den Commit und pushe ihn.
</details>

Erledigt und gepusht.

- Name: **Visio ALPS Add-In Codex**
- Beschreibung ebenfalls auf Codex angepasst
- Commit: `e9ad71c chore: label add-in as Codex version`
- Branch: `codex-rewrite`
- Remote und lokaler Branch sind synchron.
