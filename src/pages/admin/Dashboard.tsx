import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useGetAdminOrdersQuery,
  useGetDashboardQuery,
  useGetDeliveryPersonsQuery,
  useUpdateOrderStatusMutation,
} from '../../store/api'
import { formatMoney, formatTime, STATUS_LABEL } from '../../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
  SkeletonRows,
  STATUS_TONE,
} from '../../components/ui'

/**
 * A metric tile. The delta line carries the interpretation — a number alone
 * makes the reader do the work of deciding whether it is good or bad.
 */
function Metric({
  icon,
  tone,
  value,
  label,
  note,
  noteTone = 'text-on-surface-variant',
  loading,
  to,
}: {
  icon: string
  tone: string
  value: string
  label: string
  note?: string
  noteTone?: string
  loading?: boolean
  to?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon name={icon} className="text-[19px]" />
        </span>
        {to ? (
          <Icon name="arrow_outward" className="text-[16px] text-outline-variant" />
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-9 w-24" />
      ) : (
        <p className="mt-4 font-display text-headline-lg leading-none text-primary tabular">
          {value}
        </p>
      )}

      <p className="mt-2 text-label-md uppercase tracking-widest text-on-surface-variant">{label}</p>
      {note && !loading ? <p className={`mt-1 text-label-md ${noteTone}`}>{note}</p> : null}
    </>
  )

  const className =
    'card card-interactive block p-4 transition-colors hover:border-outline-variant'

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

const NEXT_ACTION: Record<string, { status: string; label: string }> = {
  CONFIRMED: { status: 'PREPARING', label: 'Start' },
  PREPARING: { status: 'PACKED', label: 'Packed' },
  PACKED: { status: 'DISPATCHED', label: 'Dispatch' },
  DISPATCHED: { status: 'DELIVERED', label: 'Delivered' },
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardQuery(undefined, { pollingInterval: 30_000 })
  const { data: orderList, isLoading: loadingOrders } = useGetAdminOrdersQuery(
    { status: 'active', page_size: 10 },
    { pollingInterval: 30_000 },
  )
  const { data: riders = [] } = useGetDeliveryPersonsQuery()
  const [updateStatus] = useUpdateOrderStatusMutation()
  const [error, setError] = useState('')

  const window = data?.window
  const maxTally = Math.max(1, ...(data?.portion_tally ?? []).map((row) => row.total_qty))
  const orders = orderList?.orders ?? []

  async function advance(orderId: number, status: string) {
    setError('')
    try {
      await updateStatus({ id: orderId, status }).unwrap()
    } catch {
      setError('That status change was rejected.')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Kitchen Hub"
        title="Today's Service"
        description="Everything happening right now, and the next action on each order."
        actions={
          <>
            <Link to="/admin/stock">
              <Button variant="secondary" icon="inventory_2">
                Edit stock
              </Button>
            </Link>
            <Link to="/admin/exports">
              <Button icon="download">Exports</Button>
            </Link>
          </>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {!isLoading && !window?.has_window ? (
        <Alert tone="warning" title="No ordering window today">
          Customers can't order until a window is published.{' '}
          <Link to="/admin/window" className="font-semibold underline">
            Set one up
          </Link>
          .
        </Alert>
      ) : null}

      {/* ── Metrics ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon="receipt_long"
          tone="bg-primary-fixed text-on-primary-fixed"
          value={String(data?.total_orders ?? 0)}
          label="Orders today"
          note={data?.cancelled_orders ? `${data.cancelled_orders} cancelled` : 'None cancelled'}
          loading={isLoading}
          to="/admin/orders"
        />
        <Metric
          icon="account_balance_wallet"
          tone={
            data?.unpaid_orders
              ? 'bg-error-container text-on-error-container'
              : 'bg-secondary-container text-on-secondary-container'
          }
          value={String(data?.unpaid_orders ?? 0)}
          label="Unpaid"
          note={
            data?.unpaid_orders ? `${formatMoney(data.unpaid_amount)} to collect` : 'All settled'
          }
          noteTone={data?.unpaid_orders ? 'text-error font-semibold' : 'text-secondary'}
          loading={isLoading}
          to="/admin/payments"
        />
        <Metric
          icon="skillet"
          tone="bg-tertiary-fixed text-on-tertiary-fixed"
          value={String(data?.pending_preparation ?? 0)}
          label="Still to cook"
          note={
            window?.cutoff_at ? `Cutoff ${formatTime(window.cutoff_at)}` : 'No cutoff scheduled'
          }
          loading={isLoading}
        />
        <Metric
          icon="savings"
          tone="bg-secondary-container text-on-secondary-container"
          value={formatMoney(data?.margin)}
          label="Margin today"
          note={`on ${formatMoney(data?.gross_revenue)} revenue`}
          loading={isLoading}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] xl:items-start">
        {/* ── Live board ── */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-body-lg font-semibold text-primary">Active orders</h2>
              {orders.length ? <Badge tone="neutral">{orders.length}</Badge> : null}
            </div>
            <Link
              to="/admin/orders"
              className="text-label-lg text-secondary transition-colors hover:text-primary"
            >
              View all
            </Link>
          </div>

          {loadingOrders ? (
            <SkeletonRows rows={4} className="p-5" />
          ) : orders.length === 0 ? (
            <EmptyState icon="inbox" title="Nothing in the queue">
              Orders appear here the moment they're placed.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {orders.map((order) => {
                const next = NEXT_ACTION[order.status]
                return (
                  <li
                    key={order.id}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-container-low"
                  >
                    <div className="w-14 shrink-0">
                      <p className="font-display text-body-lg font-bold leading-none text-primary tabular">
                        {order.token}
                      </p>
                      {order.payment_status !== 'PAID' ? (
                        <p className="mt-1 text-label-md font-semibold text-error">Unpaid</p>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md text-primary">{order.item_summary}</p>
                      <p className="truncate text-label-md text-on-surface-variant">
                        {order.drop_zone_name} · {order.customer_name}
                      </p>
                    </div>

                    <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>

                    {next ? (
                      <Button
                        variant={order.status === 'CONFIRMED' ? 'secondary' : 'dark'}
                        onClick={() => advance(order.id, next.status)}
                        className="shrink-0 px-3 py-1.5 text-label-md"
                      >
                        {next.label}
                      </Button>
                    ) : (
                      <span className="w-[76px]" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {/* ── Portion tally ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3.5">
              <h2 className="font-display text-body-lg font-semibold text-primary">Portion tally</h2>
              <Icon name="soup_kitchen" className="text-[20px] text-on-surface-variant" />
            </div>

            <div className="p-5">
              {isLoading ? (
                <SkeletonRows rows={3} />
              ) : !data?.portion_tally.length ? (
                <p className="py-4 text-center text-body-md text-on-surface-variant">
                  Nothing to cook yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {data.portion_tally.map((row) => (
                    <li key={`${row.menu_item_id}-${row.item_name}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-body-md text-primary">{row.item_name}</span>
                        <span className="font-display text-body-lg font-bold leading-none text-secondary tabular">
                          {row.total_qty}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full rounded-full bg-secondary transition-[width] duration-500"
                          style={{ width: `${(row.total_qty / maxTally) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Link to="/admin/exports" className="mt-5 block">
                <Button variant="dark" icon="download" className="w-full">
                  Prep list
                </Button>
              </Link>
            </div>
          </Card>

          {/* ── Couriers ── */}
          <Card className="overflow-hidden">
            <div className="border-b border-outline-variant/50 px-5 py-3.5">
              <h2 className="font-display text-body-lg font-semibold text-primary">Couriers</h2>
            </div>

            <div className="p-5">
              {!riders.length ? (
                <p className="text-body-md text-on-surface-variant">
                  No delivery people yet.{' '}
                  <Link to="/admin/delivery" className="text-secondary hover:underline">
                    Add one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {riders.map((rider) => (
                    <li key={rider.id} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-label-md font-bold text-on-secondary-fixed">
                        {rider.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-md text-primary">{rider.name}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {rider.active_orders} box{rider.active_orders === 1 ? '' : 'es'}
                        </p>
                      </div>
                      <Badge tone={rider.active_orders > 0 ? 'success' : 'neutral'}>
                        {rider.active_orders > 0 ? 'Active' : 'Idle'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
