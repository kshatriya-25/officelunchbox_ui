/// <reference types="vite/client" />

/**
 * Typed environment variables.
 *
 * Declaring them here means a typo like `import.meta.env.VITE_API_URL` fails
 * typecheck instead of silently becoming `undefined` at runtime.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MEDIA_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_CURRENCY_SYMBOL?: string
  readonly VITE_LOCALE?: string
  readonly VITE_TIMEZONE?: string
  readonly VITE_WHATSAPP_CHANNEL_URL?: string
  readonly VITE_POLL_WINDOW_MS?: string
  readonly VITE_POLL_MENU_MS?: string
  readonly VITE_POLL_ADMIN_MS?: string
  readonly VITE_POLL_ORDERS_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
