"use no memo";

import {
  FlexWidget,
  ListWidget,
  TextWidget,
} from "react-native-android-widget";
import type { WidgetNote } from "./notes-widget-data";

const LILAC = "#cf9eff";
const LILAC_DEEP = "#8b5cf6";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.55)";
const FAINT = "rgba(255, 255, 255, 0.38)";

/**
 * Quick-notes card: recent notes plus a one-tap "new note" shortcut that
 * opens the editor straight away (atlas://notes?compose=1).
 */
export function AtlasNotesWidget({
  notes,
  width,
  height,
}: {
  notes: WidgetNote[];
  width: number;
  height: number;
}) {
  const listHeight = Math.max(56, Math.round(height - 82));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
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
        <FlexWidget
          style={{ flexDirection: "row", alignItems: "center", flexGap: 5 }}
        >
          <TextWidget
            text="Notes"
            style={{ fontSize: 14.5, fontWeight: "600", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text={`· ${notes.length}`}
            style={{ fontSize: 11.5, color: FAINT }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "atlas://notes?compose=1" }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundGradient: {
              from: "#c9a3ff",
              to: LILAC_DEEP,
              orientation: "TL_BR",
            },
          }}
        >
          <TextWidget
            text="+"
            style={{ fontSize: 17, fontWeight: "bold", color: "#0a0817" }}
            maxLines={1}
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
          {notes.map((note) => (
            <FlexWidget
              key={note.id}
              clickAction="OPEN_URI"
              clickActionData={{ uri: "atlas://notes" }}
              style={{
                width: "match_parent",
                flexDirection: "row",
                alignItems: "center",
                flexGap: 10,
                paddingVertical: 7,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <FlexWidget
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: LILAC,
                }}
              />
              <FlexWidget
                style={{ flex: 1, flexDirection: "column" }}
              >
                <TextWidget
                  text={note.title}
                  style={{ fontSize: 12.5, fontWeight: "600", color: WHITE }}
                  maxLines={1}
                  truncate="END"
                />
                {note.snippet ? (
                  <TextWidget
                    text={note.snippet}
                    style={{ fontSize: 11, color: MUTED, marginTop: 2 }}
                    maxLines={1}
                    truncate="END"
                  />
                ) : null}
              </FlexWidget>
              <TextWidget
                text={note.timeLabel}
                style={{ fontSize: 10, color: FAINT }}
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
          }}
        >
          <TextWidget
            text="No notes yet"
            style={{ fontSize: 13, fontWeight: "600", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text="Tap + to write one."
            style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}
            maxLines={1}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
