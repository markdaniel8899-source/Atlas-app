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
const TRACK = "rgba(255, 255, 255, 0.06)";
const HAIRLINE = "rgba(255, 255, 255, 0.05)";
const GLASS_BORDER = "rgba(207, 158, 255, 0.25)";
const GLASS_BORDER_STRONG = "rgba(207, 158, 255, 0.35)";
const CARD_FROM = "#140d2e";
const CARD_TO = "#080512";
const GLASS_HIGHLIGHT = "rgba(255, 255, 255, 0.03)";

const WEEK_LENGTH = 7;
const PADDING = 18;
const CHART_HEIGHT = 60;

const RANK_COLORS: Record<string, string> = {
  "Bronze I": "#cd7f32",
  "Bronze II": "#cd7f32",
  "Bronze III": "#cd7f32",
  "Silver I": "#c0c0c0",
  "Silver II": "#c0c0c0",
  "Silver III": "#c0c0c0",
  "Gold I": "#ffd700",
  "Gold II": "#ffd700",
  "Gold III": "#ffd700",
  "Platinum I": "#e5e4e2",
  "Platinum II": "#e5e4e2",
  "Platinum III": "#e5e4e2",
  "Diamond I": "#b9f2ff",
  "Diamond II": "#b9f2ff",
  "Diamond III": "#b9f2ff",
  "Conqueror": "#cf9eff",
};

/**
 * Premium Streak + Stats + Chart card with glassmorphism, theme gradients,
 * and app-style rank badge. Single column, space-between layout.
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
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const focusTodayLabel = formatFocus(data.todaySeconds);

  const rank = getRankFromXP(data.xp);
  const rankColor = RANK_COLORS[rank.name] || LILAC;

  // Badge chips: streak milestone (largest), rank (colored pill), weekly XP
  const streakMilestones = [7, 14, 21, 30, 50, 100, 200, 365];
  const streakBadge = streakMilestones
    .filter((m) => data.streak >= m)
    .sort((a, b) => b - a)[0];
  const badges = [];
  if (streakBadge) badges.push({ text: `🔥 ${streakBadge}-Day Streak`, type: "streak" as const });
  badges.push({ text: rank.name, type: "rank" as const, color: rankColor });
  if (data.weeklyXp > 0) badges.push({ text: `⚡ ${String(Math.max(0, Math.floor(data.weeklyXp))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} wk XP`, type: "xp" as const });
  const displayBadges = badges.slice(0, 3);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        padding: PADDING,
        borderRadius: 28,
        borderWidth: 1.5,
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
          marginBottom: 2,
        }}
      >
        <TextWidget
          text="ATLAS"
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: WHITE,
            letterSpacing: 4,
            fontFamily: "sans-serif",
          }}
          maxLines={1}
        />
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundGradient: {
              from: "rgba(207, 158, 255, 0.22)",
              to: "rgba(157, 180, 255, 0.18)",
              orientation: "TL_BR",
            },
            borderWidth: 1,
            borderColor: GLASS_BORDER_STRONG,
          }}
        >
          <TextWidget
            text={`LV ${data.level}`}
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: LILAC,
              letterSpacing: 0.8,
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
          marginTop: 6,
        }}
      >
        {/* Left: Flame + Streak with gradient glow */}
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 8,
            paddingVertical: 2,
          }}
        >
          <FlexWidget
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundGradient: {
                from: "rgba(255, 165, 0, 0.25)",
                to: "rgba(255, 100, 0, 0.15)",
                orientation: "TL_BR",
              },
              borderWidth: 1,
              borderColor: "rgba(255, 165, 0, 0.35)",
            }}
          >
            <TextWidget text="🔥" style={{ fontSize: 26, lineHeight: 30 }} maxLines={1} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: "column", justifyContent: "flex-end" }}>
            <TextWidget
              text={`${data.streak}`}
              style={{
                fontSize: 38,
                fontWeight: "800",
                color: WHITE,
                lineHeight: 40,
              }}
              maxLines={1}
            />
            <TextWidget
              text={streakCaption}
              style={{ fontSize: 10.5, color: MUTED, letterSpacing: 0.3 }}
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Right: Focus Today with theme accent */}
        <FlexWidget
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            flexGap: 3,
          }}
        >
          <TextWidget
            text="FOCUS TODAY"
            style={{
              fontSize: 9,
              fontWeight: "600",
              color: FAINT,
              letterSpacing: 1,
            }}
            maxLines={1}
          />
          <TextWidget
            text={focusTodayLabel}
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: LILAC,
              lineHeight: 28,
            }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 7-Day Focus Chart with gradient bars */}
      <FlexWidget
        style={{
          width: "match_parent",
          height: CHART_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          flexGap: 6,
          marginTop: 8,
        }}
      >
        {week.map((day, index) => {
          const isToday = index === week.length - 1;
          const h = day.seconds <= 0 ? 5 : 6 + Math.round(Math.min(1, day.seconds / maxSeconds) * 48);
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
                          ? "rgba(207, 158, 255, 0.38)"
                          : TRACK,
                    }),
              }}
            />
          );
        })}
      </FlexWidget>

      {/* Weekday Labels aligned under bars */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 5,
          paddingHorizontal: 3,
        }}
      >
        {week.map((day, index) => (
          <TextWidget
            key={`${day.label}-${index}`}
            text={day.label}
            style={{
              fontSize: 9,
              fontWeight: index === week.length - 1 ? "700" : "500",
              color: index === week.length - 1 ? LILAC : FAINT,
              letterSpacing: 0.3,
              textAlign: "center",
            }}
            maxLines={1}
          />
        ))}
      </FlexWidget>

      {/* Footer: Premium Badge Chips — streak milestone, rank (colored), weekly XP */}
      {displayBadges.length > 0 && (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            flexGap: 7,
            alignItems: "center",
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 0.5,
            borderTopColor: HAIRLINE,
          }}
        >
          {displayBadges.map((badge, index) => {
            const isRank = badge.type === "rank";
            const bgColor = isRank ? (badge as { color: string }).color : undefined;
            return (
              <FlexWidget
                key={`${badge.text}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: isRank ? 13 : 11,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: (isRank ? bgColor : "rgba(255, 255, 255, 0.07)") as any,
                  borderWidth: isRank ? 0 : 0.5,
                  borderColor: isRank ? undefined : "rgba(255, 255, 255, 0.08)",
                }}
              >
                <TextWidget
                  text={badge.text}
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: isRank ? "#080512" : WHITE,
                    letterSpacing: 0.3,
                  }}
                  maxLines={1}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}