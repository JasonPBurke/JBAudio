import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';

const BookStatsScreen = () => {
  const { colors: themeColors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Book Stats' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard title='Statistics' icon={BarChart3}>
          <View style={styles.placeholderContent}>
            <Text
              style={[
                styles.comingSoonText,
                { color: themeColors.textMuted },
              ]}
            >
              Book statistics coming soon
            </Text>
            <Text
              style={[
                styles.descriptionText,
                { color: themeColors.textMuted },
              ]}
            >
              Track your listening time, completed books, and reading
              progress.
            </Text>
          </View>
        </SettingsCard>
      </ScrollView>
    </View>
  );
};

export default BookStatsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  scrollView: {
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 60,
    flexGrow: 1,
  },
  placeholderContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
    alignItems: 'center',
  },
  comingSoonText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 16,
  },
  descriptionText: {
    fontFamily: 'Rubik',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
