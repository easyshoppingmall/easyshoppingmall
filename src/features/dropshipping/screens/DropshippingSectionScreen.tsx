import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useDropshippingProfileQuery } from '../api/queries';
import { formatDropshippingTaka } from '../api/homeApi';
import { DropshippingSearchScreen } from './DropshippingSearchScreen';
import { DropshippingAllProductsScreen } from './DropshippingAllProductsScreen';

const SECTIONS: Record<
  string,
  { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  balance: {
    title: 'Balance',
    description: 'আপনার অ্যাকাউন্টের বর্তমান ব্যালেন্স',
    icon: 'wallet-outline',
  },
  account: {
    title: 'Account',
    description: 'আপনার অ্যাকাউন্টের তথ্য',
    icon: 'person-circle-outline',
  },
  card: {
    title: 'Card',
    description: 'কার্ড সংক্রান্ত সুবিধা এখানে যুক্ত হলে দেখা যাবে',
    icon: 'card-outline',
  },
  'all-products': {
    title: 'All Products',
    description: 'সব পণ্য দেখার বিভাগ',
    icon: 'grid-outline',
  },
  'new-products': {
    title: 'New Products',
    description: 'নতুন পণ্য দেখার বিভাগ',
    icon: 'sparkles-outline',
  },
  'boost-products': {
    title: 'Boost Products',
    description: 'বুস্ট করা পণ্য দেখার বিভাগ',
    icon: 'rocket-outline',
  },
  'team-system': {
    title: 'Team System',
    description: 'টিমের তথ্য ও পরিচালনা',
    icon: 'people-outline',
  },
  video: {
    title: 'Video',
    description: 'ভিডিও ও শেখার উপকরণ',
    icon: 'play-circle-outline',
  },
  'seller-dashboard': {
    title: 'Seller Dashboard',
    description: 'বিক্রির সারসংক্ষেপ ও ব্যবস্থাপনা',
    icon: 'bar-chart-outline',
  },
  'order-list': {
    title: 'Order List',
    description: 'আপনার অর্ডারের তালিকা',
    icon: 'receipt-outline',
  },
  blog: {
    title: 'Blog',
    description: 'ড্রপশিপিং বিষয়ক লেখা ও আপডেট',
    icon: 'newspaper-outline',
  },
  'search-products': {
    title: 'Search Products',
    description: 'পণ্য খোঁজার বিভাগ',
    icon: 'search-outline',
  },
  'my-analytics': {
    title: 'My Analytics',
    description: 'আপনার ড্রপশিপিং কার্যক্রমের পরিসংখ্যান',
    icon: 'analytics-outline',
  },
  'shop-settings': {
    title: 'Shop Settings',
    description: 'আপনার দোকানের সেটিংস',
    icon: 'settings-outline',
  },
  'referral-profile': {
    title: 'Referral Profile',
    description: 'রেফারেল প্রোফাইল ও তথ্য',
    icon: 'people-outline',
  },
  'payment-request': {
    title: 'Payment Request',
    description: 'পেমেন্ট অনুরোধ ও তার অবস্থা',
    icon: 'wallet-outline',
  },
  support: {
    title: 'Support',
    description: 'সহায়তা ও যোগাযোগ',
    icon: 'help-circle-outline',
  },
};

export function DropshippingSectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  const details = section ? SECTIONS[section] : undefined;
  const profileQuery = useDropshippingProfileQuery();
  const profile = profileQuery.data;

  if (section === 'search-products') return <DropshippingSearchScreen />;
  if (section === 'all-products' || section === 'new-products') {
    return <DropshippingAllProductsScreen />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg px-4">
      <View className="flex-row items-center py-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ড্রপশিপিং হোমে ফিরুন"
          onPress={() => router.replace('/(dropshipping)')}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text className="text-[17px] font-bold text-ink">
          {details?.title ?? 'Dropshipping'}
        </Text>
      </View>

      <View className="mt-3 flex-1 items-center justify-center rounded-[24px] border border-line bg-white px-6">
        <View className="h-16 w-16 items-center justify-center rounded-[20px] bg-primary-light">
          <Ionicons
            name={details?.icon ?? 'apps-outline'}
            size={30}
            color={colors.primary}
          />
        </View>
        <Text className="mt-4 text-center text-[17px] font-bold text-ink">
          {details?.title ?? 'বিভাগটি পাওয়া যায়নি'}
        </Text>
        {details ? (
          <Text className="mt-2 text-center text-[12px] leading-5 text-muted">
            {details.description}
          </Text>
        ) : null}

        {section === 'balance' ? (
          <View className="mt-5 w-full items-center rounded-2xl bg-primary-light px-4 py-4">
            <Text className="text-[11px] font-medium text-muted">বর্তমান ব্যালেন্স</Text>
            {profileQuery.isPending ? (
              <ActivityIndicator className="mt-2" size="small" color={colors.primary} />
            ) : profileQuery.isError ? (
              <TouchableOpacity onPress={() => void profileQuery.refetch()} className="mt-2">
                <Text className="text-[11px] font-semibold text-red-600">
                  ব্যালেন্স আনা যায়নি · আবার চেষ্টা করুন
                </Text>
              </TouchableOpacity>
            ) : (
              <Text className="mt-1 text-[22px] font-extrabold text-primary-dark">
                {typeof profile?.balance === 'number'
                  ? formatDropshippingTaka(profile.balance)
                  : '—'}
              </Text>
            )}
          </View>
        ) : null}

        {section === 'account' ? (
          <View className="mt-5 w-full rounded-2xl bg-bg px-4 py-3">
            {profileQuery.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : profileQuery.isError ? (
              <TouchableOpacity onPress={() => void profileQuery.refetch()}>
                <Text className="text-center text-[11px] font-semibold text-red-600">
                  অ্যাকাউন্টের তথ্য আনা যায়নি · আবার চেষ্টা করুন
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                {profile?.name ? <Text className="text-[12px] text-ink">{profile.name}</Text> : null}
                {profile?.email ? <Text className="mt-1 text-[11px] text-muted">{profile.email}</Text> : null}
                {profile?.mobile ? <Text className="mt-1 text-[11px] text-muted">{profile.mobile}</Text> : null}
                {profile?.shopName ? <Text className="mt-1 text-[11px] text-muted">{profile.shopName}</Text> : null}
                {!profile?.name && !profile?.email && !profile?.mobile && !profile?.shopName ? (
                  <Text className="text-[11px] text-muted">অ্যাকাউন্টের অতিরিক্ত তথ্য নেই।</Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {section !== 'balance' && section !== 'account' && details ? (
          <View className="mt-5 rounded-full bg-tint-blue px-3 py-1.5">
            <Text className="text-[10px] font-semibold text-primary-dark">
              এই বিভাগটি পরবর্তী ধাপে তৈরি হবে
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default DropshippingSectionScreen;
