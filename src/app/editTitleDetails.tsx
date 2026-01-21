import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { colors } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBehavior } from '@/hooks/useBehavior';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useBookById, refreshLibraryStore } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import { useEffect, useState } from 'react';
import { BookEditableFields } from '@/types/Book';
import { updateBookDetails } from '@/db/bookQueries';

const editTitleDetails = () => {
  const { colors: themeColors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const behavior = useBehavior();
  const { bookId } = useLocalSearchParams<{
    bookId: string;
  }>();
  const book = useBookById(bookId);

  const [formState, setFormState] = useState<BookEditableFields>({
    bookTitle: '',
    author: '',
    narrator: '',
    genre: '',
    year: '',
    description: '',
    copyright: '',
  });

  useEffect(() => {
    if (book) {
      setFormState({
        bookTitle: book.bookTitle,
        author: book.author,
        narrator: book.metadata.narrator ?? '',
        genre: book.metadata.genre ?? '',
        year: book.metadata.year ?? '',
        description: book.metadata.description ?? '',
        copyright: book.metadata.copyright ?? '',
      });
    }
  }, [book]);

  const handleInputChange = (
    field: keyof BookEditableFields,
    value: string,
  ) => {
    setFormState((prevState) => ({ ...prevState, [field]: value }));
  };

  const handleSave = async () => {
    await updateBookDetails(bookId, formState);
    await refreshLibraryStore();
    router.back();
  };

  if (!book) {
    return (
      <View style={styles.container}>
        <Text
          style={[styles.header, { color: themeColors.textMuted }]}
        ></Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={behavior} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[
          styles.container,
          {
            flex: 1,
            paddingTop: top,
            paddingBottom: bottom + 50,
          },
        ]}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: bottom + 24,
        }}
      >
        <Animated.Text
          entering={FadeInUp.duration(400).delay(100)}
          style={[styles.header, { color: themeColors.textMuted }]}
        >
          {/* Edit {book?.bookTitle} Details */}
          Edit Book Details
        </Animated.Text>
        <Image
          contentFit='contain'
          source={{
            uri: book?.artwork ?? unknownBookImageUri,
          }}
          style={styles.image}
        />
        <Animated.View
          entering={FadeInDown.duration(600).delay(400)}
          style={[
            styles.card,
            { backgroundColor: themeColors.modalBackgroundWithOpacity },
          ]}
        >
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Title
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            value={formState.bookTitle}
            onChangeText={(text) => handleInputChange('bookTitle', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Author
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            value={formState.author}
            onChangeText={(text) => handleInputChange('author', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Narrator
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Narrator'}
            value={formState.narrator ?? ''}
            onChangeText={(text) => handleInputChange('narrator', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Genre Tags
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Genre Tags (comma separated)'}
            value={formState.genre ?? ''}
            onChangeText={(text) => handleInputChange('genre', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Release Year
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Release Year'}
            value={formState.year ?? ''}
            onChangeText={(text) => handleInputChange('year', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            keyboardType='numeric'
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Description
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Description'}
            value={formState.description ?? ''}
            onChangeText={(text) => handleInputChange('description', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            multiline
            textAlignVertical='top'
          ></TextInput>
          <Text
            style={[styles.fieldTitle, { color: themeColors.textMuted }]}
          >
            Copyright
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.background,
                color: themeColors.textMuted,
              },
            ]}
            placeholder={'Copyright'}
            value={formState.copyright ?? ''}
            onChangeText={(text) => handleInputChange('copyright', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: withOpacity(themeColors.textMuted, 0.3),
                },
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.primary,
                },
              ]}
              onPress={handleSave}
            >
              <Text
                style={[styles.buttonText, { color: themeColors.text }]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        {/* </BlurView> */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default editTitleDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 25,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingBottom: 10,
  },
  image: {
    width: '100%',
    height: 345,
  },
  text: {
    fontSize: 30,
    margin: 20,
  },
  card: {
    width: '100%',
    height: 'auto',
    padding: 20,
    paddingBottom: 40,
    marginTop: 20,
  },
  fieldTitle: {
    marginStart: 4,
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchInput: {
    width: '100%',
    borderRadius: 8,
    padding: 14,
    marginVertical: 10,
    fontSize: 18,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
