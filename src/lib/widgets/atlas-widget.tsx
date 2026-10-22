"use no memo";

import {
  FlexWidget,
  TextWidget,
} from "react-native-android-widget";
import { getRankFromXP } from "../gamification";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { formatFocus } from "./widget-model";

const LILAC = "#cf9eff";
const LILAC_DEEP = "#8b5cf6";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.35)";
const TRACK = "rgba(255, 255, 255, 0.08)";
const HAIRLINE = "rgba(255, 255, 255, 0.08)";
const GLASS_BORDER = "rgba(207, 158, 255, 0.22)";
const CARD_FROM = "#1b1440";
const CARD_TO = "#0a0817";

const WEEK_LENGTH = 7;
const PADDING = 16;
const CHART_HEIGHT = 56;

/**
 * Streak + Stats + Chart card (4x3+): ATLAS wordmark + LV pill header,
 * flame + streak + focus today row, 7-day focus chart, badge chips footer.
 * Single column layout with justifyContent space-between for premium feel.
 */
export function AtlasWidget({
  data,
  width = 320,
  height = 220,
}: {
  data: AtlasWidgetData;
  width?: number;
  height?: number;
}) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const focusTodayLabel = formatFocus(data.todaySeconds);

  const rank = getRankFromXP(data.xp);

  // Badge chips: streak milestone, rank, weekly XP
  const streakMilestones = [7, 14, 21, 30, 50, 100, 200, 365];
  const streakBadge = streakMilestones
    .filter((m) => data.streak >= m)
    .sort((a, b) => b - a)[0];
  const badges = [];
  if (streakBadge) badges.push(`🔥 ${streakBadge}-Day Streak`);
  badges.push(`★ ${rank.name}`);
  if (data.weeklyXp > 0) badges.push(`⚡ ${data.weeklyXp} wk XP`);
  const displayBadges = badges.slice(0, 3);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        padding: PADDING,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: GLASS_BORDER,
        backgroundGradient: {
          from: CARD_FROM,
          to: CARD_TO,
          orientation: "TL_BR",
        },
        justifyContent: "space-between",
      }}
    >
      {/* Header: ATLAS wordmark + LV pill */}
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
            fontSize: 18,
            fontWeight: "800",
            color: WHITE,
            letterSpacing: 3,
            fontFamily: "sans-serif",
          }}
          maxLines={1}
        />
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: "rgba(207, 158, 255, 0.18)",
            borderWidth: 1,
            borderColor: "rgba(207, 158, 255, 0.35)",
          }}
        >
          <TextWidget
            text={`LV ${data.level}`}
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: LILAC,
              letterSpacing: 0.5,
            }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Main Stats Row: Flame + Streak (left) | Focus Today (right) */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        {/* Left: Flame + Streak */}
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 6,
          }}
        >
          <TextWidget
            text="🔥"
            style={{ fontSize: 32, lineHeight: 36 }}
            maxLines={1}
          />
          <FlexWidget style={{ flexDirection: "column" }}>
            <TextWidget
              text={`${data.streak}`}
              style={{
                fontSize: 34,
                fontWeight: "800",
                color: WHITE,
                lineHeight: 36,
              }}
              maxLines={1}
            />
            <TextWidget
              text={streakCaption}
              style={{ fontSize: 10, color: MUTED, letterSpacing: 0.2 }}
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Right: Focus Today */}
        <FlexWidget
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            flexGap: 2,
          }}
        >
          <TextWidget
            text="FOCUS TODAY"
            style={{
              fontSize: 9,
              fontWeight: "600",
              color: FAINT,
              letterSpacing: 0.8,
            }}
            maxLines={1}
          />
          <TextWidget
            text={focusTodayLabel}
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: LILAC,
              lineHeight: 26,
            }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 7-Day Focus Chart */}
      <FlexWidget
        style={{
          width: "match_parent",
          height: CHART_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          flexGap: 5,
          marginTop: 6,
        }}
      >
        {week.map((day, index) => {
          const isToday = index === week.length - 1;
          const barHeight =
            day.seconds <= 0
              ? 4
              : 6 + Math.round(Math.min(1, day.seconds / maxSeconds) * 44);
          return (
            <FlexWidget
              key={`${day.label}-${index}`}
              style={{
                flex: 1,
                height: barHeight,
                borderRadius: 2,
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
                          ? "rgba(207, 158, 255, 0.34)"
                          : TRACK,
                    }),
              }}
            />
          );
        })}
      </FlexWidget>

      {/* Weekday Labels */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 4,
          paddingHorizontal: 2,
        }}
      >
        {week.map((day, index) => (
          <TextWidget
            key={`${day.label}-${index}`}
            text={day.label}
            style={{
              fontSize: 8.5,
              fontWeight: index === week.length - 1 ? "700" : "500",
              color: index === week.length - 1 ? LILAC : FAINT,
              letterSpacing: 0.2,
              textAlign: "center",
            }}
            maxLines={1}
          />
        ))}
      </FlexWidget>

      {/* Footer: Badge Chips */}
      {displayBadges.length > 0 && (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            flexGap: 6,
            alignItems: "center",
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 0.5,
            borderTopColor: HAIRLINE,
          }}
        >
          {displayBadges.map((badge, index) => (
            <FlexWidget
              key={`${badge}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderWidth: 0.5,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <TextWidget
                text={badge}
                style={{
                  fontSize: 8.5,
                  fontWeight: "600",
                  color: WHITE,
                  letterSpacing: 0.2,
                }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
