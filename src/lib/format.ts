import { config } from '../config'
/** Money arrives from the API as a decimal string; never parse it into a float
 *  for arithmetic — only for display. */
export function formatMoney(
  value: string | number | null | undefined,
  symbol = config.currencySymbol,
): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return `${symbol}0.00`
  return `${symbol}${amount.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(config.locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(config.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

/** Seconds -> "1:24:09" or "24:09". Used for the cutoff countdown. */
export function formatCountdown(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return '00:00'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Today in the business timezone, as the API expects it (YYYY-MM-DD). */
export function todayISO(): string {
    // en-CA purely because it formats as ISO; the zone is what matters.
  return new Date().toLocaleDateString('en-CA', { timeZone: config.timezone })
}

export const FOOD_TYPE_LABEL: Record<string, string> = {
  VEG: 'Vegetarian',
  NON_VEG: 'Non-Veg',
  EGG: 'Egg',
}

export const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  PACKED: 'Packed',
  DISPATCHED: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  FAILED: 'Payment failed',
}
