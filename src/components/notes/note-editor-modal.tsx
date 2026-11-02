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
  Share2,
  Trash2,
  Underline,
  X,
} from "lucide-react-native";
import type { Note } from "../../lib/notes";
import { colors, fonts } from "../../theme/theme";
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
  stateKey: keyof EditorCommandState;
  dividerBefore?: boolean;
}

const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, command: "bold", stateKey: "bold" },
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
};

interface NoteEditorModalProps {
  visible: boolean;
  note: Note | null;
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
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close note editor"
            onPress={onClose}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <ChevronLeft size={22} color={colors.w70} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>Note</Text>
            <Animated.Text
              style={[styles.savedText, { opacity: savedAnim }]}
            >
              Saved
            </Animated.Text>
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
            <MoreHorizontal size={22} color={colors.w70} />
          </Pressable>
        </View>

        <View style={styles.toolbarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.toolbar}
          >
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = toolState[tool.stateKey];
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
                      size={17}
                      color={active ? colors.lilac : colors.w45}
                    />
                  </Pressable>
                </Fragment>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.titleRow}>
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

        <View style={[styles.editorArea, { paddingBottom: insets.bottom }]}>
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
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Note options</Text>
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
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPressed: {
    backgroundColor: colors.w07,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  savedText: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: colors.lilac70,
  },
  toolbarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toolDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 5,
    backgroundColor: colors.w08,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonActive: {
    backgroundColor: colors.lilac12,
  },
  toolButtonPressed: {
    backgroundColor: colors.w07,
  },
  titleRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  titleInput: {
    padding: 0,
    fontSize: 21,
    fontFamily: fonts.semibold,
    letterSpacing: -0.5,
    color: colors.white,
  },
  editorArea: {
    flex: 1,
    minHeight: 0,
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
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  menuSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.w10,
    backgroundColor: "#0c0c16",
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDanger: {
    borderColor: "rgba(248,113,113,0.25)",
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
