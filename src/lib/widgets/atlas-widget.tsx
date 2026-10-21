"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { barHeight, formatFocus } from "./widget-model";

const LILAC = "#cf9eff";
const LILAC_SOFT = "#d9c2ff";
const LILAC_DEEP = "#8b5cf6";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.35)";
const TRACK = "rgba(255, 255, 255, 0.08)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.06)";
const HAIRLINE = "rgba(255, 255, 255, 0.05)";
const CHIP_BG = "rgba(207, 158, 255, 0.08)";
const CHIP_BORDER = "rgba(207, 158, 255, 0.18)";

const WEEK_LENGTH = 7;

/**
 * Premium ATLAS stats card: streak, today's focus, a slim 7-day chart and the
 * strongest badges, all inside one elegant dark glass panel.
 */
export function AtlasWidget({ data }: { data: AtlasWidgetData }) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const lastIndex = week.length - 1;
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const badges = data.badges.slice(0, 2);
  const badgeLine = badges.length
    ? badges.join("  ·  ")
    : `★ ${data.rankName}`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 26,
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
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TextWidget
          text="ATLAS"
          style={{
            fontSize: 12,
            fontFamily: "CreateFuture",
            letterSpacing: 1.5,
            color: LILAC,
          }}
        />
        <FlexWidget
          style={{
            backgroundColor: CHIP_BG,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: CHIP_BORDER,
          }}
        >
          <TextWidget
            text={`LV ${data.level}`}
            style={{
              fontSize: 9,
              fontWeight: "700",
              color: LILAC,
              letterSpacing: 0.5,
            }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 6,
          }}
        >
          <TextWidget text="🔥" style={{ fontSize: 22, color: WHITE }} />
          <TextWidget
            text={`${data.streak}`}
            style={{ fontSize: 36, fontWeight: "800", color: WHITE, lineHeight: 36 }}
            maxLines={1}
          />
          <TextWidget
            text={streakCaption}
            style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <TextWidget
            text="FOCUS TODAY"
            style={{
              fontSize: 7.5,
              fontWeight: "600",
              color: FAINT,
              letterSpacing: 1.4,
            }}
            maxLines={1}
          />
          <TextWidget
            text={formatFocus(data.todaySeconds)}
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: WHITE,
              marginTop: 3,
            }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {week.length > 0 ? (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "flex-end",
            flexGap: 5,
            marginTop: 12,
          }}
        >
          {week.map((day, index) => {
            const isToday = index === lastIndex;
            return (
              <FlexWidget
                key={`${day.label}-${index}`}
                style={{ flex: 1, flexDirection: "column" }}
              >
                <FlexWidget
                  style={{
                    width: "match_parent",
                    height: barHeight(day.seconds, maxSeconds),
                    borderRadius: 3,
                    marginBottom: 4,
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
                              ? "rgba(207, 158, 255, 0.28)"
                              : TRACK,
                        }),
                  }}
                />
                <TextWidget
                  text={day.label}
                  style={{
                    width: "match_parent",
                    fontSize: 7.5,
                    fontWeight: isToday ? "700" : "500",
                    textAlign: "center",
                    color: isToday ? LILAC : FAINT,
                    letterSpacing: 0.3,
                  }}
                  maxLines={1}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      ) : null}

      <FlexWidget
        style={{
          width: "match_parent",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 0.5,
          borderTopColor: HAIRLINE,
        }}
      >
        <TextWidget
          text={badgeLine}
          style={{
            fontSize: 9,
            fontWeight: "600",
            color: LILAC_SOFT,
            letterSpacing: 0.2,
          }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );
}
