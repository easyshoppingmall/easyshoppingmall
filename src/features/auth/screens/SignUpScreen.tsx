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
import { UserRole } from '../../../api/authApi';
import { useSendOtpMutation, useSignUpMutation } from '../api/mutations';
import { colors } from '../../../shared/theme/colors';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Role Card ──────────────────────────────────────────────────────────────

interface RoleCardProps {
  icon: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

function RoleCard({ icon, title, subtitle, selected, onPress }: RoleCardProps) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
      <Animated.View
        style={[
          styles.roleCard,
          selected && styles.roleCardSelected,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={styles.roleIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.roleTitle, selected && { color: colors.primary }]}>{title}</Text>
          <Text style={styles.roleSubtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Sign Up Screen ─────────────────────────────────────────────────────────

export function SignUpScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((s) => s.auth);
  const signUpMutation = useSignUpMutation();
  const sendOtpMutation = useSendOtpMutation();

  const [role, setRole] = useState<UserRole>('USER');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => {
      dispatch(clearError());
    };
  }, [dispatch, fadeAnim]);

  // ── Validation ─────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = 'আপনার নাম লিখুন';
    else if (name.trim().length < 3) errs.name = 'নাম কমপক্ষে ৩ অক্ষরের হতে হবে';

    if (!email.trim()) errs.email = 'ইমেইল লিখুন';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'সঠিক ইমেইল লিখুন';

    if (!phone.trim()) errs.phone = 'মোবাইল নম্বর লিখুন';
    else if (!/^01[3-9]\d{8}$/.test(phone.trim())) errs.phone = 'সঠিক ১১ সংখ্যার বাংলাদেশি নম্বর দিন';

    if (!password) errs.password = 'পাসওয়ার্ড দিন';
    else if (password.length < 6) errs.password = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;

    const normalizedEmail = email.trim().toLowerCase();
    try {
      await signUpMutation.mutateAsync({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password,
        role,
        ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
      });
      setIsSendingOtp(true);
      try {
        const otpResponse = await sendOtpMutation.mutateAsync({ email: normalizedEmail });
        const otpSent = otpResponse.success !== false;
        router.push({
          pathname: '/(auth)/verify-otp',
          params: {
            email: normalizedEmail,
            otpSent: String(otpSent),
            ...(otpSent
              ? { otpExpiresAt: String(Date.now() + 5 * 60 * 1000) }
              : { initialError: otpResponse.message || 'OTP পাঠানো যায়নি। আবার চেষ্টা করুন।' }),
          },
        });
      } catch (otpError) {
        const message =
          (otpError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'OTP পাঠানো যায়নি। আবার চেষ্টা করুন।';
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { email: normalizedEmail, otpSent: 'false', initialError: message },
        });
      } finally {
        setIsSendingOtp(false);
      }
    } catch {
      // The rejected Redux thunk sets the localized auth error shown by this screen.
    }
  }

  // ── Render ─────────────────────────────

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
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* ── Header ──────────────────── */}
          <View style={styles.headerSection}>
            <Text style={styles.brandTitle}>ইজি শপিং মল বিডি</Text>
            <Text style={styles.brandSubtitle}>কেনাকাটা ও ড্রপশিপিং, এক জায়গায়</Text>
          </View>

          {/* ── Role Selection ───────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>আপনি কীভাবে শুরু করতে চান?</Text>

            <RoleCard
              icon="🛍️"
              title="আমি কিনতে চাই"
              subtitle="পণ্য দেখুন, কার্টে রাখুন, অর্ডার করুন"
              selected={role === 'USER'}
              onPress={() => setRole('USER')}
            />

            <RoleCard
              icon="📦"
              title="আমি ড্রপশিপিং করতে চাই"
              subtitle="স্টক ছাড়াই বিক্রি করুন, লাভ রাখুন"
              selected={role === 'DROPSHIPPING'}
              onPress={() => setRole('DROPSHIPPING')}
            />
          </View>

          {/* ── Form Fields ─────────────── */}
          <View style={styles.section}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, fieldErrors.name ? styles.inputError : null]}>
                <Ionicons name="person-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="আপনার নাম"
                  placeholderTextColor={colors.muted}
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' }));
                  }}
                  autoCapitalize="words"
                />
              </View>
              {!!fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, fieldErrors.email ? styles.inputError : null]}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ইমেইল অ্যাড্রেস"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              {!!fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, fieldErrors.phone ? styles.inputError : null]}>
                <Ionicons name="call-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="মোবাইল নম্বর (০১XXXXXXXXX)"
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: '' }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>
              {!!fieldErrors.phone && <Text style={styles.errorText}>{fieldErrors.phone}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, fieldErrors.password ? styles.inputError : null]}>
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

            {/* Referral Code (optional) */}
            <View style={styles.inputGroup}>
              <View style={styles.inputContainer}>
                <Ionicons name="gift-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="রেফার কোড (ঐচ্ছিক)"
                  placeholderTextColor={colors.muted}
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          {/* ── API Error ───────────────── */}
          {!!error && (
            <View style={styles.apiErrorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.accent} />
              <Text style={styles.apiErrorText}>{error}</Text>
            </View>
          )}

          {/* ── Submit Button ───────────── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSignUp}
            disabled={isLoading || isSendingOtp}
            style={styles.submitButtonWrapper}
          >
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              {isLoading || isSendingOtp ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>সাইন আপ করুন</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Footer ──────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>আগে থেকেই অ্যাকাউন্ট আছে? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
              <Text style={styles.footerLink}>লগইন করুন</Text>
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
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.muted,
    marginTop: 4,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },

  // Role Card
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 10,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleIcon: {
    fontSize: 30,
    marginRight: 12,
  },
  roleTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.ink,
  },
  roleSubtitle: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // Input
  inputGroup: {
    marginBottom: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
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
    marginBottom: 20,
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
    marginTop: 4,
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

export default SignUpScreen;
