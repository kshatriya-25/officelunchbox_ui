import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useGetLocationsQuery, useRegisterMutation } from '../store/api'
import { errorMessage } from '../store/baseQuery'
import { useAppDispatch, useAppSelector } from '../store'
import { credentialsReceived } from '../store/authSlice'
import { Alert, Button, Field, Icon, Input, Select } from '../components/ui'

const PASSWORD_RULE =
  'At least 8 characters with an uppercase letter, a lowercase letter, a digit and a symbol.'

export default function Register() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const { data: locations = [] } = useGetLocationsQuery()
  const [register, { isLoading }] = useRegisterMutation()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    default_location_id: '',
    default_drop_zone_id: '',
  })
  const [error, setError] = useState('')

  // Drop zones are meaningless outside their tech park, so the second select
  // only ever offers zones belonging to the chosen location.
  const dropZones = useMemo(() => {
    const location = locations.find((l) => String(l.id) === form.default_location_id)
    return location?.drop_zones ?? []
  }, [locations, form.default_location_id])

  if (accessToken) return <Navigate to="/menu" replace />

  function update(field: string, value: string) {
    setForm((previous) => {
      const next = { ...previous, [field]: value }
      // Changing park invalidates whatever zone was picked under the old one.
      if (field === 'default_location_id') next.default_drop_zone_id = ''
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const tokens = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        default_location_id: form.default_location_id ? Number(form.default_location_id) : undefined,
        default_drop_zone_id: form.default_drop_zone_id ? Number(form.default_drop_zone_id) : undefined,
      }).unwrap()

      dispatch(credentialsReceived(tokens))
      navigate('/menu', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container">
            <Icon name="lunch_dining" className="text-[28px] text-tertiary-fixed-dim" />
          </span>
          <h1 className="font-display text-headline-lg text-primary">Create your account</h1>
          <p className="text-body-md text-on-surface-variant">
            Tell us where you sit and we'll drop lunch there.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-5 p-6">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </Field>
            <Field label="Phone" hint="Used only if there's a problem with your order">
              <Input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
              />
            </Field>
          </div>

          <Field label="Work email" hint="You'll sign in with this">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password" hint={PASSWORD_RULE}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Tech park">
              <Select
                value={form.default_location_id}
                onChange={(e) => update('default_location_id', e.target.value)}
                required
              >
                <option value="">Select your park…</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Drop zone" hint="Where you'll collect your box">
              <Select
                value={form.default_drop_zone_id}
                onChange={(e) => update('default_drop_zone_id', e.target.value)}
                disabled={!form.default_location_id}
                required
              >
                <option value="">
                  {form.default_location_id ? 'Select a drop point…' : 'Pick a park first'}
                </option>
                {dropZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>


          <Button type="submit" loading={isLoading} className="w-full">
            Create account
          </Button>

          <p className="text-center text-body-md text-on-surface-variant">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-secondary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
