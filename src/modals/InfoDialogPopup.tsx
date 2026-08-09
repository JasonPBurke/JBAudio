import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { X } from 'lucide-react-native';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

const InfoDialogPopup = ({ isVisible, onClose, title, message }: any) => {
  const { height } = useWindowDimensions();

  return (
    <View style={styles.modalContainer}>
      <Modal
        animationType='fade'
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
      >
        <View style={styles.centeredView}>
          {/*
            THE BACKDROP IS A SIBLING BEHIND THE CARD, NOT ITS PARENT, AND THAT
            IS LOAD-BEARING FOR THE SCROLL.

            It used to be two nested `TouchableOpacity`s wrapping everything. A
            touchable claims the touch responder on touch-START, so a ScrollView
            underneath one has to win the responder back on MOVE — which it does
            only sometimes. The symptom is a message that scrolls on the third
            or fourth try and feels broken on the first two, and no ScrollView
            prop fixes it, because the contention is above the ScrollView.

            As a sibling the backdrop still catches every tap outside the card
            (it fills the modal), the card sits above it in z-order, and nothing
            competes with the ScrollView for the gesture.
          */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel={`Close ${title}`}
          />
          <View style={styles.modalView}>
            <Pressable style={styles.closeX} onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.modalTitleText}>{title}</Text>
            {/*
              The box has a fixed width and grows with its copy, so a long
              message runs off the bottom of the screen with nothing to say so
              — no scrollbar, no cut edge, just a missing last paragraph. Every
              caller passed one paragraph until the `Series Detection` card
              passed three, which fits a phone at 1x and clips above ~1.2x font
              scale.

              A ceiling rather than a fixed height: content shorter than 60% of
              the screen is laid out exactly as it was before, so the dialogs
              that were fine stay pixel-identical.
            */}
            <ScrollView style={[styles.messageScroll, { maxHeight: height * 0.6 }]}>
              <Text style={styles.modalText}>{message}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default InfoDialogPopup;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: withOpacity(colors.background, 0.5), // Semi-transparent overlay
  },
  modalView: {
    backgroundColor: colors.background,
    width: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.background,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitleText: {
    fontFamily: 'Rubik', fontWeight: '600',
    color: colors.text,
    marginBottom: 15,
    textAlign: 'left',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  // `modalView` centres its children, which would shrink the scroll view to
  // its content width and re-wrap the text; stretch keeps the old line breaks.
  messageScroll: {
    alignSelf: 'stretch',
  },
  modalText: {
    fontFamily: 'Rubik',
    color: colors.text,
    marginBottom: 15,
    textAlign: 'left',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  closeX: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
