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

function restore(): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accessToken: null, refreshToken: null, user: null }
    const parsed = JSON.parse(raw)
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null,
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
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
