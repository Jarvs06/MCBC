import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { router } from 'expo-router';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppModal from '@/components/AppModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/*
 * ==========================================
 * TYPES
 * ==========================================
 */

type Ministry =
  | 'None'
  | 'Choir'
  | 'Media'
  | 'Outreach'
  | 'Pastor'
  | 'Sunday School Teacher'
  | 'Ushering'
  | 'Worship';

type MemberStatus =
  | 'Active'
  | 'Inactive'
  | 'Transferred';

type MemberGroup =
  | 'General'
  | 'Men'
  | 'Women'
  | 'Children'
  | 'Youth'
  | 'Young Professional';

type Member = {
  id: string;

  member_no: string | null;

  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;

  birth_date: string | null;
  wedding_date: string | null;

  spouse_id: string | null;

  address: string | null;
  contact_no: string | null;

  baptized: boolean;

  member_group: MemberGroup | string | null;

  ministry: Ministry | string | null;
  status: MemberStatus;

  created_at: string;
  updated_at: string;
};

/*
 * ==========================================
 * FILTER OPTIONS
 * ==========================================
 */

const memberGroups: Array<
  'All' | MemberGroup
> = [
  'All',
  'General',
  'Men',
  'Women',
  'Children',
  'Youth',
  'Young Professional',
];

const ministries: Array<
  'All' | Ministry
> = [
  'All',
  'None',
  'Choir',
  'Media',
  'Outreach',
  'Pastor',
  'Sunday School Teacher',
  'Ushering',
  'Worship',
];

const statuses: Array<
  'All' | MemberStatus
> = [
  'All',
  'Active',
  'Inactive',
  'Transferred',
];

/*
 * ==========================================
 * SCREEN
 * ==========================================
 */

export default function MembersScreen() {
  const {
    isSuperAdmin,
    isViewer,
    isActive,
  } = useAuth();

  /*
   * ----------------------------------------
   * State
   * ----------------------------------------
   */

  const [members, setMembers] =
    useState<Member[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [
    memberGroupFilter,
    setMemberGroupFilter,
  ] =
    useState<'All' | MemberGroup>('All');

  const [
    ministryFilter,
    setMinistryFilter,
  ] =
    useState<'All' | Ministry>('All');

  const [
    ministryDropdownOpen,
    setMinistryDropdownOpen,
  ] =
    useState(false);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<'All' | MemberStatus>(
      'All'
    );

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  const [
    modalTitle,
    setModalTitle,
  ] = useState('');

  const [
    modalMessage,
    setModalMessage,
  ] = useState('');

  /*
   * ----------------------------------------
   * Modal
   * ----------------------------------------
   */

  function showModal(
    title: string,
    message: string
  ) {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  /*
   * ========================================
   * ACCESS
   * ========================================
   */

  const canViewMembers =
    isActive &&
    (isSuperAdmin || isViewer);

  /*
   * ========================================
   * LOAD MEMBERS
   * ========================================
   *
   * Database contains encrypted sensitive
   * fields.
   *
   * We:
   *
   * 1. Read the member records.
   * 2. Send them to member-crypto.
   * 3. Decrypt them server-side.
   * 4. Sort them locally.
   * 5. Store them in state.
   *
   * We intentionally do NOT order by
   * first_name / last_name in Supabase
   * because those fields are encrypted.
   */

  const loadMembers =
    useCallback(async () => {
      if (!canViewMembers) {
        setMembers([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log(
        '[MEMBERS] Loading members...'
      );

      try {
        setLoading(true);

        /*
         * ------------------------------------
         * Get encrypted records
         * ------------------------------------
         */

        const {
          data: encryptedMembers,
          error: membersError,
        } =
          await supabase
            .from('members')
            .select(`
              id,
              member_no,
              first_name,
              middle_name,
              last_name,
              suffix,
              birth_date,
              wedding_date,
              spouse_id,
              member_group,
              address,
              contact_no,
              baptized,
              ministry,
              status,
              created_at,
              updated_at
            `);

        if (membersError) {
          console.error(
            '[MEMBERS] Query failed:',
            membersError
          );

          setMembers([]);

          showModal(
            'Unable to Load Members',
            membersError.code === '42501'
              ? 'You do not have permission to view member records.'
              : 'The member records could not be loaded. Please try again.'
          );

          return;
        }

        /*
         * ------------------------------------
         * No records
         * ------------------------------------
         */

        if (
          !encryptedMembers ||
          encryptedMembers.length === 0
        ) {
          console.log(
            '[MEMBERS] No members found.'
          );

          setMembers([]);

          return;
        }

        console.log(
          '[MEMBERS] Encrypted members loaded:',
          encryptedMembers.length
        );

        /*
         * ------------------------------------
         * Decrypt through Edge Function
         * ------------------------------------
         */

        const {
          data: cryptoResponse,
          error: cryptoError,
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

        if (cryptoError) {
          console.error(
            '[MEMBERS] Decryption failed:',
            cryptoError
          );

          /*
           * Do not expose raw Edge Function
           * responses or implementation details.
           */

          if (
            cryptoError instanceof
            FunctionsHttpError
          ) {
            try {
              const response =
                await cryptoError.context;

              const responseText =
                await response.text();

              console.error(
                '[MEMBERS] Edge Function response:',
                responseText
              );
            } catch (error) {
              console.error(
                '[MEMBERS] Could not read Edge Function error:',
                error
              );
            }
          }

          setMembers([]);

          showModal(
            'Decryption Failed',
            'The member information could not be decrypted. Please try again.'
          );

          return;
        }

        /*
         * ------------------------------------
         * Validate crypto response
         * ------------------------------------
         */

        if (
          !cryptoResponse ||
          cryptoResponse.success !==
            true ||
          !Array.isArray(
            cryptoResponse.data
          )
        ) {
          console.error(
            '[MEMBERS] Invalid crypto response:',
            cryptoResponse
          );

          setMembers([]);

          showModal(
            'Unable to Read Members',
            'The server returned an invalid member response.'
          );

          return;
        }

        /*
         * ------------------------------------
         * Convert response
         * ------------------------------------
         */

        const decryptedMembers =
          cryptoResponse.data as Member[];

        /*
         * ------------------------------------
         * Sort locally
         * ------------------------------------
         *
         * Because last_name and first_name
         * are encrypted in PostgreSQL,
         * database ordering cannot be used.
         */

        decryptedMembers.sort(
          (a, b) => {
            const lastNameA =
              (
                a.last_name ?? ''
              )
                .trim()
                .toLowerCase();

            const lastNameB =
              (
                b.last_name ?? ''
              )
                .trim()
                .toLowerCase();

            const lastNameComparison =
              lastNameA.localeCompare(
                lastNameB
              );

            if (
              lastNameComparison !== 0
            ) {
              return lastNameComparison;
            }

            const firstNameA =
              (
                a.first_name ?? ''
              )
                .trim()
                .toLowerCase();

            const firstNameB =
              (
                b.first_name ?? ''
              )
                .trim()
                .toLowerCase();

            return firstNameA.localeCompare(
              firstNameB
            );
          }
        );

        console.log(
          '[MEMBERS] Decrypted members:',
          decryptedMembers.length
        );

        setMembers(
          decryptedMembers
        );
      } catch (error) {
        console.error(
          '[MEMBERS] Unexpected loading error:',
          error
        );

        setMembers([]);

        showModal(
          'Unable to Load Members',
          'Something went wrong while loading the member records.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [canViewMembers]);

  /*
   * ========================================
   * INITIAL LOAD
   * ========================================
   */

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  /*
   * ========================================
   * REFRESH
   * ========================================
   */

  function handleRefresh() {
    if (!canViewMembers) {
      return;
    }

    setRefreshing(true);
    void loadMembers();
  }

  /*
   * ========================================
   * FULL MEMBER NAME
   * ========================================
   */

  function getFullName(
    member: Member
  ) {
    return [
      member.first_name,
      member.middle_name,
      member.last_name,
      member.suffix,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /*
   * ========================================
   * FORMAT DATE
   * ========================================
   */

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return 'Not provided';
    }

    const [
      year,
      month,
      day,
    ] = date
      .split('-')
      .map(Number);

    if (
      !year ||
      !month ||
      !day
    ) {
      return date;
    }

    const parsedDate =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return 'Not provided';
    }

    return parsedDate.toLocaleDateString(
      'en-US',
      {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    );
  }

  /*
   * ========================================
   * FILTER MEMBERS
   * ========================================
   *
   * Filtering happens AFTER decryption.
   *
   * This is important because encrypted
   * names cannot be searched with SQL
   * ILIKE / LIKE.
   */

  const normalizedSearch =
    search
      .trim()
      .toLowerCase();

  const filteredMembers =
    members.filter(
      (member) => {
        /*
         * ------------------------------------
         * Search
         * ------------------------------------
         */

        const fullName =
          getFullName(member)
            .toLowerCase();

        const memberNumber =
          (
            member.member_no ??
            ''
          )
            .toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          fullName.includes(
            normalizedSearch
          ) ||
          memberNumber.includes(
            normalizedSearch
          );

        /*
         * ------------------------------------
         * Member Group
         * ------------------------------------
         */

        const matchesMemberGroup =
          memberGroupFilter ===
            'All' ||
          member.member_group ===
            memberGroupFilter;

        /*
         * ------------------------------------
         * Ministry
         * ------------------------------------
         */

        const matchesMinistry =
          ministryFilter ===
            'All' ||
          member.ministry ===
            ministryFilter;

        /*
         * ------------------------------------
         * Status
         * ------------------------------------
         */

        const matchesStatus =
          statusFilter ===
            'All' ||
          member.status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesMemberGroup &&
          matchesMinistry &&
          matchesStatus
        );
      }
    );

  /*
   * ========================================
   * ACCESS CHECK
   * ========================================
   *
   * Super Admin:
   * - Can view members.
   * - Can use the Add Member action.
   *
   * Viewer:
   * - Can view members.
   * - Cannot use the Add Member action.
   *
   * The UI check is only for UX.
   * Supabase RLS / server-side policies
   * must enforce the same permissions.
   */

  if (!canViewMembers) {
    return (
      <View style={styles.center}>
        <Text
          style={styles.accessTitle}
        >
          Access Restricted
        </Text>

        <Text
          style={styles.accessText}
        >
          Your account does not have
          access to the member records.
        </Text>
      </View>
    );
  }

  /*
   * ========================================
   * UI
   * ========================================
   */

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* ==================================
            HEADER
        ================================== */}

        <View style={styles.header}>
          <View
            style={styles.headerText}
          >
            <Text
              style={styles.title}
            >
              Members
            </Text>

            <Text
              style={styles.subtitle}
            >
              View and manage church
              member records.
            </Text>
          </View>

          {isActive &&
            isSuperAdmin && (
            <Pressable
              style={
                styles.addButton
              }
              onPress={() =>
                router.push(
                  '/(app)/members/add'
                )
              }
            >
              <Text
                style={
                  styles.addButtonText
                }
              >
                + Add Member
              </Text>
            </Pressable>
          )}
        </View>

        {/* ==================================
            SUMMARY
        ================================== */}

        <View
          style={styles.summary}
        >
          <View
            style={
              styles.summaryItem
            }
          >
            <Text
              style={
                styles.summaryNumber
              }
            >
              {members.length}
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Total Members
            </Text>
          </View>

          <View
            style={
              styles.summaryItem
            }
          >
            <Text
              style={
                styles.summaryNumber
              }
            >
              {
                members.filter(
                  (member) =>
                    member.status ===
                    'Active'
                ).length
              }
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Active
            </Text>
          </View>

          <View
            style={
              styles.summaryItem
            }
          >
            <Text
              style={
                styles.summaryNumber
              }
            >
              {
                members.filter(
                  (member) =>
                    member.baptized
                ).length
              }
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Baptized
            </Text>
          </View>
        </View>

        {/* ==================================
            SEARCH
        ================================== */}

        <View
          style={
            styles.searchContainer
          }
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or member number..."
            placeholderTextColor="#9ca3af"
            style={
              styles.searchInput
            }
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* ==================================
            MEMBER GROUP
        ================================== */}

        <Text
          style={styles.filterTitle}
        >
          Member Group
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={
            styles.filterScroll
          }
          contentContainerStyle={
            styles.filterContainer
          }
        >
          {memberGroups.map(
            (item) => {
              const selected =
                memberGroupFilter ===
                item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    setMemberGroupFilter(
                      item
                    )
                  }
                  style={[
                    styles.filterButton,
                    selected &&
                      styles.filterButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selected &&
                        styles.filterButtonTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* ==================================
            MINISTRY
        ================================== */}

        <Text
          style={styles.filterTitle}
        >
          Ministry
        </Text>

        <View
          style={
            styles.dropdownWrapper
          }
        >
          <Pressable
            style={
              styles.dropdownButton
            }
            onPress={() =>
              setMinistryDropdownOpen(
                (current) =>
                  !current
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Filter members by ministry"
            accessibilityState={{
              expanded:
                ministryDropdownOpen,
            }}
          >
            <Text
              style={
                styles.dropdownButtonText
              }
            >
              {ministryFilter}
            </Text>

            <Text
              style={
                styles.dropdownArrow
              }
            >
              {ministryDropdownOpen
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {ministryDropdownOpen && (
            <View
              style={
                styles.dropdownMenu
              }
            >
              {ministries.map(
                (item) => {
                  const selected =
                    ministryFilter ===
                    item;

                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setMinistryFilter(
                          item
                        );

                        setMinistryDropdownOpen(
                          false
                        );
                      }}
                      style={[
                        styles.dropdownOption,
                        selected &&
                          styles.dropdownOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          selected &&
                            styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}
        </View>

        {/* ==================================
            STATUS
        ================================== */}

        <Text
          style={styles.filterTitle}
        >
          Status
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={
            styles.filterScroll
          }
          contentContainerStyle={
            styles.filterContainer
          }
        >
          {statuses.map(
            (item) => {
              const selected =
                statusFilter ===
                item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    setStatusFilter(
                      item
                    )
                  }
                  style={[
                    styles.filterButton,
                    selected &&
                      styles.filterButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selected &&
                        styles.filterButtonTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* ==================================
            RESULTS HEADER
        ================================== */}

        <View
          style={
            styles.resultHeader
          }
        >
          <Text
            style={styles.resultTitle}
          >
            Member Records
          </Text>

          <Text
            style={
              styles.resultCount
            }
          >
            {filteredMembers.length}{' '}
            found
          </Text>
        </View>

        {/* ==================================
            LOADING
        ================================== */}

        {loading && (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading members...
            </Text>
          </View>
        )}

        {/* ==================================
            EMPTY
        ================================== */}

        {!loading &&
          filteredMembers.length ===
            0 && (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Members Found
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                No member records match
                your current search and
                filters.
              </Text>
            </View>
          )}

        {/* ==================================
            MEMBERS
        ================================== */}

        {!loading &&
          filteredMembers.map(
            (member) => (
              <Pressable
                key={member.id}
                style={
                  styles.memberCard
                }
                onPress={() =>
                  router.push(
                    `/(app)/members/${member.id}`
                  )
                }
              >
                {/* Member Header */}

                <View
                  style={
                    styles.memberHeader
                  }
                >
                  <View
                    style={
                      styles.memberNameContainer
                    }
                  >
                    <Text
                      style={
                        styles.memberName
                      }
                    >
                      {getFullName(
                        member
                      )}
                    </Text>

                    {member.member_no && (
                      <Text
                        style={
                          styles.memberNumber
                        }
                      >
                        {member.member_no}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      member.status ===
                        'Active' &&
                        styles.statusActive,
                      member.status ===
                        'Inactive' &&
                        styles.statusInactive,
                      member.status ===
                        'Transferred' &&
                        styles.statusTransferred,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        member.status ===
                          'Active' &&
                          styles.statusTextActive,
                        member.status ===
                          'Inactive' &&
                          styles.statusTextInactive,
                        member.status ===
                          'Transferred' &&
                          styles.statusTextTransferred,
                      ]}
                    >
                      {member.status}
                    </Text>
                  </View>
                </View>

                {/* Member Meta */}

                <View
                  style={
                    styles.memberMeta
                  }
                >
                  <Text
                    style={
                      styles.metaText
                    }
                  >
                    {member.member_group ??
                      'General'}
                  </Text>

                  <Text
                    style={
                      styles.metaSeparator
                    }
                  >
                    •
                  </Text>

                  <Text
                    style={
                      styles.metaText
                    }
                  >
                    {member.ministry ??
                      'No Ministry'}
                  </Text>

                  <Text
                    style={
                      styles.metaSeparator
                    }
                  >
                    •
                  </Text>

                  <Text
                    style={
                      styles.metaText
                    }
                  >
                    {member.baptized
                      ? 'Baptized'
                      : 'Not Baptized'}
                  </Text>
                </View>

                {/* Birthday */}

                {member.birth_date && (
                  <View
                    style={
                      styles.detailRow
                    }
                  >
                    <Text
                      style={
                        styles.detailLabel
                      }
                    >
                      Birthday
                    </Text>

                    <Text
                      style={
                        styles.detailValue
                      }
                    >
                      {formatDate(
                        member.birth_date
                      )}
                    </Text>
                  </View>
                )}

                {/* Wedding Anniversary */}

                {member.wedding_date && (
                  <View
                    style={
                      styles.detailRow
                    }
                  >
                    <Text
                      style={
                        styles.detailLabel
                      }
                    >
                      Wedding Anniversary
                    </Text>

                    <Text
                      style={
                        styles.detailValue
                      }
                    >
                      {formatDate(
                        member.wedding_date
                      )}
                    </Text>
                  </View>
                )}

                {/* View */}

                <View
                  style={
                    styles.viewRow
                  }
                >
                  <Text
                    style={
                      styles.viewText
                    }
                  >
                    View member details →
                  </Text>
                </View>
              </Pressable>
            )
          )}
      </ScrollView>

      {/* ==================================
          MODAL
      ================================== */}

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
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 60,
    position: 'relative',
  },

  /*
   * Header
   */

  header: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 24,
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
    color: '#6b7280',
    marginTop: 5,
  },

  /*
   * Add button
   */

  addButton: {
    backgroundColor: '#111827',
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  /*
   * Summary
   */

  summary: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    marginBottom: 20,
  },

  summaryItem: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor:
      '#e5e7eb',
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },

  /*
   * Search
   */

  searchContainer: {
    marginBottom: 18,
  },

  searchInput: {
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#111827',
  },

  /*
   * Filters
   */

  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },

  filterScroll: {
    marginBottom: 16,
    zIndex: 1,
  },

  filterContainer: {
    gap: 8,
  },

  filterButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  filterButtonSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },

  filterButtonText: {
    fontSize: 13,
    color: '#374151',
  },

  filterButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },

  /*
   * Ministry dropdown
   */

  dropdownWrapper: {
    position: 'relative',
    zIndex: 1000,
    marginBottom: 16,
  },

  dropdownButton: {
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownButtonText: {
    fontSize: 14,
    color: '#374151',
  },

  dropdownArrow: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 12,
  },

  dropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    overflow: 'hidden',
    zIndex: 1001,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  dropdownOption: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 11,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  dropdownOptionSelected: {
    backgroundColor: '#f3f4f6',
  },

  dropdownOptionText: {
    fontSize: 14,
    color: '#374151',
  },

  dropdownOptionTextSelected: {
    color: '#111827',
    fontWeight: '700',
  },

  /*
   * Results
   */

  resultHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },

  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  resultCount: {
    fontSize: 13,
    color: '#6b7280',
  },

  /*
   * Loading
   */

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  loadingText: {
    color: '#6b7280',
    marginTop: 12,
  },

  /*
   * Empty
   */

  emptyContainer: {
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
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 7,
    lineHeight: 20,
  },

  /*
   * Member card
   */

  memberCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },

  memberHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  memberNameContainer: {
    flex: 1,
  },

  memberName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  memberNumber: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 3,
  },

  /*
   * Status
   */

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  statusActive: {
    backgroundColor: '#dcfce7',
  },

  statusInactive: {
    backgroundColor: '#f3f4f6',
  },

  statusTransferred: {
    backgroundColor: '#fef3c7',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  statusTextActive: {
    color: '#166534',
  },

  statusTextInactive: {
    color: '#4b5563',
  },

  statusTextTransferred: {
    color: '#92400e',
  },

  /*
   * Meta
   */

  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  metaText: {
    fontSize: 13,
    color: '#6b7280',
  },

  metaSeparator: {
    fontSize: 13,
    color: '#9ca3af',
    marginHorizontal: 7,
  },

  /*
   * Details
   */

  detailRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  detailValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },

  /*
   * View
   */

  viewRow: {
    alignItems: 'flex-end',
    marginTop: 14,
  },

  viewText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },

  /*
   * Access
   */

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  accessTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  accessText: {
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
