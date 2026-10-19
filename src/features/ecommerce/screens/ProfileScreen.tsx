import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  authApi,
  type ProfileDashboard,
  type ReferralOrder,
  type ReferralUser,
  type UpdateOwnProfilePayload,
} from '../../../api/authApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { changePassword as changePasswordAction, signOut, updateCurrentUser } from '../../../store/authSlice';
import {
  customerApi,
  mapWishlistProducts,
  responseMessage,
  type Address,
  type AddressPayload,
  type CustomerOrder,
} from '../api/customerApi';
import { formatTaka, isRemoteImage, toBengaliNumber } from '../data/catalog';
import { colors } from '../../../shared/theme/colors';

type AccountTab = 'profile' | 'orders' | 'wishlist' | 'addresses' | 'referrals' | 'settings' | 'password';
type AddressDraft = Omit<AddressPayload, 'mobile'> & { mobile: string };
type ProfileDraft = {
  name: string;
  email: string;
  mobile: string;
  date_of_birth: string;
  gender: '' | 'Male' | 'Female' | 'Other';
  shopName: string;
  shopAddress: string;
  shopWebsite: string;
  facebookPage: string;
  whatsappNumber: string;
  paymentDetails: { bkash: string; nagad: string; rocket: string; bank: string };
};

const emptyProfileDraft: ProfileDraft = {
  name: '',
  email: '',
  mobile: '',
  date_of_birth: '',
  gender: '',
  shopName: '',
  shopAddress: '',
  shopWebsite: '',
  facebookPage: '',
  whatsappNumber: '',
  paymentDetails: { bkash: '', nagad: '', rocket: '', bank: '' },
};

const PAGE_SIZE = 5;
const emptyAddress: AddressDraft = {
  address_line: '',
  district: '',
  division: '',
  upazila_thana: '',
  pincode: '',
  country: 'Bangladesh',
  mobile: '',
};

function isAccountTab(value?: string): value is AccountTab {
  return value === 'profile' || value === 'orders' || value === 'wishlist' ||
    value === 'addresses' || value === 'referrals' || value === 'settings' || value === 'password';
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function orderStatusLabel(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ',
    processing: 'প্রস্তুত হচ্ছে',
    shipped: 'পাঠানো হয়েছে',
    delivered: 'ডেলিভারি সম্পন্ন',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    return: 'ফেরত',
  };
  return labels[status] ?? 'অবস্থা অজানা';
}

function paymentStatusLabel(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'যাচাইয়ের অপেক্ষায়',
    submitted: 'যাচাইয়ের অপেক্ষায়',
    paid: 'পরিশোধিত',
    failed: 'ব্যর্থ',
    refunded: 'ফেরত দেওয়া হয়েছে',
  };
  return labels[status] ?? 'অবস্থা অজানা';
}

function profileValueLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  const labels: Record<string, string> = {
    Active: 'সক্রিয়',
    Inactive: 'নিষ্ক্রিয়',
    Blocked: 'সাময়িকভাবে বন্ধ',
    Male: 'পুরুষ',
    Female: 'নারী',
    Other: 'অন্যান্য',
    NewCustomer: 'নতুন গ্রাহক',
    TopCustomer: 'শীর্ষ গ্রাহক',
    ReturningCustomer: 'ফিরে আসা গ্রাহক',
    VIPCustomer: 'বিশেষ গ্রাহক',
    WholesaleCustomer: 'পাইকারি গ্রাহক',
    Reseller: 'রিসেলার',
    '3starCustomer': '৩ তারকা গ্রাহক',
    '4starCustomer': '৪ তারকা গ্রাহক',
    '5starCustomer': '৫ তারকা গ্রাহক',
  };
  return labels[raw] ?? (raw || 'তথ্য নেই');
}

function formatDate(value?: string): string {
  if (!value) return 'তারিখ নেই';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'তারিখ নেই'
    : date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function orderProducts(order: CustomerOrder): Record<string, unknown>[] {
  return Array.isArray(order.products) ? order.products : Array.isArray(order.items) ? order.items : [];
}

function productName(item: Record<string, unknown>): string {
  const product = record(item.productId ?? item.product);
  return String(item.name ?? item.productName ?? product.productName ?? product.name ?? 'পণ্য');
}

function orderTotal(order: CustomerOrder): number {
  return Number(order.totalAmt ?? order.totalAmount ?? order.totalPrice) || 0;
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="mb-4 flex-row items-center">
      <View className="flex-1">
        <Text className="text-[17px] font-extrabold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-1 text-[11px] text-muted">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
}) {
  return (
    <View className="items-center rounded-2xl border border-line bg-white px-5 py-8">
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-primary-light">
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text className="text-[14px] font-bold text-ink">{title}</Text>
      <Text className="mt-1 text-center text-[11px] leading-5 text-muted">{message}</Text>
    </View>
  );
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center rounded-2xl border border-red-100 bg-red-50 px-4 py-5">
      <Ionicons name="cloud-offline-outline" size={24} color={colors.accent} />
      <Text className="mt-2 text-center text-[12px] text-red-700">{message}</Text>
      <TouchableOpacity onPress={onRetry} className="mt-3 rounded-xl bg-white px-4 py-2">
        <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা করুন</Text>
      </TouchableOpacity>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View className="mb-3 rounded-2xl border border-line bg-white p-4">
      <View className="h-3 w-2/5 rounded-full bg-line" />
      <View className="mt-3 h-3 w-4/5 rounded-full bg-line" />
      <View className="mt-3 h-3 w-3/5 rounded-full bg-line" />
    </View>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'words',
  placeholder,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[11px] font-semibold text-ink">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.muted}
        className="rounded-xl border border-line bg-bg px-3.5 py-3 text-[12px] text-ink"
      />
    </View>
  );
}

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const sessionUser = useAppSelector((state) => state.auth.user);
  const userId = sessionUser?._id;
  const [tabSelection, setTabSelection] = useState<{ routeTab?: string; tab: AccountTab }>();
  const activeTab = tabSelection && tabSelection.routeTab === tab
    ? tabSelection.tab
    : isAccountTab(tab)
      ? tab
      : 'profile';
  const setActiveTab = (nextTab: AccountTab) => setTabSelection({ routeTab: tab, tab: nextTab });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailChangeTarget, setEmailChangeTarget] = useState('');
  const [emailChangeOtp, setEmailChangeOtp] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [editingAddressId, setEditingAddressId] = useState<string>();
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [notice, setNotice] = useState<string>();

  const profileQuery = useQuery<ProfileDashboard>({
    queryKey: ['auth', 'profile-dashboard', userId],
    queryFn: authApi.getProfileDashboard,
    enabled: Boolean(userId),
  });
  const profile = profileQuery.data?.user ?? sessionUser;
  const isDropshipper = profile?.role === 'DROPSHIPPING';
  const referrals = profileQuery.data?.referrals;

  const ordersQuery = useQuery({
    queryKey: ['customer', 'orders', userId],
    queryFn: customerApi.getOrders,
    enabled: Boolean(userId),
  });
  const addressesQuery = useQuery({
    queryKey: ['customer', 'addresses', userId],
    queryFn: customerApi.getAddresses,
    enabled: Boolean(userId),
  });
  const wishlistQuery = useQuery({
    queryKey: ['customer', 'wishlist', userId],
    queryFn: async () => mapWishlistProducts(await customerApi.getWishlist()),
    enabled: Boolean(userId),
  });
  const saveProfileMutation = useMutation({
    mutationFn: (payload: UpdateOwnProfilePayload) => authApi.updateOwnProfile(payload),
    onSuccess: async (updatedUser) => {
      dispatch(updateCurrentUser(updatedUser));
      queryClient.setQueryData<ProfileDashboard>(
        ['auth', 'profile-dashboard', userId],
        (previous) => previous
          ? { ...previous, user: updatedUser }
          : { user: updatedUser, referrals: { count: 0, users: [], orders: [] } }
      );
      setEditingProfile(false);
      setNotice('আপনার প্রোফাইল তথ্য আপডেট হয়েছে।');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile-dashboard', userId] });
    },
    onError: (error) => setNotice(responseMessage(error, 'প্রোফাইল আপডেট করা যায়নি।')),
  });
  const passwordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      dispatch(changePasswordAction(payload)).unwrap(),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordVisible(false);
      setActiveTab('settings');
      setNotice('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।');
    },
    onError: (error) => setNotice(
      typeof error === 'string' ? error : responseMessage(error, 'পাসওয়ার্ড পরিবর্তন করা যায়নি।')
    ),
  });
  const emailChangeRequestMutation = useMutation({
    mutationFn: (email: string) => authApi.requestEmailChange(email),
    onSuccess: (response, email) => {
      if (!response.success) {
        setNotice(response.message || 'ইমেইল যাচাইকরণ কোড পাঠানো যায়নি।');
        return;
      }
      setEmailChangeTarget(email);
      setEmailChangeOtp('');
      setNotice(response.message || 'নতুন ইমেইলে যাচাইকরণ কোড পাঠানো হয়েছে।');
    },
    onError: (error) => setNotice(responseMessage(error, 'ইমেইল যাচাইকরণ কোড পাঠানো যায়নি।')),
  });
  const emailChangeVerifyMutation = useMutation({
    mutationFn: (otp: string) => authApi.verifyEmailChange(otp),
    onSuccess: async (updatedUser) => {
      dispatch(updateCurrentUser(updatedUser));
      queryClient.setQueryData<ProfileDashboard>(
        ['auth', 'profile-dashboard', userId],
        (previous) => previous
          ? { ...previous, user: updatedUser }
          : { user: updatedUser, referrals: { count: 0, users: [], orders: [] } }
      );
      setEmailChangeTarget('');
      setEmailChangeOtp('');
      setNotice('আপনার ইমেইল যাচাই ও আপডেট হয়েছে।');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile-dashboard', userId] });
    },
    onError: (error) => setNotice(responseMessage(error, 'ইমেইল যাচাই করা যায়নি।')),
  });
  const orderList = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const addressList = addressesQuery.data ?? [];
  const wishlist = wishlistQuery.data ?? [];
  const totalOrderPages = Math.max(1, Math.ceil(orderList.length / PAGE_SIZE));
  const visibleOrderPage = Math.min(orderPage, totalOrderPages);
  const visibleOrders = useMemo(
    () => orderList.slice((visibleOrderPage - 1) * PAGE_SIZE, visibleOrderPage * PAGE_SIZE),
    [orderList, visibleOrderPage]
  );
  const referralCommission = (referrals?.orders ?? []).reduce(
    (sum, order) => sum + (Number(order.referralBonusAmount) || 0),
    0
  );
  const referralCode = profile?.referralCode;
  const referralLink = referralCode
    ? `https://easyshoppingmallbd.com/signup?ref=${encodeURIComponent(referralCode)}`
    : '';

  const saveAddressMutation = useMutation({
    mutationFn: ({ payload, id }: { payload: AddressPayload; id?: string }) =>
      id ? customerApi.updateAddress({ ...payload, _id: id }) : customerApi.createAddress(payload),
    onSuccess: async () => {
      setShowAddressForm(false);
      setEditingAddressId(undefined);
      setAddressDraft(emptyAddress);
      await queryClient.invalidateQueries({ queryKey: ['customer', 'addresses', userId] });
      setNotice('ঠিকানা সংরক্ষণ হয়েছে।');
    },
    onError: (error) => setNotice(responseMessage(error, 'ঠিকানা সংরক্ষণ করা যায়নি।')),
  });
  const removeAddressMutation = useMutation({
    mutationFn: customerApi.disableAddress,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customer', 'addresses', userId] });
      setNotice('ঠিকানা সরানো হয়েছে।');
    },
    onError: (error) => setNotice(responseMessage(error, 'ঠিকানা সরানো যায়নি।')),
  });
  const removeWishlistMutation = useMutation({
    mutationFn: customerApi.removeWishlistItem,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['customer', 'wishlist', userId] }),
    onError: (error) => setNotice(responseMessage(error, 'উইশলিস্ট আপডেট হয়নি।')),
  });
  const profileImageMutation = useMutation({
    mutationFn: async ({ uri, type }: { uri: string; type?: 'shopLogo' }) => {
      if (!userId) throw new Error('ছবি বদলাতে লগইন করুন।');
      const formData = new FormData() as FormData & {
        append(name: string, value: { uri: string; name: string; type: string }): void;
      };
      formData.append('image', { uri, name: type ? 'shop-logo.jpg' : 'profile-photo.jpg', type: 'image/jpeg' });
      return customerApi.updateUserImage(userId, formData, type);
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth', 'profile-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] }),
      ]);
      setNotice(variables.type ? 'শপের লোগো আপডেট হয়েছে।' : 'প্রোফাইল ছবি আপডেট হয়েছে।');
    },
    onError: (error) => setNotice(responseMessage(error, 'প্রোফাইল ছবি আপডেট হয়নি।')),
  });

  const refreshing = Boolean(
    profileQuery.isRefetching ||
    ordersQuery.isRefetching ||
    addressesQuery.isRefetching ||
    wishlistQuery.isRefetching
  );
  const refreshDashboard = () => {
    void Promise.all([
      profileQuery.refetch(),
      ordersQuery.refetch(),
      addressesQuery.refetch(),
      wishlistQuery.refetch(),
    ]);
  };

  const chooseProfileImage = async (type?: 'shopLogo') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('অনুমতি প্রয়োজন', 'ছবি বাছাই করতে ফটো লাইব্রেরির অনুমতি দিন।');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        profileImageMutation.mutate({ uri: result.assets[0].uri, type });
      }
    } catch (error) {
      setNotice(responseMessage(error, 'ছবি নির্বাচন করা যায়নি।'));
    }
  };

  const beginEditProfile = () => {
    setProfileDraft({
      name: profile?.name ?? '',
      email: profile?.email ?? '',
      mobile: String(profile?.mobile ?? profile?.phone ?? ''),
      date_of_birth: String(profile?.date_of_birth ?? '').slice(0, 10),
      gender: profile?.gender ?? '',
      shopName: String(profile?.shopName ?? ''),
      shopAddress: String(profile?.shopAddress ?? ''),
      shopWebsite: String(profile?.shopWebsite ?? ''),
      facebookPage: String(profile?.facebookPage ?? ''),
      whatsappNumber: String(profile?.whatsappNumber ?? ''),
      paymentDetails: {
        bkash: String(profile?.paymentDetails?.bkash ?? ''),
        nagad: String(profile?.paymentDetails?.nagad ?? ''),
        rocket: String(profile?.paymentDetails?.rocket ?? ''),
        bank: String(profile?.paymentDetails?.bank ?? ''),
      },
    });
    setEditingProfile(true);
  };

  const submitProfile = () => {
    const name = profileDraft.name.trim();
    const email = profileDraft.email.trim().toLowerCase();
    const mobile = profileDraft.mobile.trim();
    const dateOfBirth = profileDraft.date_of_birth.trim();
    if (!name || name.length > 100) {
      setNotice('নাম ১ থেকে ১০০ অক্ষরের মধ্যে লিখুন।');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice('সঠিক ইমেইল ঠিকানা লিখুন।');
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

    const dropshippingProfile = isDropshipper
      ? {
          shopName: profileDraft.shopName.trim(),
          shopAddress: profileDraft.shopAddress.trim(),
          shopWebsite: profileDraft.shopWebsite.trim(),
          facebookPage: profileDraft.facebookPage.trim(),
          whatsappNumber: profileDraft.whatsappNumber.trim(),
          paymentDetails: {
            bkash: profileDraft.paymentDetails.bkash.trim(),
            nagad: profileDraft.paymentDetails.nagad.trim(),
            rocket: profileDraft.paymentDetails.rocket.trim(),
            bank: profileDraft.paymentDetails.bank.trim(),
          },
        }
      : {};
    const payload: UpdateOwnProfilePayload = {
      name,
      mobile,
      date_of_birth: dateOfBirth || null,
      gender: profileDraft.gender || null,
      ...dropshippingProfile,
    };
    const emailHasChanged = email !== String(profile?.email ?? '').trim().toLowerCase();
    saveProfileMutation.mutate(payload, {
      onSuccess: () => {
        if (emailHasChanged) emailChangeRequestMutation.mutate(email);
      },
    });
  };

  const submitPasswordChange = () => {
    if (!currentPassword) {
      setNotice('বর্তমান পাসওয়ার্ড লিখুন।');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setNotice('নতুন পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setNotice('নতুন পাসওয়ার্ড ও নিশ্চিত পাসওয়ার্ড মিলছে না।');
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const beginAddAddress = () => {
    setEditingAddressId(undefined);
    setAddressDraft({
      ...emptyAddress,
      mobile: String(profile?.phone ?? profile?.mobile ?? ''),
    });
    setShowAddressForm(true);
  };

  const beginEditAddress = (address: Address) => {
    setEditingAddressId(address._id);
    setAddressDraft({
      address_line: address.address_line ?? '',
      district: address.district ?? '',
      division: address.division ?? '',
      upazila_thana: address.upazila_thana ?? '',
      pincode: address.pincode ?? '',
      country: address.country ?? 'Bangladesh',
      mobile: String(address.mobile ?? ''),
    });
    setShowAddressForm(true);
  };

  const submitAddress = () => {
    if (
      !addressDraft.address_line.trim() ||
      !addressDraft.district.trim() ||
      !addressDraft.division.trim() ||
      !addressDraft.upazila_thana.trim() ||
      !addressDraft.mobile.trim()
    ) {
      setNotice('ঠিকানা, বিভাগ, জেলা, উপজেলা/থানা ও মোবাইল নম্বর পূরণ করুন।');
      return;
    }
    const payload: AddressPayload = {
      ...addressDraft,
      address_line: addressDraft.address_line.trim(),
      district: addressDraft.district.trim(),
      division: addressDraft.division.trim(),
      upazila_thana: addressDraft.upazila_thana.trim(),
      pincode: addressDraft.pincode.trim(),
      mobile: Number(addressDraft.mobile.replace(/\D/g, '')) || null,
    };
    saveAddressMutation.mutate({ payload, id: editingAddressId });
  };

  const copyReferral = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setNotice(`${label} কপি হয়েছে।`);
    } catch (error) {
      setNotice(responseMessage(error, `${label} কপি করা যায়নি।`));
    }
  };

  const shareReferral = async () => {
    try {
      await Share.share({
        message: `EasyShoppingMallBD-এ যোগ দিতে আমার রেফারেল লিংক ব্যবহার করুন:\n${referralLink}`,
        url: referralLink,
      });
    } catch (error) {
      setNotice(responseMessage(error, 'রেফারেল লিংক শেয়ার করা যায়নি।'));
    }
  };

  const handleLogout = () => {
    Alert.alert('লগআউট', 'আপনি কি নিশ্চিত যে অ্যাকাউন্ট থেকে বের হতে চান?', [
      { text: 'থাকুন', style: 'cancel' },
      {
        text: 'লগআউট',
        style: 'destructive',
        onPress: () => {
          void dispatch(signOut()).then(() => router.replace('/(auth)/sign-in'));
        },
      },
    ]);
  };

  const tabs: { id: AccountTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'profile', label: 'প্রোফাইল', icon: 'person-outline' },
    { id: 'orders', label: 'অর্ডার', icon: 'receipt-outline' },
    { id: 'wishlist', label: 'উইশলিস্ট', icon: 'heart-outline' },
    { id: 'addresses', label: 'ঠিকানা', icon: 'location-outline' },
    ...(isDropshipper ? [{ id: 'referrals' as const, label: 'রেফারেল', icon: 'people-outline' as const }] : []),
    { id: 'settings', label: 'সেটিংস', icon: 'settings-outline' },
  ];

  const renderOrders = () => (
    <View>
      <SectionHeading
        title="আমার অর্ডার"
        subtitle={`মোট ${toBengaliNumber(orderList.length)}টি অর্ডার`}
      />
      {ordersQuery.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : ordersQuery.isError ? (
        <RetryState
          message={responseMessage(ordersQuery.error, 'অর্ডার লোড করা যায়নি।')}
          onRetry={() => void ordersQuery.refetch()}
        />
      ) : orderList.length === 0 ? (
        <EmptyState icon="receipt-outline" title="এখনো কোনো অর্ডার নেই" message="আপনার করা অর্ডার এখানে দেখা যাবে।" />
      ) : (
        <>
          {visibleOrders.map((order) => {
            const products = orderProducts(order);
            const orderId = order._id ?? order.id ?? '';
            return (
              <TouchableOpacity
                key={orderId || order.orderId}
                accessibilityRole="button"
                onPress={() => {
                  if (orderId) router.push({ pathname: '/(ecommerce)/order/[id]', params: { id: orderId } });
                }}
                className="mb-3 rounded-2xl border border-line bg-white p-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <Text className="text-[10px] text-muted">অর্ডার নম্বর</Text>
                    <Text numberOfLines={1} className="mt-1 text-[12px] font-extrabold text-ink">
                      {order.orderId ?? order.orderNumber ?? orderId ?? 'আইডি নেই'}
                    </Text>
                  </View>
                  <View className="rounded-full bg-tint-green px-2.5 py-1">
                    <Text className="text-[10px] font-bold text-green-800">{orderStatusLabel(order.order_status ?? order.status)}</Text>
                  </View>
                </View>
                <Text className="mt-2 text-[10px] text-muted">{formatDate(order.createdAt)}</Text>
                <View className="my-3 h-px bg-line" />
                {products.slice(0, 3).map((item, index) => {
                  const quantity = Number(item.quantity) || 1;
                  const lineTotal = Number(item.totalPrice) || (Number(item.sellingPrice ?? item.price) || 0) * quantity;
                  return (
                    <View key={String(item._id ?? index)} className="mb-2 flex-row items-center justify-between">
                      <Text numberOfLines={1} className="mr-2 flex-1 text-[11px] text-ink">
                        {productName(item)} <Text className="text-muted">× {toBengaliNumber(quantity)}</Text>
                      </Text>
                      <Text className="text-[11px] font-semibold text-ink">{formatTaka(lineTotal)}</Text>
                    </View>
                  );
                })}
                {products.length > 3 ? (
                  <Text className="mb-2 text-[10px] text-muted">আরও {toBengaliNumber(products.length - 3)}টি পণ্য</Text>
                ) : null}
                <View className="flex-row items-end justify-between border-t border-line pt-3">
                  <View>
                    <Text className="text-[10px] text-muted">পেমেন্ট</Text>
                    <Text className="mt-1 text-[10px] font-semibold text-green-800">
                      {paymentStatusLabel(order.payment_status ?? order.paymentStatus)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-muted">সর্বমোট</Text>
                    <Text className="mt-1 text-[14px] font-extrabold text-primary">{formatTaka(orderTotal(order))}</Text>
                  </View>
                </View>
                <View className="mt-3 flex-row items-center justify-end">
                  <Text className="mr-1 text-[10px] font-bold text-primary">বিস্তারিত দেখুন</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
          {totalOrderPages > 1 ? (
            <View className="mt-1 flex-row items-center justify-between rounded-xl border border-line bg-white p-2">
              <TouchableOpacity
                disabled={visibleOrderPage <= 1}
                onPress={() => setOrderPage(Math.max(1, visibleOrderPage - 1))}
                className={`flex-row items-center rounded-lg px-3 py-2 ${visibleOrderPage <= 1 ? 'opacity-40' : 'bg-primary-light'}`}
              >
                <Ionicons name="chevron-back" size={15} color={colors.primary} />
                <Text className="ml-1 text-[11px] font-bold text-primary">আগের</Text>
              </TouchableOpacity>
              <Text className="text-[11px] font-semibold text-muted">
                {toBengaliNumber(visibleOrderPage)} / {toBengaliNumber(totalOrderPages)}
              </Text>
              <TouchableOpacity
                disabled={visibleOrderPage >= totalOrderPages}
                onPress={() => setOrderPage(Math.min(totalOrderPages, visibleOrderPage + 1))}
                className={`flex-row items-center rounded-lg px-3 py-2 ${visibleOrderPage >= totalOrderPages ? 'opacity-40' : 'bg-primary-light'}`}
              >
                <Text className="mr-1 text-[11px] font-bold text-primary">পরের</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const renderWishlist = () => (
    <View>
      <SectionHeading title="আমার উইশলিস্ট" subtitle={`${toBengaliNumber(wishlist.length)}টি পছন্দের পণ্য`} />
      {wishlistQuery.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : wishlistQuery.isError ? (
        <RetryState
          message={responseMessage(wishlistQuery.error, 'উইশলিস্ট লোড করা যায়নি।')}
          onRetry={() => void wishlistQuery.refetch()}
        />
      ) : wishlist.length === 0 ? (
        <EmptyState icon="heart-outline" title="উইশলিস্ট খালি" message="পছন্দের পণ্য সংরক্ষণ করলে এখানে দেখা যাবে।" />
      ) : wishlist.map((product) => (
        <View key={product.id} className="mb-3 flex-row items-center rounded-2xl border border-line bg-white p-3">
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(ecommerce)/product/[id]', params: { id: product.id } })}
            className="mr-3 h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-xl bg-primary-light"
          >
            {isRemoteImage(product.image)
              ? <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
              : <Text className="text-[26px]">{product.image}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(ecommerce)/product/[id]', params: { id: product.id } })}
            className="flex-1"
          >
            <Text numberOfLines={2} className="text-[12px] font-bold text-ink">{product.name}</Text>
            <Text className="mt-1 text-[13px] font-extrabold text-primary">{formatTaka(product.price)}</Text>
            <Text className="mt-1 text-[10px] text-muted">পণ্যের বিবরণ দেখতে ট্যাপ করুন</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="উইশলিস্ট থেকে সরান"
            disabled={removeWishlistMutation.isPending}
            onPress={() => removeWishlistMutation.mutate(product.id)}
            className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-red-50"
          >
            <Ionicons name="heart-dislike-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderAddressForm = () => (
    <View className="mb-4 rounded-2xl border border-primary-light bg-white p-4">
      <Text className="mb-3 text-[14px] font-bold text-ink">
        {editingAddressId ? 'ঠিকানা সম্পাদনা' : 'নতুন ঠিকানা'}
      </Text>
      {([
        ['address_line', 'সম্পূর্ণ ঠিকানা', 'default'],
        ['division', 'বিভাগ', 'default'],
        ['district', 'জেলা', 'default'],
        ['upazila_thana', 'উপজেলা / থানা', 'default'],
        ['pincode', 'পোস্ট কোড', 'number-pad'],
        ['mobile', 'মোবাইল নম্বর', 'phone-pad'],
      ] as const).map(([field, label, keyboardType]) => (
        <View key={field} className="mb-2">
          <Text className="mb-1 text-[10px] font-semibold text-ink">{label}{field !== 'pincode' ? ' *' : ''}</Text>
          <TextInput
            value={addressDraft[field]}
            onChangeText={(value) => setAddressDraft((draft) => ({ ...draft, [field]: value }))}
            placeholder={label}
            keyboardType={keyboardType}
            autoCapitalize="words"
            className="rounded-xl border border-line bg-bg px-3 py-3 text-[12px] text-ink"
          />
        </View>
      ))}
      <View className="mt-2 flex-row">
        <TouchableOpacity
          onPress={() => {
            setShowAddressForm(false);
            setEditingAddressId(undefined);
          }}
          className="mr-2 flex-1 items-center rounded-xl border border-line py-3"
        >
          <Text className="text-[11px] font-bold text-muted">বাতিল</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={saveAddressMutation.isPending}
          onPress={submitAddress}
          className="flex-1 items-center rounded-xl bg-primary py-3"
        >
          {saveAddressMutation.isPending
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text className="text-[11px] font-bold text-white">{editingAddressId ? 'আপডেট করুন' : 'ঠিকানা সংরক্ষণ'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddresses = () => (
    <View>
      <SectionHeading
        title="আমার ঠিকানা"
        subtitle={`${toBengaliNumber(addressList.length)}টি সংরক্ষিত ঠিকানা`}
        action={
          <TouchableOpacity
            onPress={showAddressForm ? () => setShowAddressForm(false) : beginAddAddress}
            className="flex-row items-center rounded-xl bg-primary px-3 py-2"
          >
            <Ionicons name={showAddressForm ? 'close' : 'add'} size={16} color="#FFFFFF" />
            <Text className="ml-1 text-[10px] font-bold text-white">{showAddressForm ? 'বন্ধ' : 'যোগ করুন'}</Text>
          </TouchableOpacity>
        }
      />
      {showAddressForm ? renderAddressForm() : null}
      {addressesQuery.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : addressesQuery.isError ? (
        <RetryState
          message={responseMessage(addressesQuery.error, 'ঠিকানা লোড করা যায়নি।')}
          onRetry={() => void addressesQuery.refetch()}
        />
      ) : addressList.length === 0 ? (
        <EmptyState icon="location-outline" title="কোনো ঠিকানা নেই" message="ডেলিভারির সুবিধার জন্য আপনার ঠিকানা যোগ করুন।" />
      ) : addressList.map((address) => (
        <View key={address._id} className="mb-3 rounded-2xl border border-line bg-white p-4">
          <View className="flex-row items-start">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-tint-green">
              <Ionicons name="home-outline" size={19} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-bold text-ink">
                {[address.upazila_thana, address.district].filter(Boolean).join(', ') || 'ডেলিভারি ঠিকানা'}
              </Text>
              <Text className="mt-1 text-[11px] leading-5 text-muted">
                {[address.address_line, address.upazila_thana, address.district, address.division, address.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
              <Text className="mt-1 text-[10px] text-muted">
                মোবাইল: {String(address.mobile ?? 'নম্বর নেই')}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row justify-end border-t border-line pt-2">
            <TouchableOpacity onPress={() => beginEditAddress(address)} className="mr-4 flex-row items-center py-1">
              <Ionicons name="create-outline" size={15} color={colors.primary} />
              <Text className="ml-1 text-[10px] font-bold text-primary">সম্পাদনা</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={removeAddressMutation.isPending}
              onPress={() => Alert.alert('ঠিকানা সরাবেন?', 'এই সংরক্ষিত ঠিকানাটি নিষ্ক্রিয় করা হবে।', [
                { text: 'বাতিল', style: 'cancel' },
                { text: 'সরান', style: 'destructive', onPress: () => removeAddressMutation.mutate(address._id) },
              ])}
              className="flex-row items-center py-1"
            >
              <Ionicons name="trash-outline" size={15} color={colors.accent} />
              <Text className="ml-1 text-[10px] font-bold text-red-700">সরান</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderReferrals = () => {
    const referredUsers: ReferralUser[] = referrals?.users ?? [];
    const referralOrders: ReferralOrder[] = referrals?.orders ?? [];
    return (
      <View>
        <SectionHeading title="রেফারেল" subtitle="আপনার আমন্ত্রণ ও রেফারেল কার্যক্রম" />
        <View className="mb-3 rounded-2xl bg-emerald-700 p-4">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Ionicons name="gift-outline" size={21} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[14px] font-extrabold text-white">বন্ধুদের আমন্ত্রণ জানান</Text>
              <Text className="mt-1 text-[10px] text-white/80">আপনার রেফারেল কোড শেয়ার করুন</Text>
            </View>
          </View>
          {referralCode ? (
            <>
              <View className="mt-4 flex-row items-center rounded-xl bg-white px-3 py-3">
                <View className="flex-1">
                  <Text className="text-[9px] font-semibold text-muted">আপনার রেফারেল কোড</Text>
                  <Text selectable className="mt-1 text-[17px] font-black tracking-wider text-ink">{referralCode}</Text>
                </View>
                <TouchableOpacity onPress={() => void copyReferral(referralCode, 'রেফারেল কোড')} className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View className="mt-2 flex-row">
                <TouchableOpacity onPress={() => void copyReferral(referralLink, 'রেফারেল লিংক')} className="mr-2 flex-1 flex-row items-center justify-center rounded-xl bg-white/15 py-3">
                  <Ionicons name="link-outline" size={17} color="#FFFFFF" />
                  <Text className="ml-2 text-[10px] font-bold text-white">লিংক কপি</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void shareReferral()} className="flex-1 flex-row items-center justify-center rounded-xl bg-white py-3">
                  <Ionicons name="share-social-outline" size={17} color={colors.primary} />
                  <Text className="ml-2 text-[10px] font-bold text-primary">শেয়ার</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text className="mt-4 rounded-xl bg-white/10 p-3 text-[11px] leading-5 text-white">
              এই অ্যাকাউন্টের রেফারেল কোড এখনো পাওয়া যায়নি। প্রোফাইল আবার লোড করে দেখুন।
            </Text>
          )}
        </View>

        <View className="mb-4 flex-row">
          <View className="mr-2 flex-1 rounded-2xl border border-line bg-white p-4">
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text className="mt-3 text-[20px] font-black text-ink">
              {toBengaliNumber(referrals?.count ?? profile?.referralCount ?? referredUsers.length)}
            </Text>
            <Text className="mt-1 text-[10px] text-muted">মোট রেফারেল</Text>
          </View>
          <View className="ml-2 flex-1 rounded-2xl border border-line bg-white p-4">
            <Ionicons name="wallet-outline" size={20} color={colors.success} />
            <Text className="mt-3 text-[20px] font-black text-ink">{formatTaka(referralCommission)}</Text>
            <Text className="mt-1 text-[10px] text-muted">রেফারেল কমিশন</Text>
          </View>
        </View>
        {typeof profile?.balance === 'number' ? (
          <View className="mb-4 flex-row items-center rounded-2xl border border-green-100 bg-tint-green p-4">
            <Ionicons name="cash-outline" size={21} color={colors.success} />
            <Text className="ml-2 flex-1 text-[11px] font-semibold text-ink">বর্তমান অ্যাকাউন্ট ব্যালেন্স</Text>
            <Text className="text-[13px] font-extrabold text-green-800">{formatTaka(profile.balance)}</Text>
          </View>
        ) : null}

        <SectionHeading title="রেফারেল সদস্য" subtitle={`${toBengaliNumber(referredUsers.length)} জন`} />
        {profileQuery.isLoading ? <SkeletonCard /> : referredUsers.length === 0 ? (
          <EmptyState icon="people-outline" title="এখনো কোনো রেফারেল নেই" message="আপনার কোড বা লিংক শেয়ার করলে নতুন সদস্যরা এখানে দেখা যাবে।" />
        ) : referredUsers.map((referral) => (
          <View key={referral._id} className="mb-2 flex-row items-center rounded-xl border border-line bg-white p-3">
            <View className="mr-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-light">
              {referral.image && isRemoteImage(referral.image)
                ? <Image source={{ uri: referral.image }} className="h-full w-full" />
                : <Ionicons name="person-outline" size={19} color={colors.primary} />}
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-bold text-ink">{referral.name ?? 'নতুন সদস্য'}</Text>
              {referral.email ? <Text className="mt-0.5 text-[10px] text-muted">{referral.email}</Text> : null}
            </View>
            <Text className="text-[9px] text-muted">{formatDate(referral.createdAt)}</Text>
          </View>
        ))}

        <SectionHeading title="রেফারেল অর্ডার ও কমিশন" subtitle={`${toBengaliNumber(referralOrders.length)}টি সাম্প্রতিক অর্ডার`} />
        {referralOrders.length === 0 ? (
          <EmptyState icon="trending-up-outline" title="কমিশনের তথ্য নেই" message="রেফারেল সদস্যদের অর্ডার হলে তার অবস্থা ও কমিশন এখানে দেখা যাবে।" />
        ) : referralOrders.map((order) => {
          const referredUser = typeof order.userId === 'object' ? order.userId : undefined;
          return (
            <View key={order._id} className="mb-2 rounded-xl border border-line bg-white p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-bold text-ink">{order.orderId ?? 'অর্ডার'}</Text>
                <Text className="rounded-full bg-primary-light px-2 py-1 text-[9px] font-bold text-primary">
                  {orderStatusLabel(order.order_status)}
                </Text>
              </View>
              <Text className="mt-1 text-[10px] text-muted">
                {referredUser?.name ?? 'রেফারেল সদস্য'} · {formatDate(order.createdAt)}
              </Text>
              <View className="mt-2 flex-row justify-between border-t border-line pt-2">
                <Text className="text-[10px] text-muted">অর্ডার: {formatTaka(Number(order.totalAmt) || 0)}</Text>
                <Text className="text-[10px] font-bold text-green-800">
                  কমিশন: {formatTaka(Number(order.referralBonusAmount) || 0)}
                </Text>
              </View>
              <Text className="mt-1 text-[9px] text-muted">পেমেন্ট: {paymentStatusLabel(order.payment_status)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderProfileEdit = () => (
    <View className="rounded-2xl border border-primary-light bg-white p-4">
      <Text className="mb-4 text-[14px] font-extrabold text-ink">ব্যক্তিগত তথ্য সম্পাদনা</Text>
      <ProfileField
        label="সম্পূর্ণ নাম *"
        value={profileDraft.name}
        onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, name: value }))}
      />
      <ProfileField
        label="ইমেইল *"
        value={profileDraft.email}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, email: value }))}
      />
      <Text className="mb-3 -mt-2 text-[9px] leading-4 text-muted">
        ইমেইল পরিবর্তন করলে নতুন ঠিকানায় পাঠানো OTP দিয়ে যাচাই করতে হবে।
      </Text>
      <ProfileField
        label="মোবাইল নম্বর"
        value={profileDraft.mobile}
        keyboardType="phone-pad"
        autoCapitalize="none"
        onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, mobile: value }))}
      />
      <ProfileField
        label="জন্মতারিখ"
        value={profileDraft.date_of_birth}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, date_of_birth: value }))}
      />
      <Text className="mb-2 text-[11px] font-semibold text-ink">লিঙ্গ</Text>
      <View className="mb-4 flex-row">
        {([
          ['', 'উল্লেখ নেই'],
          ['Male', 'পুরুষ'],
          ['Female', 'নারী'],
          ['Other', 'অন্যান্য'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            key={value || 'none'}
            onPress={() => setProfileDraft((draft) => ({ ...draft, gender: value }))}
            className={`mr-2 rounded-full border px-3 py-2 ${profileDraft.gender === value ? 'border-primary bg-primary-light' : 'border-line bg-white'}`}
          >
            <Text className={`text-[10px] font-semibold ${profileDraft.gender === value ? 'text-primary' : 'text-muted'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isDropshipper ? (
        <>
          <View className="mb-3 mt-1 border-t border-line pt-4">
            <Text className="text-[13px] font-extrabold text-ink">ড্রপশিপিং শপের তথ্য</Text>
            <Text className="mt-1 text-[10px] text-muted">আপনার শপ ও যোগাযোগের তথ্য আপডেট করুন</Text>
          </View>
          <ProfileField label="শপের নাম" value={profileDraft.shopName} onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, shopName: value }))} />
          <ProfileField label="শপের ঠিকানা" value={profileDraft.shopAddress} onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, shopAddress: value }))} />
          <ProfileField label="ওয়েবসাইট" value={profileDraft.shopWebsite} keyboardType="url" autoCapitalize="none" onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, shopWebsite: value }))} />
          <ProfileField label="Facebook পেজ" value={profileDraft.facebookPage} keyboardType="url" autoCapitalize="none" onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, facebookPage: value }))} />
          <ProfileField label="WhatsApp নম্বর" value={profileDraft.whatsappNumber} keyboardType="phone-pad" autoCapitalize="none" onChangeText={(value) => setProfileDraft((draft) => ({ ...draft, whatsappNumber: value }))} />
          <View className="mb-3 mt-1 border-t border-line pt-4">
            <Text className="text-[13px] font-extrabold text-ink">কমিশন গ্রহণের তথ্য</Text>
            <Text className="mt-1 text-[10px] text-muted">শুধু আপনার নিজের পেমেন্ট গ্রহণের বিবরণ দিন</Text>
          </View>
          {([
            ['bkash', 'বিকাশ নম্বর'],
            ['nagad', 'নগদ নম্বর'],
            ['rocket', 'রকেট নম্বর'],
            ['bank', 'ব্যাংক তথ্য'],
          ] as const).map(([field, label]) => (
            <ProfileField
              key={field}
              label={label}
              value={profileDraft.paymentDetails[field]}
              keyboardType={field === 'bank' ? 'default' : 'phone-pad'}
              onChangeText={(value) => setProfileDraft((draft) => ({
                ...draft,
                paymentDetails: { ...draft.paymentDetails, [field]: value },
              }))}
            />
          ))}
        </>
      ) : null}

      <View className="mt-2 flex-row">
        <TouchableOpacity
          onPress={() => setEditingProfile(false)}
          disabled={saveProfileMutation.isPending}
          className="mr-2 flex-1 items-center rounded-xl border border-line py-3"
        >
          <Text className="text-[11px] font-bold text-muted">বাতিল</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={submitProfile}
          disabled={saveProfileMutation.isPending}
          className="flex-1 flex-row items-center justify-center rounded-xl bg-primary py-3"
        >
          {saveProfileMutation.isPending
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />}
          <Text className="ml-1.5 text-[11px] font-bold text-white">
            {saveProfileMutation.isPending ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordChange = () => (
    <View>
      <TouchableOpacity
        onPress={() => setActiveTab('settings')}
        className="mb-4 flex-row items-center self-start rounded-full bg-primary-light px-3 py-2"
      >
        <Ionicons name="arrow-back" size={15} color={colors.primary} />
        <Text className="ml-1.5 text-[10px] font-bold text-primary">সেটিংসে ফিরে যান</Text>
      </TouchableOpacity>
      <SectionHeading title="পাসওয়ার্ড পরিবর্তন" subtitle="অ্যাকাউন্ট সুরক্ষিত রাখতে শক্তিশালী পাসওয়ার্ড ব্যবহার করুন" />
      <View className="rounded-2xl border border-line bg-white p-4">
        <ProfileField
          label="বর্তমান পাসওয়ার্ড *"
          value={currentPassword}
          autoCapitalize="none"
          secureTextEntry={!passwordVisible}
          onChangeText={setCurrentPassword}
        />
        <ProfileField
          label="নতুন পাসওয়ার্ড *"
          value={newPassword}
          autoCapitalize="none"
          secureTextEntry={!passwordVisible}
          onChangeText={setNewPassword}
        />
        <ProfileField
          label="নতুন পাসওয়ার্ড নিশ্চিত করুন *"
          value={confirmNewPassword}
          autoCapitalize="none"
          secureTextEntry={!passwordVisible}
          onChangeText={setConfirmNewPassword}
        />
        <Text className="mb-4 text-[10px] leading-4 text-muted">কমপক্ষে ৮ অক্ষর দিন। পাসওয়ার্ড পরিবর্তনের পর অন্য ডিভাইসের সেশন বন্ধ হবে।</Text>
        <TouchableOpacity
          onPress={() => setPasswordVisible((visible) => !visible)}
          className="mb-3 flex-row items-center self-start"
        >
          <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.muted} />
          <Text className="ml-1 text-[10px] text-muted">{passwordVisible ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={submitPasswordChange}
          disabled={passwordMutation.isPending}
          className="flex-row items-center justify-center rounded-xl bg-primary py-3.5"
        >
          {passwordMutation.isPending
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />}
          <Text className="ml-2 text-[11px] font-bold text-white">
            {passwordMutation.isPending ? 'পাসওয়ার্ড পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSettings = () => (
    <View>
      <SectionHeading title="সেটিংস" subtitle="অ্যাকাউন্ট ও নিরাপত্তা" />
      <View className="mb-4 rounded-2xl border border-line bg-white p-4">
        <Text className="mb-3 text-[13px] font-bold text-ink">অ্যাকাউন্ট তথ্য</Text>
        <InfoRow icon="person-outline" label="অ্যাকাউন্টের ধরন" value={isDropshipper ? 'ড্রপশিপিং' : 'সাধারণ গ্রাহক'} />
        <InfoRow icon="mail-outline" label="ইমেইল" value={profile?.email || 'তথ্য নেই'} />
        <InfoRow icon="call-outline" label="মোবাইল" value={profile?.phone || String(profile?.mobile ?? 'তথ্য নেই')} />
        <InfoRow
          icon="shield-checkmark-outline"
          label="যাচাইকরণ"
          value={profile?.isVerified ? 'যাচাইকৃত' : 'যাচাই করা হয়নি'}
          last
        />
      </View>
      <TouchableOpacity
        onPress={() => setActiveTab('password')}
        className="mb-4 flex-row items-center rounded-2xl border border-line bg-white p-4"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-[12px] font-bold text-ink">পাসওয়ার্ড পরিবর্তন</Text>
          <Text className="mt-1 text-[10px] text-muted">বর্তমান পাসওয়ার্ড দিয়ে নিরাপদে পরিবর্তন করুন</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(ecommerce)/(tabs)/contact')}
        className="mb-3 flex-row items-center rounded-2xl border border-line bg-white p-4"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-[12px] font-bold text-ink">সহায়তা ও যোগাযোগ</Text>
          <Text className="mt-1 text-[10px] text-muted">প্রয়োজনে আমাদের সঙ্গে যোগাযোগ করুন</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleLogout} className="mb-4 flex-row items-center justify-center rounded-2xl border border-red-100 bg-red-50 py-4">
        <Ionicons name="log-out-outline" size={18} color={colors.accent} />
        <Text className="ml-2 text-[12px] font-bold text-red-700">অ্যাকাউন্ট থেকে লগআউট</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProfile = () => (
    <View>
      <SectionHeading
        title={editingProfile ? 'প্রোফাইল সম্পাদনা' : 'প্রোফাইল তথ্য'}
        subtitle={editingProfile ? 'আপনার তথ্য সম্পাদনা করে সংরক্ষণ করুন' : 'আপনার অ্যাকাউন্টের তথ্য'}
        action={!editingProfile ? (
          <TouchableOpacity
            onPress={beginEditProfile}
            className="flex-row items-center rounded-xl bg-primary px-3 py-2"
          >
            <Ionicons name="create-outline" size={15} color="#FFFFFF" />
            <Text className="ml-1 text-[10px] font-bold text-white">সম্পাদনা</Text>
          </TouchableOpacity>
        ) : undefined}
      />
      {editingProfile ? renderProfileEdit() : <View className="rounded-2xl border border-line bg-white p-4">
        <InfoRow icon="person-outline" label="নাম" value={profile?.name || 'তথ্য নেই'} />
        <InfoRow icon="mail-outline" label="ইমেইল" value={profile?.email || 'তথ্য নেই'} />
        <InfoRow icon="call-outline" label="মোবাইল নম্বর" value={profile?.phone || String(profile?.mobile ?? 'তথ্য নেই')} />
        <InfoRow
          icon="ribbon-outline"
          label="অ্যাকাউন্ট"
          value={isDropshipper ? 'ড্রপশিপিং সদস্য' : 'সাধারণ সদস্য'}
        />
        <InfoRow icon="shield-checkmark-outline" label="অ্যাকাউন্ট অবস্থা" value={profileValueLabel(profile?.status)} />
        <InfoRow icon="star-outline" label="গ্রাহক শ্রেণি" value={profileValueLabel(profile?.customerstatus)} />
        {profile?.date_of_birth ? <InfoRow icon="calendar-outline" label="জন্মতারিখ" value={formatDate(String(profile.date_of_birth))} /> : null}
        {profile?.gender ? <InfoRow icon="male-female-outline" label="লিঙ্গ" value={profileValueLabel(profile.gender)} /> : null}
        {profile?.createdAt ? <InfoRow icon="calendar-number-outline" label="সদস্য হয়েছেন" value={formatDate(String(profile.createdAt))} /> : null}
        <InfoRow icon="cube-outline" label="ডেলিভার হওয়া পণ্য" value={toBengaliNumber(Number(profile?.deliveredItemsCount) || 0)} last={!isDropshipper} />
        {isDropshipper ? (
          <>
            <View className="mb-2 mt-4 border-t border-line pt-4">
              <Text className="text-[12px] font-bold text-ink">ড্রপশিপিং তথ্য</Text>
            </View>
            <InfoRow icon="storefront-outline" label="শপের নাম" value={String(profile?.shopName ?? 'তথ্য নেই')} />
            <InfoRow icon="location-outline" label="শপের ঠিকানা" value={String(profile?.shopAddress ?? 'তথ্য নেই')} />
            <InfoRow icon="globe-outline" label="ওয়েবসাইট" value={String(profile?.shopWebsite ?? 'তথ্য নেই')} />
            <InfoRow icon="logo-whatsapp" label="WhatsApp" value={String(profile?.whatsappNumber ?? 'তথ্য নেই')} />
            <InfoRow icon="logo-facebook" label="Facebook পেজ" value={String(profile?.facebookPage ?? 'তথ্য নেই')} />
            <InfoRow icon="wallet-outline" label="বিকাশ" value={String(profile?.paymentDetails?.bkash ?? 'তথ্য নেই')} />
            <InfoRow icon="wallet-outline" label="নগদ" value={String(profile?.paymentDetails?.nagad ?? 'তথ্য নেই')} />
            <InfoRow icon="wallet-outline" label="রকেট" value={String(profile?.paymentDetails?.rocket ?? 'তথ্য নেই')} />
            <InfoRow icon="business-outline" label="ব্যাংক" value={String(profile?.paymentDetails?.bank ?? 'তথ্য নেই')} last />
            <View className="mt-3 flex-row items-center rounded-xl bg-bg p-3">
              <View className="mr-3 h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary-light">
                {profile?.shopLogo && isRemoteImage(profile.shopLogo)
                  ? <Image source={{ uri: profile.shopLogo }} className="h-full w-full" resizeMode="cover" />
                  : <Ionicons name="storefront-outline" size={21} color={colors.primary} />}
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-ink">শপের লোগো</Text>
                <Text className="mt-1 text-[9px] text-muted">{profile?.shopLogo ? 'আপলোড করা আছে' : 'এখনো যোগ করা হয়নি'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => void chooseProfileImage('shopLogo')}
                disabled={profileImageMutation.isPending}
                className="rounded-lg bg-white px-3 py-2"
              >
                <Text className="text-[9px] font-bold text-primary">
                  {profileImageMutation.isPending && profileImageMutation.variables?.type === 'shopLogo' ? 'আপলোড হচ্ছে...' : 'পরিবর্তন'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
        <TouchableOpacity
          onPress={() => void chooseProfileImage()}
          disabled={profileImageMutation.isPending}
          className="mt-4 flex-row items-center justify-center rounded-xl bg-primary-light py-3"
        >
          {profileImageMutation.isPending
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="camera-outline" size={17} color={colors.primary} />}
          <Text className="ml-2 text-[11px] font-bold text-primary">
            {profileImageMutation.isPending && !profileImageMutation.variables?.type
              ? 'ছবি আপডেট হচ্ছে...'
              : 'প্রোফাইল ছবি পরিবর্তন'}
          </Text>
        </TouchableOpacity>
      </View>}
      {emailChangeRequestMutation.isPending ? (
        <View className="mt-3 flex-row items-center rounded-xl border border-primary-light bg-white p-3">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="ml-2 text-[10px] text-muted">নতুন ইমেইলে যাচাইকরণ কোড পাঠানো হচ্ছে...</Text>
        </View>
      ) : null}
      {emailChangeTarget ? (
        <View className="mt-3 rounded-2xl border border-primary-light bg-white p-4">
          <Text className="text-[13px] font-extrabold text-ink">নতুন ইমেইল যাচাই করুন</Text>
          <Text className="mt-1 text-[10px] leading-4 text-muted">
            {emailChangeTarget} ঠিকানায় পাঠানো ৬ সংখ্যার কোড লিখুন।
          </Text>
          <TextInput
            value={emailChangeOtp}
            onChangeText={(value) => setEmailChangeOtp(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="৬ সংখ্যার OTP"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl border border-line bg-bg px-3.5 py-3 text-[14px] tracking-[4px] text-ink"
          />
          <View className="mt-3 flex-row">
            <TouchableOpacity
              onPress={() => emailChangeRequestMutation.mutate(emailChangeTarget)}
              disabled={emailChangeRequestMutation.isPending}
              className="mr-2 flex-1 items-center rounded-xl border border-line py-3"
            >
              <Text className="text-[10px] font-bold text-primary">কোড আবার পাঠান</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => emailChangeVerifyMutation.mutate(emailChangeOtp)}
              disabled={emailChangeVerifyMutation.isPending || emailChangeOtp.length !== 6}
              className="flex-1 flex-row items-center justify-center rounded-xl bg-primary py-3"
            >
              {emailChangeVerifyMutation.isPending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text className="text-[10px] font-bold text-white">যাচাই ও আপডেট</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {profileQuery.isError ? (
        <View className="mt-3">
          <RetryState
            message={responseMessage(profileQuery.error, 'প্রোফাইল লোড করা যায়নি।')}
            onRetry={() => void profileQuery.refetch()}
          />
        </View>
      ) : null}
    </View>
  );

  const activeContent = () => {
    switch (activeTab) {
      case 'orders': return renderOrders();
      case 'wishlist': return renderWishlist();
      case 'addresses': return renderAddresses();
      case 'referrals': return isDropshipper ? renderReferrals() : renderProfile();
      case 'settings': return renderSettings();
      case 'password': return renderPasswordChange();
      default: return renderProfile();
    }
  };

  if (!userId) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-bg px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Ionicons name="person-outline" size={30} color={colors.primary} />
        </View>
        <Text className="mt-4 text-[18px] font-extrabold text-ink">অ্যাকাউন্টে প্রবেশ করুন</Text>
        <Text className="mt-2 text-center text-[12px] leading-5 text-muted">প্রোফাইল, অর্ডার ও সংরক্ষিত ঠিকানা দেখতে লগইন করুন।</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')} className="mt-5 rounded-xl bg-primary px-6 py-3">
          <Text className="text-[12px] font-bold text-white">লগইন করুন</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-bg">
          <Ionicons name="chevron-back" size={21} color={colors.ink} />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] font-extrabold text-ink">আমার অ্যাকাউন্ট</Text>
        <TouchableOpacity onPress={refreshDashboard} className="h-9 w-9 items-center justify-center rounded-full bg-primary-light">
          {refreshing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
        </TouchableOpacity>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor={colors.success}
            colors={[colors.success]}
          />
        }
      >
        <View className="mb-4 overflow-hidden rounded-3xl bg-emerald-700 p-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => void chooseProfileImage()}
              disabled={profileImageMutation.isPending}
              className="h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-white/15"
            >
              {profile?.image && isRemoteImage(profile.image)
                ? <Image source={{ uri: profile.image }} className="h-full w-full" />
                : <Ionicons name="person" size={31} color="#FFFFFF" />}
              {profileImageMutation.isPending ? (
                <View className="absolute inset-0 items-center justify-center bg-black/30">
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </TouchableOpacity>
            <View className="ml-3 flex-1">
              <Text numberOfLines={1} className="text-[17px] font-extrabold text-white">
                {profile?.name ?? 'ব্যবহারকারী'}
              </Text>
              <Text numberOfLines={1} className="mt-1 text-[10px] text-white/80">{profile?.email ?? 'ইমেইল নেই'}</Text>
              <Text className="mt-1 text-[10px] text-white/80">
                {profile?.phone || String(profile?.mobile ?? 'মোবাইল নম্বর নেই')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => void chooseProfileImage()} className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View className="mt-4 flex-row">
            <SummaryTile icon="receipt-outline" label="অর্ডার" value={orderList.length} />
            <SummaryTile icon="heart-outline" label="উইশলিস্ট" value={wishlist.length} />
            <SummaryTile icon="location-outline" label="ঠিকানা" value={addressList.length} last />
          </View>
        </View>

        {notice ? (
          <TouchableOpacity onPress={() => setNotice(undefined)} className="mb-3 flex-row items-center rounded-xl border border-primary-light bg-white px-3 py-2.5">
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <Text className="ml-2 flex-1 text-[10px] text-primary">{notice}</Text>
            <Ionicons name="close" size={15} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-12">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.id)}
                className={`mr-2 flex-row items-center rounded-full border px-3.5 py-2 ${selected ? 'border-primary bg-primary' : 'border-line bg-white'}`}
              >
                <Ionicons name={tab.icon} size={15} color={selected ? '#FFFFFF' : colors.muted} />
                <Text className={`ml-1.5 text-[10px] font-bold ${selected ? 'text-white' : 'text-muted'}`}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {profileQuery.isLoading && activeTab === 'profile' ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : activeContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View className={`flex-row items-center py-3 ${last ? '' : 'border-b border-line'}`}>
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text className="ml-2.5 w-[82px] text-[10px] text-muted">{label}</Text>
      <Text selectable className="flex-1 text-right text-[11px] font-semibold text-ink">{value}</Text>
    </View>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <View className={`flex-1 flex-row items-center ${last ? '' : 'mr-2'} rounded-xl bg-white/15 px-2.5 py-2.5`}>
      <Ionicons name={icon} size={17} color="#FFFFFF" />
      <View className="ml-2">
        <Text className="text-[13px] font-extrabold text-white">{toBengaliNumber(value)}</Text>
        <Text className="text-[9px] text-white/80">{label}</Text>
      </View>
    </View>
  );
}

export default ProfileScreen;
