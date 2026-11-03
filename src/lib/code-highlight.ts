/**
 * Self-contained syntax highlighting shared by the notes exporter and (as
 * embedded JS) the in-app WebView editor. The website uses Monaco; mobile
 * has no Monaco, so this small tokenizer keeps the same `cb-tok-*` palette
 * the website emits, and the exact same language ids in `data-language`.
 */

export type CodeLanguageMode = "generic" | "html" | "css" | "json";

export interface CodeLanguage {
  id: string;
  label: string;
  mode: CodeLanguageMode;
  keywords: string[];
  constants: string[];
  lineComments: string[];
  blockComment: [string, string] | null;
  quotes: string[];
  /** Identifiers immediately followed by `:` (CSS properties, YAML keys). */
  propertySyntax?: boolean;
}

const JS_KEYWORDS = [
  "abstract",
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "namespace",
  "new",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "set",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "type",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
];

const COMMON_CONSTANTS = [
  "true",
  "false",
  "null",
  "undefined",
  "nan",
  "infinity",
];

const PYTHON_KEYWORDS = [
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "print",
  "self",
];

const JAVA_KEYWORDS = [
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
  "var",
  "record",
  "sealed",
  "yield",
];

const C_KEYWORDS = [
  "auto",
  "break",
  "case",
  "char",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  "class",
  "namespace",
  "public",
  "private",
  "protected",
  "template",
  "typename",
  "using",
  "virtual",
  "override",
  "new",
  "delete",
  "nullptr",
  "constexpr",
  "auto",
  "bool",
  "true",
  "false",
  "try",
  "catch",
  "throw",
  "this",
  "operator",
];

const CSHARP_KEYWORDS = [
  "abstract",
  "as",
  "async",
  "await",
  "base",
  "bool",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "checked",
  "class",
  "const",
  "continue",
  "decimal",
  "default",
  "delegate",
  "do",
  "double",
  "else",
  "enum",
  "event",
  "explicit",
  "extern",
  "finally",
  "fixed",
  "float",
  "for",
  "foreach",
  "get",
  "goto",
  "if",
  "implicit",
  "in",
  "int",
  "interface",
  "internal",
  "is",
  "lock",
  "long",
  "namespace",
  "new",
  "object",
  "operator",
  "out",
  "override",
  "params",
  "private",
  "protected",
  "public",
  "readonly",
  "record",
  "ref",
  "return",
  "sbyte",
  "sealed",
  "set",
  "short",
  "sizeof",
  "stackalloc",
  "static",
  "string",
  "struct",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "uint",
  "ulong",
  "unchecked",
  "unsafe",
  "ushort",
  "using",
  "var",
  "virtual",
  "void",
  "volatile",
  "while",
  "yield",
];

const GO_KEYWORDS = [
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
];

const RUST_KEYWORDS = [
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
];

const RUBY_KEYWORDS = [
  "alias",
  "and",
  "begin",
  "break",
  "case",
  "class",
  "def",
  "defined",
  "do",
  "else",
  "elsif",
  "end",
  "ensure",
  "false",
  "for",
  "if",
  "in",
  "module",
  "next",
  "nil",
  "not",
  "or",
  "redo",
  "rescue",
  "retry",
  "return",
  "self",
  "super",
  "then",
  "true",
  "undef",
  "unless",
  "until",
  "when",
  "while",
  "yield",
  "require",
  "attr_accessor",
  "attr_reader",
  "attr_writer",
];

const PHP_KEYWORDS = [
  "abstract",
  "and",
  "array",
  "as",
  "break",
  "callable",
  "case",
  "catch",
  "class",
  "clone",
  "const",
  "continue",
  "declare",
  "default",
  "do",
  "echo",
  "else",
  "elseif",
  "empty",
  "enddeclare",
  "endfor",
  "endforeach",
  "endif",
  "endswitch",
  "endwhile",
  "extends",
  "final",
  "finally",
  "fn",
  "for",
  "foreach",
  "function",
  "global",
  "goto",
  "if",
  "implements",
  "include",
  "instanceof",
  "interface",
  "isset",
  "list",
  "match",
  "namespace",
  "new",
  "or",
  "print",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "static",
  "switch",
  "throw",
  "trait",
  "try",
  "unset",
  "use",
  "var",
  "while",
  "xor",
  "yield",
];

const SWIFT_KEYWORDS = [
  "associatedtype",
  "class",
  "deinit",
  "enum",
  "extension",
  "fileprivate",
  "func",
  "import",
  "init",
  "inout",
  "internal",
  "let",
  "open",
  "operator",
  "private",
  "protocol",
  "public",
  "rethrows",
  "static",
  "struct",
  "subscript",
  "typealias",
  "var",
  "break",
  "case",
  "continue",
  "default",
  "defer",
  "do",
  "else",
  "fallthrough",
  "for",
  "guard",
  "if",
  "in",
  "repeat",
  "return",
  "switch",
  "where",
  "while",
  "as",
  "catch",
  "false",
  "is",
  "nil",
  "self",
  "super",
  "throw",
  "throws",
  "true",
  "try",
  "await",
  "async",
  "some",
  "any",
];

const KOTLIN_KEYWORDS = [
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "typeof",
  "val",
  "var",
  "when",
  "while",
  "by",
  "catch",
  "constructor",
  "delegate",
  "dynamic",
  "field",
  "file",
  "finally",
  "get",
  "import",
  "init",
  "param",
  "property",
  "receiver",
  "set",
  "setparam",
  "where",
  "actual",
  "abstract",
  "annotation",
  "companion",
  "const",
  "crossinline",
  "data",
  "enum",
  "expect",
  "external",
  "final",
  "infix",
  "inline",
  "inner",
  "internal",
  "lateinit",
  "noinline",
  "open",
  "operator",
  "out",
  "override",
  "private",
  "protected",
  "public",
  "reified",
  "sealed",
  "suspend",
  "tailrec",
  "vararg",
];

const SQL_KEYWORDS = [
  "select",
  "from",
  "where",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "alter",
  "drop",
  "truncate",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "outer",
  "cross",
  "on",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "offset",
  "distinct",
  "union",
  "all",
  "as",
  "and",
  "or",
  "not",
  "null",
  "is",
  "in",
  "exists",
  "between",
  "like",
  "ilike",
  "case",
  "when",
  "then",
  "else",
  "end",
  "asc",
  "desc",
  "primary",
  "foreign",
  "key",
  "references",
  "default",
  "constraint",
  "unique",
  "index",
  "view",
  "with",
  "recursive",
  "returning",
  "conflict",
  "do",
  "nothing",
  "begin",
  "commit",
  "rollback",
  "grant",
  "revoke",
];

const BASH_KEYWORDS = [
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "until",
  "do",
  "done",
  "case",
  "esac",
  "in",
  "function",
  "select",
  "time",
  "until",
  "export",
  "local",
  "readonly",
  "declare",
  "return",
  "break",
  "continue",
  "exit",
  "shift",
  "source",
  "alias",
  "unalias",
  "echo",
  "printf",
  "read",
  "cd",
  "pwd",
  "set",
  "unset",
  "trap",
  "wait",
  "exec",
  "eval",
];

const CSS_KEYWORDS = [
  "media",
  "import",
  "keyframes",
  "font-face",
  "supports",
  "charset",
  "namespace",
  "page",
  "from",
  "to",
  "important",
  "root",
];

export const CODE_LANGUAGES: CodeLanguage[] = [
  {
    id: "plaintext",
    label: "Plain Text",
    mode: "generic",
    keywords: [],
    constants: [],
    lineComments: [],
    blockComment: null,
    quotes: [],
  },
  {
    id: "javascript",
    label: "JavaScript",
    mode: "generic",
    keywords: JS_KEYWORDS,
    constants: [...COMMON_CONSTANTS, "this"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"', "`"],
  },
  {
    id: "typescript",
    label: "TypeScript",
    mode: "generic",
    keywords: [...JS_KEYWORDS, "keyof", "infer", "asserts", "unknown", "never"],
    constants: COMMON_CONSTANTS,
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"', "`"],
  },
  {
    id: "python",
    label: "Python",
    mode: "generic",
    keywords: PYTHON_KEYWORDS,
    constants: ["true", "false", "none"],
    lineComments: ["#"],
    blockComment: null,
    quotes: ["'", '"'],
  },
  {
    id: "java",
    label: "Java",
    mode: "generic",
    keywords: JAVA_KEYWORDS,
    constants: COMMON_CONSTANTS,
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "c",
    label: "C",
    mode: "generic",
    keywords: C_KEYWORDS,
    constants: COMMON_CONSTANTS,
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "cpp",
    label: "C++",
    mode: "generic",
    keywords: C_KEYWORDS,
    constants: [...COMMON_CONSTANTS, "nullptr"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "csharp",
    label: "C#",
    mode: "generic",
    keywords: CSHARP_KEYWORDS,
    constants: COMMON_CONSTANTS,
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "go",
    label: "Go",
    mode: "generic",
    keywords: GO_KEYWORDS,
    constants: [...COMMON_CONSTANTS, "nil", "iota"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"', "`"],
  },
  {
    id: "rust",
    label: "Rust",
    mode: "generic",
    keywords: RUST_KEYWORDS,
    constants: ["true", "false", "none", "some", "ok", "err"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"'],
  },
  {
    id: "ruby",
    label: "Ruby",
    mode: "generic",
    keywords: RUBY_KEYWORDS,
    constants: ["true", "false", "nil"],
    lineComments: ["#"],
    blockComment: null,
    quotes: ["'", '"'],
  },
  {
    id: "php",
    label: "PHP",
    mode: "generic",
    keywords: PHP_KEYWORDS,
    constants: COMMON_CONSTANTS,
    lineComments: ["//", "#"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "swift",
    label: "Swift",
    mode: "generic",
    keywords: SWIFT_KEYWORDS,
    constants: ["true", "false", "nil"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"'],
  },
  {
    id: "kotlin",
    label: "Kotlin",
    mode: "generic",
    keywords: KOTLIN_KEYWORDS,
    constants: ["true", "false", "null"],
    lineComments: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"'],
  },
  {
    id: "sql",
    label: "SQL",
    mode: "generic",
    keywords: SQL_KEYWORDS,
    constants: ["true", "false", "null"],
    lineComments: ["--"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
  },
  {
    id: "html",
    label: "HTML",
    mode: "html",
    keywords: [],
    constants: [],
    lineComments: [],
    blockComment: ["<!--", "-->"],
    quotes: ['"', "'"],
  },
  {
    id: "xml",
    label: "XML",
    mode: "html",
    keywords: [],
    constants: [],
    lineComments: [],
    blockComment: ["<!--", "-->"],
    quotes: ['"', "'"],
  },
  {
    id: "css",
    label: "CSS",
    mode: "css",
    keywords: CSS_KEYWORDS,
    constants: [],
    lineComments: [],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
    propertySyntax: true,
  },
  {
    id: "json",
    label: "JSON",
    mode: "json",
    keywords: [],
    constants: ["true", "false", "null"],
    lineComments: [],
    blockComment: null,
    quotes: ['"'],
  },
  {
    id: "bash",
    label: "Shell",
    mode: "generic",
    keywords: BASH_KEYWORDS,
    constants: ["true", "false"],
    lineComments: ["#"],
    blockComment: null,
    quotes: ["'", '"', "`"],
  },
  {
    id: "yaml",
    label: "YAML",
    mode: "generic",
    keywords: [],
    constants: ["true", "false", "null", "yes", "no", "on", "off"],
    lineComments: ["#"],
    blockComment: null,
    quotes: ["'", '"'],
    propertySyntax: true,
  },
  {
    id: "markdown",
    label: "Markdown",
    mode: "generic",
    keywords: [],
    constants: [],
    lineComments: [],
    blockComment: null,
    quotes: ["`"],
  },
];

export const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  "c++": "cpp",
  cplusplus: "cpp",
  "c#": "csharp",
  cs: "csharp",
  golang: "go",
  rs: "rust",
  rb: "ruby",
  kt: "kotlin",
  kts: "kotlin",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  psql: "sql",
  postgres: "sql",
  postgresql: "sql",
  htm: "html",
  yml: "yaml",
  md: "markdown",
  text: "plaintext",
  txt: "plaintext",
};

const LANGUAGE_BY_ID = new Map(
  CODE_LANGUAGES.map((language) => [language.id, language]),
);

export function normalizeLanguageId(input?: string | null): string {
  if (!input) return "plaintext";
  const raw = input.trim().toLowerCase().replace(/^\./, "");
  if (!raw) return "plaintext";
  const aliased = LANGUAGE_ALIASES[raw] ?? raw;
  return LANGUAGE_BY_ID.has(aliased) ? aliased : "plaintext";
}

export function languageLabel(language: string): string {
  return (
    LANGUAGE_BY_ID.get(normalizeLanguageId(language))?.label ??
    LANGUAGE_BY_ID.get("plaintext")!.label
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

const WORD_START = /[A-Za-z_$#@]/;
const WORD_PART = /[A-Za-z0-9_$#@-]/;
const DIGIT = /[0-9]/;

function span(kind: string | null, text: string): string {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return kind ? `<span class="cb-tok-${kind}">${escaped}</span>` : escaped;
}

function scanString(
  code: string,
  start: number,
  quotes: string[],
): { end: number } {
  const quote = code[start];
  const multiline = quote === "`";
  let index = start + 1;
  while (index < code.length) {
    const char = code[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      index += 1;
      break;
    }
    if (!multiline && char === "\n") break;
    index += 1;
  }
  return { end: Math.min(index, code.length) };
}

function scanNumber(code: string, start: number): number {
  let index = start;
  if (code[index] === "0" && /[xXbBoO]/.test(code[index + 1] ?? "")) {
    index += 2;
    while (index < code.length && /[0-9a-fA-F_]/.test(code[index])) index += 1;
    return index;
  }
  while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
  if (code[index] === ".") {
    index += 1;
    while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
  }
  if (/[eE]/.test(code[index] ?? "")) {
    index += 1;
    if (/[+-]/.test(code[index] ?? "")) index += 1;
    while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
  }
  while (index < code.length && /[a-zA-Z]/.test(code[index])) index += 1;
  return index;
}

function highlightGeneric(code: string, language: CodeLanguage): string {
  const keywordSet = new Set(language.keywords.map((word) => word.toLowerCase()));
  const constantSet = new Set(
    language.constants.map((word) => word.toLowerCase()),
  );
  const quotes = new Set(language.quotes);
  const lineComments = language.lineComments;
  let out = "";
  let index = 0;

  while (index < code.length) {
    const char = code[index];

    if (language.blockComment) {
      const [open, close] = language.blockComment;
      if (code.startsWith(open, index)) {
        const closeAt = code.indexOf(close, index + open.length);
        const end =
          closeAt < 0 ? code.length : closeAt + close.length;
        out += span("comment", code.slice(index, end));
        index = end;
        continue;
      }
    }

    const lineComment = lineComments.find((token) =>
      code.startsWith(token, index),
    );
    if (lineComment) {
      const newline = code.indexOf("\n", index);
      const end = newline < 0 ? code.length : newline;
      out += span("comment", code.slice(index, end));
      index = end;
      continue;
    }

    if (quotes.has(char)) {
      const { end } = scanString(code, index, language.quotes);
      out += span("string", code.slice(index, end));
      index = end;
      continue;
    }

    if (DIGIT.test(char) && !WORD_PART.test(code[index - 1] ?? "")) {
      const end = scanNumber(code, index);
      out += span("number", code.slice(index, end));
      index = end;
      continue;
    }

    if (WORD_START.test(char)) {
      let end = index + 1;
      while (end < code.length && WORD_PART.test(code[end])) end += 1;
      const word = code.slice(index, end);
      const lower = word.toLowerCase();

      let lookahead = end;
      while (lookahead < code.length && /[ \t]/.test(code[lookahead])) {
        lookahead += 1;
      }

      let kind: string | null = null;
      if (keywordSet.has(lower)) kind = "keyword";
      else if (constantSet.has(lower)) kind = "constant";
      else if (code[lookahead] === "(") kind = "function";
      else if (language.propertySyntax && code[lookahead] === ":") {
        kind = "attribute";
      } else if (/^[A-Z]/.test(word) && word.length > 1) kind = "type";

      out += span(kind, word);
      index = end;
      continue;
    }

    if (/[=+\-*/%<>!&|^~?:;,.()[\]{}]/.test(char)) {
      out += span("operator", char);
      index += 1;
      continue;
    }

    out += escapeHtml(char);
    index += 1;
  }

  return out;
}

function highlightHtml(code: string): string {
  let out = "";
  let index = 0;

  while (index < code.length) {
    if (code.startsWith("<!--", index)) {
      const endAt = code.indexOf("-->", index + 4);
      const end = endAt < 0 ? code.length : endAt + 3;
      out += span("comment", code.slice(index, end));
      index = end;
      continue;
    }

    const char = code[index];
    if (char === "<" && /[A-Za-z!/]/.test(code[index + 1] ?? "")) {
      let cursor = index + 1;
      if (code[cursor] === "/") cursor += 1;
      const nameStart = cursor;
      while (cursor < code.length && /[A-Za-z0-9:-]/.test(code[cursor])) {
        cursor += 1;
      }
      out += span("tag", code.slice(index, cursor));
      if (cursor === nameStart) {
        out += escapeHtml(code.slice(index, cursor + 1));
        index = cursor + 1;
        continue;
      }

      while (cursor < code.length && code[cursor] !== ">") {
        const inner = code[cursor];
        if (inner === '"' || inner === "'") {
          const { end } = scanString(code, cursor, ['"', "'"]);
          out += span("string", code.slice(cursor, end));
          cursor = end;
          continue;
        }
        if (/[A-Za-z_:@-]/.test(inner)) {
          let end = cursor + 1;
          while (end < code.length && /[A-Za-z0-9_:@.-]/.test(code[end])) {
            end += 1;
          }
          out += span("attribute", code.slice(cursor, end));
          cursor = end;
          continue;
        }
        out += escapeHtml(inner);
        cursor += 1;
      }

      if (code[cursor] === ">") {
        out += span("tag", ">");
        cursor += 1;
      }
      index = cursor;
      continue;
    }

    let end = index + 1;
    while (end < code.length && code[end] !== "<") end += 1;
    out += escapeHtml(code.slice(index, end));
    index = end;
  }

  return out;
}

function highlightJson(code: string): string {
  let out = "";
  let index = 0;

  while (index < code.length) {
    const char = code[index];
    if (char === '"') {
      const { end } = scanString(code, index, ['"']);
      let lookahead = end;
      while (lookahead < code.length && /[ \t]/.test(code[lookahead])) {
        lookahead += 1;
      }
      out += span(
        code[lookahead] === ":" ? "attribute" : "string",
        code.slice(index, end),
      );
      index = end;
      continue;
    }
    if (DIGIT.test(char) || (char === "-" && DIGIT.test(code[index + 1] ?? ""))) {
      const end = scanNumber(code, index);
      out += span("number", code.slice(index, end));
      index = end;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      let end = index + 1;
      while (end < code.length && /[A-Za-z]/.test(code[end])) end += 1;
      const word = code.slice(index, end);
      out += span(
        /^(true|false|null)$/i.test(word) ? "constant" : null,
        word,
      );
      index = end;
      continue;
    }
    out += escapeHtml(char);
    index += 1;
  }

  return out;
}

/** Same token classes the website renders with Monaco. */
export function highlightCode(code: string, language: string): string {
  const normalized = code.replace(/\r\n?/g, "\n");
  if (!normalized) return "";
  const definition =
    LANGUAGE_BY_ID.get(normalizeLanguageId(language)) ??
    LANGUAGE_BY_ID.get("plaintext")!;

  if (definition.id === "plaintext") return escapeHtml(normalized);
  if (definition.mode === "html") return highlightHtml(normalized);
  if (definition.mode === "json") return highlightJson(normalized);
  if (definition.mode === "css") {
    return highlightGeneric(normalized, {
      ...definition,
      propertySyntax: true,
    });
  }
  return highlightGeneric(normalized, definition);
}

/** Website-parity code block view (line-number gutter + highlighted code). */
export function renderHighlightedCodeBlock(
  code: string,
  language: string,
): string {
  const normalized = code.replace(/\r\n?/g, "\n");
  const normalizedLanguage = normalizeLanguageId(language);
  const lines = normalized.split("\n");
  const gutter = lines.map((_, index) => String(index + 1)).join("\n");
  const highlighted = highlightCode(normalized, normalizedLanguage);

  return (
    `<div class="atomic-code-block-view">` +
    `<div class="atomic-code-block-gutter" aria-hidden="true">${escapeHtml(gutter)}</div>` +
    `<pre class="atomic-code-block-pre"><code class="atomic-code-block-code">${highlighted}</code></pre>` +
    `</div>`
  );
}

/** Default file extension per language (editor header + picker). */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  plaintext: ".txt",
  javascript: ".js",
  typescript: ".ts",
  python: ".py",
  java: ".java",
  c: ".c",
  cpp: ".cpp",
  csharp: ".cs",
  go: ".go",
  rust: ".rs",
  ruby: ".rb",
  php: ".php",
  swift: ".swift",
  kotlin: ".kt",
  sql: ".sql",
  html: ".html",
  xml: ".xml",
  css: ".css",
  json: ".json",
  bash: ".sh",
  yaml: ".yaml",
  markdown: ".md",
};

/** Editor picker payload (embedded into the WebView document). */
export const EDITOR_LANGUAGES = CODE_LANGUAGES.map((language) => ({
  id: language.id,
  label: language.label,
  extension: LANGUAGE_EXTENSIONS[language.id] ?? ".txt",
}));

export function escapeCodeHtml(value: string): string {
  return escapeHtml(value);
}

export function escapeCodeAttribute(value: string): string {
  return escapeAttribute(value);
}
