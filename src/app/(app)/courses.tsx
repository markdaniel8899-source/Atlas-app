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
import { LinearGradient } from 'expo-linear-gradient';
import { Circle, Svg } from 'react-native-svg';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  Map as MapIcon,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import {
  createCourse,
  createTopic,
  deleteCourse,
  fetchCourses,
  nextTopic,
  setTopicStatus,
} from '@/lib/db/courses';
import type { Course, CourseStatus } from '@/lib/db/types';
import { toastInfo, toastSuccess } from '@/lib/toast';

const STATUS_TEXT: Record<CourseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Complete',
};

function formatFocus(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function ProgressRing({ progress, accent }: { progress: number; accent: string }) {
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return (
    <Svg
      width={64}
      height={64}
      viewBox="0 0 64 64"
      style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={32}
        cy={32}
        r={26}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={5}
      />
      <Circle
        cx={32}
        cy={32}
        r={26}
        fill="none"
        stroke={accent}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
      />
    </Svg>
  );
}

export default function CoursesScreen() {
  const userId = useUserId();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [topicFor, setTopicFor] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicDrafts, setTopicDrafts] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    if (!userId) return;
    void fetchCourses(userId).then((rows) => {
      setCourses(rows);
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
    if (!title.trim()) {
      setError('Give the course a title.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createCourse(userId, title, description);
      if (created) {
        toastSuccess('Course created', `"${created.title}" added to your syllabus.`);
        setTitle('');
        setDescription('');
        setShowForm(false);
        setExpanded(created.id);
        load();
      } else {
        setError('Could not create the course. Check your connection.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAddTopic = async (courseId: number) => {
    if (!userId) return;
    const draft = (topicDrafts[courseId] ?? '').trim();
    if (!draft) return;
    const created = await createTopic(userId, courseId, draft);
    if (created) {
      toastSuccess('Topic added');
      setTopicDrafts((prev) => ({ ...prev, [courseId]: '' }));
      setTopicFor(null);
      load();
    }
  };

  const handleToggleTopic = (courseId: number, topicId: number, done: boolean) => {
    void setTopicStatus(courseId, topicId, done ? 'not_started' : 'completed').then(
      load,
    );
  };

  const handleDelete = (course: Course) => {
    Alert.alert(
      'Delete course?',
      `This also removes "${course.title}"'s roadmap, topics and notes. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            void deleteCourse(userId, course.id).then(() => {
              toastInfo('Course deleted');
              load();
            });
          },
        },
      ],
    );
  };

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
          Syllabus
        </Text>
        <RevealText
          text="Courses on the wall."
          className="mt-1 font-display-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
        <Text
          allowFontScaling={false}
          className="mt-1 text-base leading-[26px] text-white/45">
          {courses.length === 0
            ? 'Build a course, break it into topics, then tick them off as you climb.'
            : `${courses.length} course${courses.length === 1 ? '' : 's'} tracked. Progress follows your focus sessions.`}
        </Text>
        <PrimaryButton
          variant="ghost"
          compact
          className="mt-3 self-start"
          label={showForm ? 'Cancel' : 'New course'}
          icon={
            showForm ? (
              <X size={16} color="#ffffff" />
            ) : (
              <Plus size={16} color="#ffffff" />
            )
          }
          onPress={() => setShowForm((value) => !value)}
        />
      </View>

      {error ? (
        <Text allowFontScaling={false} className="text-base text-red-300/85">
          {error}
        </Text>
      ) : null}

      {showForm ? (
        <GlassCard className="gap-3 p-5">
          <View className="gap-1.5">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Title
            </Text>
            <TextInput
              allowFontScaling={false}
              value={title}
              onChangeText={setTitle}
              placeholder="Systems Design Primer"
              placeholderTextColor="rgba(255,255,255,0.25)"
              maxLength={160}
              className="min-h-[52px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-sans text-base text-white"
            />
          </View>
          <View className="gap-1.5">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Source
            </Text>
            <TextInput
              allowFontScaling={false}
              value={description}
              onChangeText={setDescription}
              placeholder="ByteGrad"
              placeholderTextColor="rgba(255,255,255,0.25)"
              maxLength={160}
              className="min-h-[52px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-sans text-base text-white"
            />
          </View>
          <PrimaryButton
            label={creating ? 'Saving...' : 'Create'}
            loading={creating}
            onPress={() => void handleCreate()}
          />
        </GlassCard>
      ) : null}

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#9db4ff" size="large" />
        </View>
      ) : courses.length === 0 ? (
        <GlassCard className="p-8">
          <View className="flex-row items-start gap-4">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Compass size={20} color="rgba(255,255,255,0.4)" />
            </View>
            <View className="flex-1 gap-1.5">
              <Text
                allowFontScaling={false}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                Empty syllabus
              </Text>
              <Text
                allowFontScaling={false}
                className="mt-1 font-sans-semibold text-xl tracking-[-0.03em] text-white">
                No courses yet
              </Text>
              <Text
                allowFontScaling={false}
                className="text-base leading-[26px] text-white/45">
                {"Create your first course and it will show up on Today's Focus immediately."}
              </Text>
            </View>
          </View>
        </GlassCard>
      ) : (
        courses.map((course) => {
          const open = expanded === course.id;
          const formOpen = topicFor === course.id;
          const done = course.topics.filter((t) => t.status === 'completed').length;
          const total = course.topics.length;
          const progress = Math.max(0, Math.min(100, course.progress_percentage));
          const next = nextTopic(course);
          return (
            <GlassCard key={course.id} className="p-6">
              <View
                pointerEvents="none"
                className="absolute inset-x-0 top-0 h-px">
                <LinearGradient
                  colors={['transparent', course.accent, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-full w-full"
                />
              </View>

              <Pressable
                onPress={() => setExpanded(open ? null : course.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                className="flex-row items-start justify-between gap-4">
                <View className="min-w-0 flex-1 gap-2">
                  <Text
                    allowFontScaling={false}
                    className="text-[15px] uppercase tracking-[0.2em] text-white/35">
                    {course.description || 'Self-paced'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    className="font-sans-medium text-base leading-snug tracking-tight text-white">
                    {course.title}
                  </Text>
                </View>
                <ProgressRing progress={progress} accent={course.accent} />
              </Pressable>

              <View className="mt-4 flex-row flex-wrap gap-1.5">
                <Pressable
                  onPress={() => router.push('/roadmap')}
                  accessibilityRole="link"
                  className="min-h-[48px] flex-row items-center gap-1.5 rounded-full border border-[#cf9eff]/30 bg-[#cf9eff]/10 px-5 py-3">
                  <MapIcon size={12} color="#cf9eff" />
                  <Text
                    allowFontScaling={false}
                    className="text-base text-[#cf9eff]">
                    View Roadmap
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/notes')}
                  accessibilityRole="link"
                  className="min-h-[48px] flex-row items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3">
                  <BookOpen size={12} color="rgba(255,255,255,0.7)" />
                  <Text allowFontScaling={false} className="text-base text-white/70">
                    Notes
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/timer')}
                  accessibilityRole="link"
                  className="min-h-[48px] flex-row items-center gap-1.5 rounded-full border border-[#9db4ff]/30 bg-[#9db4ff]/[0.08] px-5 py-3">
                  <Play size={12} color="#9db4ff" />
                  <Text allowFontScaling={false} className="text-base text-[#9db4ff]">
                    Start Focus
                  </Text>
                </Pressable>
              </View>

              <Text
                allowFontScaling={false}
                className="mt-4 text-base text-white/40">
                {done}/{total} topics · {Math.round(progress)}%
                <Text allowFontScaling={false} className="text-white/30">
                  {' · '}
                  {formatFocus(course.total_focus_seconds)} focused
                </Text>
              </Text>

              <View className="mt-4 flex-row flex-wrap gap-1.5">
                {course.topics.length === 0 ? (
                  <Text
                    allowFontScaling={false}
                    className="text-base text-white/30">
                    No topics yet - add the first one below.
                  </Text>
                ) : (
                  course.topics.map((topic) => {
                    const complete = topic.status === 'completed';
                    return (
                      <Pressable
                        key={topic.id}
                        onPress={() =>
                          handleToggleTopic(course.id, topic.id, complete)
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: complete }}
                        className={`min-h-[48px] flex-row items-center gap-1.5 rounded-full border px-5 py-3 ${
                          complete
                            ? 'border-[#cf9eff]/35 bg-[#cf9eff]/[0.12]'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}>
                        {complete ? <Check size={12} color="#cf9eff" /> : null}
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          className={`max-w-[200px] text-base ${
                            complete ? 'text-[#cf9eff]' : 'text-white/45'
                          }`}>
                          {topic.title}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <View className="mt-5 flex-row items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  className="min-w-0 flex-1 text-base text-white/45">
                  {next ? next.title : 'Add a topic to begin'}
                </Text>
                <View className="flex-row shrink-0 items-center gap-2">
                  {course.status === 'completed' ? (
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={14} color="rgba(207,158,255,0.8)" />
                      <Text
                        allowFontScaling={false}
                        className="text-base text-[#cf9eff]/80">
                        Complete
                      </Text>
                    </View>
                  ) : (
                    <Text
                      allowFontScaling={false}
                      className="text-base"
                      style={{ color: course.accent }}>
                      {STATUS_TEXT[course.status]}
                    </Text>
                  )}
                  <View className="h-4 w-px bg-white/[0.08]" />
                  <Pressable
                    onPress={() => handleDelete(course)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${course.title}`}
                    hitSlop={8}
                    className="h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Trash2 size={14} color="rgba(255,255,255,0.45)" />
                  </Pressable>
                </View>
              </View>

              <View className="mt-4">
                {formOpen ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      allowFontScaling={false}
                      autoFocus
                      value={topicDrafts[course.id] ?? ''}
                      onChangeText={(v) =>
                        setTopicDrafts((prev) => ({ ...prev, [course.id]: v }))
                      }
                      placeholder="Topic title"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      maxLength={160}
                      onSubmitEditing={() => void handleAddTopic(course.id)}
                      className="min-h-[52px] min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3.5 font-sans text-base text-white"
                    />
                    <Pressable
                      onPress={() => void handleAddTopic(course.id)}
                      accessibilityRole="button"
                      className="min-h-[48px] justify-center rounded-lg border border-white/10 bg-white/[0.06] px-6 py-3">
                      <Text
                        allowFontScaling={false}
                        className="text-base text-white">
                        Add
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setTopicFor(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel adding a topic"
                      className="min-h-[48px] min-w-[48px] items-center justify-center">
                      <X size={14} color="rgba(255,255,255,0.4)" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setTopicFor(course.id)}
                    accessibilityRole="button"
                    className="min-h-[48px] flex-row items-center gap-1.5 px-6 py-3">
                    <Plus size={14} color="rgba(255,255,255,0.35)" />
                    <Text
                      allowFontScaling={false}
                      className="text-base text-white/35">
                      Add topic
                    </Text>
                  </Pressable>
                )}
              </View>
            </GlassCard>
          );
        })
      )}
    </ScrollView>
  );
}
