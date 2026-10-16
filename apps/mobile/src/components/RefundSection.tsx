import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatMoney,
  MOBILE_MONEY_PROVIDER_LABELS,
  refundDestinationSchema,
  type CardDto,
  type RefundDto,
} from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { useCardAction } from '@/api/queries';
import { formatDateTime, formatPhone } from '@/lib/format';
import { Button } from './Button';
import { RuleRow } from './RuleRow';
import { InfoNote, InlineError } from './States';
import { Surface } from './Surface';
import { TextField } from './TextField';

const STATUS_LABEL: Record<RefundDto['status'], string> = {
  PENDING: 'En cours',
  SENT: 'Envoyé',
  FAILED: 'Échec',
  ACTION_REQUIRED: 'Numéro Mixx by Yas requis',
};

/** Refund of an ended card's unspent balance, and the form to send it elsewhere when it cannot go back. */
export function RefundSection({ card }: { card: CardDto }) {
  const refund = card.refund;
  const [phone, setPhone] = useState('+228 ');
  const parsed = refundDestinationSchema.shape.phone.safeParse(phone);
  const redirect = useCardAction((p: string) => api.redirectRefund(card.id, { phone: p }));
  if (!refund) return null;

  const wallet = MOBILE_MONEY_PROVIDER_LABELS[refund.provider];
  const needsNumber = refund.status === 'ACTION_REQUIRED' || refund.status === 'FAILED';
  return (
    <Surface>
      <RuleRow
        label={refund.status === 'SENT' ? 'Solde remboursé' : 'Solde non dépensé'}
        value={formatMoney(refund.amount, refund.currency)}
        emphasis
      />
      <RuleRow label="Statut" value={STATUS_LABEL[refund.status]} separated />
      {refund.phone ? <RuleRow label={wallet} value={formatPhone(refund.phone)} separated /> : null}
      {refund.sentAt ? <RuleRow label="Envoyé" value={formatDateTime(refund.sentAt)} separated /> : null}

      {refund.status === 'PENDING' ? (
        <InfoNote>Le solde non dépensé est en route vers votre Mobile Money. Les frais de service ne sont pas remboursés.</InfoNote>
      ) : null}
      {refund.status === 'SENT' ? (
        <InfoNote tone="mint" icon="checkmark-circle-outline">Le solde non dépensé a été envoyé sur votre Mobile Money.</InfoNote>
      ) : null}
      {needsNumber ? (
        <View style={styles.form}>
          <InfoNote>
            {refund.status === 'FAILED'
              ? "L'envoi a échoué. Vérifiez le numéro et réessayez, ou indiquez un autre numéro Mixx by Yas."
              : `Les remboursements ne peuvent être envoyés que sur Mixx by Yas (ex-TMoney). Indiquez un numéro Mixx by Yas pour recevoir ${formatMoney(refund.amount, refund.currency)}.`}
          </InfoNote>
          <TextField
            label="Numéro Mixx by Yas"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={phone.length > 5 && !parsed.success ? parsed.error.issues[0]?.message : null}
          />
          <InlineError message={redirect.error ? errorMessage(redirect.error) : null} />
          <Button
            label="Recevoir sur Mixx by Yas"
            icon="arrow-down-circle-outline"
            disabled={!parsed.success}
            loading={redirect.isPending}
            onPress={() => parsed.success && redirect.mutate(parsed.data)}
          />
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, marginTop: 8 },
});
