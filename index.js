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
  } catch (error) {
    // Binary without the widget native module (older APK, Expo Go) - skipped.
    console.warn("[atlas-widget] task handler not registered", error);
  }
}

// Background sync: refreshes profile, heatmap and notes into the dashboard
// cache + widgets while the app is closed. Must be defined at global scope so
// a headless launch (WorkManager / BGTask) can find the task.
try {
  const backgroundSync = require("./src/lib/background-sync");
  backgroundSync.registerAtlasBackgroundSync();
} catch (error) {
  // Binary without the background-task native modules (older APK, Expo Go).
  console.warn("[atlas-bg] background sync not registered", error);
}
