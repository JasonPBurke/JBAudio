import { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Text } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { ColorFormatsObject } from 'reanimated-color-picker';
import ColorPicker, {
  OpacitySlider,
  Panel5,
  PreviewText,
  InputWidget,
  Preview,
} from 'reanimated-color-picker';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { colorTokens } from '@/constants/tokens';

interface ColorPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ColorPickerModal({
  isVisible,
  onClose,
}: ColorPickerModalProps) {
  const { colors: themeColors } = useTheme();
  const customPrimaryColor = useThemeStore(
    (state) => state.customPrimaryColor,
  );
  const setCustomPrimaryColor = useThemeStore(
    (state) => state.setCustomPrimaryColor,
  );

  const [resultColor, setResultColor] = useState(themeColors.primary);
  const [originalColor, setOriginalColor] = useState(themeColors.primary);
  const currentColor = useSharedValue(themeColors.primary);

  // Update colors when modal opens
  useEffect(() => {
    if (isVisible) {
      setResultColor(themeColors.primary);
      setOriginalColor(themeColors.primary);
      currentColor.value = themeColors.primary;
    }
  }, [isVisible, themeColors.primary]);

  const onColorChange = (color: ColorFormatsObject) => {
    'worklet';
    currentColor.value = color.hex;
  };

  const onColorPick = (color: ColorFormatsObject) => {
    setResultColor(color.hex);
  };

  const handleDone = async () => {
    // Save the selected color to the database
    await setCustomPrimaryColor(resultColor);
    onClose();
  };

  const handleDismiss = () => {
    // Close without saving - discard any color changes
    onClose();
  };

  const handleReset = async () => {
    // Reset to default primary color
    const defaultPrimary = colorTokens.shared.primary;
    await setCustomPrimaryColor(null);
    setResultColor(defaultPrimary);
    currentColor.value = defaultPrimary;
  };

  const isDefault = customPrimaryColor === null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType='fade'
      onRequestClose={handleDismiss}
    >
      <View style={colorPickerStyle.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityLabel="Close color picker"
          accessibilityRole="button"
        >
          {/* Backdrop hit area - tapping here dismisses without saving */}
        </Pressable>
        <View
          style={[
            colorPickerStyle.colorPickerModalContent,
            { backgroundColor: themeColors.modalBackground },
          ]}
        >
          <View style={colorPickerStyle.colorPickerHeader}>
            <Text
              style={[
                colorPickerStyle.colorPickerTitle,
                { color: themeColors.text },
              ]}
            >
              Select Primary Color
            </Text>
            <Pressable onPress={handleDone}>
              <Text
                style={[
                  colorPickerStyle.colorPickerCloseButton,
                  { color: themeColors.primary },
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>
          {!isDefault && (
            <View style={colorPickerStyle.statusContainer}>
              <Text
                style={[
                  colorPickerStyle.statusText,
                  { color: themeColors.textMuted },
                ]}
              >
                Using custom color
              </Text>
            </View>
          )}
          <PrimaryColorPicker
            resultColor={resultColor}
            originalColor={originalColor}
            onColorChange={onColorChange}
            onColorPick={onColorPick}
          />
          <Pressable
            onPress={handleReset}
            style={[
              colorPickerStyle.resetButton,
              { backgroundColor: themeColors.background },
            ]}
          >
            <Text
              style={[
                colorPickerStyle.resetButtonText,
                { color: themeColors.text },
              ]}
            >
              Reset to Default
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface PrimaryColorPickerProps {
  resultColor?: string;
  originalColor?: string;
  onColorChange?: (color: ColorFormatsObject) => void;
  onColorPick?: (color: ColorFormatsObject) => void;
}

function PrimaryColorPicker({
  resultColor: initialResultColor,
  originalColor,
  onColorChange: customOnColorChange,
  onColorPick: customOnColorPick,
}: PrimaryColorPickerProps) {
  const { colors: themeColors } = useTheme();
  const initialColor =
    originalColor || initialResultColor || themeColors.primary;
  const currentColor = useSharedValue(initialColor);

  const onColorChange = (color: ColorFormatsObject) => {
    'worklet';
    currentColor.value = color.hex;
    customOnColorChange?.(color);
  };

  const onColorPick = (color: ColorFormatsObject) => {
    customOnColorPick?.(color);
  };

  return (
    <View style={colorPickerStyle.pickerContainer}>
      <ColorPicker
        value={initialColor}
        sliderThickness={25}
        thumbSize={24}
        thumbShape='circle'
        onChange={onColorChange}
        onCompleteJS={onColorPick}
        style={colorPickerStyle.picker}
      >
        <Panel5 style={[colorPickerStyle.panelStyle]} />
        {/* <OpacitySlider style={colorPickerStyle.sliderStyle} adaptSpectrum /> */}
        <InputWidget formats={['HEX']} />
        <Preview />
      </ColorPicker>
    </View>
  );
}

export default PrimaryColorPicker;

const colorPickerStyle = StyleSheet.create({
  picker: {
    gap: 20,
  },
  pickerContainer: {
    alignSelf: 'center',
    width: 300,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,

    elevation: 10,
  },
  panelStyle: {
    borderRadius: 4,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  colorPickerModalContent: {
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPickerTitle: {
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
  },
  colorPickerCloseButton: {
    fontSize: 16,
    fontFamily: 'Rubik-SemiBold',
  },
  statusContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Rubik',
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: 'Rubik-SemiBold',
  },
});
