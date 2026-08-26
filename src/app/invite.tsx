import {
  router,
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import AppModal from '@/components/AppModal';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  supabase,
} from '@/lib/supabase';

export default function InviteScreen() {
  /*
   * ========================================
   * AUTH CONTEXT
   * ========================================
   */

  const {
    session,
    profile,
    loading: authLoading,
    refreshProfile,
  } = useAuth();

  /*
   * ========================================
   * LOCAL STATE
   * ========================================
   */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    fullName,
    setFullName,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

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

  const [
    success,
    setSuccess,
  ] = useState(false);

  /*
   * ========================================
   * AUTH ROUTING
   * ========================================
   */

  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading account...
        </Text>
      </View>
    );
  }

  /*
   * ========================================
   * NO SESSION
   * ========================================
   */

  if (!session) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>
          Your invitation session is missing or
          has expired.
        </Text>

        <Pressable
          style={styles.loginButton}
          onPress={() =>
            router.replace('/login')
          }
        >
          <Text style={styles.loginButtonText}>
            Go to Login
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * ========================================
   * MODAL
   * ========================================
   */

  function showModal(
    title: string,
    message: string,
    isSuccess = false
  ) {
    setModalTitle(title);

    setModalMessage(message);

    setSuccess(
      isSuccess
    );

    setModalVisible(true);
  }

  /*
   * ========================================
   * LOAD INVITATION
   * ========================================
   */

  useEffect(() => {
    async function loadInvitation() {
      try {
        /*
         * Get current session
         */

        const {
          data: {
            session:
              currentSession,
          },
        } =
          await supabase.auth.getSession();

        if (
          !currentSession?.user
        ) {
          showModal(
            'Invalid Invitation',
            'This invitation is invalid or has expired.'
          );

          return;
        }

        /*
         * Email
         */

        setEmail(
          currentSession.user.email ?? ''
        );

        /*
         * Full name
         */

        const metadata =
          currentSession.user
            .user_metadata;

        setFullName(
          metadata?.full_name ?? ''
        );

        console.log(
          '[INVITE] Invitation session loaded:',
          {
            email:
              currentSession.user.email,

            userId:
              currentSession.user.id,

            profileStatus:
              profile?.status ??
              null,

            profileRole:
              profile?.role ??
              null,
          }
        );
      } catch (error) {
        console.error(
          '[INVITE] Invitation loading error:',
          error
        );

        showModal(
          'Invitation Error',
          'We could not load your invitation.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, []);

  /*
   * ========================================
   * SET PASSWORD
   * ========================================
   */

  async function handleSetPassword() {
    /*
     * Validation
     */

    if (
      !password ||
      !confirmPassword
    ) {
      showModal(
        'Missing Information',
        'Please enter and confirm your password.'
      );

      return;
    }

    /*
     * Password length
     */

    if (
      password.length < 8
    ) {
      showModal(
        'Password Too Short',
        'Your password must contain at least 8 characters.'
      );

      return;
    }

    /*
     * Password confirmation
     */

    if (
      password !==
      confirmPassword
    ) {
      showModal(
        'Passwords Do Not Match',
        'Please make sure both passwords are the same.'
      );

      return;
    }

    /*
     * Prevent duplicate requests
     */

    if (saving) {
      return;
    }

    try {
      setSaving(true);

      /*
       * ======================================
       * 1. UPDATE SUPABASE AUTH PASSWORD
       * ======================================
       */

      const {
        data: userData,
        error:
          passwordError,
      } =
        await supabase.auth.updateUser({
          password,
        });

      /*
       * Password update failed
       */

      if (passwordError) {
        console.error(
          '[INVITE] Password update error:',
          passwordError
        );

        showModal(
          'Password Setup Failed',
          passwordError.message
        );

        return;
      }

      /*
       * Verify user
       */

      if (
        !userData.user
      ) {
        showModal(
          'Password Setup Failed',
          'We could not verify your account.'
        );

        return;
      }

      console.log(
        '[INVITE] Password successfully created for:',
        userData.user.email
      );

      /*
       * ======================================
       * 2. ACTIVATE ADMIN PROFILE
       * ======================================
       */

      const {
        data: activationData,
        error:
          activationError,
      } =
        await supabase.functions.invoke(
          'activate-admin-profile',
          {
            body: {},
          }
        );

      /*
       * ======================================
       * EDGE FUNCTION ERROR
       * ======================================
       */

      if (
        activationError
      ) {
        console.error(
          '[INVITE] Activate admin profile error:',
          activationError
        );

        /*
         * HTTP error
         */

        if (
          activationError instanceof
          FunctionsHttpError
        ) {
          try {
            const errorBody =
              await activationError
                .context
                .json();

            console.error(
              '[INVITE] Activation Edge Function response:',
              errorBody
            );

            showModal(
              'Account Activation Failed',
              errorBody?.error ??
                errorBody?.message ??
                'We could not activate your administrator account.'
            );
          } catch (
            parseError
          ) {
            console.error(
              '[INVITE] Could not parse activation error:',
              parseError
            );

            showModal(
              'Account Activation Failed',
              'The server could not activate your administrator account.'
            );
          }

          return;
        }

        /*
         * Network error
         */

        if (
          activationError instanceof
          FunctionsFetchError
        ) {
          showModal(
            'Connection Error',
            'Could not connect to the account activation service. Please check your internet connection and try again.'
          );

          return;
        }

        /*
         * Relay error
         */

        if (
          activationError instanceof
          FunctionsRelayError
        ) {
          showModal(
            'Server Connection Error',
            'The account activation service could not be reached. Please try again.'
          );

          return;
        }

        /*
         * Unknown error
         */

        showModal(
          'Account Activation Failed',
          activationError.message ||
            'We could not activate your administrator account.'
        );

        return;
      }

      /*
       * ======================================
       * 3. CHECK ACTIVATION RESPONSE
       * ======================================
       */

      console.log(
        '[INVITE] Activation response:',
        activationData
      );

      if (
        !activationData?.success
      ) {
        showModal(
          'Account Activation Failed',
          activationData?.error ??
            'Your password was created, but your administrator profile could not be activated.'
        );

        return;
      }

      /*
       * ======================================
       * 4. REFRESH AUTH PROFILE
       * ======================================
       *
       * IMPORTANT:
       *
       * The Edge Function has changed the
       * database profile to Active.
       *
       * AuthContext may still contain the
       * old Pending profile.
       *
       * Refresh it before allowing the
       * protected dashboard route.
       */

      console.log(
        '[INVITE] Refreshing local auth profile...'
      );

      const refreshedProfile =
        await refreshProfile();

      /*
       * Verify that the local AuthContext
       * now knows the account is active.
       */

      if (
        !refreshedProfile ||
        refreshedProfile.status !==
          'Active'
      ) {
        console.error(
          '[INVITE] Profile refresh did not return an Active profile:',
          refreshedProfile
        );

        showModal(
          'Account Activation Failed',
          'Your account was activated, but we could not refresh your session. Please try again.'
        );

        return;
      }

      console.log(
        '[INVITE] Local auth profile is now Active.'
      );

      /*
       * ======================================
       * 5. SUCCESS
       * ======================================
       */

      showModal(
        'Account Ready',
        'Your administrator account has been successfully created. You can now continue to the dashboard.',
        true
      );
    } catch (
      error
    ) {
      console.error(
        '[INVITE] Invitation setup error:',
        error
      );

      showModal(
        'Setup Error',
        'Something went wrong while setting up your account. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * ========================================
   * MODAL CLOSE
   * ========================================
   */

  function handleModalClose() {
    /*
     * Close the modal first.
     */

    setModalVisible(false);

    /*
     * The profile has already been refreshed
     * before this success modal was displayed.
     *
     * Therefore the RootLayout now knows:
     *
     * profile.status === "Active"
     *
     * and the protected dashboard route
     * is allowed.
     */

    if (success) {
      router.replace(
        '/dashboard'
      );
    }
  }

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading invitation...
        </Text>
      </View>
    );
  }

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
      <View style={styles.container}>
        {/* ==================================
            HEADER
        ================================== */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Welcome
          </Text>

          <Text style={styles.subtitle}>
            Create your administrator password to
            finish setting up your account.
          </Text>
        </View>

        {/* ==================================
            CARD
        ================================== */}

        <View style={styles.card}>
          {/* Full Name */}

          <Text style={styles.label}>
            Full Name
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.disabledInput,
            ]}
            value={
              fullName
            }
            editable={false}
            placeholder="Full Name"
            placeholderTextColor="#9ca3af"
          />

          {/* Email */}

          <Text style={styles.label}>
            Email Address
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.disabledInput,
            ]}
            value={
              email
            }
            editable={false}
            placeholder="Email Address"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />

          {/* Password */}

          <Text style={styles.label}>
            Create Password
          </Text>

          <TextInput
            style={styles.input}
            value={
              password
            }
            onChangeText={
              setPassword
            }
            placeholder="Enter password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          {/* Confirm Password */}

          <Text style={styles.label}>
            Confirm Password
          </Text>

          <TextInput
            style={styles.input}
            value={
              confirmPassword
            }
            onChangeText={
              setConfirmPassword
            }
            placeholder="Confirm password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          {/* ==================================
              PASSWORD REQUIREMENTS
          ================================== */}

          <View style={styles.notice}>
            <Text
              style={
                styles.noticeTitle
              }
            >
              Password Requirements
            </Text>

            <Text
              style={
                styles.noticeText
              }
            >
              • At least 8 characters
            </Text>

            <Text
              style={
                styles.noticeText
              }
            >
              • Keep your password private
            </Text>

            <Text
              style={
                styles.noticeText
              }
            >
              • You can change it later
            </Text>
          </View>

          {/* ==================================
              SUBMIT
          ================================== */}

          <Pressable
            style={[
              styles.button,
              saving &&
                styles.buttonDisabled,
            ]}
            onPress={
              handleSetPassword
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
                    styles.buttonText
                  }
                >
                  Setting up account...
                </Text>
              </>
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Create Password
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ====================================
          APP MODAL
      ==================================== */}

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
        onClose={
          handleModalClose
        }
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
      backgroundColor:
        '#f8fafc',
    },

    container: {
      flex: 1,
      justifyContent:
        'center',
      padding: 24,
    },

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
      color: '#6b7280',
      lineHeight: 21,
      marginTop: 6,
    },

    card: {
      backgroundColor:
        '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#e5e7eb',
      padding: 22,
    },

    label: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
      marginTop: 16,
    },

    input: {
      height: 50,
      borderWidth: 1,
      borderColor:
        '#d1d5db',
      borderRadius: 9,
      paddingHorizontal: 14,
      fontSize: 15,
      color: '#111827',
      backgroundColor:
        '#ffffff',
    },

    disabledInput: {
      backgroundColor:
        '#f3f4f6',
      color: '#6b7280',
    },

    notice: {
      backgroundColor:
        '#f8fafc',
      borderRadius: 10,
      padding: 14,
      marginTop: 20,
    },

    noticeTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#374151',
      marginBottom: 5,
    },

    noticeText: {
      fontSize: 13,
      color: '#6b7280',
      lineHeight: 20,
    },

    button: {
      height: 52,
      backgroundColor:
        '#111827',
      borderRadius: 9,
      alignItems: 'center',
      justifyContent:
        'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 22,
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
    },

    loadingScreen: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#f8fafc',
      padding: 24,
    },

    loadingText: {
      marginTop: 12,
      color: '#6b7280',
      textAlign: 'center',
    },

    loginButton: {
      marginTop: 20,
      backgroundColor:
        '#111827',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 9,
    },

    loginButtonText: {
      color: '#ffffff',
      fontWeight: '600',
    },
  });