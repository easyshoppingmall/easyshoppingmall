import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isAxiosError } from 'axios';
import { Header } from '../../../shared/components/Header';
import { colors } from '../../../shared/theme/colors';
import { customerApi, type ContactMessagePayload } from '../api/customerApi';

type IconName = keyof typeof Ionicons.glyphMap;
type ContactField = keyof ContactMessagePayload;
type ContactFormValues = ContactMessagePayload;
type ContactFormErrors = Partial<Record<ContactField, string>>;

const emptyForm: ContactFormValues = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

interface ContactInfoCardProps {
  icon: IconName;
  title: string;
  value?: string;
  description: string;
  tint: string;
  onPress?: () => void;
}

function ContactInfoCard({
  icon,
  title,
  value,
  description,
  tint,
  onPress,
}: ContactInfoCardProps) {
  const content = (
    <>
      <View
        className="mr-3 h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tint }}
      >
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[12px] font-bold text-ink">{title}</Text>
        <Text selectable className="mt-1 text-[12px] leading-[18px] text-ink">
          {value || 'তথ্য দেওয়া নেই'}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-4 text-muted">{description}</Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={15} color={colors.muted} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}: ${value}`}
      onPress={onPress}
      className="mb-2.5 flex-row items-center rounded-2xl border border-line bg-card p-3.5 shadow-sm"
    >
      {content}
    </Pressable>
  ) : (
    <View className="mb-2.5 flex-row items-center rounded-2xl border border-line bg-card p-3.5 shadow-sm">
      {content}
    </View>
  );
}

interface ContactInputProps {
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  onChangeText: (value: string) => void;
  onBlur?: () => void;
}

function ContactInput({
  label,
  placeholder,
  value,
  error,
  required = false,
  multiline = false,
  maxLength,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  onChangeText,
  onBlur,
}: ContactInputProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[12px] font-semibold text-ink">
        {label}
        {required ? <Text className="text-accent"> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={
          error || (required ? 'এই ঘরটি পূরণ করা আবশ্যক' : undefined)
        }
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={keyboardType !== 'email-address'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={maxLength}
        className={`rounded-xl border bg-bg px-3.5 text-[13px] text-ink ${
          multiline ? 'min-h-[132px] py-3' : 'h-12'
        } ${error ? 'border-accent' : 'border-line'}`}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-1 text-[10px] leading-4 text-accent"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone?.trim() ?? '';
  const subject = values.subject.trim();
  const message = values.message.trim();

  if (!name) errors.name = 'আপনার নাম লিখুন।';
  else if (name.length > 120) errors.name = 'নাম ১২০ অক্ষরের মধ্যে লিখুন।';

  if (!email) errors.email = 'আপনার ইমেইল ঠিকানা লিখুন।';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.email = 'একটি সঠিক ইমেইল ঠিকানা লিখুন।';
  }

  if (phone) {
    const digitCount = phone.replace(/\D/g, '').length;
    if (!/^[+\d\s().-]+$/.test(phone) || digitCount < 7 || digitCount > 15 || phone.length > 32) {
      errors.phone = 'সঠিক ফোন নম্বর লিখুন অথবা ঘরটি ফাঁকা রাখুন।';
    }
  }

  if (!subject) errors.subject = 'বার্তার বিষয় লিখুন।';
  else if (subject.length > 200) errors.subject = 'বিষয় ২০০ অক্ষরের মধ্যে লিখুন।';

  if (!message) errors.message = 'আপনার বার্তাটি লিখুন।';
  else if (message.length > 5000) errors.message = 'বার্তা ৫০০০ অক্ষরের মধ্যে লিখুন।';

  return errors;
}

function getSubmitErrorMessage(error: unknown): string {
  if (isAxiosError<{ message?: unknown }>(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
        ? 'অনুরোধের সময় শেষ হয়েছে। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
        : 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।';
    }
    if (error.response.status >= 500) {
      return 'সার্ভারে সাময়িক সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    }
    const message = error.response.data?.message;
    return typeof message === 'string' ? message : 'বার্তাটি পাঠানো যায়নি। তথ্যগুলো যাচাই করে আবার চেষ্টা করুন।';
  }
  return error instanceof Error
    ? error.message
    : 'বার্তাটি পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।';
}

async function openContactLink(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`${label} খোলা যায়নি`, 'এই মুহূর্তে লিংকটি খোলা সম্ভব হচ্ছে না।');
  }
}

export const ContactScreen: React.FC = () => {
  const [values, setValues] = useState<ContactFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<ContactFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [emailNotificationWarning, setEmailNotificationWarning] = useState('');
  const submissionInFlight = useRef(false);
  const websiteInfoQuery = useQuery({
    queryKey: ['customer', 'website-info'],
    queryFn: customerApi.getWebsiteInfo,
  });
  const contactMutation = useMutation({
    mutationFn: customerApi.sendContactMessage,
  });

  const websiteInfo = websiteInfoQuery.data;
  const supportNumber = websiteInfo?.number || websiteInfo?.supportContact || '';
  const email = websiteInfo?.email || '';
  const address = websiteInfo?.address || '';
  const officeHours = websiteInfo?.officeHours || '';

  const updateField = (field: ContactField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError('');
    setSubmitSuccess('');
    setEmailNotificationWarning('');
  };

  const handleSubmit = async () => {
    if (submissionInFlight.current) return;

    const nextErrors = validateContactForm(values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('চিহ্নিত ঘরগুলো ঠিক করে আবার চেষ্টা করুন।');
      setSubmitSuccess('');
      return;
    }

    submissionInFlight.current = true;
    setSubmitError('');
    setSubmitSuccess('');
    setEmailNotificationWarning('');

    try {
      const result = await contactMutation.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        subject: values.subject.trim(),
        message: values.message.trim(),
      });
      setValues(emptyForm);
      setFieldErrors({});
      setSubmitSuccess('আপনার বার্তাটি সফলভাবে সংরক্ষণ করা হয়েছে।');
      if (result.emailNotificationSent === false) {
        setEmailNotificationWarning(
          'বার্তাটি সংরক্ষিত হয়েছে, তবে ইমেইল বিজ্ঞপ্তি পাঠানো যায়নি। আমাদের সাপোর্ট টিম পরে এটি দেখতে পারবে।'
        );
      }
    } catch (error) {
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      submissionInFlight.current = false;
    }
  };

  const isSubmitting = contactMutation.isPending;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
      >
        <View className="w-full max-w-[1100px] self-center">
          <Header title="যোগাযোগ" showCart={false} />

          <View className="mb-5 mt-1 items-center rounded-[24px] bg-primary-light px-5 py-6">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-white">
              <Ionicons name="chatbubbles-outline" size={25} color={colors.primary} />
            </View>
            <Text className="text-center text-[21px] font-extrabold text-ink">
              আমাদের সাথে যোগাযোগ করুন
            </Text>
            <Text className="mt-2 max-w-[520px] text-center text-[12px] leading-[19px] text-muted">
              কোনো প্রশ্ন, পরামর্শ বা সহায়তার প্রয়োজন হলে আমাদের লিখুন। আপনার বার্তা
              সরাসরি আমাদের সহায়তা টিমের কাছে পৌঁছে যাবে।
            </Text>
          </View>

          <View className="md:flex-row md:items-start md:gap-5">
            <View className="mb-4 md:mb-0 md:w-[38%]">
              <View className="mb-2.5">
                <Text className="text-[16px] font-extrabold text-ink">যোগাযোগের তথ্য</Text>
                <Text className="mt-1 text-[11px] leading-[17px] text-muted">
                  ওয়েবসাইটের তথ্য থেকে হালনাগাদ যোগাযোগের মাধ্যম।
                </Text>
              </View>

              {websiteInfoQuery.isLoading ? (
                <View className="mb-2 flex-row items-center rounded-xl bg-card px-3 py-3">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="ml-2 text-[11px] text-muted">তথ্য লোড হচ্ছে…</Text>
                </View>
              ) : null}
              {websiteInfoQuery.isError ? (
                <View className="mb-2.5 rounded-xl border border-accent/20 bg-accent-light px-3 py-3">
                  <Text className="text-[11px] leading-[17px] text-ink">
                    যোগাযোগের তথ্য লোড করা যায়নি।
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void websiteInfoQuery.refetch()}
                    className="mt-1.5 self-start"
                  >
                    <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা করুন</Text>
                  </Pressable>
                </View>
              ) : null}

              <ContactInfoCard
                icon="call-outline"
                title="ফোন"
                value={supportNumber}
                description="ফোনে আমাদের সাথে কথা বলুন"
                tint={colors.tintBlue}
                onPress={
                  supportNumber
                    ? () =>
                        void openContactLink(
                          `tel:${supportNumber.replace(/[^\d+]/g, '')}`,
                          'ফোন'
                        )
                    : undefined
                }
              />
              <ContactInfoCard
                icon="mail-outline"
                title="ইমেইল"
                value={email}
                description="ইমেইলে আপনার প্রশ্ন পাঠান"
                tint={colors.tintGreen}
                onPress={
                  email
                    ? () => void openContactLink(`mailto:${email}`, 'ইমেইল')
                    : undefined
                }
              />
              <ContactInfoCard
                icon="location-outline"
                title="ঠিকানা"
                value={address}
                description="আমাদের ঠিকানা"
                tint={colors.tintOrange}
              />
              <ContactInfoCard
                icon="time-outline"
                title="অফিস সময়"
                value={officeHours}
                description="ওয়েবসাইটে প্রকাশিত অফিস সময়"
                tint={colors.tintPurple}
              />
            </View>

            <View className="rounded-[22px] border border-line bg-card p-4 shadow-sm md:flex-1 md:p-5">
              <View className="mb-4">
                <Text className="text-[16px] font-extrabold text-ink">আমাদের লিখে জানান</Text>
                <Text className="mt-1 text-[11px] leading-[17px] text-muted">
                  তারকা চিহ্নিত ঘরগুলো পূরণ করা আবশ্যক।
                </Text>
              </View>

              <View className="md:flex-row md:gap-3">
                <View className="md:flex-1">
                  <ContactInput
                    label="নাম"
                    placeholder="আপনার পুরো নাম"
                    value={values.name}
                    error={fieldErrors.name}
                    required
                    maxLength={120}
                    onChangeText={(value) => updateField('name', value)}
                  />
                </View>
                <View className="md:flex-1">
                  <ContactInput
                    label="ইমেইল"
                    placeholder="আপনার ইমেইল ঠিকানা"
                    value={values.email}
                    error={fieldErrors.email}
                    required
                    maxLength={254}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={(value) => updateField('email', value)}
                  />
                </View>
              </View>

              <View className="md:flex-row md:gap-3">
                <View className="md:flex-1">
                  <ContactInput
                    label="ফোন নম্বর"
                    placeholder="আপনার ফোন নম্বর (ঐচ্ছিক)"
                    value={values.phone ?? ''}
                    error={fieldErrors.phone}
                    maxLength={32}
                    keyboardType="phone-pad"
                    onChangeText={(value) => updateField('phone', value)}
                  />
                </View>
                <View className="md:flex-1">
                  <ContactInput
                    label="বিষয়"
                    placeholder="বার্তার বিষয় লিখুন"
                    value={values.subject}
                    error={fieldErrors.subject}
                    required
                    maxLength={200}
                    onChangeText={(value) => updateField('subject', value)}
                  />
                </View>
              </View>

              <ContactInput
                label="বার্তা"
                placeholder="আপনার প্রশ্ন বা বার্তা বিস্তারিত লিখুন…"
                value={values.message}
                error={fieldErrors.message}
                required
                multiline
                maxLength={5000}
                onChangeText={(value) => updateField('message', value)}
              />

              {submitError ? (
                <View
                  accessibilityLiveRegion="assertive"
                  className="mb-3 flex-row items-start rounded-xl bg-accent-light px-3 py-2.5"
                >
                  <Ionicons name="alert-circle-outline" size={17} color={colors.accent} />
                  <Text className="ml-2 flex-1 text-[11px] leading-[17px] text-ink">
                    {submitError}
                  </Text>
                </View>
              ) : null}
              {submitSuccess ? (
                <View
                  accessibilityLiveRegion="polite"
                  className="mb-3 flex-row items-start rounded-xl bg-tint-green px-3 py-2.5"
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color={colors.success} />
                  <Text className="ml-2 flex-1 text-[11px] leading-[17px] text-ink">
                    {submitSuccess}
                  </Text>
                </View>
              ) : null}
              {emailNotificationWarning ? (
                <View className="mb-3 flex-row items-start rounded-xl bg-tint-orange px-3 py-2.5">
                  <Ionicons name="mail-unread-outline" size={17} color={colors.warning} />
                  <Text className="ml-2 flex-1 text-[10px] leading-[16px] text-ink">
                    {emailNotificationWarning}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
                className={`min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3 ${
                  isSubmitting ? 'bg-primary/70' : 'bg-primary'
                }`}
                style={{
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="paper-plane-outline" size={17} color="#FFFFFF" />
                )}
                <Text className="ml-2 text-[13px] font-bold text-white">
                  {isSubmitting ? 'বার্তা পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-5 flex-row items-start rounded-2xl border border-primary/10 bg-primary-light p-4">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white">
              <Ionicons name="heart-outline" size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-extrabold text-ink">
                আপনার আস্থাই আমাদের অগ্রাধিকার
              </Text>
              <Text className="mt-1 text-[11px] leading-[18px] text-muted">
                প্রতিটি বার্তা আমাদের কাছে গুরুত্বপূর্ণ। আপনার দেওয়া তথ্য শুধু
                যোগাযোগ ও সহায়তার প্রয়োজনে ব্যবহার করা হয়; বার্তা সংরক্ষিত হলে
                নির্ধারিত সাপোর্ট ইমেইলে বিজ্ঞপ্তি পাঠানোর চেষ্টা করা হয়।
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ContactScreen;
