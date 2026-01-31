import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

interface ProBadgeProps {
  size?: 'small' | 'medium';
}

export const ProBadge = ({ size = 'small' }: ProBadgeProps) => {
  const { colors } = useTheme();

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.primary },
        isSmall && styles.badgeSmall,
      ]}
    >
      <Crown size={isSmall ? 12 : 16} color='#FFFFFF' />
      <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>
        PRO
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Rubik-SemiBold',
  },
  badgeTextSmall: {
    fontSize: 10,
  },
});
