import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { slugify, formatDate, uniquePath } from "./util.js";
import { renderMarkdown } from "./renderers/markdown.js";
import { renderHtml } from "./renderers/html.js";
import { renderPdf } from "./renderers/pdf.js";

export const FORMATS = ["markdown", "html", "pdf", "all"];
export const DEFAULT_FORMAT = "markdown";
const EXT = { markdown: "md", html: "html", pdf: "pdf" };

export function expandHome(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function resolveExportDir() {
  let dir = (process.env.EXPORT_DIR || "").trim();
  // Nicht aufgelöste Platzhalter wie "${DOWNLOADS}" oder "${user_config.export_directory}"
  // (kommen vor, wenn ein Host die Manifest-Defaults ungeprüft weiterreicht) → Standardordner.
  if (!dir || /\$\{[^}]*\}/.test(dir)) dir = path.join(os.homedir(), "Downloads");
  return expandHome(dir);
}

/** Zielordner für Massen-Exporte (export-all): <Exportordner>/Claude-Sessions */
export function resolveBulkDir() {
  return path.join(resolveExportDir(), "Claude-Sessions");
}

/**
 * Chat rendern und schreiben; gibt die Dateipfade zurück.
 *  dir       – Zielordner (Standard: Exportordner)
 *  fileBase  – fester Dateiname ohne Endung (Standard: <Datum>_<Titel-Slug>)
 *  overwrite – true: gleichnamige Datei überschreiben statt -2/-3 anzuhängen
 */
export async function runExport({ title, format = DEFAULT_FORMAT, messages, date, dir, fileBase, overwrite = false }) {
  const outDir = dir || resolveExportDir();
  fs.mkdirSync(outDir, { recursive: true });

  const { iso, human } = formatDate(date);
  const base = fileBase || `${iso}_${slugify(title)}`;
  const clean = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content ?? ""),
  }));
  const data = { title: String(title || "Claude Chat"), dateHuman: human, messages: clean };

  const targets = format === "all" ? ["markdown", "html", "pdf"] : [format];
  const paths = [];
  for (const f of targets) {
    const outPath = overwrite ? path.join(outDir, `${base}.${EXT[f]}`) : uniquePath(outDir, base, EXT[f]);
    if (f === "markdown") fs.writeFileSync(outPath, renderMarkdown(data), "utf8");
    else if (f === "html") fs.writeFileSync(outPath, renderHtml(data), "utf8");
    else if (f === "pdf") await renderPdf(data, outPath);
    paths.push(outPath);
  }
  return paths;
}
