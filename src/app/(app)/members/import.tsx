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

import AppModal from '@/components/AppModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

type MemberGroup =
  (typeof memberGroups)[number];

// ========================================
// Types
// ========================================

type ParsedMember = {
  rowNumber: number;

  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;

  birth_date: string | null;

  wedding_date: string | null;

  spouse_name: string | null;

  address: string | null;

  member_group: MemberGroup;

  contact_no: string | null;

  baptized: boolean;

  valid: boolean;
  error: string | null;

  duplicate: boolean;
};

// ========================================
// Helpers
// ========================================

function normalizeText(value: string) {
  const text =
    value
      .replace(/\u00a0/g, ' ')
      .trim();

  /*
   * Spreadsheet convention:
   * "NOT MENTIONED" means blank.
   */
  if (
    text.toLowerCase() ===
    'not mentioned'
  ) {
    return '';
  }

  return text;
}

// ========================================
// Parse date
// ========================================

function parseDate(value: string): {
  date: string | null;
  error: string | null;
} {
  const text = normalizeText(value);

  if (!text) {
    return {
      date: null,
      error: null,
    };
  }

  // ----------------------------------------
  // Already YYYY-MM-DD
  // ----------------------------------------

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    const date = new Date(
      `${text}T00:00:00`
    );

    if (
      !Number.isNaN(date.getTime())
    ) {
      const [
        year,
        month,
        day,
      ] = text
        .split('-')
        .map(Number);

      if (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        date.getDate() === day
      ) {
        return {
          date: text,
          error: null,
        };
      }
    }

    return {
      date: null,
      error:
        'Invalid date.',
    };
  }

  // ----------------------------------------
  // Try JavaScript date parsing
  // ----------------------------------------

  const parsed =
    new Date(text);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    const year =
      parsed.getFullYear();

    const month =
      String(
        parsed.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        parsed.getDate()
      ).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      error: null,
    };
  }

  return {
    date: null,
    error:
      'Invalid birthday. Use a valid date such as December 3, 2011.',
  };
}

// ========================================
// Parse name
// ========================================

function parseName(
  value: string
): {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  error: string | null;
} {
  const text =
    normalizeText(value);

  if (!text) {
    return {
      first_name: '',
      middle_name: null,
      last_name: '',
      suffix: null,
      error:
        'Name is required.',
    };
  }

  const parts =
    text
      .split(',')
      .map(normalizeText)
      .filter(Boolean);

  if (parts.length < 2) {
    return {
      first_name: '',
      middle_name: null,
      last_name: '',
      suffix: null,
      error:
        'Name must use Last Name, First Name format.',
    };
  }

  const lastName =
    parts[0];

  let givenName =
    parts[1];

  let suffix:
    string | null = null;

  /*
   * Names may contain a comma-separated
   * suffix:
   *
   * Atinen, Rens Dielo Q., Jr.
   */

  if (parts.length >= 3) {
    suffix =
      parts
        .slice(2)
        .join(', ')
        .trim() || null;
  }

  /*
   * If the last token of the given-name
   * portion looks like a middle initial,
   * keep it as middle_name.
   *
   * Example:
   *
   * Atinen, Rens Dielo Q.
   *
   * First name  = Rens Dielo
   * Middle name = Q.
   * Last name   = Atinen
   *
   * This also supports:
   *
   * Atinen, Rens Q.
   * First name  = Rens
   * Middle name = Q.
   *
   * If there is no initial-like final token,
   * the complete given-name portion remains
   * the first name.
   */

  const givenTokens =
    givenName
      .split(/\s+/)
      .map(normalizeText)
      .filter(Boolean);

  let middleName:
    string | null = null;

  if (
    givenTokens.length >= 2
  ) {
    const lastGivenToken =
      givenTokens[
        givenTokens.length - 1
      ];

    const isMiddleInitial =
      /^[A-Za-z]\.$/.test(
        lastGivenToken
      );

    if (isMiddleInitial) {
      middleName =
        lastGivenToken;

      givenName =
        givenTokens
          .slice(0, -1)
          .join(' ');
    }
  }

  if (!lastName) {
    return {
      first_name: '',
      middle_name: middleName,
      last_name: '',
      suffix,
      error:
        'Last name is missing.',
    };
  }

  if (!givenName) {
    return {
      first_name: '',
      middle_name: middleName,
      last_name: lastName,
      suffix,
      error:
        'First name is missing.',
    };
  }

  return {
    first_name: givenName,
    middle_name: middleName,
    last_name: lastName,
    suffix,
    error: null,
  };
}

// ========================================
// Member Group
// ========================================

function parseMemberGroup(
  value: string
): {
  group: MemberGroup;
  error: string | null;
} {
  const text =
    normalizeText(value);

  if (!text) {
    return {
      group: 'General',
      error: null,
    };
  }

  const normalized =
    text.toLowerCase();

  const groupAliases:
    Record<string, MemberGroup> = {
      'junior youth':
        'Youth',
      'senior youth':
        'Youth',
      'young pro':
        'Young Professional',
    };

  const alias =
    groupAliases[
      normalized
    ];

  if (alias) {
    return {
      group: alias,
      error: null,
    };
  }

  const match =
    memberGroups.find(
      (group) =>
        group.toLowerCase() ===
        normalized
    );

  if (match) {
    return {
      group: match,
      error: null,
    };
  }

  return {
    group: 'General',
    error:
      `Unknown member group "${text}".`,
  };
}

// ========================================
// Baptized
// ========================================

function parseBaptized(
  value: string
): {
  baptized: boolean;
  error: string | null;
} {
  const text =
    normalizeText(value)
      .toLowerCase();

  if (!text) {
    return {
      baptized: false,
      error: null,
    };
  }

  if (
    ['yes', 'y', 'true', '1']
      .includes(text)
  ) {
    return {
      baptized: true,
      error: null,
    };
  }

  if (
    ['no', 'n', 'false', '0']
      .includes(text)
  ) {
    return {
      baptized: false,
      error: null,
    };
  }

  return {
    baptized: false,
    error:
      `Unknown baptized value "${text}". Use Yes or No.`,
  };
}

// ========================================
// Component
// ========================================

export default function ImportMembersScreen() {
  const {
    isSuperAdmin,
    isActive,
  } = useAuth();

  // ----------------------------------------
  // Input
  // ----------------------------------------

  const [pasteText, setPasteText] =
    useState('');

  // ----------------------------------------
  // Preview
  // ----------------------------------------

  const [members, setMembers] =
    useState<ParsedMember[]>([]);

  const [previewMode, setPreviewMode] =
    useState(false);

  // ----------------------------------------
  // Loading
  // ----------------------------------------

  const [checking, setChecking] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  // ----------------------------------------
  // Result
  // ----------------------------------------

  const [importedCount, setImportedCount] =
    useState(0);

  // ----------------------------------------
  // Modal
  // ----------------------------------------

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
  // Parse pasted spreadsheet
  // ========================================

  function parseSpreadsheet() {
    const text =
      pasteText.trim();

    if (!text) {
      showModal(
        'Nothing to Import',
        'Please copy your member rows from Google Sheets and paste them here.'
      );

      return;
    }

    const lines =
      text
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.trim().length > 0
        );

    if (lines.length === 0) {
      showModal(
        'Nothing to Import',
        'No rows were found.'
      );

      return;
    }

    // --------------------------------------
    // Detect header
    // --------------------------------------

    const firstColumns =
      lines[0]
        .split('\t')
        .map((value) =>
          normalizeText(value)
            .toUpperCase()
        );

    const hasHeader =
      firstColumns.some(
        (column) =>
          column === 'NAME'
      );

    const normalizedHeaders =
      firstColumns.map(
        (column) =>
          column
            .replace(
              /\s+/g,
              ' '
            )
            .trim()
      );

    const hasMenWomenHeader =
      normalizedHeaders.includes(
        'WEDDING ANNIVERSARY'
      ) ||
      normalizedHeaders.includes(
        'SPOUSE'
      );

    const hasBaptizedHeader =
      normalizedHeaders.includes(
        'BAPTIZED'
      );

    const dataLines =
      hasHeader
        ? lines.slice(1)
        : lines;

    if (dataLines.length === 0) {
      showModal(
        'No Member Rows',
        'The spreadsheet header was detected, but there are no member rows below it.'
      );

      return;
    }

    // --------------------------------------
    // Parse rows
    // --------------------------------------

    const parsed: ParsedMember[] =
      [];

    dataLines.forEach(
      (line, index) => {
        const rowNumber =
          hasHeader
            ? index + 2
            : index + 1;

        const columns =
          line
            .split('\t')
            .map(normalizeText);

        /*
         * Supported formats:
         *
         * General / Youth:
         * 0 NAME
         * 1 BIRTHDAY
         * 2 ADDRESS
         * 3 REMARKS
         * 4 CONTACT NO.
         * 5 BAPTIZED
         *
         * Men / Women:
         * 0 NAME
         * 1 BIRTHDAY
         * 2 WEDDING ANNIVERSARY
         * 3 SPOUSE
         * 4 ADDRESS
         * 5 REMARKS
         * 6 CONTACT NO.
         * 7 BAPTIZED
         */

        const name =
          columns[0] ?? '';

        const birthday =
          columns[1] ?? '';

        const isMenWomenFormat =
          columns.length >= 8;

        const weddingDate =
          isMenWomenFormat
            ? columns[2] ?? ''
            : '';

        const spouseName =
          isMenWomenFormat
            ? columns[3] ?? ''
            : '';

        const address =
          isMenWomenFormat
            ? columns[4] ?? ''
            : columns[2] ?? '';

        const remarks =
          isMenWomenFormat
            ? columns[5] ?? ''
            : columns[3] ?? '';

        const contactNo =
          isMenWomenFormat
            ? columns[6] ?? ''
            : columns[4] ?? '';

        const baptizedText =
          isMenWomenFormat
            ? columns[7] ?? ''
            : columns[5] ?? '';

        // ------------------------------------
        // Name
        // ------------------------------------

        const parsedName =
          parseName(name);

        // ------------------------------------
        // Birthday
        // ------------------------------------

        const parsedBirthday =
          parseDate(birthday);

        // ------------------------------------
        // Wedding anniversary
        // ------------------------------------

        const parsedWeddingDate =
          parseDate(weddingDate);

        // ------------------------------------
        // Group
        // ------------------------------------

        const parsedGroup =
          parseMemberGroup(
            remarks
          );

        // ------------------------------------
        // Baptized
        // ------------------------------------

        const parsedBaptized =
          parseBaptized(
            baptizedText
          );

        // ------------------------------------
        // Errors
        // ------------------------------------

        let error:
          | string
          | null = null;

        if (
          parsedName.error
        ) {
          error =
            parsedName.error;
        } else if (
          parsedBirthday.error
        ) {
          error =
            parsedBirthday.error;
        } else if (
          parsedWeddingDate.error
        ) {
          error =
            parsedWeddingDate.error;
        } else if (
          parsedGroup.error
        ) {
          error =
            parsedGroup.error;
        } else if (
          parsedBaptized.error
        ) {
          error =
            parsedBaptized.error;
        }

        parsed.push({
          rowNumber,

          first_name:
            parsedName.first_name,

          middle_name:
            parsedName.middle_name,

          last_name:
            parsedName.last_name,

          suffix:
            parsedName.suffix,

          birth_date:
            parsedBirthday.date,

          wedding_date:
            parsedWeddingDate.date,

          spouse_name:
            spouseName || null,

          address:
            address || null,

          member_group:
            parsedGroup.group,

          contact_no:
            contactNo || null,

          baptized:
            parsedBaptized.baptized,

          valid:
            !error,

          error,

          duplicate:
            false,
        });
      }
    );

    setMembers(parsed);
    setPreviewMode(true);

    // --------------------------------------
    // Check duplicates
    // --------------------------------------

    checkDuplicates(parsed);
  }

  // ========================================
  // Check duplicates
  // ========================================

  async function checkDuplicates(
    parsedMembers: ParsedMember[]
  ) {
    try {
      setChecking(true);

      const names =
        parsedMembers
          .filter(
            (member) =>
              member.valid
          )
          .map(
            (member) =>
              member.last_name
          )
          .filter(Boolean);

      if (names.length === 0) {
        return;
      }

      const uniqueNames =
        Array.from(
          new Set(
            names.map(
              (name) =>
                name.toLowerCase()
            )
          )
        );

      /*
       * We retrieve members and perform
       * case-insensitive comparison locally.
       *
       * This avoids relying on a specific
       * database extension.
       */

      const {
        data,
        error,
      } = await supabase
        .from('members')
        .select(
          'first_name, middle_name, last_name, suffix'
        );

      if (error) {
        console.error(
          'Duplicate check error:',
          error
        );

        return;
      }

      const existing =
        data ?? [];

      const updated =
        parsedMembers.map(
          (member) => {
            if (!member.valid) {
              return member;
            }

            const duplicate =
              existing.some(
                (existingMember) => {
                  const sameLastName =
                    existingMember.last_name
                      ?.trim()
                      .toLowerCase() ===
                    member.last_name
                      .trim()
                      .toLowerCase();

                  const sameFirstName =
                    existingMember.first_name
                      ?.trim()
                      .toLowerCase() ===
                    member.first_name
                      .trim()
                      .toLowerCase();

                  const existingMiddleName =
                    existingMember.middle_name
                      ?.trim()
                      .toLowerCase() ??
                    '';

                  const memberMiddleName =
                    member.middle_name
                      ?.trim()
                      .toLowerCase() ??
                    '';

                  const existingSuffix =
                    existingMember.suffix
                      ?.trim()
                      .toLowerCase() ??
                    '';

                  const memberSuffix =
                    member.suffix
                      ?.trim()
                      .toLowerCase() ??
                    '';

                  return (
                    sameLastName &&
                    sameFirstName &&
                    existingMiddleName ===
                      memberMiddleName &&
                    existingSuffix ===
                      memberSuffix
                  );
                }
              );

            return {
              ...member,
              duplicate,
            };
          }
        );

      setMembers(updated);
    } catch (error) {
      console.error(
        'Duplicate check error:',
        error
      );
    } finally {
      setChecking(false);
    }
  }

  // ========================================
  // Import
  // ========================================

  async function handleImport() {
    if (
      importing ||
      members.length === 0
    ) {
      return;
    }

    const validMembers =
      members.filter(
        (member) =>
          member.valid &&
          !member.duplicate
      );

    if (
      validMembers.length === 0
    ) {
      showModal(
        'Nothing to Import',
        'There are no valid new members to import.'
      );

      return;
    }

    try {
      setImporting(true);

      /*
       * ======================================
       * Encrypt sensitive fields
       * ======================================
       *
       * The import page must follow the same
       * encryption architecture as Add/Edit
       * Member.
       *
       * Sensitive fields are NEVER inserted
       * into the members table as plaintext.
       *
       * member-crypto owns the encryption key.
       */

      const encryptedRows: Array<{
        member: ParsedMember;
        row: Record<string, unknown>;
      }> = [];

      for (
        const member of validMembers
      ) {
        const sensitiveData = {
          first_name:
            member.first_name,

          middle_name:
            member.middle_name,

          last_name:
            member.last_name,

          suffix:
            member.suffix,

          birth_date:
            member.birth_date,

          address:
            member.address,

          contact_no:
            member.contact_no,
        };

        const {
          data:
            cryptoResponse,
          error:
            cryptoError,
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
            `[IMPORT] Encryption failed for row ${member.rowNumber}:`,
            cryptoError
          );

          showModal(
            'Unable to Secure Member Information',
            `Member row ${member.rowNumber} could not be securely processed. No members were imported. Please try again.`
          );

          return;
        }

        if (
          !cryptoResponse?.success ||
          !cryptoResponse?.data
        ) {
          console.error(
            `[IMPORT] Invalid encryption response for row ${member.rowNumber}:`,
            cryptoResponse
          );

          showModal(
            'Encryption Failed',
            `Member row ${member.rowNumber} could not be secured. No members were imported.`
          );

          return;
        }

        const encrypted =
          cryptoResponse.data;

        encryptedRows.push({
          member,

          row: {
            /*
             * Non-sensitive fields
             */
            member_no: null,

            wedding_date:
              member.wedding_date,

            spouse_id: null,

            baptized:
              member.baptized,

            status: 'Active',

            member_group:
              member.member_group,

            ministry: 'None',

            gender: null,

            /*
             * Encrypted fields
             */
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
          },
        });
      }

      /*
       * ======================================
       * Insert encrypted rows
       * ======================================
       *
       * The database receives ciphertext for
       * all sensitive member fields.
       */

      const {
        data: insertedMembers,
        error,
      } = await supabase
        .from('members')
        .insert(
          encryptedRows.map(
            (item) =>
              item.row
          )
        )
        .select('id');

      if (error) {
        console.error(
          'Bulk member import error:',
          error
        );

        showModal(
          'Import Failed',
          'The members could not be imported. Please review the preview and try again.'
        );

        return;
      }

      if (
        !insertedMembers ||
        insertedMembers.length !==
          encryptedRows.length
      ) {
        console.error(
          '[IMPORT] Inserted member count did not match the encrypted import rows.',
          {
            expected:
              encryptedRows.length,
            received:
              insertedMembers?.length ??
              0,
          }
        );

        showModal(
          'Import Failed',
          'The import could not be verified. Please try again.'
        );

        return;
      }

      /*
       * Keep the source spreadsheet row together
       * with the returned database ID.
       *
       * PostgreSQL returns INSERT ... RETURNING
       * rows in the statement's inserted-row order
       * for this batch operation.
       */
      const inserted =
        insertedMembers.map(
          (
            insertedMember,
            index
          ) => ({
            id:
              insertedMember.id,
            member:
              encryptedRows[index]
                .member,
          })
        );

      /*
       * ======================================
       * Resolve spouse relationships
       * ======================================
       *
       * The members table stores names encrypted,
       * so the client must not search plaintext
       * names directly.
       *
       * The server-side resolver can match the
       * spouse against both:
       *
       * 1. Members imported in this batch
       * 2. Members that already existed before
       *    this spreadsheet was imported
       *
       * Therefore spouses do NOT need to be
       * imported at the same time.
       */

      const spouseRequests =
        inserted
          .filter(
            (item) =>
              !!item.member
                .spouse_name
          )
          .map(
            (item) => ({
              member_id:
                item.id,
              spouse_name:
                item.member
                  .spouse_name,
            })
          );

      if (
        spouseRequests.length > 0
      ) {
        const {
          data:
            spouseResolution,
          error:
            spouseResolutionError,
        } =
          await supabase.functions.invoke(
            'resolve-member-spouses',
            {
              body: {
                members:
                  spouseRequests,
              },
            }
          );

        if (
          spouseResolutionError
        ) {
          console.error(
            '[IMPORT] Spouse resolution error:',
            spouseResolutionError
          );

          /*
           * The import itself succeeded.
           * Do not report the entire import as
           * failed just because a spouse could
           * not be linked.
           */
        } else {
          console.log(
            '[IMPORT] Spouse resolution result:',
            spouseResolution
          );
        }
      }

      setImportedCount(
        validMembers.length
      );

      showModal(
        'Import Complete',
        `${validMembers.length} member${validMembers.length === 1 ? '' : 's'} were successfully imported.`,
        true
      );
    } catch (error) {
      console.error(
        'Unexpected import error:',
        error
      );

      showModal(
        'Import Failed',
        'Something went wrong while importing the members.'
      );
    } finally {
      setImporting(false);
    }
  }

  // ========================================
  // Reset
  // ========================================

  function resetImport() {
    setPasteText('');
    setMembers([]);
    setPreviewMode(false);
    setImportedCount(0);
  }

  // ========================================
  // Access control
  // ========================================

  if (
    !isActive ||
    !isSuperAdmin
  ) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>
          Access Denied
        </Text>

        <Text style={styles.deniedText}>
          Only an active Super Admin can import members.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
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

  // ========================================
  // Statistics
  // ========================================

  const validCount =
    members.filter(
      (member) =>
        member.valid &&
        !member.duplicate
    ).length;

  const errorCount =
    members.filter(
      (member) =>
        !member.valid
    ).length;

  const duplicateCount =
    members.filter(
      (member) =>
        member.duplicate
    ).length;

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
        {/* Header */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Import Members
          </Text>

          <Text style={styles.subtitle}>
            Copy your member rows from Google
            Sheets and paste them below.
          </Text>
        </View>

        {/* Instructions */}

        <View style={styles.notice}>
          <Text
            style={
              styles.noticeTitle
            }
          >
            Google Sheets Format
          </Text>

          <Text
            style={styles.noticeText}
          >
            General / Youth: NAME {'\t'} BIRTHDAY {'\t'} ADDRESS {'\t'} REMARKS {'\t'} CONTACT NO. {'\t'} BAPTIZED
          </Text>

          <Text
            style={styles.noticeText}
          >
            Men / Women: NAME {'\t'} BIRTHDAY {'\t'} WEDDING ANNIVERSARY {'\t'} SPOUSE {'\t'} ADDRESS {'\t'} REMARKS {'\t'} CONTACT NO. {'\t'} BAPTIZED
          </Text>

          <Text
            style={styles.noticeText}
          >
            Member groups: Junior Youth → Youth; Senior Youth → Youth; Young Pro → Young Professional.
          </Text>

          <Text
            style={styles.noticeText}
          >
            BAPTIZED accepts Yes or No.
          </Text>

          <Text
            style={styles.noticeText}
          >
            Name format: Last Name, First Name [Middle Initial]
          </Text>

          <Text
            style={styles.noticeText}
          >
            Example: Atinen, Rens Dielo Q. → First Name: Rens Dielo; Middle Name: Q.; Last Name: Atinen.
          </Text>

          <Text
            style={styles.noticeText}
          >
            Blank REMARKS will become General.
          </Text>
        </View>

        {!previewMode && (
          <>
            {/* Paste */}

            <View style={styles.form}>
              <Text
                style={styles.label}
              >
                Paste Google Sheets Data
              </Text>

              <TextInput
                style={
                  styles.textArea
                }
                value={pasteText}
                onChangeText={
                  setPasteText
                }
                placeholder={
                  'Copy rows from Google Sheets and paste them here...'
                }
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  !pasteText.trim() &&
                    styles.buttonDisabled,
                ]}
                onPress={
                  parseSpreadsheet
                }
                disabled={
                  !pasteText.trim()
                }
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Preview Import
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={() => router.replace('/members')}
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
          </>
        )}

        {previewMode && (
          <>
            {/* Preview Header */}

            <View style={styles.previewHeader}>
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Import Preview
                </Text>

                <Text
                  style={
                    styles.previewSubtitle
                  }
                >
                  {members.length}{' '}
                  rows found
                </Text>
              </View>

              <Pressable
                style={
                  styles.smallButton
                }
                onPress={
                  resetImport
                }
                disabled={importing}
              >
                <Text
                  style={
                    styles.smallButtonText
                  }
                >
                  Start Over
                </Text>
              </Pressable>
            </View>

            {/* Statistics */}

            <View
              style={
                styles.statsContainer
              }
            >
              <View
                style={
                  styles.statCard
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {validCount}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Ready
                </Text>
              </View>

              <View
                style={
                  styles.statCard
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {errorCount}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Errors
                </Text>
              </View>

              <View
                style={
                  styles.statCard
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {duplicateCount}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Duplicates
                </Text>
              </View>
            </View>

            {checking && (
              <View
                style={
                  styles.checking
                }
              >
                <ActivityIndicator />

                <Text
                  style={
                    styles.checkingText
                  }
                >
                  Checking existing members...
                </Text>
              </View>
            )}

            {/* Rows */}

            <View style={styles.rowsContainer}>
              {members.map(
                (member) => {
                  const rowError =
                    !member.valid ||
                    member.duplicate;

                  return (
                    <View
                      key={`${member.rowNumber}-${member.first_name}-${member.last_name}`}
                      style={[
                        styles.memberRow,
                        rowError &&
                          styles.memberRowError,
                      ]}
                    >
                      <View
                        style={
                          styles.rowHeader
                        }
                      >
                        <Text
                          style={
                            styles.rowNumber
                          }
                        >
                          Row{' '}
                          {member.rowNumber}
                        </Text>

                        {member.duplicate ? (
                          <Text
                            style={
                              styles.errorBadge
                            }
                          >
                            DUPLICATE
                          </Text>
                        ) : member.error ? (
                          <Text
                            style={
                              styles.errorBadge
                            }
                          >
                            ERROR
                          </Text>
                        ) : (
                          <Text
                            style={
                              styles.readyBadge
                            }
                          >
                            READY
                          </Text>
                        )}
                      </View>

                      <Text
                        style={
                          styles.memberName
                        }
                      >
                        {member.last_name},{' '}
                        {member.first_name}
                        {member.middle_name
                          ? ` ${member.middle_name}`
                          : ''}
                        {member.suffix
                          ? `, ${member.suffix}`
                          : ''}
                      </Text>

                      <View
                        style={
                          styles.memberDetails
                        }
                      >
                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          Birthday:{' '}
                          {member.birth_date ??
                            '—'}
                        </Text>

                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          Group:{' '}
                          {member.member_group}
                        </Text>

                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          Baptized:{' '}
                          {member.baptized
                            ? 'Yes'
                            : 'No'}
                        </Text>

                        {member.wedding_date && (
                          <Text
                            style={
                              styles.detailText
                            }
                          >
                            Wedding Anniversary:{' '}
                            {member.wedding_date}
                          </Text>
                        )}

                        {member.spouse_name && (
                          <Text
                            style={
                              styles.detailText
                            }
                          >
                            Spouse:{' '}
                            {member.spouse_name}
                          </Text>
                        )}

                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          Contact:{' '}
                          {member.contact_no ??
                            '—'}
                        </Text>
                      </View>

                      {member.address && (
                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          Address:{' '}
                          {member.address}
                        </Text>
                      )}

                      {member.error && (
                        <Text
                          style={
                            styles.errorText
                          }
                        >
                          {member.error}
                        </Text>
                      )}

                      {member.duplicate && (
                        <Text
                          style={
                            styles.errorText
                          }
                        >
                          A member with the same
                          name already exists.
                        </Text>
                      )}
                    </View>
                  );
                }
              )}
            </View>

            {/* Import notice */}

            <View style={styles.notice}>
              <Text
                style={
                  styles.noticeTitle
                }
              >
                Import Settings
              </Text>

              <Text
                style={styles.noticeText}
              >
                Status will be set to Active.
              </Text>

              <Text
                style={styles.noticeText}
              >
                Ministry will be set to None.
              </Text>

              <Text
                style={styles.noticeText}
              >
                Baptized will be imported from the BAPTIZED column.
              </Text>

              <Text
                style={styles.noticeText}
              >
                Men / Women wedding anniversary and spouse values will be imported.
              </Text>

              <Text
                style={styles.noticeText}
              >
                Gender and member number will remain blank.
              </Text>
            </View>

            {/* Import */}

            <Pressable
              style={[
                styles.primaryButton,
                (importing ||
                  checking ||
                  validCount === 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={
                handleImport
              }
              disabled={
                importing ||
                checking ||
                validCount === 0
              }
            >
              {importing ? (
                <View
                  style={
                    styles.buttonContent
                  }
                >
                  <ActivityIndicator
                    color="#ffffff"
                    size="small"
                  />

                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Importing...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Import {validCount}{' '}
                  Member
                  {validCount === 1
                    ? ''
                    : 's'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={
                styles.cancelButton
              }
              onPress={() =>
                router.back()
              }
              disabled={importing}
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Modal */}

      <AppModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttonText="OK"
        onClose={() => {
          setModalVisible(false);

          if (
            modalSuccess
          ) {
            router.replace('/members');
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

  // ----------------------------------------
  // Header
  // ----------------------------------------

  header: {
    marginBottom: 24,
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  textArea: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // ----------------------------------------
  // Notice
  // ----------------------------------------

  notice: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 5,
  },

  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6b7280',
  },

  // ----------------------------------------
  // Preview
  // ----------------------------------------

  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  previewSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 3,
  },

  smallButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
  },

  smallButtonText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },

  // ----------------------------------------
  // Stats
  // ----------------------------------------

  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },

  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // ----------------------------------------
  // Checking
  // ----------------------------------------

  checking: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },

  checkingText: {
    fontSize: 13,
    color: '#6b7280',
  },

  // ----------------------------------------
  // Rows
  // ----------------------------------------

  rowsContainer: {
    gap: 10,
    marginBottom: 20,
  },

  memberRow: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 15,
  },

  memberRowError: {
    borderColor: '#d1d5db',
    backgroundColor: '#fafafa',
  },

  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  rowNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },

  readyBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },

  errorBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },

  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  memberDetails: {
    marginTop: 7,
    gap: 3,
  },

  detailText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4b5563',
    marginTop: 8,
    fontWeight: '600',
  },

  // ----------------------------------------
  // Buttons
  // ----------------------------------------

  primaryButton: {
    minHeight: 52,
    backgroundColor: '#111827',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelButtonText: {
    color: '#6b7280',
    fontSize: 15,
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
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },

  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
