import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError, errorMessage } from '@/api/client';
import { useMe } from '@/api/queries';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Access flow: signed out → onboarding/auth; signed in with an unconfirmed e-mail →
 * e-mail code; then without verified KYC → KYC; verified → the app. Stack.Protected redirects automatically when a
 * guard changes (sign in, KYC verified, sign out).
 */
function RootNavigator() {
  const { ready, signedIn, signOut } = useAuth();
  const me = useMe(signedIn);

  if (!ready || (signedIn && me.isPending)) {
    return (
      <View style={styles.center}>
        <Logo height={44} />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  if (signedIn && me.isError) {
    return (
      <View style={styles.center}>
        <Logo height={44} />
        <Text style={styles.error}>{errorMessage(me.error)}</Text>
        <Button label="Réessayer" onPress={() => void me.refetch()} />
        <Button label="Se déconnecter" variant="outline" onPress={() => void signOut()} />
      </View>
    );
  }

  const emailVerified = me.data?.emailVerified === true;
  const verified = emailVerified && me.data?.kycStatus === 'VERIFIED';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !emailVerified}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && emailVerified && !verified}>
        <Stack.Screen name="kyc" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && verified}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  error: { color: colors.danger, fontWeight: '700', textAlign: 'center' },
});
