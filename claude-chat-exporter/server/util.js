import fs from "node:fs";
import path from "node:path";

export const ROLE_LABELS = { user: "Du", assistant: "Claude" };

/** Titel → sicherer Dateiname-Slug (Umlaute transliteriert). */
export function slugify(title) {
  const map = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
  let s = String(title || "")
    .replace(/[äöüÄÖÜß]/g, (c) => map[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "chat";
}

/** Datum aufbereiten: ISO für Dateinamen, menschenlesbar (de-DE) für Kopfzeilen. */
export function formatDate(dateInput) {
  let d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const human = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
  return { iso, human };
}

/** Kollisionsfreien Pfad finden: name.ext, name-2.ext, name-3.ext, … */
export function uniquePath(dir, baseName, ext) {
  let candidate = path.join(dir, `${baseName}.${ext}`);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${i}.${ext}`);
    i++;
  }
  return candidate;
}

// Zeichen außerhalb von Latin-1, die WinAnsi (CP1252) zusätzlich kennt.
const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const CHAR_REPLACEMENTS = new Map(Object.entries({
  "→": "->", "←": "<-", "↔": "<->", "⇒": "=>", "⇐": "<=", "⇔": "<=>",
  "✓": "+", "✔": "+", "✗": "x", "✘": "x", "•": "•", "◦": "-", "▪": "-",
  "−": "-", "∙": "-", "≈": "~", "≠": "!=", "≤": "<=", "≥": ">=",
  "…": "…", " ": " ", " ": " ", " ": " ",
}));

/**
 * Text auf WinAnsi-Zeichenvorrat reduzieren (für pdfkit-Standardfonts).
 * Bekannte Symbole werden ersetzt, Emojis/unbekannte Zeichen entfernt.
 */
export function toWinAnsi(str) {
  let out = "";
  for (const ch of String(str)) {
    const mapped = CHAR_REPLACEMENTS.get(ch);
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) { out += ch; continue; }
    if (cp < 0x20) continue;
    if (cp <= 0xff || WINANSI_EXTRA.has(cp)) { out += ch; continue; }
    // Emoji-Modifikatoren, Zero-Width-Zeichen etc. stillschweigend entfernen
  }
  return out;
}

/** HTML-Entities dekodieren (defensiv, für Code-Inhalte im PDF). */
export function decodeEntities(str) {
  return String(str)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
