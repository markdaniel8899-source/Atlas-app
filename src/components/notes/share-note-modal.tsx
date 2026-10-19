import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Send, Users, X } from "lucide-react-native";
import { readCache } from "../../lib/data-cache";
import { fetchSquad } from "../../lib/db/squad";
import type { SquadMember } from "../../lib/db/squad";
import { shareNote } from "../../lib/db/shares";
import { ensureOnline } from "../../lib/net";
import { colors, fonts } from "../../theme/theme";
import { ShareAvatar } from "./share-avatar";

const SQUAD_CACHE_KEY = "squad";

interface ShareNoteModalProps {
  open: boolean;
  noteId: string | null;
  noteTitle: string;
  onClose: () => void;
  /** Called after the RPC confirmed the share. */
  onShared: (message: string) => void;
}

export function ShareNoteModal({
  open,
  noteId,
  noteTitle,
  onClose,
  onShared,
}: ShareNoteModalProps) {
  const router = useRouter();
  const cachedFriends = useRef<SquadMember[] | null>(null);
  const [friends, setFriends] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusyId(null);

    const cached = readCache<SquadMember[]>(SQUAD_CACHE_KEY);
    cachedFriends.current = cached;
    if (cached) {
      setFriends(cached.filter((m) => m.relationship === "friend"));
      setLoading(false);
    } else {
      setFriends([]);
      setLoading(true);
    }

    let live = true;
    void fetchSquad().then((result) => {
      if (!live) return;
      if (result.ok) {
        setFriends(result.members.filter((m) => m.relationship === "friend"));
        setError(null);
      } else if (!cachedFriends.current) {
        setError("Couldn't load your friends. Check your connection.");
      }
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, [open]);

  const send = async (friend: SquadMember) => {
    if (!noteId || busyId) return;
    if (!(await ensureOnline("Sharing a note needs an internet connection."))) {
      return;
    }
    setBusyId(friend.id);
    setError(null);
    const result = await shareNote(noteId, friend.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onShared(
      `Note sent to ${friend.displayName || `@${friend.username}`}.`,
    );
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close share note"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
        />

        <View style={styles.centerWrap} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            accessibilityLabel="Share note with a friend"
            style={styles.panel}
          >
            <View style={styles.header}>
              <View style={styles.headerText}>
                <View style={styles.eyebrowRow}>
                  <Send size={14} color={colors.lilac} />
                  <Text style={styles.eyebrow}>Share note</Text>
                </View>
                <Text style={styles.title} numberOfLines={1}>
                  {noteTitle.trim() || "Untitled note"}
                </Text>
                <Text style={styles.subtitle}>
                  Pick a friend - the note is copied into their Notes.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close share note"
                onPress={onClose}
                hitSlop={6}
                style={styles.closeButton}
              >
                <X size={16} color={colors.w40} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator size="small" color={colors.lilac} />
                <Text style={styles.stateText}>Loading your friends…</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.stateWrap}>
                <View style={styles.stateIcon}>
                  <Users size={20} color={colors.lilac} />
                </View>
                <Text style={styles.stateTitle}>No friends to share with</Text>
                <Text style={styles.stateText}>
                  Notes can only be sent to accepted friends. Add someone
                  first, then come back.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    router.push("/friends");
                  }}
                  style={styles.friendsButton}
                >
                  <Text style={styles.friendsButtonText}>Open Friends</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              >
                {friends.map((friend) => {
                  const busy = busyId === friend.id;
                  return (
                    <Pressable
                      key={friend.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Share with ${friend.displayName}`}
                      onPress={() => void send(friend)}
                      disabled={busyId !== null}
                      style={({ pressed }) => [
                        styles.friendRow,
                        pressed && styles.friendRowPressed,
                        busy && styles.friendRowBusy,
                      ]}
                    >
                      <ShareAvatar
                        name={friend.displayName}
                        initials={friend.initials}
                        gradient={friend.avatar}
                        avatarUrl={friend.avatarUrl}
                        size={40}
                      />
                      <View style={styles.friendText}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {friend.displayName || `@${friend.username}`}
                        </Text>
                        <Text style={styles.friendUsername} numberOfLines={1}>
                          @{friend.username}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.lilac} />
                      ) : (
                        <Send size={16} color={colors.w40} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "78%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.98)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.95,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 32 },
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 22,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    color: colors.w45,
  },
  title: {
    marginTop: 8,
    fontSize: 19,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.white,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  closeButton: {
    borderRadius: 8,
    padding: 8,
  },
  stateWrap: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 26,
  },
  stateIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  stateText: {
    maxWidth: 300,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  friendsButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  friendsButtonText: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  listScroll: {
    flexShrink: 1,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    gap: 2,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  friendRowPressed: {
    backgroundColor: colors.w04,
  },
  friendRowBusy: {
    opacity: 0.7,
  },
  friendText: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  friendUsername: {
    marginTop: 2,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  error: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingHorizontal: 22,
    paddingVertical: 12,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.9)",
  },
});
