import fs from "node:fs";
import PDFDocument from "pdfkit";
import { Marked } from "marked";
import { ROLE_LABELS, toWinAnsi, decodeEntities } from "../util.js";

const md = new Marked();
md.use({ gfm: true, breaks: true });

const COLORS = {
  text: "#1f1e1d",
  muted: "#6e6a65",
  faint: "#8a857e",
  rule: "#e0dbd3",
  link: "#1a56db",
  user: "#1a56db",
  assistant: "#c15f3c",
  codeText: "#24292e",
  codeBg: "#f4f3f0",
  codeBorder: "#e5e2dc",
};

const BASE_SIZE = 10.5;
const HEADING_SIZES = { 1: 15.5, 2: 13.5, 3: 12, 4: 11.5, 5: 11, 6: 10.5 };

function bottomOf(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > bottomOf(doc)) doc.addPage();
}

function pickFont(run) {
  if (run.code) return "Courier";
  if (run.bold && run.italic) return "Helvetica-BoldOblique";
  if (run.bold) return "Helvetica-Bold";
  if (run.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

/** Inline-Tokens (strong/em/code/link/…) zu flachen Text-Runs auflösen. */
function flattenInline(tokens, style = {}, out = []) {
  for (const t of tokens || []) {
    switch (t.type) {
      case "strong": flattenInline(t.tokens, { ...style, bold: true }, out); break;
      case "em": flattenInline(t.tokens, { ...style, italic: true }, out); break;
      case "del": flattenInline(t.tokens, { ...style, strike: true }, out); break;
      case "link": flattenInline(t.tokens, { ...style, link: t.href }, out); break;
      case "codespan": out.push({ ...style, code: true, text: decodeEntities(t.text) }); break;
      case "br": out.push({ ...style, text: "\n" }); break;
      case "image": out.push({ ...style, italic: true, text: `[Bild: ${t.text || t.href || ""}]` }); break;
      case "escape": out.push({ ...style, text: t.text }); break;
      case "html": out.push({ ...style, text: t.raw ?? "" }); break;
      case "text":
        if (t.tokens && t.tokens.length) flattenInline(t.tokens, style, out);
        else out.push({ ...style, text: t.text ?? "" });
        break;
      default: out.push({ ...style, text: t.raw ?? t.text ?? "" });
    }
  }
  return out;
}

/** Text-Runs mit Font-Wechseln als fortlaufenden Absatz ausgeben. */
function emitRuns(doc, runs, ctx, { size = BASE_SIZE, color = COLORS.text, spaceAfter = 7, forceBold = false } = {}) {
  const cleaned = runs
    .map((r) => ({ ...r, text: toWinAnsi(r.text) }))
    .filter((r) => r.text.length > 0);
  if (!cleaned.length) return;

  ensureSpace(doc, size * 2);
  cleaned.forEach((run, i) => {
    doc
      .font(pickFont(forceBold ? { ...run, bold: true } : run))
      .fontSize(run.code ? size - 1 : size)
      .fillColor(run.link ? COLORS.link : color);
    const opts = {
      width: ctx.width,
      lineGap: 2.5,
      continued: i < cleaned.length - 1,
      underline: !!run.link,
      strike: !!run.strike,
    };
    if (run.link) opts.link = run.link;
    if (i === 0) doc.text(run.text, ctx.x, doc.y, opts);
    else doc.text(run.text, opts);
  });
  doc.y += spaceAfter;
}

/** Code-Block mit grauem Hintergrund, seitenumbruchsicher in Häppchen. */
function renderCodeBlock(doc, rawText, ctx) {
  const PAD = 10;
  const text = toWinAnsi(decodeEntities(rawText)).replace(/\t/g, "  ");
  let lines = text.split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (!lines.length) lines = [""];

  doc.font("Courier").fontSize(9);
  const lineH = doc.currentLineHeight();
  let idx = 0;

  while (idx < lines.length) {
    let avail = bottomOf(doc) - doc.y - 2 * PAD;
    if (avail < lineH) {
      doc.addPage();
      continue;
    }
    let used = 0;
    let take = 0;
    while (idx + take < lines.length) {
      const h = doc.heightOfString(lines[idx + take] || " ", { width: ctx.width - 2 * PAD, lineGap: 1 });
      if (used + h > avail) {
        if (take === 0) { used += h; take = 1; } // überlange Einzelzeile: fließen lassen
        break;
      }
      used += h;
      take++;
    }
    const chunk = lines.slice(idx, idx + take).join("\n");
    const rectH = Math.min(used + 2 * PAD, bottomOf(doc) - doc.y);
    const startY = doc.y;
    doc.save();
    doc.roundedRect(ctx.x, startY, ctx.width, rectH, 4).fillAndStroke(COLORS.codeBg, COLORS.codeBorder);
    doc.restore();
    doc
      .fillColor(COLORS.codeText)
      .font("Courier")
      .fontSize(9)
      .text(chunk, ctx.x + PAD, startY + PAD, { width: ctx.width - 2 * PAD, lineGap: 1 });
    doc.y += PAD;
    idx += take;
    if (idx < lines.length) doc.addPage();
  }
  doc.y += 6;
}

function renderList(doc, token, ctx, depth = 0) {
  const start = token.start === "" || token.start === undefined ? 1 : Number(token.start) || 1;

  token.items.forEach((item, i) => {
    let prefix;
    if (item.task) prefix = item.checked ? "[x]" : "[ ]";
    else if (token.ordered) prefix = `${start + i}.`;
    else prefix = "•";

    ensureSpace(doc, BASE_SIZE * 2);
    const y0 = doc.y;
    doc.font("Helvetica").fontSize(BASE_SIZE).fillColor(ctx.color || COLORS.text);
    const indent = Math.max(18, doc.widthOfString(prefix) + 7);
    doc.text(prefix, ctx.x + 2, y0, { lineBreak: false });
    doc.y = y0;

    const childCtx = { ...ctx, x: ctx.x + indent, width: ctx.width - indent };
    const blocks = item.tokens || [];
    if (!blocks.length) {
      doc.y += doc.currentLineHeight();
    }
    for (const block of blocks) {
      if (block.type === "checkbox") {
        continue; // Häkchen ist bereits im Präfix enthalten
      } else if (block.type === "text") {
        emitRuns(doc, flattenInline(block.tokens || [block]), childCtx, { spaceAfter: 3, color: ctx.color });
      } else if (block.type === "list") {
        renderList(doc, block, childCtx, depth + 1);
      } else {
        renderBlocks(doc, [block], childCtx);
      }
    }
  });
  doc.y += 4;
}

/** Block-Tokens (Absätze, Überschriften, Listen, Code, Zitate, …) rendern. */
function renderBlocks(doc, tokens, ctx) {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const size = HEADING_SIZES[token.depth] || BASE_SIZE;
        doc.y += 4;
        emitRuns(doc, flattenInline(token.tokens), ctx, { size, spaceAfter: 5, forceBold: true, color: ctx.color });
        break;
      }
      case "paragraph":
        emitRuns(doc, flattenInline(token.tokens), ctx, { color: ctx.color });
        break;
      case "code":
        renderCodeBlock(doc, token.text ?? "", ctx);
        break;
      case "blockquote": {
        const pagesBefore = doc.bufferedPageRange().count;
        const y0 = doc.y;
        renderBlocks(doc, token.tokens || [], { ...ctx, x: ctx.x + 14, width: ctx.width - 14, color: COLORS.muted });
        const pagesAfter = doc.bufferedPageRange().count;
        if (pagesAfter === pagesBefore && doc.y - 6 > y0) {
          doc.save();
          doc.moveTo(ctx.x + 4, y0 + 1).lineTo(ctx.x + 4, doc.y - 6).lineWidth(2).strokeColor(COLORS.rule).stroke();
          doc.restore();
        }
        break;
      }
      case "list":
        renderList(doc, token, ctx);
        break;
      case "table":
        renderCodeBlock(doc, token.raw ?? "", ctx);
        break;
      case "hr":
        ensureSpace(doc, 16);
        doc.save();
        doc.moveTo(ctx.x, doc.y + 4).lineTo(ctx.x + ctx.width, doc.y + 4).lineWidth(0.5).strokeColor(COLORS.rule).stroke();
        doc.restore();
        doc.y += 14;
        break;
      case "space":
        doc.y += 3;
        break;
      case "html":
        emitRuns(doc, [{ text: token.raw ?? "" }], ctx, { color: ctx.color });
        break;
      case "def":
        break;
      default:
        if (token.raw) emitRuns(doc, [{ text: token.raw }], ctx, { color: ctx.color });
    }
  }
}

function renderMessage(doc, msg, ctx) {
  const label = (ROLE_LABELS[msg.role] || msg.role).toUpperCase();
  const color = msg.role === "user" ? COLORS.user : COLORS.assistant;

  ensureSpace(doc, 70);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(color);
  doc.text(label, ctx.x, doc.y, { characterSpacing: 1.5, width: ctx.width });
  doc.save();
  doc.moveTo(ctx.x, doc.y + 3).lineTo(ctx.x + ctx.width, doc.y + 3).lineWidth(0.5).strokeColor(COLORS.rule).stroke();
  doc.restore();
  doc.y += 12;

  const tokens = md.lexer(String(msg.content ?? ""));
  renderBlocks(doc, tokens, ctx);
  doc.y += 14;
}

/** Chat als PDF-Datei schreiben. Gibt ein Promise zurück (Datei fertig geschrieben). */
export function renderPdf({ title, dateHuman, messages }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 64, bottom: 64, left: 56, right: 56 },
      bufferPages: true,
      info: { Title: title, Author: "Chat Exporter für Claude Desktop" },
    });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    const ctx = {
      x: doc.page.margins.left,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    };

    // Kopf: Titel + Metazeile + Trennlinie
    doc.font("Helvetica-Bold").fontSize(19).fillColor(COLORS.text);
    doc.text(toWinAnsi(title), ctx.x, doc.y, { width: ctx.width });
    doc.y += 4;
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted);
    doc.text(toWinAnsi(`Exportiert aus Claude Desktop · ${dateHuman} · ${messages.length} Nachrichten`), ctx.x, doc.y, { width: ctx.width });
    doc.y += 8;
    doc.moveTo(ctx.x, doc.y).lineTo(ctx.x + ctx.width, doc.y).lineWidth(1).strokeColor(COLORS.rule).stroke();
    doc.y += 20;

    for (const msg of messages) {
      renderMessage(doc, msg, ctx);
    }

    // Seitenzahlen (nachträglich, dank bufferPages)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.faint);
      doc.text(`Seite ${i + 1} von ${range.count}`, doc.page.margins.left, doc.page.height - 42, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false,
      });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}
