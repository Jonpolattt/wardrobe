import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { usePreferences } from '../store/preferences';
import { useAuth } from '../store/auth';
import { queryClient } from '../services/query-client';
import { useTheme } from '../hooks/useTheme';
import { Button, Screen, StateView } from '../components/ui';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined); }, []);
  const { t } = useTranslation('common');
  return <SafeAreaProvider><Screen><StateView kind="error" title={t('errorTitle')} message={t('appError')} />
    <Button title={t('retry')} onPress={() => { void retry(); }} /></Screen></SafeAreaProvider>;
}
export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const locale = usePreferences((state) => state.locale);
  const preferencesHydrated = usePreferences((state) => state.hydrated);
  const authHydrated = useAuth((state) => state.hydrated);
  const { t } = useTranslation('common');
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    PlayfairDisplay_600SemiBold,
  });
  useEffect(() => {
    void Promise.resolve(usePreferences.persist.rehydrate()).catch(() => usePreferences.setState({ hydrated: true }));
    void useAuth.getState().hydrate();
  }, []);
  useEffect(() => { void i18n.changeLanguage(locale); }, [locale]);
  useEffect(() => {
    focusManager.setEventListener((setFocused) => {
      setFocused(AppState.currentState === 'active');
      const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
      return () => subscription.remove();
    });
    return () => focusManager.setEventListener(() => undefined);
  }, []);
  const ready = (fontsLoaded || !!fontError) && preferencesHydrated && authHydrated;
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return null;
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;
  return <SafeAreaProvider><QueryClientProvider client={queryClient}>
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, primary: colors.accent,
      background: colors.background, card: colors.header, text: colors.text, border: colors.border } }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.header }, headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        headerShadowVisible: false, contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ title: t('categories') }} />
        <Stack.Screen name="product/[slug]" options={{ title: t('product') }} />
        <Stack.Screen name="auth/login" options={{ title: t('login') }} />
        <Stack.Screen name="auth/register" options={{ title: t('register') }} />
        <Stack.Screen name="auth/verify" options={{ title: t('verify') }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: t('forgotPassword') }} />
        <Stack.Screen name="auth/reset-password" options={{ title: t('forgotPassword') }} />
        <Stack.Screen name="reset-password" options={{ title: t('forgotPassword') }} />
        <Stack.Screen name="profile/edit" options={{ title: t('editProfile') }} />
        <Stack.Screen name="checkout/index" options={{ title: t('checkout') }} />
        <Stack.Screen name="orders/index" options={{ title: t('orders') }} />
        <Stack.Screen name="orders/[id]" options={{ title: t('order') }} />
        <Stack.Screen name="payment-return" options={{ title: t('order') }} />
        <Stack.Screen name="support" options={{ title: t('support') }} />
        <Stack.Screen name="+not-found" options={{ title: t('notFoundTitle') }} />
      </Stack>
    </ThemeProvider>
  </QueryClientProvider></SafeAreaProvider>;
}
