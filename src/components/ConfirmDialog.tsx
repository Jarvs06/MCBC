import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

/*
 * ==========================================
 * ConfirmDialog
 * ==========================================
 *
 * admin-users/index.tsx previously repeated this exact overlay +
 * card + cancel/action-button shape twice (delete confirmation and
 * status-change confirmation), differing only in copy and the
 * action button's color. This makes that one component.
 */

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  actionText: string;
  actionVariant?: 'danger' | 'success';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  actionText,
  actionVariant = 'danger',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              actionVariant === 'danger' ? styles.dangerButton : styles.successButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={actionText}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Text style={styles.actionText}>{actionText}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
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

  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    padding: 22,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },

  cancelButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  cancelText: {
    color: colors.textLabel,
    fontSize: 13,
    fontWeight: '600',
  },

  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerButton: {
    backgroundColor: colors.danger,
  },

  successButton: {
    backgroundColor: colors.success,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  actionText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
  },
});
