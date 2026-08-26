import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import type {
  Session,
} from '@supabase/supabase-js';

import {
  supabase,
} from '@/lib/supabase';

/*
 * ==========================================
 * ADMIN TYPES
 * ==========================================
 */

export type AdminRole =
  | 'Super Admin'
  | 'Viewer';

export type AdminStatus =
  | 'Pending'
  | 'Active'
  | 'Disabled';

export type AdminProfile = {
  id: string;

  full_name: string;

  role: AdminRole;

  status: AdminStatus;

  approved: boolean;

  created_at: string;

  updated_at: string;
};

/*
 * ==========================================
 * AUTH CONTEXT
 * ==========================================
 */

type AuthContextType = {
  session: Session | null;

  profile: AdminProfile | null;

  loading: boolean;

  isSuperAdmin: boolean;

  isViewer: boolean;

  isActive: boolean;

  refreshProfile: () => Promise<AdminProfile | null>;

  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<
    AuthContextType | undefined
  >(undefined);

/*
 * ==========================================
 * PROVIDER
 * ==========================================
 */

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(null);

  const [
    profile,
    setProfile,
  ] =
    useState<AdminProfile | null>(null);

  /*
   * ========================================
   * INITIAL LOADING
   * ========================================
   */

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  /*
   * ========================================
   * LOAD PROFILE
   * ========================================
   */

  async function loadProfile(
    userId: string
  ): Promise<AdminProfile | null> {
    const {
      data,
      error,
    } =
      await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
      console.error(
        '[AUTH] Failed to load admin profile:',
        error
      );

      /*
       * Do not clear the existing profile
       * because of a temporary database,
       * network, or RLS error.
       */

      return null;
    }

    const adminProfile =
      data as AdminProfile;

    setProfile(
      adminProfile
    );

    return adminProfile;
  }

  /*
   * ========================================
   * REFRESH PROFILE
   * ========================================
   *
   * Used after important profile changes,
   * such as invitation activation.
   *
   * This makes sure the in-memory AuthContext
   * reflects the latest database state.
   */

  async function refreshProfile(): Promise<AdminProfile | null> {
    if (!session?.user) {
      return null;
    }

    console.log(
      '[AUTH] Refreshing admin profile...'
    );

    const updatedProfile =
      await loadProfile(
        session.user.id
      );

    if (updatedProfile) {
      console.log(
        '[AUTH] Profile refreshed:',
        {
          status:
            updatedProfile.status,
          approved:
            updatedProfile.approved,
          role:
            updatedProfile.role,
        }
      );
    }

    return updatedProfile;
  }

  /*
   * ========================================
   * INITIAL AUTHENTICATION
   * ========================================
   */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        console.log(
          '[AUTH] Initial session:',
          session?.user?.email ??
            'No session'
        );

        /*
         * Store session.
         */

        setSession(
          session
        );

        /*
         * Load profile.
         */

        if (
          session?.user
        ) {
          await loadProfile(
            session.user.id
          );
        }
      } catch (error) {
        console.error(
          '[AUTH] Initialization error:',
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    /*
     * ======================================
     * AUTH STATE LISTENER
     * ======================================
     */

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          nextSession
        ) => {
          if (!mounted) {
            return;
          }

          console.log(
            '[AUTH EVENT]',
            event,
            nextSession?.user?.email ??
              'No session'
          );

          /*
           * ==================================
           * SIGNED OUT
           * ==================================
           */

          if (
            event ===
            'SIGNED_OUT'
          ) {
            console.log(
              '[AUTH] User actually signed out'
            );

            setSession(null);

            setProfile(null);

            setLoading(false);

            return;
          }

          /*
           * ==================================
           * SIGNED IN
           * ==================================
           */

          if (
            event ===
              'SIGNED_IN' &&
            nextSession?.user
          ) {
            setSession(
              nextSession
            );

            /*
             * Load profile without changing
             * loading state.
             */

            setTimeout(
              async () => {
                if (!mounted) {
                  return;
                }

                await loadProfile(
                  nextSession.user.id
                );
              },
              0
            );

            return;
          }

          /*
           * ==================================
           * TOKEN REFRESHED
           * ==================================
           */

          if (
            event ===
            'TOKEN_REFRESHED'
          ) {
            if (
              nextSession
            ) {
              setSession(
                nextSession
              );
            }

            return;
          }

          /*
           * ==================================
           * USER UPDATED
           * ==================================
           */

          if (
            event ===
            'USER_UPDATED'
          ) {
            if (
              nextSession
            ) {
              setSession(
                nextSession
              );
            }

            return;
          }

          /*
           * ==================================
           * INITIAL SESSION
           * ==================================
           */

          if (
            event ===
            'INITIAL_SESSION'
          ) {
            if (
              nextSession
            ) {
              setSession(
                nextSession
              );
            }

            return;
          }

          /*
           * ==================================
           * FALLBACK
           * ==================================
           */

          if (
            nextSession
          ) {
            setSession(
              nextSession
            );
          }
        }
      );

    /*
     * ======================================
     * CLEANUP
     * ======================================
     */

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  /*
   * ==========================================
   * SIGN OUT
   * ==========================================
   */

  async function signOut() {
    console.log(
      '[AUTH] signOut() called'
    );

    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        '[AUTH] signOut failed:',
        error
      );

      return;
    }

    console.log(
      '[AUTH] signOut successful'
    );

    setSession(null);

    setProfile(null);

    setLoading(false);
  }

  /*
   * ==========================================
   * PERMISSIONS
   * ==========================================
   */

  const isActive =
    profile?.status ===
    'Active';

  const isSuperAdmin =
    profile?.role ===
      'Super Admin' &&
    isActive;

  const isViewer =
    profile?.role ===
      'Viewer' &&
    isActive;

  /*
   * ==========================================
   * PROVIDER
   * ==========================================
   */

  return (
    <AuthContext.Provider
      value={{
        session,

        profile,

        loading,

        isSuperAdmin,

        isViewer,

        isActive,

        refreshProfile,

        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/*
 * ==========================================
 * HOOK
 * ==========================================
 */

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}