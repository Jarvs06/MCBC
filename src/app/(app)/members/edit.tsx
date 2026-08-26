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
  TextInput,
  View,
} from 'react-native';

import AppModal from '@/components/AppModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ========================================
// Options
// ========================================

const memberGroups = [
  'General',
  'Men',
  'Women',
  'Children',
  'Youth',
  'Young Professional',
] as const;

const ministries = [
  'None',
  'Choir',
  'Media',
  'Outreach',
  'Pastor',
  'Sunday School Teacher',
  'Ushering',
  'Worship',
] as const;

const statuses = [
  'Active',
  'Inactive',
  'Transferred',
  'Moved Away',
  'Deceased',
] as const;

const genders = [
  'Male',
  'Female',
] as const;

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

// ========================================
// Types
// ========================================

type MemberGroup =
  (typeof memberGroups)[number];

type Ministry =
  (typeof ministries)[number];

type MemberStatus =
  (typeof statuses)[number];

type Gender =
  (typeof genders)[number];

type Member = {
  id: string;

  member_no: string | null;

  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;

  birth_date: string | null;
  gender: string | null;

  wedding_date: string | null;
  spouse_id: string | null;

  address: string | null;
  contact_no: string | null;

  baptized: boolean;

  status: string;
  member_group: string;
  ministry: string | null;
};

type Spouse = {
  id: string;

  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
};


// ========================================
// Member encryption helper
// ========================================
//
// Sensitive member fields are encrypted by the
// Supabase Edge Function. The encryption key
// never exists in the Expo application.
//
// The Edge Function handles:
// first_name
// middle_name
// last_name
// suffix
// birth_date
// address
// contact_no
//
// Non-sensitive fields are returned unchanged.

async function decryptMemberData<
  T extends Record<string, unknown>
>(
  data: T
): Promise<T> {
  const {
    data: cryptoResponse,
    error: cryptoError,
  } =
    await supabase.functions.invoke(
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
      '[MEMBER] Decryption function error:',
      cryptoError
    );

    throw new Error(
      cryptoError.message ||
        'Unable to decrypt member information.'
    );
  }

  if (
    !cryptoResponse?.success ||
    !cryptoResponse?.data
  ) {
    console.error(
      '[MEMBER] Invalid decryption response:',
      cryptoResponse
    );

    const responseError =
      cryptoResponse?.error;

    throw new Error(
      typeof responseError === 'string'
        ? responseError
        : 'Unable to decrypt member information.'
    );
  }

  return cryptoResponse.data as T;
}

// ========================================
// Component
// ========================================

export default function EditMemberScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

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
    useState<MemberGroup>('General');

  // None is the default UI value.
  // It will be saved as NULL in Supabase.
  const [ministry, setMinistry] =
    useState<Ministry>('None');

  const [status, setStatus] =
    useState<MemberStatus>('Active');

  // ========================================
  // Spouse data
  // ========================================

  const [spouses, setSpouses] =
    useState<Spouse[]>([]);

  const [loadingSpouses, setLoadingSpouses] =
    useState(false);

  // ========================================
  // Dropdown states
  // ========================================

  const [
    showSpouseList,
    setShowSpouseList,
  ] = useState(false);

  const [
    showMemberGroupList,
    setShowMemberGroupList,
  ] = useState(false);

  const [
    showMinistryList,
    setShowMinistryList,
  ] = useState(false);

  const [
    showStatusList,
    setShowStatusList,
  ] = useState(false);

  // ========================================
  // Loading
  // ========================================

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  // ========================================
  // App Modal
  // ========================================

  const [modalVisible, setModalVisible] =
    useState(false);

  const [modalTitle, setModalTitle] =
    useState('');

  const [modalMessage, setModalMessage] =
    useState('');

  const [modalSuccess, setModalSuccess] =
    useState(false);

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

  // ========================================
  // Close dropdowns
  // ========================================

  function closeAllDropdowns() {
    setShowSpouseList(false);
    setShowMemberGroupList(false);
    setShowMinistryList(false);
    setShowStatusList(false);
  }

  // ========================================
  // Load member
  // ========================================

  useEffect(() => {
    if (!id) {
      setLoading(false);

      showModal(
        'Member Not Found',
        'No member ID was provided.'
      );

      return;
    }

    loadMember();
  }, [id]);

  async function loadMember() {
    try {
      setLoading(true);

      // ======================================
      // Load member
      // ======================================

      const {
        data: member,
        error: memberError,
      } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (memberError) {
        console.error(
          'Load member error:',
          memberError
        );

        showModal(
          'Unable to Load Member',
          memberError.message
        );

        return;
      }

      // ======================================
      // Decrypt sensitive member information
      // ======================================

      const decryptedMember =
        await decryptMemberData(
          member as Record<string, unknown>
        );

      const typedMember =
        decryptedMember as unknown as Member;

      // ======================================
      // Populate form
      // ======================================

      setMemberNo(
        normalizeOptionalText(
          typedMember.member_no
        )
      );

      setFirstName(
        normalizeRequiredText(
          typedMember.first_name
        )
      );

      setMiddleName(
        normalizeOptionalText(
          typedMember.middle_name
        )
      );

      setLastName(
        normalizeRequiredText(
          typedMember.last_name
        )
      );

      setSuffix(
        normalizeOptionalText(
          typedMember.suffix
        )
      );

      setBirthDate(
        normalizeOptionalText(
          typedMember.birth_date
        )
      );

      // ======================================
      // Gender
      // ======================================

      if (
        genders.includes(
          typedMember.gender as Gender
        )
      ) {
        setGender(
          typedMember.gender as Gender
        );
      } else {
        setGender('Male');
      }

      // ======================================
      // Spouse
      // ======================================

      setSpouseId(
        typedMember.spouse_id ?? null
      );

      // ======================================
      // Wedding Date
      // ======================================

      setWeddingDate(
        normalizeOptionalText(
          typedMember.wedding_date
        )
      );

      // ======================================
      // Contact
      // ======================================

      setContactNo(
        normalizeOptionalText(
          typedMember.contact_no
        )
      );

      setAddress(
        normalizeOptionalText(
          typedMember.address
        )
      );

      // ======================================
      // Baptized
      // ======================================

      setBaptized(
        typedMember.baptized
      );

      // ======================================
      // Member Group
      // ======================================

      if (
        memberGroups.includes(
          typedMember.member_group as MemberGroup
        )
      ) {
        setMemberGroup(
          typedMember.member_group as MemberGroup
        );
      } else {
        setMemberGroup('General');
      }

      // ======================================
      // Ministry
      // ======================================

      /*
       * If the database contains NULL,
       * automatically show "None".
       */
      if (
        typedMember.ministry &&
        ministries.includes(
          typedMember.ministry as Ministry
        )
      ) {
        setMinistry(
          typedMember.ministry as Ministry
        );
      } else {
        setMinistry('None');
      }

      // ======================================
      // Status
      // ======================================

      if (
        statuses.includes(
          typedMember.status as MemberStatus
        )
      ) {
        setStatus(
          typedMember.status as MemberStatus
        );
      } else {
        setStatus('Active');
      }

      // ======================================
      // Load spouse choices
      // ======================================

      setLoadingSpouses(true);

      const {
        data: spouseData,
        error: spouseError,
      } = await supabase
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
        .neq('id', id);

      if (spouseError) {
        console.error(
          'Load spouse error:',
          spouseError
        );

        showModal(
          'Unable to Load Spouses',
          spouseError.message
        );

        return;
      }

      // ======================================
      // Decrypt spouse names
      // ======================================

      const decryptedSpouses =
        await Promise.all(
          (spouseData ?? []).map(
            async (person) => {
              return await decryptMemberData(
                person as Record<
                  string,
                  unknown
                >
              );
            }
          )
        );

      const typedSpouses =
        (
          decryptedSpouses as unknown as Spouse[]
        ).map((person) => ({
          ...person,
          first_name:
            normalizeRequiredText(
              person.first_name
            ),
          middle_name:
            normalizeOptionalText(
              person.middle_name
            ) || null,
          last_name:
            normalizeRequiredText(
              person.last_name
            ),
          suffix:
            normalizeOptionalText(
              person.suffix
            ) || null,
        }));

      // ======================================
      // Sort by decrypted last name
      // ======================================

      typedSpouses.sort(
        (a, b) =>
          a.last_name.localeCompare(
            b.last_name,
            undefined,
            {
              sensitivity: 'base',
            }
          )
      );

      setSpouses(typedSpouses);
    } catch (error) {
      console.error(
        'Unexpected load error:',
        error
      );

      showModal(
        'Unable to Load Member',
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading the member.'
      );
    } finally {
      setLoading(false);
      setLoadingSpouses(false);
    }
  }


  // ========================================
  // Full name
  // ========================================

  function getFullName(
    person: Spouse
  ) {
    return [
      normalizeRequiredText(
        person.first_name
      ),
      normalizeOptionalText(
        person.middle_name
      ),
      normalizeRequiredText(
        person.last_name
      ),
      normalizeOptionalText(
        person.suffix
      ),
    ]
      .filter(Boolean)
      .join(' ');
  }

  // ========================================
  // Selected spouse
  // ========================================

  function getSelectedSpouseName() {
    if (!spouseId) {
      return 'None';
    }

    const spouse =
      spouses.find(
        (person) =>
          person.id === spouseId
      );

    return spouse
      ? getFullName(spouse)
      : 'None';
  }

  // ========================================
  // Date validation
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

    const date =
      new Date(
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
  // Save member
  // ========================================

  async function handleSave() {
    if (!isActive || !isSuperAdmin) {
      showModal(
        'Access Denied',
        'Only an active Super Admin can edit members.'
      );

      return;
    }

    if (!id) {
      showModal(
        'Unable to Save',
        'No member ID was provided.'
      );

      return;
    }

    const trimmedMemberNo =
      normalizeOptionalText(
        memberNo
      );

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

    // ======================================
    // Validation
    // ======================================

    if (!trimmedFirstName) {
      showModal(
        'Missing First Name',
        'Please enter the member\'s first name.'
      );

      return;
    }

    if (!trimmedLastName) {
      showModal(
        'Missing Last Name',
        'Please enter the member\'s last name.'
      );

      return;
    }

    if (!trimmedBirthDate) {
      showModal(
        'Missing Birth Date',
        'Please enter the birth date.'
      );

      return;
    }

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
      trimmedMemberNo.length >
      50
    ) {
      showModal(
        'Invalid Member Number',
        'Member number must be 50 characters or fewer.'
      );

      return;
    }

    if (
      spouseId === id
    ) {
      showModal(
        'Invalid Spouse',
        'A member cannot be their own spouse.'
      );

      return;
    }

    try {
      setSaving(true);

      // ======================================
      // Get current spouse
      // ======================================

      const {
        data: currentMember,
        error: currentMemberError,
      } = await supabase
        .from('members')
        .select('spouse_id')
        .eq('id', id)
        .single();

      if (currentMemberError) {
        showModal(
          'Unable to Save',
          currentMemberError.message
        );

        return;
      }

      const oldSpouseId =
        currentMember?.spouse_id ?? null;

      // ======================================
      // Check duplicate member number
      // ======================================

      if (trimmedMemberNo) {
        const {
          data: duplicateMember,
          error: duplicateCheckError,
        } =
          await supabase
            .from('members')
            .select('id')
            .eq(
              'member_no',
              trimmedMemberNo
            )
            .neq(
              'id',
              id
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
            'We could not verify whether this member number is already in use. The member was not updated. Please try again.'
          );

          return;
        }

        if (duplicateMember) {
          showModal(
            'Duplicate Member Number',
            `Member number ${trimmedMemberNo} is already assigned to another member. Please use a different member number.`
          );

          return;
        }
      }

      // ======================================
      // Ministry
      // ======================================

      /*
       * "None" is only used by the UI.
       *
       * Supabase stores NULL instead.
       */
      const ministryValue =
        ministry === 'None'
          ? null
          : ministry;

      // ======================================
      // Encrypt sensitive information
      // ======================================

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
          'We could not securely process the member information. The member was not updated. Please try again.'
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
          'The member information could not be secured. The member was not updated.'
        );

        return;
      }

      const encrypted =
        cryptoResponse.data;

      console.log(
        '[MEMBER] Sensitive information encrypted successfully.'
      );

      // ======================================
      // Update member
      // ======================================

      const {
        error: updateError,
      } = await supabase
        .from('members')
        .update({
          // ----------------------------------
          // Non-sensitive fields
          // ----------------------------------

          member_no:
            trimmedMemberNo || null,

          gender,

          spouse_id:
            spouseId || null,

          wedding_date:
            trimmedWeddingDate || null,

          baptized,

          member_group:
            memberGroup,

          ministry:
            ministryValue,

          status,

          updated_at:
            new Date().toISOString(),

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
        .eq('id', id);

      if (updateError) {
        console.error(
          'Update member error:',
          updateError
        );

        if (
          updateError.code ===
          '23505'
        ) {
          showModal(
            'Duplicate Member',
            'This member conflicts with an existing record. The member number may already be in use.'
          );
        } else if (
          updateError.code ===
          '42501'
        ) {
          showModal(
            'Access Denied',
            'Your administrator account is not permitted to edit members.'
          );
        } else {
          showModal(
            'Unable to Update Member',
            'We could not save the member. Please review the information and try again.'
          );
        }

        return;
      }

      // ======================================
      // Remove old spouse relationship
      // ======================================

      if (
        oldSpouseId &&
        oldSpouseId !== spouseId
      ) {
        const {
          error: removeSpouseError,
        } = await supabase
          .from('members')
          .update({
            spouse_id: null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            oldSpouseId
          );

        if (removeSpouseError) {
          console.error(
            'Remove spouse relationship error:',
            removeSpouseError
          );
        }
      }

      // ======================================
      // Set new spouse relationship
      // ======================================

      if (spouseId) {
        /*
         * If the selected spouse is currently linked
         * to another member, remove that old link first.
         * This prevents a member from having two spouses
         * through stale one-sided relationships.
         */
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
            'Selected spouse lookup error:',
            selectedSpouseError
          );

          showModal(
            'Unable to Update Spouse',
            'We could not verify the selected spouse relationship. The member information was saved, but the spouse relationship was not changed.'
          );

          return;
        }

        const previousSpouseOfSelected =
          selectedSpouse?.spouse_id ?? null;

        if (
          previousSpouseOfSelected &&
          previousSpouseOfSelected !== id
        ) {
          const {
            error:
              detachSelectedSpouseError,
          } = await supabase
            .from('members')
            .update({
              spouse_id: null,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              previousSpouseOfSelected
            );

          if (
            detachSelectedSpouseError
          ) {
            console.error(
              'Detach selected spouse previous relationship error:',
              detachSelectedSpouseError
            );

            showModal(
              'Unable to Update Spouse',
              'The selected spouse is already linked to another member, and that existing relationship could not be safely removed.'
            );

            return;
          }
        }

        const {
          error: spouseError,
        } = await supabase
          .from('members')
          .update({
            spouse_id: id,

            wedding_date:
              trimmedWeddingDate || null,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            spouseId
          );

        if (spouseError) {
          console.error(
            'Spouse update error:',
            spouseError
          );

          showModal(
            'Member Updated',
            'The member was updated, but the spouse relationship could not be updated.'
          );

          return;
        }
      }

      // ======================================
      // Success
      // ======================================

      showModal(
        'Member Updated',
        `${trimmedFirstName} ${trimmedLastName} has been updated successfully.`,
        true
      );
    } catch (error) {
      console.error(
        'Save member error:',
        error
      );

      showModal(
        'Unable to Update Member',
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving the member.'
      );
    } finally {
      setSaving(false);
    }
  }


  // ========================================
  // Access denied
  // ========================================

  if (!isActive || !isSuperAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Only an active Super Admin can edit members.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/members')}
        >
          <Text style={styles.backButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // ========================================
  // Loading
  // ========================================

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

  // ========================================
  // Screen
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
        {/* ==================================
            Header
        ================================== */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Edit Member
          </Text>

          <Text style={styles.subtitle}>
            Update the member information below.
          </Text>
        </View>

        {/* ==================================
            Personal Information
        ================================== */}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>
            Personal Information
          </Text>

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
            autoCapitalize="characters"
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
            {genders.map((item) => {
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
                  onPress={() => {
                    setGender(item);
                    closeAllDropdowns();
                  }}
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
        </View>

        {/* ==================================
            Family Information
        ================================== */}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>
            Family Information
          </Text>

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

              setShowMemberGroupList(false);
              setShowMinistryList(false);
              setShowStatusList(false);
            }}
          >
            <Text
              style={[
                styles.selectText,
                !spouseId &&
                  styles.placeholderText,
              ]}
            >
              {getSelectedSpouseName()}
            </Text>

            <Text style={styles.selectArrow}>
              {showSpouseList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showSpouseList && (
            <View style={styles.dropdown}>
              {/* None */}

              <Pressable
                style={[
                  styles.dropdownOption,
                  !spouseId &&
                    styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setSpouseId(null);
                  setShowSpouseList(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    !spouseId &&
                      styles.dropdownOptionTextSelected,
                  ]}
                >
                  None
                </Text>
              </Pressable>

              {/* Loading */}

              {loadingSpouses ? (
                <View
                  style={styles.loadingSpouse}
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
              ) : spouses.length === 0 ? (
                <View
                  style={styles.loadingSpouse}
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
                spouses.map((person) => {
                  const selected =
                    spouseId === person.id;

                  return (
                    <Pressable
                      key={person.id}
                      style={[
                        styles.dropdownOption,
                        selected &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setSpouseId(
                          person.id
                        );

                        setShowSpouseList(
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
                        {getFullName(person)}
                      </Text>
                    </Pressable>
                  );
                })
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
            onChangeText={setWeddingDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.helperText}>
            Leave blank if not applicable.
          </Text>
        </View>

        {/* ==================================
            Contact Information
        ================================== */}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>
            Contact Information
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
        </View>

        {/* ==================================
            Church Information
        ================================== */}

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>
            Church Information
          </Text>

          {/* Baptized */}

          <Text style={styles.label}>
            Baptized
          </Text>

          <View style={styles.optionContainer}>
            {/* Yes */}

            <Pressable
              style={[
                styles.option,
                baptized &&
                  styles.optionSelected,
              ]}
              onPress={() => {
                setBaptized(true);
                closeAllDropdowns();
              }}
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

            {/* No */}

            <Pressable
              style={[
                styles.option,
                !baptized &&
                  styles.optionSelected,
              ]}
              onPress={() => {
                setBaptized(false);
                closeAllDropdowns();
              }}
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

              setShowSpouseList(false);
              setShowMinistryList(false);
              setShowStatusList(false);
            }}
          >
            <Text style={styles.selectText}>
              {memberGroup}
            </Text>

            <Text style={styles.selectArrow}>
              {showMemberGroupList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showMemberGroupList && (
            <View style={styles.dropdown}>
              {memberGroups.map((item) => {
                const selected =
                  memberGroup === item;

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
              })}
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

              setShowSpouseList(false);
              setShowMemberGroupList(false);
              setShowStatusList(false);
            }}
          >
            <Text style={styles.selectText}>
              {ministry}
            </Text>

            <Text style={styles.selectArrow}>
              {showMinistryList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showMinistryList && (
            <View style={styles.dropdown}>
              {ministries.map((item) => {
                const selected =
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
                      setMinistry(item);

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
              })}
            </View>
          )}

          {/* Status */}

          <Text style={styles.label}>
            Status *
          </Text>

          <Pressable
            style={styles.selectInput}
            onPress={() => {
              setShowStatusList(
                !showStatusList
              );

              setShowSpouseList(false);
              setShowMemberGroupList(false);
              setShowMinistryList(false);
            }}
          >
            <Text style={styles.selectText}>
              {status}
            </Text>

            <Text style={styles.selectArrow}>
              {showStatusList
                ? '▲'
                : '▼'}
            </Text>
          </Pressable>

          {showStatusList && (
            <View style={styles.dropdown}>
              {statuses.map((item) => {
                const selected =
                  status === item;

                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.dropdownOption,
                      selected &&
                        styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      setStatus(item);

                      setShowStatusList(
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
              })}
            </View>
          )}
        </View>

        {/* ==================================
            Notice
        ================================== */}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Member Information
          </Text>

          <Text style={styles.noticeText}>
            Make sure the information is
            accurate before saving the member.
            Sensitive member information is
            encrypted before it is stored.
          </Text>
        </View>

        {/* ==================================
            Save Button
        ================================== */}

        <Pressable
          style={[
            styles.button,
            saving &&
              styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text style={styles.buttonText}>
              Save Changes
            </Text>
          )}
        </Pressable>

        {/* ==================================
            Cancel
        ================================== */}

        <Pressable
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>
            Cancel
          </Text>
        </Pressable>
      </ScrollView>

      {/* ==================================
          App Modal
      ================================== */}

      <AppModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttonText="OK"
        onClose={() => {
          setModalVisible(false);

          if (modalSuccess) {
            router.replace({
              pathname:
                '/(app)/members/[id]',
              params: {
                id,
              },
            });
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

  // ======================================
  // Form
  // ======================================

  form: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 22,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
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
  // Select
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
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },

  placeholderText: {
    color: '#9ca3af',
  },

  selectArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 10,
  },

  // ======================================
  // Inline Dropdown
  // ======================================

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
  // Spouse Loading
  // ======================================

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
    marginBottom: 20,
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
    marginTop: 5,
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
  // Loading
  // ======================================

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
  },

  // ======================================
  // Access Denied
  // ======================================

  deniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  deniedText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
  },

  backButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
