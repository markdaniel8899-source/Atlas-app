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
}

const FORBIDDEN_TAGS = "script|style|iframe|form|input";

/**
 * DOMPurify equivalent for React Native (no DOM): drops the same forbidden
 * tags, inline event handlers and style attributes, plus javascript: URIs.
 * Content is only ever written by our own editor, so this is belt-and-braces
 * against anything that sneaks in from another client.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(
      new RegExp(`<(${FORBIDDEN_TAGS})\\b[\\s\\S]*?<\\/\\1>`, "gi"),
      "",
    )
    .replace(new RegExp(`<\\/?(${FORBIDDEN_TAGS})\\b[^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}
