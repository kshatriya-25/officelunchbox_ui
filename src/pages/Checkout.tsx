import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  useGetLocationsQuery,
  useGetPublicSettingsQuery,
  useGetWindowQuery,
  usePlaceOrderMutation,
} from '../store/api'
import { errorMessage } from '../store/baseQuery'
import { useAppDispatch, useAppSelector } from '../store'
import { clearCart, setDropZone, setNote } from '../store/cartSlice'
import { formatMoney, formatTime } from '../lib/format'
import { Alert, Button, Card, Field, FoodDot, Icon, Input, Select } from '../components/ui'

export default function Checkout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const cart = useAppSelector((state) => state.cart)
  const user = useAppSelector((state) => state.auth.user)

  const { data: settings } = useGetPublicSettingsQuery()
  const { data: window } = useGetWindowQuery(undefined, { pollingInterval: 30_000 })
  const { data: locations = [] } = useGetLocationsQuery()
  const [placeOrder, { isLoading }] = usePlaceOrderMutation()

  const [utr, setUtr] = useState('')
  const [error, setError] = useState('')

  // Only active zones are offered. A retired zone is still on the customer's
  // profile as a default, and preselecting it sends an order the server will
  // reject with a 404 the customer can do nothing about.
  const zones = useMemo(
    () =>
      locations.flatMap((location) =>
        location.drop_zones
          .filter((z) => z.is_active)
          .map((z) => ({ ...z, location: location.name })),
      ),
    [locations],
  )

  const preferredZoneId = cart.dropZoneId ?? user?.default_drop_zone_id ?? null
  const zoneIsUsable = zones.some((z) => z.id === preferredZoneId)
  const selectedZoneId = zoneIsUsable ? preferredZoneId : null
  const defaultZoneRetired = preferredZoneId !== null && !zoneIsUsable && zones.length > 0

  const totals = useMemo(() => {
    const subtotal = cart.lines.reduce((sum, l) => sum + Number(l.unit_price) * l.quantity, 0)
    const gstPercent = Number(settings?.gst_percent ?? 0)
    const deliveryFee = Number(settings?.delivery_fee ?? 0)
    const gstAmount = Math.round(subtotal * gstPercent) / 100
    return { subtotal, gstAmount, deliveryFee, total: subtotal + gstAmount + deliveryFee }
  }, [cart.lines, settings])

  if (cart.lines.length === 0) return <Navigate to="/menu" replace />

  const canOrder = Boolean(window?.is_open)

  async function handlePlaceOrder() {
    setError('')
    try {
      const order = await placeOrder({
        items: cart.lines.map((line) => ({
          menu_item_id: line.menu_item_id,
          quantity: line.quantity,
        })),
        drop_zone_id: selectedZoneId,
        customer_note: cart.note || undefined,
        upi_reference: utr.trim() || undefined,
      }).unwrap()

      dispatch(clearCart())
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not place your order.'))
    }
  }

  // A UPI deep link so a phone can open its payment app directly instead of
  // scanning a QR shown on that same phone.
  const upiLink = settings?.upi_id
    ? `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(
        settings.upi_payee_name ?? 'Mealhub',
      )}&am=${totals.total.toFixed(2)}&cu=INR`
    : null

  return (
    <div className="page py-8">
      <Link
        to="/menu"
        className="mb-6 inline-flex items-center gap-1.5 text-label-lg text-on-surface-variant hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" /> Back to menu
      </Link>

      <h1 className="font-display text-headline-lg text-primary">Review & pay</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        Confirm where your box goes, pay by UPI, then place the order.
      </p>

      {error ? <div className="mt-6"><Alert tone="danger">{error}</Alert></div> : null}

      {defaultZoneRetired ? (
        <div className="mt-6">
          <Alert tone="warning" title="Your usual drop point is no longer in service">
            Pick another one below. Update it in your profile to make the change stick.
          </Alert>
        </div>
      ) : null}

      {!canOrder ? (
        <div className="mt-6">
          <Alert tone="danger" title={window?.reason ?? 'Ordering is closed'}>
            Your cart is saved — you can place this order when the next window opens.
          </Alert>
        </div>
      ) : null}

      <div className="mt-8 grid gap-gutter lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="flex flex-col gap-gutter">
          {/* ── Delivery ── */}
          <Card className="p-6">
            <h2 className="font-display text-headline-md text-primary">Delivery</h2>
            <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
              We hand boxes over at your drop point — there's no doorstep delivery inside the park.
            </p>

            <div className="mt-5 grid gap-5">
              <Field label="Drop zone">
                <Select
                  value={selectedZoneId ?? ''}
                  onChange={(e) => dispatch(setDropZone(e.target.value ? Number(e.target.value) : null))}
                  required
                >
                  <option value="">Select where to drop your box…</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.location} — {zone.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Note for the kitchen" hint="Allergies, spice level, anything else">
                <Input
                  value={cart.note}
                  onChange={(e) => dispatch(setNote(e.target.value))}
                  placeholder="Optional"
                  maxLength={500}
                />
              </Field>
            </div>

            {window?.delivery_eta ? (
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-secondary-container/40 px-4 py-3 text-on-secondary-fixed">
                <Icon name="schedule" className="text-[18px]" />
                <span className="text-label-lg">
                  Expected at your drop point around {formatTime(window.delivery_eta)}
                </span>
              </div>
            ) : null}
          </Card>

          {/* ── Payment ── */}
          <Card className="p-6">
            <h2 className="font-display text-headline-md text-primary">Pay by UPI</h2>
            <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
              Scan the code or use the UPI ID below, then place your order. Our team matches the
              payment against your token before delivery.
            </p>

            <div className="mt-5 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                {settings?.upi_qr_path ? (
                  <img
                    src={`/${settings.upi_qr_path}`}
                    alt="UPI QR code for payment"
                    className="h-40 w-40 object-contain"
                  />
                ) : (
                  <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-lg bg-surface-container text-center">
                    <Icon name="qr_code_2" className="text-[32px] text-outline" />
                    <span className="px-2 text-label-md text-on-surface-variant">
                      QR not uploaded yet
                    </span>
                  </div>
                )}
                <span className="font-display text-body-lg font-bold text-primary tabular">
                  {formatMoney(totals.total)}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {settings?.upi_id ? (
                  <div>
                    <p className="label-caps">UPI ID</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 truncate rounded border border-outline-variant bg-surface-container px-3 py-2 text-body-md">
                        {settings.upi_id}
                      </code>
                      <Button
                        variant="secondary"
                        icon="content_copy"
                        onClick={() => navigator.clipboard?.writeText(settings.upi_id!)}
                        className="px-3"
                        aria-label="Copy UPI ID"
                      >
                        Copy
                      </Button>
                    </div>
                    {settings.upi_payee_name ? (
                      <p className="mt-1.5 text-label-md text-on-surface-variant">
                        Payee: {settings.upi_payee_name}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {upiLink ? (
                  <a href={upiLink} className="sm:hidden">
                    <Button variant="secondary" icon="account_balance" className="w-full">
                      Open a UPI app
                    </Button>
                  </a>
                ) : null}

                <Field
                  label="UPI reference / UTR"
                  hint="Optional, but it makes reconciliation much faster"
                >
                  <Input
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="e.g. 412233445566"
                    maxLength={64}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5">
              <Alert tone="info">
                Your order is confirmed as soon as you place it. Payment is verified separately by
                our team — you don't need to wait.
              </Alert>
            </div>
          </Card>
        </div>

        {/* ── Summary ── */}
        <aside className="lg:sticky lg:top-28">
          <Card className="overflow-hidden">
            <h2 className="border-b border-outline-variant/50 px-5 py-4 font-display text-headline-md text-primary">
              Order summary
            </h2>

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
                <dt className="text-on-surface-variant">GST ({Number(settings?.gst_percent ?? 0)}%)</dt>
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
                loading={isLoading}
                disabled={!canOrder || !selectedZoneId}
                onClick={handlePlaceOrder}
                icon="check"
              >
                Place order ({formatMoney(totals.total)})
              </Button>
              {!selectedZoneId ? (
                <p className="mt-3 text-center text-label-md text-error">
                  Choose a drop zone to continue.
                </p>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
