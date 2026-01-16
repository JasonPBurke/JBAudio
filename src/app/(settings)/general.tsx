import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { ColorPickerModal } from '@/components/ColorPicker';
import SettingsHeader from '@/components/SettingsHeader';
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
      <SettingsHeader title='General' />
      <View style={{ gap: 8 }}>
        <View style={styles.rowStyle}>
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Number of Columns:
          </Text>
          <SegmentedControl
            style={{ flex: 1, height: 40 }}
            backgroundColor={themeColors.background}
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
        <View style={styles.rowStyle}>
          <Text style={[styles.content, { color: themeColors.textMuted }]}>
            Change Primary Color:
          </Text>
          <Pressable onPress={showColorPicker}>
            <View
              style={[
                styles.showPrimaryColor,
                { backgroundColor: themeColors.primary, borderRadius: 50 },
              ]}
            />
          </Pressable>
        </View>
      </View>
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
    gap: 20,
    paddingHorizontal: screenPadding.horizontal,
  },
  rowStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 30,
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    marginVertical: 10,
  },
  showPrimaryColor: {
    height: 30,
    width: 30,
  },
});
