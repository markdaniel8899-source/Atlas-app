import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import {
  BookOpen,
  Check,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import { AI_CONFIGURED } from '@/lib/ai';
import type { Difficulty, QuizQuestion } from '@/lib/ai';
import { fetchFocusCourse } from '@/lib/db/courses';
import { saveQuizSession } from '@/lib/db/quizSessions';
import { toastSuccess } from '@/lib/toast';
import {
  KIND_LABEL,
  QUIZ_KINDS,
  XP_PER_CORRECT,
  canSubmit,
  evaluateAnswer,
  initialAnswer,
  requestQuiz,
  summarize,
  type GenerateInput,
  type KindChoice,
  type QuizAnswer,
  type QuizAttempt,
} from '@/lib/quiz';

const KINDS: KindChoice[] = ['mixed', ...QUIZ_KINDS];
const COUNTS = [5, 10, 15];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'Gentle warm-up',
  medium: 'Balanced challenge',
  hard: 'Push your limits',
};

type Phase = 'setup' | 'loading' | 'running' | 'grading' | 'done' | 'error';

function verdict(percent: number): string {
  if (percent >= 90) return 'Outstanding command of the topic.';
  if (percent >= 70) return 'Solid - a few rough edges left.';
  if (percent >= 50) return 'Halfway there. Review the misses below.';
  return 'Tough set. Walk the feedback and go again.';
}

function ScoreRing({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 56;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <View className="relative h-40 w-40 items-center justify-center">
      <Svg
        width={160}
        height={160}
        viewBox="0 0 128 128"
        style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={64}
          cy={64}
          r={56}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
        />
        <Circle
          cx={64}
          cy={64}
          r={56}
          fill="none"
          stroke="#cf9eff"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View className="absolute items-center">
        <Text
          allowFontScaling={false}
          className="font-mono text-3xl tabular-nums text-white">
          {percent}%
        </Text>
        <Text
          allowFontScaling={false}
          className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">
          score
        </Text>
      </View>
    </View>
  );
}

export default function QuizScreen() {
  const userId = useUserId();
  const [phase, setPhase] = useState<Phase>('setup');
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState<KindChoice>('mixed');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [useCourse, setUseCourse] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [lastEval, setLastEval] = useState<{ ok: boolean; feedback: string } | null>(null);

  const start = async () => {
    if (!topic.trim()) {
      setError('Enter a topic to be quizzed on.');
      return;
    }
    if (!AI_CONFIGURED) {
      setError('AI service is not configured. Set EXPO_PUBLIC_AI_API_URL in .env.');
      return;
    }
    setPhase('loading');
    setError(null);
    try {
      const input: GenerateInput = { topic, kind, count, difficulty };
      if (useCourse && userId) {
        const course = await fetchFocusCourse(userId);
        if (course) {
          input.courseId = course.id;
          input.context = course.title;
        }
      }
      const result = await requestQuiz(input);
      if (!result.questions.length) {
        setPhase('setup');
        setError('No questions came back. Try a different topic or kind.');
        return;
      }
      setQuestions(result.questions);
      setAnswers(result.questions.map(initialAnswer));
      setIndex(0);
      setAttempts([]);
      setLastEval(null);
      setPhase('running');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Quiz generation failed.');
    }
  };

  const current = questions[index];
  const answer = answers[index];

  const setAnswer = (value: QuizAnswer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const submit = async () => {
    if (!current || !canSubmit(current, answer)) return;
    setPhase('grading');
    try {
      const evaluation = await evaluateAnswer(current, answer);
      setAttempts((prev) => [...prev, { question: current, answer, evaluation }]);
      setLastEval({
        ok: evaluation.is_correct,
        feedback: evaluation.feedback,
      });
      setPhase('running');
    } catch (err) {
      setLastEval({
        ok: false,
        feedback: err instanceof Error ? err.message : 'Could not grade that answer.',
      });
      setPhase('running');
    }
  };

  const next = () => {
    setLastEval(null);
    if (index + 1 >= questions.length) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const finish = async () => {
    const summary = summarize(attempts);
    setPhase('done');
    if (summary.correct > 0) {
      toastSuccess(
        'Quiz complete',
        `${summary.correct}/${summary.total} correct · +${summary.xp} XP`,
      );
    }
    if (userId && summary.correct > 0) {
      await saveQuizSession({
        topic: topic.slice(0, 160),
        kind,
        correct: summary.correct,
        total: summary.total,
        xp: summary.xp,
      });
    }
  };

  const reset = () => {
    setPhase('setup');
    setQuestions([]);
    setAttempts([]);
    setIndex(0);
    setLastEval(null);
    setError(null);
  };

  const retake = () => {
    const fresh = attempts.map((item) => item.question);
    if (!fresh.length) {
      reset();
      return;
    }
    setQuestions(fresh);
    setAnswers(fresh.map(initialAnswer));
    setIndex(0);
    setAttempts([]);
    setLastEval(null);
    setPhase('running');
  };

  const summary = phase === 'done' ? summarize(attempts) : null;
  const answered = attempts.filter((item) => item.evaluation).length;
  const runningPercent =
    questions.length > 0 ? (answered / questions.length) * 100 : 0;

  if (phase === 'setup' || phase === 'loading' || phase === 'error') {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-2 pt-2">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Assessment
          </Text>
          <RevealText
            text="Quiz."
            className="mt-1 font-display-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
          />
        </View>

        {phase === 'loading' ? (
          <GlassCard className="items-center gap-4 px-6 py-16">
            <ActivityIndicator color="#9db4ff" size="large" />
            <View className="items-center gap-1.5">
              <Text
                allowFontScaling={false}
                className="font-sans-medium text-base text-white">
                Writing your questions
              </Text>
              <Text
                allowFontScaling={false}
                className="text-center text-[15px] text-white/40">
                The model is drafting prompts, code snippets and explanations.
              </Text>
            </View>
          </GlassCard>
        ) : (
          <GlassCard className="gap-5 p-6">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl border border-[#cf9eff]/25 bg-[#cf9eff]/10">
                <BookOpen size={18} color="#cf9eff" />
              </View>
              <View className="flex-1">
                <Text
                  allowFontScaling={false}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                  Assessment
                </Text>
                <Text
                  allowFontScaling={false}
                  className="mt-1 font-sans-medium text-base text-white">
                  Choose what you want to be tested on
                </Text>
              </View>
            </View>

            <View className="gap-1.5">
              <Text
                allowFontScaling={false}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                Topic to quiz
              </Text>
              <TextInput
                allowFontScaling={false}
                value={topic}
                onChangeText={setTopic}
                placeholder="e.g., Python list comprehensions, CSS grid, Big-O notation"
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={300}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-sans text-base text-white"
              />
            </View>

            <View className="gap-2">
              <Text
                allowFontScaling={false}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                Question type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {KINDS.map((k) => {
                  const selected = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`min-h-[48px] rounded-full px-5 py-3 ${
                        selected
                          ? 'border-2 border-[#cf9eff] bg-[#cf9eff]/[0.08]'
                          : 'border border-white/10 bg-white/[0.04]'
                      }`}>
                      <Text
                        allowFontScaling={false}
                        className={`font-sans-medium text-base ${
                          selected ? 'text-white' : 'text-white/55'
                        }`}>
                        {KIND_LABEL[k]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text
                allowFontScaling={false}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                Questions
              </Text>
              <View className="flex-row gap-2">
                {COUNTS.map((c) => {
                  const selected = count === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCount(c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`min-h-[48px] flex-1 rounded-xl px-5 py-3 ${
                        selected
                          ? 'border-2 border-[#9db4ff] bg-[#9db4ff]/10'
                          : 'border border-white/10 bg-white/[0.04]'
                      }`}>
                      <Text
                        allowFontScaling={false}
                        className={`text-center font-mono text-base tabular-nums ${
                          selected ? 'text-star' : 'text-white/50'
                        }`}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text
                allowFontScaling={false}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                Difficulty
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DIFFICULTIES.map((d) => {
                  const selected = difficulty === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDifficulty(d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`min-h-[48px] rounded-full px-5 py-3 ${
                        selected
                          ? 'border-2 border-[#cf9eff] bg-[#cf9eff]/[0.08]'
                          : 'border border-white/10 bg-white/[0.04]'
                      }`}>
                      <Text
                        allowFontScaling={false}
                        className={`font-sans-medium text-base capitalize ${
                          selected ? 'text-white' : 'text-white/55'
                        }`}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text allowFontScaling={false} className="text-[15px] text-white/40">
                {DIFFICULTY_HINTS[difficulty]}
              </Text>
            </View>

            <Pressable
              onPress={() => setUseCourse((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useCourse }}
              className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3">
              <View
                className={`h-5 w-5 items-center justify-center rounded border-2 ${
                  useCourse ? 'border-[#9db4ff] bg-[#9db4ff]' : 'border-white/25'
                }`}>
                {useCourse ? (
                  <Check size={12} color="#030305" strokeWidth={3} />
                ) : null}
              </View>
              <Text
                allowFontScaling={false}
                className="flex-1 text-base text-white/75">
                Base it on my current course
              </Text>
            </Pressable>

            {error ? (
              <View className="rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3.5">
                <Text
                  allowFontScaling={false}
                  className="text-base leading-relaxed text-red-100/90">
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="gap-3 border-t border-white/[0.07] pt-5">
              <View className="flex-row items-start gap-1.5">
                <Sparkles
                  size={14}
                  color="rgba(157,180,255,0.7)"
                  style={{ marginTop: 2 }}
                />
                <Text
                  allowFontScaling={false}
                  className="flex-1 text-[15px] leading-[24px] text-white/35">
                  {count} questions, {KIND_LABEL[kind].toLowerCase()} - graded
                  with feedback after every answer. Each correct answer earns{' '}
                  {XP_PER_CORRECT} XP.
                </Text>
              </View>
              <PrimaryButton
                label="Generate quiz"
                icon={<Sparkles size={16} color="#030305" />}
                onPress={() => void start()}
              />
            </View>
          </GlassCard>
        )}
      </ScrollView>
    );
  }

  if (phase === 'done' && summary) {
    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}>
        <GlassCard className="gap-8 p-6">
          <View className="items-center">
            <ScoreRing percent={summary.percent} />
          </View>
          <View className="items-center gap-2">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Quiz complete
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-1 font-sans-semibold text-2xl tracking-[-0.03em] text-white">
              {summary.correct} / {summary.total} correct
            </Text>
            <Text
              allowFontScaling={false}
              className="text-center text-base leading-relaxed text-white/50">
              {topic} - {verdict(summary.percent)}
            </Text>
            <View className="mt-3 flex-row flex-wrap justify-center gap-2">
              <View className="flex-row items-center gap-1.5 rounded-full border border-[#cf9eff]/35 bg-[#cf9eff]/10 px-4 py-2">
                <Sparkles size={14} color="#cf9eff" />
                <Text
                  allowFontScaling={false}
                  className="font-sans-medium text-[15px] text-[#cf9eff]">
                  {summary.xp} XP earned
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                <Trophy size={14} color="rgba(255,255,255,0.55)" />
                <Text
                  allowFontScaling={false}
                  className="text-[15px] text-white/55">
                  {summary.total} questions
                </Text>
              </View>
            </View>
          </View>
          <View className="gap-2">
            <PrimaryButton
              label="Retake this quiz"
              icon={<RotateCcw size={16} color="#030305" />}
              onPress={retake}
            />
            <PrimaryButton
              label="New quiz"
              variant="ghost"
              onPress={reset}
            />
          </View>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 16 }}
      showsVerticalScrollIndicator={false}>
      <GlassCard className="gap-3 p-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            allowFontScaling={false}
            className="text-base text-white/75">
            Question {index + 1} of {questions.length}
          </Text>
          <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <Text
              allowFontScaling={false}
              className="text-[15px] text-white/50">
              {KIND_LABEL[current?.kind ?? 'mixed']}
            </Text>
          </View>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <View
            className="h-full rounded-full bg-gradient-to-r from-[#9db4ff] to-[#cf9eff]"
            style={{ width: `${runningPercent}%` }}
          />
        </View>
      </GlassCard>

      {current ? (
        <GlassCard className="gap-4 p-6">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            {topic || KIND_LABEL[current.kind]}
          </Text>
          <Text
            allowFontScaling={false}
            className="font-sans-medium text-lg leading-relaxed text-white">
            {current.prompt}
          </Text>

          {current.code && current.kind !== 'code' ? (
            <View className="rounded-2xl border border-white/[0.07] bg-black/40 p-4">
              <Text
                allowFontScaling={false}
                className="font-mono text-[15px] leading-[24px] text-star/90">
                {current.code}
              </Text>
            </View>
          ) : null}

          {current.kind === 'mcq' ? (
            <View className="gap-2">
              {current.options.map((opt, i) => {
                const selected = answer === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setAnswer(i)}
                    disabled={Boolean(lastEval)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={`min-h-[48px] flex-row items-start gap-3 rounded-2xl border px-5 py-4 ${
                      selected
                        ? 'border-star/60 bg-star/10'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}>
                    <View
                      className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border ${
                        selected ? 'border-star bg-star/20' : 'border-white/25'
                      }`}>
                      {selected ? (
                        <View className="h-2 w-2 rounded-full bg-star" />
                      ) : null}
                    </View>
                    <Text
                      allowFontScaling={false}
                      className="flex-1 text-base leading-[26px] text-white/85">
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              allowFontScaling={false}
              value={typeof answer === 'string' ? answer : ''}
              onChangeText={setAnswer}
              editable={!Boolean(lastEval)}
              placeholder={
                current.kind === 'debug'
                  ? 'First line: keep/fix note\nThen the corrected code...'
                  : 'Type your answer...'
              }
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              textAlignVertical="top"
              className="min-h-[140px] rounded-2xl border border-white/[0.07] bg-black/40 p-4 font-mono text-[15px] leading-[24px] text-white/90"
            />
          )}

          {lastEval ? (
            <View
              className={`rounded-2xl border px-4 py-3.5 ${
                lastEval.ok
                  ? 'border-[#cf9eff]/30 bg-[#cf9eff]/[0.08]'
                  : 'border-amber-300/30 bg-amber-300/[0.08]'
              }`}>
              <View className="flex-row items-start gap-3">
                <View
                  className={`mt-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                    lastEval.ok
                      ? 'border-[#cf9eff]/30 bg-[#cf9eff]/10'
                      : 'border-amber-300/30 bg-amber-300/10'
                  }`}>
                  <Check
                    size={14}
                    color={lastEval.ok ? '#cf9eff' : '#fde68a'}
                    strokeWidth={2.5}
                  />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text
                    allowFontScaling={false}
                    className="font-sans-medium text-base text-white">
                    {lastEval.ok ? 'Correct' : 'Not quite'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    className="text-base leading-relaxed text-white/65">
                    {lastEval.feedback}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {phase === 'grading' ? (
            <View className="items-center py-2">
              <ActivityIndicator color="#9db4ff" />
            </View>
          ) : (
            <View className="gap-2 border-t border-white/[0.07] pt-5">
              <PrimaryButton
                label={
                  lastEval
                    ? index + 1 >= questions.length
                      ? 'See results'
                      : 'Next question'
                    : 'Check answer'
                }
                disabled={!lastEval && !canSubmit(current, answer)}
                icon={
                  lastEval ? undefined : <Sparkles size={16} color="#030305" />
                }
                onPress={() => (lastEval ? next() : void submit())}
              />
            </View>
          )}
        </GlassCard>
      ) : null}

      <Pressable
        onPress={reset}
        accessibilityRole="button"
        className="min-h-[48px] self-center px-6 py-3">
        <Text
          allowFontScaling={false}
          className="text-base text-white/45">
          Quit quiz
        </Text>
      </Pressable>
    </ScrollView>
  );
}
