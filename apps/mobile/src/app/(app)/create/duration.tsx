import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DURATION_PRESETS, formatDuration, formatMoney, MAX_DURATION_MINUTES } from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { Button } from '@/components/Button';
import { OptionRow } from '@/components/OptionRow';
import { RuleRow } from '@/components/RuleRow';
import { Screen } from '@/components/Screen';
import { InfoNote, InlineError } from '@/components/States';
import { StepHeader } from '@/components/StepHeader';
import { TextField } from '@/components/TextField';
import { useCreateCard } from '@/features/create-card/CreateCardContext';
import { paymentsLabel } from '@/lib/format';
import { colors, radius, type } from '@/theme/tokens';

const MAX_CUSTOM_HOURS = MAX_DURATION_MINUTES / 60;

export default function Duration() {
  const { draft, update, toInput } = useCreateCard();
  const isPreset = DURATION_PRESETS.some((p) => p.minutes === draft.durationMinutes);
  const [custom, setCustom] = useState(!isPreset);
  const [hours, setHours] = useState(isPreset ? '' : String(Math.round(draft.durationMinutes / 60)));
  const customHours = Number(hours);
  const customValid = Number.isInteger(customHours) && customHours >= 1 && customHours <= MAX_CUSTOM_HOURS;

  const createDraft = useMutation({
    mutationFn: () => api.createDraft(toInput()),
    onSuccess: (card) => router.push({ pathname: '/cards/[id]/review', params: { id: card.id } }),
  });

  const setCustomHours = (value: string) => {
    setHours(value.replace(/\D/g, ''));
    const h = Number(value);
    if (Number.isInteger(h) && h >= 1 && h <= MAX_CUSTOM_HOURS) update({ durationMinutes: h * 60 });
  };

  return (
    <Screen
      title="Créer une carte sécurisée"
      footer={
        <>
          <InlineError message={createDraft.isError ? errorMessage(createDraft.error) : null} />
          <Button
            label="Vérifier la carte"
            icon="arrow-forward"
            disabled={custom && !customValid}
            loading={createDraft.isPending}
            onPress={() => createDraft.mutate()}
          />
        </>
      }
    >
      <StepHeader step={4} question="Combien de temps doit-elle rester active ?" />
      <InfoNote tone="plain" icon="time-outline">
        À la fin de cette durée, la carte s'éteint toute seule. Pour un abonnement, choisissez 30 jours et créez une
        nouvelle carte chaque mois.
      </InfoNote>
      <View style={styles.options}>
        {DURATION_PRESETS.map((p) => (
          <OptionRow
            key={p.minutes}
            title={p.label}
            radio="left"
            dense
            selected={!custom && draft.durationMinutes === p.minutes}
            onPress={() => {
              setCustom(false);
              update({ durationMinutes: p.minutes });
            }}
          />
        ))}
        <OptionRow title="Personnalisée" radio="left" dense selected={custom} onPress={() => setCustom(true)} />
      </View>
      {custom ? (
        <TextField
          label="Heures"
          value={hours}
          onChangeText={setCustomHours}
          keyboardType="number-pad"
          placeholder="ex. 48"
          error={hours && !customValid ? `Entre 1 et ${MAX_CUSTOM_HOURS} heures` : null}
        />
      ) : null}

      <View style={styles.summary}>
        <View style={styles.summaryHead}>
          <Text style={type.heading}>Les règles de votre carte</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.dismissAll()}>
            <Text style={styles.edit}>Modifier</Text>
          </Pressable>
        </View>
        <RuleRow icon="wallet-outline" label="Plafond" value={formatMoney(draft.maxAmount)} />
        <RuleRow
          icon="storefront-outline"
          label="Marchand"
          value={draft.restrictToMerchant && draft.merchant ? draft.merchant.name : 'Partout'}
        />
        <RuleRow icon="repeat-outline" label="Paiements" value={paymentsLabel(draft.maxTransactionCount)} />
        <RuleRow icon="time-outline" label="Durée" value={formatDuration(draft.durationMinutes)} />
      </View>
      <InfoNote tone="plain" icon="lock-closed-outline">
        Cette carte ne pourra pas dépenser au-delà de ces règles.
      </InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: 8 },
  summary: { backgroundColor: colors.mint, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 14 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  edit: { color: colors.green, fontWeight: '800' },
});
