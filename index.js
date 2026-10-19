import "expo-router/entry";
import { Platform } from "react-native";

// Android home-screen widgets: the task handler must be registered while the
// JS bundle is evaluated - headless widget tasks never render the React tree,
// so registering inside a component module (e.g. the root layout) is skipped
// and the widget falls back to the transparent stub layout.
if (Platform.OS === "android") {
  try {
    const handler = require("./src/lib/widgets/widget-task-handler");
    handler.registerAtlasWidgetTaskHandler();
  } catch {
    // Binary without the widget native module (older APK, Expo Go) - skipped.
  }
}
