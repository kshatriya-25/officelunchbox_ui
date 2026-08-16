import { useState } from 'react'
import { useGetAdminOrdersQuery, useReconcilePaymentMutation } from '../../store/api'
import { errorMessage } from '../../store/baseQuery'
import { formatMoney, formatTime, todayISO } from '../../lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  SkeletonRows,
} from '../../components/ui'

export default function Payments() {
  const [serviceDate, setServiceDate] = useState(todayISO())
  const { data, isLoading } = useGetAdminOrdersQuery({
    service_date: serviceDate,
    unpaid_only: true,
    page_size: 200,
  })
  const [reconcile, { isLoading: saving }] = useReconcilePaymentMutation()
  const [error, setError] = useState('')

  const orders = data?.orders ?? []
  const outstanding = orders.reduce((sum, order) => sum + Number(order.total), 0)

  async function mark(id: number, status: string) {
    setError('')
    try {
      await reconcile({ id, payment_status: status }).unwrap()
    } catch (err) {
      setError(errorMessage(err, 'Could not update that payment.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Reconciliation"
        title="Payments"
        description="Orders are confirmed the moment they're placed, so this is where money gets matched. Check each UPI reference against your bank statement before the vendor cutoff."
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

      <div className="rounded-xl bg-primary-container p-5">
        <p className="text-label-md font-semibold uppercase tracking-widest text-on-primary-container">
          Outstanding
        </p>
        <p className="mt-1 font-display text-display-lg leading-none text-tertiary-fixed-dim tabular">
          {formatMoney(outstanding)}
        </p>
        <p className="mt-2 text-label-lg text-inverse-on-surface">
          across {orders.length} order{orders.length === 1 ? '' : 's'}
        </p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={5} className="p-5" />
        ) : orders.length === 0 ? (
          <EmptyState icon="check_circle" title="Everything is settled">
            No unpaid orders for {serviceDate}.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-surface-container-low">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="px-5 py-3 font-semibold">Token</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">UPI reference</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Reconcile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <p className="font-display text-body-lg font-bold text-primary tabular">
                        {order.token}
                      </p>
                      <p className="text-label-md text-on-surface-variant">
                        {formatTime(order.placed_at)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-body-md font-medium text-primary">{order.customer_name}</p>
                      <p className="text-label-md text-on-surface-variant">
                        {order.customer_phone ?? order.customer_email}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {order.upi_reference ? (
                        <code className="rounded bg-surface-container px-2 py-1 text-label-lg">
                          {order.upi_reference}
                        </code>
                      ) : (
                        <span className="text-label-md italic text-on-surface-variant">
                          Not provided
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right font-display text-body-lg font-bold text-primary tabular">
                      {formatMoney(order.total)}
                    </td>
                    <td className="px-3 py-4">
                      <Badge tone={order.payment_status === 'FAILED' ? 'danger' : 'warning'}>
                        {order.payment_status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          icon="check"
                          disabled={saving}
                          onClick={() => mark(order.id, 'PAID')}
                          className="py-2 text-label-md"
                        >
                          Paid
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={saving}
                          onClick={() => mark(order.id, 'FAILED')}
                          className="py-2 text-label-md text-error"
                        >
                          Failed
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon name="info" className="text-[16px]" />
        Marking an order paid records who reconciled it and when.
      </p>
    </>
  )
}
