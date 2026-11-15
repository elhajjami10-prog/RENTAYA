import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../lib/auth';
import { SearchProvider } from '../lib/search';
import { loadLanguage } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Loading } from '../components/ui';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });

function Nav() {
  const { t } = useTranslation();
  const { ready } = useAuth();
  if (!ready) return <Loading />;
  const title = (key: string) => ({ title: t(key) });
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { fontWeight: '700', color: colors.ink },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Rentaya' }} />
      <Stack.Screen name="auth/login" options={{ ...title('auth.login'), presentation: 'modal' }} />
      <Stack.Screen name="auth/register" options={{ ...title('auth.createAccount'), presentation: 'modal' }} />
      <Stack.Screen name="auth/forgot" options={title('auth.forgot')} />
      <Stack.Screen name="search" options={title('search.results')} />
      <Stack.Screen name="filters" options={{ ...title('filters.title'), presentation: 'modal' }} />
      <Stack.Screen name="car/[id]" options={{ title: '', headerTransparent: true }} />
      <Stack.Screen name="book/[carId]" options={title('checkout.title')} />
      <Stack.Screen name="booking/[id]/index" options={title('booking.title')} />
      <Stack.Screen name="booking/[id]/pay" options={title('payment.title')} />
      <Stack.Screen name="booking/[id]/inspection" options={title('inspection.title')} />
      <Stack.Screen name="booking/[id]/review" options={title('review.title')} />
      <Stack.Screen name="booking/[id]/extend" options={title('extend.title')} />
      <Stack.Screen name="booking/[id]/claim" options={title('claim.title')} />
      <Stack.Screen name="booking/[id]/charge" options={title('charges.add')} />
      <Stack.Screen name="chat/[id]" options={title('messages.conversation')} />
      <Stack.Screen name="user/[id]" options={title('profile.public')} />
      <Stack.Screen name="owner/car-form" options={title('carForm.title')} />
      <Stack.Screen name="owner/calendar" options={title('calendar.title')} />
      <Stack.Screen name="owner/earnings" options={title('earnings.title')} />
      <Stack.Screen name="owner/car-documents" options={title('carDocs.title')} />
      <Stack.Screen name="account/edit" options={title('profile.edit')} />
      <Stack.Screen name="account/verification" options={title('verification.title')} />
      <Stack.Screen name="account/phone" options={title('phone.title')} />
      <Stack.Screen name="account/favorites" options={title('favorites.title')} />
      <Stack.Screen name="account/wallet" options={title('wallet.title')} />
      <Stack.Screen name="account/payments" options={title('paymentsHistory.title')} />
      <Stack.Screen name="account/notifications" options={title('notifications.title')} />
      <Stack.Screen name="account/settings" options={title('settings.title')} />
      <Stack.Screen name="account/bank" options={title('bank.title')} />
      <Stack.Screen name="account/help" options={title('help.title')} />
      <Stack.Screen name="account/article" options={title('help.title')} />
      <Stack.Screen name="account/support" options={title('support.title')} />
      <Stack.Screen name="account/legal" options={title('legal.title')} />
      <Stack.Screen name="payment-result" options={{ title: '', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { loadLanguage().finally(() => setLangReady(true)); }, []);
  if (!langReady) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <SearchProvider>
            <StatusBar style="dark" />
            <Nav />
          </SearchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
