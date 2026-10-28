"use no memo";

import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
} from "react-native-android-widget";
import { getRankFromXP } from "../gamification";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { buildFlameIcon } from "./icons";
import { buildRankBadgeSvg } from "./rank-badge-svg";
import { barHeight, formatFocus, formatXp } from "./widget-model";

const WHITE = "#ffffff";
const LILAC = "#cf9eff";
const LILAC_DEEP = "#8b5cf6";
const MUTED = "rgba(255, 255, 255, 0.52)";
const FAINT = "rgba(255, 255, 255, 0.32)";
const TRACK = "rgba(255, 255, 255, 0.08)";
const HAIRLINE = "rgba(255, 255, 255, 0.07)";
const CARD_BG = "#05050a";
const CARD_BORDER = "rgba(255, 255, 255, 0.085)";

const WEEK_LENGTH = 7;

/**
 * Streak + rank stats card: black glass panel with soft theme-colored glow
 * spots, the dashboard flame icon, a metallic rank badge and a 7-day chart
 * that only appears when the widget is tall enough.
 */
export function AtlasWidget({
  data,
  width = 340,
  height = 240,
}: {
  data: AtlasWidgetData;
  width?: number;
  height?: number;
}) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const compact = height < 175;
  const showChart = height >= 195;
  const showFooter = height >= 250;

  const rank = getRankFromXP(data.xp);
  const badgeSize = compact ? 38 : 46;
  const padding = compact ? 14 : 16;
  const streakNumberSize = compact ? 32 : 38;
  const chartHeight = compact ? 34 : 48;

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        borderRadius: 26,
        overflow: "hidden",
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: CARD_BORDER,
      }}
    >
      {/* Glow spots - layered gradient circles read as an out-of-focus blur. */}
      <FlexWidget
        style={{
          width: 190,
          height: 190,
          borderRadius: 95,
          marginLeft: Math.max(8, width - 120),
          marginTop: -62,
          backgroundGradient: {
            from: "rgba(207, 158, 255, 0.30)",
            to: "rgba(207, 158, 255, 0.00)",
            orientation: "TL_BR",
          },
        }}
      />
      <FlexWidget
        style={{
          width: 170,
          height: 170,
          borderRadius: 85,
          marginLeft: -74,
          marginTop: Math.max(0, height - 104),
          backgroundGradient: {
            from: "rgba(139, 92, 246, 0.26)",
            to: "rgba(139, 92, 246, 0.00)",
            orientation: "TL_BR",
          },
        }}
      />
      <FlexWidget
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          marginLeft: Math.max(0, width - 168),
          marginTop: Math.max(0, height - 150),
          backgroundGradient: {
            from: "rgba(157, 180, 255, 0.18)",
            to: "rgba(157, 180, 255, 0.00)",
            orientation: "TL_BR",
          },
        }}
      />

      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          flexDirection: "column",
          padding,
          justifyContent: "space-between",
        }}
      >
        {/* Header */}
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TextWidget
            text="ATLAS"
            style={{
              fontSize: compact ? 17 : 19,
              fontWeight: "400",
              color: WHITE,
              letterSpacing: 4,
              fontFamily: "CreateFuture",
            }}
            maxLines={1}
          />
          <FlexWidget
            style={{
              paddingHorizontal: 11,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: "rgba(207, 158, 255, 0.14)",
              borderWidth: 1,
              borderColor: "rgba(207, 158, 255, 0.30)",
            }}
          >
            <TextWidget
              text={`LV ${data.level}`}
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: LILAC,
                letterSpacing: 0.8,
              }}
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Streak | Rank */}
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexGap: compact ? 8 : 10,
            }}
          >
            <FlexWidget
              style={{
                width: compact ? 36 : 44,
                height: compact ? 36 : 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 166, 84, 0.10)",
                borderWidth: 1,
                borderColor: "rgba(255, 166, 84, 0.26)",
              }}
            >
              <SvgWidget
                svg={buildFlameIcon("#ffb35c", compact ? 20 : 24)}
                style={{ width: compact ? 20 : 24, height: compact ? 20 : 24 }}
              />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "column" }}>
              <TextWidget
                text={String(data.streak)}
                style={{
                  fontSize: streakNumberSize,
                  fontWeight: "800",
                  color: WHITE,
                  lineHeight: streakNumberSize + 2,
                }}
                maxLines={1}
              />
              <TextWidget
                text={data.streak > 0 ? "day streak" : "start today"}
                style={{ fontSize: 9.5, color: MUTED, letterSpacing: 0.35 }}
                maxLines={1}
              />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
            <SvgWidget
              svg={buildRankBadgeSvg(
                rank.current.tier.key,
                rank.current.step,
                badgeSize,
              )}
              style={{ width: badgeSize, height: badgeSize }}
            />
            <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
              <TextWidget
                text={rank.name}
                style={{
                  fontSize: compact ? 11 : 12.5,
                  fontWeight: "700",
                  color: WHITE,
                  letterSpacing: 0.2,
                }}
                maxLines={1}
              />
              <TextWidget
                text={`${formatXp(data.xp)} XP`}
                style={{ fontSize: 9, color: FAINT, letterSpacing: 0.35 }}
                maxLines={1}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {showChart && (
          <FlexWidget
            style={{
              width: "match_parent",
              height: chartHeight,
              flexDirection: "row",
              alignItems: "flex-end",
              flexGap: 6,
              marginTop: 10,
            }}
          >
            {week.map((day, index) => {
              const isToday = index === week.length - 1;
              const h =
                day.seconds > 0
                  ? Math.max(
                      8,
                      Math.round(
                        (barHeight(day.seconds, maxSeconds) / 22) * chartHeight,
                      ),
                    )
                  : 4;
              return (
                <FlexWidget
                  key={`${day.label}-${index}`}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 3,
                    ...(isToday
                      ? {
                          backgroundGradient: {
                            from: LILAC,
                            to: LILAC_DEEP,
                            orientation: "TOP_BOTTOM" as const,
                          },
                        }
                      : {
                          backgroundColor:
                            day.seconds > 0
                              ? "rgba(207, 158, 255, 0.46)"
                              : TRACK,
                        }),
                  }}
                />
              );
            })}
          </FlexWidget>
        )}

        {showChart && (
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 5,
            }}
          >
            {week.map((day, index) => (
              <FlexWidget key={`${day.label}-${index}`} style={{ flex: 1 }}>
                <TextWidget
                  text={day.label}
                  style={{
                    fontSize: 8.5,
                    fontWeight: index === week.length - 1 ? "700" : "500",
                    color: index === week.length - 1 ? LILAC : FAINT,
                    letterSpacing: 0.3,
                    textAlign: "center",
                  }}
                  maxLines={1}
                />
              </FlexWidget>
            ))}
          </FlexWidget>
        )}

        {showFooter && (
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: HAIRLINE,
            }}
          >
            <FlexWidget style={{ flexDirection: "column" }}>
              <TextWidget
                text="FOCUS TODAY"
                style={{
                  fontSize: 8.5,
                  fontWeight: "600",
                  color: FAINT,
                  letterSpacing: 1,
                }}
                maxLines={1}
              />
              <TextWidget
                text={formatFocus(data.todaySeconds)}
                style={{ fontSize: 16, fontWeight: "700", color: LILAC }}
                maxLines={1}
              />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
              <TextWidget
                text="THIS WEEK"
                style={{
                  fontSize: 8.5,
                  fontWeight: "600",
                  color: FAINT,
                  letterSpacing: 1,
                }}
                maxLines={1}
              />
              <TextWidget
                text={`${formatXp(data.weeklyXp)} XP`}
                style={{ fontSize: 16, fontWeight: "700", color: WHITE }}
                maxLines={1}
              />
            </FlexWidget>
          </FlexWidget>
        )}
      </FlexWidget>
    </OverlapWidget>
  );
}
