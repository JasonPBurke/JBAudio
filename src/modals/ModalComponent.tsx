import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Modal, { ModalProps } from 'react-native-modal';
import ButtonComponent from './ModalButton';
import { colors, fontSize } from '@/constants/tokens';

interface Props {
  hideModal: () => void;
  hideCloseButton?: boolean;
  modalStyle?: StyleProp<ViewStyle>;
}

const ModalComponent = ({
  hideModal,
  hideCloseButton,
  style,
  children,
  ...props
}: Props & Partial<ModalProps>) => {
  return (
    <Modal {...props}>
      <View style={[styles.modal, style]}>
        {/* <Text style={styles.text}>Place for your content</Text> */}
        {!hideCloseButton && (
          <ButtonComponent
            title='Close'
            style={styles.closeButton}
            onClick={hideModal}
          />
        )}
        {children}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 30,
    height: 80,
  },
  modal: {
    flex: 3 / 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 30,
  },
  text: {
    fontSize: fontSize.sm,
  },
});

export default ModalComponent;
