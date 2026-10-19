import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookOpen, Check, Download, Trash2, X } from "lucide-react-native";
import type { NoteShare } from "../../lib/db/shares";
import { colors, fonts } from "../../theme/theme";
import { RichNoteEditor } from "./rich-note-editor";
import { ShareAvatar } from "./share-avatar";

interface SharedNoteModalProps {
  share: NoteShare | null;
  onClose: () => void;
  onImport: (share: NoteShare) => void;
  onDelete: (share: NoteShare) => void;
  importing: boolean;
  deleting: boolean;
  error: string | null;
}

function formatSharedAt(ms: number): string {
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

export function SharedNoteModal({
  share,
  onClose,
  onImport,
  onDelete,
  importing,
  deleting,
  error,
}: SharedNoteModalProps) {
  const imported = Boolean(share?.importedAt);

  return (
    <Modal
      visible={share !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close shared note"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
        />

        <View style={styles.centerWrap} pointerEvents="box-none">
          {share ? (
            <View
              accessibilityViewIsModal
              accessibilityLabel={`Shared note: ${share.title}`}
              style={styles.panel}
            >
              <View style={styles.header}>
                <ShareAvatar
                  name={share.senderName}
                  avatarUrl={share.senderAvatarUrl}
                  size={42}
                />
                <View style={styles.headerText}>
                  <Text style={styles.sender} numberOfLines={1}>
                    {share.senderName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {share.senderUsername
                      ? `@${share.senderUsername}`
                      : "Sent you a note"}
                    {share.createdAt
                      ? ` · ${formatSharedAt(share.createdAt)}`
                      : ""}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close shared note"
                  onPress={onClose}
                  hitSlop={6}
                  style={styles.closeButton}
                >
                  <X size={16} color={colors.w40} />
                </Pressable>
              </View>

              <View style={styles.titleWrap}>
                <Text style={styles.title} numberOfLines={2}>
                  {share.title.trim() || "Untitled note"}
                </Text>
                {share.courseTitle ? (
                  <View style={styles.courseChip}>
                    <BookOpen size={11} color={colors.lilac} />
                    <Text style={styles.courseChipText} numberOfLines={1}>
                      {share.courseTitle}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.editorFrame}>
                <RichNoteEditor
                  noteId={share.id}
                  html={share.html}
                  onChange={() => undefined}
                  readOnly
                  height={300}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove shared note"
                  onPress={() => onDelete(share)}
                  disabled={deleting || importing}
                  style={[styles.deleteButton, deleting && styles.disabled]}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.w50} />
                  ) : (
                    <Trash2 size={15} color={colors.w50} />
                  )}
                  <Text style={styles.deleteText}>Remove</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    imported ? "Note already imported" : "Import note to my notes"
                  }
                  onPress={() => onImport(share)}
                  disabled={imported || importing || deleting}
                  style={[
                    styles.importButton,
                    (imported || importing) && styles.importButtonDone,
                  ]}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color={colors.primaryText} />
                  ) : imported ? (
                    <>
                      <Check size={15} color={colors.white} strokeWidth={3} />
                      <Text style={styles.importedText}>Imported</Text>
                    </>
                  ) : (
                    <>
                      <Download size={15} color={colors.primaryText} />
                      <Text style={styles.importText}>Import to my notes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.98)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.95,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 32 },
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  sender: {
    fontSize: 13.5,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  meta: {
    marginTop: 2,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  closeButton: {
    borderRadius: 8,
    padding: 8,
  },
  titleWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
    color: colors.white,
  },
  courseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  courseChipText: {
    flexShrink: 1,
    fontSize: 10.5,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  editorFrame: {
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: colors.w02,
    overflow: "hidden",
  },
  error: {
    paddingHorizontal: 20,
    paddingTop: 10,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.9)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    paddingHorizontal: 18,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w50,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.lilac,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minWidth: 44,
    justifyContent: "center",
  },
  importButtonDone: {
    backgroundColor: colors.w08,
    opacity: 0.9,
  },
  importText: {
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  importedText: {
    fontSize: 12.5,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  disabled: {
    opacity: 0.45,
  },
});
