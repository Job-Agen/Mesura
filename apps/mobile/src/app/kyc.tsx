import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { kycStartSchema } from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { keys, useMe } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoNote, InlineError } from '@/components/States';
import { Surface } from '@/components/Surface';
import { PhoneField } from '@/components/PhoneField';
import { TextField } from '@/components/TextField';
import { colors, type } from '@/theme/tokens';

type Field = 'firstName' | 'lastName' | 'dateOfBirth' | 'phone';

export default function Kyc() {
  const client = useQueryClient();
  const { signOut } = useAuth();
  const me = useMe();
  const kyc = useQuery({ queryKey: keys.kyc, queryFn: api.kyc });

  const [firstName, setFirstName] = useState(me.data?.name ?? '');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState(me.data?.phone ?? '');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const verify = useMutation({
    mutationFn: async () => {
      const parsed = kycStartSchema.safeParse({ firstName, lastName, dateOfBirth, phone, country: 'TG' });
      if (!parsed.success) {
        const next: Partial<Record<Field, string>> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as Field;
          next[key] ??= issue.message;
        }
        setErrors(next);
        return null;
      }
      setErrors({});
      await api.startKyc(parsed.data);
      return api.completeKyc();
    },
    onSuccess: async (profile) => {
      if (!profile) return;
      client.setQueryData(keys.kyc, profile);
      // When VERIFIED, refreshing /me flips the navigation guard to the app.
      await client.invalidateQueries({ queryKey: keys.me });
    },
  });

  const rejected = (verify.data ?? kyc.data)?.status === 'REJECTED';

  return (
    <Screen
      title="Vérifiez votre identité"
      back={false}
      footer={
        <>
          <Button label={rejected ? 'Réessayer' : 'Vérifier mon identité'} onPress={() => verify.mutate()} loading={verify.isPending} />
          <Button label="Se déconnecter" variant="outline" onPress={() => void signOut()} />
        </>
      }
    >
      <Text style={type.title}>Une vérification rapide avant votre première carte</Text>
      <Text style={[type.body, { color: colors.muted }]}>
        La réglementation nous oblige à savoir qui crée une carte. Cela prend moins d'une minute.
      </Text>

      {verify.isPending ? (
        <Surface style={styles.checking}>
          <ActivityIndicator color={colors.green} />
          <Text style={type.body}>Vérification de vos informations…</Text>
        </Surface>
      ) : null}

      {rejected ? (
        <InlineError message="Nous n'avons pas pu vérifier votre identité. Vous devez avoir 18 ans ou plus pour utiliser Mesura." />
      ) : null}

      <TextField label="Prénom" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoComplete="given-name" />
      <TextField label="Nom" value={lastName} onChangeText={setLastName} error={errors.lastName} autoComplete="family-name" />
      <TextField
        label="Date de naissance"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        error={errors.dateOfBirth}
        placeholder="AAAA-MM-JJ"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <PhoneField label="Numéro de mobile" value={phone} onChange={setPhone} error={errors.phone} />
      <View style={styles.country}>
        <Text style={type.label}>Pays</Text>
        <Text style={type.body}>🇹🇬  Togo</Text>
      </View>
      <InlineError message={verify.isError ? errorMessage(verify.error) : null} />
      <InfoNote tone="sandbox">
        Vérification sandbox : aucun document n'est envoyé ni conservé, et aucune vraie vérification d'identité n'est faite.
      </InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  checking: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  country: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
});
