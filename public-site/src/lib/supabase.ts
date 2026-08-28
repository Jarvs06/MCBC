import { createClient } from '@supabase/supabase-js';

/*
 * This site is anonymous-only — no login, no session ever exists
 * — so session persistence/refresh is deliberately off (unlike
 * the main app's client, which needs all three for the admin
 * panel).
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
