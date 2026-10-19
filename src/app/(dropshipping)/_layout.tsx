import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAppSelector } from '../../store/hooks';
import { colors } from '../../shared/theme/colors';

export default function DropshippingLayout() {
  const { isInitialized, isAuthenticated, user } = useAppSelector((state) => state.auth);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated || !user) return <Redirect href="/(auth)/sign-in" />;
  if (user.role?.toUpperCase() !== 'DROPSHIPPING') return <Redirect href="/(ecommerce)/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
