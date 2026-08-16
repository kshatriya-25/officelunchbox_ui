import { useState } from 'react'
import {
  useCreateCategoryMutation,
  useCreateVendorMutation,
  useGetCategoriesQuery,
  useGetVendorsQuery,
  useUpdateVendorMutation,
} from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, Input, PageHeader, PageSkeleton } from '../../components/ui'

const BLANK = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  gst_number: '',
}

export default function Vendors() {
  const { data: vendors = [], isLoading } = useGetVendorsQuery(true)
  const { data: categories = [] } = useGetCategoriesQuery()
  const [createVendor, { isLoading: creating }] = useCreateVendorMutation()
  const [updateVendor] = useUpdateVendorMutation()
  const [createCategory, { isLoading: addingCategory }] = useCreateCategoryMutation()

  const [form, setForm] = useState(BLANK)
  const [categoryName, setCategoryName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Catalogue"
        title="Vendors"
      description="The kitchens you buy from. Each dish belongs to exactly one vendor, which is how their order sheet gets built."
        rows={5}
      />
    )

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await createVendor({
        ...form,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        gst_number: form.gst_number || null,
      } as never).unwrap()
      setMessage(`Added ${form.name}.`)
      setForm(BLANK)
    } catch (err) {
      setError(errorMessage(err, 'Could not add that vendor.'))
    }
  }

  async function handleCategory(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await createCategory({ name: categoryName, sort_order: categories.length + 1 }).unwrap()
      setMessage(`Added category ${categoryName}.`)
      setCategoryName('')
    } catch (err) {
      setError(errorMessage(err, 'Could not add that category.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Vendors"
        description="The kitchens you buy from. Each dish belongs to exactly one vendor, which is how their order sheet gets built."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="p-6">
        <h2 className="mb-5 font-display text-headline-md text-primary">Add a vendor</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Vendor name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Contact person">
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="GSTIN">
              <Input
                value={form.gst_number}
                onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                placeholder="Optional"
              />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={creating} icon="add">
              Add vendor
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-outline-variant/50 px-5 py-4 font-display text-headline-md text-primary">
          All vendors ({vendors.length})
        </h2>

        {vendors.length === 0 ? (
          <EmptyState icon="storefront" title="No vendors yet">
            Add the kitchens you're partnering with.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {vendors.map((vendor) => (
              <li
                key={vendor.id}
                className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center ${
                  vendor.is_active ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-display text-body-lg font-semibold text-primary">
                    {vendor.name}
                    {vendor.is_active ? null : <Badge tone="neutral">Retired</Badge>}
                  </p>
                  <p className="text-label-lg font-normal tracking-normal text-on-surface-variant">
                    {[vendor.contact_person, vendor.phone, vendor.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {vendor.gst_number ? (
                    <p className="text-label-md text-on-surface-variant">GSTIN {vendor.gst_number}</p>
                  ) : null}
                </div>

                <Button
                  variant={vendor.is_active ? 'ghost' : 'secondary'}
                  icon={vendor.is_active ? 'visibility_off' : 'restore'}
                  onClick={() => updateVendor({ id: vendor.id, is_active: !vendor.is_active })}
                >
                  {vendor.is_active ? 'Retire' : 'Restore'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Categories ── */}
      <Card className="p-6">
        <h2 className="font-display text-headline-md text-primary">Menu categories</h2>
        <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
          These become the tabs customers browse by.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge key={category.id} tone="info">
              {category.name}
            </Badge>
          ))}
          {categories.length === 0 ? (
            <span className="text-body-md text-on-surface-variant">None yet.</span>
          ) : null}
        </div>

        <form onSubmit={handleCategory} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g. Today's Special"
            className="flex-1"
            aria-label="New category name"
            required
          />
          <Button type="submit" variant="secondary" loading={addingCategory} icon="add">
            Add category
          </Button>
        </form>
      </Card>

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Retiring a vendor also hides all of its dishes. Historical orders keep their records.
      </p>
    </>
  )
}
