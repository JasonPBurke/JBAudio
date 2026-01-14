import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBehavior } from '@/hooks/useBehavior';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useBookById } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import { useEffect, useState } from 'react';
import { BookEditableFields } from '@/types/Book';
import { updateBookDetails } from '@/db/bookQueries';

const editTitleDetails = () => {
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
        author: book.author, // Author is not editable in this implementation
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
    value: string
  ) => {
    setFormState((prevState) => ({ ...prevState, [field]: value }));
  };

  const handleSave = async () => {
    await updateBookDetails(bookId, formState);
    router.back();
  };

  if (!book) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Book not found</Text>
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
        {/* <BlurView
          experimentalBlurMethod='dimezisBlurView'
          intensity={30}
          tint='dark'
          style={[
            styles.container,
            { paddingTop: top, paddingBottom: bottom },
          ]}
        > */}
        <Animated.Text
          entering={FadeInUp.duration(400).delay(100)}
          style={styles.header}
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
          style={styles.card}
        >
          <Text style={styles.fieldTitle}>Title</Text>
          <TextInput
            style={styles.searchInput}
            value={formState.bookTitle}
            onChangeText={(text) => handleInputChange('bookTitle', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text style={styles.fieldTitle}>Author</Text>
          <TextInput
            style={styles.searchInput}
            value={formState.author}
            editable={false} //! Author editing is complex due to the data model
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text style={styles.fieldTitle}>Narrator</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={'Narrator'}
            value={formState.narrator ?? ''}
            onChangeText={(text) => handleInputChange('narrator', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text style={styles.fieldTitle}>Genre Tags</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={'Genre Tags (comma separated)'}
            value={formState.genre ?? ''}
            onChangeText={(text) => handleInputChange('genre', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <Text style={styles.fieldTitle}>Release Year</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={'Release Year'}
            value={formState.year ?? ''}
            onChangeText={(text) => handleInputChange('year', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            keyboardType='numeric'
          ></TextInput>
          <Text style={styles.fieldTitle}>Description</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={'Description'}
            value={formState.description ?? ''}
            onChangeText={(text) => handleInputChange('description', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            multiline
            textAlignVertical='top'
          ></TextInput>
          <Text style={styles.fieldTitle}>Copyright</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={'Copyright'}
            value={formState.copyright ?? ''}
            onChangeText={(text) => handleInputChange('copyright', text)}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
          ></TextInput>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={styles.buttonText}>Save</Text>
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
    // alignItems: 'center',
    paddingTop: 25,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textMuted,
    paddingBottom: 10,
  },
  image: {
    width: '100%',
    height: 345,
    // resizeMode: 'contain',
  },
  text: {
    fontSize: 30,
    margin: 20,
  },
  card: {
    width: 375,
    height: 'auto',
    backgroundColor: colors.modalBackground,
    borderRadius: 10,
    padding: 20,
    margin: 20,
  },
  fieldTitle: {
    marginStart: 4,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  searchInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 14,
    marginVertical: 10,
    color: colors.textMuted,
    fontSize: 16,
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
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: withOpacity(colors.textMuted, 0.3),
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
