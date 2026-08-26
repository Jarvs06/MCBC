import {
  Stack,
  usePathname,
  useRouter,
} from 'expo-router';

import {
  useEffect,
} from 'react';

import {
  AuthProvider,
  useAuth,
} from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const {
    session,
    loading,
    profile,
  } = useAuth();

  const pathname =
    usePathname();

  const router =
    useRouter();

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
      pathname,
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
   * PREVENT ACTIVE USERS FROM /invite
   * ========================================
   *
   * IMPORTANT:
   *
   * This useEffect MUST be placed BEFORE
   * the "if (loading) return null" block.
   *
   * React hooks must always be called in
   * the same order on every render.
   */

  useEffect(() => {
    /*
     * Wait until authentication has finished
     * initializing.
     */

    if (loading) {
      return;
    }

    /*
     * If an already-active administrator
     * somehow reaches /invite, send them
     * to the dashboard.
     */

    if (
      isActive &&
      pathname === '/invite'
    ) {
      console.log(
        '[ROOT NAV] Active account is on /invite. Redirecting to /dashboard.'
      );

      router.replace(
        '/dashboard'
      );
    }
  }, [
    loading,
    isActive,
    pathname,
    router,
  ]);

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
      </Stack.Protected>

      {/* ======================================
          INVITATION ROUTE
      ======================================

          This route is intentionally available
          for invited users.

          Invitation flow:

          Email
            ↓
          /invite
            ↓
          Create Password
            ↓
          Activate Account
            ↓
          /dashboard

          Once the account becomes Active,
          the useEffect above prevents the
          user from returning to /invite.
      ====================================== */}

      <Stack.Screen
        name="invite"
      />

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