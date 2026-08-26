import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import AppModal from '@/components/AppModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Member = {
  id: string;
  member_no: string | null;

  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;

  birth_date: string | null;
  gender: string | null;

  spouse_id: string | null;
  wedding_date: string | null;

  address: string | null;
  contact_no: string | null;

  baptized: boolean;

  status: string;
  member_group: string;
  ministry: string | null;

  created_at: string;
  updated_at: string;
};

/*
 * ==========================================
 * DISPLAY NORMALIZATION
 * ==========================================
 *
 * "NOT MENTIONED" is treated as blank on
 * this page so imported placeholder values
 * are never shown to the user.
 */
function cleanDisplayValue(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(/\u00a0/g, ' ')
      .trim();

  if (
    !cleaned ||
    cleaned.toLowerCase() ===
      'not mentioned'
  ) {
    return null;
  }

  return cleaned;
}

export default function MemberDetailsScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const {
    isSuperAdmin,
    isViewer,
    isActive,
  } = useAuth();

  const [member, setMember] =
    useState<Member | null>(null);

  const [spouse, setSpouse] =
    useState<Member | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState('');

  const [modalMessage, setModalMessage] =
    useState('');

  const [deleteModalVisible, setDeleteModalVisible] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  useEffect(() => {
    if (!isActive) {
      setLoading(false);
      return;
    }

    if (!id) {
      showModal(
        'Member Not Found',
        'No member ID was provided.'
      );

      setLoading(false);

      return;
    }

    loadMember();
  }, [id, isActive]);

  /*
   * ----------------------------------------
   * Decrypt member data
   * ----------------------------------------
   */

  async function decryptMembers(
    encryptedMembers: Record<
      string,
      unknown
    >[]
  ): Promise<Member[]> {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'member-crypto',
        {
          body: {
            action: 'decrypt',
            data: encryptedMembers,
          },
        }
      );

    if (error) {
      console.error(
        '[MEMBER DETAILS] Decryption failed:',
        error
      );

      /*
       * Get the actual Edge Function
       * response when available.
       */

      if (
        error instanceof
        FunctionsHttpError
      ) {
        try {
          const response =
            await error.context;

          const responseText =
            await response.text();

          console.error(
            '[MEMBER DETAILS] Edge Function response:',
            responseText
          );

          throw new Error(
            responseText ||
              'The member information could not be decrypted.'
          );
        } catch (readError) {
          console.error(
            '[MEMBER DETAILS] Could not read Edge Function error:',
            readError
          );

          throw readError;
        }
      }

      throw error;
    }

    if (
      !data ||
      !data.data ||
      !Array.isArray(data.data)
    ) {
      throw new Error(
        'Invalid response from member-crypto.'
      );
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

      /*
       * --------------------------------------
       * Load main member
       * --------------------------------------
       */

      const {
        data,
        error,
      } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(
          '[MEMBER DETAILS] Failed to load member:',
          error
        );

        showModal(
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
        decryptedMembers =
          await decryptMembers([
            data as Record<
              string,
              unknown
            >,
          ]);
      } catch (cryptoError) {
        console.error(
          '[MEMBER DETAILS] Member decryption error:',
          cryptoError
        );

        showModal(
          'Decryption Failed',
          'The member information could not be decrypted. Please try again or contact a Super Admin.'
        );

        return;
      }

      const decryptedMember =
        decryptedMembers[0];

      if (!decryptedMember) {
        showModal(
          'Unable to Load Member',
          'The member information could not be decrypted.'
        );

        return;
      }

      setMember(
        decryptedMember
      );

      /*
       * --------------------------------------
       * Load spouse
       * --------------------------------------
       */

      if (data.spouse_id) {
        const {
          data: spouseData,
          error: spouseError,
        } = await supabase
          .from('members')
          .select('*')
          .eq(
            'id',
            data.spouse_id
          )
          .single();

        if (
          !spouseError &&
          spouseData
        ) {
          try {
            const decryptedSpouse =
              await decryptMembers([
                spouseData as Record<
                  string,
                  unknown
                >,
              ]);

            if (
              decryptedSpouse[0]
            ) {
              setSpouse(
                decryptedSpouse[0]
              );
            }
          } catch (cryptoError) {
            console.error(
              '[MEMBER DETAILS] Spouse decryption failed:',
              cryptoError
            );

            /*
             * Don't prevent the main
             * member from displaying if
             * spouse decryption fails.
             */
            setSpouse(null);
          }
        }
      } else {
        setSpouse(null);
      }
    } catch (error) {
      console.error(
        '[MEMBER DETAILS] Unexpected member loading error:',
        error
      );

      showModal(
        'Error',
        'Something went wrong while loading the member. Please try again.'
      );
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

      showModal(
        'Access Denied',
        'Only an active Super Admin can delete members.'
      );

      return;
    }

    if (!member?.id) {
      setDeleteModalVisible(false);

      showModal(
        'Unable to Delete Member',
        'The member could not be identified.'
      );

      return;
    }

    if (deleting) {
      return;
    }

    try {
      setDeleting(true);

      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'delete-member',
          {
            body: {
              member_id: member.id,
            },
          }
        );

      if (error) {
        console.error(
          '[MEMBER DETAILS] Delete member error:',
          error
        );

        setDeleteModalVisible(false);

        showModal(
          'Unable to Delete Member',
          'The member could not be deleted. Please try again.'
        );

        return;
      }

      if (
        !data ||
        data.success !== true
      ) {
        console.error(
          '[MEMBER DETAILS] Invalid delete-member response:',
          data
        );

        setDeleteModalVisible(false);

        showModal(
          'Unable to Delete Member',
          'The member could not be deleted. Please try again.'
        );

        return;
      }

      setDeleteModalVisible(false);

      /*
       * The member no longer exists, so return
       * to the member list after successful
       * deletion.
       */
      router.replace('/members');
    } catch (error) {
      console.error(
        '[MEMBER DETAILS] Unexpected delete error:',
        error
      );

      setDeleteModalVisible(false);

      showModal(
        'Unable to Delete Member',
        'Something went wrong while deleting the member. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  }

  /*
   * ----------------------------------------
   * Format date
   * ----------------------------------------
   */

  function formatDate(
    date: string | null
  ) {
    const cleanedDate =
      cleanDisplayValue(date);

    if (!cleanedDate) {
      return '—';
    }

    const parsed =
      new Date(
        `${cleanedDate}T00:00:00`
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return cleanedDate;
    }

    return parsed.toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    );
  }

  /*
   * ----------------------------------------
   * Full name
   * ----------------------------------------
   */

  function getFullName(
    person: Member
  ) {
    return [
      cleanDisplayValue(
        person.first_name
      ),
      cleanDisplayValue(
        person.middle_name
      ),
      cleanDisplayValue(
        person.last_name
      ),
      cleanDisplayValue(
        person.suffix
      ),
    ]
      .filter(Boolean)
      .join(' ');
  }

  /*
   * ----------------------------------------
   * Access control
   * ----------------------------------------
   *
   * The app layout already protects the
   * authenticated application, but this
   * screen also checks the account status
   * before allowing member data to be
   * displayed or decrypted.
   */

  if (!isActive) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          Access Denied
        </Text>

        <Text style={styles.emptyText}>
          Your administrator account is not
          active. You cannot view member records.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => {
            router.replace('/');
          }}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * ----------------------------------------
   * Loading
   * ----------------------------------------
   */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading member...
        </Text>
      </View>
    );
  }

  /*
   * ----------------------------------------
   * Member not found
   * ----------------------------------------
   */

  if (!member) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          Member Not Found
        </Text>

        <Text style={styles.emptyText}>
          The member could not be found.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => {
            router.push({
              pathname:
                '/(app)/members',
            });
          }}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const fullName =
    getFullName(member);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
      >

        {/* ======================================
            HEADER
        ====================================== */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {fullName}
            </Text>

            {member.member_no && (
              <Text
                style={
                  styles.memberNumber
                }
              >
                Member No.{' '}
                {member.member_no}
              </Text>
            )}
          </View>

          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/members')}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Back
            </Text>
          </Pressable>
        </View>

        {/* ======================================
            STATUS
        ====================================== */}

        <View style={styles.statusRow}>
          <View
            style={
              styles.statusBadge
            }
          >
            <Text
              style={
                styles.statusText
              }
            >
              {member.status}
            </Text>
          </View>

          {member.baptized && (
            <View
              style={
                styles.baptizedBadge
              }
            >
              <Text
                style={
                  styles.baptizedText
                }
              >
                Baptized
              </Text>
            </View>
          )}
        </View>

        {/* ======================================
            PERSONAL INFORMATION
        ====================================== */}

        <View style={styles.card}>
          <Text
            style={styles.cardTitle}
          >
            Personal Information
          </Text>

          <InfoRow
            label="First Name"
            value={
              member.first_name
            }
          />

          <InfoRow
            label="Middle Name"
            value={
              member.middle_name
            }
          />

          <InfoRow
            label="Last Name"
            value={
              member.last_name
            }
          />

          <InfoRow
            label="Suffix"
            value={
              member.suffix
            }
          />

          <InfoRow
            label="Birth Date"
            value={formatDate(
              member.birth_date
            )}
          />

          <InfoRow
            label="Gender"
            value={
              member.gender
            }
          />
        </View>

        {/* ======================================
            CHURCH INFORMATION
        ====================================== */}

        <View style={styles.card}>
          <Text
            style={styles.cardTitle}
          >
            Church Information
          </Text>

          <InfoRow
            label="Member Group"
            value={
              member.member_group
            }
          />

          <InfoRow
            label="Ministry"
            value={
              member.ministry
            }
          />

          <InfoRow
            label="Baptized"
            value={
              member.baptized
                ? 'Yes'
                : 'No'
            }
          />

          <InfoRow
            label="Status"
            value={
              member.status
            }
          />
        </View>

        {/* ======================================
            FAMILY INFORMATION
        ====================================== */}

        <View style={styles.card}>
          <Text
            style={styles.cardTitle}
          >
            Family Information
          </Text>

          <InfoRow
            label="Spouse"
            value={
              spouse
                ? getFullName(spouse)
                : 'None'
            }
          />

          <InfoRow
            label="Wedding Anniversary"
            value={formatDate(
              member.wedding_date
            )}
          />
        </View>

        {/* ======================================
            CONTACT INFORMATION
        ====================================== */}

        <View style={styles.card}>
          <Text
            style={styles.cardTitle}
          >
            Contact Information
          </Text>

          <InfoRow
            label="Contact No."
            value={
              member.contact_no
            }
          />

          <InfoRow
            label="Address"
            value={
              member.address
            }
          />
        </View>

        {/* ======================================
            ACTIONS
        ====================================== */}

        {isActive &&
          isSuperAdmin && (
          <View style={styles.actions}>
            <Pressable
              style={
                styles.editButton
              }
              onPress={() => {
                router.push({
                  pathname:
                    '/(app)/members/edit',
                  params: {
                    id: member.id,
                  },
                });
              }}
              disabled={deleting}
            >
              <Text
                style={
                  styles.editButtonText
                }
              >
                Edit Member
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.deleteButton
              }
              onPress={() => {
                setDeleteModalVisible(
                  true
                );
              }}
              disabled={deleting}
            >
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Delete Member
              </Text>
            </Pressable>
          </View>
        )}

        {isViewer && (
          <View
            style={
              styles.viewerNotice
            }
          >
            <Text
              style={
                styles.viewerNoticeTitle
              }
            >
              Viewer Access
            </Text>

            <Text
              style={
                styles.viewerNoticeText
              }
            >
              You can view this
              member's information,
              but you cannot edit or
              delete member records.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* ======================================
          DELETE CONFIRMATION
      ====================================== */}

      <AppModal
        visible={deleteModalVisible}
        title="Delete Member"
        message={
          deleting
            ? 'Deleting this member...'
            : `Are you sure you want to permanently delete ${fullName}? This action cannot be undone.`
        }
        buttonText={
          deleting
            ? 'Deleting...'
            : 'Delete'
        }
        onClose={() => {
          if (!deleting) {
            setDeleteModalVisible(
              false
            );
          }
        }}
        onConfirm={
          deleting
            ? undefined
            : handleDeleteMember
        }
      />

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

/*
 * ==========================================
 * INFO ROW
 * ==========================================
 */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={styles.infoLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.infoValue}
      >
        {cleanDisplayValue(value) ??
          '—'}
      </Text>
    </View>
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
      backgroundColor:
        '#f8fafc',
    },

    container: {
      flex: 1,
    },

    content: {
      padding: 24,
      paddingBottom: 60,
    },

    header: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
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
      color: '#111827',
    },

    memberNumber: {
      fontSize: 14,
      color: '#6b7280',
      marginTop: 5,
    },

    backButton: {
      backgroundColor:
        '#111827',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },

    backButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },

    statusRow: {
      flexDirection:
        'row',
      gap: 8,
      marginBottom: 20,
    },

    statusBadge: {
      backgroundColor:
        '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
    },

    statusText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#334155',
    },

    baptizedBadge: {
      backgroundColor:
        '#ecfdf5',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
    },

    baptizedText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#047857',
    },

    card: {
      backgroundColor:
        '#ffffff',
      borderWidth: 1,
      borderColor:
        '#e5e7eb',
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    },

    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 8,
    },

    infoRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#f1f5f9',
    },

    infoLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: '#6b7280',
    },

    infoValue: {
      fontSize: 15,
      color: '#111827',
      marginTop: 4,
    },

    actions: {
      marginTop: 4,
      marginBottom: 16,
    },

    editButton: {
      backgroundColor:
        '#111827',
      borderRadius: 9,
      paddingVertical: 14,
      alignItems: 'center',
    },

    editButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },

    deleteButton: {
      backgroundColor: '#b91c1c',
      borderRadius: 9,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },

    deleteButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },

    viewerNotice: {
      backgroundColor:
        '#ffffff',
      borderWidth: 1,
      borderColor:
        '#e5e7eb',
      borderRadius: 14,
      padding: 18,
    },

    viewerNoticeTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    viewerNoticeText: {
      fontSize: 14,
      lineHeight: 21,
      color: '#6b7280',
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
      color: '#6b7280',
      marginTop: 12,
    },

    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: '#111827',
    },

    emptyText: {
      fontSize: 14,
      color: '#6b7280',
      marginTop: 6,
      marginBottom: 20,
    },
  });
