import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
  const isConfirmation =
    !!onConfirm;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.message}>
            {message}
          </Text>

          {isConfirmation ? (
            <View
              style={
                styles.actions
              }
            >
              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={onClose}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  {cancelButtonText}
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.confirmButton
                }
                onPress={onConfirm}
              >
                <Text
                  style={
                    styles.confirmButtonText
                  }
                >
                  {confirmButtonText}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.button}
              onPress={onClose}
            >
              <Text
                style={styles.buttonText}
              >
                {buttonText}
              </Text>
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
    backgroundColor:
      'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6b7280',
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
    borderColor: '#d1d5db',
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },

  confirmButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  button: {
    backgroundColor: '#111827',
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignSelf: 'flex-end',
    marginTop: 22,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
