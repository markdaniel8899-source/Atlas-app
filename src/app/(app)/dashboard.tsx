import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { FocusTimerWidget } from '@/components/dashboard/FocusTimerWidget';
import { PlayerStats } from '@/components/dashboard/PlayerStats';
import { TodayFocus } from '@/components/dashboard/TodayFocus';
import { RevealText } from '@/components/ui/reveal-text';
import { useDashboard } from '@/hooks/useDashboard';
import { useUserId } from '@/hooks/useUserId';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const userId = useUserId();
  const [refreshing, setRefreshing] = useState(false);
  const { profile, heatmap, focus, loading, reload } = useDashboard(userId);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 600);
  }, [reload]);

  const fullName = profile?.display_name || '';
  const firstName = fullName.split(' ')[0]?.trim() || 'Explorer';

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 20 }}
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
      <View className="gap-3 pb-2 pt-8">
        <Text
          allowFontScaling={false}
          className="text-[10px] font-medium uppercase tracking-[0.36em] text-[#9db4ff]/70">
          {greeting()}
        </Text>
        <RevealText
          text={`${firstName}, here's your terrain.`}
          className="font-display-semibold text-[30px] leading-[36px] tracking-[-0.04em] text-white"
        />
      </View>

      <PlayerStats profile={profile} loading={loading} />

      <FocusTimerWidget />

      <TodayFocus focus={focus} loading={loading} />

      <ActivityHeatmap days={heatmap} />
    </ScrollView>
  );
}
