import { router, useLocalSearchParams } from 'expo-router';
import { formatMoney } from '@mesura/shared';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { useCard, useCardAction, useTransactions } from '@/api/queries';
import { Button } from '@/components/Button';
import { CardRules } from '@/components/CardRules';
import { RefundSection } from '@/components/RefundSection';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { CardStatusBadge } from '@/components/StatusBadge';
import { ErrorState, InfoNote, InlineError, Skeleton } from '@/components/States';
import { Surface } from '@/components/Surface';
import { TransactionList } from '@/components/TransactionRow';
import { VirtualCard } from '@/components/VirtualCard';
import { confirmAction } from '@/lib/confirm';
import { type } from '@/theme/tokens';

const CLOSED_MESSAGE = {
  EXPIRED: 'Cette carte a expiré. Elle ne peut plus être utilisée.',
  TERMINATED: 'Cette carte est clôturée. Elle ne peut plus être utilisée.',
} as const;

export default function CardDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCard(id);
  const txs = useTransactions('ALL', id);
  const freeze = useCardAction(api.freezeCard);
  const unfreeze = useCardAction(api.unfreezeCard);
  const terminate = useCardAction(api.terminateCard);
  const c = card.data;
  const actionError = freeze.error ?? unfreeze.error ?? terminate.error;

  const onTerminate = async () => {
    // What the card still holds: the amount funded minus what was spent.
    const left = c ? Math.max(0, c.pricing.funding - c.policy.spentAmount) : 0;
    const ok = await confirmAction(
      'Clôturer cette carte ?',
      'La carte cessera de fonctionner immédiatement. Cette action est irréversible.' +
        (left > 0 ? ` Le solde non dépensé (${formatMoney(left, c?.policy.currency)}) vous sera remboursé sur Mobile Money.` : ''),
      'Clôturer',
    );
    if (ok) terminate.mutate(id);
  };

  return (
    <Screen
      title="Détails de la carte"
      onRefresh={() => void Promise.all([card.refetch(), txs.refetch()])}
      refreshing={card.isRefetching}
    >
      {card.isPending ? (
        <>
          <Skeleton height={210} />
          <Skeleton height={300} />
        </>
      ) : card.isError || !c ? (
        <ErrorState message={errorMessage(card.error)} onRetry={() => void card.refetch()} />
      ) : (
        <>
          <VirtualCard label={c.label} last4={c.last4} status={c.status} />
          <View style={styles.statusRow}>
            <Text style={type.body}>Statut</Text>
            <CardStatusBadge status={c.status} />
          </View>

          {c.status === 'FROZEN' ? <InfoNote>Cette carte est gelée. Tous les paiements sont bloqués jusqu'à ce que vous la dégeliez.</InfoNote> : null}
          {c.status === 'EXPIRED' || c.status === 'TERMINATED' ? <InfoNote>{CLOSED_MESSAGE[c.status]}</InfoNote> : null}
          <RefundSection card={c} />

          <Surface>
            <CardRules card={c} mode="live" />
          </Surface>

          {c.status === 'ACTIVE' || c.status === 'FROZEN' ? (
            <>
              <View style={styles.actions}>
                {c.status === 'ACTIVE' ? (
                  <Button compact label="Geler" variant="secondary" loading={freeze.isPending} onPress={() => freeze.mutate(id)} />
                ) : (
                  <Button compact label="Dégeler" variant="secondary" loading={unfreeze.isPending} onPress={() => unfreeze.mutate(id)} />
                )}
                <Button compact label="Gérer les règles" variant="neutral" onPress={() => router.push({ pathname: '/cards/[id]/rules', params: { id } })} />
                <Button compact label="Clôturer" variant="danger" loading={terminate.isPending} onPress={() => void onTerminate()} />
              </View>
              <InlineError message={actionError ? errorMessage(actionError) : null} />
            </>
          ) : null}

          {c.status === 'ACTIVE' || c.status === 'FROZEN' ? (
            <Button
              label="Voir les informations de la carte"
              icon="card-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/cards/[id]/details', params: { id } })}
            />
          ) : null}

          <Button
            label="Simuler un paiement en ligne"
            icon="flask-outline"
            variant="outline"
            onPress={() => router.push({ pathname: '/cards/[id]/simulate', params: { id } })}
          />

          <SectionHeader title="Activité de la carte" />
          {txs.isPending ? (
            <Skeleton height={60} />
          ) : (txs.data ?? []).length === 0 ? (
            <Text style={type.caption}>Aucune tentative de paiement pour l'instant.</Text>
          ) : (
            <TransactionList txs={txs.data ?? []} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  actions: { flexDirection: 'row', gap: 8 },
});
