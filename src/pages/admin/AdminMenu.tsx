import { useEffect, useMemo, useState } from 'react'
import {
  useCreateMenuItemMutation,
  useDeleteMenuItemMutation,
  useGetCategoriesQuery,
  useGetMenuItemsQuery,
  useGetSettingsQuery,
  useGetVendorsQuery,
  useUpdateMenuItemMutation,
  useUploadMenuItemImageMutation,
} from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatMoney } from '../../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FoodDot,
  Icon,
  ImagePicker,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '../../components/ui'
import type { MenuItemAdmin } from '../../types'

const BLANK = {
  name: '',
  description: '',
  vendor_id: '',
  category_id: '',
  food_type: 'VEG',
  calories: '',
  vendor_price: '',
  markup_type: 'DEFAULT',
  markup_value: '',
}

/** Mirrors the server's pricing rule so the admin sees the price before saving. */
function previewPrice(
  vendorPrice: string,
  markupType: string,
  markupValue: string,
  defaultPercent: string,
): number | null {
  const cost = Number(vendorPrice)
  if (!Number.isFinite(cost) || vendorPrice === '') return null

  if (markupType === 'FLAT') return cost + Number(markupValue || 0)
  const percent = markupType === 'PERCENT' ? Number(markupValue || 0) : Number(defaultPercent || 0)
  return Math.round(cost * (1 + percent / 100) * 100) / 100
}

export default function AdminMenu() {
  const { data: items = [], isLoading } = useGetMenuItemsQuery({ include_inactive: true })
  const { data: vendors = [] } = useGetVendorsQuery()
  const { data: categories = [] } = useGetCategoriesQuery()
  const { data: settings } = useGetSettingsQuery()

  const [createItem, { isLoading: creating }] = useCreateMenuItemMutation()
  const [updateItem] = useUpdateMenuItemMutation()
  const [deleteItem] = useDeleteMenuItemMutation()
  const [uploadImage, { isLoading: uploading }] = useUploadMenuItemImageMutation()

  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState<MenuItemAdmin | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // The photo is staged locally until the dish is saved: a new dish has no id
  // to upload against yet, so the upload runs straight after the create call.
  const [photo, setPhoto] = useState<File | null>(null)
  const stagedUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => () => { if (stagedUrl) URL.revokeObjectURL(stagedUrl) }, [stagedUrl])

  const photoPreview = stagedUrl ?? (editing?.image_path ? `/${editing.image_path}` : null)

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Catalogue"
        title="Menu & Pricing"
      description="Vendor cost plus your markup gives the customer price. Customers only ever see the final price."
        rows={6}
      />
    )

  const preview = previewPrice(
    form.vendor_price,
    form.markup_type,
    form.markup_value,
    settings?.default_markup_percent ?? '0',
  )

  function startEdit(item: MenuItemAdmin) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      vendor_id: String(item.vendor_id),
      category_id: String(item.category_id),
      food_type: item.food_type,
      calories: item.calories ? String(item.calories) : '',
      vendor_price: item.vendor_price,
      markup_type: item.markup_type,
      markup_value: item.markup_value ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditing(null)
    setForm(BLANK)
    setPhoto(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      vendor_id: Number(form.vendor_id),
      category_id: Number(form.category_id),
      food_type: form.food_type,
      calories: form.calories ? Number(form.calories) : null,
      vendor_price: form.vendor_price,
      markup_type: form.markup_type,
      markup_value: form.markup_type === 'DEFAULT' ? null : form.markup_value,
    }

    try {
      const saved = editing
        ? await updateItem({ id: editing.id, ...payload }).unwrap()
        : await createItem(payload).unwrap()

      // The dish exists now, so the staged photo has an id to attach to.
      if (photo) {
        try {
          await uploadImage({ id: saved.id, file: photo }).unwrap()
        } catch (err) {
          // The dish itself saved — say so rather than implying it all failed.
          setError(
            `${form.name} was saved, but the photo didn't upload: ${errorMessage(err, 'unknown error')}`,
          )
          reset()
          return
        }
      }

      setMessage(
        `${editing ? 'Updated' : 'Added'} ${form.name}${photo ? ' with its photo' : ''}.`,
      )
      reset()
    } catch (err) {
      setError(errorMessage(err, 'Could not save that dish.'))
    }
  }

  async function handleImage(item: MenuItemAdmin, file: File) {
    setError('')
    try {
      await uploadImage({ id: item.id, file }).unwrap()
      setMessage(`Photo updated for ${item.name}.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not upload that image.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Menu & Pricing"
        description="Vendor cost plus your markup gives the customer price. Customers only ever see the final price."
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Add / edit ── */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-headline-md text-primary">
            {editing ? `Edit "${editing.name}"` : 'Add a dish'}
          </h2>
          {editing ? (
            <Button variant="ghost" onClick={reset} icon="close">
              Cancel
            </Button>
          ) : null}
        </div>

        {vendors.length === 0 || categories.length === 0 ? (
          <Alert tone="warning">
            Add at least one vendor and one category before creating dishes.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-5 md:grid-cols-[260px_1fr] md:items-start">
              <div>
                <span className="mb-1.5 block text-label-lg font-semibold text-on-surface-variant">
                  Dish photo
                </span>
                <ImagePicker
                  previewUrl={photoPreview}
                  onSelect={setPhoto}
                  onClear={photo ? () => setPhoto(null) : undefined}
                  busy={uploading}
                  emptyLabel="Add a photo"
                  hint={
                    editing && !photo
                      ? 'Pick a new image to replace the current one.'
                      : 'JPG, PNG or WebP · up to 5 MB'
                  }
                />
              </div>

              <div className="flex flex-col gap-5">
                <Field label="Dish name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Description">
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What's in the box?"
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <Field label="Vendor">
                <Select
                  value={form.vendor_id}
                  onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type">
                <Select
                  value={form.food_type}
                  onChange={(e) => setForm({ ...form, food_type: e.target.value })}
                >
                  <option value="VEG">Vegetarian</option>
                  <option value="NON_VEG">Non-vegetarian</option>
                  <option value="EGG">Contains egg</option>
                </Select>
              </Field>
              <Field label="Calories">
                <Input
                  type="number"
                  min={0}
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <Field label="Vendor price" hint="What the vendor charges us">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.vendor_price}
                  onChange={(e) => setForm({ ...form, vendor_price: e.target.value })}
                  required
                />
              </Field>
              <Field label="Markup type">
                <Select
                  value={form.markup_type}
                  onChange={(e) => setForm({ ...form, markup_type: e.target.value })}
                >
                  <option value="DEFAULT">
                    Default ({settings?.default_markup_percent ?? 0}%)
                  </option>
                  <option value="PERCENT">Percentage</option>
                  <option value="FLAT">Flat amount</option>
                </Select>
              </Field>
              <Field
                label={form.markup_type === 'FLAT' ? 'Markup (₹)' : 'Markup (%)'}
                hint={form.markup_type === 'DEFAULT' ? 'Uses the global default' : undefined}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.markup_value}
                  onChange={(e) => setForm({ ...form, markup_value: e.target.value })}
                  disabled={form.markup_type === 'DEFAULT'}
                  required={form.markup_type !== 'DEFAULT'}
                />
              </Field>
              <Field label="Customer pays" hint="Calculated for you">
                <div className="flex h-[46px] items-center rounded border border-outline-variant bg-surface-container px-3 font-display text-body-lg font-bold text-secondary tabular">
                  {preview === null ? '—' : formatMoney(preview)}
                </div>
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={creating} icon={editing ? 'save' : 'add'}>
                {editing ? 'Save changes' : 'Add dish'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* ── Catalogue ── */}
      <Card className="overflow-hidden">
        <h2 className="border-b border-outline-variant/50 px-5 py-4 font-display text-headline-md text-primary">
          Catalogue ({items.length})
        </h2>

        {items.length === 0 ? (
          <EmptyState icon="restaurant_menu" title="No dishes yet">
            Add your first dish above.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead className="bg-surface-container-low">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="px-5 py-3 font-semibold">Dish</th>
                  <th className="px-3 py-3 font-semibold">Vendor</th>
                  <th className="px-3 py-3 text-right font-semibold">Cost</th>
                  <th className="px-3 py-3 font-semibold">Markup</th>
                  <th className="px-3 py-3 text-right font-semibold">Sells at</th>
                  <th className="px-3 py-3 text-right font-semibold">Margin</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-surface-container-low ${item.is_active ? '' : 'opacity-50'}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* The thumbnail is the upload target — the most obvious
                            place to click when you want to change a photo. */}
                        <label
                          className="group relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded"
                          title={item.image_path ? `Replace photo for ${item.name}` : `Add a photo to ${item.name}`}
                        >
                          {item.image_path ? (
                            <img src={`/${item.image_path}`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center bg-surface-container">
                              <Icon name="add_photo_alternate" className="text-[18px] text-outline" />
                            </span>
                          )}
                          <span className="absolute inset-0 hidden items-center justify-center bg-inverse-surface/60 group-hover:flex">
                            <Icon name="photo_camera" className="text-[16px] text-white" />
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImage(item, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        <div>
                          <p className="flex items-center gap-1.5 text-body-md font-medium text-primary">
                            <FoodDot type={item.food_type} />
                            {item.name}
                          </p>
                          <p className="text-label-md text-on-surface-variant">
                            {item.category_name}
                            {item.is_active ? '' : ' · inactive'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-label-lg font-normal tracking-normal text-on-surface-variant">
                      {item.vendor_name}
                    </td>
                    <td className="px-3 py-3 text-right text-body-md tabular">
                      {formatMoney(item.vendor_price)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone="neutral">
                        {item.markup_type === 'DEFAULT'
                          ? `Default ${settings?.default_markup_percent ?? 0}%`
                          : item.markup_type === 'PERCENT'
                            ? `${item.markup_value}%`
                            : `+${formatMoney(item.markup_value)}`}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right font-display text-body-lg font-bold text-primary tabular">
                      {formatMoney(item.selling_price)}
                    </td>
                    <td className="px-3 py-3 text-right text-body-md font-semibold text-secondary tabular">
                      {formatMoney(item.margin)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Icon name="edit" className="text-[18px]" />
                        </button>

                        <label
                          className="cursor-pointer rounded p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                          title="Upload photo"
                        >
                          <Icon name={uploading ? 'progress_activity' : 'photo_camera'} className="text-[18px]" />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImage(item, file)
                              e.target.value = ''
                            }}
                          />
                        </label>

                        {item.is_active ? (
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="rounded p-2 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                            aria-label={`Retire ${item.name}`}
                          >
                            <Icon name="visibility_off" className="text-[18px]" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateItem({ id: item.id, is_active: true })}
                            className="rounded p-2 text-on-surface-variant hover:bg-secondary-container"
                            aria-label={`Restore ${item.name}`}
                          >
                            <Icon name="visibility" className="text-[18px]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
