import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

/** Merchants' own icons (see assets/merchants/SOURCES.md), keyed by merchant slug. */
const LOGOS: Record<string, number> = {
  canva: require('../../assets/merchants/canva.png'),
  meta: require('../../assets/merchants/meta.png'),
  google: require('../../assets/merchants/google.png'),
  openai: require('../../assets/merchants/openai.png'),
  netflix: require('../../assets/merchants/netflix.png'),
  amazon: require('../../assets/merchants/amazon.png'),
};

/** Brand-coloured tiles with an initial, for merchants without a bundled logo. */
const TINTS: Record<string, { bg: string; fg: string }> = {
  canva: { bg: '#3B82F6', fg: '#FFFFFF' },
  meta: { bg: '#EAF1FF', fg: '#0866FF' },
  google: { bg: '#FFFFFF', fg: '#EA4335' },
  openai: { bg: '#101815', fg: '#FFFFFF' },
  netflix: { bg: '#141414', fg: '#E50914' },
  amazon: { bg: '#F5A623', fg: '#141414' },
};

/** The merchant's logo on a white tile, a letter tile for other merchants, a globe for "anywhere". */
export function MerchantAvatar({ name, slug, size = 40 }: { name: string | null; slug?: string | null; size?: number }) {
  const logo = name && slug ? LOGOS[slug.toLowerCase()] : undefined;
  if (logo) {
    return (
      <View style={[styles.avatar, styles.outlined, styles.logoTile, { width: size, height: size, borderRadius: size / 3.2, padding: size * 0.14 }]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const tint = (slug && TINTS[slug]) || { bg: colors.green, fg: colors.onDark };
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 3.2, backgroundColor: name ? tint.bg : colors.mint },
        name && tint.bg === '#FFFFFF' ? styles.outlined : null,
      ]}
    >
      {name ? (
        <Text style={[styles.letter, { color: tint.fg, fontSize: size * 0.46 }]}>{name.charAt(0).toUpperCase()}</Text>
      ) : (
        <Ionicons name="globe-outline" size={size * 0.5} color={colors.green} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  outlined: { borderWidth: 1, borderColor: colors.border },
  logoTile: { backgroundColor: '#FFFFFF' },
  logo: { width: '100%', height: '100%' },
  letter: { fontWeight: '900' },
});
