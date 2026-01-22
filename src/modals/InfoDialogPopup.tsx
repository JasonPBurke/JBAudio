import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { X } from 'lucide-react-native';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';

const InfoDialogPopup = ({ isVisible, onClose, title, message }: any) => {
  return (
    <View style={styles.modalContainer}>
      <Modal
        animationType='fade'
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.centeredView}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalView}>
            <Pressable style={styles.closeX} onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.modalTitleText}>{title}</Text>
            <Text style={styles.modalText}>{message}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
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
    fontFamily: 'Rubik-SemiBold',
    color: colors.text,
    marginBottom: 15,
    textAlign: 'left',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
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
