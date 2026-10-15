import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View, Pressable } from 'react-native';
import { Compass, Play, Target } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SoftGlow } from '@/components/ui/soft-glow';
import { nextTopic } from '@/lib/db/courses';
import type { CourseStatus, FocusCourse } from '@/lib/db/types';

interface Props {
  focus: FocusCourse | null;
  loading: boolean;
}

function Eyebrow({ children }: { children: string }) {
  return (
    <Text
      allowFontScaling={false}
      className="text-[10px] font-medium uppercase tracking-[0.32em] text-[#9db4ff]/70">
      {children}
    </Text>
  );
}

function SmallGhostButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5">
      {children}
      <Text allowFontScaling={false} className="text-xs font-medium text-white">
        {label}
      </Text>
    </Pressable>
  );
}

function SmallOutlineButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.02] px-5 py-2.5">
      {children}
      <Text allowFontScaling={false} className="text-xs font-medium text-white">
        {label}
      </Text>
    </Pressable>
  );
}

export function TodayFocus({ focus, loading }: Props) {
  if (loading) {
    return (
      <GlassCard className="p-6">
        <View className="gap-4">
          <View className="h-3 w-28 rounded bg-white/[0.06]" />
          <View className="h-7 w-48 rounded bg-white/[0.06]" />
          <View className="h-2.5 w-full rounded-full bg-white/[0.05]" />
        </View>
      </GlassCard>
    );
  }

  if (!focus) {
    return (
      <GlassCard className="relative overflow-hidden p-6">
        <SoftGlow color="#9db4ff" opacity={0.1} radius={128} style={{ bottom: -96, left: -40 }} />
        <View className="relative gap-4">
          <View className="flex-row items-start gap-4">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Compass size={20} color="rgba(255,255,255,0.4)" />
            </View>
            <View className="min-w-0 flex-1">
              <Eyebrow>Today&apos;s focus</Eyebrow>
              <Text
                allowFontScaling={false}
                className="mt-1.5 font-display-semibold text-xl leading-[26px] tracking-[-0.03em] text-white">
                No course queued yet
              </Text>
              <Text allowFontScaling={false} className="mt-1.5 text-sm leading-[23px] text-white/45">
                Add a course and pick a topic - it will show up here as your single focus for the
                day.
              </Text>
            </View>
          </View>
          <View className="flex-row">
            <SmallGhostButton label="Add a course" onPress={() => router.push('/courses')}>
              <Target size={14} color="white" />
            </SmallGhostButton>
          </View>
        </View>
      </GlassCard>
    );
  }

  const topic = nextTopic(focus);
  const progress = Math.max(0, Math.min(100, focus.progress_percentage));

  return (
    <GlassCard className="relative overflow-hidden p-6">
      <SoftGlow color="#cf9eff" opacity={0.12} radius={128} style={{ top: -96, left: '33%' }} />

      <View className="relative gap-4">
        <View className="gap-2">
          <Eyebrow>Today&apos;s focus</Eyebrow>
          <Text
            allowFontScaling={false}
            className="font-display-semibold text-2xl leading-[32px] tracking-[-0.03em] text-white">
            {focus.title}
          </Text>
          <Text allowFontScaling={false} className="text-sm leading-[20px] text-white/45">
            Next up:{' '}
            <Text allowFontScaling={false} className="text-white/75">
              {topic ? topic.title : 'Add your first topic'}
            </Text>
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          <SmallGhostButton label="Start session" onPress={() => router.push('/timer')}>
            <Play size={14} color="white" />
          </SmallGhostButton>
          <SmallOutlineButton label="Roadmap" onPress={() => router.push('/roadmap')} />
        </View>
      </View>

      <View className="relative mt-7">
        <ProgressBar
          percent={progress}
          colors={[`${focus.accent}aa`, focus.accent]}
          glow={`${focus.accent}80`}
        />
        <View className="mt-2 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <Text allowFontScaling={false} className="text-[11px] text-white/35">
            {Math.round(progress)}% complete
          </Text>
          <Text allowFontScaling={false} className="text-[11px] text-white/50">
            {topic ? `${courseStatusLabel(focus.status)} - ${topic.title}` : courseStatusLabel(focus.status)}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

function courseStatusLabel(status: CourseStatus): string {
  switch (status) {
    case 'completed':
      return 'Course complete';
    case 'in_progress':
      return 'In progress';
    case 'paused':
      return 'Paused';
    default:
      return 'Not started';
  }
}
