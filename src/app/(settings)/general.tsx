import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { Settings, Palette } from 'lucide-react-native';
import { ColorPickerModal } from '@/components/ColorPicker';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import { screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useSettingsStore } from '@/store/settingsStore';

const GeneralSettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { numColumns, setNumColumns } = useSettingsStore();
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  const showColorPicker = () => {
    setColorPickerVisible(true);
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
            <SegmentedControl
              style={{ height: 40, marginTop: 8 }}
              backgroundColor={themeColors.modalBackground}
              activeFontStyle={{ color: themeColors.primary }}
              fontStyle={{ color: themeColors.textMuted }}
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
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
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
});
