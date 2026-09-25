import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, TYPOGRAPHY } from '../design-system/tokens';

/**
 * TecodeLogoIcon - Símbolo de insignia oficial Tec[ode
 * Polígono morado con T estilizada, brackets < > y barra inferior inclinada blanca.
 */
export function TecodeLogoIcon({ size = 40, style }) {
  const scale = size / 40;

  return (
    <View style={[styles.iconWrapper, { width: size, height: size, borderRadius: size * 0.28 }, style]}>
      <View style={styles.iconInner}>
        <View style={styles.topRow}>
          <Text style={[styles.tChar, { fontSize: Math.round(18 * scale) }]}>T</Text>
          <Text style={[styles.codeChar, { fontSize: Math.round(14 * scale) }]}>&lt;&gt;</Text>
        </View>
        <View style={[styles.slashBar, { height: Math.max(3, Math.round(4 * scale)) }]} />
      </View>
    </View>
  );
}

/**
 * TecodeLogo - Logo completo oficial Tec[ode (Insignia + Wordmark Tec[ode)
 */
export function TecodeLogo({ size = 'md', showTag = true, layout = 'horizontal', style }) {
  const isLg = size === 'lg';
  const iconSize = isLg ? 46 : 34;

  return (
    <View style={[styles.logoContainer, layout === 'vertical' && styles.vertical, style]}>
      <TecodeLogoIcon size={iconSize} />

      <View style={[styles.textGroup, layout === 'vertical' && styles.verticalTextGroup]}>
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordText, isLg && styles.wordTextLg]}>Tec</Text>
          <Text style={[styles.bracketText, isLg && styles.wordTextLg]}>[</Text>
          <Text style={[styles.wordText, isLg && styles.wordTextLg]}>ode</Text>
        </View>
        {showTag ? (
          <Text style={[styles.tagline, isLg && styles.taglineLg]}>ERP Enterprise</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Icon Badge
  iconWrapper: {
    backgroundColor: '#7C3AED',
    borderWidth: 1.5,
    borderColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tChar: {
    fontFamily: 'serif',
    fontWeight: '900',
    color: '#080B14',
    fontStyle: 'normal',
  },
  codeChar: {
    fontFamily: TYPOGRAPHY.fontFamily.mono,
    fontWeight: '900',
    color: '#080B14',
    letterSpacing: -1,
  },
  slashBar: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xs,
    transform: [{ rotate: '-6deg' }],
    marginTop: 1,
  },

  // Full Logo Layout
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vertical: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  textGroup: {
    justifyContent: 'center',
    gap: 1,
  },
  verticalTextGroup: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: TYPOGRAPHY.fontFamily.display,
    letterSpacing: -0.5,
  },
  bracketText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  wordTextLg: {
    fontSize: 28,
  },
  tagline: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  taglineLg: {
    fontSize: 12,
  },
});
