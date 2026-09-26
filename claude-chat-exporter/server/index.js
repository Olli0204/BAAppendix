#!/usr/bin/env node
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { FORMATS, DEFAULT_FORMAT, resolveExportDir, resolveBulkDir, runExport } from "./export.js";
import { exportAllSessions } from "./bulk.js";
import { createSession, getSession, deleteSession } from "./store.js";
import { listSessions, resolveSession, parseSessionFile, projectsRoot } from "./sessions.js";

const VERSION = "1.2.0";

function ok(text) {
  return { content: [{ type: "text", text }] };
}

function fail(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Fehler beim Export: ${msg}` }], isError: true };
}

const messagesShape = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]).describe("Who sent the message"),
      content: z.string().describe("The complete message text, verbatim, with original markdown formatting"),
    })
  )
  .min(1)
  .describe("Conversation messages in chronological order");

const formatShape = z.enum(FORMATS).default(DEFAULT_FORMAT).describe("Output format (default: markdown); 'all' saves markdown + html + pdf");

const server = new McpServer({ name: "claude-chat-exporter", version: VERSION });

const NO_SIDE_EFFECT_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

server.registerTool(
  "export_chat",
  {
    title: "Chat exportieren",
    description:
      "Export the current chat conversation to a file on the user's computer (Markdown, HTML and/or PDF). " +
      "Use this when the user asks to export, save or download this conversation. " +
      "IMPORTANT: Pass the COMPLETE conversation verbatim — every user and assistant message from the very " +
      "beginning of the chat, in chronological order, with original wording and markdown formatting intact. " +
      "Do not summarize, shorten or omit messages. " +
      "For very long conversations (more than ~40 messages or ~60,000 characters total) do NOT use this tool; " +
      "use begin_export → append_messages → finalize_export instead. " +
      "If the user wants to export a Claude Code session (stored locally in ~/.claude/projects), prefer " +
      "export_session — it reads the complete transcript from disk and is always lossless.",
    inputSchema: {
      title: z.string().describe("Short descriptive title of the conversation (used for the filename and document header)"),
      format: formatShape,
      messages: messagesShape,
      date: z.string().optional().describe("ISO timestamp of when the conversation started, if known"),
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async (args) => {
    try {
      const paths = await runExport(args);
      return ok(
        `Export gespeichert (${args.messages.length} Nachrichten):\n` +
          paths.map((p) => `- ${p}`).join("\n") +
          `\n\nNenne dem User den/die Dateipfad(e).`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "begin_export",
  {
    title: "Langen Chat-Export starten",
    description:
      "Start a chunked export session for a LONG conversation (too long for a single export_chat call). " +
      "Returns an export_id. Afterwards call append_messages repeatedly (10–20 messages per call, in " +
      "chronological order, verbatim), then finalize_export to write the file.",
    inputSchema: {
      title: z.string().describe("Short descriptive title of the conversation"),
      format: formatShape,
      date: z.string().optional().describe("ISO timestamp of when the conversation started, if known"),
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async ({ title, format, date }) => {
    try {
      const id = createSession({ title, format, date });
      return ok(
        `Export-Session gestartet. export_id: ${id}\n` +
          `Jetzt append_messages mit 10–20 Nachrichten pro Aufruf aufrufen (chronologisch, wortgetreu), danach finalize_export.`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "append_messages",
  {
    title: "Nachrichten anhängen",
    description:
      "Append the next batch of messages (10–20 per call, chronological order, verbatim) to a chunked " +
      "export session started with begin_export.",
    inputSchema: {
      export_id: z.string().describe("The export_id returned by begin_export"),
      messages: messagesShape,
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async ({ export_id, messages }) => {
    try {
      const session = getSession(export_id);
      if (!session) return fail(new Error(`Unbekannte oder abgelaufene export_id: ${export_id}. Bitte mit begin_export neu starten.`));
      session.messages.push(...messages);
      return ok(`Angehängt. Bisher ${session.messages.length} Nachrichten in Session ${export_id}. Weitere append_messages oder finalize_export aufrufen.`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "finalize_export",
  {
    title: "Export abschließen",
    description: "Render and save a chunked export session to file(s). Returns the saved file path(s).",
    inputSchema: {
      export_id: z.string().describe("The export_id returned by begin_export"),
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async ({ export_id }) => {
    try {
      const session = getSession(export_id);
      if (!session) return fail(new Error(`Unbekannte oder abgelaufene export_id: ${export_id}. Bitte mit begin_export neu starten.`));
      if (!session.messages.length) return fail(new Error("Session enthält keine Nachrichten. Erst append_messages aufrufen."));
      const paths = await runExport({
        title: session.title,
        format: session.format,
        messages: session.messages,
        date: session.date,
      });
      deleteSession(export_id);
      return ok(
        `Export gespeichert (${session.messages.length} Nachrichten):\n` +
          paths.map((p) => `- ${p}`).join("\n") +
          `\n\nNenne dem User den/die Dateipfad(e).`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "list_sessions",
  {
    title: "Claude-Code-Sessions auflisten",
    description:
      "List locally stored Claude Code session transcripts (~/.claude/projects). Use this to find a session " +
      "before exporting it losslessly with export_session. Returns id, project, date, size, title and a " +
      "preview of the first user prompt, newest first.",
    inputSchema: {
      project: z.string().optional().describe("Filter: only sessions whose project folder name contains this text (case-insensitive)"),
      limit: z.number().int().min(1).max(50).optional().describe("Maximum number of sessions to list (default 20)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ project, limit }) => {
    try {
      const sessions = listSessions({ project, limit: limit ?? 20 });
      if (!sessions.length) {
        return ok(`Keine Session-Dateien gefunden (gesucht unter ${projectsRoot()}${project ? `, Filter: „${project}"` : ""}).`);
      }
      const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });
      const lines = sessions.map((s) => {
        const mb = s.size > 1024 * 1024 ? `${(s.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(s.size / 1024)} KB`;
        const title = s.title || s.firstUserText || "(ohne Titel)";
        return `- ${s.id.slice(0, 8)} · ${fmt.format(s.mtime)} · ${mb} · ${s.project}\n  „${title}"`;
      });
      return ok(
        `${sessions.length} Session(s), neueste zuerst:\n${lines.join("\n")}\n\n` +
          `Export mit export_session (session: ID-Präfix oder "latest").`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "export_session",
  {
    title: "Claude-Code-Session verlustfrei exportieren",
    description:
      "Losslessly export a locally stored Claude Code session transcript (~/.claude/projects) to Markdown, " +
      "HTML and/or PDF — works for arbitrarily long sessions because it reads the complete transcript from " +
      "disk instead of the chat context. Use list_sessions first if you need to find the right session. " +
      "This is the preferred tool whenever the conversation to export is a Claude Code session.",
    inputSchema: {
      session: z
        .string()
        .describe('Which session: "latest", a session id (or unique id prefix) from list_sessions, or a full path to a .jsonl transcript'),
      format: formatShape,
      include_tool_calls: z
        .boolean()
        .optional()
        .describe("Also include compact one-line notes for each tool call Claude made (default: false, text only)"),
      title: z.string().optional().describe("Override the document title (default: the session's stored title)"),
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async ({ session, format, include_tool_calls, title }) => {
    try {
      const filePath = resolveSession(session);
      const parsed = await parseSessionFile(filePath, { includeToolCalls: !!include_tool_calls });
      if (!parsed.messages.length) {
        return fail(new Error(`Transkript ${path.basename(filePath)} enthält keine exportierbaren Nachrichten.`));
      }
      const paths = await runExport({
        title: title || parsed.title,
        format,
        messages: parsed.messages,
        date: parsed.date,
      });
      return ok(
        `Session ${path.basename(filePath, ".jsonl").slice(0, 8)} verlustfrei exportiert ` +
          `(${parsed.messages.length} Nachrichten, Quelle: ${filePath}):\n` +
          paths.map((p) => `- ${p}`).join("\n") +
          `\n\nNenne dem User den/die Dateipfad(e).`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "export_all_sessions",
  {
    title: "Alle Claude-Code-Sessions exportieren",
    description:
      "Bulk-export ALL locally stored Claude Code sessions (optionally filtered by project) losslessly to files — " +
      "one file per session in a subfolder per project, plus an INDEX.md overview table. Writes to " +
      "<export dir>/Claude-Sessions. Re-running only exports sessions that changed since the last run. " +
      "Use this when the user wants documentation of past sessions, e.g. 'exportiere alle Sessions als Markdown'.",
    inputSchema: {
      project: z.string().optional().describe("Filter: only sessions whose project folder name contains this text (case-insensitive)"),
      format: formatShape,
      include_tool_calls: z.boolean().default(true).describe("Include compact one-line notes for tool calls (default: true)"),
      min_messages: z.number().int().min(1).max(100).default(2).describe("Skip sessions with fewer messages (default: 2)"),
      force: z.boolean().default(false).describe("Re-export sessions even if unchanged since the last run"),
    },
    annotations: NO_SIDE_EFFECT_ANNOTATIONS,
  },
  async ({ project, format, include_tool_calls, min_messages, force }) => {
    try {
      const res = await exportAllSessions({ project, format, includeToolCalls: include_tool_calls, minMessages: min_messages, force });
      const sample = res.exported.slice(0, 8).map((e) => `- ${e.date} · ${e.project} · ${e.title} (${e.messages} Nachrichten)`);
      if (res.exported.length > 8) sample.push(`- … und ${res.exported.length - 8} weitere`);
      return ok(
        `Massen-Export abgeschlossen (${res.total} Sessions geprüft${project ? `, Filter „${project}"` : ""}):\n` +
          `- ${res.exported.length} exportiert\n- ${res.unchanged.length} unverändert (bereits exportiert)\n` +
          `- ${res.skipped.length} übersprungen (< ${min_messages} Nachrichten)\n- ${res.failed.length} fehlgeschlagen\n` +
          (sample.length ? `\nNeu exportiert:\n${sample.join("\n")}\n` : "") +
          (res.failed.length ? `\nFehler:\n${res.failed.map((f) => `- ${f.project} ${f.id.slice(0, 8)}: ${f.error}`).join("\n")}\n` : "") +
          `\nOrdner: ${res.outDir}\nÜbersicht: ${res.indexPath}\n\nNenne dem User Ordner und INDEX.md.`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerPrompt(
  "export-this-chat",
  {
    title: "Diesen Chat exportieren",
    description: "Exportiert den aktuellen Chatverlauf als PDF, Markdown oder HTML in den Export-Ordner.",
    argsSchema: {
      format: z.enum(["markdown", "pdf", "html", "all"]).optional().describe("Zielformat (Standard: markdown)"),
    },
  },
  ({ format }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Bitte exportiere diesen gesamten Chatverlauf als ${format || "markdown"}. ` +
            `Übergib den vollständigen Verlauf wortgetreu und ungekürzt an das Export-Tool ` +
            `(bei sehr langen Chats nutze begin_export → append_messages → finalize_export). ` +
            `Nenne mir am Ende den Dateipfad der exportierten Datei.`,
        },
      },
    ],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[claude-chat-exporter v${VERSION}] bereit – Exportordner: ${resolveExportDir()} · Massen-Export: ${resolveBulkDir()}`);
}

main().catch((err) => {
  console.error("[claude-chat-exporter] Startfehler:", err);
  process.exit(1);
});
