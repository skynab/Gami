import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';

export type Role = 'learner' | 'creator' | 'admin';
export type RequestStatus = 'pending' | 'approved' | 'declined';

interface AuthState {
  /**
   * off: this site has no Supabase project configured, so there are no accounts.
   * loading: checking for a saved session.
   */
  status: 'off' | 'loading' | 'signed-out' | 'signed-in';
  email: string | null;
  userId: string | null;
  name: string;
  role: Role | null;
  /** Their request to become a creator, if they've made one. */
  request: RequestStatus | null;

  start(): void;
  /** Emails a sign-in link. Resolves to an error message, or null when sent. */
  sendLink(email: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Asks an admin for the creator role. Resolves to an error message, or null when sent. */
  askToCreate(message: string): Promise<string | null>;
  refresh(): Promise<void>;
}

/** Whether this build was given a Supabase project. Without one, learning works and accounts are hidden. */
export const accountsEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

let client: Promise<SupabaseClient> | null = null;
/** The Supabase client, downloaded on first use. */
export function supabase(): Promise<SupabaseClient> {
  client ??= import('./client').then((m) => m.client);
  return client;
}

const signedOut = { status: 'signed-out', email: null, userId: null, name: '', role: null, request: null } as const;

export const useAuth = create<AuthState>()((set, get) => ({
  status: accountsEnabled ? 'loading' : 'off',
  email: null,
  userId: null,
  name: '',
  role: null,
  request: null,

  start() {
    if (!accountsEnabled) return;
    void supabase().then(async (sb) => {
      sb.auth.onAuthStateChange((_event, session) => {
        if (!session) set(signedOut);
        else if (session.user.id !== get().userId) {
          set({ status: 'signed-in', email: session.user.email ?? null, userId: session.user.id });
          void get().refresh();
        }
      });
      const { data } = await sb.auth.getSession();
      if (!data.session) set(signedOut);
    });
  },

  async sendLink(email) {
    const sb = await supabase();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
    return error ? error.message : null;
  },

  async signOut() {
    const sb = await supabase();
    await sb.auth.signOut();
    set(signedOut);
  },

  async askToCreate(message) {
    const { userId } = get();
    if (!userId) return 'Sign in first.';
    const sb = await supabase();
    const { error } = await sb.from('creator_requests').insert({ user_id: userId, message });
    if (error) return error.code === '23505' ? 'You’ve already asked. An admin will get back to you.' : error.message;
    set({ request: 'pending' });
    return null;
  },

  async refresh() {
    const { userId } = get();
    if (!userId) return;
    const sb = await supabase();
    const [profile, request] = await Promise.all([
      sb.from('profiles').select('display_name, role').eq('id', userId).maybeSingle(),
      sb.from('creator_requests').select('status').eq('user_id', userId).maybeSingle(),
    ]);
    set({
      name: profile.data?.display_name ?? '',
      role: (profile.data?.role as Role | undefined) ?? 'learner',
      request: (request.data?.status as RequestStatus | undefined) ?? null,
    });
  },
}));
