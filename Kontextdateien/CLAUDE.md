# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Visio VSTO add-in** that imports PASS/ALPS process models from OWL files and draws them as Visio diagrams. PASS = "Parallel Activity Specification Schema" (subject-oriented process modelling); ALPS extends it with a multi-layer concept. The heavy lifting of parsing OWL/RDF and building the in-memory model graph is delegated to the external `alps.net.api` library; this repo only adds the Visio-rendering layer on top.

The German design notes in [ALPS_Visio_AddIn-rewrite/TODO.md](ALPS_Visio_AddIn-rewrite/TODO.md) are the authoritative architecture overview and to-do list — read them. `docs/` contains SVG class/flow diagrams (`ThisAddIn.svg`, `OWLImporter.svg`, `PASSProcessModel.svg`) and a `documentation.md`.

## Which project is which

The solution `ALPS_Visio_Tools.sln` now contains a **single project** — the rewrite. The legacy `VisioAddIn/` original, the `UnitTestProject/`, and the scratch `TestProject/` / `TrialProject/` were all removed during cleanup; they stay recoverable via git history (see `CODE-AENDERUNGEN.md`).

- **`ALPS_Visio_AddIn-rewrite/`** — the **active refactor target** and the only remaining project. Namespace `ALPS_Visio_AddIn_rewrite`.
- `ALPS_Visio_AddIn-rewrite/_old/` — legacy code copied verbatim from the original add-in, kept under namespace `VisioAddIn` / `VisioAddIn.Snapping` / `VisioAddIn.UI` (Snapping, WPF/WinForms UI windows, geometry util). It is **still compiled and wired into startup** (`ModelController`, `WindowDirectory`, `AnchorBarsUsage`) and is now the **only** place the `VisioAddIn.*` types live (e.g. `ALPSConstants`, `ALPSGlobalFunctions`) — the standalone original project is gone. Explicitly un-refactored; touch with care, the goal is to replace it.
- **No test projects currently exist** — the MSTest `UnitTestProject` tested the now-removed original. A rewrite-targeted test project is future work.

## Build / run / test

This is a **legacy non-SDK MSBuild project targeting .NET Framework 4.8 with VSTO + Office COM interop**. It only builds on **Windows with Visual Studio 2022** (workload "Office/SharePoint development") and Visio installed. It will **not** `dotnet build` on macOS/Linux — the COM references (`Microsoft.Office.Interop.Visio`) and VSTO targets require the Windows toolchain.

- Dependencies come from a NuGet **`packages/`** folder (packages.config style, `HintPath` into `..\packages\...`), not `<PackageReference>`. Restore with `nuget restore ALPS_Visio_Tools.sln` (or VS auto-restore) before first build; a missing `packages/` folder is the usual cause of build errors.
- Build: open the solution in Visual Studio, or `msbuild ALPS_Visio_Tools.sln /p:Configuration=Debug`.
- Run/debug: **F5 in Visual Studio** launches Visio with the add-in registered (`LoadBehavior=3`) and the debugger attached. There is no CLI run.
- The manifest is signed (`ALPS_Visio_AddIn-rewrite_TemporaryKey.pfx`, `ManifestCertificateThumbprint`). See `docs/publish_test_certificate/` and `docs/latex/` for certificate install/publish steps.
- There are no test projects currently (the MSTest `UnitTestProject` was removed with the original it tested). The rewrite csproj still imports `NUnit3TestAdapter` but contains no NUnit tests.

Key NuGet deps: `alps.net.api` (the PASS/OWL model API — central), `dotNetRDF` (RDF/OWL parsing), `Serilog` (logging), `HtmlAgilityPack`, `Neo4j.Driver`.

## Architecture (the import pipeline)

Everything centers on turning a parsed OWL model into Visio shapes. The flow:

1. **Startup** — `ThisAddIn.ThisAddIn_Startup` → `prepStuff()` instantiates the legacy `ModelController` and subscribes to Visio app events (DocumentCreated/Opened, PageAdded, WindowActivated). Ribbon buttons are built in `ALPSRibbon`.
2. **Trigger** — the ribbon **"Import OWL"** button (`ALPSRibbon.LoadOWLFile`) opens a file dialog and calls `OWLImporter.Instance.Parse(fileName)`.
3. **Parse** — `OWLImporter` (singleton) drives `alps.net.api`'s `PASSReaderWriter`. It loads the bundled ontologies from `Resources/standard_PASS_ont_v_1.1.0.owl` + `ALPS_ont_v_0.8.0.owl`, then `loadModels(file)` parses the user's OWL into an `IPASSProcessModel` graph.
4. **Class substitution** — the crucial trick: `VisioClassFactory` (a `BasicPASSProcessModelElementFactory`) makes the parser instantiate this project's `Visio*` classes wherever they implement `IVisioImportable`, instead of the API's plain classes. `ReflectiveEnumerator.addAssemblyToCheckForTypes` registers this assembly so the factory can find them. This is how parsed model elements gain the ability to draw themselves.
5. **Render to Visio** — `OWLImporter.Parse` disables VBA listeners, opens the SID stencil, then calls `ImportToVisio()` on the **first** model only (multi-model import is an unimplemented FEAT). VBA listeners are intentionally **not** re-enabled afterwards — the stencil's welcome/license MsgBox (Elstermann VBA) renames the freshly created SID page when the user clicks OK, which happens after `Parse` returns; keeping the flag at 0 suppresses this rename.

### Model object graph (the `Visio*` classes in `OWLShapes/`)

Mirrors the PASS structure; each node renders itself. `VisioPASSProcessModel` → one or more `VisioModelLayer` (more than one layer = the ALPS feature over PASS) → subjects (`VisioFullySpecifiedSubject` is the only near-complete one; also Interface/StandAloneMacro) + messages (`VisioMessageExchange`/`List`/`Specification`) → `VisioSubjectBehavior` → states (`OWLShapes/BehaviorDescribing/States/`) + transitions (`.../Transitions/`).

Two interfaces define the contract:
- `IVisioImportable.ImportToVisio(page)` — every drawable element.
- `IVisioImportableWithShape` adds `PrepareDimensions()` (returns **`false` when the model has no coordinates**) and `GetShape()`. When no element carries coordinates, an auto-layout fallback positions the shapes: `VisioSubjectBehavior.ApplyTreeLayout` cascades SBD states into a tree, `VisioModelLayer.ApplyHorizontalLayout` arranges SID subjects in a row.

Elements don't draw themselves directly — they delegate to **import helper classes** in `OWLShapes/ImportFunctionality/` implementing `IShapeImport` (`SubjectImport`, `StateImport`, `TransitionImport`, `PASSProcessModelElementImport`), which call into `VisioHelper` to create shapes and set ShapeSheet cells.

### Visio-interaction helpers

- **`VisioHelper`** — large grab-bag of Visio COM helpers (stencils, page/shape creation, `SetProperty*` variants for ShapeSheet cells, `setVBAListenersRunning`). Explicitly flagged as messy and a refactor priority; property-setting should be unified.
- **`ShapeFinder`** — locates stencil masters (`VisioHelper.openStencil`).
- **`Constants`** — Visio constants (page types, property names, stencils). Incomplete; the fuller-but-also-incomplete legacy versions are `_old/ALPSConstants.cs` + `_old/ALPSGlobalFunctions.cs`, and migrating them in is an open task.

## Gotchas (from the maintainers' notes)

- **Escape strings before setting them as Visio properties** — always use `VH.QuoteLiteral()` / the `SetProperty*` helpers; setting a raw string containing `"` produces an invalid ShapeSheet formula (silent failure or crash). Fixed in the rewrite for all active code paths; `_old/` still has raw wraps.
- **Duplicate page names crash Visio** — use `GetUniquePageName()` (added in `VisioHelper`) instead of setting `page.Name` directly. Fixed in the rewrite; `_old/` is unaffected (it doesn't create pages).
- **`page.NameU` must not be whitespace** — a whitespace `NameU` is invalid; Visio discards it and resets to the default name ("Zeichenblatt-N"). Always set `NameU` to the same value as `Name` (or a valid universal name) right after creating a page.
- **VBA listeners stay disabled after import** — `setVBAListenersRunning(false)` is called before opening the stencil and is **never re-enabled**. This is intentional: the stencil's welcome VBA routine renames the SID page when its MsgBox is dismissed; keeping the flag at 0 suppresses it. Do not add a `setVBAListenersRunning(true)` call at the end of `OWLImporter.Parse`.
- Stuck on this **old C#/.NET Framework version on purpose** — Visio interop forces it. Don't assume modern language features or SDK-style project conveniences.
- `alps.net.api` does **not always match the ontology**, so some ontology features can't be implemented yet (e.g. `hasSubjectExecutionMapping` only for `FullySpecifiedSubject`).

## Conventions

- Doc comments follow a **JavaDoc-style** `<summary>`/`<remarks>` convention. Prefer expressive code over inline comments; reserve inline comments for active-development notes (TODO/FEAT markers are used in-code).
- New-file namespace for the rewrite is `ALPS_Visio_AddIn_rewrite` (`RootNamespace`).
