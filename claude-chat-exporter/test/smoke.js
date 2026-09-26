#!/usr/bin/env node
/**
 * Smoke-Test: startet den MCP-Server als Kindprozess und spricht
 * JSON-RPC (newline-delimited) über stdio – wie Claude Desktop es tut.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(__dirname, "out");
const FIXTURES = path.join(__dirname, "fixtures");

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// Fixture: gefälschter ~/.claude/projects-Ordner mit zwei Session-Transkripten
// im echten Claude-Code-JSONL-Format (inkl. Tool-Results, Thinking, Titeln).
fs.rmSync(FIXTURES, { recursive: true, force: true });
const FIX_PROJECT = path.join(FIXTURES, "-Users-test-BA-Projekt");
fs.mkdirSync(FIX_PROJECT, { recursive: true });

const SESSION_A = "aaaa1111-2222-3333-4444-555566667777";
const SESSION_B = "bbbb8888-9999-0000-1111-222233334444";

const fixtureLines = [
  { type: "user", uuid: "u1", isSidechain: false, timestamp: "2026-08-01T10:00:00.000Z", message: { role: "user", content: "Erste Frage: Was ist ALPS? Bitte mit Umlauten: äöüß" } },
  { type: "assistant", uuid: "a1", timestamp: "2026-08-01T10:00:10.000Z", message: { id: "msg_1", content: [
    { type: "thinking", thinking: "geheime Überlegungen, dürfen NICHT im Export landen" },
    { type: "text", text: "ALPS ist **eine Methode** zur Prozessmodellierung." },
    { type: "tool_use", name: "Bash", id: "t1", input: { command: "ls -la", description: "Ordner listen" } },
  ] } },
  { type: "user", uuid: "u2", timestamp: "2026-08-01T10:00:12.000Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "GEHEIMES-TOOL-ERGEBNIS darf nicht erscheinen" }] } },
  { type: "assistant", uuid: "a2", timestamp: "2026-08-01T10:00:20.000Z", message: { id: "msg_1", content: [{ type: "text", text: "Und hier die Fortsetzung nach dem Tool-Aufruf." }] } },
  { type: "user", uuid: "u3", isMeta: true, timestamp: "2026-08-01T10:00:25.000Z", message: { role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "xxx" } }] } },
  { type: "user", uuid: "u4", timestamp: "2026-08-01T10:01:00.000Z", message: { role: "user", content: "Zweite Frage bitte, **fett** formatiert." } },
  { type: "assistant", uuid: "a3", timestamp: "2026-08-01T10:01:10.000Z", message: { id: "msg_2", content: [{ type: "text", text: "Antwort zwei mit `Code`." }] } },
  // --- Fälle aus dem Format von September 2026 ---
  { type: "assistant", uuid: "a3", timestamp: "2026-08-01T10:01:10.000Z", message: { id: "msg_2", content: [{ type: "text", text: "Antwort zwei mit `Code`." }] } }, // Duplikat (gleiche uuid) nach Session-Resume
  { type: "user", uuid: "u5", isCompactSummary: true, isVisibleInTranscriptOnly: true, timestamp: "2026-08-01T10:01:15.000Z", message: { role: "user", content: "KOMPAKT-ZUSAMMENFASSUNG darf nicht erscheinen" } },
  { type: "user", uuid: "u6", timestamp: "2026-08-01T10:01:16.000Z", message: { role: "user", content: "<task-notification>TASK-NOTIFICATION darf nicht erscheinen</task-notification>" } },
  { type: "user", uuid: "u7", timestamp: "2026-08-01T10:01:17.000Z", message: { role: "user", content: "<command-name>/model</command-name><command-message>model</command-message>" } },
  { type: "assistant", uuid: "a4", isApiErrorMessage: true, timestamp: "2026-08-01T10:01:18.000Z", message: { id: "msg_err", content: [{ type: "text", text: "API-FEHLER darf nicht erscheinen" }] } },
  { type: "user", uuid: "u8", timestamp: "2026-08-01T10:01:20.000Z", message: { role: "user", content: [{ type: "text", text: "<system-reminder>REMINDER-INHALT darf nicht erscheinen</system-reminder>\\nDritte Frage nach Reminder" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "xxx" } }] } },
  { type: "assistant", uuid: "a5", timestamp: "2026-08-01T10:01:30.000Z", message: { id: "msg_3", content: [{ type: "fallback", from: { model: "a" }, to: { model: "b" } }, { type: "text", text: "Antwort drei." }] } },
  { type: "ai-title", sessionId: SESSION_A, aiTitle: "ALPS Grundlagen Session" },
  { type: "agent-name", sessionId: SESSION_A, agentName: "Agent-Name darf nicht Titel sein" },
  { type: "system", subtype: "hook", timestamp: "2026-08-01T10:01:20.000Z" },
  { type: "queue-operation", operation: "enqueue", content: "QUEUE-INHALT darf nicht erscheinen" },
  { type: "last-prompt", lastPrompt: "LAST-PROMPT darf nicht erscheinen" },
];
fs.writeFileSync(path.join(FIX_PROJECT, `${SESSION_A}.jsonl`), fixtureLines.map((l) => JSON.stringify(l)).join("\n") + "\n");
fs.writeFileSync(
  path.join(FIX_PROJECT, `${SESSION_B}.jsonl`),
  [
    { type: "user", uuid: "b1", timestamp: "2026-07-01T09:00:00.000Z", message: { role: "user", content: "Alte Mini-Session" } },
    { type: "agent-name", sessionId: SESSION_B, agentName: "Agent-Name als Titel" },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n"
);
// B älter machen als A, damit „latest" deterministisch A ist
const old = new Date("2026-07-01T09:00:00Z");
fs.utimesSync(path.join(FIX_PROJECT, `${SESSION_B}.jsonl`), old, old);

const child = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
  env: { ...process.env, EXPORT_DIR: OUT_DIR, CLAUDE_PROJECTS_DIR: FIXTURES },
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (data) => {
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`RPC-Fehler: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    }
  }
});

function request(method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(payload + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout bei ${method}`));
      }
    }, 15000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` – ${detail}` : ""}`);
  }
}

const SAMPLE_MESSAGES = [
  {
    role: "user",
    content:
      "Hallo Claude! Kannst du mir **kurz** erklären, was ein MCP-Server ist? Bitte mit Beispiel für Größenordnungen: ä ö ü ß – und einem Emoji-Test 🚀✨",
  },
  {
    role: "assistant",
    content: `Gerne! Ein **MCP-Server** (Model Context Protocol) stellt Claude *Tools* bereit.

## Wichtige Punkte

1. Läuft lokal über \`stdio\`
2. Bietet Tools, Prompts und Ressourcen an
3. Wird z. B. als \`.mcpb\`-Datei installiert

### Beispiel-Code

\`\`\`javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "demo", version: "1.0.0" });
// Ein sehr langer Kommentar, der testet, wie der PDF-Renderer mit Zeilenumbrüchen in Code-Blöcken umgeht, wenn die Zeile deutlich breiter ist als die Seite.
server.registerTool("greet", { description: "Sagt Hallo" }, async () => {
  return { content: [{ type: "text", text: "Hallo Welt! Umlaute: äöüß" }] };
});
\`\`\`

> **Merke:** Der Server hat keinen Zugriff auf <div>-HTML oder den Chatverlauf – Claude übergibt Daten explizit.

| Feld | Bedeutung |
|------|-----------|
| name | Eindeutiger Name |
| version | Semver-Version |

Mehr dazu unter [modelcontextprotocol.io](https://modelcontextprotocol.io). Inline-Code: \`const x = a < b && c > d;\`

- Erster Punkt mit einer ziemlich langen Zeile, die im PDF umbrechen muss, damit man sieht, ob hängende Einzüge funktionieren
- Zweiter Punkt
  - Verschachtelt A
  - Verschachtelt B
- [x] Erledigter Task
- [ ] Offener Task`,
  },
  {
    role: "user",
    content: "Danke! Und wie installiere ich das dann in der Desktop App?",
  },
  {
    role: "assistant",
    content:
      "Ganz einfach:\n\n1. `.mcpb`-Datei doppelklicken\n2. Installation bestätigen\n3. Fertig – die Tools stehen in jedem Chat bereit\n\n---\n\nViel Erfolg! 🎉",
  },
];

function textOf(result) {
  return (result?.content || []).map((c) => c.text || "").join("\n");
}

async function main() {
  console.log("1) initialize");
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "1.0.0" },
  });
  check("Server meldet sich", init?.serverInfo?.name === "claude-chat-exporter", JSON.stringify(init?.serverInfo));
  notify("notifications/initialized", {});

  console.log("2) tools/list");
  const tools = await request("tools/list", {});
  const names = (tools?.tools || []).map((t) => t.name).sort();
  check(
    "7 Tools vorhanden",
    JSON.stringify(names) ===
      JSON.stringify(["append_messages", "begin_export", "export_all_sessions", "export_chat", "export_session", "finalize_export", "list_sessions"]),
    names.join(", ")
  );
  const fmtSchema = (tools?.tools || []).find((t) => t.name === "export_session")?.inputSchema?.properties?.format;
  check("format hat Standard markdown im Schema", fmtSchema?.default === "markdown", JSON.stringify(fmtSchema));

  console.log("3) prompts/list + prompts/get");
  const prompts = await request("prompts/list", {});
  check("Prompt export-this-chat vorhanden", (prompts?.prompts || []).some((p) => p.name === "export-this-chat"));
  const prompt = await request("prompts/get", { name: "export-this-chat", arguments: { format: "pdf" } });
  check("Prompt-Text enthält 'exportiere'", /exportiere/i.test(prompt?.messages?.[0]?.content?.text || ""));

  console.log("4) tools/call export_chat (format: all)");
  const res = await request("tools/call", {
    name: "export_chat",
    arguments: {
      title: "MCP-Server erklärt – Größen & Umlaute",
      format: "all",
      messages: SAMPLE_MESSAGES,
      date: "2026-08-02T20:15:00",
    },
  });
  const resText = textOf(res);
  check("Kein Fehler", !res?.isError, resText);
  const files = fs.readdirSync(OUT_DIR);
  const md = files.find((f) => f.endsWith(".md"));
  const html = files.find((f) => f.endsWith(".html"));
  const pdf = files.find((f) => f.endsWith(".pdf"));
  check("Markdown-Datei erzeugt", !!md, files.join(", "));
  check("HTML-Datei erzeugt", !!html);
  check("PDF-Datei erzeugt", !!pdf);
  if (pdf) {
    const size = fs.statSync(path.join(OUT_DIR, pdf)).size;
    check("PDF > 2 KB", size > 2048, `${size} Bytes`);
    const head = fs.readFileSync(path.join(OUT_DIR, pdf)).subarray(0, 5).toString();
    check("PDF-Header korrekt", head === "%PDF-", head);
  }
  if (md) {
    const content = fs.readFileSync(path.join(OUT_DIR, md), "utf8");
    check("Markdown enthält Original-Code", content.includes("registerTool"), "");
    check("Markdown enthält Umlaute", content.includes("äöüß"));
  }
  if (html) {
    const content = fs.readFileSync(path.join(OUT_DIR, html), "utf8");
    check("HTML escaped rohes HTML", !content.includes("<div>-HTML"), "rohes <div> gefunden");
    check("HTML enthält Titel", content.includes("MCP-Server erklärt"));
  }

  console.log("5) Kollision: gleicher Titel nochmal (markdown)");
  const res2 = await request("tools/call", {
    name: "export_chat",
    arguments: {
      title: "MCP-Server erklärt – Größen & Umlaute",
      format: "markdown",
      messages: SAMPLE_MESSAGES.slice(0, 2),
      date: "2026-08-02T20:15:00",
    },
  });
  check("Zweiter Export ohne Fehler", !res2?.isError);
  const mdFiles = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".md"));
  check("Kollisionsfreier Dateiname (-2)", mdFiles.length === 2 && mdFiles.some((f) => f.includes("-2")), mdFiles.join(", "));

  console.log("6) Chunk-Flow: begin → append ×2 → finalize (pdf)");
  const begin = await request("tools/call", {
    name: "begin_export",
    arguments: { title: "Langer Chat über Ökonomie", format: "pdf" },
  });
  const idMatch = textOf(begin).match(/export_id: (\S+)/);
  check("export_id erhalten", !!idMatch, textOf(begin));
  const exportId = idMatch?.[1];
  const app1 = await request("tools/call", {
    name: "append_messages",
    arguments: { export_id: exportId, messages: SAMPLE_MESSAGES.slice(0, 2) },
  });
  check("append #1 ok", !app1?.isError && textOf(app1).includes("2 Nachrichten"), textOf(app1));
  const app2 = await request("tools/call", {
    name: "append_messages",
    arguments: { export_id: exportId, messages: SAMPLE_MESSAGES.slice(2) },
  });
  check("append #2 ok", !app2?.isError && textOf(app2).includes("4 Nachrichten"), textOf(app2));
  const fin = await request("tools/call", {
    name: "finalize_export",
    arguments: { export_id: exportId },
  });
  check("finalize ok", !fin?.isError && textOf(fin).includes(".pdf"), textOf(fin));
  const fin2 = await request("tools/call", {
    name: "finalize_export",
    arguments: { export_id: exportId },
  });
  check("Session nach finalize gelöscht", fin2?.isError === true, textOf(fin2));

  console.log("7) Fehlerfall: unbekannte export_id");
  const bad = await request("tools/call", {
    name: "append_messages",
    arguments: { export_id: "gibtsnicht", messages: SAMPLE_MESSAGES.slice(0, 1) },
  });
  check("Fehlermeldung bei unbekannter ID", bad?.isError === true, textOf(bad));

  console.log("8) list_sessions (Fixture-Projektordner)");
  const list = await request("tools/call", { name: "list_sessions", arguments: {} });
  const listText = textOf(list);
  check("Beide Sessions gelistet", listText.includes("aaaa1111") && listText.includes("bbbb8888"), listText);
  check("Titel aus ai-title gelesen", listText.includes("ALPS Grundlagen Session"));
  check("agent-name als Titel-Fallback", listText.includes("Agent-Name als Titel"), listText);
  check("Neueste zuerst", listText.indexOf("aaaa1111") < listText.indexOf("bbbb8888"));

  console.log("9) export_session latest (markdown)");
  const sess = await request("tools/call", {
    name: "export_session",
    arguments: { session: "latest", format: "markdown" },
  });
  const sessText = textOf(sess);
  check("Session-Export ohne Fehler", !sess?.isError, sessText);
  check("6 Nachrichten erkannt (Duplikate/Meta gefiltert)", sessText.includes("(6 Nachrichten"), sessText);
  const sessMd = fs.readdirSync(OUT_DIR).find((f) => f.includes("alps-grundlagen"));
  check("Datei mit Titel-Slug erzeugt", !!sessMd, fs.readdirSync(OUT_DIR).join(", "));
  if (sessMd) {
    const content = fs.readFileSync(path.join(OUT_DIR, sessMd), "utf8");
    check("Assistant-Turn zusammengeführt", content.includes("eine Methode") && content.includes("Fortsetzung"));
    check("Tool-Results NICHT enthalten", !content.includes("GEHEIMES-TOOL-ERGEBNIS"));
    check("Thinking NICHT enthalten", !content.includes("geheime Überlegungen"));
    check("Kein Tool-Aufruf ohne Option", !content.includes("🔧"));
    check("Duplikat (gleiche uuid) nur einmal", content.split("Antwort zwei mit").length === 2, `${content.split("Antwort zwei mit").length - 1}×`);
    check("Compact-Summary NICHT enthalten", !content.includes("KOMPAKT-ZUSAMMENFASSUNG"));
    check("task-notification NICHT enthalten", !content.includes("TASK-NOTIFICATION"));
    check("Slash-Command-Marker NICHT enthalten", !content.includes("command-name"));
    check("API-Fehler-Nachricht NICHT enthalten", !content.includes("API-FEHLER"));
    check("system-reminder entfernt, Rest bleibt", !content.includes("REMINDER-INHALT") && content.includes("Dritte Frage nach Reminder"));
    check("Bild-Platzhalter vorhanden", content.includes("[Bild angehängt]"));
    check("fallback-Block ignoriert, Text bleibt", content.includes("Antwort drei."));
    check("queue/last-prompt NICHT enthalten", !content.includes("QUEUE-INHALT") && !content.includes("LAST-PROMPT"));
    check("custom/ai-title schlägt agent-name", content.startsWith("# ALPS Grundlagen Session"));
  }

  console.log("10) export_session per ID-Präfix mit include_tool_calls (pdf+markdown)");
  const sess2 = await request("tools/call", {
    name: "export_session",
    arguments: { session: "aaaa1111", format: "all", include_tool_calls: true, title: "ALPS mit Tools" },
  });
  check("Export per Präfix ok", !sess2?.isError, textOf(sess2));
  const toolsMd = fs.readdirSync(OUT_DIR).find((f) => f.includes("alps-mit-tools") && f.endsWith(".md"));
  check("Override-Titel verwendet", !!toolsMd, fs.readdirSync(OUT_DIR).join(", "));
  if (toolsMd) {
    const content = fs.readFileSync(path.join(OUT_DIR, toolsMd), "utf8");
    check("Tool-Aufruf kompakt enthalten", content.includes("🔧") && content.includes("Bash") && content.includes("Ordner listen"));
  }
  const toolsPdf = fs.readdirSync(OUT_DIR).find((f) => f.includes("alps-mit-tools") && f.endsWith(".pdf"));
  check("Session-PDF erzeugt", !!toolsPdf && fs.statSync(path.join(OUT_DIR, toolsPdf)).size > 1500);

  console.log("11) export_session Fehlerfälle");
  const sessBad = await request("tools/call", {
    name: "export_session",
    arguments: { session: "zzzz9999", format: "markdown" },
  });
  check("Unbekanntes Präfix → Fehler", sessBad?.isError === true, textOf(sessBad));
  const sessEscape = await request("tools/call", {
    name: "export_session",
    arguments: { session: "/etc/passwd.jsonl", format: "markdown" },
  });
  check("Pfad außerhalb projects-Root → Fehler", sessEscape?.isError === true, textOf(sessEscape));

  console.log("12) export_session ohne format → Markdown-Standard");
  const noFmt = await request("tools/call", { name: "export_session", arguments: { session: "aaaa1111", title: "Standardformat" } });
  check("Export ohne format ok", !noFmt?.isError, textOf(noFmt));
  check("Markdown-Datei erzeugt", fs.readdirSync(OUT_DIR).some((f) => f.includes("standardformat") && f.endsWith(".md")), fs.readdirSync(OUT_DIR).join(", "));

  console.log("13) export_all_sessions (Massen-Export mit INDEX.md)");
  const all1 = await request("tools/call", { name: "export_all_sessions", arguments: {} });
  const all1Text = textOf(all1);
  check("Massen-Export ohne Fehler", !all1?.isError, all1Text);
  check("1 exportiert, 1 übersprungen (< 2 Nachrichten)", all1Text.includes("- 1 exportiert") && all1Text.includes("- 1 übersprungen"), all1Text);
  const bulkDir = path.join(OUT_DIR, "Claude-Sessions");
  const projDir = path.join(bulkDir, "BA-Projekt");
  check("Unterordner pro Projekt (Präfix -Users-<name>- entfernt)", fs.existsSync(projDir), fs.existsSync(bulkDir) ? fs.readdirSync(bulkDir).join(", ") : "kein Claude-Sessions-Ordner");
  const bulkFiles = fs.existsSync(projDir) ? fs.readdirSync(projDir) : [];
  check("Datei mit Datum, Slug und Session-ID", bulkFiles.some((f) => f === "2026-08-01_alps-grundlagen-session_aaaa1111.md"), bulkFiles.join(", "));
  const indexMd = path.join(bulkDir, "INDEX.md");
  check("INDEX.md erzeugt", fs.existsSync(indexMd));
  if (fs.existsSync(indexMd)) {
    const idx = fs.readFileSync(indexMd, "utf8");
    check("INDEX.md listet Session mit Link", idx.includes("ALPS Grundlagen Session") && idx.includes("(BA-Projekt/2026-08-01_alps-grundlagen-session_aaaa1111.md)"), idx.slice(0, 400));
    check("INDEX.md ohne übersprungene Mini-Session", !idx.includes("Agent-Name als Titel"));
  }
  if (bulkFiles.length) {
    const content = fs.readFileSync(path.join(projDir, "2026-08-01_alps-grundlagen-session_aaaa1111.md"), "utf8");
    check("Massen-Export enthält Tool-Protokoll (Standard)", content.includes("🔧"));
  }
  const all2 = await request("tools/call", { name: "export_all_sessions", arguments: {} });
  check("Zweiter Lauf: 0 exportiert, 1 unverändert", textOf(all2).includes("- 0 exportiert") && textOf(all2).includes("- 1 unverändert"), textOf(all2));
  check("Kein Duplikat (-2) im Projektordner", fs.readdirSync(projDir).length === 1, fs.readdirSync(projDir).join(", "));
  const all3 = await request("tools/call", { name: "export_all_sessions", arguments: { format: "pdf", min_messages: 1 } });
  check("Dritter Lauf (pdf, min 1): 2 exportiert", textOf(all3).includes("- 2 exportiert"), textOf(all3));
  check("Alte .md durch .pdf ersetzt", fs.readdirSync(projDir).every((f) => f.endsWith(".pdf")) && fs.readdirSync(projDir).length === 2, fs.readdirSync(projDir).join(", "));

  console.log(`\nDateien in ${OUT_DIR}:`);
  for (const f of fs.readdirSync(OUT_DIR)) {
    const st = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f}${st.isDirectory() ? "/" : ` (${st.size} Bytes)`}`);
  }

  console.log(failures === 0 ? "\n🎉 Alle Checks bestanden" : `\n💥 ${failures} Check(s) fehlgeschlagen`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Testlauf abgebrochen:", err);
  child.kill();
  process.exit(1);
});
