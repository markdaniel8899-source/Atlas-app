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
const HAIRLINE = "rgba(255, 255, 255, 0.055)";
const PLUS_BG_FROM = "#e6d2ff";
const PLUS_BG_TO = "#cf9eff";
const NOTE_DOT = "#cf9eff";

/**
 * Wide recent-notes card (4x2): RECENT NOTES header with the note count and
 * a one-tap compose button, then a list of the newest notes (title + time).
 * Tap a row to open Notes, tap + to jump straight into a new note.
 */
export function AtlasNotesWidget({
  notes,
  width = 250,
  height = 110,
}: {
  notes: WidgetNote[];
  width?: number;
  height?: number;
}) {
  const displayNotes = notes.slice(0, 5);
  const listHeight = Math.max(48, height - 41);
  // Older 2x2 placements stay renderable: drop the long header and the count.
  const isCompact = width < 180;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        padding: 12,
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
          height: 24,
        }}
      >
        <TextWidget
          text={isCompact ? "NOTES" : "RECENT NOTES"}
          style={{
            fontSize: 8.5,
            fontWeight: "700",
            color: FAINT,
            letterSpacing: 1.2,
          }}
          maxLines={1}
        />
        <FlexWidget
          style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}
        >
          {!isCompact ? (
            <TextWidget
              text={`${notes.length} notes`}
              style={{ fontSize: 8, color: FAINT }}
              maxLines={1}
            />
          ) : null}
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: "atlas://notes?compose=1" }}
            style={{
              width: 24,
              height: 24,
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
            <TextWidget text={buildPlusIcon("#0a0817", 12)} style={{}} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {notes.length > 0 ? (
        <ListWidget
          style={{
            width: "match_parent",
            height: listHeight,
            marginTop: 6,
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
                paddingVertical: 4,
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
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={note.title}
                  style={{
                    fontSize: 10.5,
                    fontWeight: "600",
                    color: WHITE,
                    lineHeight: 13,
                  }}
                  maxLines={1}
                  truncate="END"
                />
              </FlexWidget>
              <TextWidget
                text={note.timeLabel}
                style={{ fontSize: 8, color: FAINT }}
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
            paddingHorizontal: 12,
          }}
        >
          <FlexWidget
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(207, 158, 255, 0.15)",
              marginBottom: 8,
            }}
          >
            <TextWidget text={buildFileTextIcon(LILAC, 18)} style={{}} />
          </FlexWidget>
          <TextWidget
            text="No notes yet"
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: WHITE,
              letterSpacing: 0.1,
            }}
            maxLines={1}
          />
          <TextWidget
            text="Tap + to write one."
            style={{
              fontSize: 9,
              color: MUTED,
              marginTop: 4,
              letterSpacing: 0.1,
            }}
            maxLines={1}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
