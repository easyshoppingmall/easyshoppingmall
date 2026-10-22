import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type UpdateDropshippingShopSettingsPayload, type UserProfile } from '../../../api/authApi';
import { updateCurrentUser } from '../../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { colors } from '../../../shared/theme/colors';
import {
  dropshippingHomeQueryKeys,
  useDropshippingProfileDashboardQuery,
} from '../api/queries';
import { dropshippingProfileErrorMessage, updateDropshippingUserImage } from '../api/profileApi';

type PaymentDetails = UpdateDropshippingShopSettingsPayload['paymentDetails'];

interface ShopSettingsDraft {
  shopName: string;
  shopAddress: string;
  shopWebsite: string;
  facebookPage: string;
  whatsappNumber: string;
  paymentDetails: PaymentDetails;
}

function draftFromProfile(profile?: UserProfile): ShopSettingsDraft {
  return {
    shopName: profile?.shopName ?? '',
    shopAddress: profile?.shopAddress ?? '',
    shopWebsite: profile?.shopWebsite ?? '',
    facebookPage: profile?.facebookPage ?? '',
    whatsappNumber: profile?.whatsappNumber ?? '',
    paymentDetails: {
      bkash: profile?.paymentDetails?.bkash ?? '',
      nagad: profile?.paymentDetails?.nagad ?? '',
      rocket: profile?.paymentDetails?.rocket ?? '',
      bank: profile?.paymentDetails?.bank ?? '',
    },
  };
}

function ShopField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences';
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

export function DropshippingShopSettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const sessionUser = useAppSelector((state) => state.auth.user);
  const userId = sessionUser?._id ?? '';
  const profileQuery = useDropshippingProfileDashboardQuery();
  const profile = profileQuery.data?.user ?? sessionUser ?? undefined;
  const [draftOverride, setDraftOverride] = useState<ShopSettingsDraft>();
  const draft = draftOverride ?? draftFromProfile(profile);
  const [notice, setNotice] = useState('');

  const updateDraft = (update: (current: ShopSettingsDraft) => ShopSettingsDraft) => {
    setDraftOverride((current) => update(current ?? draftFromProfile(profile)));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateDropshippingShopSettingsPayload) =>
      authApi.updateDropshippingShopSettings(payload),
    onSuccess: async (updatedUser) => {
      dispatch(updateCurrentUser(updatedUser));
      setDraftOverride(draftFromProfile(updatedUser));
      queryClient.setQueryData(dropshippingHomeQueryKeys.profile(userId), updatedUser);
      queryClient.setQueryData(
        dropshippingHomeQueryKeys.profileDashboard(userId),
        (current: typeof profileQuery.data) =>
          current ? { ...current, user: updatedUser } : current
      );
      setNotice('শপ ও পেমেন্টের তথ্য সংরক্ষণ হয়েছে।');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profileDashboard(userId) }),
      ]);
    },
    onError: (error) => {
      setNotice(dropshippingProfileErrorMessage(error, 'শপের তথ্য সংরক্ষণ করা যায়নি।'));
    },
  });

  const imageMutation = useMutation({
    mutationFn: async (uri: string) => {
      const formData = new FormData() as FormData & {
        append(name: string, value: { uri: string; name: string; type: string }): void;
      };
      formData.append('image', { uri, name: 'shop-logo.jpg', type: 'image/jpeg' });
      await updateDropshippingUserImage(userId, formData, 'shopLogo');
      return authApi.getProfile();
    },
    onSuccess: async (updatedUser) => {
      dispatch(updateCurrentUser(updatedUser));
      queryClient.setQueryData(dropshippingHomeQueryKeys.profile(userId), updatedUser);
      queryClient.setQueryData(
        dropshippingHomeQueryKeys.profileDashboard(userId),
        (current: typeof profileQuery.data) =>
          current ? { ...current, user: updatedUser } : current
      );
      setNotice('শপের লোগো আপডেট হয়েছে।');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: dropshippingHomeQueryKeys.profileDashboard(userId) }),
      ]);
    },
    onError: (error) => setNotice(dropshippingProfileErrorMessage(error, 'শপের লোগো আপলোড করা যায়নি।')),
  });

  const chooseShopLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice('লোগো বাছাই করতে Photos অনুমতি দিন।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const image = result.assets?.[0];
      if (!result.canceled && image) imageMutation.mutate(image.uri);
    } catch (error) {
      setNotice(dropshippingProfileErrorMessage(error, 'ছবি নির্বাচন করা যায়নি।'));
    }
  };

  const submit = () => {
    setNotice('');
    saveMutation.mutate({
      shopName: draft.shopName.trim(),
      shopAddress: draft.shopAddress.trim(),
      shopWebsite: draft.shopWebsite.trim(),
      facebookPage: draft.facebookPage.trim(),
      whatsappNumber: draft.whatsappNumber.trim(),
      paymentDetails: {
        bkash: draft.paymentDetails.bkash.trim(),
        nagad: draft.paymentDetails.nagad.trim(),
        rocket: draft.paymentDetails.rocket.trim(),
        bank: draft.paymentDetails.bank.trim(),
      },
    });
  };

  const refreshing = profileQuery.isRefetching;
  const refresh = () => void profileQuery.refetch();

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
          <Text className="text-[15px] font-extrabold text-ink">শপ সেটিংস</Text>
          <Text className="mt-0.5 text-[9px] text-muted">শপ পরিচিতি ও পেমেন্ট গ্রহণের তথ্য</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="তথ্য রিফ্রেশ"
          onPress={refresh}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary-light"
        >
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : (
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View className="mb-4 rounded-2xl bg-primary p-4">
          <Text className="text-[13px] font-extrabold text-white">আপনার শপ সাজিয়ে নিন</Text>
          <Text className="mt-1 text-[9px] leading-4 text-white/80">
            Shop ও payment settings এখানে আলাদাভাবে সংরক্ষিত হবে; ব্যক্তিগত profile তথ্য পরিবর্তিত হবে না।
          </Text>
        </View>

        {profileQuery.isError && !profile ? (
          <View className="mb-3 rounded-xl border border-red-100 bg-red-50 p-3">
            <Text className="text-[10px] leading-4 text-red-700">
              {dropshippingProfileErrorMessage(profileQuery.error, 'শপের তথ্য লোড হয়নি।')}
            </Text>
            <Pressable onPress={refresh} className="mt-2 self-start rounded-lg bg-white px-3 py-2">
              <Text className="text-[9px] font-bold text-primary">আবার চেষ্টা করুন</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-4 rounded-2xl border border-line bg-white p-4">
          <View className="mb-4 flex-row items-center">
            <View className="mr-3 h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary-light">
              {profile?.shopLogo ? (
                <Image source={{ uri: profile.shopLogo }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="storefront-outline" size={22} color={colors.primary} />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-bold text-ink">শপের লোগো</Text>
              <Text className="mt-1 text-[9px] text-muted">
                {profile?.shopLogo ? 'লোগো আপলোড করা আছে' : 'আপনার শপের লোগো যোগ করুন'}
              </Text>
            </View>
            <Pressable
              onPress={() => void chooseShopLogo()}
              disabled={!userId || imageMutation.isPending}
              className="rounded-lg bg-primary-light px-3 py-2"
            >
              {imageMutation.isPending
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text className="text-[9px] font-bold text-primary">লোগো বাছুন</Text>}
            </Pressable>
          </View>
          <ShopField label="শপের নাম" value={draft.shopName} onChangeText={(value) => updateDraft((current) => ({ ...current, shopName: value }))} />
          <ShopField label="শপের ঠিকানা" value={draft.shopAddress} onChangeText={(value) => updateDraft((current) => ({ ...current, shopAddress: value }))} />
          <ShopField label="ওয়েবসাইট" value={draft.shopWebsite} keyboardType="url" autoCapitalize="none" onChangeText={(value) => updateDraft((current) => ({ ...current, shopWebsite: value }))} />
          <ShopField label="Facebook পেজ" value={draft.facebookPage} keyboardType="url" autoCapitalize="none" onChangeText={(value) => updateDraft((current) => ({ ...current, facebookPage: value }))} />
          <ShopField label="WhatsApp নম্বর" value={draft.whatsappNumber} keyboardType="phone-pad" onChangeText={(value) => updateDraft((current) => ({ ...current, whatsappNumber: value }))} />
        </View>

        <View className="mb-4 rounded-2xl border border-line bg-white p-4">
          <View className="mb-3 flex-row items-center">
            <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
              <Ionicons name="wallet-outline" size={17} color={colors.primary} />
            </View>
            <View>
              <Text className="text-[12px] font-extrabold text-ink">পেমেন্ট গ্রহণের তথ্য</Text>
              <Text className="mt-0.5 text-[9px] text-muted">আপনার পেমেন্ট গ্রহণের অ্যাকাউন্ট দিন</Text>
            </View>
          </View>
          <ShopField
            label="বিকাশ নম্বর"
            value={draft.paymentDetails.bkash}
            keyboardType="phone-pad"
            onChangeText={(value) => updateDraft((current) => ({
              ...current,
              paymentDetails: { ...current.paymentDetails, bkash: value },
            }))}
          />
          <ShopField
            label="নগদ নম্বর"
            value={draft.paymentDetails.nagad}
            keyboardType="phone-pad"
            onChangeText={(value) => updateDraft((current) => ({
              ...current,
              paymentDetails: { ...current.paymentDetails, nagad: value },
            }))}
          />
          <ShopField
            label="রকেট নম্বর"
            value={draft.paymentDetails.rocket}
            keyboardType="phone-pad"
            onChangeText={(value) => updateDraft((current) => ({
              ...current,
              paymentDetails: { ...current.paymentDetails, rocket: value },
            }))}
          />
          <ShopField
            label="ব্যাংক তথ্য"
            value={draft.paymentDetails.bank}
            onChangeText={(value) => updateDraft((current) => ({
              ...current,
              paymentDetails: { ...current.paymentDetails, bank: value },
            }))}
          />
        </View>

        {notice ? (
          <View className={`mb-3 rounded-xl px-3 py-2.5 ${saveMutation.isError || imageMutation.isError ? 'bg-red-50' : 'bg-primary-light'}`}>
            <Text className={`text-[10px] leading-4 ${saveMutation.isError || imageMutation.isError ? 'text-red-700' : 'text-primary'}`}>
              {notice}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={!userId || profileQuery.isPending || saveMutation.isPending}
          className={`min-h-12 flex-row items-center justify-center rounded-xl ${
            !userId || profileQuery.isPending || saveMutation.isPending ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          {saveMutation.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
              <Text className="ml-2 text-[10px] font-extrabold text-white">শপ সেটিংস সংরক্ষণ</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DropshippingShopSettingsScreen;
