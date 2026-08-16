import { useState } from 'react'
import {
  useAssignDeliveryMutation,
  useBulkUpdateStatusMutation,
  useGetAdminOrdersQuery,
  useGetDeliveryPersonsQuery,
  useGetVendorsQuery,
  useReconcilePaymentMutation,
  useUpdateOrderStatusMutation,
} from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatMoney, formatTime, STATUS_LABEL, todayISO } from '../../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Select,
  PageHeader,
  SkeletonRows,
} from '../../components/ui'
import type { AdminOrder } from '../../types'

const STATUSES = ['CONFIRMED', 'PREPARING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']

/**
 * The vendors behind an order, as recorded when it was placed.
 *
 * These come from the order line's own snapshot, not from the dish's current
 * vendor — reassigning a dish must never change who an existing order is owed to.
 */
function vendorsOf(order: AdminOrder) {
  const counts = new Map<string, number>()
  for (const item of order.items) {
    const name = item.vendor_name ?? 'Unassigned'
    counts.set(name, (counts.get(name) ?? 0) + item.quantity)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
}

/** Order lines grouped by vendor, with what that vendor is owed for this order. */
function byVendor(order: AdminOrder) {
  const groups = new Map<string, { name: string; items: AdminOrder['items']; cost: number }>()
  for (const item of order.items) {
    const name = item.vendor_name ?? 'Unassigned'
    const group = groups.get(name) ?? { name, items: [], cost: 0 }
    group.items.push(item)
    group.cost += Number(item.line_vendor_total)
    groups.set(name, group)
  }
  return [...groups.values()]
}

function OrderRow({
  order,
  selected,
  onSelect,
  onStatus,
  onPaid,
}: {
  order: AdminOrder
  selected: boolean
  onSelect: (checked: boolean) => void
  onStatus: (status: string) => void
  onPaid: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr className="align-top hover:bg-surface-container-low">
        <td className="px-4 py-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select order ${order.token}`}
            className="h-4 w-4 accent-[#1b6b44]"
          />
        </td>
        <td className="px-3 py-4">
          <button
            onClick={() => setOpen((v) => !v)}
            className="font-display text-body-lg font-bold text-primary tabular hover:text-secondary"
          >
            {order.token}
          </button>
          <p className="text-label-md text-on-surface-variant">{formatTime(order.placed_at)}</p>
        </td>
        <td className="px-3 py-4">
          <p className="text-body-md font-medium text-primary">{order.customer_name}</p>
          <p className="text-label-md text-on-surface-variant">{order.customer_phone ?? '—'}</p>
        </td>
        <td className="px-3 py-4">
          <p className="text-body-md text-primary">{order.drop_zone_name ?? '—'}</p>
          <p className="text-label-md text-secondary">{order.location_name}</p>
        </td>
        <td className="max-w-[200px] px-3 py-4 text-label-lg font-normal tracking-normal text-on-surface-variant">
          {order.item_summary}
        </td>
        <td className="px-3 py-4">
          <div className="flex flex-wrap gap-1">
            {vendorsOf(order).map((vendor) => (
              <Badge key={vendor.name} tone={vendor.name === 'Unassigned' ? 'danger' : 'info'}>
                {vendor.name}
                {vendor.count > 1 ? ` ×${vendor.count}` : ''}
              </Badge>
            ))}
          </div>
        </td>
        <td className="px-3 py-4 text-right">
          <p className="text-body-md font-semibold text-primary tabular">{formatMoney(order.total)}</p>
          <p className="text-label-md text-secondary tabular">+{formatMoney(order.margin_total)}</p>
        </td>
        <td className="px-3 py-4">
          {order.payment_status === 'PAID' ? (
            <Badge tone="success" icon="check">Paid</Badge>
          ) : (
            <button onClick={onPaid} title="Mark this order paid">
              <Badge tone="danger" icon="error">Unpaid</Badge>
            </button>
          )}
        </td>
        <td className="px-4 py-4">
          <Select
            value={order.status}
            onChange={(e) => onStatus(e.target.value)}
            className="min-w-[130px] py-1.5 text-label-lg"
            aria-label={`Status for order ${order.token}`}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </td>
      </tr>

      {open ? (
        <tr className="bg-surface-container-low">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="label-caps mb-2">Items by vendor</p>
                <div className="flex flex-col gap-3">
                  {byVendor(order).map((group) => (
                    <div key={group.name} className="rounded-lg border border-outline-variant/60 p-3">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-body-md font-semibold text-primary">
                          <Icon name="storefront" className="text-[16px] text-secondary" />
                          {group.name}
                        </span>
                        <span className="text-label-md text-on-surface-variant tabular">
                          owed {formatMoney(group.cost)}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1">
                        {group.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-4 text-body-md">
                            <span>
                              {item.quantity}× {item.item_name}
                            </span>
                            <span className="tabular">
                              {formatMoney(item.line_total)}
                              <span className="ml-2 text-label-md text-on-surface-variant">
                                cost {formatMoney(item.line_vendor_total)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-label-md text-on-surface-variant">
                  Vendor recorded when the order was placed — later dish reassignments don't
                  change it.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 text-body-md">
                <p className="label-caps mb-0.5">Details</p>
                <p><span className="text-on-surface-variant">Email:</span> {order.customer_email ?? '—'}</p>
                <p><span className="text-on-surface-variant">Employee code:</span> {order.employee_code ?? '—'}</p>
                <p><span className="text-on-surface-variant">UPI reference:</span> {order.upi_reference ?? '—'}</p>
                <p><span className="text-on-surface-variant">Rider:</span> {order.delivery_person_name ?? 'Unassigned'}</p>
                {order.customer_note ? (
                  <p><span className="text-on-surface-variant">Note:</span> {order.customer_note}</p>
                ) : null}
                {order.cancel_reason ? (
                  <p className="text-error">Cancelled: {order.cancel_reason}</p>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export default function AdminOrders() {
  const [filters, setFilters] = useState({
    service_date: todayISO(),
    status: 'all',
    vendor_id: '',
    search: '',
    unpaid_only: false,
  })
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')

  const { data, isLoading } = useGetAdminOrdersQuery(
    { ...filters, page_size: 100 },
    { pollingInterval: 45_000 },
  )
  const { data: riders = [] } = useGetDeliveryPersonsQuery()
  const { data: vendors = [] } = useGetVendorsQuery()

  const [updateStatus] = useUpdateOrderStatusMutation()
  const [bulkStatus, { isLoading: bulking }] = useBulkUpdateStatusMutation()
  const [reconcile] = useReconcilePaymentMutation()
  const [assign, { isLoading: assigning }] = useAssignDeliveryMutation()

  const orders = data?.orders ?? []
  const allSelected = orders.length > 0 && selected.length === orders.length

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err, fallback))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Orders"
        description={
          isLoading
            ? 'Loading orders…'
            : `${data?.total_count ?? 0} order${data?.total_count === 1 ? '' : 's'} matching your filters.`
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Filters ── */}
      <Card className="grid gap-4 p-5 md:grid-cols-5">
        <Input
          type="date"
          value={filters.service_date}
          onChange={(e) => setFilters({ ...filters, service_date: e.target.value })}
          aria-label="Service date"
        />
        <Select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          <option value="active">In progress</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        <Select
          value={filters.vendor_id}
          onChange={(e) => setFilters({ ...filters, vendor_id: e.target.value })}
          aria-label="Vendor filter"
        >
          <option value="">All vendors</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </Select>
        <Input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Token or customer…"
          aria-label="Search orders"
        />
        <label className="flex items-center gap-2 text-body-md">
          <input
            type="checkbox"
            checked={filters.unpaid_only}
            onChange={(e) => setFilters({ ...filters, unpaid_only: e.target.checked })}
            className="h-4 w-4 accent-[#1b6b44]"
          />
          Unpaid only
        </label>
      </Card>

      {/* ── Bulk actions ── */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-container px-5 py-3 text-on-primary">
          <span className="text-label-lg">{selected.length} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* No `value` prop, so it always renders the placeholder — the
                action fires and the control resets itself. */}
            <Select
              onChange={(e) => {
                const status = e.target.value
                if (!status) return
                run(
                  () => bulkStatus({ order_ids: selected, status }).unwrap(),
                  'Bulk update failed.',
                ).then(() => setSelected([]))
              }}
              disabled={bulking}
              className="py-2 text-label-lg"
              aria-label="Move selected orders to status"
            >
              <option value="">Move to…</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </Select>

            <Select
              onChange={(e) => {
                const riderId = e.target.value
                if (!riderId) return
                run(
                  () =>
                    assign({
                      order_ids: selected,
                      delivery_person_id: Number(riderId),
                    }).unwrap(),
                  'Could not assign those orders.',
                ).then(() => setSelected([]))
              }}
              disabled={assigning || riders.length === 0}
              className="py-2 text-label-lg"
              aria-label="Assign selected orders to a rider"
            >
              <option value="">Assign rider…</option>
              {riders.map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              ))}
            </Select>

            <Button variant="ghost" onClick={() => setSelected([])} className="text-on-primary">
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={6} className="p-5" />
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long" title="No orders match">
            Try a different date or clear the filters.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-surface-container-low">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? orders.map((o) => o.id) : [])}
                      aria-label="Select all orders"
                      className="h-4 w-4 accent-[#1b6b44]"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Token</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Drop point</th>
                  <th className="px-3 py-3 font-semibold">Items</th>
                  <th className="px-3 py-3 font-semibold">Vendor</th>
                  <th className="px-3 py-3 text-right font-semibold">Total / Margin</th>
                  <th className="px-3 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={selected.includes(order.id)}
                    onSelect={(checked) =>
                      setSelected((prev) =>
                        checked ? [...prev, order.id] : prev.filter((id) => id !== order.id),
                      )
                    }
                    onStatus={(status) =>
                      run(
                        () => updateStatus({ id: order.id, status }).unwrap(),
                        'That status change was rejected.',
                      )
                    }
                    onPaid={() =>
                      run(
                        () => reconcile({ id: order.id, payment_status: 'PAID' }).unwrap(),
                        'Could not mark that order paid.',
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Click a token to expand an order. Click the Unpaid badge to reconcile it.
      </p>
    </>
  )
}
