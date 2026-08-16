import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import { credentialsReceived, loggedOut } from './authSlice'
import type { RootState } from './index'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// A single in-flight refresh shared by every 401. Without this, a page that
// fires five queries at once would rotate the refresh token five times — and
// the backend treats reuse of a rotated token as a compromise, killing every
// session for that user.
let refreshInFlight: Promise<boolean> | null = null

async function refreshSession(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: object,
): Promise<boolean> {
  const state = api.getState() as RootState
  const refreshToken = state.auth.refreshToken
  if (!refreshToken) return false

  const result = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST', body: { refresh_token: refreshToken } },
    api,
    extraOptions,
  )

  if (result.data) {
    api.dispatch(credentialsReceived(result.data as never))
    return true
  }

  api.dispatch(loggedOut())
  return false
}

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401) {
    // Never try to refresh a failed refresh or a failed login — that recurses.
    const url = typeof args === 'string' ? args : args.url
    if (url.startsWith('/auth/refresh') || url.startsWith('/auth/login')) {
      return result
    }

    if (!refreshInFlight) {
      refreshInFlight = refreshSession(api, extraOptions).finally(() => {
        refreshInFlight = null
      })
    }

    if (await refreshInFlight) {
      result = await rawBaseQuery(args, api, extraOptions)
    }
  }

  return result
}

/** FastAPI puts human-readable messages in `detail`; validation errors in `errors`. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback

  const data = (error as FetchBaseQueryError)?.data as
    | { detail?: unknown; errors?: { field: string; message: string }[] }
    | undefined

  if (data?.errors?.length) {
    return data.errors.map((e) => `${e.field.replace('body.', '')}: ${e.message}`).join(', ')
  }
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) {
    return (data.detail as { msg?: string }[]).map((d) => d.msg ?? '').filter(Boolean).join(', ')
  }
  if ((error as FetchBaseQueryError)?.status === 'FETCH_ERROR') {
    return 'Cannot reach the server. Is the backend running?'
  }
  return fallback
}
