import { router } from 'expo-router';
import { useState } from 'react';
import {
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
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validators';

export default function LoginScreen() {
  const { loading: authLoading } = useAuth();

  // ----------------------------------------
  // Form
  // ----------------------------------------

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ----------------------------------------
  // Login loading
  // ----------------------------------------

  const [loading, setLoading] = useState(false);

  // ----------------------------------------
  // Modal
  // ----------------------------------------

  const modal = useAppModal();

  // ----------------------------------------
  // Authentication initialization
  // ----------------------------------------

  /*
   * Wait for AuthContext to finish restoring the existing
   * Supabase session.
   *
   * IMPORTANT: we do NOT redirect here. The root authentication
   * layout is responsible for protecting authenticated routes.
   */
  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Checking your session...</Text>
      </View>
    );
  }

  // ----------------------------------------
  // Login
  // ----------------------------------------

  async function handleLogin() {
    if (loading) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      modal.show('Missing Information', 'Please enter your email and password.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      modal.show('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        console.error('[LOGIN] Login error:', error);
        modal.show('Login Failed', error.message);
        return;
      }

      if (!data.session || !data.user) {
        console.error('[LOGIN] No session returned.');
        modal.show(
          'Login Failed',
          'We could not establish your session. Please try again.'
        );
        return;
      }

      console.log('[LOGIN] Login successful.');

      /*
       * This is the ONLY place this login screen navigates to
       * /dashboard. It happens only after the user has explicitly
       * submitted valid credentials. AuthContext will receive
       * SIGNED_IN and load the administrator profile.
       */
      router.replace('/dashboard');
    } catch (error) {
      console.error('[LOGIN] Unexpected login error:', error);
      modal.show('Login Error', 'Something went wrong while signing in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------
  // Forgot password
  // ----------------------------------------

  function handleForgotPassword() {
    if (loading) {
      return;
    }

    modal.show('Forgot Password', 'Password recovery will be available in a later phase.');
  }

  // ----------------------------------------
  // Screen
  // ----------------------------------------

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* ================================ HEADER ================================ */}

          <Text style={styles.title}>Church Admin</Text>
          <Text style={styles.subtitle}>Sign in to manage church information</Text>

          {/* ================================ EMAIL ================================ */}

          <Text style={styles.label}>Email</Text>

          <TextInput
            style={styles.input}
            placeholder="admin@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
            returnKeyType="next"
            accessibilityLabel="Email address"
          />

          {/* ================================ PASSWORD ================================ */}

          <Text style={styles.label}>Password</Text>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password"
          />

          {/* ================================ LOGIN BUTTON ================================ */}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </Pressable>

          {/* ================================ FORGOT PASSWORD ================================ */}

          <View style={styles.forgotRow}>
            <Pressable
              disabled={loading}
              onPress={handleForgotPassword}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.link}>Forgot Password?</Text>
            </Pressable>
          </View>

          {/* ================================ ACTIVATE ACCOUNT ================================ */}

          <View style={styles.forgotRow}>
            <Pressable
              disabled={loading}
              onPress={() => router.push('/activate')}
              accessibilityRole="button"
              accessibilityLabel="Activate account"
            >
              <Text style={styles.link}>Have an activation code? Activate Account</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ================================ MODAL ================================ */}

      <AppModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        buttonText="OK"
        onClose={modal.hide}
      />
    </View>
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
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  // Header

  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 36,
  },

  // Labels

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
    marginBottom: 8,
  },

  // Inputs

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 18,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  // Login button

  button: {
    height: 52,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },

  // Forgot password

  forgotRow: {
    alignItems: 'center',
    marginTop: 24,
  },

  link: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },

  // Loading

  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});