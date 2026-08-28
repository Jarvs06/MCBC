import * as Clipboard from 'expo-clipboard';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import AppModal from '@/components/AppModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FilterDropdown } from '@/components/FilterDropdown';
import { Pagination } from '@/components/Pagination';
import { colors, radii, WIDE_BREAKPOINT } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppModal } from '@/hooks/useAppModal';
import { resolveEdgeFunctionError } from '@/lib/edgeFunctionError';
import { supabase } from '@/lib/supabase';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '@/lib/validators';
import type { AdminProfile, AdminRole, AdminStatus } from '@/types/admin';

const PAGE_SIZE = 10;

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

const statusFilterOptions = ['All', 'Active', 'Pending', 'Disabled'] as const;
const roleFilterOptions = ['All', 'Super Admin', 'Viewer'] as const;

export default function AdminUsersScreen() {
  const { profile, isSuperAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------
  // Search & Filters
  // ----------------------------------------

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | AdminStatus>('All');
  const [roleFilter, setRoleFilter] = useState<'All' | AdminRole>('All');
  const [openFilter, setOpenFilter] = useState<'status' | 'role' | null>(null);

  const [page, setPage] = useState(1);

  const modal = useAppModal();

  const [statusConfirmVisible, setStatusConfirmVisible] = useState(false);
  const [statusConfirmUser, setStatusConfirmUser] = useState<AdminProfile | null>(null);
  const [statusConfirmNextStatus, setStatusConfirmNextStatus] = useState<
    'Active' | 'Disabled' | null
  >(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // ----------------------------------------
  // Activation Code
  // ----------------------------------------

  const [activationModalVisible, setActivationModalVisible] = useState(false);
  const [activationUser, setActivationUser] = useState<AdminProfile | null>(null);
  const [activationEmail, setActivationEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [activationExpiresAt, setActivationExpiresAt] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationCopied, setActivationCopied] = useState(false);

  // ----------------------------------------
  // Delete Administrator
  // ----------------------------------------

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AdminProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ----------------------------------------
  // Set Password
  // ----------------------------------------
  //
  // Last-resort fallback for when the invitation-link flow doesn't
  // reach someone: a Super Admin can set a non-Super-Admin account's
  // password directly, whether that account is still Pending (never
  // activated) or already Active.

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AdminProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select(
          `
            id,
            full_name,
            role,
            status,
            approved,
            created_at,
            updated_at
          `
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load admin users:', error);
        modal.show(
          'Unable to Load Users',
          'We could not load the administrator accounts. Please try again.'
        );
        return;
      }

      setUsers((data ?? []) as AdminProfile[]);
    } catch (error) {
      console.error('Unexpected error loading users:', error);
      modal.show('Error', 'Something went wrong while loading administrator accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  // ----------------------------------------
  // Confirm status change
  // ----------------------------------------

  async function confirmStatusChange() {
    if (!statusConfirmUser || !statusConfirmNextStatus || statusUpdating) {
      return;
    }

    const targetUser = statusConfirmUser;
    const nextStatus = statusConfirmNextStatus;

    try {
      setStatusUpdating(true);

      const { data, error } = await supabase.functions.invoke('set-admin-status', {
        body: { admin_id: targetUser.id, status: nextStatus },
      });

      if (error) {
        console.error('[ADMIN STATUS] Update error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Update Failed');
        setStatusConfirmVisible(false);
        modal.show(title, message);
        return;
      }

      if (!data?.success) {
        setStatusConfirmVisible(false);
        modal.show('Update Failed', data?.error ?? 'Unable to update administrator status.');
        return;
      }

      setStatusConfirmVisible(false);
      setStatusConfirmUser(null);
      setStatusConfirmNextStatus(null);

      await loadUsers();

      modal.show(
        nextStatus === 'Disabled' ? 'Administrator Disabled' : 'Administrator Enabled',
        `${targetUser.full_name}'s administrator account is now ${nextStatus.toLowerCase()}.`
      );
    } catch (error) {
      console.error('[ADMIN STATUS] Unexpected error:', error);
      setStatusConfirmVisible(false);
      modal.show('Update Failed', 'Something went wrong while updating the administrator status.');
    } finally {
      setStatusUpdating(false);
    }
  }

  // ----------------------------------------
  // Generate activation code
  // ----------------------------------------

  async function generateActivationCode(user: AdminProfile) {
    if (activationLoading) {
      return;
    }

    if (user.id === profile?.id) {
      modal.show(
        'Action Not Allowed',
        'You cannot generate an activation code for your own administrator account.'
      );
      return;
    }

    if (user.status !== 'Pending') {
      modal.show(
        'Activation Code Unavailable',
        'An activation code can only be generated for a Pending administrator account.'
      );
      return;
    }

    try {
      setActivationLoading(true);
      setActivationCopied(false);

      const { data, error } = await supabase.functions.invoke('regenerate-admin-activation-code', {
        body: { admin_id: user.id },
      });

      if (error) {
        console.error('[ADMIN ACTIVATION] Generate code error:', error);

        const { title, message } = await resolveEdgeFunctionError(
          error,
          'Activation Code Failed'
        );
        modal.show(title, message);
        return;
      }

      if (!data?.success) {
        modal.show('Activation Code Failed', data?.error ?? 'Unable to generate the activation code.');
        return;
      }

      setActivationUser(user);
      setActivationEmail(data.admin?.email ?? '');
      setActivationCode(data.activation_code ?? '');
      setActivationExpiresAt(data.expires_at ?? '');
      setActivationModalVisible(true);
    } catch (error) {
      console.error('[ADMIN ACTIVATION] Unexpected error:', error);
      modal.show(
        'Activation Code Failed',
        'Something went wrong while generating the activation code.'
      );
    } finally {
      setActivationLoading(false);
    }
  }

  async function copyActivationCode() {
    if (!activationCode) {
      return;
    }

    try {
      await Clipboard.setStringAsync(activationCode);
      setActivationCopied(true);
    } catch (error) {
      console.error('[ADMIN ACTIVATION] Clipboard error:', error);
      modal.show('Copy Failed', 'We could not copy the activation code. Please copy it manually.');
    }
  }

  // ----------------------------------------
  // Delete administrator
  // ----------------------------------------

  async function confirmDeleteAdmin() {
    if (!deleteUser || deleteLoading) {
      return;
    }

    const targetUser = deleteUser;

    if (targetUser.id === profile?.id) {
      setDeleteModalVisible(false);
      setDeleteUser(null);
      modal.show('Action Not Allowed', 'You cannot delete your own administrator account.');
      return;
    }

    try {
      setDeleteLoading(true);

      const { data, error } = await supabase.functions.invoke('delete-admin-user', {
        body: { admin_id: targetUser.id },
      });

      if (error) {
        console.error('[ADMIN DELETE] Delete error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Delete Failed');
        setDeleteModalVisible(false);
        setDeleteUser(null);
        modal.show(title, message);
        return;
      }

      if (!data?.success) {
        setDeleteModalVisible(false);
        setDeleteUser(null);
        modal.show('Delete Failed', data?.error ?? 'Unable to delete the administrator account.');
        return;
      }

      setDeleteModalVisible(false);
      setDeleteUser(null);

      await loadUsers();

      modal.show(
        'Administrator Deleted',
        `${targetUser.full_name}'s administrator account has been permanently deleted.`
      );
    } catch (error) {
      console.error('[ADMIN DELETE] Unexpected error:', error);
      setDeleteModalVisible(false);
      setDeleteUser(null);
      modal.show('Delete Failed', 'Something went wrong while deleting the administrator account.');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ----------------------------------------
  // Set password
  // ----------------------------------------

  function openSetPasswordModal(user: AdminProfile) {
    setPasswordUser(user);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordModalVisible(true);
  }

  async function confirmSetPassword() {
    if (!passwordUser || passwordSaving) {
      return;
    }

    if (!isValidPassword(newPassword)) {
      modal.show(
        'Password Too Short',
        `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      modal.show('Passwords Do Not Match', 'Please make sure both passwords are the same.');
      return;
    }

    const targetUser = passwordUser;

    try {
      setPasswordSaving(true);

      const { data, error } = await supabase.functions.invoke('set-admin-password', {
        body: { admin_id: targetUser.id, password: newPassword },
      });

      if (error) {
        console.error('[ADMIN PASSWORD] Set password error:', error);

        const { title, message } = await resolveEdgeFunctionError(error, 'Set Password Failed');
        modal.show(title, message);
        return;
      }

      if (!data?.success) {
        modal.show('Set Password Failed', data?.error ?? "Unable to set the administrator's password.");
        return;
      }

      setPasswordModalVisible(false);
      setPasswordUser(null);
      setNewPassword('');
      setConfirmNewPassword('');

      await loadUsers();

      modal.show(
        'Password Set',
        `${targetUser.full_name}'s password has been set. Share it with them directly — they can sign in right away.`
      );
    } catch (error) {
      console.error('[ADMIN PASSWORD] Unexpected error:', error);
      modal.show('Set Password Failed', 'Something went wrong while setting the password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  // ----------------------------------------
  // Filtered users
  // ----------------------------------------

  const normalizedSearch = search.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !normalizedSearch ||
      user.full_name.toLowerCase().includes(normalizedSearch) ||
      user.role.toLowerCase().includes(normalizedSearch) ||
      user.status.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
    const matchesRole = roleFilter === 'All' || user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  // ----------------------------------------
  // Pagination
  // ----------------------------------------
  //
  // currentPage is clamped against the live filtered count rather
  // than reset via an effect, so narrowing a filter down to fewer
  // pages than the current page never shows a blank page.

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>
          Only Super Admin can manage administrator accounts.
        </Text>

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

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ================================ HEADER ================================ */}

        <View style={[styles.header, isWide && styles.headerWide]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Admin Users</Text>
            <Text style={styles.subtitle}>
              Manage users who can access the church administration system.
            </Text>
          </View>

          <Link href="/(app)/admin-users/add" asChild>
            <Pressable
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Add user"
            >
              <Text style={styles.addButtonText}>+ Add User</Text>
            </Pressable>
          </Link>
        </View>

        {/* ================================ CURRENT USER ================================ */}

        {profile && (
          <View style={styles.currentUserCard}>
            <Text style={styles.currentUserLabel}>You are signed in as</Text>
            <Text style={styles.currentUserName}>{profile.full_name}</Text>
            <Text style={styles.currentUserRole}>{profile.role}</Text>
          </View>
        )}

        {/* ================================ SEARCH ================================ */}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search administrators..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* ================================ FILTERS ================================ */}

        <View style={styles.filterRow}>
          <FilterDropdown
            label="Status"
            placeholder="All Statuses"
            value={statusFilter}
            options={statusFilterOptions}
            isOpen={openFilter === 'status'}
            onToggle={() => setOpenFilter((current) => (current === 'status' ? null : 'status'))}
            onSelect={(item) => {
              setStatusFilter(item);
              setOpenFilter(null);
            }}
          />

          <FilterDropdown
            label="Role"
            placeholder="All Roles"
            value={roleFilter}
            options={roleFilterOptions}
            isOpen={openFilter === 'role'}
            onToggle={() => setOpenFilter((current) => (current === 'role' ? null : 'role'))}
            onSelect={(item) => {
              setRoleFilter(item);
              setOpenFilter(null);
            }}
          />
        </View>

        {/* ================================ COUNT ================================ */}

        <View style={[styles.countRow, isWide && styles.countRowWide]}>
          <Text style={styles.sectionTitle}>Administrator Accounts</Text>
          <Text style={styles.countText}>
            {filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}
          </Text>
        </View>

        {/* ================================ LOADING ================================ */}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        )}

        {/* ================================ EMPTY ================================ */}

        {!loading && users.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No administrator accounts</Text>
            <Text style={styles.emptyText}>
              There are currently no administrator profiles in the system.
            </Text>

            <Link href="/(app)/admin-users/add" asChild>
              <Pressable
                style={styles.emptyButton}
                accessibilityRole="button"
                accessibilityLabel="Add first user"
              >
                <Text style={styles.emptyButtonText}>Add First User</Text>
              </Pressable>
            </Link>
          </View>
        )}

        {/* ================================ FILTERED EMPTY ================================ */}

        {!loading && users.length > 0 && filteredUsers.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matching administrators</Text>
            <Text style={styles.emptyText}>Try changing the search text or filters.</Text>

            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                setSearch('');
                setStatusFilter('All');
                setRoleFilter('All');
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
            >
              <Text style={styles.emptyButtonText}>Clear Filters</Text>
            </Pressable>
          </View>
        )}

        {/* ================================ USERS ================================ */}

        {!loading && (
          <View style={isWide && styles.usersGrid}>
            {paginatedUsers.map((user) => {
              const isCurrentUser = user.id === profile?.id;

              return (
                <View key={user.id} style={isWide && styles.usersGridItem}>
                  <View style={[styles.userCard, isWide && styles.userCardWide]}>
                    <View style={styles.userTop}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.full_name}</Text>

                        {isCurrentUser && <Text style={styles.currentBadge}>You</Text>}
                      </View>

                      <View style={[styles.statusBadge, getStatusBadgeStyle(user.status)]}>
                        <Text style={[styles.statusText, getStatusTextStyle(user.status)]}>
                          {user.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.userDetails}>
                      <View>
                        <Text style={styles.detailLabel}>Role</Text>
                        <Text style={styles.detailValue}>{user.role}</Text>
                      </View>

                      <View>
                        <Text style={styles.detailLabel}>Approved</Text>
                        <Text style={styles.detailValue}>{user.approved ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>

                    <View style={styles.cardSpacer} />

                    <View style={styles.actions}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => {
                          router.push({
                            pathname: '/admin-users/edit',
                            params: { id: user.id },
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${user.full_name}`}
                      >
                        <Text style={styles.secondaryButtonText}>Edit</Text>
                      </Pressable>

                      {user.status === 'Pending' && !isCurrentUser && (
                        <Pressable
                          style={styles.activationButton}
                          onPress={() => generateActivationCode(user)}
                          disabled={activationLoading}
                          accessibilityRole="button"
                          accessibilityLabel={`Generate activation code for ${user.full_name}`}
                        >
                          <Text style={styles.activationButtonText}>
                            {activationLoading ? 'Generating...' : 'Activation Code'}
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={[
                          styles.secondaryButton,
                          user.status === 'Disabled' && styles.enableButton,
                        ]}
                        onPress={() => {
                          if (user.id === profile?.id) {
                            modal.show(
                              'Action Not Allowed',
                              'You cannot disable your own administrator account.'
                            );
                            return;
                          }

                          const nextStatus = user.status === 'Active' ? 'Disabled' : 'Active';

                          setStatusConfirmUser(user);
                          setStatusConfirmNextStatus(nextStatus);
                          setStatusConfirmVisible(true);
                        }}
                        disabled={statusUpdating}
                        accessibilityRole="button"
                        accessibilityLabel={
                          user.status === 'Disabled'
                            ? `Enable ${user.full_name}`
                            : `Disable ${user.full_name}`
                        }
                      >
                        <Text style={styles.secondaryButtonText}>
                          {user.status === 'Disabled' ? 'Enable' : 'Disable'}
                        </Text>
                      </Pressable>

                      {!isCurrentUser && user.role !== 'Super Admin' && (
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => openSetPasswordModal(user)}
                          accessibilityRole="button"
                          accessibilityLabel={`Set password for ${user.full_name}`}
                        >
                          <Text style={styles.secondaryButtonText}>Set Password</Text>
                        </Pressable>
                      )}

                      {!isCurrentUser && (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => {
                            setDeleteUser(user);
                            setDeleteModalVisible(true);
                          }}
                          disabled={deleteLoading}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${user.full_name}`}
                        >
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ================================ PAGINATION ================================ */}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrev={() => setPage(currentPage - 1)}
            onNext={() => setPage(currentPage + 1)}
          />
        )}
      </ScrollView>

      {/* ================================ ACTIVATION CODE ================================ */}

      {activationModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.activationCard}>
            <Text style={styles.confirmTitle}>Activation Code</Text>

            <Text style={styles.confirmMessage}>
              {activationUser?.full_name
                ? `A new activation code has been generated for ${activationUser.full_name}. Give it to them directly — the previous code no longer works.`
                : 'A new activation code has been generated.'}
            </Text>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Administrator Name</Text>
              <Text style={styles.activationFieldValue}>{activationUser?.full_name ?? '—'}</Text>
            </View>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Email</Text>
              <Text style={styles.activationFieldValue}>{activationEmail || '—'}</Text>
            </View>

            <View style={styles.activationField}>
              <Text style={styles.activationFieldLabel}>Role</Text>
              <Text style={styles.activationFieldValue}>{activationUser?.role ?? '—'}</Text>
            </View>

            <Text style={styles.passwordLabel}>Activation Code</Text>

            <View style={styles.activationCodeContainer}>
              <Text style={styles.activationCodeText} selectable>
                {activationCode}
              </Text>
            </View>

            <Text style={styles.activationExpiry}>
              Expires: {formatExpiresAt(activationExpiresAt)}
            </Text>

            <Pressable
              style={styles.copyActivationButton}
              onPress={copyActivationCode}
              disabled={!activationCode}
              accessibilityRole="button"
              accessibilityLabel="Copy activation code"
            >
              <Text style={styles.copyActivationButtonText}>
                {activationCopied ? 'Copied!' : 'Copy Activation Code'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.closeActivationButton}
              onPress={() => {
                setActivationModalVisible(false);
                setActivationUser(null);
                setActivationEmail('');
                setActivationCode('');
                setActivationExpiresAt('');
                setActivationCopied(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeActivationText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================================ SET PASSWORD ================================ */}

      {passwordModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.activationCard}>
            <Text style={styles.confirmTitle}>Set Password</Text>

            <Text style={styles.confirmMessage}>
              {passwordUser?.full_name
                ? `Set a password for ${passwordUser.full_name} directly, skipping the invitation link. Share it with them yourself — they can sign in with it right away.`
                : 'Set a password directly, skipping the invitation link.'}
            </Text>

            <Text style={styles.passwordLabel}>New Password</Text>

            <TextInput
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!passwordSaving}
              accessibilityLabel="New password"
            />

            <Text style={styles.passwordLabel}>Confirm Password</Text>

            <TextInput
              style={styles.passwordInput}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!passwordSaving}
              accessibilityLabel="Confirm new password"
            />

            <Pressable
              style={[styles.copyActivationButton, passwordSaving && styles.savePasswordButtonDisabled]}
              onPress={confirmSetPassword}
              disabled={passwordSaving}
              accessibilityRole="button"
              accessibilityLabel="Save password"
            >
              <Text style={styles.copyActivationButtonText}>
                {passwordSaving ? 'Saving...' : 'Save Password'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.closeActivationButton}
              onPress={() => {
                if (passwordSaving) return;
                setPasswordModalVisible(false);
                setPasswordUser(null);
                setNewPassword('');
                setConfirmNewPassword('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.closeActivationText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================================ DELETE CONFIRMATION ================================ */}

      <ConfirmDialog
        visible={deleteModalVisible && !!deleteUser}
        title="Delete Administrator"
        message={
          deleteUser
            ? `Permanently delete ${deleteUser.full_name}'s administrator account? This cannot be undone.`
            : ''
        }
        actionText={deleteLoading ? 'Deleting...' : 'Delete'}
        actionVariant="danger"
        loading={deleteLoading}
        onCancel={() => {
          if (deleteLoading) return;
          setDeleteModalVisible(false);
          setDeleteUser(null);
        }}
        onConfirm={confirmDeleteAdmin}
      />

      {/* ================================ STATUS CONFIRMATION ================================ */}

      <ConfirmDialog
        visible={statusConfirmVisible && !!statusConfirmUser && !!statusConfirmNextStatus}
        title={
          statusConfirmNextStatus === 'Disabled' ? 'Disable Administrator' : 'Enable Administrator'
        }
        message={
          statusConfirmUser
            ? statusConfirmNextStatus === 'Disabled'
              ? `Disable ${statusConfirmUser.full_name}'s administrator account? They will no longer be able to access the dashboard.`
              : `Enable ${statusConfirmUser.full_name}'s administrator account?`
            : ''
        }
        actionText={
          statusUpdating ? 'Updating...' : statusConfirmNextStatus === 'Disabled' ? 'Disable' : 'Enable'
        }
        actionVariant={statusConfirmNextStatus === 'Disabled' ? 'danger' : 'success'}
        loading={statusUpdating}
        onCancel={() => {
          if (statusUpdating) return;
          setStatusConfirmVisible(false);
          setStatusConfirmUser(null);
          setStatusConfirmNextStatus(null);
        }}
        onConfirm={confirmStatusChange}
      />

      {/* ================================ POPUP ================================ */}

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

/*
 * ----------------------------------------
 * Status style helpers
 * ----------------------------------------
 */

function getStatusBadgeStyle(status: AdminStatus) {
  switch (status) {
    case 'Active':
      return { backgroundColor: colors.adminStatusActiveBg };
    case 'Pending':
      return { backgroundColor: colors.adminStatusPendingBg };
    case 'Disabled':
      return { backgroundColor: colors.adminStatusDisabledBg };
    default:
      return {};
  }
}

function getStatusTextStyle(status: AdminStatus) {
  switch (status) {
    case 'Active':
      return { color: colors.adminStatusActiveText };
    case 'Pending':
      return { color: colors.adminStatusPendingText };
    case 'Disabled':
      return { color: colors.adminStatusDisabledText };
    default:
      return {};
  }
}

/*
 * ----------------------------------------
 * Styles
 * ----------------------------------------
 */

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
    flexDirection: 'column',
    marginBottom: 24,
    gap: 16,
  },

  headerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerText: {
    flex: 1,
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

  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.sm,
  },

  addButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  searchContainer: {
    marginBottom: 14,
  },

  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    zIndex: 1000,
  },

  currentUserCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 25,
  },

  currentUserLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  currentUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },

  currentUserRole: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },

  countRow: {
    flexDirection: 'column',
    marginBottom: 12,
    gap: 4,
  },

  countRowWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  countText: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  loadingContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 40,
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 30,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },

  emptyButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 18,
  },

  emptyButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  confirmMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
  },

  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -8,
  },

  usersGridItem: {
    width: '50%',
    paddingHorizontal: 8,
  },

  userCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  userCardWide: {
    flex: 1,
  },

  cardSpacer: {
    flex: 1,
  },

  userTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
  },

  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  currentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  userDetails: {
    flexDirection: 'row',
    gap: 50,
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },

  detailLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLabel,
  },

  activationCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 20,
  },

  activationButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  activationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },

  activationField: {
    marginTop: 12,
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

  activationCodeContainer: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 14,
    alignItems: 'center',
  },

  activationCodeText: {
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

  passwordLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLabel,
    marginTop: 16,
    marginBottom: 8,
  },

  passwordInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  savePasswordButtonDisabled: {
    opacity: 0.6,
  },

  copyActivationButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  copyActivationButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },

  closeActivationButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },

  closeActivationText: {
    color: colors.textLabel,
    fontSize: 13,
    fontWeight: '600',
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  enableButton: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },

  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLabel,
  },

  deleteButton: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },

  backLink: {
    alignItems: 'center',
    marginTop: 25,
    paddingVertical: 12,
  },

  backLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 20,
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