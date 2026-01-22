import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

type CompactSettingsRowProps = {
  label: string;
  control: ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
};

/**
 * Minimal settings row for inside collapsible sections
 * No icons (icon is in section header)
 */
const CompactSettingsRow = ({
  label,
  control,
  onPress,
  showDivider = true,
}: CompactSettingsRowProps) => {
  const { colors: themeColors } = useTheme();

  const content = (
    <>
      <View style={styles.container}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: themeColors.textMuted }]}>
            {label}
          </Text>
        </View>
        <View style={styles.control}>{control}</View>
      </View>
      {showDivider && (
        <View
          style={[
            styles.divider,
            {
              backgroundColor: withOpacity(themeColors.divider, 0.2),
            },
          ]}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{
          color: withOpacity(themeColors.primary, 0.08),
        }}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

export default CompactSettingsRow;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  labelContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
  control: {
    flexShrink: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
