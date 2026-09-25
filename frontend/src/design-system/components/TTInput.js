import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../tokens';

/**
 * TTInput - Input estilizado TECTODE ERP
 */
export function TTInput({
  label,
  error,
  hint,
  required = false,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline = false,
  numberOfLines = 1,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  inputStyle,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          focused && styles.focusedWrapper,
          error && styles.errorWrapper,
          disabled && styles.disabledWrapper,
          multiline && styles.multilineWrapper,
        ]}
      >
        {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            disabled && styles.disabledInput,
            inputStyle,
          ]}
          {...props}
        />

        {isPassword ? (
          <Pressable style={styles.passwordToggle} onPress={() => setShowPassword((s) => !s)}>
            <Text style={styles.passwordToggleText}>{showPassword ? '🙈' : '👁️'}</Text>
          </Pressable>
        ) : iconRight ? (
          <View style={styles.iconRight}>{iconRight}</View>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs + 2,
    width: '100%',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
  },
  required: {
    color: COLORS.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 42,
  },
  focusedWrapper: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  errorWrapper: {
    borderColor: COLORS.error,
  },
  disabledWrapper: {
    opacity: 0.5,
    backgroundColor: COLORS.background,
  },
  multilineWrapper: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.ui,
    paddingVertical: SPACING.sm,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  disabledInput: {
    color: COLORS.textMuted,
  },
  iconLeft: {
    marginRight: SPACING.sm,
  },
  iconRight: {
    marginLeft: SPACING.sm,
  },
  passwordToggle: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  passwordToggleText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  hintText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textMuted,
  },
});
