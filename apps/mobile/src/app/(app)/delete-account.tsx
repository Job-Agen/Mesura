import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';
import { deleteAccountSchema } from '@mesura/shared';
import { errorMessage } from '@/api/client';
import { api } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoNote, InlineError } from '@/components/States';
import { TextField } from '@/components/TextField';
import { confirmAction } from '@/lib/confirm';
import { colors, type } from '@/theme/tokens';

/** Permanent account deletion (required by app stores for apps with sign-up). */
export default function DeleteAccount() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const valid = deleteAccountSchema.safeParse({ password }).success;

  const remove = useMutation({
    mutationFn: () => api.deleteAccount({ password }),
    onSuccess: () => void signOut(),
  });

  const onDelete = async () => {
    const ok = await confirmAction(
      'Supprimer définitivement votre compte ?',
      'Vos cartes, leurs règles et tout votre historique seront effacés. Cette action est irréversible.',
      'Supprimer',
    );
    if (ok) remove.mutate();
  };

  return (
    <Screen
      title="Supprimer mon compte"
      footer={
        <>
          <InlineError message={remove.isError ? errorMessage(remove.error) : null} />
          <Button label="Supprimer définitivement" variant="danger" disabled={!valid} loading={remove.isPending} onPress={() => void onDelete()} />
        </>
      }
    >
      <Text style={type.title}>Vous partez ?</Text>
      <Text style={[type.body, { color: colors.muted }]}>
        La suppression efface immédiatement votre compte, vos informations d'identité, toutes vos cartes, leurs règles,
        vos recharges et votre historique de paiements. Les cartes actives cessent de fonctionner. Seule une empreinte
        chiffrée de votre identité et de votre numéro est gardée, pour qu'un nouveau compte ne contourne pas les limites.
      </Text>
      <InfoNote>
        Vos cartes encore actives sont clôturées et leur solde non dépensé est renvoyé sur votre Mobile Money. Si une carte
        a été rechargée avec Flooz ou Moov Money, indiquez d'abord un numéro TMoney sur cette carte pour recevoir son solde.
      </InfoNote>
      <TextField
        label="Confirmez avec votre mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
    </Screen>
  );
}
