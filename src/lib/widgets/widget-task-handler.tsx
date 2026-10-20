import {
  FlexWidget,
  TextWidget,
  registerWidgetTaskHandler,
} from "react-native-android-widget";
import { AtlasWidget } from "./atlas-widget";
import { ATLAS_WIDGET_NAME, loadAtlasWidgetData } from "./atlas-widget-data";
import { AtlasStickyWidget } from "./atlas-sticky-widget";
import { AtlasNotesWidget } from "./atlas-notes-widget";
import {
  ATLAS_NOTES_WIDGET_NAME,
  ATLAS_STICKY_WIDGET_NAME,
  loadNotesWidgetData,
  loadStickyNoteIndex,
  saveStickyNoteIndex,
} from "./notes-widget-data";

/**
 * Registered from the root layout so Android can (re)draw the widgets even
 * when the app is launched headless in the background.
 */
export function registerAtlasWidgetTaskHandler(): void {
  registerWidgetTaskHandler(async (props) => {
    if (props.widgetAction === "WIDGET_DELETED") return;

    try {
      const name = props.widgetInfo.widgetName;

      if (name === ATLAS_WIDGET_NAME) {
        const data = await loadAtlasWidgetData();
        props.renderWidget(<AtlasWidget data={data} />);
        return;
      }

      if (name === ATLAS_STICKY_WIDGET_NAME) {
        if (
          props.widgetAction === "WIDGET_CLICK" &&
          props.clickAction !== "NEXT_NOTE"
        ) {
          return; // OPEN_URI / OPEN_APP are handled by the system.
        }
        const data = await loadNotesWidgetData();
        if (
          props.widgetAction === "WIDGET_CLICK" &&
          props.clickAction === "NEXT_NOTE" &&
          data.notes.length > 0
        ) {
          const next = ((await loadStickyNoteIndex()) + 1) % data.notes.length;
          await saveStickyNoteIndex(next);
        }
        const index = await loadStickyNoteIndex();
        const note =
          data.notes.length > 0 ? data.notes[index % data.notes.length] : null;
        props.renderWidget(<AtlasStickyWidget note={note} />);
        return;
      }

      if (name === ATLAS_NOTES_WIDGET_NAME) {
        const data = await loadNotesWidgetData();
        props.renderWidget(
          <AtlasNotesWidget
            notes={data.notes}
            width={props.widgetInfo.width}
            height={props.widgetInfo.height}
          />,
        );
      }
    } catch (error) {
      // Never leave the widget as the transparent initial stub: draw a plain
      // card the user can tap, and log the real failure for debugging.
      console.warn("[atlas-widget] render failed", error);
      try {
        props.renderWidget(
          <FlexWidget
            clickAction="OPEN_APP"
            style={{
              width: "match_parent",
              height: "match_parent",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "rgba(207, 158, 255, 0.22)",
              backgroundColor: "#1b1440",
            }}
          >
            <TextWidget
              text="ATLAS"
              style={{ fontSize: 14, fontWeight: "bold", color: "#cf9eff" }}
              maxLines={1}
            />
            <TextWidget
              text="Open the app to refresh this widget"
              style={{
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.62)",
                marginTop: 6,
              }}
              maxLines={2}
            />
          </FlexWidget>,
        );
      } catch {
        // Nothing else we can do from JS.
      }
    }
  });
}
