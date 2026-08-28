import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

/*
 * ==========================================
 * FilterDropdown
 * ==========================================
 *
 * One inline dropdown for a list screen's filter row (Members:
 * Member Group/Ministry/Status, Admin Users: Status/Role, etc.),
 * so every filter bar in the app reads the same way — a single
 * WordPress-style row of compact dropdowns — instead of each
 * screen inventing its own filter layout.
 */

type FilterDropdownProps<T extends string> = {
  label: string;
  placeholder: string;
  value: T;
  options: readonly T[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: T) => void;
};

export function FilterDropdown<T extends string>({
  label,
  placeholder,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
}: FilterDropdownProps<T>) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.button}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Filter by ${label}`}
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.buttonText} numberOfLines={1}>
          {value === 'All' ? placeholder : value}
        </Text>

        <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {isOpen && (
        <View style={styles.menu}>
          {options.map((item) => {
            const selected = value === item;

            return (
              <Pressable
                key={item}
                onPress={() => onSelect(item)}
                style={[styles.option, selected && styles.optionSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
                  {item === 'All' ? placeholder : item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    minWidth: 150,
    position: 'relative',
    zIndex: 1000,
  },

  button: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  buttonText: {
    fontSize: 14,
    color: colors.textLabel,
  },

  arrow: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 12,
  },

  menu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radii.sm,
    overflow: 'hidden',
    zIndex: 1001,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  option: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 11,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  optionSelected: {
    backgroundColor: colors.statusInactiveBg,
  },

  optionText: {
    fontSize: 14,
    color: colors.textLabel,
  },

  optionTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
