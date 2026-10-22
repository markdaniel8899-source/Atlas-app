"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { AtlasWidgetData, WidgetWeekDay } from "./atlas-widget-data";
import { barHeight, formatFocus } from "./widget-model";
import { buildFlameIcon, buildTimerIcon, buildAwardIcon } from "./icons";

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
const COMPACT_BREAKPOINT = 200;

/**
 * Premium ATLAS stats card: streak, today's focus, a slim 7-day chart and the
 * strongest badges, all inside one elegant dark glass panel.
 * Responsive: wide (>=200dp) shows full layout, compact (<200dp) hides bars.
 */
export function AtlasWidget({
  data,
  width = 250,
  height = 110,
}: {
  data: AtlasWidgetData;
  width?: number;
  height?: number;
}) {
  const week: WidgetWeekDay[] = data.week.slice(-WEEK_LENGTH);
  const maxSeconds = Math.max(1, ...week.map((day) => day.seconds));
  const lastIndex = week.length - 1;
  const streakCaption = data.streak > 0 ? "day streak" : "start today";
  const isCompact = width < COMPACT_BREAKPOINT;

  const rankChip = (
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
        text={`★ ${data.rankName}`}
        style={{
          fontSize: 9,
          fontWeight: "700",
          color: LILAC,
          letterSpacing: 0.5,
        }}
        maxLines={1}
      />
    </FlexWidget>
  );

  const lvPill = (
    <FlexWidget
      style={{
        backgroundColor: CHIP_BG,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: CHIP_BORDER,
        flexDirection: "row",
        alignItems: "center",
        flexGap: 4,
      }}
    >
      <TextWidget
        text={buildAwardIcon(LILAC, 10)}
        style={{}}
      />
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
  );

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 12,
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
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TextWidget
          text="ATLAS"
          style={{
            fontSize: isCompact ? 11 : 12,
            fontFamily: "CreateFuture",
            letterSpacing: 1.5,
            color: LILAC,
          }}
        />
        {isCompact ? lvPill : rankChip}
      </FlexWidget>

      {!isCompact ? (
        <>
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <FlexWidget
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                flexGap: 6,
              }}
            >
              <TextWidget
                text={buildFlameIcon(LILAC, 20)}
                style={{}}
              />
              <TextWidget
                text={`${data.streak}`}
                style={{ fontSize: 32, fontWeight: "800", color: WHITE, lineHeight: 32 }}
                maxLines={1}
              />
              <TextWidget
                text={streakCaption}
                style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}
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
                  fontSize: 7,
                  fontWeight: "600",
                  color: FAINT,
                  letterSpacing: 1.2,
                }}
                maxLines={1}
              />
              <TextWidget
                text={formatFocus(data.todaySeconds)}
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: WHITE,
                  marginTop: 2,
                }}
                maxLines={1}
              />
            </FlexWidget>
          </FlexWidget>

          {week.length > 0 && (
            <FlexWidget
              style={{
                width: "match_parent",
                flexDirection: "row",
                alignItems: "flex-end",
                flexGap: 4,
                marginTop: 8,
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
                        marginBottom: 3,
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
                        fontSize: 7,
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
          )}

          <FlexWidget
            style={{
              width: "match_parent",
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 0.5,
              borderTopColor: HAIRLINE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexGap: 8,
            }}
          >
            <FlexWidget
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexGap: 6,
              }}
            >
              {data.badges.slice(0, 2).map((badge, i) => (
                <TextWidget
                  key={i}
                  text={badge.replace(/^🔥\s*/, "").replace(/^★\s*/, "★ ").replace(/^⚡\s*/, "⚡ ")}
                  style={{
                    fontSize: 8,
                    fontWeight: "600",
                    color: LILAC_SOFT,
                    letterSpacing: 0.2,
                  }}
                  maxLines={1}
                  truncate="END"
                />
              ))}
            </FlexWidget>
            <TextWidget
              text={`LV ${data.level}`}
              style={{
                fontSize: 8,
                fontWeight: "700",
                color: LILAC,
                letterSpacing: 0.5,
              }}
              maxLines={1}
            />
          </FlexWidget>
        </>
      ) : (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "column",
            alignItems: "flex-start",
            marginTop: 8,
            flexGap: 8,
          }}
        >
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              flexGap: 6,
            }}
          >
            <TextWidget
              text={buildFlameIcon(LILAC, 18)}
              style={{}}
            />
            <TextWidget
              text={`${data.streak}`}
              style={{ fontSize: 24, fontWeight: "800", color: WHITE, lineHeight: 24 }}
              maxLines={1}
            />
            <TextWidget
              text={streakCaption}
              style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}
              maxLines={1}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexGap: 8,
            }}
          >
            <TextWidget
              text={buildTimerIcon(LILAC, 12)}
              style={{}}
            />
            <TextWidget
              text="FOCUS TODAY"
              style={{
                fontSize: 7,
                fontWeight: "600",
                color: FAINT,
                letterSpacing: 1,
              }}
              maxLines={1}
            />
            <TextWidget
              text={formatFocus(data.todaySeconds)}
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: WHITE,
              }}
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}