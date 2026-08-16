import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Profile, TokenPair } from '../types'

const STORAGE_KEY = 'olb.auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: Profile | null
  /** False until we have tried to restore a session, so guards don't bounce
   *  an authenticated user to /login on first paint. */
  initialised: boolean
}

/**
 * Only tokens are restored — never the user.
 *
 * `user.role` decides whether the console renders. localStorage is fully
 * client-controlled, so a persisted role is a claim the user can edit. Starting
 * with `user: null` forces SessionLoader to fetch /auth/me, and the role always
 * comes from the server. The tokens are safe to persist: they are signed, and
 * the API verifies them on every request.
 */
function restore(): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accessToken: null, refreshToken: null, user: null }
    const parsed = JSON.parse(raw)
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: null,
    }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

function persist(state: AuthState) {
  try {
    if (!state.accessToken) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    // Tokens only. The user (and therefore the role) is deliberately not
    // persisted — see restore().
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    )
  } catch {
    // A full or blocked localStorage must not break the session in memory.
  }
}

const initialState: AuthState = { ...restore(), initialised: false }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<TokenPair>) {
      state.accessToken = action.payload.access_token
      state.refreshToken = action.payload.refresh_token
      if (action.payload.user) state.user = action.payload.user

      // Having a token is not the same as knowing who it belongs to. Claiming
      // to be initialised here would make SessionLoader skip /auth/me, leaving
      // `user` null forever — and every role-gated route would read as customer.
      // A mid-session token refresh carries no user but already has one, so it
      // stays initialised and never flashes a spinner.
      state.initialised = state.user !== null
      persist(state)
    },
    profileLoaded(state, action: PayloadAction<Profile>) {
      state.user = action.payload
      state.initialised = true
      persist(state)
    },
    sessionChecked(state) {
      state.initialised = true
    },
    loggedOut(state) {
      state.accessToken = null
      state.refreshToken = null
      state.user = null
      state.initialised = true
      persist(state)
    },
  },
})

export const { credentialsReceived, profileLoaded, sessionChecked, loggedOut } = authSlice.actions
export default authSlice.reducer
