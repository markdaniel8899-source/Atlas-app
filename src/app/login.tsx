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
import { ArrowRight, Lock, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/ui/glass-card';
import { MeshBackground } from '@/components/ui/mesh-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { doubleCurtainNavigate } from '@/components/DoubleCurtain';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'signin' | 'signup';

const MODES: { key: Mode; label: string }[] = [
  { key: 'signin', label: 'Log in' },
  { key: 'signup', label: 'Sign up' },
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
            <View className="w-full px-6 py-10">
              <GlassCard className="w-full max-w-md self-center p-8">
                <View className="items-center">
                  <Text
                    allowFontScaling={false}
                    className="text-xs font-medium uppercase tracking-[0.45em] text-[#9db4ff]/70">
                    ATLAS
                  </Text>
                  <Text
                    allowFontScaling={false}
                    className="mt-3 text-center font-display-semibold text-[30px] leading-[36px] tracking-[-0.04em] text-white">
                    {mode === 'signin' ? 'Welcome back.' : 'Claim your map.'}
                  </Text>
                  <Text allowFontScaling={false} className="mt-2 text-center text-[15px] text-white/45">
                    {mode === 'signin'
                      ? 'Pick up where the streak left off.'
                      : 'Set up your learning OS in under a minute.'}
                  </Text>
                </View>

                <View className="mt-8 flex-row rounded-full border border-white/10 bg-white/[0.03] p-1">
                  {MODES.map((item) => {
                    const active = item.key === mode;
                    return (
                      <Pressable
                        key={item.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => switchMode(item.key)}
                        className={`min-h-[48px] flex-1 items-center justify-center rounded-full px-4 py-2.5 ${
                          active ? 'border border-white/10 bg-white/[0.07]' : 'bg-transparent'
                        }`}>
                        <Text
                          allowFontScaling={false}
                          className={`font-sans text-base ${
                            active ? 'text-white' : 'text-white/45'
                          }`}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!isSupabaseConfigured ? (
                  <View className="mt-6 rounded-xl border border-[#cf9eff]/30 bg-[#cf9eff]/[0.08] px-4 py-3">
                    <Text
                      allowFontScaling={false}
                      className="text-xs leading-relaxed text-[#e9dcff]">
                      Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to
                      enable sign-in.
                    </Text>
                  </View>
                ) : null}

                {notice ? (
                  <View className="mt-6 rounded-xl border border-[#cf9eff]/30 bg-[#cf9eff]/[0.08] px-4 py-3">
                    <Text
                      allowFontScaling={false}
                      className="text-xs leading-relaxed text-[#e9dcff]">
                      {notice}
                    </Text>
                  </View>
                ) : null}

                {error ? (
                  <View className="mt-6 rounded-xl border border-red-400/30 bg-red-400/[0.07] px-4 py-3">
                    <Text allowFontScaling={false} className="text-xs leading-relaxed text-red-200">
                      {error}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-7 gap-4">
                  {mode === 'signup' ? (
                    <TextField
                      label="Name"
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      returnKeyType="next"
                      value={name}
                      onChangeText={setName}
                    />
                  ) : null}

                  <TextField
                    label="Email"
                    placeholder="you@domain.com"
                    icon={<Mail size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.75} />}
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
                    icon={<Lock size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.75} />}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                    returnKeyType="done"
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={() => void submit()}
                  />

                  <PrimaryButton
                    label={mode === 'signin' ? 'Enter the dashboard' : 'Create account'}
                    loading={loading}
                    onPress={() => void submit()}
                    icon={<ArrowRight size={16} color="#030305" />}
                  />

                  {mode === 'signin' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Forgot password"
                      hitSlop={8}
                      className="min-h-[48px] items-center justify-center px-6 py-2"
                      onPress={() => void handleForgotPassword()}>
                      <Text
                        allowFontScaling={false}
                        className="text-center font-sans text-sm text-star">
                        Forgot password?
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </GlassCard>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mode === 'signin' ? 'Create an account' : 'Log in'}
                onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="mt-6 min-h-[44px] items-center justify-center py-2">
                <Text allowFontScaling={false} className="text-sm text-white/45">
                  {mode === 'signin' ? 'New here? ' : 'Already climbing? '}
                  <Text className="text-star">
                    {mode === 'signin' ? 'Create an account' : 'Log in'}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
