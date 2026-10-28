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
import { buildWidgetMeshSvg } from "./widget-mesh";
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
  const showFooter = height >= 240;

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
      {/* Mesh gradient: soft radial layers, no visible blob edges. */}
      <SvgWidget
        svg={buildWidgetMeshSvg(width, height, "stats")}
        style={{ width: "match_parent", height: "match_parent" }}
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
              flexGap: compact ? 9 : 11,
            }}
          >
            <FlexWidget
              style={{
                width: compact ? 38 : 42,
                height: compact ? 38 : 42,
                borderRadius: compact ? 14 : 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundGradient: {
                  from: "rgba(255, 176, 96, 0.20)",
                  to: "rgba(255, 122, 40, 0.05)",
                  orientation: "TL_BR",
                },
                borderWidth: 1,
                borderColor: "rgba(255, 166, 84, 0.30)",
              }}
            >
              <SvgWidget
                svg={buildFlameIcon("#ffb35c", compact ? 21 : 24)}
                style={{ width: compact ? 21 : 24, height: compact ? 21 : 24 }}
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
              const isToday = day.isToday === true;
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
                    fontSize: 9,
                    fontWeight: day.isToday === true ? "700" : "500",
                    color: day.isToday === true ? LILAC : FAINT,
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
              marginTop: 10,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: HAIRLINE,
            }}
          >
            <FlexWidget
              style={{
                flex: 1,
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text="FOCUS TODAY"
                style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: FAINT,
                  letterSpacing: 1.1,
                }}
                maxLines={1}
              />
              <TextWidget
                text={formatFocus(data.todaySeconds)}
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: LILAC,
                  lineHeight: 22,
                  marginTop: 2,
                }}
                maxLines={1}
              />
            </FlexWidget>

            <FlexWidget
              style={{
                width: 1,
                height: 30,
                marginHorizontal: 12,
                backgroundColor: HAIRLINE,
              }}
            />

            <FlexWidget
              style={{
                flex: 1,
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text="THIS WEEK"
                style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: FAINT,
                  letterSpacing: 1.1,
                }}
                maxLines={1}
              />
              <FlexWidget
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  flexGap: 4,
                  marginTop: 2,
                }}
              >
                <TextWidget
                  text={formatXp(data.weeklyXp)}
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: WHITE,
                    lineHeight: 22,
                  }}
                  maxLines={1}
                />
                <TextWidget
                  text="XP"
                  style={{
                    fontSize: 9,
                    fontWeight: "600",
                    color: FAINT,
                    lineHeight: 22,
                  }}
                  maxLines={1}
                />
              </FlexWidget>
            </FlexWidget>
          </FlexWidget>
        )}
      </FlexWidget>
    </OverlapWidget>
  );
}
