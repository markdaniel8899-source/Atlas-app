import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CodeBlock } from "./code-block";
import { CodeInput } from "./code-input";
import { MarkdownInput } from "./markdown-input";
import { RichText } from "./rich-text";
import type { QuizQuestion } from "../../lib/ai";
import type { QuizAnswer } from "../../lib/quiz";
import { colors, fonts } from "../../theme/theme";

interface QuestionInputProps {
  question: QuizQuestion;
  answer: QuizAnswer;
  onChange: (answer: QuizAnswer) => void;
  disabled?: boolean;
}

function Legend({ children }: { children: string }) {
  return <Text style={styles.legend}>{children}</Text>;
}

export function QuestionInput({
  question,
  answer,
  onChange,
  disabled = false,
}: QuestionInputProps) {
  if (question.kind === "mcq") {
    const chosen = typeof answer === "number" ? answer : null;
    return (
      <View accessibilityRole="radiogroup" style={styles.mcqList}>
        {question.options.map((option, index) => {
          const active = chosen === index;
          return (
            <Pressable
              key={`${index}-${option.slice(0, 16)}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(index)}
              style={({ pressed }) => [
                styles.mcqOption,
                active && styles.mcqOptionActive,
                pressed && !disabled && styles.mcqOptionPressed,
                disabled && styles.disabled,
              ]}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.mcqOptionText}>
                <RichText
                  text={option}
                  style={[styles.optionText, active && styles.optionTextActive]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (question.kind === "code") {
    return (
      <View>
        <Legend>
          {question.language
            ? `Your solution - ${question.language}`
            : "Your solution"}
        </Legend>
        <CodeInput
          value={String(answer ?? "")}
          onChange={onChange}
          language={question.language || "plaintext"}
          height={320}
          disabled={disabled}
        />
      </View>
    );
  }

  if (question.kind === "debug") {
    const raw = String(answer ?? "");
    const split = raw.indexOf("\n");
    const lineText = split === -1 ? raw : raw.slice(0, split);
    const fixText = split === -1 ? "" : raw.slice(split + 1);

    return (
      <View style={styles.debugWrap}>
        <View>
          <Legend>Buggy code</Legend>
          <CodeBlock
            code={question.code}
            language={question.language}
            caption="Find the problem"
          />
        </View>
        <View style={styles.debugRow}>
          <View style={styles.debugLineCol}>
            <Legend>Line number</Legend>
            <TextInput
              value={lineText}
              onChangeText={(next) => onChange(`${next}\n${fixText}`)}
              editable={!disabled}
              keyboardType="number-pad"
              placeholder={
                question.buggy_line ? String(question.buggy_line) : "1"
              }
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={[styles.lineInput, disabled && styles.disabled]}
            />
          </View>
          <View style={styles.debugFixCol}>
            <Legend>The fix</Legend>
            <CodeInput
              value={fixText}
              onChange={(next) => onChange(`${lineText}\n${next}`)}
              language={question.language || "plaintext"}
              height={120}
              disabled={disabled}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.debugWrap}>
      <View>
        <Legend>Code under test</Legend>
        <CodeBlock
          code={question.code}
          language={question.language}
          caption="What does this print?"
        />
      </View>
      <View>
        <Legend>Predicted output</Legend>
        <MarkdownInput
          value={String(answer ?? "")}
          onChange={onChange}
          height={140}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    marginBottom: 8,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  mcqList: {
    gap: 8,
  },
  mcqOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mcqOptionActive: {
    borderColor: "rgba(207,158,255,0.5)",
    backgroundColor: "rgba(207,158,255,0.07)",
  },
  mcqOptionPressed: {
    borderColor: "rgba(207,158,255,0.35)",
    backgroundColor: colors.w05,
  },
  disabled: {
    opacity: 0.6,
  },
  radio: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w30,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.lilac,
    backgroundColor: "rgba(207,158,255,0.2)",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.lilac,
  },
  mcqOptionText: {
    flex: 1,
    minWidth: 0,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.w70,
  },
  optionTextActive: {
    color: colors.white,
  },
  debugWrap: {
    gap: 16,
  },
  debugRow: {
    flexDirection: "row",
    gap: 16,
  },
  debugLineCol: {
    width: 110,
  },
  debugFixCol: {
    flex: 1,
    minWidth: 0,
  },
  lineInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.mono,
    color: colors.white,
  },
});
