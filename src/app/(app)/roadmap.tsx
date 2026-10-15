import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronRight,
  Compass,
  Sparkles,
  Target,
  Timer,
  Trash2,
} from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import { AI_CONFIGURED } from '@/lib/ai';
import {
  createRoadmap,
  deleteRoadmap,
  fetchRoadmaps,
} from '@/lib/db/roadmaps';
import type { RoadmapSummary } from '@/lib/db/types';
import { toastInfo, toastSuccess } from '@/lib/toast';

const COMMITMENTS = [
  { key: 'casual', label: 'Casual', hint: '2-3 hours / week', hours: 3 },
  { key: 'serious', label: 'Serious', hint: '5-10 hours / week', hours: 8 },
  { key: 'intensive', label: 'Intensive', hint: '15+ hours / week', hours: 16 },
];

const LEVELS = [
  { key: 'beginner', label: 'Beginner', hint: 'New to this topic' },
  { key: 'intermediate', label: 'Intermediate', hint: 'Some hands-on experience' },
  { key: 'advanced', label: 'Advanced', hint: 'Confident and building already' },
];

const TEMPLATES = [
  {
    label: 'Python Programming',
    goal:
      'Learn Python from scratch to an advanced level: core syntax, data structures, functions and object-oriented design, file and error handling, the standard library, virtual environments and packaging, then finish with a capstone command-line project.',
  },
  {
    label: 'Data Science',
    goal:
      'Go from zero to a working data scientist: Python and pandas fundamentals, NumPy and data wrangling, statistics and probability, data visualization, exploratory analysis, scikit-learn for classical machine learning, and an end-to-end project on a real dataset.',
  },
  {
    label: 'Web Development',
    goal:
      'Build and ship full-stack web apps: HTML, CSS and responsive layout, modern JavaScript and the DOM, a frontend framework, REST APIs and databases, authentication, testing, deployment, and one deployed portfolio project.',
  },
  {
    label: 'Machine Learning',
    goal:
      'Master machine learning from foundations to practice: linear algebra and probability refresh, core ML models and model evaluation, scikit-learn workflows, feature engineering, neural networks with PyTorch, and a deployed model project.',
  },
];

export default function RoadmapScreen() {
  const userId = useUserId();
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [goal, setGoal] = useState('');
  const [commitmentKey, setCommitmentKey] = useState('serious');
  const [level, setLevel] = useState('beginner');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    void fetchRoadmaps(userId).then((rows) => {
      setRoadmaps(rows);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  }, [load]);

  const handleCreate = async () => {
    if (!userId) return;
    if (!goal.trim()) {
      setError('Describe your goal first.');
      return;
    }
    if (!AI_CONFIGURED) {
      setError('AI service is not configured. Set EXPO_PUBLIC_AI_API_URL in .env.');
      return;
    }
    setCreating(true);
    setError(null);
    const commitment =
      COMMITMENTS.find((entry) => entry.key === commitmentKey) ?? COMMITMENTS[1];
    try {
      const created = await createRoadmap(userId, {
        goal,
        hoursPerWeek: commitment.hours,
        level,
      });
      if (created) {
        setGoal('');
        setExpanded(created.id);
        toastSuccess('Roadmap generated', `"${created.title}" is ready to explore.`);
        load();
      } else {
        setError('Could not create the roadmap. Check your connection and AI service.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete roadmap?', 'This removes the roadmap and its outline.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!userId) return;
          void deleteRoadmap(userId, id).then(() => {
            toastInfo('Roadmap deleted');
            load();
          });
        },
      },
    ]);
  };

  const selectedLevel = LEVELS.find((entry) => entry.key === level) ?? LEVELS[0];
  const selectedCommitment =
    COMMITMENTS.find((entry) => entry.key === commitmentKey) ?? COMMITMENTS[1];

  const builder = (
    <GlassCard className="gap-5 p-6">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl border border-[#cf9eff]/25 bg-[#cf9eff]/10">
          <Compass size={18} color="#cf9eff" />
        </View>
        <View className="flex-1">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            AI syllabus
          </Text>
          <Text
            allowFontScaling={false}
            className="mt-1 font-sans-medium text-base text-white">
            Tell ATLAS what you want to learn
          </Text>
        </View>
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center gap-1.5">
          <Target size={12} color="rgba(255,255,255,0.4)" />
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Goal
          </Text>
        </View>
        <TextInput
          allowFontScaling={false}
          value={goal}
          onChangeText={setGoal}
          placeholder="e.g., Learn Python from basics to advanced, Master Calculus, Build a full-stack web app"
          placeholderTextColor="rgba(255,255,255,0.25)"
          maxLength={400}
          multiline
          textAlignVertical="top"
          className="min-h-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 font-sans text-base leading-[24px] text-white"
        />
        <Text
          allowFontScaling={false}
          className="mt-1 text-base leading-[24px] text-white/35">
          Be specific about what you want to learn and your end goal
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <Timer size={12} color="rgba(255,255,255,0.4)" />
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Current level
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {LEVELS.map((option) => {
            const selected = level === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setLevel(option.key)}
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
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text allowFontScaling={false} className="text-base text-white/40">
          {selectedLevel.hint}
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <Timer size={12} color="rgba(255,255,255,0.4)" />
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Time commitment
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {COMMITMENTS.map((option) => {
            const selected = commitmentKey === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setCommitmentKey(option.key)}
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
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text allowFontScaling={false} className="text-base text-white/40">
          {selectedCommitment.hint}
        </Text>
      </View>

      <View className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <Text
          allowFontScaling={false}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
          Or start from a template
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {TEMPLATES.map((template) => (
            <Pressable
              key={template.label}
              onPress={() => {
                setGoal(template.goal);
                setError(null);
              }}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3">
              <Sparkles size={14} color="rgba(157,180,255,0.7)" />
              <Text
                allowFontScaling={false}
                className="text-base text-white/60">
                {template.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <View className="rounded-2xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3.5">
          <Text
            allowFontScaling={false}
            className="font-sans text-base leading-[24px] text-red-100/90">
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
            className="flex-1 text-base leading-[24px] text-white/35">
            The timeline is sized automatically from your goal and commitment.
          </Text>
        </View>
        <PrimaryButton
          label="Generate roadmap"
          loading={creating}
          onPress={() => void handleCreate()}
        />
      </View>
    </GlassCard>
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#9db4ff"
          colors={['#9db4ff']}
          progressBackgroundColor="#0a0a1a"
        />
      }>
      <View className="gap-2 pt-2">
        <Text
          allowFontScaling={false}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
          Path map
        </Text>
        <RevealText
          text="Roadmap"
          className="mt-1 font-display-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#9db4ff" size="large" />
        </View>
      ) : roadmaps.length === 0 ? (
        <>
          <GlassCard className="items-center px-6 py-14">
            <View className="relative h-20 w-20 items-center justify-center rounded-3xl border border-[#cf9eff]/25 bg-[#cf9eff]/10">
              <Compass size={36} color="#cf9eff" />
              <View
                pointerEvents="none"
                className="absolute -inset-3.5 rounded-[30px] border border-dashed border-[#cf9eff]/25"
              />
            </View>
            <Text
              allowFontScaling={false}
              className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              No roadmap yet
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-3 text-center font-sans-semibold text-[24px] leading-[30px] tracking-[-0.03em] text-white">
              Your learning journey starts here
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-3 text-center text-base leading-[26px] text-white/45">
              Tell us what you want to master, and AI will create a personalized
              roadmap with milestones, resources, and progress tracking.
            </Text>
          </GlassCard>
          {builder}
        </>
      ) : (
        <>
          {builder}
          {roadmaps.map((item) => {
            const open = expanded === item.id;
            return (
              <GlassCard key={item.id} className="p-5">
                <Pressable
                  onPress={() => setExpanded(open ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1.5">
                    <Text
                      allowFontScaling={false}
                      className="font-sans-semibold text-[16px] leading-[22px] text-white">
                      {item.title}
                    </Text>
                    {item.courseTitle ? (
                      <Text
                        allowFontScaling={false}
                        className="font-sans text-base text-lilac/80">
                        {item.courseTitle}
                      </Text>
                    ) : null}
                    <Text
                      allowFontScaling={false}
                      className="font-sans text-base text-white/45">
                      {item.phaseCount} phases ·{' '}
                      {item.total > 0
                        ? `${item.completed}/${item.total} levels`
                        : 'outline only'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => handleDelete(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${item.title}`}
                      hitSlop={8}
                      className="h-11 w-11 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/[0.08]">
                      <Trash2 size={14} color="#fecaca" />
                    </Pressable>
                    <ChevronRight
                      size={18}
                      color="rgba(255,255,255,0.4)"
                      style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
                    />
                  </View>
                </Pressable>

                {item.total > 0 ? (
                  <View className="mt-3 h-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
                    <View
                      className="h-full rounded-full bg-gradient-to-r from-[#9db4ff] to-[#cf9eff]"
                      style={{ width: `${Math.min(100, item.percent)}%` }}
                    />
                  </View>
                ) : null}

                {open ? (
                  <View className="mt-4 gap-3 border-t border-white/[0.07] pt-4">
                    {item.summary ? (
                      <Text
                        allowFontScaling={false}
                        className="font-sans text-base leading-[24px] text-white/60">
                        {item.summary}
                      </Text>
                    ) : null}
                    {item.phases.map((phase) => (
                      <View
                        key={`${item.id}-${phase.number}`}
                        className="gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                        <View className="flex-row items-center gap-2">
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-[#cf9eff]/[0.12]">
                            <Text
                              allowFontScaling={false}
                              className="font-sans-bold text-[15px] text-lilac">
                              {phase.number}
                            </Text>
                          </View>
                          <Text
                            allowFontScaling={false}
                            className="flex-1 font-sans-semibold text-base text-white">
                            {phase.title}
                          </Text>
                        </View>
                        {phase.objective ? (
                          <Text
                            allowFontScaling={false}
                            className="font-sans text-base leading-[24px] text-white/50">
                            {phase.objective}
                          </Text>
                        ) : null}
                        <Text
                          allowFontScaling={false}
                          className="font-sans text-base text-white/35">
                          {phase.durationWeeks > 0 ? `${phase.durationWeeks}w · ` : ''}
                          {phase.hours > 0 ? `${phase.hours}h` : ''}
                        </Text>
                        {phase.milestones.length > 0 ? (
                          <View className="mt-1 gap-1">
                            {phase.milestones.map((m, i) => (
                              <View key={i} className="flex-row items-start gap-2">
                                <View className="mt-1.5 h-1 w-1 rounded-full bg-lilac" />
                                <Text
                                  allowFontScaling={false}
                                  className="flex-1 font-sans text-base leading-[24px] text-white/45">
                                  {m}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </GlassCard>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
