import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  formatAddress,
  formatBRL,
  formatPhone,
  isOpenOrder,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
} from '../seed'
import { useStore } from '../store'
import type { Order, OrderStatus } from '../types'
import { OrderReceipt } from './OrderReceipt'

const NEXT_ACTION: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'preparing', label: 'Iniciar preparo' },
  preparing: { status: 'out', label: 'Saiu para entrega' },
  out: { status: 'done', label: 'Marcar entregue' },
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function pendingOrderCount(orders: Order[]) {
  return orders.filter((order) => isOpenOrder(order.status)).length
}

export function KitchenBoard() {
  const { data, setOrderStatus } = useStore()
  const [filter, setFilter] = useState<'open' | 'done'>('open')
  const [printOrder, setPrintOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!printOrder) return
    const clear = () => setPrintOrder(null)
    window.addEventListener('afterprint', clear)
    const timer = window.setTimeout(() => window.print(), 60)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', clear)
    }
  }, [printOrder])

  const list = useMemo(() => {
    const wanted = data.orders.filter((order) =>
      filter === 'open' ? isOpenOrder(order.status) : order.status === 'done',
    )
    return wanted.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.orders, filter])

  const openCount = pendingOrderCount(data.orders)

  return (
    <div>
      <div className="kitchen-toolbar">
        <button
          className={`chip ${filter === 'open' ? 'active' : ''}`}
          type="button"
          onClick={() => setFilter('open')}
        >
          A atender
          {openCount > 0 && <span className="tab-count">{openCount}</span>}
        </button>
        <button
          className={`chip ${filter === 'done' ? 'active' : ''}`}
          type="button"
          onClick={() => setFilter('done')}
        >
          Entregues
        </button>
      </div>

      {list.length === 0 && (
        <p className="empty">
          {filter === 'open'
            ? 'Nenhum pedido na fila. Quando o cliente confirmar, ele aparece aqui.'
            : 'Nenhum pedido entregue ainda.'}
        </p>
      )}

      <div className="kitchen-list">
        {list.map((order) => {
          const action = NEXT_ACTION[order.status]
          return (
            <article className={`kitchen-card status-${order.status}`} key={order.id}>
              <header>
                <div>
                  <strong>Pedido #{order.id}</strong>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {formatWhen(order.createdAt)}
                  </p>
                </div>
                <span className={`status-pill status-${order.status}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </header>

              <ul>
                {order.items.map((line) => {
                  const product = data.products.find((item) => item.id === line.productId)
                  return (
                    <li key={`${order.id}-${line.productId}`}>
                      <span>
                        {line.qty}× {product?.name ?? 'Item removido'}
                      </span>
                      {line.note ? <small> · {line.note}</small> : null}
                    </li>
                  )
                })}
              </ul>

              <p>
                <strong>Cliente</strong>
                <br />
                {formatPhone(order.phone)}
              </p>
              <p>
                <strong>Entrega</strong>
                <br />
                {formatAddress(order.address)}
              </p>
              <p>
                <strong>Pagamento</strong>
                <br />
                {PAYMENT_LABELS[order.paymentMethod]}
                {order.paymentMethod === 'cash' && order.changeFor
                  ? ` · troco para ${formatBRL(order.changeFor)}`
                  : ''}
                {' · '}
                {formatBRL(order.total)}
              </p>

              <div className="kitchen-card-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setPrintOrder(order)}
                >
                  Imprimir
                </button>
                {action && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setOrderStatus(order.id, action.status)}
                  >
                    {action.label}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {printOrder &&
        createPortal(
          <div className="receipt-print" aria-hidden="true">
            <OrderReceipt
              order={printOrder}
              products={data.products}
              storeName={data.settings.name}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
