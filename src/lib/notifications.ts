import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type NotificationsModule = typeof import("expo-notifications");

const CHANNEL_ID = "session-alerts";
const PENDING_KEY = "atlas.notif.session.id";

let cachedModule: NotificationsModule | null = null;
let moduleUnavailable = false;
let configured = false;
let permissionGranted: boolean | null = null;

/**
 * Loads expo-notifications lazily so binaries built before the module was
 * added (and web) simply skip notifications instead of crashing.
 */
function getNotifications(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  if (cachedModule) return cachedModule;
  if (moduleUnavailable) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the notifications native module
    cachedModule = require("expo-notifications") as NotificationsModule;
  } catch {
    moduleUnavailable = true;
    return null;
  }
  return cachedModule;
}

/**
 * Foreground presentation stays silent - while the app is open the
 * session-complete card is the UI; this alert is for backgrounded use.
 */
export function initNotifications(): void {
  const N = getNotifications();
  if (!N || configured) return;
  configured = true;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      void N.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Session alerts",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#cf9eff",
      }).catch(() => undefined);
    }
  } catch {
    // Binary without notification support - the feature stays off.
  }
}

async function ensurePermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  if (permissionGranted !== null) return permissionGranted;
  try {
    const existing = await N.getPermissionsAsync();
    if (existing.granted) {
      permissionGranted = true;
      return true;
    }
    const requested = await N.requestPermissionsAsync();
    permissionGranted = requested.granted;
  } catch {
    permissionGranted = false;
  }
  return permissionGranted;
}

/**
 * Schedules the end-of-session alert for the current focus run. Replaces
 * any previous one so exactly one alert is ever pending.
 */
export async function scheduleSessionEndNotification(
  endsAtMs: number,
): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  initNotifications();
  await cancelSessionEndNotification();
  if (endsAtMs - Date.now() < 5_000) return;
  try {
    if (!(await ensurePermission())) return;
    const id = await N.scheduleNotificationAsync({
      content: {
        title: "Session complete",
        body: "Your focus session has ended. Open ATLAS to bank your XP.",
        sound: "default",
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAtMs),
        channelId: CHANNEL_ID,
      },
    });
    void AsyncStorage.setItem(PENDING_KEY, id).catch(() => undefined);
  } catch {
    // Scheduling is best-effort - the timer itself is unaffected.
  }
}

/** Cancels the pending alert (pause, early stop, sign-out). */
export async function cancelSessionEndNotification(): Promise<void> {
  const N = getNotifications();
  try {
    const id = await AsyncStorage.getItem(PENDING_KEY);
    if (id && N) await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or already gone - nothing left to clean up.
  }
  void AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
}
