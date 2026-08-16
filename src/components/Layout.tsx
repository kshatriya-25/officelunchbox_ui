import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useGetWindowQuery, useLogoutMutation } from '../store/api'
import { useAppDispatch, useAppSelector } from '../store'
import { loggedOut } from '../store/authSlice'
import { formatCountdown, formatTime } from '../lib/format'
import { Icon } from './ui'

/**
 * Live cutoff countdown.
 *
 * The server hands us `seconds_to_cutoff` and we tick locally, refetching every
 * 60s. Counting down from a server-supplied number rather than comparing clocks
 * means a customer with a skewed device clock still sees the real deadline.
 */
function useCountdown(seconds: number | null | undefined) {
  const [remaining, setRemaining] = useState(seconds ?? 0)

  useEffect(() => {
    setRemaining(seconds ?? 0)
  }, [seconds])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [remaining > 0])

  return remaining
}

function WindowPill() {
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 60_000 })
  const remaining = useCountdown(window?.seconds_to_cutoff)

  if (!window) return null

  if (!window.is_open) {
    return (
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name="schedule" className="text-[16px]" />
        <span className="text-label-md">{window.reason ?? 'Orders closed'}</span>
      </div>
    )
  }

  // Under 30 minutes the deadline stops being background information.
  const urgent = remaining > 0 && remaining < 1800

  return (
    <div className={`flex items-center gap-2 ${urgent ? 'text-error' : 'text-on-surface-variant'}`}>
      <Icon name="schedule" className="text-[16px]" />
      <span className="text-label-md tabular">
        {urgent ? (
          <>Closes in {formatCountdown(remaining)}</>
        ) : (
          <>Closes {formatTime(window.cutoff_at)}</>
        )}
      </span>
    </div>
  )
}

const NAV_LINK =
  'text-label-lg transition-colors hover:text-primary'

export default function Layout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user, refreshToken } = useAppSelector((state) => state.auth)
  const cartCount = useAppSelector((state) =>
    state.cart.lines.reduce((sum, line) => sum + line.quantity, 0),
  )
  const [logout] = useLogoutMutation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isStaff = user?.role === 'admin' || user?.role === 'ops'

  async function handleLogout() {
    // Revoke server-side, but never block the UI on it — a failed revoke must
    // not leave the user stuck in a session they asked to end.
    if (refreshToken) {
      try {
        await logout({ refresh_token: refreshToken }).unwrap()
      } catch {
        /* ignore */
      }
    }
    dispatch(loggedOut())
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-outline-variant/40 bg-surface/90 backdrop-blur-md">
        <div className="page flex h-20 items-center justify-between gap-4">
          <Link to="/menu" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
              <Icon name="lunch_dining" className="text-[22px] text-tertiary-fixed-dim" />
            </span>
            <span className="font-display text-headline-md tracking-tight text-primary">
              Mealhub
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <NavLink
              to="/menu"
              className={({ isActive }) =>
                `${NAV_LINK} ${isActive ? 'font-bold text-secondary' : 'text-on-surface-variant'}`
              }
            >
              Menu
            </NavLink>
            <NavLink
              to="/orders"
              className={({ isActive }) =>
                `${NAV_LINK} ${isActive ? 'font-bold text-secondary' : 'text-on-surface-variant'}`
              }
            >
              My Orders
            </NavLink>
            <NavLink
              to="/bulk-orders"
              className={({ isActive }) =>
                `${NAV_LINK} ${isActive ? 'font-bold text-secondary' : 'text-on-surface-variant'}`
              }
            >
              Bulk Orders
            </NavLink>
            {isStaff ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `${NAV_LINK} ${isActive ? 'font-bold text-secondary' : 'text-on-surface-variant'}`
                }
              >
                Kitchen Hub
              </NavLink>
            ) : null}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden flex-col items-end border-r border-outline-variant pr-4 xl:flex">
              {user?.default_location_name ? (
                <div className="flex items-center gap-1.5 text-secondary">
                  <Icon name="location_on" className="text-[16px]" />
                  <span className="text-label-md font-semibold uppercase tracking-wider">
                    Delivering to: {user.default_location_name}
                  </span>
                </div>
              ) : null}
              <WindowPill />
            </div>

            <Link
              to="/checkout"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant hover:bg-surface-container"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <Icon name="shopping_cart" className="text-[20px] text-primary" />
              {cartCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-label-md font-bold text-on-secondary">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <Icon name="person" className="text-[18px] text-on-primary" />
              </button>

              {menuOpen ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg">
                    <div className="border-b border-outline-variant/60 px-4 py-3">
                      <p className="truncate text-body-md font-semibold text-primary">{user?.name}</p>
                      <p className="truncate text-label-md text-on-surface-variant">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-body-md hover:bg-surface-container"
                    >
                      <Icon name="settings" className="text-[18px]" /> Profile
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-body-md hover:bg-surface-container lg:hidden"
                    >
                      <Icon name="receipt_long" className="text-[18px]" /> My Orders
                    </Link>
                    {isStaff ? (
                      <Link
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-body-md hover:bg-surface-container lg:hidden"
                      >
                        <Icon name="dashboard" className="text-[18px]" /> Kitchen Hub
                      </Link>
                    ) : null}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-outline-variant/60 px-4 py-2.5 text-left text-body-md text-error hover:bg-error-container/40"
                    >
                      <Icon name="logout" className="text-[18px]" /> Sign out
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-outline-variant/40 bg-surface-container">
        <div className="page grid gap-10 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Icon name="lunch_dining" className="text-[22px] text-primary" />
              <span className="font-display text-headline-md text-primary">Mealhub</span>
            </div>
            <p className="mt-3 max-w-sm text-body-md text-on-surface-variant">
              Elevating the corporate dining experience with chef-curated boxes delivered daily to
              your tech park.
            </p>
          </div>
          <div>
            <h4 className="label-caps">Services</h4>
            <ul className="mt-3 space-y-2 text-body-md text-on-surface-variant">
              <li><Link to="/menu" className="hover:text-primary">Daily Menu</Link></li>
              <li><Link to="/orders" className="hover:text-primary">Order History</Link></li>
              <li><Link to="/bulk-orders" className="hover:text-primary">Bulk Orders</Link></li>
              <li><Link to="/profile" className="hover:text-primary">Your Drop Zone</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="label-caps">Need help?</h4>
            <p className="mt-3 text-body-md text-on-surface-variant">
              Contact your tech park coordinator for anything about a live order.
            </p>
          </div>
        </div>
        <div className="page flex flex-col gap-2 border-t border-outline-variant/40 py-6 text-label-md text-on-surface-variant sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Mealhub. All rights reserved.</span>
          <span>Prices include our service margin. GST as applicable.</span>
        </div>
      </footer>
    </div>
  )
}
