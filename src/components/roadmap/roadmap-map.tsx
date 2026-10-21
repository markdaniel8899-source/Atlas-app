import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { Check, Lock, Skull, Zap } from "lucide-react-native";
import { useBlurTargetRef } from "../blur-target";
import type {
  GraphNode,
  LevelPoint,
  NodeStatus,
  RoadmapGraph,
} from "../../lib/roadmap-graph";
import {
  layoutLevels,
  orderedNodes,
  phaseProgress,
  trailPath,
  trailSegmentPath,
} from "../../lib/roadmap-graph";
import { colors, fonts } from "../../theme/theme";

interface RoadmapMapProps {
  graph: RoadmapGraph;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const STATUS_WORD: Record<NodeStatus, string> = {
  completed: "Completed",
  active: "Active",
  locked: "Locked",
};

interface SegmentStyle {
  stroke: string;
  strokeWidth: number;
  dash?: string;
  glow: string | null;
}

function overlayStyle(status: NodeStatus): SegmentStyle | null {
  if (status === "completed") {
    return {
      stroke: "url(#atlas-trail-grad)",
      strokeWidth: 5,
      glow: "#a855f7",
    };
  }
  if (status === "active") {
    return { stroke: "#e9d5ff", strokeWidth: 4, dash: "6 8", glow: "#cf9eff" };
  }
  return null;
}

interface CircleSpec {
  gradient: [string, string];
  border: string;
  opacity: number;
  glowColor: string | null;
  glowOpacity: number;
}

function circleSpec(status: NodeStatus, isBoss: boolean): CircleSpec {
  if (status === "completed") {
    return {
      gradient: ["#a855f7", "#6366f1"],
      border: "rgba(255,255,255,0.5)",
      opacity: 1,
      glowColor: "#a855f7",
      glowOpacity: 0.55,
    };
  }
  if (status === "locked") {
    return isBoss
      ? {
          gradient: ["#4c0f1e", "#1e0c2c"],
          border: "rgba(251,113,133,0.3)",
          opacity: 0.65,
          glowColor: "#f43f5e",
          glowOpacity: 0.25,
        }
      : {
          gradient: ["#141422", "#0a0a14"],
          border: colors.w10,
          opacity: 0.6,
          glowColor: null,
          glowOpacity: 0,
        };
  }
  return isBoss
    ? {
        gradient: ["#f43f5e", "#a855f7"],
        border: "rgba(254,205,211,0.6)",
        opacity: 1,
        glowColor: "#f43f5e",
        glowOpacity: 0.6,
      }
    : {
        gradient: ["#2a1055", "#160a36"],
        border: "rgba(207,158,255,0.75)",
        opacity: 1,
        glowColor: "#cf9eff",
        glowOpacity: 0.7,
      };
}

const STATUS_CHIP: Record<NodeStatus, { bg: string; text: string }> = {
  completed: { bg: "rgba(168,85,247,0.20)", text: "#e9d5ff" },
  active: { bg: "rgba(168,85,247,0.25)", text: "#ddd6fe" },
  locked: { bg: "rgba(255,255,255,0.10)", text: "rgba(255,255,255,0.45)" },
};

/** Pulsing ring around the current (active) level. */
function ActiveHalo({ size }: { size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size + 12,
          height: size + 12,
          borderRadius: (size + 12) / 2,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1.06],
              }),
            },
          ],
        },
      ]}
    />
  );
}

interface MapNodeProps {
  node: GraphNode;
  point: LevelPoint;
  canvasWidth: number;
  selected: boolean;
  onSelect: (key: string) => void;
}

/**
 * One level node + its card. Memoized so selecting a node or appending a new
 * phase does not repaint every level on the map.
 */
const MapNode = memo(function MapNode({
  node,
  point,
  canvasWidth,
  selected,
  onSelect,
}: MapNodeProps) {
  const isBoss = node.type === "boss";
  const locked = node.status === "locked";
  const completed = node.status === "completed";
  const active = node.status === "active";
  const size = point.size;
  const title = isBoss
    ? node.title.replace(/^boss battle:\s*/i, "") || node.title
    : node.title;
  // Labels ride toward the centre so they never sit on the path.
  const labelSide: "left" | "right" =
    point.cx < canvasWidth / 2 ? "right" : "left";
  const spec = circleSpec(node.status, isBoss);
  const Icon = isBoss ? Skull : completed ? Check : locked ? Lock : Zap;
  const chip = STATUS_CHIP[node.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Level ${node.levelNumber} · ${node.title} · ${STATUS_WORD[node.status]}`}
      onPress={() => onSelect(node.key)}
      style={[
        styles.node,
        {
          left: point.cx - size / 2,
          top: point.cy - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={[styles.underglow, isBoss && styles.underglowBoss]}
        />
      ) : null}

      {active ? <ActiveHalo size={size} /> : null}

      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: spec.border,
            opacity: spec.opacity,
            transform: [{ scale: selected ? 1.08 : 1 }],
          },
          selected && styles.circleSelected,
          spec.glowColor
            ? {
                shadowColor: spec.glowColor,
                shadowOpacity: spec.glowOpacity,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              }
            : null,
        ]}
      >
        <LinearGradient
          colors={spec.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <Icon
          size={isBoss ? 40 : 30}
          color={locked && !isBoss ? "rgba(255,255,255,0.7)" : colors.white}
          strokeWidth={2.4}
        />
        {!isBoss ? (
          <Text style={styles.levelNumber}>{node.levelNumber}</Text>
        ) : null}
      </View>

      {/* Glassmorphism level card beside the node. */}
      <View
        pointerEvents="none"
        style={[
          styles.labelWrap,
          labelSide === "right"
            ? { left: size + 18 }
            : { right: size + 18 },
        ]}
      >
        {isBoss ? (
          <View style={styles.bossBadge}>
            <Text style={styles.bossBadgeText}>Boss Battle</Text>
          </View>
        ) : null}
        <View style={styles.labelCard}>
          <Text numberOfLines={2} style={styles.labelTitle}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Lv {node.levelNumber}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{node.estimatedDays}d</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.statusChipText, { color: chip.text }]}>
                {STATUS_WORD[node.status]}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export function RoadmapMap({ graph, selectedKey, onSelect }: RoadmapMapProps) {
  const ordered = useMemo(() => orderedNodes(graph.nodes), [graph.nodes]);
  const blurTarget = useBlurTargetRef();
  const layout = useMemo(() => layoutLevels(graph.nodes), [graph.nodes]);
  const trail = useMemo(() => {
    const out: LevelPoint[] = [];
    for (const node of ordered) {
      const point = layout.points.get(node.key);
      if (point) out.push(point);
    }
    return out;
  }, [ordered, layout]);
  const ribbon = useMemo(() => trailPath(trail), [trail]);

  // Fit the fixed-width canvas into narrow (mobile) viewports.
  const [hostWidth, setHostWidth] = useState(0);
  const scale =
    hostWidth > 0 ? Math.min(1, hostWidth / layout.width) : 1;

  // Phase ribbons at every 5th level, sitting in the gap below that row.
  const dividers = useMemo(() => {
    const out: {
      key: string;
      y: number;
      phaseNumber: number;
      title: string;
      complete: boolean;
      done: number;
      total: number;
    }[] = [];

    for (let i = 4; i < ordered.length - 1; i += 5) {
      const a = trail[i];
      const b = trail[i + 1];
      const next = ordered[i + 1];
      if (!a || !b || !next) continue;
      const phase = graph.phases.find((p) => p.number === next.phaseNumber);
      const counts = phaseProgress(graph, next.phaseNumber);
      out.push({
        key: `div-${i}`,
        y: (a.cy + a.size / 2 + (b.cy - b.size / 2)) / 2,
        phaseNumber: next.phaseNumber,
        title: phase?.title ?? "Journey",
        complete: counts.total > 0 && counts.completed >= counts.total,
        done: counts.completed,
        total: counts.total,
      });
    }
    return out;
  }, [ordered, trail, graph]);

  return (
    <View style={styles.card}>
      <BlurView
        intensity={28}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget ?? undefined}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={styles.canvasHost}
        onLayout={(event) => setHostWidth(event.nativeEvent.layout.width)}
      >
        <View
          style={{
            width: layout.width * scale,
            height: layout.height * scale,
          }}
        >
          <View
            style={[
              styles.canvas,
              {
                width: layout.width,
                height: layout.height,
                transform: [{ scale }],
                transformOrigin: "top left",
              },
            ]}
          >
            {/* Trail: gradient ribbon + status overlays. */}
            <Svg
              pointerEvents="none"
              width={layout.width}
              height={layout.height}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient
                  id="atlas-trail-grad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={layout.height}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor="#a855f7" />
                  <Stop offset="50%" stopColor="#6366f1" />
                  <Stop offset="100%" stopColor="#22d3ee" />
                </SvgLinearGradient>
              </Defs>

              {/* Locked trail: thick dashed purple→cyan, low opacity. */}
              <Path
                d={ribbon}
                fill="none"
                stroke="url(#atlas-trail-grad)"
                strokeWidth={6}
                strokeDasharray="10 15"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
              />

              {/* Progress: completed draws solid, active sits as a bright dash. */}
              {ordered.slice(1).map((node, index) => {
                const spec = overlayStyle(node.status);
                if (!spec) return null;
                const segment = trailSegmentPath(trail, index);
                return (
                  <G key={`${node.key}-${node.status}`}>
                    {spec.glow ? (
                      <Path
                        d={segment}
                        fill="none"
                        stroke={spec.glow}
                        strokeWidth={12}
                        strokeLinecap="round"
                        opacity={0.18}
                      />
                    ) : null}
                    <Path
                      d={segment}
                      fill="none"
                      stroke={spec.stroke}
                      strokeWidth={spec.strokeWidth}
                      strokeDasharray={spec.dash}
                      strokeLinecap="round"
                    />
                  </G>
                );
              })}
            </Svg>

            {/* Phase dividers: ribbon every 5 levels. */}
            {dividers.map((divider) => (
              <View
                key={divider.key}
                pointerEvents="none"
                style={[styles.dividerRow, { top: divider.y - 16 }]}
              >
                <View
                  style={[
                    styles.dividerPill,
                    divider.complete && styles.dividerPillComplete,
                  ]}
                >
                  <Text
                    style={[
                      styles.dividerPhase,
                      divider.complete && styles.dividerPhaseComplete,
                    ]}
                  >
                    Phase {divider.phaseNumber}
                  </Text>
                  <LinearGradient
                    colors={[
                      "rgba(168,85,247,0.6)",
                      "rgba(34,211,238,0.3)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dividerLine}
                  />
                  <Text numberOfLines={1} style={styles.dividerTitle}>
                    {divider.title}
                    {divider.complete ? " Complete!" : ""}
                  </Text>
                  <View
                    style={[
                      styles.dividerCount,
                      divider.complete && styles.dividerCountComplete,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dividerCountText,
                        divider.complete && styles.dividerCountTextComplete,
                      ]}
                    >
                      {divider.done}/{divider.total}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Level nodes + glass level cards. */}
            {ordered.map((node) => {
              const point = layout.points.get(node.key);
              if (!point) return null;
              return (
                <MapNode
                  key={node.key}
                  node={node}
                  point={point}
                  canvasWidth={layout.width}
                  selected={node.key === selectedKey}
                  onSelect={onSelect}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: "rgba(6,6,14,0.35)",
    paddingTop: 40,
    overflow: "hidden",
  },
  canvasHost: {
    alignItems: "center",
  },
  canvas: {
    position: "relative",
  },
  dividerRow: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dividerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 540,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  dividerPillComplete: {
    borderColor: "rgba(168,85,247,0.45)",
    backgroundColor: "rgba(168,85,247,0.12)",
    shadowColor: "#a855f7",
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  dividerPhase: {
    fontSize: 10.5,
    fontFamily: fonts.semibold,
    letterSpacing: 2.8,
    textTransform: "uppercase",
    color: colors.lilac,
  },
  dividerPhaseComplete: {
    color: "#ddd6fe",
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: "rgba(255,255,255,0.85)",
  },
  dividerCount: {
    borderRadius: 999,
    backgroundColor: colors.w10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dividerCountComplete: {
    backgroundColor: "rgba(168,85,247,0.25)",
  },
  dividerCountText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.55)",
  },
  dividerCountTextComplete: {
    color: "#ede9fe",
  },
  node: {
    position: "absolute",
    zIndex: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    left: -6,
    top: -6,
    borderWidth: 2,
    borderColor: "rgba(207,158,255,0.7)",
  },
  underglow: {
    position: "absolute",
    bottom: -16,
    width: 76,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(207,158,255,0.7)",
    shadowColor: "#cf9eff",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  underglowBoss: {
    backgroundColor: "rgba(244,63,94,0.7)",
    shadowColor: "#f43f5e",
  },
  circle: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  circleSelected: {
    borderColor: "rgba(255,255,255,0.7)",
  },
  levelNumber: {
    marginTop: 4,
    fontSize: 11.5,
    fontFamily: fonts.semibold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.9)",
  },
  labelWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 224,
    justifyContent: "center",
  },
  bossBadge: {
    alignSelf: "flex-start",
    marginBottom: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.6)",
    backgroundColor: "rgba(244,63,94,0.25)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    shadowColor: "#f43f5e",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  bossBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#ffe4e6",
  },
  labelCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  labelTitle: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.semibold,
    color: "rgba(255,255,255,0.9)",
  },
  metaRow: {
    marginTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  metaChip: {
    borderRadius: 5,
    backgroundColor: colors.w10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.6)",
  },
  statusChip: {
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
  },
});
