import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { ArrowUpRight, Check, Pause, Play, Square, Timer, X } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useTimer } from '@/context/TimerContext';

const PRESETS = [25, 50, 90];

function formatHMS(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const timer = useTimer();
  const { state, globalTotal, progress, activeCourse, flash } = timer;
  const [quickOpen, setQuickOpen] = useState(false);
  const [preset, setPreset] = useState(state.targetMin);
  const active = state.mode !== 'idle';

  const openQuick = () => {
    setPreset(state.targetMin);
    setQuickOpen(true);
  };

  const startQuick = () => {
    timer.startQuick(preset);
    setQuickOpen(false);
  };

  return (
    <>
      <GlassCard className="relative overflow-hidden p-6">
        <View className="flex-row flex-wrap items-start justify-between gap-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Timer size={20} color="#9db4ff" />
            </View>
            <View>
              <Text allowFontScaling={false} className="font-sans-medium text-base text-white">
                Focus timer
              </Text>
              <Text allowFontScaling={false} className="text-base text-white/40">
                {state.mode === 'running'
                  ? 'Session in progress'
                  : state.mode === 'paused'
                    ? 'Session paused'
                    : 'No session running'}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open timer"
            hitSlop={8}
            onPress={() => router.push('/timer')}
            className="min-h-[48px] flex-row items-center gap-1 px-6 py-3">
            <Text allowFontScaling={false} className="text-base text-white/45">
              Open timer
            </Text>
            <ArrowUpRight size={14} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </View>

        <View className="mt-6 items-center">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            Total Focus Time
          </Text>
          <Text
            allowFontScaling={false}
            className="mt-2.5 font-mono text-4xl tracking-tight tabular-nums text-white"
            style={{ textShadowColor: 'rgba(207,158,255,0.5)', textShadowRadius: 18 }}>
            {formatHMS(globalTotal)}
          </Text>
          <View className="mt-2.5 flex-row items-center gap-1">
            <Text allowFontScaling={false} className="text-base text-white/50">
              Focusing on:
            </Text>
            <Text allowFontScaling={false} className="text-base text-white/80" numberOfLines={1}>
              {activeCourse ? activeCourse.title : 'No course selected'}
            </Text>
          </View>

          <View className="mt-5 w-full max-w-sm self-center">
            <ProgressBar
              percent={progress * 100}
              colors={['#9db4ff', '#cf9eff', '#cf9eff']}
              height={6}
              trackColor="rgba(255,255,255,0.07)"
            />
            <View className="mt-2 flex-row items-center justify-center gap-2">
              <View className="rounded-full border border-star/30 bg-star/[0.06] px-4 py-2">
                <Text allowFontScaling={false} className="text-base text-star">
                  {state.targetMin} min target
                </Text>
              </View>
              <View className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
                <Text allowFontScaling={false} className="text-base text-white/40">
                  {active ? `${Math.round(progress * 100)}%` : 'Idle'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-6 flex-row flex-wrap items-center justify-center gap-2">
          {active ? (
            <>
              <PrimaryButton
                label={state.mode === 'running' ? 'Pause' : 'Resume'}
                onPress={timer.toggle}
                compact
                className="flex-1"
                icon={
                  state.mode === 'running' ? (
                    <Pause size={16} color="#030305" />
                  ) : (
                    <Play size={16} color="#030305" />
                  )
                }
              />
              <PrimaryButton
                label="Stop"
                variant="ghost"
                onPress={() => timer.stop()}
                compact
                className="flex-1"
                icon={<Square size={14} color="white" />}
              />
            </>
          ) : (
            <PrimaryButton
              label="Quick start"
              onPress={openQuick}
              className="flex-1"
              icon={<Play size={16} color="#030305" />}
            />
          )}
        </View>

        {flash ? (
          <View className="mt-4 flex-row items-center justify-center gap-2">
            <Check size={14} color="#cf9eff" />
            <Text allowFontScaling={false} className="text-base text-[#cf9eff]/90">
              {flash}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <Modal visible={quickOpen} transparent animationType="fade" onRequestClose={() => setQuickOpen(false)}>
        <View className="flex-1 items-center justify-center p-4">
          <Pressable
            accessibilityLabel="Close quick start"
            onPress={() => setQuickOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />
          <View className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-ink p-6 shadow-card">
            <View className="flex-row items-start justify-between gap-4">
              <View>
                <Text
                  allowFontScaling={false}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
                  Quick start
                </Text>
                <Text allowFontScaling={false} className="mt-1.5 font-sans-semibold text-lg text-white">
                  Pick a session length
                </Text>
              </View>
              <Pressable
                onPress={() => setQuickOpen(false)}
                accessibilityLabel="Close"
                hitSlop={8}
                className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <X size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            <View className="mt-5 flex-row gap-2">
              {PRESETS.map((min) => {
                const selected = preset === min;
                return (
                  <Pressable
                    key={min}
                    onPress={() => setPreset(min)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-[48px] flex-1 items-center rounded-2xl border px-5 py-4 ${
                      selected
                        ? 'border-star/50 bg-star/10'
                        : 'border-white/10 bg-white/[0.03]'
                    }`}>
                    <Text
                      allowFontScaling={false}
                      className={`font-mono text-2xl tabular-nums ${selected ? 'text-star' : 'text-white/50'}`}>
                      {min}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      className={`mt-0.5 text-xs uppercase tracking-[0.2em] ${selected ? 'text-star' : 'text-white/50'}`}>
                      min
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-5 flex-row gap-2">
              <PrimaryButton
                label="Start session"
                onPress={startQuick}
                compact
                className="flex-1"
                icon={<Play size={16} color="#030305" />}
              />
              <PrimaryButton label="Cancel" variant="ghost" onPress={() => setQuickOpen(false)} compact />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
