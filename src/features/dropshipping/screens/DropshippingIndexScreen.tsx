import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { signOut } from '../../../store/authSlice';
import { colors } from '../../../shared/theme/colors';
import {
  formatDropshippingNumber,
  formatDropshippingTaka,
  type DropshippingNotice,
} from '../api/homeApi';
import {
  useActiveDropshippingNoticesQuery,
  useDropshippingBannersQuery,
  useDropshippingProfileQuery,
} from '../api/queries';
import { DropshippingHomeBanner } from '../components/DropshippingHomeBanner';

type DrawerDestination =
  | 'home'
  | 'search'
  | 'all-products'
  | 'profile'
  | 'new-products'
  | 'wishlist'
  | 'orders'
  | 'section';

interface DrawerItem {
  label: string;
  destination: DrawerDestination;
  section?: string;
}

const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Home', destination: 'home' },
  { label: 'Search Products', destination: 'search' },
  { label: 'All Products', destination: 'all-products' },
  { label: 'Profile', destination: 'profile' },
  { label: 'New Products', destination: 'new-products' },
  { label: 'Wishlist', destination: 'wishlist' },
  { label: 'Order List', destination: 'orders' },
  { label: 'My Analytics', destination: 'section', section: 'my-analytics' },
  { label: 'Videos', destination: 'section', section: 'video' },
  { label: 'Shop Settings', destination: 'section', section: 'shop-settings' },
  { label: 'Referral Profile', destination: 'section', section: 'referral-profile' },
  { label: 'Payment Request', destination: 'section', section: 'payment-request' },
  { label: 'Support', destination: 'section', section: 'support' },
  { label: 'Dashboard', destination: 'section', section: 'seller-dashboard' },
];

function NoticeCard({ notice }: { notice: DropshippingNotice }) {
  return (
    <View className="mb-3 rounded-2xl border border-blue-100 bg-white p-4">
      <View className="flex-row items-start">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-ink">{notice.title}</Text>
          <Text className="mt-1 text-[12px] leading-5 text-muted">{notice.description}</Text>
        </View>
      </View>
      {notice.keyPoints.length > 0 ? (
        <View className="ml-12 mt-2">
          {notice.keyPoints.map((point, index) => (
            <View key={`${notice.id}-${index}`} className="mb-1 flex-row">
              <Text className="mr-2 text-primary">•</Text>
              <Text className="flex-1 text-[11px] leading-4 text-muted">{point}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-row items-center rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
      <Ionicons name="alert-circle-outline" size={19} color="#DC2626" />
      <Text className="ml-2 flex-1 text-[11px] leading-4 text-red-700">{message}</Text>
      <TouchableOpacity onPress={onRetry} className="ml-2 px-1 py-2">
        <Text className="text-[11px] font-bold text-primary">আবার চেষ্টা</Text>
      </TouchableOpacity>
    </View>
  );
}

export function DropshippingIndexScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const cartCount = useAppSelector((state) => state.cart.totalQuantity);
  const profileQuery = useDropshippingProfileQuery();
  const bannersQuery = useDropshippingBannersQuery();
  const noticesQuery = useActiveDropshippingNoticesQuery();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(360, width * 0.86);
  const [drawerPosition] = useState(() => new Animated.Value(-360));
  const [backdropOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!drawerVisible) return;
    drawerPosition.setValue(-drawerWidth);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(drawerPosition, {
        toValue: 0,
        speed: 22,
        bounciness: 2,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, drawerPosition, drawerVisible, drawerWidth]);

  const balance = profileQuery.data?.balance ?? user?.balance;
  const balanceLabel =
    typeof balance === 'number' && Number.isFinite(balance)
      ? formatDropshippingTaka(balance)
      : profileQuery.isPending
        ? '...'
        : '—';
  const displayName =
    profileQuery.data?.shopName ||
    profileQuery.data?.name ||
    user?.name ||
    'ড্রপশিপার';
  const email = profileQuery.data?.email || user?.email;
  const profileImage = profileQuery.data?.image || user?.image;

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerPosition, {
        toValue: -drawerWidth,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setDrawerVisible(false);
    });
  };

  const openRoute = (item: DrawerItem) => {
    closeDrawer();
    switch (item.destination) {
      case 'home':
        router.replace('/(dropshipping)');
        break;
      case 'profile':
        router.push('/(dropshipping)/profile');
        break;
      case 'wishlist':
        router.push({
          pathname: '/(dropshipping)/[section]',
          params: { section: 'wishlist' },
        });
        break;
      case 'orders':
        router.push({
          pathname: '/(dropshipping)/[section]',
          params: { section: 'order-list' },
        });
        break;
      case 'search':
        router.push({
          pathname: '/(dropshipping)/[section]',
          params: { section: 'search-products' },
        });
        break;
      case 'all-products':
        router.push('/(dropshipping)/all-products');
        break;
      case 'new-products':
        router.push('/(dropshipping)/all-products');
        break;
      case 'section':
        if (item.section) {
          router.push({
            pathname: '/(dropshipping)/[section]',
            params: { section: item.section },
          });
        }
        break;
    }
  };

  const refreshHome = () => {
    void Promise.all([
      profileQuery.refetch(),
      bannersQuery.refetch(),
      noticesQuery.refetch(),
    ]);
  };
  const refreshing =
    profileQuery.isRefetching || bannersQuery.isRefetching || noticesQuery.isRefetching;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center border-b border-line bg-white px-3 py-2">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="মেনু খুলুন"
          onPress={() => setDrawerVisible(true)}
          activeOpacity={0.75}
          className="mr-2 h-9 w-9 items-center justify-center rounded-xl border border-line bg-white"
          style={{
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <Ionicons name="menu" size={22} color={colors.ink} />
        </TouchableOpacity>

        <View className="mr-2 flex-1 flex-row items-center">
          <Image
            source={require('../../../../assets/icon.png')}
            resizeMode="contain"
            className="h-8 w-8"
          />
          <View className="ml-1.5 flex-1">
            <Text numberOfLines={1} className="text-[10px] font-extrabold tracking-tight text-ink">
              EasyShoppingMallBD
            </Text>
            <Text numberOfLines={1} className="text-[9px] text-muted">Dropshipping</Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`ব্যালেন্স ${balanceLabel}`}
          onPress={() => router.push({
            pathname: '/(dropshipping)/[section]',
            params: { section: 'balance' },
          })}
          className="mr-1 flex-row items-center"
        >
          <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
            <Ionicons name="cash-outline" size={16} color="#059669" />
          </View>
          <Text numberOfLines={1} className="ml-1 max-w-[48px] text-[9px] font-bold text-ink">
            {balanceLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="প্রোফাইল"
          onPress={() => router.push('/(dropshipping)/profile')}
          className="h-8 w-8 items-center justify-center"
        >
          <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="উইশলিস্ট"
          onPress={() => router.push({
            pathname: '/(dropshipping)/[section]',
            params: { section: 'wishlist' },
          })}
          className="h-8 w-8 items-center justify-center"
        >
          <Ionicons name="heart-outline" size={20} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`কার্ট, ${formatDropshippingNumber(cartCount)}টি পণ্য`}
          onPress={() => router.push('/(ecommerce)/(tabs)/cart')}
          className="relative h-8 w-8 items-center justify-center"
        >
          <Ionicons name="cart-outline" size={21} color={colors.ink} />
          {cartCount > 0 ? (
            <View className="absolute right-0 top-0 min-w-[15px] items-center rounded-full border border-white bg-accent px-1">
              <Text className="text-[8px] font-bold text-white">{formatDropshippingNumber(cartCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshHome}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View className="mt-4 overflow-hidden rounded-[24px] bg-primary px-5 py-5">
          <View className="absolute -right-5 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <Text className="text-[12px] font-medium text-white/80">আসসালামু আলাইকুম</Text>
          <Text numberOfLines={1} className="mt-1 text-[22px] font-extrabold text-white">
            {displayName}
          </Text>
          <View className="mt-3 self-start flex-row items-center rounded-full bg-white/20 px-3 py-1.5">
            <Ionicons name="briefcase-outline" size={14} color="#FFFFFF" />
            <Text className="ml-1.5 text-[10px] font-semibold text-white">
              ড্রপশিপিং অ্যাকাউন্ট
            </Text>
          </View>
          {profileQuery.isError ? (
            <Text className="mt-3 text-[10px] leading-4 text-white">
              প্রোফাইল আপডেট করা যায়নি; সংরক্ষিত তথ্য দেখানো হচ্ছে।
            </Text>
          ) : null}
        </View>

        <View className="mt-6">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-[16px] font-bold text-ink">আপনার জন্য</Text>
              <Text className="mt-0.5 text-[11px] text-muted">সর্বশেষ আপডেট ও ঘোষণা</Text>
            </View>
            {bannersQuery.isFetching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
          </View>
          {bannersQuery.isError ? (
            <RetryNotice
              message={bannersQuery.error.message}
              onRetry={() => void bannersQuery.refetch()}
            />
          ) : bannersQuery.isPending ? (
            <View className="h-[168px] items-center justify-center rounded-[20px] border border-line bg-white">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="mt-2 text-[11px] text-muted">ব্যানার লোড হচ্ছে...</Text>
            </View>
          ) : (
            <DropshippingHomeBanner
              key={bannersQuery.data.map((banner) => banner.id).join(':')}
              banners={bannersQuery.data}
            />
          )}
        </View>

        <View className="mb-3 mt-6">
          <Text className="text-[16px] font-bold text-ink">গুরুত্বপূর্ণ ঘোষণা</Text>
          <Text className="mt-0.5 text-[11px] text-muted">অ্যাকাউন্ট সংক্রান্ত সর্বশেষ তথ্য</Text>
        </View>
        {noticesQuery.isPending ? (
          <View className="items-center rounded-2xl border border-line bg-white py-5">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : noticesQuery.isError ? (
          <RetryNotice
            message={noticesQuery.error.message}
            onRetry={() => void noticesQuery.refetch()}
          />
        ) : noticesQuery.data.length > 0 ? (
          noticesQuery.data.map((notice) => <NoticeCard key={notice.id} notice={notice} />)
        ) : (
          <View className="items-center rounded-2xl border border-line bg-white px-4 py-6">
            <Ionicons name="checkmark-circle-outline" size={26} color="#10B981" />
            <Text className="mt-2 text-[12px] text-muted">এখন কোনো নতুন নোটিশ নেই</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={drawerVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDrawer}
      >
        <View className="flex-1 flex-row">
          <Animated.View
            className="absolute inset-0 bg-black/45"
            style={{ opacity: backdropOpacity }}
          >
            <Pressable className="flex-1" onPress={closeDrawer} accessibilityLabel="মেনু বন্ধ করুন" />
          </Animated.View>
          <Animated.View
            className="h-full bg-white"
            style={{
              width: drawerWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX: drawerPosition }],
              shadowColor: '#000000',
              shadowOffset: { width: 4, height: 0 },
              shadowOpacity: 0.16,
              shadowRadius: 12,
              elevation: 12,
            }}
          >
            <View className="flex-row items-center border-b border-line px-4 py-4">
              <Image
                source={require('../../../../assets/icon.png')}
                resizeMode="contain"
                className="h-12 w-12 rounded-xl"
              />
              <View className="ml-3 flex-1">
                <Text className="text-[14px] font-extrabold text-ink">EasyShoppingMallBD</Text>
                <Text className="mt-0.5 text-[10px] text-muted">Dropshipping</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="ড্রয়ার বন্ধ করুন"
                onPress={closeDrawer}
                className="h-9 w-9 items-center justify-center rounded-full bg-bg"
              >
                <Ionicons name="close" size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {isAuthenticated && user ? (
              <View className="flex-row items-center border-b border-line px-4 py-4">
                <View className="h-11 w-11 overflow-hidden rounded-full bg-primary-light">
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} className="h-full w-full" />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Ionicons name="person" size={21} color={colors.primary} />
                    </View>
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="text-[13px] font-bold text-ink">
                    {displayName}
                  </Text>
                  {email ? (
                    <Text numberOfLines={1} className="mt-0.5 text-[10px] text-muted">
                      {email}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="লগ আউট"
                  onPress={() => {
                    closeDrawer();
                    dispatch(signOut());
                  }}
                  className="h-9 w-9 items-center justify-center"
                >
                  <Ionicons name="log-out-outline" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row border-b border-line px-4 py-4">
                <TouchableOpacity
                  onPress={() => {
                    closeDrawer();
                    router.push('/(auth)/sign-in');
                  }}
                  className="mr-2 flex-1 items-center rounded-xl bg-primary py-3"
                >
                  <Text className="text-[12px] font-bold text-white">Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    closeDrawer();
                    router.push('/(auth)/sign-up');
                  }}
                  className="flex-1 items-center rounded-xl border border-primary py-3"
                >
                  <Text className="text-[12px] font-bold text-primary">Sign Up</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="px-5 pb-5 pt-2"
            >
              {DRAWER_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => openRoute(item)}
                  className="py-3"
                >
                  <Text className="text-[14px] font-medium text-ink">{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default DropshippingIndexScreen;
