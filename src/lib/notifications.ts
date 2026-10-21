import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDayKey, utcDayKey } from "./day";

type NotificationsModule = typeof import("expo-notifications");

const CHANNEL_ID = "session-alerts";
const PENDING_KEY = "atlas.notif.session.id";
const STREAK_PENDING_KEY = "atlas.notif.streak.id";
const STREAK_HOUR = 21;
const STREAK_FALLBACK_HOUR = 23;

// Custom notification sound file (place at assets/sounds/notification.mp3)
// Falls back to system default if file is missing or on unsupported platforms.
const CUSTOM_SOUND = "notification.mp3";

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
 * Configures the notification handler and Android channel.
 * Foreground presentation plays the custom sound so alerts feel responsive
 * even when the app is open.
 */
export function initNotifications(): void {
  const N = getNotifications();
  if (!N || configured) return;
  configured = true;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    if (Platform.OS === "android") {
      void N.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Session alerts",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#cf9eff",
        sound: CUSTOM_SOUND,
        enableVibrate: true,
      }).catch(() => undefined);
    }
  } catch {
    // Binary without notification support - the feature stays off.
  }
}

async function ensurePermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  if (permissionGranted === true) return true;
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
  return permissionGranted === true;
}

/**
 * Schedules a local notification with the custom sound.
 * Falls back to default sound if the custom sound file is unavailable.
 */
async function scheduleNotificationWithSound(
  title: string,
  body: string,
  trigger: Parameters<NotificationsModule["scheduleNotificationAsync"]>[0]["trigger"],
  channelId: string = CHANNEL_ID,
): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;
  initNotifications();
  try {
    if (!(await ensurePermission())) return null;
    const id = await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: CUSTOM_SOUND,
      },
      trigger: {
        ...trigger,
        channelId,
      },
    });
    return id;
  } catch {
    // If custom sound fails, retry with default sound
    try {
      const id = await N.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: "default",
        },
        trigger: {
          ...trigger,
          channelId,
        },
      });
      return id;
    } catch {
      return null;
    }
  }
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
  const id = await scheduleNotificationWithSound(
    "Session complete",
    "Your focus session has ended. Open ATLAS to bank your XP.",
    {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: new Date(endsAtMs),
    },
  );
  if (id) {
    void AsyncStorage.setItem(PENDING_KEY, id).catch(() => undefined);
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

function todayAt(hour: number): number {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/**
 * Keeps a single "save your streak" reminder pending for tonight (21:00,
 * falling back to 23:00). Only schedules when the user already granted
 * notification permission - never prompts at launch. Called with null or
 * streak 0, or once today's session is logged, it cancels instead.
 */
export async function syncStreakReminder(
  input: { streak: number; lastActiveDate: string | null } | null,
): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  await cancelStreakReminder();
  if (!input || input.streak <= 0) return;
  try {
    const existing = await N.getPermissionsAsync();
    if (existing.granted) permissionGranted = true;
    if (!existing.granted) return;
  } catch {
    return;
  }
  const now = new Date();
  const lastActive = (input.lastActiveDate ?? "").slice(0, 10);
  if (lastActive === localDayKey(now) || lastActive === utcDayKey(now)) return;
  const nowMs = Date.now();
  let fireAt = todayAt(STREAK_HOUR);
  if (fireAt - nowMs < 60_000) fireAt = todayAt(STREAK_FALLBACK_HOUR);
  if (fireAt - nowMs < 60_000) return; // Too late tonight - tomorrow's sync re-arms.
  const id = await scheduleNotificationWithSound(
    "Keep your streak alive 🔥",
    `No focus session logged today yet. Study before midnight to protect your ${input.streak}-day streak.`,
    {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: new Date(fireAt),
    },
  );
  if (id) {
    void AsyncStorage.setItem(STREAK_PENDING_KEY, id).catch(() => undefined);
  }
}

/** Cancels the pending streak reminder (studied today, sign-out). */
export async function cancelStreakReminder(): Promise<void> {
  const N = getNotifications();
  try {
    const id = await AsyncStorage.getItem(STREAK_PENDING_KEY);
    if (id && N) await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or already gone - nothing left to clean up.
  }
  void AsyncStorage.removeItem(STREAK_PENDING_KEY).catch(() => undefined);
}

/**
 * Sends a real alert ~10 seconds from now so the user can verify that
 * notifications reach the device (Settings > Notifications card).
 * This is the only path that actively requests permission.
 */
export async function sendTestNotification(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  initNotifications();
  try {
    if (!(await ensurePermission())) return false;
    const id = await scheduleNotificationWithSound(
      "ATLAS test alert",
      "Notifications are working. Session-end and streak reminders will arrive like this.",
      {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 10_000),
      },
    );
    return id !== null;
  } catch {
    return false;
  }
}

/**
 * Example: Schedule a notification when a note is shared or friend request received.
 * Usage:
 *   await scheduleCustomNotification(
 *     "Note shared",
 *     "Alex shared a note with you: 'React Native Tips'",
 *     { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 1000) }
 *   );
 */
export async function scheduleCustomNotification(
  title: string,
  body: string,
  trigger: Parameters<NotificationsModule["scheduleNotificationAsync"]>[0]["trigger"],
): Promise<string | null> {
  return scheduleNotificationWithSound(title, body, trigger);
}
