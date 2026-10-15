import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { summariseHeatmap } from '@/lib/db/activity';
import type { HeatmapDay } from '@/lib/db/types';

interface Props {
  days: HeatmapDay[];
  weeks?: number;
}

const CELL = 12;
const GAP = 4;
const LABEL_W = 28;
const ROW_H = CELL + GAP;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const LEVEL_COLORS = [
  'rgba(255,255,255,0.05)',
  'rgba(207,158,255,0.25)',
  'rgba(207,158,255,0.5)',
  'rgba(207,158,255,0.75)',
  '#cf9eff',
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
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
    const monthLabel = previousMonth === -1 || month !== previousMonth ? MONTHS[month] : null;
    previousMonth = month;

    columns.push({ key: `w${week}`, monthLabel, cells });
  }

  return columns;
}

export function ActivityHeatmap({ days, weeks = 53 }: Props) {
  const columns = useMemo(() => buildColumns(days, weeks), [days, weeks]);
  const { totalSeconds, activeDays } = useMemo(() => summariseHeatmap(days), [days]);
  const hours = Math.round((totalSeconds / 3600) * 10) / 10;

  const contentWidth = LABEL_W + weeks * (CELL + GAP);

  return (
    <GlassCard className="p-6">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <View>
          <Text
            allowFontScaling={false}
            className="text-xs font-medium uppercase tracking-[0.32em] text-[#9db4ff]/70">
            Activity
          </Text>
          <Text
            allowFontScaling={false}
            className="mt-1.5 font-sans-medium text-lg tracking-[-0.02em] text-white">
            Last {weeks} weeks
          </Text>
        </View>
        <Text allowFontScaling={false} className="text-[13px] text-white/40">
          <Text allowFontScaling={false} className="font-medium text-white">
            {activeDays}
          </Text>{' '}
          active days{' '}
          <Text allowFontScaling={false} className="text-white/20">
            /
          </Text>{' '}
          <Text allowFontScaling={false} className="font-medium text-white">
            {hours}
          </Text>{' '}
          hours focused
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-6"
        contentContainerStyle={{ width: contentWidth }}
        accessibilityLabel={`Focus activity for the last ${weeks} weeks, ${activeDays} active days.`}>
        <View>
          <View style={{ height: 16, paddingLeft: LABEL_W }}>
            {columns.map((column, index) =>
              column.monthLabel ? (
                <Text
                  key={`${column.key}-label`}
                  allowFontScaling={false}
                  className="absolute text-[10px] leading-none text-white/35"
                  style={{ left: LABEL_W + index * (CELL + GAP), top: 0 }}>
                  {column.monthLabel}
                </Text>
              ) : null,
            )}
          </View>

          <View>
            {DAY_LABELS.map((label, dow) => (
              <View key={dow} className="flex-row items-center" style={{ height: ROW_H }}>
                <View style={{ width: LABEL_W - 4 }}>
                  <Text allowFontScaling={false} className="text-[10px] leading-none text-white/30">
                    {label}
                  </Text>
                </View>
                {columns.map((column) => {
                  const cell = column.cells[dow];
                  return (
                    <View
                      key={cell.key}
                      style={{
                        width: CELL,
                        height: CELL,
                        marginRight: GAP,
                        borderRadius: 3,
                        backgroundColor: cell.future ? 'transparent' : LEVEL_COLORS[cell.level],
                        ...(cell.level === 4 && !cell.future
                          ? { boxShadow: '0px 0px 10px 0px rgba(207,158,255,0.7)' }
                          : {}),
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="mt-5 flex-row items-center justify-end gap-1.5">
        <Text allowFontScaling={false} className="mr-1 text-xs text-white/35">
          Less
        </Text>
        {LEVEL_COLORS.map((color, level) => (
          <View
            key={level}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              backgroundColor: color,
              ...(level === 4 ? { boxShadow: '0px 0px 10px 0px rgba(207,158,255,0.7)' } : {}),
            }}
          />
        ))}
        <Text allowFontScaling={false} className="ml-1 text-xs text-white/35">
          More
        </Text>
      </View>
    </GlassCard>
  );
}
