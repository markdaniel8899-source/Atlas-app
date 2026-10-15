import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { SoftGlow } from '@/components/ui/soft-glow';

type Props = {
  eyebrow?: string;
  title: string;
  date?: string;
  lead?: string;
  children: ReactNode;
  wide?: boolean;
};

export function PublicPage({ eyebrow, title, date, lead, children, wide = false }: Props) {
  return (
    <View className="flex-1 bg-void">
      <View pointerEvents="none" className="absolute inset-0">
        <SoftGlow color="#cf9eff" opacity={0.12} radius={190} style={{ top: -80, left: -120 }} />
        <SoftGlow color="#4044cc" opacity={0.14} radius={160} style={{ top: 200, left: 180 }} />
        <SoftGlow color="#7a5cff" opacity={0.12} radius={180} style={{ bottom: -40, left: 40 }} />
      </View>
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="h-16 flex-row items-center px-5">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white/[0.03]">
            <ArrowLeft size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 56,
            gap: 28,
            maxWidth: wide ? 640 : 520,
            width: '100%',
            alignSelf: 'center',
          }}
          showsVerticalScrollIndicator={false}>
          <View className="gap-3 pt-2">
            {eyebrow ? (
              <Text
                allowFontScaling={false}
                className="font-outfit-semibold text-xs font-semibold uppercase tracking-[0.42em] text-white/55">
                {eyebrow}
              </Text>
            ) : null}
            <Text
              allowFontScaling={false}
              className="font-outfit-bold text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
              {title}
            </Text>
            {date ? (
              <Text
                allowFontScaling={false}
                className="mt-2 font-outfit text-[15px] uppercase tracking-[0.18em] text-white/40">
                {date}
              </Text>
            ) : null}
            {lead ? (
              <Text
                allowFontScaling={false}
                className="mt-3 font-outfit text-base leading-relaxed text-white/60">
                {lead}
              </Text>
            ) : null}
          </View>

          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text
        allowFontScaling={false}
        className="font-outfit-semibold mt-2 text-xl font-semibold tracking-[-0.01em] text-white">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function PublicSubheading({ children }: { children: ReactNode }) {
  return (
    <Text
      allowFontScaling={false}
      className="mt-4 font-outfit-semibold text-base font-semibold tracking-[0.01em] text-white/85">
      {children}
    </Text>
  );
}

export function PublicText({ children }: { children: ReactNode }) {
  return (
    <Text
      allowFontScaling={false}
      className="font-outfit text-base leading-[1.85] text-white/60">
      {children}
    </Text>
  );
}

export function PublicBullet({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <View className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#cf9eff]/60" />
      <Text
        allowFontScaling={false}
        className="flex-1 font-outfit text-base leading-[1.85] text-white/60">
        {children}
      </Text>
    </View>
  );
}

export function PublicCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-[56px] items-center justify-center self-start rounded-full bg-gradient-to-r from-[#7c5cff] to-[#5b47d4] px-8 py-4 shadow-atlas-glow">
      <Text
        allowFontScaling={false}
        className="font-outfit-bold text-xs font-bold uppercase tracking-[0.2em] text-white">
        {label}
      </Text>
    </Pressable>
  );
}
