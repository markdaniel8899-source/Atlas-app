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
const HAIRLINE = "rgba(255, 255, 255, 0.05)";
const GLASS_BORDER = "rgba(207, 158, 255, 0.25)";
const CARD_FROM = "#140d2e";
const CARD_TO = "#080512";
const GLASS_HIGHLIGHT = "rgba(255, 255, 255, 0.03)";
const PLUS_BG_FROM = "#e6d2ff";
const PLUS_BG_TO = "#cf9eff";
const NOTE_DOT = "#cf9eff";

/**
 * Premium recent-notes card with glassmorphism, theme gradients, and better alignment.
 * Header with count + compose button, scrollable list with lilac accent dots.
 * Tap row → notes, tap + → new note.
 */
export function AtlasNotesWidget({
  notes,
  width = 280,
  height = 160,
}: {
  notes: WidgetNote[];
  width?: number;
  height?: number;
}) {
  const displayNotes = notes.slice(0, 5);
  const listHeight = Math.max(56, height - 50);
  const isCompact = width < 190;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        padding: 16,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: GLASS_BORDER,
        backgroundGradient: {
          from: CARD_FROM,
          to: CARD_TO,
          orientation: "TL_BR",
        },
      }}
    >
      {/* Header: Title + Count + Compose button */}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 28,
        }}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
          <FlexWidget
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundGradient: {
                from: "rgba(207, 158, 255, 0.25)",
                to: "rgba(157, 180, 255, 0.2)",
                orientation: "TL_BR",
              },
            }}
          >
            <TextWidget text={buildFileTextIcon(LILAC, 11)} style={{}} />
          </FlexWidget>
          <TextWidget
            text={isCompact ? "NOTES" : "RECENT NOTES"}
            style={{
              fontSize: 9.5,
              fontWeight: "700",
              color: FAINT,
              letterSpacing: 1.4,
            }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
          {!isCompact && notes.length > 0 ? (
            <TextWidget
              text={`${notes.length} notes`}
              style={{ fontSize: 8.5, color: FAINT, fontWeight: "500" }}
              maxLines={1}
            />
          ) : null}
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: "atlas://notes?compose=1" }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundGradient: {
                from: PLUS_BG_FROM,
                to: PLUS_BG_TO,
                orientation: "TL_BR",
              },
            }}
          >
            <TextWidget text={buildPlusIcon("#080512", 13)} style={{}} />
          </FlexWidget>
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
                borderBottomWidth: index < displayNotes.length - 1 ? 0.5 : 0,
                borderBottomColor: HAIRLINE,
              }}
            >
              {/* Lilac accent dot */}
              <FlexWidget
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: NOTE_DOT,
                }}
              />
              <FlexWidget style={{ flex: 1, flexDirection: "column", flexGap: 1 }}>
                <TextWidget
                  text={note.title}
                  style={{
                    fontSize: 11.5,
                    fontWeight: "600",
                    color: WHITE,
                    lineHeight: 15,
                    letterSpacing: 0.1,
                  }}
                  maxLines={1}
                  truncate="END"
                />
                <TextWidget
                  text={note.timeLabel}
                  style={{ fontSize: 8.5, color: FAINT, fontWeight: "400" }}
                  maxLines={1}
                />
              </FlexWidget>
              <FlexWidget
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  borderWidth: 0.5,
                  borderColor: "rgba(255, 255, 255, 0.05)",
                }}
              >
                <TextWidget
                  text="▸"
                  style={{ fontSize: 11, color: MUTED, lineHeight: 12 }}
                  maxLines={1}
                />
              </FlexWidget>
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
            paddingTop: 8,
          }}
        >
          <FlexWidget
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundGradient: {
                from: "rgba(207, 158, 255, 0.18)",
                to: "rgba(157, 180, 255, 0.12)",
                orientation: "TL_BR",
              },
              borderWidth: 1,
              borderColor: "rgba(207, 158, 255, 0.25)",
              marginBottom: 10,
            }}
          >
            <TextWidget text={buildFileTextIcon(LILAC, 20)} style={{}} />
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
  );
}