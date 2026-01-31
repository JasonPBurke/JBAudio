import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Settings, Palette, Crown } from 'lucide-react-native';
import { ColorPickerModal } from '@/components/ColorPicker';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

const GeneralSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { numColumns, setNumColumns } = useSettingsStore();
  const { isProUser } = useSubscriptionStore();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const showColorPicker = () => {
    setColorPickerVisible(true);
  };

  const navigateToSubscription = () => {
    router.push('/(settings)/subscription');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Appearance' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={navigateToSubscription}>
          <SettingsCard title='Subscription' icon={Crown}>
            <View style={styles.subscriptionContent}>
              <View style={styles.subscriptionInfo}>
                <Text
                  style={[styles.subscriptionTitle, { color: themeColors.text }]}
                >
                  {isProUser ? 'Sonicbooks Pro' : 'Free Plan'}
                </Text>
                <Text
                  style={[
                    styles.subscriptionSubtitle,
                    { color: themeColors.textMuted },
                  ]}
                >
                  {isProUser ? 'All features unlocked' : 'Tap to upgrade'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isProUser ? '#10B981' : '#6B7280' },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isProUser ? 'PRO' : 'FREE'}
                </Text>
              </View>
            </View>
          </SettingsCard>
        </Pressable>

        <SettingsCard title='Display Settings' icon={Settings}>
          <View style={styles.sectionContent}>
            <Text
              style={[
                styles.settingLabel,
                { color: themeColors.textMuted },
              ]}
            >
              Number of Columns
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Choose how many columns to display in your library
            </Text>
            <SegmentedControl
              style={{ height: 40, marginTop: 8 }}
              backgroundColor={themeColors.modalBackground}
              activeFontStyle={{ color: themeColors.primary }}
              fontStyle={{
                color: themeColors.textMuted,
                fontFamily: 'Rubik',
              }}
              values={['One', 'Two', 'Three']}
              selectedIndex={numColumns - 1}
              onChange={(event) => {
                const numberOfColumns =
                  event.nativeEvent.selectedSegmentIndex + 1;
                setNumColumns(numberOfColumns);
              }}
            />
          </View>
        </SettingsCard>

        <SettingsCard title='Theme Settings' icon={Palette}>
          <View style={styles.sectionContent}>
            <Text
              style={[
                styles.settingLabel,
                { color: themeColors.textMuted },
              ]}
            >
              Primary Color
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Customize the accent color throughout the app
            </Text>
            <Pressable
              onPress={showColorPicker}
              style={styles.colorPickerButton}
            >
              <View
                style={[
                  styles.colorPreview,
                  { backgroundColor: themeColors.primary },
                ]}
              />
            </Pressable>
          </View>
        </SettingsCard>
      </ScrollView>

      <ColorPickerModal
        isVisible={colorPickerVisible}
        onClose={() => setColorPickerVisible(false)}
      />
    </View>
  );
};

export default GeneralSettingsScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  scrollView: {
    // flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 20,
    flexGrow: 1,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
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
  colorPickerButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  colorPreview: {
    height: 50,
    width: 50,
    borderRadius: 25,
  },
  subscriptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  subscriptionInfo: {
    flex: 1,
    gap: 4,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  subscriptionSubtitle: {
    fontSize: 14,
    fontFamily: 'Rubik',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Rubik-SemiBold',
  },
});
