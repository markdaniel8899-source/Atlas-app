import { useEffect } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  BellRing,
  CheckCheck,
  FileText,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react-native";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  type AppNotification,
  type NotificationKind,
} from "../lib/notification-center";
import { syncAllNotifications } from "../lib/notification-sync";
import { colors, fonts } from "../theme/theme";
import {
  modalPanelStyle,
  useModalTransition,
} from "./ui/modal-transition";

const ICONS: Record<NotificationKind, typeof Bell> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  note_shared: FileText,
};

const TONES: Record<
  NotificationKind,
  { icon: string; background: string; border: string }
> = {
  friend_request: {
    icon: colors.lilac,
    background: colors.lilac12,
    border: colors.lilac25,
  },
  friend_accepted: {
    icon: "#6ee7b7",
    background: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.28)",
  },
  note_shared: {
    icon: colors.star,
    background: colors.star10,
    border: colors.star30,
  },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bell panel from the app header. Mirrors the website: unread count, mark all
 * read, and rows that jump straight to Friends or Notes.
 */
export function NotificationsSheet({
  open,
  onClose,
}: NotificationsSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items } = useNotifications();
  const { rendered, anim } = useModalTransition(open);

  const unread = items.reduce(
    (total, item) => (item.read ? total : total + 1),
    0,
  );

  useEffect(() => {
    if (!open) return;
    void syncAllNotifications({ force: true });
  }, [open]);

  const openItem = (item: AppNotification) => {
    markNotificationRead(item.id);
    onClose();
    router.navigate(item.href as Href);
  };

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel="Notifications"
          style={[
            styles.panel,
            modalPanelStyle(anim, "bottom"),
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <BellRing size={16} color={colors.lilac} />
              <Text style={styles.headerTitle}>Notifications</Text>
              {unread > 0 ? (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{unread}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              {unread > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark all notifications read"
                  onPress={markAllNotificationsRead}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.markAll,
                    pressed && styles.markAllPressed,
                  ]}
                >
                  <CheckCheck size={14} color={colors.w45} />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
                onPress={onClose}
                hitSlop={6}
                style={styles.closeButton}
              >
                <X size={16} color={colors.w45} />
              </Pressable>
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Bell size={22} color={colors.w30} />
              </View>
              <Text style={styles.emptyTitle}>You’re all caught up.</Text>
              <Text style={styles.emptyText}>
                Friend requests and shared notes land here instantly.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => {
                const Icon = ICONS[item.kind];
                const tone = TONES[item.kind];
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.message}
                    onPress={() => openItem(item)}
                    style={({ pressed }) => [
                      styles.row,
                      !item.read && styles.rowUnread,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.rowIcon,
                        {
                          backgroundColor: tone.background,
                          borderColor: tone.border,
                        },
                      ]}
                    >
                      <Icon size={17} color={tone.icon} />
                    </View>

                    <View style={styles.rowText}>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.message,
                          item.read && styles.messageRead,
                        ]}
                      >
                        {item.message}
                      </Text>
                      {item.detail ? (
                        <Text numberOfLines={1} style={styles.detail}>
                          {item.detail}
                        </Text>
                      ) : null}
                      <Text style={styles.time}>
                        {timeAgo(item.createdAt)}
                      </Text>
                    </View>

                    {!item.read ? <View style={styles.unreadDot} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  panel: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: "rgba(17,17,26,0.98)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -18 },
    elevation: 24,
  },
  handleWrap: {
    paddingTop: 10,
    alignItems: "center",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.w15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
    color: colors.white,
  },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lilac12,
    borderWidth: 1,
    borderColor: colors.lilac25,
  },
  countPillText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.lilac,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    borderRadius: 9,
    paddingHorizontal: 7,
  },
  markAllPressed: {
    backgroundColor: colors.w06,
  },
  markAllText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.w45,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  listScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  list: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 14,
  },
  rowUnread: {
    backgroundColor: colors.w02,
  },
  rowPressed: {
    backgroundColor: colors.w05,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  messageRead: {
    color: colors.w60,
  },
  detail: {
    marginTop: 2,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  time: {
    marginTop: 5,
    fontSize: 9.5,
    fontFamily: fonts.medium,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.w30,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: colors.lilac,
    shadowColor: colors.lilac,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 36,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
    color: colors.w75,
  },
  emptyText: {
    marginTop: 5,
    maxWidth: 280,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
});
