import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../design-system/tokens';
import { TTButton, TTInput } from '../design-system/components';
import { TecodeLogo } from '../components/TecodeLogo';

/** Pantalla de inicio de sesión TECTODE ERP (Dark Theme) */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Credenciales inválidas. Verifique sus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {/* LOGO DE MARCA Tec[ode */}
        <View style={styles.brandHeader}>
          <TecodeLogo size="lg" layout="horizontal" />
        </View>

        <Text style={styles.welcomeTitle}>Iniciar Sesión</Text>
        <Text style={styles.welcomeSub}>Ingrese sus credenciales para acceder al ecosistema.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <TTInput
          label="Correo Electrónico"
          value={email}
          onChangeText={setEmail}
          placeholder="usuario@empresa.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          disabled={loading}
        />

        <TTInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          disabled={loading}
          onSubmitEditing={onSubmit}
        />

        <TTButton
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading || !email || !password}
          onPress={onSubmit}
          style={styles.submitBtn}
        >
          Acceder al Sistema
        </TTButton>

        <Text style={styles.footerNote}>
          Tec[ode ERP Multiempresa · Sistema Seguro SSL / TLS
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  brandLogoBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    color: COLORS.textPrimary,
    fontWeight: '900',
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  brandName: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    fontFamily: TYPOGRAPHY.fontFamily.display,
    letterSpacing: 1,
  },
  brandTag: {
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  welcomeTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.display,
  },
  welcomeSub: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textMuted,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    marginBottom: SPACING.xs,
  },
  errorBox: {
    backgroundColor: `${COLORS.error}15`,
    borderColor: `${COLORS.error}40`,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  submitBtn: {
    marginTop: SPACING.sm,
  },
  footerNote: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
