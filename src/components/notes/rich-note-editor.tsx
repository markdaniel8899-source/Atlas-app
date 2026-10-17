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
}

/**
 * Same contract as the web contentEditable editor: the note body is stored
 * as HTML and edited inline. A hidden membership in the page keeps the last
 * selection so toolbar taps (which blur the WebView) still format the right
 * range - the same approach native rich editors use.
 */
const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #editor {
    min-height: 300px;
    padding: 20px 24px 48px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.625;
    color: rgba(255,255,255,0.7);
    outline: none;
    word-wrap: break-word;
    -webkit-user-select: text;
    user-select: text;
  }
  #editor h2 { margin: 16px 0 8px; font-size: 20px; line-height: 1.3; font-weight: 600; color: #fff; }
  #editor blockquote {
    margin: 8px 0;
    border-left: 2px solid rgba(157,180,255,0.5);
    padding-left: 16px;
    color: rgba(255,255,255,0.5);
  }
  #editor ul { list-style: disc; padding-left: 20px; margin: 8px 0; }
  #editor ol { list-style: decimal; padding-left: 20px; margin: 8px 0; }
  #editor li { margin: 4px 0; }
  #editor p { margin: 8px 0; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" spellcheck="true" aria-label="Note content"></div>
<script>
  (function () {
    var editor = document.getElementById("editor");
    var savedRange = null;

    function post(kind, html) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ kind: kind, html: html })
        );
      }
    }

    function saveSelection() {
      var selection = window.getSelection();
      if (selection && selection.rangeCount > 0 &&
          editor.contains(selection.anchorNode)) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
    }

    function notifyChange() {
      post("change", editor.innerHTML);
    }

    document.addEventListener("selectionchange", saveSelection);

    window.__setHtml = function (html) {
      editor.innerHTML = html;
      savedRange = null;
      post("ready", editor.innerHTML);
    };

    window.__cmd = function (name, value) {
      editor.focus();
      var selection = window.getSelection();
      if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      try {
        document.execCommand(name, false, value || null);
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

    post("ready", "");
  })();
</script>
</body>
</html>`;

export const RichNoteEditor = forwardRef<
  RichNoteEditorHandle,
  RichNoteEditorProps
>(function RichNoteEditor({ noteId, html, onChange }, ref) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const pushedRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    let parsed: { kind?: string; html?: string };
    try {
      parsed = JSON.parse(data) as { kind?: string; html?: string };
    } catch {
      return;
    }
    if (parsed.kind === "ready") {
      setReady(true);
    } else if (parsed.kind === "change" && typeof parsed.html === "string") {
      onChangeRef.current(parsed.html);
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
    <View style={styles.wrap}>
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
