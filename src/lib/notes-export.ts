import { Platform } from "react-native";
import type * as ExpoFileSystem from "expo-file-system/legacy";
import {
  escapeCodeAttribute,
  normalizeLanguageId,
  renderHighlightedCodeBlock,
} from "./code-highlight";
import { sanitizeHtml } from "./notes";

export interface ExportNote {
  title: string;
  html: string;
}

export interface ExportResult {
  ok: boolean;
  message: string;
  /** The user dismissed the folder picker - not an error. */
  cancelled?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    )
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "i",
  ).exec(attrs);
  if (!match) return null;
  return match[2] ?? match[3] ?? "";
}

const BLOCK_OPEN =
  /<div class="atomic-code-block"([^>]*)>/g;

/** Index just past the matching `</div>` of the block that starts at `from`. */
function findBlockEnd(html: string, from: number): number {
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ""));
}

/**
 * Replace every persisted atomic code block with the website's highlighted
 * view (line numbers + `cb-tok-*` colours). Stored blocks keep their raw
 * source in `data-code`, so the exported file always re-highlights cleanly.
 */
function renderCodeBlocks(html: string): string {
  let out = "";
  let cursor = 0;
  BLOCK_OPEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BLOCK_OPEN.exec(html))) {
    const start = match.index;
    if (start < cursor) continue;
    const innerStart = BLOCK_OPEN.lastIndex;
    const blockEnd = findBlockEnd(html, innerStart);
    if (blockEnd < 0) continue;

    const attrs = match[1] ?? "";
    const language = normalizeLanguageId(
      attrValue(attrs, "data-language") ?? "plaintext",
    );
    const rawCode = attrValue(attrs, "data-code");
    const code =
      rawCode != null ? decodeEntities(rawCode) : stripTags(html.slice(innerStart, blockEnd));

    out += html.slice(cursor, start);
    out +=
      `<div class="atomic-code-block"` +
      ` data-language="${escapeCodeAttribute(language)}"` +
      ` data-code="${escapeCodeAttribute(code)}"` +
      ` contenteditable="false">` +
      renderHighlightedCodeBlock(code, language) +
      `</div>`;

    cursor = blockEnd;
    BLOCK_OPEN.lastIndex = blockEnd;
  }

  out += html.slice(cursor);
  return out;
}

/** Website-parity dark document (theme.css from the web notes exporter). */
const EXPORT_STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { background: #0a0a12; }
  body {
    margin: 0;
    color: #d4d4d4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  main.notes-export {
    max-width: 880px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }
  .export-note + .export-note {
    margin-top: 56px;
    padding-top: 40px;
    border-top: 1px dashed rgba(255, 255, 255, 0.16);
  }
  .export-note h1,
  .export-note h2,
  .export-note h3,
  .export-note h4,
  .export-note h5,
  .export-note h6 {
    margin: 28px 0 12px;
    color: #f5f5f8;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .export-note h1 { margin-top: 0; font-size: 2rem; }
  .export-note h2 { font-size: 1.5rem; }
  .export-note h3 { font-size: 1.2rem; }
  .export-note p { margin: 12px 0; }
  .export-note ul,
  .export-note ol { margin: 12px 0; padding-left: 26px; }
  .export-note li { margin: 6px 0; }
  .export-note strong { color: #f0f0f5; font-weight: 600; }
  .export-note em { font-style: italic; }
  .export-note a { color: #cf9eff; text-decoration: none; }
  .export-note a:hover { text-decoration: underline; }
  .export-note blockquote {
    margin: 16px 0;
    padding: 2px 0 2px 16px;
    border-left: 3px solid rgba(207, 158, 255, 0.5);
    color: #a7a7b4;
    font-style: italic;
  }
  .export-note hr {
    margin: 28px 0;
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
  .export-note img { max-width: 100%; height: auto; }
  .export-note code {
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.07);
    color: #e8e8e8;
    font-family: "Fira Code", "Cascadia Code", Consolas, "SFMono-Regular", Menlo, monospace;
    font-size: 0.9em;
  }
  .export-note .atomic-code-block code {
    padding: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font-size: inherit;
  }
  @media print {
    body { background: #0a0a12; }
    main.notes-export { max-width: none; padding: 0; }
  }
  .atomic-code-block {
    position: relative;
    margin: 14px 0;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 10px;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: "Fira Code", "Cascadia Code", Consolas, "SFMono-Regular", Menlo, monospace;
    font-size: 13px;
    line-height: 21px;
    text-align: left;
    overflow: hidden;
  }
  .atomic-code-block .atomic-code-block-view {
    display: flex;
    align-items: stretch;
    max-width: 100%;
    border-radius: 9px;
    overflow: hidden;
    background: #1e1e1e;
  }
  .atomic-code-block .atomic-code-block-gutter {
    flex: 0 0 auto;
    padding: 14px 10px 14px 16px;
    background: #1e1e1e;
    border-right: 1px solid rgba(255, 255, 255, 0.045);
    color: #5f5f5f;
    font: inherit;
    line-height: 21px;
    text-align: right;
    white-space: pre;
    user-select: none;
    -webkit-user-select: none;
  }
  .atomic-code-block .atomic-code-block-pre {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    padding: 14px 18px;
    background: transparent;
    color: #d4d4d4;
    font: inherit;
    line-height: 21px;
    white-space: pre;
    overflow-x: auto;
    overflow-y: hidden;
    tab-size: 2;
    -moz-tab-size: 2;
    scrollbar-width: thin;
    scrollbar-color: #4a4a4a #1e1e1e;
  }
  .atomic-code-block .atomic-code-block-code {
    display: block;
    min-width: max-content;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
    white-space: pre;
  }
  .atomic-code-block .cb-tok-keyword { color: #569cd6; }
  .atomic-code-block .cb-tok-string { color: #ce9178; }
  .atomic-code-block .cb-tok-comment { color: #6a9955; font-style: italic; }
  .atomic-code-block .cb-tok-number { color: #b5cea8; }
  .atomic-code-block .cb-tok-type { color: #4ec9b0; }
  .atomic-code-block .cb-tok-function { color: #dcdcaa; }
  .atomic-code-block .cb-tok-variable { color: #9cdcfe; }
  .atomic-code-block .cb-tok-constant { color: #4fc1ff; }
  .atomic-code-block .cb-tok-tag { color: #569cd6; }
  .atomic-code-block .cb-tok-attribute { color: #9cdcfe; }
  .atomic-code-block .cb-tok-operator { color: #d4d4d4; }
  .atomic-code-block .cb-tok-meta { color: #c586c0; }
  .atomic-code-block .cb-tok-invalid {
    color: #f44747;
    background: rgba(244, 71, 71, 0.1);
    text-decoration: underline wavy;
  }
`;

/** One self-contained, dark-themed HTML document with every selected note. */
export function buildNotesExportHtml(notes: ExportNote[]): string {
  const body = notes
    .map((note) => {
      const title = escapeHtml(note.title.trim() || "Untitled note");
      const content = renderCodeBlocks(sanitizeHtml(note.html));
      return `<article class="export-note"><h1>${title}</h1>${content}</article>`;
    })
    .join("\n");

  const documentTitle =
    notes.length === 1
      ? notes[0].title.trim() || "Untitled note"
      : "ATLAS notes";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(documentTitle)}</title>
  <style>${EXPORT_STYLE}</style>
</head>
<body>
<main class="notes-export">
${body}
</main>
</body>
</html>
`;
}

function exportFileName(): string {
  return `notes-${new Date().toISOString().slice(0, 10)}.html`;
}

/** Web: same browser download the website uses. */
function downloadOnWeb(html: string): ExportResult {
  try {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return { ok: false, message: "Downloading is not available here." };
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName();
    doc.body.appendChild(anchor);
    anchor.click();
    doc.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return { ok: true, message: "Notes downloaded." };
  } catch {
    return { ok: false, message: "Could not download the notes." };
  }
}

function lazySharing(): typeof import("expo-sharing") | null {
  try {
    // The current APK may not contain the native module yet; the next build
    // will. Keep it optional so this screen never crashes on older builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-sharing") as typeof import("expo-sharing");
  } catch {
    return null;
  }
}

function lazyFileSystem(): typeof ExpoFileSystem | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-file-system/legacy") as typeof ExpoFileSystem;
  } catch {
    return null;
  }
}

/**
 * Save the exported HTML through the platform's file UI:
 * - Android: SAF folder picker (works on the current APK, no share module).
 * - iOS / fallback: the system share sheet when expo-sharing is present.
 */
export async function exportNotesFile(
  notes: ExportNote[],
): Promise<ExportResult> {
  if (notes.length === 0) {
    return { ok: false, message: "Select at least one note first." };
  }

  const html = buildNotesExportHtml(notes);

  if (Platform.OS === "web") return downloadOnWeb(html);

  const fileSystem = lazyFileSystem();
  if (!fileSystem) {
    return { ok: false, message: "File storage is not available on this build." };
  }

  if (Platform.OS === "android") {
    try {
      const permission =
        await fileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permission.granted) {
        const baseName = exportFileName().replace(/\.html$/, "");
        const uri = await fileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          baseName,
          "text/html",
        );
        await fileSystem.StorageAccessFramework.writeAsStringAsync(uri, html, {
          encoding: fileSystem.EncodingType.UTF8,
        });
        return {
          ok: true,
          message: `Saved ${notes.length} note${notes.length > 1 ? "s" : ""} to the folder you picked.`,
        };
      }
      return { ok: false, cancelled: true, message: "Saving cancelled." };
    } catch {
      // Fall through to the share sheet below.
    }
  }

  try {
    const directory = fileSystem.cacheDirectory;
    if (!directory) {
      return { ok: false, message: "Could not prepare the download file." };
    }
    const uri = `${directory}${exportFileName()}`;
    await fileSystem.writeAsStringAsync(uri, html, {
      encoding: fileSystem.EncodingType.UTF8,
    });

    const sharing = lazySharing();
    if (sharing) {
      const available = await sharing.isAvailableAsync();
      if (available) {
        await sharing.shareAsync(uri, {
          mimeType: "text/html",
          dialogTitle: "Save or share notes",
          UTI: "public.html",
        });
        return {
          ok: true,
          message: `Exported ${notes.length} note${notes.length > 1 ? "s" : ""}.`,
        };
      }
    }

    return {
      ok: false,
      message: "Saving files isn't available on this build. Update the app to enable it.",
    };
  } catch {
    return { ok: false, message: "Could not export the notes." };
  }
}
