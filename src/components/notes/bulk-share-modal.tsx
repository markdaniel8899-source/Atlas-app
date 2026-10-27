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
import { Check, Send, Share2, Users, X } from "lucide-react-native";
import { readCache } from "../../lib/data-cache";
import { fetchSquad } from "../../lib/db/squad";
import type { SquadMember } from "../../lib/db/squad";
import { bulkShareNotes } from "../../lib/db/shares";
import { ensureOnline } from "../../lib/net";
import { colors, fonts } from "../../theme/theme";
import { ShareAvatar } from "./share-avatar";

const SQUAD_CACHE_KEY = "squad";

interface BulkShareModalProps {
  open: boolean;
  noteIds: string[];
  noteCount: number;
  onClose: () => void;
  onShared: (message: string) => void;
}

export function BulkShareModal({
  open,
  noteIds,
  noteCount,
  onClose,
  onShared,
}: BulkShareModalProps) {
  const router = useRouter();
  const cachedFriends = useRef<SquadMember[] | null>(null);
  const [friends, setFriends] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setSelected(new Set());

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

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = friends.length > 0 && selected.size === friends.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(friends.map((f) => f.id)));
  };

  const send = async () => {
    if (busy || selected.size === 0) return;
    if (!(await ensureOnline("Sharing notes needs an internet connection."))) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await bulkShareNotes(noteIds, [...selected]);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onShared(result.message);
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
          accessibilityLabel="Close share notes"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
        />

        <View style={styles.centerWrap} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            accessibilityLabel="Share selected notes"
            style={styles.panel}
          >
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Share2 size={20} color={colors.lilac} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>
                  Share {noteCount} note{noteCount > 1 ? "s" : ""}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {noteCount} selected
                </Text>
                <Text style={styles.subtitle}>
                  Pick friends - every note is copied into their Notes.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close share notes"
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
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={allSelected ? "Deselect all friends" : "Select all friends"}
                  onPress={toggleAll}
                  style={styles.selectAllRow}
                >
                  <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
                    {allSelected ? <Check size={12} color={colors.lilac} /> : null}
                  </View>
                  <Text style={styles.selectAllText}>
                    {allSelected ? "Deselect all" : "Select all"}
                  </Text>
                  <Text style={styles.selectCount}>{selected.size} selected</Text>
                </Pressable>

                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={styles.list}
                  showsVerticalScrollIndicator={false}
                >
                  {friends.map((friend) => {
                    const checked = selected.has(friend.id);
                    const name = friend.displayName || `@${friend.username}`;
                    return (
                      <Pressable
                        key={friend.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={`Toggle ${name}`}
                        onPress={() => toggleFriend(friend.id)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.friendRow,
                          pressed && styles.friendRowPressed,
                          busy && styles.friendRowBusy,
                        ]}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                          {checked ? <Check size={12} color={colors.lilac} /> : null}
                        </View>
                        <ShareAvatar
                          name={friend.displayName}
                          initials={friend.initials}
                          gradient={friend.avatar}
                          avatarUrl={friend.avatarUrl}
                          size={40}
                        />
                        <View style={styles.friendText}>
                          <Text style={styles.friendName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={styles.friendUsername} numberOfLines={1}>
                            @{friend.username}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.footer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${noteCount} notes`}
                    onPress={() => void send()}
                    disabled={selected.size === 0 || busy}
                    style={({ pressed }) => [
                      styles.sendButton,
                      (selected.size === 0 || busy) && styles.sendButtonOff,
                      pressed && selected.size > 0 && !busy ? styles.pressed : null,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Send size={16} color={colors.white} />
                    )}
                    <Text style={styles.sendText}>
                      {busy
                        ? "Sharing…"
                        : `Share ${noteCount} note${noteCount > 1 ? "s" : ""}`}
                    </Text>
                  </Pressable>
                </View>
              </>
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
    maxHeight: "82%",
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
    gap: 12,
    padding: 20,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    color: colors.w45,
  },
  title: {
    marginTop: 6,
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.white,
  },
  subtitle: {
    marginTop: 4,
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
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.w07,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  selectAllText: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  selectCount: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w45,
    borderRadius: 999,
    backgroundColor: colors.w05,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.w20,
    backgroundColor: colors.w03,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: colors.lilac,
    backgroundColor: colors.lilac12,
  },
  listScroll: {
    flexShrink: 1,
    maxHeight: 340,
  },
  list: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.w07,
    padding: 16,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac12,
  },
  sendButtonOff: {
    borderColor: colors.w08,
    backgroundColor: colors.w04,
    opacity: 0.6,
  },
  sendText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  error: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingHorizontal: 22,
    paddingVertical: 12,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.9)",
  },
});
