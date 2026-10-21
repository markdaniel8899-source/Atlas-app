import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookOpen, Plus, Save, X } from "lucide-react-native";
import { addTopic, removeTopic, updateCourse } from "../../lib/db/courses";
import { useKeyboardHeight } from "../../hooks/use-keyboard-height";
import type { Course, CourseTopic } from "../../lib/db/types";
import { ThemedInput } from "../ui/themed-input";
import { colors, fonts } from "../../theme/theme";

interface CourseEditorModalProps {
  /** Course to edit, or null when the modal is closed. */
  course: Course | null;
  onClose: () => void;
  /** Called after any successful write so the parent can reload. */
  onSaved: () => void;
}

export function CourseEditorModal({
  course,
  onClose,
  onSaved,
}: CourseEditorModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [topicTitle, setTopicTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (!course) return;
    setTitle(course.title);
    setDescription(course.description);
    setTopics(course.topics);
    setTopicTitle("");
    setError(null);
    setBusy(false);
  }, [course]);

  const submitCourse = async () => {
    if (!course || busy) return;
    if (!title.trim()) {
      setError("Give the course a title.");
      return;
    }

    setBusy(true);
    setError(null);
    const updated = await updateCourse(course.id, { title, description });
    setBusy(false);

    if (!updated) {
      setError("Could not save the course. Check your connection.");
      return;
    }
    onSaved();
    onClose();
  };

  const submitTopic = async () => {
    if (!course || busy || !topicTitle.trim()) return;

    setBusy(true);
    setError(null);
    const created = await addTopic(course.id, topicTitle);
    setBusy(false);

    if (!created) {
      setError("Could not add the topic. Check your connection.");
      return;
    }
    setTopics((prev) => [...prev, created]);
    setTopicTitle("");
    onSaved();
  };

  const deleteTopic = async (topic: CourseTopic) => {
    if (!course || busy) return;

    setBusy(true);
    setError(null);
    const removed = await removeTopic(course.id, topic.id);
    setBusy(false);

    if (!removed.ok) {
      setError(
        removed.message ?? "Could not remove the topic. Check your connection.",
      );
      return;
    }
    setTopics((prev) => prev.filter((item) => item.id !== topic.id));
    onSaved();
  };

  return (
    <Modal
      visible={course !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close editor"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={() => {
            if (!busy) onClose();
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centerWrap}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel={course ? `Edit ${course.title}` : "Edit course"}
            style={styles.panel}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: 24 + keyboardHeight },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.iconBox}>
                    <BookOpen size={16} color={colors.lilac} />
                  </View>
                  <View>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      style={styles.eyebrow}
                    >
                      Manage course
                    </Text>
                    <Text style={styles.title}>Edit course</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close editor"
                  onPress={onClose}
                  disabled={busy}
                  hitSlop={6}
                  style={[styles.closeButton, busy && styles.disabled]}
                >
                  <X size={16} color={colors.w40} />
                </Pressable>
              </View>

              <View style={styles.form}>
                <View>
                  <Text maxFontSizeMultiplier={1.3} style={styles.label}>
                    Title
                  </Text>
                  <ThemedInput
                    value={title}
                    onChangeText={setTitle}
                    maxLength={160}
                    placeholder="Excel Fundamentals"
                    placeholderTextColor={colors.w30}
                    style={styles.field}
                  />
                </View>
                <View>
                  <Text maxFontSizeMultiplier={1.3} style={styles.label}>
                    Source
                  </Text>
                  <ThemedInput
                    value={description}
                    onChangeText={setDescription}
                    maxLength={160}
                    placeholder="ByteGrad"
                    placeholderTextColor={colors.w30}
                    style={styles.field}
                  />
                </View>

                <View style={styles.topicsBox}>
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={styles.topicsLabel}
                  >
                    Topics · {topics.length}
                  </Text>

                  <View style={styles.chipRow}>
                    {topics.length === 0 ? (
                      <Text
                        maxFontSizeMultiplier={1.3}
                        style={styles.noTopics}
                      >
                        No topics yet.
                      </Text>
                    ) : (
                      topics.map((topic) => (
                        <View key={topic.id} style={styles.chip}>
                          <Text numberOfLines={1} style={styles.chipText}>
                            {topic.title}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove topic ${topic.title}`}
                            onPress={() => void deleteTopic(topic)}
                            disabled={busy}
                            hitSlop={12}
                            style={[styles.chipRemove, busy && styles.disabled]}
                          >
                            <X size={12} color={colors.w35} />
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.addRow}>
                    <ThemedInput
                      value={topicTitle}
                      onChangeText={setTopicTitle}
                      placeholder="Add a topic"
                      placeholderTextColor={colors.w30}
                      maxLength={160}
                      editable={!busy}
                      onSubmitEditing={() => void submitTopic()}
                      style={[styles.field, styles.addField]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void submitTopic()}
                      disabled={busy || !topicTitle.trim()}
                      style={[
                        styles.addButton,
                        (busy || !topicTitle.trim()) && styles.disabled,
                      ]}
                    >
                      <Plus size={14} color={colors.white} />
                      <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.footer}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onClose}
                    disabled={busy}
                    style={[styles.cancelButton, busy && styles.disabled]}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void submitCourse()}
                    disabled={busy}
                    style={[styles.saveButton, busy && styles.saveDisabled]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.primaryText} />
                    ) : (
                      <Save size={16} color={colors.primaryText} />
                    )}
                    <Text style={styles.saveText}>Save changes</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 512,
    maxHeight: "85%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(12,12,22,0.97)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.95,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 30 },
    elevation: 24,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 2.8,
    textTransform: "uppercase",
    color: colors.star70,
  },
  title: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.54,
    color: colors.white,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  form: {
    marginTop: 24,
    gap: 16,
  },
  label: {
    marginBottom: 6,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  field: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  topicsBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w02,
    padding: 16,
  },
  topicsLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  chipRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  noTopics: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 4,
    maxWidth: 176,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  chipRemove: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addField: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
  },
  addButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w06,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  error: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.85)",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.w07,
    paddingTop: 16,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w15,
    backgroundColor: colors.w02,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w70,
  },
  saveButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.primaryText,
  },
});
