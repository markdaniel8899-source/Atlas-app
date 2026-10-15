import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  Info,
  LogOut,
  Mail,
  MapPin,
  Save,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RevealText } from '@/components/ui/reveal-text';
import { doubleCurtainNavigate } from '@/components/DoubleCurtain';
import { useUserId } from '@/hooks/useUserId';
import { getCurrentUser } from '@/lib/auth';
import { deleteCourse, fetchCourses, topicCounts } from '@/lib/db/courses';
import { fetchProfile, updateProfile } from '@/lib/db/profile';
import { getRankFromXP } from '@/lib/gamification';
import { supabase } from '@/lib/supabase';
import type { Course, Profile } from '@/lib/db/types';
import { toastInfo, toastSuccess } from '@/lib/toast';

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function SectionLabel({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text
          allowFontScaling={false}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
          {label}
        </Text>
      </View>
      {right ? (
        <Text allowFontScaling={false} className="text-base text-white/35">
          {right}
        </Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  hint,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  prefix?: string;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text
        allowFontScaling={false}
        className="text-[15px] font-medium uppercase tracking-[0.1em] text-white/45">
        {label}
      </Text>
      <View className="min-h-[52px] flex-row items-center rounded-xl border border-white/10 bg-white/[0.03] px-4">
        {prefix ? (
          <Text
            allowFontScaling={false}
            className="select-none text-base text-white/30">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          allowFontScaling={false}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          maxLength={maxLength}
          className={`min-h-[52px] flex-1 py-3.5 font-sans text-base text-white ${
            prefix ? 'pl-1.5' : ''
          }`}
        />
      </View>
      {hint ? (
        <Text
          allowFontScaling={false}
          className="text-base text-white/30">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const userId = useUserId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    void Promise.all([fetchProfile(userId), fetchCourses(userId)]).then(
      ([p, list]) => {
        setProfile(p);
        setCourses(list);
        setDisplayName(p?.display_name ?? '');
        setUsername(p?.username ?? '');
        setLoading(false);
      },
    );
    void getCurrentUser().then((u) => setUserEmail(u?.email ?? ''));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  }, [load]);

  const handleSave = async () => {
    if (!userId || saving) return;
    const name = displayName.trim();
    const handle = username.trim().toLowerCase();

    if (!name) {
      setError("Display name can't be empty.");
      return;
    }
    if (name.length > 60) {
      setError('Display name must be 60 characters or fewer.');
      return;
    }
    if (!USERNAME_RE.test(handle)) {
      setError('Username must be 3-24 characters: lowercase letters, numbers or _.');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const { profile: updated, error: saveError } = await updateProfile(userId, {
      display_name: name,
      username: handle,
    });

    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }

    setProfile(updated);
    setDisplayName(updated?.display_name ?? name);
    setUsername(updated?.username ?? handle);
    setSaved(true);
    toastSuccess('Profile saved');
  };

  const handleDeleteCourse = (course: Course) => {
    Alert.alert(
      'Delete course?',
      `This also removes its roadmap, levels, topics and notes for "${course.title}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            void deleteCourse(userId, course.id).then(() => {
              toastInfo('Course deleted');
              load();
            });
          },
        },
      ],
    );
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    doubleCurtainNavigate(() => router.replace('/login'));
  };

  const rankData = getRankFromXP(profile?.xp ?? 0);
  const initials =
    (displayName || profile?.display_name || 'A')
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'A';

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
        <RevealText
          text="Settings."
          className="font-syne-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#9db4ff" size="large" />
        </View>
      ) : (
        <>
          <GlassCard className="gap-6 p-6">
            <SectionLabel
              icon={<UserRound size={14} color="rgba(255,255,255,0.45)" />}
              label="Profile"
            />

            <View className="flex-row flex-wrap items-center gap-5">
              <View className="h-20 w-20 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.03]">
                <LinearGradient
                  colors={['#3d4f9e', '#7b8ee8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0 items-center justify-center">
                  <Text
                    allowFontScaling={false}
                    className="font-sans-semibold text-lg text-white">
                    {initials}
                  </Text>
                </LinearGradient>
                <Image
                  source={{
                    uri: `https://api.dicebear.com/9.x/glass/png?size=240&seed=${encodeURIComponent(
                      profile?.username || profile?.display_name || 'atlas',
                    )}`,
                  }}
                  contentFit="cover"
                  transition={200}
                  style={{ width: 80, height: 80 }}
                />
              </View>
              <View className="min-w-0 flex-1 gap-2">
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/55">
                  Your rank grows with every focused hour and correct answer.
                </Text>
                <View
                  className="self-start flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5"
                  style={{
                    borderColor: rankData.tier.pillBorder,
                    backgroundColor: rankData.tier.pillBg,
                  }}>
                  <Text
                    allowFontScaling={false}
                    className="text-base font-medium"
                    style={{ color: rankData.tier.pillText }}>
                    {rankData.name}
                  </Text>
                </View>
              </View>
            </View>

            <Field
              label="Display name"
              value={displayName}
              onChangeText={(v) => {
                setDisplayName(v);
                setSaved(false);
              }}
              placeholder="Ada Lovelace"
              maxLength={60}
            />
            <Field
              label="Username"
              value={username}
              onChangeText={(v) => {
                setUsername(v.replace(/\s+/g, ''));
                setSaved(false);
              }}
              placeholder="ada"
              prefix="@"
              hint="3-24 chars - lowercase, numbers, underscore"
              maxLength={24}
            />

            {error ? (
              <View className="flex-row items-start gap-2 rounded-xl border border-rose-300/30 bg-rose-300/[0.07] px-3.5 py-3">
                <AlertCircle
                  size={16}
                  color="#fecdd3"
                  style={{ marginTop: 2 }}
                />
                <Text
                  allowFontScaling={false}
                  className="min-w-0 flex-1 text-base leading-relaxed text-rose-200">
                  {error}
                </Text>
              </View>
            ) : null}
            {saved && !error ? (
              <View className="flex-row items-center gap-2 rounded-xl border border-[#cf9eff]/30 bg-[#cf9eff]/[0.07] px-3.5 py-3">
                <Check size={16} color="#cf9eff" />
                <Text
                  allowFontScaling={false}
                  className="text-base text-[#cf9eff]">
                  Profile saved.
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Save changes"
              loading={saving}
              icon={<Save size={16} color="#030305" />}
              onPress={() => void handleSave()}
            />
          </GlassCard>

          <GlassCard className="gap-4 p-5">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Account
            </Text>
            <View className="flex-row items-center justify-between gap-3">
              <Text
                allowFontScaling={false}
                className="shrink-0 text-base text-white/45">
                Email
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                className="min-w-0 flex-1 text-right text-base text-white/80">
                {userEmail || '-'}
              </Text>
            </View>
          </GlassCard>

          <GlassCard className="gap-4 p-5">
            <Text
              allowFontScaling={false}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
              Progress
            </Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/45">
                  Rank
                </Text>
                <View
                  className="flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5"
                  style={{
                    borderColor: rankData.tier.pillBorder,
                    backgroundColor: rankData.tier.pillBg,
                  }}>
                  <Text
                    allowFontScaling={false}
                    className="text-base font-medium"
                    style={{ color: rankData.tier.pillText }}>
                    {rankData.name}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/45">
                  XP
                </Text>
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/80">
                  {(profile?.xp ?? 0).toLocaleString()}
                </Text>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/45">
                  Weekly XP
                </Text>
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/80">
                  {(profile?.weekly_xp ?? 0).toLocaleString()}
                </Text>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/45">
                  Streak
                </Text>
                <Text
                  allowFontScaling={false}
                  className="text-base text-white/80">
                  {profile?.streak ?? 0}d
                </Text>
              </View>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <LinearGradient
                colors={rankData.tier.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: `${rankData.percent}%`,
                  height: '100%',
                  borderRadius: 999,
                }}
              />
            </View>
            <Text
              allowFontScaling={false}
              className="text-base text-white/35">
              {rankData.xpToNext} XP to {rankData.nextRankName ?? 'max rank'}
            </Text>
          </GlassCard>

          <GlassCard className="gap-4 p-6">
            <SectionLabel
              icon={<GraduationCap size={14} color="rgba(255,255,255,0.45)" />}
              label="Manage courses"
              right={`${courses.length} total`}
            />
            <Text
              allowFontScaling={false}
              className="text-base leading-relaxed text-white/55">
              Central control for every course. Deleting also removes the
              course&apos;s roadmap and notes.
            </Text>

            {courses.length === 0 ? (
              <Text
                allowFontScaling={false}
                className="text-base text-white/40">
                No courses yet: create one from the Courses page.
              </Text>
            ) : (
              <View className="gap-2">
                {courses.map((course) => {
                  const { total, done } = topicCounts(course);
                  const pct = Math.max(0, Math.min(100, course.progress_percentage));
                  return (
                    <View
                      key={course.id}
                      className="flex-row items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                      <View
                        className="h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <BookOpen size={16} color={course.accent} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          className="text-base text-white">
                          {course.title}
                        </Text>
                        <Text
                          allowFontScaling={false}
                          className="mt-0.5 text-base text-white/40">
                          {done}/{total} topics - {Math.round(pct)}%
                        </Text>
                        <View className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <View
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: course.accent }}
                          />
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteCourse(course)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${course.title}`}
                        hitSlop={8}
                        className="h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Trash2 size={14} color="rgba(255,255,255,0.45)" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>

          <GlassCard className="gap-1 p-3">
            <Pressable
              onPress={() => router.push('/about')}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-5 py-3.5">
              <Info size={16} color="rgba(255,255,255,0.55)" />
              <Text
                allowFontScaling={false}
                className="flex-1 font-sans text-base text-white/85">
                About ATLAS
              </Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/contact')}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-5 py-3.5">
              <Mail size={16} color="rgba(255,255,255,0.55)" />
              <Text
                allowFontScaling={false}
                className="flex-1 font-sans text-base text-white/85">
                Contact us
              </Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/privacy')}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-5 py-3.5">
              <Shield size={16} color="rgba(255,255,255,0.55)" />
              <Text
                allowFontScaling={false}
                className="flex-1 font-sans text-base text-white/85">
                Privacy policy
              </Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/terms')}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-5 py-3.5">
              <MapPin size={16} color="rgba(255,255,255,0.55)" />
              <Text
                allowFontScaling={false}
                className="flex-1 font-sans text-base text-white/85">
                Terms & conditions
              </Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
            </Pressable>
            <View className="my-1 h-px bg-white/[0.07]" />
            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-5 py-3.5">
              <LogOut size={16} color="#ff6b6b" />
              <Text
                allowFontScaling={false}
                className="flex-1 font-sans text-base text-[#ff6b6b]">
                Sign out
              </Text>
            </Pressable>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}
