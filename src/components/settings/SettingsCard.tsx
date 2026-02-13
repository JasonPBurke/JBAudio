import { StyleSheet, Text, View } from 'react-native';
import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react-native';
import { ShadowedView } from 'react-native-fast-shadow';
import { useTheme } from '@/hooks/useTheme';

type SettingsCardProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  rightAccessory?: ReactNode;
};

/**
 * Static (non-collapsible) settings card with header
 * Same visual design as expanded CollapsibleSettingsSection
 */
const SettingsCard = ({
  title,
  icon: Icon,
  children,
  rightAccessory,
}: SettingsCardProps) => {
  const { colors: themeColors } = useTheme();

  return (
    <ShadowedView
      style={[
        styles.shadowContainer,
        {
          shadowColor: '#000000',
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: themeColors.overlay }]}>
        <View style={styles.header}>
          <View style={styles.leftContent}>
            <Icon size={24} color={themeColors.primary} />
            <Text style={[styles.title, { color: themeColors.text }]}>
              {title}
            </Text>
          </View>
          {rightAccessory}
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </ShadowedView>
  );
};

export default SettingsCard;

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: 12,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
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
  },
  content: {
    paddingBottom: 16,
  },
});
