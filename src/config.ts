/**
 * Every environment-dependent value in one place.
 *
 * Vite only exposes variables prefixed `VITE_`, and it inlines them at build
 * time — so these are baked into the bundle, not read at runtime. Never put a
 * secret here: anything in this file is readable by anyone who opens the app.
 *
 * Defaults assume the frontend is served from the same origin as the API
 * (Vite proxy in dev, a reverse proxy in production). Set the URLs explicitly
 * when the API lives on a different host.
 */

const env = import.meta.env

/** Trailing slashes double up when concatenated with a path. */
function trimEnd(value: string): string {
  return value.replace(/\/+$/, '')
}

function text(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

function ms(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  // A typo'd interval that parses as 0 would poll in a tight loop.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  /** Where the API lives. `/api` means "same origin as this page". */
  apiBaseUrl: trimEnd(text(env.VITE_API_BASE_URL, '/api')),

  /** Origin serving uploaded images. Empty means same origin as this page. */
  mediaBaseUrl: trimEnd(text(env.VITE_MEDIA_BASE_URL, '')),

  appName: text(env.VITE_APP_NAME, 'Mealhub'),
  currencySymbol: text(env.VITE_CURRENCY_SYMBOL, '₹'),

  /** Number, date and time formatting. */
  locale: text(env.VITE_LOCALE, 'en-IN'),
  /** Must match the backend's TIMEZONE, or "today" disagrees across the wire. */
  timezone: text(env.VITE_TIMEZONE, 'Asia/Kolkata'),

  whatsappChannelUrl: text(env.VITE_WHATSAPP_CHANNEL_URL, ''),

  /** How often each screen refetches, in milliseconds. */
  poll: {
    window: ms(env.VITE_POLL_WINDOW_MS, 60_000),
    menu: ms(env.VITE_POLL_MENU_MS, 45_000),
    admin: ms(env.VITE_POLL_ADMIN_MS, 30_000),
    orders: ms(env.VITE_POLL_ORDERS_MS, 45_000),
  },
} as const

/** Absolute URL for an API path: apiUrl('/admin/exports/...'). */
export function apiUrl(path: string): string {
  return `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * URL for an uploaded file.
 *
 * The API returns storage-relative paths like `uploads/menu/abc.jpg`. Absolute
 * URLs are passed through untouched, so switching to S3 or a CDN later needs
 * no change here.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${config.mediaBaseUrl}/${path.replace(/^\/+/, '')}`
}

// Catch the mistake that actually happens: pointing at another origin without
// telling the browser where the images are.
if (import.meta.env.DEV && /^https?:\/\//i.test(config.apiBaseUrl) && !config.mediaBaseUrl) {
  console.warn(
    '[config] VITE_API_BASE_URL is a different origin but VITE_MEDIA_BASE_URL is unset — ' +
      'uploaded images will be requested from this origin and 404.',
  )
}
