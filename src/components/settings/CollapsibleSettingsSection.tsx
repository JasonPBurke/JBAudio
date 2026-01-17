import { StyleSheet, View } from 'react-native';
import { ReactNode, useState } from 'react';
import { LucideIcon } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { ShadowedView } from 'react-native-fast-shadow';
import { useTheme } from '@/hooks/useTheme';
import SectionHeaderBar from './SectionHeaderBar';

type CollapsibleSettingsSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultExpanded?: boolean;
};

/**
 * Collapsible section card with animated height
 * Features shadow elevation and smooth expand/collapse animation
 */
const CollapsibleSettingsSection = ({
  title,
  icon,
  children,
  defaultExpanded = true,
}: CollapsibleSettingsSectionProps) => {
  const { colors: themeColors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const animatedHeight = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpand = () => {
    const newValue = !isExpanded;
    animatedHeight.value = withTiming(newValue ? 1 : 0, {
      duration: 300,
    });
    setIsExpanded(newValue);
  };

  const heightStyle = useAnimatedStyle(() => {
    return {
      height: animatedHeight.value * contentHeight,
      opacity: animatedHeight.value,
    };
  });

  return (
    <ShadowedView
      style={[
        styles.shadowContainer,
        // isExpanded && {
        {
          shadowColor: '#000000',
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: themeColors.overlay }]}>
        <SectionHeaderBar
          title={title}
          icon={icon}
          isExpanded={isExpanded}
          onPress={toggleExpand}
        />
        <Animated.View style={[styles.contentWrapper, heightStyle]}>
          <View
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              if (height !== contentHeight) {
                setContentHeight(height);
              }
            }}
            style={styles.content}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </ShadowedView>
  );
};

export default CollapsibleSettingsSection;

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: 12,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  contentWrapper: {
    overflow: 'hidden',
  },
  content: {
    paddingBottom: 12,
  },
});
