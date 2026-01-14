// Theme-specific color palettes
export const colorTokens = {
  dark: {
    background: '#1C1C1C',
    modalBackground: '#252525',
    text: '#ECEFF4',
    textMuted: '#d8dee9',
    icon: '#E5E9F0',
    maximumTrackTintColor: 'rgba(129, 161, 193, .4)',
    minimumTrackTintColor: '#FFB606',
    chapterActive: '#6d6d6dbf',
    chapterInactive: '#1d2233bf',
    divider: '#d8dee9',
    overlay: '#1C1C1C',
    // chapterListItem: '#22273b',
  },
  light: {
    background: '#eceff4', //#F5F5F5
    modalBackground: '#d8dee9', //#E8E8E8
    text: '#1C1C1C',
    textMuted: '#6B7280', //#a0a9ba
    icon: '#374151',
    maximumTrackTintColor: 'rgba(107, 114, 128, 0.4)',
    minimumTrackTintColor: '#FFB606',
    chapterActive: '#a0a9babf',
    chapterInactive: '#F3F4F6bf',
    divider: '#9CA3AF',
    overlay: '#FFFFFF',
    // chapterListItem: '#FFFFFF',
  },
  shared: {
    primary: '#FFB606',
    danger: '#FF5F56',
    success: '#8BD649',
    warning: '#FFCA8A',
    lightIcon: '#E5E9F0',
    lightText: '#ECEFF4',
    lightTextMuted: '#d8dee9',
  },
};

// Legacy export for backwards compatibility (will be removed after migration)
export const colors = {
  primary: '#FFB606',
  background: '#1C1C1C',
  modalBackground: '#252525',
  text: '#ECEFF4',
  textMuted: '#d8dee9',
  icon: '#E5E9F0',
  maximumTrackTintColor: 'rgba(129, 161, 193, .4)',
  minimumTrackTintColor: '#FFB606',
  danger: '#FF5F56',
  success: '#8BD649',
  warning: '#FFCA8A',
  divider: '#d8dee9',
  chapterActive: '#6d6d6d',
  chapterInactive: '#1d2233',
  // chapterListItem: '#22273b',
};

//? Gold/black/purple: #1C1C1C, # 3B3B3B, #FFE002, #FFB606, #B28228, #492666, #830982, #

export const fontSize = {
  xs: 12,
  sm: 16,
  base: 20,
  lg: 24,
};

export const screenPadding = {
  horizontal: 12,
};
