import { useEffect, useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { queryClient } from '../config/queryClient';
import {
  getActiveDropshippingNotices,
  getDropshippingBanners,
  getDropshippingProfile,
} from '../features/dropshipping/api/homeApi';
import { dropshippingHomeQueryKeys } from '../features/dropshipping/api/queries';
import {
  getCenterBanners,
  getHomeCategories,
  getHomeProducts,
  getHomeSubcategories,
  getPopularProducts,
  getProductsForSubcategories,
  getTopHomeBanners,
} from '../features/ecommerce/api/homeApi';
import { catalogQueryKeys } from '../features/ecommerce/api/queries';
import { useAppSelector } from '../store/hooks';
import { colors } from '../shared/theme/colors';

export default function IndexRoute() {
  const { isInitialized, isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.78));
  const [haloOpacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const timeout = setTimeout(() => setMinimumSplashElapsed(true), 2000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 11,
        stiffness: 150,
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(haloOpacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      entrance.stop();
      pulse.stop();
    };
  }, [haloOpacity, logoOpacity, logoScale]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !user) return;

    if (user.role?.toUpperCase() === 'DROPSHIPPING') {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: dropshippingHomeQueryKeys.profile(user._id),
          queryFn: () => getDropshippingProfile(),
          staleTime: 60_000,
        }),
        queryClient.prefetchQuery({
          queryKey: dropshippingHomeQueryKeys.banners,
          queryFn: () => getDropshippingBanners(),
          staleTime: 5 * 60_000,
        }),
        queryClient.prefetchQuery({
          queryKey: dropshippingHomeQueryKeys.notices,
          queryFn: () => getActiveDropshippingNotices(),
          staleTime: 5 * 60_000,
        }),
      ]);
      return;
    }

    const subcategoryProductsWarmup = queryClient.prefetchQuery({
      queryKey: catalogQueryKeys.subcategories,
      queryFn: getHomeSubcategories,
    }).then(() => {
      const subcategories = queryClient.getQueryData<Awaited<ReturnType<typeof getHomeSubcategories>>>(
        catalogQueryKeys.subcategories
      );
      if (!subcategories?.length) return;
      return queryClient.prefetchQuery({
        queryKey: ['home', 'subcategory-products', subcategories.map((subcategory) => subcategory.id)],
        queryFn: () => getProductsForSubcategories(subcategories),
      });
    });

    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: catalogQueryKeys.categories,
        queryFn: getHomeCategories,
      }),
      subcategoryProductsWarmup,
      queryClient.prefetchQuery({
        queryKey: ['home', 'center-banners'],
        queryFn: getCenterBanners,
      }),
      queryClient.prefetchQuery({
        queryKey: ['home', 'top-banners'],
        queryFn: getTopHomeBanners,
      }),
      queryClient.prefetchQuery({
        queryKey: ['home', 'top-discounts'],
        queryFn: () => getHomeProducts({ limit: 20 }),
      }),
      queryClient.prefetchQuery({
        queryKey: ['home', 'popular-products'],
        queryFn: () => getPopularProducts({ page: 1, limit: 10 }),
      }),
    ]);
  }, [isAuthenticated, isInitialized, user]);

  if (isInitialized && minimumSplashElapsed) {
    const destination = isAuthenticated && user
      ? user.role?.toUpperCase() === 'DROPSHIPPING'
        ? '/(dropshipping)'
        : '/(ecommerce)/(tabs)'
      : '/(auth)/sign-in';
    return <Redirect href={destination} />;
  }

  return (
    <View
      className="flex-1 items-center justify-center overflow-hidden px-8"
      style={{ backgroundColor: colors.primary }}
    >
      <Animated.View
        className="absolute h-52 w-52 rounded-full bg-white/15"
        style={{ opacity: haloOpacity, transform: [{ scale: 1.2 }] }}
      />
      <Animated.View
        className="h-40 w-40 items-center justify-center rounded-[34px] border border-white bg-white p-3"
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <Image
          source={require('../../assets/logo.png')}
          resizeMode="contain"
          className="h-full w-full"
          accessibilityLabel="EasyShoppingMallBD"
        />
      </Animated.View>
      <Animated.View style={{ opacity: logoOpacity }}>
        <Text className="mt-7 text-[21px] font-extrabold tracking-tight text-white">
          EasyShoppingMallBD
        </Text>
        <Text className="mt-1 text-center text-[12px] font-medium text-white/80">
          Shopping made easy
        </Text>
      </Animated.View>
      <View className="absolute bottom-14 h-1 w-16 overflow-hidden rounded-full bg-white/30">
        <Animated.View
          className="h-full w-8 rounded-full bg-white"
          style={{
            transform: [
              {
                translateX: logoOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-32, 32],
                }),
              },
            ],
          }}
        />
      </View>
    </View>
  );
}
