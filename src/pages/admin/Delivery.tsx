import { useState } from 'react'
import {
  useAssignDeliveryMutation,
  useCreateDeliveryPersonMutation,
  useGetAdminOrdersQuery,
  useGetDeliveryPersonsQuery,
  useUpdateDeliveryPersonMutation,
} from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatMoney, todayISO } from '../../lib/format'
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Input, Select, PageHeader, PageSkeleton } from '../../components/ui'

export default function Delivery() {
  const { data: riders = [], isLoading } = useGetDeliveryPersonsQuery()
  const { data: orderList } = useGetAdminOrdersQuery({
    service_date: todayISO(),
    status: 'active',
    page_size: 200,
  })

  const [createRider, { isLoading: creating }] = useCreateDeliveryPersonMutation()
  const [updateRider] = useUpdateDeliveryPersonMutation()
  const [assign, { isLoading: assigning }] = useAssignDeliveryMutation()

  const [form, setForm] = useState({ name: '', phone: '', vehicle_number: '' })
  const [selected, setSelected] = useState<number[]>([])
  const [riderId, setRiderId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Service"
        title="Delivery"
      description="Who's carrying which boxes today. Routing is manual — this is the record of who took what."
        rows={5}
      />
    )

  const orders = orderList?.orders ?? []
  const unassigned = orders.filter((order) => !order.delivery_person_id)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createRider({
        name: form.name,
        phone: form.phone,
        vehicle_number: form.vehicle_number || undefined,
      }).unwrap()
      setMessage(`Added ${form.name}.`)
      setForm({ name: '', phone: '', vehicle_number: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not add that delivery person.'))
    }
  }

  async function handleAssign() {
    setError('')
    setMessage('')
    try {
      await assign({ order_ids: selected, delivery_person_id: Number(riderId) }).unwrap()
      setMessage(`Assigned ${selected.length} order(s).`)
      setSelected([])
    } catch (err) {
      setError(errorMessage(err, 'Could not assign those orders.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Delivery"
        description="Who's carrying which boxes today. Routing is manual — this is the record of who took what."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Team ── */}
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {riders.map((rider) => (
          <Card key={rider.id} className={`p-5 ${rider.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container font-display text-body-lg font-bold text-on-secondary-fixed">
                {rider.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-body-lg font-semibold text-primary">
                  {rider.name}
                </p>
                <p className="text-label-lg font-normal tracking-normal text-on-surface-variant">
                  {rider.phone}
                </p>
                {rider.vehicle_number ? (
                  <p className="text-label-md text-on-surface-variant">{rider.vehicle_number}</p>
                ) : null}
              </div>
              <Badge tone={rider.active_orders > 0 ? 'success' : 'neutral'}>
                {rider.active_orders} box{rider.active_orders === 1 ? '' : 'es'}
              </Badge>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                icon={rider.is_active ? 'person_off' : 'person_check'}
                onClick={() => updateRider({ id: rider.id, is_active: !rider.is_active })}
                className="text-label-md"
              >
                {rider.is_active ? 'Mark off-duty' : 'Mark active'}
              </Button>
            </div>
          </Card>
        ))}

        {riders.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState icon="local_shipping" title="No delivery people yet">
              Add whoever is carrying boxes to the tech park.
            </EmptyState>
          </Card>
        ) : null}
      </div>

      {/* ── Add ── */}
      <Card className="p-6">
        <h2 className="mb-5 font-display text-headline-md text-primary">Add a delivery person</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </Field>
            <Field label="Vehicle number" hint="Optional">
              <Input
                value={form.vehicle_number}
                onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                placeholder="TN 09 BX 4412"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={creating} icon="add">
              Add
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Assign ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/50 px-5 py-4">
          <h2 className="font-display text-headline-md text-primary">
            Unassigned today ({unassigned.length})
          </h2>
          {selected.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select
                value={riderId}
                onChange={(e) => setRiderId(e.target.value)}
                className="py-2 text-label-lg"
                aria-label="Choose a delivery person"
              >
                <option value="">Choose a rider…</option>
                {riders
                  .filter((rider) => rider.is_active)
                  .map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.name}
                    </option>
                  ))}
              </Select>
              <Button onClick={handleAssign} loading={assigning} disabled={!riderId} icon="local_shipping">
                Assign {selected.length}
              </Button>
            </div>
          ) : null}
        </div>

        {unassigned.length === 0 ? (
          <EmptyState icon="check_circle" title="Every order has a rider">
            Nothing left to hand out today.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {unassigned.map((order) => (
              <li key={order.id} className="flex items-center gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={selected.includes(order.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, order.id] : prev.filter((id) => id !== order.id),
                    )
                  }
                  className="h-4 w-4 accent-[#1b6b44]"
                  aria-label={`Select order ${order.token}`}
                />
                <span className="w-14 font-display text-body-lg font-bold text-primary tabular">
                  {order.token}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md text-primary">{order.drop_zone_name}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {order.location_name} · {order.customer_name}
                  </p>
                </div>
                {order.payment_status !== 'PAID' ? (
                  <Badge tone="danger">Collect {formatMoney(order.total)}</Badge>
                ) : (
                  <Badge tone="success">Paid</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Download the run sheet from Exports — it groups every box by drop point and flags unpaid orders.
      </p>
    </>
  )
}
