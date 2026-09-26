import fs from "node:fs";
import path from "node:path";

import { allSessionFiles, parseSessionFile, projectLabel } from "./sessions.js";
import { runExport, resolveBulkDir, DEFAULT_FORMAT } from "./export.js";
import { slugify, formatDate } from "./util.js";

/**
 * Massen-Export aller lokalen Claude-Code-Sessions – für die nachträgliche Dokumentation.
 *  - eine Datei pro Session, Unterordner pro Projekt, Session-ID im Dateinamen
 *  - export-index.json merkt sich Stand/Dateien; erneute Läufe exportieren nur geänderte Sessions
 *  - INDEX.md: Übersichtstabelle aller exportierten Sessions (pro Projekt, neueste zuerst)
 */

const INDEX_JSON = "export-index.json";
const INDEX_MD = "INDEX.md";

function readIndex(dir) {
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(dir, INDEX_JSON), "utf8"));
    if (idx && typeof idx.sessions === "object") return idx;
  } catch {
    /* noch kein Index */
  }
  return { sessions: {} };
}

function relLink(outDir, file) {
  return encodeURI(path.relative(outDir, file).split(path.sep).join("/"));
}

function renderIndexMd(index, outDir) {
  const entries = Object.values(index.sessions);
  const byProject = new Map();
  for (const e of entries) {
    if (!byProject.has(e.project)) byProject.set(e.project, []);
    byProject.get(e.project).push(e);
  }
  const totalMsgs = entries.reduce((a, e) => a + (e.messages || 0), 0);
  const { human } = formatDate(new Date());
  const lines = [
    "# Claude-Code-Sessions – Übersicht",
    "",
    `> Stand: ${human} · ${entries.length} Sessions · ${totalMsgs} Nachrichten · Ordner: \`${outDir}\``,
    "",
  ];
  for (const project of [...byProject.keys()].sort((a, b) => a.localeCompare(b, "de"))) {
    const list = byProject.get(project).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    lines.push(`## ${project}`, "", "| Datum | Titel | Nachrichten | Export |", "|---|---|---:|---|");
    for (const e of list) {
      const links = e.files
        .filter((f) => fs.existsSync(f))
        .map((f) => `[${path.extname(f).slice(1)}](${relLink(outDir, f)})`)
        .join(" · ");
      lines.push(`| ${e.date} | ${String(e.title).replace(/\|/g, "\\|")} | ${e.messages} | ${links} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function exportAllSessions({
  project,
  format = DEFAULT_FORMAT,
  includeToolCalls = true,
  outDir,
  minMessages = 2,
  force = false,
  onProgress,
} = {}) {
  const root = outDir || resolveBulkDir();
  fs.mkdirSync(root, { recursive: true });
  const index = readIndex(root);
  const files = allSessionFiles({ project });
  const result = { outDir: root, total: files.length, exported: [], unchanged: [], skipped: [], failed: [] };

  for (const f of files) {
    const label = projectLabel(f.project);
    const id8 = f.id.slice(0, 8);
    const prev = index.sessions[f.id];
    const prevIntact = prev && Array.isArray(prev.files) && prev.files.length > 0 && prev.files.every((p) => fs.existsSync(p));
    if (
      !force &&
      prevIntact &&
      prev.mtimeMs >= f.mtime.getTime() &&
      prev.format === format &&
      prev.tools === includeToolCalls
    ) {
      result.unchanged.push({ id: f.id, project: label, title: prev.title });
      continue;
    }
    try {
      const parsed = await parseSessionFile(f.path, { includeToolCalls });
      if (parsed.messages.length < minMessages) {
        result.skipped.push({ id: f.id, project: label, messages: parsed.messages.length });
        continue;
      }
      const dir = path.join(root, label);
      const { iso } = formatDate(parsed.date || f.mtime);
      const fileBase = `${iso}_${slugify(parsed.title)}_${id8}`;
      const paths = await runExport({
        title: parsed.title,
        format,
        messages: parsed.messages,
        date: parsed.date,
        dir,
        fileBase,
        overwrite: true,
      });
      // Frühere Exporte dieser Session (nur die im Index verzeichneten) entfernen, wenn sich Name oder Format geändert haben
      if (prev && Array.isArray(prev.files)) {
        for (const p of prev.files) {
          if (!paths.includes(p) && fs.existsSync(p)) fs.rmSync(p);
        }
      }
      const entry = {
        id: f.id,
        project: label,
        title: parsed.title,
        date: iso,
        messages: parsed.messages.length,
        files: paths,
        format,
        tools: includeToolCalls,
        mtimeMs: f.mtime.getTime(),
        size: f.size,
      };
      index.sessions[f.id] = entry;
      result.exported.push(entry);
      onProgress?.(entry);
    } catch (err) {
      result.failed.push({ id: f.id, project: label, error: err instanceof Error ? err.message : String(err) });
    }
  }

  index.updated = new Date().toISOString();
  fs.writeFileSync(path.join(root, INDEX_JSON), JSON.stringify(index, null, 2) + "\n");
  result.indexPath = path.join(root, INDEX_MD);
  fs.writeFileSync(result.indexPath, renderIndexMd(index, root), "utf8");
  return result;
}
