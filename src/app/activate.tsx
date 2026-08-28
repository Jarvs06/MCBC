import { router } from 'expo-router';
import { useState } from 'react';
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
import { useAppModal } from '@/hooks/useAppModal';
import { resolveEdgeFunctionError } from '@/lib/edgeFunctionError';
import { supabase } from '@/lib/supabase';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '@/lib/validators';

/*
 * ==========================================
 * ACTIVATE ACCOUNT
 * ==========================================
 *
 * Replaces the old magic-link /invite screen. A Super Admin
 * generates a short activation code (admin-users/add.tsx or
 * admin-users/index.tsx) and hands it to the new administrator
 * out-of-band — no email, no redirect URL, no deep link, so this
 * behaves identically on localhost, GitHub Pages, and the Android
 * APK.
 *
 * Two steps, kept as one screen (not two routes) so the verified
 * code/admin info never has to travel through a URL/route param:
 *
 * 1. "code"     — enter the code, verify-activation-code confirms
 *                 it and returns the account's name/email/role.
 * 2. "password" — set a new password, complete-admin-activation
 *                 marks the code used and activates the account.
 *                 The client then signs in directly with the
 *                 credentials just created.
 */

type VerifiedAdmin = {
  full_name: string;
  email: string;
  role: string;
};

export default function ActivateScreen() {
  const modal = useAppModal();

  const [step, setStep] = useState<'code' | 'password'>('code');

  // ----------------------------------------
  // Step 1: code
  // ----------------------------------------

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedAdmin, setVerifiedAdmin] = useState<VerifiedAdmin | null>(null);

  // ----------------------------------------
  // Step 2: password
  // ----------------------------------------

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activating, setActivating] = useState(false);

  // ----------------------------------------
  // Verify code
  // ----------------------------------------

  async function handleVerifyCode() {
    if (verifying) {
      return;
    }

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      modal.show('Missing Code', 'Please enter your activation code.');
      return;
    }

    try {
      setVerifying(true);

      const { data, error } = await supabase.functions.invoke('verify-activation-code', {
        body: { code: trimmedCode },
      });

      if (error) {
        console.error('[ACTIVATE] Verify code error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Invalid Code');
        modal.show(title, message);
        return;
      }

      if (!data?.success || !data?.admin) {
        modal.show('Invalid Code', data?.error ?? 'That activation code is not valid.');
        return;
      }

      setVerifiedAdmin(data.admin);
      setStep('password');
    } catch (error) {
      console.error('[ACTIVATE] Unexpected verify error:', error);
      modal.show('Verification Error', 'Something went wrong while checking your code. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  // ----------------------------------------
  // Complete activation
  // ----------------------------------------

  async function handleActivate() {
    if (activating) {
      return;
    }

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

    if (!verifiedAdmin) {
      modal.show('Something Went Wrong', 'Please verify your activation code again.');
      setStep('code');
      return;
    }

    try {
      setActivating(true);

      const { data, error } = await supabase.functions.invoke('complete-admin-activation', {
        body: { code: code.trim(), password },
      });

      if (error) {
        console.error('[ACTIVATE] Complete activation error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Activation Failed');
        modal.show(title, message);
        return;
      }

      if (!data?.success) {
        modal.show('Activation Failed', data?.error ?? 'Unable to activate your account.');
        return;
      }

      /*
       * The server never issues session tokens for this flow —
       * sign in directly with the credentials just created,
       * exactly like the regular login screen does.
       */
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: verifiedAdmin.email,
        password,
      });

      if (signInError || !signInData.session) {
        console.error('[ACTIVATE] Post-activation sign-in error:', signInError);

        modal.show(
          'Account Activated',
          'Your account is ready, but we could not sign you in automatically. Please sign in with your new password.'
        );

        router.replace('/login');
        return;
      }

      router.replace('/dashboard');
    } catch (error) {
      console.error('[ACTIVATE] Unexpected activation error:', error);
      modal.show('Activation Error', 'Something went wrong while activating your account. Please try again.');
    } finally {
      setActivating(false);
    }
  }

  // ----------------------------------------
  // Screen
  // ----------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {step === 'code' ? (
          <>
            {/* ================================ HEADER ================================ */}

            <View style={styles.header}>
              <Text style={styles.title}>Activate Account</Text>
              <Text style={styles.subtitle}>
                Enter the activation code your Super Admin gave you.
              </Text>
            </View>

            {/* ================================ CARD ================================ */}

            <View style={styles.card}>
              <Text style={styles.label}>Activation Code</Text>

              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!verifying}
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
                accessibilityLabel="Activation code"
              />

              <Pressable
                style={[styles.button, verifying && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={verifying}
                accessibilityRole="button"
                accessibilityLabel="Verify activation code"
                accessibilityState={{ disabled: verifying, busy: verifying }}
              >
                {verifying ? (
                  <>
                    <ActivityIndicator color={colors.surface} size="small" />
                    <Text style={styles.buttonText}>Verifying...</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Verify Activation Code</Text>
                )}
              </Pressable>
            </View>

            {/* ================================ BACK TO LOGIN ================================ */}

            <View style={styles.backRow}>
              <Pressable
                disabled={verifying}
                onPress={() => router.replace('/login')}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
              >
                <Text style={styles.link}>Back to Login</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* ================================ HEADER ================================ */}

            <View style={styles.header}>
              <Text style={styles.title}>Create Password</Text>
              <Text style={styles.subtitle}>
                Set your own password to finish activating your account.
              </Text>
            </View>

            {/* ================================ CARD ================================ */}

            <View style={styles.card}>
              <Text style={styles.label}>Full Name</Text>

              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={verifiedAdmin?.full_name ?? ''}
                editable={false}
                accessibilityLabel="Full name"
              />

              <Text style={styles.label}>Email Address</Text>

              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={verifiedAdmin?.email ?? ''}
                editable={false}
                autoCapitalize="none"
                accessibilityLabel="Email address"
              />

              <Text style={styles.label}>Role</Text>

              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={verifiedAdmin?.role ?? ''}
                editable={false}
                accessibilityLabel="Role"
              />

              <Text style={styles.label}>New Password</Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!activating}
                accessibilityLabel="New password"
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
                editable={!activating}
                returnKeyType="done"
                onSubmitEditing={handleActivate}
                accessibilityLabel="Confirm password"
              />

              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Password Requirements</Text>
                <Text style={styles.noticeText}>• At least {MIN_PASSWORD_LENGTH} characters</Text>
                <Text style={styles.noticeText}>• Keep your password private</Text>
                <Text style={styles.noticeText}>• Your Super Admin will never see it</Text>
              </View>

              <Pressable
                style={[styles.button, activating && styles.buttonDisabled]}
                onPress={handleActivate}
                disabled={activating}
                accessibilityRole="button"
                accessibilityLabel="Activate account"
                accessibilityState={{ disabled: activating, busy: activating }}
              >
                {activating ? (
                  <>
                    <ActivityIndicator color={colors.surface} size="small" />
                    <Text style={styles.buttonText}>Activating...</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Activate Account</Text>
                )}
              </Pressable>
            </View>

            {/* ================================ BACK ================================ */}

            <View style={styles.backRow}>
              <Pressable
                disabled={activating}
                onPress={() => setStep('code')}
                accessibilityRole="button"
                accessibilityLabel="Back to activation code"
              >
                <Text style={styles.link}>Use a Different Code</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* ================================ MODAL ================================ */}

      <AppModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        buttonText="OK"
        onClose={modal.hide}
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
    paddingHorizontal: 28,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 8,
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

  codeInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
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

  backRow: {
    alignItems: 'center',
    marginTop: 24,
  },

  link: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
