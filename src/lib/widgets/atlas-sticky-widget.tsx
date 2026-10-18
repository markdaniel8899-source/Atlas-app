import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetNote } from "./notes-widget-data";

const LILAC = "#cf9eff";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.72)";
const FAINT = "rgba(255, 255, 255, 0.38)";

/**
 * Sticky-note card: the most recent note stays visible on the home screen.
 * "Next" cycles through the cached notes without opening the app.
 */
export function AtlasStickyWidget({ note }: { note: WidgetNote | null }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "atlas://notes" }}
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
          text="● STICKY NOTE"
          style={{
            fontSize: 10,
            fontWeight: "600",
            color: LILAC,
            letterSpacing: 1.5,
          }}
          maxLines={1}
        />
        {note ? (
          <TextWidget
            text={note.timeLabel}
            style={{ fontSize: 10, color: FAINT }}
            maxLines={1}
          />
        ) : null}
      </FlexWidget>

      {note ? (
        <>
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "column",
              flex: 1,
              marginTop: 11,
            }}
          >
            <TextWidget
              text={note.title}
              style={{ fontSize: 14.5, fontWeight: "600", color: WHITE }}
              maxLines={1}
              truncate="END"
            />
            <TextWidget
              text={note.snippet || "Empty note"}
              style={{
                fontSize: 12,
                color: MUTED,
                marginTop: 6,
                lineHeight: 18,
              }}
              maxLines={4}
              truncate="END"
            />
          </FlexWidget>

          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              flexGap: 8,
            }}
          >
            <FlexWidget
              clickAction="NEXT_NOTE"
              style={{
                backgroundColor: "rgba(207, 158, 255, 0.14)",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(207, 158, 255, 0.42)",
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <TextWidget
                text="↻ Next"
                style={{ fontSize: 11, fontWeight: "600", color: LILAC }}
                maxLines={1}
              />
            </FlexWidget>
            <FlexWidget
              clickAction="OPEN_URI"
              clickActionData={{ uri: "atlas://notes" }}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.18)",
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <TextWidget
                text="Open ↗"
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: "rgba(255, 255, 255, 0.85)",
                }}
                maxLines={1}
              />
            </FlexWidget>
          </FlexWidget>
        </>
      ) : (
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <TextWidget
            text="No notes yet"
            style={{ fontSize: 14, fontWeight: "600", color: WHITE }}
            maxLines={1}
          />
          <TextWidget
            text="Tap to write your first note."
            style={{ fontSize: 12, color: MUTED, marginTop: 5 }}
            maxLines={2}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
