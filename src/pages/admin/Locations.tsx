import { useState } from 'react'
import {
  useCreateDropZoneMutation,
  useCreateLocationMutation,
  useDeleteDropZoneMutation,
  useGetLocationsQuery,
} from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { Alert, Button, Card, EmptyState, Field, Icon, Input, PageHeader, PageSkeleton, Select } from '../../components/ui'

export default function Locations() {
  const { data: locations = [], isLoading } = useGetLocationsQuery()
  const [createLocation, { isLoading: creatingLocation }] = useCreateLocationMutation()
  const [createZone, { isLoading: creatingZone }] = useCreateDropZoneMutation()
  const [deleteZone] = useDeleteDropZoneMutation()

  const [locationForm, setLocationForm] = useState({ name: '', city: '', address: '' })
  const [zoneForm, setZoneForm] = useState({ location_id: '', name: '', description: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Configuration"
        title="Locations"
      description="The tech parks you serve and the exact points where boxes are handed over."
        rows={4}
      />
    )

  async function handleLocation(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createLocation({
        name: locationForm.name,
        city: locationForm.city || undefined,
        address: locationForm.address || undefined,
      }).unwrap()
      setMessage(`Added ${locationForm.name}.`)
      setLocationForm({ name: '', city: '', address: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not add that location.'))
    }
  }

  async function handleZone(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createZone({
        location_id: Number(zoneForm.location_id),
        name: zoneForm.name,
        description: zoneForm.description || undefined,
      }).unwrap()
      setMessage(`Added drop zone ${zoneForm.name}.`)
      setZoneForm({ ...zoneForm, name: '', description: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not add that drop zone.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Locations"
        description="The tech parks you serve and the exact points where boxes are handed over."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {locations.length === 0 ? (
        <Card>
          <EmptyState icon="location_on" title="No locations yet">
            Add your first tech park below — customers can't sign up without one.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-gutter md:grid-cols-2">
          {locations.map((location) => (
            <Card key={location.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-body-lg font-semibold text-primary">
                    {location.name}
                  </h2>
                  <p className="text-label-lg font-normal tracking-normal text-on-surface-variant">
                    {[location.address, location.city].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <Icon name="apartment" className="text-[22px] text-outline" />
              </div>

              <p className="label-caps mt-5">Drop zones ({location.drop_zones.length})</p>
              {location.drop_zones.length === 0 ? (
                <p className="mt-2 text-body-md text-on-surface-variant">
                  None yet — add one so customers can pick a handover point.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-outline-variant/40">
                  {location.drop_zones.map((zone) => (
                    <li key={zone.id} className="flex items-center gap-3 py-2.5">
                      <Icon name="pin_drop" className="text-[18px] text-secondary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-md text-primary">{zone.name}</p>
                        {zone.description ? (
                          <p className="truncate text-label-md text-on-surface-variant">
                            {zone.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => deleteZone(zone.id)}
                        className="rounded p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                        aria-label={`Retire ${zone.name}`}
                        title="Retire this drop zone"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-gutter md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-display text-headline-md text-primary">Add a tech park</h2>
          <form onSubmit={handleLocation} className="flex flex-col gap-5">
            <Field label="Name">
              <Input
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                placeholder="Tidel Park"
                required
              />
            </Field>
            <Field label="City">
              <Input
                value={locationForm.city}
                onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                placeholder="Chennai"
              />
            </Field>
            <Field label="Address">
              <Input
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={creatingLocation} icon="add">
                Add location
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-5 font-display text-headline-md text-primary">Add a drop zone</h2>
          <form onSubmit={handleZone} className="flex flex-col gap-5">
            <Field label="Tech park">
              <Select
                value={zoneForm.location_id}
                onChange={(e) => setZoneForm({ ...zoneForm, location_id: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Drop zone name">
              <Input
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                placeholder="Tower A - Lobby Drop-box 04"
                required
              />
            </Field>
            <Field label="Directions" hint="Helps the delivery person find it">
              <Input
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                placeholder="Ground floor, beside the visitor desk"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                type="submit"
                loading={creatingZone}
                disabled={locations.length === 0}
                icon="add"
              >
                Add drop zone
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
