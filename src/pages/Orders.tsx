import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetMyOrdersQuery } from '../store/api'
import { formatDate, formatMoney, PAYMENT_LABEL, STATUS_LABEL } from '../lib/format'
import { Badge, Button, Card, EmptyState, Icon, Spinner, STATUS_TONE } from '../components/ui'

const FILTERS = [
  { key: 'all', label: 'All orders' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function Orders() {
  const [filter, setFilter] = useState('all')
  const { data, isLoading } = useGetMyOrdersQuery({ status: filter, limit: 50 })

  if (isLoading) return <Spinner label="Loading your orders" />

  const orders = data?.orders ?? []

  return (
    <div className="page py-8">
      <p className="label-caps text-secondary">Archive & analytics</p>
      <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-headline-lg text-primary">Your Order History</h1>
          <p className="mt-2 max-w-lg text-body-md text-on-surface-variant">
            Review past lunches and keep track of what you've spent at work.
          </p>
        </div>

        <div className="flex gap-4">
          <Card className="min-w-[160px] p-5">
            <p className="label-caps">Total orders</p>
            <p className="mt-1 font-display text-headline-lg font-bold text-primary tabular">
              {data?.total_count ?? 0}
            </p>
          </Card>
          <div className="min-w-[180px] rounded-xl bg-primary-container p-5">
            <p className="text-label-md font-semibold uppercase tracking-widest text-on-primary-container">
              Total spent
            </p>
            <p className="mt-1 font-display text-headline-lg font-bold text-tertiary-fixed-dim tabular">
              {formatMoney(data?.total_spent)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-gutter lg:grid-cols-[220px_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-28">
          <h2 className="font-display text-body-lg font-semibold text-primary">Filters</h2>
          <div className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:items-start">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key)}
                className={`rounded-full px-4 py-1.5 text-label-lg transition-colors ${
                  filter === option.key
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex flex-col gap-4">
          {orders.length === 0 ? (
            <Card>
              <EmptyState
                icon="receipt_long"
                title="No orders here yet"
                action={
                  <Link to="/menu">
                    <Button icon="restaurant_menu">Browse today's menu</Button>
                  </Link>
                }
              >
                {filter === 'all'
                  ? "You haven't ordered yet. Today's menu is waiting."
                  : 'Nothing matches this filter.'}
              </EmptyState>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="card-interactive overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-container">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Token
                    </span>
                    <span className="font-display text-body-lg font-bold text-primary tabular">
                      {order.token}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-body-lg font-semibold text-primary">
                      {order.item_summary || 'Order'}
                    </h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md text-on-surface-variant">
                      <span>{formatDate(order.service_date)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="account_balance_wallet" className="text-[14px]" />
                        {PAYMENT_LABEL[order.payment_status]}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                    <span className="font-display text-body-lg font-bold text-primary tabular">
                      {formatMoney(order.total)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/50 bg-surface-container-low px-5 py-3">
                  <span className="text-label-md text-on-surface-variant">
                    {order.drop_zone_name ?? '—'}
                  </span>
                  <Link to={`/orders/${order.id}`}>
                    <Button variant="secondary" icon="confirmation_number" className="py-2">
                      View ticket
                    </Button>
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
