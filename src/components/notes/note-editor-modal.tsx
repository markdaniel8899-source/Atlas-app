import { Fragment, useEffect, useState } from "react";
import type { RefObject } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BookOpen,
  Bold,
  ChevronLeft,
  Code2,
  Download,
  Heading2,
  Italic,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Redo2,
  Share2,
  Table2,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react-native";
import type { Note } from "../../lib/notes";
import { colors, fonts, hexToRgba } from "../../theme/theme";
import { MeshBackground } from "../mesh-background";
import { RichNoteEditor } from "./rich-note-editor";
import type {
  EditorCommandState,
  RichNoteEditorHandle,
} from "./rich-note-editor";

interface Tool {
  label: string;
  icon: typeof Bold;
  command: string;
  value?: string;
  stateKey?: keyof EditorCommandState;
  dividerBefore?: boolean;
}

const TOOLS: Tool[] = [
  { label: "Undo", icon: Undo2, command: "undo" },
  { label: "Redo", icon: Redo2, command: "redo" },
  {
    label: "Bold",
    icon: Bold,
    command: "bold",
    stateKey: "bold",
    dividerBefore: true,
  },
  { label: "Italic", icon: Italic, command: "italic", stateKey: "italic" },
  {
    label: "Underline",
    icon: Underline,
    command: "underline",
    stateKey: "underline",
  },
  {
    label: "Heading",
    icon: Heading2,
    command: "formatBlock",
    value: "h2",
    stateKey: "heading",
    dividerBefore: true,
  },
  {
    label: "Quote",
    icon: Quote,
    command: "formatBlock",
    value: "blockquote",
    stateKey: "quote",
  },
  {
    label: "Bullet list",
    icon: List,
    command: "insertUnorderedList",
    stateKey: "unordered",
    dividerBefore: true,
  },
  {
    label: "Numbered list",
    icon: ListOrdered,
    command: "insertOrderedList",
    stateKey: "ordered",
  },
  {
    label: "Code block",
    icon: Code2,
    command: "codeBlock",
    stateKey: "code",
    dividerBefore: true,
  },
  {
    label: "Table",
    icon: Table2,
    command: "tableBlock",
    stateKey: "table",
    dividerBefore: true,
  },
];

const EMPTY_STATE: EditorCommandState = {
  bold: false,
  italic: false,
  underline: false,
  heading: false,
  quote: false,
  unordered: false,
  ordered: false,
  code: false,
  table: false,
};

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
  accent?: string;
  title: string;
  savedAnim: Animated.Value;
  editorRef: RefObject<RichNoteEditorHandle | null>;
  editorReady: boolean;
  downloading: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onTitleBlur: () => void;
  onChangeHtml: (html: string) => void;
  onShare: () => void;
  onMove: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

/**
 * Full-screen note editor. The website keeps the list beside the editor; on
 * a phone the same surface is best used edge to edge, so tapping a note opens
 * this modal and the list stays behind it. Toolbar formatting, the saved
 * indicator and every secondary action (share/move/download/delete) live in
 * one aligned header, with the destructive and rare actions tucked into the
 * right-hand overflow menu.
 */
export function NoteEditorModal({
  visible,
  note,
  accent,
  title,
  savedAnim,
  editorRef,
  editorReady,
  downloading,
  onClose,
  onTitleChange,
  onTitleBlur,
  onChangeHtml,
  onShare,
  onMove,
  onDownload,
  onDelete,
}: NoteEditorModalProps) {
  const insets = useSafeAreaInsets();
  const noteAccent = accent ?? colors.lilac;
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolState, setToolState] = useState<EditorCommandState>(EMPTY_STATE);

  // A different note must never inherit the previous note's menu or toolbar
  // highlight state.
  useEffect(() => {
    setMenuOpen(false);
    setToolState(EMPTY_STATE);
  }, [note?.id]);

  useEffect(() => {
    if (!visible) {
      setMenuOpen(false);
      setToolState(EMPTY_STATE);
    }
  }, [visible]);

  const closeMenu = () => setMenuOpen(false);

  const openMenu = () => {
    Keyboard.dismiss();
    setMenuOpen(true);
  };

  const runAction = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (menuOpen) closeMenu();
        else onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <MeshBackground />

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close note editor"
            onPress={onClose}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <ChevronLeft size={21} color={colors.w80} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>Note</Text>
            <View style={styles.savedRow}>
              <View style={styles.savedDot} />
              <Animated.Text
                style={[styles.savedText, { opacity: savedAnim }]}
              >
                Saved
              </Animated.Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Note options"
            onPress={openMenu}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <MoreHorizontal size={21} color={colors.w80} />
          </Pressable>
        </View>

        <View style={styles.toolbarCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.toolbar}
          >
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = tool.stateKey ? toolState[tool.stateKey] : false;
              return (
                <Fragment key={tool.label}>
                  {tool.dividerBefore ? (
                    <View style={styles.toolDivider} />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tool.label}
                    accessibilityState={{ selected: active }}
                    onPress={() =>
                      editorRef.current?.run(tool.command, tool.value)
                    }
                    style={({ pressed }) => [
                      styles.toolButton,
                      active && styles.toolButtonActive,
                      pressed && styles.toolButtonPressed,
                    ]}
                  >
                    <Icon
                      size={16}
                      color={active ? colors.lilac : colors.w45}
                    />
                  </Pressable>
                </Fragment>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.titleEyebrow}>Title</Text>
          <TextInput
            keyboardAppearance="dark"
            value={title}
            onChangeText={onTitleChange}
            onBlur={onTitleBlur}
            placeholder="Untitled note"
            placeholderTextColor={colors.w30}
            maxLength={160}
            style={styles.titleInput}
          />
        </View>

        <View
          style={[
            styles.editorArea,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <View
            style={[
              styles.editorCard,
              { borderColor: hexToRgba(noteAccent, 0.18) },
            ]}
          >
            <LinearGradient
              colors={[
                hexToRgba(noteAccent, 0.42),
                hexToRgba(noteAccent, 0.12),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editorAccent}
              pointerEvents="none"
            />
            {note && visible && editorReady ? (
              <RichNoteEditor
                ref={editorRef}
                noteId={note.id}
                html={note.html}
                onChange={onChangeHtml}
                onStateChange={setToolState}
                fill
              />
            ) : (
              <View style={styles.editorPlaceholder}>
                <ActivityIndicator size="small" color={colors.lilac} />
              </View>
            )}
          </View>
        </View>

        {menuOpen ? (
          <View style={styles.menuOverlay}>
            <Pressable
              accessibilityLabel="Close note options"
              style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
              onPress={closeMenu}
            />
            <View
              accessibilityViewIsModal
              style={[
                styles.menuSheet,
                { paddingBottom: insets.bottom + 14 },
              ]}
            >
              <View style={styles.menuHandle} />
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Note actions</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close note options"
                  onPress={closeMenu}
                  hitSlop={8}
                  style={styles.menuClose}
                >
                  <X size={18} color={colors.w45} />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => runAction(onShare)}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Share2 size={18} color={colors.lilac} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>Share</Text>
                  <Text style={styles.menuHint}>Send a copy to a friend</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => runAction(onMove)}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  <BookOpen size={18} color={colors.lilac} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>Move to course</Text>
                  <Text style={styles.menuHint}>Change where this note lives</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={downloading}
                onPress={() => runAction(onDownload)}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={colors.lilac} />
                  ) : (
                    <Download size={18} color={colors.lilac} />
                  )}
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuLabel}>Download</Text>
                  <Text style={styles.menuHint}>Save this note as HTML</Text>
                </View>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable
                accessibilityRole="button"
                onPress={() => runAction(onDelete)}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
              >
                <View style={[styles.menuIcon, styles.menuIconDanger]}>
                  <Trash2 size={18} color="#fca5a5" />
                </View>
                <View style={styles.menuText}>
                  <Text style={[styles.menuLabel, styles.menuLabelDanger]}>
                    Delete
                  </Text>
                  <Text style={styles.menuHint}>This can’t be undone</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPressed: {
    backgroundColor: colors.w08,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  headerEyebrow: {
    fontSize: 9.5,
    fontFamily: fonts.medium,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.w40,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 14,
  },
  savedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lilac,
  },
  savedText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.lilac70,
  },
  toolbarCard: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  toolDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 5,
    backgroundColor: colors.w08,
  },
  toolButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonActive: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac12,
  },
  toolButtonPressed: {
    backgroundColor: colors.w05,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  titleEyebrow: {
    marginBottom: 4,
    fontSize: 9.5,
    fontFamily: fonts.medium,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w30,
  },
  titleInput: {
    padding: 0,
    fontSize: 24,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
    color: colors.white,
  },
  editorArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 14,
  },
  editorCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: "rgba(7,7,14,0.62)",
    overflow: "hidden",
  },
  editorAccent: {
    height: 1.5,
    width: "100%",
  },
  editorPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  menuBackdrop: {
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  menuSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.w10,
    backgroundColor: "#0a0a13",
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  menuHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.w15,
    marginTop: 2,
    marginBottom: 10,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: colors.w06,
  },
  menuTitle: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w40,
  },
  menuClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  menuItemPressed: {
    backgroundColor: colors.w05,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: {
    borderColor: "rgba(248,113,113,0.28)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  menuText: {
    flex: 1,
    minWidth: 0,
  },
  menuLabel: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  menuLabelDanger: {
    color: "#fca5a5",
  },
  menuHint: {
    marginTop: 2,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
});
