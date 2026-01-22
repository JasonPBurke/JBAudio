import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon, ChevronRight } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';

type SectionHeaderBarProps = {
  title: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onPress: () => void;
};

/**
 * Pressable header bar for collapsible sections
 * Features rotating chevron and background highlight on press
 */
const SectionHeaderBar = ({
  title,
  icon: Icon,
  isExpanded,
  onPress,
}: SectionHeaderBarProps) => {
  const { colors: themeColors } = useTheme();

  const chevronStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: withTiming(isExpanded ? '90deg' : '0deg', {
            duration: 200,
          }),
        },
      ],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{
        color: withOpacity(themeColors.divider, 0.16),
      }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? withOpacity(themeColors.divider, 0.08)
            : 'transparent',
        },
      ]}
    >
      <View style={styles.leftContent}>
        <Icon size={24} color={themeColors.primary} />
        <Text style={[styles.title, { color: themeColors.text }]}>
          {title}
        </Text>
      </View>
      <Animated.View style={chevronStyle}>
        <ChevronRight size={20} color={themeColors.textMuted} />
      </Animated.View>
    </Pressable>
  );
};

export default SectionHeaderBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 17,
    // fontWeight: '600',
  },
});
