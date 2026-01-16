import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Trash2, FolderPlus } from 'lucide-react-native';
import SettingsHeader from '@/components/SettingsHeader';
import { screenPadding } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import { refreshLibraryStore } from '@/store/library';
import { getLibraryFolders, removeLibraryFolder } from '@/db/settingsQueries';
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
    }, [])
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
              prev.filter((path) => path !== folderPath)
            );
          },
        },
      ]
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
      <View>
        {libraryFolders.map((folder, index) => (
          <View key={index} style={styles.rowStyle}>
            <Text
              style={[
                styles.content,
                { flex: 1, color: themeColors.textMuted },
              ]}
              numberOfLines={2}
            >
              {folder}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemoveFolder(folder)}
              style={[
                styles.removeButton,
                { backgroundColor: withOpacity(themeColors.danger, 0.1) },
              ]}
            >
              <Trash2 size={20} color={themeColors.danger} />
              <Text
                style={[styles.removeButtonText, { color: themeColors.danger }]}
              >
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={handleAddFolder}
          style={[
            styles.addButton,
            { backgroundColor: withOpacity(themeColors.primary, 0.1) },
          ]}
        >
          <FolderPlus size={20} color={themeColors.primary} />
          <Text style={[styles.addButtonText, { color: themeColors.primary }]}>
            Add Library Folder
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default LibrarySettingsScreen;

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
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
