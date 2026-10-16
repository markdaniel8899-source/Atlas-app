import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

interface RichTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

const MATH = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;

const TOKEN =
  /\^\{([^}]*)\}|\^([+\-]?[A-Za-z0-9]+)|_\{([^}]*)\}|_(\d+)|([A-Z)])(\d+)/g;

/** Superscript/subscript fall back to small raised/ lowered glyphs on native. */
const SYMBOLS: [RegExp, string][] = [
  [/(^|[^<])<=/g, "$1\u2264"],
  [/(^|[^>])>=/g, "$1\u2265"],
  [/(^|[^!=])!=(?!=)/g, "$1\u2260"],
  [/\+\/-/g, "\u00B1"],
  [/\bsqrt\b/gi, "\u221A"],
  [/\bpi\b/gi, "\u03C0"],
  [/\binfinity\b/gi, "\u221E"],
];

function applySymbols(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SYMBOLS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function plainNodes(text: string, nextKey: () => string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let match = TOKEN.exec(text);
  while (match) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [full, supBraced, sup, subBraced, sub, base, digits] = match;
    if (full.startsWith("^")) {
      nodes.push(
        <Text key={nextKey()} style={styles.sup}>
          {supBraced ?? sup ?? ""}
        </Text>,
      );
    } else if (full.startsWith("_")) {
      nodes.push(
        <Text key={nextKey()} style={styles.sub}>
          {subBraced ?? sub ?? ""}
        </Text>,
      );
    } else {
      nodes.push(base);
      nodes.push(
        <Text key={nextKey()} style={styles.sub}>
          {digits}
        </Text>,
      );
    }
    last = match.index + full.length;
    match = TOKEN.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function toNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let counter = 0;
  const nextKey = () => `rt${counter++}`;
  let last = 0;
  MATH.lastIndex = 0;
  let match = MATH.exec(text);
  while (match) {
    const tex = match[1] ?? match[2] ?? "";
    if (match.index > last) {
      nodes.push(
        ...plainNodes(applySymbols(text.slice(last, match.index)), nextKey),
      );
    }
    // No KaTeX on device: the TeX body renders through the same symbol /
    // script pipeline, which keeps formulas readable.
    nodes.push(...plainNodes(applySymbols(tex), nextKey));
    last = match.index + match[0].length;
    match = MATH.exec(text);
  }
  if (last < text.length) {
    nodes.push(...plainNodes(applySymbols(text.slice(last)), nextKey));
  }
  return nodes;
}

export const RichText = memo(function RichText({
  text,
  style,
}: RichTextProps) {
  const nodes = useMemo(() => toNodes(text), [text]);
  return <Text style={style}>{nodes}</Text>;
});

const styles = StyleSheet.create({
  sup: {
    fontSize: 10,
    lineHeight: 14,
  },
  sub: {
    fontSize: 10,
    lineHeight: 14,
  },
});
