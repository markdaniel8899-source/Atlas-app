export interface Note {
  id: string;
  title: string;
  html: string;
  /** Creation time (notes.created_at), shown in the list like the website. */
  createdAt: number;
  updatedAt: number;
  /** Course this note belongs to (notes.course_id); null = unlinked. */
  courseId: number | null;
  /** Course topic this note is attached to (notes.topic_id); null = unlinked. */
  topicId: number | null;
  /** Title of the owning course, used for subject grouping. */
  courseTitle: string | null;
  /** Manual ordering inside the notes list (notes.sort_order). */
  sortOrder: number | null;
  /** User ID of who shared this note (if it was shared). */
  sharedBy: string | null;
  /** Display name/username of who shared this note (for the sender badge). */
  sharedByName: string | null;
  /** When the note was shared. */
  sharedAt: number | null;
}

/** Tags the editor itself can produce (plus legacy web-client content). */
const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h2",
  "h3",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

/** Syntax-highlight token classes emitted by the website's code blocks. */
const TOKEN_CLASSES = new Set([
  "cb-tok-keyword",
  "cb-tok-string",
  "cb-tok-comment",
  "cb-tok-number",
  "cb-tok-type",
  "cb-tok-function",
  "cb-tok-variable",
  "cb-tok-constant",
  "cb-tok-tag",
  "cb-tok-attribute",
  "cb-tok-operator",
  "cb-tok-meta",
  "cb-tok-invalid",
]);

const SAFE_TOKEN_RE = /^[a-zA-Z0-9+#._-]{1,40}$/;
const SAFE_BLOCK_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

/** Elements whose entire content is dropped (never just unwrapped). */
const DROPPED_BLOCKS =
  "script|style|iframe|object|embed|form|select|textarea|button|video|audio|source|svg|math|template|meta|link|base|frame|frameset|applet";

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    )
    .replace(/&colon;/gi, ":")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Reads an attribute value from a raw attribute string. */
function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  ).exec(attrs);
  if (!match) return null;
  return match[1].replace(/^["']|["']$/g, "");
}

/** Re-encodes a value for safe use inside a double-quoted attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function classTokens(attrs: string): string[] {
  const raw = attrValue(attrs, "class");
  return raw ? raw.split(/\s+/).filter(Boolean) : [];
}

/** Returns a safe href (https/http/mailto only) or null. */
function safeHref(attrs: string): string | null {
  const match = /\bhref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(attrs);
  if (!match) return null;
  const raw = match[1].replace(/^["']|["']$/g, "");
  // Entity tricks (`java&#x73;cript:`, `java\tscript:`) are decoded and
  // stripped of whitespace/quote characters before the scheme check.
  const decoded = decodeEntities(raw).replace(
    /[\u0000-\u0020\u007f<>"'`]/g,
    "",
  );
  if (
    /^https?:\/\//i.test(decoded) ||
    /^mailto:[^\s@]+@[^\s@]+/.test(decoded)
  ) {
    return decoded;
  }
  return null;
}

/**
 * Allowlist-based HTML sanitizer for note bodies (React Native has no DOM).
 * Only tags the editor can produce survive, with every attribute dropped
 * except a validated href; scripts, styles, handlers and exotic tags are
 * removed. Any stray `<` that could start a malformed tag at the tail of the
 * string is escaped so a browser re-parse cannot find a tag we did not emit.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let out = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(
      new RegExp(`<(${DROPPED_BLOCKS})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi"),
      "",
    )
    .replace(new RegExp(`<\\/?(${DROPPED_BLOCKS})\\b[^>]*>`, "gi"), "");
  out = out.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g,
    (match, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (match.startsWith("</")) return name === "br" ? "" : `</${name}>`;
      if (name === "br") return "<br/>";
      if (name === "hr") return "<hr/>";
      if (name === "a") {
        const href = safeHref(rawAttrs);
        return href ? `<a href="${href}">` : "<a>";
      }
      if (name === "div") {
        const divTokens = classTokens(rawAttrs);
        if (divTokens.includes("atomic-table-block")) {
          const tableId = attrValue(rawAttrs, "data-table-id");
          const rawRows = attrValue(rawAttrs, "data-table");
          const safeTableId =
            tableId && SAFE_BLOCK_ID_RE.test(tableId.trim()) ? tableId.trim() : "";
          let rows: string[][] = [];
          const decodedRows = rawRows == null ? "" : decodeEntities(rawRows);
          if (decodedRows) {
            try {
              const parsed: unknown = JSON.parse(decodedRows);
              if (Array.isArray(parsed)) {
                for (const row of parsed) {
                  if (!Array.isArray(row)) continue;
                  const cells: string[] = [];
                  for (const cell of row) {
                    cells.push(typeof cell === "string" ? cell : cell == null ? "" : String(cell));
                  }
                  rows.push(cells);
                }
              }
            } catch {
              rows = [];
            }
          }
          const safeRows: string[][] = rows.length > 0 ? rows : [["", ""]];
          const headHtml = (safeRows[0] ?? [])
            .map((cell) => `<th>${cell}</th>`)
            .join("");
          const bodyHtml = safeRows
            .slice(1)
            .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
            .join("");
          const bodySection = safeRows.length > 1 ? `<tbody>${bodyHtml}</tbody>` : "";
          return (
            `<div class="atomic-table-block"` +
            (safeTableId ? ` data-table-id="${escapeAttr(safeTableId)}"` : "") +
            ` data-table="${escapeAttr(JSON.stringify(safeRows))}" contenteditable="false">` +
            `<div class="atomic-table-view"><table class="atomic-table"><thead><tr>${headHtml}</tr></thead>${bodySection}</table></div>` +
            `</div>`
          );
        }
        if (!divTokens.includes("atomic-code-block")) {
          return "<div>";
        }
        const id = attrValue(rawAttrs, "data-code-block-id");
        const language = attrValue(rawAttrs, "data-language");
        const rawCode = attrValue(rawAttrs, "data-code");
        const code = rawCode == null ? "" : decodeEntities(rawCode);
        const safeId =
          id && SAFE_BLOCK_ID_RE.test(id.trim()) ? id.trim() : "";
        const safeLanguage =
          language && SAFE_TOKEN_RE.test(language.trim())
            ? language.trim()
            : "plaintext";
        return (
          `<div class="atomic-code-block"` +
          (safeId ? ` data-code-block-id="${escapeAttr(safeId)}"` : "") +
          ` data-language="${escapeAttr(safeLanguage)}"` +
          ` data-code="${escapeAttr(code)}">`
        );
      }
      if (name === "pre") {
        const keepClass = classTokens(rawAttrs).includes(
          "atomic-code-block-pre",
        );
        const language = attrValue(rawAttrs, "data-language");
        const safeLanguage =
          language && SAFE_TOKEN_RE.test(language.trim())
            ? language.trim()
            : null;
        return (
          `<pre${keepClass ? ' class="atomic-code-block-pre"' : ""}` +
          (safeLanguage
            ? ` data-language="${escapeAttr(safeLanguage)}"`
            : "") +
          ">"
        );
      }
      if (name === "code") {
        const keepClass = classTokens(rawAttrs).includes(
          "atomic-code-block-code",
        );
        return keepClass
          ? '<code class="atomic-code-block-code">'
          : "<code>";
      }
      if (name === "span") {
        const token = classTokens(rawAttrs).find((value) =>
          TOKEN_CLASSES.has(value),
        );
        return token ? `<span class="${token}">` : "<span>";
      }
      return `<${name}>`;
    },
  );
  // Tail safety: a `<` followed by letters with no closing `>` would be
  // re-parsed as a tag opener by a browser (e.g. unclosed `<script src=…`).
  out = out.replace(/<([^>]*)$/, (_, tail: string) => `&lt;${tail}`);
  return out;
}
