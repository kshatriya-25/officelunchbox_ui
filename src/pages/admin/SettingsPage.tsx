import { useEffect, useState } from 'react'
import { useGetSettingsQuery, useUpdateSettingsMutation, useUploadUpiQrMutation } from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { Alert, Button, Card, Field, ImagePicker, Input, PageHeader, PageSkeleton } from '../../components/ui'
import { mediaUrl } from '../../config'

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetSettingsQuery()
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation()
  const [uploadQr, { isLoading: uploading }] = useUploadUpiQrMutation()

  const [form, setForm] = useState({
    default_markup_percent: '',
    gst_percent: '',
    delivery_fee: '',
    upi_id: '',
    upi_payee_name: '',
    support_contact: '',
    support_note: '',
  })
  const [reprice, setReprice] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!settings) return
    setForm({
      default_markup_percent: settings.default_markup_percent,
      gst_percent: settings.gst_percent,
      delivery_fee: settings.delivery_fee,
      upi_id: settings.upi_id ?? '',
      upi_payee_name: settings.upi_payee_name ?? '',
      support_contact: settings.support_contact ?? '',
      support_note: settings.support_note ?? '',
    })
  }, [settings])

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Configuration"
        title="Settings"
      description="Pricing defaults and the UPI details customers pay into."
        rows={5}
      />
    )

  const markupChanged =
    settings != null && Number(form.default_markup_percent) !== Number(settings.default_markup_percent)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    try {
      await updateSettings({
        default_markup_percent: form.default_markup_percent,
        gst_percent: form.gst_percent,
        delivery_fee: form.delivery_fee,
        upi_id: form.upi_id || null,
        upi_payee_name: form.upi_payee_name || null,
        support_contact: form.support_contact || null,
        support_note: form.support_note || null,
        reprice_existing_items: reprice,
      }).unwrap()
      setMessage(reprice ? 'Settings saved and dishes repriced.' : 'Settings saved.')
      setReprice(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not save settings.'))
    }
  }

  async function handleQr(file: File) {
    setMessage('')
    setError('')
    try {
      await uploadQr(file).unwrap()
      setMessage('UPI QR updated. Customers will see it at checkout.')
    } catch (err) {
      setError(errorMessage(err, 'Could not upload that image.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Pricing defaults and the UPI details customers pay into."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-gutter">
        <Card className="p-6">
          <h2 className="font-display text-headline-md text-primary">Pricing</h2>
          <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            The default markup applies to any dish set to "Default". Dishes with their own
            percentage or flat markup are unaffected.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Field label="Default markup (%)">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.default_markup_percent}
                onChange={(e) => setForm({ ...form, default_markup_percent: e.target.value })}
                required
              />
            </Field>
            <Field label="GST (%)" hint="Charged on the food subtotal">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={form.gst_percent}
                onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
                required
              />
            </Field>
            <Field label="Delivery fee (₹)" hint="0 shows as 'Free'">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
                required
              />
            </Field>
          </div>

          {markupChanged ? (
            <div className="mt-5">
              <Alert tone="warning" title="You changed the default markup">
                Existing dishes keep their current prices unless you ask for them to be recalculated.
                <label className="mt-2 flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={reprice}
                    onChange={(e) => setReprice(e.target.checked)}
                    className="h-4 w-4 accent-[#1b6b44]"
                  />
                  Reprice every dish on the default markup
                </label>
              </Alert>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-headline-md text-primary">UPI payment</h2>
          <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            Shown at checkout. There's no payment gateway — you reconcile these manually.
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-[200px_1fr] md:items-start">
            {/* Uploads immediately — unlike the dish photo, the settings row
                already exists, so there is nothing to stage it against. */}
            <ImagePicker
              previewUrl={mediaUrl(settings?.upi_qr_path)}
              onSelect={handleQr}
              busy={uploading}
              emptyIcon="qr_code_2"
              emptyLabel="Upload your UPI QR"
              hint="Customers scan this at checkout."
            />

            <div className="flex flex-col gap-5">
              <Field label="UPI ID">
                <Input
                  value={form.upi_id}
                  onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                  placeholder="mealhub@okicici"
                />
              </Field>
              <Field label="Payee name">
                <Input
                  value={form.upi_payee_name}
                  onChange={(e) => setForm({ ...form, upi_payee_name: e.target.value })}
                  placeholder="Mealhub"
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-headline-md text-primary">Support</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Support contact">
              <Input
                value={form.support_contact}
                onChange={(e) => setForm({ ...form, support_contact: e.target.value })}
                placeholder="+91 98400 00000"
              />
            </Field>
            <Field label="Help note" hint="Shown on the menu screen">
              <Input
                value={form.support_note}
                onChange={(e) => setForm({ ...form, support_note: e.target.value })}
                placeholder="Contact your tech park coordinator"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon="save">
            Save settings
          </Button>
        </div>
      </form>
    </>
  )
}
