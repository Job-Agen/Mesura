import { Ionicons } from '@expo/vector-icons';
import type { CardSecretsDto } from '@mesura/shared';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { useCard } from '@/api/queries';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorState, InfoNote, InlineError, Skeleton } from '@/components/States';
import { Surface } from '@/components/Surface';
import { VirtualCard } from '@/components/VirtualCard';
import { colors, radius, type } from '@/theme/tokens';

/** How long the details stay on screen before they are hidden again. */
const VISIBLE_SECONDS = 30;

const group = (number: string) => number.replace(/(\d{4})(?=\d)/g, '$1 ');
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Asks for the phone's fingerprint, face or screen lock (PIN, pattern). A phone with no lock at
 * all has nothing to ask for; the API still requires the signed-in session.
 */
async function confirmOwner(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirmez pour afficher votre carte',
    cancelLabel: 'Annuler',
  });
  return result.success;
}

export default function CardDetailsReveal() {
  usePreventScreenCapture();
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useCard(id);
  const [secrets, setSecrets] = useState<CardSecretsDto | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const hide = () => {
    setSecrets(null);
    setSecondsLeft(0);
  };

  // Count down while visible, then hide.
  useEffect(() => {
    if (!secrets) return;
    if (secondsLeft <= 0) return hide();
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secrets, secondsLeft]);

  // Never leave the details on screen when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state !== 'active' && hide());
    return () => sub.remove();
  }, []);

  const reveal = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!(await confirmOwner())) {
        setError("Vérification annulée. Les informations n'ont pas été affichées.");
        return;
      }
      setSecrets(await api.revealCard(id));
      setSecondsLeft(VISIBLE_SECONDS);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (field: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(field);
    setTimeout(() => setCopied((c) => (c === field ? null : c)), 2000);
  };

  const c = card.data;
  return (
    <Screen title="Informations de la carte">
      {card.isPending ? (
        <Skeleton height={210} />
      ) : card.isError || !c ? (
        <ErrorState message={errorMessage(card.error)} onRetry={() => void card.refetch()} />
      ) : (
        <>
          <VirtualCard label={c.label} last4={c.last4} status={c.status} />

          {secrets ? (
            <>
              {secrets.demo ? (
                <InfoNote tone="sandbox" icon="flask-outline">
                  Carte de démonstration : aucun marchand n'accepte ce numéro. Pour essayer vos règles, utilisez « Simuler un paiement ».
                </InfoNote>
              ) : null}
              <Surface>
                <Field label="Numéro de carte" value={group(secrets.number)} copied={copied === 'number'} onCopy={() => void copy('number', secrets.number)} mono />
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Field
                      label="Expiration"
                      value={`${pad2(secrets.expiryMonth)}/${String(secrets.expiryYear).slice(-2)}`}
                      copied={copied === 'expiry'}
                      onCopy={() => void copy('expiry', `${pad2(secrets.expiryMonth)}/${String(secrets.expiryYear).slice(-2)}`)}
                      mono
                    />
                  </View>
                  <View style={styles.half}>
                    <Field label="CVV" value={secrets.cvv} copied={copied === 'cvv'} onCopy={() => void copy('cvv', secrets.cvv)} mono />
                  </View>
                </View>
                {secrets.holderName ? (
                  <Field label="Titulaire" value={secrets.holderName} copied={copied === 'holder'} onCopy={() => void copy('holder', secrets.holderName)} />
                ) : null}
              </Surface>
              <Text style={[type.caption, styles.center]}>Masquage automatique dans {secondsLeft} s</Text>
              <Button label="Masquer maintenant" variant="outline" icon="eye-off-outline" onPress={hide} />
            </>
          ) : (
            <>
              <InfoNote icon="lock-closed-outline">
                Votre numéro de carte, sa date d'expiration et son CVV s'affichent pendant 30 secondes, après vérification de votre
                identité sur ce téléphone. Ne les communiquez à personne : Mesura ne vous les demandera jamais.
              </InfoNote>
              <InlineError message={error} />
              <Button label="Afficher les informations" icon="eye-outline" loading={loading} onPress={() => void reveal()} />
            </>
          )}
          <Button label="Retour à la carte" variant="link" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

function Field({ label, value, onCopy, copied, mono }: { label: string; value: string; onCopy: () => void; copied: boolean; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text selectable={false} style={[styles.value, mono && styles.mono]}>
          {value}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Copier ${label.toLowerCase()}`} hitSlop={10} onPress={onCopy} style={styles.copy}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.green} />
          <Text style={styles.copyText}>{copied ? 'Copié' : 'Copier'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  field: { gap: 4, paddingVertical: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  value: { ...type.heading, flexShrink: 1 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.mint },
  copyText: { fontSize: 12, fontWeight: '700', color: colors.green },
  center: { textAlign: 'center' },
});
