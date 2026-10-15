import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bold,
  Code,
  Heading1,
  Italic,
  List,
  ListOrdered,
  Plus,
  Trash2,
} from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import { createNote, deleteNote, fetchNotes, updateNote } from '@/lib/db/notes';
import type { Note } from '@/lib/db/types';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface Selection {
  start: number;
  end: number;
}

type ToolbarAction = {
  key: string;
  label: string;
  Icon: typeof Bold;
  apply: (body: string, selection: Selection) => { text: string; cursor: number };
};

function wrapAction(key: string, label: string, Icon: typeof Bold, marker: string): ToolbarAction {
  return {
    key,
    label,
    Icon,
    apply: (body, selection) => {
      const start = Math.min(selection.start, body.length);
      const end = Math.min(Math.max(selection.end, start), body.length);
      const chosen = body.slice(start, end) || label.toLowerCase();
      const text = body.slice(0, start) + marker + chosen + marker + body.slice(end);
      const cursor = start + marker.length + chosen.length + marker.length;
      return { text, cursor };
    },
  };
}

function lineAction(
  key: string,
  label: string,
  Icon: typeof Bold,
  prefix: string,
): ToolbarAction {
  return {
    key,
    label,
    Icon,
    apply: (body, selection) => {
      const lineStart = body.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
      const text = body.slice(0, lineStart) + prefix + body.slice(lineStart);
      const cursor = selection.start + prefix.length;
      return { text, cursor };
    },
  };
}

const TOOLBAR: ToolbarAction[] = [
  wrapAction('bold', 'Bold', Bold, '**'),
  wrapAction('italic', 'Italic', Italic, '_'),
  wrapAction('code', 'Code', Code, '`'),
  lineAction('heading', 'Heading', Heading1, '# '),
  lineAction('bullet', 'Bullet list', List, '- '),
  lineAction('number', 'Numbered list', ListOrdered, '1. '),
];

export default function NotesScreen() {
  const userId = useUserId();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });

  const runToolbarAction = (action: ToolbarAction) => {
    const { text, cursor } = action.apply(draftBody, selection);
    setDraftBody(text);
    setSelection({ start: cursor, end: cursor });
  };

  const load = useCallback(() => {
    if (!userId) return;
    void fetchNotes(userId).then((rows) => {
      setNotes(rows);
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

  const active = notes.find((n) => n.id === activeId) ?? null;

  const handleCreate = async () => {
    if (!userId) return;
    const created = await createNote(userId);
    if (created) {
      toastSuccess('Note created');
      load();
      setActiveId(created.id);
      setDraftTitle(created.title);
      setDraftBody(created.content);
      setSelection({ start: 0, end: 0 });
    }
  };

  const openNote = (note: Note) => {
    setActiveId(note.id);
    setDraftTitle(note.title);
    setDraftBody(note.content);
    setSelection({ start: note.content.length, end: note.content.length });
  };

  const closeEditor = async () => {
    if (activeId) {
      setSaving(true);
      const result = await updateNote(activeId, { title: draftTitle, content: draftBody });
      setSaving(false);
      if (result) {
        toastSuccess('Note saved');
      } else {
        toastError('Note not saved', 'Check your connection and try again.');
      }
      load();
    }
    setActiveId(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteNote(id).then(() => {
            toastInfo('Note deleted');
            if (activeId === id) setActiveId(null);
            load();
          });
        },
      },
    ]);
  };

  if (active) {
    return (
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 px-6 pb-6 pt-2">
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => void closeEditor()}
              accessibilityRole="button"
              className="min-h-[48px] rounded-full border border-white/[0.08] bg-white/[0.03] px-6 py-3">
              <Text
                allowFontScaling={false}
                className="font-sans-medium text-base text-white">
                {saving ? 'Saving...' : 'Done'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDelete(active.id)}
              accessibilityRole="button"
              accessibilityLabel="Delete note"
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <Trash2 size={14} color="rgba(255,255,255,0.45)" />
            </Pressable>
          </View>

          <TextInput
            allowFontScaling={false}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Untitled note"
            placeholderTextColor="rgba(255,255,255,0.2)"
            className="mb-3 font-sans-semibold text-2xl font-semibold tracking-[-0.03em] text-white"
          />
          {active.courseTitle ? (
            <View className="mb-3 self-start rounded-full bg-[#cf9eff]/20 px-3 py-1">
              <Text
                allowFontScaling={false}
                className="text-[15px] text-[#cf9eff]">
                {active.courseTitle}
              </Text>
            </View>
          ) : null}

          <View className="mb-2 flex-row items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
            {TOOLBAR.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => runToolbarAction(action)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                hitSlop={4}
                className="h-10 flex-1 items-center justify-center rounded-xl">
                <action.Icon size={16} color="rgba(255,255,255,0.65)" strokeWidth={2} />
              </Pressable>
            ))}
          </View>

          <TextInput
            allowFontScaling={false}
            value={draftBody}
            onChangeText={setDraftBody}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            placeholder="Start writing... markdown supported"
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            textAlignVertical="top"
            className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 font-sans text-base leading-relaxed text-white/70"
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

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
          Memory
        </Text>
        <RevealText
          text="Notes that survive the session."
          className="mt-1 font-syne-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
        <PrimaryButton
          variant="ghost"
          compact
          className="mt-3 self-start"
          label="New note"
          icon={<Plus size={16} color="#ffffff" />}
          onPress={() => void handleCreate()}
        />
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#9db4ff" size="large" />
        </View>
      ) : notes.length === 0 ? (
        <GlassCard className="items-center gap-2 p-10">
          <Text
            allowFontScaling={false}
            className="text-base text-white/40">
            No notes yet.
          </Text>
          <Pressable
            onPress={() => void handleCreate()}
            accessibilityRole="button"
            className="min-h-[48px] items-center justify-center rounded-2xl px-6 py-3">
            <Text
              allowFontScaling={false}
              className="text-base text-star">
              Write the first one
            </Text>
          </Pressable>
        </GlassCard>
      ) : (
        notes.map((note) => (
          <Pressable key={note.id} onPress={() => openNote(note)}>
            <GlassCard className="gap-1 p-3.5">
              <View className="flex-row items-start justify-between gap-3">
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  className="min-w-0 flex-1 text-base text-white">
                  {note.title || 'Untitled note'}
                </Text>
                <Pressable
                  onPress={() => handleDelete(note.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                  hitSlop={8}
                  className="h-11 w-11 items-center justify-center rounded-lg">
                  <Trash2 size={14} color="rgba(255,255,255,0.4)" />
                </Pressable>
              </View>
              <View className="flex-row items-center gap-2">
                <Text
                  allowFontScaling={false}
                  className="text-[15px] text-white/35">
                  {formatWhen(note.updatedAt)}
                </Text>
                {note.courseTitle ? (
                  <View className="rounded-full bg-[#cf9eff]/20 px-3 py-1">
                    <Text
                      allowFontScaling={false}
                      className="text-[15px] text-[#cf9eff]">
                      {note.courseTitle}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
