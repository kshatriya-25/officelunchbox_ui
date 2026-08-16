import { useEffect, useState } from 'react'
import { useGetWindowQuery, useListWindowsQuery, useUpsertWindowMutation } from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatDate, formatTime, todayISO } from '../../lib/format'
import { Alert, Badge, Button, Card, Field, Icon, Input, PageHeader, PageSkeleton } from '../../components/ui'

/** "2026-08-03T05:45:00Z" -> "11:15" in the browser's local clock. */
function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function WindowSettings() {
  const [serviceDate, setServiceDate] = useState(todayISO())
  const { data: current, isLoading } = useGetWindowQuery()
  const { data: history = [] } = useListWindowsQuery()
  const [upsert, { isLoading: saving }] = useUpsertWindowMutation()

  const [form, setForm] = useState({
    opens_at: '08:00',
    cutoff_at: '11:15',
    delivery_eta: '12:45',
    is_accepting: true,
    notes: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Pre-fill from the window already configured for the chosen date, so editing
  // today's cutoff doesn't mean retyping every field.
  useEffect(() => {
    const existing = history.find((w) => w.service_date === serviceDate)
    if (!existing) return
    setForm({
      opens_at: toTimeInput(existing.opens_at),
      cutoff_at: toTimeInput(existing.cutoff_at),
      delivery_eta: toTimeInput(existing.delivery_eta),
      is_accepting: existing.is_accepting,
      notes: existing.notes ?? '',
    })
  }, [serviceDate, history])

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Configuration"
        title="Order Window"
      description="Orders can only be placed between these times. Customers see a live countdown to the cutoff."
        rows={4}
      />
    )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await upsert({
        service_date: serviceDate,
        opens_at: `${form.opens_at}:00`,
        cutoff_at: `${form.cutoff_at}:00`,
        delivery_eta: form.delivery_eta ? `${form.delivery_eta}:00` : null,
        is_accepting: form.is_accepting,
        notes: form.notes || null,
      }).unwrap()
      setMessage(`Window saved for ${serviceDate}.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the window.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Order Window"
        description="Orders can only be placed between these times. Customers see a live countdown to the cutoff."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Today at a glance ── */}
      <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <div>
          <p className="label-caps">Right now</p>
          <p className="mt-1 flex items-center gap-2 font-display text-body-lg font-semibold text-primary">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                current?.is_open ? 'bg-secondary' : 'bg-error'
              }`}
            />
            {current?.is_open ? 'Open' : 'Closed'}
          </p>
        </div>
        <div>
          <p className="label-caps">Opens</p>
          <p className="mt-1 font-display text-body-lg text-primary tabular">
            {formatTime(current?.opens_at)}
          </p>
        </div>
        <div>
          <p className="label-caps">Cutoff</p>
          <p className="mt-1 font-display text-body-lg text-primary tabular">
            {formatTime(current?.cutoff_at)}
          </p>
        </div>
        <div>
          <p className="label-caps">Delivery</p>
          <p className="mt-1 font-display text-body-lg text-primary tabular">
            {formatTime(current?.delivery_eta)}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 font-display text-headline-md text-primary">Set a window</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-4">
            <Field label="Service date">
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Orders open">
              <Input
                type="time"
                value={form.opens_at}
                onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
                required
              />
            </Field>
            <Field label="Cutoff" hint="Last moment to order">
              <Input
                type="time"
                value={form.cutoff_at}
                onChange={(e) => setForm({ ...form, cutoff_at: e.target.value })}
                required
              />
            </Field>
            <Field label="Delivery ETA" hint="Shown on the ticket">
              <Input
                type="time"
                value={form.delivery_eta}
                onChange={(e) => setForm({ ...form, delivery_eta: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes" hint="Internal only">
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Diwali — kitchen closes early"
            />
          </Field>

          <label className="flex items-center gap-2 text-body-md">
            <input
              type="checkbox"
              checked={form.is_accepting}
              onChange={(e) => setForm({ ...form, is_accepting: e.target.checked })}
              className="h-4 w-4 accent-[#1b6b44]"
            />
            Accept orders during this window
          </label>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} icon="save">
              Save window
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-outline-variant/50 px-5 py-4 font-display text-headline-md text-primary">
          Recent windows
        </h2>
        <ul className="divide-y divide-outline-variant/40">
          {history.slice(0, 14).map((window) => (
            <li key={window.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-32 font-display text-body-md font-semibold text-primary">
                {formatDate(window.service_date)}
              </span>
              <span className="text-body-md text-on-surface-variant tabular">
                {formatTime(window.opens_at)} → {formatTime(window.cutoff_at)}
              </span>
              <span className="text-label-md text-on-surface-variant">
                delivery {formatTime(window.delivery_eta)}
              </span>
              <span className="ml-auto">
                <Badge tone={window.is_accepting ? 'success' : 'neutral'}>
                  {window.is_accepting ? 'Accepting' : 'Paused'}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Times are in your local clock and stored against {Intl.DateTimeFormat().resolvedOptions().timeZone}.
        The kitchen hub's toggle can pause ordering without changing the cutoff.
      </p>
    </>
  )
}
