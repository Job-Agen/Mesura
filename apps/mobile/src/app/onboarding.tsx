import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { VirtualCard } from '@/components/VirtualCard';
import { colors, type } from '@/theme/tokens';

const BENEFITS: { icon: ComponentProps<typeof Ionicons>['name']; text: string }[] = [
  { icon: 'options-outline', text: 'Vous fixez les limites' },
  { icon: 'shield-checkmark-outline', text: 'Vous gardez le contrôle' },
  { icon: 'lock-closed-outline', text: 'Payez en ligne en toute confiance' },
];

export default function Onboarding() {
  return (
    <Screen
      back={false}
      footer={
        <>
          <Button label="Commencer" icon="arrow-forward" onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })} />
          <Button label="J'ai déjà un compte" variant="link" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} />
        </>
      }
    >
      <Logo height={30} />
      <View style={styles.intro}>
        <Text style={[type.display, styles.center]}>Votre argent.{'\n'}Vos règles.</Text>
        <Text style={[type.body, styles.center, { color: colors.muted }]}>
          Créez des cartes virtuelles éphémères pour vos paiements en ligne : elles s'éteignent toutes seules.
        </Text>
      </View>

      <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.blob} />
        <View style={[styles.cardBack, { transform: [{ rotate: '-14deg' }] }]} />
        <VirtualCard label="Carte Canva" last4="4821" small style={styles.cardFront} />
      </View>

      <View style={styles.benefits}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name={b.icon} size={16} color={colors.onDark} />
            </View>
            <Text style={type.body}>{b.text}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, alignItems: 'center' },
  center: { textAlign: 'center' },
  illustration: { height: 210, alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', width: '100%', height: 150, borderRadius: 120, backgroundColor: colors.mint, opacity: 0.7 },
  cardBack: {
    position: 'absolute',
    width: 230,
    height: 144,
    borderRadius: 20,
    backgroundColor: colors.accent,
    opacity: 0.35,
    left: '14%',
  },
  cardFront: { width: 250, transform: [{ rotate: '-8deg' }] },
  benefits: { gap: 14, alignSelf: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
