#!/bin/bash
# Claude-Code-Hook (SessionEnd): exportiert die beendete Session automatisch als PDF + Markdown
# mit Tool-Protokoll. Liest das Hook-JSON von stdin (session_id, transcript_path, reason).
# Umgebung: CHAT_EXPORTER_CLI (Pfad zu cli.js), CHAT_EXPORTER_DIR (Zielordner), CHAT_EXPORTER_FORMAT.
set -u
INPUT="$(cat)"
CLI="${CHAT_EXPORTER_CLI:-$HOME/Library/Application Support/Claude Chat Exporter/cli.js}"
OUT="${CHAT_EXPORTER_DIR:-$HOME/Documents/Claude-Sessions}"
FORMAT="${CHAT_EXPORTER_FORMAT:-all}"
LOG="$HOME/Library/Logs/claude-chat-exporter-hook.log"

find_node() {
  for c in /opt/homebrew/bin/node /usr/local/bin/node /opt/homebrew/opt/node/bin/node; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  command -v node 2>/dev/null || true
}
NODE_BIN="$(find_node)"
[ -n "$NODE_BIN" ] || { echo "$(date '+%F %T') node nicht gefunden" >> "$LOG"; exit 0; }

TRANSCRIPT="$(printf '%s' "$INPUT" | "$NODE_BIN" -e '
let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>{ try { const j=JSON.parse(d); process.stdout.write(j.transcript_path||""); } catch { } });')"
[ -n "$TRANSCRIPT" ] || { echo "$(date '+%F %T') kein transcript_path im Hook-Input" >> "$LOG"; exit 0; }
case "$TRANSCRIPT" in "~/"*) TRANSCRIPT="$HOME/${TRANSCRIPT#\~/}";; esac
[ -f "$TRANSCRIPT" ] || { echo "$(date '+%F %T') Transkript fehlt: $TRANSCRIPT" >> "$LOG"; exit 0; }

mkdir -p "$OUT"
if RESULT="$("$NODE_BIN" "$CLI" export "$TRANSCRIPT" --format "$FORMAT" --tools --out "$OUT" 2>&1)"; then
  echo "$(date '+%F %T') exportiert: $(printf '%s' "$RESULT" | tr '\n' ' ')" >> "$LOG"
else
  echo "$(date '+%F %T') Export fehlgeschlagen ($TRANSCRIPT): $RESULT" >> "$LOG"
fi
exit 0
