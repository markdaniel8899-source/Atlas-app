"use no memo";

import {
  FlexWidget,
  ListWidget,
  TextWidget,
} from "react-native-android-widget";
import type { WidgetNote } from "./notes-widget-data";
import { buildFileTextIcon, buildPlusIcon } from "./icons";

const LILAC = "#cf9eff";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.35)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.06)";
const HAIRLINE = "rgba(255, 255, 255, 0.05)";
const PLUS_BG_FROM = "#c9a3ff";
const PLUS_BG_TO = "#8b5cf6";
const NOTE_DOT = "#cf9eff";

/**
 * Premium quick-notes card: the newest notes plus a one-tap new-note
 * shortcut (atlas://notes?compose=1).
 * Responsive: 2x2 (110dp) shows 1-2 rows, larger sizes show up to 4 rows.
 */
export function AtlasNotesWidget({
  notes,
  width = 110,
  height = 110,
}: {
  notes: WidgetNote[];
  width?: number;
  height?: number;
}) {
  const headerHeight = 36;
  const availableHeight = height - 24; // 12dp padding top + bottom
  const listHeight = Math.max(44, availableHeight - headerHeight - 8);
  const maxRows = Math.max(1, Math.floor(listHeight / 36));
  const displayNotes = notes.slice(0, maxRows);
  const isCompact = height <= 120;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
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
          height: headerHeight,
        }}
      >
        <FlexWidget
          style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}
        >
          <TextWidget
            text={buildFileTextIcon(LILAC, isCompact ? 14 : 16)}
            style={{}}
          />
          <TextWidget
            text="Notes"
            style={{
              fontSize: isCompact ? 12 : 14,
              fontWeight: "600",
              color: WHITE,
              letterSpacing: 0.2,
            }}
            maxLines={1}
          />
          <TextWidget
            text={`· ${notes.length}`}
            style={{ fontSize: isCompact ? 9 : 10.5, color: FAINT }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "atlas://notes?compose=1" }}
          style={{
            width: isCompact ? 24 : 28,
            height: isCompact ? 24 : 28,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundGradient: {
              from: PLUS_BG_FROM,
              to: PLUS_BG_TO,
              orientation: "TL_BR",
            },
          }}
        >
          <TextWidget
            text={buildPlusIcon("#0a0817", isCompact ? 14 : 17)}
            style={{}}
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
                flexGap: 8,
                paddingVertical: isCompact ? 5 : 7,
                borderBottomWidth: index < displayNotes.length - 1 ? 0.5 : 0,
                borderBottomColor: HAIRLINE,
              }}
            >
              <FlexWidget
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: NOTE_DOT,
                }}
              />
              <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                <TextWidget
                  text={note.title}
                  style={{
                    fontSize: isCompact ? 11 : 13,
                    fontWeight: "600",
                    color: WHITE,
                    letterSpacing: 0.1,
                  }}
                  maxLines={1}
                  truncate="END"
                />
                {note.snippet ? (
                  <TextWidget
                    text={note.snippet}
                    style={{
                      fontSize: isCompact ? 9 : 11,
                      color: MUTED,
                      marginTop: 1,
                      letterSpacing: 0.1,
                    }}
                    maxLines={1}
                    truncate="END"
                  />
                ) : null}
              </FlexWidget>
              <TextWidget
                text={note.timeLabel}
                style={{ fontSize: isCompact ? 8 : 9, color: FAINT }}
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
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <FlexWidget
            style={{
              width: isCompact ? 36 : 44,
              height: isCompact ? 36 : 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(207, 158, 255, 0.12)",
              marginBottom: isCompact ? 6 : 8,
            }}
          >
            <TextWidget
              text={buildFileTextIcon(LILAC, isCompact ? 16 : 20)}
              style={{}}
            />
          </FlexWidget>
          <TextWidget
            text="No notes yet"
            style={{
              fontSize: isCompact ? 11 : 13,
              fontWeight: "600",
              color: WHITE,
              letterSpacing: 0.1,
            }}
            maxLines={1}
          />
          <TextWidget
            text="Tap + to write one."
            style={{
              fontSize: isCompact ? 9 : 10.5,
              color: MUTED,
              marginTop: isCompact ? 3 : 4,
              letterSpacing: 0.1,
            }}
            maxLines={1}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}