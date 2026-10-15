import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, Sparkles } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { useUserId } from '@/hooks/useUserId';
import {
  SUGGESTIONS,
  ask,
  buildLearnerContext,
  classify,
  newTurnId,
  validate,
  type Turn,
} from '@/lib/assistant';
import { AI_CONFIGURED } from '@/lib/ai';
import { fetchFocusCourse } from '@/lib/db/courses';
import { fetchProfile } from '@/lib/db/profile';
import type { FocusCourse, Profile } from '@/lib/db/types';
import { toastError } from '@/lib/toast';

export default function AssistantScreen() {
  const userId = useUserId();
  const scrollRef = useRef<ScrollView>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [focus, setFocus] = useState<FocusCourse | null>(null);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void Promise.all([fetchProfile(userId), fetchFocusCourse(userId)]).then(
      ([p, f]) => {
        if (cancelled) return;
        setProfile(p);
        setFocus(f);
        setUserName(p?.display_name?.trim() || undefined);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
    });
    return () => sub.remove();
  }, []);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    const invalid = validate(message);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!AI_CONFIGURED) {
      setError('AI service is not configured. Set EXPO_PUBLIC_AI_API_URL in .env.');
      return;
    }
    setError(null);
    setFailedPrompt(null);
    setInput('');
    setBusy(true);

    const userTurn: Turn = { id: newTurnId(), role: 'user', content: message };
    const history = [...turns, userTurn];
    setTurns(history);

    try {
      const systemPrompt = buildLearnerContext({ profile, focus });
      const reply = await ask(message, turns, systemPrompt, userName);
      setTurns((prev) => [...prev, reply]);
    } catch (err) {
      const message2 = classify(err);
      setError(message2);
      setFailedPrompt(message);
      toastError('Assistant unavailable', message2);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const retry = async () => {
    const message = failedPrompt;
    if (!message || busy) return;
    setError(null);
    setFailedPrompt(null);
    setBusy(true);
    const history = turns.slice(0, -1);
    try {
      const systemPrompt = buildLearnerContext({ profile, focus });
      const reply = await ask(message, history, systemPrompt, userName);
      setTurns((prev) => [...prev, reply]);
    } catch (err) {
      const message2 = classify(err);
      setError(message2);
      setFailedPrompt(message);
      toastError('Assistant unavailable', message2);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <View className="flex-1 px-6 pb-4 pt-2">
        <View className="gap-2 pb-3 pt-2">
          <Text
            allowFontScaling={false}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
            AI
          </Text>
          <Text
            allowFontScaling={false}
            className="font-display-semibold text-[30px] leading-[36px] tracking-[-0.04em] text-white">
            Assistant
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {turns.length === 0 ? (
            <GlassCard className="gap-3 p-6">
              <View className="flex-row items-center gap-2">
                <Sparkles size={16} color="#cf9eff" />
                <Text
                  allowFontScaling={false}
                  className="font-sans-semibold text-base text-white">
                  Ask me anything
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                className="font-sans text-base leading-[24px] text-white/55">
                I know your current course, level and streak, so answers land in
                context. Try one of these:
              </Text>
              <View className="mt-1 gap-2">
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={() => void send(s.prompt)}
                    disabled={busy}
                    className="min-h-[48px] rounded-2xl border border-hairline bg-white/[0.03] px-5 py-3">
                    <Text
                      allowFontScaling={false}
                      className="font-sans-medium text-base text-white/80">
                      {s.label}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      className="mt-0.5 font-sans text-[15px] text-white/40">
                      {s.prompt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          ) : null}

          {turns.map((turn) => (
            <View
              key={turn.id}
              className={`max-w-[92%] rounded-3xl border px-4 py-3 ${
                turn.role === 'user'
                  ? 'self-end border-star/30 bg-star/[0.12]'
                  : 'self-start border-hairline bg-white/[0.03] backdrop-blur-2xl'
              }`}>
              {turn.role === 'assistant' ? (
                <Text
                  allowFontScaling={false}
                  className="mb-1 text-xs uppercase tracking-[0.2em] text-white/30">
                  ATLAS
                </Text>
              ) : null}
              <Text
                allowFontScaling={false}
                className="font-sans text-base leading-[24px] text-white/90">
                {turn.content}
              </Text>
            </View>
          ))}

          {busy ? (
            <View className="flex-row items-center gap-2 self-start rounded-3xl border border-hairline bg-white/[0.03] px-4 py-3">
              <ActivityIndicator size="small" color="#9db4ff" />
              <Text
                allowFontScaling={false}
                className="font-sans text-[15px] text-white/50">
                Thinking…
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {error ? (
          <View className="mb-2 flex-row items-center gap-3 rounded-2xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/10 px-4 py-3">
            <Text
              allowFontScaling={false}
              numberOfLines={3}
              className="min-w-0 flex-1 font-sans text-base leading-[24px] text-[#ffb3b3]">
              {error}
            </Text>
            {failedPrompt ? (
              <Pressable
                onPress={() => void retry()}
                disabled={busy}
                accessibilityRole="button"
                className={`shrink-0 rounded-full border border-[#ffb3b3]/40 px-4 py-2 ${
                  busy ? 'opacity-40' : ''
                }`}>
                <Text
                  allowFontScaling={false}
                  className="font-sans-medium text-base text-[#ffb3b3]">
                  Retry
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row items-end gap-2">
          <TextInput
            allowFontScaling={false}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            onSubmitEditing={() => void send()}
            className="max-h-[120px] min-h-[48px] flex-1 rounded-3xl border border-hairline bg-white/[0.04] px-4 py-3 font-sans text-base text-white"
            textAlignVertical="center"
          />
          <Pressable
            onPress={() => void send()}
            disabled={busy || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className={`h-12 w-12 items-center justify-center rounded-full border border-star/40 bg-star/10 ${
              busy || !input.trim() ? 'opacity-40' : ''
            }`}>
            <Send size={18} color="#9db4ff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
