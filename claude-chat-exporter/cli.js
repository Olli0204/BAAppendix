#!/usr/bin/env node
/**
 * Kommandozeilen-Zugang zum Chat Exporter – für die Mac-App, Skripte und Slash-Commands.
 *
 *   node cli.js list [--limit N] [--project FILTER] [--tsv]
 *   node cli.js export <latest|Session-ID|Pfad> [--format markdown|pdf|html|all]
 *                      [--tools] [--title "…"] [--out ORDNER]
 *   node cli.js export-all [--format markdown|pdf|html|all] [--no-tools] [--project FILTER]
 *                          [--out ORDNER] [--min-messages N] [--force]
 *
 * Standardformat ist Markdown. export-all legt pro Projekt einen Unterordner an, schreibt eine
 * INDEX.md und exportiert bei erneutem Aufruf nur Sessions, die sich seit dem letzten Lauf geändert haben.
 */
import { listSessions, resolveSession, parseSessionFile, projectsRoot, projectLabel } from "./server/sessions.js";
import { runExport, resolveBulkDir, expandHome, DEFAULT_FORMAT } from "./server/export.js";
import { exportAllSessions } from "./server/bulk.js";

const BOOL_FLAGS = new Set(["tsv", "tools", "no-tools", "force"]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (BOOL_FLAGS.has(key)) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function fmtSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (cmd === "list") {
    const sessions = listSessions({ project: args.project, limit: Number(args.limit) || 30 });
    if (!sessions.length) {
      console.error(`Keine Sessions unter ${projectsRoot()} gefunden.`);
      process.exit(1);
    }
    for (const s of sessions) {
      const title = (s.title || s.firstUserText || "(ohne Titel)").replace(/[\t\n]/g, " ");
      const project = projectLabel(s.project).replace(/[\t\n]/g, " ");
      if (args.tsv) {
        console.log([s.id.slice(0, 8), dateFmt.format(s.mtime), fmtSize(s.size), project, title].join("\t"));
      } else {
        console.log(`${s.id.slice(0, 8)} · ${dateFmt.format(s.mtime)} · ${fmtSize(s.size)} · ${project}\n  „${title}"`);
      }
    }
    return;
  }

  if (cmd === "export") {
    const ref = args._[1] || "latest";
    const format = args.format || DEFAULT_FORMAT;
    if (args.out) process.env.EXPORT_DIR = args.out;

    const filePath = resolveSession(ref);
    const parsed = await parseSessionFile(filePath, { includeToolCalls: !!args.tools });
    if (!parsed.messages.length) throw new Error(`Transkript enthält keine exportierbaren Nachrichten: ${filePath}`);

    const paths = await runExport({
      title: args.title || parsed.title,
      format,
      messages: parsed.messages,
      date: parsed.date,
    });
    for (const p of paths) console.log(p);
    return;
  }

  if (cmd === "export-all") {
    const format = args.format || DEFAULT_FORMAT;
    const includeToolCalls = !args["no-tools"];
    const outDir = args.out ? expandHome(args.out) : resolveBulkDir();
    const minMessages = Number(args["min-messages"]) || 2;
    console.error(
      `Exportiere alle Sessions${args.project ? ` (Projekt-Filter „${args.project}")` : ""} als ${format}` +
        `${includeToolCalls ? " mit Tool-Protokoll" : ""} nach ${outDir} …`
    );
    const res = await exportAllSessions({
      project: args.project,
      format,
      includeToolCalls,
      outDir,
      minMessages,
      force: !!args.force,
      onProgress: (e) => console.error(`  ✓ ${e.date} · ${e.project} · ${e.title} (${e.messages} Nachrichten)`),
    });
    console.error(
      `\n${res.exported.length} exportiert · ${res.unchanged.length} unverändert · ` +
        `${res.skipped.length} übersprungen (< ${minMessages} Nachrichten) · ${res.failed.length} fehlgeschlagen`
    );
    for (const f of res.failed) console.error(`  ✗ ${f.project} ${f.id.slice(0, 8)}: ${f.error}`);
    console.log(res.indexPath);
    return;
  }

  console.error(
    "Nutzung:\n" +
      "  cli.js list [--limit N] [--project FILTER] [--tsv]\n" +
      "  cli.js export <latest|ID|Pfad> [--format markdown|pdf|html|all] [--tools] [--title \"…\"] [--out ORDNER]\n" +
      "  cli.js export-all [--format markdown|pdf|html|all] [--no-tools] [--project FILTER] [--out ORDNER] [--min-messages N] [--force]"
  );
  process.exit(2);
}

main().catch((err) => {
  console.error(`Fehler: ${err.message}`);
  process.exit(1);
});
