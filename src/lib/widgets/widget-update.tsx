import { requestWidgetUpdate } from "react-native-android-widget";
import { AtlasWidget } from "./atlas-widget";
import { ATLAS_WIDGET_NAME } from "./atlas-widget-data";
import type { AtlasWidgetData } from "./atlas-widget-data";
import { AtlasNotesWidget } from "./atlas-notes-widget";
import { ATLAS_NOTES_WIDGET_NAME } from "./notes-widget-data";
import type { NotesWidgetData } from "./notes-widget-data";
import { diag } from "../diagnostics";

/** Re-renders every stats widget on the home screen with fresh data. */
export function pushAtlasStatsWidgetUpdate(data: AtlasWidgetData): void {
  diag("widget:stats:request");
  void requestWidgetUpdate({
    widgetName: ATLAS_WIDGET_NAME,
    renderWidget: (info) => {
      diag("widget:stats:render", { width: info.width, height: info.height });
      return <AtlasWidget data={data} width={info.width} height={info.height} />;
    },
    widgetNotFound: () => diag("widget:stats:not-placed"),
  })
    .then(() => diag("widget:stats:requested"))
    .catch((error: unknown) =>
      diag("widget:stats:request-fail", {
        message: error instanceof Error ? error.message : String(error),
      }),
    );
}

/** Re-renders every quick-notes widget with the cached list. */
export function pushNotesWidgetUpdate(data: NotesWidgetData): void {
  diag("widget:notes:request");
  void requestWidgetUpdate({
    widgetName: ATLAS_NOTES_WIDGET_NAME,
    renderWidget: (info) => {
      diag("widget:notes:render", { width: info.width, height: info.height });
      return (
        <AtlasNotesWidget
          notes={data.notes}
          width={info.width}
          height={info.height}
        />
      );
    },
    widgetNotFound: () => diag("widget:notes:not-placed"),
  })
    .then(() => diag("widget:notes:requested"))
    .catch((error: unknown) =>
      diag("widget:notes:request-fail", {
        message: error instanceof Error ? error.message : String(error),
      }),
    );
}
