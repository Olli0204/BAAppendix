import { ROLE_LABELS } from "../util.js";

const ROLE_ICONS = { user: "👤", assistant: "🤖" };

/** Chat als Markdown-Dokument. Nachrichteninhalte bleiben wortgetreu erhalten. */
export function renderMarkdown({ title, dateHuman, messages }) {
  const parts = [];
  parts.push(`# ${title}\n`);
  parts.push(`> **Exportiert aus Claude Desktop** · ${dateHuman} · ${messages.length} Nachrichten\n`);
  for (const msg of messages) {
    const icon = ROLE_ICONS[msg.role] || "";
    const label = ROLE_LABELS[msg.role] || msg.role;
    parts.push(`---\n`);
    parts.push(`## ${icon} ${label}\n`);
    parts.push(`${msg.content.trim()}\n`);
  }
  return parts.join("\n");
}
