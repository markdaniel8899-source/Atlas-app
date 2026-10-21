import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Lock,
  Map as MapIcon,
  RotateCcw,
  Skull,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { BossConfetti } from "../components/roadmap/boss-confetti";
import { RoadmapBuilder } from "../components/roadmap/roadmap-builder";
import type { RoadmapRequestInput } from "../components/roadmap/roadmap-builder";
import { RoadmapDetail } from "../components/roadmap/roadmap-detail";
import { RoadmapMap } from "../components/roadmap/roadmap-map";
import { AiError, generateRoadmapOutline, generateRoadmapPhase } from "../lib/ai";
import { useCourses } from "../hooks/use-courses";
import { readCache, writeCache } from "../lib/data-cache";
import { fetchCourses } from "../lib/db/courses";
import {
  ROADMAPS_CHANGED_EVENT,
  notifyRoadmapsChanged,
} from "../lib/events";
import { useFocusedEvent } from "../hooks/use-focused-event";
import { ensureOnline } from "../lib/net";
import { beginHeavyTask, endHeavyTask } from "../lib/heavy-task";
import {
  appendRoadmapPhase,
  awardLevelXp,
  deleteRoadmap,
  fetchLatestRoadmap,
  saveRoadmapSkeleton,
  syncRoadmapProgressToCourse,
  updateNodeStatuses,
} from "../lib/db/roadmaps";
import type { GraphNode, NodeStatus, RoadmapGraph } from "../lib/roadmap-graph";
import {
  currentPhaseNumber,
  deriveEdges,
  graphNodesFromPhase,
  orderedNodes,
  phaseProgress,
  progressOf,
  roadmapDisplayTitle,
  withDerivedStatuses,
  xpFor,
  xpProgressOf,
} from "../lib/roadmap-graph";
import { colors, fonts } from "../theme/theme";

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type IconType = ComponentType<{ size?: number; color?: string }>;

interface SwitcherItem {
  id: number | null;
  title: string;
  icon: IconType;
}

function CourseSwitcher({
  courses,
  value,
  onChange,
}: {
  courses: { id: number; title: string }[];
  value: number | null;
  onChange: (courseId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const items: SwitcherItem[] = [
    { id: null, title: "All roadmaps", icon: Compass },
    ...courses.map((course) => ({
      id: course.id,
      title: course.title,
      icon: BookOpen,
    })),
  ];
  const selected =
    items.find((item) => item.id === value) ??
    (value != null
      ? { id: value, title: `Roadmap #${value}`, icon: MapIcon }
      : items[0]);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch roadmap by course"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.switcherPill,
          pressed && styles.switcherPillPressed,
        ]}
      >
        <MapIcon size={16} color={colors.lilac70} />
        <Text numberOfLines={1} style={styles.switcherText}>
          {selected.title}
        </Text>
        <ChevronDown size={16} color={colors.w35} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            accessibilityLabel="Close course list"
            style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}
            onPress={() => setOpen(false)}
          />
          <View style={styles.sheet}>
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.id === value;
              return (
                <Pressable
                  key={item.id ?? "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  style={[styles.sheetOption, active && styles.sheetOptionActive]}
                >
                  <View
                    style={[styles.sheetIcon, active && styles.sheetIconActive]}
                  >
                    <Icon
                      size={16}
                      color={active ? colors.lilac : colors.w45}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sheetTitle,
                      active && styles.sheetTitleActive,
                    ]}
                  >
                    {item.title}
                  </Text>
                  {active ? <Check size={16} color={colors.lilac} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function RoadmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ courseId?: string | string[] }>();
  const [graph, setGraph] = useState<RoadmapGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nodeBusy, setNodeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectNode = useCallback((key: string) => setSelected(key), []);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Live chunked-generation status, e.g. "AI is designing Phase 2...". */
  const [generating, setGenerating] = useState<{
    number: number;
    message: string;
  } | null>(null);
  const {
    courses,
    setCourses,
    loading: coursesLoading,
    reload: reloadCourses,
  } = useCourses();
  /** True while this page is writing roadmaps, so its own change
   *  notifications never trigger a refetch that would clobber local state. */
  const busyRef = useRef(false);

  useEffect(
    () => () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    },
    [],
  );

  // /roadmap?courseId=<id> opens the roadmap linked to that course.
  const roadmapCourseId = useMemo(() => {
    const raw = Array.isArray(params.courseId)
      ? params.courseId[0]
      : params.courseId;
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.courseId]);

  const switchCourse = useCallback(
    (courseId: number | null) => {
      router.setParams({ courseId: courseId != null ? String(courseId) : "" });
    },
    [router],
  );

  // A course deleted on another page: once the refreshed list proves it is
  // gone, drop ?courseId= so the switcher and fetch fall back to the
  // remaining roadmaps (also covers deletions made while busyRef skipped
  // the ROADMAPS listener below).
  useEffect(() => {
    if (coursesLoading) return;
    if (
      roadmapCourseId != null &&
      !courses.some((course) => course.id === roadmapCourseId)
    ) {
      router.setParams({ courseId: "" });
    }
  }, [coursesLoading, courses, roadmapCourseId, router]);

  useEffect(() => {
    let alive = true;
    const key = `roadmap:${roadmapCourseId ?? "latest"}`;
    const cached = readCache<RoadmapGraph>(key);
    if (cached) setGraph(cached);
    setLoading(cached === null);
    void fetchLatestRoadmap(roadmapCourseId)
      .then((result) => {
        if (!alive) return;
        setGraph(result);
        writeCache(key, result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [roadmapCourseId]);

  // Deleting a course on another screen would leave this view showing the
  // deleted roadmap. Re-read it whenever roadmaps change elsewhere; our own
  // write notifications are skipped while busy so an in-flight generation or
  // node toggle is never overwritten by a stale fetch.
  const refresh = useCallback(() => {
    if (busyRef.current) return;
    void (async () => {
      try {
        const rows = await fetchCourses();
        setCourses(rows);
        const courseGone =
          roadmapCourseId != null &&
          !rows.some((course) => course.id === roadmapCourseId);
        if (courseGone) {
          // The scoped course no longer exists: drop ?courseId= so the
          // switcher and the fetch effect fall back to remaining roadmaps.
          router.setParams({ courseId: "" });
          return;
        }
        const next = await fetchLatestRoadmap(roadmapCourseId);
        setGraph(next);
        writeCache(`roadmap:${roadmapCourseId ?? "latest"}`, next);
      } catch {
        // Transient network error - keep the current view.
      }
    })();
  }, [roadmapCourseId, router, setCourses]);

  // Course/topic rows themselves are refreshed by useCourses on COURSES_CHANGED;
  // this only re-reads the graph, and only while the roadmap tab is visible.
  useFocusedEvent(ROADMAPS_CHANGED_EVENT, refresh);

  const generate = useCallback(
    async (input: RoadmapRequestInput) => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (
        !(await ensureOnline(
          "Roadmaps are generated online - reconnect to start one.",
        ))
      ) {
        busyRef.current = false;
        return;
      }
      setBusy(true);
      setError(null);
      setGenerating(null);
      beginHeavyTask();
      try {
        // Step 1: outline only - small and fast, phase titles show at once.
        const outline = await generateRoadmapOutline(
          input.goal,
          input.hours,
          input.level,
        );

        const skeleton = await saveRoadmapSkeleton({
          goal: input.goal,
          title: outline.title,
          summary: outline.summary,
          model: outline.model,
          courseId: input.courseId,
          courseTitle: input.courseTitle,
          phases: outline.phases.map((phase) => ({
            number: phase.number,
            title: phase.title,
            objective: phase.objective,
            durationWeeks: 0,
            hours: 0,
            milestones: [],
          })),
        });

        if (!skeleton?.id) {
          setError(
            "The outline is ready, but saving it failed. Check your connection and try again.",
          );
          return;
        }
        setGraph(skeleton);

        // Step 2+: one phase chunk at a time - each is small, fast and
        // saved to Supabase the moment it arrives.
        let current: RoadmapGraph = skeleton;
        const idMap = new Map<string, string>();
        const takenKeys = new Set(skeleton.nodes.map((node) => node.key));
        let previousLastKey: string | null = null;
        let saveFailed = false;

        for (let index = 0; index < outline.phases.length; index += 1) {
          const meta = outline.phases[index];
          setGenerating({
            number: meta.number,
            message: `AI is designing Phase ${meta.number} of ${outline.phases.length}: ${meta.title}...`,
          });

          const chunk = await generateRoadmapPhase({
            goal: input.goal,
            hours: input.hours,
            level: input.level,
            outline: outline.phases,
            phaseNumber: meta.number,
            doneTitles: current.nodes.map((node) => node.title),
          });

          const newNodes = graphNodesFromPhase(chunk.phase, takenKeys);
          const base: RoadmapGraph = {
            ...current,
            nodes: [...current.nodes, ...newNodes],
          };
          const merged = withDerivedStatuses({
            ...base,
            edges: deriveEdges(base),
          });

          const savedNodes = await appendRoadmapPhase(
            skeleton.id,
            idMap,
            newNodes,
            previousLastKey,
            { notify: false },
          );
          if (savedNodes) {
            const byKey = new Map(savedNodes.map((node) => [node.key, node]));
            current = withDerivedStatuses({
              ...merged,
              nodes: merged.nodes.map((node) => byKey.get(node.key) ?? node),
            });
          } else {
            saveFailed = true;
            current = merged;
          }

          const ordered = orderedNodes(current.nodes);
          previousLastKey =
            ordered.length > 0 ? ordered[ordered.length - 1].key : null;
          setGraph(current);
          setGenerating(null);
        }

        if (saveFailed) {
          setError(
            "Some phases could not be saved to your account. Check your connection and try again.",
          );
        } else if (current.courseId == null) {
          setError(
            "Roadmap generated, but its course row could not be created. Check your connection and try again.",
          );
        }

        if (current.courseId != null) {
          await syncRoadmapProgressToCourse(
            current.courseId,
            current.nodes,
          ).catch(() => false);
          if (roadmapCourseId != null && current.courseId !== roadmapCourseId) {
            router.setParams({ courseId: String(current.courseId) });
          }
        }

        setSelected(null);
        setShowBuilder(false);
      } catch (err) {
        // Phases generated before the failure stay on screen and in the DB.
        if (err instanceof AiError) {
          const unreachable = err.status === 0 || err.status === 503;
          setError(
            unreachable
              ? null
              : err.status === 408
                ? "The AI timed out mid-generation. Your saved progress is kept - try again."
                : err.message,
          );
        } else {
          setError("Roadmap generation failed. Saved progress is kept.");
        }
      } finally {
        endHeavyTask();
        setGenerating(null);
        await reloadCourses();
        notifyRoadmapsChanged();
        busyRef.current = false;
        setBusy(false);
      }
    },
    [roadmapCourseId, reloadCourses, router],
  );

  const toggleNode = useCallback(
    async (node: GraphNode) => {
      if (!graph || busyRef.current) return;

      const completing = node.status !== "completed";
      const stamp = completing ? new Date().toISOString() : null;
      const previous = graph.nodes;

      const applied = previous.map((item) =>
        item.key === node.key
          ? {
              ...item,
              status: (completing ? "completed" : "locked") as NodeStatus,
              completedAt: stamp,
            }
          : item,
      );

      const next = withDerivedStatuses({ ...graph, nodes: applied });

      const previousByKey = new Map(previous.map((item) => [item.key, item]));
      const updates: {
        id: string;
        status: NodeStatus;
        completedAt: string | null;
      }[] = [];

      for (const item of next.nodes) {
        if (!item.id) continue;
        const before = previousByKey.get(item.key);
        if (before && before.status === item.status) continue;
        updates.push({
          id: item.id,
          status: item.status,
          completedAt: item.completedAt,
        });
      }

      if (updates.length === 0) {
        setGraph(next);
        return;
      }

      busyRef.current = true;
      setNodeBusy(true);
      setError(null);
      setGraph(next);

      try {
        const saved = await updateNodeStatuses(updates).catch(() => null);
        if (!saved || !saved.ok) {
          if (saved && saved.applied > 0) {
            setError(
              "Some progress could not be saved. Check your connection and try again.",
            );
          } else {
            setGraph(graph);
            setError(
              "Could not save your progress. Check your connection and try again.",
            );
          }
          return;
        }

        if (graph.courseId) {
          const synced = await syncRoadmapProgressToCourse(
            graph.courseId,
            next.nodes,
          ).catch(() => false);
          if (!synced) {
            setError(
              "Progress saved, but the linked course could not be updated.",
            );
          }
        }

        if (completing && node.id && saved.completedIds.includes(node.id)) {
          const xpSaved = await awardLevelXp(node.id, xpFor(node)).catch(
            () => false,
          );
          if (!xpSaved) {
            setError(
              "Level completed, but its XP could not be awarded. Try again later.",
            );
          }
          if (node.type === "boss") {
            setConfetti((value) => value + 1);
            if (confettiTimer.current) clearTimeout(confettiTimer.current);
            confettiTimer.current = setTimeout(() => setConfetti(0), 2400);
          }
        }
      } finally {
        busyRef.current = false;
        setNodeBusy(false);
      }
    },
    [graph],
  );

  const removeRoadmap = useCallback(() => {
    if (!graph?.id || busy || nodeBusy) return;
    setShowConfirmDelete(true);
  }, [graph, busy, nodeBusy]);

  const confirmRemoveRoadmap = useCallback(async () => {
    if (!graph?.id) return;
    setShowConfirmDelete(false);
    setError(null);
    busyRef.current = true;
    const removed = await deleteRoadmap(graph.id).catch(() => false);
    busyRef.current = false;
    if (!removed) {
      setError("Could not delete the roadmap. Check your connection.");
      return;
    }
    setSelected(null);
    setShowBuilder(false);
    setGraph(null);
  }, [graph]);

  const progress = useMemo(
    () => (graph ? progressOf(graph) : null),
    [graph],
  );

  const xp = useMemo(() => (graph ? xpProgressOf(graph) : null), [graph]);

  const currentPhase = graph ? currentPhaseNumber(graph) : null;
  const currentPhaseTitle =
    graph && currentPhase != null
      ? graph.phases.find((phase) => phase.number === currentPhase)?.title
      : undefined;

  const selectedNode = selected && graph ? selected : null;

  if (loading) {
    return (
      <ScreenShell title="Roadmap">
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.w40} />
          <Text style={styles.loadingText}>Loading roadmap…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!graph) {
    return (
      <ScreenShell title="Roadmap">
        <ScreenHeading eyebrow="Path map" title="Roadmap" />

        <View style={styles.controlsRow}>
          <CourseSwitcher
            courses={courses}
            value={roadmapCourseId}
            onChange={switchCourse}
          />
          {roadmapCourseId != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open notes for the selected course"
              onPress={() =>
                router.push(`/notes?courseId=${roadmapCourseId}` as Href)
              }
              style={({ pressed }) => [
                styles.ghostPill,
                pressed && styles.ghostPillPressed,
              ]}
            >
              <BookOpen size={16} color={colors.white} />
              <Text style={styles.ghostPillText}>Notes</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <View pointerEvents="none" style={styles.emptyIconGlow} />
            <View style={styles.emptyIconBadge}>
              <Compass size={34} color={colors.lilac} />
            </View>
          </View>
          <Text style={styles.emptyEyebrow}>No roadmap yet</Text>
          <Text style={styles.emptyTitle}>
            Your learning journey starts here
          </Text>
          <Text style={styles.emptyBody}>
            Tell us what you want to master, and AI will create a personalized
            roadmap with milestones, resources, and progress tracking.
          </Text>
        </View>

        <RoadmapBuilder
          busy={busy}
          error={error}
          defaultCourseId={roadmapCourseId}
          onGenerate={(input) => void generate(input)}
        />
      </ScreenShell>
    );
  }

  const offset =
    RING_CIRCUMFERENCE -
    ((progress ? progress.percent : 0) / 100) * RING_CIRCUMFERENCE;

  return (
    <ScreenShell title="Roadmap">
      <ScreenHeading eyebrow="Path map" title="Roadmap" />

      <View style={styles.controlsRow}>
        <CourseSwitcher
          courses={courses}
          value={roadmapCourseId}
          onChange={switchCourse}
        />
        {(graph.courseId ?? roadmapCourseId) != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notes for this course"
            onPress={() =>
              router.push(
                `/notes?courseId=${graph.courseId ?? roadmapCourseId}` as Href,
              )
            }
            style={({ pressed }) => [
              styles.ghostPill,
              pressed && styles.ghostPillPressed,
            ]}
          >
            <BookOpen size={16} color={colors.white} />
            <Text style={styles.ghostPillText}>Notes</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showBuilder ? "Cancel new roadmap" : "New roadmap"}
          onPress={() => setShowBuilder((value) => !value)}
          style={({ pressed }) => [
            styles.ghostPill,
            pressed && styles.ghostPillPressed,
          ]}
        >
          {showBuilder ? (
            <X size={16} color={colors.white} />
          ) : (
            <Sparkles size={16} color={colors.white} />
          )}
          <Text style={styles.ghostPillText}>
            {showBuilder ? "Cancel" : "New roadmap"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete roadmap"
          disabled={busy || nodeBusy}
          onPress={removeRoadmap}
          style={({ pressed }) => [
            styles.deletePill,
            pressed && styles.deletePillPressed,
            (busy || nodeBusy) && styles.disabled,
          ]}
        >
          <Trash2 size={16} color="#fecdd3" />
          <Text style={styles.deletePillText}>Delete roadmap</Text>
        </Pressable>
      </View>

      {showBuilder ? (
        <RoadmapBuilder
          busy={busy}
          error={error}
          defaultCourseId={graph.courseId}
          onGenerate={(input) => void generate(input)}
        />
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>
          {graph.courseTitle ? "Course roadmap" : "Learning path"}
        </Text>
        <Text style={styles.summaryTitle}>{roadmapDisplayTitle(graph)}</Text>

        <View style={styles.phaseRow}>
          {graph.phases.map((phase) => {
            const counts = phaseProgress(graph, phase.number);
            const activePhase = generating?.number === phase.number;
            const complete =
              counts.total > 0 && counts.completed >= counts.total;
            return (
              <View
                key={phase.number}
                style={[styles.phaseChip, activePhase && styles.phaseChipActive]}
              >
                {activePhase ? (
                  <ActivityIndicator size="small" color={colors.lilac} />
                ) : (
                  <Text
                    style={[
                      styles.phaseChipNumber,
                      complete && styles.phaseChipNumberComplete,
                    ]}
                  >
                    {phase.number}
                  </Text>
                )}
                <Text numberOfLines={1} style={styles.phaseChipTitle}>
                  {phase.title}
                </Text>
                {counts.total > 0 ? (
                  <Text style={styles.phaseChipCount}>
                    · {counts.completed}/{counts.total}
                  </Text>
                ) : null}
                {activePhase ? (
                  <Text style={styles.phaseChipDesigning}>· designing…</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressCount}>
              {progress?.completed ?? 0} / {progress?.total ?? 0} levels
            </Text>
            <Text style={styles.progressPhase}>
              Current phase {currentPhase ?? 1} of{" "}
              {Math.max(graph.phases.length, currentPhase ?? 1)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={["#a855f7", "#818cf8", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressFill,
                { width: `${Math.min(100, progress?.percent ?? 0)}%` },
              ]}
            />
          </View>
          <View style={styles.xpRow}>
            <View style={styles.xpChip}>
              <Sparkles size={14} color={colors.lilac} />
              <Text style={styles.xpChipText}>
                {xp?.earned ?? 0} / {xp?.total ?? 0} XP
              </Text>
            </View>
            <View style={styles.phasePill}>
              <MapIcon size={14} color="#67e8f9" />
              <Text style={styles.phasePillText}>
                {currentPhaseTitle
                  ? `Phase ${currentPhase}: ${currentPhaseTitle}`
                  : "Journey"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ringRow}>
          <View style={styles.ringWrap}>
            <Svg width={96} height={96} viewBox="0 0 84 84">
              <SvgCircle
                cx="42"
                cy="42"
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="6"
              />
              <SvgCircle
                cx="42"
                cy="42"
                r={RING_RADIUS}
                fill="none"
                stroke="#cf9eff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
                transform="rotate(-90 42 42)"
              />
            </Svg>
            <View style={styles.ringLabel}>
              <Text style={styles.ringText}>
                {Math.round(progress?.percent ?? 0)}%
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.ringCount}>
              {progress?.completed ?? 0} / {progress?.total ?? 0}
            </Text>
            <Text style={styles.ringCaption}>levels completed</Text>
          </View>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <Lock size={14} color={colors.w40} />
          <Text style={styles.legendText}>Locked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>Active</Text>
        </View>
        <View style={styles.legendItem}>
          <Check size={14} color="#c4b5fd" />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <Skull size={14} color="#fb7185" />
          <Text style={styles.legendText}>Boss level · +200 XP</Text>
        </View>
        <View style={[styles.legendItem, styles.legendItemEnd]}>
          <RotateCcw size={14} color={colors.w40} />
          <Text style={styles.legendText}>
            Follow the path: each level unlocks the next (+50 XP)
          </Text>
        </View>
      </View>

      <RoadmapMap
        graph={graph}
        selectedKey={selectedNode}
        onSelect={selectNode}
      />

      {generating ? (
        <View style={styles.generatingBanner}>
          <ActivityIndicator size="small" color={colors.lilac} />
          <Text style={styles.generatingText}>{generating.message}</Text>
          <View style={styles.generatingChip}>
            <Text style={styles.generatingChipText}>
              Generating next levels…
            </Text>
          </View>
        </View>
      ) : null}

      {selectedNode ? (
        <RoadmapDetail
          key={selectedNode}
          graph={graph}
          nodeKey={selectedNode}
          busy={nodeBusy}
          topInset={insets.top}
          onClose={() => setSelected(null)}
          onToggle={(node) => void toggleNode(node)}
        />
      ) : null}

      {confetti > 0 ? (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setConfetti(0)}
        >
          <BossConfetti key={confetti} />
        </Modal>
      ) : null}

      <ConfirmDialog
        open={showConfirmDelete}
        title="Delete roadmap?"
        message={`This will permanently delete "${roadmapDisplayTitle(graph)}". This cannot be undone.`}
        onConfirm={() => void confirmRemoveRoadmap()}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  controlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  switcherPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 224,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switcherPillPressed: {
    borderColor: colors.lilac45,
    backgroundColor: colors.w06,
  },
  switcherText: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  sheetBackdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,18,0.97)",
    padding: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetOptionActive: {
    backgroundColor: colors.lilac12,
  },
  sheetIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconActive: {
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: "rgba(207,158,255,0.15)",
  },
  sheetTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  sheetTitleActive: {
    fontFamily: fonts.medium,
    color: colors.white,
  },
  ghostPill: {
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
  ghostPillPressed: {
    borderColor: colors.lilac45,
    backgroundColor: colors.w06,
  },
  ghostPillText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  deletePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.25)",
    backgroundColor: "rgba(244,63,94,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deletePillPressed: {
    borderColor: "rgba(251,113,133,0.55)",
    backgroundColor: "rgba(244,63,94,0.14)",
  },
  deletePillText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#fecdd3",
  },
  disabled: {
    opacity: 0.5,
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: "center",
    overflow: "hidden",
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconGlow: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: "rgba(207,158,255,0.10)",
  },
  emptyIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEyebrow: {
    marginTop: 28,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: colors.star70,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.7,
    color: colors.white,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 12,
    maxWidth: 460,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
    textAlign: "center",
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 20,
    overflow: "hidden",
  },
  summaryEyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  summaryTitle: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.display,
    letterSpacing: -0.7,
    color: colors.white,
  },
  phaseRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  phaseChipActive: {
    borderColor: "rgba(207,158,255,0.55)",
    backgroundColor: "rgba(207,158,255,0.12)",
  },
  phaseChipNumber: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.star70,
  },
  phaseChipNumberComplete: {
    color: "#c4b5fd",
  },
  phaseChipTitle: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  phaseChipCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  phaseChipDesigning: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(207,158,255,0.85)",
  },
  progressBlock: {
    marginTop: 20,
    maxWidth: 560,
  },
  progressLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressCount: {
    fontSize: 11,
    fontFamily: fonts.medium,
    fontVariant: ["tabular-nums"],
    color: colors.w75,
  },
  progressPhase: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.55)",
  },
  progressTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w06,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  xpRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  xpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.3)",
    backgroundColor: colors.lilac10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  xpChipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: "#f0e2ff",
  },
  phasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  phasePillText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.65)",
  },
  ringRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  ringWrap: {
    width: 96,
    height: 96,
  },
  ringLabel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    fontVariant: ["tabular-nums"],
    color: colors.white,
  },
  ringCount: {
    fontSize: 14,
    fontFamily: fonts.regular,
    fontVariant: ["tabular-nums"],
    color: colors.white,
  },
  ringCaption: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendItemEnd: {
    marginLeft: "auto",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#a855f7",
  },
  legendText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  generatingBanner: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: "rgba(207,158,255,0.07)",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  generatingText: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w80,
  },
  generatingChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  generatingChipText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    color: colors.w45,
  },
});
