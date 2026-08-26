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

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import AppModal from '@/components/AppModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const roles = [
  {
    value: 'Viewer' as const,
    title: 'Viewer',
    description:
      'Can view the system but cannot add, edit or delete.',
  },
  {
    value: 'Super Admin' as const,
    title: 'Super Admin',
    description:
      'Full access to manage the entire system.',
  },
];

type Role = (typeof roles)[number]['value'];

export default function AddAdminUserScreen() {
  const { isSuperAdmin } = useAuth();

  // ----------------------------------------
  // Form
  // ----------------------------------------

  const [fullName, setFullName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [role, setRole] =
    useState<Role>('Viewer');

  // ----------------------------------------
  // Loading
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

  const [success, setSuccess] =
    useState(false);

  // ----------------------------------------
  // Activation link
  // ----------------------------------------

  const [activationLink, setActivationLink] =
    useState('');

  const [activationModalVisible, setActivationModalVisible] =
    useState(false);

  const [linkCopied, setLinkCopied] =
    useState(false);

  // ----------------------------------------
  // Modal helper
  // ----------------------------------------

  function showModal(
    title: string,
    message: string,
    isSuccess = false
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setSuccess(isSuccess);
    setModalVisible(true);
  }

  // ----------------------------------------
  // Create User
  // ----------------------------------------

  async function handleCreateUser() {
    const trimmedName =
      fullName.trim();

    const trimmedEmail =
      email.trim().toLowerCase();

    // ----------------------------------------
    // Validate name
    // ----------------------------------------

    if (!trimmedName) {
      showModal(
        'Missing Name',
        'Please enter the user\'s full name.'
      );

      return;
    }

    if (trimmedName.length < 2) {
      showModal(
        'Invalid Name',
        'Please enter a valid full name.'
      );

      return;
    }

    // ----------------------------------------
    // Validate email
    // ----------------------------------------

    if (!trimmedEmail) {
      showModal(
        'Missing Email',
        'Please enter the user\'s email address.'
      );

      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      showModal(
        'Invalid Email',
        'Please enter a valid email address.'
      );

      return;
    }

    // ----------------------------------------
    // Prevent duplicate request
    // ----------------------------------------

    if (loading) {
      return;
    }

    try {
      setLoading(true);

      console.log(
        'Creating admin user:',
        {
          full_name: trimmedName,
          email: trimmedEmail,
          role,
        }
      );

      // ----------------------------------------
      // Call Edge Function
      // ----------------------------------------

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'create-admin-user',
          {
            body: {
              full_name:
                trimmedName,

              email:
                trimmedEmail,

              role,
            },
          }
        );

      // ----------------------------------------
      // Edge Function Error
      // ----------------------------------------

      if (error) {
        console.error(
          'Create admin function error:',
          error
        );

        // --------------------------------------
        // HTTP error returned by Edge Function
        // --------------------------------------

        if (
          error instanceof
          FunctionsHttpError
        ) {
          try {
            const errorBody =
              await error.context.json();

            console.error(
              'Edge Function response:',
              errorBody
            );

            const message =
              errorBody?.error ??
              errorBody?.message ??
              'The server rejected the request.';

            showModal(
              'Registration Failed',
              message
            );
          } catch (parseError) {
            console.error(
              'Could not parse Edge Function error:',
              parseError
            );

            showModal(
              'Registration Failed',
              'The server rejected the request. Please check the Edge Function logs.'
            );
          }

          return;
        }

        // --------------------------------------
        // Network error
        // --------------------------------------

        if (
          error instanceof
          FunctionsFetchError
        ) {
          showModal(
            'Connection Error',
            'Could not connect to the registration service. Please check your internet connection and try again.'
          );

          return;
        }

        // --------------------------------------
        // Relay error
        // --------------------------------------

        if (
          error instanceof
          FunctionsRelayError
        ) {
          showModal(
            'Server Connection Error',
            'The registration service could not be reached. Please try again.'
          );

          return;
        }

        // --------------------------------------
        // Unknown error
        // --------------------------------------

        showModal(
          'Registration Failed',
          error.message ||
            'Unable to register the user.'
        );

        return;
      }

      // ----------------------------------------
      // Successful HTTP response
      // ----------------------------------------

      console.log(
        'Create admin response:',
        data
      );

      if (!data?.success) {
        showModal(
          'Registration Failed',
          data?.error ??
            'Unable to create the user.'
        );

        return;
      }

      // ----------------------------------------
      // Get activation link
      // ----------------------------------------

      const activationLink =
        data?.activation_link;

      if (!activationLink) {
        console.error(
          'Registration succeeded but no activation link was returned:',
          data
        );

        showModal(
          'Registration Incomplete',
          'The user was created successfully, but no activation link was returned by the server. Please check the create-admin-user Edge Function.'
        );

        return;
      }

      // ----------------------------------------
      // Registration successful
      // ----------------------------------------

      setFullName('');
      setEmail('');
      setRole('Viewer');

      setActivationLink(activationLink);
      setLinkCopied(false);
      setActivationModalVisible(true);

    } catch (error) {
      // ----------------------------------------
      // Unexpected error
      // ----------------------------------------

      console.error(
        'Unexpected create admin error:',
        error
      );

      showModal(
        'Registration Error',
        'Something unexpected happened while creating the user. Please try again.'
      );

    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------
  // Access control
  // ----------------------------------------

  if (!isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Only Super Admin can register users.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------
  // Screen
  // ----------------------------------------

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------------------------------- */}
        {/* Header */}
        {/* ---------------------------------- */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Register User
          </Text>

          <Text style={styles.subtitle}>
            Create an administrator account for the
            church system.
          </Text>
        </View>

        {/* ---------------------------------- */}
        {/* Form */}
        {/* ---------------------------------- */}

        <View style={styles.form}>

          {/* Full Name */}

          <Text style={styles.label}>
            Full Name
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            placeholderTextColor="#9ca3af"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Email */}

          <Text style={styles.label}>
            Email Address
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          {/* Role */}

          <Text style={styles.label}>
            Role
          </Text>

          <View style={styles.rolesContainer}>
            {roles.map((item) => {
              const selected =
                role === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() =>
                    !loading &&
                    setRole(item.value)
                  }
                  style={[
                    styles.roleOption,
                    selected &&
                      styles.roleOptionSelected,
                  ]}
                  disabled={loading}
                >
                  {/* Radio */}

                  <View
                    style={[
                      styles.radio,
                      selected &&
                        styles.radioSelected,
                    ]}
                  >
                    {selected && (
                      <View
                        style={
                          styles.radioInner
                        }
                      />
                    )}
                  </View>

                  {/* Role text */}

                  <View
                    style={
                      styles.roleContent
                    }
                  >
                    <Text
                      style={[
                        styles.roleTitle,
                        selected &&
                          styles.roleTitleSelected,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={
                        styles.roleDescription
                      }
                    >
                      {item.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* -------------------------------- */}
          {/* Password / Activation notice */}
          {/* -------------------------------- */}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              Password & Activation
            </Text>

            <Text style={styles.noticeText}>
              The user will receive an activation
              link and will create their own password.
              The password is never visible to the
              Super Admin.
            </Text>
          </View>

          {/* -------------------------------- */}
          {/* Create */}
          {/* -------------------------------- */}

          <Pressable
            style={[
              styles.createButton,
              loading &&
                styles.createButtonDisabled,
            ]}
            onPress={handleCreateUser}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator
                  color="#ffffff"
                  size="small"
                />

                <Text
                  style={
                    styles.createButtonText
                  }
                >
                  Creating User...
                </Text>
              </>
            ) : (
              <Text
                style={
                  styles.createButtonText
                }
              >
                Create User
              </Text>
            )}
          </Pressable>

          {/* -------------------------------- */}
          {/* Cancel */}
          {/* -------------------------------- */}

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text
              style={
                styles.cancelButtonText
              }
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ------------------------------------ */}
      {/* Activation Link Popup */}
      {/* ------------------------------------ */}

      {activationModalVisible && (
        <View style={styles.activationOverlay}>
          <View style={styles.activationModal}>
            <Text style={styles.activationTitle}>
              User Registered
            </Text>

            <Text style={styles.activationMessage}>
              The user has been registered successfully.
              Send the activation link below to the user.
            </Text>

            <Text style={styles.activationLabel}>
              Activation Link
            </Text>

            <Pressable
              style={styles.activationLinkContainer}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(
                    activationLink
                  );

                  setLinkCopied(true);
                } catch (error) {
                  console.error(
                    'Failed to copy activation link:',
                    error
                  );
                }
              }}
            >
              <Text
                style={styles.activationLink}
                selectable
              >
                {activationLink}
              </Text>
            </Pressable>

            {linkCopied && (
              <Text style={styles.copiedText}>
                ✓ Activation link copied to clipboard.
              </Text>
            )}

            <Text style={styles.activationHint}>
              Tap the link above to copy it automatically.
            </Text>

            <Pressable
              style={styles.activationDoneButton}
              onPress={() => {
                setActivationModalVisible(false);
                setActivationLink('');
                setLinkCopied(false);
                router.back();
              }}
            >
              <Text style={styles.activationDoneButtonText}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ------------------------------------ */}
      {/* Error / Information Popup */}
      {/* ------------------------------------ */}

      <AppModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttonText="OK"
        onClose={() => {
          setModalVisible(false);

          if (success) {
            router.back();
          }
        }}
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
    backgroundColor: '#f8fafc',
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 60,
  },

  // ----------------------------------------
  // Header
  // ----------------------------------------

  header: {
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    marginTop: 6,
  },

  // ----------------------------------------
  // Form
  // ----------------------------------------

  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 18,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // ----------------------------------------
  // Roles
  // ----------------------------------------

  rolesContainer: {
    gap: 10,
  },

  roleOption: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roleOptionSelected: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc',
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  radioSelected: {
    borderColor: '#111827',
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },

  roleContent: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  roleTitleSelected: {
    color: '#111827',
    fontWeight: '700',
  },

  roleDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#6b7280',
    marginTop: 3,
  },

  // ----------------------------------------
  // Notice
  // ----------------------------------------

  notice: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 15,
    marginTop: 22,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },

  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7280',
    marginTop: 5,
  },

  // ----------------------------------------
  // Create button
  // ----------------------------------------

  createButton: {
    minHeight: 52,
    backgroundColor: '#111827',
    borderRadius: 9,
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  // ----------------------------------------
  // Cancel
  // ----------------------------------------

  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },

  cancelButtonText: {
    color: '#6b7280',
    fontSize: 15,
  },

  // ----------------------------------------
  // Activation Link Popup
  // ----------------------------------------

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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  activationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  activationMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    marginTop: 8,
  },

  activationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
  },

  activationLinkContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    backgroundColor: '#f8fafc',
    padding: 12,
  },

  activationLink: {
    fontSize: 13,
    lineHeight: 19,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },

  copiedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803d',
    marginTop: 10,
  },

  activationHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9ca3af',
    marginTop: 8,
  },

  activationDoneButton: {
    height: 48,
    backgroundColor: '#111827',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  activationDoneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ----------------------------------------
  // Access denied
  // ----------------------------------------

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  deniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  deniedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },

  backButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 20,
  },

  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
