import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DashboardLayout } from '@/components/DashboardLayout';
import { KeepAliveHost } from '@/components/KeepAliveHost';
import { MeshBackground } from '@/components/ui/mesh-background';
import { SessionCompleteCard } from '@/components/ui/session-complete-card';
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { getCurrentUserId } from '@/lib/auth';

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getCurrentUserId()
      .then((id) => {
        if (cancelled) return;
        setAuthed(Boolean(id));
        setReady(true);
        if (!id) router.replace('/login');
      })
      .catch(() => {
        if (cancelled) return;
        setAuthed(false);
        setReady(true);
        router.replace('/login');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !authed) {
    return (
      <View className="flex-1 items-center justify-center bg-void">
        <MeshBackground />
        <ActivityIndicator color="#9db4ff" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function SessionCompleteLayer() {
  const { sessionComplete, dismissSessionComplete } = useTimer();
  if (!sessionComplete) return null;
  return (
    <SessionCompleteCard
      key={sessionComplete.id}
      minutes={sessionComplete.minutes}
      message={sessionComplete.message}
      onDismiss={dismissSessionComplete}
    />
  );
}

export default function AppLayout() {
  return (
    <TimerProvider>
      <AuthGate>
        <View className="flex-1 bg-void">
          <DashboardLayout>
            <KeepAliveHost />
          </DashboardLayout>
          <SessionCompleteLayer />
        </View>
      </AuthGate>
    </TimerProvider>
  );
}
