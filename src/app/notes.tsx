import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Plus,
  Quote,
  Share2,
  StickyNote,
  Trash2,
  Underline,
  Users,
  X,
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Card } from "../components/ui/card";
import { RichNoteEditor } from "../components/notes/rich-note-editor";
import type { RichNoteEditorHandle } from "../components/notes/rich-note-editor";
import { ShareNoteModal } from "../components/notes/share-note-modal";
import { BulkShareModal } from "../components/notes/bulk-share-modal";
import { MoveNoteModal } from "../components/notes/move-note-modal";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { StaleNotice } from "../components/ui/stale-notice";
import { useCourses } from "../hooks/use-courses";
import { readCache, writeCache } from "../lib/data-cache";
import { createNote, fetchNotes, updateNoteOrder } from "../lib/db/notes";
import { ensureOnline } from "../lib/net";
import type { Note } from "../lib/notes";
import { exportNotesFile } from "../lib/notes-export";
import {
  applyNoteOrder,
  readNoteOrder,
  writeNoteOrder,
} from "../lib/notes-order";
import {
  flushNotesQueue,
  getNotesQueueSnapshot,
  isNoteQueued,
  isTempNoteId,
  makeTempNoteId,
  queueNoteDelete,
  queueNoteUpsert,
  registerNoteIdSwap,
  subscribeNotesQueue,
} from "../lib/notes-queue";
import { listen, NOTES_CHANGED_EVENT } from "../lib/events";
import { inferSubject } from "../lib/subjects";
import { syncAtlasNotesWidget } from "../lib/widgets/widget-sync";
import { colors, fonts } from "../theme/theme";

const TOOLS: {
  label: string;
  icon: typeof Bold;
  command: string;
  value?: string;
}[] = [
  { label: "Bold", icon: Bold, command: "bold" },
  { label: "Italic", icon: Italic, command: "italic" },
  { label: "Underline", icon: Underline, command: "underline" },
  { label: "Heading", icon: Heading2, command: "formatBlock", value: "h2" },
  { label: "Quote", icon: Quote, command: "formatBlock", value: "blockquote" },
  { label: "Bullet list", icon: List, command: "insertUnorderedList" },
  { label: "Numbered list", icon: ListOrdered, command: "insertOrderedList" },
];

/**
 * Same behaviour as the Roadmap course switcher: pick a course to scope the
 * view, or "All notes" to see everything grouped by subject.
 */
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

  const items: { id: number | null; title: string; icon: typeof Bold }[] = [
    { id: null, title: "All notes", icon: StickyNote },
    ...courses.map((course) => ({
      id: course.id,
      title: course.title,
      icon: BookOpen,
    })),
  ];
  const selected = items.find((item) => item.id === value) ?? items[0];

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter notes by course"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.switcherTrigger,
          open && styles.switcherTriggerOpen,
          pressed && styles.pressed,
        ]}
      >
        <StickyNote
          size={16}
          color={open ? colors.lilac : colors.lilac70}
        />
        <Text numberOfLines={1} style={styles.switcherLabel}>
          {selected.title}
        </Text>
        <ChevronDown
          size={16}
          color={open ? colors.lilac : colors.w35}
          style={open ? styles.chevronOpen : undefined}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close options"
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={() => setOpen(false)}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <Text style={styles.sheetLabel}>Notes by course</Text>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.id === value;
                return (
                  <Pressable
                    key={item.id ?? "all"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setOpen(false);
                      onChange(item.id);
                    }}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                  >
                    <View
                      style={[styles.sheetIconBox, active && styles.sheetIconBoxActive]}
                    >
                      <Icon
                        size={16}
                        color={active ? colors.lilac : "rgba(255,255,255,0.45)"}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.sheetOptionLabel,
                        active && styles.sheetOptionLabelActive,
                      ]}
                    >
                      {item.title}
                    </Text>
                    {active ? <Check size={16} color={colors.lilac} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface NoteSection {
  subject: string;
  data: Note[];
  count?: number;
}

const NoteRow = memo(function NoteRow({
  note,
  active,
  onPress,
  selectionMode,
  selected,
  onToggle,
  reorderMode,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  note: Note;
  active: boolean;
  onPress: (id: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  reorderMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const sharedLabel = selectionMode
    ? null
    : note.sharedByName || (note.sharedBy ? "Shared" : null);
  const accessibilityLabel = selectionMode
    ? `${selected ? "Deselect" : "Select"} note ${note.title || "Untitled note"}`
    : `Open note ${note.title || "Untitled note"}`;

  return (
    <View
      style={[
        styles.noteItem,
        active && !selectionMode && !reorderMode ? styles.noteItemActive : null,
        selected ? styles.noteItemSelected : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selectionMode ? { selected } : undefined}
        onPress={() => (selectionMode ? onToggle(note.id) : onPress(note.id))}
        style={styles.noteItemMain}
      >
        <View style={styles.noteItemContent}>
          <Text numberOfLines={1} style={styles.noteItemTitle}>
            {note.title || "Untitled note"}
          </Text>
          <View style={styles.noteItemMeta}>
            <Text style={styles.noteItemDate}>
              {new Date(note.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
            {sharedLabel ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.noteItemShared,
                  note.sharedByName ? styles.noteItemSender : null,
                ]}
              >
                {sharedLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {selectionMode ? (
          <View
            style={[styles.checkbox, selected && styles.checkboxOn]}
            pointerEvents="none"
          >
            {selected ? <Check size={12} color={colors.lilac} /> : null}
          </View>
        ) : null}
      </Pressable>

      {reorderMode ? (
        <View style={styles.reorderControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move note up"
            disabled={!canMoveUp}
            onPress={() => onMoveUp(note.id)}
            style={({ pressed }) => [
              styles.reorderButton,
              !canMoveUp && styles.reorderButtonOff,
              pressed && canMoveUp ? styles.reorderButtonPressed : null,
            ]}
          >
            <ArrowUp size={16} color={canMoveUp ? colors.lilac : colors.w20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move note down"
            disabled={!canMoveDown}
            onPress={() => onMoveDown(note.id)}
            style={({ pressed }) => [
              styles.reorderButton,
              !canMoveDown && styles.reorderButtonOff,
              pressed && canMoveDown ? styles.reorderButtonPressed : null,
            ]}
          >
            <ArrowDown
              size={16}
              color={canMoveDown ? colors.lilac : colors.w20}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

function NoteSeparator() {
  return <View style={styles.noteSeparator} />;
}

export default function NotesScreen() {
  const { courses, loading: coursesLoading } = useCourses();
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    compose?: string | string[];
  }>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorReady, setEditorReady] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [shareTarget, setShareTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Website-parity extras: multi-select bulk actions, reorder mode,
  // collapsible subject groups and moving a note between courses.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const queue = useSyncExternalStore(
    subscribeNotesQueue,
    getNotesQueueSnapshot,
  );

  const editorRef = useRef<RichNoteEditorHandle>(null);
  const savedAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef<Note[]>([]);
  const activeRef = useRef<string | null>(activeId);
  const prevPendingRef = useRef(0);
  const composeHandledRef = useRef(false);
  const pendingHtmlRef = useRef<string | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<{ id: string; title: string } | null>(null);
  const flushPendingRef = useRef<() => void>(() => {});
  const noteOrderRef = useRef<string[]>([]);
  const queueRef = useRef(queue);

  const rawCourseId = Array.isArray(params.courseId)
    ? params.courseId[0]
    : params.courseId;
  const rawCompose = Array.isArray(params.compose)
    ? params.compose[0]
    : params.compose;
  const parsedCourseId = Number(rawCourseId ?? "");
  const selectedCourseId =
    Number.isSafeInteger(parsedCourseId) && parsedCourseId > 0
      ? parsedCourseId
      : null;
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );
  /** The selected id while the course exists, else null (stale param).
   *  Number-valued so the notes fetch effect does not re-run on every
   *  unrelated courses refresh (rename, topic toggle, focus commit). */
  const activeCourseId = selectedCourse ? selectedCourseId : null;

  const active = notes.find((note) => note.id === activeId) ?? null;

  // Drop a stale ?courseId= (course was deleted) once courses are known.
  useEffect(() => {
    if (coursesLoading) return;
    if (selectedCourseId != null && !selectedCourse) {
      router.setParams({ courseId: "" });
    }
  }, [coursesLoading, selectedCourseId, selectedCourse, router]);

  const persistNoteOrder = useCallback((ids: string[]) => {
    noteOrderRef.current = ids;
    void writeNoteOrder(ids);
  }, []);

  /**
   * Merge rows with any queued offline-created notes so they never
   * disappear while waiting to sync.
   */
  const applyRows = useCallback(
    (rows: Note[]) => {
      const pendingTemp = new Set(getNotesQueueSnapshot().tempIds);
      setNotes((prev) => {
        const keep = prev.filter(
          (note) =>
            pendingTemp.has(note.id) &&
            (activeCourseId == null || note.courseId === activeCourseId),
        );
        const seen = new Set(keep.map((note) => note.id));
        return applyNoteOrder(
          [...keep, ...rows.filter((row) => !seen.has(row.id))],
          noteOrderRef.current,
        );
      });
      setActiveId((current) => {
        if (
          current &&
          (rows.some((row) => row.id === current) || pendingTemp.has(current))
        ) {
          return current;
        }
        return rows[0]?.id ?? current ?? null;
      });
    },
    [activeCourseId],
  );

  /** Fetch the active scope and merge in queued offline notes. */
  const load = useCallback(async () => {
    const scope =
      activeCourseId != null ? { courseId: activeCourseId } : undefined;
    let rows: Note[] | null = null;
    try {
      rows = await fetchNotes(scope);
      setStale(false);
    } catch {
      rows = null;
      setStale(notes.length > 0);
    }
    if (!rows) return;
    writeCache(`notes:${activeCourseId ?? "all"}`, rows);
    applyRows(rows);
  }, [activeCourseId, applyRows, notes.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Restore the manual order saved by the last reorder on this device.
  useEffect(() => {
    let alive = true;
    void readNoteOrder().then((order) => {
      if (!alive || order.length === 0) return;
      noteOrderRef.current = order;
      setNotes((prev) => applyNoteOrder(prev, order));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Live updates: the single app-wide realtime socket emits this event when a
  // note shared by a friend (or edited on another device) lands. Debounced,
  // and skipped while this device still has unsynced edits so local
  // keystrokes are never clobbered.
  useEffect(() => {
    let alive = true;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (!alive) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        if (!alive) return;
        if (queueRef.current.pending > 0) return;
        if (timerRef.current || titleTimerRef.current) return;
        void loadRef.current();
      }, 1800);
    };

    const unwatch = listen(NOTES_CHANGED_EVENT, scheduleReload);

    return () => {
      alive = false;
      unwatch();
      if (debounce) clearTimeout(debounce);
    };
  }, []);

  // Fetch only the notes of the active context: the selected course's
  // notes when a course is picked, otherwise every note (the list is then
  // grouped by subject below).
  useEffect(() => {
    if (coursesLoading) return;
    if (selectedCourseId != null && activeCourseId == null) return; // stale param
    let alive = true;
    const cached = readCache<Note[]>(`notes:${activeCourseId ?? "all"}`);
    if (cached) applyRows(cached);
    setLoading(cached === null);

    (async () => {
      await load();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [coursesLoading, selectedCourseId, activeCourseId, load, applyRows]);

  // Tabs stay mounted: silently re-pull on re-focus so a note shared by a
  // friend shows up without restarting the app. The first focus is already
  // covered by the mount fetch above.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      // Let the tab transition finish before swapping the list in.
      const timer = setTimeout(() => void load(), 420);
      return () => clearTimeout(timer);
    }, [load]),
  );

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(timer);
  }, [flash]);

  // Mounting the WebView mid-slide is one of the heaviest frames on Android:
  // let the screen transition finish first.
  useEffect(() => {
    const timer = setTimeout(() => setEditorReady(true), 240);
    return () => clearTimeout(timer);
  }, []);

  // Queue drained: pull the source of truth back in (temp ids now real).
  useEffect(() => {
    const previous = prevPendingRef.current;
    prevPendingRef.current = queue.pending;
    if (previous > 0 && queue.pending === 0) {
      void load();
    }
  }, [queue.pending, load]);

  // The queue inserted a temp note for real: swap the id in local state.
  useEffect(() => {
    return registerNoteIdSwap((tempId, realId) => {
      notesRef.current = notesRef.current.map((note) =>
        note.id === tempId ? { ...note, id: realId } : note,
      );
      setNotes((prev) =>
        prev.map((note) =>
          note.id === tempId ? { ...note, id: realId } : note,
        ),
      );
      setActiveId((current) => (current === tempId ? realId : current));
      setSelectedIds((prev) => {
        if (!prev.has(tempId)) return prev;
        const next = new Set(prev);
        next.delete(tempId);
        next.add(realId);
        return next;
      });
      persistNoteOrder(
        noteOrderRef.current.map((id) => (id === tempId ? realId : id)),
      );
    });
  }, [persistNoteOrder]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // A realtime delete (or a scope change) must not leave invisible ids in
  // the bulk selection.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(notes.map((note) => note.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [notes]);

  // Keep the home-screen quick-notes widget mirrored (debounced
  // so a typing burst only pushes one update).
  useEffect(() => {
    const timer = setTimeout(() => syncAtlasNotesWidget(notes), 800);
    return () => clearTimeout(timer);
  }, [notes]);

  // Subject groups for the "All notes" view; null in a course view (flat).
  const groupedNotes = useMemo(() => {
    if (selectedCourseId != null) return null;
    const groups = new Map<string, Note[]>();
    for (const note of notes) {
      const text = `${note.title} ${note.html.replace(/<[^>]+>/g, " ")}`;
      const subject = inferSubject(text) ?? note.courseTitle ?? "General";
      const list = groups.get(subject);
      if (list) list.push(note);
      else groups.set(subject, [note]);
    }
    return Array.from(groups.entries());
  }, [notes, selectedCourseId]);

  const sections = useMemo<NoteSection[]>(() => {
    // Manual reorder works on one predictable flat list (groups would make
    // an up/down move jump between sections).
    if (reorderMode) {
      return notes.length > 0
        ? [{ subject: "", data: notes, count: notes.length }]
        : [];
    }
    if (groupedNotes) {
      return groupedNotes.map(([subject, data]) => ({
        subject,
        data: collapsedGroups.has(subject) ? [] : data,
        count: data.length,
      }));
    }
    return notes.length > 0 ? [{ subject: "", data: notes, count: notes.length }] : [];
  }, [groupedNotes, notes, reorderMode, collapsedGroups]);

  useEffect(() => {
    activeRef.current = activeId;
    const note = notes.find((item) => item.id === activeId);
    if (note) setTitle(note.title);
  }, [activeId, notes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const markSaved = () => {
    Animated.timing(savedAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (savedRef.current) clearTimeout(savedRef.current);
    savedRef.current = setTimeout(() => {
      Animated.timing(savedAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1200);
  };

  const persist = (id: string, patch: Partial<Omit<Note, "id">>) => {
    const current = notesRef.current.find((note) => note.id === id);
    const next: Note = {
      id,
      title: "",
      html: "",
      courseId: null,
      topicId: null,
      courseTitle: null,
      sharedBy: null,
      sharedAt: null,
      sortOrder: null,
      sharedByName: null,
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    notesRef.current = notesRef.current.map((note) =>
      note.id === id ? next : note,
    );
    setNotes((prev) => prev.map((note) => (note.id === id ? next : note)));
    // The offline queue is the single write path: it saves locally, then
    // syncs to Supabase (retrying whenever the connection comes back).
    queueNoteUpsert({
      id,
      title: next.title,
      html: next.html,
      courseId: next.courseId,
      topicId: next.topicId,
      sortOrder: next.sortOrder,
    });
    markSaved();
  };

  const handleEditorChange = (html: string) => {
    const id = activeRef.current;
    if (!id) return;
    pendingHtmlRef.current = html;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingHtmlRef.current = null;
      persist(id, { html });
    }, 600);
  };

  const handleTitleChange = (next: string) => {
    const id = activeRef.current;
    setTitle(next);
    if (!id) return;
    pendingTitleRef.current = { id, title: next };
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      titleTimerRef.current = null;
      const pending = pendingTitleRef.current;
      pendingTitleRef.current = null;
      if (pending) persist(pending.id, { title: pending.title });
    }, 500);
  };

  /** Force the debounced title edit into the offline queue. */
  const flushPendingTitle = () => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    const pending = pendingTitleRef.current;
    pendingTitleRef.current = null;
    if (pending) persist(pending.id, { title: pending.title });
  };

  /** Force the debounced body edit into the offline queue. */
  const flushPendingBody = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const html = pendingHtmlRef.current;
    const id = activeRef.current;
    pendingHtmlRef.current = null;
    if (html != null && id) persist(id, { html });
  };

  const flushPendingEdits = () => {
    flushPendingTitle();
    flushPendingBody();
  };
  flushPendingRef.current = flushPendingEdits;

  // Leaving the tab (or unmounting) must not drop the last keystrokes.
  useFocusEffect(
    useCallback(() => {
      return () => flushPendingRef.current();
    }, []),
  );
  useEffect(
    () => () => {
      flushPendingRef.current();
    },
    [],
  );

  const selectNote = useCallback((id: string) => {
    flushPendingRef.current();
    setActiveId(id);
  }, []);

  const leaveSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkBusy(false);
  }, []);

  const enterSelection = useCallback(() => {
    flushPendingRef.current();
    setReorderMode(false);
    setSelectionMode(true);
    setSelectedIds(new Set(activeRef.current ? [activeRef.current] : []));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === notesRef.current.length
        ? new Set()
        : new Set(notesRef.current.map((note) => note.id)),
    );
  }, []);

  const enterReorder = useCallback(() => {
    flushPendingRef.current();
    setSelectionMode(false);
    setSelectedIds(new Set());
    setReorderMode(true);
  }, []);

  const leaveReorder = useCallback(() => {
    setReorderMode(false);
  }, []);

  const moveNote = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = notesRef.current;
      const index = current.findIndex((note) => note.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return;

      flushPendingRef.current();

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      const ids = next.map((note) => note.id);

      notesRef.current = next;
      setNotes(next);
      persistNoteOrder(ids);
      // Best-effort server sync (same as the website). The local copy above
      // keeps the order across app restarts even when this request fails.
      void updateNoteOrder(ids);
    },
    [persistNoteOrder],
  );

  const moveNoteUp = useCallback(
    (id: string) => moveNote(id, -1),
    [moveNote],
  );
  const moveNoteDown = useCallback(
    (id: string) => moveNote(id, 1),
    [moveNote],
  );

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedIds.has(note.id)),
    [notes, selectedIds],
  );

  const toggleGrouped = useCallback((subject: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  }, []);

  const downloadSelected = async () => {
    if (selectedNotes.length === 0 || bulkBusy) return;
    flushPendingRef.current();
    setBulkBusy(true);
    try {
      const result = await exportNotesFile(
        selectedNotes.map((note) => ({ title: note.title, html: note.html })),
      );
      if (result.ok) {
        setFlash(result.message);
        leaveSelection();
      } else if (!result.cancelled) {
        Alert.alert("Download failed", result.message);
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const openBulkSharePicker = async () => {
    if (selectedNotes.length === 0) return;
    if (selectedNotes.some((note) => isTempNoteId(note.id))) {
      Alert.alert(
        "Still saving",
        "One of the selected notes is still being saved. Try again in a moment.",
      );
      return;
    }
    if (!(await ensureOnline("Sharing notes needs an internet connection."))) {
      return;
    }
    flushPendingRef.current();
    const ids = selectedNotes.map((note) => note.id);
    if (ids.some((id) => isNoteQueued(id))) {
      await flushNotesQueue();
      if (ids.some((id) => isNoteQueued(id))) {
        Alert.alert(
          "Not synced yet",
          "Your latest changes are still syncing. Try again in a moment.",
        );
        return;
      }
    }
    setBulkShareOpen(true);
  };

  const moveNotesToCourse = (courseId: number | null) => {
    setMoveOpen(false);
    const ids = new Set(moveIds);
    setMoveIds([]);
    if (ids.size === 0) return;
    flushPendingRef.current();

    const target =
      courseId == null
        ? null
        : (courses.find((course) => course.id === courseId) ?? null);
    const targetTitle = target?.title ?? null;

    const next = notesRef.current
      .map((note) =>
        ids.has(note.id)
          ? {
              ...note,
              courseId,
              topicId: null,
              courseTitle: targetTitle,
            }
          : note,
      )
      .filter((note) => activeCourseId == null || note.courseId === activeCourseId);

    const queued = notesRef.current.filter((note) => ids.has(note.id));
    for (const note of queued) {
      queueNoteUpsert({
        id: note.id,
        title: note.title,
        html: note.html,
        courseId,
        topicId: null,
        sortOrder: note.sortOrder,
      });
    }

    notesRef.current = next;
    setNotes(next);
    if (ids.has(activeRef.current ?? "")) setActiveId(next[0]?.id ?? null);
    setFlash(
      `Moved ${ids.size} note${ids.size > 1 ? "s" : ""} to ${
        targetTitle ?? "General"
      }`,
    );
    leaveSelection();
  };

  const addNote = useCallback(async () => {
    flushPendingRef.current();
    // In a course view the note is owned by the course (and linked to its
    // first topic for subject grouping), so it stays in that course's scope.
    const courseId = selectedCourse?.id ?? null;
    const topicId = selectedCourse?.topics[0]?.id ?? null;
    // New notes go above the current list (same as the website). The value
    // is negative when needed so the order stays authoritative in the DB.
    const topSort =
      notesRef.current.reduce((min, item) => {
        if (item.sortOrder == null) return min;
        return Math.min(min, item.sortOrder);
      }, 0) - 1;

    let note: Note | null = null;
    try {
      note = await createNote({ courseId, topicId, sortOrder: topSort });
    } catch {
      note = null;
    }
    if (note) {
      setNotes((prev) => [note, ...prev]);
      setActiveId(note.id);
      persistNoteOrder([
        note.id,
        ...noteOrderRef.current.filter((id) => id !== note.id),
      ]);
      return;
    }

    // Offline / failed: create the note locally and queue the insert for
    // when the connection returns (the queue swaps in the real id later).
    const local: Note = {
      id: makeTempNoteId(),
      title: "Untitled note",
      html: "",
      updatedAt: Date.now(),
      courseId,
      topicId,
      courseTitle: selectedCourse?.title ?? null,
      sharedBy: null,
      sharedAt: null,
      sortOrder: topSort,
      sharedByName: null,
    };
    setNotes((prev) => [local, ...prev]);
    setActiveId(local.id);
    persistNoteOrder([
      local.id,
      ...noteOrderRef.current.filter((id) => id !== local.id),
    ]);
    queueNoteUpsert({
      id: local.id,
      title: local.title,
      html: local.html,
      courseId,
      topicId,
      sortOrder: topSort,
    });
  }, [selectedCourse, persistNoteOrder]);

  // Widget "+" shortcut (atlas://notes?compose=1): create a fresh note once
  // the initial list has loaded so the new note stays selected.
  useEffect(() => {
    if (rawCompose !== "1" || composeHandledRef.current) return;
    if (loading || coursesLoading) return;
    composeHandledRef.current = true;
    router.setParams({ compose: "" });
    void addNote();
  }, [rawCompose, loading, coursesLoading, addNote, router]);

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;
    const id = noteToDelete;
    if (activeId === id) {
      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
        titleTimerRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingTitleRef.current = null;
      pendingHtmlRef.current = null;
    }
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    if (selectedIds.has(id)) {
      setSelectedIds((prev) => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    }
    persistNoteOrder(noteOrderRef.current.filter((noteId) => noteId !== id));
    queueNoteDelete(id);
    setNoteToDelete(null);
  };

  /** Open the friend picker - only for a note that already synced. */
  const openSharePicker = async () => {
    const note = notesRef.current.find((item) => item.id === activeRef.current);
    if (!note) return;
    if (isTempNoteId(note.id)) {
      Alert.alert(
        "Not synced yet",
        "This note is still being saved. Give it a moment, then share it.",
      );
      return;
    }
    if (!(await ensureOnline("Sharing a note needs an internet connection."))) {
      return;
    }
    flushPendingEdits();
    if (isNoteQueued(note.id)) {
      await flushNotesQueue();
      if (isNoteQueued(note.id)) {
        Alert.alert(
          "Not synced yet",
          "Your latest changes are still syncing. Try again in a moment.",
        );
        return;
      }
    }
    setShareTarget({ id: note.id, title: title.trim() || note.title });
  };

  return (
    <ScreenShell
      title="Notes"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#cf9eff"]}
        />
      }
    >
      <StaleNotice visible={stale && notes.length > 0} onRetry={onRefresh} retrying={refreshing} />
      <ScreenHeading eyebrow="Memory" title="Notes that survive the session." />

      {flash ? (
        <View style={styles.flashRow}>
          <Check size={13} color={colors.lilac} />
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      ) : null}

      <View style={styles.controlsRow}>
        <CourseSwitcher
          courses={courses}
          value={selectedCourseId}
          onChange={(next) => {
            router.setParams({ courseId: next != null ? String(next) : "" });
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a note"
          onPress={() => void addNote()}
          style={({ pressed }) => [
            styles.newNoteButton,
            pressed && styles.pressed,
          ]}
        >
          <Plus size={16} color={colors.white} />
          <Text style={styles.newNoteText}>New note</Text>
        </Pressable>
      </View>

      <View style={styles.utilityRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selectionMode ? "Finish selecting notes" : "Select notes"
          }
          accessibilityState={{ selected: selectionMode }}
          onPress={selectionMode ? leaveSelection : enterSelection}
          style={({ pressed }) => [
            styles.modeButton,
            selectionMode && styles.modeButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Users
            size={14}
            color={selectionMode ? colors.lilac : colors.w45}
          />
          <Text
            style={[
              styles.modeButtonText,
              selectionMode && styles.modeButtonTextActive,
            ]}
          >
            {selectionMode ? "Finish" : "Select"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            reorderMode ? "Finish reordering notes" : "Reorder notes manually"
          }
          accessibilityState={{ selected: reorderMode }}
          onPress={reorderMode ? leaveReorder : enterReorder}
          style={({ pressed }) => [
            styles.modeButton,
            reorderMode && styles.modeButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <ArrowUpDown
            size={14}
            color={reorderMode ? colors.lilac : colors.w45}
          />
          <Text
            style={[
              styles.modeButtonText,
              reorderMode && styles.modeButtonTextActive,
            ]}
          >
            {reorderMode ? "Done" : "Reorder"}
          </Text>
        </Pressable>

        {selectionMode ? (
          <Text style={styles.selectionHint}>
            {selectedIds.size} selected
          </Text>
        ) : null}
      </View>

      <Card padded={false} style={styles.listCard}>
        {loading ? (
          <View style={styles.listContent}>
            <Text style={styles.listMessage}>Loading notes…</Text>
          </View>
        ) : notes.length === 0 ? (
          <View style={[styles.listContent, styles.listEmpty]}>
            <Text style={styles.listMessage}>
              {selectedCourse
                ? "No notes in this course yet."
                : "No notes yet."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create your first note"
              onPress={() => void addNote()}
              hitSlop={12}
            >
              <Text style={styles.listEmptyLink}>
                {selectedCourse
                  ? "Write one in this course"
                  : "Write the first one"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(note) => note.id}
            extraData={{
              activeId,
              selectionMode,
              reorderMode,
              selectedIds,
            }}
            renderItem={({ item, index }) => (
              <NoteRow
                note={item}
                active={item.id === activeId}
                onPress={selectNote}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onToggle={toggleSelected}
                reorderMode={reorderMode}
                canMoveUp={index > 0}
                canMoveDown={index < notes.length - 1}
                onMoveUp={moveNoteUp}
                onMoveDown={moveNoteDown}
              />
            )}
            renderSectionHeader={({ section }) =>
              section.subject ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${
                    collapsedGroups.has(section.subject)
                      ? "Expand"
                      : "Collapse"
                  } ${section.subject}`}
                  accessibilityState={{
                    expanded: !collapsedGroups.has(section.subject),
                  }}
                  onPress={() => toggleGrouped(section.subject)}
                  style={({ pressed }) => [
                    styles.groupHeader,
                    pressed && styles.groupHeaderPressed,
                  ]}
                >
                  {collapsedGroups.has(section.subject) ? (
                    <ChevronRight size={13} color={colors.w35} />
                  ) : (
                    <ChevronDown size={13} color={colors.w35} />
                  )}
                  <Text style={styles.groupLabel}>{section.subject}</Text>
                  <Text style={styles.groupCount}>
                    {section.count ?? section.data.length}
                  </Text>
                </Pressable>
              ) : null
            }
            ItemSeparatorComponent={NoteSeparator}
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            nestedScrollEnabled
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
          />
        )}
      </Card>

      <Card padded={false} style={styles.editorCard}>
        {selectionMode ? (
          <View style={styles.bulkPanel}>
            <View style={styles.bulkHeader}>
              <View style={styles.bulkIcon}>
                <Users size={18} color={colors.lilac} />
              </View>
              <View style={styles.bulkHeaderText}>
                <Text style={styles.bulkEyebrow}>Bulk actions</Text>
                <Text style={styles.bulkTitle}>
                  {selectedNotes.length} selected
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
                onPress={leaveSelection}
                style={({ pressed }) => [
                  styles.bulkClose,
                  pressed && styles.toolButtonPressed,
                ]}
              >
                <X size={18} color={colors.w45} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.bulkListScroll}
              contentContainerStyle={styles.bulkList}
              showsVerticalScrollIndicator={false}
            >
              {selectedNotes.length === 0 ? (
                <Text style={styles.listMessage}>
                  Select notes on the left to act on them together.
                </Text>
              ) : (
                selectedNotes.map((note) => (
                  <View key={note.id} style={styles.bulkRow}>
                    <View style={styles.bulkDot} />
                    <Text numberOfLines={1} style={styles.bulkRowText}>
                      {note.title || "Untitled note"}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.bulkToolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectedNotes.length === notes.length &&
                  notes.length > 0
                    ? "Deselect all notes"
                    : "Select all notes"
                }
                onPress={toggleSelectAll}
                style={({ pressed }) => [
                  styles.selectAllButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectAllText}>
                  {selectedNotes.length === notes.length && notes.length > 0
                    ? "Deselect all"
                    : "Select all"}
                </Text>
              </Pressable>

              <View style={styles.bulkActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Download selected notes"
                  disabled={selectedNotes.length === 0 || bulkBusy}
                  onPress={() => void downloadSelected()}
                  style={({ pressed }) => [
                    styles.bulkAction,
                    (selectedNotes.length === 0 || bulkBusy) &&
                      styles.bulkActionOff,
                    pressed &&
                      selectedNotes.length > 0 &&
                      !bulkBusy &&
                      styles.pressed,
                  ]}
                >
                  {bulkBusy ? (
                    <ActivityIndicator size="small" color={colors.lilac} />
                  ) : (
                    <Download size={16} color={colors.lilac} />
                  )}
                  <Text numberOfLines={1} style={styles.bulkActionText}>Download</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share selected notes"
                  disabled={selectedNotes.length === 0 || bulkBusy}
                  onPress={() => void openBulkSharePicker()}
                  style={({ pressed }) => [
                    styles.bulkAction,
                    (selectedNotes.length === 0 || bulkBusy) &&
                      styles.bulkActionOff,
                    pressed &&
                      selectedNotes.length > 0 &&
                      !bulkBusy &&
                      styles.pressed,
                  ]}
                >
                  <Share2 size={16} color={colors.lilac} />
                  <Text numberOfLines={1} style={styles.bulkActionText}>Share</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move selected notes to a course"
                  disabled={selectedNotes.length === 0 || bulkBusy}
                  onPress={() => {
                    setMoveIds(selectedNotes.map((note) => note.id));
                    setMoveOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.bulkAction,
                    (selectedNotes.length === 0 || bulkBusy) &&
                      styles.bulkActionOff,
                    pressed &&
                      selectedNotes.length > 0 &&
                      !bulkBusy &&
                      styles.pressed,
                  ]}
                >
                  <BookOpen size={16} color={colors.lilac} />
                  <Text numberOfLines={1} style={styles.bulkActionText}>Move</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.bulkHint}>
              Download saves one HTML file containing every selected note.
            </Text>
          </View>
        ) : reorderMode ? (
          <View style={styles.bulkPanel}>
            <View style={styles.bulkHeader}>
              <View style={styles.bulkIcon}>
                <ArrowUpDown size={18} color={colors.lilac} />
              </View>
              <View style={styles.bulkHeaderText}>
                <Text style={styles.bulkEyebrow}>Manual order</Text>
                <Text style={styles.bulkTitle}>Reorder notes</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Finish reordering notes"
                onPress={leaveReorder}
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.reorderBody}>
              <View style={styles.reorderBadge}>
                <ArrowUp size={16} color={colors.lilac} />
                <ArrowDown size={16} color={colors.lilac} />
              </View>
              <Text style={styles.reorderTitle}>
                Use the arrows next to each note
              </Text>
              <Text style={styles.reorderText}>
                Your order is saved on this device and synced to your account
                when you are online.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Finish reordering notes"
                onPress={leaveReorder}
                style={({ pressed }) => [
                  styles.reorderDoneButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reorderDoneText}>Done reordering</Text>
              </Pressable>
            </View>
          </View>
        ) : active ? (
          <>
            <View style={styles.editorHeader}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={styles.toolbarScroll}
                contentContainerStyle={styles.toolbar}
              >
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Pressable
                      key={tool.label}
                      accessibilityRole="button"
                      accessibilityLabel={tool.label}
                      onPress={() => editorRef.current?.run(tool.command, tool.value)}
                      style={({ pressed }) => [
                        styles.toolButton,
                        pressed && styles.toolButtonPressed,
                      ]}
                    >
                      <Icon size={16} color={colors.w45} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.editorHeaderRight}>
                <Animated.Text style={[styles.savedText, { opacity: savedAnim }]}>
                  Saved
                </Animated.Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move note to a course"
                  onPress={() => {
                    flushPendingEdits();
                    setMoveIds([active.id]);
                    setMoveOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.toolButton,
                    pressed && styles.toolButtonPressed,
                  ]}
                >
                  <BookOpen size={16} color={colors.w40} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share note with a friend"
                  onPress={() => void openSharePicker()}
                  style={({ pressed }) => [
                    styles.toolButton,
                    pressed && styles.toolButtonPressed,
                  ]}
                >
                  <Share2 size={16} color={colors.w40} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                  onPress={() => setNoteToDelete(active.id)}
                  style={({ pressed }) => [
                    styles.toolButton,
                    pressed && styles.toolButtonPressed,
                  ]}
                >
                  <Trash2 size={16} color={colors.w40} />
                </Pressable>
              </View>
            </View>

            <View style={styles.titleRow}>
              <TextInput
                keyboardAppearance="dark"
                value={title}
                onChangeText={handleTitleChange}
                onBlur={flushPendingTitle}
                placeholder="Untitled note"
                placeholderTextColor={colors.w30}
                maxLength={160}
                style={styles.titleInput}
              />
            </View>

            {editorReady ? (
              <RichNoteEditor
                ref={editorRef}
                noteId={active.id}
                html={active.html}
                onChange={handleEditorChange}
              />
            ) : (
              <View style={styles.editorPlaceholder}>
                <ActivityIndicator size="small" color={colors.lilac} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.editorEmpty}>
            <Text style={styles.listMessage}>
              {loading
                ? "Loading notes…"
                : "Pick a note on the left, or start a fresh page."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new note"
              onPress={() => void addNote()}
              hitSlop={12}
            >
              <Text style={styles.editorEmptyLink}>+ New note</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Text style={styles.footnote}>
        Content is sanitized before saving and saved as you type.
      </Text>

      <ShareNoteModal
        open={shareTarget !== null}
        noteId={shareTarget?.id ?? null}
        noteTitle={shareTarget?.title ?? ""}
        onClose={() => setShareTarget(null)}
        onShared={(message) => {
          setShareTarget(null);
          setFlash(message);
        }}
      />
      <BulkShareModal
        open={bulkShareOpen}
        noteIds={selectedNotes.map((note) => note.id)}
        noteCount={selectedNotes.length}
        onClose={() => setBulkShareOpen(false)}
        onShared={(message) => {
          setBulkShareOpen(false);
          setFlash(message);
          leaveSelection();
        }}
      />
      <MoveNoteModal
        open={moveOpen}
        courses={courses.map((course) => ({
          id: course.id,
          title: course.title,
          accent: course.accent,
        }))}
        currentCourseId={
          moveIds.length === 1
            ? (notesRef.current.find((note) => note.id === moveIds[0])
                ?.courseId ?? null)
            : undefined
        }
        onSelect={moveNotesToCourse}
        onClose={() => {
          setMoveOpen(false);
          setMoveIds([]);
        }}
      />
      <ConfirmDialog
        open={noteToDelete !== null}
        title="Delete this note?"
        message="This can\u2019t be undone."
        confirmLabel="Delete"
        onConfirm={confirmDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  flashRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  flashText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  editorPlaceholder: {
    height: 340,
    alignItems: "center",
    justifyContent: "center",
  },
  switcherTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switcherTriggerOpen: {
    borderColor: "rgba(207,158,255,0.5)",
    backgroundColor: "rgba(207,158,255,0.08)",
  },
  switcherLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,18,0.97)",
    padding: 6,
    maxHeight: "70%",
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  sheetLabel: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.w40,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: 4,
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
  sheetIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconBoxActive: {
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: "rgba(207,158,255,0.15)",
  },
  sheetOptionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  sheetOptionLabelActive: {
    fontFamily: fonts.medium,
    color: colors.white,
  },
  controlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  newNoteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  newNoteText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
  },
  modeButtonActive: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
  },
  modeButtonText: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.w45,
  },
  modeButtonTextActive: {
    color: colors.lilac,
  },
  selectionHint: {
    marginLeft: "auto",
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  listCard: {
    overflow: "hidden",
  },
  listScroll: {
    maxHeight: 320,
  },
  listContent: {
    padding: 12,
  },
  listMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
    textAlign: "center",
  },
  listEmpty: {
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  listEmptyLink: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.star,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupHeaderPressed: {
    opacity: 0.7,
  },
  groupLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w35,
  },
  groupCount: {
    minWidth: 20,
    textAlign: "center",
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.w40,
    backgroundColor: colors.w05,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  noteSeparator: {
    height: 6,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteItemActive: {
    borderColor: colors.w10,
    backgroundColor: colors.w07,
  },
  noteItemSelected: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
  },
  noteItemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  noteItemContent: {
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.w20,
    backgroundColor: colors.w03,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: colors.lilac,
    backgroundColor: colors.lilac12,
  },
  reorderControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reorderButton: {
    width: 32,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderButtonOff: {
    opacity: 0.4,
  },
  reorderButtonPressed: {
    backgroundColor: colors.w07,
  },
  noteItemMeta: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noteItemTitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  noteItemDate: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  noteItemShared: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.lilac,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  noteItemSender: {
    maxWidth: "72%",
  },
  bulkPanel: {
    minHeight: 420,
    padding: 20,
    gap: 14,
  },
  bulkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bulkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  bulkEyebrow: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    color: colors.w40,
  },
  bulkTitle: {
    marginTop: 3,
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.white,
  },
  bulkClose: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkListScroll: {
    flexGrow: 0,
    maxHeight: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: colors.w02,
  },
  bulkList: {
    padding: 10,
    gap: 6,
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lilac,
  },
  bulkRowText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  bulkToolbar: {
    gap: 10,
  },
  selectAllButton: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  selectAllText: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.star70,
  },
  bulkActions: {
    flexDirection: "row",
    gap: 8,
  },
  bulkAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 6,
  },
  bulkActionOff: {
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    opacity: 0.45,
  },
  bulkActionText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  bulkHint: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  doneButton: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  reorderBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 12,
  },
  reorderBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  reorderTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
    textAlign: "center",
  },
  reorderText: {
    maxWidth: 320,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  reorderDoneButton: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac12,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderDoneText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  editorCard: {
    overflow: "hidden",
    minHeight: 420,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.w07,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolbarScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  toolButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonPressed: {
    backgroundColor: colors.w07,
  },
  editorHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.lilac70,
  },
  titleRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.w07,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  titleInput: {
    padding: 0,
    fontSize: 22,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
    color: colors.white,
  },
  editorEmpty: {
    flex: 1,
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 40,
  },
  editorEmptyLink: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.star,
  },
  footnote: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
});
