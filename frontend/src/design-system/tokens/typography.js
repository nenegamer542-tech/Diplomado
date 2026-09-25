/**
 * TECTODE Design Tokens - Typography
 */
import { Platform } from 'react-native';

const fontFamilyDisplay = Platform.select({
  web: "'Space Grotesk', 'Sora', system-ui, -apple-system, sans-serif",
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const fontFamilyUI = Platform.select({
  web: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMono = Platform.select({
  web: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  ios: 'Courier',
  android: 'monospace',
  default: 'monospace',
});

export const TYPOGRAPHY = {
  fontFamily: {
    display: fontFamilyDisplay,
    ui: fontFamilyUI,
    mono: fontFamilyMono,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 22,
    '3xl': 28,
    '4xl': 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};
