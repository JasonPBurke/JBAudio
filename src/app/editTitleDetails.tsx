import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useBookById } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';

const editTitleDetails = () => {
  const { top } = useSafeAreaInsets();
  const { bookId } = useLocalSearchParams<{
    bookId: string;
  }>();

  const book = useBookById(bookId);
  console.log(book);

  return (
    <BlurView
      experimentalBlurMethod='dimezisBlurView'
      intensity={30}
      style={[styles.container, { paddingTop: top }]}
    >
      <Animated.Text
        entering={FadeInUp.duration(400).delay(100)}
        style={styles.header}
      >
        Edit {book?.bookTitle} Details
      </Animated.Text>
      <Animated.Image
        // sharedTransitionTag='image'
        source={{
          uri: book?.artwork ?? unknownBookImageUri,
        }}
        style={styles.image}
      />
      <Animated.View
        entering={FadeInDown.duration(400).delay(400)}
        style={styles.card}
      >
        <Text>edit info container</Text>
      </Animated.View>
    </BlurView>
  );
};

export default editTitleDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: colors.modalBackground,
    alignItems: 'center',
    paddingTop: 20,
    // justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  text: {
    fontSize: 30,
    margin: 20,
  },
  card: {
    width: 375,
    height: 400, //'auto'
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    margin: 20,
  },
});
