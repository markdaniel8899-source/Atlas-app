import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDayKey, utcDayKey } from "./day";

type NotificationsModule = typeof import("expo-notifications");

const CHANNEL_ID = "session-alerts";
const PENDING_KEY = "atlas.notif.session.id";
const STREAK_PENDING_KEY = "atlas.notif.streak.id";
const STREAK_HOUR = 21;
const STREAK_FALLBACK_HOUR = 23;

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
  try {
    const id = await N.scheduleNotificationAsync({
      content: {
        title: "Keep your streak alive 🔥",
        body: `No focus session logged today yet. Study before midnight to protect your ${input.streak}-day streak.`,
        sound: "default",
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        channelId: CHANNEL_ID,
      },
    });
    void AsyncStorage.setItem(STREAK_PENDING_KEY, id).catch(() => undefined);
  } catch {
    // Scheduling is best-effort - the streak itself is unaffected.
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
    await N.scheduleNotificationAsync({
      content: {
        title: "ATLAS test alert",
        body: "Notifications are working. Session-end and streak reminders will arrive like this.",
        sound: "default",
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 10_000),
        channelId: CHANNEL_ID,
      },
    });
    return true;
  } catch {
    return false;
  }
}
