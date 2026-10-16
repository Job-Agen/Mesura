import { Image, StyleSheet, View } from 'react-native';
import type { MobileMoneyProvider } from '@mesura/shared';
import { colors, radius } from '@/theme/tokens';

/** Operators' own logos (see assets/payments/SOURCES.md): Flooz and Moov Money are Moov Africa's wallet. */
const LOGOS: Record<MobileMoneyProvider, number> = {
  TMONEY: require('../../assets/payments/mixx-by-yas.png'),
  FLOOZ: require('../../assets/payments/moov-africa.jpg'),
  MOOV_MONEY: require('../../assets/payments/moov-africa.jpg'),
};

/** The wallet's logo on a white tile, readable on light and dark backgrounds. */
export function ProviderLogo({ provider }: { provider: MobileMoneyProvider }) {
  return (
    <View style={styles.tile}>
      <Image source={LOGOS[provider]} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 72,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logo: { width: '100%', height: '100%' },
});
