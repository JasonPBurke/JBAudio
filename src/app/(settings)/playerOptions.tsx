import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { ArrowLeftRight } from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import SegmentedControl from '@/components/SegmentedControl';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';

const SKIP_OPTIONS = [10, 15, 30, 60];
const SKIP_LABELS = ['10s', '15s', '30s', '60s'];

const PlayerSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const skipBackDuration = useSettingsStore((s) => s.skipBackDuration);
  const skipForwardDuration = useSettingsStore((s) => s.skipForwardDuration);
  const setSkipBackDuration = useSettingsStore((s) => s.setSkipBackDuration);
  const setSkipForwardDuration = useSettingsStore(
    (s) => s.setSkipForwardDuration,
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Player' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard title='Skip Duration' icon={ArrowLeftRight}>
          <View style={styles.sectionContent}>
            <Text
              style={[styles.settingLabel, { color: themeColors.textMuted }]}
            >
              Skip Back
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted },
              ]}
            >
              How far to rewind when tapping the skip back button
            </Text>
            <View style={styles.controlWrapper}>
              <SegmentedControl
                values={SKIP_LABELS}
                selectedIndex={SKIP_OPTIONS.indexOf(skipBackDuration)}
                onChange={(index) => setSkipBackDuration(SKIP_OPTIONS[index])}
                height={40}
              />
            </View>
          </View>

          <View style={[styles.sectionContent, styles.sectionDivider]}>
            <Text
              style={[styles.settingLabel, { color: themeColors.textMuted }]}
            >
              Skip Forward
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted },
              ]}
            >
              How far to jump ahead when tapping the skip forward button
            </Text>
            <View style={styles.controlWrapper}>
              <SegmentedControl
                values={SKIP_LABELS}
                selectedIndex={SKIP_OPTIONS.indexOf(skipForwardDuration)}
                onChange={(index) =>
                  setSkipForwardDuration(SKIP_OPTIONS[index])
                }
                height={40}
              />
            </View>
          </View>
        </SettingsCard>
      </ScrollView>
    </View>
  );
};

export default PlayerSettingsScreen;

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
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sectionDivider: {
    marginTop: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 4,
  },
  settingDescription: {
    fontFamily: 'Rubik',
    fontSize: 13,
    lineHeight: 17,
  },
  controlWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
});
