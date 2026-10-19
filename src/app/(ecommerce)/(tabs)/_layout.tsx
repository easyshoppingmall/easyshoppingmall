import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CenterShopButton } from '../../../shared/components/CenterShopButton';
import { colors } from '../../../shared/theme/colors';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabItems = [
  { name: 'index', label: 'হোম', icon: 'home-outline' },
  { name: 'blog', label: 'ব্লগ', icon: 'newspaper-outline' },
  { name: 'shop', label: 'শপ', icon: 'storefront-outline' },
  { name: 'about', label: 'আমাদের সম্পর্কে', icon: 'information-circle-outline' },
  { name: 'contact', label: 'যোগাযোগ', icon: 'call-outline' },
] as const;

function EcommerceTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;

  if (activeRoute === 'cart' || activeRoute === 'profile') return null;

  return (
    <View
      className="px-3 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8), backgroundColor: 'transparent' }}
    >
      <View
        className="h-[72px] flex-row items-center rounded-[26px] border border-white bg-white px-1"
        style={{
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.12,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        {tabItems.map((item) => {
          const routeIndex = state.routes.findIndex((route) => route.name === item.name);
          const route = state.routes[routeIndex];
          if (!route) return null;

          const isFocused = state.index === routeIndex;
          const options = descriptors[route.key].options;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
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

          const iconName = item.icon as keyof typeof Ionicons.glyphMap;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? item.label}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              className={`mx-0.5 flex-1 items-center justify-center rounded-2xl py-2 ${
                isFocused ? 'bg-primary-light' : 'bg-transparent'
              }`}
            >
              <Ionicons
                name={iconName}
                size={21}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text
                numberOfLines={1}
                className={`mt-1 text-[9px] ${
                  isFocused ? 'font-bold text-primary' : 'font-medium text-muted'
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function EcommerceTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <EcommerceTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'হোম' }} />
      <Tabs.Screen name="blog" options={{ title: 'ব্লগ' }} />
      <Tabs.Screen name="shop" options={{ title: 'শপ' }} />
      <Tabs.Screen name="about" options={{ title: 'আমাদের সম্পর্কে' }} />
      <Tabs.Screen name="contact" options={{ title: 'যোগাযোগ' }} />
      <Tabs.Screen name="cart" options={{ href: null, title: 'কার্ট' }} />
      <Tabs.Screen name="profile" options={{ href: null, title: 'প্রোফাইল' }} />
    </Tabs>
  );
}
