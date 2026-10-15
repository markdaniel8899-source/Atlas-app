import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasWordmark } from '@/components/ui/atlas-wordmark';
import { GlassCard } from '@/components/ui/glass-card';
import { MeshBackground } from '@/components/ui/mesh-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { doubleCurtainNavigate } from '@/components/DoubleCurtain';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'signin' | 'signup';

const MODES: { key: Mode; label: string }[] = [
  { key: 'signin', label: 'Sign in' },
  { key: 'signup', label: 'Create account' },
];

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError(
        'Sign-in is unavailable: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart the dev server.',
      );
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Enter your name so we can greet you properly.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        doubleCurtainNavigate(() => router.replace('/dashboard'));
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (!data.session) {
          setNotice('Check your email to confirm your account, then sign in.');
          switchMode('signin');
          return;
        }
        doubleCurtainNavigate(() => router.replace('/dashboard'));
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError('Password reset needs Supabase configured in .env.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter your email address first, then tap Forgot password.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setNotice('Password reset link sent. Check your inbox.');
    } catch {
      setError('Could not send the reset link. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-void">
      <MeshBackground />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="gap-8 px-7 py-10">
              <View className="gap-3">
                <AtlasWordmark size="lg" />
                <Text
                  allowFontScaling={false}
                  className="font-sans text-base leading-[24px] text-body">
                  Sign in to pick up your terrain where you left off.
                </Text>
              </View>

              <GlassCard className="gap-5 p-6">
                <View className="flex-row rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                  {MODES.map((item) => {
                    const active = item.key === mode;
                    return (
                      <Pressable
                        key={item.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => switchMode(item.key)}
                        className={`min-h-[48px] flex-1 items-center rounded-full px-4 py-3 ${
                          active ? 'bg-white/[0.08]' : 'bg-transparent'
                        }`}>
                        <Text
                          allowFontScaling={false}
                          className={`font-sans-medium text-base ${
                            active ? 'text-white' : 'text-white/45'
                          }`}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!isSupabaseConfigured ? (
                  <View className="rounded-2xl border border-lilac/30 bg-lilac/10 px-4 py-3">
                    <Text
                      allowFontScaling={false}
                      className="font-sans text-base leading-[24px] text-lilac">
                      Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to
                      enable sign-in.
                    </Text>
                  </View>
                ) : null}

                {mode === 'signup' ? (
                  <TextField
                    label="Name"
                    placeholder="Alex Rivera"
                    autoComplete="name"
                    returnKeyType="next"
                    value={name}
                    onChangeText={setName}
                  />
                ) : null}

                <TextField
                  label="Email"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                />

                <TextField
                  label="Password"
                  placeholder="••••••••"
                  secure
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void submit()}
                />

                {error ? (
                  <View className="rounded-2xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/10 px-4 py-3">
                    <Text
                      allowFontScaling={false}
                      className="font-sans text-base leading-[24px] text-[#ffb3b3]">
                      {error}
                    </Text>
                  </View>
                ) : null}

                {notice ? (
                  <View className="rounded-2xl border border-star/30 bg-star/10 px-4 py-3">
                    <Text
                      allowFontScaling={false}
                      className="font-sans text-base leading-[24px] text-star">
                      {notice}
                    </Text>
                  </View>
                ) : null}

                <PrimaryButton
                  label={mode === 'signin' ? 'Sign in' : 'Create account'}
                  loading={loading}
                  onPress={() => void submit()}
                />

                {mode === 'signin' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Forgot password"
                    hitSlop={8}
                    className="min-h-[48px] items-center justify-center rounded-2xl px-6 py-3"
                    onPress={() => void handleForgotPassword()}>
                    <Text
                      allowFontScaling={false}
                      className="text-center font-sans-medium text-base text-star">
                      Forgot password?
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>

              <Text
                allowFontScaling={false}
                className="text-center font-sans text-[15px] text-white/35">
                Sessions are RLS-scoped to your account.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
