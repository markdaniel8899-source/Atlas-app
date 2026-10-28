"use no memo";

import {
  FlexWidget,
  ListWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
} from "react-native-android-widget";
import type { WidgetNote } from "./notes-widget-data";
import { buildFileTextIcon, buildPlusIcon } from "./icons";

const LILAC = "#cf9eff";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.52)";
const FAINT = "rgba(255, 255, 255, 0.32)";
const HAIRLINE = "rgba(255, 255, 255, 0.07)";
const CARD_BG = "#05050a";
const CARD_BORDER = "rgba(255, 255, 255, 0.085)";
const NOTE_DOT = "#cf9eff";

/**
 * Recent-notes card with the same black glass language as the stats widget:
 * theme-colored glow spots, compose shortcut and a scrollable list.
 */
export function AtlasNotesWidget({
  notes,
  width = 280,
  height = 180,
}: {
  notes: WidgetNote[];
  width?: number;
  height?: number;
}) {
  const displayNotes = notes.slice(0, 5);
  const padding = 16;
  const listHeight = Math.max(40, height - padding * 2 - 30 - 8);
  const isCompact = width < 220;

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
      <FlexWidget
        style={{
          width: 170,
          height: 170,
          borderRadius: 85,
          marginLeft: Math.max(8, width - 110),
          marginTop: -58,
          backgroundGradient: {
            from: "rgba(207, 158, 255, 0.28)",
            to: "rgba(207, 158, 255, 0.00)",
            orientation: "TL_BR",
          },
        }}
      />
      <FlexWidget
        style={{
          width: 150,
          height: 150,
          borderRadius: 75,
          marginLeft: -66,
          marginTop: Math.max(0, height - 92),
          backgroundGradient: {
            from: "rgba(139, 92, 246, 0.24)",
            to: "rgba(139, 92, 246, 0.00)",
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
        }}
      >
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            height: 30,
          }}
        >
          <FlexWidget
            style={{ flexDirection: "row", alignItems: "center", flexGap: 9 }}
          >
            <FlexWidget
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(207, 158, 255, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(207, 158, 255, 0.24)",
              }}
            >
              <SvgWidget
                svg={buildFileTextIcon(LILAC, 15)}
                style={{ width: 15, height: 15 }}
              />
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "column" }}>
              <TextWidget
                text="Notes"
                style={{
                  fontSize: 18,
                  fontWeight: "400",
                  color: WHITE,
                  fontFamily: "CreateFuture",
                  letterSpacing: 0.8,
                  lineHeight: 20,
                }}
                maxLines={1}
              />
              {!isCompact && (
                <TextWidget
                  text={
                    notes.length > 0
                      ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}`
                      : "empty"
                  }
                  style={{ fontSize: 8.5, color: FAINT, letterSpacing: 0.4 }}
                  maxLines={1}
                />
              )}
            </FlexWidget>
          </FlexWidget>

          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: "atlas://notes?compose=1" }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundGradient: {
                from: "#e6d2ff",
                to: "#b18cff",
                orientation: "TL_BR",
              },
            }}
          >
            <SvgWidget
              svg={buildPlusIcon("#080512", 15)}
              style={{ width: 15, height: 15 }}
            />
          </FlexWidget>
        </FlexWidget>

        {notes.length > 0 ? (
          <ListWidget
            style={{
              width: "match_parent",
              height: listHeight,
              marginTop: 8,
            }}
          >
            {displayNotes.map((note, index) => (
              <FlexWidget
                key={note.id}
                clickAction="OPEN_URI"
                clickActionData={{ uri: "atlas://notes" }}
                style={{
                  width: "match_parent",
                  flexDirection: "row",
                  alignItems: "center",
                  flexGap: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 2,
                  borderBottomWidth: index < displayNotes.length - 1 ? 1 : 0,
                  borderBottomColor: HAIRLINE,
                }}
              >
                <FlexWidget
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: NOTE_DOT,
                  }}
                />
                <FlexWidget
                  style={{ flex: 1, flexDirection: "column", flexGap: 2 }}
                >
                  <TextWidget
                    text={note.title}
                    style={{
                      fontSize: 11.5,
                      fontWeight: "600",
                      color: WHITE,
                      lineHeight: 14,
                      letterSpacing: 0.1,
                    }}
                    maxLines={1}
                    truncate="END"
                  />
                  <TextWidget
                    text={note.snippet.length > 0 ? note.snippet : note.timeLabel}
                    style={{
                      fontSize: 9,
                      color: MUTED,
                      fontWeight: "400",
                      lineHeight: 11,
                    }}
                    maxLines={1}
                    truncate="END"
                  />
                </FlexWidget>
                <TextWidget
                  text={note.timeLabel}
                  style={{ fontSize: 8.5, color: FAINT, fontWeight: "500" }}
                  maxLines={1}
                />
              </FlexWidget>
            ))}
          </ListWidget>
        ) : (
          <FlexWidget
            style={{
              width: "match_parent",
              flex: 1,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              paddingTop: 6,
            }}
          >
            <FlexWidget
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(207, 158, 255, 0.10)",
                borderWidth: 1,
                borderColor: "rgba(207, 158, 255, 0.22)",
                marginBottom: 10,
              }}
            >
              <SvgWidget
                svg={buildFileTextIcon(LILAC, 22)}
                style={{ width: 22, height: 22 }}
              />
            </FlexWidget>
            <TextWidget
              text="No notes yet"
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: WHITE,
                letterSpacing: 0.2,
              }}
              maxLines={1}
            />
            <TextWidget
              text="Tap + to write one."
              style={{
                fontSize: 9.5,
                color: MUTED,
                marginTop: 5,
                letterSpacing: 0.1,
              }}
              maxLines={1}
            />
          </FlexWidget>
        )}
      </FlexWidget>
    </OverlapWidget>
  );
}
