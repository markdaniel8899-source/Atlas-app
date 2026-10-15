import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Animated, Easing, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Clock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Map,
  Settings,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react-native';

const PANEL_WIDTH = 240;
const SLIDE_DISTANCE = PANEL_WIDTH + 40;

interface NavItem {
  href:
    | '/dashboard'
    | '/roadmap'
    | '/courses'
    | '/notes'
    | '/quiz'
    | '/timer'
    | '/friends'
    | '/leaderboard'
    | '/assistant'
    | '/settings';
  label: string;
  Icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: LayoutDashboard },
  { href: '/roadmap', label: 'Roadmap', Icon: Map },
  { href: '/courses', label: 'Courses', Icon: GraduationCap },
  { href: '/notes', label: 'Notes', Icon: FileText },
  { href: '/quiz', label: 'Quiz', Icon: ListChecks },
  { href: '/timer', label: 'Timer', Icon: Clock },
  { href: '/friends', label: 'Friends', Icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
  { href: '/assistant', label: 'Assistant', Icon: Sparkles },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

function DrawerLogo() {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-3 w-3 rotate-45 rounded-[2px] border border-star/80 bg-star/20" />
      <Text
        allowFontScaling={false}
        className="font-sans-semibold text-[16px] tracking-[-0.03em] text-white">
        ATLAS
      </Text>
    </View>
  );
}

export function NavigationDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const [translateX] = useState(() => new Animated.Value(-SLIDE_DISTANCE));
  const [overlay] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -SLIDE_DISTANCE,
        duration: open ? 350 : 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlay, {
        toValue: open ? 1 : 0,
        duration: open ? 250 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, translateX, overlay]);

  const go = (href: NavItem['href']) => {
    onClose();
    router.push(href);
  };

  return (
    <View
      pointerEvents={open ? 'auto' : 'none'}
      className="absolute inset-0 z-50"
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <Animated.View
        style={{ opacity: overlay }}
        className="absolute inset-0 bg-black/60">
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={{ transform: [{ translateX }], width: PANEL_WIDTH }}
        className="absolute inset-y-0 left-0 overflow-hidden border-r border-white/[0.08]">
        {Platform.OS === 'web' ? (
          <View
            className="absolute inset-0 bg-[#0a0a1a]/90"
            // @ts-expect-error -- web-only backdrop blur
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          />
        ) : (
          <>
            <BlurView
              intensity={50}
              tint="dark"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <View className="absolute inset-0 bg-[#0a0a1a]/90" />
          </>
        )}

        <View className="flex-1">
          <View className="h-16 shrink-0 flex-row items-center justify-between border-b border-white/[0.05] px-5">
            <DrawerLogo />
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close navigation"
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-lg">
              <X size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          <View className="flex-1 p-3">
            <View className="flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => go(item.href)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`flex-row items-center gap-3 rounded-xl border px-3.5 py-3 ${
                      active
                        ? 'border-[#cf9eff]/50 bg-[#cf9eff]/10'
                        : 'border-transparent'
                    }`}
                    style={
                      active
                        ? {
                            boxShadow:
                              '0px 0px 16px 0px rgba(207, 158, 255, 0.5), inset 0px 0px 12px 0px rgba(207, 158, 255, 0.12)',
                          }
                        : undefined
                    }>
                    <item.Icon
                      size={16}
                      color={active ? '#cf9eff' : 'rgba(255,255,255,0.5)'}
                      strokeWidth={1.9}
                    />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      className={`flex-1 font-sans text-[14px] ${
                        active ? 'font-sans-medium text-white' : 'text-white/50'
                      }`}>
                      {item.label}
                    </Text>
                    {active ? <View className="h-1.5 w-1.5 rounded-full bg-[#cf9eff]" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
