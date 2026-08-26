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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const {
    loading: authLoading,
  } = useAuth();

  // ----------------------------------------
  // Form
  // ----------------------------------------

  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');

  // ----------------------------------------
  // Login loading
  // ----------------------------------------

  const [loading, setLoading] =
    useState(false);

  // ----------------------------------------
  // Modal
  // ----------------------------------------

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState('');

  const [modalMessage, setModalMessage] =
    useState('');

  // ----------------------------------------
  // Modal helper
  // ----------------------------------------

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  // ----------------------------------------
  // Authentication initialization
  // ----------------------------------------

  /*
   * Wait for AuthContext to finish restoring
   * the existing Supabase session.
   *
   * IMPORTANT:
   *
   * We do NOT redirect here.
   *
   * The root authentication layout is now
   * responsible for protecting authenticated
   * routes.
   */

  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>
          Checking your session...
        </Text>
      </View>
    );
  }

  // ----------------------------------------
  // Login
  // ----------------------------------------

  async function handleLogin() {
    // Prevent duplicate submissions.
    if (loading) {
      return;
    }

    const trimmedEmail =
      email.trim().toLowerCase();

    // --------------------------------------
    // Validate email/password
    // --------------------------------------

    if (
      !trimmedEmail ||
      !password
    ) {
      showModal(
        'Missing Information',
        'Please enter your email and password.'
      );

      return;
    }

    // --------------------------------------
    // Basic email validation
    // --------------------------------------

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      showModal(
        'Invalid Email',
        'Please enter a valid email address.'
      );

      return;
    }

    try {
      setLoading(true);

      console.log(
        '[LOGIN] Attempting login:',
        trimmedEmail
      );

      // --------------------------------------
      // Supabase login
      // --------------------------------------

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      // --------------------------------------
      // Supabase error
      // --------------------------------------

      if (error) {
        console.error(
          '[LOGIN] Login error:',
          error
        );

        showModal(
          'Login Failed',
          error.message
        );

        return;
      }

      // --------------------------------------
      // Verify session
      // --------------------------------------

      if (
        !data.session ||
        !data.user
      ) {
        console.error(
          '[LOGIN] No session returned.'
        );

        showModal(
          'Login Failed',
          'We could not establish your session. Please try again.'
        );

        return;
      }

      console.log(
        '[LOGIN] Login successful:',
        data.user.email
      );

      // --------------------------------------
      // Navigate to dashboard
      // --------------------------------------
      //
      // This is the ONLY place this login
      // screen navigates to /dashboard.
      //
      // It happens only after the user has
      // explicitly submitted valid credentials.
      //
      // AuthContext will receive SIGNED_IN
      // and load the administrator profile.
      //

      router.replace('/dashboard');

    } catch (error) {
      console.error(
        '[LOGIN] Unexpected login error:',
        error
      );

      showModal(
        'Login Error',
        'Something went wrong while signing in. Please try again.'
      );
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

    showModal(
      'Forgot Password',
      'Password recovery will be available in a later phase.'
    );
  }

  // ----------------------------------------
  // Screen
  // ----------------------------------------

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.content}>

          {/* ==================================
              HEADER
          ================================== */}

          <Text style={styles.title}>
            Church Admin
          </Text>

          <Text style={styles.subtitle}>
            Sign in to manage church information
          </Text>

          {/* ==================================
              EMAIL
          ================================== */}

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            placeholder="admin@example.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
            returnKeyType="next"
          />

          {/* ==================================
              PASSWORD
          ================================== */}

          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* ==================================
              LOGIN BUTTON
          ================================== */}

          <Pressable
            style={[
              styles.button,
              loading &&
                styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? 'Signing in...'
                : 'Sign In'}
            </Text>
          </Pressable>

          {/* ==================================
              FORGOT PASSWORD
          ================================== */}

          <View style={styles.forgotRow}>
            <Pressable
              disabled={loading}
              onPress={
                handleForgotPassword
              }
            >
              <Text style={styles.link}>
                Forgot Password?
              </Text>
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* ======================================
          MODAL
      ====================================== */}

      <AppModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttonText="OK"
        onClose={() =>
          setModalVisible(false)
        }
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
    backgroundColor: '#ffffff',
  },

  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  // ----------------------------------------
  // Header
  // ----------------------------------------

  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 36,
  },

  // ----------------------------------------
  // Labels
  // ----------------------------------------

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  // ----------------------------------------
  // Inputs
  // ----------------------------------------

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 18,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // ----------------------------------------
  // Login button
  // ----------------------------------------

  button: {
    height: 52,
    backgroundColor: '#111827',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ----------------------------------------
  // Forgot password
  // ----------------------------------------

  forgotRow: {
    alignItems: 'center',
    marginTop: 24,
  },

  link: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },

  // ----------------------------------------
  // Loading
  // ----------------------------------------

  loadingScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },
});