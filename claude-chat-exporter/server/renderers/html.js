import { Marked } from "marked";
import { ROLE_LABELS } from "../util.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Eigene Marked-Instanz: rohes HTML aus Chat-Inhalten wird escaped statt ausgeführt.
const md = new Marked();
md.use({
  gfm: true,
  breaks: true,
  renderer: {
    html(token) {
      return escapeHtml(token.raw ?? token.text ?? "");
    },
    image(token) {
      return `<em class="img-placeholder">[Bild: ${escapeHtml(token.text || token.href || "Bild")}]</em>`;
    },
  },
});

const CSS = `
  :root {
    --text: #1f1e1d; --muted: #6e6a65; --bg: #faf9f7; --card: #ffffff;
    --border: #e8e4de; --user: #1a56db; --assistant: #c15f3c;
    --code-bg: #f4f3f0; --code-border: #e5e2dc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px; line-height: 1.6;
  }
  .wrap { max-width: 800px; margin: 0 auto; }
  header h1 { font-size: 26px; margin: 0 0 6px; }
  header .meta { color: var(--muted); font-size: 13px; margin-bottom: 28px; }
  .msg {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 18px 22px; margin-bottom: 16px;
  }
  .msg.user { border-left: 3px solid var(--user); }
  .msg.assistant { border-left: 3px solid var(--assistant); }
  .role {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    margin-bottom: 8px;
  }
  .msg.user .role { color: var(--user); }
  .msg.assistant .role { color: var(--assistant); }
  .content > :first-child { margin-top: 0; }
  .content > :last-child { margin-bottom: 0; }
  .content pre {
    background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 8px;
    padding: 12px 14px; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
    font-size: 13px; line-height: 1.5;
  }
  .content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em; background: var(--code-bg); border-radius: 4px; padding: 1px 5px;
  }
  .content pre code { background: none; padding: 0; }
  .content blockquote {
    margin: 0.8em 0; padding: 2px 16px; border-left: 3px solid var(--border);
    color: var(--muted);
  }
  .content table { border-collapse: collapse; margin: 0.8em 0; }
  .content th, .content td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
  .content th { background: var(--code-bg); }
  .content img { max-width: 100%; }
  .content a { color: var(--user); }
  footer { color: var(--muted); font-size: 12px; text-align: center; margin-top: 32px; }
  @media print {
    body { background: #fff; padding: 0; }
    .msg { break-inside: avoid; box-shadow: none; }
    .content pre { white-space: pre-wrap; }
  }
`;

/** Chat als eigenständige, gestylte HTML-Datei (auch druckfreundlich). */
export function renderHtml({ title, dateHuman, messages }) {
  const sections = messages.map((msg) => {
    const roleClass = msg.role === "user" ? "user" : "assistant";
    const label = ROLE_LABELS[msg.role] || msg.role;
    const body = md.parse(msg.content);
    return `<section class="msg ${roleClass}">
  <div class="role">${escapeHtml(label)}</div>
  <div class="content">${body}</div>
</section>`;
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Exportiert aus Claude Desktop · ${escapeHtml(dateHuman)} · ${messages.length} Nachrichten</div>
</header>
${sections.join("\n")}
<footer>Erstellt mit Chat Exporter für Claude Desktop</footer>
</div>
</body>
</html>
`;
}
