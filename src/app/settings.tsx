import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AlertCircle,
  BookOpen,
  Check,
  GraduationCap,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenShell } from "../components/screen-shell";
import { AvatarPickerModal } from "../components/profile/avatar-picker-modal";
import { CourseEditorModal } from "../components/courses/course-editor-modal";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ThemedInput } from "../components/ui/themed-input";
import { resolveSession } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { fetchProfile, updateProfile } from "../lib/db/profile";
import { deleteCourse, topicCounts } from "../lib/db/courses";
import { apiSelectAvatar } from "../lib/gamification-api";
import { getRankFromXP } from "../lib/gamification";
import { pngAvatarUrl } from "../lib/dicebear";
import { notifyProfileChanged } from "../lib/events";
import { ensureOnline } from "../lib/net";
import { getCachedProfile } from "../lib/profile-cache";
import { useCourses } from "../hooks/use-courses";
import type { Course, Profile } from "../lib/db/types";
import { colors, fonts } from "../theme/theme";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export default function SettingsScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Seed from the cached profile so returning to Settings paints instantly;
  // the effect below silently revalidates.
  const [profile, setProfile] = useState<Profile | null>(() =>
    getCachedProfile(),
  );
  const [loading, setLoading] = useState(() => getCachedProfile() === null);
  const [displayName, setDisplayName] = useState(
    () => getCachedProfile()?.display_name ?? "",
  );
  const [username, setUsername] = useState(
    () => getCachedProfile()?.username ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => getCachedProfile()?.avatar_url ?? null,
  );
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    courses: managedCourses,
    loading: coursesLoading,
    reload: reloadCourses,
  } = useCourses();
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Course | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionUser = await resolveSession();
      if (cancelled) return;
      setUser(sessionUser);
      if (!sessionUser) {
        setLoading(false);
        return;
      }

      try {
        const loaded = await fetchProfile(sessionUser.id);
        if (cancelled) return;
        setProfile(loaded);
        setDisplayName(loaded?.display_name ?? sessionUser.name ?? "");
        setUsername(loaded?.username ?? "");
        setAvatarUrl(loaded?.avatar_url ?? null);
      } catch {
        if (!cancelled) setError("Couldn't load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvatarSelected = async (url: string): Promise<boolean> => {
    if (!user) return false;
    if (!(await ensureOnline("Profile changes need an internet connection."))) {
      return false;
    }
    setSaving(true);
    setError(null);
    setSaved(false);

    const { profile: updated, error: saveError } = await updateProfile(user.id, {
      avatar_url: url,
    });

    // Best-effort server-side validation via FastAPI - the URL is already
    // stored on the profile, so failures here are ignored.
    void apiSelectAvatar(url);

    setSaving(false);

    if (saveError || !updated) {
      setError(saveError ?? "Couldn't save that avatar.");
      return false;
    }

    setProfile(updated);
    setAvatarUrl(url);
    notifyProfileChanged();
    setSaved(true);
    return true;
  };

  const removeAvatar = async () => {
    if (!user) return;
    if (!(await ensureOnline("Profile changes need an internet connection."))) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);

    const { profile: updated, error: saveError } = await updateProfile(user.id, {
      avatar_url: null,
    });

    void apiSelectAvatar(null);

    setSaving(false);

    if (saveError || !updated) {
      setError(saveError ?? "Couldn't remove the avatar.");
      return;
    }

    setProfile(updated);
    setAvatarUrl(null);
    notifyProfileChanged();
    setSaved(true);
  };

  const handleSave = async () => {
    if (!user || saving) return;

    const name = displayName.trim();
    const handle = username.trim().toLowerCase();

    if (!name) {
      setError("Display name can't be empty.");
      return;
    }
    if (name.length > 60) {
      setError("Display name must be 60 characters or fewer.");
      return;
    }
    if (!USERNAME_RE.test(handle)) {
      setError(
        "Username must be 3-24 characters: lowercase letters, numbers or _.",
      );
      return;
    }

    if (!(await ensureOnline("Profile changes need an internet connection."))) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const { profile: updated, error: saveError } = await updateProfile(user.id, {
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
    notifyProfileChanged();
    setSaved(true);
  };

  const confirmDeleteCourse = async () => {
    const course = confirmTarget;
    if (!course) return;
    setConfirmTarget(null);
    setCourseBusy(true);
    setCourseError(null);
    const removed = await deleteCourse(course.id);
    setCourseBusy(false);

    if (!removed) {
      setCourseError("Could not delete the course. Check your connection.");
      return;
    }
    setEditingCourse((current) => (current?.id === course.id ? null : current));
    await reloadCourses();
  };

  const rankData = getRankFromXP(profile?.xp ?? 0);
  const initials =
    (displayName || profile?.display_name || user?.name || "A")
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  return (
    <ScreenShell title="Settings" activeLabel="Settings">
      <Text style={styles.heading}>Settings.</Text>

      {/* PROFILE */}
      <Card style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeader}>
            <UserRound size={14} color={colors.w45} />
            <Text style={styles.cardTitle}>PROFILE</Text>
          </View>
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {pngAvatarUrl(avatarUrl) ? (
                <Image
                  source={{ uri: pngAvatarUrl(avatarUrl) ?? undefined }}
                  style={styles.avatarImage}
                />
              ) : (
                <LinearGradient
                  colors={[colors.avatarFrom, colors.avatarTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                >
                  <View style={styles.avatarInitialsWrap}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                </LinearGradient>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit avatar"
              onPress={() => setAvatarPickerOpen(true)}
              disabled={loading}
              style={[styles.avatarEditBadge, loading && styles.disabled]}
            >
              <Sparkles size={14} color={colors.w70} />
            </Pressable>
          </View>

          <View style={styles.avatarTextWrap}>
            <Text style={styles.avatarHint}>
              Unique generated avatars via DiceBear - pick a style that fits
              your rank.
            </Text>
            {avatarUrl && !pngAvatarUrl(avatarUrl) ? (
              <Text style={styles.avatarWarn}>
                The saved avatar link isn’t supported - pick a new one.
              </Text>
            ) : null}
            <View style={styles.avatarButtons}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAvatarPickerOpen(true)}
                style={styles.editAvatarButton}
              >
                <Sparkles size={14} color={colors.w80} />
                <Text style={styles.editAvatarText}>Edit avatar</Text>
              </Pressable>
              {avatarUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void removeAvatar()}
                  disabled={saving}
                  style={[styles.removeButton, saving && styles.disabled]}
                >
                  <Trash2 size={14} color={colors.w50} />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
              <View
                style={[
                  styles.rankChip,
                  {
                    borderColor: rankData.tier.border,
                    backgroundColor: rankData.tier.bg,
                  },
                ]}
              >
                <Text
                  style={[styles.rankChipText, { color: rankData.tier.text }]}
                >
                  {rankData.name}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.fieldsWrap}>
          <View>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <ThemedInput
              value={displayName}
              maxLength={60}
              editable={!loading}
              onChangeText={(value) => {
                setDisplayName(value);
                setSaved(false);
              }}
              placeholder="Ada Lovelace"
              placeholderTextColor={colors.w30}
              style={styles.field}
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>USERNAME</Text>
            <View style={styles.usernameField}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                keyboardAppearance="dark"
                value={username}
                maxLength={24}
                editable={!loading}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  setUsername(value.replace(/\s+/g, ""));
                  setSaved(false);
                }}
                onBlur={() =>
                  setUsername((value) => value.trim().toLowerCase())
                }
                placeholder="ada"
                placeholderTextColor={colors.w30}
                style={styles.usernameInput}
              />
            </View>
            <Text style={styles.usernameHint}>
              3-24 chars · lowercase, numbers, underscore
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color="rgba(253,164,175,0.9)" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : saved ? (
          <View style={styles.savedBanner}>
            <Check size={16} color={colors.lilac} />
            <Text style={styles.savedBannerText}>Profile saved.</Text>
          </View>
        ) : null}

        <View style={styles.saveRow}>
          <Button
            label={saving ? "Saving…" : "Save changes"}
            icon={
              saving ? undefined : <Save size={16} color={colors.primaryText} />
            }
            disabled={saving || loading || !user}
            onPress={() => void handleSave()}
            contentStyle={styles.saveButton}
          />
        </View>
      </Card>

      {/* MANAGE COURSES */}
      <Card style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeader}>
            <GraduationCap size={14} color={colors.w45} />
            <Text style={styles.cardTitle}>MANAGE COURSES</Text>
          </View>
          <Text style={styles.courseCount}>
            {coursesLoading ? "Loading…" : `${managedCourses.length} total`}
          </Text>
        </View>

        <Text style={styles.coursesDescription}>
          Central control for every course. Editing updates the title and
          topics; deleting also removes its roadmap and notes.
        </Text>

        {courseError ? (
          <Text style={styles.courseError}>{courseError}</Text>
        ) : null}

        <View style={styles.courseList}>
          {coursesLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.w40} />
              <Text style={styles.loadingText}>Loading courses…</Text>
            </View>
          ) : managedCourses.length === 0 ? (
            <Text style={styles.noCourses}>
              No courses yet: create one from the Courses page.
            </Text>
          ) : (
            managedCourses.map((course) => {
              const { total, done } = topicCounts(course);
              const progress = Math.max(
                0,
                Math.min(100, course.progress_percentage),
              );
              return (
                <View key={course.id} style={styles.courseRow}>
                  <View style={styles.courseIconBox}>
                    <BookOpen size={16} color={course.accent} />
                  </View>

                  <View style={styles.courseInfo}>
                    <Text numberOfLines={1} style={styles.courseName}>
                      {course.title}
                    </Text>
                    <Text style={styles.courseMeta}>
                      {done}/{total} topics · {Math.round(progress)}%
                    </Text>
                    <View style={styles.courseTrack}>
                      <View
                        style={[
                          styles.courseFill,
                          {
                            width: `${progress}%`,
                            backgroundColor: course.accent,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.courseActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${course.title}`}
                      onPress={() => setEditingCourse(course)}
                      disabled={courseBusy}
                      style={[styles.courseAction, courseBusy && styles.disabled]}
                    >
                      <Pencil size={14} color={colors.w45} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${course.title}`}
                      onPress={() => {
                        if (!courseBusy) setConfirmTarget(course);
                      }}
                      disabled={courseBusy}
                      style={[styles.courseAction, courseBusy && styles.disabled]}
                    >
                      <Trash2 size={14} color={colors.w45} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Card>

      {/* ACCOUNT */}
      <Card style={styles.smallCard}>
        <Text style={styles.cardTitle}>ACCOUNT</Text>
        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Email</Text>
            <Text numberOfLines={1} style={styles.metaValue}>
              {user?.email ?? "—"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>User ID</Text>
            <Text numberOfLines={1} style={styles.metaMono}>
              {user?.id ?? "—"}
            </Text>
          </View>
        </View>
      </Card>

      {/* PROGRESS */}
      <Card style={styles.smallCard}>
        <Text style={styles.cardTitle}>PROGRESS</Text>
        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Rank</Text>
            <View
              style={[
                styles.rankChip,
                {
                  borderColor: rankData.tier.border,
                  backgroundColor: rankData.tier.bg,
                },
              ]}
            >
              <Text
                style={[styles.rankChipText, { color: rankData.tier.text }]}
              >
                {rankData.name}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>XP</Text>
            <Text style={styles.metaValue}>{profile?.xp ?? 0}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Weekly XP</Text>
            <Text style={styles.metaValue}>{profile?.weekly_xp ?? 0}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Streak</Text>
            <Text style={styles.metaValue}>{profile?.streak ?? 0}d</Text>
          </View>
        </View>

        <View style={styles.rankTrack}>
          <LinearGradient
            colors={rankData.tier.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: "100%", width: `${rankData.percent}%` }}
          />
        </View>
        <Text style={styles.rankHint}>
          {rankData.xpToNext} XP to {rankData.nextRankName ?? "max rank"}
        </Text>
      </Card>

      <CourseEditorModal
        course={editingCourse}
        onClose={() => setEditingCourse(null)}
        onSaved={() => void reloadCourses()}
      />

      <AvatarPickerModal
        open={avatarPickerOpen}
        currentUrl={avatarUrl}
        userId={user?.id ?? ""}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={handleAvatarSelected}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete course?"
        message={`This also removes its roadmap, levels, topics and notes for "${confirmTarget?.title ?? ""}". This cannot be undone.`}
        onConfirm={() => void confirmDeleteCourse()}
        onCancel={() => setConfirmTarget(null)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: fonts.display,
    letterSpacing: -1.2,
    color: colors.white,
  },
  card: {
    padding: 24,
  },
  smallCard: {
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    color: colors.w45,
  },
  avatarRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  avatarWrap: {
    width: 80,
    height: 80,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitialsWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac45,
    backgroundColor: "#0a0a14",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  avatarHint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  avatarWarn: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: "rgba(253,186,116,0.85)",
  },
  avatarButtons: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  editAvatarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.4)",
    backgroundColor: colors.lilac10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editAvatarText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w80,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w50,
  },
  disabled: {
    opacity: 0.5,
  },
  rankChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rankChipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  fieldsWrap: {
    marginTop: 28,
    gap: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.w45,
  },
  field: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  usernameField: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 16,
  },
  usernamePrefix: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  usernameInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingLeft: 6,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  usernameHint: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  errorBanner: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(253,164,175,0.3)",
    backgroundColor: "rgba(253,164,175,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "rgba(254,205,211,1)",
  },
  savedBanner: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.3)",
    backgroundColor: "rgba(207,158,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  savedBannerText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.lilac,
  },
  saveRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  saveButton: {
    alignSelf: "auto",
  },
  courseCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  coursesDescription: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  courseError: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(253,164,175,0.85)",
  },
  courseList: {
    marginTop: 16,
    gap: 8,
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
  noCourses: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w07,
    backgroundColor: colors.w02,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  courseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  courseInfo: {
    flex: 1,
    minWidth: 0,
  },
  courseName: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  courseMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  courseTrack: {
    marginTop: 6,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.w06,
    overflow: "hidden",
  },
  courseFill: {
    height: "100%",
    borderRadius: 999,
  },
  courseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  courseAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  metaList: {
    marginTop: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaKey: {
    flexShrink: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  metaValue: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w80,
  },
  metaMono: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.w50,
  },
  rankTrack: {
    marginTop: 20,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.w06,
    overflow: "hidden",
  },
  rankHint: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
});
