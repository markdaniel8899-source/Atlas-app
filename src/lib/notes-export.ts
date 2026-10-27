import { Platform } from "react-native";
import type * as ExpoFileSystem from "expo-file-system/legacy";
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

const EXPORT_STYLE = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    background: #ffffff;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #111;
    margin-top: 24px;
    margin-bottom: 12px;
    line-height: 1.3;
  }
  h1 { font-size: 2.5rem; border-bottom: 2px solid #eaeaea; padding-bottom: 8px; }
  h2 { font-size: 1.8rem; }
  h3 { font-size: 1.4rem; }
  p { margin: 12px 0; }
  ul, ol { margin: 12px 0; padding-left: 24px; }
  li { margin: 6px 0; }
  code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: "SF Mono", "Fira Code", "Monaco", monospace;
    font-size: 0.9em;
  }
  pre {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
  }
  pre code { background: none; padding: 0; color: inherit; font-size: 0.9rem; }
  blockquote {
    border-left: 4px solid #cf9eff;
    padding-left: 16px;
    margin: 16px 0;
    color: #666;
    font-style: italic;
  }
  a { color: #7c5cf0; text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr { border: none; border-top: 1px solid #eaeaea; margin: 24px 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  .note-separator {
    border-top: 2px dashed #cf9eff;
    margin: 40px 0;
    padding-top: 20px;
  }
`;

/** One self-contained HTML document containing every selected note. */
export function buildNotesExportHtml(notes: ExportNote[]): string {
  const body = notes
    .map((note) => {
      const title = escapeHtml(note.title.trim() || "Untitled note");
      return `
  <h1>${title}</h1>
  <div>${sanitizeHtml(note.html)}</div>`;
    })
    .join('\n  <div class="note-separator"></div>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(
    notes.length === 1
      ? notes[0].title.trim() || "Untitled note"
      : "ATLAS notes",
  )}</title>
  <style>${EXPORT_STYLE}</style>
</head>
<body>
${body}
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
