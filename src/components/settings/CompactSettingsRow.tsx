import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { Info } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

type CompactSettingsRowProps = {
  label: string;
  control: ReactNode;
  /** Optional line under the label, for the short always-visible explanation. */
  description?: string;
  /** When set, an `Info` icon sits beside the label and opens the long copy. */
  onInfoPress?: () => void;
  onPress?: () => void;
  showDivider?: boolean;
};

/**
 * Minimal settings row for inside collapsible sections
 * No leading icon (that lives in the section header)
 *
 * `description` + `onInfoPress` carry the settings info pattern established by
 * `timer.tsx`'s Fadeout Duration: short line always visible, long copy behind a
 * pressable `Info` icon. That row could use the icon inline because its control
 * (a Picker) renders below; a row whose control is a switch cannot, since the
 * control slot is taken — which is why shake-to-reset needed a second
 * `How it works` row. Both props are optional, so existing call sites are
 * unchanged.
 */
const CompactSettingsRow = ({
  label,
  control,
  description,
  onInfoPress,
  onPress,
  showDivider = true,
}: CompactSettingsRowProps) => {
  const { colors: themeColors } = useTheme();

  const content = (
    <>
      <View style={styles.container}>
        <View style={styles.labelContainer}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: themeColors.textMuted }]}>
              {label}
            </Text>
            {onInfoPress && (
              <Pressable
                onPress={onInfoPress}
                hitSlop={10}
                style={styles.infoButton}
                accessibilityRole='button'
                accessibilityLabel={`About ${label}`}
              >
                <Info
                  color={themeColors.textMuted}
                  size={16}
                  strokeWidth={1.5}
                />
              </Pressable>
            )}
          </View>
          {description && (
            <Text
              style={[styles.description, { color: themeColors.textMuted }]}
            >
              {description}
            </Text>
          )}
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
  // Mirrors timer.tsx's `fadeoutHeader`, so the icon sits identically here.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: 'Rubik',
    fontSize: 16,
    // Without this the label takes its content width in the row and a long
    // one pushes the icon off the edge instead of wrapping.
    flexShrink: 1,
  },
  infoButton: {
    padding: 4,
  },
  description: {
    fontFamily: 'Rubik',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 4,
  },
  control: {
    flexShrink: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
