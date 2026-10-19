import '../../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../config/queryClient';
import { hydrateAuth } from '../store/authSlice';
import { store } from '../store';

function AppNavigation() {
  useEffect(() => {
    void store.dispatch(hydrateAuth());
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(ecommerce)" />
        <Stack.Screen name="(dropshipping)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppNavigation />
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
