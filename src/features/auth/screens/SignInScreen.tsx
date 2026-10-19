import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { clearError } from '../../../store/authSlice';
import { useSignInMutation } from '../api/mutations';
import { colors } from '../../../shared/theme/colors';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

export function SignInScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((s) => s.auth);
  const signInMutation = useSignInMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    return () => {
      dispatch(clearError());
    };
  }, [dispatch, fadeAnim, slideAnim]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'ইমেইল লিখুন';
    if (!password) errs.password = 'পাসওয়ার্ড দিন';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignIn() {
    if (!validate()) return;
    try {
      await signInMutation.mutateAsync({ email: email.trim(), password });
    } catch {
      // The rejected Redux thunk sets the localized auth error shown by this screen.
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* ── Header ──────────────────── */}
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-open-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.brandTitle}>ইজি শপিং মল বিডি</Text>
            <Text style={styles.brandSubtitle}>আপনার অ্যাকাউন্টে লগইন করুন</Text>
          </View>

          {/* ── Form ────────────────────── */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>লগইন</Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputContainer,
                  fieldErrors.email ? styles.inputError : null,
                ]}
              >
                <Ionicons name="person-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ইমেইল"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {!!fieldErrors.email && (
                <Text style={styles.errorText}>{fieldErrors.email}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputContainer,
                  fieldErrors.password ? styles.inputError : null,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="পাসওয়ার্ড"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </View>
              {!!fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotWrapper}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>পাসওয়ার্ড ভুলে গেছেন?</Text>
            </TouchableOpacity>

            {/* API Error */}
            {!!error && (
              <View style={styles.apiErrorContainer}>
                <Ionicons name="alert-circle" size={18} color={colors.accent} />
                <Text style={styles.apiErrorText}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSignIn}
              disabled={isLoading}
              style={styles.submitButtonWrapper}
            >
              <LinearGradient
                colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>লগইন করুন</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── Footer ──────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>অ্যাকাউন্ট নেই? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.footerLink}>সাইন আপ করুন</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: spacing.screenPadding + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: 4,
  },

  // Form Card
  formCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  formTitle: {
    fontSize: typography.heroTitle,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Input
  inputGroup: {
    marginBottom: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.ink,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: typography.caption,
    color: colors.accent,
    marginTop: 4,
    marginLeft: 4,
  },

  // Forgot
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },

  // API Error
  apiErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  apiErrorText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
  },

  // Submit
  submitButtonWrapper: {
    borderRadius: borderRadius.btn,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.btn,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: typography.heading,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.body,
    color: colors.muted,
  },
  footerLink: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
});

export default SignInScreen;
