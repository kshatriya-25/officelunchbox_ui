import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useGetMenuQuery,
  useGetPublicSettingsQuery,
  useGetWindowQuery,
} from '../store/api'
import { useAppDispatch, useAppSelector } from '../store'
import { reconcile, setQuantity } from '../store/cartSlice'
import { formatMoney, formatTime } from '../lib/format'
import { Alert, Badge, Button, Card, EmptyState, FoodDot, Icon, Input, Spinner } from '../components/ui'
import type { PublicMenuItem } from '../types'

/**
 * "Last 4 left" / "14 left today" — scarcity, only when it is real.
 *
 * Unlimited dishes show a plain Available: a countdown that never moves reads
 * as broken, and false scarcity is worse than none.
 */
function StockBadge({ item }: { item: PublicMenuItem }) {
  if (item.is_sold_out) return null
  if (item.is_unlimited || item.qty_remaining === null) {
    return <Badge tone="success">Available</Badge>
  }
  if (item.qty_remaining <= 5) {
    return <Badge tone="danger">Last {item.qty_remaining} left</Badge>
  }
  if (item.qty_remaining <= 15) {
    return <Badge tone="warning">{item.qty_remaining} left today</Badge>
  }
  return <Badge tone="success">Available</Badge>
}

function Stepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number
  max: number
  disabled?: boolean
  onChange: (next: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-outline-variant">
      <button
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 0}
        className="flex h-9 w-9 items-center justify-center rounded-l-lg text-primary transition-colors hover:bg-surface-container disabled:text-outline-variant"
        aria-label="Reduce quantity"
      >
        <Icon name="remove" className="text-[18px]" />
      </button>
      <span className="w-8 text-center text-body-md font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        className="flex h-9 w-9 items-center justify-center rounded-r-lg text-primary transition-colors hover:bg-surface-container disabled:text-outline-variant"
        aria-label="Increase quantity"
        title={value >= max ? 'No more portions available' : undefined}
      >
        <Icon name="add" className="text-[18px]" />
      </button>
    </div>
  )
}

function MenuCard({
  item,
  quantity,
  canOrder,
  onChange,
}: {
  item: PublicMenuItem
  quantity: number
  canOrder: boolean
  onChange: (next: number) => void
}) {
  return (
    <Card className={`card-interactive overflow-hidden ${item.is_sold_out ? 'opacity-70' : ''}`}>
      <div className="relative aspect-[16/10] bg-surface-container">
        {item.image_path ? (
          <img
            src={`/${item.image_path}`}
            alt={item.name}
            loading="lazy"
            className={`h-full w-full object-cover ${item.is_sold_out ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon name="restaurant" className="text-[40px] text-outline-variant" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface-container-lowest/95 px-2.5 py-1 backdrop-blur">
          <FoodDot type={item.food_type} />
          <span className="text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            {item.food_type === 'VEG' ? 'Veg' : item.food_type === 'EGG' ? 'Egg' : 'Non-Veg'}
          </span>
        </div>

        {item.is_sold_out ? (
          <div className="absolute inset-0 flex items-center justify-center bg-inverse-surface/45">
            <span className="-rotate-6 rounded bg-surface-container-lowest px-4 py-1.5 font-display text-headline-md tracking-wide text-error">
              SOLD OUT
            </span>
          </div>
        ) : (
          <div className="absolute bottom-3 right-3">
            <StockBadge item={item} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-body-lg font-semibold leading-tight text-primary">
            {item.name}
          </h3>
          <span className="shrink-0 font-display text-body-lg font-bold text-secondary tabular">
            {formatMoney(item.price)}
          </span>
        </div>

        {item.description ? (
          <p className="line-clamp-2 text-label-lg font-normal leading-relaxed tracking-normal text-on-surface-variant">
            {item.description}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-between border-t border-outline-variant/50 pt-3">
          {item.is_sold_out ? (
            <span className="text-label-md text-on-surface-variant">Restocking tomorrow</span>
          ) : (
            <Stepper
              value={quantity}
              // Unlimited still gets a ceiling: the API caps a single line at 50,
              // so the stepper must not let you build a request it will reject.
              max={item.qty_remaining ?? 50}
              disabled={!canOrder}
              onChange={onChange}
            />
          )}
          {item.calories ? (
            <span className="text-label-md text-on-surface-variant tabular">{item.calories} kcal</span>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export default function Menu() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const { data: menu, isLoading, isError, refetch } = useGetMenuQuery(undefined, {
    // Stock moves while you browse; a stale menu leads to checkout failures.
    pollingInterval: 45_000,
  })
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 60_000 })
  const { data: settings } = useGetPublicSettingsQuery()

  const cart = useAppSelector((state) => state.cart)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Prune anything that sold out or left the menu while the cart sat in storage.
  useEffect(() => {
    if (menu) dispatch(reconcile({ items: menu.items, serviceDate: menu.service_date }))
  }, [menu, dispatch])

  const quantities = useMemo(
    () => new Map(cart.lines.map((line) => [line.menu_item_id, line.quantity])),
    [cart.lines],
  )

  const visibleItems = useMemo(() => {
    if (!menu) return []
    const term = search.trim().toLowerCase()
    return menu.items.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category_slug === activeCategory
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [menu, activeCategory, search])

  const totals = useMemo(() => {
    const subtotal = cart.lines.reduce(
      (sum, line) => sum + Number(line.unit_price) * line.quantity,
      0,
    )
    const gstPercent = Number(settings?.gst_percent ?? 0)
    const deliveryFee = Number(settings?.delivery_fee ?? 0)
    const gstAmount = Math.round(subtotal * gstPercent) / 100

    return {
      subtotal,
      gstAmount,
      deliveryFee,
      total: subtotal + gstAmount + deliveryFee,
      count: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    }
  }, [cart.lines, settings])

  const canOrder = Boolean(window?.is_open)

  if (isLoading) return <Spinner label="Loading today's menu" />

  if (isError) {
    return (
      <div className="page py-16">
        <EmptyState
          icon="cloud_off"
          title="Couldn't load the menu"
          action={<Button onClick={() => refetch()} icon="refresh">Try again</Button>}
        >
          The kitchen service isn't responding. Check that the backend is running.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="page py-8">
      {/* ── Status strip ── */}
      <div className="mb-8 grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low p-5 sm:grid-cols-3">
        <div>
          <p className="label-caps">Status</p>
          <p className="mt-1 flex items-center gap-2 font-display text-body-lg font-semibold text-primary">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                canOrder ? 'bg-secondary' : 'bg-error'
              }`}
            />
            {canOrder ? 'Accepting Orders' : 'Orders Closed'}
          </p>
        </div>
        <div>
          <p className="label-caps">Estimated delivery</p>
          <p className="mt-1 font-display text-body-lg font-semibold text-primary tabular">
            {formatTime(window?.delivery_eta)}
          </p>
        </div>
        <div>
          <p className="label-caps">Orders close</p>
          <p className="mt-1 font-display text-body-lg font-semibold text-primary tabular">
            {formatTime(window?.cutoff_at)}
          </p>
        </div>
      </div>

      {!canOrder && window ? (
        <div className="mb-6">
          <Alert tone="warning" title={window.reason ?? 'Ordering is closed'}>
            {window.has_window
              ? 'You can still browse today\'s menu. Ordering reopens with tomorrow\'s window.'
              : 'No ordering window has been published yet. Check back shortly.'}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-gutter lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ── Menu ── */}
        <div>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="scrollbar-none flex gap-1 overflow-x-auto">
              <CategoryTab
                label="All"
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
              />
              {menu?.categories.map((category) => (
                <CategoryTab
                  key={category.id}
                  label={category.name}
                  active={activeCategory === category.slug}
                  onClick={() => setActiveCategory(category.slug)}
                />
              ))}
            </div>

            <div className="relative md:w-64">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="pl-10"
                aria-label="Search the menu"
              />
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <Card>
              <EmptyState
                icon={menu?.items.length ? 'search_off' : 'restaurant_menu'}
                title={menu?.items.length ? 'Nothing matches that' : "Today's menu isn't published yet"}
              >
                {menu?.items.length
                  ? 'Try a different search or category.'
                  : 'The kitchen publishes the day\'s menu each morning. Check back soon.'}
              </EmptyState>
            </Card>
          ) : (
            <div className="grid gap-gutter sm:grid-cols-2">
              {visibleItems.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  quantity={quantities.get(item.id) ?? 0}
                  canOrder={canOrder}
                  onChange={(next) =>
                    dispatch(
                      setQuantity({ item, quantity: next, serviceDate: menu!.service_date }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Order summary ── */}
        <aside className="lg:sticky lg:top-28">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-4">
              <h2 className="font-display text-headline-md text-primary">Your Order</h2>
              {totals.count > 0 ? (
                <Badge tone="success">
                  {totals.count} item{totals.count === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>

            {cart.lines.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Icon name="shopping_basket" className="text-[32px] text-outline-variant" />
                <p className="mt-2 text-body-md text-on-surface-variant">
                  Your box is empty. Add something from the menu.
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-outline-variant/40">
                  {cart.lines.map((line) => (
                    <li key={line.menu_item_id} className="flex items-center gap-3 px-5 py-3">
                      <FoodDot type={line.food_type} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-md font-medium text-primary">{line.name}</p>
                        <p className="text-label-md text-on-surface-variant tabular">
                          {line.quantity} × {formatMoney(line.unit_price)}
                        </p>
                      </div>
                      <span className="text-body-md font-semibold tabular">
                        {formatMoney(Number(line.unit_price) * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="space-y-2 border-t border-outline-variant/50 px-5 py-4 text-body-md">
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Subtotal</dt>
                    <dd className="tabular">{formatMoney(totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Delivery</dt>
                    <dd className={totals.deliveryFee === 0 ? 'font-semibold text-secondary' : 'tabular'}>
                      {totals.deliveryFee === 0 ? 'Free' : formatMoney(totals.deliveryFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">
                      GST ({Number(settings?.gst_percent ?? 0)}%)
                    </dt>
                    <dd className="tabular">{formatMoney(totals.gstAmount)}</dd>
                  </div>
                </dl>

                <div className="flex items-baseline justify-between border-t border-outline-variant/50 px-5 py-4">
                  <span className="font-display text-headline-md text-primary">Total</span>
                  <span className="font-display text-headline-lg font-bold text-primary tabular">
                    {formatMoney(totals.total)}
                  </span>
                </div>

                <div className="px-5 pb-5">
                  <Button
                    className="w-full"
                    disabled={!canOrder}
                    onClick={() => navigate('/checkout')}
                    icon="arrow_forward"
                  >
                    {canOrder ? 'Review & pay' : 'Ordering closed'}
                  </Button>
                  <p className="mt-3 text-center text-label-md text-on-surface-variant">
                    Final price is confirmed by the kitchen when you place the order.
                  </p>
                </div>
              </>
            )}
          </Card>

          {settings?.support_contact ? (
            <Card className="mt-4 flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
                <Icon name="support_agent" className="text-[20px] text-on-primary" />
              </span>
              <div>
                <p className="text-body-md font-semibold text-primary">Need help?</p>
                <p className="text-label-md text-on-surface-variant">
                  {settings.support_note ?? settings.support_contact}
                </p>
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-4 py-2.5 font-display text-body-lg font-semibold transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      {label}
    </button>
  )
}
