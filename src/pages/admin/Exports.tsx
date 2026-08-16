import { useState } from 'react'
import {
  useGetVendorExportSummaryQuery,
  useLazyGetVendorMessageQuery,
} from '../../store/api'
import { useAppSelector } from '../../store'
import { formatDateTime, formatMoney, formatTime, todayISO } from '../../lib/format'
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
import type { VendorExportRow } from '../../types'
import { apiUrl, config } from '../../config'

/**
 * Exports are authenticated downloads, so a plain <a href> won't do — the
 * bearer token has to be attached. Fetch, then hand the browser a blob.
 */
function useDownload() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function download(url: string, key: string) {
    setBusy(key)
    setError('')
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `Export failed (${response.status})`)
      }

      // Prefer the server's filename so vendor sheets are consistently named.
      const match = (response.headers.get('content-disposition') ?? '').match(/filename="?([^"]+)"?/)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = match?.[1] ?? 'export'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setBusy(null)
    }
  }

  return { download, busy, error }
}

function VendorCard({
  vendor,
  serviceDate,
  onDownload,
  busy,
}: {
  vendor: VendorExportRow
  serviceDate: string
  onDownload: (url: string, key: string) => void
  busy: string | null
}) {
  const [fetchMessage, { isFetching }] = useLazyGetVendorMessageQuery()
  const [copied, setCopied] = useState(false)
  const [messageError, setMessageError] = useState('')

  async function withMessage(action: (text: string, url: string | null) => void) {
    setMessageError('')
    try {
      const message = await fetchMessage({ vendorId: vendor.vendor_id, serviceDate }).unwrap()
      action(message.text, message.whatsapp_url)
    } catch {
      setMessageError('Could not build the message.')
    }
  }

  async function copyText() {
    await withMessage(async (text) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {
        setMessageError('Clipboard blocked — open WhatsApp instead.')
      }
    })
  }

  function openWhatsApp() {
    withMessage((text, url) => {
      // wa.me pre-fills the message; without a stored phone it opens the
      // contact picker so the operator chooses the chat.
      const target = url
        ? `${url}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(target, '_blank', 'noopener')
    })
  }

  const base = apiUrl(`/admin/exports/vendors/${vendor.vendor_id}?service_date=${serviceDate}`)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/50 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-display text-body-lg font-semibold text-primary">
            {vendor.vendor_name ?? 'Unassigned'}
          </h3>
          <p className="text-label-md text-on-surface-variant">
            {[vendor.contact_person, vendor.phone].filter(Boolean).join(' · ') || 'No contact on file'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {vendor.last_sent_at ? (
            <Badge tone="success" icon="check">Sent {formatTime(vendor.last_sent_at)}</Badge>
          ) : (
            <Badge tone="warning">Not sent</Badge>
          )}
          <div className="text-right">
            <p className="font-display text-body-lg font-bold text-primary tabular">
              {formatMoney(vendor.amount_payable)}
            </p>
            <p className="text-label-md text-on-surface-variant">
              {vendor.total_qty} portions
            </p>
          </div>
        </div>
      </div>

      {/* Exactly what the vendor will receive — checkable before sending. */}
      <table className="w-full text-left">
        <thead>
          <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
            <th className="px-5 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Unit</th>
            <th className="px-5 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {vendor.items.map((line) => (
            <tr key={line.item_name}>
              <td className="px-5 py-2.5 text-body-md text-primary">{line.item_name}</td>
              <td className="px-3 py-2.5 text-right text-body-md font-semibold tabular">{line.quantity}</td>
              <td className="px-3 py-2.5 text-right text-body-md text-on-surface-variant tabular">
                {formatMoney(line.unit_vendor_price)}
              </td>
              <td className="px-5 py-2.5 text-right text-body-md tabular">{formatMoney(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {messageError ? (
        <p className="px-5 pt-3 text-label-md text-error">{messageError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/50 bg-surface-container-low px-5 py-3">
        <Button
          icon="chat"
          onClick={openWhatsApp}
          loading={isFetching}
          className="bg-[#25D366] text-[#0b3d1f] hover:brightness-95"
        >
          Send on WhatsApp
        </Button>
        <Button
          variant="secondary"
          icon={copied ? 'check' : 'content_copy'}
          onClick={copyText}
          loading={isFetching && !copied}
        >
          {copied ? 'Copied' : 'Copy text'}
        </Button>
        <Button
          variant="secondary"
          icon="picture_as_pdf"
          loading={busy === `pdf-${vendor.vendor_id}`}
          onClick={() => onDownload(`${base}&format=pdf`, `pdf-${vendor.vendor_id}`)}
        >
          PDF
        </Button>
        <Button
          variant="ghost"
          icon="table_view"
          loading={busy === `xlsx-${vendor.vendor_id}`}
          onClick={() => onDownload(`${base}&format=xlsx`, `xlsx-${vendor.vendor_id}`)}
        >
          Excel
        </Button>
      </div>
    </Card>
  )
}

export default function Exports() {
  const [serviceDate, setServiceDate] = useState(todayISO())
  const [rangeStart, setRangeStart] = useState(todayISO())
  const { data, isLoading } = useGetVendorExportSummaryQuery(serviceDate, {
    pollingInterval: config.poll.admin,
  })
  const { download, busy, error } = useDownload()
  const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin')

  if (isLoading)
    return (
      <PageSkeleton
        eyebrow="Service"
        title="Vendor Dispatch"
        description="Send each vendor their order, and hand the kitchen and delivery team their sheets."
        rows={5}
      />
    )

  const vendors = data?.vendors ?? []
  const payable = vendors.reduce((sum, v) => sum + Number(v.amount_payable), 0)
  const portions = vendors.reduce((sum, v) => sum + v.total_qty, 0)
  const unsent = vendors.filter((v) => !v.last_sent_at).length

  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Vendor Dispatch"
        description="Today's orders so far, split by vendor. Check the numbers, then send each vendor their sheet."
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

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* ── Snapshot summary ── */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Orders so far', value: String(data?.order_count ?? 0), tone: 'text-primary' },
          { label: 'Portions', value: String(portions), tone: 'text-primary' },
          { label: 'Total payable', value: formatMoney(payable), tone: 'text-primary' },
          {
            label: 'Not yet sent',
            value: `${unsent} of ${vendors.length}`,
            tone: unsent ? 'text-error' : 'text-secondary',
          },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-label-md uppercase tracking-widest text-on-surface-variant">
              {tile.label}
            </p>
            <p className={`mt-1.5 font-display text-headline-md leading-none tabular ${tile.tone}`}>
              {tile.value}
            </p>
          </Card>
        ))}
      </div>

      {data?.generated_at ? (
        <Alert tone="warning">
          These figures are a snapshot as of <b>{formatDateTime(data.generated_at)}</b>. Orders keep
          arriving until the cutoff — every sheet carries this timestamp so vendors know how current
          it is. Re-send after the cutoff for the final numbers.
        </Alert>
      ) : null}

      {/* ── Per vendor ── */}
      {vendors.length === 0 ? (
        <Card>
          <EmptyState icon="storefront" title="No vendor orders yet">
            Nothing has been ordered for {serviceDate}. Sheets appear here as orders come in.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-gutter">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.vendor_id}
              vendor={vendor}
              serviceDate={serviceDate}
              onDownload={download}
              busy={busy}
            />
          ))}
        </div>
      )}

      {/* ── Internal sheets ── */}
      <div className="grid gap-gutter sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-container">
            <Icon name="soup_kitchen" className="text-[22px] text-on-secondary-container" />
          </span>
          <h2 className="font-display text-body-lg font-semibold text-primary">Kitchen prep list</h2>
          <p className="flex-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            Total portions of every dish across all vendors, so the kitchen knows exactly what to make.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon="picture_as_pdf"
              loading={busy === 'prep-pdf'}
              onClick={() => download(apiUrl(`/admin/exports/prep-list?service_date=${serviceDate}&format=pdf`), 'prep-pdf')}
            >
              PDF
            </Button>
            <Button
              variant="ghost"
              icon="table_view"
              loading={busy === 'prep-xlsx'}
              onClick={() => download(apiUrl(`/admin/exports/prep-list?service_date=${serviceDate}&format=xlsx`), 'prep-xlsx')}
            >
              Excel
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed">
            <Icon name="local_shipping" className="text-[22px] text-on-primary-fixed" />
          </span>
          <h2 className="font-display text-body-lg font-semibold text-primary">Delivery run sheet</h2>
          <p className="flex-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            Every box grouped by tech park and drop point, with tokens, phone numbers and a signature
            column. Unpaid orders are flagged to collect.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon="picture_as_pdf"
              loading={busy === 'run-pdf'}
              onClick={() => download(apiUrl(`/admin/exports/run-sheet?service_date=${serviceDate}&format=pdf`), 'run-pdf')}
            >
              PDF
            </Button>
            <Button
              variant="ghost"
              icon="table_view"
              loading={busy === 'run-xlsx'}
              onClick={() => download(apiUrl(`/admin/exports/run-sheet?service_date=${serviceDate}&format=xlsx`), 'run-xlsx')}
            >
              Excel
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Accounting ── */}
      {isAdmin ? (
        <Card className="p-5">
          <h2 className="font-display text-headline-md text-primary">Order & margin report</h2>
          <p className="mt-1 text-label-lg font-normal tracking-normal text-on-surface-variant">
            Every order with vendor cost, revenue and margin. Admin only — never send this to a vendor.
          </p>

          <div className="mt-4 flex flex-col items-end gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="text-label-lg font-semibold text-on-surface-variant">From</span>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="mt-1.5"
              />
            </label>
            <label className="flex-1">
              <span className="text-label-lg font-semibold text-on-surface-variant">To</span>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="mt-1.5"
              />
            </label>
            <Button
              variant="dark"
              icon="table_view"
              loading={busy === 'accounting'}
              onClick={() =>
                download(
                  apiUrl(`/admin/exports/accounting?start_date=${rangeStart}&end_date=${serviceDate}`),
                  'accounting',
                )
              }
            >
              Download report
            </Button>
          </div>
        </Card>
      ) : null}

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Vendor sheets are priced at vendor cost — your markup never appears on them. Every download is
        recorded, so you can always see what a vendor was told to cook.
      </p>
    </>
  )
}
