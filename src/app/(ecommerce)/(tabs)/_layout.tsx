import { useEffect, useState, type ComponentProps } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterShopButton } from '../../../shared/components/CenterShopButton';
import { colors } from '../../../shared/theme/colors';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

interface EcommerceTabButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  accessibilityLabel?: string;
  testID?: string;
  onPress: () => void;
  onLongPress: () => void;
}

function EcommerceTabButton({
  icon,
  label,
  focused,
  accessibilityLabel,
  testID,
  onPress,
  onLongPress,
}: EcommerceTabButtonProps) {
  const [focusProgress] = useState(() => new Animated.Value(focused ? 1 : 0));
  const [pressScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.spring(focusProgress, {
      toValue: focused ? 1 : 0,
      stiffness: 280,
      damping: 22,
      mass: 0.7,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focusProgress, focused]);

  const onPressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.94,
      stiffness: 420,
      damping: 24,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      stiffness: 360,
      damping: 18,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      className="mx-0.5 flex-1 items-center justify-center"
    >
      <Animated.View
        style={{
          transform: [{ scale: pressScale }],
          width: '100%',
        }}
        className="items-center justify-center"
      >
        <Animated.View
          className="w-full items-center justify-center rounded-2xl px-1 py-1.5"
          style={{
            backgroundColor: focused ? colors.primaryLight : 'transparent',
            borderWidth: focused ? 1 : 0,
            borderColor: focused ? '#CFE9FF' : 'transparent',
            minHeight: 48,
            transform: [{
              scale: focusProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            }],
          }}
        >
          <View
            className="h-7 w-7 items-center justify-center rounded-xl"
            style={{
              backgroundColor: focused ? '#FFFFFF' : 'transparent',
              shadowColor: focused ? colors.primary : '#000000',
              shadowOpacity: focused ? 0.12 : 0,
              shadowRadius: focused ? 8 : 0,
              elevation: focused ? 2 : 0,
            }}
          >
            <Ionicons
              name={icon}
              size={20}
              color={focused ? colors.primary : colors.muted}
            />
          </View>
          <Animated.Text
            numberOfLines={1}
            className={`mt-1 text-[8.5px] ${
              focused ? 'font-extrabold text-primary' : 'font-semibold text-muted'
            }`}
            style={{
              opacity: focusProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
              transform: [{
                translateY: focusProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 0],
                }),
              }],
            }}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const tabItems = [
  { name: 'index', label: 'হোম', icon: 'home-outline' },
  { name: 'blog', label: 'ব্লগ', icon: 'newspaper-outline' },
  { name: 'shop', label: 'শপ', icon: 'storefront-outline' },
  { name: 'about', label: 'আমাদের সম্পর্কে', icon: 'information-circle-outline' },
  { name: 'contact', label: 'যোগাযোগ', icon: 'call-outline' },
] as const;

function EcommerceTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="px-2 pt-1"
      style={{ paddingBottom: Math.max(insets.bottom, 5), backgroundColor: colors.background }}
    >
      <View
        className="h-[66px] flex-row items-center rounded-[22px] border bg-white px-1"
        style={{
          borderColor: '#D9EFFC',
          shadowColor: colors.primaryDark,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 7,
        }}
      >
        {tabItems.map((item) => {
          const routeIndex = state.routes.findIndex((route) => route.name === item.name);
          const route = state.routes[routeIndex];
          if (!route) return null;

          const isFocused = state.index === routeIndex;
          const options = descriptors[route.key].options;
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };
          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          if (item.name === 'shop') {
            return (
              <View key={item.name} className="flex-1 items-center justify-center">
                <CenterShopButton
                  isFocused={isFocused}
                  onPress={onPress}
                  label={options.title ?? item.label}
                />
              </View>
            );
          }

          return (
            <EcommerceTabButton
              key={item.name}
              icon={item.icon}
              label={item.label}
              focused={isFocused}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? item.label}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function EcommerceTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <EcommerceTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'হোম' }} />
      <Tabs.Screen name="blog" options={{ title: 'ব্লগ' }} />
      <Tabs.Screen name="shop" options={{ title: 'শপ' }} />
      <Tabs.Screen name="about" options={{ title: 'আমাদের সম্পর্কে' }} />
      <Tabs.Screen name="contact" options={{ title: 'যোগাযোগ' }} />
    </Tabs>
  );
}
