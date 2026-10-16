import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatDuration,
  formatMoney,
  FUNDING_PROVIDERS,
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
import { ProviderLogo } from '@/components/ProviderLogo';
import { PriceSummary } from '@/components/PriceSummary';
import { Screen } from '@/components/Screen';
import { ErrorState, InfoNote, InlineError, Skeleton } from '@/components/States';
import { Surface } from '@/components/Surface';
import { TextField } from '@/components/TextField';
import { formatPhone, paymentsLabel } from '@/lib/format';
import { radius, type } from '@/theme/tokens';

/** A line under each wallet's name, so people find it under the name they know. */
const PROVIDER_NOTE: Partial<Record<Provider, string>> = {
  TMONEY: 'Ex-TMoney',
  FLOOZ: 'Moov Money',
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
            {FUNDING_PROVIDERS.map((p) => (
              <OptionRow
                key={p}
                title={MOBILE_MONEY_PROVIDER_LABELS[p]}
                note={PROVIDER_NOTE[p]}
                dense
                selected={provider === p}
                onPress={() => setProvider(p)}
                leading={<ProviderLogo provider={p} />}
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
  flag: { fontSize: 20 },
});
