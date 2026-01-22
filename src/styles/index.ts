import { fontSize } from '@/constants/tokens';
import { StyleSheet } from 'react-native';

export const defaultStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: fontSize.base,
  },
});

export const utilsStyles = StyleSheet.create({
  centeredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    height: 2,
    borderRadius: 16,
  },
  itemSeparator: {
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.3,
    // borderColor should be applied inline with theme colors
  },
  emptyComponent: {
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'Rubik',
  },
});
