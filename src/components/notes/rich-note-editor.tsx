import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import { sanitizeHtml } from "../../lib/notes";
import { colors } from "../../theme/theme";

export interface EditorCommandState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading: boolean;
  quote: boolean;
  unordered: boolean;
  ordered: boolean;
  code: boolean;
}

export interface RichNoteEditorHandle {
  /** Runs a document.execCommand inside the editor (bold, italic, ...). */
  run: (command: string, value?: string) => void;
}

interface RichNoteEditorProps {
  /** Pushes `html` into the page whenever the edited note changes. */
  noteId: string;
  html: string;
  /** Fired with the editor's innerHTML on every user input. */
  onChange: (html: string) => void;
  /** Active formatting at the caret (drives the toolbar highlight). */
  onStateChange?: (state: EditorCommandState) => void;
  /** Fill the remaining modal height instead of a fixed 340px box. */
  fill?: boolean;
}

/**
 * Same contract as the web contentEditable editor: the note body is stored
 * as HTML and edited inline. A hidden membership in the page keeps the last
 * selection so toolbar taps (which blur the WebView) still format the right
 * range - the same approach native rich editors use.
 *
 * Code blocks use the website's atomic-code-block shape (`data-code` +
 * `data-language`) so a note can move between the app and the web without
 * losing its code. Monaco is web-only; mobile renders them as a plain
 * monospace card and edits the raw code text directly.
 */
function buildEditorHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #editor {
    min-height: 100%;
    padding: 18px 20px 120px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.625;
    color: rgba(255,255,255,0.72);
    outline: none;
    word-wrap: break-word;
    -webkit-user-select: text;
    user-select: text;
  }
  #editor h2 { margin: 18px 0 8px; font-size: 20px; line-height: 1.3; font-weight: 600; color: #fff; }
  #editor h3 { margin: 16px 0 6px; font-size: 17px; line-height: 1.35; font-weight: 600; color: #fff; }
  #editor blockquote {
    margin: 10px 0;
    border-left: 2px solid rgba(207,158,255,0.5);
    padding-left: 16px;
    color: rgba(255,255,255,0.55);
  }
  #editor ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
  #editor ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
  #editor li { margin: 4px 0; }
  #editor p { margin: 8px 0; }
  #editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 18px 0; }
  #editor a { color: #cf9eff; text-decoration: underline; }
  #editor .atomic-code-block {
    margin: 14px 0;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px;
    background: #0a0a12;
    overflow: hidden;
  }
  #editor .atomic-code-block::before {
    content: attr(data-language);
    display: block;
    padding: 6px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(207,158,255,0.7);
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  #editor .atomic-code-block-pre {
    margin: 0;
    padding: 12px 14px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: #d4d4d4;
  }
  #editor .atomic-code-block-code {
    font-family: inherit;
    background: none;
    padding: 0;
    color: inherit;
  }
  #editor pre:not(.atomic-code-block-pre) {
    margin: 12px 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: #0a0a12;
    border: 1px solid rgba(255,255,255,0.08);
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: #d4d4d4;
  }
  #editor code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
  }
  #editor .cb-tok-keyword { color: #569cd6; }
  #editor .cb-tok-string { color: #ce9178; }
  #editor .cb-tok-comment { color: #6a9955; font-style: italic; }
  #editor .cb-tok-number { color: #b5cea8; }
  #editor .cb-tok-type { color: #4ec9b0; }
  #editor .cb-tok-function { color: #dcdcaa; }
  #editor .cb-tok-variable { color: #9cdcfe; }
  #editor .cb-tok-constant { color: #4fc1ff; }
  #editor .cb-tok-tag { color: #569cd6; }
  #editor .cb-tok-attribute { color: #9cdcfe; }
  #editor .cb-tok-operator { color: #d4d4d4; }
  #editor .cb-tok-meta { color: #c586c0; }
  #editor .cb-tok-invalid { color: #f44747; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" spellcheck="true" aria-label="Note content"></div>
<script>
  (function () {
    var editor = document.getElementById("editor");
    var savedRange = null;

    function post(kind, payload) {
      if (!window.ReactNativeWebView) return;
      var message = { kind: kind };
      if (payload) {
        for (var key in payload) message[key] = payload[key];
      }
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function saveSelection() {
      var selection = window.getSelection();
      if (selection && selection.rangeCount > 0 &&
          editor.contains(selection.anchorNode)) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    }

    function currentBlock() {
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      var node = selection.getRangeAt(0).startContainer;
      var element = node && node.nodeType === 3 ? node.parentElement : node;
      return element && element.closest ? element : null;
    }

    function collectState() {
      var state = {
        bold: false, italic: false, underline: false,
        heading: false, quote: false,
        unordered: false, ordered: false, code: false
      };
      try {
        state.bold = document.queryCommandState("bold");
        state.italic = document.queryCommandState("italic");
        state.underline = document.queryCommandState("underline");
        state.unordered = document.queryCommandState("insertUnorderedList");
        state.ordered = document.queryCommandState("insertOrderedList");
      } catch (error) { /* unsupported - keep false */ }
      var block = currentBlock();
      if (block) {
        state.heading = Boolean(block.closest("h2, h3"));
        state.quote = Boolean(block.closest("blockquote"));
        state.code = Boolean(block.closest(".atomic-code-block"));
      }
      return state;
    }

    function pushState() {
      post("state", collectState());
    }

    /** Rebuild a code block's editable view from its raw data-code value. */
    function renderBlock(block) {
      var raw = block.getAttribute("data-code");
      var codeElement = block.querySelector("code");
      var code = raw != null ? raw : (codeElement ? codeElement.textContent : "");
      var language = block.getAttribute("data-language") || "plaintext";
      block.setAttribute("data-code", code);
      block.setAttribute("data-language", language);
      if (!block.getAttribute("data-code-block-id")) {
        block.setAttribute(
          "data-code-block-id",
          "block-" + Date.now().toString(36) + "-" +
            Math.random().toString(36).slice(2, 8)
        );
      }
      block.innerHTML =
        '<pre class="atomic-code-block-pre"><code class="atomic-code-block-code">' +
        (code ? escapeHtml(code) : "<br>") +
        "</code></pre>";
    }

    function normalizeBlocks() {
      var blocks = editor.querySelectorAll(".atomic-code-block");
      for (var index = 0; index < blocks.length; index += 1) {
        renderBlock(blocks[index]);
      }
    }

    /** Persist the latest code text back onto the block before posting. */
    function syncBlocks() {
      var blocks = editor.querySelectorAll(".atomic-code-block");
      for (var index = 0; index < blocks.length; index += 1) {
        var block = blocks[index];
        var codeElement = block.querySelector("code");
        block.setAttribute("data-code", codeElement ? codeElement.textContent : "");
        if (!block.getAttribute("data-language")) {
          block.setAttribute("data-language", "plaintext");
        }
      }
    }

    function notifyChange() {
      syncBlocks();
      post("change", { html: editor.innerHTML });
      pushState();
    }

    function toggleBlock(tag) {
      var block = currentBlock();
      var active = block && block.closest ? block.closest(tag) : null;
      document.execCommand("formatBlock", false, active ? "p" : tag);
    }

    function insertCodeBlock() {
      var id =
        "block-" + Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 8);
      var block = document.createElement("div");
      block.className = "atomic-code-block";
      block.setAttribute("data-code-block-id", id);
      block.setAttribute("data-language", "plaintext");
      block.setAttribute("data-code", "");
      block.innerHTML =
        '<pre class="atomic-code-block-pre"><code class="atomic-code-block-code"><br></code></pre>';
      var trailing = document.createElement("p");
      trailing.innerHTML = "<br>";

      var selection = window.getSelection();
      var range = selection && selection.rangeCount
        ? selection.getRangeAt(0)
        : null;
      if (range && editor.contains(range.commonAncestorContainer)) {
        range.collapse(false);
        var node = range.startContainer;
        var top = node && node.nodeType === 3 ? node.parentElement : node;
        while (top && top.parentNode !== editor) top = top.parentNode;
        if (top && top !== editor && top.parentNode === editor) {
          top.after(block);
          block.after(trailing);
        } else {
          editor.appendChild(block);
          editor.appendChild(trailing);
        }
      } else {
        editor.appendChild(block);
        editor.appendChild(trailing);
      }

      var codeElement = block.querySelector("code");
      var caret = document.createRange();
      caret.selectNodeContents(codeElement);
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);
      savedRange = caret.cloneRange();
      notifyChange();
    }

    document.addEventListener("selectionchange", function () {
      saveSelection();
      pushState();
    });

    window.__setHtml = function (html) {
      editor.innerHTML = html;
      normalizeBlocks();
      savedRange = null;
      post("ready", { html: editor.innerHTML });
      pushState();
    };

    window.__cmd = function (name, value) {
      editor.focus();
      var selection = window.getSelection();
      if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      try {
        if (name === "codeBlock") {
          insertCodeBlock();
          return;
        }
        if (name === "formatBlock" && (value === "h2" || value === "blockquote")) {
          toggleBlock(value);
        } else {
          document.execCommand(name, false, value || null);
        }
      } catch (error) {
        /* unsupported command - ignore */
      }
      saveSelection();
      notifyChange();
    };

    editor.addEventListener("input", function () {
      saveSelection();
      notifyChange();
    });

    editor.addEventListener("keydown", function (event) {
      var mod = event.metaKey || event.ctrlKey;
      var key = (event.key || "").toLowerCase();
      if (mod && !event.shiftKey && (key === "b" || key === "i" || key === "u")) {
        event.preventDefault();
        document.execCommand(
          key === "b" ? "bold" : key === "i" ? "italic" : "underline"
        );
        notifyChange();
        return;
      }
      if (mod && key === "q") {
        event.preventDefault();
        toggleBlock("blockquote");
        notifyChange();
        return;
      }
      if (event.altKey && event.shiftKey && key === "h") {
        event.preventDefault();
        toggleBlock("h2");
        notifyChange();
        return;
      }
      if (event.altKey && event.shiftKey && key === "e") {
        event.preventDefault();
        insertCodeBlock();
        return;
      }
      if (event.altKey && event.shiftKey && key === "l") {
        event.preventDefault();
        document.execCommand("insertUnorderedList");
        notifyChange();
        return;
      }
      if (event.altKey && event.shiftKey && key === "n") {
        event.preventDefault();
        document.execCommand("insertOrderedList");
        notifyChange();
      }
    });

    post("ready", { html: "" });
  })();
</script>
</body>
</html>`;
}

const EDITOR_HTML = buildEditorHtml();

export const RichNoteEditor = forwardRef<
  RichNoteEditorHandle,
  RichNoteEditorProps
>(function RichNoteEditor(
  { noteId, html, onChange, onStateChange, fill = false },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const pushedRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useImperativeHandle(
    ref,
    () => ({
      run: (command: string, value?: string) => {
        webRef.current?.injectJavaScript(
          `window.__cmd(${JSON.stringify(command)}, ${JSON.stringify(value ?? null)}); true;`,
        );
      },
    }),
    [],
  );

  useEffect(() => {
    if (!ready) return;
    if (pushedRef.current === noteId) return;
    pushedRef.current = noteId;
    webRef.current?.injectJavaScript(
      `window.__setHtml(${JSON.stringify(sanitizeHtml(html))}); true;`,
    );
  }, [ready, noteId, html]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;
    if (!data) return;
    let parsed: {
      kind?: string;
      html?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      heading?: boolean;
      quote?: boolean;
      unordered?: boolean;
      ordered?: boolean;
      code?: boolean;
    };
    try {
      parsed = JSON.parse(data) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.kind === "ready") {
      setReady(true);
    } else if (parsed.kind === "change" && typeof parsed.html === "string") {
      onChangeRef.current(parsed.html);
    } else if (parsed.kind === "state" && onStateChangeRef.current) {
      onStateChangeRef.current({
        bold: Boolean(parsed.bold),
        italic: Boolean(parsed.italic),
        underline: Boolean(parsed.underline),
        heading: Boolean(parsed.heading),
        quote: Boolean(parsed.quote),
        unordered: Boolean(parsed.unordered),
        ordered: Boolean(parsed.ordered),
        code: Boolean(parsed.code),
      });
    }
  }, []);

  /**
   * The editor only ever loads its own inline document: any other navigation
   * (link taps, injected JS) is blocked. Safe http(s) links are opened
   * externally instead; everything else is silently dropped.
   */
  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url ?? "";
      if (
        url === "" ||
        url.startsWith("about:") ||
        url.startsWith("data:text/html")
      ) {
        return true;
      }
      if (/^https?:\/\//i.test(url)) {
        void Linking.openURL(url).catch(() => undefined);
      }
      return false;
    },
    [],
  );

  return (
    <View style={fill ? styles.fill : styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: EDITOR_HTML }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        style={styles.web}
        containerStyle={styles.webContainer}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        automaticallyAdjustContentInsets={false}
        scrollEnabled
        setBuiltInZoomControls={false}
        overScrollMode="never"
        nestedScrollEnabled
        javaScriptEnabled={true}
        allowsInlineMediaPlayback={false}
        mediaPlaybackRequiresUserAction={true}
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        domStorageEnabled={true}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.lilac} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    height: 340,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
  webContainer: {
    backgroundColor: "transparent",
  },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
