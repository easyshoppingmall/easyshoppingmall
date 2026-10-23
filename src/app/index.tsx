import { useEffect, useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppSelector } from '../store/hooks';
import { colors } from '../shared/theme/colors';

export default function IndexRoute() {
  const { isInitialized, isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.78));
  const [haloOpacity] = useState(() => new Animated.Value(0.35));

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

  if (isInitialized) {
    const destination = isAuthenticated && user
      ? user.role?.toUpperCase() === 'DROPSHIPPING'
        ? '/(dropshipping)'
        : '/(ecommerce)/(tabs)'
      : '/(auth)/sign-in';
    return <Redirect href={destination} />;
  }

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-bg px-8">
      <Animated.View
        className="absolute h-52 w-52 rounded-full bg-primary-light"
        style={{ opacity: haloOpacity, transform: [{ scale: 1.2 }] }}
      />
      <Animated.View
        className="h-40 w-40 items-center justify-center rounded-[34px] border border-white bg-white p-3"
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.16,
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
        <Text className="mt-7 text-[21px] font-extrabold tracking-tight text-primary">
          EasyShoppingMallBD
        </Text>
        <Text className="mt-1 text-center text-[12px] font-medium text-muted">
          Shopping made easy
        </Text>
      </Animated.View>
      <View className="absolute bottom-14 h-1 w-16 overflow-hidden rounded-full bg-primary-light">
        <Animated.View
          className="h-full w-8 rounded-full bg-primary"
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
