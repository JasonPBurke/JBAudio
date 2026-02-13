import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { withOpacity } from '@/helpers/colorUtils';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';


type ProFeaturePopupProps = {
  isVisible: boolean;
  onClose: () => void;
};

const ProFeaturePopup = ({ isVisible, onClose }: ProFeaturePopupProps) => {
  const { colors } = useTheme();
  const presentPaywall = useSubscriptionStore(
    (state) => state.presentPaywall,
  );

  const handleGetPro = async () => {
    onClose();
    await presentPaywall();
  };

  return (
    <Modal
      animationType='fade'
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={[
          styles.centeredView,
          { backgroundColor: withOpacity(colors.background, 0.5) },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.modalView, { backgroundColor: colors.overlay }]}
        >
          <Text style={[styles.titleText, { color: colors.text }]}>
            Pro Feature
          </Text>
          <Text style={[styles.messageText, { color: colors.textMuted }]}>
            This feature requires Sonicbooks Pro. Upgrade to unlock all
            premium features.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              style={[
                styles.button,
                styles.dismissButton,
                { backgroundColor: withOpacity(colors.textMuted, 0.15) },
              ]}
            >
              <Text
                style={[styles.buttonText, { color: colors.textMuted }]}
              >
                Dismiss
              </Text>
            </Pressable>
            <Pressable
              onPress={handleGetPro}
              style={[
                styles.button,
                styles.proButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Get Pro
              </Text>
            </Pressable>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default ProFeaturePopup;

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '80%',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  titleText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  messageText: {
    fontFamily: 'Rubik',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissButton: {},
  proButton: {},
  buttonText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 15,
  },
});
