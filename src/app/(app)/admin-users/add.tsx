import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
import { isValidEmail } from '@/lib/validators';

const roles = [
  {
    value: 'Viewer' as const,
    title: 'Viewer',
    description: 'Can view the system but cannot add, edit or delete.',
  },
  {
    value: 'Super Admin' as const,
    title: 'Super Admin',
    description: 'Full access to manage the entire system.',
  },
];

type Role = (typeof roles)[number]['value'];

function formatExpiresAt(value: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AddAdminUserScreen() {
  const { isSuperAdmin } = useAuth();

  // ----------------------------------------
  // Form
  // ----------------------------------------

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Viewer');

  // ----------------------------------------
  // Loading
  // ----------------------------------------

  const [loading, setLoading] = useState(false);

  // ----------------------------------------
  // Modal
  // ----------------------------------------

  const modal = useAppModal();

  // ----------------------------------------
  // Activation code
  // ----------------------------------------

  const [activationCode, setActivationCode] = useState('');
  const [activationExpiresAt, setActivationExpiresAt] = useState('');
  const [activationAdminName, setActivationAdminName] = useState('');
  const [activationAdminEmail, setActivationAdminEmail] = useState('');
  const [activationAdminRole, setActivationAdminRole] = useState('');
  const [activationModalVisible, setActivationModalVisible] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // ----------------------------------------
  // Create User
  // ----------------------------------------

  async function handleCreateUser() {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    /*
     * ------------------------------------
     * Validate name
     * ------------------------------------
     */
    if (!trimmedName) {
      modal.show('Missing Name', "Please enter the user's full name.");
      return;
    }

    if (trimmedName.length < 2) {
      modal.show('Invalid Name', 'Please enter a valid full name.');
      return;
    }

    /*
     * ------------------------------------
     * Validate email
     * ------------------------------------
     */
    if (!trimmedEmail) {
      modal.show('Missing Email', "Please enter the user's email address.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      modal.show('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    /*
     * Prevent duplicate request
     */
    if (loading) {
      return;
    }

    try {
      setLoading(true);

      console.log('Creating admin user with role:', role);

      /*
       * ------------------------------------
       * Call Edge Function
       * ------------------------------------
       */
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          full_name: trimmedName,
          email: trimmedEmail,
          role,
        },
      });

      if (error) {
        console.error('Create admin function error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Registration Failed');
        modal.show(title, message);
        return;
      }

      /*
       * ------------------------------------
       * Successful HTTP response
       * ------------------------------------
       *
       * IMPORTANT: never log `data` here — it carries the
       * one-time activation link (a live auth token). Logging it
       * would leave a way to hijack the invited account sitting
       * in the console/device logs.
       */
      console.log('Create admin response success:', data?.success === true);

      if (!data?.success) {
        modal.show('Registration Failed', data?.error ?? 'Unable to create the user.');
        return;
      }

      /*
       * ------------------------------------
       * Get activation code
       * ------------------------------------
       */
      const newActivationCode = data?.activation_code;

      if (!newActivationCode) {
        console.error('Registration succeeded but no activation code was returned:', data);

        modal.show(
          'Registration Incomplete',
          'The user was created successfully, but no activation code was returned by the server. Please check the create-admin-user Edge Function.'
        );
        return;
      }

      /*
       * ------------------------------------
       * Registration successful
       * ------------------------------------
       *
       * Capture the fields the modal needs before the form resets.
       */
      setActivationAdminName(trimmedName);
      setActivationAdminEmail(trimmedEmail);
      setActivationAdminRole(role);
      setActivationCode(newActivationCode);
      setActivationExpiresAt(data?.expires_at ?? '');
      setCodeCopied(false);

      setFullName('');
      setEmail('');
      setRole('Viewer');

      setActivationModalVisible(true);
    } catch (error) {
      console.error('Unexpected create admin error:', error);
      modal.show(
        'Registration Error',
        'Something unexpected happened while creating the user. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ========================================
   * Access control
   * ========================================
   */
  if (!isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>Only Super Admin can register users.</Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  /*
   * ========================================
   * Screen
   * ========================================
   */
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================ HEADER ================================ */}

        <View style={styles.header}>
          <Text style={styles.title}>Register User</Text>
          <Text style={styles.subtitle}>
            Create an administrator account for the church system.
          </Text>
        </View>

        {/* ================================ FORM ================================ */}

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Full name"
          />

          <Text style={styles.label}>Email Address</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
            accessibilityLabel="Email address"
          />

          <Text style={styles.label}>Role</Text>

          <View style={styles.rolesContainer}>
            {roles.map((item) => {
              const selected = role === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => !loading && setRole(item.value)}
                  style={[styles.roleOption, selected && styles.roleOptionSelected]}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.title}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioInner} />}
                  </View>

                  <View style={styles.roleContent}>
                    <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
                      {item.title}
                    </Text>

                    <Text style={styles.roleDescription}>{item.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ------------------------------ NOTICE ------------------------------ */}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Password & Activation</Text>
            <Text style={styles.noticeText}>
              Give the user the activation code shown after registering — they enter it at
              Activate Account to create their own password. The password is never visible to
              you.
            </Text>
          </View>

          {/* ------------------------------ CREATE ------------------------------ */}

          <Pressable
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateUser}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Create user"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <>
                <ActivityIndicator color={colors.surface} size="small" />
                <Text style={styles.createButtonText}>Creating User...</Text>
              </>
            ) : (
              <Text style={styles.createButtonText}>Create User</Text>
            )}
          </Pressable>

          {/* ------------------------------ CANCEL ------------------------------ */}

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ================================ ACTIVATION CODE POPUP ================================ */}

      {activationModalVisible && (
        <View style={styles.activationOverlay}>
          <View style={styles.activationModal}>
            <Text style={styles.activationTitle}>User Registered</Text>

            <Text style={styles.activationMessage}>
              The user has been registered successfully. Give them the activation code below —
              they enter it at Activate Account to create their own password.
            </Text>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Administrator Name</Text>
              <Text style={styles.activationFieldValue}>{activationAdminName}</Text>
            </View>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Email</Text>
              <Text style={styles.activationFieldValue}>{activationAdminEmail}</Text>
            </View>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Role</Text>
              <Text style={styles.activationFieldValue}>{activationAdminRole}</Text>
            </View>

            <Text style={styles.activationLabel}>Activation Code</Text>

            <View style={styles.activationCodeContainer}>
              <Text style={styles.activationCode} selectable>
                {activationCode}
              </Text>
            </View>

            <Text style={styles.activationExpiry}>
              Expires: {formatExpiresAt(activationExpiresAt)}
            </Text>

            <Pressable
              style={styles.copyActivationButton}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(activationCode);
                  setCodeCopied(true);
                } catch (error) {
                  console.error('Failed to copy activation code:', error);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy activation code"
            >
              <Text style={styles.copyActivationButtonText}>
                {codeCopied ? 'Copied!' : 'Copy Activation Code'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.activationDoneButton}
              onPress={() => {
                setActivationModalVisible(false);
                setActivationCode('');
                setActivationExpiresAt('');
                setCodeCopied(false);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.activationDoneButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================================ ERROR / INFO MODAL ================================ */}

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
    padding: 24,
    paddingBottom: 60,
  },

  header: {
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 6,
  },

  form: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
    marginBottom: 8,
    marginTop: 18,
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

  rolesContainer: {
    gap: 10,
  },

  roleOption: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm + 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roleOptionSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.background,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  radioSelected: {
    borderColor: colors.textPrimary,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textPrimary,
  },

  roleContent: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textLabel,
  },

  roleTitleSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  roleDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 3,
  },

  notice: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 15,
    marginTop: 22,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLabel,
  },

  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 5,
  },

  createButton: {
    minHeight: 52,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 25,
  },

  createButtonDisabled: {
    opacity: 0.6,
  },

  createButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },

  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },

  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
  },

  activationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },

  activationModal: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },

  activationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  activationMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 8,
  },

  activationField: {
    marginTop: 14,
  },

  activationFieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 3,
  },

  activationFieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
  },

  activationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLabel,
    marginTop: 20,
    marginBottom: 8,
  },

  activationCodeContainer: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    padding: 14,
    alignItems: 'center',
  },

  activationCode: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.textPrimary,
  },

  activationExpiry: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },

  copyActivationButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  copyActivationButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },

  activationDoneButton: {
    height: 48,
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  activationDoneButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  deniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  deniedText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  backButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 20,
  },

  backButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});