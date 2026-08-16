import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCancelMyOrderMutation,
  useGetMyOrderQuery,
  useSubmitPaymentReferenceMutation,
} from '../store/api'
import { errorMessage } from '../store/baseQuery'
import { formatDate, formatMoney, formatTime, PAYMENT_LABEL, STATUS_LABEL } from '../lib/format'
import { Alert, Badge, Button, Card, EmptyState, FoodDot, Icon, Input, Spinner, STATUS_TONE } from '../components/ui'
import { config } from '../config'

const STAGES = ['CONFIRMED', 'PREPARING', 'PACKED', 'DISPATCHED', 'DELIVERED'] as const

function Progress({ status }: { status: string }) {
  if (status === 'CANCELLED') return null
  const current = STAGES.indexOf(status as (typeof STAGES)[number])

  return (
    <ol className="flex items-center gap-1" aria-label="Order progress">
      {STAGES.map((stage, index) => {
        const done = index <= current
        return (
          <li key={stage} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${done ? 'bg-secondary' : 'bg-surface-container-high'}`}
            />
            <span
              className={`text-label-md ${
                index === current ? 'font-bold text-secondary' : 'text-on-surface-variant'
              }`}
            >
              {STATUS_LABEL[stage]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function OrderTicket() {
  const { orderId } = useParams()
  const { data: order, isLoading, isError } = useGetMyOrderQuery(Number(orderId), {
    skip: !orderId,
    // The kitchen advances status behind the scenes; keep the ticket honest.
    pollingInterval: config.poll.orders,
  })

  const [submitReference, { isLoading: savingReference }] = useSubmitPaymentReferenceMutation()
  const [cancelOrder, { isLoading: cancelling }] = useCancelMyOrderMutation()

  const [utr, setUtr] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (isLoading) return <Spinner label="Loading your ticket" />

  if (isError || !order) {
    return (
      <div className="page py-16">
        <EmptyState icon="receipt_long" title="Order not found" action={
          <Link to="/orders"><Button variant="secondary">Back to my orders</Button></Link>
        }>
          This order doesn't exist, or it belongs to another account.
        </EmptyState>
      </div>
    )
  }

  async function handleReference() {
    setError('')
    setMessage('')
    try {
      await submitReference({ id: order!.id, upi_reference: utr.trim() }).unwrap()
      setMessage('Reference saved. Our team will verify it shortly.')
      setUtr('')
    } catch (err) {
      setError(errorMessage(err, 'Could not save that reference.'))
    }
  }

  async function handleCancel() {
    setError('')
    try {
      await cancelOrder({ id: order!.id }).unwrap()
      setMessage('Your order was cancelled and the portions returned to the menu.')
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel this order.'))
    }
  }

  const cancellable = order.status === 'CONFIRMED'

  return (
    <div className="page max-w-3xl py-8">
      <Link
        to="/orders"
        className="mb-6 inline-flex items-center gap-1.5 text-label-lg text-on-surface-variant hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" /> My orders
      </Link>

      {order.status === 'CANCELLED' ? (
        <div className="mb-6">
          <Alert tone="danger" title="This order was cancelled">
            {order.cancel_reason ?? 'No reason recorded.'}
          </Alert>
        </div>
      ) : null}

      {message ? <div className="mb-6"><Alert tone="success">{message}</Alert></div> : null}
      {error ? <div className="mb-6"><Alert tone="danger">{error}</Alert></div> : null}

      {/* ── The token — the whole point of the ticket ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-2 bg-primary-container px-6 py-8 text-center">
          <p className="text-label-md font-semibold uppercase tracking-[0.2em] text-on-primary-container">
            Your pickup token
          </p>
          <p className="font-display text-[72px] font-bold leading-none text-tertiary-fixed-dim tabular">
            {order.token}
          </p>
          <p className="text-label-lg text-inverse-on-surface">
            Show this at {order.drop_zone_name ?? 'your drop point'}
          </p>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-3">
          <div>
            <p className="label-caps">Status</p>
            <div className="mt-1.5">
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            </div>
          </div>
          <div>
            <p className="label-caps">Payment</p>
            <div className="mt-1.5">
              <Badge tone={STATUS_TONE[order.payment_status]}>
                {PAYMENT_LABEL[order.payment_status]}
              </Badge>
            </div>
          </div>
          <div>
            <p className="label-caps">Expected</p>
            <p className="mt-1.5 text-body-md font-semibold text-primary tabular">
              {formatTime(order.delivery_eta)}
            </p>
          </div>
        </div>

        {order.status !== 'CANCELLED' ? (
          <div className="border-t border-outline-variant/50 px-6 py-5">
            <Progress status={order.status} />
          </div>
        ) : null}
      </Card>

      {/* ── Where and what ── */}
      <div className="mt-gutter grid gap-gutter sm:grid-cols-2">
        <Card className="p-5">
          <p className="label-caps">Drop point</p>
          <p className="mt-2 font-display text-body-lg font-semibold text-primary">
            {order.drop_zone_name ?? '—'}
          </p>
          <p className="text-label-lg font-normal tracking-normal text-on-surface-variant">
            {order.location_name}
            {order.drop_zone_description ? ` · ${order.drop_zone_description}` : ''}
          </p>
        </Card>

        <Card className="p-5">
          <p className="label-caps">Placed</p>
          <p className="mt-2 font-display text-body-lg font-semibold text-primary">
            {formatDate(order.service_date)}
          </p>
          <p className="text-label-lg font-normal tracking-normal text-on-surface-variant">
            at {formatTime(order.placed_at)}
          </p>
        </Card>
      </div>

      <Card className="mt-gutter overflow-hidden">
        <h2 className="border-b border-outline-variant/50 px-5 py-4 font-display text-headline-md text-primary">
          Your box
        </h2>
        <ul className="divide-y divide-outline-variant/40">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <FoodDot type={item.food_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-medium text-primary">{item.item_name}</p>
                <p className="text-label-md text-on-surface-variant tabular">
                  {item.quantity} × {formatMoney(item.unit_price)}
                </p>
              </div>
              <span className="text-body-md font-semibold tabular">{formatMoney(item.line_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-outline-variant/50 px-5 py-4 text-body-md">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Subtotal</dt>
            <dd className="tabular">{formatMoney(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Delivery</dt>
            <dd className={Number(order.delivery_fee) === 0 ? 'font-semibold text-secondary' : 'tabular'}>
              {Number(order.delivery_fee) === 0 ? 'Free' : formatMoney(order.delivery_fee)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">GST ({Number(order.gst_percent)}%)</dt>
            <dd className="tabular">{formatMoney(order.gst_amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-outline-variant/50 pt-2 font-display text-body-lg font-bold text-primary">
            <dt>Total</dt>
            <dd className="tabular">{formatMoney(order.total)}</dd>
          </div>
        </dl>

        {order.customer_note ? (
          <p className="border-t border-outline-variant/50 px-5 py-4 text-label-lg font-normal tracking-normal text-on-surface-variant">
            <span className="font-semibold">Your note:</span> {order.customer_note}
          </p>
        ) : null}
      </Card>

      {/* ── Payment reference ── */}
      {order.payment_status !== 'PAID' && order.status !== 'CANCELLED' ? (
        <Card className="mt-gutter p-5">
          <h2 className="font-display text-headline-md text-primary">Paid already?</h2>
          <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            {order.upi_reference
              ? `We have reference ${order.upi_reference} on file and are verifying it.`
              : 'Add your UPI reference so we can match your payment faster.'}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="UPI reference / UTR"
              maxLength={64}
              className="flex-1"
              aria-label="UPI reference"
            />
            <Button
              variant="secondary"
              onClick={handleReference}
              loading={savingReference}
              disabled={utr.trim().length < 4}
            >
              Save reference
            </Button>
          </div>
        </Card>
      ) : null}

      {cancellable ? (
        <div className="mt-gutter flex justify-end">
          <Button variant="ghost" icon="close" onClick={handleCancel} loading={cancelling}>
            Cancel this order
          </Button>
        </div>
      ) : null}
    </div>
  )
}
