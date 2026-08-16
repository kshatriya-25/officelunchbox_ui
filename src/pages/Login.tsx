import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLoginMutation } from '../store/api'
import { errorMessage } from '../store/baseQuery'
import { useAppDispatch, useAppSelector } from '../store'
import { credentialsReceived } from '../store/authSlice'
import { Alert, Button, Field, Icon, Input } from '../components/ui'

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const [login, { isLoading }] = useLoginMutation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  if (accessToken) return <Navigate to="/menu" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const tokens = await login(form).unwrap()
      dispatch(credentialsReceived(tokens))
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname
      navigate(from ?? '/menu', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container">
            <Icon name="lunch_dining" className="text-[28px] text-tertiary-fixed-dim" />
          </span>
          <h1 className="font-display text-headline-lg text-primary">Mealhub</h1>
          <p className="text-body-md text-on-surface-variant">
            Sign in to order today's lunch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-5 p-6">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Field label="Email" hint="Staff accounts can use their username instead">
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
              placeholder="you@company.com"
              required
              autoFocus
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" loading={isLoading} className="w-full">
            Sign in
          </Button>

          <p className="text-center text-body-md text-on-surface-variant">
            New here?{' '}
            <Link to="/register" className="font-semibold text-secondary hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
