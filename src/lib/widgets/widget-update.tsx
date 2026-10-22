import { requestWidgetUpdate } from "react-native-android-widget";
import { AtlasWidget } from "./atlas-widget";
import { ATLAS_WIDGET_NAME } from "./atlas-widget-data";
import type { AtlasWidgetData } from "./atlas-widget-data";
import { AtlasNotesWidget } from "./atlas-notes-widget";
import { ATLAS_NOTES_WIDGET_NAME } from "./notes-widget-data";
import type { NotesWidgetData } from "./notes-widget-data";

/** Re-renders every stats widget on the home screen with fresh data. */
export function pushAtlasStatsWidgetUpdate(data: AtlasWidgetData): void {
  void requestWidgetUpdate({
    widgetName: ATLAS_WIDGET_NAME,
    renderWidget: (info) => (
      <AtlasWidget
        data={data}
        width={info.width}
        height={info.height}
      />
    ),
    widgetNotFound: () => undefined,
  }).catch(() => undefined);
}

/** Re-renders every quick-notes widget with the cached list. */
export function pushNotesWidgetUpdate(data: NotesWidgetData): void {
  void requestWidgetUpdate({
    widgetName: ATLAS_NOTES_WIDGET_NAME,
    renderWidget: (info) => (
      <AtlasNotesWidget
        notes={data.notes}
        width={info.width}
        height={info.height}
      />
    ),
    widgetNotFound: () => undefined,
  }).catch(() => undefined);
}
