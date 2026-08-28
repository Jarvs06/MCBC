import {
  Stack,
} from 'expo-router';

import { StatusBar } from 'expo-status-bar';

import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
  AuthProvider,
  useAuth,
} from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />

      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const {
    session,
    loading,
    profile,
  } = useAuth();

  /*
   * ========================================
   * ACTIVE ACCOUNT
   * ========================================
   *
   * A user is fully authenticated when:
   *
   * 1. Supabase session exists
   * 2. Admin profile exists
   * 3. Profile status is Active
   */

  const isActive =
    !!session &&
    !!profile &&
    profile.status ===
      'Active';

  /*
   * ========================================
   * DEBUG ROUTING
   * ========================================
   */

  console.log(
    '[ROOT NAV]',
    {
      hasSession:
        !!session,
      profileStatus:
        profile?.status ??
        null,
      profileEmail:
        session?.user?.email ??
        null,
      isActive,
    }
  );

  /*
   * ========================================
   * INITIAL AUTH LOADING
   * ========================================
   */

  if (loading) {
    return null;
  }

  /*
   * ========================================
   * ROOT STACK
   * ========================================
   */

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* ======================================
          PUBLIC / NORMAL AUTH ROUTES
      ======================================

          "activate" (Activate Account) lives here alongside
          index/login rather than as its own always-visible
          screen: unlike the old magic-link /invite flow, this
          screen never has a Supabase session mid-flow (there is
          no session at all until supabase.auth.signInWithPassword
          succeeds at the very end), so there's no "authenticated
          but not yet Active" state to special-case — the same
          !isActive guard that hides /login from an active admin
          already hides /activate too.
      ====================================== */}

      <Stack.Protected
        guard={!isActive}
      >
        <Stack.Screen
          name="index"
        />

        <Stack.Screen
          name="login"
        />

        <Stack.Screen
          name="activate"
        />
      </Stack.Protected>

      {/* ======================================
          ACTIVE APPLICATION
      ====================================== */}

      <Stack.Protected
        guard={isActive}
      >
        <Stack.Screen
          name="(app)"
        />
      </Stack.Protected>
    </Stack>
  );
}
