import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Check,
  Clock,
  Flame,
  Mail,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useBlurTargetRef } from "../components/blur-target";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { readCache, writeCache } from "../lib/data-cache";
import {
  acceptInvite,
  declineInvite,
  fetchSquad,
  inviteFriend,
} from "../lib/db/squad";
import type { SquadMember, SquadStatus } from "../lib/db/squad";
import { pngAvatarUrl } from "../lib/dicebear";
import { getRankFromXP } from "../lib/gamification";
import { PROFILE_CHANGED_EVENT, listen } from "../lib/events";
import { ensureOnline } from "../lib/net";
import { colors, ease, fonts } from "../theme/theme";

const SQUAD_ERROR =
  "Couldn't load your squad. Check your internet connection and try again.";

const STATUS_DOT: Record<SquadStatus, string> = {
  studying: colors.lilac,
  online: colors.star,
  offline: "rgba(255,255,255,0.25)",
};

function MemberAvatar({
  member,
  size,
  dot,
}: {
  member: SquadMember;
  size: number;
  dot?: boolean;
}) {
  const uri = pngAvatarUrl(member.avatarUrl);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <LinearGradient
            colors={member.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.avatarInitialsWrap}>
              <Text style={styles.avatarInitials}>{member.initials}</Text>
            </View>
          </LinearGradient>
        )}
      </View>
      {dot ? (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: STATUS_DOT[member.status],
              shadowColor: STATUS_DOT[member.status],
            },
            member.status === "offline" ? styles.statusDotOffline : null,
          ]}
        />
      ) : null}
    </View>
  );
}

function ProgressBar({ percent, gradient }: { percent: number; gradient: readonly [string, string] }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(100, percent),
      duration: 900,
      delay: 200,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [anim, percent]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            transform: [
              {
                scaleX: anim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, 1],
                }),
              },
            ],
            transformOrigin: "left",
          },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function FriendCard({ member }: { member: SquadMember }) {
  const rank = getRankFromXP(member.xp);
  const blurTarget = useBlurTargetRef();

  return (
    <View style={styles.friendCardShell}>
      <BlurView
        intensity={22}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget ?? undefined}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.friendCardTint} pointerEvents="none" />

      <View style={styles.friendCard}>
        <View style={styles.friendTop}>
          <MemberAvatar member={member} size={64} dot />

          <View style={styles.friendIdentity}>
            <Text numberOfLines={1} style={styles.friendName}>
              {member.displayName}
            </Text>
            <Text numberOfLines={1} style={styles.friendUsername}>
              @{member.username}
            </Text>
            <View style={styles.friendStatusRow}>
              <Clock size={12} color={colors.w45} />
              <Text style={styles.friendStatusText}>{member.statusLabel}</Text>
            </View>
          </View>

          <View
            style={[
              styles.friendRankChip,
              { borderColor: rank.tier.border, backgroundColor: rank.tier.bg },
            ]}
          >
            <Text style={[styles.friendRankText, { color: rank.tier.text }]}>
              {rank.name}
            </Text>
          </View>
        </View>

        <View style={styles.friendStats}>
          <View style={styles.friendXp}>
            <Zap size={14} color="rgba(147,197,253,0.8)" />
            <Text style={styles.friendXpValue}>
              {member.xp.toLocaleString()}
            </Text>
            <Text style={styles.friendXpLabel}>total XP</Text>
          </View>
          <View style={styles.friendStreak}>
            <Flame size={14} color="rgba(252,211,77,0.9)" />
            <Text style={styles.friendStreakText}>
              {member.streak}d streak
            </Text>
          </View>
        </View>

        <ProgressBar percent={rank.percent} gradient={rank.tier.gradient} />

        <View style={styles.friendFooter}>
          <Text style={styles.friendTierLabel}>
            {rank.tier.label.toUpperCase()}
          </Text>
          <Text style={styles.friendNext}>
            {rank.xpToNext} XP to {rank.nextRankName ?? "max"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RequestRow({
  member,
  busy,
  onAccept,
  onDecline,
}: {
  member: SquadMember;
  busy: boolean;
  onAccept?: () => void;
  onDecline: () => void;
}) {
  const incoming = member.relationship === "incoming";

  return (
    <View style={styles.requestRow}>
      <View style={styles.requestLeft}>
        <MemberAvatar member={member} size={48} />
        <View style={styles.requestIdentity}>
          <Text numberOfLines={1} style={styles.requestName}>
            {member.displayName}
          </Text>
          <Text numberOfLines={1} style={styles.requestHint}>
            {incoming ? "wants to be your friend" : "invitation sent · waiting"}
          </Text>
        </View>
      </View>

      <View style={styles.requestActions}>
        {incoming ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onAccept}
              style={[styles.acceptButton, busy && styles.disabled]}
            >
              <Check size={14} color={colors.lilac} />
              <Text style={styles.acceptText}>Accept</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onDecline}
              style={[styles.declineButton, busy && styles.disabled]}
            >
              <X size={14} color="rgba(255,255,255,0.55)" />
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDecline}
            style={[styles.declineButton, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.w50} />
            ) : (
              <X size={14} color="rgba(255,255,255,0.55)" />
            )}
            <Text style={styles.declineText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

type Tab = "friends" | "requests";

const TABS: { id: Tab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
];

const CACHE_KEY = "squad";

export default function FriendsScreen() {
  const [members, setMembers] = useState<SquadMember[]>(
    () => readCache<SquadMember[]>(CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(
    () => readCache<SquadMember[]>(CACHE_KEY) === null,
  );
  const [tab, setTab] = useState<Tab>("friends");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [invite, setInvite] = useState("");
  const [inviting, setInviting] = useState(false);

  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestRef.current;
    const result = await fetchSquad();
    if (seq !== requestRef.current) return;
    if (result.ok) {
      setMembers(result.members);
      writeCache(CACHE_KEY, result.members);
    }
    setLoading(false);
    setError((current) => {
      if (!result.ok) return SQUAD_ERROR;
      return current === SQUAD_ERROR ? null : current;
    });
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    const unsubscribe = listen(PROFILE_CHANGED_EVENT, refresh);
    return unsubscribe;
  }, [load]);

  const friends = useMemo(
    () => members.filter((m) => m.relationship === "friend"),
    [members],
  );
  const incoming = useMemo(
    () => members.filter((m) => m.relationship === "incoming"),
    [members],
  );
  const outgoing = useMemo(
    () => members.filter((m) => m.relationship === "outgoing"),
    [members],
  );
  const requestCount = incoming.length + outgoing.length;

  const respond = async (member: SquadMember, accept: boolean) => {
    if (busyId !== null) return;
    setBusyId(member.friendshipId);
    if (accept) {
      await acceptInvite(member.friendshipId);
      setFlash(`${member.displayName} is now your friend.`);
    } else {
      await declineInvite(member.friendshipId);
      setFlash("Request removed.");
    }
    setBusyId(null);
    setError(null);
    await load();
  };

  const onInvite = async () => {
    if (inviting) return;
    setInviting(true);
    if (
      !(await ensureOnline("Friend invites need an internet connection."))
    ) {
      setInviting(false);
      return;
    }
    const result = await inviteFriend(invite);
    setInviting(false);
    if (!result.ok) {
      setError(result.message);
      setFlash(null);
      return;
    }
    setError(null);
    setFlash(result.message);
    setInvite("");
    await load();
  };

  const subtitle = loading
    ? "Loading…"
    : `${friends.length} friend${friends.length === 1 ? "" : "s"} · ${
        requestCount > 0
          ? `${requestCount} pending request${requestCount === 1 ? "" : "s"}`
          : "no pending requests"
      }`;

  return (
    <ScreenShell title="Friends" activeLabel="Friends">
      <ScreenHeading eyebrow="Your people" title="Friends." subtitle={subtitle} />

      <View style={styles.inviteRow}>
        <View style={styles.inviteField}>
          <Mail size={16} color={colors.w30} />
          <TextInput
            keyboardAppearance="dark"
            value={invite}
            onChangeText={setInvite}
            placeholder="friend@email.com"
            placeholderTextColor={colors.w30}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Invite a friend by email"
            style={styles.inviteInput}
            onSubmitEditing={() => void onInvite()}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onInvite()}
          disabled={inviting || !invite.trim()}
          style={[
            styles.inviteButton,
            (inviting || !invite.trim()) && styles.disabled,
          ]}
        >
          {inviting ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <UserPlus size={14} color={colors.primaryText} />
          )}
          <Text style={styles.inviteButtonText}>Invite</Text>
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((entry) => {
          const active = tab === entry.id;
          const count = entry.id === "friends" ? friends.length : requestCount;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(entry.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {entry.label}
              </Text>
              {count > 0 ? (
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Text
                    style={[
                      styles.tabCountText,
                      active && styles.tabCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : flash ? (
        <View style={styles.flashRow}>
          <Check size={16} color={colors.lilac90} />
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      ) : null}

      {tab === "friends" ? (
        loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.w40} />
            <Text style={styles.loadingText}>Loading friends…</Text>
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={28} color={colors.w30} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>
              Invite someone by email above, or accept a request from the
              Requests tab. You climb the leaderboard beside them.
            </Text>
          </View>
        ) : (
          <View style={styles.friendList}>
            {friends.map((member) => (
              <FriendCard key={member.friendshipId} member={member} />
            ))}
          </View>
        )
      ) : (
        <View style={styles.requestsWrap}>
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleStar}>INCOMING</Text>
              {incoming.length > 0 ? (
                <View style={styles.sectionCountStar}>
                  <Text style={styles.sectionCountStarText}>
                    {incoming.length}
                  </Text>
                </View>
              ) : null}
            </View>
            {incoming.length === 0 ? (
              <View style={styles.sectionEmpty}>
                <Text style={styles.sectionEmptyText}>
                  No incoming requests right now.
                </Text>
              </View>
            ) : (
              <View style={styles.requestList}>
                {incoming.map((member) => (
                  <RequestRow
                    key={member.friendshipId}
                    member={member}
                    busy={busyId === member.friendshipId}
                    onAccept={() => void respond(member, true)}
                    onDecline={() => void respond(member, false)}
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SENT</Text>
              {outgoing.length > 0 ? (
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>
                    {outgoing.length}
                  </Text>
                </View>
              ) : null}
            </View>
            {outgoing.length === 0 ? (
              <View style={styles.sectionEmpty}>
                <Text style={styles.sectionEmptyText}>
                  No invitations waiting for a reply.
                </Text>
              </View>
            ) : (
              <View style={styles.requestList}>
                {outgoing.map((member) => (
                  <RequestRow
                    key={member.friendshipId}
                    member={member}
                    busy={busyId === member.friendshipId}
                    onDecline={() => void respond(member, false)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  statusDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "#000000",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  statusDotOffline: {
    shadowOpacity: 0,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteField: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  inviteInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
    padding: 0,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  inviteButtonText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.primaryText,
  },
  disabled: {
    opacity: 0.4,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w03,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: colors.w07,
  },
  tabText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.w45,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabCount: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: colors.w10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: "center",
  },
  tabCountActive: {
    backgroundColor: colors.star30,
  },
  tabCountText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.w50,
  },
  tabCountTextActive: {
    color: colors.star,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.8)",
  },
  flashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flashText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.lilac90,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.5,
    color: colors.white,
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  friendList: {
    gap: 16,
  },
  friendCardShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  friendCardTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  friendCard: {
    padding: 16,
  },
  friendTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  friendIdentity: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.white,
  },
  friendUsername: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  friendStatusRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  friendStatusText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  friendRankChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  friendRankText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    letterSpacing: 0.4,
  },
  friendStats: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendXp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  friendXpValue: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w80,
  },
  friendXpLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  friendStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  friendStreakText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "rgba(252,211,77,0.9)",
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.w05,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  friendFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendTierLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.2,
    color: colors.w35,
  },
  friendNext: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  requestsWrap: {
    gap: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleStar: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 1.9,
    color: "rgba(157,180,255,0.8)",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 1.9,
    color: colors.w45,
  },
  sectionCountStar: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: "rgba(157,180,255,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: "center",
  },
  sectionCountStarText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.star,
  },
  sectionCount: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: colors.w10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: "center",
  },
  sectionCountText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.w60,
  },
  sectionEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w03,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionEmptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  requestList: {
    gap: 12,
  },
  requestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  requestLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  requestIdentity: {
    flex: 1,
    minWidth: 0,
  },
  requestName: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  requestHint: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.3)",
    backgroundColor: colors.lilac10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  acceptText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.lilac,
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 44,
    justifyContent: "center",
  },
  declineText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.55)",
  },
});
