import { registerWidgetTaskHandler } from "react-native-android-widget";
import { AtlasWidget } from "./atlas-widget";
import {
  ATLAS_WIDGET_NAME,
  loadAtlasWidgetData,
} from "./atlas-widget-data";

/**
 * Registered from the root layout so Android can (re)draw the widget even
 * when the app is launched headless in the background.
 */
export function registerAtlasWidgetTaskHandler(): void {
  registerWidgetTaskHandler(async (props) => {
    if (props.widgetInfo.widgetName !== ATLAS_WIDGET_NAME) return;
    switch (props.widgetAction) {
      case "WIDGET_ADDED":
      case "WIDGET_UPDATE":
      case "WIDGET_RESIZED": {
        const data = await loadAtlasWidgetData();
        props.renderWidget(<AtlasWidget data={data} />);
        break;
      }
      default:
        break;
    }
  });
}
