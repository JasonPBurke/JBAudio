import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { Settings, Palette } from 'lucide-react-native';
import { ColorPickerModal } from '@/components/ColorPicker';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import AccentColorSwatches from '@/components/settings/AccentColorSwatches';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { usePlayerStateStore } from '@/store/playerState';
import { useBookById } from '@/store/library';
import { updateBookSelectedAccentColorType } from '@/db/bookQueries';
import SegmentedControl from '@/components/SegmentedControl';
import { useSettingsStore } from '@/store/settingsStore';
import { useRequiresPro } from '@/hooks/useRequiresPro';
import { ProBadge } from '@/components/ProBadge';
import ProFeaturePopup from '@/modals/ProFeaturePopup';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import { ArtworkColors } from '@/helpers/gradientColorSorter';

const GeneralSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { numColumns, setNumColumns } = useSettingsStore();
  const { isProUser: hasProAccess, hasPurchasedPro } = useRequiresPro();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [showProPopup, setShowProPopup] = useState(false);

  // Auto accent state
  const autoAccentEnabled = useThemeStore((s) => s.autoAccentEnabled);
  const setAutoAccentEnabled = useThemeStore((s) => s.setAutoAccentEnabled);
  const activeBookId = usePlayerStateStore((s) => s.activeBookId);
  const activeBook = useBookById(activeBookId ?? '');
  const autoAccentToggleValue = useSharedValue(autoAccentEnabled ? 1 : 0);

  useEffect(() => {
    autoAccentToggleValue.value = autoAccentEnabled ? 1 : 0;
  }, [autoAccentEnabled]);

  const showColorPicker = () => {
    if (!hasProAccess) {
      setShowProPopup(true);
      return;
    }
    setColorPickerVisible(true);
  };

  const handleAutoAccentToggle = async () => {
    if (!autoAccentEnabled && !hasProAccess) {
      setShowProPopup(true);
      return;
    }
    const newValue = !autoAccentEnabled;
    autoAccentToggleValue.value = newValue ? 1 : 0;
    await setAutoAccentEnabled(newValue);
  };

  const handleSwatchSelect = async (colorType: string) => {
    if (!activeBookId || !activeBook?.artworkColors) return;
    await updateBookSelectedAccentColorType(activeBookId, colorType);
    // Optimistically update the accent color
    const color = activeBook.artworkColors[colorType as keyof ArtworkColors];
    if (color) {
      useThemeStore.setState({ autoAccentColor: color, manualOverrideActive: false });
    }
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

        <SettingsCard
          title='Theme Settings'
          icon={Palette}
          rightAccessory={!hasPurchasedPro ? <ProBadge /> : undefined}
        >
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
              </View>
            </Pressable>
          </View>

          <CompactSettingsRow
            label='Auto Accent from Cover'
            showDivider={false}
            control={
              <ToggleSwitch
                value={autoAccentToggleValue}
                onPress={handleAutoAccentToggle}
                style={{ width: 72, height: 36, padding: 5 }}
                trackColors={{
                  on: themeColors.primary,
                  off: themeColors.modalBackground,
                }}
              />
            }
          />

          {autoAccentEnabled && activeBook?.artworkColors && (
            <View style={styles.swatchesContainer}>
              <AccentColorSwatches
                artworkColors={activeBook.artworkColors}
                selectedColorType={activeBook.selectedAccentColorType || 'vibrant'}
                onSelectColorType={handleSwatchSelect}
              />
            </View>
          )}

          {autoAccentEnabled && !activeBook?.artworkColors && (
            <Text
              style={[
                styles.settingDescription,
                { color: themeColors.textMuted, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
              ]}
            >
              Play a book with cover art to see color options
            </Text>
          )}
        </SettingsCard>
      </ScrollView>

      <ColorPickerModal
        isVisible={colorPickerVisible}
        onClose={() => setColorPickerVisible(false)}
      />

      <ProFeaturePopup
        isVisible={showProPopup}
        onClose={() => setShowProPopup(false)}
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
  swatchesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
