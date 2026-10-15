import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatDuration,
  formatMoney,
  fundCardSchema,
  MOBILE_MONEY_PROVIDER_LABELS,
  MobileMoneyProvider,
  type MobileMoneyProvider as Provider,
} from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { useCard, useMe } from '@/api/queries';
import { Button } from '@/components/Button';
import { MerchantAvatar } from '@/components/MerchantAvatar';
import { OptionRow } from '@/components/OptionRow';
import { PriceSummary } from '@/components/PriceSummary';
import { Screen } from '@/components/Screen';
import { ErrorState, InfoNote, InlineError, Skeleton } from '@/components/States';
import { Surface } from '@/components/Surface';
import { TextField } from '@/components/TextField';
import { formatPhone, paymentsLabel } from '@/lib/format';
import { radius, type } from '@/theme/tokens';

const PROVIDER_TINT: Record<Provider, { bg: string; fg: string }> = {
  TMONEY: { bg: '#FFCC00', fg: '#141414' },
  FLOOZ: { bg: '#141B2D', fg: '#FFCC00' },
  MOOV_MONEY: { bg: '#E8F0FB', fg: '#0055A5' },
};

export default function Fund() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCard(id);
  const me = useMe();
  const [provider, setProvider] = useState<Provider>(MobileMoneyProvider.TMONEY);
  const [phone, setPhone] = useState(me.data?.phone ? formatPhone(me.data.phone) : '+228 90 12 34 56');
  const parsedPhone = fundCardSchema.shape.phone.safeParse(phone);

  const fund = useMutation({
    mutationFn: () => api.fundCard(id, { provider, phone }),
    onSuccess: (funding) => router.replace({ pathname: '/funding/[id]', params: { id: funding.id } }),
  });

  const c = card.data;
  return (
    <Screen
      title="Rechargez votre carte"
      footer={
        c ? (
          <>
            <InlineError message={fund.isError ? errorMessage(fund.error) : null} />
            <Button
              label={`Payer ${formatMoney(c.pricing.total, c.pricing.currency)}`}
              disabled={!parsedPhone.success}
              loading={fund.isPending}
              onPress={() => fund.mutate()}
            />
          </>
        ) : null
      }
    >
      {card.isPending ? (
        <Skeleton height={320} />
      ) : card.isError || !c ? (
        <ErrorState message={errorMessage(card.error)} onRetry={() => void card.refetch()} />
      ) : (
        <>
          <Surface style={styles.summary}>
            <MerchantAvatar name={c.policy.merchantRestriction?.name ?? null} slug={c.policy.merchantRestriction?.slug} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.body}>{c.label}</Text>
              <Text style={styles.summaryAmount}>{formatMoney(c.policy.maxAmount)}</Text>
              <Text style={type.caption}>
                {paymentsLabel(c.policy.maxTransactionCount)} · {formatDuration(c.policy.durationMinutes)}
              </Text>
            </View>
          </Surface>

          <Text style={type.heading}>Choisissez comment payer</Text>
          <View style={styles.providers}>
            {(Object.keys(MOBILE_MONEY_PROVIDER_LABELS) as Provider[]).map((p) => (
              <OptionRow
                key={p}
                title={MOBILE_MONEY_PROVIDER_LABELS[p]}
                dense
                selected={provider === p}
                onPress={() => setProvider(p)}
                leading={
                  <View style={[styles.logo, { backgroundColor: PROVIDER_TINT[p].bg }]}>
                    <Text style={[styles.logoText, { color: PROVIDER_TINT[p].fg }]}>{MOBILE_MONEY_PROVIDER_LABELS[p].charAt(0)}</Text>
                  </View>
                }
              />
            ))}
          </View>

          <TextField
            label="Numéro de téléphone"
            strongLabel
            leading={<Text style={styles.flag}>🇹🇬</Text>}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={phone.length > 5 && !parsedPhone.success ? parsedPhone.error.issues[0]?.message : null}
          />

          <View>
            <PriceSummary pricing={c.pricing} />
          </View>
          <InfoNote tone="plain" icon="lock-closed-outline">
            Le paiement est traité de manière sécurisée par notre partenaire. Mesura ne vous demande jamais votre code PIN.
          </InfoNote>
          <InfoNote tone="sandbox">Sandbox : aucune vraie demande Mobile Money n'est envoyée et rien n'est débité.</InfoNote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryAmount: { ...type.heading, fontSize: 19 },
  providers: { gap: 8 },
  logo: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 16, fontWeight: '900' },
  flag: { fontSize: 20 },
});
