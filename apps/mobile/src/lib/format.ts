import type { CardDto, CardStatus } from '@mesura/shared';

const pad = (n: number) => n.toString().padStart(2, '0');
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** "Aujourd'hui à 10:42" / "Hier à 09:18" / "12 janv. à 09:18" */
export function formatDateTime(isoDate: string, now = new Date()): string {
  const d = new Date(isoDate);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return `Aujourd'hui à ${time}`;
  if (d.getTime() >= startOfToday - 86_400_000) return `Hier à ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} à ${time}`;
}

/** "8 oct. 2026", or "8 oct. 2026 à 14:05" with the time. No dependency on the device's Intl support. */
export function formatDate(isoDate: string, withTime = false): string {
  const d = new Date(isoDate);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${date} à ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** "Expire dans 42 min" / "Expire dans 23 h 12" / "Expire dans 6 jours" / "Expirée" */
export function formatTimeLeft(isoDate: string, now = Date.now()): string {
  const ms = new Date(isoDate).getTime() - now;
  if (ms <= 0) return 'Expirée';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Expire dans ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Expire dans ${hours} h ${pad(minutes % 60)}`;
  return `Expire dans ${Math.floor(hours / 24)} jours`;
}

export function greeting(now = new Date()): string {
  return now.getHours() < 18 ? 'Bonjour,' : 'Bonsoir,';
}

export function paymentsLabel(max: number | null): string {
  if (max === null) return "Jusqu'à expiration";
  return `${max} paiement${max > 1 ? 's' : ''}`;
}

export function paymentsUsage(card: Pick<CardDto, 'policy'>): string {
  const { maxTransactionCount, currentTransactionCount } = card.policy;
  if (maxTransactionCount === null) return `${currentTransactionCount} effectué(s) · illimité`;
  const left = Math.max(0, maxTransactionCount - currentTransactionCount);
  return `${left} sur ${maxTransactionCount} restant${left > 1 ? 's' : ''}`;
}

export const STATUS_LABEL: Record<CardStatus, string> = {
  PENDING_FUNDING: 'En attente de recharge',
  ACTIVE: 'Active',
  FROZEN: 'Gelée',
  EXPIRED: 'Expirée',
  TERMINATED: 'Clôturée',
};

export function merchantLabel(card: Pick<CardDto, 'policy'>): string {
  return card.policy.merchantRestriction ? `${card.policy.merchantRestriction.name} uniquement` : 'Partout';
}

/** "+22890123456" → "+228 90 12 34 56"; anything else is returned as is. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('228')) return raw;
  const n = digits.slice(3);
  return `+228 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)}`;
}
