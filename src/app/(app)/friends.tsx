import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock, Flame, Mail, UserPlus, Users, X, Zap } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { useUserId } from '@/hooks/useUserId';
import { getRankFromXP } from '@/lib/gamification';
import {
  acceptInvite,
  declineInvite,
  fetchSquad,
  inviteFriend,
} from '@/lib/db/squad';
import type { SquadMember, SquadStatus } from '@/lib/db/types';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';

const STATUS_LABEL: Record<SquadStatus, string> = {
  studying: 'Active today',
  online: 'Active yesterday',
  offline: 'Offline',
};

const STATUS_DOT: Record<SquadStatus, string> = {
  studying: '#cf9eff',
  online: '#9db4ff',
  offline: 'rgba(255,255,255,0.25)',
};

function SectionLabel({
  label,
  count,
  star,
}: {
  label: string;
  count: number;
  star?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text
        allowFontScaling={false}
        className={`text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]${
          star ? ' opacity-100' : ' opacity-60'
        }`}>
        {label}
      </Text>
      {count > 0 ? (
        <View
          className={`min-w-[18px] items-center rounded-full px-1.5 py-0.5 ${
            star ? 'bg-star/15' : 'bg-white/10'
          }`}>
          <Text
            allowFontScaling={false}
            className={`text-[15px] font-bold ${
              star ? 'text-star' : 'text-white/60'
            }`}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Avatar({
  member,
  size,
  gradient,
}: {
  member: SquadMember;
  size: number;
  gradient?: [string, string];
}) {
  return (
    <View className="relative">
      <LinearGradient
        colors={gradient ?? ['#3f3f56', '#27273a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="items-center justify-center overflow-hidden">
        <Text
          allowFontScaling={false}
          className="font-sans-semibold text-[15px] text-white">
          {member.initials}
        </Text>
      </LinearGradient>
      <View
        className="absolute right-0.5 bottom-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-black"
        style={{ backgroundColor: STATUS_DOT[member.status] }}
      />
    </View>
  );
}

function FriendCard({ member }: { member: SquadMember }) {
  const rank = getRankFromXP(member.xp);
  return (
    <GlassCard className="gap-5 rounded-xl p-4">
      <View className="flex-row items-center gap-4">
        <Avatar member={member} size={64} gradient={rank.tier.gradientColors} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="font-sans-semibold text-base tracking-tight text-white">
            {member.displayName}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="text-base text-white/40">
            @{member.username}
          </Text>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Clock size={12} color="rgba(255,255,255,0.45)" />
            <Text
              allowFontScaling={false}
              className="text-base text-white/45">
              {STATUS_LABEL[member.status]}
            </Text>
          </View>
        </View>
        <View
          className="shrink-0 flex-row items-center gap-1 rounded-lg border px-3 py-1.5"
          style={{
            borderColor: rank.tier.pillBorder,
            backgroundColor: rank.tier.pillBg,
          }}>
          <Text
            allowFontScaling={false}
            className="text-base font-semibold tracking-wide"
            style={{ color: rank.tier.pillText }}>
            {rank.name}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Zap size={14} color="rgba(147,197,253,0.8)" />
            <Text
              allowFontScaling={false}
              className="font-sans-medium text-base text-white/80">
              {member.xp.toLocaleString()}
            </Text>
            <Text
              allowFontScaling={false}
              className="text-base text-white/35">
              total XP
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Flame size={14} color="#e0975f" />
            <Text
              allowFontScaling={false}
              className="font-sans-medium text-base text-amber-300/90">
              {member.streak}d streak
            </Text>
          </View>
        </View>

        <View className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <LinearGradient
            colors={rank.tier.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${rank.percent}%`, height: '100%', borderRadius: 999 }}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text
            allowFontScaling={false}
            className="uppercase tracking-wider text-[15px] text-white/35">
            {rank.tier.label}
          </Text>
          <Text
            allowFontScaling={false}
            className="text-base text-white/35">
            {rank.xpToNext} XP to {rank.nextRankName ?? 'max'}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

function RequestRow({
  member,
  onAccept,
  onDecline,
}: {
  member: SquadMember;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const incoming = member.relationship === 'incoming';
  return (
    <GlassCard className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
      <View className="min-w-0 flex-row items-center gap-3">
        <Avatar member={member} size={48} />
        <View className="min-w-0">
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="text-base font-medium text-white">
            {member.displayName}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="text-base text-white/40">
            {incoming
              ? 'wants to be your friend'
              : 'invitation sent - waiting'}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {incoming ? (
          <>
            <Pressable
              onPress={onAccept}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl border border-[#cf9eff]/30 bg-[#cf9eff]/10 px-6 py-3">
              <Check size={14} color="#cf9eff" />
              <Text
                allowFontScaling={false}
                className="text-base font-medium text-[#cf9eff]">
                Accept
              </Text>
            </Pressable>
            <Pressable
              onPress={onDecline}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3">
              <X size={14} color="rgba(255,255,255,0.55)" />
              <Text
                allowFontScaling={false}
                className="text-base font-medium text-white/55">
                Decline
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onDecline}
            accessibilityRole="button"
            className="min-h-[48px] flex-row items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3">
            <X size={14} color="rgba(255,255,255,0.55)" />
            <Text
              allowFontScaling={false}
              className="text-base font-medium text-white/55">
              Cancel
            </Text>
          </Pressable>
        )}
      </View>
    </GlassCard>
  );
}

export default function FriendsScreen() {
  const userId = useUserId();
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    void fetchSquad(userId).then((rows) => {
      setMembers(rows);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  }, [load]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    setNotice(null);
    const result = await inviteFriend(email);
    setSending(false);
    setNotice({ ok: result.ok, text: result.message });
    if (result.ok) {
      toastSuccess('Invitation sent', result.message);
      setEmail('');
      load();
    } else {
      toastError('Invite failed', result.message);
    }
  };

  const handleAccept = async (friendshipId: number) => {
    await acceptInvite(friendshipId);
    toastSuccess('Friend added');
    load();
  };

  const handleDecline = async (friendshipId: number) => {
    await declineInvite(friendshipId);
    toastInfo('Request removed');
    load();
  };

  const incoming = members.filter((m) => m.relationship === 'incoming');
  const outgoing = members.filter((m) => m.relationship === 'outgoing');
  const friends = members.filter((m) => m.relationship === 'friend');
  const requestCount = incoming.length + outgoing.length;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#9db4ff"
          colors={['#9db4ff']}
          progressBackgroundColor="#0a0a1a"
        />
      }>
      <View className="gap-2 pt-2">
        <Text
          allowFontScaling={false}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
          Your people
        </Text>
        <RevealText
          text="Friends."
          className="mt-1 font-syne-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
        <Text
          allowFontScaling={false}
          className="mt-1 text-base text-white/45">
          {loading
            ? 'Loading...'
            : `${friends.length} friend${friends.length === 1 ? '' : 's'} · ${
                requestCount > 0
                  ? `${requestCount} pending request${requestCount === 1 ? '' : 's'}`
                  : 'no pending requests'
              }`}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="min-h-[52px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 backdrop-blur-2xl">
          <Mail size={16} color="rgba(255,255,255,0.3)" />
          <TextInput
            allowFontScaling={false}
            value={email}
            onChangeText={setEmail}
            placeholder="friend@email.com"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            className="min-h-[52px] min-w-0 flex-1 bg-transparent py-3.5 font-sans text-base text-white"
          />
        </View>
        <PrimaryButton
          label="Invite"
          compact
          loading={sending}
          disabled={!email.trim()}
          icon={<UserPlus size={14} color="#030305" />}
          onPress={() => void handleInvite()}
        />
      </View>

      {notice ? (
        <View
          className={`rounded-2xl border px-4 py-3.5 ${
            notice.ok
              ? 'border-[#cf9eff]/30 bg-[#cf9eff]/[0.08]'
              : 'border-red-400/25 bg-red-500/[0.08]'
          }`}>
          <Text
            allowFontScaling={false}
            className={`text-base leading-relaxed ${
              notice.ok ? 'text-[#cf9eff]/90' : 'text-red-100/90'
            }`}>
            {notice.text}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#9db4ff" size="large" />
        </View>
      ) : (
        <>
          <View className="gap-3">
            <SectionLabel label="Incoming" count={incoming.length} star />
            {incoming.length === 0 ? (
              <Text
                allowFontScaling={false}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-base text-white/40">
                No incoming requests right now.
              </Text>
            ) : (
              incoming.map((member) => (
                <RequestRow
                  key={member.friendshipId}
                  member={member}
                  onAccept={() => void handleAccept(member.friendshipId)}
                  onDecline={() => void handleDecline(member.friendshipId)}
                />
              ))
            )}
          </View>

          <View className="gap-3">
            <SectionLabel label="Sent" count={outgoing.length} />
            {outgoing.length === 0 ? (
              <Text
                allowFontScaling={false}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-base text-white/40">
                No invitations waiting for a reply.
              </Text>
            ) : (
              outgoing.map((member) => (
                <RequestRow
                  key={member.friendshipId}
                  member={member}
                  onAccept={() => undefined}
                  onDecline={() => void handleDecline(member.friendshipId)}
                />
              ))
            )}
          </View>

          <View className="gap-3">
            <SectionLabel label="Friends" count={friends.length} />
            {friends.length === 0 ? (
              <GlassCard className="items-center gap-3 p-8">
                <Users size={28} color="rgba(255,255,255,0.25)" />
                <Text
                  allowFontScaling={false}
                  className="font-sans-semibold text-lg tracking-tight text-white">
                  No friends yet
                </Text>
                <Text
                  allowFontScaling={false}
                  className="max-w-[280px] text-center text-base leading-relaxed text-white/45">
                  Invite someone by email above, or accept a request from
                  Incoming. You climb the leaderboard beside them.
                </Text>
              </GlassCard>
            ) : (
              friends.map((member) => (
                <FriendCard key={member.friendshipId} member={member} />
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
