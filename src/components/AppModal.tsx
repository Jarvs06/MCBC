import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radii } from '@/constants/theme';

type AppModalProps = {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  cancelButtonText?: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmButtonText?: string;
};

export default function AppModal({
  visible,
  title,
  message,
  buttonText = 'OK',
  cancelButtonText = 'Cancel',
  onClose,
  onConfirm,
  confirmButtonText = 'Confirm',
}: AppModalProps) {
  const isConfirmation = !!onConfirm;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {isConfirmation ? (
            <View style={styles.actions}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={cancelButtonText}
              >
                <Text style={styles.cancelButtonText}>{cancelButtonText}</Text>
              </Pressable>

              <Pressable
                style={styles.confirmButton}
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityLabel={confirmButtonText}
              >
                <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.button}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={buttonText}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 2,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 10,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
  },

  cancelButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  cancelButtonText: {
    color: colors.textLabel,
    fontSize: 14,
    fontWeight: '600',
  },

  confirmButton: {
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  confirmButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  button: {
    backgroundColor: colors.textPrimary,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignSelf: 'flex-end',
    marginTop: 22,
  },

  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});
