import { StyleSheet, Text, View } from 'react-native';
import SettingsHeader from '@/components/SettingsHeader';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';

const PlayerSettingsScreen = () => {
  const { colors: themeColors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Player' />
      <View style={styles.content}>
        <Text style={[styles.comingSoonText, { color: themeColors.textMuted }]}>
          Coming soon
        </Text>
      </View>
    </View>
  );
};

export default PlayerSettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    gap: 20,
    paddingHorizontal: screenPadding.horizontal,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 18,
  },
});
