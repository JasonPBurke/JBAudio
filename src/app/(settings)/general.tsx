import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { Settings, Palette, Crown } from 'lucide-react-native';
import { ColorPickerModal } from '@/components/ColorPicker';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import SegmentedControl from '@/components/SegmentedControl';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import { ProBadge } from '@/components/ProBadge';

const GeneralSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const {
    numColumns,
    setNumColumns,
    meshGradientEnabled,
    setMeshGradientEnabled,
  } = useSettingsStore();
  const { isProUser } = useSubscriptionStore();
  const { isProUser: hasProAccess, presentPaywall } = useRequiresPro();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const meshGradientValue = useSharedValue(meshGradientEnabled ? 1 : 0);

  useEffect(() => {
    meshGradientValue.value = meshGradientEnabled ? 1 : 0;
  }, [meshGradientEnabled]);

  const toggleMeshGradient = () => {
    const newValue = !meshGradientEnabled;
    meshGradientValue.value = newValue ? 1 : 0;
    setMeshGradientEnabled(newValue);
  };

  const showColorPicker = async () => {
    if (!hasProAccess) {
      await presentPaywall();
      return;
    }
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
            <View style={{ marginTop: 8 }}>
              <SegmentedControl
                values={['One', 'Two', 'Three']}
                selectedIndex={numColumns - 1}
                onChange={(index) => setNumColumns(index + 1)}
                height={40}
              />
            </View>
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
              Accent Color
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
              <View style={styles.colorPickerRow}>
                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: themeColors.primary },
                  ]}
                />
                {!hasProAccess && <ProBadge size='small' />}
              </View>
            </Pressable>
          </View>
          <View style={styles.sectionContent}>
            <Text
              style={[
                styles.settingLabel,
                { color: themeColors.textMuted },
              ]}
            >
              Background Style
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Use a mesh gradient on the player and book details screens
            </Text>
          </View>
          <CompactSettingsRow
            label='Mesh Gradient'
            showDivider={false}
            control={
              <ToggleSwitch
                value={meshGradientValue}
                onPress={toggleMeshGradient}
                style={{ width: 72, height: 36, padding: 5 }}
                trackColors={{
                  on: themeColors.primary,
                  off: themeColors.modalBackground,
                }}
              />
            }
          />
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
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 300,
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
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
