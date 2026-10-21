import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FileCode2 } from "lucide-react-native";
import { colors, fonts } from "../../theme/theme";

interface CodeBlockProps {
  code: string;
  language?: string;
  caption?: string;
  startLine?: number;
}

export function CodeBlock({
  code,
  language,
  caption,
  startLine = 1,
}: CodeBlockProps) {
  const lines = code.replace(/\n+$/, "").split("\n");

  return (
    <View style={styles.frame}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FileCode2 size={14} color={colors.w45} />
          <Text style={styles.caption}>{caption ?? "Snippet"}</Text>
        </View>
        {language ? (
          <View style={styles.langPill}>
            <Text maxFontSizeMultiplier={1.2} style={styles.langText}>
              {language.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.codePad}>
          {lines.map((line, index) => (
            <View key={startLine + index} style={styles.lineRow}>
              <Text style={styles.lineNo}>{startLine + index}</Text>
              <Text style={styles.lineText}>{line || " "}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.w07,
    backgroundColor: colors.w03,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  caption: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  langPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  langText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 1.6,
    color: colors.w40,
  },
  scroll: {
    maxWidth: "100%",
  },
  codePad: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lineRow: {
    flexDirection: "row",
    gap: 12,
  },
  lineNo: {
    width: 24,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 21,
    fontFamily: fonts.mono,
    color: "rgba(255,255,255,0.25)",
  },
  lineText: {
    fontSize: 12,
    lineHeight: 21,
    fontFamily: fonts.mono,
    color: "rgba(255,255,255,0.85)",
  },
});
