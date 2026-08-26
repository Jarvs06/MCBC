import {
    router,
    useLocalSearchParams,
} from 'expo-router';

import {
    useEffect,
    useState,
} from 'react';

import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import AppModal from '@/components/AppModal';

import {
    useAuth,
} from '@/contexts/AuthContext';

import {
    supabase,
} from '@/lib/supabase';

type AdminRole =
  | 'Super Admin'
  | 'Viewer';

type AdminStatus =
  | 'Pending'
  | 'Active'
  | 'Disabled';

type AdminProfile = {
  id: string;

  full_name: string;

  role: AdminRole;

  status: AdminStatus;

  approved: boolean;

  created_at: string;

  updated_at: string;
};

export default function EditAdminScreen() {
  /*
   * ========================================
   * AUTH
   * ========================================
   */

  const {
    profile,
    isSuperAdmin,
  } = useAuth();

  /*
   * ========================================
   * ROUTE PARAM
   * ========================================
   */

  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const adminId =
    typeof params.id === 'string'
      ? params.id
      : '';

  /*
   * ========================================
   * STATE
   * ========================================
   */

  const [
    admin,
    setAdmin,
  ] =
    useState<AdminProfile | null>(null);

  const [
    fullName,
    setFullName,
  ] =
    useState('');

  const [
    role,
    setRole,
  ] =
    useState<AdminRole>('Viewer');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    modalVisible,
    setModalVisible,
  ] =
    useState(false);

  const [
    modalTitle,
    setModalTitle,
  ] =
    useState('');

  const [
    modalMessage,
    setModalMessage,
  ] =
    useState('');

  const [
    modalSuccess,
    setModalSuccess,
  ] =
    useState(false);

  /*
   * ========================================
   * MODAL
   * ========================================
   */

  function showModal(
    title: string,
    message: string,
    success = false
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalSuccess(success);
    setModalVisible(true);
  }

  /*
   * ========================================
   * LOAD ADMIN
   * ========================================
   */

  useEffect(() => {
    let mounted = true;

    async function loadAdmin() {
      if (!isSuperAdmin) {
        if (mounted) {
          setLoading(false);
        }

        return;
      }

      if (!adminId) {
        if (mounted) {
          setLoading(false);

          showModal(
            'Invalid Administrator',
            'No administrator was selected.'
          );
        }

        return;
      }

      try {
        const {
          data,
          error,
        } =
          await supabase
            .from('admin_profiles')
            .select('*')
            .eq('id', adminId)
            .single();

        if (error) {
          console.error(
            '[ADMIN EDIT] Load error:',
            error
          );

          if (mounted) {
            showModal(
              'Unable to Load Administrator',
              'We could not load this administrator account.'
            );
          }

          return;
        }

        if (!mounted) {
          return;
        }

        const loadedAdmin =
          data as AdminProfile;

        setAdmin(
          loadedAdmin
        );

        setFullName(
          loadedAdmin.full_name
        );

        setRole(
          loadedAdmin.role
        );
      } catch (error) {
        console.error(
          '[ADMIN EDIT] Unexpected load error:',
          error
        );

        if (mounted) {
          showModal(
            'Error',
            'Something went wrong while loading the administrator.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAdmin();

    return () => {
      mounted = false;
    };
  }, [
    adminId,
    isSuperAdmin,
  ]);

  /*
   * ========================================
   * SAVE
   * ========================================
   */

  async function handleSave() {
    if (!admin) {
      return;
    }

    const trimmedName =
      fullName.trim();

    if (!trimmedName) {
      showModal(
        'Missing Information',
        'Full name is required.'
      );

      return;
    }

    if (
      trimmedName.length > 150
    ) {
      showModal(
        'Invalid Name',
        'Full name cannot exceed 150 characters.'
      );

      return;
    }

    if (saving) {
      return;
    }

    try {
      setSaving(true);

      /*
       * Sensitive administrator changes are
       * handled by an Edge Function.
       *
       * The client never directly updates
       * role/status/approved.
       */

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'update-admin-profile',
          {
            body: {
              admin_id:
                admin.id,

              full_name:
                trimmedName,

              role,
            },
          }
        );

      if (error) {
        console.error(
          '[ADMIN EDIT] Update error:',
          error
        );

        let message =
          error.message ||
          'Unable to update administrator.';

        try {
          if (
            'context' in error &&
            error.context
          ) {
            const body =
              await error.context.json();

            message =
              body?.error ??
              body?.message ??
              message;
          }
        } catch {
          // Keep the original error message.
        }

        showModal(
          'Update Failed',
          message
        );

        return;
      }

      if (
        !data?.success
      ) {
        showModal(
          'Update Failed',
          data?.error ??
            'Unable to update administrator.'
        );

        return;
      }

      /*
       * Update the local form state from
       * the server response.
       */

      if (data.profile) {
        setAdmin(
          data.profile as AdminProfile
        );

        setFullName(
          data.profile.full_name
        );

        setRole(
          data.profile.role
        );
      }

      showModal(
        'Administrator Updated',
        'The administrator account has been updated successfully.',
        true
      );
    } catch (error) {
      console.error(
        '[ADMIN EDIT] Unexpected update error:',
        error
      );

      showModal(
        'Update Failed',
        'Something went wrong while updating the administrator.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================
   * ACCESS CONTROL
   * ========================================
   */

  if (!isSuperAdmin) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.accessTitle}>
          Access Denied
        </Text>

        <Text style={styles.accessText}>
          Only Super Admin can manage administrator
          accounts.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace('/dashboard')
          }
        >
          <Text style={styles.primaryButtonText}>
            Back to Dashboard
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading administrator...
        </Text>
      </View>
    );
  }

  /*
   * ========================================
   * NO ADMIN
   * ========================================
   */

  if (!admin) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.accessTitle}>
          Administrator Not Found
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.back()
          }
        >
          <Text style={styles.primaryButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * ========================================
   * SELF EDIT
   * ========================================
   *
   * A Super Admin can update their own
   * display name, but cannot change their
   * own role through this screen.
   */

  const isEditingSelf =
    admin.id === profile?.id;

  /*
   * ========================================
   * SCREEN
   * ========================================
   */

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}

        <View style={styles.header}>
          <Pressable
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.backText}>
              ‹ Back
            </Text>
          </Pressable>

          <Text style={styles.title}>
            Edit Administrator
          </Text>

          <Text style={styles.subtitle}>
            Update this administrator's account
            information and role.
          </Text>
        </View>

        {/* Form */}

        <View style={styles.card}>
          {/* Full Name */}

          <Text style={styles.label}>
            Full Name
          </Text>

          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={
              setFullName
            }
            placeholder="Full Name"
            placeholderTextColor="#9ca3af"
            editable={!saving}
            autoCapitalize="words"
          />

          {/* Role */}

          <Text style={styles.label}>
            Role
          </Text>

          <View style={styles.roleRow}>
            <Pressable
              style={[
                styles.roleOption,
                role === 'Viewer' &&
                  styles.roleOptionSelected,
                isEditingSelf &&
                  styles.roleOptionDisabled,
              ]}
              disabled={
                saving ||
                isEditingSelf
              }
              onPress={() =>
                setRole('Viewer')
              }
            >
              <Text
                style={[
                  styles.roleOptionTitle,
                  role === 'Viewer' &&
                    styles.roleOptionTitleSelected,
                ]}
              >
                Viewer
              </Text>

              <Text
                style={[
                  styles.roleOptionText,
                  role === 'Viewer' &&
                    styles.roleOptionTextSelected,
                ]}
              >
                Can use the application according
                to Viewer permissions.
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.roleOption,
                role === 'Super Admin' &&
                  styles.roleOptionSelected,
                isEditingSelf &&
                  styles.roleOptionDisabled,
              ]}
              disabled={
                saving ||
                isEditingSelf
              }
              onPress={() =>
                setRole(
                  'Super Admin'
                )
              }
            >
              <Text
                style={[
                  styles.roleOptionTitle,
                  role === 'Super Admin' &&
                    styles.roleOptionTitleSelected,
                ]}
              >
                Super Admin
              </Text>

              <Text
                style={[
                  styles.roleOptionText,
                  role === 'Super Admin' &&
                    styles.roleOptionTextSelected,
                ]}
              >
                Can manage administrators and
                privileged application functions.
              </Text>
            </Pressable>
          </View>

          {isEditingSelf && (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>
                Your role cannot be changed here
              </Text>

              <Text style={styles.noticeText}>
                For security, a Super Admin cannot
                change their own administrator role.
              </Text>
            </View>
          )}

          {/* Status */}

          <Text style={styles.label}>
            Status
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.statusText}>
              {admin.status}
            </Text>
          </View>

          {/* Approved */}

          <Text style={styles.label}>
            Approved
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.statusText}>
              {admin.approved
                ? 'Yes'
                : 'No'}
            </Text>
          </View>

          {/* Save */}

          <Pressable
            style={[
              styles.primaryButton,
              saving &&
                styles.buttonDisabled,
            ]}
            onPress={
              handleSave
            }
            disabled={saving}
          >
            {saving ? (
              <>
                <ActivityIndicator
                  color="#ffffff"
                  size="small"
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Saving...
                </Text>
              </>
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Save Changes
              </Text>
            )}
          </Pressable>

          {/* Cancel */}

          <Pressable
            style={
              styles.cancelButton
            }
            onPress={() =>
              router.back()
            }
            disabled={saving}
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

      {/* Modal */}

      <AppModal
        visible={
          modalVisible
        }
        title={
          modalTitle
        }
        message={
          modalMessage
        }
        buttonText="OK"
        onClose={() => {
          setModalVisible(
            false
          );

          if (
            modalSuccess
          ) {
            router.back();
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#f8fafc',
    },

    content: {
      padding: 20,
      paddingBottom: 50,
    },

    header: {
      marginBottom: 20,
    },

    backText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#2563eb',
      marginBottom: 12,
    },

    title: {
      fontSize: 28,
      fontWeight: '700',
      color: '#111827',
    },

    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: '#6b7280',
      marginTop: 6,
    },

    card: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      padding: 20,
    },

    label: {
      fontSize: 13,
      fontWeight: '700',
      color: '#374151',
      marginTop: 18,
      marginBottom: 8,
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

    roleRow: {
      gap: 10,
    },

    roleOption: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 12,
      padding: 15,
      backgroundColor: '#ffffff',
    },

    roleOptionSelected: {
      borderColor: '#111827',
      backgroundColor: '#111827',
    },

    roleOptionDisabled: {
      opacity: 0.55,
    },

    roleOptionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },

    roleOptionTitleSelected: {
      color: '#ffffff',
    },

    roleOptionText: {
      fontSize: 12,
      lineHeight: 18,
      color: '#6b7280',
      marginTop: 4,
    },

    roleOptionTextSelected: {
      color: '#d1d5db',
    },

    notice: {
      backgroundColor: '#f8fafc',
      borderRadius: 10,
      padding: 14,
      marginTop: 14,
    },

    noticeTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#374151',
    },

    noticeText: {
      fontSize: 12,
      lineHeight: 18,
      color: '#6b7280',
      marginTop: 4,
    },

    readOnlyField: {
      height: 50,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 9,
      paddingHorizontal: 14,
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
    },

    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#4b5563',
    },

    primaryButton: {
      height: 50,
      borderRadius: 9,
      backgroundColor: '#111827',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 24,
    },

    primaryButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    cancelButton: {
      height: 50,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: '#d1d5db',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },

    cancelButtonText: {
      color: '#374151',
      fontSize: 14,
      fontWeight: '600',
    },

    centerScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#f8fafc',
    },

    loadingText: {
      marginTop: 12,
      color: '#6b7280',
    },

    accessTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#111827',
      textAlign: 'center',
    },

    accessText: {
      fontSize: 14,
      lineHeight: 21,
      color: '#6b7280',
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 360,
    },
  });
