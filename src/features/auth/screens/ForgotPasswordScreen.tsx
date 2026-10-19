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
import {
  useResetPasswordMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
} from '../api/mutations';
import { colors } from '../../../shared/theme/colors';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

type Step = 'request' | 'otp' | 'newPassword' | 'done';
const OTP_VALIDITY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function StepIndicator({ step }: { step: Step }) {
  const steps: { label: string; key: Step }[] = [
    { label: 'ইমেইল', key: 'request' },
    { label: 'OTP', key: 'otp' },
    { label: 'নতুন পাসওয়ার্ড', key: 'newPassword' },
  ];
  const currentIndex = steps.findIndex((item) => item.key === step);
  const doneIndex = step === 'done' ? steps.length : currentIndex;

  return (
    <View style={styles.stepRow}>
      {steps.map((item, index) => (
        <React.Fragment key={item.key}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                index <= doneIndex ? styles.stepDotActive : null,
                index < doneIndex ? styles.stepDotDone : null,
              ]}
            >
              {index < doneIndex ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={[styles.stepDotText, index <= doneIndex && { color: '#fff' }]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, index <= doneIndex && { color: colors.primary }]}>
              {item.label}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View style={[styles.stepLine, index < doneIndex && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

export function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('request');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const secondsUntilExpiry = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt - now) / 1000))
    : 0;
  const canResend = resendAvailableAt !== null && now >= resendAvailableAt;

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();
  const resetPasswordMutation = useResetPasswordMutation();

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fadeAnim]);

  // Animate step change
  function animateStep() {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  // ── Step 1: Request OTP ─────────────────

  async function handleSendOtp() {
    const email = emailOrPhone.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('সঠিক ইমেইল ঠিকানা লিখুন');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await sendOtpMutation.mutateAsync({ email });
      if (res.success) {
        const sentAt = Date.now();
        setNow(sentAt);
        setOtpExpiresAt(sentAt + OTP_VALIDITY_MS);
        setResendAvailableAt(sentAt + OTP_RESEND_COOLDOWN_MS);
        setStep('otp');
        animateStep();
        setSuccess('OTP কোড পাঠানো হয়েছে');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.message || 'OTP পাঠানো ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'OTP পাঠানো ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Verify OTP ──────────────────

  async function handleVerifyOtp() {
    if (!otpExpiresAt || Date.now() >= otpExpiresAt) {
      setError('OTP-এর মেয়াদ শেষ হয়েছে। নতুন OTP নিন।');
      return;
    }
    if (!otp.trim() || otp.trim().length < 4) {
      setError('সঠিক OTP কোড লিখুন');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await verifyOtpMutation.mutateAsync({
        email: emailOrPhone.trim().toLowerCase(),
        otp: otp.trim(),
      });
      if (res.success) {
        setStep('newPassword');
        animateStep();
      } else {
        setError(res.message || 'OTP যাচাই ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'OTP যাচাই ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Reset Password ──────────────

  async function handleResetPassword() {
    if (!otpExpiresAt || Date.now() >= otpExpiresAt) {
      setError('OTP-এর মেয়াদ শেষ হয়েছে। আবার OTP নিয়ে চেষ্টা করুন।');
      setStep('request');
      animateStep();
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('পাসওয়ার্ড মিলছে না');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await resetPasswordMutation.mutateAsync({
        email: emailOrPhone.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      if (res.success) {
        setStep('done');
        animateStep();
      } else {
        setError(res.message || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!canResend || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await sendOtpMutation.mutateAsync({ email: emailOrPhone.trim().toLowerCase() });
      if (!res.success) {
        setError(res.message || 'OTP পাঠানো ব্যর্থ হয়েছে');
        return;
      }
      const sentAt = Date.now();
      setNow(sentAt);
      setOtpExpiresAt(sentAt + OTP_VALIDITY_MS);
      setResendAvailableAt(sentAt + OTP_RESEND_COOLDOWN_MS);
      setOtp('');
      setSuccess('নতুন OTP পাঠানো হয়েছে');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'OTP পাঠানো ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────

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
          {/* Back */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={step === 'done' ? 'checkmark-circle-outline' : 'key-outline'}
                size={44}
                color={step === 'done' ? colors.success : colors.primary}
              />
            </View>
            <Text style={styles.title}>
              {step === 'done' ? 'সফল!' : 'পাসওয়ার্ড রিসেট করুন'}
            </Text>
          </View>

          {step !== 'done' && <StepIndicator step={step} />}

          {/* Form Card */}
          <View style={styles.formCard}>
            {step === 'request' && (
              <>
                <Text style={styles.description}>
                  আপনার অ্যাকাউন্টের ইমেইল ঠিকানা দিন। আমরা একটি OTP কোড পাঠাব।
                </Text>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="ইমেইল ঠিকানা"
                      placeholderTextColor={colors.muted}
                      value={emailOrPhone}
                      onChangeText={(t) => { setEmailOrPhone(t); setError(''); }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoFocus
                    />
                  </View>
                </View>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text style={styles.description}>
                  <Text style={{ fontWeight: '700' }}>{emailOrPhone}</Text> এ পাঠানো OTP কোডটি লিখুন
                </Text>
                <Text style={styles.otpTimer}>
                  OTP-এর মেয়াদ: {Math.floor(secondsUntilExpiry / 60)}:
                  {String(secondsUntilExpiry % 60).padStart(2, '0')}
                </Text>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="keypad-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="OTP কোড"
                      placeholderTextColor={colors.muted}
                      value={otp}
                      onChangeText={(t) => { setOtp(t); setError(''); }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>
                <TouchableOpacity
                  disabled={!canResend || isLoading}
                  onPress={handleResendOtp}
                  style={styles.resendButton}
                >
                  <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
                    {canResend
                      ? 'নতুন OTP পাঠান'
                      : `আবার পাঠাতে ${Math.max(0, Math.ceil(((resendAvailableAt || now) - now) / 1000))} সেকেন্ড অপেক্ষা করুন`}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'newPassword' && (
              <>
                <Text style={styles.description}>আপনার নতুন পাসওয়ার্ড সেট করুন</Text>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="নতুন পাসওয়ার্ড"
                      placeholderTextColor={colors.muted}
                      value={newPassword}
                      onChangeText={(t) => { setNewPassword(t); setError(''); }}
                      secureTextEntry={!showPassword}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-open-outline" size={18} color={colors.muted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                      placeholderTextColor={colors.muted}
                      value={confirmPassword}
                      onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>
              </>
            )}

            {step === 'done' && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={[styles.title, { marginTop: 16, color: colors.success }]}>
                  পাসওয়ার্ড রিসেট হয়েছে!
                </Text>
                <Text style={styles.description}>
                  আপনার নতুন পাসওয়ার্ড দিয়ে এখন লগইন করতে পারবেন।
                </Text>
              </View>
            )}

            {/* Error / Success */}
            {!!error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.accent} />
                <Text style={styles.errorMsg}>{error}</Text>
              </View>
            )}
            {!!success && (
              <View style={[styles.errorContainer, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.errorMsg, { color: colors.success }]}>{success}</Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isLoading}
              style={styles.submitButtonWrapper}
              onPress={() => {
                if (step === 'request') handleSendOtp();
                else if (step === 'otp') handleVerifyOtp();
                else if (step === 'newPassword') handleResetPassword();
                else router.replace('/(auth)/sign-in');
              }}
            >
              <LinearGradient
                colors={
                  step === 'done'
                    ? [colors.success, '#059669']
                    : [colors.primaryGradientStart, colors.primaryGradientEnd]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {step === 'request'
                      ? 'OTP পাঠান'
                      : step === 'otp'
                      ? 'যাচাই করুন'
                      : step === 'newPassword'
                      ? 'পাসওয়ার্ড রিসেট করুন'
                      : 'লগইন করুন'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4,
    marginBottom: 10,
  },
  headerSection: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: colors.ink,
  },

  // Step Indicator
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 24, paddingHorizontal: 10,
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.line, justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success },
  stepDotText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  stepLabel: { fontSize: 9, color: colors.muted, marginTop: 4, fontWeight: '600' },
  stepLine: { width: 30, height: 2, backgroundColor: colors.line, marginHorizontal: 4, marginBottom: 16 },
  stepLineActive: { backgroundColor: colors.success },

  // Form Card
  formCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: 20, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },
  description: {
    fontSize: typography.body, color: colors.muted,
    marginBottom: 18, lineHeight: 20, textAlign: 'center',
  },
  otpTimer: {
    fontSize: typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 12,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: -4,
    marginBottom: 14,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  resendDisabled: {
    color: colors.muted,
  },
  inputGroup: { marginBottom: 14 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: borderRadius.md,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: typography.base, color: colors.ink, height: '100%' },

  errorContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.accentLight, borderRadius: borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  errorMsg: {
    fontSize: typography.bodySmall, color: colors.accent,
    marginLeft: 8, fontWeight: '600', flex: 1,
  },

  submitButtonWrapper: {
    borderRadius: borderRadius.btn, overflow: 'hidden',
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  submitButton: {
    height: 52, justifyContent: 'center', alignItems: 'center',
    borderRadius: borderRadius.btn,
  },
  submitButtonText: {
    color: '#FFFFFF', fontSize: typography.heading,
    fontWeight: '700', letterSpacing: 0.5,
  },
});

export default ForgotPasswordScreen;
