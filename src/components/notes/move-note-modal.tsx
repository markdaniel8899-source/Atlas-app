import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookOpen, Check, StickyNote } from "lucide-react-native";
import { colors, fonts } from "../../theme/theme";

interface MoveNoteModalProps {
  open: boolean;
  courses: { id: number; title: string; accent: string }[];
  /** `undefined` = mixed selection (no current course highlighted). */
  currentCourseId: number | null | undefined;
  onSelect: (courseId: number | null) => void;
  onClose: () => void;
}

export function MoveNoteModal({
  open,
  courses,
  currentCourseId,
  onSelect,
  onClose,
}: MoveNoteModalProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close course picker"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.sheetLabel}>Move note to</Text>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: currentCourseId === null }}
              onPress={() => onSelect(null)}
              style={[
                styles.option,
                currentCourseId === null && styles.optionActive,
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  currentCourseId === null && styles.iconBoxActive,
                ]}
              >
                <StickyNote
                  size={16}
                  color={currentCourseId === null ? colors.lilac : colors.w45}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.optionLabel,
                  currentCourseId === null && styles.optionLabelActive,
                ]}
              >
                General
              </Text>
              {currentCourseId === null ? (
                <Check size={16} color={colors.lilac} />
              ) : null}
            </Pressable>

            {courses.map((course) => {
              const active = course.id === currentCourseId;
              return (
                <Pressable
                  key={course.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(course.id)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={[styles.iconBox, active && styles.iconBoxActive]}>
                    <BookOpen
                      size={16}
                      color={active ? course.accent : colors.w45}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                  >
                    {course.title}
                  </Text>
                  {active ? <Check size={16} color={course.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  sheetContent: {
    paddingBottom: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionActive: {
    backgroundColor: colors.lilac12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: "rgba(207,158,255,0.15)",
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w75,
  },
  optionLabelActive: {
    fontFamily: fonts.medium,
    color: colors.white,
  },
});
