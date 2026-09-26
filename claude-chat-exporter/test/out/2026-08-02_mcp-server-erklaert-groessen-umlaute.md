# MCP-Server erklärt – Größen & Umlaute

> **Exportiert aus Claude Desktop** · 2. August 2026 um 20:15 · 4 Nachrichten

---

## 👤 Du

Hallo Claude! Kannst du mir **kurz** erklären, was ein MCP-Server ist? Bitte mit Beispiel für Größenordnungen: ä ö ü ß – und einem Emoji-Test 🚀✨

---

## 🤖 Claude

Gerne! Ein **MCP-Server** (Model Context Protocol) stellt Claude *Tools* bereit.

## Wichtige Punkte

1. Läuft lokal über `stdio`
2. Bietet Tools, Prompts und Ressourcen an
3. Wird z. B. als `.mcpb`-Datei installiert

### Beispiel-Code

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "demo", version: "1.0.0" });
// Ein sehr langer Kommentar, der testet, wie der PDF-Renderer mit Zeilenumbrüchen in Code-Blöcken umgeht, wenn die Zeile deutlich breiter ist als die Seite.
server.registerTool("greet", { description: "Sagt Hallo" }, async () => {
  return { content: [{ type: "text", text: "Hallo Welt! Umlaute: äöüß" }] };
});
```

> **Merke:** Der Server hat keinen Zugriff auf <div>-HTML oder den Chatverlauf – Claude übergibt Daten explizit.

| Feld | Bedeutung |
|------|-----------|
| name | Eindeutiger Name |
| version | Semver-Version |

Mehr dazu unter [modelcontextprotocol.io](https://modelcontextprotocol.io). Inline-Code: `const x = a < b && c > d;`

- Erster Punkt mit einer ziemlich langen Zeile, die im PDF umbrechen muss, damit man sieht, ob hängende Einzüge funktionieren
- Zweiter Punkt
  - Verschachtelt A
  - Verschachtelt B
- [x] Erledigter Task
- [ ] Offener Task

---

## 👤 Du

Danke! Und wie installiere ich das dann in der Desktop App?

---

## 🤖 Claude

Ganz einfach:

1. `.mcpb`-Datei doppelklicken
2. Installation bestätigen
3. Fertig – die Tools stehen in jedem Chat bereit

---

Viel Erfolg! 🎉
