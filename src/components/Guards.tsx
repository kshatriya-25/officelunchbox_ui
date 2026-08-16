import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useGetProfileQuery } from '../store/api'
import { useAppDispatch, useAppSelector } from '../store'
import { profileLoaded, sessionChecked } from '../store/authSlice'
import { Spinner } from './ui'

/**
 * Restores the session on boot.
 *
 * A token in localStorage is a claim, not proof — it may be expired or revoked.
 * We verify it against /auth/me before letting guards act on it, otherwise a
 * stale token would render the admin shell for a second before bouncing.
 */
export function SessionLoader({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const { accessToken, initialised } = useAppSelector((state) => state.auth)

  const { data, isError, isSuccess, isLoading } = useGetProfileQuery(undefined, {
    skip: !accessToken || initialised,
  })

  useEffect(() => {
    if (!accessToken) {
      dispatch(sessionChecked())
    } else if (isSuccess && data) {
      dispatch(profileLoaded(data))
    } else if (isError) {
      // baseQuery has already cleared credentials if the refresh failed.
      dispatch(sessionChecked())
    }
  }, [accessToken, isSuccess, isError, data, dispatch])

  if (accessToken && !initialised && isLoading) {
    return <Spinner label="Restoring your session" />
  }

  return <>{children}</>
}

export function RequireAuth() {
  const location = useLocation()
  const { accessToken, initialised } = useAppSelector((state) => state.auth)

  if (!initialised) return <Spinner />
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />

  return <Outlet />
}

export function RequireStaff() {
  const { user, accessToken, initialised } = useAppSelector((state) => state.auth)

  if (!initialised) return <Spinner />
  if (!accessToken) return <Navigate to="/login" replace />
  if (user?.role !== 'admin' && user?.role !== 'ops') return <Navigate to="/menu" replace />

  return <Outlet />
}

export function RequireAdmin() {
  const { user, accessToken, initialised } = useAppSelector((state) => state.auth)

  if (!initialised) return <Spinner />
  if (!accessToken) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/admin" replace />

  return <Outlet />
}
