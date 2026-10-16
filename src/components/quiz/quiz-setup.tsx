import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react-native";
import { SelectMenu } from "../ui/select-menu";
import type { SelectOption } from "../ui/select-menu";
import type { Difficulty, NativeFile } from "../../lib/ai";
import type { Course } from "../../lib/db/types";
import { fetchNotes } from "../../lib/db/notes";
import { fetchLatestRoadmap } from "../../lib/db/roadmaps";
import { inferSubject, textMatchesTopic } from "../../lib/subjects";
import type { GenerateInput, KindChoice } from "../../lib/quiz";
import { KIND_HINT, KIND_LABEL, QUIZ_KINDS } from "../../lib/quiz";
import {
  CUSTOM_TOPIC_ICON,
  COURSE_ICON,
  DIFFICULTY_ICON,
  FIELD_ICON,
  GENERAL_COURSE_ICON,
  KIND_ICON,
  TOPIC_ICON,
} from "./icons";
import type { QuizIcon } from "./icons";
import { colors, fonts } from "../../theme/theme";

const CUSTOM = "__custom";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const DIFFICULTIES: SelectOption<string>[] = [
  {
    value: "easy",
    label: "Easy",
    hint: "Gentle warm-up",
    icon: DIFFICULTY_ICON.easy,
  },
  {
    value: "medium",
    label: "Medium",
    hint: "Balanced challenge",
    icon: DIFFICULTY_ICON.medium,
  },
  {
    value: "hard",
    label: "Hard",
    hint: "Push your limits",
    icon: DIFFICULTY_ICON.hard,
  },
];

const COUNTS = [5, 10, 15];

/** Backend caps `context` at 4000 chars - stay under it. */
const CONTEXT_CAP = 3800;

function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|\/td)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Course syllabus + roadmap progress + saved notes, so the AI can build the
 * quiz from what the learner actually studied. Notes are strictly scoped:
 * with a course, only that course's notes; without one, only notes that
 * match the custom topic's subject (foreign-subject notes never travel).
 * Never throws: a missing piece of context just drops out of the string.
 */
async function buildLearnerContext(
  course: Course | null,
  topic: string,
): Promise<string> {
  const parts: string[] = [];

  if (course) {
    parts.push(`Course: ${course.title}`);
    if (course.description.trim()) {
      parts.push(`Course description: ${course.description.trim()}`);
    }
    parts.push(`Course progress: ${Math.round(course.progress_percentage)}%`);
    if (course.topics.length > 0) {
      const done = course.topics.filter(
        (item) => item.status === "completed",
      ).length;
      parts.push(
        `Syllabus (${done}/${course.topics.length} completed): ` +
          course.topics
            .map((item) => `${item.title} [${item.status}]`)
            .join("; "),
      );
    }
  }

  try {
    const roadmap = await fetchLatestRoadmap(course ? course.id : undefined);
    if (roadmap && roadmap.nodes.length > 0) {
      const completed = roadmap.nodes.filter(
        (node) => node.status === "completed",
      );
      const active = roadmap.nodes.filter((node) => node.status === "active");
      parts.push(`Roadmap: ${roadmap.title}`);
      parts.push(
        `Roadmap progress: ${completed.length}/${roadmap.nodes.length} levels completed`,
      );
      if (completed.length > 0) {
        parts.push(
          `Levels already studied: ${completed
            .slice(0, 12)
            .map((node) => node.title)
            .join("; ")}`,
        );
      }
      if (active.length > 0) {
        parts.push(
          `Current levels: ${active
            .slice(0, 6)
            .map((node) => node.title)
            .join("; ")}`,
        );
      }
    }
  } catch {
    // No roadmap - the course-only fallback covers this.
  }

  try {
    const notes = course
      ? await fetchNotes({
          courseId: course.id,
          topicIds: course.topics.map((item) => item.id),
        })
      : await fetchNotes();
    const excerpts = notes
      .map((note) => ({
        entry: `${note.title}: ${htmlToText(note.html)}`,
        subject: `${note.title} ${htmlToText(note.html)}`,
      }))
      .filter(({ entry }) => entry.length > 0)
      // No course: only same-subject notes may travel - an English quiz
      // never carries Python notes (backend re-checks this too).
      .filter(({ subject }) => course || textMatchesTopic(topic, subject))
      .slice(0, 4)
      .map(({ entry }) => entry.slice(0, 700));
    if (excerpts.length > 0) {
      parts.push(`Saved notes:\n${excerpts.join("\n---\n")}`);
    }
  } catch {
    // No notes available.
  }

  return parts.join("\n").slice(0, CONTEXT_CAP);
}

interface QuizSetupProps {
  courses: Course[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onGenerate: (input: GenerateInput) => void;
}

export function QuizSetup({
  courses,
  loading,
  busy,
  error,
  onGenerate,
}: QuizSetupProps) {
  const [courseId, setCourseId] = useState("");
  const [topicChoice, setTopicChoice] = useState(CUSTOM);
  const [customTopic, setCustomTopic] = useState("");
  const [kind, setKind] = useState<KindChoice>("mixed");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [pdfFile, setPdfFile] = useState<NativeFile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const course = useMemo(
    () => courses.find((item) => String(item.id) === courseId) ?? null,
    [courses, courseId],
  );

  // §7: the Mixed set subtitle follows the domain the backend will use -
  // the course when one is selected, otherwise the typed topic. Unknown
  // domain keeps the original wording.
  const kindOptions = useMemo<SelectOption<string>[]>(() => {
    const domainText = course
      ? `${course.title} ${course.topics.map((item) => item.title).join(" ")}`
      : customTopic;
    const subject = inferSubject(domainText);
    const mixedHint =
      subject && subject !== "Programming"
        ? "Mixed styles (MCQ)"
        : "All four types, shuffled";
    return [
      {
        value: "mixed",
        label: KIND_LABEL.mixed,
        hint: mixedHint,
        icon: KIND_ICON.mixed as QuizIcon,
      },
      ...QUIZ_KINDS.map((item) => ({
        value: item,
        label: KIND_LABEL[item],
        hint: KIND_HINT[item],
        icon: KIND_ICON[item] as QuizIcon,
      })),
    ];
  }, [course, customTopic]);

  const courseOptions = useMemo<SelectOption<string>[]>(
    () => [
      {
        value: "",
        label: "General",
        hint: "No course attached",
        icon: GENERAL_COURSE_ICON,
      },
      ...courses.map((item) => ({
        value: String(item.id),
        label: item.title,
        icon: COURSE_ICON,
        hint:
          item.topics.length > 0 ? `${item.topics.length} topics` : "No topics yet",
      })),
    ],
    [courses],
  );

  const topicOptions = useMemo<SelectOption<string>[]>(() => {
    const topics = (course?.topics ?? []).map((item) => ({
      value: `t:${item.id}`,
      label: item.title,
      icon: TOPIC_ICON,
      hint: item.status === "completed" ? "Completed" : "Open",
    }));
    return [
      ...topics,
      {
        value: CUSTOM,
        label: "Custom topic",
        hint: "Type your own",
        icon: CUSTOM_TOPIC_ICON,
      },
    ];
  }, [course]);

  // Keep a still-valid syllabus topic pick; otherwise fall back to the
  // custom box (empty focus -> the backend quizzes the whole course's
  // completed topics). Keyed on ids, NOT on the course object identity, so
  // background courses refreshes (useCourses auto-reload) never stomp the
  // user's pick.
  const topicChoiceKey = `${courseId}:${(course?.topics ?? [])
    .map((item) => item.id)
    .join(",")}`;
  useEffect(() => {
    setTopicChoice((choice) => {
      if (
        choice !== CUSTOM &&
        course?.topics.some((item) => `t:${item.id}` === choice)
      ) {
        return choice;
      }
      return CUSTOM;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see key above
  }, [topicChoiceKey]);

  // The selected course may have been deleted on another page: clear the
  // stale id once the refreshed list proves it is gone.
  useEffect(() => {
    if (loading) return;
    if (
      courseId !== "" &&
      courses.every((item) => String(item.id) !== courseId)
    ) {
      setCourseId("");
    }
  }, [courses, courseId, loading]);

  const pdfName = pdfFile ? pdfFile.name.replace(/\.pdf$/i, "") : "";

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const size = asset.size ?? 0;
      const isPdf =
        asset.mimeType === "application/pdf" ||
        asset.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setLocalError("Only PDF files are supported.");
        return;
      }
      if (size > MAX_PDF_BYTES) {
        setLocalError("The PDF must be 10 MB or smaller.");
        return;
      }
      setLocalError(null);
      setPdfFile({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/pdf",
      });
    } catch {
      setLocalError("Could not open the file picker. Try again.");
    }
  };

  const resolvedTopic = (() => {
    if (topicChoice !== CUSTOM) {
      const match = course?.topics.find(
        (item) => `t:${item.id}` === topicChoice,
      );
      if (match) return match.title;
    }
    // The PDF file name doubles as the topic only for a General quiz; with
    // a course it would turn into a bogus focus instruction (the backend
    // uses the PDF itself whenever one is uploaded).
    return (
      customTopic.trim() || (!course && pdfFile ? pdfName.slice(0, 300) : "")
    );
  })();

  const showTopicText = topicChoice === CUSTOM;

  const submit = async () => {
    // A selected course is enough: the backend scopes the quiz to it even
    // when no focus text is typed.
    if (resolvedTopic.length < 2 && !course) {
      setLocalError(
        "Give the quiz a topic of at least 2 characters, or upload a PDF syllabus.",
      );
      return;
    }
    if (resolvedTopic.length > 300) {
      setLocalError("Keep the topic under 300 characters.");
      return;
    }
    setLocalError(null);
    // An empty focus box with a course stays empty: the backend then runs
    // mode `course` over the completed topics instead of treating the
    // course title as a focus instruction.
    const topic = resolvedTopic;
    const attachedCourseId = course ? Number(course.id) : null;
    // Without a course, name the topic's subject so the backend scopes the
    // notes to it (English quiz never receives Python notes).
    const subject = course ? "" : (inferSubject(topic) ?? "");
    setPreparing(true);
    try {
      const context = await buildLearnerContext(course, topic);
      onGenerate({
        topic,
        kind,
        count,
        difficulty: difficulty as Difficulty,
        context,
        courseId: attachedCourseId,
        subject,
        pdf: pdfFile,
      });
    } catch {
      onGenerate({
        topic,
        kind,
        count,
        difficulty: difficulty as Difficulty,
        context: course ? `Course: ${course.title}` : "",
        courseId: attachedCourseId,
        subject,
        pdf: pdfFile,
      });
    } finally {
      setPreparing(false);
    }
  };

  const message = localError ?? error;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <BookOpen size={18} color={colors.lilac} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardEyebrow}>Assessment</Text>
          <Text style={styles.cardTitle}>
            Choose what you want to be tested on
          </Text>
        </View>
      </View>

      <View style={styles.formWrap}>
        <SelectMenu
          label="Course"
          labelIcon={FIELD_ICON.course}
          value={courseId}
          options={courseOptions}
          onChange={(next) => {
            setCourseId(next);
            setLocalError(null);
          }}
        />
        <SelectMenu
          label="Topic"
          labelIcon={FIELD_ICON.topic}
          value={topicChoice}
          options={topicOptions}
          onChange={(next) => {
            setTopicChoice(next);
            setLocalError(null);
          }}
        />

        {showTopicText ? (
          <View>
            <Text style={styles.label}>
              {course ? "Focus (optional)" : "Topic to quiz"}
            </Text>
            <TextInput
              value={customTopic}
              onChangeText={setCustomTopic}
              maxLength={300}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={
                course
                  ? "e.g. loops and functions only"
                  : "e.g., Python list comprehensions, CSS grid, Big-O notation"
              }
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={styles.field}
            />
            <Text style={styles.fieldHint}>
              {loading
                ? "Loading your courses..."
                : "Pick a course above, or leave this empty and quiz from an uploaded PDF."}
            </Text>
          </View>
        ) : null}

        <View>
          <Text style={styles.label}>Syllabus PDF (optional)</Text>
          <View style={styles.pdfTile}>
            {pdfFile ? (
              <>
                <View style={styles.pdfIconActive}>
                  <FileText size={16} color={colors.lilac} />
                </View>
                <View style={styles.pdfTextWrap}>
                  <Text numberOfLines={1} style={styles.pdfName}>
                    {pdfFile.name}
                  </Text>
                  <Text style={styles.pdfMeta}>
                    read once for this quiz, then deleted. Never stored.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove uploaded PDF"
                  onPress={() => setPdfFile(null)}
                  style={({ pressed }) => [
                    styles.pdfRemove,
                    pressed && styles.pressed,
                  ]}
                >
                  <X size={16} color={colors.w50} />
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload PDF syllabus"
                onPress={() => void pickPdf()}
                style={styles.pdfPickRow}
              >
                <View style={styles.pdfIconIdle}>
                  <Upload size={16} color={colors.star70} />
                </View>
                <View style={styles.pdfTextWrap}>
                  <Text style={styles.pdfPickTitle}>
                    Upload PDF / Syllabus
                  </Text>
                  <Text style={styles.pdfMeta}>
                    Tap to pick - optional, up to 10 MB. The AI reads it for
                    this quiz only, then it is permanently deleted.
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        <SelectMenu
          label="Question type"
          labelIcon={FIELD_ICON.kind}
          value={kind}
          options={kindOptions}
          onChange={(next) => setKind(next as KindChoice)}
        />
        <SelectMenu
          label="Difficulty"
          labelIcon={FIELD_ICON.difficulty}
          value={difficulty}
          options={DIFFICULTIES}
          onChange={setDifficulty}
        />

        <View>
          <Text style={styles.label}>Questions</Text>
          <View style={styles.countRow}>
            {COUNTS.map((value) => {
              const active = count === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCount(value)}
                  style={({ pressed }) => [
                    styles.countButton,
                    active && styles.countButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      active && styles.countTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {message ? (
          <View style={styles.alert}>
            <View style={styles.alertIcon}>
              <AlertTriangle size={14} color="#fecaca" />
            </View>
            <Text style={styles.alertText}>{message}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy || preparing}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
                (busy || preparing) && styles.disabled,
              ]}
            >
              <RefreshCw size={12} color={colors.w80} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.footerNote}>
            <Sparkles size={14} color={colors.star70} />
            <Text style={styles.footerNoteText}>
              {count} questions, {KIND_LABEL[kind].toLowerCase()} - the format
              auto-detects from your course, notes and PDF, graded with
              feedback after every answer.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy || preparing}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.generateButton,
              pressed && styles.pressed,
              (busy || preparing) && styles.generateDisabled,
            ]}
          >
            {busy || preparing ? (
              <>
                <ActivityIndicator size="small" color={colors.primaryText} />
                <Text style={styles.generateText}>
                  {preparing && !busy
                    ? "Reading your notes..."
                    : "Writing your quiz..."}
                </Text>
              </>
            ) : (
              <>
                <Sparkles size={16} color={colors.primaryText} />
                <Text style={styles.generateText}>Generate quiz</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.75)",
    padding: 24,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  formWrap: {
    marginTop: 24,
    gap: 20,
  },
  label: {
    marginBottom: 6,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  field: {
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
  fieldHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  pdfTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.w15,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pdfPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  pdfIconIdle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfIconActive: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.35)",
    backgroundColor: "rgba(207,158,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  pdfPickTitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  pdfName: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  pdfMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  pdfRemove: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  countRow: {
    flexDirection: "row",
    gap: 8,
  },
  countButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingVertical: 13,
  },
  countButtonActive: {
    borderColor: colors.star50,
    backgroundColor: colors.star10,
  },
  countText: {
    fontSize: 14,
    fontFamily: fonts.mono,
    color: colors.w50,
  },
  countTextActive: {
    color: colors.star,
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
  retryButton: {
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
  retryText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w80,
  },
  disabled: {
    opacity: 0.5,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.w07,
    paddingTop: 20,
    gap: 16,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  footerNoteText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: colors.star,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  generateDisabled: {
    opacity: 0.6,
  },
  generateText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.85,
  },
});
