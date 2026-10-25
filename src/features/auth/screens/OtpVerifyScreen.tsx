import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSendOtpMutation, useVerifyOtpMutation } from '../api/mutations';
import { colors } from '../../../shared/theme/colors';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds
const OTP_VALIDITY_MS = 5 * 60 * 1000;

export function OtpVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    otpSent?: string;
    otpExpiresAt?: string;
    initialError?: string;
  }>();
  const email = params.email ?? '';
  const otpSent = params.otpSent !== 'false';
  const otpExpiresAt = params.otpExpiresAt ? Number(params.otpExpiresAt) : undefined;
  const initialError = params.initialError;

  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(
    otpSent ? otpExpiresAt ?? null : null
  );
  const [resendAvailableAt, setResendAvailableAt] = useState(
    otpSent && otpExpiresAt !== undefined
      ? otpExpiresAt - OTP_VALIDITY_MS + RESEND_COOLDOWN * 1000
      : 0
  );
  const countdown = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const secondsUntilExpiry = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const canResend = now >= resendAvailableAt;

  const inputRefs = useRef<(TextInputInstance | null)[]>([]);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const sendOtpMutation = useSendOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function handleOtpChange(text: string, index: number) {
    setError('');
    const newOtp = [...otp];

    if (text.length > 1) {
      // Handle paste
      const digits = text.replace(/\D/g, '').split('').slice(0, OTP_LENGTH);
      digits.forEach((d, i) => {
        if (i < OTP_LENGTH) newOtp[i] = d;
      });
      setOtp(newOtp);
      const lastIdx = Math.min(digits.length, OTP_LENGTH) - 1;
      inputRefs.current[lastIdx]?.focus();
      return;
    }

    newOtp[index] = text.replace(/\D/g, '');
    setOtp(newOtp);

    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  }

  async function handleVerify() {
    if (!expiresAt || Date.now() >= expiresAt) {
      setError('OTP-এর মেয়াদ শেষ হয়েছে। নতুন OTP নিন।');
      return;
    }
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('সম্পূর্ণ OTP কোড লিখুন');
      shake();
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await verifyOtpMutation.mutateAsync({ email, otp: code });
      if (res.success) {
        setSuccess('সফলভাবে যাচাই করা হয়েছে!');
        setTimeout(() => {
          router.replace('/(auth)/sign-in');
        }, 1500);
      } else {
        setError(res.message || 'OTP যাচাই ব্যর্থ হয়েছে');
        shake();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'OTP যাচাই ব্যর্থ হয়েছে');
      shake();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await sendOtpMutation.mutateAsync({ email });
      if (res.success) {
        setSuccess('নতুন OTP পাঠানো হয়েছে');
        setOtp(new Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        const sentAt = Date.now();
        setNow(sentAt);
        setExpiresAt(sentAt + OTP_VALIDITY_MS);
        setResendAvailableAt(sentAt + RESEND_COOLDOWN * 1000);
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={44} color={colors.primary} />
        </View>

        <Text style={styles.title}>OTP যাচাই করুন</Text>
        <Text style={styles.subtitle}>
          আমরা <Text style={{ fontWeight: '700', color: colors.ink }}>{email}</Text> এ একটি কোড পাঠিয়েছি
        </Text>
        {expiresAt !== null && (
          <Text style={styles.resendTimer}>
            OTP-এর মেয়াদ: {Math.floor(secondsUntilExpiry / 60)}:
            {String(secondsUntilExpiry % 60).padStart(2, '0')}
          </Text>
        )}

        {/* OTP Inputs */}
        <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
                error ? styles.otpInputError : null,
              ]}
              value={digit}
              onChangeText={(t) => handleOtpChange(t, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </Animated.View>

        {/* Error / Success */}
        {!!error && (
          <View style={styles.messageContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.accent} />
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}
        {!!success && (
          <View style={[styles.messageContainer, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.errorMessage, { color: colors.success }]}>{success}</Text>
          </View>
        )}

        {/* Verify Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleVerify}
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
              <Text style={styles.submitButtonText}>যাচাই করুন</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>কোড পাননি? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>পুনরায় পাঠান</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendTimer}>{countdown} সেকেন্ড পর পুনরায় পাঠান</Text>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: spacing.screenPadding,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpInputError: {
    borderColor: colors.accent,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorMessage: {
    fontSize: typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  submitButtonWrapper: {
    width: '100%',
    borderRadius: borderRadius.btn,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 20,
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: typography.body,
    color: colors.muted,
  },
  resendLink: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  resendTimer: {
    fontSize: typography.body,
    color: colors.muted,
    fontWeight: '600',
  },
});

export default OtpVerifyScreen;
