import { router } from 'expo-router';
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

type Gender = 'Male' | 'Female';

function normalizeOptionalText(
  value: string | null | undefined
) {
  const normalized =
    (value ?? '')
      .replace(/\u00a0/g, ' ')
      .trim();

  if (
    normalized.toLowerCase() ===
    'not mentioned'
  ) {
    return '';
  }

  return normalized;
}

function normalizeRequiredText(
  value: string | null | undefined
) {
  return normalizeOptionalText(
    value
  );
}

type MemberOption = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
};

// ========================================
// Member Groups
// ========================================

const memberGroups = [
  'General',
  'Children',
  'Men',
  'Women',
  'Youth',
  'Young Professional',
] as const;

// ========================================
// Ministries
// ========================================

const ministries = [
  'None',
  'Choir',
  'Media',
  'Outreach',
  'Pastor',
  'Sunday School Teacher',
  'Ushering',
  'Worship',
];

export default function AddMemberScreen() {
  const {
    isSuperAdmin,
    isActive,
  } = useAuth();

  // ========================================
  // Form fields
  // ========================================

  const [memberNo, setMemberNo] =
    useState('');

  const [firstName, setFirstName] =
    useState('');

  const [middleName, setMiddleName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [suffix, setSuffix] =
    useState('');

  const [birthDate, setBirthDate] =
    useState('');

  const [gender, setGender] =
    useState<Gender>('Male');

  const [spouseId, setSpouseId] =
    useState<string | null>(null);

  const [weddingDate, setWeddingDate] =
    useState('');

  const [contactNo, setContactNo] =
    useState('');

  const [address, setAddress] =
    useState('');

  const [baptized, setBaptized] =
    useState(true);

  const [memberGroup, setMemberGroup] =
    useState('General');

  const [ministry, setMinistry] =
    useState('None');

  // ========================================
  // Spouse
  // ========================================

  const [members, setMembers] =
    useState<MemberOption[]>([]);

  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [showSpouseList, setShowSpouseList] =
    useState(false);

  // ========================================
  // Dropdowns
  // ========================================

  const [
    showMemberGroupList,
    setShowMemberGroupList,
  ] = useState(false);

  const [
    showMinistryList,
    setShowMinistryList,
  ] = useState(false);

  // ========================================
  // Submit
  // ========================================

  const [loading, setLoading] =
    useState(false);

  // ========================================
  // Modal
  // ========================================

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState('');

  const [modalMessage, setModalMessage] =
    useState('');

  const [success, setSuccess] =
    useState(false);

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

  // ========================================
  // Load members for spouse selection
  // ========================================

  useEffect(() => {
    async function loadMembers() {
      setLoadingMembers(true);

      try {
        const { data, error } =
          await supabase
            .from('members')
            .select(
              `
                id,
                first_name,
                middle_name,
                last_name,
                suffix
              `
            )
            .eq('status', 'Active');

        if (error) {
          console.error(
            '[MEMBER] Failed to load members:',
            error
          );

          showModal(
            'Unable to Load Members',
            'We could not load the existing members for spouse selection.'
          );

          return;
        }

        if (!data || data.length === 0) {
          setMembers([]);
          return;
        }

        console.log(
          '[MEMBER] Loaded encrypted members:',
          data.length
        );

        const {
          data: cryptoResponse,
          error: cryptoError,
        } = await supabase.functions.invoke(
          'member-crypto',
          {
            body: {
              action: 'decrypt',
              data,
            },
          }
        );

        if (cryptoError) {
          console.error(
            '[MEMBER] Decryption failed:',
            cryptoError
          );

          showModal(
            'Unable to Load Members',
            'We could not securely decrypt the existing members.'
          );

          return;
        }

        if (
          !cryptoResponse?.success ||
          !Array.isArray(cryptoResponse.data)
        ) {
          console.error(
            '[MEMBER] Invalid decryption response:',
            cryptoResponse
          );

          showModal(
            'Decryption Failed',
            'The existing member information could not be decrypted.'
          );

          return;
        }

        const decryptedMembers =
          (
            cryptoResponse.data as MemberOption[]
          ).map((member) => ({
            ...member,
            first_name:
              normalizeRequiredText(
                member.first_name
              ),
            middle_name:
              normalizeOptionalText(
                member.middle_name
              ) || null,
            last_name:
              normalizeRequiredText(
                member.last_name
              ),
            suffix:
              normalizeOptionalText(
                member.suffix
              ) || null,
          }));

        const sortedMembers =
          [...decryptedMembers].sort((a, b) => {
            const lastName =
              a.last_name.localeCompare(
                b.last_name
              );

            if (lastName !== 0) {
              return lastName;
            }

            return a.first_name.localeCompare(
              b.first_name
            );
          });

        setMembers(sortedMembers);

        console.log(
          '[MEMBER] Members decrypted successfully:',
          sortedMembers.length
        );
      } catch (error) {
        console.error(
          '[MEMBER] Unexpected member loading error:',
          error
        );

        showModal(
          'Unable to Load Members',
          'Something went wrong while loading members.'
        );
      } finally {
        setLoadingMembers(false);
      }
    }

    if (isSuperAdmin) {
      loadMembers();
    }
  }, [isSuperAdmin]);

  // ========================================
  // Member display name
  // ========================================

  function getMemberName(
    member: MemberOption
  ) {
    return [
      normalizeRequiredText(
        member.first_name
      ),
      normalizeOptionalText(
        member.middle_name
      ),
      normalizeRequiredText(
        member.last_name
      ),
      normalizeOptionalText(
        member.suffix
      ),
    ]
      .filter(Boolean)
      .join(' ');
  }

  function getSelectedSpouseName() {
    if (!spouseId) {
      return '';
    }

    const spouse = members.find(
      (member) =>
        member.id === spouseId
    );

    return spouse
      ? getMemberName(spouse)
      : '';
  }

  // ========================================
  // Date helpers
  // ========================================

  function parseDateOnly(
    value: string
  ): Date | null {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        value
      );

    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // ========================================
  // Create member
  // ========================================

  async function handleAddMember() {
    if (!isActive || !isSuperAdmin) {
      showModal(
        'Access Denied',
        'Only an active Super Admin can add members.'
      );

      return;
    }

  const trimmedFirstName =
    normalizeRequiredText(
      firstName
    );

  const trimmedMiddleName =
    normalizeOptionalText(
      middleName
    );

  const trimmedLastName =
    normalizeRequiredText(
      lastName
    );

  const trimmedSuffix =
    normalizeOptionalText(
      suffix
    );

  const trimmedMemberNo =
    normalizeOptionalText(
      memberNo
    );

  const trimmedBirthDate =
    normalizeOptionalText(
      birthDate
    );

  const trimmedWeddingDate =
    normalizeOptionalText(
      weddingDate
    );

  const trimmedContactNo =
    normalizeOptionalText(
      contactNo
    );

  const trimmedAddress =
    normalizeOptionalText(
      address
    );

  const trimmedMinistry =
    normalizeOptionalText(
      ministry
    );

  // ========================================
  // Validation
  // ========================================

  if (!trimmedFirstName) {
    showModal(
      'Missing Information',
      'Please enter the first name.'
    );

    return;
  }

  if (!trimmedLastName) {
    showModal(
      'Missing Information',
      'Please enter the last name.'
    );

    return;
  }

  if (
    trimmedFirstName.length > 150 ||
    trimmedMiddleName.length > 150 ||
    trimmedLastName.length > 150 ||
    trimmedSuffix.length > 50
  ) {
    showModal(
      'Invalid Name',
      'Name fields contain too many characters. Please review the name and try again.'
    );

    return;
  }

  if (!trimmedBirthDate) {
    showModal(
      'Missing Information',
      'Please enter the birth date.'
    );

    return;
  }

  // ========================================
  // Date validation
  // ========================================

  const birthDateValue =
    parseDateOnly(
      trimmedBirthDate
    );

  if (!birthDateValue) {
    showModal(
      'Invalid Birth Date',
      'Please enter a valid birth date using YYYY-MM-DD.'
    );

    return;
  }

  const now = new Date();

  const todayDateOnly =
    new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )
    );

  if (
    birthDateValue >
    todayDateOnly
  ) {
    showModal(
      'Invalid Birth Date',
      'Birth date cannot be in the future.'
    );

    return;
  }

  const weddingDateValue =
    trimmedWeddingDate
      ? parseDateOnly(
          trimmedWeddingDate
        )
      : null;

  if (
    trimmedWeddingDate &&
    !weddingDateValue
  ) {
    showModal(
      'Invalid Wedding Anniversary',
      'Please enter a valid wedding anniversary using YYYY-MM-DD.'
    );

    return;
  }

  if (
    weddingDateValue &&
    weddingDateValue >
      todayDateOnly
  ) {
    showModal(
      'Invalid Wedding Anniversary',
      'Wedding anniversary cannot be in the future.'
    );

    return;
  }

  if (
    weddingDateValue &&
    weddingDateValue <
      birthDateValue
  ) {
    showModal(
      'Invalid Wedding Anniversary',
      'Wedding anniversary cannot be earlier than the member birth date.'
    );

    return;
  }

  // ========================================
  // Member number validation
  // ========================================

  if (
    trimmedMemberNo &&
    trimmedMemberNo.length >
      50
  ) {
    showModal(
      'Invalid Member Number',
      'Member number must be 50 characters or fewer.'
    );

    return;
  }

  // ========================================
  // Prevent duplicate submission
  // ========================================

  if (loading) {
    return;
  }

  try {
    setLoading(true);

    // ========================================
    // Check duplicate member number
    // ========================================

    if (trimmedMemberNo) {
      const {
        data: existingMember,
        error: duplicateCheckError,
      } =
        await supabase
          .from('members')
          .select('id')
          .eq(
            'member_no',
            trimmedMemberNo
          )
          .limit(1)
          .maybeSingle();

      if (duplicateCheckError) {
        console.error(
          '[MEMBER] Duplicate member number check failed:',
          duplicateCheckError
        );

        showModal(
          'Unable to Validate Member Number',
          'We could not verify whether this member number is already in use. The member was not saved. Please try again.'
        );

        return;
      }

      if (existingMember) {
        showModal(
          'Duplicate Member Number',
          `Member number ${trimmedMemberNo} is already assigned to another member. Please use a different member number.`
        );

        return;
      }
    }

    // ========================================
    // Prepare sensitive data
    // ========================================

    const sensitiveData = {
      first_name:
        trimmedFirstName,

      middle_name:
        trimmedMiddleName || null,

      last_name:
        trimmedLastName,

      suffix:
        trimmedSuffix || null,

      birth_date:
        trimmedBirthDate || null,

      address:
        trimmedAddress || null,

      contact_no:
        trimmedContactNo || null,
    };

    console.log(
      '[MEMBER] Encrypting sensitive information...'
    );

    // ========================================
    // Encrypt sensitive information
    // ========================================

    const {
      data: cryptoResponse,
      error: cryptoError,
    } =
      await supabase.functions.invoke(
        'member-crypto',
        {
          body: {
            action: 'encrypt',
            data: sensitiveData,
          },
        }
      );

    if (cryptoError) {
      console.error(
        '[MEMBER] Encryption function error:',
        cryptoError
      );

      showModal(
        'Unable to Secure Member Information',
        'We could not securely process the member information. The member was not saved. Please try again.'
      );

      return;
    }

    if (
      !cryptoResponse?.success ||
      !cryptoResponse?.data
    ) {
      console.error(
        '[MEMBER] Invalid encryption response:',
        cryptoResponse
      );

      showModal(
        'Encryption Failed',
        'The member information could not be secured. The member was not saved.'
      );

      return;
    }

    const encrypted =
      cryptoResponse.data;

    console.log(
      '[MEMBER] Sensitive information encrypted successfully.'
    );

    // ========================================
    // Insert member
    // ========================================

    const {
      data: insertedMember,
      error: insertError,
    } =
      await supabase
        .from('members')
        .insert({
          // ----------------------------------
          // Non-sensitive fields
          // ----------------------------------

          member_no:
            trimmedMemberNo || null,

          gender,

          wedding_date:
            trimmedWeddingDate || null,

          spouse_id:
            spouseId || null,

          baptized,

          status:
            'Active',

          member_group:
            memberGroup,

          ministry:
            trimmedMinistry || null,

          // ----------------------------------
          // Encrypted fields
          // ----------------------------------

          first_name:
            encrypted.first_name,

          middle_name:
            encrypted.middle_name,

          last_name:
            encrypted.last_name,

          suffix:
            encrypted.suffix,

          birth_date:
            encrypted.birth_date,

          address:
            encrypted.address,

          contact_no:
            encrypted.contact_no,
        })
        .select('id')
        .single();

    // ========================================
    // Database error
    // ========================================

    if (insertError) {
      console.error(
        '[MEMBER] Failed to add member:',
        insertError
      );

      if (
        insertError.code ===
        '23505'
      ) {
        showModal(
          'Duplicate Member',
          'This member conflicts with an existing record. If you entered a member number, it may already be in use.'
        );
      } else if (
        insertError.code ===
        '42501'
      ) {
        showModal(
          'Access Denied',
          'Your administrator account is not permitted to add members.'
        );
      } else {
        showModal(
          'Unable to Add Member',
          'We could not save the member. Please review the information and try again.'
        );
      }

      return;
    }

    const insertedMemberId =
      insertedMember?.id ?? null;

    if (!insertedMemberId) {
      console.error(
        '[MEMBER] Insert succeeded but no member ID was returned.'
      );

      showModal(
        'Member Added',
        `${trimmedFirstName} ${trimmedLastName} was added, but the new member ID could not be confirmed. You can verify the record from Member Records.`,
        true
      );

      return;
    }

    // ========================================
    // Set spouse relationship
    // ========================================
    //
    // The new member now exists, so establish the
    // reverse spouse_id on the selected spouse.
    // If that spouse was already linked to another
    // member, clear the stale relationship first.

    if (spouseId) {
      const {
        data: selectedSpouse,
        error: selectedSpouseError,
      } = await supabase
        .from('members')
        .select('spouse_id')
        .eq('id', spouseId)
        .single();

      if (selectedSpouseError) {
        console.error(
          '[MEMBER] Selected spouse lookup failed:',
          selectedSpouseError
        );

        /*
         * The member was already inserted successfully.
         * Do not pretend the spouse relationship succeeded.
         */
        showModal(
          'Member Added',
          `${trimmedFirstName} ${trimmedLastName} was added, but the spouse relationship could not be completed. You can set the spouse from Edit Member.`,
          true
        );

        return;
      }

      const previousSpouseId =
        selectedSpouse?.spouse_id ?? null;

      if (
        previousSpouseId
      ) {
        const {
          error:
            detachPreviousSpouseError,
        } = await supabase
          .from('members')
          .update({
            spouse_id: null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            previousSpouseId
          );

        if (
          detachPreviousSpouseError
        ) {
          console.error(
            '[MEMBER] Failed to detach previous spouse:',
            detachPreviousSpouseError
          );

          showModal(
            'Member Added',
            `${trimmedFirstName} ${trimmedLastName} was added, but the existing spouse relationship could not be safely replaced.`,
            true
          );

          return;
        }
      }

      const {
        error:
          spouseUpdateError,
      } = await supabase
        .from('members')
        .update({
          spouse_id:
            insertedMemberId,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          spouseId
        );

      if (
        spouseUpdateError
      ) {
        console.error(
          '[MEMBER] Failed to create reverse spouse relationship:',
          spouseUpdateError
        );

        showModal(
          'Member Added',
          `${trimmedFirstName} ${trimmedLastName} was added, but the spouse relationship could not be completed. You can set the spouse from Edit Member.`,
          true
        );

        return;
      }
    }

    // ========================================
    // Success
    // ========================================

    showModal(
      'Member Added',
      `${trimmedFirstName} ${trimmedLastName} has been successfully added.`,
      true
    );
  } catch (error) {
    console.error(
      '[MEMBER] Unexpected add member error:',
      error
    );

    showModal(
      'Unable to Add Member',
      'Something went wrong while securely adding the member. Please try again.'
    );
  } finally {
    setLoading(false);
  }
}

  // ========================================
  // Access control
  // ========================================

  if (!isActive || !isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Only an active Super Admin can add members.
        </Text>
      </View>
    );
  }

  // ========================================
  // Form
  // ========================================

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Add Member
          </Text>

          <Text style={styles.subtitle}>
            Add a new member to the church
            directory.
          </Text>
        </View>

        {/* Form */}

        <View style={styles.form}>

          {/* Member Number */}

          <Text style={styles.label}>
            Member No.
          </Text>

          <TextInput
            style={styles.input}
            value={memberNo}
            onChangeText={setMemberNo}
            placeholder="Optional"
            placeholderTextColor="#9ca3af"
          />

          {/* First Name */}

          <Text style={styles.label}>
            First Name *
          </Text>

          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />

          {/* Middle Name */}

          <Text style={styles.label}>
            Middle Name
          </Text>

          <TextInput
            style={styles.input}
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="Optional"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />

          {/* Last Name */}

          <Text style={styles.label}>
            Last Name *
          </Text>

          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />

          {/* Suffix */}

          <Text style={styles.label}>
            Suffix
          </Text>

          <TextInput
            style={styles.input}
            value={suffix}
            onChangeText={setSuffix}
            placeholder="Jr., Sr., III, etc."
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
          />

          {/* Birth Date */}

          <Text style={styles.label}>
            Birth Date *
          </Text>

          <TextInput
            style={styles.input}
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.helperText}>
            Example: 1990-08-25
          </Text>

          {/* Gender */}

          <Text style={styles.label}>
            Gender
          </Text>

          <View style={styles.optionContainer}>
            {(
              ['Male', 'Female'] as Gender[]
            ).map((item) => {
              const selected =
                gender === item;

              return (
                <Pressable
                  key={item}
                  style={[
                    styles.option,
                    selected &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setGender(item)
                  }
                >
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

                  <Text
                    style={[
                      styles.optionText,
                      selected &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Spouse */}

          <Text style={styles.label}>
            Spouse
          </Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => {
              setShowSpouseList(
                !showSpouseList
              );

              setShowMemberGroupList(
                false
              );

              setShowMinistryList(
                false
              );
            }}
          >
            <Text
              style={[
                styles.selectText,
                !spouseId &&
                  styles.placeholderText,
              ]}
            >
              {spouseId
                ? getSelectedSpouseName()
                : 'Select spouse (optional)'}
            </Text>

            <Text
              style={styles.selectArrow}
            >
              {showSpouseList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showSpouseList && (
            <View
              style={
                styles.spouseDropdown
              }
            >
              {/* No spouse */}

              <Pressable
                style={
                  styles.spouseOption
                }
                onPress={() => {
                  setSpouseId(null);

                  setShowSpouseList(
                    false
                  );
                }}
              >
                <Text
                  style={
                    styles.spouseOptionText
                  }
                >
                  No spouse
                </Text>
              </Pressable>

              {loadingMembers ? (
                <View
                  style={
                    styles.loadingSpouse
                  }
                >
                  <ActivityIndicator />

                  <Text
                    style={
                      styles.loadingSpouseText
                    }
                  >
                    Loading members...
                  </Text>
                </View>
              ) : members.length ===
                0 ? (
                <View
                  style={
                    styles.loadingSpouse
                  }
                >
                  <Text
                    style={
                      styles.loadingSpouseText
                    }
                  >
                    No other members found.
                  </Text>
                </View>
              ) : (
                members.map((member) => (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.spouseOption,
                      spouseId ===
                        member.id &&
                        styles.spouseOptionSelected,
                    ]}
                    onPress={() => {
                      setSpouseId(
                        member.id
                      );

                      setShowSpouseList(
                        false
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.spouseOptionText
                      }
                    >
                      {getMemberName(
                        member
                      )}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Wedding Anniversary */}

          <Text style={styles.label}>
            Wedding Anniversary
          </Text>

          <TextInput
            style={styles.input}
            value={weddingDate}
            onChangeText={
              setWeddingDate
            }
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.helperText}>
            Leave blank if not applicable.
          </Text>

          {/* Contact */}

          <Text style={styles.label}>
            Contact No.
          </Text>

          <TextInput
            style={styles.input}
            value={contactNo}
            onChangeText={setContactNo}
            placeholder="Enter contact number"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />

          {/* Address */}

          <Text style={styles.label}>
            Address
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.textArea,
            ]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Baptized */}

          <Text style={styles.label}>
            Baptized
          </Text>

          <View style={styles.optionContainer}>
            <Pressable
              style={[
                styles.option,
                baptized &&
                  styles.optionSelected,
              ]}
              onPress={() =>
                setBaptized(true)
              }
            >
              <View
                style={[
                  styles.radio,
                  baptized &&
                    styles.radioSelected,
                ]}
              >
                {baptized && (
                  <View
                    style={
                      styles.radioInner
                    }
                  />
                )}
              </View>

              <Text
                style={[
                  styles.optionText,
                  baptized &&
                    styles.optionTextSelected,
                ]}
              >
                Yes
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.option,
                !baptized &&
                  styles.optionSelected,
              ]}
              onPress={() =>
                setBaptized(false)
              }
            >
              <View
                style={[
                  styles.radio,
                  !baptized &&
                    styles.radioSelected,
                ]}
              >
                {!baptized && (
                  <View
                    style={
                      styles.radioInner
                    }
                  />
                )}
              </View>

              <Text
                style={[
                  styles.optionText,
                  !baptized &&
                    styles.optionTextSelected,
                ]}
              >
                No
              </Text>
            </Pressable>
          </View>

          {/* Member Group */}

          <Text style={styles.label}>
            Member Group *
          </Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => {
              setShowMemberGroupList(
                !showMemberGroupList
              );

              setShowMinistryList(
                false
              );

              setShowSpouseList(
                false
              );
            }}
          >
            <Text style={styles.selectText}>
              {memberGroup}
            </Text>

            <Text
              style={styles.selectArrow}
            >
              {showMemberGroupList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showMemberGroupList && (
            <View
              style={styles.dropdown}
            >
              {memberGroups.map(
                (item) => {
                  const selected =
                    memberGroup ===
                    item;

                  return (
                    <Pressable
                      key={item}
                      style={[
                        styles.dropdownOption,
                        selected &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setMemberGroup(
                          item
                        );

                        setShowMemberGroupList(
                          false
                        );
                      }}
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

          {/* Ministry */}

          <Text style={styles.label}>
            Ministry
          </Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => {
              setShowMinistryList(
                !showMinistryList
              );

              setShowMemberGroupList(
                false
              );

              setShowSpouseList(
                false
              );
            }}
          >
            <Text
              style={[
                styles.selectText,
                !ministry &&
                  styles.placeholderText,
              ]}
            >
              {ministry ||
                'Select ministry (optional)'}
            </Text>

            <Text
              style={styles.selectArrow}
            >
              {showMinistryList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showMinistryList && (
            <View
              style={styles.dropdown}
            >
              {ministries.map(
                (item) => {
                  const selected =
                    (item === 'None' &&
                      !ministry) ||
                    ministry === item;

                  return (
                    <Pressable
                      key={item}
                      style={[
                        styles.dropdownOption,
                        selected &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setMinistry(
                          item ===
                            'None'
                            ? ''
                            : item
                        );

                        setShowMinistryList(
                          false
                        );
                      }}
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

          {/* Information Notice */}

          <View style={styles.notice}>
            <Text
              style={styles.noticeTitle}
            >
              Member Information
            </Text>

            <Text
              style={styles.noticeText}
            >
              Make sure the information is
              accurate before saving the
              member. Sensitive member
              information is encrypted before
              it is stored.
            </Text>
          </View>

          {/* Add Member */}

          <Pressable
            style={[
              styles.button,
              loading &&
                styles.buttonDisabled,
            ]}
            onPress={
              handleAddMember
            }
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={styles.buttonText}
              >
                Add Member
              </Text>
            )}
          </Pressable>

          {/* Cancel */}

          <Pressable
            style={styles.cancelButton}
            onPress={() => router.replace('/members')}
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

      {/* Modal */}

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

// ========================================
// Styles
// ========================================

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
    marginBottom: 25,
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

  form: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  textArea: {
    height: 110,
    paddingTop: 14,
  },

  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 5,
  },

  // ======================================
  // Radio buttons
  // ======================================

  optionContainer: {
    gap: 8,
  },

  option: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionSelected: {
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
    marginRight: 10,
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

  optionText: {
    fontSize: 14,
    color: '#374151',
  },

  optionTextSelected: {
    fontWeight: '700',
    color: '#111827',
  },

  // ======================================
  // Select / Dropdown
  // ======================================

  selectInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },

  selectText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },

  placeholderText: {
    color: '#9ca3af',
  },

  selectArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 10,
  },

  dropdown: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    marginTop: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },

  dropdownOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  dropdownOptionSelected: {
    backgroundColor: '#f1f5f9',
  },

  dropdownOptionText: {
    fontSize: 14,
    color: '#374151',
  },

  dropdownOptionTextSelected: {
    fontWeight: '700',
    color: '#111827',
  },

  // ======================================
  // Spouse dropdown
  // ======================================

  spouseDropdown: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    marginTop: 6,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },

  spouseOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  spouseOptionSelected: {
    backgroundColor: '#f1f5f9',
  },

  spouseOptionText: {
    fontSize: 14,
    color: '#374151',
  },

  loadingSpouse: {
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },

  loadingSpouseText: {
    fontSize: 13,
    color: '#6b7280',
  },

  // ======================================
  // Notice
  // ======================================

  notice: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
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

  // ======================================
  // Buttons
  // ======================================

  button: {
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },

  cancelButtonText: {
    color: '#6b7280',
    fontSize: 15,
  },

  // ======================================
  // Access denied
  // ======================================

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
    marginTop: 8,
    textAlign: 'center',
  },
});
