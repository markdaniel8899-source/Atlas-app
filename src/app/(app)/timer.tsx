import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BookOpen, Check, Pause, Play, RotateCcw } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import { useTimer } from '@/context/TimerContext';
import { fetchCourses } from '@/lib/db/courses';
import { fetchRecentSessions, type RecentSession } from '@/lib/db/sessions';
import type { Course } from '@/lib/db/types';

const PRESETS = [25, 50, 90];

function formatHMS(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDay(iso: string) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatClock(iso: string) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TimerScreen() {
  const userId = useUserId();
  const timer = useTimer();
  const { state, globalTotal, progress, activeCourse, flash } = timer;
  const active = state.mode !== 'idle';

  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    void Promise.all([fetchRecentSessions(userId, 12), fetchCourses(userId)]).then(
      ([rows, list]) => {
        setSessions(rows);
        setCourses(list);
        setLoading(false);
      },
    );
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  }, [load]);

  const hint =
    state.mode === 'running'
      ? 'Counting up live - pauses and stops are saved.'
      : state.mode === 'paused'
        ? 'Paused - resume to keep counting from here.'
        : 'Resumes from this total next time you press Start.';

  return (
    <>
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
            Deep work
          </Text>
          <RevealText
            text="Focus timer."
            className="mt-1 font-syne-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
          />
        </View>

        <GlassCard className="items-center gap-5 p-6">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Total Focus Time
          </Text>
          <Text
            allowFontScaling={false}
            className="font-mono text-4xl leading-none tracking-tight tabular-nums text-white"
            style={{ textShadowColor: 'rgba(207,158,255,0.55)', textShadowRadius: 22 }}>
            {formatHMS(globalTotal)}
          </Text>

          <Pressable
            onPress={() => setCourseOpen(true)}
            disabled={active}
            accessibilityRole="button"
            className={`min-h-[48px] flex-row items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 ${
              active ? 'opacity-50' : ''
            }`}>
            <BookOpen size={16} color={activeCourse?.accent ?? 'rgba(255,255,255,0.5)'} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              className="max-w-[220px] text-base text-white">
              {activeCourse ? activeCourse.title : 'No course selected'}
            </Text>
          </Pressable>

          <View className="w-full">
            <ProgressBar
              percent={progress * 100}
              colors={['#9db4ff', '#cf9eff']}
              height={6}
            />
            <View className="mt-2.5 flex-row items-center justify-center gap-2">
              <View className="rounded-full border border-star/30 bg-star/[0.06] px-4 py-2">
                <Text allowFontScaling={false} className="text-base text-star">
                  {state.targetMin} min target
                </Text>
              </View>
              <View className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
                <Text allowFontScaling={false} className="text-base text-white/40">
                  {state.mode === 'running'
                    ? 'In session'
                    : state.mode === 'paused'
                      ? 'Paused'
                      : 'Idle'}
                </Text>
              </View>
            </View>
          </View>

          <View className="w-full flex-row items-center justify-center gap-3">
            <PrimaryButton
              label={state.mode === 'running' ? 'Pause' : state.mode === 'paused' ? 'Resume' : 'Start'}
              icon={
                state.mode === 'running' ? (
                  <Pause size={16} color="#030305" />
                ) : (
                  <Play size={16} color="#030305" />
                )
              }
              onPress={timer.toggle}
              className="min-w-[140px] flex-1"
            />
            <PrimaryButton
              label={state.mode === 'idle' ? 'Reset' : 'Finish'}
              variant="ghost"
              icon={<RotateCcw size={16} color="#ffffff" />}
              disabled={state.mode === 'idle'}
              onPress={() => {
                timer.stop();
                setTimeout(load, 800);
              }}
              className="flex-1"
            />
          </View>

          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <Text allowFontScaling={false} className="mr-1 text-[15px] text-white/35">
              Target
            </Text>
            {PRESETS.map((min) => {
              const selected = state.targetMin === min;
              return (
                <Pressable
                  key={min}
                  onPress={() => timer.setTarget(min)}
                  disabled={state.mode !== 'idle'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-[48px] rounded-full px-5 py-3 ${
                    selected
                      ? 'border-2 border-[#9db4ff] bg-[#9db4ff]/10'
                      : 'border border-white/10 bg-white/[0.03]'
                  } ${state.mode !== 'idle' ? 'opacity-40' : ''}`}>
                  <Text
                    allowFontScaling={false}
                    className={`text-base ${selected ? 'text-star' : 'text-white/45'}`}>
                    {min}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {flash ? (
            <View className="flex-row items-center gap-2">
              <Check size={16} color="#cf9eff" />
              <Text allowFontScaling={false} className="text-base text-[#cf9eff]/90">
                {flash}
              </Text>
            </View>
          ) : null}

          <Text
            allowFontScaling={false}
            className="max-w-[280px] text-center text-base leading-relaxed text-white/30">
            {hint} Elapsed time is derived from timestamps, not tick counts.
          </Text>
        </GlassCard>

        <GlassCard className="gap-3 p-5">
          <View className="flex-row items-baseline justify-between gap-4">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Session History
            </Text>
            <Text allowFontScaling={false} className="text-base text-white/30">
              {sessions.length} logged
            </Text>
          </View>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#9db4ff" size="large" />
            </View>
          ) : sessions.length === 0 ? (
            <Text
              allowFontScaling={false}
              className="mt-1 text-base leading-relaxed text-white/30">
              No sessions yet - finish a minute or more of focus and it lands
              here.
            </Text>
          ) : (
            <View className="gap-2">
              {sessions.map((session) => (
                <View
                  key={session.id}
                  className="flex-row items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    className="min-w-0 flex-1 text-base text-white/55">
                    {session.courseTitle || session.label || 'Focus session'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    className="shrink-0 font-mono text-[15px] tabular-nums text-white/35">
                    {formatDay(session.startedAt)} · {formatClock(session.startedAt)} -{' '}
                    {formatClock(session.endedAt)}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    className="shrink-0 font-sans-medium text-base text-star/80">
                    {session.minutes} min
                  </Text>
                </View>
              ))}
            </View>
          )}
        </GlassCard>
      </ScrollView>

      <Modal
        visible={courseOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCourseOpen(false)}>
        <View className="flex-1 items-center justify-center p-4">
          <Pressable
            accessibilityLabel="Close course picker"
            onPress={() => setCourseOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />
          <View className="max-h-[70%] w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0a0a1a] p-5 shadow-card">
            <View className="flex-row items-start justify-between gap-4">
              <Text
                allowFontScaling={false}
                className="font-sans-semibold text-lg text-white">
                Course
              </Text>
              <Pressable
                onPress={() => setCourseOpen(false)}
                accessibilityLabel="Close"
                hitSlop={8}
                className="min-h-[48px] justify-center rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3">
                <Text allowFontScaling={false} className="text-base text-white/50">
                  Close
                </Text>
              </Pressable>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => {
                  timer.setCourse(null);
                  setCourseOpen(false);
                }}
                accessibilityRole="button"
                className="mb-2 min-h-[48px] flex-row items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3">
                <Text
                  allowFontScaling={false}
                  className="flex-1 text-base text-white/75">
                  No course
                </Text>
                {state.courseId == null ? (
                  <Check size={16} color="#9db4ff" />
                ) : null}
              </Pressable>

              {courses.map((course) => {
                const selected = state.courseId === course.id;
                return (
                  <Pressable
                    key={course.id}
                    onPress={() => {
                      timer.setCourse(course.id);
                      setCourseOpen(false);
                    }}
                    accessibilityRole="button"
                    className={`mb-2 min-h-[48px] flex-row items-center gap-3 rounded-xl px-5 py-3 ${
                      selected ? 'bg-[#cf9eff]/12' : 'bg-white/[0.04]'
                    }`}>
                    <View
                      className={`h-8 w-8 items-center justify-center rounded-lg border ${
                        selected
                          ? 'border-[#cf9eff]/40 bg-[#cf9eff]/15'
                          : 'border-white/10 bg-white/[0.05]'
                      }`}>
                      <BookOpen size={14} color={course.accent} />
                    </View>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      className={`min-w-0 flex-1 text-base ${
                        selected ? 'font-medium text-white' : 'text-white/75'
                      }`}>
                      {course.title}
                    </Text>
                    {selected ? <Check size={16} color="#cf9eff" /> : null}
                  </Pressable>
                );
              })}

              {courses.length === 0 ? (
                <Text
                  allowFontScaling={false}
                  className="py-4 text-center text-base text-white/40">
                  No courses yet. Create one from the Courses tab.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
