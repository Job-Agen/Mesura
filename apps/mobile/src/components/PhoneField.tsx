import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { TextField } from './TextField';

const PREFIX = '+228';
const DIGITS = 8;

/** The 8 local digits of a Togolese number, from whatever was typed or pasted (+228…, 00228…, spaces, dashes). */
export function localDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length > DIGITS && d.startsWith('00228')) d = d.slice(5);
  else if (d.length > DIGITS && d.startsWith('228')) d = d.slice(3);
  return d.slice(0, DIGITS);
}

/** "90123456" → "90 12 34 56" (pairs, as Togolese numbers are read). */
const group = (d: string) => d.replace(/(\d{2})(?=\d)/g, '$1 ');

interface PhoneFieldProps {
  label: string;
  /** Full number, "+228XXXXXXXX", or "" while empty. */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  strongLabel?: boolean;
}

/**
 * Togolese mobile number: the +228 prefix is fixed, the person types only the 8 digits, shown in pairs.
 * The value handed back is the full number, ready for the API (togoPhoneSchema).
 */
export function PhoneField({ label, value, onChange, error, hint = '8 chiffres, ex. 90 12 34 56', strongLabel }: PhoneFieldProps) {
  const [touched, setTouched] = useState(false);
  const digits = localDigits(value);
  const incomplete = digits.length > 0 && digits.length < DIGITS;

  return (
    <TextField
      label={label}
      strongLabel={strongLabel}
      leading={
        <View style={styles.prefix}>
          <Text style={styles.flag}>🇹🇬</Text>
          <Text style={styles.code}>{PREFIX}</Text>
          <View style={styles.divider} />
        </View>
      }
      value={group(digits)}
      onChangeText={(text) => {
        const next = localDigits(text);
        onChange(next ? `${PREFIX}${next}` : '');
      }}
      onBlur={() => setTouched(true)}
      placeholder="90 12 34 56"
      keyboardType="number-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      error={error ?? (touched && incomplete ? `Il manque ${DIGITS - digits.length} chiffre${DIGITS - digits.length > 1 ? 's' : ''}` : null)}
      hint={hint}
    />
  );
}

const styles = StyleSheet.create({
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { fontSize: 20 },
  code: { fontSize: 16, fontWeight: '700', color: colors.text },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginLeft: 4 },
});
