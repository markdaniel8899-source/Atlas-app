import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react-native";
import { CodeBlock } from "./code-block";
import { RichText } from "./rich-text";
import { KIND_ICON } from "./icons";
import { Card } from "../ui/card";
import type { QuizAttempt, QuizSummary } from "../../lib/quiz";
import { KIND_LABEL } from "../../lib/quiz";
import { colors, fonts } from "../../theme/theme";

interface QuizResultsProps {
  summary: QuizSummary;
  attempts: QuizAttempt[];
  topic: string;
  xpStatus: "saving" | "saved" | "failed";
  onRetry: () => void;
  onNewQuiz: () => void;
}

function verdict(percent: number): string {
  if (percent >= 90) return "Outstanding command of the topic.";
  if (percent >= 70) return "Solid - a few rough edges left.";
  if (percent >= 50) return "Halfway there. Review the misses below.";
  return "Tough set. Walk the feedback and go again.";
}

export function QuizResults({
  summary,
  attempts,
  topic,
  xpStatus,
  onRetry,
  onNewQuiz,
}: QuizResultsProps) {
  const circumference = 2 * Math.PI * 56;
  const offset = circumference * (1 - summary.percent / 100);
  const xpLabel =
    xpStatus === "saved"
      ? `${summary.xp} XP earned`
      : xpStatus === "saving"
        ? `${summary.xp} XP pending`
        : `${summary.xp} XP not recorded`;

  return (
    <View style={styles.wrap}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.ringWrap}>
            <Svg
              width={160}
              height={160}
              viewBox="0 0 128 128"
              style={styles.ring}
            >
              <SvgCircle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <SvgCircle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke={colors.lilac}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.ringPercent}>{summary.percent}%</Text>
              <Text style={styles.ringLabel}>score</Text>
            </View>
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.eyebrow}>Quiz complete</Text>
            <Text style={styles.headline}>
              {summary.correct} / {summary.total} correct
            </Text>
            <Text style={styles.verdict}>
              {topic} - {verdict(summary.percent)}
            </Text>

            <View style={styles.pillRow}>
              <View style={styles.xpPill}>
                <Sparkles size={14} color={colors.lilac} />
                <Text style={styles.xpPillText}>{xpLabel}</Text>
              </View>
              <View style={styles.questionsPill}>
                <Trophy size={14} color={colors.w50} />
                <Text style={styles.questionsPillText}>
                  {summary.total} questions
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.retakeButton,
                  pressed && styles.pressed,
                ]}
              >
                <RotateCcw size={16} color={colors.primaryText} />
                <Text style={styles.retakeText}>Retake this quiz</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onNewQuiz}
                style={({ pressed }) => [
                  styles.newQuizButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.newQuizText}>New quiz</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.reviewWrap}>
        <Text style={styles.reviewHeading}>Review</Text>
        {attempts.map((attempt, index) => {
          const passed = Boolean(attempt.evaluation?.is_correct);
          const KindIcon = KIND_ICON[attempt.question.kind];
          return (
            <Card
              key={`${index}-${attempt.question.prompt.slice(0, 24)}`}
              style={[
                styles.reviewCard,
                {
                  borderColor: passed
                    ? "rgba(207,158,255,0.25)"
                    : "rgba(248,113,113,0.25)",
                },
              ]}
            >
              <View style={styles.reviewRow}>
                <View
                  style={[
                    styles.reviewIcon,
                    passed ? styles.reviewIconPass : styles.reviewIconFail,
                  ]}
                >
                  {passed ? (
                    <CheckCircle2 size={16} color={colors.lilac} />
                  ) : (
                    <XCircle size={16} color="#fecaca" />
                  )}
                </View>
                <View style={styles.reviewBody}>
                  <View style={styles.reviewMetaRow}>
                    <View style={styles.reviewKind}>
                      <KindIcon size={12} color={colors.star70} />
                      <Text style={styles.reviewKindText}>
                        Q{index + 1} · {KIND_LABEL[attempt.question.kind]}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.reviewStatus,
                        {
                          color: passed
                            ? "rgba(207,158,255,0.8)"
                            : "rgba(252,165,165,0.8)",
                        },
                      ]}
                    >
                      {passed ? "Correct" : "Incorrect"}
                      {!passed && attempt.evaluation
                        ? ` · ${Math.round(attempt.evaluation.score)}%`
                        : ""}
                    </Text>
                  </View>

                  <RichText
                    text={attempt.question.prompt}
                    style={styles.reviewPrompt}
                  />

                  {attempt.question.kind !== "mcq" && attempt.question.code ? (
                    <View style={styles.reviewCode}>
                      <CodeBlock
                        code={attempt.question.code}
                        language={attempt.question.language}
                        caption="Question code"
                      />
                    </View>
                  ) : null}

                  {attempt.evaluation?.feedback ? (
                    <View
                      style={[
                        styles.feedbackPanel,
                        passed
                          ? styles.feedbackPass
                          : styles.feedbackFail,
                      ]}
                    >
                      <RichText
                        text={attempt.evaluation.feedback}
                        style={[
                          styles.feedbackText,
                          {
                            color: passed
                              ? "rgba(207,158,255,0.85)"
                              : "rgba(254,243,199,0.85)",
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 20,
  },
  summaryCard: {
    padding: 24,
  },
  summaryRow: {
    alignItems: "center",
    gap: 28,
  },
  ringWrap: {
    width: 160,
    height: 160,
  },
  ring: {
    transform: [{ rotate: "-90deg" }],
  },
  ringCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringPercent: {
    fontSize: 28,
    fontFamily: fonts.mono,
    color: colors.white,
  },
  ringLabel: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: fonts.regular,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.w35,
  },
  summaryText: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  headline: {
    marginTop: 8,
    fontSize: 24,
    fontFamily: fonts.semibold,
    letterSpacing: -0.72,
    color: colors.white,
    textAlign: "center",
  },
  verdict: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w50,
    textAlign: "center",
  },
  pillRow: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.35)",
    backgroundColor: "rgba(207,158,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpPillText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  questionsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  questionsPillText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  buttonRow: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: colors.star,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  retakeText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  newQuizButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  newQuizText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  reviewWrap: {
    gap: 12,
  },
  reviewHeading: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  reviewCard: {
    padding: 20,
    borderRadius: 16,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewIcon: {
    marginTop: 2,
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewIconPass: {
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: "rgba(207,158,255,0.10)",
  },
  reviewIconFail: {
    borderColor: "rgba(248,113,113,0.4)",
    backgroundColor: "rgba(248,113,113,0.10)",
  },
  reviewBody: {
    flex: 1,
    minWidth: 0,
  },
  reviewMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  reviewKind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewKindText: {
    fontSize: 10,
    fontFamily: fonts.regular,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  reviewStatus: {
    fontSize: 10,
    fontFamily: fonts.regular,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  reviewPrompt: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: colors.w80,
  },
  reviewCode: {
    marginTop: 12,
  },
  feedbackPanel: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedbackPass: {
    borderColor: "rgba(207,158,255,0.25)",
    backgroundColor: "rgba(207,158,255,0.07)",
  },
  feedbackFail: {
    borderColor: "rgba(252,211,77,0.25)",
    backgroundColor: "rgba(252,211,77,0.07)",
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 19,
  },
});
