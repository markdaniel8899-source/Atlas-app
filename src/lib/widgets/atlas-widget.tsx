"use no memo";

import {
  FlexWidget,
  SvgWidget,
  TextWidget,
} from "react-native-android-widget";
import { getRankFromXP } from "../gamification";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { formatXp } from "./widget-model";
import { buildRankBadgeSvg } from "./rank-badge-svg";

const LILAC = "#cf9eff";
const LILAC_DEEP = "#8b5cf6";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.35)";
const TRACK = "rgba(255, 255, 255, 0.08)";
const HAIRLINE = "rgba(255, 255, 255, 0.08)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.06)";

const WEEK_LENGTH = 7;
const PADDING = 12;
const LEFT_WIDTH = 84;
/** Below this width the 7-day chart is dropped so the stats stay readable. */
const FULL_LAYOUT_MIN_WIDTH = 290;

/**
 * Wide streak card (4x2): flame + streak on the left, the 7-day focus chart
 * in the middle and the real rank badge with XP progress on the right.
 * Compact widths (<290dp) hide the chart instead of squeezing the stats.
 */
export function AtlasWidget({
  data,
  width = 250,
}: {
  data: AtlasWidgetData;
  width?: number;
  height?: number;
}) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const showBars = width >= FULL_LAYOUT_MIN_WIDTH && week.length > 0;

  const rank = getRankFromXP(data.xp);
  const badgeSvg = buildRankBadgeSvg(rank.tier.key, rank.current.step, 19);

  const rightWidth = Math.max(
    64,
    width - PADDING * 2 - LEFT_WIDTH - 21 - (showBars ? 76 : 0),
  );
  const fillWidth = Math.max(
    3,
    Math.round((rightWidth * Math.min(100, Math.max(0, rank.percent))) / 100),
  );

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        padding: PADDING,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: GLASS_BORDER,
        backgroundGradient: {
          from: "#1b1440",
          to: "#0a0817",
          orientation: "TL_BR",
        },
      }}
    >
      <FlexWidget
        style={{
          width: LEFT_WIDTH,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextWidget
          text="🔥"
          style={{ fontSize: 24, lineHeight: 28 }}
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
            text={`${data.streak}`}
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: WHITE,
              lineHeight: 28,
            }}
            maxLines={1}
          />
          <TextWidget
            text={streakCaption}
            style={{ fontSize: 8.5, color: MUTED, marginBottom: 3 }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {showBars ? (
        <FlexWidget
          style={{
            width: 74,
            height: 62,
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 3,
            marginLeft: 2,
          }}
        >
          {week.map((day, index) => {
            const isToday = index === week.length - 1;
            const height =
              day.seconds <= 0
                ? 4
                : 6 +
                  Math.round(
                    Math.min(1, day.seconds / maxSeconds) * 38,
                  );
            return (
              <FlexWidget
                key={`${day.label}-${index}`}
                style={{
                  flex: 1,
                  height,
                  borderRadius: 2,
                  ...(isToday
                    ? {
                        backgroundGradient: {
                          from: "#ffb27d",
                          to: "#ff8f52",
                          orientation: "TOP_BOTTOM" as const,
                        },
                      }
                    : {
                        backgroundColor:
                          day.seconds > 0
                            ? "rgba(207, 158, 255, 0.28)"
                            : TRACK,
                      }),
                }}
              />
            );
          })}
        </FlexWidget>
      ) : null}

      <FlexWidget
        style={{
          width: 1,
          height: 64,
          backgroundColor: HAIRLINE,
          marginHorizontal: 10,
        }}
      />

      <FlexWidget
        style={{
          width: rightWidth,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <FlexWidget
          style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}
        >
          <SvgWidget svg={badgeSvg} style={{ width: 19, height: 19 }} />
          <TextWidget
            text={rank.name}
            style={{
              fontSize: 10.5,
              fontWeight: "700",
              color: WHITE,
              letterSpacing: -0.1,
            }}
            maxLines={1}
            truncate="END"
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 4,
            marginTop: 6,
          }}
        >
          <TextWidget
            text={formatXp(data.xp)}
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: WHITE,
              lineHeight: 16,
            }}
            maxLines={1}
          />
          <TextWidget
            text="XP"
            style={{ fontSize: 8, color: FAINT, marginBottom: 2 }}
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            width: rightWidth,
            height: 4,
            borderRadius: 99,
            backgroundColor: TRACK,
            marginTop: 5,
          }}
        >
          <FlexWidget
            style={{
              width: fillWidth,
              height: 4,
              borderRadius: 99,
              backgroundGradient: {
                from: LILAC,
                to: LILAC_DEEP,
                orientation: "LEFT_RIGHT",
              },
            }}
          />
        </FlexWidget>

        <TextWidget
          text={
            rank.nextRankName
              ? `LV ${data.level} · ${formatXp(rank.xpToNext)} XP to ${rank.nextRankName}`
              : "Max rank reached"
          }
          style={{
            fontSize: 7.5,
            color: FAINT,
            marginTop: 5,
            letterSpacing: 0.1,
          }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );
}
