import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppModal } from '@/hooks/useAppModal';
import { resolveEdgeFunctionError } from '@/lib/edgeFunctionError';
import { supabase } from '@/lib/supabase';
import type { AdminProfile, AdminRole } from '@/types/admin';

export default function EditAdminScreen() {
  const { profile, isSuperAdmin } = useAuth();

  const params = useLocalSearchParams<{ id?: string }>();
  const adminId = typeof params.id === 'string' ? params.id : '';

  // ----------------------------------------
  // State
  // ----------------------------------------

  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('Viewer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const modal = useAppModal();
  const [success, setSuccess] = useState(false);

  function finish(title: string, message: string, isSuccess = false) {
    setSuccess(isSuccess);
    modal.show(title, message);
  }

  // ----------------------------------------
  // Load admin
  // ----------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadAdmin() {
      if (!isSuperAdmin) {
        if (mounted) setLoading(false);
        return;
      }

      if (!adminId) {
        if (mounted) {
          setLoading(false);
          finish('Invalid Administrator', 'No administrator was selected.');
        }

        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('id', adminId)
          .single();

        if (error) {
          console.error('[ADMIN EDIT] Load error:', error);

          if (mounted) {
            finish('Unable to Load Administrator', 'We could not load this administrator account.');
          }

          return;
        }

        if (!mounted) {
          return;
        }

        const loadedAdmin = data as AdminProfile;

        setAdmin(loadedAdmin);
        setFullName(loadedAdmin.full_name);
        setRole(loadedAdmin.role);
      } catch (error) {
        console.error('[ADMIN EDIT] Unexpected load error:', error);

        if (mounted) {
          finish('Error', 'Something went wrong while loading the administrator.');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, isSuperAdmin]);

  // ----------------------------------------
  // Save
  // ----------------------------------------

  async function handleSave() {
    if (!admin) {
      return;
    }

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      finish('Missing Information', 'Full name is required.');
      return;
    }

    if (trimmedName.length > 150) {
      finish('Invalid Name', 'Full name cannot exceed 150 characters.');
      return;
    }

    if (saving) {
      return;
    }

    try {
      setSaving(true);

      /*
       * Sensitive administrator changes are handled by an Edge
       * Function. The client never directly updates
       * role/status/approved.
       */
      const { data, error } = await supabase.functions.invoke('update-admin-profile', {
        body: {
          admin_id: admin.id,
          full_name: trimmedName,
          role,
        },
      });

      if (error) {
        console.error('[ADMIN EDIT] Update error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Update Failed');
        finish(title, message);

        return;
      }

      if (!data?.success) {
        finish('Update Failed', data?.error ?? 'Unable to update administrator.');
        return;
      }

      /*
       * Update the local form state from the server response.
       */
      if (data.profile) {
        setAdmin(data.profile as AdminProfile);
        setFullName(data.profile.full_name);
        setRole(data.profile.role);
      }

      finish('Administrator Updated', 'The administrator account has been updated successfully.', true);
    } catch (error) {
      console.error('[ADMIN EDIT] Unexpected update error:', error);
      finish('Update Failed', 'Something went wrong while updating the administrator.');
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------
  // Access control
  // ----------------------------------------

  if (!isSuperAdmin) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.accessTitle}>Access Denied</Text>
        <Text style={styles.accessText}>Only Super Admin can manage administrator accounts.</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------
  // Loading
  // ----------------------------------------

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading administrator...</Text>
      </View>
    );
  }

  // ----------------------------------------
  // No admin
  // ----------------------------------------

  if (!admin) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.accessTitle}>Administrator Not Found</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  /*
   * A Super Admin can update their own display name, but cannot
   * change their own role through this screen.
   */
  const isEditingSelf = admin.id === profile?.id;

  // ----------------------------------------
  // Screen
  // ----------------------------------------

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <Text style={styles.title}>Edit Administrator</Text>
          <Text style={styles.subtitle}>Update this administrator's account information and role.</Text>
        </View>

        {/* Form */}

        <View style={styles.card}>
          {/* Full Name */}

          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full Name"
            placeholderTextColor={colors.textMuted}
            editable={!saving}
            autoCapitalize="words"
          />

          {/* Role */}

          <Text style={styles.label}>Role</Text>

          <View style={styles.roleRow}>
            <Pressable
              style={[
                styles.roleOption,
                role === 'Viewer' && styles.roleOptionSelected,
                isEditingSelf && styles.roleOptionDisabled,
              ]}
              disabled={saving || isEditingSelf}
              onPress={() => setRole('Viewer')}
              accessibilityRole="radio"
              accessibilityState={{ selected: role === 'Viewer', disabled: isEditingSelf }}
            >
              <Text style={[styles.roleOptionTitle, role === 'Viewer' && styles.roleOptionTitleSelected]}>
                Viewer
              </Text>

              <Text style={[styles.roleOptionText, role === 'Viewer' && styles.roleOptionTextSelected]}>
                Can use the application according to Viewer permissions.
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.roleOption,
                role === 'Super Admin' && styles.roleOptionSelected,
                isEditingSelf && styles.roleOptionDisabled,
              ]}
              disabled={saving || isEditingSelf}
              onPress={() => setRole('Super Admin')}
              accessibilityRole="radio"
              accessibilityState={{ selected: role === 'Super Admin', disabled: isEditingSelf }}
            >
              <Text style={[styles.roleOptionTitle, role === 'Super Admin' && styles.roleOptionTitleSelected]}>
                Super Admin
              </Text>

              <Text style={[styles.roleOptionText, role === 'Super Admin' && styles.roleOptionTextSelected]}>
                Can manage administrators and privileged application functions.
              </Text>
            </Pressable>
          </View>

          {isEditingSelf && (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Your role cannot be changed here</Text>
              <Text style={styles.noticeText}>
                For security, a Super Admin cannot change their own administrator role.
              </Text>
            </View>
          )}

          {/* Status */}

          <Text style={styles.label}>Status</Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.statusText}>{admin.status}</Text>
          </View>

          {/* Approved */}

          <Text style={styles.label}>Approved</Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.statusText}>{admin.approved ? 'Yes' : 'No'}</Text>
          </View>

          {/* Save */}

          <Pressable
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? (
              <>
                <ActivityIndicator color={colors.surface} size="small" />
                <Text style={styles.primaryButtonText}>Saving...</Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            )}
          </Pressable>

          {/* Cancel */}

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal */}

      <AppModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        buttonText="OK"
        onClose={() => {
          modal.hide();

          if (success) {
            router.back();
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.accent,
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLabel,
    marginTop: 18,
    marginBottom: 8,
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

  roleRow: {
    gap: 10,
  },

  roleOption: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.md + 2,
    padding: 15,
    backgroundColor: colors.surface,
  },

  roleOptionSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },

  roleOptionDisabled: {
    opacity: 0.55,
  },

  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  roleOptionTitleSelected: {
    color: colors.surface,
  },

  roleOptionText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },

  roleOptionTextSelected: {
    color: colors.borderInput,
  },

  notice: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 14,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLabel,
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },

  readOnlyField: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: colors.statusInactiveBg,
  },

  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.statusInactiveText,
  },

  primaryButton: {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },

  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  cancelButton: {
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  cancelButtonText: {
    color: colors.textLabel,
    fontSize: 14,
    fontWeight: '600',
  },

  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },

  accessTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  accessText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
});
