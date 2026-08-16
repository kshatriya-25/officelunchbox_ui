import { useEffect, useMemo, useState } from 'react'
import { useGetDailyMenuQuery, useGetMenuItemsQuery, useSetDailyMenuMutation } from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatMoney, todayISO } from '../../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  PageSkeleton,
} from '../../components/ui'

/**
 * A dish's plan for one service date.
 *
 * `limit === null` means unlimited — the default, because most dishes are
 * cooked to order and have no cap. A number is the exception.
 */
interface Draft {
  onMenu: boolean
  limit: number | null
  priceOverride: string
  sold: number
}

const OFF_MENU: Draft = { onMenu: false, limit: null, priceOverride: '', sold: 0 }

/** Two-state control: unlimited, or a number. Clearer than a checkbox + field. */
function LimitControl({
  draft,
  onChange,
  disabled,
  label,
}: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  disabled: boolean
  label: string
}) {
  const unlimited = draft.limit === null

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-outline-variant">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ limit: null })}
          aria-pressed={unlimited}
          className={`px-3 py-1.5 text-label-lg transition-colors disabled:opacity-50 ${
            unlimited
              ? 'bg-secondary text-on-secondary font-semibold'
              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          Unlimited
        </button>
        <button
          type="button"
          disabled={disabled}
          // Seed from what has already sold so the cap can never start invalid.
          onClick={() => onChange({ limit: Math.max(draft.sold, 20) })}
          aria-pressed={!unlimited}
          className={`border-l border-outline-variant px-3 py-1.5 text-label-lg transition-colors disabled:opacity-50 ${
            !unlimited
              ? 'bg-primary-container text-on-primary font-semibold'
              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          Limit
        </button>
      </div>

      {unlimited ? (
        <span className="text-label-md text-on-surface-variant">No cap</span>
      ) : (
        <Input
          type="number"
          min={draft.sold}
          value={draft.limit ?? 0}
          onChange={(e) => onChange({ limit: Number(e.target.value) })}
          className="w-24 py-1.5"
          aria-label={`Daily limit for ${label}`}
          disabled={disabled}
        />
      )}
    </div>
  )
}

export default function DailyStock() {
  const [serviceDate, setServiceDate] = useState(todayISO())
  const { data: items = [], isLoading: loadingItems } = useGetMenuItemsQuery()
  const { data: daily = [], isLoading: loadingDaily } = useGetDailyMenuQuery(serviceDate)
  const [save, { isLoading: saving }] = useSetDailyMenuMutation()

  const [draft, setDraft] = useState<Record<number, Draft>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Seed from what is already published for this date.
  useEffect(() => {
    const next: Record<number, Draft> = {}
    for (const row of daily) {
      next[row.menu_item_id] = {
        onMenu: row.is_available,
        limit: row.qty_total,
        priceOverride: row.price_override ?? '',
        sold: row.qty_sold,
      }
    }
    setDraft(next)
  }, [daily, serviceDate])

  const onMenuCount = useMemo(
    () => Object.values(draft).filter((d) => d.onMenu).length,
    [draft],
  )

  if (loadingItems || loadingDaily)
    return (
      <PageSkeleton
        eyebrow="Service"
        title="Today's Menu"
        description="Choose which dishes are on sale. Most are unlimited — set a limit only where you actually have one."
        rows={8}
      />
    )

  function update(itemId: number, patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? OFF_MENU), ...patch } }))
  }

  function setAll(patch: Partial<Draft>) {
    setDraft((prev) => {
      const next: Record<number, Draft> = {}
      for (const item of items) {
        next[item.id] = { ...(prev[item.id] ?? OFF_MENU), ...patch }
      }
      return next
    })
  }

  async function handleSave() {
    setMessage('')
    setError('')

    const entries = items
      .filter((item) => draft[item.id]?.onMenu)
      .map((item) => {
        const row = draft[item.id]
        return {
          menu_item_id: item.id,
          // Omitting qty_total is how the API expresses "unlimited".
          qty_total: row.limit,
          is_available: true,
          price_override: row.priceOverride ? row.priceOverride : null,
        }
      })

    if (entries.length === 0) {
      setError('Put at least one dish on the menu before publishing.')
      return
    }

    try {
      await save({ service_date: serviceDate, entries }).unwrap()
      setMessage(`Published ${entries.length} dish${entries.length === 1 ? '' : 'es'} for ${serviceDate}.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not publish the menu.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Today's Menu"
        description="Choose which dishes are on sale. Most are unlimited — set a limit only where you actually have one."
        actions={
          <Input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="w-44"
            aria-label="Service date"
          />
        }
      />

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="restaurant_menu" title="No dishes in the catalogue">
            Add dishes under Menu &amp; Pricing before publishing a day.
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* ── Bulk actions ── */}
          <Card className="flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-label-lg text-on-surface-variant">Quick set:</span>
            <Button variant="secondary" icon="done_all" onClick={() => setAll({ onMenu: true, limit: null })}>
              All on, unlimited
            </Button>
            <Button variant="ghost" icon="all_inclusive" onClick={() => setAll({ limit: null })}>
              Clear all limits
            </Button>
            <Button variant="ghost" icon="remove_done" onClick={() => setAll({ onMenu: false })}>
              Take all off
            </Button>
            <span className="ml-auto text-label-lg text-on-surface-variant">
              <b className="text-primary">{onMenuCount}</b> of {items.length} on the menu
            </span>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-surface-container-low">
                  <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                    <th className="px-5 py-3 font-semibold">On menu</th>
                    <th className="px-3 py-3 font-semibold">Dish</th>
                    <th className="px-3 py-3 text-right font-semibold">Price</th>
                    <th className="px-3 py-3 font-semibold">Availability</th>
                    <th className="px-3 py-3 font-semibold">Sold</th>
                    <th className="px-5 py-3 font-semibold">Price today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {items.map((item) => {
                    const row = draft[item.id] ?? OFF_MENU
                    const off = !row.onMenu

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-surface-container-low ${off ? 'opacity-55' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            checked={row.onMenu}
                            onChange={(e) => update(item.id, { onMenu: e.target.checked })}
                            className="h-4 w-4 accent-[#1b6b44]"
                            aria-label={`Put ${item.name} on the menu`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-body-md font-medium text-primary">{item.name}</p>
                          <p className="text-label-md text-on-surface-variant">
                            {item.category_name} · {item.vendor_name}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right text-body-md tabular">
                          {formatMoney(item.selling_price)}
                        </td>
                        <td className="px-3 py-3">
                          <LimitControl
                            draft={row}
                            disabled={off}
                            label={item.name}
                            onChange={(patch) => update(item.id, patch)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {row.sold > 0 ? (
                            <Badge tone={row.limit !== null && row.sold >= row.limit ? 'danger' : 'success'}>
                              {row.sold} sold
                              {row.limit !== null ? ` / ${row.limit}` : ''}
                            </Badge>
                          ) : (
                            <span className="text-label-md text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={row.priceOverride}
                            onChange={(e) => update(item.id, { priceOverride: e.target.value })}
                            placeholder="Default"
                            className="w-28 py-1.5"
                            aria-label={`Price override for ${item.name}`}
                            disabled={off}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
              <Icon name="info" className="text-[16px]" />
              A limit can't be set below what has already sold — switch that dish to unlimited instead.
            </p>
            <Button onClick={handleSave} loading={saving} icon="publish">
              Publish menu
            </Button>
          </div>
        </>
      )}
    </>
  )
}
