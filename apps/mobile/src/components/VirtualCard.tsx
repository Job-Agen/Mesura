import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { CardStatus } from '@mesura/shared';
import { STATUS_LABEL } from '@/lib/format';
import { colors, radius } from '@/theme/tokens';
import { Wordmark } from './Logo';

interface VirtualCardProps {
  label: string;
  /** Sandbox masked representation only. null while the card is not issued yet. */
  last4: string | null;
  status?: CardStatus;
  /** Compact variant for illustrations (onboarding). */
  small?: boolean;
  style?: ViewStyle;
}

/**
 * Masked card visual. Mesura never has — and therefore never shows — a real PAN or CVV.
 * No card network logo (Visa, Mastercard) until a licensed issuer issues the cards: only it may show one.
 */
export function VirtualCard({ label, last4, status, small, style }: VirtualCardProps) {
  const inactive = status && status !== 'ACTIVE' && status !== 'PENDING_FUNDING';
  return (
    <View
      style={[styles.card, small && styles.small, inactive && styles.inactive, style]}
      accessible
      accessibilityLabel={`${label}, carte virtuelle se terminant par ${last4 ?? 'pas encore émise'}${status ? `, ${STATUS_LABEL[status]}` : ''}`}
    >
      <View style={[styles.facet, styles.facetA]} />
      <View style={[styles.facet, styles.facetB]} />
      <View style={styles.top}>
        <Wordmark height={small ? 18 : 22} />
        <Text style={[styles.network, small && { fontSize: 9 }]}>CARTE VIRTUELLE</Text>
      </View>
      <View style={styles.bottom}>
        {small ? null : (
          <Text style={styles.label} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        )}
        <View style={styles.numberRow}>
          <Text style={[styles.number, small && { fontSize: 15 }]}>
            {small ? '•••• ' : '•••• •••• '}
            {last4 ?? '••••'}
          </Text>
          {inactive && status ? <Text style={styles.stamp}>{STATUS_LABEL[status].toUpperCase()}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2.1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.forestDeep,
    paddingHorizontal: 22,
    paddingVertical: 18,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#04291F',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  small: { aspectRatio: 1.6, paddingHorizontal: 18, paddingVertical: 16 },
  inactive: { backgroundColor: '#3F4A45' },
  facet: { position: 'absolute', backgroundColor: colors.accent, borderRadius: 40 },
  facetA: { width: 220, height: 220, right: -70, bottom: -120, opacity: 0.22, transform: [{ rotate: '35deg' }] },
  facetB: { width: 140, height: 140, right: 30, bottom: -70, opacity: 0.14, transform: [{ rotate: '20deg' }] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  network: { color: colors.onDarkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  bottom: { gap: 6 },
  label: { color: colors.onDarkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  numberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { color: colors.onDark, fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  stamp: { color: colors.onDark, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});
