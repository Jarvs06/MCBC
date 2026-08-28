import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppModal from '@/components/AppModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppModal } from '@/hooks/useAppModal';
import { formatMemberName, normalizeOptionalText } from '@/lib/memberHelpers';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/types/member';

/*
 * "NOT MENTIONED" is treated as blank on this page so imported
 * placeholder values are never shown to the user.
 */
function cleanDisplayValue(value: string | null | undefined): string | null {
  return normalizeOptionalText(value) || null;
}

export default function MemberDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSuperAdmin, isViewer, isActive } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [spouse, setSpouse] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const modal = useAppModal();

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setLoading(false);
      return;
    }

    if (!id) {
      modal.show('Member Not Found', 'No member ID was provided.');
      setLoading(false);
      return;
    }

    loadMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isActive]);

  /*
   * ----------------------------------------
   * Decrypt member data
   * ----------------------------------------
   */

  async function decryptMembers(encryptedMembers: Record<string, unknown>[]): Promise<Member[]> {
    const { data, error } = await supabase.functions.invoke('member-crypto', {
      body: {
        action: 'decrypt',
        data: encryptedMembers,
      },
    });

    if (error) {
      console.error('[MEMBER DETAILS] Decryption failed:', error);
      throw new Error('The member information could not be decrypted.');
    }

    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response from member-crypto.');
    }

    return data.data as Member[];
  }

  /*
   * ----------------------------------------
   * Load member
   * ----------------------------------------
   */

  async function loadMember() {
    try {
      setLoading(true);
      setMember(null);
      setSpouse(null);

      const { data, error } = await supabase.from('members').select('*').eq('id', id).single();

      if (error) {
        console.error('[MEMBER DETAILS] Failed to load member:', error);

        modal.show(
          'Unable to Load Member',
          'The member could not be loaded. You may not have permission to view this record, or the record may no longer exist.'
        );

        return;
      }

      /*
       * --------------------------------------
       * Decrypt main member
       * --------------------------------------
       */

      let decryptedMembers: Member[];

      try {
        decryptedMembers = await decryptMembers([data as Record<string, unknown>]);
      } catch (cryptoError) {
        console.error('[MEMBER DETAILS] Member decryption error:', cryptoError);

        modal.show(
          'Decryption Failed',
          'The member information could not be decrypted. Please try again or contact a Super Admin.'
        );

        return;
      }

      const decryptedMember = decryptedMembers[0];

      if (!decryptedMember) {
        modal.show('Unable to Load Member', 'The member information could not be decrypted.');
        return;
      }

      setMember(decryptedMember);

      /*
       * --------------------------------------
       * Load spouse
       * --------------------------------------
       */

      if (data.spouse_id) {
        const { data: spouseData, error: spouseError } = await supabase
          .from('members')
          .select('*')
          .eq('id', data.spouse_id)
          .single();

        if (!spouseError && spouseData) {
          try {
            const decryptedSpouse = await decryptMembers([spouseData as Record<string, unknown>]);

            if (decryptedSpouse[0]) {
              setSpouse(decryptedSpouse[0]);
            }
          } catch (cryptoError) {
            console.error('[MEMBER DETAILS] Spouse decryption failed:', cryptoError);

            /*
             * Don't prevent the main member from displaying if
             * spouse decryption fails.
             */
            setSpouse(null);
          }
        }
      } else {
        setSpouse(null);
      }
    } catch (error) {
      console.error('[MEMBER DETAILS] Unexpected member loading error:', error);
      modal.show('Error', 'Something went wrong while loading the member. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /*
   * ----------------------------------------
   * Delete member
   * ----------------------------------------
   */

  async function handleDeleteMember() {
    if (!isActive || !isSuperAdmin) {
      setDeleteModalVisible(false);
      modal.show('Access Denied', 'Only an active Super Admin can delete members.');
      return;
    }

    if (!member?.id) {
      setDeleteModalVisible(false);
      modal.show('Unable to Delete Member', 'The member could not be identified.');
      return;
    }

    if (deleting) {
      return;
    }

    try {
      setDeleting(true);

      const { data, error } = await supabase.functions.invoke('delete-member', {
        body: { member_id: member.id },
      });

      if (error) {
        console.error('[MEMBER DETAILS] Delete member error:', error);

        setDeleteModalVisible(false);
        modal.show('Unable to Delete Member', 'The member could not be deleted. Please try again.');

        return;
      }

      if (!data || data.success !== true) {
        console.error('[MEMBER DETAILS] Invalid delete-member response:', data);

        setDeleteModalVisible(false);
        modal.show('Unable to Delete Member', 'The member could not be deleted. Please try again.');

        return;
      }

      setDeleteModalVisible(false);

      /*
       * The member no longer exists, so return to the member list
       * after successful deletion.
       */
      router.replace('/members');
    } catch (error) {
      console.error('[MEMBER DETAILS] Unexpected delete error:', error);

      setDeleteModalVisible(false);
      modal.show('Unable to Delete Member', 'Something went wrong while deleting the member. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  /*
   * ----------------------------------------
   * Format date
   * ----------------------------------------
   */

  function formatDate(date: string | null) {
    const cleanedDate = cleanDisplayValue(date);

    if (!cleanedDate) {
      return '—';
    }

    const parsed = new Date(`${cleanedDate}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return cleanedDate;
    }

    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /*
   * ----------------------------------------
   * Access control
   * ----------------------------------------
   *
   * The app layout already protects the authenticated
   * application, but this screen also checks the account status
   * before allowing member data to be displayed or decrypted.
   */

  if (!isActive) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Access Denied</Text>

        <Text style={styles.emptyText}>
          Your administrator account is not active. You cannot view member records.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading member...</Text>
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Member Not Found</Text>
        <Text style={styles.emptyText}>The member could not be found.</Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.push({ pathname: '/(app)/members' })}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const fullName = formatMemberName(member);

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{fullName}</Text>

            {member.member_no && <Text style={styles.memberNumber}>Member No. {member.member_no}</Text>}
          </View>

          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/members')}
            accessibilityRole="button"
            accessibilityLabel="Back to members"
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        {/* Status */}

        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{member.status}</Text>
          </View>

          {member.baptized && (
            <View style={styles.baptizedBadge}>
              <Text style={styles.baptizedText}>Baptized</Text>
            </View>
          )}
        </View>

        {/* Personal Information */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <InfoRow label="First Name" value={member.first_name} />
          <InfoRow label="Middle Name" value={member.middle_name} />
          <InfoRow label="Last Name" value={member.last_name} />
          <InfoRow label="Suffix" value={member.suffix} />
          <InfoRow label="Birth Date" value={formatDate(member.birth_date)} />
          <InfoRow label="Gender" value={member.gender} />
        </View>

        {/* Church Information */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Church Information</Text>

          <InfoRow label="Member Group" value={member.member_group} />
          <InfoRow label="Ministry" value={member.ministry} />
          <InfoRow label="Baptized" value={member.baptized ? 'Yes' : 'No'} />
          <InfoRow label="Status" value={member.status} />
        </View>

        {/* Family Information */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Family Information</Text>

          <InfoRow label="Spouse" value={spouse ? formatMemberName(spouse) : 'None'} />
          <InfoRow label="Wedding Anniversary" value={formatDate(member.wedding_date)} />
        </View>

        {/* Contact Information */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>

          <InfoRow label="Contact No." value={member.contact_no} />
          <InfoRow label="Address" value={member.address} />
        </View>

        {/* Actions */}

        {isActive && isSuperAdmin && (
          <View style={styles.actions}>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                router.push({
                  pathname: '/(app)/members/edit',
                  params: { id: member.id },
                });
              }}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Edit member"
            >
              <Text style={styles.editButtonText}>Edit Member</Text>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => setDeleteModalVisible(true)}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete member"
            >
              <Text style={styles.deleteButtonText}>Delete Member</Text>
            </Pressable>
          </View>
        )}

        {isViewer && (
          <View style={styles.viewerNotice}>
            <Text style={styles.viewerNoticeTitle}>Viewer Access</Text>

            <Text style={styles.viewerNoticeText}>
              You can view this member's information, but you cannot edit or delete member records.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete confirmation */}

      <ConfirmDialog
        visible={deleteModalVisible}
        title="Delete Member"
        message={`Are you sure you want to permanently delete ${fullName}? This action cannot be undone.`}
        actionText={deleting ? 'Deleting...' : 'Delete'}
        actionVariant="danger"
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setDeleteModalVisible(false);
          }
        }}
        onConfirm={handleDeleteMember}
      />

      {/* Info modal */}

      <AppModal visible={modal.visible} title={modal.title} message={modal.message} buttonText="OK" onClose={modal.hide} />
    </View>
  );
}

/*
 * ==========================================
 * INFO ROW
 * ==========================================
 */

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{cleanDisplayValue(value) ?? '—'}</Text>
    </View>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 20,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  memberNumber: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 5,
  },

  backButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  backButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },

  statusBadge: {
    backgroundColor: colors.statusInactiveBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },

  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.statusInactiveText,
  },

  baptizedBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },

  baptizedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.statusInactiveBg,
  },

  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  infoValue: {
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 4,
  },

  actions: {
    marginTop: 4,
    marginBottom: 16,
  },

  editButton: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },

  editButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },

  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },

  deleteButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },

  viewerNotice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 18,
  },

  viewerNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  viewerNoticeText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },
});
