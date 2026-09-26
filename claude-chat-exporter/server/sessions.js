import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

/**
 * Zugriff auf lokale Claude-Code-Session-Transkripte (~/.claude/projects/<slug>/<uuid>.jsonl).
 * Diese Dateien enthalten den VOLLSTÄNDIGEN Verlauf einer Session – damit sind
 * verlustfreie Exporte beliebig langer Sitzungen möglich.
 *
 * Format-Hinweise (Stand September 2026):
 *  - Zeilentypen: user, assistant, custom-title, ai-title, agent-name, system, attachment,
 *    queue-operation, last-prompt, mode, pr-link, … – nur user/assistant/Titel sind relevant.
 *  - Beim Fortsetzen einer Session kann Claude Code bereits geschriebene Einträge (gleiche uuid)
 *    erneut anhängen → Deduplizierung über die uuid.
 *  - User-Einträge mit isMeta/isCompactSummary/isSidechain sowie Tool-Results sind keine
 *    echten Nutzer-Nachrichten. Interne Marker (<command-name>, <task-notification>, …) werden
 *    ausgefiltert, <system-reminder>-Blöcke aus echten Nachrichten entfernt.
 */

export function projectsRoot() {
  const override = (process.env.CLAUDE_PROJECTS_DIR || "").trim();
  return override || path.join(os.homedir(), ".claude", "projects");
}

function listSessionFiles() {
  const root = projectsRoot();
  const out = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return out;
  }
  for (const dir of dirs) {
    const dirPath = path.join(root, dir.name);
    let files = [];
    try {
      files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const full = path.join(dirPath, f);
      try {
        const st = fs.statSync(full);
        out.push({ path: full, project: dir.name, id: f.replace(/\.jsonl$/, ""), mtime: st.mtime, size: st.size });
      } catch {
        /* Datei ggf. gerade gelöscht */
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

/** Alle Session-Dateien (ohne Limit), optional nach Projektname gefiltert – für Massen-Exporte. */
export function allSessionFiles({ project } = {}) {
  let files = listSessionFiles();
  if (project) {
    const needle = project.toLowerCase();
    files = files.filter((f) => f.project.toLowerCase().includes(needle));
  }
  return files;
}

/** Lesbarer Projektname: "-Users-olli-Documents-BA-Projekt" → "Documents-BA-Projekt". */
export function projectLabel(project) {
  return String(project).replace(/^-Users-[^-]+-/, "") || String(project);
}

function safeParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Anfang + Ende einer Datei lesen (für Titel/Preview, ohne Riesendateien komplett zu laden). */
function readHeadTail(filePath, bytes = 128 * 1024) {
  const size = fs.statSync(filePath).size;
  const fd = fs.openSync(filePath, "r");
  try {
    const headLen = Math.min(bytes, size);
    const head = Buffer.alloc(headLen);
    fs.readSync(fd, head, 0, headLen, 0);
    let tail = Buffer.alloc(0);
    if (size > bytes) {
      const tailLen = Math.min(bytes, size - bytes);
      tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    }
    return { head: head.toString("utf8"), tail: tail.toString("utf8"), size };
  } finally {
    fs.closeSync(fd);
  }
}

// Interne Marker, die Claude Code als "user"-Text ablegt, aber keine Nutzer-Nachrichten sind.
const SKIP_TAG_RE =
  /^\s*<(command-name|command-message|command-args|local-command-caveat|local-command-stdout|local-command-stderr|task-notification|[a-z0-9-]*-command|ide_opened_file|ide_selection)\b/i;
// Eingebettete Hinweise, die aus echten Nachrichten entfernt werden.
const STRIP_TAG_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/gi;

function cleanUserText(text) {
  if (typeof text !== "string") return null;
  if (SKIP_TAG_RE.test(text)) return null;
  const cleaned = text.replace(STRIP_TAG_RE, "").trim();
  return cleaned || null;
}

/** Echten User-Text aus einer user-Zeile ziehen (null bei Tool-Results/Meta/Kommandos). */
function userTextFrom(entry) {
  if (entry.isMeta || entry.isSidechain || entry.isCompactSummary || entry.isVisibleInTranscriptOnly) return null;
  const content = entry.message?.content;
  if (typeof content === "string") return cleanUserText(content);
  if (Array.isArray(content)) {
    if (content.some((b) => b?.type === "tool_result")) return null;
    const parts = [];
    for (const b of content) {
      if (b?.type === "text") {
        const t = cleanUserText(b.text);
        if (t) parts.push(t);
      } else if (b?.type === "image") parts.push("*[Bild angehängt]*");
      else if (b?.type === "document") parts.push("*[Dokument angehängt]*");
    }
    const joined = parts.join("\n\n").trim();
    return joined || null;
  }
  return null;
}

function describeToolUse(block) {
  const input = block.input || {};
  let detail =
    input.description ||
    input.file_path ||
    input.path ||
    input.command ||
    input.pattern ||
    input.url ||
    input.query ||
    input.prompt ||
    "";
  detail = String(detail).replace(/\s+/g, " ").trim();
  if (detail.length > 140) detail = detail.slice(0, 140) + "…";
  return detail ? `> 🔧 **${block.name}** — ${detail}` : `> 🔧 **${block.name}**`;
}

function titleFrom(entry, current) {
  if (entry.type === "custom-title" && entry.customTitle) return { ...current, custom: entry.customTitle };
  if (entry.type === "ai-title" && entry.aiTitle) return { ...current, ai: entry.aiTitle };
  if (entry.type === "agent-name" && entry.agentName) return { ...current, agent: entry.agentName };
  return current;
}

function pickTitle(t) {
  return t.custom || t.ai || t.agent || null;
}

/**
 * Session-Datei streamen und in {title, date, messages} umwandeln.
 * Aufeinanderfolgende Assistant-Textblöcke eines Turns werden zusammengeführt.
 */
export async function parseSessionFile(filePath, { includeToolCalls = false } = {}) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  const messages = [];
  let assistantParts = [];
  let titles = {};
  let firstTimestamp = null;
  let firstUserText = null;
  const seenUuids = new Set();
  let skippedDuplicates = 0;

  const flushAssistant = () => {
    const text = assistantParts.join("\n\n").trim();
    if (text) messages.push({ role: "assistant", content: text });
    assistantParts = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const entry = safeParse(line);
    if (!entry) continue;

    if (entry.type === "user" || entry.type === "assistant") {
      if (entry.uuid) {
        if (seenUuids.has(entry.uuid)) {
          skippedDuplicates++;
          continue;
        }
        seenUuids.add(entry.uuid);
      }
    }

    switch (entry.type) {
      case "custom-title":
      case "ai-title":
      case "agent-name":
        titles = titleFrom(entry, titles);
        break;
      case "user": {
        if (!firstTimestamp && entry.timestamp) firstTimestamp = entry.timestamp;
        const text = userTextFrom(entry);
        if (text) {
          flushAssistant();
          messages.push({ role: "user", content: text });
          if (!firstUserText) firstUserText = text;
        }
        break;
      }
      case "assistant": {
        if (entry.isSidechain || entry.isApiErrorMessage) break;
        const content = entry.message?.content;
        if (!Array.isArray(content)) break;
        for (const block of content) {
          if (block?.type === "text" && block.text?.trim()) assistantParts.push(block.text.trim());
          else if (block?.type === "tool_use" && includeToolCalls) assistantParts.push(describeToolUse(block));
        }
        break;
      }
      default:
        break;
    }
  }
  flushAssistant();

  let title = pickTitle(titles);
  if (!title && firstUserText) {
    title = firstUserText.replace(/\s+/g, " ").trim().slice(0, 70);
  }
  return {
    title: title || `Claude Code Session ${path.basename(filePath, ".jsonl").slice(0, 8)}`,
    date: firstTimestamp,
    messages,
    skippedDuplicates,
  };
}

/** Kurzinfos für die Session-Liste (Titel + erster Prompt, aus Kopf/Ende der Datei). */
function sessionPreview(filePath) {
  let titles = {};
  let firstUserText = null;
  let firstTimestamp = null;
  try {
    const { head, tail } = readHeadTail(filePath);
    const scan = (textBlock) => {
      for (const line of textBlock.split("\n")) {
        const entry = safeParse(line);
        if (!entry) continue;
        if (entry.type === "custom-title" || entry.type === "ai-title" || entry.type === "agent-name") {
          titles = titleFrom(entry, titles);
        } else if (entry.type === "user") {
          if (!firstTimestamp && entry.timestamp) firstTimestamp = entry.timestamp;
          if (!firstUserText) {
            const t = userTextFrom(entry);
            if (t) firstUserText = t.replace(/\s+/g, " ").slice(0, 100);
          }
        }
      }
    };
    scan(head);
    if (tail) scan(tail);
  } catch {
    /* Preview ist optional */
  }
  return { title: pickTitle(titles), firstUserText, firstTimestamp };
}

export function listSessions({ project, limit = 20 } = {}) {
  let files = listSessionFiles();
  if (project) {
    const needle = project.toLowerCase();
    files = files.filter((f) => f.project.toLowerCase().includes(needle));
  }
  return files.slice(0, Math.max(1, Math.min(limit, 50))).map((f) => ({
    ...f,
    ...sessionPreview(f.path),
  }));
}

/** Session anhand von "latest", ID(-Präfix) oder Pfad finden. */
export function resolveSession(ref) {
  const root = fs.existsSync(projectsRoot()) ? fs.realpathSync(projectsRoot()) : projectsRoot();

  if (!ref || ref === "latest") {
    const files = listSessionFiles();
    if (!files.length) throw new Error(`Keine Session-Dateien unter ${projectsRoot()} gefunden.`);
    return files[0].path;
  }

  if (ref.includes("/") || ref.endsWith(".jsonl")) {
    const p = ref.startsWith("~/") ? path.join(os.homedir(), ref.slice(2)) : ref;
    if (!fs.existsSync(p)) throw new Error(`Datei nicht gefunden: ${p}`);
    const real = fs.realpathSync(p);
    if (!real.startsWith(root + path.sep)) {
      throw new Error(`Aus Sicherheitsgründen werden nur Dateien unter ${projectsRoot()} gelesen.`);
    }
    return real;
  }

  const matches = listSessionFiles().filter((f) => f.id.startsWith(ref));
  if (!matches.length) {
    throw new Error(`Keine Session mit ID-Präfix „${ref}" gefunden. Mit list_sessions nachsehen.`);
  }
  const uniqueIds = new Set(matches.map((m) => m.id));
  if (uniqueIds.size > 1) {
    throw new Error(
      `ID-Präfix „${ref}" ist mehrdeutig: ${[...uniqueIds].slice(0, 5).map((s) => s.slice(0, 12)).join(", ")} …`
    );
  }
  return matches[0].path;
}
