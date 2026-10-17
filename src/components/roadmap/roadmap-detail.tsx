import { useEffect, useRef } from "react";
import {
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  GraduationCap,
  Lock,
  Newspaper,
  Play,
  Skull,
  Star,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react-native";
import type { ComponentType } from "react";
import type { GraphNode, RoadmapGraph } from "../../lib/roadmap-graph";
import { objectivesFor, xpFor } from "../../lib/roadmap-graph";
import { colors, ease, fonts } from "../../theme/theme";

interface RoadmapDetailProps {
  graph: RoadmapGraph;
  nodeKey: string;
  busy: boolean;
  /** Safe-area top inset passed down from the screen: insets read inside a
   *  Modal can be 0 on Android, which pushed the heading off-screen. */
  topInset?: number;
  onClose: () => void;
  onToggle: (node: GraphNode) => void;
}

const STATUS_LABEL: Record<GraphNode["status"], string> = {
  completed: "Completed",
  active: "Active",
  locked: "Locked",
};

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const RESOURCE_ICON: Record<string, IconType> = {
  docs: BookOpen,
  video: Play,
  article: Newspaper,
  book: BookOpen,
  course: GraduationCap,
  practice: Target,
};

function resourceIcon(type: string): IconType {
  return RESOURCE_ICON[type] ?? ArrowUpRight;
}

export function RoadmapDetail({
  graph,
  nodeKey,
  busy,
  topInset = 0,
  onClose,
  onToggle,
}: RoadmapDetailProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, topInset, 12);
  const router = useRouter();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const handleClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 250,
      easing: ease,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const node = graph.nodes.find((item) => item.key === nodeKey) ?? null;
  const phase = graph.phases.find((item) => item.number === node?.phaseNumber);

  if (!node) return null;

  const prerequisites = node.prerequisites
    .map((key) => graph.nodes.find((item) => item.key === key))
    .filter((item): item is GraphNode => Boolean(item));

  const completed = node.status === "completed";
  const locked = node.status === "locked";
  const boss = node.type === "boss";
  const objectives = objectivesFor(node, phase);
  const xp = xpFor(node);
  const previousLevel = node.levelNumber - 1;
  const title = boss
    ? node.title.replace(/^boss battle:\s*/i, "") || node.title
    : node.title;

  const startLearning = () => {
    onClose();
    router.push(
      graph.courseId != null ? `/timer?courseId=${graph.courseId}` : "/timer",
    );
  };

  const takeBossBattle = () => {
    onClose();
    router.push("/quiz" as Href);
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close level details"
            onPress={handleClose}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              width,
              paddingTop: safeTop,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [width, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text
                style={[styles.eyebrow, boss ? styles.eyebrowBoss : null]}
              >
                {boss ? "Boss Battle" : `Level ${node.levelNumber}`}
                {` · ${graph.nodes.length} total`}
                {!boss && phase ? ` · ${phase.title}` : ""}
              </Text>
              <View style={styles.titleRow}>
                {boss ? <Skull size={20} color="#fb7185" /> : null}
                <Text style={styles.title}>{title}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close level details"
              onPress={handleClose}
              hitSlop={8}
              style={styles.closeButton}
            >
              <X size={16} color={colors.w45} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.chipRow}>
              <View style={styles.infoChip}>
                {completed ? (
                  <Check size={12} color="#c4b5fd" />
                ) : node.status === "active" ? (
                  boss ? (
                    <Skull size={12} color="#fb7185" />
                  ) : (
                    <Star size={12} color={colors.lilac} />
                  )
                ) : (
                  <Lock size={12} color={colors.w45} />
                )}
                <Text style={styles.infoChipText}>
                  {STATUS_LABEL[node.status]}
                </Text>
              </View>
              <View style={styles.infoChip}>
                <Clock size={12} color={colors.w45} />
                <Text style={styles.infoChipText}>
                  {node.estimatedDays} day{node.estimatedDays === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={[styles.infoChip, styles.xpChip]}>
                <Trophy size={12} color={colors.star} />
                <Text style={[styles.infoChipText, styles.xpChipText]}>
                  +{xp} XP
                </Text>
              </View>
            </View>

            {boss ? (
              <View style={styles.bossBox}>
                <View style={styles.bossTitleRow}>
                  <Skull size={16} color="#fda4af" />
                  <Text style={styles.bossTitle}>Boss Level</Text>
                </View>
                <Text style={styles.bossBody}>
                  This is a boss level. Take its quiz in the Quiz tab, then mark
                  the battle won once you pass. Everything before this level is
                  fair game.
                </Text>
              </View>
            ) : null}

            {node.description ? (
              <Text style={styles.description}>{node.description}</Text>
            ) : null}

            <View>
              <Text style={styles.sectionLabel}>Learning objectives</Text>
              <View style={styles.list}>
                {objectives.map((objective, index) => (
                  <View key={`${objective}-${index}`} style={styles.objectiveRow}>
                    <CheckCircle2 size={16} color="rgba(207,158,255,0.8)" />
                    <Text style={styles.objectiveText}>{objective}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.sectionLabel}>
                {boss ? "Study material before the battle" : "Resources"}
              </Text>
              {node.resources.length === 0 ? (
                <Text style={styles.emptyText}>
                  No links for this level: use your own notes.
                </Text>
              ) : (
                <View style={styles.list}>
                  {node.resources.map((resource, index) => {
                    const Icon = resourceIcon(resource.type);
                    if (resource.url) {
                      return (
                        <Pressable
                          key={`${resource.url}-${index}`}
                          accessibilityRole="link"
                          accessibilityLabel={`Open ${resource.title}`}
                          onPress={() => {
                    if (/^https?:\/\//i.test(resource.url)) {
                      void Linking.openURL(resource.url).catch(() => undefined);
                    }
                  }}
                          style={({ pressed }) => [
                            styles.resourceRow,
                            pressed && styles.resourceRowPressed,
                          ]}
                        >
                          <Icon size={16} color={colors.star70} />
                          <Text
                            numberOfLines={1}
                            style={[styles.resourceTitle, styles.resourceTitleActive]}
                          >
                            {resource.title}
                          </Text>
                          <View style={styles.resourceMeta}>
                            <Text style={styles.resourceType}>
                              {resource.type}
                            </Text>
                            <ArrowUpRight size={12} color={colors.w35} />
                          </View>
                        </Pressable>
                      );
                    }
                    return (
                      <View key={`${resource.title}-${index}`} style={styles.resourceRow}>
                        <Icon size={16} color={colors.w30} />
                        <Text
                          numberOfLines={1}
                          style={[styles.resourceTitle, styles.resourceTitleDim]}
                        >
                          {resource.title}
                        </Text>
                        <Text style={styles.resourceType}>{resource.type}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View>
              <View style={styles.sectionLabelRow}>
                <Lock size={12} color={colors.w40} />
                <Text style={styles.sectionLabel}>Unlocks after</Text>
              </View>
              {prerequisites.length === 0 ? (
                <Text style={styles.emptyText}>
                  Entry level: nothing to finish first.
                </Text>
              ) : (
                <View style={styles.list}>
                  {prerequisites.map((item) => (
                    <View key={item.key} style={styles.prereqRow}>
                      {item.status === "completed" ? (
                        <Check size={14} color="#c4b5fd" />
                      ) : (
                        <Lock size={14} color={colors.w30} />
                      )}
                      <Text style={styles.prereqText}>
                        Level {item.levelNumber} · {item.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {phase && phase.milestones.length > 0 ? (
              <View>
                <View style={styles.sectionLabelRow}>
                  <Flag size={12} color={colors.w40} />
                  <Text style={styles.sectionLabel}>
                    Phase {phase.number} milestones
                  </Text>
                </View>
                <View style={styles.list}>
                  {phase.milestones.map((milestone, index) => (
                    <View
                      key={`${milestone}-${index}`}
                      style={styles.milestoneRow}
                    >
                      <View style={styles.milestoneDot} />
                      <Text style={styles.milestoneText}>{milestone}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {locked ? (
              <View style={[styles.lockedButton]}>
                <Lock size={16} color={colors.w40} />
                <Text style={styles.lockedButtonText}>
                  Complete Level {previousLevel} to unlock
                </Text>
              </View>
            ) : (
              <>
                {boss ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take boss battle"
                    disabled={busy}
                    onPress={takeBossBattle}
                    style={({ pressed }) => [
                      styles.primaryWrap,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <LinearGradient
                      colors={["#f43f5e", "#a855f7"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.primaryButton}
                    >
                      <Skull size={16} color={colors.white} />
                      <Text style={styles.primaryText}>
                        Take Boss Battle · 80% to pass
                      </Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start learning"
                    disabled={busy}
                    onPress={startLearning}
                    style={({ pressed }) => [
                      styles.learnButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Timer size={16} color={colors.primaryText} />
                    <Text style={styles.learnText}>Start Learning</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    completed
                      ? "Mark as not completed"
                      : boss
                        ? "Mark battle won"
                        : "Mark level completed"
                  }
                  disabled={busy}
                  onPress={() => onToggle(node)}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    completed && styles.toggleButtonCompleted,
                    pressed && styles.togglePressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.toggleText}>
                    {completed
                      ? "Mark as not completed"
                      : boss
                        ? "I passed, mark battle won"
                        : "Mark level completed"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    height: "100%",
    backgroundColor: "rgba(7,7,15,0.97)",
    borderLeftWidth: 1,
    borderLeftColor: colors.w10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.w07,
    paddingHorizontal: 24,
    paddingVertical: 20,
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
  eyebrowBoss: {
    color: "rgba(251,113,133,0.9)",
  },
  titleRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
    color: colors.white,
  },
  closeButton: {
    borderRadius: 8,
    padding: 8,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 24,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoChipText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  xpChip: {
    borderColor: "rgba(157,180,255,0.25)",
    backgroundColor: colors.star10,
  },
  xpChipText: {
    color: colors.star,
  },
  bossBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.25)",
    backgroundColor: "rgba(244,63,94,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bossTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bossTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#fda4af",
  },
  bossBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "rgba(254,205,211,0.7)",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.w40,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  list: {
    marginTop: 10,
    gap: 8,
  },
  objectiveRow: {
    flexDirection: "row",
    gap: 10,
  },
  objectiveText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.65)",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resourceRowPressed: {
    borderColor: colors.star30,
  },
  resourceTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  resourceTitleActive: {
    color: "rgba(255,255,255,0.65)",
  },
  resourceTitleDim: {
    color: colors.w50,
  },
  resourceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resourceType: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.w35,
  },
  prereqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  prereqText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: 10,
  },
  milestoneDot: {
    marginTop: 8,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.star70,
  },
  milestoneText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.w07,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  lockedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  lockedButtonText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w40,
  },
  primaryWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  learnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  learnText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primaryText,
  },
  toggleButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w15,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  toggleButtonCompleted: {
    borderColor: colors.w10,
    backgroundColor: colors.w05,
  },
  togglePressed: {
    backgroundColor: colors.w07,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w75,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
});
