import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ONBOARDING_CARDS,
  OnboardingCard,
  type OnboardingCardData,
} from '@/components/onboarding/onboarding-card';
import { AtlasWordmark } from '@/components/ui/atlas-wordmark';
import { MeshBackground } from '@/components/ui/mesh-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { setOnboarded } from '@/lib/onboarding';

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingCardData>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === ONBOARDING_CARDS.length - 1;

  const finish = async () => {
    await setOnboarded();
    router.replace('/login');
  };

  const handleNext = () => {
    if (isLast) {
      void finish();
      return;
    }
    const nextIndex = index + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setIndex(nextIndex);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextIndex !== index && nextIndex >= 0 && nextIndex < ONBOARDING_CARDS.length) {
      setIndex(nextIndex);
    }
  };

  return (
    <View className="flex-1 bg-void">
      <MeshBackground />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="h-16 flex-row items-center justify-between px-6">
          <AtlasWordmark size="sm" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
            className="min-h-[48px] min-w-[76px] shrink-0 items-center justify-center rounded-2xl px-6 py-3"
            onPress={() => void finish()}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              className="font-sans-medium text-[17px] text-white/50">
              Skip
            </Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          className="flex-1"
          data={ONBOARDING_CARDS}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, itemIndex) => ({
            length: width,
            offset: width * itemIndex,
            index: itemIndex,
          })}
          renderItem={({ item }) => <OnboardingCard card={item} width={width} height={height} />}
          accessibilityLabel={`Onboarding, page ${index + 1} of ${ONBOARDING_CARDS.length}`}
        />

        <View className="gap-4 px-7 pb-3">
          <View className="flex-row items-center justify-center gap-2">
            {ONBOARDING_CARDS.map((card, cardIndex) => (
              <View
                key={card.key}
                accessibilityLabel={`Page ${cardIndex + 1}`}
                className={`h-2 rounded-full ${
                  cardIndex === index ? 'w-7 bg-star' : 'w-2 bg-white/25'
                }`}
              />
            ))}
          </View>

          <PrimaryButton
            label={isLast ? 'Get started' : 'Continue'}
            variant={isLast ? 'gradient' : 'primary'}
            onPress={handleNext}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            hitSlop={8}
            className="min-h-[44px] flex-row items-center justify-center gap-1.5 px-6"
            onPress={() => void finish()}>
            <Text allowFontScaling={false} className="font-sans text-[16px] text-white/45">
              Already have an account?
            </Text>
            <Text allowFontScaling={false} className="font-sans-semibold text-[16px] text-star">
              Sign In
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
