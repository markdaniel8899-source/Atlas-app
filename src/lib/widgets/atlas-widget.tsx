import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { barHeight, formatFocus } from "./widget-model";

const LILAC = "#cf9eff";
const LILAC_SOFT = "#d9c2ff";
const LILAC_DEEP = "#8b5cf6";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.62)";
const FAINT = "rgba(255, 255, 255, 0.38)";
const TRACK = "rgba(255, 255, 255, 0.16)";
const CHIP_BG = "rgba(207, 158, 255, 0.10)";
const CHIP_BORDER = "rgba(207, 158, 255, 0.30)";

const WEEK_LENGTH = 7;

/**
 * ATLAS stats card: streak, today's focus time, a 7-day chart and the
 * user's badges - everything about momentum in one glance.
 */
export function AtlasWidget({ data }: { data: AtlasWidgetData }) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const lastIndex = week.length - 1;
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const badges = data.badges.slice(0, 3);

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
        borderColor: "rgba(207, 158, 255, 0.22)",
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
            fontSize: 12.5,
            fontFamily: "CreateFuture",
            color: LILAC,
          }}
        />
        <FlexWidget
          style={{
            backgroundColor: CHIP_BG,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: "rgba(207, 158, 255, 0.24)",
          }}
        >
          <TextWidget
            text={`LV ${data.level}`}
            style={{
              fontSize: 9.5,
              fontWeight: "700",
              color: LILAC,
              letterSpacing: 0.4,
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
            flexGap: 7,
          }}
        >
          <TextWidget text="🔥" style={{ fontSize: 24, color: WHITE }} />
          <TextWidget
            text={`${data.streak}`}
            style={{ fontSize: 34, fontWeight: "bold", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text={streakCaption}
            style={{ fontSize: 12, color: MUTED, marginBottom: 5 }}
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
              fontSize: 8.5,
              fontWeight: "600",
              color: FAINT,
              letterSpacing: 1.4,
            }}
            maxLines={1}
          />
          <TextWidget
            text={formatFocus(data.todaySeconds)}
            style={{
              fontSize: 19,
              fontWeight: "bold",
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
            flexGap: 8,
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
                    borderRadius: 5,
                    marginBottom: 4,
                    ...(isToday
                      ? {
                          backgroundGradient: {
                            from: LILAC,
                            to: LILAC_DEEP,
                            orientation: "TOP_BOTTOM" as const,
                          },
                        }
                      : { backgroundColor: day.seconds > 0 ? "rgba(207, 158, 255, 0.34)" : TRACK }),
                  }}
                />
                <TextWidget
                  text={day.label}
                  style={{
                    width: "match_parent",
                    fontSize: 8.5,
                    fontWeight: isToday ? "700" : "500",
                    textAlign: "center",
                    color: isToday ? LILAC : FAINT,
                  }}
                  maxLines={1}
                />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      ) : null}

      {badges.length > 0 ? (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            flexGap: 6,
            marginTop: 12,
          }}
        >
          {badges.map((badge) => (
            <FlexWidget
              key={badge}
              style={{
                backgroundColor: CHIP_BG,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: CHIP_BORDER,
                paddingHorizontal: 9,
                paddingVertical: 4.5,
              }}
            >
              <TextWidget
                text={badge}
                style={{ fontSize: 10, fontWeight: "600", color: LILAC_SOFT }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
