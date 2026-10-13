import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { MeshBackground } from '@/components/ui/mesh-background';
import { hasOnboarded } from '@/lib/onboarding';

export default function IndexScreen() {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hasOnboarded()
      .then((value) => {
        if (cancelled) return;
        setSeen(value);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSeen(false);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-void">
        <MeshBackground />
        <ActivityIndicator color="#9db4ff" size="large" />
      </View>
    );
  }

  return <Redirect href={seen ? '/login' : '/onboarding'} />;
}
