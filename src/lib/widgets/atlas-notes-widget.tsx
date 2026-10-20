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
const GLASS_BORDER = "rgba(255, 255, 255, 0.10)";

/**
 * Compact quick-notes card: the newest notes plus a one-tap new-note
 * shortcut (atlas://notes?compose=1).
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
  const listHeight = Math.max(44, Math.round(height - 70));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        padding: 13,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: GLASS_BORDER,
        backgroundGradient: {
          from: "#211b36",
          to: "#09080f",
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
            style={{ fontSize: 13.5, fontWeight: "600", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text={`· ${notes.length}`}
            style={{ fontSize: 10.5, color: FAINT }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "atlas://notes?compose=1" }}
          style={{
            width: 26,
            height: 26,
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
            style={{ fontSize: 16, fontWeight: "bold", color: "#0a0817" }}
            maxLines={1}
          />
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
          {notes.map((note) => (
            <FlexWidget
              key={note.id}
              clickAction="OPEN_URI"
              clickActionData={{ uri: "atlas://notes" }}
              style={{
                width: "match_parent",
                flexDirection: "row",
                alignItems: "center",
                flexGap: 9,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <FlexWidget
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: LILAC,
                }}
              />
              <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                <TextWidget
                  text={note.title}
                  style={{ fontSize: 12, fontWeight: "600", color: WHITE }}
                  maxLines={1}
                  truncate="END"
                />
                {note.snippet ? (
                  <TextWidget
                    text={note.snippet}
                    style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}
                    maxLines={1}
                    truncate="END"
                  />
                ) : null}
              </FlexWidget>
              <TextWidget
                text={note.timeLabel}
                style={{ fontSize: 9.5, color: FAINT }}
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
            style={{ fontSize: 12.5, fontWeight: "600", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text="Tap + to write one."
            style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}
            maxLines={1}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
