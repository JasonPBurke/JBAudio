import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import {
  FolderOpen,
  Trash2,
  FolderPlus,
  Layers,
} from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CollapsibleSettingsSection from '@/components/settings/CollapsibleSettingsSection';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import ToggleSwitch from '@/components/animations/ToggleSwitch';
import { screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { refreshLibraryStore } from '@/store/library';
import {
  getLibraryFolders,
  removeLibraryFolder,
  getAutoChapterInterval,
  setAutoChapterInterval,
  getBooksWithoutChapterData,
} from '@/db/settingsQueries';
import { applyAutoChaptersToExistingBooks } from '@/helpers/autoChapterGenerator';
import { directoryPicker } from '@/helpers/directoryPicker';
import { router } from 'expo-router';
import { useRequiresPro } from '@/hooks/useRequiresPro';

const LibrarySettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const { isProUser, presentPaywall } = useRequiresPro();
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [autoChapterEnabled, setAutoChapterEnabled] = useState(false);
  const [autoChapterInterval, setAutoChapterIntervalState] =
    useState<string>('30');
  const [booksWithoutChaptersCount, setBooksWithoutChaptersCount] =
    useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const autoChapterToggleValue = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchSettings = async () => {
        const folders = await getLibraryFolders();
        const interval = await getAutoChapterInterval();
        const booksWithoutChapters = await getBooksWithoutChapterData();

        if (isActive) {
          setLibraryFolders(folders);
          if (interval !== null) {
            setAutoChapterEnabled(true);
            setAutoChapterIntervalState(interval.toString());
            autoChapterToggleValue.value = 1;
          } else {
            setAutoChapterEnabled(false);
            autoChapterToggleValue.value = 0;
          }
          setBooksWithoutChaptersCount(booksWithoutChapters.length);
        }
      };
      fetchSettings();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const handleRemoveFolder = (folderPath: string) => {
    Alert.alert(
      'Remove Library',
      `Are you sure you want to remove this folder and all of its books from your library?\n\n${folderPath}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeLibraryFolder(folderPath);
            await refreshLibraryStore();
            setLibraryFolders((prev) =>
              prev.filter((path) => path !== folderPath),
            );
          },
        },
      ],
    );
  };

  const handleAddFolder = async () => {
    router.back();
    await directoryPicker();
  };

  const handleAutoChapterToggle = async () => {
    // Check for Pro when trying to enable auto-chapters
    if (!autoChapterEnabled && !isProUser) {
      await presentPaywall();
      return;
    }

    const newEnabled = !autoChapterEnabled;
    setAutoChapterEnabled(newEnabled);
    autoChapterToggleValue.value = newEnabled ? 1 : 0;

    if (newEnabled) {
      // Enable with the currently selected interval
      await setAutoChapterInterval(parseInt(autoChapterInterval, 10));
    } else {
      // Disable auto-chapter generation
      await setAutoChapterInterval(null);
    }
  };

  const handleIntervalChange = async (value: string) => {
    setAutoChapterIntervalState(value);
    if (autoChapterEnabled) {
      await setAutoChapterInterval(parseInt(value, 10));
    }
  };

  const handleApplyToExisting = async () => {
    if (!isProUser) {
      await presentPaywall();
      return;
    }

    if (booksWithoutChaptersCount === 0) {
      Alert.alert(
        'No Books Found',
        'All books in your library already have chapter data.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Apply Auto-Chapters',
      `This will generate ${autoChapterInterval}-minute chapters for ${booksWithoutChaptersCount} book${booksWithoutChaptersCount > 1 ? 's' : ''} without chapter data. Continue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Apply',
          onPress: async () => {
            setIsApplying(true);
            try {
              const count = await applyAutoChaptersToExistingBooks();
              await refreshLibraryStore();
              setBooksWithoutChaptersCount(0);
              Alert.alert(
                'Success',
                `Auto-chapters generated for ${count} book${count > 1 ? 's' : ''}.`,
                [{ text: 'OK' }],
              );
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to apply auto-chapters. Please try again.',
                [{ text: 'OK' }],
              );
            } finally {
              setIsApplying(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.modalBackground },
      ]}
    >
      <SettingsHeader title='Library' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard title='Add Folder' icon={FolderPlus}>
          <View style={styles.addFolderContent}>
            <Text
              style={[
                styles.addFolderDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Select a folder to add to your audiobook library
            </Text>
            <TouchableOpacity
              onPress={handleAddFolder}
              style={[
                styles.addButton,
                {
                  backgroundColor: withOpacity(themeColors.primary, 0.1),
                },
              ]}
            >
              <FolderPlus size={20} color={themeColors.primary} />
              <Text
                style={[
                  styles.addButtonText,
                  { color: themeColors.primary },
                ]}
              >
                Add Library Folder
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsCard>

        <SettingsCard title='Auto-Generate Chapters' icon={Layers}>
          <View style={styles.autoChapterContent}>
            <Text
              style={[
                styles.addFolderDescription,
                { color: themeColors.textMuted },
              ]}
            >
              Automatically create chapter markers for audiobooks that don't
              have embedded chapter data
            </Text>
            <CompactSettingsRow
              label='Enable Auto-Chapters'
              control={
                <ToggleSwitch
                  value={autoChapterToggleValue}
                  onPress={handleAutoChapterToggle}
                  style={{ width: 72, height: 36, padding: 5 }}
                  trackColors={{
                    on: themeColors.primary,
                    off: themeColors.modalBackground,
                  }}
                />
              }
            />
            {autoChapterEnabled && (
              <>
                <View style={styles.pickerContainer}>
                  <Text
                    style={[
                      styles.pickerLabel,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    Chapter Interval
                  </Text>
                  <Picker
                    style={{
                      flex: 1,
                      height: 50,
                      color: themeColors.text,
                      backgroundColor: themeColors.modalBackground,
                      fontFamily: 'Rubik',
                    }}
                    // itemStyle={{ fontFamily: 'Rubik' }}
                    dropdownIconColor={themeColors.primary}
                    selectedValue={autoChapterInterval}
                    onValueChange={handleIntervalChange}
                    mode='dropdown'
                  >
                    <Picker.Item label='30 minutes' value='30' />
                    <Picker.Item label='60 minutes' value='60' />
                  </Picker>
                </View>
                <TouchableOpacity
                  onPress={handleApplyToExisting}
                  disabled={isApplying}
                  style={[
                    styles.addButton,
                    {
                      backgroundColor: withOpacity(
                        themeColors.primary,
                        0.1,
                      ),
                      opacity: isApplying ? 0.5 : 1,
                    },
                  ]}
                >
                  <Layers size={20} color={themeColors.primary} />
                  <Text
                    style={[
                      styles.addButtonText,
                      { color: themeColors.primary },
                    ]}
                  >
                    {isApplying
                      ? 'Applying...'
                      : `Apply to Existing Books (${booksWithoutChaptersCount})`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SettingsCard>

        {libraryFolders.length > 0 && (
          <CollapsibleSettingsSection
            title='Library Folders'
            icon={FolderOpen}
            defaultExpanded={false}
          >
            {libraryFolders.map((folder, index) => (
              <CompactSettingsRow
                key={folder}
                label={folder}
                showDivider={index < libraryFolders.length - 1}
                control={
                  <TouchableOpacity
                    onPress={() => handleRemoveFolder(folder)}
                    style={[
                      styles.removeButton,
                      {
                        backgroundColor: withOpacity(
                          themeColors.danger,
                          0.1,
                        ),
                      },
                    ]}
                  >
                    <Trash2 size={18} color={themeColors.danger} />
                    <Text
                      style={[
                        styles.removeButtonText,
                        { color: themeColors.danger },
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                }
              />
            ))}
          </CollapsibleSettingsSection>
        )}
      </ScrollView>
    </View>
  );
};

export default LibrarySettingsScreen;

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
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  removeButtonText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 14,
  },
  addFolderContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  addFolderDescription: {
    fontFamily: 'Rubik',
    fontSize: 14,
    lineHeight: 18,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 16,
  },
  autoChapterContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerLabel: {
    fontFamily: 'Rubik',
    fontSize: 16,
  },
});
