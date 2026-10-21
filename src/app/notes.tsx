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
  Bold,
  BookOpen,
  Check,
  ChevronDown,
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
} from "lucide-react-native";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Card } from "../components/ui/card";
import { RichNoteEditor } from "../components/notes/rich-note-editor";
import type { RichNoteEditorHandle } from "../components/notes/rich-note-editor";
import { ShareNoteModal } from "../components/notes/share-note-modal";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { StaleNotice } from "../components/ui/stale-notice";
import { useCourses } from "../hooks/use-courses";
import { readCache, writeCache } from "../lib/data-cache";
import { createNote, fetchNotes } from "../lib/db/notes";
import { ensureOnline } from "../lib/net";
import type { Note } from "../lib/notes";
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
}

const NoteRow = memo(function NoteRow({
  note,
  active,
  onPress,
}: {
  note: Note;
  active: boolean;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open note ${note.title || "Untitled note"}`}
      onPress={() => onPress(note.id)}
      style={[styles.noteItem, active && styles.noteItemActive]}
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
          {note.sharedBy ? (
            <Text style={styles.noteItemShared}>Shared</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
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
        return [...keep, ...rows.filter((row) => !seen.has(row.id))];
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
    void load().finally(() => {
      if (alive) setLoading(false);
    });
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
    });
  }, []);

  useEffect(() => {
    notesRef.current = notes;
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
    if (groupedNotes) {
      return groupedNotes.map(([subject, data]) => ({ subject, data }));
    }
    return notes.length > 0 ? [{ subject: "", data: notes }] : [];
  }, [groupedNotes, notes]);

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

  const addNote = useCallback(async () => {
    flushPendingRef.current();
    // In a course view the note is owned by the course (and linked to its
    // first topic for subject grouping), so it stays in that course's scope.
    const courseId = selectedCourse?.id ?? null;
    const topicId = selectedCourse?.topics[0]?.id ?? null;

    let note: Note | null = null;
    try {
      note = await createNote({ courseId, topicId });
    } catch {
      note = null;
    }
    if (note) {
      setNotes((prev) => [note, ...prev]);
      setActiveId(note.id);
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
    };
    setNotes((prev) => [local, ...prev]);
    setActiveId(local.id);
    queueNoteUpsert({
      id: local.id,
      title: local.title,
      html: local.html,
      courseId,
      topicId,
    });
  }, [selectedCourse]);

  // Widget "+" shortcut (atlas://notes?compose=1): create a fresh note once
  // the initial list has loaded so the new note stays selected.
  useEffect(() => {
    if (rawCompose !== "1" || composeHandledRef.current) return;
    if (loading || coursesLoading) return;
    composeHandledRef.current = true;
    router.setParams({ compose: "" });
    void addNote();
  }, [rawCompose, loading, coursesLoading, addNote, router]);

  const removeNote = (id: string) => {
    setNoteToDelete(id);
  };

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
            renderItem={({ item }) => (
              <NoteRow
                note={item}
                active={item.id === activeId}
                onPress={selectNote}
              />
            )}
            renderSectionHeader={({ section }) =>
              section.subject ? (
                <Text style={styles.groupLabel}>{section.subject}</Text>
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
        {active ? (
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
  groupLabel: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w35,
  },
  noteSeparator: {
    height: 6,
  },
  noteItem: {
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
  noteItemContent: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.lilac,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
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
