export interface Note {
  id: string;
  title: string;
  html: string;
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
  "div",
  "em",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "s",
  "strong",
  "u",
  "ul",
]);

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
    .replace(/&amp;/gi, "&");
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
      if (match.startsWith("</")) return `</${name}>`;
      if (name === "br") return "<br/>";
      if (name === "a") {
        const href = safeHref(rawAttrs);
        return href ? `<a href="${href}">` : "<a>";
      }
      return `<${name}>`;
    },
  );
  // Tail safety: a `<` followed by letters with no closing `>` would be
  // re-parsed as a tag opener by a browser (e.g. unclosed `<script src=…`).
  out = out.replace(/<([^>]*)$/, (_, tail: string) => `&lt;${tail}`);
  return out;
}
