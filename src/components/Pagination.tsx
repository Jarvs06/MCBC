import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

/*
 * ==========================================
 * Pagination
 * ==========================================
 *
 * Prev / Page X of Y / Next bar shared by list screens (Members,
 * Admin Users, ...). Renders nothing when there's only one page,
 * so a screen can render it unconditionally.
 */

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

export function Pagination({ currentPage, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <View style={styles.pagination}>
      <Pressable
        style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
        onPress={onPrev}
        disabled={currentPage === 1}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>‹ Prev</Text>
      </Pressable>

      <Text style={styles.pageIndicator}>
        Page {currentPage} of {totalPages}
      </Text>

      <Pressable
        style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
        onPress={onNext}
        disabled={currentPage === totalPages}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Text
          style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}
        >
          Next ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 20,
  },

  pageButton: {
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  pageButtonDisabled: {
    opacity: 0.4,
  },

  pageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLabel,
  },

  pageButtonTextDisabled: {
    color: colors.textMuted,
  },

  pageIndicator: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
