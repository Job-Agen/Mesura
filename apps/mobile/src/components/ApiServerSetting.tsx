import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_API_URL, getApiBaseUrl, setApiBaseUrl } from '@/api/client';
import { apiUrlStorage } from '@/auth/token-storage';
import { colors, radius, type } from '@/theme/tokens';
import { Button } from './Button';
import { TextField } from './TextField';

/**
 * Sandbox-only: choose which Mesura API the app talks to, so an installed APK can
 * reach an API on the local network (http://192.168.x.x:3000) or a hosted one.
 */
export function ApiServerSetting() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getApiBaseUrl());
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<string | null>(null);
  const valid = /^https?:\/\/[^\s/]+/.test(value.trim());

  /** Keeps the new address only if it answers like the Mesura API (GET /health). */
  const save = async () => {
    const previous = getApiBaseUrl();
    setApiBaseUrl(value.trim());
    const candidate = getApiBaseUrl();
    setStatus('Vérification…');
    let message: string;
    try {
      const res = await fetch(`${candidate}/health`);
      const body: unknown = res.ok ? await res.json().catch(() => null) : null;
      if ((body as { service?: unknown } | null)?.service === 'mesura-api') {
        await apiUrlStorage.set(candidate);
        setCurrent(candidate);
        setStatus("Connecté à l'API Mesura.");
        return;
      }
      message = "Cette adresse répond, mais ce n'est pas l'API Mesura. Vérifiez l'adresse du serveur.";
    } catch {
      message = 'Impossible de joindre ce serveur depuis le téléphone.';
    }
    setApiBaseUrl(previous === DEFAULT_API_URL ? null : previous);
    setStatus(`${message} L'adresse précédente est conservée.`);
  };

  const reset = async () => {
    setApiBaseUrl(null);
    await apiUrlStorage.clear();
    setCurrent(DEFAULT_API_URL);
    setValue(DEFAULT_API_URL);
    setStatus(null);
  };

  return (
    <View style={styles.box}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8}>
        <Text style={type.caption}>
          Serveur API (sandbox) : <Text style={styles.url}>{current}</Text> · {open ? 'Masquer' : 'Modifier'}
        </Text>
      </Pressable>
      {open ? (
        <>
          <TextField
            label="Adresse du serveur API"
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.20:3000"
            hint="L'adresse IP locale de votre ordinateur et le port de l'API, ou une adresse https://."
          />
          <View style={styles.row}>
            <Button compact label="Enregistrer et tester" variant="secondary" disabled={!valid} onPress={() => void save()} />
            <Button compact label="Réinitialiser" variant="outline" onPress={() => void reset()} />
          </View>
          {status ? <Text style={type.caption}>{status}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  url: { fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
});
