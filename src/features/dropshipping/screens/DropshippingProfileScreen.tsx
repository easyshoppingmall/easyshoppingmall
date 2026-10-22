import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { authApi, type UpdateOwnProfilePayload, type UserProfile } from '../../../api/authApi';
import { signOut, updateCurrentUser } from '../../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import { formatDropshippingNumber, formatDropshippingTaka } from '../api/homeApi';
import {
  dropshippingHomeQueryKeys,
  useDropshippingOrdersQuery,
  useDropshippingProfileDashboardQuery,
} from '../api/queries';
import {
  dropshippingProfileErrorMessage,
  updateDropshippingUserImage,
} from '../api/profileApi';

type Gender = '' | 'Male' | 'Female' | 'Other';

interface ProfileDraft {
  name: string;
  mobile: string;
  dateOfBirth: string;
  gender: Gender;
}

function profileDraftFrom(user?: UserProfile): ProfileDraft {
  return {
    name: user?.name ?? '',
    mobile: String(user?.mobile ?? user?.phone ?? ''),
    dateOfBirth: String(user?.date_of_birth ?? '').slice(0, 10),
    gender: user?.gender ?? '',
  };
}

function displayText(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'হ্যাঁ' : 'না';
  return 'তথ্য যোগ করা হয়নি';
}

function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'তথ্য যোগ করা হয়নি';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'তথ্য যোগ করা হয়নি'
    : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
}

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="mb-3 mt-5 flex-row items-center">
      <Text className="flex-1 text-[14px] font-extrabold text-ink">{title}</Text>
      {action}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center py-3 ${last ? '' : 'border-b border-line'}`}>
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text className="w-[38%] text-[10px] text-muted">{label}</Text>
      <Text selectable className="flex-1 text-right text-[11px] font-semibold text-ink">
        {value}
      </Text>
    </View>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[10px] font-semibold text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className="rounded-xl border border-line bg-bg px-3 py-3 text-[12px] text-ink"
      />
    </View>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  tint = 'bg-primary-light',
  iconColor = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  tint?: string;
  iconColor?: string;
}) {
  return (
    <View className="mr-2 min-h-[112px] flex-1 rounded-2xl border border-line bg-white p-3">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text numberOfLines={1} className="mt-3 text-[15px] font-extrabold text-ink">{value}</Text>
      <Text numberOfLines={1} className="mt-1 text-[9px] text-muted">{title}</Text>
    </View>
  );
}

function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return (
    <View className="mt-3 flex-row items-center rounded-xl border border-red-100 bg-red-50 px-3 py-3">
      <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
      <Text className="ml-2 flex-1 text-[10px] leading-4 text-red-700">{message}</Text>
      <Pressable onPress={retry} className="ml-2 px-1 py-2">
        <Text className="text-[10px] font-bold text-primary">আবার চেষ্টা</Text>
      </Pressable>
    </View>
  );
}

export function DropshippingProfileScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const sessionUser = useAppSelector((state) => state.auth.user);
  const userId = sessionUser?._id ?? '';
  const profileDashboardQuery = useDropshippingProfileDashboardQuery();
  const profile = profileDashboardQuery.data?.user ?? sessionUser ?? undefined;
  const referralData = profileDashboardQuery.data?.referrals;
  const ordersQuery = useDropshippingOrdersQuery();
  const orders = ordersQuery.data ?? [];
  const commission = (referralData?.orders ?? []).reduce(
    (total, order) => total + (Number(order.referralBonusAmount) || 0),
    0
  );
  const referralCode = profile?.referralCode;
  const referralLink = referralCode
    ? `https://easyshoppingmallbd.com/signup?ref=${encodeURIComponent(referralCode)}`
    : '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraftFrom(profile));
  const [notice, setNotice] = useState('');
  const profileMutation = useMutation({
    mutationFn: (payload: UpdateOwnProfilePayload) => authApi.updateOwnProfile(payload),
    onSuccess: async (updatedUser) => {
      dispatch(updateCurrentUser(updatedUser));
      queryClient.setQueryData(
        dropshippingHomeQueryKeys.profileDashboard(userId),
        (current: typeof profileDashboardQuery.data) =>
          current ? { ...current, user: updatedUser } : current
      );
      queryClient.setQueryData(dropshippingHomeQueryKeys.profile(userId), updatedUser);
      setEditing(false);
      setNotice('প্রোফাইলের তথ্য সংরক্ষণ হয়েছে।');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profileDashboard(userId) }),
      ]);
    },
    onError: (error) => setNotice(dropshippingProfileErrorMessage(error, 'প্রোফাইল সংরক্ষণ করা যায়নি।')),
  });

  const imageMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData() as FormData & {
        append(name: string, value: { uri: string; name: string; type: string }): void;
      };
      formData.append('image', {
        uri,
        name: 'profile-photo.jpg',
        type: 'image/jpeg',
      });
      await updateDropshippingUserImage(userId, formData);
    },
    onSuccess: async () => {
      setNotice('প্রোফাইল ছবি আপডেট হয়েছে।');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profileDashboard(userId) }),
      ]);
    },
    onError: (error) => setNotice(dropshippingProfileErrorMessage(error, 'ছবি আপলোড করা যায়নি।')),
  });

  const refreshing = profileDashboardQuery.isRefetching || ordersQuery.isRefetching;
  const refreshProfile = () => {
    void Promise.all([profileDashboardQuery.refetch(), ordersQuery.refetch()]);
  };

  const updateDraft = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const beginEditing = () => {
    setDraft(profileDraftFrom(profile));
    setNotice('');
    setEditing(true);
  };

  const saveProfile = () => {
    const name = draft.name.trim();
    const mobile = draft.mobile.trim();
    const dateOfBirth = draft.dateOfBirth.trim();
    if (!name || name.length > 100) {
      setNotice('নাম ১ থেকে ১০০ অক্ষরের মধ্যে লিখুন।');
      return;
    }
    if (mobile && (mobile.length < 7 || mobile.length > 20)) {
      setNotice('মোবাইল নম্বর ৭ থেকে ২০ অক্ষরের মধ্যে লিখুন।');
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setNotice('জন্মতারিখ YYYY-MM-DD ফরম্যাটে লিখুন।');
      return;
    }
    profileMutation.mutate({
      name,
      mobile,
      date_of_birth: dateOfBirth || null,
      gender: draft.gender || null,
    });
  };

  const chooseImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('অনুমতি প্রয়োজন', 'ছবি বাছাই করতে Photos অনুমতি দিন।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        imageMutation.mutate(result.assets[0].uri);
      }
    } catch (error) {
      setNotice(dropshippingProfileErrorMessage(error, 'ছবি নির্বাচন করা যায়নি।'));
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setNotice(`${label} কপি হয়েছে।`);
    } catch (error) {
      setNotice(dropshippingProfileErrorMessage(error, `${label} কপি করা যায়নি।`));
    }
  };

  const shareReferral = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: `EasyShoppingMallBD-এ যোগ দিতে আমার রেফারেল লিংক ব্যবহার করুন:\n${referralLink}`,
        url: referralLink,
      });
    } catch (error) {
      setNotice(dropshippingProfileErrorMessage(error, 'রেফারেল লিংক শেয়ার করা যায়নি।'));
    }
  };

  const logOut = () => {
    Alert.alert('লগআউট করবেন?', 'আপনি কি এই অ্যাকাউন্ট থেকে বের হতে চান?', [
      { text: 'না', style: 'cancel' },
      { text: 'লগআউট', style: 'destructive', onPress: () => dispatch(signOut()) },
    ]);
  };

  if (!userId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <Ionicons name="person-circle-outline" size={54} color={colors.primary} />
        <Text className="mt-3 text-[17px] font-extrabold text-ink">প্রোফাইলে প্রবেশ করুন</Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-in')} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-[11px] font-bold text-white">লগইন করুন</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const loading = profileDashboardQuery.isPending && !profile;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-bg"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-ink">ড্রপশিপার প্রোফাইল</Text>
          <Text className="mt-0.5 text-[9px] text-muted">অ্যাকাউন্ট, শপ ও আয়ের তথ্য</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="প্রোফাইল রিফ্রেশ"
          onPress={refreshProfile}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary-light"
        >
          {refreshing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto w-full max-w-[960px] px-4 pb-8 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshProfile} tintColor={colors.primary} />
        }
      >
        <View className="overflow-hidden rounded-[26px] bg-emerald-800 p-5">
          <View className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="প্রোফাইল ছবি পরিবর্তন"
              onPress={() => void chooseImage()}
              disabled={imageMutation.isPending}
              className="h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white/15"
            >
              {profile?.image ? (
                <Image source={{ uri: profile.image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="person" size={35} color="#FFFFFF" />
              )}
              {imageMutation.isPending ? (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
              <View className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full bg-white">
                <Ionicons name="camera" size={13} color={colors.primary} />
              </View>
            </Pressable>
            <View className="ml-3 flex-1">
              <Text numberOfLines={1} className="text-[17px] font-extrabold text-white">
                {profile?.name || 'ড্রপশিপার'}
              </Text>
              <Text numberOfLines={1} className="mt-1 text-[10px] text-white/80">
                {profile?.email || 'ইমেইল যোগ করা হয়নি'}
              </Text>
              <View className="mt-2 self-start rounded-full bg-white/15 px-2.5 py-1">
                <Text className="text-[9px] font-bold text-white">
                  {profile?.role === 'DROPSHIPPING' ? 'ড্রপশিপিং সদস্য' : 'সদস্য'}
                  {profile?.isVerified ? ' · যাচাইকৃত' : ''}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="প্রোফাইল সম্পাদনা"
              onPress={beginEditing}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/15"
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <View className="mt-5 flex-row items-center justify-between border-t border-white/15 pt-4">
            <View>
              <Text className="text-[9px] text-white/70">বর্তমান ব্যালেন্স</Text>
              <Text className="mt-1 text-[21px] font-black text-white">
                {typeof profileDashboardQuery.data?.user.balance === 'number' &&
                Number.isFinite(profileDashboardQuery.data.user.balance)
                  ? formatDropshippingTaka(profileDashboardQuery.data.user.balance)
                  : '—'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/(dropshipping)/[section]', params: { section: 'balance' } })}
              className="flex-row items-center rounded-xl bg-white px-3 py-2.5"
            >
              <Ionicons name="wallet-outline" size={15} color={colors.primary} />
              <Text className="ml-1.5 text-[10px] font-bold text-primary">ব্যালেন্স দেখুন</Text>
            </Pressable>
          </View>
        </View>

        {notice ? (
          <View className="mt-3 flex-row items-center rounded-xl border border-primary-light bg-white px-3 py-2.5">
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <Text className="ml-2 flex-1 text-[10px] leading-4 text-ink">{notice}</Text>
            <Pressable accessibilityLabel="বার্তা বন্ধ করুন" onPress={() => setNotice('')} className="p-1">
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        {profileDashboardQuery.isError && !profile ? (
          <ErrorNotice
            message={dropshippingProfileErrorMessage(profileDashboardQuery.error, 'প্রোফাইলের তথ্য লোড হয়নি।')}
            retry={() => void profileDashboardQuery.refetch()}
          />
        ) : null}
        {profileDashboardQuery.isError && profile ? (
          <ErrorNotice
            message="সার্ভার থেকে প্রোফাইল/রেফারেল তথ্য আপডেট হয়নি; সংরক্ষিত তথ্য দেখানো হচ্ছে।"
            retry={() => void profileDashboardQuery.refetch()}
          />
        ) : null}
        {ordersQuery.isError ? (
          <ErrorNotice
            message={dropshippingProfileErrorMessage(ordersQuery.error, 'অর্ডারের সারসংক্ষেপ লোড হয়নি.')}
            retry={() => void ordersQuery.refetch()}
          />
        ) : null}

        {loading ? (
          <View className="mt-5 items-center rounded-2xl border border-line bg-white py-10">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-3 text-[11px] text-muted">প্রোফাইলের তথ্য লোড হচ্ছে...</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <SectionTitle title="আপনার সারসংক্ষেপ" />
            <View className="flex-row">
              <SummaryCard
                icon="receipt-outline"
                title="মোট অর্ডার"
                value={ordersQuery.isPending ? '…' : formatDropshippingNumber(orders.length)}
              />
              <SummaryCard
                icon="people-outline"
                title="রেফারেল সদস্য"
                value={profileDashboardQuery.isPending
                  ? '…'
                  : formatDropshippingNumber(referralData?.count ?? profile?.referralCount ?? 0)}
                tint="bg-violet-50"
                iconColor="#7C3AED"
              />
              <SummaryCard
                icon="trending-up-outline"
                title="রেফারেল কমিশন"
                value={profileDashboardQuery.isPending ? '…' : formatDropshippingTaka(commission)}
                tint="bg-emerald-50"
                iconColor="#059669"
                />
            </View>

            {editing ? (
              <View className="mt-5 rounded-[22px] border border-line bg-white p-4">
                <View className="mb-4 flex-row items-center">
                  <View className="flex-1">
                    <Text className="text-[14px] font-extrabold text-ink">প্রোফাইল সম্পাদনা</Text>
                    <Text className="mt-1 text-[10px] text-muted">আপনার ব্যক্তিগত অ্যাকাউন্টের তথ্য হালনাগাদ করুন</Text>
                  </View>
                  <Pressable onPress={() => setEditing(false)} className="h-8 w-8 items-center justify-center rounded-full bg-bg">
                    <Ionicons name="close" size={18} color={colors.ink} />
                  </Pressable>
                </View>
                <ProfileField label="সম্পূর্ণ নাম *" value={draft.name} onChangeText={(value) => updateDraft('name', value)} />
                <ProfileField label="মোবাইল নম্বর" value={draft.mobile} keyboardType="phone-pad" onChangeText={(value) => updateDraft('mobile', value)} />
                <ProfileField label="জন্মতারিখ" value={draft.dateOfBirth} placeholder="YYYY-MM-DD" onChangeText={(value) => updateDraft('dateOfBirth', value)} />
                <Text className="mb-2 text-[10px] font-semibold text-ink">লিঙ্গ</Text>
                <View className="mb-4 flex-row flex-wrap">
                  {([
                    ['', 'উল্লেখ নেই'],
                    ['Male', 'পুরুষ'],
                    ['Female', 'নারী'],
                    ['Other', 'অন্যান্য'],
                  ] as const).map(([gender, label]) => (
                    <Pressable
                      key={gender || 'none'}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: draft.gender === gender }}
                      onPress={() => updateDraft('gender', gender)}
                      className={`mb-2 mr-2 rounded-full border px-3 py-2 ${draft.gender === gender ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
                    >
                      <Text className={`text-[10px] font-semibold ${draft.gender === gender ? 'text-primary' : 'text-muted'}`}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="mt-1 flex-row">
                  <Pressable
                    onPress={() => setEditing(false)}
                    disabled={profileMutation.isPending}
                    className="mr-2 flex-1 items-center rounded-xl border border-line py-3"
                  >
                    <Text className="text-[10px] font-bold text-muted">বাতিল</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveProfile}
                    disabled={profileMutation.isPending}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-primary py-3"
                  >
                    {profileMutation.isPending
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />}
                    <Text className="ml-1.5 text-[10px] font-bold text-white">
                      {profileMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <SectionTitle
                  title="ব্যক্তিগত তথ্য"
                  action={
                    <Pressable onPress={beginEditing} className="flex-row items-center rounded-lg bg-primary px-3 py-2">
                      <Ionicons name="create-outline" size={14} color="#FFFFFF" />
                      <Text className="ml-1 text-[9px] font-bold text-white">সম্পাদনা</Text>
                    </Pressable>
                  }
                />
                <View className="rounded-2xl border border-line bg-white px-3">
                  <InfoRow icon="person-outline" label="নাম" value={displayText(profile?.name)} />
                  <InfoRow icon="mail-outline" label="ইমেইল" value={displayText(profile?.email)} />
                  <InfoRow icon="call-outline" label="মোবাইল" value={displayText(profile?.mobile ?? profile?.phone)} />
                  <InfoRow icon="shield-checkmark-outline" label="অ্যাকাউন্ট অবস্থা" value={displayText(profile?.status)} />
                  <InfoRow icon="checkmark-circle-outline" label="ইমেইল যাচাইকৃত" value={displayText(profile?.isVerified)} />
                  <InfoRow icon="calendar-outline" label="জন্মতারিখ" value={dateLabel(profile?.date_of_birth)} />
                  <InfoRow icon="male-female-outline" label="লিঙ্গ" value={displayText(profile?.gender)} />
                  <InfoRow icon="calendar-number-outline" label="সদস্য হয়েছেন" value={dateLabel(profile?.createdAt)} last />
                </View>

              </>
            )}

            <SectionTitle title="রেফারেল ও কমিশন" />
            <View className="overflow-hidden rounded-2xl bg-emerald-800 p-4">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[13px] font-extrabold text-white">বন্ধুদের আমন্ত্রণ জানান</Text>
                  <Text className="mt-1 text-[9px] text-white/75">রেফারেল কোড শেয়ার করে সদস্য বাড়ান</Text>
                </View>
              </View>
              {referralCode ? (
                <>
                  <View className="mt-4 flex-row items-center rounded-xl bg-white px-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-[8px] font-semibold text-muted">রেফারেল কোড</Text>
                      <Text selectable className="mt-1 text-[16px] font-black tracking-wider text-ink">{referralCode}</Text>
                    </View>
                    <Pressable onPress={() => void copyText(referralCode, 'রেফারেল কোড')} className="h-9 w-9 items-center justify-center rounded-lg bg-primary-light">
                      <Ionicons name="copy-outline" size={17} color={colors.primary} />
                    </Pressable>
                  </View>
                  <View className="mt-2 flex-row">
                    <Pressable onPress={() => void copyText(referralLink, 'রেফারেল লিংক')} className="mr-2 flex-1 flex-row items-center justify-center rounded-xl bg-white/15 py-3">
                      <Ionicons name="link-outline" size={15} color="#FFFFFF" />
                      <Text className="ml-1.5 text-[9px] font-bold text-white">লিংক কপি</Text>
                    </Pressable>
                    <Pressable onPress={() => void shareReferral()} className="flex-1 flex-row items-center justify-center rounded-xl bg-white py-3">
                      <Ionicons name="share-social-outline" size={15} color={colors.primary} />
                      <Text className="ml-1.5 text-[9px] font-bold text-primary">শেয়ার</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text className="mt-3 text-[10px] leading-4 text-white/80">
                  এই অ্যাকাউন্টের রেফারেল কোড API-তে পাওয়া যায়নি।
                </Text>
              )}
            </View>
            <View className="mt-3 flex-row">
              <SummaryCard
                icon="people-outline"
                title="মোট রেফারেল"
                value={profileDashboardQuery.isPending
                  ? '…'
                  : formatDropshippingNumber(referralData?.count ?? profile?.referralCount ?? 0)}
                tint="bg-violet-50"
                iconColor="#7C3AED"
              />
              <SummaryCard
                icon="cash-outline"
                title="রেফারেল কমিশন"
                value={profileDashboardQuery.isPending ? '…' : formatDropshippingTaka(commission)}
                tint="bg-emerald-50"
                iconColor="#059669"
              />
              <View className="flex-1" />
            </View>

            <SectionTitle
              title="সাম্প্রতিক রেফারেল সদস্য"
              action={
                <Text className="text-[9px] text-muted">
                  {formatDropshippingNumber(referralData?.users.length ?? 0)} জন
                </Text>
              }
            />
            {profileDashboardQuery.isPending ? (
              <View className="items-center rounded-2xl border border-line bg-white py-5">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (referralData?.users.length ?? 0) === 0 ? (
              <View className="items-center rounded-2xl border border-line bg-white px-4 py-6">
                <Ionicons name="people-outline" size={25} color={colors.muted} />
                <Text className="mt-2 text-[10px] text-muted">এখনো কোনো রেফারেল সদস্য নেই।</Text>
              </View>
            ) : (
              <View className="rounded-2xl border border-line bg-white px-3">
                {referralData?.users.slice(0, 5).map((referredUser, index, users) => (
                  <View key={referredUser._id} className={`flex-row items-center py-3 ${index < users.length - 1 ? 'border-b border-line' : ''}`}>
                    <View className="mr-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-light">
                      {referredUser.image ? (
                        <Image source={{ uri: referredUser.image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Ionicons name="person-outline" size={17} color={colors.primary} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-[10px] font-bold text-ink">{referredUser.name || 'নতুন সদস্য'}</Text>
                      {referredUser.email ? <Text numberOfLines={1} className="mt-0.5 text-[9px] text-muted">{referredUser.email}</Text> : null}
                    </View>
                    <Text className="ml-2 text-[8px] text-muted">{dateLabel(referredUser.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}

            <SectionTitle title="সাম্প্রতিক রেফারেল কমিশন" />
            {(referralData?.orders.length ?? 0) === 0 ? (
              <View className="items-center rounded-2xl border border-line bg-white px-4 py-6">
                <Ionicons name="trending-up-outline" size={25} color={colors.muted} />
                <Text className="mt-2 text-[10px] text-muted">রেফারেল অর্ডার বা কমিশনের তথ্য নেই।</Text>
              </View>
            ) : (
              referralData?.orders.slice(0, 5).map((order) => {
                const referredUser = typeof order.userId === 'object' ? order.userId : undefined;
                return (
                  <View key={order._id} className="mb-2 rounded-xl border border-line bg-white p-3">
                    <View className="flex-row items-center justify-between">
                      <Text numberOfLines={1} className="flex-1 text-[10px] font-bold text-ink">
                        {order.orderId || 'রেফারেল অর্ডার'}
                      </Text>
                      <Text className="ml-2 rounded-full bg-primary-light px-2 py-1 text-[8px] font-bold text-primary">
                        {order.order_status || 'অবস্থা নেই'}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[9px] text-muted">
                      {referredUser?.name || 'রেফারেল সদস্য'} · {dateLabel(order.createdAt)}
                    </Text>
                    <View className="mt-2 flex-row justify-between border-t border-line pt-2">
                      <Text className="text-[9px] text-muted">
                        অর্ডার {formatDropshippingTaka(Number(order.totalAmt) || 0)}
                      </Text>
                      <Text className="text-[9px] font-bold text-emerald-700">
                        কমিশন {formatDropshippingTaka(Number(order.referralBonusAmount) || 0)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {ordersQuery.data ? (
              <View className="mt-4 flex-row items-center rounded-xl border border-line bg-white p-3">
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                <Text className="ml-2 flex-1 text-[10px] text-muted">আপনার অর্ডার</Text>
                <Text className="text-[11px] font-bold text-ink">{formatDropshippingNumber(orders.length)}টি</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={logOut}
              className="mt-6 flex-row items-center justify-center rounded-xl border border-red-100 bg-white py-3.5"
            >
              <Ionicons name="log-out-outline" size={17} color="#DC2626" />
              <Text className="ml-2 text-[11px] font-bold text-red-600">লগআউট</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingProfileScreen;
