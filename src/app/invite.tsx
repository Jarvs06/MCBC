import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppModal from '@/components/AppModal';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppModal } from '@/hooks/useAppModal';
import { resolveEdgeFunctionError } from '@/lib/edgeFunctionError';
import { supabase } from '@/lib/supabase';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '@/lib/validators';

export default function InviteScreen() {
  /*
   * ========================================
   * AUTH CONTEXT
   * ========================================
   */
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();

  /*
   * ========================================
   * ALL HOOKS DECLARED UNCONDITIONALLY
   * ========================================
   *
   * IMPORTANT: every hook below must run on every render of this
   * component. The previous version placed `useEffect` after two
   * conditional `return` statements (authLoading / !session), so
   * on renders where those returns fired, the effect was skipped
   * entirely — a Rules of Hooks violation (the number of hooks
   * called must never change between renders of the same mounted
   * component). All conditional rendering now happens at the
   * bottom of the function, after every hook has run.
   */

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const modal = useAppModal();

  /*
   * ========================================
   * HAND OFF TO THE NATIVE APP
   * ========================================
   *
   * Supabase's activation links always point here (this web page),
   * even when they were generated for the Android/iOS app — a plain
   * https:// link is something every mail/SMS app will actually open,
   * unlike a raw "churchadmin://" redirect, which most mobile browsers
   * silently refuse to follow on their own.
   *
   * So instead, this page does the handoff itself: if it's carrying
   * fresh auth tokens in the URL hash, immediately try navigating to
   * the app's deep link with the same hash. If the app is installed,
   * the OS intercepts that navigation and opens it straight to this
   * same screen with a session already restored (see the native
   * deep-link handler in app/_layout.tsx). If it isn't, this
   * navigation is simply ignored and the user finishes here in the
   * browser instead — no error, no dead end either way.
   *
   * Read the hash on the very first render tick, before Supabase's
   * own detectSessionInUrl handling (which runs shortly after) strips
   * it from the URL.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash;

    if (!hash || !hash.includes('access_token')) {
      return;
    }

    window.location.href = `churchadmin://invite${hash}`;
  }, []);

  /*
   * ========================================
   * LOAD INVITATION
   * ========================================
   *
   * Reads directly from the `session` already provided by
   * AuthContext instead of calling supabase.auth.getSession()
   * again — that was a redundant duplicate fetch of the same data.
   */
  useEffect(() => {
    if (authLoading) {
      // Auth context is still restoring the session; wait for it.
      return;
    }

    if (!session?.user) {
      modal.show('Invalid Invitation', 'This invitation is invalid or has expired.');
      setLoading(false);
      return;
    }

    setEmail(session.user.email ?? '');
    setFullName(session.user.user_metadata?.full_name ?? '');

    console.log('[INVITE] Invitation session loaded:', {
      userId: session.user.id,
      profileStatus: profile?.status ?? null,
      profileRole: profile?.role ?? null,
    });

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  /*
   * ========================================
   * SET PASSWORD
   * ========================================
   */
  async function handleSetPassword() {
    if (!password || !confirmPassword) {
      modal.show('Missing Information', 'Please enter and confirm your password.');
      return;
    }

    if (!isValidPassword(password)) {
      modal.show(
        'Password Too Short',
        `Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (password !== confirmPassword) {
      modal.show('Passwords Do Not Match', 'Please make sure both passwords are the same.');
      return;
    }

    if (saving) {
      return;
    }

    try {
      setSaving(true);

      /*
       * 1. Update Supabase Auth password
       */
      const { data: userData, error: passwordError } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) {
        console.error('[INVITE] Password update error:', passwordError);
        modal.show('Password Setup Failed', passwordError.message);
        return;
      }

      if (!userData.user) {
        modal.show('Password Setup Failed', 'We could not verify your account.');
        return;
      }

      console.log('[INVITE] Password successfully created.');

      /*
       * 2. Activate admin profile
       */
      const { data: activationData, error: activationError } = await supabase.functions.invoke(
        'activate-admin-profile',
        { body: {} }
      );

      if (activationError) {
        console.error('[INVITE] Activate admin profile error:', activationError);

        const { title, message } = await resolveEdgeFunctionError(
          activationError,
          'Account Activation Failed'
        );

        modal.show(title, message);
        return;
      }

      console.log('[INVITE] Activation response:', activationData);

      if (!activationData?.success) {
        modal.show(
          'Account Activation Failed',
          activationData?.error ??
            'Your password was created, but your administrator profile could not be activated.'
        );
        return;
      }

      /*
       * 3. Refresh AuthContext
       *
       * The Edge Function has changed the database profile to
       * Active. AuthContext may still hold the old Pending profile,
       * so refresh it before allowing the protected dashboard route.
       */
      console.log('[INVITE] Refreshing local auth profile...');

      const refreshedProfile = await refreshProfile();

      if (!refreshedProfile || refreshedProfile.status !== 'Active') {
        console.error(
          '[INVITE] Profile refresh did not return an Active profile:',
          refreshedProfile
        );

        modal.show(
          'Account Activation Failed',
          'Your account was activated, but we could not refresh your session. Please try again.'
        );
        return;
      }

      console.log('[INVITE] Local auth profile is now Active.');

      /*
      * 4. Success
      */
      modal.show(
        'Account Ready',
        'Your administrator account has been successfully created. You can now continue to the dashboard.'
      );

      setSuccess(true);

      setSuccess(true);
    } catch (error) {
      console.error('[INVITE] Invitation setup error:', error);
      modal.show('Setup Error', 'Something went wrong while setting up your account. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================
   * MODAL CLOSE
   * ========================================
   */
  function handleModalClose() {
    modal.hide();

    /*
     * The profile has already been refreshed before this success
     * modal was shown, so RootLayout already knows
     * profile.status === "Active" and the protected dashboard
     * route is allowed.
     */
    if (success) {
      router.replace('/dashboard');
    }
  }

  /*
   * ========================================
   * CONDITIONAL RENDERING
   * ========================================
   *
   * Every hook above has already run by this point, regardless of
   * which branch below fires — safe to return conditionally here.
   */

  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>
          Your invitation session is missing or has expired.
        </Text>

        <Pressable
          style={styles.loginButton}
          onPress={() => router.replace('/login')}
          accessibilityRole="button"
          accessibilityLabel="Go to login"
        >
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading invitation...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* ================================ HEADER ================================ */}

        <View style={styles.header}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Create your administrator password to finish setting up your account.
          </Text>
        </View>

        {/* ================================ CARD ================================ */}

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={fullName}
            editable={false}
            placeholder="Full Name"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Email Address</Text>

          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
            placeholder="Email Address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Create Password</Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            accessibilityLabel="Create password"
          />

          <Text style={styles.label}>Confirm Password</Text>

          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            accessibilityLabel="Confirm password"
          />

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Password Requirements</Text>
            <Text style={styles.noticeText}>• At least {MIN_PASSWORD_LENGTH} characters</Text>
            <Text style={styles.noticeText}>• Keep your password private</Text>
            <Text style={styles.noticeText}>• You can change it later</Text>
          </View>

          <Pressable
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSetPassword}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Create password"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? (
              <>
                <ActivityIndicator color={colors.surface} size="small" />
                <Text style={styles.buttonText}>Setting up account...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Create Password</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ================================ MODAL ================================ */}

      <AppModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        buttonText="OK"
        onClose={handleModalClose}
      />
    </KeyboardAvoidingView>
  );
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: 6,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
    marginBottom: 8,
    marginTop: 16,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  disabledInput: {
    backgroundColor: colors.statusInactiveBg,
    color: colors.textSecondary,
  },

  notice: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 20,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLabel,
    marginBottom: 5,
  },

  noticeText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  button: {
    height: 52,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },

  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  loginButton: {
    marginTop: 20,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.sm,
  },

  loginButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
});