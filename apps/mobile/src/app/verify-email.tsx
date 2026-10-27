import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { verifyEmailSchema } from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { keys, useMe } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoNote, InlineError } from '@/components/States';
import { TextField } from '@/components/TextField';
import { colors, type } from '@/theme/tokens';

/**
 * Confirms the address of a new account: a 6-digit code is e-mailed when the screen opens,
 * and entering it lets the user continue to identity verification.
 */
export default function VerifyEmail() {
  const client = useQueryClient();
  const { signOut } = useAuth();
  const me = useMe();
  const [code, setCode] = useState('');
  const check = verifyEmailSchema.safeParse({ code });

  const sendCode = useMutation({ mutationFn: api.sendEmailCode });
  const verify = useMutation({
    mutationFn: () => api.verifyEmail({ code }),
    // The confirmed user flips the navigation guard to identity verification.
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });

  // One code per visit to the screen (not on every re-render).
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    sendCode.mutate();
  }, [sendCode]);

  const sandboxCode = sendCode.data?.sandboxCode;

  return (
    <Screen
      title="Confirmez votre e-mail"
      back={false}
      footer={
        <>
          <InlineError message={verify.isError ? errorMessage(verify.error) : null} />
          <Button label="Confirmer" disabled={!check.success} loading={verify.isPending} onPress={() => verify.mutate()} />
          <Button
            label="Renvoyer un code"
            variant="link"
            loading={sendCode.isPending}
            onPress={() => {
              setCode('');
              sendCode.mutate();
            }}
          />
          <Button label="Se déconnecter" variant="outline" onPress={() => void signOut()} />
        </>
      }
    >
      <Text style={type.title}>Vérifiez vos e-mails</Text>
      <Text style={[type.body, { color: colors.muted }]}>
        Nous avons envoyé un code à 6 chiffres à {me.data?.email ?? 'votre adresse'}. Il est valable 15 minutes. Pensez à regarder
        dans les courriers indésirables (spam).
      </Text>
      <TextField
        label="Code à 6 chiffres"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        onSubmitEditing={() => check.success && verify.mutate()}
      />
      <InlineError message={sendCode.isError ? errorMessage(sendCode.error) : null} />
      {sandboxCode ? (
        <InfoNote tone="sandbox">{`Version de démonstration : l'envoi d'e-mails n'est pas encore activé. Votre code : ${sandboxCode}`}</InfoNote>
      ) : null}
      <InfoNote>
        Une erreur dans l'adresse ? Déconnectez-vous et créez votre compte avec la bonne adresse. Mesura ne vous demandera jamais ce
        code par téléphone.
      </InfoNote>
    </Screen>
  );
}
