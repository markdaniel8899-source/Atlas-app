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
import {
  CODE_LANGUAGES,
  EDITOR_LANGUAGES,
  LANGUAGE_ALIASES,
} from "../../lib/code-highlight";
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
 * Code blocks mirror the website's atomic-code-block model (`data-code` +
 * `data-language`): each block renders a language chip + Monaco-style
 * token colours, the chip opens a language picker (changing it recolours the
 * block), and raw source is always kept in `data-code` so the note moves
 * between the app and the web without losing anything.
 */
function buildEditorHtml(): string {
  const languagesJson = JSON.stringify(CODE_LANGUAGES);
  const aliasesJson = JSON.stringify(LANGUAGE_ALIASES);
  const pickerJson = JSON.stringify(EDITOR_LANGUAGES);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #editor {
    min-height: 100%;
    padding: 14px 16px 140px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.65;
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
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 12px;
    background: #15151f;
    overflow: hidden;
  }
  #editor .cb-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
  }
  #editor .cb-lang {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(207,158,255,0.28);
    border-radius: 999px;
    background: rgba(207,158,255,0.10);
    color: rgba(207,158,255,0.92);
    padding: 4px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }
  #editor .cb-lang-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #cf9eff;
    box-shadow: 0 0 6px rgba(207,158,255,0.8);
  }
  #editor .cb-chev { font-size: 9px; opacity: 0.7; }
  #editor .cb-ext {
    width: 68px;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.78);
    padding: 4px 7px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10.5px;
    line-height: 1.2;
    outline: none;
  }
  #editor .cb-ext:focus {
    border-color: rgba(207,158,255,0.55);
    background: rgba(207,158,255,0.08);
    color: #fff;
  }
  #editor .cb-ext.invalid { border-color: rgba(244,71,71,0.55); }
  #editor .cb-ext::placeholder {
    color: rgba(255,255,255,0.28);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  #editor .cb-spacer { flex: 1; }
  #editor .cb-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255,255,255,0.42);
    padding: 0;
    touch-action: manipulation;
  }
  #editor .cb-icon svg { display: block; pointer-events: none; }
  #editor .cb-icon.copied { color: #6ee7a8; }
  #editor .cb-icon-danger { color: rgba(255,255,255,0.38); }
  #editor .cb-icon-danger:active { color: #f87171; background: rgba(248,113,113,0.10); }
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
    background: #101018;
  }
  #editor .atomic-code-block-code {
    display: block;
    min-height: 20px;
    font-family: inherit;
    background: none;
    padding: 0;
    color: inherit;
    outline: none;
    caret-color: #cf9eff;
    white-space: pre-wrap;
    word-break: break-word;
    tab-size: 2;
  }
  #editor pre:not(.atomic-code-block-pre) {
    margin: 12px 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: #101018;
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
  .cb-menu {
    position: fixed;
    z-index: 9999;
    width: 190px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: #12121d;
    box-shadow: 0 18px 40px rgba(0,0,0,0.65);
    padding: 4px;
    -webkit-overflow-scrolling: touch;
  }
  .cb-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgba(255,255,255,0.72);
    text-align: left;
    padding: 8px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
  }
  .cb-menu-item.active {
    background: rgba(207,158,255,0.14);
    color: #cf9eff;
  }
</style>
</head>
<body>
<div id="editor" contenteditable="true" spellcheck="true" aria-label="Note content"></div>
<script>
  (function () {
    var editor = document.getElementById("editor");
    var savedRange = null;
    var LANGS = ${languagesJson};
    var ALIASES = ${aliasesJson};
    var PICKER = ${pickerJson};
    var LANG_BY_ID = {};
    for (var l = 0; l < LANGS.length; l += 1) LANG_BY_ID[LANGS[l].id] = LANGS[l];

    var COPY_ICON =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var CHECK_ICON =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var CLOSE_ICON =
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

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

    function readCode(element) {
      if (!element) return "";
      var text = element.innerText;
      return typeof text === "string" ? text : element.textContent || "";
    }

    // A zero-width marker maps a range onto the flattened code string, so
    // live re-highlighting can restore the caret exactly (even across the
    // <div>/<br> line breaks soft keyboards insert).
    function captureRangeText(root, range) {
      if (!range || !root.contains(range.startContainer)) return null;
      var marker = document.createTextNode("\\uFEFF");
      var probe = range.cloneRange();
      probe.collapse(true);
      probe.insertNode(marker);
      var code = readCode(root);
      var offset = code.indexOf("\\uFEFF");
      if (marker.parentNode) marker.parentNode.removeChild(marker);
      if (offset < 0) return null;
      return {
        code: code.slice(0, offset) + code.slice(offset + 1),
        offset: offset
      };
    }

    function captureLiveCode(root) {
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      var range = selection.getRangeAt(0);
      if (!range.collapsed) return null;
      return captureRangeText(root, range);
    }

    function rangeAtOffset(root, offset) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var remaining = offset;
      var node = walker.nextNode();
      while (node) {
        var length = node.nodeValue ? node.nodeValue.length : 0;
        if (remaining <= length) {
          var range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          return range;
        }
        remaining -= length;
        node = walker.nextNode();
      }
      var end = document.createRange();
      end.selectNodeContents(root);
      end.collapse(false);
      return end;
    }

    function placeCaret(root, offset) {
      var range = rangeAtOffset(root, offset);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    /** Resolve the code element from the event target or the live selection. */
    function codeElementFromEvent(event) {
      var target = event && event.target;
      if (target && target.classList) {
        if (target.classList.contains("atomic-code-block-code")) return target;
        if (target.closest) {
          var block = target.closest(".atomic-code-block");
          if (block) return block.querySelector("code");
        }
      }
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      var node = selection.getRangeAt(0).startContainer;
      var element = node && node.nodeType === 3 ? node.parentElement : node;
      return element && element.closest
        ? element.closest(".atomic-code-block-code")
        : null;
    }

    var liveTimer = null;

    function liveHighlight(codeElement) {
      var block = codeElement.closest(".atomic-code-block");
      if (!block || !editor.contains(codeElement)) return;
      var captured = captureLiveCode(codeElement);
      if (!captured) return;
      block.setAttribute("data-code", captured.code);
      var language = normalizeLanguage(
        block.getAttribute("data-language") || "javascript"
      );
      codeElement.innerHTML = captured.code
        ? highlight(captured.code, language)
        : "<br>";
      placeCaret(codeElement, captured.offset);
    }

    function scheduleLiveHighlight(codeElement) {
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(function () {
        liveTimer = null;
        liveHighlight(codeElement);
      }, 120);
    }

    /** Re-colour a block from its raw text (no caret bookkeeping). */
    function refreshCode(block) {
      var codeElement = block.querySelector("code");
      if (!codeElement) return;
      var code = readCode(codeElement);
      block.setAttribute("data-code", code);
      var language = normalizeLanguage(
        block.getAttribute("data-language") || "javascript"
      );
      codeElement.innerHTML = code ? highlight(code, language) : "<br>";
    }

    function normalizeLanguage(input) {
      if (!input) return "plaintext";
      var raw = String(input).trim().toLowerCase().replace(/^\\./, "");
      if (!raw) return "plaintext";
      var id = ALIASES[raw] || raw;
      return LANG_BY_ID[id] ? id : "plaintext";
    }

    function languageLabel(id) {
      return LANG_BY_ID[id] ? LANG_BY_ID[id].label : "Plain Text";
    }

    var EXT_BY_ID = {};
    for (var p = 0; p < PICKER.length; p += 1) {
      EXT_BY_ID[PICKER[p].id] = PICKER[p].extension || ".txt";
    }

    function resolveLanguageInput(input) {
      if (!input) return null;
      var raw = String(input).trim().toLowerCase().replace(/^\\./, "");
      if (!raw) return null;
      var id = ALIASES[raw] || raw;
      return LANG_BY_ID[id] ? id : null;
    }

    function extensionForLanguage(id) {
      return String(EXT_BY_ID[id] || ".txt").replace(/^\\./, "");
    }

    function span(kind, text) {
      if (!text) return "";
      var escaped = escapeHtml(text);
      return kind ? '<span class="cb-tok-' + kind + '">' + escaped + "</span>" : escaped;
    }

    function scanString(code, start) {
      var quote = code[start];
      var multiline = quote === "\\u0060";
      var index = start + 1;
      while (index < code.length) {
        var char = code[index];
        if (char === "\\\\") { index += 2; continue; }
        if (char === quote) { index += 1; break; }
        if (!multiline && char === "\\n") break;
        index += 1;
      }
      return Math.min(index, code.length);
    }

    function scanNumber(code, start) {
      var index = start;
      if (code[index] === "0" && /[xXbBoO]/.test(code[index + 1] || "")) {
        index += 2;
        while (index < code.length && /[0-9a-fA-F_]/.test(code[index])) index += 1;
        return index;
      }
      while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
      if (code[index] === ".") {
        index += 1;
        while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
      }
      if (/[eE]/.test(code[index] || "")) {
        index += 1;
        if (/[+-]/.test(code[index] || "")) index += 1;
        while (index < code.length && /[0-9_]/.test(code[index])) index += 1;
      }
      while (index < code.length && /[a-zA-Z]/.test(code[index])) index += 1;
      return index;
    }

    function highlightGeneric(code, def) {
      var keywords = {};
      var constants = {};
      var i;
      for (i = 0; i < def.keywords.length; i += 1) keywords[def.keywords[i].toLowerCase()] = true;
      for (i = 0; i < def.constants.length; i += 1) constants[def.constants[i].toLowerCase()] = true;
      var quotes = {};
      for (i = 0; i < def.quotes.length; i += 1) quotes[def.quotes[i]] = true;
      var out = "";
      var index = 0;

      while (index < code.length) {
        var char = code[index];

        if (def.blockComment && code.startsWith(def.blockComment[0], index)) {
          var closeAt = code.indexOf(def.blockComment[1], index + def.blockComment[0].length);
          var blockEnd = closeAt < 0 ? code.length : closeAt + def.blockComment[1].length;
          out += span("comment", code.slice(index, blockEnd));
          index = blockEnd;
          continue;
        }

        var lineToken = null;
        for (i = 0; i < def.lineComments.length; i += 1) {
          if (code.startsWith(def.lineComments[i], index)) { lineToken = def.lineComments[i]; break; }
        }
        if (lineToken) {
          var newline = code.indexOf("\\n", index);
          var lineEnd = newline < 0 ? code.length : newline;
          out += span("comment", code.slice(index, lineEnd));
          index = lineEnd;
          continue;
        }

        if (quotes[char]) {
          var strEnd = scanString(code, index);
          out += span("string", code.slice(index, strEnd));
          index = strEnd;
          continue;
        }

        if (/[0-9]/.test(char) && !/[A-Za-z0-9_$#@-]/.test(code[index - 1] || "")) {
          var numEnd = scanNumber(code, index);
          out += span("number", code.slice(index, numEnd));
          index = numEnd;
          continue;
        }

        if (/[A-Za-z_$#@]/.test(char)) {
          var wordEnd = index + 1;
          while (wordEnd < code.length && /[A-Za-z0-9_$#@-]/.test(code[wordEnd])) wordEnd += 1;
          var word = code.slice(index, wordEnd);
          var lower = word.toLowerCase();
          var look = wordEnd;
          while (look < code.length && (code[look] === " " || code[look] === "\\t")) look += 1;

          var kind = null;
          if (keywords[lower]) kind = "keyword";
          else if (constants[lower]) kind = "constant";
          else if (code[look] === "(") kind = "function";
          else if (def.propertySyntax && code[look] === ":") kind = "attribute";
          else if (/^[A-Z]/.test(word) && word.length > 1) kind = "type";

          out += span(kind, word);
          index = wordEnd;
          continue;
        }

        if (/[=+\\-*\\/%<>!&|^~?:;,.()[\\]{}]/.test(char)) {
          out += span("operator", char);
          index += 1;
          continue;
        }

        out += escapeHtml(char);
        index += 1;
      }

      return out;
    }

    function highlightHtml(code) {
      var out = "";
      var index = 0;
      while (index < code.length) {
        if (code.startsWith("<!--", index)) {
          var close = code.indexOf("-->", index + 4);
          var commentEnd = close < 0 ? code.length : close + 3;
          out += span("comment", code.slice(index, commentEnd));
          index = commentEnd;
          continue;
        }
        var char = code[index];
        if (char === "<" && /[A-Za-z!\\/]/.test(code[index + 1] || "")) {
          var cursor = index + 1;
          if (code[cursor] === "/") cursor += 1;
          var nameStart = cursor;
          while (cursor < code.length && /[A-Za-z0-9:-]/.test(code[cursor])) cursor += 1;
          out += span("tag", code.slice(index, cursor));
          if (cursor === nameStart) {
            out += escapeHtml(code.slice(index, cursor + 1));
            index = cursor + 1;
            continue;
          }
          while (cursor < code.length && code[cursor] !== ">") {
            var inner = code[cursor];
            if (inner === '"' || inner === "'") {
              var attrEnd = scanString(code, cursor);
              out += span("string", code.slice(cursor, attrEnd));
              cursor = attrEnd;
              continue;
            }
            if (/[A-Za-z_:@-]/.test(inner)) {
              var attrStart = cursor;
              cursor += 1;
              while (cursor < code.length && /[A-Za-z0-9_:@.-]/.test(code[cursor])) cursor += 1;
              out += span("attribute", code.slice(attrStart, cursor));
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
        var textEnd = index + 1;
        while (textEnd < code.length && code[textEnd] !== "<") textEnd += 1;
        out += escapeHtml(code.slice(index, textEnd));
        index = textEnd;
      }
      return out;
    }

    function highlightJson(code) {
      var out = "";
      var index = 0;
      while (index < code.length) {
        var char = code[index];
        if (char === '"') {
          var strEnd = scanString(code, index);
          var look = strEnd;
          while (look < code.length && (code[look] === " " || code[look] === "\\t")) look += 1;
          out += span(code[look] === ":" ? "attribute" : "string", code.slice(index, strEnd));
          index = strEnd;
          continue;
        }
        if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(code[index + 1] || ""))) {
          var numEnd = scanNumber(code, index);
          out += span("number", code.slice(index, numEnd));
          index = numEnd;
          continue;
        }
        if (/[A-Za-z]/.test(char)) {
          var wordEnd = index + 1;
          while (wordEnd < code.length && /[A-Za-z]/.test(code[wordEnd])) wordEnd += 1;
          var word = code.slice(index, wordEnd);
          out += span(/^(true|false|null)$/i.test(word) ? "constant" : null, word);
          index = wordEnd;
          continue;
        }
        out += escapeHtml(char);
        index += 1;
      }
      return out;
    }

    function highlight(code, language) {
      var def = LANG_BY_ID[normalizeLanguage(language)] || LANG_BY_ID["plaintext"];
      if (def.id === "plaintext") return escapeHtml(code);
      if (def.mode === "html") return highlightHtml(code);
      if (def.mode === "json") return highlightJson(code);
      if (def.mode === "css") return highlightGeneric(code, def);
      return highlightGeneric(code, def);
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

    var langMenu = null;
    var activeBlockId = null;

    function findBlockById(id) {
      if (!id) return null;
      var blocks = editor.querySelectorAll(".atomic-code-block");
      for (var index = 0; index < blocks.length; index += 1) {
        if (blocks[index].getAttribute("data-code-block-id") === id) {
          return blocks[index];
        }
      }
      return null;
    }

    function closeLanguageMenu() {
      if (langMenu && langMenu.parentNode) {
        langMenu.parentNode.removeChild(langMenu);
      }
      langMenu = null;
      activeBlockId = null;
    }

    function openLanguageMenu(button, block) {
      closeLanguageMenu();
      activeBlockId = block.getAttribute("data-code-block-id");
      var rect = button.getBoundingClientRect();
      var current = normalizeLanguage(block.getAttribute("data-language"));

      var menu = document.createElement("div");
      menu.className = "cb-menu";
      menu.setAttribute("contenteditable", "false");

      for (var index = 0; index < PICKER.length; index += 1) {
        var option = PICKER[index];
        var item = document.createElement("button");
        item.type = "button";
        item.className =
          "cb-menu-item" + (option.id === current ? " active" : "");
        item.setAttribute("data-language", option.id);
        item.textContent = option.label;
        menu.appendChild(item);
      }

      document.body.appendChild(menu);
      var width = 190;
      var left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      var top = rect.bottom + 6;
      var available = window.innerHeight - top - 12;
      if (available < 150) {
        top = Math.max(8, rect.top - 266);
        available = 260;
      }
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.style.width = width + "px";
      menu.style.maxHeight = Math.min(260, available) + "px";

      langMenu = menu;
    }

    /** Rebuild a code block's editable view from its raw data-code value. */
    function renderBlock(block) {
      var raw = block.getAttribute("data-code");
      var codeElement = block.querySelector("code");
      var code = raw != null ? raw : readCode(codeElement);
      var language = normalizeLanguage(block.getAttribute("data-language") || "javascript");
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
        '<div class="cb-head" contenteditable="false">' +
          '<button type="button" class="cb-lang" data-action="lang" aria-label="Code language">' +
            '<span class="cb-lang-dot"></span>' +
            '<span class="cb-lang-label">' + escapeHtml(languageLabel(language)) + '</span>' +
            '<span class="cb-chev">\\u25BE</span>' +
          '</button>' +
          '<input type="text" class="cb-ext" data-action="ext" value="' +
            escapeHtml(extensionForLanguage(language)) +
            '" placeholder="js, py, sql" aria-label="File extension" ' +
            'spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" />' +
          '<span class="cb-spacer"></span>' +
          '<button type="button" class="cb-icon" data-action="copy" aria-label="Copy code">' +
            COPY_ICON +
          '</button>' +
          '<button type="button" class="cb-icon cb-icon-danger" data-action="remove" aria-label="Remove code block">' +
            CLOSE_ICON +
          '</button>' +
        '</div>' +
        '<pre class="atomic-code-block-pre"><code class="atomic-code-block-code" contenteditable="true" spellcheck="false" autocorrect="off" autocapitalize="off">' +
        (code ? highlight(code, language) : "<br>") +
        "</code></pre>";
    }

    /** Swap a block's language in place (header + caret stay mounted). */
    function applyBlockLanguage(block, language) {
      block.setAttribute("data-language", language);
      var label = block.querySelector(".cb-lang-label");
      if (label) label.textContent = languageLabel(language);
      var extInput = block.querySelector(".cb-ext");
      if (extInput) extInput.value = extensionForLanguage(language);
      var codeElement = block.querySelector("code");
      if (!codeElement) return;
      var captured = captureLiveCode(codeElement);
      var code = captured ? captured.code : block.getAttribute("data-code") || "";
      block.setAttribute("data-code", code);
      codeElement.innerHTML = code ? highlight(code, language) : "<br>";
      if (captured) placeCaret(codeElement, captured.offset);
    }

    function handleExtensionInput(input) {
      var block = input.closest(".atomic-code-block");
      if (!block) return;
      var resolved = resolveLanguageInput(input.value);
      var invalid = input.value.trim() !== "" && !resolved;
      if (invalid) input.classList.add("invalid");
      else input.classList.remove("invalid");
      if (!resolved) return;
      if (resolved === normalizeLanguage(block.getAttribute("data-language"))) {
        return;
      }
      applyBlockLanguage(block, resolved);
      notifyChange();
    }

    function copyCode(block, button) {
      var text = block.getAttribute("data-code");
      if (text == null) {
        text = readCode(block.querySelector("code"));
      }
      var done = function (ok) {
        button.innerHTML = ok ? CHECK_ICON : COPY_ICON;
        button.classList.add("copied");
        setTimeout(function () {
          button.innerHTML = COPY_ICON;
          button.classList.remove("copied");
        }, 1200);
      };
      var active = document.activeElement;
      var copied = legacyCopy(text);
      if (!copied) {
        var attempt = null;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            attempt = navigator.clipboard.writeText(text);
          }
        } catch (error) {
          attempt = null;
        }
        if (attempt && typeof attempt.then === "function") {
          attempt.then(function () {
            done(true);
          }, function () {
            done(false);
          });
          return;
        }
      }
      done(copied);
      if (active && active.focus && active !== document.activeElement) {
        try {
          active.focus();
        } catch (error) {
          /* focus restore is best-effort */
        }
      }
    }

    function legacyCopy(text) {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        return Boolean(ok);
      } catch (error) {
        return false;
      }
    }

    function removeCodeBlock(block) {
      closeLanguageMenu();
      var next = block.nextElementSibling;
      if (block.parentNode) block.parentNode.removeChild(block);
      var selection = window.getSelection();
      var range = document.createRange();
      if (next && next.parentNode === editor) {
        range.selectNodeContents(next);
        range.collapse(true);
      } else {
        var trailing = document.createElement("p");
        trailing.innerHTML = "<br>";
        editor.appendChild(trailing);
        range.selectNodeContents(trailing);
        range.collapse(true);
      }
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editor.focus();
      notifyChange();
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
        block.setAttribute("data-code", readCode(codeElement));
        if (!block.getAttribute("data-language")) {
          block.setAttribute("data-language", "plaintext");
        }
      }
    }

    /** Strip editor-only chrome (language header) from the saved HTML. */
    function serializeHtml() {
      syncBlocks();
      if (!editor.querySelector(".cb-head")) return editor.innerHTML;
      var clone = editor.cloneNode(true);
      var heads = clone.querySelectorAll(".cb-head");
      for (var index = 0; index < heads.length; index += 1) {
        if (heads[index].parentNode) heads[index].parentNode.removeChild(heads[index]);
      }
      return clone.innerHTML;
    }

    function notifyChange() {
      post("change", { html: serializeHtml() });
      pushState();
      scheduleHistory();
    }

    // Live re-highlighting rewrites code innerHTML, which clears the browser's
    // native undo stack. Keep our own document history so Undo/Redo (toolbar
    // and Ctrl/Cmd+Z) always works.
    var history = [];
    var historyIndex = -1;
    var historyTimer = null;
    var restoringHistory = false;

    function pushHistory() {
      if (restoringHistory) return;
      var html = serializeHtml();
      if (historyIndex >= 0 && history[historyIndex] === html) return;
      history = history.slice(0, historyIndex + 1);
      history.push(html);
      if (history.length > 60) history = history.slice(history.length - 60);
      historyIndex = history.length - 1;
    }

    function scheduleHistory() {
      if (restoringHistory) return;
      if (historyTimer) clearTimeout(historyTimer);
      historyTimer = setTimeout(function () {
        historyTimer = null;
        pushHistory();
      }, 650);
    }

    function applyHistory(direction) {
      if (historyTimer) {
        clearTimeout(historyTimer);
        historyTimer = null;
      }
      pushHistory();
      var next = historyIndex + direction;
      if (next < 0 || next >= history.length) return false;
      historyIndex = next;
      restoringHistory = true;
      editor.innerHTML = history[historyIndex];
      normalizeBlocks();
      savedRange = null;
      notifyChange();
      restoringHistory = false;
      return true;
    }

    function undo() {
      return applyHistory(-1);
    }

    function redo() {
      return applyHistory(1);
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
      block.setAttribute("data-language", "javascript");
      block.setAttribute("data-code", "");
      renderBlock(block);

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
        } else {
          editor.appendChild(block);
        }
      } else {
        editor.appendChild(block);
      }
      if (!block.nextElementSibling) block.after(trailing);

      var codeElement = block.querySelector("code");
      if (codeElement) {
        var caret = document.createRange();
        caret.selectNodeContents(codeElement);
        caret.collapse(true);
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(caret);
        }
        codeElement.focus();
        savedRange = caret.cloneRange();
      }
      notifyChange();
    }

    document.addEventListener("selectionchange", function () {
      var active = document.activeElement;
      if (active && active.classList && active.classList.contains("cb-ext")) {
        return;
      }
      saveSelection();
      pushState();
    });

    // Header controls run before focus moves (focusout would otherwise
    // swallow the tap).
    editor.addEventListener("pointerdown", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var button = target.closest('[data-action="lang"]');
      if (button) {
        event.preventDefault();
        var block = button.closest(".atomic-code-block");
        if (block) openLanguageMenu(button, block);
        return;
      }
      var copyButton = target.closest('[data-action="copy"]');
      if (copyButton) {
        event.preventDefault();
        var copyBlock = copyButton.closest(".atomic-code-block");
        if (copyBlock) copyCode(copyBlock, copyButton);
        return;
      }
      var removeButton = target.closest('[data-action="remove"]');
      if (removeButton) {
        event.preventDefault();
        var removeBlock = removeButton.closest(".atomic-code-block");
        if (removeBlock) removeCodeBlock(removeBlock);
      }
    }, true);

    document.addEventListener("pointerdown", function (event) {
      if (!langMenu) return;
      var target = event.target;
      var item = target && target.closest ? target.closest(".cb-menu-item") : null;
      if (item) {
        event.preventDefault();
        var block = findBlockById(activeBlockId);
        var language = normalizeLanguage(item.getAttribute("data-language"));
        if (block) {
          var codeElement = block.querySelector("code");
          block.setAttribute("data-code", readCode(codeElement));
          applyBlockLanguage(block, language);
          notifyChange();
        }
        closeLanguageMenu();
        return;
      }
      if (target && target.closest && !target.closest(".cb-menu")) {
        closeLanguageMenu();
      }
    }, true);

    window.addEventListener("scroll", closeLanguageMenu, true);

    window.__setHtml = function (html) {
      editor.innerHTML = html;
      normalizeBlocks();
      savedRange = null;
      history = [];
      historyIndex = -1;
      if (historyTimer) {
        clearTimeout(historyTimer);
        historyTimer = null;
      }
      pushHistory();
      post("ready", { html: editor.innerHTML });
      pushState();
    };

    window.__cmd = function (name, value) {
      if (name === "undo" || name === "redo") {
        if (name === "undo") undo();
        else redo();
        return;
      }
      if (historyTimer) {
        clearTimeout(historyTimer);
        historyTimer = null;
      }
      pushHistory();
      editor.focus();
      var selection = window.getSelection();
      if (savedRange && editor.contains(savedRange.startContainer)) {
        try {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        } catch (error) {
          /* stale range - use the current selection */
        }
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

    editor.addEventListener("compositionend", function (event) {
      var target = event.target;
      if (target && target.classList &&
          target.classList.contains("atomic-code-block-code")) {
        scheduleLiveHighlight(target);
      }
    }, true);

    editor.addEventListener("input", function (event) {
      var target = event.target;
      if (target && target.classList && target.classList.contains("cb-ext")) {
        handleExtensionInput(target);
        return;
      }
      saveSelection();
      var codeElement = codeElementFromEvent(event);
      if (codeElement) scheduleLiveHighlight(codeElement);
      notifyChange();
    });

    // Colour a block that was saved before live highlighting existed as soon
    // as the user taps into it.
    editor.addEventListener("focusin", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var codeElement = target.closest(".atomic-code-block-code");
      if (!codeElement) return;
      var block = codeElement.closest(".atomic-code-block");
      if (!block) return;
      var language = normalizeLanguage(block.getAttribute("data-language"));
      if (language === "plaintext") return;
      if (codeElement.querySelector("span[class^='cb-tok-']")) return;
      refreshCode(block);
    }, true);

    // Flush token colours when the caret leaves a code block. The raw text is
    // captured through the saved range so the next toolbar command still
    // works even though the innerHTML is rebuilt.
    editor.addEventListener("focusout", function (event) {
      var target = event.target;
      if (!target || !target.classList) return;
      if (target.classList.contains("cb-ext")) {
        var extBlock = target.closest(".atomic-code-block");
        if (extBlock) {
          var extLanguage = normalizeLanguage(
            extBlock.getAttribute("data-language")
          );
          target.value = extensionForLanguage(extLanguage);
          target.classList.remove("invalid");
        }
        return;
      }
      if (!target.classList.contains("atomic-code-block-code")) return;
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
      var block = target.closest(".atomic-code-block");
      if (!block) return;
      var codeElement = block.querySelector("code");
      if (!codeElement) return;
      var captured = captureRangeText(codeElement, savedRange);
      var code = captured ? captured.code : readCode(codeElement);
      block.setAttribute("data-code", code);
      var language = normalizeLanguage(
        block.getAttribute("data-language") || "javascript"
      );
      codeElement.innerHTML = code ? highlight(code, language) : "<br>";
      savedRange = rangeAtOffset(
        codeElement,
        captured ? captured.offset : code.length
      );
      notifyChange();
    }, true);

    editor.addEventListener("keydown", function (event) {
      var target = event.target;
      if (target && target.classList && target.classList.contains("cb-ext")) {
        if (event.key === "Enter") {
          event.preventDefault();
          target.blur();
        }
        return;
      }
      var mod = event.metaKey || event.ctrlKey;
      var key = (event.key || "").toLowerCase();
      if (mod && !event.shiftKey && key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
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
