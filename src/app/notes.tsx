import {
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  Heading2,
  Inbox,
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
import { ShareAvatar } from "../components/notes/share-avatar";
import { ShareNoteModal } from "../components/notes/share-note-modal";
import { SharedNoteModal } from "../components/notes/shared-note-modal";
import { useCourses } from "../hooks/use-courses";
import { readCache, writeCache } from "../lib/data-cache";
import { createNote, fetchNotes } from "../lib/db/notes";
import {
  deleteShare,
  fetchSharedWithMe,
  importShare,
  markShareRead,
} from "../lib/db/shares";
import type { NoteShare } from "../lib/db/shares";
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

const SHARES_CACHE_KEY = "note-shares";

type NotesTab = "mine" | "shared";

function nowMs(): number {
  return Date.now();
}

function formatShareTime(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
  const [tab, setTab] = useState<NotesTab>("mine");
  const [editorReady, setEditorReady] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const cachedShares = useRef<NoteShare[] | null>(
    readCache<NoteShare[]>(SHARES_CACHE_KEY),
  );
  const [shares, setShares] = useState<NoteShare[]>(
    () => cachedShares.current ?? [],
  );
  const [sharesLoading, setSharesLoading] = useState(
    () => cachedShares.current === null,
  );
  const [sharesError, setSharesError] = useState<string | null>(null);
  const sharesLoadedRef = useRef(false);
  const sharesRequestRef = useRef(0);
  const [previewShare, setPreviewShare] = useState<NoteShare | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    } catch {
      rows = null;
    }
    if (!rows) return;
    writeCache(`notes:${activeCourseId ?? "all"}`, rows);
    applyRows(rows);
  }, [activeCourseId, applyRows]);

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

  /** Pull the shared-notes inbox (latest response wins). */
  const loadShares = useCallback(async () => {
    const request = sharesRequestRef.current + 1;
    sharesRequestRef.current = request;
    const result = await fetchSharedWithMe();
    if (sharesRequestRef.current !== request) return;
    if (result.ok) {
      sharesLoadedRef.current = true;
      setShares(result.shares);
      setSharesError(null);
    } else {
      setSharesError("Couldn't load shared notes. Check your connection.");
    }
    setSharesLoading(false);
  }, []);

  // Seed from cache immediately (unread badge included), then revalidate.
  useEffect(() => {
    if (cachedShares.current) sharesLoadedRef.current = true;
    void loadShares();
  }, [loadShares]);

  // Refresh each time the inbox tab is opened.
  useEffect(() => {
    if (tab === "shared") void loadShares();
  }, [tab, loadShares]);

  // Mirror inbox mutations (read / import / remove) into the cache.
  useEffect(() => {
    if (!sharesLoadedRef.current) return;
    writeCache(SHARES_CACHE_KEY, shares);
  }, [shares]);

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

  // Keep the home-screen sticky + quick-notes widgets mirrored (debounced
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

  /** Force the debounced body edit into the offline queue. */
  const flushPendingEdit = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const html = pendingHtmlRef.current;
    const id = activeRef.current;
    pendingHtmlRef.current = null;
    if (html != null && id) persist(id, { html });
  };

  const addNote = useCallback(async () => {
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
    setTab("mine");
    router.setParams({ compose: "" });
    void addNote();
  }, [rawCompose, loading, coursesLoading, addNote, router]);

  const removeNote = (id: string) => {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    queueNoteDelete(id);
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
    flushPendingEdit();
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
    setShareError(null);
    setShareTarget({ id: note.id, title: title.trim() || note.title });
  };

  const openSharePreview = async (share: NoteShare) => {
    setShareError(null);
    setPreviewShare(share);
    if (!share.readAt) {
      const readAt = nowMs();
      setShares((prev) =>
        prev.map((item) => (item.id === share.id ? { ...item, readAt } : item)),
      );
      setPreviewShare((prev) =>
        prev && prev.id === share.id ? { ...prev, readAt } : prev,
      );
      void markShareRead(share.id);
    }
  };

  const importShared = async (share: NoteShare) => {
    if (importing) return;
    if (
      !(await ensureOnline("Importing a note needs an internet connection."))
    ) {
      return;
    }
    setImporting(true);
    setShareError(null);
    const result = await importShare(share.id);
    setImporting(false);
    if (!result.ok) {
      setShareError(result.message);
      return;
    }
    const now = Date.now();
    setShares((prev) =>
      prev.map((item) =>
        item.id === share.id
          ? { ...item, importedAt: now, readAt: item.readAt ?? now }
          : item,
      ),
    );
    setPreviewShare(null);
    setTab("mine");
    setFlash("Note imported to My notes.");
    if (result.noteId) setActiveId(result.noteId);
    // The imported note has no course, so leave a course filter to make it
    // visible (the fetch effect reloads once the param clears).
    if (selectedCourseId != null) router.setParams({ courseId: "" });
    else void load();
  };

  const removeShared = (share: NoteShare) => {
    Alert.alert(
      "Remove shared note?",
      "It will leave your inbox. The sender's copy is not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (deleting) return;
              setDeleting(true);
              setShareError(null);
              const ok = await deleteShare(share.id);
              setDeleting(false);
              if (!ok) {
                setShareError("Couldn't remove this note. Try again.");
                return;
              }
              setShares((prev) => prev.filter((item) => item.id !== share.id));
              setPreviewShare((prev) =>
                prev && prev.id === share.id ? null : prev,
              );
            })();
          },
        },
      ],
    );
  };

  const renderShareItem = (share: NoteShare) => (
    <Pressable
      key={share.id}
      accessibilityRole="button"
      accessibilityLabel={`Open shared note ${share.title || "Untitled note"}`}
      onPress={() => void openSharePreview(share)}
      style={({ pressed }) => [
        styles.shareItem,
        !share.readAt && styles.shareItemUnread,
        pressed && styles.shareItemPressed,
      ]}
    >
      <ShareAvatar
        name={share.senderName}
        avatarUrl={share.senderAvatarUrl}
        size={38}
      />
      <View style={styles.shareItemText}>
        <View style={styles.shareTitleRow}>
          {!share.readAt ? <View style={styles.unreadDot} /> : null}
          <Text numberOfLines={1} style={styles.shareTitle}>
            {share.title || "Untitled note"}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.shareMeta}>
          From {share.senderName}
          {share.courseTitle ? ` · ${share.courseTitle}` : ""}
          {share.createdAt ? ` · ${formatShareTime(share.createdAt)}` : ""}
        </Text>
      </View>
      {share.importedAt ? (
        <Check size={14} color={colors.lilac} />
      ) : null}
    </Pressable>
  );

  const renderNoteItem = (note: Note) => {
    const isActive = note.id === activeId;
    return (
      <Pressable
        key={note.id}
        accessibilityRole="button"
        accessibilityLabel={`Open note ${note.title || "Untitled note"}`}
        onPress={() => setActiveId(note.id)}
        style={[styles.noteItem, isActive && styles.noteItemActive]}
      >
        <Text numberOfLines={1} style={styles.noteItemTitle}>
          {note.title || "Untitled note"}
        </Text>
        <Text style={styles.noteItemDate}>
          {new Date(note.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </Pressable>
    );
  };

  const unreadShares = shares.filter((share) => !share.readAt).length;

  return (
    <ScreenShell title="Notes" activeLabel="Notes">
      <ScreenHeading eyebrow="Memory" title="Notes that survive the session." />

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "mine" }}
          onPress={() => setTab("mine")}
          style={[styles.tab, tab === "mine" && styles.tabActive]}
        >
          <StickyNote
            size={14}
            color={tab === "mine" ? colors.white : colors.w40}
          />
          <Text
            style={[styles.tabText, tab === "mine" && styles.tabTextActive]}
          >
            My notes
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === "shared" }}
          onPress={() => setTab("shared")}
          style={[styles.tab, tab === "shared" && styles.tabActive]}
        >
          <Inbox
            size={14}
            color={tab === "shared" ? colors.white : colors.w40}
          />
          <Text
            style={[styles.tabText, tab === "shared" && styles.tabTextActive]}
          >
            Shared with me
          </Text>
          {unreadShares > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {unreadShares > 9 ? "9+" : unreadShares}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {flash ? (
        <View style={styles.flashRow}>
          <Check size={13} color={colors.lilac} />
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      ) : null}

      {tab === "mine" ? (
        <>
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
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {loading ? (
            <Text style={styles.listMessage}>Loading notes…</Text>
          ) : notes.length === 0 ? (
            <View style={styles.listEmpty}>
              <Text style={styles.listMessage}>
                {selectedCourse
                  ? "No notes in this course yet."
                  : "No notes yet."}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void addNote()}
              >
                <Text style={styles.listEmptyLink}>
                  {selectedCourse
                    ? "Write one in this course"
                    : "Write the first one"}
                </Text>
              </Pressable>
            </View>
          ) : groupedNotes ? (
            <View style={styles.groupList}>
              {groupedNotes.map(([subject, list]) => (
                <View key={subject}>
                  <Text style={styles.groupLabel}>{subject}</Text>
                  <View style={styles.noteList}>{list.map(renderNoteItem)}</View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noteList}>{notes.map(renderNoteItem)}</View>
          )}
        </ScrollView>
      </Card>

      <Card padded={false} style={styles.editorCard}>
        {active ? (
          <>
            <View style={styles.editorHeader}>
              <View style={styles.toolbar}>
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
              </View>
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
                  onPress={() => removeNote(active.id)}
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
                onChangeText={(next) => {
                  setTitle(next);
                  persist(active.id, { title: next });
                }}
                placeholder="Untitled note"
                placeholderTextColor="rgba(255,255,255,0.2)"
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
            <Pressable accessibilityRole="button" onPress={() => void addNote()}>
              <Text style={styles.editorEmptyLink}>+ New note</Text>
            </Pressable>
          </View>
        )}
      </Card>

          <Text style={styles.footnote}>
            Content is sanitized with DOMPurify and saved as you type.
          </Text>
        </>
      ) : (
        <>
          <Card padded={false} style={styles.sharedCard}>
            {sharesLoading ? (
              <View style={styles.sharedState}>
                <ActivityIndicator size="small" color={colors.lilac} />
                <Text style={styles.listMessage}>Loading shared notes…</Text>
              </View>
            ) : sharesError && shares.length === 0 ? (
              <View style={styles.sharedState}>
                <Text style={styles.listMessage}>{sharesError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadShares()}
                >
                  <Text style={styles.listEmptyLink}>Try again</Text>
                </Pressable>
              </View>
            ) : shares.length === 0 ? (
              <View style={styles.sharedState}>
                <View style={styles.sharedEmptyIcon}>
                  <Inbox size={20} color={colors.lilac} />
                </View>
                <Text style={styles.sharedEmptyTitle}>
                  Nothing shared with you yet
                </Text>
                <Text style={styles.listMessage}>
                  When a friend shares a note it lands here, ready to import.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <View style={styles.shareList}>
                  {shares.map(renderShareItem)}
                </View>
              </ScrollView>
            )}
          </Card>

          <Text style={styles.footnote}>
            Only you can see this inbox. Importing saves your own copy.
          </Text>
        </>
      )}

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

      <SharedNoteModal
        share={previewShare}
        onClose={() => {
          setPreviewShare(null);
          setShareError(null);
        }}
        onImport={(share) => void importShared(share)}
        onDelete={removeShared}
        importing={importing}
        deleting={deleting}
        error={shareError}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    padding: 4,
    alignSelf: "flex-start",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: colors.w10,
    borderWidth: 1,
    borderColor: colors.w10,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.w40,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabBadge: {
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: colors.lilac,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9.5,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
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
  sharedCard: {
    overflow: "hidden",
  },
  sharedState: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 42,
  },
  sharedEmptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  sharedEmptyTitle: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  shareList: {
    gap: 6,
  },
  shareItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shareItemUnread: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
  },
  shareItemPressed: {
    backgroundColor: colors.w07,
  },
  shareItemText: {
    flex: 1,
    minWidth: 0,
  },
  shareTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.lilac,
  },
  shareTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  shareMeta: {
    marginTop: 3,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w35,
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
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
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
  groupList: {
    gap: 12,
  },
  groupLabel: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  noteList: {
    gap: 6,
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
  noteItemTitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  noteItemDate: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  editorCard: {
    overflow: "hidden",
    minHeight: 420,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.w07,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
  },
  toolButton: {
    borderRadius: 8,
    padding: 8,
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
