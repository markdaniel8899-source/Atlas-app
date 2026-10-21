import { useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "../ui/card";
import { summariseHeatmap } from "../../lib/db/activity";
import type { HeatmapDay } from "../../lib/db/types";
import { colors, fonts } from "../../theme/theme";

interface ActivityHeatmapProps {
  days: HeatmapDay[];
  weeks?: number;
}

const CELL = 12;
const GAP = 4;
const LABEL_WIDTH = 26;
const MONTH_ROW_HEIGHT = 16;
const GRID_HEIGHT = MONTH_ROW_HEIGHT + 7 * CELL + 6 * GAP;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const LEVEL_COLORS = [
  "rgba(255,255,255,0.05)",
  "rgba(207,158,255,0.25)",
  "rgba(207,158,255,0.50)",
  "rgba(207,158,255,0.75)",
  "#cf9eff",
];

interface GridCell {
  key: string;
  seconds: number;
  sessions: number;
  level: number;
  future: boolean;
}

interface GridColumn {
  key: string;
  monthLabel: string | null;
  cells: GridCell[];
}

function levelFor(seconds: number): number {
  if (seconds <= 0) return 0;
  const minutes = seconds / 60;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

function buildColumns(days: HeatmapDay[], weeks: number): GridColumn[] {
  const lookup = new Map<string, HeatmapDay>();
  for (const day of days) {
    lookup.set(String(day.day).slice(0, 10), day);
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const lastSunday = new Date(today);
  lastSunday.setUTCDate(today.getUTCDate() - today.getUTCDay());
  const first = new Date(lastSunday);
  first.setUTCDate(lastSunday.getUTCDate() - (weeks - 1) * 7);

  const columns: GridColumn[] = [];
  let previousMonth = -1;

  for (let week = 0; week < weeks; week += 1) {
    const columnStart = new Date(first);
    columnStart.setUTCDate(first.getUTCDate() + week * 7);

    const cells: GridCell[] = [];
    for (let dow = 0; dow < 7; dow += 1) {
      const date = new Date(columnStart);
      date.setUTCDate(columnStart.getUTCDate() + dow);
      const key = date.toISOString().slice(0, 10);
      const record = lookup.get(key);
      const seconds = record ? Number(record.total_seconds) || 0 : 0;

      cells.push({
        key,
        seconds,
        sessions: record ? Number(record.session_count) || 0 : 0,
        level: levelFor(seconds),
        future: date.getTime() > today.getTime(),
      });
    }

    const month = columnStart.getUTCMonth();
    const monthLabel =
      previousMonth === -1 || month !== previousMonth ? MONTHS[month] : null;
    previousMonth = month;

    columns.push({ key: `w${week}`, monthLabel, cells });
  }

  return columns;
}

export function ActivityHeatmap({ days, weeks = 53 }: ActivityHeatmapProps) {
  const columns = useMemo(() => buildColumns(days, weeks), [days, weeks]);
  const { totalSeconds, activeDays } = useMemo(
    () => summariseHeatmap(days),
    [days],
  );
  const hours = Math.round((totalSeconds / 3600) * 10) / 10;
  const scrollRef = useRef<ScrollView>(null);
  const scrolledToToday = useRef(false);

  return (
    <Card>
      <View style={styles.headerRow}>
        <View>
          <Text maxFontSizeMultiplier={1.3} style={styles.eyebrow}>
            Activity
          </Text>
          <Text style={styles.title}>Last {weeks} weeks</Text>
        </View>
        <Text style={styles.caption}>
          <Text style={styles.captionStrong}>{activeDays}</Text>
          {" active days "}
          <Text style={styles.captionFaint}>/</Text>
          {" "}
          <Text style={styles.captionStrong}>{hours}</Text>
          {" hours focused"}
        </Text>
      </View>

      <View
        style={styles.gridArea}
        accessible
        accessibilityLabel={`Focus activity for the last ${weeks} weeks, ${activeDays} active days.`}
      >
        <View style={styles.gridRow}>
          <View style={styles.gutter}>
            {DAY_LABELS.map((label, dow) => (
              <View
                key={dow}
                style={[
                  styles.gutterRow,
                  dow < 6 ? { marginBottom: GAP } : null,
                ]}
              >
                {label ? (
                  <Text
                    maxFontSizeMultiplier={1.1}
                    style={styles.dayLabel}
                  >
                    {label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.scrollWrap}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.gridScroll}
              onContentSizeChange={() => {
                if (scrolledToToday.current) return;
                scrolledToToday.current = true;
                scrollRef.current?.scrollToEnd({ animated: false });
              }}
            >
              <View>
                <View style={styles.monthsRow}>
                  {columns.map((column, index) =>
                    column.monthLabel ? (
                      <Text
                        key={column.key}
                        maxFontSizeMultiplier={1.1}
                        style={[
                          styles.monthLabel,
                          { left: index * (CELL + GAP) },
                        ]}
                      >
                        {column.monthLabel}
                      </Text>
                    ) : null,
                  )}
                </View>

                <View style={styles.columnsRow}>
                  {columns.map((column, index) => (
                    <View
                      key={column.key}
                      style={[
                        styles.weekColumn,
                        index < columns.length - 1
                          ? { marginRight: GAP }
                          : null,
                      ]}
                    >
                      {column.cells.map((cell, dow) => (
                        <View
                          key={cell.key}
                          style={[
                            styles.cell,
                            dow < 6 ? { marginBottom: GAP } : null,
                            {
                              backgroundColor: cell.future
                                ? "transparent"
                                : LEVEL_COLORS[cell.level],
                            },
                            cell.level === 4 && !cell.future
                              ? styles.levelFourGlow
                              : null,
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={[colors.cardBg, "rgba(12,12,22,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.leftFade}
            />
          </View>
        </View>

        <View style={styles.legend}>
          <Text maxFontSizeMultiplier={1.2} style={styles.legendText}>
            Less
          </Text>
          {LEVEL_COLORS.map((color, level) => (
            <View
              key={level}
              style={[
                styles.legendCell,
                { backgroundColor: color },
                level === 4 ? styles.levelFourGlow : null,
              ]}
            />
          ))}
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.legendText, styles.legendMore]}
          >
            More
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 24,
    rowGap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 2.8,
    textTransform: "uppercase",
    color: colors.star70,
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontFamily: fonts.medium,
    letterSpacing: -0.36,
    color: colors.white,
  },
  caption: {
    marginTop: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  captionStrong: {
    color: colors.white,
    fontFamily: fonts.medium,
  },
  captionFaint: {
    color: colors.w20,
  },
  gridArea: {
    marginTop: 24,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gutter: {
    width: LABEL_WIDTH,
    marginTop: MONTH_ROW_HEIGHT,
  },
  gutterRow: {
    height: CELL,
    position: "relative",
  },
  dayLabel: {
    position: "absolute",
    left: 0,
    top: 0,
    fontSize: 11,
    lineHeight: 12,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  scrollWrap: {
    flexGrow: 1,
    flexShrink: 1,
    height: GRID_HEIGHT,
  },
  gridScroll: {
    flexGrow: 1,
  },
  leftFade: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
  },
  monthsRow: {
    height: MONTH_ROW_HEIGHT,
    position: "relative",
  },
  monthLabel: {
    position: "absolute",
    top: 0,
    fontSize: 11,
    lineHeight: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  columnsRow: {
    flexDirection: "row",
  },
  weekColumn: {
    width: CELL,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  levelFourGlow: {
    shadowColor: "rgba(207,158,255,0.7)",
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  legend: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  legendMore: {
    marginLeft: 4,
  },
  legendCell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
});
