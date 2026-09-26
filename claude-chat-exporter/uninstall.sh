#!/bin/bash
# Entfernt alles, was install.sh angelegt hat (außer der Desktop-Erweiterung selbst –
# die wird in Claude Desktop unter Einstellungen → Erweiterungen deinstalliert).
set -uo pipefail
INSTALL_DIR="$HOME/Library/Application Support/Claude Chat Exporter"
APP_PATH="$HOME/Applications/Chat Exporter.app"
CMD="$HOME/.claude/commands/export-session.md"

if grep -q '"claude-chat-exporter"' "$INSTALL_DIR/manifest.json" 2>/dev/null; then
  rm -rf "$INSTALL_DIR" && echo "✅ Laufzeit entfernt: $INSTALL_DIR"
fi
[ -d "$APP_PATH" ] && rm -rf "$APP_PATH" && echo "✅ App entfernt: $APP_PATH"
[ -f "$CMD" ] && rm -f "$CMD" && echo "✅ Slash-Command entfernt: $CMD"
if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user chat-exporter >/dev/null 2>&1 && echo "✅ MCP-Server aus Claude Code entfernt"
fi
LOG="$HOME/Library/Logs/claude-chat-exporter-hook.log"
[ -f "$LOG" ] && rm -f "$LOG" && echo "✅ Hook-Log entfernt: $LOG"
echo "Bleibt erhalten: exportierte Dateien (z. B. ~/Downloads/Claude-Sessions), cleanupPeriodDays in ~/.claude/settings.json"
echo "und ein eventuell manuell eingetragener SessionEnd-Hook in ~/.claude/settings.json."
echo "Desktop-Erweiterung: Claude Desktop → Einstellungen → Erweiterungen → Chat Exporter → Deinstallieren."
