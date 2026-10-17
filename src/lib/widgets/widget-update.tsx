import { requestWidgetUpdate } from "react-native-android-widget";
import { AtlasWidget } from "./atlas-widget";
import { ATLAS_WIDGET_NAME } from "./atlas-widget-data";
import type { AtlasWidgetData } from "./atlas-widget-data";

/** Re-renders every AtlasWidget on the home screen with fresh data. */
export function pushAtlasWidgetUpdate(data: AtlasWidgetData): void {
  void requestWidgetUpdate({
    widgetName: ATLAS_WIDGET_NAME,
    renderWidget: () => <AtlasWidget data={data} />,
    widgetNotFound: () => undefined,
  }).catch(() => undefined);
}
