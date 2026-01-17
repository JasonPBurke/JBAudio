import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FolderOpen, Trash2, FolderPlus } from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import SettingsCard from '@/components/settings/SettingsCard';
import CollapsibleSettingsSection from '@/components/settings/CollapsibleSettingsSection';
import CompactSettingsRow from '@/components/settings/CompactSettingsRow';
import { screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { refreshLibraryStore } from '@/store/library';
import {
  getLibraryFolders,
  removeLibraryFolder,
} from '@/db/settingsQueries';
import { directoryPicker } from '@/helpers/directoryPicker';

const LibrarySettingsScreen = () => {
  const { colors: themeColors } = useTheme();
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchLibraryFolders = async () => {
        const folders = await getLibraryFolders();
        if (isActive) {
          setLibraryFolders(folders);
        }
      };
      fetchLibraryFolders();

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
    await directoryPicker();
    const folders = await getLibraryFolders();
    setLibraryFolders(folders);
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
    // flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 20,
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
    fontWeight: '600',
    fontSize: 14,
  },
  addFolderContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  addFolderDescription: {
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
    fontWeight: '600',
    fontSize: 16,
  },
});
