import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Code,
  Coffee,
  Compass,
  Database,
  Flame,
  Gauge,
  Globe,
  RefreshCw,
  Rocket,
  Sparkles,
  Sprout,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import { SelectMenu } from "../ui/select-menu";
import type { SelectOption } from "../ui/select-menu";
import { useCourses } from "../../hooks/use-courses";
import { colors, fonts } from "../../theme/theme";

export interface RoadmapRequestInput {
  goal: string;
  hours: number;
  level: string;
  /** Course this roadmap is generated for (null = standalone). */
  courseId: number | null;
  courseTitle: string | null;
}

interface RoadmapBuilderProps {
  busy: boolean;
  error: string | null;
  onGenerate: (input: RoadmapRequestInput) => void;
  defaultCourseId?: number | null;
}

const LEVELS: SelectOption<string>[] = [
  {
    value: "beginner",
    label: "Beginner",
    hint: "New to this topic",
    icon: Sprout,
  },
  {
    value: "intermediate",
    label: "Intermediate",
    hint: "Some hands-on experience",
    icon: TrendingUp,
  },
  {
    value: "advanced",
    label: "Advanced",
    hint: "Confident and building already",
    icon: Rocket,
  },
];

const COMMITMENTS: (SelectOption<string> & { hours: number })[] = [
  {
    value: "casual",
    label: "Casual",
    hint: "2-3 hours / week",
    icon: Coffee,
    hours: 3,
  },
  {
    value: "serious",
    label: "Serious",
    hint: "5-10 hours / week",
    icon: Flame,
    hours: 8,
  },
  {
    value: "intensive",
    label: "Intensive",
    hint: "15+ hours / week",
    icon: Zap,
    hours: 16,
  },
];

const TEMPLATES: { label: string; icon: typeof Code; goal: string }[] = [
  {
    label: "Python Programming",
    icon: Code,
    goal:
      "Learn Python from scratch to an advanced level: core syntax, data structures, functions and object-oriented design, file and error handling, the standard library, virtual environments and packaging, then finish with a capstone command-line project.",
  },
  {
    label: "Data Science",
    icon: Database,
    goal:
      "Go from zero to a working data scientist: Python and pandas fundamentals, NumPy and data wrangling, statistics and probability, data visualization, exploratory analysis, scikit-learn for classical machine learning, and an end-to-end project on a real dataset.",
  },
  {
    label: "Web Development",
    icon: Globe,
    goal:
      "Build and ship full-stack web apps: HTML, CSS and responsive layout, modern JavaScript and the DOM, a frontend framework, REST APIs and databases, authentication, testing, deployment, and one deployed portfolio project.",
  },
  {
    label: "Machine Learning",
    icon: Brain,
    goal:
      "Master machine learning from foundations to practice: linear algebra and probability refresh, core ML models and model evaluation, scikit-learn workflows, feature engineering, neural networks with PyTorch, and a deployed model project.",
  },
];

export function RoadmapBuilder({
  busy,
  error,
  onGenerate,
  defaultCourseId = null,
}: RoadmapBuilderProps) {
  const { courses } = useCourses();
  // Always starts blank: a fresh generation never inherits the last prompt.
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("beginner");
  const [commitment, setCommitment] = useState<string>("serious");
  const [courseValue, setCourseValue] = useState(
    defaultCourseId !== null ? String(defaultCourseId) : "",
  );
  // Only a real interaction with the picker counts as an explicit choice;
  // an untouched builder with no default course falls through to the
  // save flow, which creates/reuses a course from the goal's title.
  const [courseTouched, setCourseTouched] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const courseOptions: SelectOption<string>[] = [
    {
      value: "",
      label: "Not linked",
      hint: "Standalone roadmap",
      icon: Compass,
    },
    ...courses.map((course) => ({
      value: String(course.id),
      label: course.title,
      hint: "Roadmap for this course",
      icon: BookOpen,
    })),
  ];

  /**
   * Explicit pick wins. A pre-selected course (builder opened for
   * roadmap?courseId=N) is an explicit choice too: the picker visibly
   * shows it, so silently dropping the link would orphan the roadmap and it
   * would outlive its course on delete. Only a bare standalone builder
   * (no default, untouched picker) falls through to the title-based
   * reuse/create flow at save time.
   */
  const resolveCourse = (): {
    courseId: number | null;
    courseTitle: string | null;
  } => {
    if (courseTouched) {
      const picked = courses.find(
        (course) => String(course.id) === courseValue,
      );
      return picked
        ? { courseId: picked.id, courseTitle: picked.title }
        : { courseId: null, courseTitle: null };
    }
    if (defaultCourseId != null) {
      const preset = courses.find((course) => course.id === defaultCourseId);
      return { courseId: defaultCourseId, courseTitle: preset?.title ?? null };
    }
    return { courseId: null, courseTitle: null };
  };

  const run = () => {
    const trimmed = goal.trim();
    if (trimmed.length < 3) {
      setLocalError("Describe the goal in at least 3 characters.");
      return;
    }
    if (trimmed.length > 400) {
      setLocalError("Keep the goal under 400 characters.");
      return;
    }
    setLocalError(null);
    const option =
      COMMITMENTS.find((item) => item.value === commitment) ?? COMMITMENTS[1];
    onGenerate({
      goal: trimmed,
      hours: option.hours,
      level,
      ...resolveCourse(),
    });
  };

  const applyTemplate = (value: string) => {
    setGoal(value);
    setLocalError(null);
  };

  const message = localError ?? error;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Compass size={18} color={colors.lilac} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>AI syllabus</Text>
          <Text style={styles.headerTitle}>
            Tell ATLAS what you want to learn
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <View>
          <View style={styles.labelRow}>
            <Target size={12} color={colors.w40} />
            <Text style={styles.label}>Goal</Text>
          </View>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            multiline
            maxLength={400}
            placeholder="e.g., Learn Python from basics to advanced, Master Calculus, Build a full-stack web app"
            placeholderTextColor={colors.w30}
            style={styles.goalInput}
          />
          <Text style={styles.hint}>
            Be specific about what you want to learn and your end goal
          </Text>
        </View>

        <SelectMenu
          label="Current level"
          labelIcon={Gauge}
          value={level}
          options={LEVELS}
          onChange={setLevel}
          disabled={busy}
        />

        <SelectMenu
          label="Time commitment"
          labelIcon={Timer}
          value={commitment}
          options={COMMITMENTS}
          onChange={setCommitment}
          disabled={busy}
        />

        <SelectMenu
          label="Link to course"
          labelIcon={BookOpen}
          value={courseValue}
          options={courseOptions}
          onChange={(value) => {
            setCourseValue(value);
            setCourseTouched(true);
          }}
          disabled={busy}
        />

        <View style={styles.templatesBox}>
          <Text style={styles.templatesLabel}>Or start from a template</Text>
          <View style={styles.templateRow}>
            {TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <Pressable
                  key={template.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${template.label} template`}
                  onPress={() => applyTemplate(template.goal)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.templateChip,
                    pressed && styles.templateChipPressed,
                  ]}
                >
                  <Icon size={14} color={colors.star70} />
                  <Text style={styles.templateText}>{template.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {message ? (
          <View style={styles.errorBox}>
            <View style={styles.errorIcon}>
              <AlertTriangle size={14} color="#fecaca" />
            </View>
            <Text style={styles.errorText}>{message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry generation"
              onPress={run}
              disabled={busy}
              style={({ pressed }) => [
                styles.retryChip,
                pressed && styles.templateChipPressed,
                busy && styles.disabled,
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
              The timeline is sized automatically from your goal and
              commitment.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Generate roadmap"
            onPress={run}
            disabled={busy}
            style={({ pressed }) => [
              styles.generateButton,
              pressed && styles.generatePressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Sparkles size={16} color={colors.primaryText} />
            )}
            <Text style={styles.generateText}>
              {busy ? "Researching the path…" : "Generate roadmap"}
            </Text>
            {!busy && (
              <ArrowRight size={16} color={colors.primaryText} />
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
    backgroundColor: colors.w03,
    padding: 24,
    shadowColor: colors.lilac,
    shadowOpacity: 0.3,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  form: {
    marginTop: 24,
    gap: 20,
  },
  labelRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  goalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 84,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.white,
    textAlignVertical: "top",
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  templatesBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w02,
    padding: 16,
  },
  templatesLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  templateRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  templateChipPressed: {
    backgroundColor: colors.lilac10,
    borderColor: colors.lilac45,
  },
  templateText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  errorBox: {
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
  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    backgroundColor: "rgba(248,113,113,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "rgba(254,226,226,0.9)",
  },
  retryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac45,
    backgroundColor: colors.w06,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w80,
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
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignSelf: "flex-start",
    shadowColor: colors.star,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  generatePressed: {
    opacity: 0.9,
  },
  generateText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  disabled: {
    opacity: 0.6,
  },
});
