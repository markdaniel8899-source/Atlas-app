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
        '</div>' +
        '<pre class="atomic-code-block-pre"><code class="atomic-code-block-code" contenteditable="true" spellcheck="false" autocorrect="off" autocapitalize="off">' +
        (code ? highlight(code, language) : "<br>") +
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
      saveSelection();
      pushState();
    });

    // Language chip: open the picker before focus moves (focusout re-renders
    // the block, which would otherwise swallow the click).
    editor.addEventListener("pointerdown", function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('[data-action="lang"]') : null;
      if (!button) return;
      event.preventDefault();
      var block = button.closest(".atomic-code-block");
      if (block) openLanguageMenu(button, block);
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
          block.setAttribute("data-language", language);
          renderBlock(block);
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

    // Refresh token colours after editing code (never during typing, so the
    // caret is not disturbed).
    editor.addEventListener("focusout", function (event) {
      var codeElement = event.target;
      if (!codeElement || !codeElement.classList ||
          !codeElement.classList.contains("atomic-code-block-code")) {
        return;
      }
      var block = codeElement.closest(".atomic-code-block");
      if (!block) return;
      syncBlocks();
      renderBlock(block);
      notifyChange();
    }, true);

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
