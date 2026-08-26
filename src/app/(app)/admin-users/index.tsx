import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type AdminRole = 'Super Admin' | 'Viewer';

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

export default function AdminUsersScreen() {
  const {
    profile,
    isSuperAdmin,
  } = useAuth();

  const [users, setUsers] =
    useState<AdminProfile[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ----------------------------------------
  // Search & Filters
  // ----------------------------------------

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<'All' | AdminStatus>('All');

  const [roleFilter, setRoleFilter] =
    useState<'All' | AdminRole>('All');

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState('');

  const [modalMessage, setModalMessage] =
    useState('');

  const [statusConfirmVisible, setStatusConfirmVisible] =
    useState(false);

  const [statusConfirmUser, setStatusConfirmUser] =
    useState<AdminProfile | null>(null);

  const [statusConfirmNextStatus, setStatusConfirmNextStatus] =
    useState<'Active' | 'Disabled' | null>(null);

  const [statusUpdating, setStatusUpdating] =
    useState(false);

  // ----------------------------------------
  // Activation Link
  // ----------------------------------------

  const [activationModalVisible, setActivationModalVisible] =
    useState(false);

  const [activationUser, setActivationUser] =
    useState<AdminProfile | null>(null);

  const [activationLink, setActivationLink] =
    useState('');

  const [activationLoading, setActivationLoading] =
    useState(false);

  const [activationCopied, setActivationCopied] =
    useState(false);

  // ----------------------------------------
  // Delete Administrator
  // ----------------------------------------

  const [deleteModalVisible, setDeleteModalVisible] =
    useState(false);

  const [deleteUser, setDeleteUser] =
    useState<AdminProfile | null>(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  async function loadUsers() {
    setLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
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
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Failed to load admin users:',
          error
        );

        showModal(
          'Unable to Load Users',
          'We could not load the administrator accounts. Please try again.'
        );

        return;
      }

      setUsers(
        (data ?? []) as AdminProfile[]
      );
    } catch (error) {
      console.error(
        'Unexpected error loading users:',
        error
      );

      showModal(
        'Error',
        'Something went wrong while loading administrator accounts.'
      );
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
  }, [isSuperAdmin]);

  // ----------------------------------------
  // Confirm status change
  // ----------------------------------------

  async function confirmStatusChange() {
    if (
      !statusConfirmUser ||
      !statusConfirmNextStatus ||
      statusUpdating
    ) {
      return;
    }

    const targetUser =
      statusConfirmUser;

    const nextStatus =
      statusConfirmNextStatus;

    try {
      setStatusUpdating(true);

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'set-admin-status',
          {
            body: {
              admin_id:
                targetUser.id,
              status:
                nextStatus,
            },
          }
        );

      if (error) {
        console.error(
          '[ADMIN STATUS] Update error:',
          error
        );

        let message =
          error.message ||
          'Unable to update administrator status.';

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

        setStatusConfirmVisible(false);

        showModal(
          'Update Failed',
          message
        );

        return;
      }

      if (!data?.success) {
        setStatusConfirmVisible(false);

        showModal(
          'Update Failed',
          data?.error ??
            'Unable to update administrator status.'
        );

        return;
      }

      setStatusConfirmVisible(false);
      setStatusConfirmUser(null);
      setStatusConfirmNextStatus(null);

      await loadUsers();

      showModal(
        nextStatus === 'Disabled'
          ? 'Administrator Disabled'
          : 'Administrator Enabled',
        `${targetUser.full_name}'s administrator account is now ${nextStatus.toLowerCase()}.`
      );
    } catch (error) {
      console.error(
        '[ADMIN STATUS] Unexpected error:',
        error
      );

      setStatusConfirmVisible(false);

      showModal(
        'Update Failed',
        'Something went wrong while updating the administrator status.'
      );
    } finally {
      setStatusUpdating(false);
    }
  }

  // ----------------------------------------
  // Generate activation link
  // ----------------------------------------

  async function generateActivationLink(
    user: AdminProfile
  ) {
    if (activationLoading) {
      return;
    }

    if (user.id === profile?.id) {
      showModal(
        'Action Not Allowed',
        'You cannot generate an activation link for your own administrator account.'
      );
      return;
    }

    if (user.status !== 'Pending') {
      showModal(
        'Activation Link Unavailable',
        'An activation link can only be generated for a Pending administrator account.'
      );
      return;
    }

    try {
      setActivationLoading(true);
      setActivationCopied(false);

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'resend-admin-invite',
          {
            body: {
              admin_id:
                user.id,
            },
          }
        );

      if (error) {
        console.error(
          '[ADMIN INVITE] Generate link error:',
          error
        );

        let message =
          error.message ||
          'Unable to generate the activation link.';

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
          // Keep the original message.
        }

        showModal(
          'Activation Link Failed',
          message
        );

        return;
      }

      if (!data?.success) {
        showModal(
          'Activation Link Failed',
          data?.error ??
            'Unable to generate the activation link.'
        );

        return;
      }

      setActivationUser(user);

      setActivationLink(
        data.activation_link ?? ''
      );

      setActivationModalVisible(true);
    } catch (error) {
      console.error(
        '[ADMIN INVITE] Unexpected error:',
        error
      );

      showModal(
        'Activation Link Failed',
        'Something went wrong while generating the activation link.'
      );
    } finally {
      setActivationLoading(false);
    }
  }

  async function copyActivationLink() {
    if (!activationLink) {
      return;
    }

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          activationLink
        );

        setActivationCopied(true);
        return;
      }

      showModal(
        'Copy Failed',
        'Your browser does not allow clipboard access here. Please copy the link manually.'
      );
    } catch (error) {
      console.error(
        '[ADMIN INVITE] Clipboard error:',
        error
      );

      showModal(
        'Copy Failed',
        'We could not copy the activation link. Please copy it manually.'
      );
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

      showModal(
        'Action Not Allowed',
        'You cannot delete your own administrator account.'
      );

      return;
    }

    try {
      setDeleteLoading(true);

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'delete-admin-user',
          {
            body: {
              admin_id: targetUser.id,
            },
          }
        );

      if (error) {
        console.error(
          '[ADMIN DELETE] Delete error:',
          error
        );

        let message =
          error.message ||
          'Unable to delete the administrator account.';

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
          // Keep original message.
        }

        setDeleteModalVisible(false);
        setDeleteUser(null);

        showModal(
          'Delete Failed',
          message
        );

        return;
      }

      if (!data?.success) {
        setDeleteModalVisible(false);
        setDeleteUser(null);

        showModal(
          'Delete Failed',
          data?.error ??
            'Unable to delete the administrator account.'
        );

        return;
      }

      setDeleteModalVisible(false);
      setDeleteUser(null);

      await loadUsers();

      showModal(
        'Administrator Deleted',
        `${targetUser.full_name}'s administrator account has been permanently deleted.`
      );
    } catch (error) {
      console.error(
        '[ADMIN DELETE] Unexpected error:',
        error
      );

      setDeleteModalVisible(false);
      setDeleteUser(null);

      showModal(
        'Delete Failed',
        'Something went wrong while deleting the administrator account.'
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  // ----------------------------------------
  // Filtered users
  // ----------------------------------------

  const normalizedSearch =
    search.trim().toLowerCase();

  const filteredUsers =
    users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.full_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        user.role
          .toLowerCase()
          .includes(normalizedSearch) ||
        user.status
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'All' ||
        user.status === statusFilter;

      const matchesRole =
        roleFilter === 'All' ||
        user.role === roleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole
      );
    });

  if (!isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Only Super Admin can manage administrator
          accounts.
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

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              Admin Users
            </Text>

            <Text style={styles.subtitle}>
              Manage users who can access the church
              administration system.
            </Text>
          </View>

          <Link
            href="/(app)/admin-users/add"
            asChild
          >
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>
                + Add User
              </Text>
            </Pressable>
          </Link>
        </View>

        {/* Current user */}
        {profile && (
          <View style={styles.currentUserCard}>
            <Text style={styles.currentUserLabel}>
              You are signed in as
            </Text>

            <Text style={styles.currentUserName}>
              {profile.full_name}
            </Text>

            <Text style={styles.currentUserRole}>
              {profile.role}
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search administrators..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>
            Status
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['All', 'Active', 'Pending', 'Disabled'] as const).map(
              (item) => {
                const selected =
                  statusFilter === item;

                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.filterChip,
                      selected &&
                        styles.filterChipSelected,
                    ]}
                    onPress={() =>
                      setStatusFilter(item)
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected &&
                          styles.filterChipTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>

          <Text style={styles.filterLabel}>
            Role
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(
              [
                'All',
                'Super Admin',
                'Viewer',
              ] as const
            ).map((item) => {
              const selected =
                roleFilter === item;

              return (
                <Pressable
                  key={item}
                  style={[
                    styles.filterChip,
                    selected &&
                      styles.filterChipSelected,
                  ]}
                  onPress={() =>
                    setRoleFilter(item)
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected &&
                        styles.filterChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* User Count */}
        <View style={styles.countRow}>
          <Text style={styles.sectionTitle}>
            Administrator Accounts
          </Text>

          <Text style={styles.countText}>
            {filteredUsers.length} of {users.length}{' '}
            {users.length === 1
              ? 'user'
              : 'users'}
          </Text>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
            />

            <Text style={styles.loadingText}>
              Loading users...
            </Text>
          </View>
        )}

        {/* Empty */}
        {!loading &&
          users.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No administrator accounts
              </Text>

              <Text style={styles.emptyText}>
                There are currently no administrator
                profiles in the system.
              </Text>

              <Link
                href="/(app)/admin-users/add"
                asChild
              >
                <Pressable
                  style={styles.emptyButton}
                >
                  <Text
                    style={styles.emptyButtonText}
                  >
                    Add First User
                  </Text>
                </Pressable>
              </Link>
            </View>
          )}

        {/* Filtered Empty */}
        {!loading &&
          users.length > 0 &&
          filteredUsers.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No matching administrators
              </Text>

              <Text style={styles.emptyText}>
                Try changing the search text or filters.
              </Text>

              <Pressable
                style={styles.emptyButton}
                onPress={() => {
                  setSearch('');
                  setStatusFilter('All');
                  setRoleFilter('All');
                }}
              >
                <Text style={styles.emptyButtonText}>
                  Clear Filters
                </Text>
              </Pressable>
            </View>
          )}

        {/* Users */}
        {!loading &&
          filteredUsers.map((user) => {
            const isCurrentUser =
              user.id === profile?.id;

            return (
              <View
                key={user.id}
                style={styles.userCard}
              >
                {/* User Information */}
                <View style={styles.userTop}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.full_name}
                    </Text>

                    {isCurrentUser && (
                      <Text
                        style={styles.currentBadge}
                      >
                        You
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(
                        user.status
                      ),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextStyle(
                          user.status
                        ),
                      ]}
                    >
                      {user.status}
                    </Text>
                  </View>
                </View>

                {/* Role */}
                <View style={styles.userDetails}>
                  <View>
                    <Text style={styles.detailLabel}>
                      Role
                    </Text>

                    <Text style={styles.detailValue}>
                      {user.role}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.detailLabel}>
                      Approved
                    </Text>

                    <Text style={styles.detailValue}>
                      {user.approved
                        ? 'Yes'
                        : 'No'}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      router.push({
                        pathname: '/admin-users/edit',
                        params: {
                          id: user.id,
                        },
                      });
                    }}
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      Edit
                    </Text>
                  </Pressable>

                  {user.status === 'Pending' &&
                    !isCurrentUser && (
                      <Pressable
                        style={styles.activationButton}
                        onPress={() =>
                          generateActivationLink(user)
                        }
                        disabled={activationLoading}
                      >
                        <Text
                          style={
                            styles.activationButtonText
                          }
                        >
                          {activationLoading
                            ? 'Generating...'
                            : 'Activation Link'}
                        </Text>
                      </Pressable>
                    )}

                  <Pressable
                    style={[
                      styles.secondaryButton,
                      user.status === 'Disabled' &&
                        styles.enableButton,
                    ]}
                    onPress={() => {
                      if (user.id === profile?.id) {
                        showModal(
                          'Action Not Allowed',
                          'You cannot disable your own administrator account.'
                        );
                        return;
                      }

                      const nextStatus =
                        user.status === 'Active'
                          ? 'Disabled'
                          : 'Active';

                      setStatusConfirmUser(user);
                      setStatusConfirmNextStatus(nextStatus);
                      setStatusConfirmVisible(true);
                    }}
                    disabled={statusUpdating}
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      {user.status ===
                      'Disabled'
                        ? 'Enable'
                        : 'Disable'}
                    </Text>
                  </Pressable>

                  {!isCurrentUser && (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => {
                        setDeleteUser(user);
                        setDeleteModalVisible(true);
                      }}
                      disabled={deleteLoading}
                    >
                      <Text
                        style={
                          styles.deleteButtonText
                        }
                      >
                        Delete
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

        {/* Back */}
        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={styles.backLinkText}>
            ← Back to Dashboard
          </Text>
        </Pressable>
      </ScrollView>

      {/* Activation Link */}
      {activationModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.activationCard}>
            <Text style={styles.confirmTitle}>
              Activation Link
            </Text>

            <Text style={styles.confirmMessage}>
              {activationUser?.full_name
                ? `A new activation link has been generated for ${activationUser.full_name}.`
                : 'A new activation link has been generated.'}
            </Text>

            <TextInput
              style={styles.activationLinkInput}
              value={activationLink}
              editable={false}
              multiline
              selectTextOnFocus
            />

            <Pressable
              style={styles.copyActivationButton}
              onPress={copyActivationLink}
              disabled={!activationLink}
            >
              <Text
                style={styles.copyActivationButtonText}
              >
                {activationCopied
                  ? 'Copied!'
                  : 'Copy Activation Link'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.confirmCancelButton}
              onPress={() => {
                setActivationModalVisible(false);
                setActivationUser(null);
                setActivationLink('');
                setActivationCopied(false);
              }}
            >
              <Text style={styles.confirmCancelText}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Delete Confirmation */}
      {deleteModalVisible &&
        deleteUser && (
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                Delete Administrator
              </Text>

              <Text style={styles.confirmMessage}>
                {`Permanently delete ${deleteUser.full_name}'s administrator account? This cannot be undone.`}
              </Text>

              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.confirmCancelButton}
                  onPress={() => {
                    if (deleteLoading) {
                      return;
                    }

                    setDeleteModalVisible(false);
                    setDeleteUser(null);
                  }}
                  disabled={deleteLoading}
                >
                  <Text style={styles.confirmCancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmActionButton,
                    styles.confirmDeleteButton,
                    deleteLoading &&
                      styles.buttonDisabled,
                  ]}
                  onPress={confirmDeleteAdmin}
                  disabled={deleteLoading}
                >
                  <Text style={styles.confirmActionText}>
                    {deleteLoading
                      ? 'Deleting...'
                      : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

      {/* Status Confirmation */}
      {statusConfirmVisible &&
        statusConfirmUser &&
        statusConfirmNextStatus && (
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>
                {statusConfirmNextStatus === 'Disabled'
                  ? 'Disable Administrator'
                  : 'Enable Administrator'}
              </Text>

              <Text style={styles.confirmMessage}>
                {statusConfirmNextStatus === 'Disabled'
                  ? `Disable ${statusConfirmUser.full_name}'s administrator account? They will no longer be able to access the dashboard.`
                  : `Enable ${statusConfirmUser.full_name}'s administrator account?`}
              </Text>

              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.confirmCancelButton}
                  onPress={() => {
                    if (statusUpdating) {
                      return;
                    }

                    setStatusConfirmVisible(false);
                    setStatusConfirmUser(null);
                    setStatusConfirmNextStatus(null);
                  }}
                  disabled={statusUpdating}
                >
                  <Text style={styles.confirmCancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmActionButton,
                    statusConfirmNextStatus === 'Disabled'
                      ? styles.confirmDisableButton
                      : styles.confirmEnableButton,
                    statusUpdating &&
                      styles.buttonDisabled,
                  ]}
                  onPress={confirmStatusChange}
                  disabled={statusUpdating}
                >
                  <Text style={styles.confirmActionText}>
                    {statusUpdating
                      ? 'Updating...'
                      : statusConfirmNextStatus === 'Disabled'
                        ? 'Disable'
                        : 'Enable'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

      {/* Popup */}
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

/*
 * ----------------------------------------
 * Status Styles
 * ----------------------------------------
 */

function getStatusStyle(
  status: AdminStatus
) {
  switch (status) {
    case 'Active':
      return styles.statusActive;

    case 'Pending':
      return styles.statusPending;

    case 'Disabled':
      return styles.statusDisabled;

    default:
      return {};
  }
}

function getStatusTextStyle(
  status: AdminStatus
) {
  switch (status) {
    case 'Active':
      return styles.statusActiveText;

    case 'Pending':
      return styles.statusPendingText;

    case 'Disabled':
      return styles.statusDisabledText;

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
    backgroundColor: '#f8fafc',
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 60,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 20,
  },

  headerText: {
    flex: 1,
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

  addButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
  },

  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  searchContainer: {
    marginBottom: 14,
  },

  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  filterSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
  },

  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },

  filterChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },

  filterChipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },

  filterChipTextSelected: {
    color: '#ffffff',
  },

  currentUserCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 18,
    marginBottom: 25,
  },

  currentUserLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  currentUserName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },

  currentUserRole: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 3,
  },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  countText: {
    fontSize: 13,
    color: '#6b7280',
  },

  loadingContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },

  emptyButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 18,
  },

  emptyButtonText: {
    color: '#ffffff',
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

  confirmCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  confirmMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
    marginTop: 8,
  },

  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },

  confirmCancelButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  confirmCancelText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },

  confirmActionButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  confirmDeleteButton: {
    backgroundColor: '#dc2626',
  },

  confirmDisableButton: {
    backgroundColor: '#dc2626',
  },

  confirmEnableButton: {
    backgroundColor: '#15803d',
  },

  confirmActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  userCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
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
    color: '#111827',
  },

  currentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
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

  statusActive: {
    backgroundColor: '#ecfdf5',
  },

  statusActiveText: {
    color: '#047857',
  },

  statusPending: {
    backgroundColor: '#fffbeb',
  },

  statusPendingText: {
    color: '#b45309',
  },

  statusDisabled: {
    backgroundColor: '#fef2f2',
  },

  statusDisabledText: {
    color: '#b91c1c',
  },

  userDetails: {
    flexDirection: 'row',
    gap: 50,
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  detailLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 3,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  activationCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
  },

  activationButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  activationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },

  activationLinkInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#374151',
    backgroundColor: '#f9fafb',
    textAlignVertical: 'top',
  },

  copyActivationButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  copyActivationButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  enableButton: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },

  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  deleteButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },

  backLink: {
    alignItems: 'center',
    marginTop: 25,
    paddingVertical: 12,
  },

  backLinkText: {
    fontSize: 14,
    color: '#6b7280',
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
    color: '#111827',
  },

  deniedText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
