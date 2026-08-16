import { useEffect, useMemo, useState } from 'react'
import { useGetLocationsQuery, useGetProfileQuery, useUpdateProfileMutation } from '../store/api'
import { errorMessage } from '../store/baseQuery'
import { useAppDispatch } from '../store'
import { profileLoaded } from '../store/authSlice'
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../components/ui'

export default function Profile() {
  const dispatch = useAppDispatch()
  const { data: profile, isLoading } = useGetProfileQuery()
  const { data: locations = [] } = useGetLocationsQuery()
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation()

  const [form, setForm] = useState({
    name: '',
    phone: '',
    employee_code: '',
    default_location_id: '',
    default_drop_zone_id: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      employee_code: profile.employee_code ?? '',
      default_location_id: profile.default_location_id ? String(profile.default_location_id) : '',
      default_drop_zone_id: profile.default_drop_zone_id ? String(profile.default_drop_zone_id) : '',
    })
  }, [profile])

  const dropZones = useMemo(() => {
    const location = locations.find((l) => String(l.id) === form.default_location_id)
    return location?.drop_zones ?? []
  }, [locations, form.default_location_id])

  if (isLoading) return <Spinner label="Loading your profile" />

  function update(field: string, value: string) {
    setForm((previous) => {
      const next = { ...previous, [field]: value }
      if (field === 'default_location_id') next.default_drop_zone_id = ''
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      const updated = await updateProfile({
        name: form.name,
        phone: form.phone || null,
        employee_code: form.employee_code || null,
        default_location_id: form.default_location_id ? Number(form.default_location_id) : null,
        default_drop_zone_id: form.default_drop_zone_id ? Number(form.default_drop_zone_id) : null,
      } as never).unwrap()

      dispatch(profileLoaded(updated))
      setMessage('Profile updated.')
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile.'))
    }
  }

  return (
    <div className="page max-w-2xl py-8">
      <h1 className="font-display text-headline-lg text-primary">Your profile</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">
        Set where your lunch should be dropped by default.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Card className="flex flex-col gap-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Username" hint="Cannot be changed">
              <Input value={profile?.username ?? ''} disabled />
            </Field>
            <Field label="Email" hint="Contact an admin to change this">
              <Input value={profile?.email ?? ''} disabled />
            </Field>
          </div>

          <Field label="Employee code" hint="Optional — helps your company reconcile spend">
            <Input
              value={form.employee_code}
              onChange={(e) => update('employee_code', e.target.value)}
            />
          </Field>
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <h2 className="font-display text-headline-md text-primary">Default drop zone</h2>
          <p className="-mt-3 text-label-lg font-normal tracking-normal text-on-surface-variant">
            Pre-filled at checkout. You can still change it order by order.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Tech park">
              <Select
                value={form.default_location_id}
                onChange={(e) => update('default_location_id', e.target.value)}
              >
                <option value="">Not set</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Drop zone">
              <Select
                value={form.default_drop_zone_id}
                onChange={(e) => update('default_drop_zone_id', e.target.value)}
                disabled={!form.default_location_id}
              >
                <option value="">
                  {form.default_location_id ? 'Not set' : 'Pick a park first'}
                </option>
                {dropZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon="save">
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}
