import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  Map as MapIcon,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Card } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { CourseEditorModal } from "../components/courses/course-editor-modal";
import { useCourses } from "../hooks/use-courses";
import {
  createCourse,
  createTopic,
  deleteCourse,
  nextTopic,
  setTopicStatus,
  topicCounts,
} from "../lib/db/courses";
import type { Course, CourseStatus, CourseTopic } from "../lib/db/types";
import { fetchRoadmapProgressByCourse } from "../lib/db/roadmaps";
import type { RoadmapCourseProgress } from "../lib/db/roadmaps";
import {
  FOCUS_CHANGED_EVENT,
  ROADMAPS_CHANGED_EVENT,
  listen,
} from "../lib/events";
import { colors, fonts } from "../theme/theme";

const STATUS_TEXT: Record<CourseStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Complete",
};

/** Compact lifetime focus label, e.g. "3h 05m" / "12m". */
function formatFocus(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

interface CourseCardProps {
  course: Course;
  roadmap: RoadmapCourseProgress | null;
  formOpen: boolean;
  topicTitle: string;
  busy: boolean;
  onTopicTitleChange: (value: string) => void;
  onOpenTopicForm: (courseId: number) => void;
  onCloseTopicForm: () => void;
  onSubmitTopic: (courseId: number) => void;
  onToggleTopic: (course: Course, topic: CourseTopic) => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
}

function CourseCard({
  course,
  roadmap,
  formOpen,
  topicTitle,
  busy,
  onTopicTitleChange,
  onOpenTopicForm,
  onCloseTopicForm,
  onSubmitTopic,
  onToggleTopic,
  onEdit,
  onDelete,
}: CourseCardProps) {
  const router = useRouter();
  const { total, done } = topicCounts(course);
  // A linked roadmap is the source of truth for the ring: 3/10 levels → 30%.
  const progress = Math.max(
    0,
    Math.min(100, roadmap ? roadmap.percent : course.progress_percentage),
  );
  const next = nextTopic(course);
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <Card padded={false} style={styles.courseCard}>
      <LinearGradient
        colors={["transparent", course.accent, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.hairline}
        pointerEvents="none"
      />

      <View style={styles.cardTop}>
        <View style={styles.cardTopText}>
          <Text numberOfLines={1} style={styles.courseSource}>
            {course.description || "Self-paced"}
          </Text>
          <Text style={styles.courseTitle}>{course.title}</Text>
        </View>
        <Svg width={64} height={64} viewBox="0 0 64 64">
          <SvgCircle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="5"
          />
          <SvgCircle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke={course.accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 32 32)"
          />
        </Svg>
      </View>

      <View style={styles.pillRow}>
        {roadmap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View roadmap for ${course.title}`}
            onPress={() =>
              router.push(`/roadmap?courseId=${course.id}` as Href)
            }
            style={({ pressed }) => [
              styles.roadmapPill,
              pressed && styles.pillPressed,
            ]}
          >
            <MapIcon size={12} color="#c4b5fd" />
            <Text numberOfLines={1} style={styles.roadmapPillText}>
              View Roadmap
            </Text>
            <Text style={styles.roadmapPillCount}>
              {roadmap.completed}/{roadmap.total}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open notes for ${course.title}`}
          onPress={() => router.push(`/notes?courseId=${course.id}` as Href)}
          style={({ pressed }) => [
            styles.notesPill,
            pressed && styles.pillPressed,
          ]}
        >
          <BookOpen size={12} color={colors.w70} />
          <Text style={styles.notesPillText}>Notes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start a focus session for ${course.title}`}
          onPress={() => router.push(`/timer?courseId=${course.id}`)}
          style={({ pressed }) => [
            styles.focusPill,
            pressed && styles.pillPressed,
          ]}
        >
          <Play size={12} color={colors.star} />
          <Text style={styles.focusPillText}>Start Focus</Text>
        </Pressable>
      </View>

      <Text style={styles.progressLine}>
        {roadmap
          ? `${roadmap.completed}/${roadmap.total} levels · ${Math.round(progress)}%`
          : `${done}/${total} topics · ${Math.round(progress)}%`}
        <Text style={styles.progressLineDim}>
          {" · "}
          {formatFocus(course.total_focus_seconds)} focused
        </Text>
      </Text>

      <View style={styles.topicRow}>
        {course.topics.length === 0 ? (
          <Text style={styles.noTopics}>
            No topics yet - add the first one below.
          </Text>
        ) : (
          course.topics.map((topic) => {
            const complete = topic.status === "completed";
            return (
              <Pressable
                key={topic.id}
                accessibilityRole="button"
                accessibilityLabel={
                  complete
                    ? `Mark ${topic.title} as not started`
                    : `Mark ${topic.title} as complete`
                }
                disabled={busy}
                onPress={() => onToggleTopic(course, topic)}
                style={({ pressed }) => [
                  styles.topicChip,
                  complete && styles.topicChipComplete,
                  pressed && styles.pillPressed,
                ]}
              >
                {complete ? <Check size={12} color={colors.lilac} /> : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.topicChipText,
                    complete && styles.topicChipTextComplete,
                  ]}
                >
                  {topic.title}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text numberOfLines={1} style={styles.nextTopic}>
          {next ? next.title : "Add a topic to begin"}
        </Text>
        <View style={styles.cardActions}>
          {course.status === "completed" ? (
            <View style={styles.completeTag}>
              <CheckCircle2 size={14} color="rgba(207,158,255,0.8)" />
              <Text style={styles.completeTagText}>Complete</Text>
            </View>
          ) : (
            <Text style={[styles.statusText, { color: course.accent }]}>
              {STATUS_TEXT[course.status]}
            </Text>
          )}
          <View style={styles.actionDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${course.title}`}
            onPress={() => onEdit(course)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pillPressed,
            ]}
          >
            <Pencil size={14} color={colors.w45} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${course.title}`}
            onPress={() => onDelete(course)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pillPressed,
            ]}
          >
            <Trash2 size={14} color={colors.w45} />
          </Pressable>
        </View>
      </View>

      <View style={styles.addTopicWrap}>
        {formOpen ? (
          <View style={styles.addTopicRow}>
            <TextInput
              autoFocus
              value={topicTitle}
              onChangeText={onTopicTitleChange}
              placeholder="Topic title"
              placeholderTextColor={colors.w30}
              maxLength={160}
              editable={!busy}
              onSubmitEditing={() => onSubmitTopic(course.id)}
              style={styles.addTopicInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => onSubmitTopic(course.id)}
              disabled={busy || !topicTitle.trim()}
              style={({ pressed }) => [
                styles.addTopicButton,
                pressed && styles.pillPressed,
                (busy || !topicTitle.trim()) && styles.disabled,
              ]}
            >
              <Text style={styles.addTopicButtonText}>Add</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel adding a topic"
              onPress={onCloseTopicForm}
              hitSlop={6}
              style={styles.addTopicCancel}
            >
              <X size={14} color={colors.w40} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add topic to ${course.title}`}
            onPress={() => onOpenTopicForm(course.id)}
            style={styles.addTopicLink}
          >
            <Plus size={14} color={colors.w35} />
            <Text style={styles.addTopicLinkText}>Add topic</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

export default function CoursesScreen() {
  const { courses, setCourses, loading, reload } = useCourses();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicFor, setTopicFor] = useState<number | null>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Course | null>(null);
  const [roadmaps, setRoadmaps] = useState<
    Map<number, RoadmapCourseProgress>
  >(() => new Map());

  const loadRoadmaps = useCallback(async () => {
    try {
      setRoadmaps(await fetchRoadmapProgressByCourse());
    } catch {
      setRoadmaps(new Map());
    }
  }, []);

  // Roadmap saves can auto-create a course, so refresh both lists together.
  // Course/topic rows themselves are refreshed by every useCourses instance
  // on COURSES_CHANGED, so this listener only covers roadmap progress and
  // focus counters.
  const refresh = useCallback(() => {
    void loadRoadmaps();
    void reload();
  }, [loadRoadmaps, reload]);

  useEffect(() => {
    void refresh();
    const unwatchRoadmaps = listen(ROADMAPS_CHANGED_EVENT, refresh);
    const unwatchFocus = listen(FOCUS_CHANGED_EVENT, refresh);
    return () => {
      unwatchRoadmaps();
      unwatchFocus();
    };
  }, [refresh]);

  const submitCourse = async () => {
    if (busy) return;
    if (!title.trim()) {
      setError("Give the course a title.");
      return;
    }
    setBusy(true);
    setError(null);
    const created = await createCourse(title, description);
    if (!created) {
      setError("Could not create the course. Check your connection.");
    }
    setTitle("");
    setDescription("");
    setShowForm(false);
    setBusy(false);
    await reload();
  };

  const submitTopic = async (courseId: number) => {
    if (busy || !topicTitle.trim()) return;
    setBusy(true);
    await createTopic(courseId, topicTitle);
    setTopicTitle("");
    setTopicFor(null);
    setBusy(false);
    await reload();
  };

  const toggleTopic = async (course: Course, topic: CourseTopic) => {
    const next: CourseStatus =
      topic.status === "completed" ? "not_started" : "completed";

    setCourses((prev) =>
      prev.map((row) =>
        row.id !== course.id
          ? row
          : {
              ...row,
              topics: row.topics.map((item) =>
                item.id === topic.id
                  ? {
                      ...item,
                      status: next,
                      completed_at:
                        next === "completed"
                          ? new Date().toISOString()
                          : null,
                    }
                  : item,
              ),
            },
      ),
    );

    await setTopicStatus(course.id, topic.id, next);
    await reload();
  };

  const confirmDeleteCourse = async () => {
    const course = confirmTarget;
    if (!course) return;
    setConfirmTarget(null);
    setBusy(true);
    setError(null);
    const removed = await deleteCourse(course.id);
    setBusy(false);

    if (!removed) {
      setError("Could not delete the course. Check your connection.");
      return;
    }
    setEditing((current) => (current?.id === course.id ? null : current));
    await reload();
    await loadRoadmaps();
  };

  const empty = !loading && courses.length === 0;

  return (
    <ScreenShell title="Courses" activeLabel="Courses">
      <ScreenHeading
        eyebrow="Syllabus"
        title="Courses on the wall."
        subtitle={
          courses.length === 0
            ? "Build a course, break it into topics, then tick them off as you climb."
            : `${courses.length} course${courses.length === 1 ? "" : "s"} tracked. Progress follows your focus sessions.`
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showForm ? "Cancel new course" : "New course"}
        onPress={() => setShowForm((value) => !value)}
        style={({ pressed }) => [
          styles.newCoursePill,
          pressed && styles.pillPressed,
        ]}
      >
        {showForm ? (
          <X size={16} color={colors.white} />
        ) : (
          <Plus size={16} color={colors.white} />
        )}
        <Text style={styles.newCoursePillText}>
          {showForm ? "Cancel" : "New course"}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showForm ? (
        <View style={styles.formCard}>
          <View>
            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Systems Design Primer"
              placeholderTextColor={colors.w30}
              maxLength={160}
              style={styles.formField}
            />
          </View>
          <View>
            <Text style={styles.formLabel}>Source</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="ByteGrad"
              placeholderTextColor={colors.w30}
              maxLength={160}
              style={styles.formField}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void submitCourse()}
            disabled={busy}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pillPressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : null}
            <Text style={styles.createButtonText}>
              {busy ? "Saving…" : "Create"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {empty ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Compass size={20} color={colors.w40} />
          </View>
          <View style={styles.emptyTextWrap}>
            <Text style={styles.emptyEyebrow}>Empty syllabus</Text>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading your courses…" : "No courses yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {loading
                ? "Reading from Supabase."
                : "Create your first course and it will show up on Today’s Focus immediately."}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.cardList}>
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              roadmap={roadmaps.get(course.id) ?? null}
              formOpen={topicFor === course.id}
              topicTitle={topicTitle}
              busy={busy}
              onTopicTitleChange={setTopicTitle}
              onOpenTopicForm={(courseId) => {
                setTopicFor(courseId);
                setTopicTitle("");
              }}
              onCloseTopicForm={() => {
                setTopicFor(null);
                setTopicTitle("");
              }}
              onSubmitTopic={(courseId) => void submitTopic(courseId)}
              onToggleTopic={(course, topic) => void toggleTopic(course, topic)}
              onEdit={(course) => setEditing(course)}
              onDelete={(course) => setConfirmTarget(course)}
            />
          ))}
        </View>
      )}

      <CourseEditorModal
        course={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void reload();
          void loadRoadmaps();
        }}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete course?"
        message={`This will also permanently delete its associated roadmap, progress and notes for "${confirmTarget?.title ?? ""}". This cannot be undone.`}
        onConfirm={() => void confirmDeleteCourse()}
        onCancel={() => setConfirmTarget(null)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  newCoursePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newCoursePillText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  pillPressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(252,165,165,0.85)",
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 20,
    gap: 14,
  },
  formLabel: {
    marginBottom: 6,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  formField: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 13,
    shadowColor: colors.star,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.primaryText,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 24,
    overflow: "hidden",
  },
  emptyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  emptyEyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  emptyTitle: {
    marginTop: 6,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    color: colors.white,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  cardList: {
    gap: 20,
  },
  courseCard: {
    padding: 24,
    borderRadius: 24,
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  cardTopText: {
    flex: 1,
    minWidth: 0,
  },
  courseSource: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  courseTitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fonts.medium,
    letterSpacing: -0.3,
    color: colors.white,
  },
  pillRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  roadmapPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.35)",
    backgroundColor: "rgba(168,85,247,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roadmapPillText: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#c4b5fd",
  },
  roadmapPillCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  notesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w15,
    backgroundColor: colors.w05,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notesPillText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w70,
  },
  focusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.star30,
    backgroundColor: colors.star10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  focusPillText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.star,
  },
  progressLine: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  progressLineDim: {
    color: colors.w30,
  },
  topicRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  noTopics: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topicChipComplete: {
    borderColor: "rgba(207,158,255,0.35)",
    backgroundColor: "rgba(207,158,255,0.12)",
  },
  topicChipText: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  topicChipTextComplete: {
    color: colors.lilac,
  },
  cardFooter: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  nextTopic: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  completeTagText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(207,158,255,0.8)",
  },
  statusText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.w08,
  },
  iconButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    padding: 6,
  },
  addTopicWrap: {
    marginTop: 16,
  },
  addTopicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addTopicInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  addTopicButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w06,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  addTopicButtonText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  addTopicCancel: {
    padding: 8,
  },
  addTopicLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  addTopicLinkText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
});
