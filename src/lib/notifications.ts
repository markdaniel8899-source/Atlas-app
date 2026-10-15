import { Alert, Platform, Vibration } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const FOCUS_TITLE = 'Focus target reached';
const FOCUS_BODY = 'Your focus session is complete. Session logged - nice work.';

let modulePromise: Promise<NotificationsModule | null> | null = null;
let focusEndNotificationId: string | null = null;
let lastScheduleOk = true;

function loadNotifications(): Promise<NotificationsModule | null> {
  if (modulePromise) return modulePromise;

  modulePromise = (async () => {
    if (Platform.OS === 'web') return null;
    try {
      const notifications = await import('expo-notifications');
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      return notifications;
    } catch {
      return null;
    }
  })();

  return modulePromise;
}

export async function scheduleFocusEnd(secondsFromNow: number): Promise<boolean> {
  if (!Number.isFinite(secondsFromNow) || secondsFromNow <= 0) {
    lastScheduleOk = false;
    return false;
  }

  const notifications = await loadNotifications();
  if (!notifications) {
    lastScheduleOk = false;
    return false;
  }

  try {
    await cancelFocusEnd();
    const triggerDate = new Date(Date.now() + secondsFromNow * 1000);
    focusEndNotificationId = await notifications.scheduleNotificationAsync({
      content: {
        title: FOCUS_TITLE,
        body: FOCUS_BODY,
        sound: true,
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    lastScheduleOk = focusEndNotificationId.length > 0;
    return lastScheduleOk;
  } catch {
    focusEndNotificationId = null;
    lastScheduleOk = false;
    return false;
  }
}

export async function cancelFocusEnd(): Promise<void> {
  const id = focusEndNotificationId;
  focusEndNotificationId = null;
  if (!id) return;

  const notifications = await loadNotifications();
  if (!notifications) return;
  try {
    await notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or platform refused - safe to ignore.
  }
}

export async function notifyFocusComplete(minutes: number): Promise<void> {
  await cancelFocusEnd();

  try {
    Vibration.vibrate([320, 180, 320]);
  } catch {
    // Vibration is a nice-to-have.
  }

  // The scheduled notification fires on its own when the app is
  // backgrounded. If scheduling failed (Expo Go / permission denied),
  // fall back to an in-app alert so the end of the session is never silent.
  if (!lastScheduleOk) {
    Alert.alert(FOCUS_TITLE, `${minutes} minutes of focus logged. ${FOCUS_BODY}`);
  }
}
