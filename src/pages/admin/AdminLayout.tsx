import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useGetWindowQuery, useLogoutMutation, useToggleWindowMutation } from '../../store/api'
import { useAppDispatch, useAppSelector } from '../../store'
import { loggedOut } from '../../store/authSlice'
import { formatCountdown, formatTime } from '../../lib/format'
import { Icon } from '../../components/ui'

/**
 * The back-of-house console.
 *
 * Deliberately a different product from the customer storefront: a dark command
 * rail and a persistent status bar instead of the airy editorial layout. Every
 * task here is deadline-driven, so the cutoff countdown lives in the chrome and
 * is visible from every screen.
 *
 * The shell stays mounted across navigation — only <Outlet/> swaps — so moving
 * between tabs never rebuilds the page.
 */

interface NavItem {
  to: string
  label: string
  icon: string
  adminOnly?: boolean
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

// Grouped because eleven flat links read as a list rather than a structure.
// The grouping mirrors how the day actually runs: service first, then the
// catalogue behind it, then the settings you touch once and leave alone.
const NAV: NavGroup[] = [
  {
    heading: 'Service',
    items: [
      { to: '/admin', label: 'Overview', icon: 'space_dashboard' },
      { to: '/admin/orders', label: 'Orders', icon: 'receipt_long' },
      { to: '/admin/stock', label: "Today's Stock", icon: 'inventory_2' },
      { to: '/admin/payments', label: 'Payments', icon: 'account_balance_wallet' },
      { to: '/admin/delivery', label: 'Delivery', icon: 'local_shipping' },
      { to: '/admin/exports', label: 'Vendor Dispatch', icon: 'send' },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { to: '/admin/menu', label: 'Menu & Pricing', icon: 'restaurant_menu', adminOnly: true },
      { to: '/admin/vendors', label: 'Vendors', icon: 'storefront', adminOnly: true },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { to: '/admin/window', label: 'Order Window', icon: 'schedule', adminOnly: true },
      { to: '/admin/locations', label: 'Locations', icon: 'location_on', adminOnly: true },
      { to: '/admin/settings', label: 'Settings', icon: 'tune', adminOnly: true },
    ],
  },
]

/** Ticks locally between the 60s window refetches. */
function useTicker(seconds: number | null | undefined) {
  const [value, setValue] = useState(seconds ?? 0)
  useEffect(() => setValue(seconds ?? 0), [seconds])
  useEffect(() => {
    if (value <= 0) return
    const timer = setInterval(() => setValue((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(timer)
  }, [value > 0])
  return value
}

/**
 * The signature element: the cutoff, always on screen.
 *
 * It shifts amber under 30 minutes and red under 10 — the two moments where
 * the kitchen's behaviour has to change.
 */
function CutoffStatus() {
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 60_000 })
  const remaining = useTicker(window?.seconds_to_cutoff)

  if (!window?.has_window) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-tertiary-fixed px-3 py-1.5 text-on-tertiary-fixed-variant">
        <Icon name="event_busy" className="text-[18px]" />
        <span className="text-label-lg">No window today</span>
      </div>
    )
  }

  if (!window.is_open) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-1.5 text-on-surface-variant">
        <Icon name="lock_clock" className="text-[18px]" />
        <span className="text-label-lg">{window.reason ?? 'Closed'}</span>
      </div>
    )
  }

  const urgent = remaining < 600
  const soon = remaining < 1800

  const tone = urgent
    ? 'bg-error-container text-on-error-container'
    : soon
      ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
      : 'bg-secondary-container text-on-secondary-fixed'

  return (
    <div className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 ${tone}`}>
      <span className="relative flex h-2 w-2">
        {!soon ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        ) : null}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      <span className="text-label-md uppercase tracking-wider">Cutoff in</span>
      <span className="font-display text-body-lg font-bold leading-none tabular">
        {formatCountdown(remaining)}
      </span>
    </div>
  )
}

function AcceptingSwitch() {
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 60_000 })
  const [toggle, { isLoading }] = useToggleWindowMutation()
  const accepting = Boolean(window?.is_accepting)

  return (
    <button
      onClick={() => toggle({ is_accepting: !accepting })}
      disabled={isLoading || !window?.has_window}
      role="switch"
      aria-checked={accepting}
      aria-label="Accepting orders"
      title={
        window?.has_window
          ? accepting
            ? 'Stop taking new orders'
            : 'Start taking orders again'
          : 'Publish an ordering window first'
      }
      className="flex items-center gap-2.5 rounded-lg border border-outline-variant px-2.5 py-1.5 transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="hidden text-label-lg text-on-surface-variant lg:inline">
        {accepting ? 'Accepting' : 'Paused'}
      </span>
      {/* The knob is anchored with an explicit `left`. Positioning it only by
          transform leaves it at its static origin, which is why it used to sit
          outside the track. Track 44px, knob 20px, 2px inset -> travel 20px. */}
      <span
        className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${
          accepting ? 'bg-secondary' : 'bg-outline-variant'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            accepting ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

export default function AdminLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user, refreshToken } = useAppSelector((state) => state.auth)
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 60_000 })
  const [logout] = useLogoutMutation()

  const [railOpen, setRailOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = user?.role === 'admin'
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0)

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logout({ refresh_token: refreshToken }).unwrap()
      } catch {
        /* a failed revoke must not trap the user in a session they ended */
      }
    }
    dispatch(loggedOut())
    navigate('/login')
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const rail = (
    <div className="flex h-full flex-col bg-primary-container text-inverse-on-surface">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary-fixed-dim">
          <Icon name="lunch_dining" className="text-[18px] text-on-tertiary-fixed" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-body-lg font-semibold text-white">Mealhub</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-on-primary-container">
            Kitchen Console
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Console">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-primary-container">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={() => setRailOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2 text-body-md transition-colors ${
                        isActive
                          ? 'bg-tertiary-fixed-dim font-semibold text-on-tertiary-fixed'
                          : 'text-primary-fixed hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon name={item.icon} className="text-[20px]" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          to="/menu"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-body-md text-primary-fixed transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="open_in_new" className="text-[20px]" />
          View storefront
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Command rail ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{rail}</aside>

      {railOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-sm lg:hidden"
            onClick={() => setRailOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">{rail}</aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* ── Status bar ── */}
        <header className="sticky top-0 z-30 border-b border-outline-variant/50 bg-surface/95 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setRailOpen(true)}
              className="rounded-lg p-2 text-primary hover:bg-surface-container lg:hidden"
              aria-label="Open console menu"
            >
              <Icon name="menu" className="text-[22px]" />
            </button>

            <div className="hidden min-w-0 sm:block">
              <p className="text-label-md uppercase tracking-widest text-on-surface-variant">
                Service date
              </p>
              <p className="font-display text-body-lg font-semibold leading-none text-primary">
                {today}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <CutoffStatus />

              <div className="hidden h-8 w-px bg-outline-variant sm:block" />

              <AcceptingSwitch />

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg border border-outline-variant px-2 py-1.5 hover:bg-surface-container"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-label-md font-bold text-white">
                    {(user?.name ?? '?')
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span className="hidden text-label-lg text-primary md:inline">{user?.name}</span>
                  <Icon name="expand_more" className="text-[18px] text-on-surface-variant" />
                </button>

                {menuOpen ? (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg">
                      <div className="border-b border-outline-variant/60 px-4 py-3">
                        <p className="truncate text-body-md font-semibold text-primary">
                          {user?.name}
                        </p>
                        <p className="mt-0.5 text-label-md uppercase tracking-wider text-secondary">
                          {user?.role === 'admin' ? 'Administrator' : 'Kitchen staff'}
                        </p>
                      </div>
                      <Link
                        to="/menu"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-body-md hover:bg-surface-container"
                      >
                        <Icon name="storefront" className="text-[18px]" /> View storefront
                      </Link>
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

          {/* Ordering being paused is easy to forget and expensive to miss. */}
          {window?.has_window && !window.is_accepting ? (
            <div className="flex items-center justify-center gap-2 bg-error-container px-4 py-1.5 text-on-error-container">
              <Icon name="pause_circle" className="text-[16px]" />
              <span className="text-label-lg">
                Ordering is paused — customers cannot place orders right now.
              </span>
            </div>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-outline-variant/40 px-6 py-4">
          <p className="text-label-md text-on-surface-variant">
            Mealhub · Kitchen Console
            {window?.cutoff_at ? ` · Today's cutoff ${formatTime(window.cutoff_at)}` : ''}
          </p>
        </footer>
      </div>
    </div>
  )
}
