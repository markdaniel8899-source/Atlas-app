import { supabase } from '@/lib/supabase';

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const metadata = user.user_metadata as { name?: string } | undefined;
  return {
    id: user.id,
    name: metadata?.name || user.email?.split('@')[0] || '',
    email: user.email ?? '',
  };
}
