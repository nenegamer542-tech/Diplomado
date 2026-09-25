import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, TYPOGRAPHY } from '../tokens';

/**
 * TTAvatar - Identificador visual de usuario/empresa TECTODE
 */
export function TTAvatar({ name, size = 'md', color = COLORS.primary, style }) {
  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.avatar, styles[`size_${size}`], { backgroundColor: `${color}25`, borderColor: color }, style]}>
      <Text style={[styles.text, styles[`textSize_${size}`], { color }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  size_sm: { width: 28, height: 28 },
  size_md: { width: 36, height: 36 },
  size_lg: { width: 48, height: 48 },

  text: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  textSize_sm: { fontSize: 11 },
  textSize_md: { fontSize: 13 },
  textSize_lg: { fontSize: 16 },
});
