#!/bin/bash
# Installiert den Claude Chat Exporter auf diesem Mac.
#
# Standard (ohne Optionen):
#   1. Laufzeit-Kopie (Server, CLI, Abhängigkeiten) nach ~/Library/Application Support/Claude Chat Exporter
#      – außerhalb von iCloud Drive, damit Starts nicht an ausgelagerten Dateien hängen.
#   2. Mac-App „Chat Exporter.app“ nach ~/Applications (Session-Export per Doppelklick).
#   3. Erweiterung (.mcpb) in Claude Desktop öffnen → dort den Installationsdialog bestätigen.
#
# Optional (nur mit --claude-code, verändert die Claude-Code-Konfiguration):
#   4. MCP-Server in Claude Code registrieren (User-Scope) + Slash-Command /export-session.
#   5. Transkript-Aufbewahrung in ~/.claude/settings.json auf 2 Jahre setzen (falls nicht gesetzt).
#
# Optionen:  --rebuild       .mcpb vorher neu packen
#            --no-desktop    Schritt 3 überspringen (kein Dialog in Claude Desktop öffnen)
#            --claude-code   Schritte 4 + 5 ausführen
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCPB="$PROJECT_DIR/claude-chat-exporter.mcpb"
INSTALL_DIR="$HOME/Library/Application Support/Claude Chat Exporter"
APP_PATH="$HOME/Applications/Chat Exporter.app"
COMMANDS_DIR="$HOME/.claude/commands"
EXPORT_DIR="$HOME/Downloads"

REBUILD=0; DESKTOP=1; CODE=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --no-desktop) DESKTOP=0 ;;
    --claude-code) CODE=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }

find_node() {
  for c in /opt/homebrew/bin/node /usr/local/bin/node /opt/homebrew/opt/node/bin/node; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  command -v node 2>/dev/null || true
}
NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js nicht gefunden – bitte installieren (z. B. brew install node)." >&2
  exit 1
fi
ok "Node.js: $NODE_BIN ($("$NODE_BIN" --version))"

# 1) Paket bauen
if [ "$REBUILD" = 1 ] || [ ! -f "$MCPB" ]; then
  step "Erweiterung packen (.mcpb)"
  (cd "$PROJECT_DIR" && npx -y @anthropic-ai/mcpb pack . "$MCPB")
fi
[ -f "$MCPB" ] || { echo "Paket fehlt: $MCPB" >&2; exit 1; }

# 2) Laufzeit-Kopie entpacken
step "Laufzeit nach „${INSTALL_DIR}“ kopieren"
if [ -d "$INSTALL_DIR" ]; then
  if grep -q '"claude-chat-exporter"' "$INSTALL_DIR/manifest.json" 2>/dev/null; then
    rm -rf "$INSTALL_DIR"
  else
    echo "Ordner existiert, gehört aber nicht zum Chat Exporter – bitte manuell prüfen: $INSTALL_DIR" >&2
    exit 1
  fi
fi
mkdir -p "$INSTALL_DIR"
unzip -q -o "$MCPB" -d "$INSTALL_DIR"
cp "$PROJECT_DIR/app/session-end-export.sh" "$INSTALL_DIR/session-end-export.sh" && chmod +x "$INSTALL_DIR/session-end-export.sh"
ok "$(find "$INSTALL_DIR" -type f | wc -l | tr -d ' ') Dateien entpackt"
if "$NODE_BIN" "$INSTALL_DIR/cli.js" list --limit 1 --tsv >/dev/null 2>&1; then
  ok "CLI läuft"
else
  warn "CLI-Test fehlgeschlagen (keine Sessions vorhanden?)"
fi

# 3) Mac-App kompilieren
step "Mac-App nach „${APP_PATH}“ kompilieren"
mkdir -p "$HOME/Applications"
TMP_SCRIPT="$(mktemp -t ChatExporter).applescript"
sed "s|__CLI_PATH__|$INSTALL_DIR/cli.js|" "$PROJECT_DIR/app/ChatExporter.applescript" > "$TMP_SCRIPT"
rm -rf "$APP_PATH"
osacompile -o "$APP_PATH" "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"
# Eigenes Icon
if [ -f "$PROJECT_DIR/icon.png" ]; then
  ICON_TMP="$(mktemp -d)"; ICONSET="$ICON_TMP/app.iconset"; mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$PROJECT_DIR/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null 2>&1 || true
  done
  cp "$ICONSET/icon_32x32.png" "$ICONSET/icon_16x16@2x.png" 2>/dev/null || true
  cp "$ICONSET/icon_256x256.png" "$ICONSET/icon_128x128@2x.png" 2>/dev/null || true
  cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_256x256@2x.png" 2>/dev/null || true
  iconutil -c icns "$ICONSET" -o "$APP_PATH/Contents/Resources/applet.icns" 2>/dev/null || true
  rm -rf "$ICON_TMP"
fi
/usr/libexec/PlistBuddy -c "Set :CFBundleName Chat Exporter" "$APP_PATH/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string 'Chat Exporter'" "$APP_PATH/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string de.oliverkamps.chat-exporter" "$APP_PATH/Contents/Info.plist" 2>/dev/null || true
# Nach Plist-/Icon-Änderungen neu ad-hoc signieren, sonst meldet Gatekeeper eine ungültige Signatur
codesign --force --deep --sign - "$APP_PATH" 2>/dev/null || warn "Ad-hoc-Signierung fehlgeschlagen"
touch "$APP_PATH"
ok "App gebaut (Spotlight: „Chat Exporter“)"

# 4 + 5) Claude Code – nur auf ausdrücklichen Wunsch
if [ "$CODE" = 1 ]; then
  step "MCP-Server in Claude Code registrieren (User-Scope)"
  if command -v claude >/dev/null 2>&1; then
    claude mcp remove --scope user chat-exporter >/dev/null 2>&1 || true
    claude mcp add chat-exporter --scope user -e "EXPORT_DIR=${EXPORT_DIR}" -- "$NODE_BIN" "$INSTALL_DIR/server/index.js" >/dev/null
    ok "chat-exporter registriert → Tools export_session / export_all_sessions / list_sessions in jeder Claude-Code-Sitzung"
  else
    warn "claude-CLI nicht auf dem PATH – Registrierung übersprungen."
    warn "Claude Code CLI installieren (https://docs.claude.com/claude-code) und danach ausführen:"
    echo "        claude mcp add chat-exporter --scope user -e \"EXPORT_DIR=${EXPORT_DIR}\" -- \"$NODE_BIN\" \"$INSTALL_DIR/server/index.js\""
  fi

  step "Slash-Command /export-session anlegen"
  mkdir -p "$COMMANDS_DIR"
  cp "$PROJECT_DIR/app/export-session.md" "$COMMANDS_DIR/export-session.md"
  ok "$COMMANDS_DIR/export-session.md"

  step "Transkript-Aufbewahrung (cleanupPeriodDays) prüfen"
  SETTINGS="$HOME/.claude/settings.json"
  "$NODE_BIN" - "$SETTINGS" <<'JS'
const fs = require("fs");
const p = process.argv[2];
let s;
try { s = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) {
  if (fs.existsSync(p)) { console.log("  ⚠️  settings.json nicht lesbar – unverändert gelassen"); process.exit(0); }
  s = {};
}
if (s.cleanupPeriodDays === undefined) {
  s.cleanupPeriodDays = 730;
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
  console.log("  ✅ cleanupPeriodDays = 730 gesetzt (Sessions bleiben 2 Jahre erhalten)");
} else {
  console.log(`  ✅ cleanupPeriodDays bereits gesetzt: ${s.cleanupPeriodDays}`);
}
JS
fi

# 3) Claude Desktop
if [ "$DESKTOP" = 1 ]; then
  step "Erweiterung in Claude Desktop öffnen"
  if [ -d "/Applications/Claude.app" ]; then
    open -a "Claude" "$MCPB"
    ok "Installationsdialog geöffnet – in Claude Desktop auf „Installieren“ klicken"
  else
    warn "Claude Desktop nicht in /Applications gefunden – .mcpb per Doppelklick installieren: $MCPB"
  fi
fi

printf '\n\033[1mFertig.\033[0m\n'
echo "  • Claude Desktop: „+“-Menü → „Diesen Chat exportieren“  (oder schreiben: „Exportiere diesen Chat als Markdown“)"
echo "  • Mac-App:        Spotlight → „Chat Exporter“  (jede gespeicherte Claude-Code-Session, ohne Chat)"
echo "  • Terminal:       \"$NODE_BIN\" \"$INSTALL_DIR/cli.js\" list"
if [ "$CODE" = 1 ]; then
  echo "  • Claude Code:    /export-session   (laufende Session als Markdown), /export-session alle (alle Sessions + INDEX.md)"
else
  echo "  • Claude Code:    optional →  bash \"$PROJECT_DIR/install.sh\" --claude-code --no-desktop"
fi
