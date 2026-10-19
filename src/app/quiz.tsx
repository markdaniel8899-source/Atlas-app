import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Card } from "../components/ui/card";
import { CodeBlock } from "../components/quiz/code-block";
import { QuestionInput } from "../components/quiz/question-input";
import { QuizResults } from "../components/quiz/quiz-results";
import { QuizSetup } from "../components/quiz/quiz-setup";
import { RichText } from "../components/quiz/rich-text";
import { KIND_ICON } from "../components/quiz/icons";
import { useCourses } from "../hooks/use-courses";
import { ensureOnline } from "../lib/net";
import { canSubmit, KIND_LABEL, summarize } from "../lib/quiz";
import type { GenerateInput } from "../lib/quiz";
import {
  dismissQuizError,
  generateQuizSession,
  getQuizSessionSnapshot,
  quizGoBack,
  quizGoNext,
  quizRetake,
  quizStartOver,
  setQuizAnswer,
  submitQuizAnswer,
  subscribeQuizSession,
} from "../lib/quiz-store";
import { colors, ease, fonts } from "../theme/theme";

const ACHIEVEMENT_TITLES: Record<string, string> = {
  first_quiz: "First Steps",
  streak_master: "7-Day Streak Master",
  night_owl: "Night Owl",
  quiz_wizard: "Quiz Wizard",
};

/** Entrance fade used in place of the web's motion mount animations. */
function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function QuizScreen() {
  const { courses, loading: coursesLoading } = useCourses();

  const {
    phase,
    attempts,
    index,
    answer,
    evaluation,
    evaluating,
    topic,
    error,
    unlocked,
    syncNote,
  } = useSyncExternalStore(subscribeQuizSession, getQuizSessionSnapshot);

  const question = attempts[index]?.question ?? null;
  const KindIcon = KIND_ICON[question?.kind ?? "mixed"];
  const answered = attempts.filter((attempt) => attempt.evaluation).length;
  const percent =
    attempts.length > 0 ? (answered / attempts.length) * 100 : 0;
  const summary = summarize(attempts);

  const handleGenerate = async (input: GenerateInput) => {
    if (
      !(await ensureOnline(
        "Quizzes are generated online - reconnect to start one.",
      ))
    ) {
      return;
    }
    await generateQuizSession(input);
  };

  const alert =
    error && !evaluating ? (
      <View accessibilityRole="alert" style={styles.alert}>
        <View style={styles.alertIcon}>
          <AlertTriangle size={14} color="#fecaca" />
        </View>
        <Text style={styles.alertText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={dismissQuizError}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.pressed,
          ]}
        >
          <RefreshCw size={12} color={colors.w80} />
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    ) : null;

  return (
    <ScreenShell title="Quiz" activeLabel="Quiz">
      <ScreenHeading eyebrow="Assessment" title="Quiz." />

      {phase === "setup" ? (
        <View style={styles.phaseWrap}>
          <QuizSetup
            courses={courses}
            loading={coursesLoading}
            busy={false}
            error={error}
            onGenerate={(input) => void handleGenerate(input)}
          />
        </View>
      ) : null}

      {phase === "loading" ? (
        <FadeIn style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.star} />
          <View style={styles.loadingTextWrap}>
            <Text style={styles.loadingTitle}>Writing your questions</Text>
            <Text style={styles.loadingBody}>
              The model is drafting prompts, code snippets and explanations.
            </Text>
            <Text style={styles.loadingFootnote}>
              This keeps running even if you leave the screen.
            </Text>
          </View>
        </FadeIn>
      ) : null}

      {phase === "running" && question ? (
        <View style={styles.phaseWrap}>
          <FadeIn>
            <Card style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>
                  Question {index + 1} of {attempts.length}
                </Text>
                <View style={styles.kindBadge}>
                  <KindIcon size={12} color={colors.star70} />
                  <Text style={styles.kindBadgeText}>
                    {KIND_LABEL[question.kind]}
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={["#9db4ff", "#cf9eff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${percent}%` }]}
                />
              </View>
            </Card>
          </FadeIn>

          <FadeIn key={index} delay={40} style={styles.questionCard}>
            <Card style={styles.questionCardInner}>
              <Text style={styles.topicEyebrow}>{topic}</Text>
              <View style={styles.promptWrap}>
                <RichText text={question.prompt} style={styles.prompt} />
              </View>

              {question.kind === "code" && question.code.trim() ? (
                <View style={styles.questionCode}>
                  <CodeBlock
                    code={question.code}
                    language={question.language}
                    caption="What to build"
                  />
                </View>
              ) : null}

              <View style={styles.inputWrap}>
                <QuestionInput
                  question={question}
                  answer={answer}
                  onChange={setQuizAnswer}
                  disabled={Boolean(evaluation) || evaluating}
                />
              </View>

              {evaluation ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.evalPanel,
                    evaluation.is_correct
                      ? styles.evalPanelGood
                      : styles.evalPanelBad,
                  ]}
                >
                  <View
                    style={[
                      styles.evalIcon,
                      evaluation.is_correct
                        ? styles.evalIconGood
                        : styles.evalIconBad,
                    ]}
                  >
                    {evaluation.is_correct ? (
                      <Check size={14} color={colors.lilac} />
                    ) : (
                      <AlertTriangle size={14} color="#fde68a" />
                    )}
                  </View>
                  <View style={styles.evalBody}>
                    <Text style={styles.evalTitle}>
                      {evaluation.is_correct ? "Correct" : "Not quite"}
                      {question.kind !== "mcq"
                        ? ` - ${Math.round(evaluation.score)}%`
                        : ""}
                    </Text>
                    {evaluation.feedback ? (
                      <RichText
                        text={evaluation.feedback}
                        style={styles.evalFeedback}
                      />
                    ) : null}
                    {!evaluation.is_correct &&
                    question.explanation &&
                    !evaluation.feedback ? (
                      <RichText
                        text={question.explanation}
                        style={styles.evalExplanation}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {alert ? <View style={styles.questionAlert}>{alert}</View> : null}

              <View style={styles.navRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={quizGoBack}
                  disabled={index === 0}
                  style={({ pressed }) => [
                    styles.previousButton,
                    pressed && styles.pressed,
                    index === 0 && styles.disabled,
                  ]}
                >
                  <ChevronLeft size={16} color={colors.w70} />
                  <Text style={styles.previousText}>Previous</Text>
                </Pressable>

                <View style={styles.navRight}>
                  {!evaluation ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void quizGoNext()}
                      style={({ pressed }) => [
                        styles.skipButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                  ) : null}

                  {evaluation ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void quizGoNext()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.primaryText}>
                        {index >= attempts.length - 1
                          ? "See results"
                          : "Next question"}
                      </Text>
                      <ArrowRight size={16} color={colors.primaryText} />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void submitQuizAnswer()}
                      disabled={evaluating || !canSubmit(question, answer)}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                        (evaluating || !canSubmit(question, answer)) &&
                          styles.primaryDisabled,
                      ]}
                    >
                      {evaluating ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={colors.primaryText}
                          />
                          <Text style={styles.primaryText}>Checking</Text>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} color={colors.primaryText} />
                          <Text style={styles.primaryText}>Check answer</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            </Card>
          </FadeIn>
        </View>
      ) : null}

      {phase === "done" ? (
        <View style={styles.phaseWrap}>
          {alert}
          {syncNote ? (
            <View accessibilityRole="alert" style={styles.syncNote}>
              <AlertTriangle size={14} color={colors.w50} />
              <Text style={styles.syncNoteText}>{syncNote}</Text>
            </View>
          ) : null}
          {unlocked.length > 0 ? (
            <FadeIn style={styles.achievementBanner}>
              <View style={styles.achievementIcon}>
                <Trophy size={18} color="#fcd34d" />
              </View>
              <View style={styles.achievementTextWrap}>
                <Text style={styles.achievementTitle}>
                  Achievement{unlocked.length > 1 ? "s" : ""} unlocked
                </Text>
                <Text numberOfLines={1} style={styles.achievementBody}>
                  {unlocked
                    .map((code) => ACHIEVEMENT_TITLES[code] ?? code)
                    .join(" · ")}
                </Text>
              </View>
            </FadeIn>
          ) : null}
          <FadeIn delay={60}>
            <QuizResults
              summary={summary}
              attempts={attempts}
              topic={topic}
              onRetry={quizRetake}
              onNewQuiz={quizStartOver}
            />
          </FadeIn>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  phaseWrap: {
    gap: 20,
  },
  syncNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    padding: 12,
  },
  syncNoteText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  loadingCard: {
    alignItems: "center",
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.75)",
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  loadingTextWrap: {
    alignItems: "center",
  },
  loadingTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  loadingBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w40,
    textAlign: "center",
  },
  loadingFootnote: {
    marginTop: 10,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.star70,
    textAlign: "center",
  },
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    backgroundColor: "rgba(239,68,68,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  alertIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    backgroundColor: "rgba(248,113,113,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: "rgba(254,226,226,0.9)",
  },
  dismissButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w06,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dismissText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w80,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  progressCard: {
    padding: 20,
  },
  progressTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  kindBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kindBadgeText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.w07,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  questionCard: {},
  questionCardInner: {
    padding: 24,
  },
  topicEyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.star70,
  },
  promptWrap: {
    marginTop: 12,
  },
  prompt: {
    fontSize: 18,
    lineHeight: 27,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  questionCode: {
    marginTop: 16,
  },
  inputWrap: {
    marginTop: 20,
  },
  evalPanel: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  evalPanelGood: {
    borderColor: "rgba(207,158,255,0.30)",
    backgroundColor: "rgba(207,158,255,0.08)",
  },
  evalPanelBad: {
    borderColor: "rgba(252,211,77,0.30)",
    backgroundColor: "rgba(252,211,77,0.08)",
  },
  evalIcon: {
    marginTop: 2,
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  evalIconGood: {
    borderColor: "rgba(207,158,255,0.30)",
    backgroundColor: "rgba(207,158,255,0.10)",
  },
  evalIconBad: {
    borderColor: "rgba(252,211,77,0.30)",
    backgroundColor: "rgba(252,211,77,0.10)",
  },
  evalBody: {
    flex: 1,
    minWidth: 0,
  },
  evalTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  evalFeedback: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.65)",
  },
  evalExplanation: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: colors.w45,
  },
  questionAlert: {
    marginTop: 20,
  },
  navRow: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.w07,
    paddingTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  previousButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previousText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w70,
  },
  navRight: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skipButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 10,
    shadowColor: colors.star,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  achievementBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.30)",
    backgroundColor: "rgba(251,191,36,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "rgba(251,191,36,1)",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  achievementIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.40)",
    backgroundColor: "rgba(251,191,36,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  achievementTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  achievementTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  achievementBody: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
});
