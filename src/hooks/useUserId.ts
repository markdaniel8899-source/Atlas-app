import { useEffect, useState } from 'react';

import { getCurrentUserId } from '@/lib/auth';

export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUserId().then((id) => {
      if (!cancelled) setUserId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return userId;
}
