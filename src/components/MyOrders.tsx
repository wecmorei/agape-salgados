import { useEffect, useMemo, useState } from 'react'
import {
  formatAddress,
  formatBRL,
  formatPhone,
  isValidPhone,
  normalizePhone,
} from '../seed'
import { useStore } from '../store'
import type { Order, OrderStatus } from '../types'

const STATUS_STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'new', label: 'Pedido recebido', hint: 'A loja recebeu o seu pedido' },
  { status: 'preparing', label: 'Em preparo', hint: 'Seus salgados estão sendo preparados' },
  { status: 'out', label: 'Saiu para entrega', hint: 'O pedido está a caminho' },
  { status: 'done', label: 'Entregue', hint: 'Pedido concluído' },
]

const STATUS_INDEX: Record<OrderStatus, number> = {
  new: 0,
  preparing: 1,
  out: 2,
  done: 3,
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrderTrack({ status }: { status: OrderStatus }) {
  const current = STATUS_INDEX[status]
  return (
    <ol className="order-track" aria-label="Status do pedido">
      {STATUS_STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'todo'
        return (
          <li key={step.status} className={`track-step ${state}`}>
            <span className="track-dot" aria-hidden="true" />
            <div className="track-text">
              <strong>{step.label}</strong>
              {index === current && <small>{step.hint}</small>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function OrderItems({ order }: { order: Order }) {
  const { data } = useStore()
  return (
    <ul className="my-order-items">
      {order.items.map((line) => {
        const product = data.products.find((item) => item.id === line.productId)
        return (
          <li key={`${order.id}-${line.productId}`}>
            {line.qty}× {product?.name ?? 'Item removido'}
            {line.note ? <small> · {line.note}</small> : null}
          </li>
        )
      })}
    </ul>
  )
}

export function MyOrders({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useStore()
  const [viewPhone, setViewPhone] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const known = normalizePhone(data.lastPhone)
    setViewPhone(known)
    setPhoneInput(formatPhone(known))
    setError('')
  }, [open, data.lastPhone])

  const orders = useMemo(() => {
    if (!viewPhone) return []
    return data.orders
      .filter((item) => normalizePhone(item.phone) === viewPhone)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.orders, viewPhone])

  const active = orders.filter((item) => item.status !== 'done')
  const past = orders.filter((item) => item.status === 'done')

  if (!open) return null

  function findOrders(event: React.FormEvent) {
    event.preventDefault()
    if (!isValidPhone(phoneInput)) {
      setError('Informe um telefone válido com DDD.')
      return
    }
    setError('')
    setViewPhone(normalizePhone(phoneInput))
  }

  return (
    <>
      <button className="sheet-backdrop" type="button" aria-label="Fechar" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Meus pedidos">
        <p className="step-hint">Acompanhe o preparo e veja seus pedidos anteriores</p>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Meus pedidos
        </h2>

        {!viewPhone ? (
          <form onSubmit={findOrders}>
            <p className="muted">
              Informe o telefone usado no pedido para ver o status e o histórico.
            </p>
            <label>
              Telefone com DDD
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                autoFocus
              />
            </label>
            {error && <p className="warn">{error}</p>}
            <div className="checkout-actions">
              <button className="btn dark" type="submit">
                Ver meus pedidos
              </button>
              <button className="btn ghost" type="button" onClick={onClose}>
                Fechar
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="my-orders-phone">
              {formatPhone(viewPhone)}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setViewPhone('')
                  setPhoneInput('')
                }}
              >
                Trocar telefone
              </button>
            </p>

            {orders.length === 0 && (
              <p className="empty">
                Nenhum pedido encontrado para este telefone neste aparelho.
              </p>
            )}

            {active.length > 0 && (
              <section className="my-orders-group">
                <h3 className="my-orders-title">Em andamento</h3>
                {active.map((order) => (
                  <article className="my-order-card active" key={order.id}>
                    <header>
                      <strong>Pedido #{order.id}</strong>
                      <span className="muted">{formatWhen(order.createdAt)}</span>
                    </header>
                    <OrderTrack status={order.status} />
                    <OrderItems order={order} />
                    <p className="muted my-order-address">{formatAddress(order.address)}</p>
                    <div className="my-order-total">
                      <span>Total</span>
                      <span>{formatBRL(order.total)}</span>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {past.length > 0 && (
              <section className="my-orders-group">
                <h3 className="my-orders-title">Anteriores</h3>
                {past.map((order) => (
                  <article className="my-order-card" key={order.id}>
                    <header>
                      <strong>Pedido #{order.id}</strong>
                      <span className="status-pill status-done">Entregue</span>
                    </header>
                    <span className="muted">{formatWhen(order.createdAt)}</span>
                    <OrderItems order={order} />
                    <div className="my-order-total">
                      <span>Total</span>
                      <span>{formatBRL(order.total)}</span>
                    </div>
                  </article>
                ))}
              </section>
            )}

            <button className="btn ghost" type="button" style={{ marginTop: 12 }} onClick={onClose}>
              Fechar
            </button>
          </>
        )}
      </div>
    </>
  )
}

export function activeOrderCount(orders: Order[], phone: string) {
  const normalized = normalizePhone(phone)
  if (!normalized) return 0
  return orders.filter(
    (item) => normalizePhone(item.phone) === normalized && item.status !== 'done',
  ).length
}
