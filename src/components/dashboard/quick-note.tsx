import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Check, CloudOff, StickyNote } from "lucide-react-native";
import { Card } from "../ui/card";
import { insertNote } from "../../lib/db/notes";
import type { Note } from "../../lib/notes";
import { makeTempNoteId, queueNoteUpsert } from "../../lib/notes-queue";
import { colors, fonts } from "../../theme/theme";

const MAX_LENGTH = 2000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Blank-line separated paragraphs, single newlines as <br>. */
function buildHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p>${block
          .split("\n")
          .map((line) => escapeHtml(line))
          .join("<br>")}</p>`,
    )
    .join("");
}

function firstLineTitle(text: string): string {
  const line = text.split(/\n/)[0]?.trim() ?? "";
  return line.slice(0, 80) || "Quick note";
}

/**
 * Dashboard quick-capture: type a thought, save it straight into Notes
 * (General category). Works offline too - the write goes through the
 * persistent notes queue.
 */
export function QuickNote() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<"online" | "offline" | null>(null);

  const canSave = value.trim().length > 0 && !busy;

  const handleSave = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    const title = firstLineTitle(text);
    const html = buildHtml(text);

    let created: Note | null = null;
    try {
      created = await insertNote({
        title,
        html,
        courseId: null,
        topicId: null,
      });
    } catch {
      created = null;
    }

    if (!created) {
      // Offline: keep it locally and let the queue insert it later.
      const tempId = makeTempNoteId();
      queueNoteUpsert({ id: tempId, title, html, courseId: null, topicId: null });
    }

    setSaved(created ? "online" : "offline");
    setValue("");
    setBusy(false);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <StickyNote size={18} color={colors.lilac} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Quick capture</Text>
          <Text style={styles.title}>Jot it before it slips</Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={(next) => {
          setValue(next);
          if (saved) setSaved(null);
        }}
        multiline
        maxLength={MAX_LENGTH}
        placeholder="Type a thought, a formula, a definition…"
        placeholderTextColor={colors.w30}
        style={styles.input}
      />

      <View style={styles.footer}>
        {saved ? (
          <View style={styles.savedRow}>
            {saved === "online" ? (
              <Check size={14} color={colors.lilac70} />
            ) : (
              <CloudOff size={14} color={colors.w45} />
            )}
            <Text style={styles.savedText}>
              {saved === "online"
                ? "Saved to Notes, General"
                : "Offline - queued, will sync automatically"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open notes"
              onPress={() => router.push("/notes")}
              style={({ pressed }) => [
                styles.openLink,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.openLinkText}>Open</Text>
              <ArrowRight size={12} color={colors.star} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hint}>
            Lands in Notes under General. First line becomes the title.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save quick note"
          disabled={!canSave}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            !canSave && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <StickyNote size={15} color={colors.primaryText} />
          )}
          <Text style={styles.saveText}>{busy ? "Saving…" : "Save to Notes"}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
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
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.star70,
  },
  title: {
    marginTop: 3,
    fontSize: 15,
    fontFamily: fonts.medium,
    letterSpacing: -0.3,
    color: colors.white,
  },
  input: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 88,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.white,
    textAlignVertical: "top",
  },
  footer: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  savedRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  openLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  openLinkText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.star,
  },
  hint: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  saveText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});
