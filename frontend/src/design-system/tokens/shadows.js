/**
 * TECTODE Design Tokens - Shadows & Elevation
 */
import { Platform } from 'react-native';
import { COLORS } from './colors';

export const SHADOWS = {
  sm: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)' },
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    android: { elevation: 3 },
  }),
  md: Platform.select({
    web: { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)' },
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
  }),
  lg: Platform.select({
    web: { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)' },
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
  }),
  glowAccent: Platform.select({
    web: { boxShadow: `0 0 16px ${COLORS.accentGlow}` },
    ios: {
      shadowColor: COLORS.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
    },
    android: { elevation: 8 },
  }),
  glowPrimary: Platform.select({
    web: { boxShadow: `0 0 16px ${COLORS.primaryGlow}` },
    ios: {
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
    },
    android: { elevation: 8 },
  }),
};
