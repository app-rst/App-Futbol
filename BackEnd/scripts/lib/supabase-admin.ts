import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Env } from './env.ts';

const NO_SESSION = { auth: { autoRefreshToken: false, persistSession: false } } as const;

/** Cliente con la secret key: saltea RLS. Solo para scripts de administración. */
export function adminClient(env: Env): SupabaseClient {
  return createClient(env.url, env.secretKey, NO_SESSION);
}

/** Recorre todos los usuarios de Auth (paginado). */
export async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

export async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = email.toLowerCase();
  return (await listAllUsers(admin)).find((u) => u.email?.toLowerCase() === target) ?? null;
}
